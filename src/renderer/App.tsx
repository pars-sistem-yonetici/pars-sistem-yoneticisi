import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { categoryIcon, UiIcon } from './uiIcons';
import { CATALOG, CATEGORIES, favicon, recKey, type RecommendedSoftware } from '../shared/catalog';
import { APP_LINKS, DEFAULT_UPDATE_SOURCE } from '../shared/constants';
import { translate, translateFormat } from '../shared/i18n';
import { REG_SCAN_SCOPES } from '../shared/types';
import type {
  AppApi,
  AppUpdateInfo,
  AutorunItem,
  AutorunScanResult,
  BloatwareItem,
  CleanTarget,
  ContextMenuStatus,
  ContextMenuStyle,
  DiskAnalysisResult,
  DiskTreeNode,
  DriverScanResult,
  DuplicateGroup,
  FirewallRule,
  FileScanResult,
  PackageBackupEntry,
  PackageBackupOverview,
  PrivacyTweak,
  RepairKind,
  RepairResult,
  ShellExtensionActionResult,
  ShellExtensionItem,
  InstalledApp,
  InstallProgress,
  Language,
  Leftover,
  LeftoverProgress,
  LogEntry,
  MalwareEngine,
  MalwareScanResult,
  ManagedPolicyFile,
  ManagedPolicyFixId,
  Package,
  PackageManagerStatus,
  Prerequisite,
  RegIssue,
  RegRisk,
  RegScanScope,
  RegStats,
  ScheduleKind,
  ScheduleTask,
  Settings,
  StartupItem,
  StartupTiming,
  SystemSnapshot,
  Theme,
  UpdateDownloadResult,
  UpdateProgress,
} from '../shared/types';

const api: AppApi = window.api;

type Tab = 'home' | 'updates' | 'apps' | 'packages' | 'bloatware' | 'startup' | 'firewall' | 'malware' | 'disk' | 'duplicates' | 'analysis' | 'repair' | 'drivers' | 'recommended' | 'registry' | 'schedule' | 'search' | 'autoruns' | 'privacy' | 'contextmenu' | 'debugging' | 'settings';

const REG_SCOPE_LABELS: Record<RegScanScope, string> = {
  uninstall: 'Uninstall girdileri',
  'app-paths': 'App Paths',
  'com-shell': 'COM / Shell',
  'com-hijack': 'COM geçersiz kılma',
  'file-assoc': 'Dosya ilişkilendirme',
  service: 'Hizmet yolları',
  'shared-dll': 'SharedDLLs',
  font: 'Yazı tipleri',
  odbc: 'ODBC',
};

const REG_RISK_LABELS: Record<RegRisk, string> = {
  info: 'Bilgi',
  warning: 'Uyarı',
  critical: 'Kritik',
};

const SCHEDULE_INFO: Record<ScheduleKind, { description: string; icon: string }> = {
  'weekly-full': { description: 'Her hafta belirlenen günde kapsamlı temizlik (Windows Update indirmeleri hariç).', icon: '◷' },
  'daily-light': { description: 'Her gün geçici dosyalar, önbellekler ve DNS temizliği.', icon: '◴' },
  'monthly-deep': { description: 'Ayda bir kez Windows Update indirmeleri dahil derin temizlik.', icon: '◳' },
  custom: { description: 'Belirlediğiniz aralıkla tekrarlanan özel temizlik.', icon: '◵' },
};

const MALWARE_ENGINES: Array<{ id: MalwareEngine; label: string }> = [
  { id: 'signatures', label: 'İmzalar' },
  { id: 'heuristics', label: 'Sezgisel analiz' },
  { id: 'scripts', label: 'Betik analizi' },
  { id: 'integrity', label: 'Sistem bütünlüğü' },
  { id: 'persistence', label: 'Kalıcılık taraması' },
];

interface RepairAction {
  id: RepairKind;
  icon: string;
  title: string;
  detail: string;
  readOnly?: boolean;
  backup?: boolean;
  rebootRequired?: boolean;
  danger?: boolean;
  confirm?: string;
  warning?: string;
}

const REPAIR_GROUPS: Array<{ title: string; description: string; actions: RepairAction[] }> = [
  {
    title: 'Temel onarımlar',
    description: 'Windows yerleşik onarım komutları ve tek tıkla sıralı akış. Uzun sürebilir; işlem sırasında bilgisayarı kapatmayın.',
    actions: [
      { id: 'sfc', icon: '◈', title: 'Sistem dosyası denetimi', detail: 'sfc /scannow — bozuk Windows sistem dosyalarını tarar ve onarır.' },
      { id: 'dism', icon: '⚒', title: 'Windows görüntüsü onarımı', detail: 'DISM /RestoreHealth — bileşen deposunu Windows Update ile onarır.' },
      { id: 'restore-point', icon: '⏱', title: 'Geri yükleme noktası', detail: 'Checkpoint-Computer — değişiklik öncesinde geri dönüş noktası oluşturur.' },
      {
        id: 'full-sequence', icon: '⚡', title: 'Tek tıkla sıralı onarım', backup: true,
        detail: 'Geri yükleme noktası → DISM /RestoreHealth → sfc /scannow → sfc /verifyonly. Bir adım başarısız olursa devam edilmez.',
        confirm: 'Önce geri yükleme noktası oluşturulacak; oluşturulamazsa hiçbir değişiklik yapılmayacak. Ardından DISM, SFC ve doğrulama sırayla çalışacak. Devam edilsin mi?',
      },
    ],
  },
  {
    title: 'Salt okunur tanılama',
    description: 'Yalnızca rapor üretir; sistem dosyası, kayıt defteri veya hizmet değiştirmez. Onay dışında ek işlem gerekmez.',
    actions: [
      { id: 'dism-check', icon: '🔎', title: 'DISM hızlı durum kontrolü', detail: 'DISM /CheckHealth — görüntünün bozuk bayraklı olup olmadığını saniyeler içinde bildirir.', readOnly: true },
      { id: 'dism-scan', icon: '🔬', title: 'DISM bileşen deposu taraması', detail: 'DISM /ScanHealth — bileşen deposunu tarar, onarmaz; birkaç dakika sürebilir.', readOnly: true },
      { id: 'dism-analyze', icon: '📊', title: 'Bileşen deposu analizi', detail: 'DISM /AnalyzeComponentStore — WinSxS boyutunu ve temizlenebilecek paketleri gösterir.', readOnly: true },
      { id: 'sfc-verify', icon: '🩺', title: 'Sistem dosyası doğrulaması', detail: 'sfc /verifyonly — dosyaları tarar, düzeltmeden rapor verir.', readOnly: true },
      { id: 'chkdsk-scan', icon: '💽', title: 'Disk çevrimiçi taraması', detail: 'chkdsk <sistem sürücüsü> /scan — sistem açıkken güvenli tarama; /f ve /r kullanılmaz.', readOnly: true },
    ],
  },
  {
    title: 'Windows Update ve ağ',
    description: 'Servisler durdurulup klasörler ".old" adıyla korunur; kayıt defteri yedeği alınamazsa değişiklik yapılmaz.',
    actions: [
      { id: 'update-reset', icon: '⬆️', title: 'Windows Update bileşenlerini sıfırla', detail: 'wuauserv, cryptsvc, bits, msiserver durdurulur; SoftwareDistribution ve catroot2 silinmez, ".old" olarak yeniden adlandırılır.', backup: true, rebootRequired: true },
      { id: 'network-reset', icon: '🌐', title: 'Ağ yığınını sıfırla', detail: 'netsh winsock reset, netsh int ip reset, ipconfig /flushdns ve /registerdns. Bağlantı geçici olarak kesilebilir.', backup: true, rebootRequired: true },
    ],
  },
  {
    title: 'Bakım onarımları',
    description: 'Önbellek ve kuyruk temizliği. Yedek zorunlu olan işlemlerde yedek başarısızsa temizlik yapılmaz.',
    actions: [
      { id: 'component-cleanup', icon: '🧱', title: 'Bileşen deposu temizliği', detail: 'DISM /StartComponentCleanup — eski bileşenleri kaldırır. /ResetBase kullanılmaz; güncellemeler kaldırılabilir kalır.', backup: true },
      { id: 'store-cache', icon: '🛍️', title: 'Store önbelleğini sıfırla', detail: 'wsreset.exe — Microsoft Store önbelleğini temizler; yeniden oturum açma isteyebilir.' },
      { id: 'search-index', icon: '🔍', title: 'Windows Search dizinini yeniden oluştur', detail: 'WSearch durdurulur, dizin sıfırlanır ve servis yeniden başlatılır. Yeniden indeksleme birkaç dakika sürer.', backup: true },
      { id: 'print-spooler', icon: '🖨️', title: 'Yazıcı kuyruğunu temizle', detail: 'Spooler durdurulur, bekleyen yazdırma dosyaları önce yedeklenip sonra silinir; servis yeniden başlatılır.', backup: true },
    ],
  },
];

const WINRE_COMMANDS = [
  'chkdsk C: /f /r',
  'bootrec /scanos',
  'bootrec /fixmbr',
  'bootrec /rebuildbcd',
  'bcdboot C:\\Windows /l tr-TR',
].join('\n');

const BCD_ACTION: RepairAction = {
  id: 'bcd-backup', icon: '💾', title: 'BCD yedeği al', backup: true,
  detail: 'bcdedit /export ile önyükleme yapılandırmasını yedekler. Gelişmiş başlatmada komut uygulamadan önce bunu kullanın.',
};

const RESTART_ACTION: RepairAction = {
  id: 'advanced-restart', icon: '↻', title: 'Gelişmiş başlatmaya yeniden başlat', backup: true, danger: true, rebootRequired: true,
  detail: 'shutdown /r /o ile Windows Kurtarma Ortamı’na yeniden başlatır. Önce BCD yedeği alınır.',
  confirm: 'Bilgisayar 10 saniye içinde Gelişmiş başlatma seçenekleriyle yeniden başlayacak. Kaydedilmemiş işler kapanacak; önce BCD yedeği alınacak. Devam edilsin mi?',
  warning: 'Bu işlem oturumu kapatır. Tüm dosyalarınızı kaydettiğinizden emin olun.',
};

interface Toast {
  kind: 'ok' | 'error' | 'info';
  text: string;
}

interface ConfirmOption {
  label: string;
  value: string;
  kind?: 'danger' | 'primary' | 'ghost';
}

type MeterIconKind = 'cpu' | 'ram' | 'disk';

interface ConfirmState {
  title: string;
  message: string;
  warning?: string;
  options: ConfirmOption[];
  onChoose: (value: string) => void | Promise<void>;
}

interface LeftoverTarget {
  label: string;
  apps: InstalledApp[];
}

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'home', label: 'Anasayfa', icon: '⌂' },
  { id: 'updates', label: 'Güncellemeler', icon: '↑' },
  { id: 'apps', label: 'Kurulu Uygulamalar', icon: '▦' },
  { id: 'packages', label: 'Yazılım Yedeği', icon: '▣' },
  { id: 'bloatware', label: 'Gereksiz Yazılım Temizleyici', icon: '⌫' },
  { id: 'startup', label: 'Başlangıç', icon: '⏻' },
  { id: 'firewall', label: 'Güvenlik Duvarı', icon: '⚑' },
  { id: 'malware', label: 'Kötü Amaçlı Yazılım', icon: '☣' },
  { id: 'disk', label: 'Disk Temizleme', icon: '◫' },
  { id: 'duplicates', label: 'Dosya Tarayıcı', icon: '⧉' },
  { id: 'analysis', label: 'Disk Analizi', icon: '▤' },
  { id: 'repair', label: 'Sistem Onarımı', icon: '✚' },
  { id: 'drivers', label: 'Sürücüler', icon: '⚒' },
  { id: 'recommended', label: 'Uygulama Kütüphanesi', icon: '✦' },
  { id: 'registry', label: 'Kayıt Defteri', icon: '⚙' },
  { id: 'schedule', label: 'Zamanlama', icon: '◷' },
  { id: 'search', label: 'Uygulama Ara', icon: '⌕' },
  { id: 'autoruns', label: 'Gelişmiş Başlangıç', icon: '➤' },
  { id: 'privacy', label: 'Gizlilik Ayarları', icon: '◈' },
  { id: 'contextmenu', label: 'Sağ tık menüsü', icon: '≡' },
  { id: 'debugging', label: 'Hata Ayıklama', icon: '⚗' },
  { id: 'settings', label: 'Ayarlar', icon: '⚙' },
];

const TAB_GROUPS: Array<{ id: string; label: string; icon: string; tabs: Tab[] }> = [
  { id: 'general', label: 'Genel', icon: '🧭', tabs: ['search', 'recommended'] },
  { id: 'software', label: 'Yazılım Yönetimi', icon: '📦', tabs: ['updates', 'apps', 'packages', 'drivers'] },
  { id: 'maintenance', label: 'Sistem Bakımı', icon: '🛠️', tabs: ['disk', 'duplicates', 'analysis', 'repair', 'registry', 'bloatware', 'startup', 'schedule'] },
  { id: 'security', label: 'Güvenlik', icon: '🛡️', tabs: ['firewall', 'malware', 'autoruns', 'privacy'] },
  // Sağ tık menüsü Windows kabuğunu kişiselleştirir; hata ayıklamadan ayrıldı.
  { id: 'personalization', label: 'Kişiselleştirme', icon: '🎨', tabs: ['contextmenu'] },
  // Ayarlar sol alt köşeye sabitlendi; Yapılandırma yalnızca hata ayıklamayı içerir.
  { id: 'config', label: 'Yapılandırma', icon: '⚙️', tabs: ['debugging'] },
];

/** Anasayfa bağımsız sekmedir; hiçbir gruba ait değildir. */
function groupForTab(id: Tab): string {
  if (id === 'home') return '';
  return TAB_GROUPS.find((group) => group.tabs.includes(id))?.id ?? '';
}

function sizeText(size: number): string {
  if (!size) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = size;
  for (const unit of units) {
    if (value < 1024 || unit === 'TB') return unit === 'B' ? `${Math.round(value)} B` : `${value.toFixed(1)} ${unit}`;
    value /= 1024;
  }
  return `${value.toFixed(1)} TB`;
}

interface TreemapCell {
  node: DiskTreeNode;
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
}

/** Basit, deterministik treemap: alan oranına göre sıralı şerit yerleşimi. */
function treemap(nodes: DiskTreeNode[], width = 100, height = 100): TreemapCell[] {
  const visible = [...nodes].filter((node) => node.size > 0).sort((a, b) => b.size - a.size);
  const total = visible.reduce((sum, node) => sum + node.size, 0);
  if (!total) return [];
  const cells: TreemapCell[] = [];
  let cursor = 0;
  visible.forEach((node, index) => {
    const ratio = node.size / total;
    const last = index === visible.length - 1;
    const w = last ? width - cursor : width * ratio;
    if (w <= 0) return;
    cells.push({ node, x: cursor, y: 0, w, h: height, depth: 0 });
    cursor += w;
  });
  return cells;
}

function appKey(app: InstalledApp): string {
  return app.ident || `${app.name}|${app.publisher}`;
}

/** Kurulu kimlikleri hem düz hem kaynaklı biçimde tutar; katalog recKey() ile eşleşir. */
function installedIdSet(list: InstalledApp[]): Set<string> {
  return new Set(list.flatMap((app) => (app.ident ? [app.ident, `winget:${app.ident}`] : [])));
}

function pkgKey(pkg: Package): string {
  return pkg.ident || pkg.name;
}

function cleanExtension(value: string): string {
  const cleaned = value.trim().replace(/^\*?\.?/, '').toLowerCase();
  return /^[a-z0-9]{1,12}$/.test(cleaned) ? `.${cleaned}` : '';
}

function parseExtensions(value: string): string[] {
  return [...new Set(value.split(/[,;\s]+/).map(cleanExtension).filter(Boolean))];
}

function localeName(code: string, lang: string): string {
  try {
    return new Intl.DisplayNames([lang === 'tr' ? 'tr' : 'en'], { type: 'language' }).of(code) || code;
  } catch {
    return code;
  }
}

function Avatar({ name, src, color = '#2c2c31' }: { name: string; src?: string; color?: string }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return <img className="avatar" src={src} alt="" onError={() => setFailed(true)} />;
  }
  return (
    <div className="avatar avatar-letter" style={{ background: color }}>
      {name.trim().charAt(0).toLocaleUpperCase('tr-TR')}
    </div>
  );
}

/** Güncelleme satırı için önce kurulu uygulama ikonunu, sonra katalog favicon'unu kullanır. */
function updateIcon(pkg: Package, installed: InstalledApp[]): string | undefined {
  const fromInstalled = installed.find((app) => app.ident === pkg.ident)?.icon;
  if (fromInstalled) return fromInstalled;
  const source = pkg.source || 'winget';
  const catalogItem = CATALOG.find((item) =>
    item.ident === pkg.ident && (item.source || 'winget') === source);
  return catalogItem ? favicon(catalogItem) : undefined;
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="switch" aria-hidden="true" />
    </label>
  );
}

function MeterIcon({ kind }: { kind: MeterIconKind }) {
  if (kind === 'cpu') {
    return (
      <>
        <rect x="7" y="7" width="10" height="10" rx="2" />
        <rect x="10" y="10" width="4" height="4" rx="1" />
        <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
      </>
    );
  }
  if (kind === 'ram') {
    return (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M7 10v4M11 10v4M15 10v4M19 10v4M7 18v2M17 18v2" />
      </>
    );
  }
  return (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" />
      <path d="M16 8h.01" />
    </>
  );
}

function Meter({ label, value, text, tone, icon }: { label: string; value: number; text: string; tone: string; icon: MeterIconKind }) {
  return (
    <div className="card meter-card">
      <div className="card-top meter-top">
        <span className="meter-label-wrap">
          <span className="meter-icon-box" style={{ color: tone }}>
            <svg className="meter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <MeterIcon kind={icon} />
            </svg>
          </span>
          <span className="card-label">{label}</span>
        </span>
        <span className="card-value">{text}</span>
      </div>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: tone }} />
      </div>
    </div>
  );
}

function ConfirmDialog({ state, onClose }: { state: ConfirmState; onClose: () => void }) {
  return (
    <div className="modal-backdrop modal-front" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-label={state.title}>
        <div className="modal-icon">!</div>
        <h2><UiIcon icon="⚠️" />{state.title}</h2>
        <p>{state.message}</p>
        {state.warning && <div className="danger-zone"><b>DİKKAT</b><p>{state.warning}</p></div>}
        <div className="modal-actions">
          {state.options.map((option) => (
            <button
              key={option.value}
              className={`btn ${option.kind === 'danger' ? 'btn-danger' : option.kind === 'primary' ? 'btn-primary' : ''}`}
              onClick={async () => {
                await state.onChoose(option.value);
                onClose();
              }}
            >
              <UiIcon icon={option.kind === 'danger' ? '⚠️' : option.kind === 'primary' ? '✅' : '↩️'} />{option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuStatus | null>(null);
  const [shellExtensions, setShellExtensions] = useState<ShellExtensionItem[]>([]);
  const [shellExtensionBusy, setShellExtensionBusy] = useState<string | null>(null);
  const [managedFixes, setManagedFixes] = useState<ManagedPolicyFile[]>([]);
  const [closePrompt, setClosePrompt] = useState(false);
  const [rememberClose, setRememberClose] = useState(false);
  const [appUpdate, setAppUpdate] = useState<AppUpdateInfo | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress | null>(null);
  const [downloadedUpdate, setDownloadedUpdate] = useState<UpdateDownloadResult | null>(null);
  const [updateSourceInput, setUpdateSourceInput] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [maximized, setMaximized] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [backupPath, setBackupPath] = useState('');
  const [locales, setLocales] = useState<string[]>(['tr', 'en']);
  const [dictionary, setDictionary] = useState<Record<string, string>>({});
  const [prerequisites, setPrerequisites] = useState<Prerequisite[]>([]);
  const [prereqBusy, setPrereqBusy] = useState<string | null>(null);
  const [folderInput, setFolderInput] = useState('');
  const [extensionInput, setExtensionInput] = useState('');
  const lang: Language = settings?.language ?? 'tr';
  const t = useCallback((text: string) => translate(text, lang, dictionary), [lang, dictionary]);
  const tf = useCallback((text: string, vars: Record<string, string | number>) => translateFormat(text, lang, vars, dictionary), [lang, dictionary]);
  const initialized = useRef(false);
  const prereqPrompted = useRef(false);
  const updatePrompted = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [drives, setDrives] = useState<string[]>(['C:\\']);
  const [recycleDrives, setRecycleDrives] = useState<Set<string>>(new Set(['C:\\']));
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null);
  const [driveSnapshots, setDriveSnapshots] = useState<SystemSnapshot[]>([]);
  const [driveLabels, setDriveLabels] = useState<Record<string, string>>({});
  const [drivesLoading, setDrivesLoading] = useState(true);

  const [updates, setUpdates] = useState<Package[]>([]);
  const [selectedUpdates, setSelectedUpdates] = useState<Set<string>>(new Set());
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [appQuery, setAppQuery] = useState('');
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
  const [leftoverTarget, setLeftoverTarget] = useState<LeftoverTarget | null>(null);
  const [leftoverProgress, setLeftoverProgress] = useState<LeftoverProgress | null>(null);
  const [leftoverScanning, setLeftoverScanning] = useState(false);
  const leftoverRequestId = useRef('');
  const leftoverCancelled = useRef(false);
  const [startupItems, setStartupItems] = useState<StartupItem[]>([]);
  const [startupTimings, setStartupTimings] = useState<StartupTiming[]>([]);
  const [firewallRules, setFirewallRules] = useState<FirewallRule[]>([]);
  const [firewallFilter, setFirewallFilter] = useState<'all' | 'critical' | 'medium'>('all');
  const [firewallBackupPath, setFirewallBackupPath] = useState('');
  const [malwareEngines, setMalwareEngines] = useState<MalwareEngine[]>(MALWARE_ENGINES.map((engine) => engine.id));
  const [malwareResult, setMalwareResult] = useState<MalwareScanResult | null>(null);
  const [schedules, setSchedules] = useState<ScheduleTask[]>([]);
  const [leftovers, setLeftovers] = useState<Leftover[]>([]);
  const [selectedLeftovers, setSelectedLeftovers] = useState<Set<string>>(new Set());
  const [bloatware, setBloatware] = useState<BloatwareItem[]>([]);
  const [selectedBloatware, setSelectedBloatware] = useState<Set<string>>(new Set());

  const [diskTargets, setDiskTargets] = useState<CleanTarget[]>([]);
  const [selectedDisk, setSelectedDisk] = useState<Set<string>>(new Set());
  const [driverScan, setDriverScan] = useState<DriverScanResult | null>(null);
  const [selectedDrivers, setSelectedDrivers] = useState<Set<string>>(new Set());
  const [driverQuery, setDriverQuery] = useState('');
  const [driverBackupBefore, setDriverBackupBefore] = useState(true);
  const [regIssues, setRegIssues] = useState<RegIssue[]>([]);
  const [regStats, setRegStats] = useState<RegStats | null>(null);
  const [selectedReg, setSelectedReg] = useState<Set<string>>(new Set());
  const [regScopes, setRegScopes] = useState<RegScanScope[]>([...REG_SCAN_SCOPES]);
  const [regFilter, setRegFilter] = useState<'all' | 'broken' | 'warning' | 'critical'>('all');

  // Paket yedeği
  const [packageBackups, setPackageBackups] = useState<PackageBackupOverview | null>(null);
  const [packageEntries, setPackageEntries] = useState<PackageBackupEntry[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());
  const [packageFile, setPackageFile] = useState('');
  // Dosya tarayıcı
  const [fileRoots, setFileRoots] = useState<string[]>([]);
  const [referenceRoots, setReferenceRoots] = useState<string[]>([]);
  const [fileMinSize, setFileMinSize] = useState('128');
  const [fileResult, setFileResult] = useState<FileScanResult | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  // Disk analizi
  const [analysisRoot, setAnalysisRoot] = useState('');
  const [analysisResult, setAnalysisResult] = useState<DiskAnalysisResult | null>(null);
  // Sistem onarımı
  const [repairResult, setRepairResult] = useState<RepairResult | null>(null);
  const [repairBackupPath, setRepairBackupPath] = useState('');
  // Gelişmiş başlangıç
  const [autoruns, setAutoruns] = useState<AutorunScanResult | null>(null);
  const [autorunFilter, setAutorunFilter] = useState<'all' | AutorunItem['category'] | 'elevated'>('all');
  // Gizlilik
  const [privacyTweaks, setPrivacyTweaks] = useState<PrivacyTweak[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Package[]>([]);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [recCategory, setRecCategory] = useState('Tümü');
  const [recQuery, setRecQuery] = useState('');
  const [selectedRec, setSelectedRec] = useState<Set<string>>(new Set());
  const [recSource, setRecSource] = useState<'all' | 'winget' | 'choco' | 'npm' | 'scoop'>('all');
  const [managerStatus, setManagerStatus] = useState<PackageManagerStatus[]>([]);
  const [installQueue, setInstallQueue] = useState<InstallProgress | null>(null);
  const [installing, setInstalling] = useState(false);
  const installRequestId = useRef('');
  const [updateQueueProgress, setUpdateQueueProgress] = useState<InstallProgress | null>(null);
  const [updatingQueue, setUpdatingQueue] = useState(false);
  const updateQueueRequestId = useRef('');
  const [networkBytesPerSecond, setNetworkBytesPerSecond] = useState(0);

  const firewallCritical = firewallRules.filter((rule) => rule.severity === 'critical').length;
  const firewallMedium = firewallRules.filter((rule) => rule.severity === 'medium').length;
  const visibleFirewall = firewallFilter === 'all'
    ? firewallRules
    : firewallRules.filter((rule) => rule.severity === firewallFilter);
  const malwareFindings = [...(malwareResult?.findings ?? [])].sort((a, b) => {
    const rank = { critical: 0, medium: 1, low: 2, info: 3 };
    return rank[a.severity] - rank[b.severity];
  });

  const notify = useCallback((kind: Toast['kind'], text: string) => setToast({ kind, text }), []);

  useEffect(() => api.onLog((entry) => setLogs((prev) => [...prev.slice(-500), entry])), []);

  useEffect(() => api.onLeftoverProgress((progress) => {
    if (progress.requestId === leftoverRequestId.current) setLeftoverProgress(progress);
  }), []);

  useEffect(() => api.onInstallProgress((progress) => {
    if (progress.requestId !== installRequestId.current) return;
    setInstallQueue(progress);
  }), []);

  useEffect(() => api.onUpdateQueueProgress((progress) => {
    if (progress.requestId !== updateQueueRequestId.current) return;
    setUpdateQueueProgress(progress);
  }), []);

  useEffect(() => {
    if (!updatingQueue && !installing) return;
    let alive = true;
    const sample = () => {
      void api.networkSpeed().then((value) => {
        if (alive) setNetworkBytesPerSecond(value);
      }).catch(() => undefined);
    };
    sample();
    const timer = window.setInterval(sample, 4000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [updatingQueue, installing]);

  useEffect(() => {
    void api.packageManagerStatus().then(setManagerStatus).catch(() => undefined);
  }, []);

  useEffect(() => {
    void api.isMaximized().then(setMaximized).catch(() => undefined);
    return api.onMaximizedChange(setMaximized);
  }, []);

  useEffect(() => {
    void api.registryBackupPath().then(setBackupPath).catch(() => undefined);
    void api.firewallBackupPath().then(setFirewallBackupPath).catch(() => undefined);
    void api.scheduleList().then(setSchedules).catch(() => undefined);
  }, []);

  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  const currentTheme: Theme = settings?.theme ?? 'default';
  const appliedTheme: 'default' | 'windows11' = currentTheme === 'auto'
    ? (systemDark ? 'default' : 'windows11')
    : currentTheme;

  useEffect(() => {
    document.documentElement.dataset.theme = appliedTheme;
  }, [appliedTheme]);

  function applyTheme(value: Theme) {
    document.documentElement.dataset.theme = value === 'auto' ? (systemDark ? 'default' : 'windows11') : value;
    setSettings((prev) => prev ? { ...prev, theme: value } : prev);
    setThemeMenuOpen(false);
    void api.setSettings({ theme: value }).catch((error: Error) => notify('error', error.message));
  }

  useEffect(() => {
    if (!themeMenuOpen) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.theme-switcher')) setThemeMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setThemeMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [themeMenuOpen]);

  useEffect(() => {
    if (settings) setUpdateSourceInput(settings.updateSource);
  }, [settings?.updateSource]);

  useEffect(() => {
    void api.localeList().then(setLocales).catch(() => undefined);
  }, []);

  useEffect(() => {
    void api.managedPolicyFiles().then(setManagedFixes).catch(() => undefined);
  }, []);

  useEffect(() => api.onCloseRequest(() => setClosePrompt(true)), []);

  useEffect(() => {
    let active = true;
    void api.localeDictionary(lang).then((result) => { if (active) setDictionary(result); }).catch(() => undefined);
    return () => { active = false; };
  }, [lang]);

  useEffect(() => {
    void api.systemDrives().then((list) => {
      if (!list.length) return;
      setDrives(list);
      setRecycleDrives(new Set(list));
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const run = useCallback(async (label: string, action: () => Promise<void>, success?: string) => {
    setBusy(label);
    try {
      await action();
      if (success) notify('ok', success);
    } catch (error) {
      notify('error', `${label}: ${(error as Error).message}`);
    } finally {
      setBusy(null);
    }
  }, [notify]);

  const startRepair = (action: RepairAction) => {
    const backupLabel = repairBackupPath || '%LOCALAPPDATA%\\ParsSistemYoneticisi\\repair_backups';
    const message = action.confirm
      ? t(action.confirm)
      : action.readOnly
        ? t('Salt okunur tarama başlatılacak. Sistemde değişiklik yapılmaz.')
        : action.backup
          ? tf('{title} çalıştırılacak. Değişiklikten önce zorunlu yedek alınır; yedek alınamazsa işlem yapılmaz.\nYedekler: {path}', { title: t(action.title), path: backupLabel })
          : t('Bu işlem Windows tarafından yönetici izniyle çalıştırılır ve uzun sürebilir. Devam edilsin mi?');
    setConfirm({
      title: t(action.title),
      message,
      warning: action.warning
        ? t(action.warning)
        : action.rebootRequired
          ? t('İşlem sonrasında yeniden başlatma gerekebilir. Kaydedilmemiş işlerinizi kaydedin.')
          : undefined,
      options: [
        { label: t('Vazgeç'), value: 'cancel' },
        { label: action.danger ? t('Yeniden başlat') : t('Başlat'), value: 'start', kind: action.danger ? 'danger' : 'primary' },
      ],
      onChoose: (value) => {
        if (value !== 'start') return;
        void run(t(action.title), async () => {
          const result = await api.repairRun(action.id);
          setRepairResult(result);
          let text = result.message;
          if (result.backupPath) text += ` ${tf('Yedek: {path}', { path: result.backupPath })}`;
          if (result.rebootRequired) text += ` ${t('Yeniden başlatma gerekiyor.')}`;
          notify(result.ok ? 'ok' : 'error', text);
        });
      },
    });
  };

  const checkAppUpdate = useCallback(async (announce = false): Promise<AppUpdateInfo | null> => {
    setUpdateBusy(true);
    setUpdateProgress(null);
    try {
      const result = await api.appUpdateCheck();
      setAppUpdate(result);
      if (announce) notify(result.available ? 'ok' : 'info', result.message);
      return result;
    } catch (error) {
      notify('error', tf('Güncelleme kontrolü başarısız: {message}', { message: (error as Error).message }));
      return null;
    } finally {
      setUpdateBusy(false);
    }
  }, [notify, tf]);

  const installAppUpdate = useCallback(async (filePath: string) => {
    try {
      const result = await api.appUpdateInstall(filePath);
      notify(result.ok ? 'ok' : 'error', result.message);
    } catch (error) {
      notify('error', (error as Error).message);
    }
  }, [notify]);

  const downloadAppUpdate = useCallback(async (info: AppUpdateInfo) => {
    setUpdateBusy(true);
    setUpdateProgress(null);
    setDownloadedUpdate(null);
    try {
      const result = await api.appUpdateDownload(info);
      setDownloadedUpdate(result);
      if (!result.ok) {
        notify('error', result.message);
        return;
      }
      notify('ok', result.message);
      setConfirm({
        title: t('Güncellemeyi kur'),
        message: info.portable
          ? t('Portable sürümde dosya kendiliğinden değiştirilemez. İndirilenler klasörü açılacak; yeni exe’yi eskisinin üzerine kopyalayıp uygulamayı yeniden başlatın.')
          : t('Kurulum başlatılacak ve uygulama kapanacak. Devam etmek istiyor musunuz?'),
        options: [
          { label: t('Sonra'), value: 'later' },
          { label: t('Kur'), value: 'install', kind: 'primary' },
        ],
        onChoose: (value) => { if (value === 'install' && result.path) void installAppUpdate(result.path); },
      });
    } catch (error) {
      notify('error', (error as Error).message);
    } finally {
      setUpdateBusy(false);
    }
  }, [installAppUpdate, notify, t]);

  const promptAppUpdate = useCallback((info: AppUpdateInfo) => {
    setConfirm({
      title: t('Yeni sürüm bulundu'),
      message: tf('{current} → {latest}\n\n{notes}', {
        current: info.currentVersion,
        latest: info.latestVersion,
        notes: info.notes || t('Sürüm notu yok.'),
      }),
      options: [
        { label: t('Sonra'), value: 'later' },
        { label: t('İndir'), value: 'download', kind: 'primary' },
      ],
      onChoose: (value) => { if (value === 'download') void downloadAppUpdate(info); },
    });
  }, [downloadAppUpdate, t, tf]);

  useEffect(() => {
    if (updatePrompted.current || !settings?.updateCheckOnStartup) return;
    updatePrompted.current = true;
    void (async () => {
      const info = await checkAppUpdate();
      if (info?.available) promptAppUpdate(info);
    })();
  }, [checkAppUpdate, promptAppUpdate, settings?.updateCheckOnStartup]);

  useEffect(() => {
    if (tab !== 'startup' || startupItems.length) return;
    void run(t('Başlangıç listesi yenileniyor'), async () => setStartupItems(await api.startupList())).catch(() => undefined);
  }, [tab, startupItems.length, run, t]);

  useEffect(() => {
    if (tab !== 'startup' || startupTimings.length) return;
    void api.startupTimings().then(setStartupTimings).catch(() => undefined);
  }, [tab, startupTimings.length]);

  useEffect(() => {
    if (tab !== 'bloatware' || bloatware.length) return;
    void run(t('Ön yüklü yazılımlar taranıyor'), async () => setBloatware(await api.bloatwareScan())).catch(() => undefined);
  }, [tab, bloatware.length, run, t]);

  useEffect(() => {
    if (tab !== 'firewall' || firewallRules.length) return;
    void run(t('Güvenlik duvarı kuralları denetleniyor'), async () => setFirewallRules(await api.firewallScan())).catch(() => undefined);
  }, [tab, firewallRules.length, run, t]);

  useEffect(() => {
    if (tab !== 'schedule' || schedules.length) return;
    void api.scheduleList().then(setSchedules).catch(() => undefined);
  }, [tab, schedules.length]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
    const group = groupForTab(tab);
    setExpandedGroups(group ? new Set([group]) : new Set());
  }, [tab]);

  useEffect(() => {
    if (tab !== 'repair') return;
    void api.repairBackupFolder().then(setRepairBackupPath).catch(() => undefined);
  }, [tab]);

  useEffect(() => {
    if (tab !== 'contextmenu') return;
    void api.contextMenuStatus().then(setContextMenu).catch(() => notify('error', t('Sağ tık menüsü durumu alınamadı.')));
    void api.shellExtensions().then(setShellExtensions).catch(() => notify('error', t('Sağ tık eklentileri okunamadı.')));
  }, [tab, notify, t]);

  const refreshSnapshot = useCallback(async () => {
    setDrivesLoading(true);
    try { setSnapshot(await api.systemSnapshot(settings?.drive)); } catch { /* sessiz */ }
    try {
      const [list, labels] = await Promise.all([api.systemDrives(), api.systemDriveLabels()]);
      if (list.length) setDrives(list);
      setDriveLabels(labels);
      const results = await Promise.all(list.slice(0, 12).map(async (drive) => {
        try { return await api.systemSnapshot(drive); } catch { return null; }
      }));
      setDriveSnapshots(results.filter((item): item is SystemSnapshot => !!item));
    } catch { /* sessiz */ } finally {
      setDrivesLoading(false);
    }
  }, [settings?.drive]);

  function openLink(url: string) {
    void api.openExternal(url).catch((error: Error) => notify('error', error.message));
  }

  const refreshUpdates = useCallback(async () => {
    const list = await api.wingetUpdates();
    setUpdates(list);
    setSelectedUpdates(new Set());
  }, []);

  const refreshApps = useCallback(async () => {
    const list = await api.installedApps();
    setApps(list);
    setInstalledIds(installedIdSet(list));
    setSelectedApps(new Set());
  }, []);

  /** Kurulum sonrası kartlar anında "kurulu" olur; gecikmeli tarama winget verisiyle doğrular. */
  const refreshAfterInstall = useCallback(async (installed: Array<{ ident: string; source: string }>) => {
    const optimistic = installed.flatMap((item) => [item.ident, `${item.source}:${item.ident}`]).filter(Boolean);
    setInstalledIds((prev) => new Set([...prev, ...optimistic]));
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
      const list = await api.installedApps();
      setApps(list);
      setInstalledIds((prev) => new Set([...prev, ...installedIdSet(list), ...optimistic]));
      setSelectedApps(new Set());
    } catch {
      // Doğrulama taraması başarısız olsa bile iyimser "kurulu" durumu korunur.
    }
  }, []);

  /** winget kaldırma işlemi bazen gecikmeli yansır; liste kaybolana kadar birkaç kez yenilenir. */
  const refreshAfterUninstall = useCallback(async (removed: InstalledApp[]) => {
    const keys = new Set(removed.map(appKey));
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const list = await api.installedApps();
      setApps(list);
      setInstalledIds(installedIdSet(list));
      setSelectedApps(new Set());
      if (!list.some((app) => keys.has(appKey(app)))) break;
      if (attempt < 3) await new Promise((resolve) => window.setTimeout(resolve, 1200));
    }
    await refreshUpdates();
  }, [refreshUpdates]);

  const refreshDrivers = useCallback(async () => {
    const result = await api.driversScan();
    setDriverScan(result);
    setSelectedDrivers(new Set());
  }, []);

  const refreshSettings = useCallback(async () => {
    const current = await api.getSettings();
    const winget = await api.wingetVersion();
    const merged = { ...current, wingetAvailable: winget.available, wingetVersion: winget.version };
    setSettings(merged);
    return merged;
  }, []);

  const refreshPrerequisites = useCallback(async () => {
    const list = await api.prereqScan();
    setPrerequisites(list);
    return list;
  }, []);

  const installPrerequisites = useCallback(async (items: Prerequisite[]) => {
    setPrereqBusy(items.map((item) => item.id).join(','));
    try {
      for (const item of items) {
        notify('info', tf('Kurulum sürüyor: {name}', { name: item.name }));
        const result = await api.prereqInstall(item.id);
        notify(result.ok ? 'ok' : 'error', result.ok ? result.message : tf('Kurulum başarısız: {message}', { message: result.message }));
      }
      await refreshPrerequisites();
      await refreshSettings();
    } finally {
      setPrereqBusy(null);
    }
  }, [tf, notify, refreshPrerequisites, refreshSettings]);

  const requestPrerequisiteInstall = useCallback((items: Prerequisite[]) => {
    const pending = items.filter((item) => !item.installed && item.installable);
    if (!pending.length || prereqBusy) return;
    setConfirm({
      title: t('Kurulum onayı'),
      message: tf('Şu bileşenler kurulacak: {names}\n\nKurulum arka planda ve sessiz yürür; sonuç bildirilecektir.', {
        names: pending.map((item) => item.name).join(', '),
      }),
      options: [
        { label: t('Vazgeç'), value: 'cancel' },
        { label: t('Kur'), value: 'install', kind: 'primary' },
      ],
      onChoose: (value) => { if (value === 'install') void installPrerequisites(pending); },
    });
  }, [installPrerequisites, prereqBusy, t, tf]);

  const runEnterprisePrerequisites = useCallback(async () => {
    setPrereqBusy('enterprise');
    try {
      const results = await api.prereqAutoInstall();
      const ok = results.filter((result) => result.ok).length;
      notify(
        results.length ? (ok === results.length ? 'ok' : 'error') : 'info',
        results.length
          ? tf('Kurumsal kurulum tamamlandı: {ok}/{total} başarılı.', { ok, total: results.length })
          : t('Kurumsal kurulumda eksik bileşen yok.'),
      );
      await refreshPrerequisites();
      await refreshSettings();
    } finally {
      setPrereqBusy(null);
    }
  }, [notify, refreshPrerequisites, refreshSettings, t, tf]);

  useEffect(() => {
    if (!settings || prereqPrompted.current) return;
    prereqPrompted.current = true;
    void (async () => {
      try {
        if (settings.enterpriseSilentPrereqs) {
          await runEnterprisePrerequisites();
          return;
        }
        const list = await refreshPrerequisites();
        const missing = list.filter((item) => item.required && !item.installed);
        if (!missing.length) return;
        setConfirm({
          title: t('Gerekli bileşenler'),
          message: tf('Eksik gerekli bileşenler var: {names}', { names: missing.map((item) => item.name).join(', ') }),
          options: [
            { label: t('Sonra'), value: 'later' },
            { label: t('Şimdi kur'), value: 'install', kind: 'primary' },
          ],
          onChoose: (value) => { if (value === 'install') requestPrerequisiteInstall(missing); },
        });
      } catch {
        // Açılışta eksik bileşen taraması başarısızsa uygulama yine kullanılabilir.
      }
    })();
  }, [requestPrerequisiteInstall, runEnterprisePrerequisites, settings, refreshPrerequisites, t, tf]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void (async () => {
      try {
        const loaded = await refreshSettings();
        await refreshSnapshot();
        if (loaded.autoUpdateScan) void run(t('Güncellemeler taranıyor'), refreshUpdates).catch(() => undefined);
        void run(t('Kurulu uygulamalar okunuyor'), refreshApps).catch(() => undefined);
      } catch (error) {
        notify('error', tf('Başlatma hatası: {message}', { message: (error as Error).message }));
      }
    })();
  }, [notify, refreshApps, refreshSettings, refreshSnapshot, run, t, tf]);

  useEffect(() => {
    const timer = window.setInterval(() => void refreshSnapshot(), 15_000);
    return () => window.clearInterval(timer);
  }, [refreshSnapshot]);

  useEffect(() => {
    if (settings) void refreshSnapshot();
  }, [refreshSnapshot, settings]);

  const filteredApps = useMemo(() => {
    const query = appQuery.toLocaleLowerCase('tr-TR').trim();
    if (!query) return apps;
    return apps.filter((app) =>
      `${app.name} ${app.publisher} ${app.version} ${app.ident}`.toLocaleLowerCase('tr-TR').includes(query));
  }, [apps, appQuery]);

  const filteredDrivers = useMemo(() => {
    const list = driverScan?.installed ?? [];
    const query = driverQuery.toLocaleLowerCase('tr-TR').trim();
    if (!query) return list;
    return list.filter((item) =>
      `${item.device} ${item.manufacturer} ${item.provider} ${item.version} ${item.deviceClass}`
        .toLocaleLowerCase('tr-TR').includes(query));
  }, [driverQuery, driverScan]);

  const missingEssentials = useMemo(
    () => CATALOG.filter((item) => item.essential && !installedIds.has(item.ident)),
    [installedIds],
  );

  const filteredRecommended = useMemo(() => {
    const query = recQuery.toLocaleLowerCase('tr-TR').trim();
    const categoryOrder = new Map(CATEGORIES.map((category, index) => [category, index]));
    return CATALOG.filter((item) =>
      (recCategory === 'Tümü' || item.category === recCategory) &&
      (recSource === 'all' || (item.source ?? 'winget') === recSource) &&
      (!query || `${item.name} ${item.ident} ${item.description}`.toLocaleLowerCase('tr-TR').includes(query)))
      .sort((a, b) => {
        const left = categoryOrder.get(a.category) ?? CATEGORIES.length;
        const right = categoryOrder.get(b.category) ?? CATEGORIES.length;
        return left - right || a.name.localeCompare(b.name, 'tr-TR');
      });
  }, [recCategory, recQuery, recSource]);

  const selectedRecommended = useMemo(
    () => CATALOG.filter((item) => selectedRec.has(recKey(item))),
    [selectedRec],
  );

  function toggle(setter: Dispatch<SetStateAction<Set<string>>>, key: string) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll<T>(items: T[], keyOf: (item: T) => string, selected: Set<string>, setter: Dispatch<SetStateAction<Set<string>>>) {
    setter(selected.size === items.length ? new Set() : new Set(items.map(keyOf)));
  }

  const filteredRegIssues = useMemo(() => regIssues.filter((issue) => {
    if (regFilter === 'broken') return issue.fixable === true;
    if (regFilter === 'warning') return issue.risk === 'critical' || issue.category === 'com-hijack';
    if (regFilter === 'critical') return issue.system === true || issue.risk === 'critical';
    return true;
  }), [regIssues, regFilter]);

  useEffect(() => {
    if (tab === 'packages') {
      void api.packageBackupList().then(setPackageBackups).catch((error: Error) => notify('error', error.message));
    }
    if (tab === 'privacy') {
      void api.privacyList().then(setPrivacyTweaks).catch((error: Error) => notify('error', error.message));
    }
    if (tab === 'analysis' && !analysisRoot) setAnalysisRoot(settings?.drive || 'C:\\');
  }, [tab, settings?.drive, analysisRoot, notify]);

  function askFileDelete(mode: 'recycle' | 'permanent') {
    const paths = [...selectedFiles];
    if (!paths.length) return;
    setConfirm({
      title: mode === 'recycle' ? t('Seçilen dosyaları kutuya taşı') : t('Seçilen dosyaları kalıcı sil'),
      message: mode === 'recycle'
        ? tf('{count} dosya Geri Dönüşüm Kutusu\'na taşınacak. Referans klasörler ve hariç tutulanlar atlanır.', { count: paths.length })
        : tf('{count} dosya kalıcı olarak silinecek. Bu işlem geri alınamaz.', { count: paths.length }),
      options: [
        { label: t('Vazgeç'), value: 'cancel' },
        { label: mode === 'recycle' ? t('Kutuya taşı') : t('Kalıcı sil'), value: 'delete', kind: mode === 'recycle' ? 'primary' : 'danger' },
      ],
      onChoose: (value) => {
        if (value !== 'delete') return;
        void run(t('Dosyalar işleniyor'), async () => {
          const results = await api.fileDelete(paths, referenceRoots, mode);
          const ok = results.filter((result) => result.ok).length;
          notify(ok ? 'ok' : 'error', tf('{ok}/{total} dosya işlendi.', { ok, total: results.length }));
          setSelectedFiles(new Set());
          setFileResult(await api.fileScan({
            roots: fileRoots,
            referenceRoots,
            minSize: Math.max(1, Number(fileMinSize) || 128) * 1024 * 1024,
            maxResults: 200_000,
          }));
        });
      },
    });
  }

  function askAutorun(item: AutorunItem, enabled: boolean) {
    const label = enabled ? t('Girdiyi etkinleştir') : t('Girdiyi devre dışı bırak');
    setConfirm({
      title: `${label}: ${item.name}`,
      message: item.category === 'service'
        ? t('Servisin başlangıç durumu değiştirilecek. Özgün durum yedek dosyasına kaydedilir.')
        : item.category === 'task'
          ? t('Zamanlı görevin durumu değiştirilecek. Özgün durum yedek dosyasına kaydedilir.')
          : t('Kayıt değeri değiştirilmeden önce .reg yedeği alınır; yedek alınamazsa değişiklik yapılmaz.'),
      options: [{ label: t('Vazgeç'), value: 'cancel' }, { label: label, value: 'apply', kind: enabled ? 'primary' : 'danger' }],
      onChoose: (value) => {
        if (value !== 'apply') return;
        void run(label, async () => {
          const result = await api.autorunSet(item, enabled);
          notify(result.ok ? 'ok' : 'error', result.ok ? `${result.message}${result.backupPath ? ` ${t('Yedek:')} ${result.backupPath}` : ''}` : result.message);
          setAutoruns(await api.autorunScan());
        });
      },
    });
  }

  function askPrivacy(tweak: PrivacyTweak, apply: boolean) {
    const label = apply ? t('Ayarı uygula') : t('Eski ayarı geri yükle');
    setConfirm({
      title: `${label}: ${tweak.title}`,
      message: apply
        ? t('Ayar uygulanmadan önce ilgili kayıt anahtarının .reg yedeği alınır ve özgün değer saklanır.')
        : t('Özgün değer geri yazılacak; değişiklikten önce yeniden .reg yedeği alınır.'),
      options: [{ label: t('Vazgeç'), value: 'cancel' }, { label: label, value: 'apply', kind: apply ? 'primary' : 'danger' }],
      onChoose: (value) => {
        if (value !== 'apply') return;
        void run(label, async () => {
          const result = await api.privacySet(tweak, apply);
          notify(result.ok ? 'ok' : 'error', result.ok ? result.message : result.message);
          setPrivacyTweaks(await api.privacyList());
        });
      },
    });
  }

  function updateSchedule(id: string, patch: Partial<ScheduleTask>) {
    const next = schedules.map((task) => task.id === id ? { ...task, ...patch } : task);
    setSchedules(next);
    void api.scheduleSave(next).then(setSchedules).catch((error: Error) => notify('error', error.message));
  }

  function patchSettings(patch: Partial<Settings>) {
    setSettings((prev) => prev ? { ...prev, ...patch } : prev);
    void api.setSettings(patch).catch((error: Error) => notify('error', error.message));
  }

  function applyContextMenuStyle(style: ContextMenuStyle) {
    const label = style === 'windows10'
      ? t('Windows 10 sağ tık menüsüne geç')
      : t('Windows 11 menüsüne geç');
    setConfirm({
      title: label,
      message: t('Bu işlem HKCU kayıt defterini değiştirir ve Windows Gezgini’ni yeniden başlatır. Açık dosya pencereleri kapanabilir.'),
      options: [
        { label: t('Sonra'), value: 'later' },
        { label: t('Değiştir'), value: 'apply', kind: 'primary' },
      ],
      onChoose: (value) => {
        if (value !== 'apply') return;
        void run(label, async () => {
          const result = await api.contextMenuSet(style);
          const explorer = result.explorerRestarted
            ? t('Gezgin yeniden başlatıldı.')
            : t('Gezgin yeniden başlatılamadı; oturumu kapatıp açın.');
          notify(
            result.ok ? 'ok' : 'error',
            result.ok
              ? `${t('Menü stili güncellendi.')} ${explorer}`
              : tf('Menü stili değiştirilemedi: {message}', { message: result.message }),
          );
          setContextMenu(await api.contextMenuStatus());
        });
      },
    });
  }

  function toggleShellExtension(item: ShellExtensionItem) {
    const enabled = !item.enabled;
    const label = enabled
      ? tf('{name} eklentisini aç', { name: item.label })
      : tf('{name} eklentisini kapat', { name: item.label });
    setConfirm({
      title: label,
      message: enabled
        ? t('Seçili sağ tık eklentisi yeniden etkinleştirilecek. Değişiklikten önce .reg yedeği alınır ve Windows Gezgini yeniden başlatılır.')
        : t('Seçili sağ tık eklentisi Gezgin menüsünde gizlenecek. Değişiklikten önce .reg yedeği alınır ve Windows Gezgini yeniden başlatılır.'),
      warning: item.isSystem
        ? t('Bu girdi Windows veya imzalı bir sistem bileşenine ait olabilir. Kapatılması sistem araçlarını gizleyebilir; yedek dosyasıyla geri alınabilir.')
        : undefined,
      options: [
        { label: t('Vazgeç'), value: 'cancel' },
        { label: enabled ? t('Aç') : t('Kapat'), value: 'apply', kind: enabled ? 'primary' : 'danger' },
      ],
      onChoose: (value) => {
        if (value !== 'apply') return;
        setShellExtensionBusy(item.id);
        void run(label, async () => {
          const result: ShellExtensionActionResult = await api.shellExtensionSet(item.id, enabled);
          notify(
            result.ok ? 'ok' : 'error',
            result.ok ? result.message : tf('Sağ tık eklentisi değiştirilemedi: {message}', { message: result.message }),
          );
          if (result.backupPath) notify('info', tf('Yedek: {path}', { path: result.backupPath }));
          if (result.explorerRestarted) notify('info', t('Gezgin yeniden başlatıldı.'));
          setShellExtensions(await api.shellExtensions());
        }).finally(() => setShellExtensionBusy(null));
      },
    });
  }

  function requestClose() {
    const behavior = settings?.closeBehavior ?? 'ask';
    if (behavior === 'tray') { void api.windowAction('close-to-tray'); return; }
    if (behavior === 'quit') { void api.windowAction('close'); return; }
    setRememberClose(false);
    setClosePrompt(true);
  }

  function chooseClose(target: 'tray' | 'quit') {
    if (rememberClose) patchSettings({ closeBehavior: target });
    setClosePrompt(false);
    void api.windowAction(target === 'tray' ? 'close-to-tray' : 'close');
  }

  function saveRegFix(id: ManagedPolicyFixId) {
    void run(t('Dosya kaydediliyor'), async () => {
      const result = await api.managedPolicySave(id);
      notify(result.ok ? 'ok' : result.message === 'Kaydetme iptal edildi.' ? 'info' : 'error', result.message);
    });
  }

  function applyRegFix(id: ManagedPolicyFixId) {
    const fix = managedFixes.find((item) => item.id === id);
    setConfirm({
      title: t('.reg dosyasını uygula'),
      message: tf('{title} — Yedek alınmadan hiçbir ilke anahtarı silinmez. {warning}', {
        title: t(fix?.title ?? ''),
        warning: t(fix?.warning ?? ''),
      }),
      options: [
        { label: t('Sonra'), value: 'later' },
        { label: t('Uygula'), value: 'apply', kind: 'primary' },
      ],
      onChoose: (value) => {
        if (value !== 'apply') return;
        void run(t('.reg dosyası uygulanıyor'), async () => {
          const result = await api.managedPolicyApply(id);
          notify(result.ok ? 'ok' : 'error', result.message);
        });
      },
    });
  }

  function addFolders(paths: string[]) {
    if (!settings) return;
    const clean = paths.map((item) => item.trim()).filter(Boolean);
    if (!clean.length) return;
    const current = settings.excludedFolders.map((item) => item.toLowerCase());
    const added = [...new Set(clean.filter((item) => !current.includes(item.toLowerCase())))];
    if (!added.length) { notify('info', t('Klasör zaten ekli.')); return; }
    patchSettings({ excludedFolders: [...settings.excludedFolders, ...added] });
    setFolderInput('');
  }

  function addExtensions(value: string) {
    if (!settings) return;
    const extensions = parseExtensions(value);
    if (!extensions.length) { notify('info', t('Geçerli bir uzantı girin (örn. .log).')); return; }
    patchSettings({ excludedExtensions: [...new Set([...settings.excludedExtensions, ...extensions])] });
    setExtensionInput('');
  }

  async function openLeftovers(apps: InstalledApp[]) {
    const label = apps.length === 1 ? apps[0].name : tf('{count} uygulama', { count: apps.length });
    const requestId = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    leftoverRequestId.current = requestId;
    leftoverCancelled.current = false;
    setLeftoverTarget({ label, apps });
    setLeftovers([]);
    setSelectedLeftovers(new Set());
    setLeftoverProgress(null);
    setLeftoverScanning(true);
    await run(t('Kalıntılar taranıyor'), async () => {
      try {
        // Tek tarama: kök dizinler bir kez gezilir, tüm uygulamalar aynı anda eşleştirilir.
        const scanned = await api.scanLeftoversBatch(
          apps.map((app) => ({ name: app.name, ident: app.ident })),
          requestId,
        );
        const merged = new Map<string, Leftover>();
        for (const group of scanned) {
          for (const item of group.items) if (!merged.has(item.path)) merged.set(item.path, item);
        }
        const result = [...merged.values()];
        setLeftovers(result);
        setSelectedLeftovers(new Set(result.map((item) => item.path)));
        if (leftoverCancelled.current) notify('info', t('Tarama iptal edildi; bulunan öğeler listelendi.'));
        else if (!result.length) notify('info', tf('{name} için kalıntı bulunamadı.', { name: label }));
      } finally {
        setLeftoverScanning(false);
        setLeftoverProgress(null);
      }
    });
  }

  function cancelLeftoverScan() {
    leftoverCancelled.current = true;
    api.cancelLeftovers(leftoverRequestId.current);
  }

  function askLeftoverDelete(mode: 'recycle' | 'permanent') {
    const items = leftovers.filter((item) => selectedLeftovers.has(item.path));
    if (!items.length) {
      notify('info', t('Silmek için en az bir kalıntı seçin.'));
      return;
    }
    const perform = () => run(t('Kalıntılar siliniyor'), async () => {
      const results = await api.deleteLeftovers(items, mode);
      const ok = results.filter((result) => result.ok).length;
      setLeftovers((prev) => prev.filter((item) => !results.some((result) => result.ok && result.path === item.path)));
      setSelectedLeftovers(new Set());
      notify(ok ? 'ok' : 'error', tf('{ok}/{total} kalıntı temizlendi.', { ok, total: results.length }));
    });

    if (mode === 'permanent') {
      setConfirm({
        title: t('Kalıcı silme onayı'),
        message: tf('{count} öğe Geri Dönüşüm Kutusu\'na gitmeden kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam edilsin mi?', { count: items.length }),
        options: [
          { label: t('Vazgeç'), value: 'cancel' },
          { label: t('Evet, kalıcı olarak sil'), value: 'delete', kind: 'danger' },
        ],
        onChoose: (value) => { if (value === 'delete') void perform(); },
      });
    } else {
      void perform();
    }
  }

  const refreshBloatware = useCallback(async () => {
    const list = await api.bloatwareScan();
    setBloatware(list);
    setSelectedBloatware(new Set());
  }, []);

  function removeSelectedBloatware() {
    const chosen = bloatware.filter((item) => selectedBloatware.has(item.id));
    if (!chosen.length) {
      notify('info', t('Kaldırmak için en az bir yazılım seçin.'));
      return;
    }
    const windows = chosen.filter((item) => item.kind === 'windows-app').length;
    setConfirm({
      title: t('Ön yüklü yazılımları kaldır'),
      message: tf('{count} yazılım kaldırılacak: {win} Windows uygulaması, {oem} OEM yazılımı.', {
        count: chosen.length,
        win: windows,
        oem: chosen.length - windows,
      }),
      warning: t('Bu işlem geri alınamaz. Kaldırılan uygulamalar Microsoft Store veya üretici web sitesi üzerinden yeniden yüklenebilir.'),
      options: [
        { label: t('Vazgeç'), value: 'cancel' },
        { label: t('Evet, kalıcı olarak kaldır'), value: 'remove', kind: 'danger' },
      ],
      onChoose: (value) => {
        if (value !== 'remove') return;
        void run(tf('{count} yazılım kaldırılıyor', { count: chosen.length }), async () => {
          const results = await api.bloatwareRemove(chosen);
          const ok = results.filter((result) => result.ok).length;
          await refreshBloatware();
          notify(ok ? 'ok' : 'error', tf('{ok}/{total} yazılım kaldırıldı.', { ok, total: results.length }));
        });
      },
    });
  }

  async function installSoftware(items: RecommendedSoftware[]) {
    if (!items.length) return;
    const silent = settings?.silentInstall ?? true;
    const requestId = `install-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    installRequestId.current = requestId;
    setInstallQueue(null);
    setInstalling(true);
    try {
      const results = await api.installQueue(items.map((item) => ({
        name: item.name,
        ident: item.ident,
        source: item.source ?? 'winget',
      })), silent, requestId);
      const ok = results.filter((result) => result.ok).length;
      notify(ok === results.length ? 'ok' : 'error', tf('{ok}/{total} kurulum tamamlandı.', { ok, total: results.length }));
      await refreshAfterInstall(results.filter((result) => result.ok).map((result) => ({
        ident: result.ident,
        source: result.source,
      })));
      setSelectedRec(new Set());
    } catch (error) {
      notify('error', tf('Kurulum kuyruğu başlatılamadı: {message}', { message: (error as Error).message }));
    } finally {
      setInstalling(false);
      setInstallQueue(null);
    }
  }

  function cancelInstallQueue() {
    api.installCancel(installRequestId.current);
    notify('info', t('Kurulum kuyruğu iptal ediliyor…'));
  }

  async function uninstallOne(app: InstalledApp): Promise<number> {
    const pkg: Package = { name: app.name, ident: app.ident, version: app.version, available: '', source: '' };
    const silent = settings?.silentInstall ?? true;
    const code = await api.wingetUninstall(pkg, silent);
    if (code !== 0) notify('error', tf('{name} kaldırılamadı (kod {code}). Yönetici izni gerekebilir.', { name: app.name, code }));
    else notify('ok', tf('{name} kaldırıldı.', { name: app.name }));
    return code;
  }

  function askLeftoverScan(apps: InstalledApp[]) {
    if (!apps.length || !settings?.autoLeftoverScan) return;
    const label = apps.length === 1 ? apps[0].name : tf('{count} uygulama', { count: apps.length });
    setConfirm({
      title: t('Kalıntıları tara'),
      message: tf('{label} kaldırıldı. Geride kalan dosyalar ve kayıt defteri girdileri taranılsın mı?', { label }),
      options: [
        { label: t('Hayır'), value: 'no' },
        { label: t('Evet, tara'), value: 'yes', kind: 'primary' },
      ],
      onChoose: (value) => {
        if (value === 'yes') void openLeftovers(apps);
      },
    });
  }

  async function uninstallApp(app: InstalledApp) {
    let removed = false;
    await run(tf('{name} kaldırılıyor', { name: app.name }), async () => {
      const code = await uninstallOne(app);
      await refreshAfterUninstall([app]);
      removed = code === 0;
    });
    if (removed) askLeftoverScan([app]);
  }

  async function upgradePackages(items: Package[]) {
    if (!items.length) return;
    const silent = settings?.silentInstall ?? true;
    const requestId = `update-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    updateQueueRequestId.current = requestId;
    setUpdateQueueProgress(null);
    setUpdatingQueue(true);
    try {
      const results = await api.updateQueue(items, silent, requestId);
      const ok = results.filter((result) => result.ok).length;
      notify(ok === results.length ? 'ok' : 'error', tf('{ok}/{total} güncelleme tamamlandı.', { ok, total: results.length }));
      for (const result of results.filter((entry) => !entry.ok)) {
        notify('error', tf('{name} güncellenemedi: {message}', { name: result.name, message: result.message }));
      }
      await refreshUpdates();
      await refreshApps();
    } catch (error) {
      notify('error', tf('Güncelleme kuyruğu başlatılamadı: {message}', { message: (error as Error).message }));
    } finally {
      setUpdatingQueue(false);
      setUpdateQueueProgress(null);
    }
  }

  function cancelUpdateQueue() {
    api.updateQueueCancel(updateQueueRequestId.current);
    notify('info', t('Güncelleme kuyruğu iptal ediliyor…'));
  }

  const activeProgress = updatingQueue ? updateQueueProgress : installQueue;
  const activeTitle = updatingQueue ? t('Güncelleme kuyruğu') : t('Kurulum kuyruğu');

  return (
    <div className="app-root">
      <header
        className="window-bar"
        onDoubleClick={(event) => {
          if ((event.target as HTMLElement).closest('button')) return;
          void api.windowAction('maximize');
        }}
      >
        <div className="window-title-area">
          <img className="window-icon" src="./icon.png" alt="" />
          <span className="window-title">
            {t('Pars Sistem Yöneticisi')}
            <span className="window-sep"> — </span>
            {t(TABS.find((item) => item.id === tab)?.label ?? '')}
          </span>
        </div>
        <div className="window-controls">
          <div className="theme-switcher">
            <button
              className={`window-btn theme-btn${themeMenuOpen ? ' open' : ''}`}
              title={t('Temayı değiştir')}
              aria-label={t('Temayı değiştir')}
              aria-expanded={themeMenuOpen}
              aria-haspopup="menu"
              onClick={() => setThemeMenuOpen((open) => !open)}
            >
              {currentTheme === 'auto' ? '◐' : currentTheme === 'windows11' ? '☀' : '☾'}
            </button>
            {themeMenuOpen && (
              <div className="theme-menu" role="menu">
                <button
                  role="menuitemradio"
                  aria-checked={currentTheme === 'default'}
                  className={currentTheme === 'default' ? 'active' : ''}
                  onClick={() => applyTheme('default')}
                >
                  <span className="theme-icon" aria-hidden="true">☾</span>
                  {t('Koyu Mod')}
                </button>
                <button
                  role="menuitemradio"
                  aria-checked={currentTheme === 'windows11'}
                  className={currentTheme === 'windows11' ? 'active' : ''}
                  onClick={() => applyTheme('windows11')}
                >
                  <span className="theme-icon" aria-hidden="true">☀</span>
                  {t('Açık Mod')}
                </button>
                <button
                  role="menuitemradio"
                  aria-checked={currentTheme === 'auto'}
                  className={currentTheme === 'auto' ? 'active' : ''}
                  onClick={() => applyTheme('auto')}
                >
                  <span className="theme-icon" aria-hidden="true">◐</span>
                  {t('Sistem')}
                </button>
              </div>
            )}
          </div>
          <button className="window-btn" title={t('Pencereyi küçült')} aria-label={t('Pencereyi küçült')} onClick={() => void api.windowAction('minimize')}>─</button>
          <button
            className="window-btn"
            title={t(maximized ? 'Pencereyi geri yükle' : 'Pencereyi büyüt')}
            aria-label={t(maximized ? 'Pencereyi geri yükle' : 'Pencereyi büyüt')}
            onClick={() => void api.windowAction('maximize')}
          >
            {maximized ? '❐' : '□'}
          </button>
          <button className="window-btn window-close" title={t('Kapat')} aria-label={t('Kapat')} onClick={requestClose}>✕</button>
        </div>
      </header>

      {(updatingQueue || installing) && (
        <div className="global-progress" role="status" aria-live="polite">
          <div className="global-progress-info">
            <b>{activeTitle}</b>
            <span className="global-progress-name">
              {activeProgress
                ? activeProgress.phase === 'done'
                  ? t('Tamamlandı')
                  : updatingQueue
                    ? t('Güncelleniyor')
                    : t('Kuruluyor')
                  : t('Başlatılıyor…')}
              {activeProgress ? `: ${activeProgress.name}` : ''}
            </span>
            <span className="muted small global-progress-count">
              {activeProgress ? tf('{current}/{total}', { current: activeProgress.index + 1, total: activeProgress.total }) : ''}
            </span>
            <span className="muted small global-progress-network">
              {t('Ağ')}: {networkBytesPerSecond ? `${sizeText(networkBytesPerSecond)}/s` : '—'}
            </span>
            <span className="global-progress-metrics mono">
              {activeProgress ? `${activeProgress.percent}%` : '0%'}
              {activeProgress?.speed ? ` · ${activeProgress.speed}` : ''}
            </span>
            <button
              className="btn btn-small btn-danger-ghost"
              onClick={updatingQueue ? cancelUpdateQueue : cancelInstallQueue}
            ><UiIcon label="İptal et" />
              {t('İptal et')}
            </button>
          </div>
          <div className="global-progress-track">
            <div className="global-progress-fill" style={{ width: `${activeProgress?.percent ?? 0}%` }} />
          </div>
          {activeProgress?.line && <div className="global-progress-line mono">{activeProgress.line}</div>}
        </div>
      )}

      <div className="app-shell">
      <aside className={`sidebar ${navCollapsed ? 'collapsed' : ''}`}>
        <div className="brand">
          <img className="brand-mark" src="./icon.png" alt="" />
          <div className="brand-text">
            <strong>{t('Pars Sistem Yöneticisi')}</strong>
            <small>{t('Sistem Bakım Merkezi')}</small>
          </div>
          <button
            className="nav-toggle"
            title={t(navCollapsed ? 'Sekmeleri genişlet' : 'Sekmeleri daralt')}
            aria-label={t(navCollapsed ? 'Sekmeleri genişlet' : 'Sekmeleri daralt')}
            aria-expanded={!navCollapsed}
            onClick={() => setNavCollapsed((value) => !value)}
          ><UiIcon label={navCollapsed ? 'Sekmeleri genişlet' : 'Sekmeleri daralt'} /></button>
        </div>
        <nav>
          <button
            className={`nav-item nav-item-home ${tab === 'home' ? 'active' : ''}`}
            aria-current={tab === 'home' ? 'page' : undefined}
            title={t('Anasayfa')}
            onClick={() => setTab('home')}
          >
            <span className="nav-icon">⌂</span>
            <span>{t('Anasayfa')}</span>
          </button>
          {TAB_GROUPS.map((group) => {
            const open = expandedGroups.has(group.id);
            const active = group.tabs.includes(tab);
            return (
              <div className={`nav-group ${open ? 'open' : ''} ${active ? 'has-active' : ''}`} key={group.id}>
                <button
                  className="nav-group-header"
                  aria-expanded={open}
                  title={t(group.label)}
                  onClick={() => {
                    if (navCollapsed) setNavCollapsed(false);
                    setExpandedGroups((prev) => {
                      const next = new Set(prev);
                      if (next.has(group.id)) next.delete(group.id);
                      else {
                        next.clear();
                        next.add(group.id);
                      }
                      return next;
                    });
                  }}
                >
                  <span className="nav-group-icon" aria-hidden="true"><UiIcon icon={group.icon} /></span>
                  <span className="nav-group-label">{t(group.label)}</span>
                  <span className="nav-arrow" aria-hidden="true">›</span>
                </button>
                <div className="nav-group-items">
                  <div>
                    {group.tabs.map((id) => {
                      const item = TABS.find((candidate) => candidate.id === id);
                      if (!item) return null;
                      return (
                        <button
                          key={item.id}
                          className={`nav-item ${tab === item.id ? 'active' : ''}`}
                          title={t(item.label)}
                          onClick={() => setTab(item.id)}
                        >
                          <span className="nav-icon">{item.icon}</span>
                          <span>{t(item.label)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <button
            className={`nav-item nav-item-settings ${tab === 'settings' ? 'active' : ''}`}
            aria-current={tab === 'settings' ? 'page' : undefined}
            title={t('Ayarlar')}
            onClick={() => setTab('settings')}
          >
            <span className="nav-icon">⚙</span>
            <span>{t('Ayarlar')}</span>
          </button>
          <div className="sidebar-links">
            <button title={t('GitHub deposu')} aria-label={t('GitHub deposu')} onClick={() => openLink(APP_LINKS.github)}><UiIcon label="GitHub" /></button>
            <button title={t('Web sitesi')} aria-label={t('Web sitesi')} onClick={() => openLink(APP_LINKS.website)}><UiIcon label="Web sitesi" /></button>
            <button title={t('Destek ol')} aria-label={t('Destek ol')} onClick={() => openLink(APP_LINKS.coffee)}><UiIcon label="Destek ol" /></button>
            <button title={t('Lisans ve telif hakkı')} aria-label={t('Lisans ve telif hakkı')} onClick={() => setTab('settings')}><UiIcon label="Lisans ve telif hakkı" /></button>
          </div>
          <div className="sidebar-foot">
            <span className="dot" style={{ background: 'var(--accent)' }} />
            {t('Sistem Bakım Merkezi · v1.0.4')}
          </div>
        </div>
      </aside>

      <main className="main">
        <header className={`topbar ${busy ? 'is-busy' : ''}`}>
          <div className="topbar-title">
            <h1><UiIcon icon={TABS.find((item) => item.id === tab)?.icon} />{t(TABS.find((item) => item.id === tab)?.label ?? '')}</h1>
            {busy ? (
              <p className="busy-line" role="status" aria-live="polite">
                <span className="scan-track" aria-hidden="true"><span className="scan-beam" /></span>
                <span className="busy-label">{busy}<span className="busy-dots" aria-hidden="true"><i /><i /><i /></span></span>
              </p>
            ) : (
              <p>{t('Sistem bakım ve yazılım yönetimi paneli')}</p>
            )}
          </div>
          <div className="top-stats">
            <span><b>{updates.length}</b> {t('güncelleme')}</span>
            <span><b>{driverScan?.updates.length ?? 0}</b> {t('sürücü güncellemesi')}</span>
            <span title={t('Kurulu olmayan önerilen sistem bileşenleri. Uygulamanın çalışması için zorunlu değildir.')}>
              <b>{missingEssentials.length}</b> {t('önerilen eksik')}
            </span>
            <span><b>{regIssues.length || regStats?.broken || 0}</b> {t('kayıt sorunu')}</span>
            {appUpdate?.available && (
              <button className="update-chip" onClick={() => promptAppUpdate(appUpdate)}><UiIcon label="Yeni sürüm" />
                {t('Yeni sürüm')} {appUpdate.latestVersion}
              </button>
            )}
          </div>
        </header>

        <div className="content" ref={contentRef}>
          {tab === 'home' && (
            <section className="page">
              <div className="grid-3">
                <Meter icon="cpu" label={t('CPU Kullanımı')} value={snapshot?.cpuPercent ?? 0} text={`${snapshot?.cpuPercent.toFixed(0) ?? '—'}%`} tone="var(--meter-cpu)" />
                <Meter icon="ram" label={t('RAM Kullanımı')} value={snapshot?.memoryPercent ?? 0} text={`${snapshot?.memoryPercent.toFixed(0) ?? '—'}% · ${sizeText(snapshot?.memoryAvailable ?? 0)} ${t('Boş')}`} tone="var(--meter-ram)" />
                <Meter icon="disk" label={`${t('Boş Depolama')} (${snapshot?.diskPath || 'C:\\'})`} value={snapshot?.diskPercent ?? 0} text={`${sizeText(snapshot?.diskFree ?? 0)} / ${sizeText(snapshot?.diskTotal ?? 0)}`} tone="var(--meter-disk)" />
              </div>
              <div className="card">
                <div className="card-head">
                  <h3><UiIcon label="Tüm diskler" />{t('Tüm diskler')}</h3>
                  <button className="btn btn-small" onClick={() => void run(t('Disk bilgileri yenileniyor'), refreshSnapshot)}><UiIcon label="Yenile" />{t('Yenile')}</button>
                </div>
                <div className="drive-grid">
                  {driveSnapshots.map((drive) => (
                    <div className="drive-card" key={drive.diskPath}>
                      <div className="drive-card-head">
                        <div className="drive-card-name">
                          <b>{drive.diskPath}</b>
                          <small>{driveLabels[drive.diskPath] || driveLabels[drive.diskPath.slice(0, 2)] || t('Yerel Disk')}</small>
                        </div>
                        <span className="muted small">{drive.diskPercent.toFixed(0)}%</span>
                      </div>
                      <div className="meter-track"><div className="meter-fill" style={{ width: `${drive.diskPercent}%`, background: 'var(--meter-disk)' }} /></div>
                      <div className="muted small mono">{sizeText(drive.diskFree)} / {sizeText(drive.diskTotal)}</div>
                    </div>
                  ))}
                  {!driveSnapshots.length && (
                    <div className="disk-loading" role="status" aria-live="polite">
                      <span className="disk-spin" aria-hidden="true" />
                      <span>{t(drivesLoading ? 'Disk bilgileri alınıyor…' : 'Disk bilgisi alınamadı.')}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="card welcome">
                <h2><UiIcon label="Hoş geldiniz" />{t('Hoş geldiniz')}</h2>
                <p>{t('Bu panel winget tabanlı güncelleme, kaldırma ve kurulum; disk temizleme; bozuk kayıt defteri girdisi tarama ve güvenli temizleme işlemlerini tek arayüzde toplar. Tüm silme işlemleri onay gerektirir; kayıt defteri silmeden önce .reg yedeği alınır.')}</p>
                <div className="quick-actions">
                  <button className="btn btn-primary" onClick={() => setTab('updates')}><UiIcon label="Güncellemeleri göster" />{t('Güncellemeleri göster')}</button>
                  <button className="btn" onClick={() => setTab('disk')}><UiIcon label="Diski temizle" />{t('Diski temizle')}</button>
                  <button className="btn" onClick={() => setTab('registry')}><UiIcon label="Kayıt defterini tara" />{t('Kayıt defterini tara')}</button>
                </div>
              </div>
              <div className="card">
                <h3><UiIcon label="Sistem özeti" />{t('Sistem özeti')}</h3>
                <dl className="summary">
                  <div><dt>{t('Kurulu uygulama')}</dt><dd>{apps.length}</dd></div>
                  <div><dt>{t('Güncelleme bekleyen')}</dt><dd>{updates.length}</dd></div>
                  <div><dt>{t('Sürücü güncellemesi')}</dt><dd>{driverScan?.updates.length ?? 0}</dd></div>
                  <div><dt>{t('Önerilen yazılım')}</dt><dd>{CATALOG.length}</dd></div>
                  <div><dt>{t('Kayıt sorunu')}</dt><dd>{regIssues.length || regStats?.broken || 0}</dd></div>
                </dl>
              </div>
            </section>
          )}

          {tab === 'updates' && (
            <section className="page">
              <div className="toolbar">
                <div>
                  <h2><UiIcon label="{count} uygulama için güncelleme var" />{updates.length ? tf('{count} uygulama için güncelleme var', { count: updates.length }) : t('Tüm programlar güncel')}</h2>
                  <p className="muted">{updates.length ? t('Seçili güncellemeleri uygulayın veya tümünü tek seferde güncelleyin.') : t('winget taraması tamamlandı; güncellenmesi gereken uygulama bulunamadı.')}</p>
                </div>
                <div className="toolbar-actions">
                  <button className="btn" onClick={() => void run(t('Güncellemeler taranıyor'), refreshUpdates)}><UiIcon label="Yeniden tara" />{t('Yeniden tara')}</button>
                  <button
                    className="btn btn-primary"
                    disabled={!updates.length}
                    onClick={() => void upgradePackages(selectedUpdates.size ? updates.filter((pkg) => selectedUpdates.has(pkgKey(pkg))) : updates)}
                  ><UiIcon label="Seçilenleri güncelle" />
                    {selectedUpdates.size ? t('Seçilenleri güncelle') : t('Tümünü güncelle')}
                  </button>
                </div>
              </div>
              {updates.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th className="col-check"><input type="checkbox" checked={selectedUpdates.size === updates.length} onChange={() => toggleAll(updates, pkgKey, selectedUpdates, setSelectedUpdates)} /></th>
                        <th>{t('Uygulama')}</th><th>{t('Kimlik')}</th><th>{t('Mevcut')}</th><th>{t('Yeni')}</th><th>{t('Kaynak')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {updates.map((pkg) => (
                        <tr key={pkgKey(pkg)}>
                          <td><input type="checkbox" checked={selectedUpdates.has(pkgKey(pkg))} onChange={() => toggle(setSelectedUpdates, pkgKey(pkg))} /></td>
                          <td><div className="cell-app"><Avatar name={pkg.name} src={updateIcon(pkg, apps)} /><b>{pkg.name}</b></div></td>
                          <td className="mono">{pkg.ident}</td>
                          <td><span className="version-current" title={t('Mevcut sürüm')}>{pkg.version}</span></td>
                          <td><span className="badge badge-green">{pkg.available}</span></td>
                          <td>{pkg.source || 'winget'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="all-updated">
                  <div className="all-updated-icon" aria-hidden="true">✓</div>
                  <h3><UiIcon label="Tüm programlar güncel" />{t('Tüm programlar güncel')}</h3>
                  <p className="muted">{t('Kurulu uygulamalarınızın tamamı güncel görünüyor. Yeni sürümler çıktığında burada görebilirsiniz.')}</p>
                  <button className="btn" onClick={() => void run(t('Güncellemeler taranıyor'), refreshUpdates)}><UiIcon label="Yeniden tara" />{t('Yeniden tara')}</button>
                </div>
              )}
            </section>
          )}

          {tab === 'apps' && (
            <section className="page">
              <div className="toolbar">
                <div>
                  <h2><UiIcon label="Kurulu uygulamalar" />{t('Kurulu uygulamalar')}</h2>
                  <p className="muted">{t('Uygulama kaldırıldıktan sonra dosya ve kayıt defteri kalıntıları için tarama yapılıp yapılmayacağı sorulur.')}</p>
                </div>
                <div className="toolbar-actions">
                  <input className="search" placeholder={t('Uygulama ara…')} value={appQuery} onChange={(event) => setAppQuery(event.target.value)} />
                  <button className="btn" onClick={() => void run(t('Liste yenileniyor'), refreshApps)}><UiIcon label="Yenile" />{t('Yenile')}</button>
                  <button
                    className="btn btn-danger-ghost"
                    disabled={!selectedApps.size}
                    onClick={() => {
                      const chosen = apps.filter((app) => selectedApps.has(appKey(app)));
                      setConfirm({
                        title: t('Uygulamaları kaldır'),
                        message: tf('{count} uygulama winget ile kaldırılacak. Kaldırma sonrası kalıntı taraması sorulacak.', { count: chosen.length }),
                        options: [{ label: t('İptal'), value: 'cancel' }, { label: t('Kaldır'), value: 'remove', kind: 'danger' }],
                        onChoose: (value) => {
                          if (value !== 'remove') return;
                          void run(tf('{count} uygulama kaldırılıyor', { count: chosen.length }), async () => {
                            const removed: InstalledApp[] = [];
                            for (const app of chosen) {
                              if (await uninstallOne(app) === 0) removed.push(app);
                            }
                            await refreshAfterUninstall(removed);
                            // Soru yalnızca tüm kaldırma işlemleri bittikten sonra gösterilir.
                            if (removed.length) askLeftoverScan(removed);
                          });
                        },
                      });
                    }}
                  ><UiIcon label="Seçilenleri kaldır" />
                    {t('Seçilenleri kaldır')}
                  </button>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th className="col-check"><input type="checkbox" checked={filteredApps.length > 0 && selectedApps.size >= filteredApps.length} onChange={() => toggleAll(filteredApps, appKey, selectedApps, setSelectedApps)} /></th>
                      <th>{t('Uygulama')}</th><th>{t('Yayıncı')}</th><th>{t('Sürüm')}</th><th>{t('Boyut')}</th><th className="col-actions">{t('İşlem')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApps.map((app) => (
                      <tr key={appKey(app)}>
                        <td><input type="checkbox" checked={selectedApps.has(appKey(app))} onChange={() => toggle(setSelectedApps, appKey(app))} /></td>
                        <td><div className="cell-app"><Avatar name={app.name} src={app.icon} /><b>{app.name}</b></div></td>
                        <td>{app.publisher || '—'}</td>
                        <td>{app.version || '—'}</td>
                        <td className="mono">{app.size ? sizeText(app.size) : '—'}</td>
                        <td className="col-actions">
                          <div className="row-actions">
                            <button className="link-btn danger" onClick={() => void uninstallApp(app)}>
                              <span className="trash-icon" aria-hidden="true">🗑</span>{t('Kaldır')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!filteredApps.length && <tr><td colSpan={6} className="empty">{t('Uygulama bulunamadı.')}</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="muted small">{tf('Toplam {count} uygulama listeleniyor. Boyutlar kayıt defterindeki EstimatedSize değerinden alınır.', { count: apps.length })}</p>
            </section>
          )}

          {tab === 'bloatware' && (
            <section className="page">
              <div className="toolbar">
                <div>
                  <h2><UiIcon label="Gereksiz Yazılım Temizleyici" />{t('Gereksiz Yazılım Temizleyici')}</h2>
                  <p className="muted">{t('Windows ile birlikte gelen uygulamalar ve üretici (OEM) yazılımları listelenir.')}</p>
                </div>
                <div className="toolbar-actions">
                  <button className="btn" onClick={() => void run(t('Liste yenileniyor'), refreshBloatware)}><UiIcon label="Yenile" />{t('Yenile')}</button>
                  <button className="btn btn-danger-ghost" disabled={!selectedBloatware.size} onClick={removeSelectedBloatware}><UiIcon label="Seçilenleri kaldır" />
                    {t('Seçilenleri kaldır')}
                  </button>
                </div>
              </div>

              <div className="danger-zone danger-zone-page">
                <b>{t('DİKKAT — BU İŞLEM GERİ ALINAMAZ')}</b>
                <p>{t('Kaldırılan uygulamalar için yedek veya geri yükleme noktası oluşturulmaz.')}</p>
                <p>{t('Kaldırılan Windows uygulamaları ve OEM yazılımları Microsoft Store veya üretici web sitesi üzerinden yeniden yüklenebilir.')}</p>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th className="col-check">
                        <input
                          type="checkbox"
                          checked={bloatware.length > 0 && selectedBloatware.size >= bloatware.length}
                          onChange={() => toggleAll(bloatware, (item) => item.id, selectedBloatware, setSelectedBloatware)}
                        />
                      </th>
                      <th>{t('Uygulama')}</th>
                      <th>{t('Tür')}</th>
                      <th>{t('Yayıncı')}</th>
                      <th>{t('Açıklama')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bloatware.map((item) => (
                      <tr key={item.id}>
                        <td><input type="checkbox" checked={selectedBloatware.has(item.id)} onChange={() => toggle(setSelectedBloatware, item.id)} /></td>
                        <td>
                          <b>{item.name}</b>
                          {item.version && <div className="muted small">{item.version}</div>}
                        </td>
                        <td>
                          <span className={`badge ${item.kind === 'oem-app' ? 'badge-warn' : ''}`}>
                            {item.kind === 'windows-app' ? t('Windows uygulaması') : t('OEM yazılımı')}
                          </span>
                        </td>
                        <td>{item.publisher || '—'}</td>
                        <td className="small">
                          {item.reason}
                          {item.provisioned && <div className="muted">{t('Yeni kullanıcılar için de kaldırılır.')}</div>}
                        </td>
                      </tr>
                    ))}
                    {!bloatware.length && <tr><td colSpan={5} className="empty">{t('Ön yüklü yazılım bulunamadı.')}</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="muted small">{tf('{count} yazılım listeleniyor. Kaldırma PowerShell ve winget ile yapılır.', { count: bloatware.length })}</p>
            </section>
          )}

          {tab === 'startup' && (
            <section className="page">
              <div className="toolbar">
                <div>
                  <h2><UiIcon label="Başlangıç uygulamaları" />{t('Başlangıç uygulamaları')}</h2>
                  <p className="muted">{t('Windows başlarken çalışan uygulamaları kapatıp açabilirsiniz. Değişiklikler anında geçerlidir.')}</p>
                </div>
                <div className="toolbar-actions">
                  <button className="btn" onClick={() => void run(t('Başlangıç listesi yenileniyor'), async () => setStartupItems(await api.startupList()))}><UiIcon label="Yenile" />{t('Yenile')}</button>
                </div>
              </div>
              <div className="stat-strip">
                <span>{t('Toplam')}: <b>{startupItems.length}</b></span>
                <span>{t('Etkin')}: <b>{startupItems.filter((item) => item.enabled).length}</b></span>
                <span>{t('Devre dışı')}: <b>{startupItems.filter((item) => !item.enabled).length}</b></span>
              </div>
              <div className="card">
                <div className="card-head">
                  <div>
                    <h3><UiIcon label="İlk 10 başlangıç uygulaması" />{t('İlk 10 başlangıç uygulaması')}</h3>
                    <p className="muted small">{t('Önyükleme sonrası işlem başlangıç zamanı (yaklaşık).')}</p>
                  </div>
                  <button className="btn btn-small" onClick={() => void run(t('Başlangıç zamanları yenileniyor'), async () => setStartupTimings(await api.startupTimings()))}><UiIcon label="Yenile" />{t('Yenile')}</button>
                </div>
                <div className="timing-chart">
                  {startupTimings.map((timing) => {
                    const max = Math.max(1, startupTimings[startupTimings.length - 1]?.seconds ?? 1);
                    return (
                      <div className="timing-row" key={`${timing.processName}-${timing.seconds}`}>
                        <span className="timing-label" title={timing.command}>{timing.name}</span>
                        <div className="timing-track"><div className="timing-fill" style={{ width: `${Math.max(2, (timing.seconds / max) * 100)}%` }} /></div>
                        <span className="mono small">{timing.seconds.toFixed(1)} sn</span>
                      </div>
                    );
                  })}
                  {!startupTimings.length && <p className="empty">{t('Başlangıç zamanı ölçülemedi.')}</p>}
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('Uygulama')}</th><th>{t('Komut')}</th><th>{t('Konum')}</th><th>{t('Kapsam')}</th><th className="col-actions">{t('Durum')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {startupItems.map((item) => (
                      <tr key={item.id} className={item.enabled ? undefined : 'muted'}>
                        <td><b>{item.name}</b></td>
                        <td className="mono small" title={item.command}>{item.command}</td>
                        <td className="small">{t(item.location)}</td>
                        <td><span className="badge">{t(item.scope === 'user' ? 'Kullanıcı' : 'Sistem')}</span></td>
                        <td className="col-actions">
                          <div className="row-actions">
                            <button
                              className={`btn btn-small ${item.enabled ? 'btn-danger-ghost' : 'btn-primary'}`}
                              onClick={() => void run(t('Başlangıç ayarı güncelleniyor'), async () => {
                                const message = await api.startupSet(item, !item.enabled);
                                setStartupItems((prev) => prev.map((current) => current.id === item.id ? { ...current, enabled: !item.enabled } : current));
                                notify('ok', t(message));
                              })}
                            ><UiIcon label="Kapat" />
                              {item.enabled ? t('Kapat') : t('Aç')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!startupItems.length && <tr><td colSpan={5} className="empty">{t('Henüz tarama yapılmadı veya başlangıç öğesi bulunamadı.')}</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="muted small">{t('Devre dışı bırakılan girdiler yedeklenir; istediğiniz zaman geri açabilirsiniz.')}</p>
            </section>
          )}

          {tab === 'firewall' && (
            <section className="page">
              <div className="toolbar">
                <div>
                  <h2><UiIcon label="Güvenlik duvarı denetimi" />{t('Güvenlik duvarı denetimi')}</h2>
                  <p className="muted">{t('Etkin gelen kurallar denetlenir; kapsamı geniş, programı eksik veya imzasız ikili dosyaları olanlar listelenir.')}</p>
                </div>
                <div className="toolbar-actions">
                  <button className="btn" onClick={() => void run(t('Güvenlik duvarı kuralları denetleniyor'), async () => setFirewallRules(await api.firewallScan()))}><UiIcon label="Tara" />{t('Tara')}</button>
                </div>
              </div>
              <div className="stat-strip">
                <span>{t('Kritik')}: <b className="danger-text">{firewallCritical}</b></span>
                <span>{t('Orta')}: <b className="warn-text">{firewallMedium}</b></span>
                <span>{t('Toplam')}: <b>{firewallRules.length}</b></span>
              </div>
              <div className="filter-row">
                {([['all', 'Tümü'], ['critical', 'Kritik'], ['medium', 'Orta']] as const).map(([value, label]) => (
                  <button key={value} className={`chip ${firewallFilter === value ? 'chip-active' : ''}`} onClick={() => setFirewallFilter(value)}><UiIcon icon={value === 'all' ? '☑️' : value === 'critical' ? '⛔' : '⚠️'} />{t(label)}</button>
                ))}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('Kural')}</th><th>{t('Program')}</th><th>{t('Kapsam')}</th><th>{t('İmza')}</th><th>{t('Önem')}</th><th>{t('Gerekçe')}</th><th className="col-actions">{t('İşlem')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleFirewall.map((rule) => (
                      <tr key={rule.id}>
                        <td><b>{rule.name}</b><div className="muted small mono">{rule.id}</div></td>
                        <td className="small mono" title={rule.program}>{rule.program || '—'}</td>
                        <td className="small"><div>{t('Uzak')}: {rule.remoteAddress || 'Any'}</div><div>{t('Yerel port')}: {rule.localPort || 'Any'}</div><div>{t('Uzak port')}: {rule.remotePort || 'Any'}</div></td>
                        <td className="small">{t(rule.signature)}</td>
                        <td><span className={`badge ${rule.severity === 'critical' ? 'badge-danger' : 'badge-warn'}`}>{t(rule.severity === 'critical' ? 'KRİTİK' : 'ORTA')}</span></td>
                        <td className="small">{rule.reasons.map((reason) => t(reason)).join(', ')}</td>
                        <td className="col-actions">
                          <div className="row-actions">
                            <button className="link-btn" onClick={() => setConfirm({
                              title: t('Kuralı devre dışı bırak'),
                              message: tf('"{name}" adlı güvenlik duvarı kuralı devre dışı bırakılacak. Değişiklik anında geçerlidir.', { name: rule.name }),
                              options: [{ label: t('Vazgeç'), value: 'cancel' }, { label: t('Devre dışı bırak'), value: 'disable', kind: 'danger' }],
                              onChoose: (value) => {
                                if (value !== 'disable') return;
                                void run(t('Kural güncelleniyor'), async () => {
                                  notify('ok', t(await api.firewallSet(rule.id, false)));
                                  setFirewallRules((prev) => prev.filter((item) => item.id !== rule.id));
                                });
                              },
                            })}><UiIcon label="Devre dışı bırak" />{t('Devre dışı bırak')}</button>
                            <button className="link-btn danger" onClick={() => setConfirm({
                              title: t('Kuralı sil'),
                              message: tf('"{name}" adlı kural silinecek. Silmeden önce JSON yedeği alınacak.\nYedekler: {path}', { name: rule.name, path: firewallBackupPath || '%LOCALAPPDATA%\\ParsSistemYoneticisi\\firewall_backups' }),
                              options: [{ label: t('Vazgeç'), value: 'cancel' }, { label: t('Yedekle ve sil'), value: 'delete', kind: 'danger' }],
                              onChoose: (value) => {
                                if (value !== 'delete') return;
                                void run(t('Kural siliniyor'), async () => {
                                  notify('ok', t(await api.firewallDelete(rule.id)));
                                  setFirewallRules((prev) => prev.filter((item) => item.id !== rule.id));
                                });
                              },
                            })}><UiIcon label="Sil" />{t('Sil')}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!visibleFirewall.length && <tr><td colSpan={7} className="empty">{t('Henüz tarama yapılmadı veya bu filtreye uygun kural bulunamadı.')}</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="muted small">{t('Devre dışı bırakılan kurallar listeden kalkar; yeniden açmak için Windows Güvenlik Duvarı konsolunu kullanın.')}</p>
            </section>
          )}

          {tab === 'malware' && (
            <section className="page">
              <div className="toolbar">
                <div>
                  <h2><UiIcon label="Kötü amaçlı yazılım taraması" />{t('Kötü amaçlı yazılım taraması')}</h2>
                  <p className="muted">{t('Çoklu motorlu yerel denetim: imzalar, sezgisel analiz, betik analizi, sistem bütünlüğü ve kalıcılık.')}</p>
                </div>
                <div className="toolbar-actions">
                  <button className="btn btn-primary" disabled={!malwareEngines.length || !!busy} onClick={() => void run(t('Tehdit taraması sürüyor'), async () => setMalwareResult(await api.malwareScan(malwareEngines)))}><UiIcon label="Taramayı başlat" />{t('Taramayı başlat')}</button>
                </div>
              </div>
              <div className="filter-row">
                {MALWARE_ENGINES.map((engine) => (
                  <button
                    key={engine.id}
                    className={`chip ${malwareEngines.includes(engine.id) ? 'chip-active' : ''}`}
                    onClick={() => setMalwareEngines((prev) => prev.includes(engine.id) ? prev.filter((id) => id !== engine.id) : [...prev, engine.id])}
                  >
                    <UiIcon icon="🛡️" />{t(engine.label)}
                  </button>
                ))}
              </div>
              <p className="muted small">{t('Bu tarama yalnızca okunabilir denetim yapar; dosya silmez, işlem sonlandırmaz. Antivirüs yerine geçmez.')}</p>
              {malwareResult && (
                <>
                  <div className="stat-strip">
                    <span>{t('Toplam bulgu')}: <b>{malwareFindings.length}</b></span>
                    <span>{t('Kritik')}: <b className="danger-text">{malwareFindings.filter((item) => item.severity === 'critical').length}</b></span>
                    <span>{t('Orta')}: <b className="warn-text">{malwareFindings.filter((item) => item.severity === 'medium').length}</b></span>
                    <span>{t('Süre')}: <b>{(malwareResult.durationMs / 1000).toFixed(1)} sn</b></span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>{t('Önem')}</th><th>{t('Motor')}</th><th>{t('Bulgu')}</th><th>{t('Detay')}</th></tr></thead>
                      <tbody>
                        {malwareFindings.map((finding) => (
                          <tr key={finding.id}>
                            <td><span className={`badge ${finding.severity === 'critical' ? 'badge-danger' : finding.severity === 'medium' ? 'badge-warn' : ''}`}>{t(finding.severity === 'critical' ? 'KRİTİK' : finding.severity === 'medium' ? 'ORTA' : finding.severity === 'low' ? 'DÜŞÜK' : 'BİLGİ')}</span></td>
                            <td className="small">{t(MALWARE_ENGINES.find((engine) => engine.id === finding.engine)?.label ?? finding.engine)}</td>
                            <td><b>{finding.title}</b>{finding.path && <div className="muted small mono">{finding.path}</div>}</td>
                            <td className="small">{finding.detail}</td>
                          </tr>
                        ))}
                        {!malwareFindings.length && <tr><td colSpan={4} className="empty">{t('Seçilen motorlarda şüpheli bulgu bulunamadı.')}</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          )}

          {tab === 'disk' && (
            <section className="page">
              <div className="toolbar">
                <div>
                  <h2><UiIcon label="Disk temizleme" />{t('Disk temizleme')}</h2>
                  <p className="muted">{t('Kategorileri tarayıp seçtiklerinizi temizleyin. Kilitli dosyalar atlanır; klasörlerin kendisi silinmez.')}</p>
                </div>
                <div className="toolbar-actions">
                  <button className="btn" onClick={() => void run(t('Disk taranıyor'), async () => { setDiskTargets(await api.diskScan()); })}><UiIcon label="Tara" />{t('Tara')}</button>
                  <button className="btn" onClick={() => void api.diskCleanupLogPath().then((file) => api.openPath(file)).catch((error: Error) => notify('error', error.message))}><UiIcon label="Temizlik kaydını aç" />{t('Temizlik kaydını aç')}</button>
                  <button
                    className="btn btn-danger-ghost"
                    disabled={!selectedDisk.size}
                    onClick={() => {
                      const names = diskTargets.filter((item) => selectedDisk.has(item.key)).map((item) => item.name);
                      setConfirm({
                        title: t('Disk temizleme onayı'),
                        message: tf('{names} kategorisi temizlenecek.\n\nBu işlem kalıcıdır. Geri Dönüşüm Kutusu seçiliyse şu sürücülerin kutusu boşaltılacaktır: {drives}', {
                          names: names.join(', '),
                          drives: [...recycleDrives].join(', ') || t('sistem sürücüsü'),
                        }),
                        options: [{ label: t('Vazgeç'), value: 'cancel' }, { label: t('Temizle'), value: 'clean', kind: 'danger' }],
                        onChoose: (value) => {
                          if (value === 'clean') void run(t('Disk temizleniyor'), async () => {
                            const results = await api.diskClean([...selectedDisk], [...recycleDrives]);
                            const ok = results.filter((result) => result.ok).length;
                            notify(ok ? 'ok' : 'error', tf('{ok}/{total} kategori temizlendi.', { ok, total: results.length }));
                            setDiskTargets(await api.diskScan());
                            setSelectedDisk(new Set());
                          });
                        },
                      });
                    }}
                  ><UiIcon label="Seçilenleri temizle" />
                    {t('Seçilenleri temizle')}
                  </button>
                </div>
              </div>
              <div className="notice recycle-drives">
                <div>
                  <b>{t('Geri Dönüşüm Kutusu sürücüleri')}</b>
                  <p className="muted">{t('Kutu boşaltma işlemi yalnızca işaretli sürücülerde uygulanır.')}</p>
                </div>
                <div className="chips">
                  {drives.map((drive) => (
                    <button
                      key={drive}
                      className={`chip ${recycleDrives.has(drive) ? 'active' : ''}`}
                      onClick={() => toggle(setRecycleDrives, drive)}
                    >
                      <UiIcon icon="💽" />{drive}
                    </button>
                  ))}
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th className="col-check"><input type="checkbox" checked={diskTargets.length > 0 && selectedDisk.size === diskTargets.length} onChange={() => toggleAll(diskTargets, (item) => item.key, selectedDisk, setSelectedDisk)} /></th>
                      <th>{t('Kategori')}</th><th>{t('Açıklama')}</th><th>{t('Durum')}</th><th>{t('Boyut')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diskTargets.map((item) => (
                      <tr key={item.key}>
                        <td><input type="checkbox" checked={selectedDisk.has(item.key)} onChange={() => toggle(setSelectedDisk, item.key)} /></td>
                        <td><b>{item.name}</b>{item.needsAdmin && <span className="badge badge-warn">{t('yönetici')}</span>}</td>
                        <td className="muted">{item.description}</td>
                        <td>{item.available ? <span className="badge badge-green">{item.count ? tf('{count} öğe', { count: item.count }) : t('hazır')}</span> : <span className="badge">{t('yok')}</span>}</td>
                        <td className="mono">{item.available ? sizeText(item.size) : '—'}</td>
                      </tr>
                    ))}
                    {!diskTargets.length && <tr><td colSpan={5} className="empty">{t('Kategoriler yükleniyor…')}</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'drivers' && (
            <section className="page">
              <div className="toolbar">
                <div>
                  <h2><UiIcon label="Sürücü yönetimi" />{t('Sürücü yönetimi')}</h2>
                  <p className="muted">{t('Kurulu sürücüler listelenir; Windows Update üzerinden sürücü güncellemeleri taranır. Kurulumdan önce yedek alınabilir.')}</p>
                </div>
                <div className="toolbar-actions">
                  <button className="btn" onClick={() => void run(t('Sürücüler taranıyor'), refreshDrivers)}><UiIcon label="Tara" />{t('Tara')}</button>
                  <button className="btn" onClick={() => void run(t('Sürücüler yedekleniyor'), async () => {
                    const result = await api.driversBackup();
                    notify(result.ok ? 'ok' : 'error', result.message);
                  })}><UiIcon label="Yedek al" />{t('Yedek al')}</button>
                  <button
                    className="btn btn-primary"
                    disabled={!driverScan?.updates.length || !selectedDrivers.size}
                    onClick={() => {
                      const chosen = driverScan?.updates.filter((item) => selectedDrivers.has(item.id)) ?? [];
                      void run(tf('{count} sürücü güncelleniyor', { count: chosen.length }), async () => {
                        const results = await api.driversInstall(chosen.map((item) => item.id), driverBackupBefore);
                        const ok = results.filter((result) => result.ok).length;
                        notify(ok ? 'ok' : 'error', tf('{ok}/{total} güncelleme tamamlandı.', { ok, total: results.length }));
                        if (results.some((result) => result.rebootRequired)) notify('info', t('Değişikliklerin tamamlanması için yeniden başlatma gerekiyor.'));
                        await refreshDrivers();
                      });
                    }}
                  ><UiIcon label="Seçilenleri kur" />
                    {t('Seçilenleri kur')}
                  </button>
                </div>
              </div>
              {driverScan && (
                <div className="stat-strip">
                  <span>{t('Kurulu sürücü')}: <b>{driverScan.installed.length}</b></span>
                  <span className="danger-text">{t('Güncellemeler')}: <b>{driverScan.updates.length}</b></span>
                  <span>{t('Yönetici')}: <b>{t(driverScan.isAdmin ? 'evet' : 'hayır')}</b></span>
                </div>
              )}
              <div className="card">
                <div className="card-top">
                  <span className="card-label">{t('Kurulum seçenekleri')}</span>
                </div>
                <label className="toggle-row" style={{ borderBottom: 'none', padding: '4px 0' }}>
                  <span>
                    <strong>{t('Kurulumdan önce sürücü yedeği al')}</strong>
                    <small>{t('Windows DISM ile tüm sürücüler yedeklenir; yedek alınamazsa kurulum yine devam eder.')}</small>
                  </span>
                  <input type="checkbox" checked={driverBackupBefore} onChange={(event) => setDriverBackupBefore(event.target.checked)} />
                  <span className="switch" aria-hidden="true" />
                </label>
              </div>
              <div className="card">
                <h3><UiIcon label="Güncellemeler" />{t('Güncellemeler')}</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th className="col-check"><input type="checkbox" checked={(driverScan?.updates.length ?? 0) > 0 && selectedDrivers.size === driverScan?.updates.length} onChange={() => toggleAll(driverScan?.updates ?? [], (item) => item.id, selectedDrivers, setSelectedDrivers)} /></th>
                        <th>{t('Başlık')}</th><th>{t('Üretici / Model')}</th><th>{t('Sürüm')}</th><th>{t('Boyut')}</th><th>{t('Yeniden başlatma')}</th><th className="col-actions">{t('İşlem')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(driverScan?.updates ?? []).map((item) => (
                        <tr key={item.id}>
                          <td><input type="checkbox" checked={selectedDrivers.has(item.id)} onChange={() => toggle(setSelectedDrivers, item.id)} /></td>
                          <td><b>{item.title}</b>{item.mandatory && <span className="badge badge-warn">{t('zorunlu')}</span>}
                            {item.downloaded && <span className="badge badge-green">{t('indirildi')}</span>}</td>
                          <td>{[item.manufacturer, item.model].filter(Boolean).join(' / ') || '—'}</td>
                          <td className="mono">{item.version || '—'}</td>
                          <td className="mono">{sizeText(item.size)}</td>
                          <td>{item.reboot}</td>
                          <td className="col-actions">
                            <button
                              className="link-btn"
                              onClick={() => void run(t('Sürücü indiriliyor'), async () => {
                                const results = await api.driversDownload([item.id]);
                                notify(results[0]?.ok ? 'ok' : 'error', results[0]?.message ?? t('İndirme sonucu alınamadı.'));
                                await refreshDrivers();
                              })}
                            ><UiIcon label="İndir" />
                              {t('İndir')}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!driverScan?.updates.length && <tr><td colSpan={7} className="empty">{t('Sürücü güncellemesi bulunamadı. Yeniden taramak için “Tara” düğmesine basın.')}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="card">
                <div className="toolbar">
                  <h3><UiIcon label="Kurulu sürücüler" />{t('Kurulu sürücüler')}</h3>
                  <input className="search" placeholder={t('Sürücü ara…')} value={driverQuery} onChange={(event) => setDriverQuery(event.target.value)} />
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>{t('Cihaz')}</th><th>{t('Üretici')}</th><th>{t('Sağlayıcı')}</th><th>{t('Sürüm')}</th><th>{t('Tarih')}</th><th>{t('Sınıf')}</th><th>{t('İmza')}</th><th>{t('Durum')}</th></tr>
                    </thead>
                    <tbody>
                      {filteredDrivers.map((item, index) => (
                        <tr key={`${item.inf}-${item.device}-${index}`}>
                          <td><b>{item.device}</b></td>
                          <td>{item.manufacturer || '—'}</td>
                          <td>{item.provider || '—'}</td>
                          <td className="mono">{item.version || '—'}</td>
                          <td className="mono">{item.date || '—'}</td>
                          <td>{item.deviceClass || '—'}</td>
                          <td>{item.signed ? <span className="badge badge-green">{t('imzalı')}</span> : <span className="badge badge-warn">{t('imzasız')}</span>}</td>
                          <td>{item.status || '—'}</td>
                        </tr>
                      ))}
                      {!filteredDrivers.length && <tr><td colSpan={8} className="empty">{t('Kurulu sürücü bulunamadı veya henüz taranmadı.')}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {tab === 'recommended' && (
            <section className="page">
              <div className="toolbar">
                <div>
                  <h2><UiIcon label="Uygulama Kütüphanesi" />{t('Uygulama Kütüphanesi')}</h2>
                  <p className="muted">{t('Kutucuğa tıklayarak uygulamayı seçin; sağdaki listeden kurulumu yönetin.')}</p>
                </div>
                <div className="toolbar-actions">
                  <input className="search" placeholder={t('Yazılım ara…')} value={recQuery} onChange={(event) => setRecQuery(event.target.value)} />
                </div>
              </div>
              <div className="chips">
                {(['all', 'winget', 'choco', 'npm', 'scoop'] as const).map((source) => {
                  const status = managerStatus.find((manager) => manager.source === source);
                  const managerLabel = source === 'all' ? t('Tümü') : source === 'winget' ? 'winget' : source === 'choco' ? 'Chocolatey' : source === 'npm' ? 'npm' : 'Scoop';
                  const statusText = source === 'all'
                    ? ''
                    : status ? (status.available ? t('kullanılabilir') : t('kurulu değil')) : t('kurulu değil');
                  return (
                    <button key={source} className={`chip ${recSource === source ? 'active' : ''}`} onClick={() => setRecSource(source)}>
                      <UiIcon label="Tümü" />
                      {managerLabel}
                      {statusText && <span className={`manager-dot ${status?.available ? 'ok' : 'warn'}`} title={status?.version || ''}>{statusText}</span>}
                    </button>
                  );
                })}
              </div>
              <div className="chips">
                {['Tümü', ...CATEGORIES].map((category) => (
                  <button key={category} className={`chip ${recCategory === category ? 'active' : ''}`} onClick={() => setRecCategory(category)}><UiIcon icon={categoryIcon(category)} />{t(category)}</button>
                ))}
              </div>
              <div className="library-layout">
                <div className="software-grid library-grid">
                  {filteredRecommended.map((item) => {
                    const installed = installedIds.has(recKey(item));
                    const key = recKey(item);
                    return (
                      <div
                        key={key}
                        role="button"
                        tabIndex={0}
                        className={`software-card library-card ${installed ? 'installed' : ''} ${selectedRec.has(key) ? 'selected' : ''}`}
                        onClick={() => toggle(setSelectedRec, key)}
                        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(setSelectedRec, key); } }}
                        aria-pressed={selectedRec.has(key)}
                      >
                        <div className="software-head">
                          <Avatar name={item.name} src={favicon(item)} />
                          <div className="software-title">
                            <b>{item.name}</b>
                            <small>{t(item.category)} · {item.source ?? 'winget'}</small>
                          </div>
                          <input type="checkbox" checked={selectedRec.has(key)} onChange={() => toggle(setSelectedRec, key)} onClick={(event) => event.stopPropagation()} />
                        </div>
                        <p>{item.description}</p>
                        <div className="software-foot">
                          <code>{item.ident}</code>
                          {installed && <span className="badge badge-green">{t('kurulu')}</span>}
                        </div>
                      </div>
                    );
                  })}
                  {!filteredRecommended.length && <p className="empty">{t('Kriterlere uygun yazılım yok.')}</p>}
                </div>
                <aside className="library-selection">
                  <h3><UiIcon label="Seçilen uygulamalar" />{t('Seçilen uygulamalar')}</h3>
                  <p className="muted">{t('Kurulum için aşağıdaki uygulamalar seçildi.')}</p>
                  {selectedRecommended.length ? (
                    <ul className="selected-list">
                      {selectedRecommended.map((item) => (
                        <li key={recKey(item)}>
                          <span>{item.name}</span>
                          <button className="btn btn-small" onClick={() => toggle(setSelectedRec, recKey(item))}>{t('Kaldır')}</button>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="empty">{t('Henüz uygulama seçilmedi.')}</p>}
                  <button className="btn btn-primary library-install" disabled={installing || !selectedRecommended.length} onClick={() => void installSoftware(selectedRecommended)}>
                    <UiIcon label="Yükle" />{installing ? t('Kuruluyor…') : t('Yükle')}
                  </button>
                </aside>
              </div>
            </section>
          )}

          {tab === 'registry' && (
            <section className="page">
              <div className="toolbar">
                <div>
                  <h2><UiIcon label="Kayıt defteri taraması" />{t('Kayıt defteri taraması')}</h2>
                  <p className="muted">{t('Dokuz kapsam salt okunur taranır. Yalnızca kanıtlanmış bozuk Uninstall/App Paths girdileri zorunlu .reg yedek ve açık onayla silinebilir; UserChoice, COM, servis ve referans kayıtlarına dokunulmaz.')}</p>
                </div>
                <div className="toolbar-actions">
                  <button className="btn" onClick={() => void run(t('Kayıt defteri taranıyor'), async () => {
                    const result = await api.registryScan(regScopes);
                    setRegIssues(result.issues);
                    setRegStats(result.stats);
                    setSelectedReg(new Set());
                  })}><UiIcon label="Tara" />{t('Tara')}</button>
                  <button className="btn btn-small" onClick={() => {
                    void api.registryBackupPath()
                      .then((folder) => api.openPath(folder))
                      .catch((error: Error) => notify('error', error.message));
                  }}><UiIcon label="Yedek klasörünü aç" />{t('Yedek klasörünü aç')}</button>
                  <button className="btn btn-small" disabled={!regIssues.length} onClick={() => void run(t('JSON raporu kaydediliyor'), async () => {
                    const result = await api.registryExportReport('json');
                    notify(result.ok ? 'ok' : 'error', result.message);
                  })}><UiIcon label="Raporu JSON kaydet" />{t('Raporu JSON kaydet')}</button>
                  <button className="btn btn-small" disabled={!regIssues.length} onClick={() => void run(t('CSV raporu kaydediliyor'), async () => {
                    const result = await api.registryExportReport('csv');
                    notify(result.ok ? 'ok' : 'error', result.message);
                  })}><UiIcon label="Raporu CSV kaydet" />{t('Raporu CSV kaydet')}</button>
                  <button
                    className="btn btn-danger-ghost"
                    disabled={!selectedReg.size}
                    onClick={() => {
                      const chosenForConfirm = regIssues.filter((issue) => selectedReg.has(regKey(issue)) && issue.fixable);
                      const systemCount = chosenForConfirm.filter((issue) => issue.system).length;
                      const warning = systemCount
                        ? `\n${tf('DİKKAT: Seçilenlerden {count} tanesi sistem/korumalı bileşendir. Yedek alınmadan silinmez.', { count: systemCount })}`
                        : '';
                      setConfirm({
                        title: t('Kayıt girdilerini sil'),
                        message: tf('{count} bozuk girdi silinecek. Her girdi için önce yedek alınacak; yedek alınamazsa girdi silinmeyecek.\nYedekler: %LOCALAPPDATA%\\ParsSistemYoneticisi\\registry_backups', { count: chosenForConfirm.length }) + warning,
                        options: [{ label: t('Vazgeç'), value: 'cancel' }, { label: t('Yedekle ve sil'), value: 'delete', kind: 'danger' }],
                        onChoose: (value) => {
                          if (value !== 'delete') return;
                          void run(t('Kayıt girdileri siliniyor'), async () => {
                            const chosen = regIssues.filter((issue) => selectedReg.has(regKey(issue)) && issue.fixable);
                            const results = await api.registryDelete(chosen);
                            const ok = results.filter((result) => result.ok).length;
                            notify(ok ? 'ok' : 'error', tf('{ok}/{total} girdi silindi.', { ok, total: results.length }));
                            const rescan = await api.registryScan(regScopes);
                            setRegIssues(rescan.issues);
                            setRegStats(rescan.stats);
                            setSelectedReg(new Set());
                          });
                        },
                      });
                    }}
                  ><UiIcon label="Seçilenleri sil" />
                    {t('Seçilenleri sil')}
                  </button>
                </div>
              </div>
              <div className="filter-row">
                <span className="muted small">{t('Kapsamlar')}:</span>
                {REG_SCAN_SCOPES.map((scope) => {
                  const active = regScopes.includes(scope);
                  const label = REG_SCOPE_LABELS[scope];
                  return (
                    <label key={scope} className={`chip ${active ? 'chip-active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => setRegScopes((prev) => active ? prev.filter((item) => item !== scope) : [...prev, scope])}
                      /> <UiIcon label={label} />{t(label)}
                    </label>
                  );
                })}
              </div>
              <div className="filter-row">
                <span className="muted small">{t('Filtre')}:</span>
                {([
                  ['all', 'Tümü'],
                  ['broken', 'Bozuk'],
                  ['warning', 'Güvenlik uyarısı'],
                  ['critical', 'Sistem kritik'],
                ] as const).map(([value, label]) => (
                  <button key={value} className={`chip ${regFilter === value ? 'chip-active' : ''}`} onClick={() => setRegFilter(value)}>
                    <UiIcon label={label} />{t(label)}
                  </button>
                ))}
              </div>
              {regStats && (
                <div className="stat-strip">
                  <span>{t('İncelenen')}: <b>{regStats.scanned}</b></span>
                  <span>{t('Bulgular')}: <b>{regStats.findings}</b></span>
                  <span>{t('Korumalı sistem girdisi')}: <b>{regStats.protected}</b></span>
                  <span>{t('Sistem bileşeni')}: <b>{regStats.system}</b></span>
                  <span className="danger-text">{t('Bozuk')}: <b>{regStats.broken}</b></span>
                </div>
              )}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th className="col-check"><input
                        type="checkbox"
                        checked={filteredRegIssues.some((issue) => issue.fixable) && filteredRegIssues.filter((issue) => issue.fixable).every((issue) => selectedReg.has(regKey(issue)))}
                        onChange={() => toggleAll(filteredRegIssues.filter((issue) => issue.fixable), regKey, selectedReg, setSelectedReg)}
                      /></th>
                      <th>{t('Kategori')}</th><th>{t('Risk')}</th><th>{t('Uygulama')}</th><th>{t('Sorun')}</th><th>{t('Öneri')}</th><th>{t('Detay')}</th><th>{t('Kök')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRegIssues.map((issue) => {
                      const categoryLabel = REG_SCOPE_LABELS[issue.category || 'uninstall'];
                      const risk = issue.risk || 'warning';
                      const riskClass = risk === 'critical' ? 'badge badge-danger' : risk === 'warning' ? 'badge badge-warn' : 'badge badge-green';
                      return (
                        <tr key={regKey(issue)}>
                          <td><input
                            type="checkbox"
                            disabled={!issue.fixable}
                            title={issue.fixable ? t('Yedekli silmeye uygun') : t('Salt rapor; silinmez')}
                            checked={selectedReg.has(regKey(issue))}
                            onChange={() => toggle(setSelectedReg, regKey(issue))}
                          /></td>
                          <td><span className="badge"><UiIcon label={categoryLabel} />{t(categoryLabel)}</span></td>
                          <td><span className={riskClass}>{t(REG_RISK_LABELS[risk])}</span></td>
                          <td><b>{issue.name}</b>{issue.system && <span className="badge badge-warn">{t('SİSTEM')}</span>}</td>
                          <td><span className="badge badge-warn">{t(issue.reason)}</span>{issue.signature && <span className="badge">{issue.signature}</span>}</td>
                          <td className="small">{issue.recommendation ? t(issue.recommendation) : '—'}</td>
                          <td className="mono small" title={issue.detail}>{issue.detail}</td>
                          <td><span className="badge">{issue.label}</span></td>
                        </tr>
                      );
                    })}
                    {!filteredRegIssues.length && <tr><td colSpan={8} className="empty">{t('Bu filtreye uygun bulgu yok.')}</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="muted small">{t('Rapor dışa aktarımı yalnızca kanıt kaydıdır; .reg yedeklerinin yerine geçmez.')}</p>
            </section>
          )}

          {tab === 'schedule' && (
            <section className="page">
              <div className="toolbar">
                <div>
                  <h2><UiIcon label="Zamanlanmış temizlik" />{t('Zamanlanmış temizlik')}</h2>
                  <p className="muted">{t('Dört hazır temizlik planını etkinleştirin; görevler uygulama açıkken belirtilen saatte çalışır. Geri dönüşüm kutusu hiçbir plana dahil edilmez.')}</p>
                </div>
                <div className="toolbar-actions">
                  <button className="btn" onClick={() => void run(t('Zamanlamalar yenileniyor'), async () => setSchedules(await api.scheduleList()))}><UiIcon label="Yenile" />{t('Yenile')}</button>
                </div>
              </div>
              <div className="schedule-grid">
                {schedules.map((task) => (
                  <div className="card schedule-card" key={task.id}>
                    <div className="schedule-head">
                      <span className="schedule-icon">{SCHEDULE_INFO[task.kind].icon}</span>
                      <div>
                        <h3><UiIcon icon="◷" />{t(task.name)}</h3>
                        <p className="muted small">{t(SCHEDULE_INFO[task.kind].description)}</p>
                      </div>
                    </div>
                    <Toggle
                      label={t('Etkin')}
                      hint={t('Zamanlayıcı yalnızca etkin planları çalıştırır.')}
                      checked={task.enabled}
                      onChange={(value) => updateSchedule(task.id, { enabled: value })}
                    />
                    <div className="setting-row compact">
                      <div><strong>{t('Saat')}</strong></div>
                      <input type="time" value={task.time} onChange={(event) => updateSchedule(task.id, { time: event.target.value })} />
                    </div>
                    {task.kind === 'weekly-full' && (
                      <div className="setting-row compact">
                        <div><strong>{t('Haftanın günü')}</strong></div>
                        <select value={task.dayOfWeek ?? 0} onChange={(event) => updateSchedule(task.id, { dayOfWeek: Number(event.target.value) })}>
                          {['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'].map((day, index) => <option key={day} value={index}>{t(day)}</option>)}
                        </select>
                      </div>
                    )}
                    {task.kind === 'monthly-deep' && (
                      <div className="setting-row compact">
                        <div><strong>{t('Ayın günü')}</strong></div>
                        <input type="number" min={1} max={28} value={task.dayOfMonth ?? 1} onChange={(event) => updateSchedule(task.id, { dayOfMonth: Math.min(28, Math.max(1, Number(event.target.value))) })} />
                      </div>
                    )}
                    {task.kind === 'custom' && (
                      <div className="setting-row compact">
                        <div><strong>{t('Aralık (gün)')}</strong></div>
                        <input type="number" min={1} max={365} value={task.intervalDays ?? 7} onChange={(event) => updateSchedule(task.id, { intervalDays: Math.min(365, Math.max(1, Number(event.target.value))) })} />
                      </div>
                    )}
                    <dl className="summary compact">
                      <div><dt>{t('Son çalışma')}</dt><dd className="small">{task.lastRun ? new Date(task.lastRun).toLocaleString() : '—'}</dd></div>
                      <div><dt>{t('Sonraki çalışma')}</dt><dd className="small">{task.nextRun ? new Date(task.nextRun).toLocaleString() : '—'}</dd></div>
                    </dl>
                    <button className="btn" onClick={() => void run(tf('{name} çalıştırılıyor', { name: t(task.name) }), async () => {
                      const result = await api.scheduleRun(task);
                      notify(result.ran ? 'ok' : 'error', t(result.message));
                      setSchedules(await api.scheduleList());
                    })}><UiIcon label="Şimdi çalıştır" />{t('Şimdi çalıştır')}</button>
                  </div>
                ))}
                {!schedules.length && <p className="empty">{t('Zamanlama listesi yüklenemedi.')}</p>}
              </div>
            </section>
          )}

          {tab === 'search' && (
            <section className="page">
              <div className="toolbar">
                <div>
                  <h2><UiIcon label="Uygulama ara ve indir" />{t('Uygulama ara ve indir')}</h2>
                  <p className="muted">{t('winget kataloğunda arama yapın; indirin veya doğrudan kurun.')}</p>
                </div>
              </div>
              <form className="search-bar" onSubmit={(event) => {
                event.preventDefault();
                if (!searchQuery.trim()) return;
                void run(t('Katalogda aranıyor'), async () => { setSearchResults(await api.wingetSearch(searchQuery.trim())); });
              }}>
                <input className="search big" placeholder={t('Örn. firefox, vscode, 7zip…')} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
                <button className="btn btn-primary" type="submit"><UiIcon label="Ara" />{t('Ara')}</button>
              </form>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>{t('Uygulama')}</th><th>{t('Kimlik')}</th><th>{t('Sürüm')}</th><th>{t('Kaynak')}</th><th className="col-actions">{t('İşlem')}</th></tr></thead>
                  <tbody>
                    {searchResults.map((pkg) => (
                      <tr key={pkgKey(pkg) + pkg.source}>
                        <td><div className="cell-app"><Avatar name={pkg.name} /><b>{pkg.name}</b></div></td>
                        <td className="mono">{pkg.ident}</td>
                        <td>{pkg.version || '—'}</td>
                        <td>{pkg.source || 'winget'}</td>
                        <td className="col-actions">
                          <div className="row-actions">
                            <button className="link-btn" onClick={() => void run(t('İndiriliyor'), async () => {
                              const result = await api.wingetDownload(pkg.ident);
                              notify(result.ok ? 'ok' : 'info', result.message);
                            })}><UiIcon label="İndir" />{t('İndir')}</button>
                            <button className="link-btn primary" onClick={() => void installSoftware([{ name: pkg.name, ident: pkg.ident, category: 'Arama', description: pkg.version }])}><UiIcon label="Kur" />{t('Kur')}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!searchResults.length && <tr><td colSpan={5} className="empty">{t('Arama sonucu yok.')}</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'contextmenu' && (
            <section className="page narrow">
              <div className="card settings-card">
                <h2><UiIcon label="Sağ tık menüsü" />{t('Sağ tık menüsü')}</h2>
                <p className="muted small">{t('Windows 10 ve Windows 11 sağ tık menüleri arasında geçiş yapın. Değişiklik oturum açan kullanıcıya özgüdür.')}</p>
                <div className="setting-row">
                  <div>
                    <strong>{t('Mevcut stil')}</strong>
                    <small>
                      {contextMenu?.style === 'windows10'
                        ? t('Klasik menü (Windows 10)')
                        : contextMenu?.style === 'windows11'
                          ? t('Modern menü (Windows 11)')
                          : t('Algılanamadı')}
                    </small>
                  </div>
                  <span className={`badge ${contextMenu?.style === 'windows10' ? 'badge-green' : contextMenu?.style === 'windows11' ? 'badge-danger' : ''}`}>
                    {contextMenu?.style === 'windows10' ? 'Windows 10' : contextMenu?.style === 'windows11' ? 'Windows 11' : '—'}
                  </span>
                </div>
                <div className="row-actions">
                  <button
                    className="btn"
                    disabled={contextMenu?.style === 'windows10'}
                    onClick={() => applyContextMenuStyle('windows10')}
                  ><UiIcon label="Windows 10 sağ tık menüsüne geç" />
                    {t('Windows 10 sağ tık menüsüne geç')}
                  </button>
                  <button
                    className="btn"
                    disabled={contextMenu?.style === 'windows11'}
                    onClick={() => applyContextMenuStyle('windows11')}
                  ><UiIcon label="Windows 11 menüsüne geç" />
                    {t('Windows 11 menüsüne geç')}
                  </button>
                </div>
              </div>

              <div className="card settings-card">
                <h2><UiIcon label="Sağ tık menüsü eklentileri" />{t('Sağ tık menüsü eklentileri')}</h2>
                <p className="muted small">
                  {t('WinRAR, 7-Zip ve benzeri programların Gezgin sağ tık menüsüne eklediği girdileri buradan kapatabilirsiniz. Her değişiklikten önce .reg yedeği alınır.')}
                </p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{t('Eklenti')}</th>
                        <th>{t('Konum')}</th>
                        <th>{t('Tür')}</th>
                        <th>{t('Durum')}</th>
                        <th>{t('İşlem')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shellExtensions.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <b>{item.label}</b>
                            <div className="muted small mono">{item.name}</div>
                          </td>
                          <td>{item.location}</td>
                          <td>{item.kind === 'shellex' ? t('Menü eklentisi') : t('Komut')}</td>
                          <td>
                            <span className={`badge ${item.enabled ? 'badge-green' : ''}`}>
                              {item.strategy === 'unsupported'
                                ? t('Desteklenmiyor')
                                : item.enabled ? t('Etkin') : t('Kapalı')}
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn btn-small"
                              disabled={shellExtensionBusy !== null || item.strategy === 'unsupported'}
                              onClick={() => toggleShellExtension(item)}
                            ><UiIcon label="Kapat" />
                              {shellExtensionBusy === item.id ? '…' : item.enabled ? t('Kapat') : t('Aç')}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!shellExtensions.length && (
                        <tr><td colSpan={5} className="empty">{t('Sağ tık menüsü eklentisi bulunamadı.')}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="muted small" style={{ marginTop: 10 }}>
                  {t('Sistem bileşenlerini kapatmak Gezgin özelliklerini gizleyebilir. Yedek dosyalarını içe aktararak geri alabilirsiniz.')}
                </p>
              </div>
            </section>
          )}

          {tab === 'debugging' && (
            <section className="page">
              <div className="card">
                <h2><UiIcon label="Hata Ayıklama" />{t('Hata Ayıklama')}</h2>
                <p className="muted small">
                  {t('"Kuruluşunuz tarafından yönetiliyor" bildirimini düzelten .reg dosyaları. Dosyayı kaydedip elle içe aktarabilir veya uygulayabilirsiniz. Uygulama öncesi ilgili anahtarların .reg yedeği alınır; yedek başarısız olursa değişiklik yapılmaz.')}
                </p>
              </div>
              <div className="reg-grid">
                {managedFixes.map((fix) => (
                  <div className="card settings-card" key={fix.id}>
                    <div className="card-top">
                      <h2 style={{ margin: 0 }}><UiIcon icon="🐛" />{t(fix.title)}</h2>
                      <span className="badge">{fix.bundled ? t('Paket dosyası') : t('Üretilen içerik')}</span>
                    </div>
                    <p className="muted small">{t(fix.description)}</p>
                    <p className="muted small reg-warning">{t(fix.warning)}</p>
                    <div className="setting-row">
                      <div>
                        <strong>{t('Dosya')}</strong>
                        <small className="mono">{fix.fileName}</small>
                      </div>
                      <span className="muted small">{fix.keys.length} {t('ilke anahtarı')}</span>
                    </div>
                    <details>
                      <summary>{t('.reg içeriğini göster')}</summary>
                      <pre className="reg-preview"><code>{fix.content}</code></pre>
                    </details>
                    <div className="row-actions">
                      <button className="btn" onClick={() => saveRegFix(fix.id)}><UiIcon label="Dosyayı kaydet" />{t('Dosyayı kaydet')}</button>
                      <button className="btn btn-primary" onClick={() => applyRegFix(fix.id)}><UiIcon label="Uygula" />{t('Uygula')}</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === 'settings' && settings && (
            <section className="page narrow">
              <div className="card settings-card">
                <h2><UiIcon label="Genel ayarlar" />{t('Genel ayarlar')}</h2>
                <div className="setting-row">
                  <div><strong>{t('Dil')}</strong><small>{t('Arayüz dili. Değişiklik anında uygulanır.')}</small></div>
                  <select
                    value={lang}
                    onChange={(event) => patchSettings({ language: event.target.value })}
                  >
                    {[...new Set(['tr', 'en', ...locales])].map((code) => (
                      <option key={code} value={code}>{localeName(code, lang)}{code === 'tr' ? ' · Türkçe' : code === 'en' ? ' · English' : ''}</option>
                    ))}
                  </select>
                </div>
                <p className="muted small">{t('Diğer diller Electron dil paketlerinden gelir. Çeviri dosyası eklemek için klasörü açın; eksik çeviriler İngilizce gösterilir.')}</p>
                <button className="btn" onClick={() => void api.localeFolder().then((folder) => api.openPath(folder)).catch((error: Error) => notify('error', error.message))}><UiIcon label="Çeviri klasörünü aç" />{t('Çeviri klasörünü aç')}</button>
                <div className="setting-row">
                  <div><strong>{t('Tema')}</strong><small>{t('Uygulama teması. Değişiklik anında uygulanır.')}</small></div>
                  <select
                    value={settings.theme}
                    onChange={(event) => applyTheme(event.target.value as Theme)}
                  >
                    <option value="default">{t('Koyu Mod')}</option>
                    <option value="windows11">{t('Açık Mod')}</option>
                    <option value="auto">{t('Sistem')}</option>
                  </select>
                </div>
                <Toggle
                  label={t('Açılışta güncellemeleri tara')}
                  hint={t('Uygulama açıldığında winget güncellemelerini arar.')}
                  checked={settings.autoUpdateScan}
                  onChange={(value) => { setSettings((prev) => prev ? { ...prev, autoUpdateScan: value } : prev); void api.setSettings({ autoUpdateScan: value }); }}
                />
                <Toggle
                  label={t('Kaldırma sonrası kalıntı sorusu')}
                  hint={t('Uygulama kaldırıldığında dosya ve kayıt defteri kalıntı taraması yapılıp yapılmayacağını sorar.')}
                  checked={settings.autoLeftoverScan}
                  onChange={(value) => { setSettings((prev) => prev ? { ...prev, autoLeftoverScan: value } : prev); void api.setSettings({ autoLeftoverScan: value }); }}
                />
                <Toggle
                  label={t('Sessiz kurulum/güncelleme')}
                  hint={t('Mümkün olduğunda kurulum sihirbazlarını göstermeden tamamlar.')}
                  checked={settings.silentInstall}
                  onChange={(value) => { setSettings((prev) => prev ? { ...prev, silentInstall: value } : prev); void api.setSettings({ silentInstall: value }); }}
                />
                <Toggle
                  label={t('Windows ile başlat')}
                  hint={t('Oturum açıldığında uygulama otomatik çalışır.')}
                  checked={settings.startWithWindows}
                  onChange={(value) => { setSettings((prev) => prev ? { ...prev, startWithWindows: value } : prev); void api.setSettings({ startWithWindows: value }); }}
                />
                <Toggle
                  label={t('Sistem tepsisinde başlat')}
                  hint={t('Windows ile başlatıldığında pencere gösterilmez, simge tepside yer alır.')}
                  checked={settings.startMinimizedToTray}
                  onChange={(value) => { setSettings((prev) => prev ? { ...prev, startMinimizedToTray: value } : prev); void api.setSettings({ startMinimizedToTray: value }); }}
                />
                <div className="setting-row">
                  <div>
                    <strong>{t('Kapatma davranışı')}</strong>
                    <small>{t('Kapat düğmesi veya Alt+F4 ile ne yapılacağını belirler.')}</small>
                  </div>
                  <select
                    value={settings.closeBehavior}
                    onChange={(event) => patchSettings({ closeBehavior: event.target.value as Settings['closeBehavior'] })}
                  >
                    <option value="ask">{t('Her zaman sor')}</option>
                    <option value="tray">{t('Sistem tepsisine küçült')}</option>
                    <option value="quit">{t('Uygulamayı kapat')}</option>
                  </select>
                </div>
                <div className="setting-row">
                  <div><strong>{t('Sürücü')}</strong><small>{t('Anasayfadaki boş alan kartında gösterilecek sürücü.')}</small></div>
                  <select value={settings.drive} onChange={(event) => { const value = event.target.value; setSettings((prev) => prev ? { ...prev, drive: value } : prev); void api.setSettings({ drive: value }); }}>
                    {drives.map((drive) => <option key={drive} value={drive}>{drive}</option>)}
                  </select>
                </div>
              </div>

              <div className="card settings-card">
                <div className="card-top">
                  <h2 style={{ margin: 0 }}><UiIcon label="Uygulama güncelleyici" />{t('Uygulama güncelleyici')}</h2>
                  <div className="row-actions">
                    <button className="btn" disabled={updateBusy} onClick={() => void checkAppUpdate(true)}><UiIcon label="Güncelleme kontrol et" />{t('Güncelleme kontrol et')}</button>
                    {downloadedUpdate?.path && (
                      <button className="btn btn-primary" onClick={() => void installAppUpdate(downloadedUpdate.path!)}><UiIcon label="İndirilen kurulumu başlat" />{t('İndirilen kurulumu başlat')}</button>
                    )}
                  </div>
                </div>
                <p className="muted small">{t('Uygulamanın kendi sürümünü kontrol eder. Yazılımları güncellemekten ayrıdır; winget güncellemeleri için Güncellemeler sekmesini kullanın.')}</p>
                <dl className="summary">
                  <div><dt>{t('Mevcut sürüm')}</dt><dd className="mono">{appUpdate?.currentVersion || '—'}</dd></div>
                  <div><dt>{t('Son sürüm')}</dt><dd className="mono">{appUpdate?.latestVersion || '—'}</dd></div>
                  <div>
                    <dt>{t('Durum')}</dt>
                    <dd>{appUpdate ? (appUpdate.available ? t('Yeni sürüm var') : t('Güncel')) : '—'}</dd>
                  </div>
                </dl>
                {appUpdate?.notes && <p className="muted small">{appUpdate.notes}</p>}
                {appUpdate && <p className="muted small">{appUpdate.message}</p>}
                {updateBusy && (
                  <div className="update-progress">
                    <div className="update-progress-track">
                      <span style={{ width: `${updateProgress?.percent ?? 0}%` }} />
                    </div>
                    <small className="muted">
                      {updateProgress?.percent
                        ? tf('%{percent} · {downloaded} / {total}', {
                          percent: updateProgress.percent,
                          downloaded: sizeText(updateProgress.downloaded),
                          total: updateProgress.total ? sizeText(updateProgress.total) : '—',
                        })
                        : t('Kontrol ediliyor...')}
                    </small>
                  </div>
                )}
                <div className="setting-row">
                  <div>
                    <strong>{t('Güncelleme kaynağı')}</strong>
                    <small>{t('Boş bırakılırsa varsayılan güncelleme kaynağı (GitHub Pages) kullanılır. http(s) adresi veya yerel klasör de yazabilirsiniz.')}</small>
                  </div>
                  <input
                    className="search"
                    value={updateSourceInput}
                    placeholder={t('Örn. https://sunucu/guncelleme veya C:\\Yayin')}
                    onChange={(event) => setUpdateSourceInput(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') patchSettings({ updateSource: updateSourceInput.trim() }); }}
                  />
                </div>
                <div className="inline-form">
                  <button className="btn" onClick={() => patchSettings({ updateSource: updateSourceInput.trim() })}><UiIcon label="Kaynağı kaydet" />{t('Kaynağı kaydet')}</button>
                  <button
                    className="btn"
                    onClick={() => { setUpdateSourceInput(DEFAULT_UPDATE_SOURCE); patchSettings({ updateSource: DEFAULT_UPDATE_SOURCE }); }}
                  ><UiIcon label="Varsayılan kaynağa dön" />
                    {t('Varsayılan kaynağa dön')}
                  </button>
                  <button
                    className="btn"
                    onClick={() => void api.pickFolders().then((items) => { if (items[0]) { setUpdateSourceInput(items[0]); patchSettings({ updateSource: items[0] }); } }).catch((error: Error) => notify('error', error.message))}
                  ><UiIcon label="Klasör seç" />
                    {t('Klasör seç')}
                  </button>
                  <button
                    className="btn"
                    onClick={() => void api.appUpdateFolder().then((folder) => api.openPath(folder)).catch((error: Error) => notify('error', error.message))}
                  ><UiIcon label="İndirilenler klasörü" />
                    {t('İndirilenler klasörü')}
                  </button>
                </div>
                <Toggle
                  label={t('Açılışta uygulama güncellemesini kontrol et')}
                  hint={t('Uygulama açıldığında yeni sürüm yayınlanmışsa onay sorar.')}
                  checked={settings.updateCheckOnStartup}
                  onChange={(value) => patchSettings({ updateCheckOnStartup: value })}
                />
              </div>

              <div className="card settings-card">
                <h2><UiIcon label="Destek ve bağlantılar" />{t('Destek ve bağlantılar')}</h2>
                <p className="muted small">{t('Projeyi kullanmaya devam etmek için destek olabilir veya kaynak kodunu inceleyebilirsiniz.')}</p>
                <div className="settings-links">
                  <button className="btn btn-primary" onClick={() => openLink(APP_LINKS.coffee)}><UiIcon label="Destek ol" />{t('Buy me a coffee · Destek ol')}</button>
                  <button className="btn" onClick={() => openLink(APP_LINKS.github)}><UiIcon label="GitHub" />{t('GitHub deposu')}</button>
                  <button className="btn" onClick={() => openLink(APP_LINKS.website)}><UiIcon label="Web sitesi" />{t('Web sitesi')}</button>
                </div>
                <div className="license-box">
                  <h3><UiIcon label="Lisans ve telif hakkı" />{t('Lisans ve telif hakkı')}</h3>
                  <p>{t('Bu yazılım MIT lisansı altında dağıtılır. Tüm telif hakları Pars Sistem Yöneticisi geliştiricilerine aittir. Kaynak kodunu GitHub deposunda inceleyebilirsiniz.')}</p>
                  <button className="link-btn" onClick={() => openLink(APP_LINKS.license)}><UiIcon label="Lisans metnini aç" />{t('Lisans metnini aç')}</button>
                </div>
              </div>

              <div className="card settings-card">
                <h2><UiIcon label="Hariç Tutulanlar" />{t('Hariç Tutulanlar')}</h2>
                <p className="muted small">{t('Bu klasörlerdeki dosyalar ve bu uzantılı dosyalar tarama, temizleme ve silme işlemlerinden tamamen çıkarılır.')}</p>

                <h3><UiIcon label="Klasörler" />{t('Klasörler')}</h3>
                <div className="exclude-list">
                  {settings.excludedFolders.map((folder) => (
                    <div className="exclude-item" key={folder}>
                      <code title={folder}>{folder}</code>
                      <button className="link-btn danger" onClick={() => patchSettings({ excludedFolders: settings.excludedFolders.filter((item) => item !== folder) })}><UiIcon label="Kaldır" />{t('Kaldır')}</button>
                    </div>
                  ))}
                  {!settings.excludedFolders.length && <p className="muted small">{t('Hariç tutulan klasör yok.')}</p>}
                </div>
                <div className="inline-form">
                  <input
                    className="search"
                    placeholder={t('Yol yazıp Ekle\'ye basabilirsiniz veya klasör seçin.')}
                    value={folderInput}
                    onChange={(event) => setFolderInput(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') addFolders([folderInput]); }}
                  />
                  <button className="btn" onClick={() => addFolders([folderInput])}><UiIcon label="Ekle" />{t('Ekle')}</button>
                  <button
                    className="btn"
                    onClick={() => void api.pickFolders().then(addFolders).catch((error: Error) => notify('error', error.message))}
                  ><UiIcon label="Klasör seç" />
                    {t('Klasör seç')}
                  </button>
                </div>

                <h3><UiIcon label="Uzantılar" />{t('Uzantılar')}</h3>
                <div className="exclude-list chips">
                  {settings.excludedExtensions.map((extension) => (
                    <button
                      key={extension}
                      className="chip chip-active"
                      title={t('Kaldır')}
                      onClick={() => patchSettings({ excludedExtensions: settings.excludedExtensions.filter((item) => item !== extension) })}
                    >
                      <UiIcon icon="🧩" />{extension} ×
                    </button>
                  ))}
                  {!settings.excludedExtensions.length && <p className="muted small">{t('Hariç tutulan uzantı yok.')}</p>}
                </div>
                <div className="inline-form">
                  <input
                    className="search"
                    placeholder={t('Örn. .iso, .zip, .log — virgül veya boşlukla ayırın.')}
                    value={extensionInput}
                    onChange={(event) => setExtensionInput(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') addExtensions(extensionInput); }}
                  />
                  <button className="btn" onClick={() => addExtensions(extensionInput)}><UiIcon label="Uzantı ekle" />{t('Uzantı ekle')}</button>
                </div>
              </div>

              <div className="card settings-card">
                <div className="card-top">
                  <h2 style={{ margin: 0 }}><UiIcon label="Gerekli bileşenler" />{t('Gerekli bileşenler')}</h2>
                  <div className="row-actions">
                    <button className="btn" onClick={() => void run(t('Sistem taraması tamamlandı.'), async () => { await refreshPrerequisites(); })}><UiIcon label="Tara" />{t('Tara')}</button>
                    <button
                      className="btn"
                      disabled={!settings.enterpriseSilentPrereqs || Boolean(prereqBusy)}
                      onClick={() => void run(t('Kurumsal kurulum sürüyor'), () => runEnterprisePrerequisites())}
                    ><UiIcon label="Kurumsal kurulumu çalıştır" />
                      {t('Kurumsal kurulumu çalıştır')}
                    </button>
                    <button
                      className="btn btn-primary"
                      disabled={!prerequisites.some((item) => !item.installed && item.installable) || Boolean(prereqBusy)}
                      onClick={() => requestPrerequisiteInstall(prerequisites)}
                    ><UiIcon label="Eksikleri kur" />
                      {t('Eksikleri kur')}
                    </button>
                  </div>
                </div>
                <p className="muted small">{t('Yerel bileşenleri ve paket yöneticilerini tarar. Kurulumlar açık onayla başlar; kurumsal mod açıksa eksik paket yöneticileri açılışta sessizce kurulur.')}</p>
                <Toggle
                  label={t('Kurumsal sessiz kurulum')}
                  hint={t('Açık olduğunda eksik paket yöneticileri açılışta onay sormadan arka planda kurulur. Varsayılan kapalıdır.')}
                  checked={settings.enterpriseSilentPrereqs}
                  onChange={(value) => patchSettings({ enterpriseSilentPrereqs: value })}
                />
                <div className="prereq-list">
                  {prerequisites.map((item) => (
                    <div className="prereq-item" key={item.id}>
                      <div>
                        <strong>{item.name}</strong>
                        <small>{item.description}</small>
                        <small className="mono">{item.version || '—'}</small>
                      </div>
                      <div className="prereq-meta">
                        <span className={`badge ${item.installed ? 'badge-green' : 'badge-danger'}`}>{item.installed ? t('Kurulu') : t('Eksik')}</span>
                        <span className="muted small">{item.required ? t('Zorunlu') : t('İsteğe bağlı')}</span>
                        <span className="muted small">{item.bundled ? t('Gömülü onarım betiği') : t('İnternetten indir')}</span>
                        {!item.installed && item.installable && (
                          <button
                            className="link-btn primary"
                            disabled={Boolean(prereqBusy)}
                            onClick={() => requestPrerequisiteInstall([item])}
                          ><UiIcon label="Kur" />
                            {prereqBusy === item.id ? '…' : t('Kur')}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {!prerequisites.length && <p className="muted small">…</p>}
                </div>
              </div>

              <div className="card settings-card">
                <h2><UiIcon label="Kayıt defteri .reg yedeği" />{t('Kayıt defteri .reg yedeği')}</h2>
                <p className="muted small">{t('Silinen kayıt girdileri için .reg yedekleri bu klasöre yazılır.')}</p>
                <div className="setting-row path-setting">
                  <code className="path-value" title={backupPath}>{backupPath || '—'}</code>
                  <button className="btn" disabled={!backupPath} onClick={() => void api.openPath(backupPath)}><UiIcon label="Yedek klasörünü aç" />{t('Yedek klasörünü aç')}</button>
                </div>
              </div>
              <div className="card settings-card">
                <h2><UiIcon label="Güvenlik duvarı kural yedeği" />{t('Güvenlik duvarı kural yedeği')}</h2>
                <p className="muted small">{t('Silinen güvenlik duvarı kurallarının JSON yedekleri bu klasöre yazılır.')}</p>
                <div className="setting-row path-setting">
                  <code className="path-value" title={firewallBackupPath}>{firewallBackupPath || '—'}</code>
                  <button className="btn" disabled={!firewallBackupPath} onClick={() => void api.openPath(firewallBackupPath)}><UiIcon label="Yedek klasörünü aç" />{t('Yedek klasörünü aç')}</button>
                </div>
              </div>
              <div className="card settings-card">
                <h2><UiIcon label="winget durumu" />{t('winget durumu')}</h2>
                <dl className="summary">
                  <div><dt>{t('Durum')}</dt><dd>{settings.wingetAvailable ? t('Kullanılabilir') : t('Bulunamadı')}</dd></div>
                  <div><dt>{t('Sürüm')}</dt><dd className="mono">{settings.wingetVersion || '—'}</dd></div>
                </dl>
                <p className="muted small">{t('Uygulama yönetici izinleriyle çalışır; winget bilgisi yalnızca bu bölümde gösterilir.')}</p>
                <button className="btn" onClick={() => void run(t('Kaynaklar güncelleniyor'), async () => {
                  const code = await api.wingetSourceUpdate();
                  notify(code === 0 ? 'ok' : 'error', code === 0 ? t('winget kaynakları güncellendi.') : tf('Kaynak güncelleme hatası (kod {code}).', { code }));
                  await refreshSettings();
                })}><UiIcon label="Kaynakları güncelle" />{t('Kaynakları güncelle')}</button>
              </div>
              <div className="card settings-card">
                <div className="card-top">
                  <h2 style={{ margin: 0 }}><UiIcon label="Son işlemler" />{t('Son işlemler')}</h2>
                  <button className="link-btn" onClick={() => setLogs([])}><UiIcon label="Temizle" />{t('Temizle')}</button>
                </div>
                <div className="mini-list">
                  {logs.slice(-12).reverse().map((entry, index) => (
                    <div key={`${entry.time}-${index}`} className="mini-row">
                      <span className="time">{entry.time}</span>
                      <span className="tag">{entry.scope}</span>
                      <span className="line" title={entry.line}>{entry.line}</span>
                    </div>
                  ))}
                  {!logs.length && <p className="muted">{t('Henüz işlem yok.')}</p>}
                </div>
              </div>
            </section>
          )}

          {tab === 'packages' && (
            <section className="page">
              <div className="toolbar">
                <div>
                  <h2><UiIcon label="Yazılım listesi yedeği" />{t('Yazılım listesi yedeği')}</h2>
                  <p className="muted">{t('winget ile kurulu paketlerin listesini yedekler; yeni bir Windows kurulumundan sonra seçtiğiniz paketleri geri yükler.')}</p>
                </div>
                <div className="toolbar-actions">
                  <button className="btn btn-primary" onClick={() => void run(t('Paket listesi yedekleniyor'), async () => {
                    const result = await api.packageExport();
                    notify(result.ok ? 'ok' : 'error', result.message);
                    setPackageBackups(await api.packageBackupList());
                  })}><UiIcon label="Yeni yedek oluştur" />{t('Yeni yedek oluştur')}</button>
                  <button className="btn" disabled={!packageBackups?.folder} onClick={() => packageBackups && void api.openPath(packageBackups.folder)}><UiIcon label="Yedek klasörünü aç" />{t('Yedek klasörünü aç')}</button>
                </div>
              </div>
              <div className="notice">
                <div>
                  <b>{t('Yedek nasıl çalışır?')}</b>
                  <p className="muted">{t('Dışa aktarma winget export JSON dosyası üretir. Geri yüklemede yalnızca işaretlediğiniz kimlikler geçici bir dosyaya yazılır ve winget import ile kurulur; program verileri yedeklenmez.')}</p>
                </div>
              </div>
              <div className="card">
                <div className="card-top"><h3 style={{ margin: 0 }}><UiIcon label="Kayıtlı yedekler" />{t('Kayıtlı yedekler')}</h3><span className="muted small">{packageBackups?.files.length ?? 0} {t('dosya')}</span></div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>{t('Dosya')}</th><th>{t('Tarih')}</th><th>{t('Paket')}</th><th>{t('Boyut')}</th><th>{t('İşlem')}</th></tr></thead>
                    <tbody>
                      {(packageBackups?.files || []).map((file) => (
                        <tr key={file.path} className={packageFile === file.path ? 'selected-row' : ''}>
                          <td className="mono small">{file.name}</td>
                          <td className="small">{new Date(file.createdAt).toLocaleString('tr-TR')}</td>
                          <td>{file.count}</td>
                          <td className="mono small">{sizeText(file.size)}</td>
                          <td><button className="btn btn-small" onClick={() => void run(t('Yedek okunuyor'), async () => {
                            const entries = await api.packageReadBackup(file.path);
                            setPackageFile(file.path);
                            setPackageEntries(entries);
                            setSelectedPackages(new Set(entries.map((entry) => entry.id)));
                          })}><UiIcon label="İncele" />{t('İncele')}</button></td>
                        </tr>
                      ))}
                      {!packageBackups?.files.length && <tr><td colSpan={5} className="empty">{t('Henüz yedek yok. Yeni yedek oluşturun.')}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
              {packageEntries.length > 0 && (
                <div className="card">
                  <div className="card-top">
                    <h3 style={{ margin: 0 }}><UiIcon label="Geri yüklenecek paketler" />{t('Geri yüklenecek paketler')}</h3>
                    <div className="row-actions">
                      <button className="btn btn-small" onClick={() => setSelectedPackages(new Set(packageEntries.map((entry) => entry.id)))}><UiIcon label="Tümünü seç" />{t('Tümünü seç')}</button>
                      <button className="btn btn-small" onClick={() => setSelectedPackages(new Set())}><UiIcon label="Hiçbirini seçme" />{t('Hiçbirini seçme')}</button>
                      <button className="btn btn-primary btn-small" disabled={!selectedPackages.size} onClick={() => {
                        const count = selectedPackages.size;
                        const file = packageFile;
                        setConfirm({
                          title: t('Paketleri geri yükle'),
                          message: tf('{count} paket winget import ile kurulacak. İşlem uzun sürebilir ve internet gerektirir.', { count }),
                          options: [{ label: t('Vazgeç'), value: 'cancel' }, { label: t('Geri yükle'), value: 'import', kind: 'primary' }],
                          onChoose: (value) => {
                            if (value !== 'import') return;
                            void run(t('Paketler geri yükleniyor'), async () => {
                              const result = await api.packageImport(file, [...selectedPackages]);
                              notify(result.ok ? 'ok' : 'error', result.message);
                            });
                          },
                        });
                      }}><UiIcon label="Seçilenleri geri yükle" />{t('Seçilenleri geri yükle')}</button>
                    </div>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th className="col-check"><input type="checkbox" checked={selectedPackages.size === packageEntries.length} onChange={() => toggleAll(packageEntries, (entry) => entry.id, selectedPackages, setSelectedPackages)} /></th><th>{t('Paket')}</th><th>{t('Kimlik')}</th><th>{t('Sürüm')}</th><th>{t('Kaynak')}</th></tr></thead>
                      <tbody>
                        {packageEntries.map((entry) => (
                          <tr key={entry.id}>
                            <td><input type="checkbox" checked={selectedPackages.has(entry.id)} onChange={() => toggle(setSelectedPackages, entry.id)} /></td>
                            <td><b>{entry.name}</b></td>
                            <td className="mono small">{entry.id}</td>
                            <td className="mono small">{entry.version || '—'}</td>
                            <td className="small">{entry.source}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}

          {tab === 'duplicates' && (
            <section className="page">
              <div className="toolbar">
                <div>
                  <h2><UiIcon label="Dosya tarayıcı" />{t('Dosya tarayıcı')}</h2>
                  <p className="muted">{t('Yinelenen, büyük ve boş dosyaları bulur. Korumalı sistem yolları, sembolik bağlantılar ve hariç tutulanlar atlanır.')}</p>
                </div>
                <div className="toolbar-actions">
                  <button className="btn" onClick={() => void api.pickScanFolders().then((folders) => { if (folders.length) setFileRoots(folders); })}><UiIcon label="Taranacak klasörler" />{t('Taranacak klasörler')}</button>
                  <button className="btn" onClick={() => void api.pickScanFolders().then((folders) => { if (folders.length) setReferenceRoots(folders); })}><UiIcon label="Referans klasörler" />{t('Referans klasörler')}</button>
                  <button className="btn btn-primary" disabled={!fileRoots.length} onClick={() => void run(t('Dosyalar taranıyor'), async () => {
                    const result = await api.fileScan({
                      roots: fileRoots,
                      referenceRoots,
                      minSize: Math.max(1, Number(fileMinSize) || 128) * 1024 * 1024,
                      maxResults: 200_000,
                    });
                    setFileResult(result);
                    setSelectedFiles(new Set());
                  })}><UiIcon label="Tara" />{t('Tara')}</button>
                </div>
              </div>
              <div className="notice">
                <div>
                  <b>{t('Referans klasörler')}</b>
                  <p className="muted">{t('Buradaki dosyalar taramada görünür ama asla silinmez. Örneğin yedeklerinizin olduğu klasörü referans olarak ekleyin.')}</p>
                </div>
                <div className="chips">
                  {fileRoots.map((root) => <span className="chip" key={root} title={root}>{root}</span>)}
                </div>
                <div className="chips">
                  {referenceRoots.map((root) => <span className="chip active" key={root} title={root}>{root}</span>)}
                </div>
                <label className="inline-field">
                  {t('En küçük boyut (MB)')}
                  <input type="number" min="1" max="1024" value={fileMinSize} onChange={(event) => setFileMinSize(event.target.value)} />
                </label>
              </div>
              {fileResult && (
                <>
                  <div className="stats-grid">
                    <div className="stat"><span>{t('Taranan dosya')}</span><b>{fileResult.scanned.toLocaleString('tr-TR')}</b></div>
                    <div className="stat"><span>{t('Yinelenen grup')}</span><b>{fileResult.duplicates.length}</b></div>
                    <div className="stat"><span>{t('Geri kazanılabilir')}</span><b>{sizeText(fileResult.wasted)}</b></div>
                    <div className="stat"><span>{t('Süre')}</span><b>{(fileResult.durationMs / 1000).toFixed(1)} sn</b></div>
                  </div>
                  <div className="toolbar">
                    <div><b>{tf('{count} dosya seçili', { count: selectedFiles.size })}</b></div>
                    <div className="toolbar-actions">
                      <button className="btn btn-small" onClick={() => {
                        const keep = new Set<string>();
                        fileResult.duplicates.forEach((group) => group.files.slice(1).forEach((file) => keep.add(file)));
                        setSelectedFiles(keep);
                      }}><UiIcon label="Yinelenenlerde ilk dosyayı koru" />{t('Yinelenenlerde ilk dosyayı koru')}</button>
                      <button className="btn btn-danger-ghost btn-small" disabled={!selectedFiles.size} onClick={() => askFileDelete('permanent')}><UiIcon label="Kalıcı sil" />{t('Kalıcı sil')}</button>
                      <button className="btn btn-primary btn-small" disabled={!selectedFiles.size} onClick={() => askFileDelete('recycle')}><UiIcon label="Geri Dönüşüm Kutusu'na taşı" />{t('Geri Dönüşüm Kutusu\'na taşı')}</button>
                    </div>
                  </div>
                  <div className="card">
                    <h3><UiIcon label="Yinelenen dosyalar" />{t('Yinelenen dosyalar')}</h3>
                    <div className="leftover-list">
                      {fileResult.duplicates.map((group: DuplicateGroup) => (
                        <div key={group.hash} className="duplicate-group">
                          <div className="muted small mono">{sizeText(group.size)} · {group.files.length} {t('kopya')} · SHA-256 {group.hash.slice(0, 12)}…</div>
                          {group.files.map((file) => (
                            <label key={file} className="leftover-row">
                              <input type="checkbox" checked={selectedFiles.has(file)} onChange={() => toggle(setSelectedFiles, file)} />
                              <span className="path" title={file}>{file}</span>
                            </label>
                          ))}
                        </div>
                      ))}
                      {!fileResult.duplicates.length && <p className="empty">{t('Yinelenen dosya bulunamadı.')}</p>}
                    </div>
                  </div>
                  <div className="card">
                    <h3><UiIcon label="En büyük dosyalar" />{t('En büyük dosyalar')}</h3>
                    <div className="leftover-list">
                      {fileResult.large.map((file) => (
                        <label key={file.path} className="leftover-row">
                          <input type="checkbox" checked={selectedFiles.has(file.path)} onChange={() => toggle(setSelectedFiles, file.path)} />
                          <span className="path" title={file.path}>{file.path}</span>
                          <span className="mono small">{sizeText(file.size)}</span>
                        </label>
                      ))}
                      {!fileResult.large.length && <p className="empty">{t('20 MB üzeri dosya bulunamadı.')}</p>}
                    </div>
                  </div>
                  <div className="card">
                    <h3><UiIcon label="Boş dosya ve klasörler" />{t('Boş dosya ve klasörler')}</h3>
                    <div className="leftover-list">
                      {fileResult.empty.map((item) => (
                        <label key={item.path} className="leftover-row">
                          <input type="checkbox" checked={selectedFiles.has(item.path)} onChange={() => toggle(setSelectedFiles, item.path)} />
                          <span className={`kind kind-${item.kind === 'folder' ? 'folder' : 'file'}`}>{t(item.kind === 'folder' ? 'KLASÖR' : 'DOSYA')}</span>
                          <span className="path" title={item.path}>{item.path}</span>
                        </label>
                      ))}
                      {!fileResult.empty.length && <p className="empty">{t('Boş öğe bulunamadı.')}</p>}
                    </div>
                  </div>
                  {!!fileResult.errors.length && <div className="notice"><p className="muted small">{fileResult.errors.slice(0, 10).join('\n')}</p></div>}
                </>
              )}
            </section>
          )}

          {tab === 'analysis' && (
            <section className="page">
              <div className="toolbar">
                <div>
                  <h2><UiIcon label="Disk analizi" />{t('Disk analizi')}</h2>
                  <p className="muted">{t('Klasör boyutlarını, en büyük dosyaları ve uzantı dağılımını gösterir. Salt okunur tarama yapar; hiçbir şey silmez.')}</p>
                </div>
                <div className="toolbar-actions">
                  <input className="path-input" value={analysisRoot} onChange={(event) => setAnalysisRoot(event.target.value)} placeholder="C:\\" />
                  <button className="btn" onClick={() => void api.pickScanFolders().then((folders) => { if (folders[0]) setAnalysisRoot(folders[0]); })}><UiIcon label="Klasör seç" />{t('Klasör seç')}</button>
                  <button className="btn btn-primary" disabled={!analysisRoot.trim()} onClick={() => void run(t('Disk taranıyor'), async () => setAnalysisResult(await api.diskAnalysis(analysisRoot.trim())))}><UiIcon label="Tara" />{t('Tara')}</button>
                </div>
              </div>
              {analysisResult && (
                <>
                  <div className="stats-grid">
                    <div className="stat"><span>{t('Toplam boyut')}</span><b>{sizeText(analysisResult.total)}</b></div>
                    <div className="stat"><span>{t('Dosya')}</span><b>{analysisResult.files.toLocaleString('tr-TR')}</b></div>
                    <div className="stat"><span>{t('Klasör')}</span><b>{analysisResult.folders.toLocaleString('tr-TR')}</b></div>
                    <div className="stat"><span>{t('Süre')}</span><b>{(analysisResult.durationMs / 1000).toFixed(1)} sn</b></div>
                  </div>
                  <div className="card">
                    <div className="card-top"><h3 style={{ margin: 0 }}><UiIcon label="Alan haritası" />{t('Alan haritası')}</h3><span className="muted small">{analysisResult.root}</span></div>
                    <div className="treemap">
                      {treemap(analysisResult.tree).map((cell) => (
                        <button
                          key={cell.node.path}
                          className="treemap-cell"
                          style={{ left: `${cell.x}%`, top: `${cell.y}%`, width: `${cell.w}%`, height: `${cell.h}%` }}
                          title={`${cell.node.name} — ${sizeText(cell.node.size)}`}
                          onClick={() => void api.openPath(cell.node.path)}
                        >
                          <span>{cell.node.name}</span>
                          <small>{sizeText(cell.node.size)}</small>
                        </button>
                      ))}
                      {!analysisResult.tree.length && <p className="empty">{t('Gösterilecek klasör yok.')}</p>}
                    </div>
                  </div>
                  <div className="two-column">
                    <div className="card">
                      <h3><UiIcon label="Uzantılara göre" />{t('Uzantılara göre')}</h3>
                      <div className="mini-list">
                        {analysisResult.extensions.slice(0, 12).map((row) => (
                          <div key={row.extension} className="mini-row"><span className="tag">{row.extension}</span><span className="line">{row.files} {t('dosya')}</span><span className="mono small">{sizeText(row.size)}</span></div>
                        ))}
                      </div>
                    </div>
                    <div className="card">
                      <h3><UiIcon label="En büyük dosyalar" />{t('En büyük dosyalar')}</h3>
                      <div className="mini-list">
                        {analysisResult.topFiles.slice(0, 12).map((file) => (
                          <button key={file.path} className="mini-row link-row" onClick={() => void api.openPath(file.path)} title={file.path}>
                            <UiIcon icon="📄" /><span className="line">{file.path.split('\\').pop()}</span><span className="mono small">{sizeText(file.size)}</span>
                          </button>
                        ))}
                        {!analysisResult.topFiles.length && <p className="empty">{t('20 MB üzeri dosya yok.')}</p>}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {tab === 'repair' && (
            <section className="page">
              <div className="toolbar">
                <div>
                  <h2><UiIcon label="Sistem onarımı" />{t('Sistem onarımı')}</h2>
                  <p className="muted">{t('Salt okunur tanılama, Windows onarım komutları, Update/ağ sıfırlama, bakım işlemleri ve WinRE rehberi tek yerde. Yönetici izni gerektirir.')}</p>
                </div>
              </div>
              <div className="notice">
                <b><UiIcon label="Önemli" />{t('Önemli')}</b>
                <p className="muted">{t('SFC ve DISM tamamlanması 30 dakikayı bulabilir. İşlem sırasında bilgisayarı kapatmayın. Değişiklik yapan işlemlerde yedek alınamazsa hiçbir değişiklik yapılmaz.')}</p>
              </div>
              <div className="card">
                <div className="card-top">
                  <h3 style={{ margin: 0 }}><UiIcon label="Yedekler" />{t('Yedekler')}</h3>
                  <button className="btn" disabled={!repairBackupPath} onClick={() => void api.openPath(repairBackupPath)}>
                    <UiIcon label="Yedek klasörünü aç" />{t('Yedek klasörünü aç')}
                  </button>
                </div>
                <code className="path-value" title={repairBackupPath}>{repairBackupPath || '—'}</code>
              </div>
              {REPAIR_GROUPS.map((group) => (
                <div className="repair-group" key={group.title}>
                  <h3><UiIcon icon="✚️" />{t(group.title)}</h3>
                  <p className="muted">{t(group.description)}</p>
                  <div className="feature-grid">
                    {group.actions.map((action) => (
                      <div className="card" key={action.id}>
                        <div className="card-top">
                          <div className="feature-icon">{action.icon}</div>
                          {action.readOnly
                            ? <span className="badge badge-green">{t('salt okunur')}</span>
                            : action.backup
                              ? <span className="badge badge-warn">{t('yedek zorunlu')}</span>
                              : null}
                        </div>
                        <h3><UiIcon label={action.title} />{t(action.title)}</h3>
                        <p className="muted">{t(action.detail)}</p>
                        <button
                          className={`btn ${action.danger ? 'btn-danger' : action.readOnly ? '' : 'btn-primary'}`}
                          onClick={() => startRepair(action)}
                        >
                          <UiIcon label={action.danger ? 'Yeniden başlat' : 'Başlat'} />
                          {action.danger ? t('Yeniden başlat') : t('Başlat')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="repair-group">
                <h3><UiIcon icon="🛟" />{t('WinRE komut rehberi')}</h3>
                <p className="muted">{t('Aşağıdaki komutlar yalnızca Windows Kurtarma Ortamı’nda (Gelişmiş başlatma → Komut İstemi) çalıştırılmalıdır. Açık sistemde chkdsk /f, bootrec veya bcdboot kullanmayın.')}</p>
                <div className="card">
                  <div className="card-top">
                    <h3 style={{ margin: 0 }}><UiIcon label="Komutlar" />{t('Komutlar')}</h3>
                    <button className="btn" onClick={() => void run(t('Komutları kopyala'), async () => {
                      await navigator.clipboard.writeText(WINRE_COMMANDS);
                    }, t('Komutlar panoya kopyalandı.'))}><UiIcon label="Komutları kopyala" />{t('Komutları kopyala')}</button>
                  </div>
                  <pre className="log-block">{WINRE_COMMANDS}</pre>
                </div>
                <div className="feature-grid">
                  {[BCD_ACTION, RESTART_ACTION].map((action) => (
                    <div className="card" key={action.id}>
                      <div className="feature-icon">{action.icon}</div>
                      <h3><UiIcon label={action.title} />{t(action.title)}</h3>
                      <p className="muted">{t(action.detail)}</p>
                      <button className={`btn ${action.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => startRepair(action)}>
                        <UiIcon label={action.danger ? 'Yeniden başlat' : action.title} />
                        {action.danger ? t('Yeniden başlat') : t(action.title)}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              {repairResult && (
                <div className="card">
                  <div className="card-top"><h3 style={{ margin: 0 }}><UiIcon label="Son işlem" />{t('Son işlem')}</h3><span className={`badge ${repairResult.ok ? 'badge-green' : 'badge-warn'}`}>{repairResult.ok ? t('tamamlandı') : t('sorun var')}</span></div>
                  <p className="muted small">{repairResult.message} · {(repairResult.durationMs / 1000).toFixed(1)} sn</p>
                  {repairResult.backupPath && <p className="muted small">{tf('Yedek: {path}', { path: repairResult.backupPath })}</p>}
                  <pre className="log-block">{repairResult.lines.slice(-80).join('\n')}</pre>
                </div>
              )}
            </section>
          )}

          {tab === 'autoruns' && (
            <section className="page">
              <div className="toolbar">
                <div>
                  <h2><UiIcon label="Gelişmiş başlangıç" />{t('Gelişmiş başlangıç')}</h2>
                  <p className="muted">{t('Zamanlı görevler, servisler, Winlogon, AppInit, IFEO ve WMI aboneliklerini listeler. Kritik girdiler otomatik değiştirilmez.')}</p>
                </div>
                <div className="toolbar-actions">
                  <select value={autorunFilter} onChange={(event) => setAutorunFilter(event.target.value as typeof autorunFilter)}>
                    {(['all', 'task', 'service', 'winlogon', 'appinit', 'ifeo', 'wmi', 'elevated'] as const).map((value) => (
                      <option key={value} value={value}>{value === 'all' ? t('Tümü') : value === 'elevated' ? t('Yüksek yetkili') : value}</option>
                    ))}
                  </select>
                  <button className="btn btn-primary" onClick={() => void run(t('Başlangıç girdileri taranıyor'), async () => setAutoruns(await api.autorunScan()))}><UiIcon label="Tara" />{t('Tara')}</button>
                </div>
              </div>
              {autoruns && (
                <>
                  <div className="stats-grid">
                    <div className="stat"><span>{t('Toplam girdi')}</span><b>{autoruns.items.length}</b></div>
                    <div className="stat"><span>{t('Etkin')}</span><b>{autoruns.items.filter((item) => item.enabled).length}</b></div>
                    <div className="stat"><span>{t('Yüksek yetkili')}</span><b>{autoruns.items.filter((item) => item.risk === 'elevated').length}</b></div>
                    <div className="stat"><span>{t('Süre')}</span><b>{(autoruns.durationMs / 1000).toFixed(1)} sn</b></div>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>{t('Tür')}</th><th>{t('Ad')}</th><th>{t('Komut / değer')}</th><th>{t('Konum')}</th><th>{t('Durum')}</th><th>{t('İşlem')}</th></tr></thead>
                      <tbody>
                        {autoruns.items.filter((item) => autorunFilter === 'all' || (autorunFilter === 'elevated' ? item.risk === 'elevated' : item.category === autorunFilter)).map((item) => (
                          <tr key={item.id}>
                            <td><span className="badge">{item.category}</span></td>
                            <td><b>{item.name}</b>{item.risk === 'elevated' && <span className="badge badge-warn">{t('yüksek')}</span>}</td>
                            <td className="small mono" title={item.command}>{item.command.slice(0, 120) || '—'}</td>
                            <td className="small muted">{item.location || '—'}</td>
                            <td>{item.enabled ? <span className="badge badge-green">{t('açık')}</span> : <span className="badge">{t('kapalı')}</span>}<div className="muted small">{item.state}</div></td>
                            <td className="row-actions">
                              <button className="btn btn-small" disabled={item.category === 'winlogon' || item.category === 'wmi'} onClick={() => askAutorun(item, !item.enabled)}><UiIcon label="Kapat" />{item.enabled ? t('Kapat') : t('Aç')}</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!!autoruns.errors.length && <div className="notice"><p className="muted small">{autoruns.errors.join('\n')}</p></div>}
                </>
              )}
            </section>
          )}

          {tab === 'privacy' && (
            <section className="page">
              <div className="toolbar">
                <div>
                  <h2><UiIcon label="Gizlilik ayarları" />{t('Gizlilik ayarları')}</h2>
                  <p className="muted">{t('Windows gizlilik ve arayüz ayarları. Her değişiklikten önce .reg yedeği alınır ve özgün değer saklanır; dilediğiniz ayarı tek tek geri alabilirsiniz.')}</p>
                </div>
                <div className="toolbar-actions">
                  <button className="btn" onClick={() => void run(t('Ayarlar okunuyor'), async () => setPrivacyTweaks(await api.privacyList()))}><UiIcon label="Yenile" />{t('Yenile')}</button>
                </div>
              </div>
              {(['telemetry', 'privacy', 'interface'] as const).map((category) => {
                const rows = privacyTweaks.filter((tweak) => tweak.category === category);
                if (!rows.length) return null;
                return (
                  <div className="card" key={category}>
                    <h3><UiIcon icon={category === 'telemetry' ? '📡' : category === 'privacy' ? '🔒' : '🎨'} />{t(category === 'telemetry' ? 'Telemetri' : category === 'privacy' ? 'Gizlilik' : 'Arayüz')}</h3>
                    <div className="mini-list privacy-list">
                      {rows.map((tweak) => (
                        <div className="setting-row" key={tweak.id}>
                          <div>
                            <strong>{t(tweak.title)}</strong>
                            <small>{t(tweak.description)}</small>
                            <div className="muted small mono">{tweak.hive}\\{tweak.location} → {tweak.name}</div>
                          </div>
                          <div className="row-actions">
                            <span className={`badge ${tweak.applied ? 'badge-green' : ''}`}>{tweak.applied ? t('uygulandı') : t('varsayılan')}</span>
                            <button className="btn btn-small" disabled={tweak.applied} onClick={() => askPrivacy(tweak, true)}><UiIcon label="Uygula" />{t('Uygula')}</button>
                            <button className="btn btn-small" disabled={!tweak.applied} onClick={() => askPrivacy(tweak, false)}><UiIcon label="Geri al" />{t('Geri al')}</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          )}
        </div>

      </main>

      {toast && <div className={`toast toast-${toast.kind}`}>{toast.text}</div>}

      {leftoverTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal wide" role="dialog" aria-modal="true" aria-label={t('Kalıntılar')}>
            <h2><UiIcon label="{name} — kalıntılar" />{tf('{name} — kalıntılar', { name: leftoverTarget.label })}</h2>
            <p className="muted">{tf('Bulunan {count} öğe. Varsayılan olarak Geri Dönüşüm Kutusu kullanılır; kalıcı silme açık onay gerektirir.', { count: leftovers.length })}</p>
            {leftoverScanning && (
              <div className="scan-progress">
                <div className="scan-progress-head">
                  <span>{t('Kalıntılar taranıyor')}</span>
                  <span>{leftoverProgress?.percent ?? 0}% · {tf('{count} öğe', { count: leftoverProgress?.matches ?? 0 })}</span>
                </div>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${leftoverProgress?.percent ?? 0}%` }} /></div>
                <button className="btn btn-danger-ghost" onClick={cancelLeftoverScan}><UiIcon label="Taramayı iptal et" />{t('Taramayı iptal et')}</button>
              </div>
            )}
            <div className="leftover-list">
              {leftovers.map((item) => (
                <label key={item.path} className="leftover-row">
                  <input type="checkbox" checked={selectedLeftovers.has(item.path)} onChange={() => toggle(setSelectedLeftovers, item.path)} />
                  <span className={`kind kind-${item.kind}`}>{t(item.kind === 'folder' ? 'KLASÖR' : item.kind === 'file' ? 'DOSYA' : 'KAYIT')}</span>
                  <span className="path" title={item.path}>{item.path}</span>
                  <span className="mono small">{sizeText(item.size)}</span>
                </label>
              ))}
              {!leftovers.length && <p className="empty">{t('Kalıntı bulunamadı.')}</p>}
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setLeftoverTarget(null)}><UiIcon label="Kapat" />{t('Kapat')}</button>
              <button className="btn btn-danger-ghost" disabled={!selectedLeftovers.size} onClick={() => askLeftoverDelete('permanent')}><UiIcon label="Kalıcı olarak sil" />{t('Kalıcı olarak sil')}</button>
              <button className="btn btn-primary" disabled={!selectedLeftovers.size} onClick={() => askLeftoverDelete('recycle')}><UiIcon label="Geri Dönüşüm Kutusu'na taşı" />{t('Geri Dönüşüm Kutusu\'na taşı')}</button>
            </div>
          </div>
        </div>
      )}

      {closePrompt && (
        <div className="modal-backdrop modal-front" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label={t('Uygulamayı kapat')}>
            <div className="modal-icon">?</div>
            <h2><UiIcon label="Uygulamayı kapat" />{t('Uygulamayı kapat')}</h2>
            <p>{t('Sistem tepsisine küçültülsün mü?')}</p>
            <label className="modal-check">
              <input type="checkbox" checked={rememberClose} onChange={(event) => setRememberClose(event.target.checked)} />
              {t('Bu tercihi hatırla')}
            </label>
            <div className="modal-actions">
              <button className="btn" onClick={() => setClosePrompt(false)}><UiIcon label="Vazgeç" />{t('Vazgeç')}</button>
              <button className="btn" onClick={() => chooseClose('quit')}><UiIcon label="Uygulamayı kapat" />{t('Uygulamayı kapat')}</button>
              <button className="btn btn-primary" onClick={() => chooseClose('tray')}><UiIcon label="Tepsiye küçült" />{t('Tepsiye küçült')}</button>
            </div>
          </div>
        </div>
      )}

      {confirm && <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />}
      </div>
    </div>
  );
}

function regKey(issue: RegIssue): string {
  return `${issue.category || 'uninstall'}|${issue.label}|${issue.rootPath}|${issue.key}|${issue.valueName || ''}`;
}
