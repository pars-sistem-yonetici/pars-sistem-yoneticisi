export interface Package {
  name: string;
  ident: string;
  version: string;
  available: string;
  source: string;
}

export type PackageSource = 'winget' | 'choco' | 'npm' | 'scoop';

export interface InstallItem {
  name: string;
  ident: string;
  source: PackageSource;
}

export interface InstallProgress {
  requestId: string;
  index: number;
  total: number;
  name: string;
  source: PackageSource;
  percent: number;
  speed: string;
  line: string;
  phase: 'start' | 'progress' | 'done';
  ok?: boolean;
}

export interface InstallResult {
  name: string;
  ident: string;
  source: PackageSource;
  ok: boolean;
  code: number;
  message: string;
}

export interface PackageManagerStatus {
  source: PackageSource;
  label: string;
  available: boolean;
  version: string;
}

export interface InstalledApp {
  name: string;
  ident: string;
  version: string;
  /** Kayıt defterindeki EstimatedSize (KB) değerinden hesaplanan bayt cinsinden boyut. */
  size: number;
  publisher: string;
  installLocation: string;
  displayIcon: string;
  uninstallString: string;
  icon?: string;
}

export interface SystemSnapshot {
  cpuPercent: number;
  memoryTotal: number;
  memoryAvailable: number;
  memoryPercent: number;
  diskTotal: number;
  diskFree: number;
  diskPercent: number;
  diskPath: string;
}

export interface CleanTarget {
  key: string;
  name: string;
  description: string;
  dirs: string[];
  files: string[];
  action: '' | 'flushdns' | 'recycle';
  needsAdmin: boolean;
  size: number;
  count: number;
  available: boolean;
}

export interface CleanResult {
  key: string;
  name: string;
  ok: boolean;
  freed: number;
  message: string;
}

export const REG_SCAN_SCOPES = [
  'uninstall', 'app-paths', 'com-shell', 'com-hijack', 'file-assoc', 'service', 'shared-dll', 'font', 'odbc',
] as const;
export type RegScanScope = (typeof REG_SCAN_SCOPES)[number];
export type RegIssueCategory = RegScanScope;
export type RegRisk = 'info' | 'warning' | 'critical';

export interface RegStats {
  scanned: number;
  protected: number;
  system: number;
  broken: number;
  findings: number;
}

export interface RegIssue {
  hive: 'HKLM' | 'HKCU';
  rootPath: string;
  label: string;
  key: string;
  name: string;
  publisher: string;
  reason: string;
  detail: string;
  view: 64 | 32;
  system?: boolean;
  category?: RegIssueCategory;
  risk?: RegRisk;
  /** Yalnızca kanıtlanmış bozuk Uninstall/App Paths girdileri yedekli olarak silinebilir. */
  fixable?: boolean;
  recommendation?: string;
  signature?: string;
  valueName?: string;
}

export interface RegResult {
  issue: RegIssue;
  ok: boolean;
  message: string;
}

export interface RegScanResult {
  issues: RegIssue[];
  stats: RegStats;
}

export interface RegExportResult {
  ok: boolean;
  message: string;
  path: string;
}

export interface Leftover {
  path: string;
  kind: 'file' | 'folder' | 'registry';
  size: number;
  reason: string;
}

export interface LeftoverScanTarget {
  name: string;
  ident: string;
}

export interface AppLeftovers extends LeftoverScanTarget {
  items: Leftover[];
}

export interface LeftoverProgress {
  requestId: string;
  rootIndex: number;
  rootsTotal: number;
  scanned: number;
  matches: number;
  percent: number;
}

export interface DeleteResult {
  path: string;
  ok: boolean;
  message: string;
}

export interface BloatwareItem {
  id: string;
  name: string;
  publisher: string;
  version: string;
  kind: 'windows-app' | 'oem-app';
  ident: string;
  packageName: string;
  packageFullName: string;
  provisioned: boolean;
  detail: string;
  reason: string;
}

export interface BloatwareRemoveResult {
  id: string;
  ok: boolean;
  message: string;
}

export interface LogEntry {
  time: string;
  scope: string;
  line: string;
}

import type { ManagedPolicyFixId } from './managedPolicy';

export type { ManagedPolicyFixId } from './managedPolicy';

/** 'tr' ve 'en' tam çevirili; diğer kodlar Electron dil paketlerinden/ek çeviri dosyalarından gelir. */
export type Language = string;
export type Theme = 'default' | 'windows11' | 'auto';
export type WindowAction = 'minimize' | 'maximize' | 'close' | 'close-to-tray';
/** Kapat düğmesine basıldığında ne yapılacağı. 'ask' her seferinde sorar. */
export type CloseBehavior = 'ask' | 'tray' | 'quit';

export interface StartupItem {
  id: string;
  name: string;
  command: string;
  location: string;
  enabled: boolean;
  kind: 'registry' | 'folder';
  scope: 'user' | 'machine';
  sourcePath: string;
  valueName: string;
  valueType: string;
}

/** Önyüklemeden sonra ilk 10 işlemin başlama zamanı (yaklaşık, saniye). */
export interface StartupTiming {
  name: string;
  processName: string;
  seconds: number;
  command: string;
}

export interface Settings {
  language: Language;
  theme: Theme;
  wingetVersion: string;
  wingetAvailable: boolean;
  autoUpdateScan: boolean;
  autoLeftoverScan: boolean;
  silentInstall: boolean;
  /** Kurumsal dağıtımda eksik paket yöneticilerini açılışta onaysız/arka planda kurur. Varsayılan kapalı. */
  enterpriseSilentPrereqs: boolean;
  drive: string;
  startWithWindows: boolean;
  startMinimizedToTray: boolean;
  closeBehavior: CloseBehavior;
  /** Boşsa exe yanındaki updates\latest.json kullanılır. http(s) URL veya yerel klasör olabilir. */
  updateSource: string;
  updateCheckOnStartup: boolean;
  /** Bu klasörlerdeki dosyalar tarama, temizleme ve silme işlemlerinden tamamen çıkarılır. */
  excludedFolders: string[];
  /** Örn. ['.iso', '.zip']; bu uzantılı dosyalar hiçbir işleme tabi tutulmaz. */
  excludedExtensions: string[];
}

export interface FirewallRule {
  id: string;
  name: string;
  enabled: boolean;
  direction: string;
  action: string;
  program: string;
  remoteAddress: string;
  localPort: string;
  remotePort: string;
  protocol: string;
  profile: string;
  signature: string;
  severity: 'critical' | 'medium' | 'low';
  reasons: string[];
}

export const MALWARE_ENGINE_IDS = [
  'signatures', 'heuristics', 'scripts', 'integrity', 'persistence', 'defender', 'hosts', 'browser',
] as const;

export type MalwareEngine = (typeof MALWARE_ENGINE_IDS)[number];
export type MalwareSeverity = 'critical' | 'medium' | 'low' | 'info';
export type MalwareScanStatus = 'running' | 'done' | 'failed' | 'cancelled';

export interface MalwareFinding {
  id: string;
  engine: MalwareEngine;
  severity: MalwareSeverity;
  title: string;
  detail: string;
  path?: string;
}

export interface MalwareScanResult {
  findings: MalwareFinding[];
  /** Her motorun gerçekte incelediği nesne sayısı (bulgu sayısı değil). */
  scanned: Record<MalwareEngine, number>;
  durationMs: number;
  /** Kullanıcı taramayı iptal ettiyse true; kısmi bulgular yine döndürülür. */
  cancelled?: boolean;
}

export interface MalwareScanProgress {
  requestId: string;
  engine: MalwareEngine;
  status: MalwareScanStatus;
  index: number;
  total: number;
  /** Bu ana kadar toplanan bulgu sayısı. */
  findings: number;
  /** Tamamlanan motorun incelediği nesne sayısı. */
  scanned: number;
}

export interface MalwareExportResult {
  ok: boolean;
  message: string;
  path: string;
}

export type ScheduleKind = 'weekly-full' | 'daily-light' | 'monthly-deep' | 'custom';

export interface ScheduleTask {
  id: string;
  kind: ScheduleKind;
  name: string;
  enabled: boolean;
  time: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  intervalDays?: number;
  lastRun?: string;
  nextRun?: string;
}

export interface DownloadResult {
  ok: boolean;
  message: string;
  path?: string;
}

export interface DriverInfo {
  device: string;
  manufacturer: string;
  provider: string;
  version: string;
  date: string;
  deviceClass: string;
  inf: string;
  signed: boolean;
  status: string;
}

export interface DriverUpdate {
  id: string;
  title: string;
  description: string;
  version: string;
  manufacturer: string;
  model: string;
  size: number;
  downloaded: boolean;
  mandatory: boolean;
  reboot: string;
}

export interface DriverScanResult {
  installed: DriverInfo[];
  updates: DriverUpdate[];
  isAdmin: boolean;
}

export interface DriverActionResult {
  id: string;
  title: string;
  ok: boolean;
  message: string;
  rebootRequired: boolean;
}

export interface DriverBackupResult {
  ok: boolean;
  message: string;
  path?: string;
}

export type PrerequisiteId = 'winget' | 'choco' | 'npm' | 'scoop' | 'powershell' | 'vcredist';

export interface Prerequisite {
  id: PrerequisiteId;
  name: string;
  description: string;
  required: boolean;
  installed: boolean;
  version: string;
  installable: boolean;
  bundled: boolean;
  message: string;
}

export interface PrereqActionResult {
  id: PrerequisiteId;
  ok: boolean;
  message: string;
  rebootRequired?: boolean;
}

export type ContextMenuStyle = 'windows10' | 'windows11';

export interface ContextMenuStatus {
  style: ContextMenuStyle;
  detected: boolean;
}

export interface ContextMenuActionResult {
  style: ContextMenuStyle;
  ok: boolean;
  message: string;
  explorerRestarted: boolean;
}

/** Gezgin sağ tık menüsüne üçüncü taraf yazılımların eklediği kabuk eklentisi. */
export interface ShellExtensionItem {
  /** root|kind|name biçiminde, tarama sonucundan üretilen kararlı kimlik. */
  id: string;
  label: string;
  name: string;
  /** *, Directory, Directory\Background, Folder veya Drive */
  root: string;
  /** shellex: COM menü eklentisi, verb: klasik shell komutu */
  kind: 'shellex' | 'verb';
  /** HKCU (kullanıcı) veya HKLM (tüm kullanıcılar) */
  location: 'HKCU' | 'HKLM';
  /** CLSID veya komut değeri. */
  value: string;
  /** Blocked anahtarıyla kapatılabilen COM CLSID'si; klasik komutlarda boş. */
  clsid: string;
  /** blocked: CLSID'yi Blocked anahtarına ekler; access-only: ProgrammaticAccessOnly kullanır. */
  strategy: 'blocked' | 'access-only' | 'unsupported';
  enabled: boolean;
  /** Windows veya imzalı sistem bileşeni olabilecek girdiler. */
  isSystem: boolean;
}

export interface ShellExtensionActionResult {
  ok: boolean;
  enabled: boolean;
  message: string;
  backupPath: string;
  explorerRestarted: boolean;
}

/** Uygulamanın kendi güncelleyicisi; winget üzerinden diğer yazılımları güncellemekten ayrıdır. */
export interface AppUpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  notes: string;
  fileName: string;
  sha512: string;
  size: number;
  source: string;
  portable: boolean;
  message: string;
}

export interface UpdateProgress {
  percent: number;
  downloaded: number;
  total: number;
}

export interface UpdateDownloadResult {
  ok: boolean;
  message: string;
  path?: string;
}

export interface UpdateInstallResult {
  ok: boolean;
  message: string;
  restarting: boolean;
}

export interface ManagedPolicyFile {
  id: ManagedPolicyFixId;
  title: string;
  description: string;
  warning: string;
  fileName: string;
  content: string;
  keys: string[];
  bundled: boolean;
}

export interface ManagedPolicySaveResult {
  ok: boolean;
  message: string;
  path?: string;
}

export interface ManagedPolicyApplyResult {
  ok: boolean;
  message: string;
  applied: boolean;
  backupFolder: string;
  backups: number;
}

/* ---------- Yeni özellikler: paket yedeği, dosya tarayıcı, disk analizi,
   sistem onarımı, gelişmiş başlangıç ve gizlilik ayarları ---------- */

export interface PackageBackupEntry {
  id: string;
  name: string;
  version: string;
  source: string;
  selected: boolean;
}

export interface PackageBackupFile {
  path: string;
  name: string;
  createdAt: string;
  count: number;
  size: number;
}

export interface PackageBackupResult {
  ok: boolean;
  path: string;
  count: number;
  message: string;
}

export interface PackageImportResult {
  total: number;
  ok: boolean;
  message: string;
  lines: string[];
}

export interface PackageBackupOverview {
  folder: string;
  files: PackageBackupFile[];
}

export interface FileScanOptions {
  roots: string[];
  referenceRoots: string[];
  minSize: number;
  maxResults: number;
}

export interface DuplicateGroup {
  hash: string;
  size: number;
  files: string[];
}

export interface LargeFile {
  path: string;
  size: number;
  modified: string;
}

export interface EmptyItem {
  path: string;
  kind: 'folder' | 'file';
  size: number;
}

export interface FileScanResult {
  scanned: number;
  duplicates: DuplicateGroup[];
  large: LargeFile[];
  empty: EmptyItem[];
  wasted: number;
  durationMs: number;
  errors: string[];
}

export interface DiskTreeNode {
  name: string;
  path: string;
  size: number;
  files: number;
  children: DiskTreeNode[];
}

export interface DiskExtension {
  extension: string;
  size: number;
  files: number;
}

export interface DiskAnalysisResult {
  root: string;
  total: number;
  files: number;
  folders: number;
  topFiles: LargeFile[];
  extensions: DiskExtension[];
  tree: DiskTreeNode[];
  durationMs: number;
  errors: string[];
}

/**IPC şeması ile arayüz listesinin aynı kimlikleri kullanması için tek kaynak. */
export const REPAIR_KINDS = [
  'sfc', 'dism', 'restore-point',
  'dism-check', 'dism-scan', 'dism-analyze', 'sfc-verify', 'chkdsk-scan',
  'update-reset', 'network-reset',
  'component-cleanup', 'store-cache', 'search-index', 'print-spooler',
  'full-sequence', 'bcd-backup', 'advanced-restart',
  'nic-latency', 'nic-latency-revert', 'prefetch-cleanup', 'counters-wmi', 'installer-perms', 'time-sync',
  'safe-mode-status', 'safe-mode-on', 'safe-mode-off',
] as const;

export type RepairKind = (typeof REPAIR_KINDS)[number];

export interface RepairResult {
  kind: RepairKind;
  ok: boolean;
  message: string;
  lines: string[];
  durationMs: number;
  /** Zorunlu yedek dosyası/klasörü (varsa). */
  backupPath?: string;
  /** İşlem sonrası yeniden başlatma gerekiyorsa true. */
  rebootRequired?: boolean;
}

export type AutorunCategory = 'task' | 'service' | 'winlogon' | 'appinit' | 'ifeo' | 'wmi';

export interface AutorunItem {
  id: string;
  category: AutorunCategory;
  name: string;
  location: string;
  command: string;
  enabled: boolean;
  publisher: string;
  sourcePath: string;
  risk: 'normal' | 'elevated';
  state: string;
}

export interface AutorunScanResult {
  items: AutorunItem[];
  errors: string[];
  durationMs: number;
}

export interface AutorunActionResult {
  ok: boolean;
  enabled: boolean;
  backupPath: string;
  message: string;
}

export type PrivacyCategory = 'telemetry' | 'privacy' | 'interface';

export interface PrivacyTweak {
  id: string;
  title: string;
  description: string;
  category: PrivacyCategory;
  hive: 'HKCU' | 'HKLM';
  location: string;
  name: string;
  value: string;
  applied: boolean;
  current: string;
  admin: boolean;
}

export interface PrivacyActionResult {
  id: string;
  ok: boolean;
  applied: boolean;
  current: string;
  backupPath: string;
  message: string;
}

/** Yerel Windows & ağ ayarları: beş kategori, toplam 63 tersine çevrilebilir ayar. */
export const TWEAK_CATEGORIES = ['network', 'performance', 'interface', 'privacy', 'services'] as const;
export type TweakCategory = (typeof TWEAK_CATEGORIES)[number];

export interface SystemTweak {
  id: string;
  title: string;
  description: string;
  category: TweakCategory;
  /** Ayarın türü; arayüzde rozet ve yedek açıklaması için kullanılır. */
  mode: 'registry' | 'command';
  hive: 'HKCU' | 'HKLM';
  /** Kayıt defteri ayarları için anahtar/değer; komut ayarları için boş olabilir. */
  location: string;
  name: string;
  value: string;
  current: string;
  applied: boolean;
  admin: boolean;
  rebootRequired: boolean;
  /** Komut tabanlı ayarlarda özgün durum JSON yedeğe kaydedilir. */
  original?: string;
}

export interface TweakActionResult {
  id: string;
  ok: boolean;
  applied: boolean;
  current: string;
  backupPath: string;
  message: string;
  rebootRequired: boolean;
}

export const PROFILE_IDS = ['competitive-gamer', 'low-latency-network', 'balanced', 'safe-privacy'] as const;
export type ProfileId = (typeof PROFILE_IDS)[number];

export interface OptimizationProfile {
  id: ProfileId;
  title: string;
  description: string;
  icon: string;
  tweakIds: string[];
}

export interface ProfileApplyResult {
  id: ProfileId;
  ok: boolean;
  applied: string[];
  failed: Array<{ id: string; message: string }>;
  backupPath: string;
  message: string;
  rebootRequired: boolean;
}

export const DNS_PROVIDER_IDS = ['cloudflare', 'google', 'quad9', 'adguard', 'opendns'] as const;
export type DnsProviderId = (typeof DNS_PROVIDER_IDS)[number];

export interface DnsProvider {
  id: DnsProviderId;
  name: string;
  primary: string;
  secondary: string;
}

export interface DnsBenchmarkRow {
  id: DnsProviderId;
  name: string;
  primary: string;
  secondary: string;
  latencyMs: number | null;
  ok: boolean;
  detail: string;
  durationMs: number;
}

export interface DnsBenchmarkResult {
  rows: DnsBenchmarkRow[];
  sample: string;
  durationMs: number;
}

export interface DnsCurrentResult {
  adapters: Array<{ name: string; index: number; servers: string[] }>;
  message: string;
}

export interface DnsSwitchResult {
  ok: boolean;
  id: DnsProviderId;
  message: string;
  backupPath: string;
  previous: string[];
}

export interface AppApi {
  onLog: (callback: (entry: LogEntry) => void) => () => void;
  onMaximizedChange: (callback: (maximized: boolean) => void) => () => void;
  windowAction: (action: WindowAction) => Promise<void>;
  isMaximized: () => Promise<boolean>;
  systemSnapshot: (drive?: string) => Promise<SystemSnapshot>;
  systemDrives: () => Promise<string[]>;
  systemDriveLabels: () => Promise<Record<string, string>>;
  wingetVersion: () => Promise<{ available: boolean; version: string }>;
  wingetSourceUpdate: () => Promise<number>;
  wingetList: () => Promise<Package[]>;
  wingetUpdates: () => Promise<Package[]>;
  updateList: (source: 'all' | PackageSource) => Promise<Package[]>;
  wingetSearch: (query: string) => Promise<Package[]>;
  wingetInstall: (ident: string, silent: boolean) => Promise<number>;
  packageManagerStatus: () => Promise<PackageManagerStatus[]>;
  networkSpeed: () => Promise<number>;
  installQueue: (items: InstallItem[], silent: boolean, requestId?: string) => Promise<InstallResult[]>;
  onInstallProgress: (callback: (progress: InstallProgress) => void) => () => void;
  installCancel: (requestId: string) => void;
  wingetUpgrade: (pkg: Package, silent: boolean) => Promise<number>;
  updateQueue: (items: Package[], silent: boolean, requestId?: string) => Promise<InstallResult[]>;
  onUpdateQueueProgress: (callback: (progress: InstallProgress) => void) => () => void;
  updateQueueCancel: (requestId: string) => void;
  wingetUpgradeAll: (silent: boolean) => Promise<number>;
  wingetUninstall: (pkg: Package, silent: boolean) => Promise<number>;
  wingetDownload: (ident: string) => Promise<DownloadResult>;
  installedApps: () => Promise<InstalledApp[]>;
  scanLeftovers: (name: string, ident: string) => Promise<Leftover[]>;
  scanLeftoversBatch: (targets: LeftoverScanTarget[], requestId?: string) => Promise<AppLeftovers[]>;
  onLeftoverProgress: (callback: (progress: LeftoverProgress) => void) => () => void;
  cancelLeftovers: (requestId: string) => void;
  deleteLeftovers: (items: Leftover[], mode: 'recycle' | 'permanent') => Promise<DeleteResult[]>;
  bloatwareScan: () => Promise<BloatwareItem[]>;
  bloatwareRemove: (items: BloatwareItem[]) => Promise<BloatwareRemoveResult[]>;
  diskTargets: () => Promise<CleanTarget[]>;
  diskScan: () => Promise<CleanTarget[]>;
  diskClean: (keys: string[], recycleDrives?: string[]) => Promise<CleanResult[]>;
  diskCleanupLogPath: () => Promise<string>;
  registryScan: (scopes?: RegScanScope[]) => Promise<RegScanResult>;
  registryDelete: (issues: RegIssue[]) => Promise<RegResult[]>;
  registryBackupPath: () => Promise<string>;
  registryExportReport: (format: 'json' | 'csv') => Promise<RegExportResult>;
  startupList: () => Promise<StartupItem[]>;
  startupTimings: () => Promise<StartupTiming[]>;
  startupSet: (item: StartupItem, enabled: boolean) => Promise<string>;
  firewallScan: () => Promise<FirewallRule[]>;
  firewallSet: (id: string, enabled: boolean) => Promise<string>;
  firewallDelete: (id: string) => Promise<string>;
  firewallBackupPath: () => Promise<string>;
  malwareScan: (engines: MalwareEngine[], requestId?: string) => Promise<MalwareScanResult>;
  onMalwareProgress: (callback: (progress: MalwareScanProgress) => void) => () => void;
  cancelMalwareScan: (requestId: string) => void;
  malwareExportReport: (content: string, format: 'json' | 'txt') => Promise<MalwareExportResult>;
  scheduleList: () => Promise<ScheduleTask[]>;
  scheduleSave: (tasks: ScheduleTask[]) => Promise<ScheduleTask[]>;
  scheduleRun: (task: ScheduleTask) => Promise<{ taskId: string; ran: boolean; message: string }>;
  driversScan: () => Promise<DriverScanResult>;
  driversDownload: (ids: string[]) => Promise<DriverActionResult[]>;
  driversInstall: (ids: string[], backup: boolean) => Promise<DriverActionResult[]>;
  driversBackup: () => Promise<DriverBackupResult>;
  localeList: () => Promise<string[]>;
  localeDictionary: (language: string) => Promise<Record<string, string>>;
  localeFolder: () => Promise<string>;
  prereqScan: () => Promise<Prerequisite[]>;
  prereqInstall: (id: PrerequisiteId) => Promise<PrereqActionResult>;
  prereqAutoInstall: () => Promise<PrereqActionResult[]>;
  contextMenuStatus: () => Promise<ContextMenuStatus>;
  contextMenuSet: (style: ContextMenuStyle) => Promise<ContextMenuActionResult>;
  shellExtensions: () => Promise<ShellExtensionItem[]>;
  shellExtensionSet: (id: string, enabled: boolean) => Promise<ShellExtensionActionResult>;
  managedPolicyFiles: () => Promise<ManagedPolicyFile[]>;
  managedPolicySave: (id: ManagedPolicyFixId) => Promise<ManagedPolicySaveResult>;
  managedPolicyApply: (id: ManagedPolicyFixId) => Promise<ManagedPolicyApplyResult>;
  onCloseRequest: (callback: () => void) => () => void;
  onUpdateProgress: (callback: (progress: UpdateProgress) => void) => () => void;
  appUpdateCheck: () => Promise<AppUpdateInfo>;
  appUpdateDownload: (info: AppUpdateInfo) => Promise<UpdateDownloadResult>;
  appUpdateInstall: (filePath: string) => Promise<UpdateInstallResult>;
  appUpdateFolder: () => Promise<string>;
  pickFolders: () => Promise<string[]>;
  getSettings: () => Promise<Settings>;
  setSettings: (patch: Partial<Settings>) => Promise<Settings>;
  openPath: (targetPath: string) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  pickScanFolders: () => Promise<string[]>;
  packageBackupFolder: () => Promise<string>;
  packageBackupList: () => Promise<PackageBackupOverview>;
  packageExport: () => Promise<PackageBackupResult>;
  packageReadBackup: (filePath: string) => Promise<PackageBackupEntry[]>;
  packageImport: (filePath: string, idents: string[]) => Promise<PackageImportResult>;
  fileScan: (options: FileScanOptions) => Promise<FileScanResult>;
  fileDelete: (paths: string[], referenceRoots: string[], mode: 'recycle' | 'permanent') => Promise<DeleteResult[]>;
  diskAnalysis: (root: string) => Promise<DiskAnalysisResult>;
  repairRun: (kind: RepairKind) => Promise<RepairResult>;
  repairBackupFolder: () => Promise<string>;
  autorunScan: () => Promise<AutorunScanResult>;
  autorunSet: (item: AutorunItem, enabled: boolean) => Promise<AutorunActionResult>;
  privacyList: () => Promise<PrivacyTweak[]>;
  privacySet: (tweak: PrivacyTweak, apply: boolean) => Promise<PrivacyActionResult>;
  tweaksList: () => Promise<SystemTweak[]>;
  tweaksSet: (id: string, apply: boolean) => Promise<TweakActionResult>;
  tweaksBackupFolder: () => Promise<string>;
  profileList: () => Promise<OptimizationProfile[]>;
  profileApply: (id: ProfileId, apply: boolean) => Promise<ProfileApplyResult>;
  dnsProviders: () => Promise<DnsProvider[]>;
  dnsCurrent: () => Promise<DnsCurrentResult>;
  dnsBenchmark: () => Promise<DnsBenchmarkResult>;
  dnsSwitch: (id: DnsProviderId) => Promise<DnsSwitchResult>;
  dnsReset: () => Promise<DnsSwitchResult>;
}

declare global {
  interface Window {
    api: AppApi;
  }
}
