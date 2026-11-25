import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, shell, Tray } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DNS_PROVIDER_IDS, PROFILE_IDS, REG_SCAN_SCOPES, REPAIR_KINDS } from '../shared/types';
import type {
  CleanTarget, DownloadResult, InstallItem, LogEntry, MalwareEngine, Package, PackageSource, RegIssue, RegScanScope, ScheduleTask, Theme, WindowAction,
} from '../shared/types';
import * as appsService from './services/apps';
import * as autorunsService from './services/autoruns';
import * as bloatwareService from './services/bloatware';
import * as cleanupLogService from './services/cleanupLog';
import * as contextMenuService from './services/contextMenu';
import * as dnsService from './services/dns';
import * as diskAnalysisService from './services/diskAnalysis';
import * as diskService from './services/disk';
import * as fileScanService from './services/fileScan';
import * as firewallService from './services/firewall';
import * as installersService from './services/installers';
import * as networkService from './services/network';
import * as driversService from './services/drivers';
import * as localeService from './services/locales';
import * as loginItemService from './services/loginItem';
import * as managedPolicyService from './services/managedPolicy';
import * as prereqService from './services/prereqs';
import * as leftoversService from './services/leftovers';
import * as malwareService from './services/malware';
import * as packagesService from './services/packages';
import * as privacyService from './services/privacy';
import * as registryService from './services/registry';
import * as repairService from './services/repair';
import * as schedulerService from './services/scheduler';
import * as shellExtensionsService from './services/shellExtensions';
import * as settingsService from './services/settings';
import * as startupService from './services/startup';
import * as systemService from './services/system';
import * as tweaksService from './services/tweaks';
import * as updaterService from './services/updater';
import * as winget from './services/winget';
import * as updatesService from './services/updates';
import {
  arr, autorunItem, bloatwareItem, bool, filePath, fileScanOptions, ident, installItem, IpcValidationError, isInside,
  leftover, leftoverScanTarget, oneOf, pathList, privacyTweak, regIssue,
  scheduleTask, searchQuery, settingsPatch, startupItem, str, updateInfo,
  Validator, wingetPkg,
} from './ipc-guard';
import { LogFn, nowTime } from './util';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let stopScheduler: (() => void) | null = null;
/** Kapatma onayı verildiğinde native 'close' olayının tekrar soru sormasını engeller. */
let forceClose = false;

/**
 * Marka değişikliğinden önceki klasörleri yeni adlarına taşır.
 * Ayarlar, çeviriler ve yedekler korunur; yeni klasör zaten varsa eskiye dokunulmaz.
 */
function migrateLegacyData(): void {
  try {
    const appData = app.getPath('appData');
    const oldUserData = path.join(appData, 'yazilim-yoneticisi-ts');
    const newUserData = path.join(appData, 'pars-sistem-yoneticisi-ts');
    if (newUserData !== oldUserData && !fs.existsSync(newUserData) && fs.existsSync(oldUserData)) {
      fs.renameSync(oldUserData, newUserData);
    }
  } catch {
    // Taşıma başarısızsa uygulama boş klasörle devam eder.
  }

  try {
    const local = process.env.LOCALAPPDATA;
    if (local) {
      const oldFolder = path.join(local, 'YazilimYoneticisi');
      const newFolder = path.join(local, 'ParsSistemYoneticisi');
      if (!fs.existsSync(newFolder) && fs.existsSync(oldFolder)) fs.renameSync(oldFolder, newFolder);
    }
  } catch {
    // Eski yedek klasörü taşınamazsa eski yerinde kalır.
  }
}

function emit(scope: string, line: string): void {
  const entry: LogEntry = { time: nowTime(), scope, line };
  mainWindow?.webContents.send('log', entry);
}

function logger(scope: string): LogFn {
  return (line) => {
    if (line.trim()) emit(scope, line.replace(/\r$/, ''));
  };
}

function startInTray(): boolean {
  return process.argv.includes('--start-tray') && settingsService.getSettings().startMinimizedToTray;
}

async function applyStartupSettings(): Promise<void> {
  // Geliştirme modunda Electron, başlangıç kaydına kendi electron.exe yolunu yazar.
  // Bu da açılışta "path-to-app" uyarısına yol açtığı için dev süreci kayıt yazmaz.
  if (!app.isPackaged) return;

  const settings = settingsService.getSettings();
  const args = settings.startMinimizedToTray ? ['--start-tray'] : [];
  const portableExe = process.env.PORTABLE_EXECUTABLE_FILE;
  const legacy = ['electron.app.Electron', `electron.app.${app.getName()}`, 'YazilimYoneticisi'];
  const toRemove = !portableExe || !settings.startWithWindows ? [...legacy, 'ParsSistemYoneticisi'] : legacy;
  await loginItemService.removeItems(toRemove);

  if (portableExe) {
    // Portable sürüm her açılışta geçici bir klasöre çıkarılır; başlangıç kaydı
    // kalıcı portable exe yolunu göstermelidir.
    if (settings.startWithWindows) await loginItemService.setItem('ParsSistemYoneticisi', [portableExe, ...args]);
    return;
  }

  app.setLoginItemSettings({
    openAtLogin: settings.startWithWindows,
    args,
  });
}

function applyLocale(language?: string): void {
  // Electron 34'te çalışma anında setLocale yok; uygulama çevirileri renderer tarafında üretilir.
  // Dil kodu yine de kaydedilir ve yerel dil paketleri listesinde gösterilir.
  const value = (language || settingsService.getSettings().language || 'tr').replace(/[^A-Za-z0-9-]/g, '').slice(0, 20);
  if (value) process.env.LC_LANGUAGE = value;
}

/** Tepsi simgesi için önce paket dışındaki kopyayı, sonra uygulama içindekileri dener. */
function trayIconPaths(): string[] {
  const candidates = [
    path.join(process.resourcesPath || '', 'icons', 'tray.ico'),
    path.join(__dirname, '..', '..', 'dist', 'icon.ico'),
    path.join(app.getAppPath(), 'dist', 'icon.ico'),
    path.join(__dirname, '..', '..', 'build', 'icon.ico'),
  ];
  return candidates.filter((candidate, index) => candidate && candidates.indexOf(candidate) === index);
}

/** Küçültülmüş veya gizlenmiş pencereyi görünür ve öne getirir. */
function showMainWindow(): void {
  let win = mainWindow;
  if (!win || win.isDestroyed()) {
    createWindow();
    win = mainWindow;
  }
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function setupTray(): void {
  if (tray) return;
  for (const iconPath of trayIconPaths()) {
    try {
      tray = new Tray(iconPath);
      break;
    } catch {
      tray = null;
    }
  }
  if (!tray) return;
  try {
    tray.setToolTip('Pars Sistem Yöneticisi');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Pencereyi göster', click: () => showMainWindow() },
      { type: 'separator' },
      { label: 'Çıkış', click: () => app.exit(0) },
    ]));
    tray.on('click', () => showMainWindow());
    tray.on('double-click', () => showMainWindow());
  } catch {
    tray?.destroy();
    tray = null;
  }
}

/** Windows temasını izleyen seçenek için pencere arka planını çözümler. */
function resolvedTheme(theme: Theme): 'default' | 'windows11' {
  if (theme === 'auto') return nativeTheme.shouldUseDarkColors ? 'default' : 'windows11';
  return theme;
}

function themeBackground(theme: Theme): string {
  return resolvedTheme(theme) === 'windows11' ? '#f3f3f3' : '#171719';
}

function createWindow(): void {
  const minimized = startInTray();
  mainWindow = new BrowserWindow({
    show: !minimized,
    width: 1280,
    height: 820,
    minWidth: 1020,
    minHeight: 640,
    title: 'Pars Sistem Yöneticisi',
    frame: false,
    backgroundColor: themeBackground(settingsService.getSettings().theme),
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', '..', 'dist', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
  }

  mainWindow.on('maximize', () => mainWindow?.webContents.send('window:maximized', true));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:maximized', false));
  mainWindow.on('close', (event) => {
    const win = mainWindow;
    if (!win || forceClose) return;
    const behavior = settingsService.getSettings().closeBehavior;
    if (behavior === 'tray') {
      event.preventDefault();
      setupTray();
      win.hide();
    } else if (behavior === 'ask') {
      // Alt+F4 gibi native kapatma isteklerinde de aynı onay penceresi açılır.
      event.preventDefault();
      win.webContents.send('window:close-request');
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IpcHandler = (...args: any[]) => unknown;

/** Kullanıcının dialog ile seçtiği klasörler oturum boyunca açma izni kazanır. */
const sessionFolders = new Set<string>();

function canonical(value: string): string {
  try { return fs.realpathSync(value); } catch { return path.resolve(value); }
}

function reject(field: string, detail: string): never {
  throw new IpcValidationError(`${field}: ${detail}`);
}

function allowedOpenRoots(): string[] {
  const local = process.env.LOCALAPPDATA || path.join(app.getPath('appData'), '..', 'Local');
  return [
    app.getPath('userData'),
    app.getPath('downloads'),
    path.join(local, 'ParsSistemYoneticisi'),
    os.tmpdir(),
    ...sessionFolders,
  ].map(canonical);
}

function deniedRoots(): string[] {
  return [
    process.env.SystemRoot || 'C:\\Windows',
    process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
    process.env.ProgramFiles || 'C:\\Program Files',
  ].map(canonical);
}

/** Yalnızca uygulamanın kullandığı klasörler ve kullanıcının seçtiği klasörler açılabilir. */
const openPath: Validator = (value, field) => {
  const input = str({ max: 4096 })(value, field) as string;
  const resolved = canonical(input);
  // Sürücü kökünün kendisi açılamaz; ama C:\ altındaki izinli klasörler açılabilir.
  const driveRoot = path.win32.parse(resolved).root;
  if (driveRoot && path.win32.relative(driveRoot, resolved) === '') {
    reject(field, 'sürücü kökü açılamaz');
  }
  if (deniedRoots().some((root) => isInside(resolved, root))) reject(field, 'sistem klasörü açılamaz');
  if (!allowedOpenRoots().some((root) => isInside(resolved, root))) reject(field, 'izin verilmeyen yol');
  return input;
};

/** Yalnızca uygulamaya ait resmi HTTPS bağlantıları tarayıcıda açılabilir. */
const externalUrl: Validator = (value, field) => {
  const input = str({ max: 2048 })(value, field) as string;
  let parsed: URL | null = null;
  try { parsed = new URL(input); } catch { reject(field, 'geçerli bir adres değil'); }
  if (!parsed || parsed.protocol !== 'https:') reject(field, 'yalnızca https bağlantıları açılabilir');
  const host = parsed.hostname.toLowerCase();
  const allowed = ['github.com', 'www.github.com', 'buymeacoffee.com', 'www.buymeacoffee.com', 'pars-sistem-yonetici.github.io'];
  if (!allowed.includes(host)) reject(field, 'izin verilmeyen adres');
  return input;
};

/** Kurulacak exe yalnızca indirilen güncellemeler klasöründen gelebilir. */
const updateInstallPath: Validator = (value, field) => {
  const input = str({ max: 4096 })(value, field) as string;
  if (!isInside(canonical(input), canonical(updaterService.updateFolder()))) {
    reject(field, 'güncelleme klasörü dışındaki dosya kurulamaz');
  }
  return input;
};

const optionalDrive: Validator = (value, field) =>
  value === undefined || value === null ? undefined : str({ allowEmpty: true, max: 16 })(value, field);
const optionalRequestId: Validator = (value, field) =>
  value === undefined || value === null ? undefined : str({ allowEmpty: true, max: 64 })(value, field);
/** Tarama kapsamı verilmezse tüm gruplar taranır (eski çağrılarla uyumlu). */
const optionalRegScopes: Validator = (value, field) =>
  value === undefined || value === null
    ? undefined
    : arr(oneOf(REG_SCAN_SCOPES), REG_SCAN_SCOPES.length)(value, field);
/** system:drives "C:\" biçiminde döner; doğrulayıcı bu biçimi de kabul etmeli. */
const driveLetter: Validator = str({ max: 3, pattern: /^[A-Za-z]:?\\?$/ });
const optionalDriveList: Validator = (value, field) =>
  value === undefined || value === null ? [] : arr(driveLetter, 26)(value, field);

/** Aktif kalıntı taramaları için iptal işlevleri (requestId → cancel). */
const leftoverCancellations = new Map<string, () => void>();
/** Aktif kurulum kuyrukları için iptal işlevleri (requestId → cancel). */
const installCancellations = new Map<string, () => void>();

/** Argüman alan kanallar için tek merkezde şema tanımı. */
const IPC_SCHEMAS: Record<string, Validator[]> = {
  'window:action': [oneOf(['minimize', 'maximize', 'close', 'close-to-tray'] as const)],
  'system:snapshot': [optionalDrive],
  'winget:search': [searchQuery],
  'winget:install': [ident, bool],
  'winget:upgrade': [wingetPkg, bool],
  'winget:upgrade-all': [bool],
  'winget:uninstall': [wingetPkg, bool],
  'winget:download': [ident],
  'updates:list': [oneOf(['all', 'winget', 'choco', 'npm', 'scoop'] as const)],
  'install:queue': [arr(installItem, 200), bool, optionalRequestId],
  'install:cancel': [str({ max: 64 })],
  'update:queue': [arr(wingetPkg, 200), bool, optionalRequestId],
  'update:queue-cancel': [str({ max: 64 })],
  'apps:leftovers': [str({ max: 256 }), str({ max: 128 })],
  'apps:leftovers-batch': [arr(leftoverScanTarget, 200), optionalRequestId],
  'leftovers:cancel': [str({ max: 64 })],
  'apps:delete-leftovers': [arr(leftover, 500), oneOf(['recycle', 'permanent'] as const)],
  'bloatware:remove': [arr(bloatwareItem, 300)],
  'disk:clean': [arr(str({ max: 128 }), 100), optionalDriveList],
  'registry:scan': [optionalRegScopes],
  'registry:delete': [arr(regIssue, 1000)],
  'registry:export': [oneOf(['json', 'csv'] as const)],
  'startup:set': [startupItem, bool],
  'firewall:set': [str({ max: 512 }), bool],
  'firewall:delete': [str({ max: 512 })],
  'malware:scan': [arr(oneOf(['signatures', 'heuristics', 'scripts', 'integrity', 'persistence'] as const), 5)],
  'schedule:save': [arr(scheduleTask, 100)],
  'schedule:run': [scheduleTask],
  'drivers:download': [arr(str({ max: 256 }), 500)],
  'drivers:install': [arr(str({ max: 256 }), 500), bool],
  'locale:dictionary': [str({ max: 64 })],
  'prereq:install': [oneOf(['winget', 'choco', 'npm', 'scoop', 'powershell', 'vcredist'] as const)],
  'contextMenu:set': [oneOf(['windows10', 'windows11'] as const)],
  'shell-ext:set': [str({ min: 3, max: 300 }), bool],
  'managedPolicy:save': [oneOf(['windows', 'browsers'] as const)],
  'managedPolicy:apply': [oneOf(['windows', 'browsers'] as const)],
  'update:download': [updateInfo],
  'update:install': [updateInstallPath],
  'settings:set': [settingsPatch],
  'shell:open-path': [openPath],
  'shell:open-external': [externalUrl],
  'package:read-backup': [filePath],
  'package:import': [filePath, arr(ident, 500)],
  'files:scan': [fileScanOptions],
  'files:delete': [pathList, pathList, oneOf(['recycle', 'permanent'] as const)],
  'analysis:scan': [filePath],
  'repair:run': [oneOf(REPAIR_KINDS)],
  'autoruns:set': [autorunItem, bool],
  'privacy:set': [privacyTweak, bool],
  'tweaks:set': [str({ min: 2, max: 120, pattern: /^[a-z0-9-]+$/ }), bool],
  'profile:apply': [oneOf(PROFILE_IDS), bool],
  'dns:switch': [oneOf(DNS_PROVIDER_IDS)],
};

/** Şeması olan kanallarda argümanları doğrulayıp sonra asıl handler'a geçirir. */
function register(channel: string, handler: IpcHandler): void {
  ipcMain.removeHandler(channel);
  const validators = IPC_SCHEMAS[channel];
  if (!validators || validators.length === 0) {
    ipcMain.handle(channel, handler);
    return;
  }
  ipcMain.handle(channel, (event, ...args: unknown[]) => {
    try {
      const checked = validators.map((validate, index) => validate(args[index], `${channel}[${index}]`));
      return handler(event, ...checked);
    } catch (error) {
      if (error instanceof IpcValidationError) emit('güvenlik', error.message);
      throw error;
    }
  });
}

function registerIpc(): void {
  /** Son taramanın hedefleri; temizlik kaydına gerçek öğe sayılarını yazmak için kullanılır. */
  let lastDiskTargets: CleanTarget[] = [];
  register('window:is-maximized', () => mainWindow?.isMaximized() ?? false);
  register('window:action', (_event, action: WindowAction) => {
    const win = mainWindow;
    if (!win) return;
    if (action === 'minimize') win.minimize();
    else if (action === 'maximize') {
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
    } else if (action === 'close-to-tray') {
      setupTray();
      win.hide();
    } else if (action === 'close') {
      forceClose = true;
      win.close();
    }
  });

  register('system:snapshot', (_event, drive?: string) => systemService.snapshot(drive));
  register('system:drives', () => systemService.drives());
  register('system:drive-labels', () => systemService.driveLabels());

  register('winget:version', async () => {
    const result = await winget.version();
    settingsService.setSettings({ wingetAvailable: result.available, wingetVersion: result.version });
    return result;
  });
  register('winget:source-update', () => winget.updateSources(logger('winget')));
  register('winget:list', () => winget.listPackages(logger('winget')));
  register('winget:updates', () => winget.listUpdates(logger('winget')));
  register('updates:list', (_event, source: 'all' | PackageSource) =>
    source === 'all' ? updatesService.listAllUpdates(logger('güncelleme')) : updatesService.listUpdates(source, logger('güncelleme')));
  register('winget:search', (_event, query: string) => winget.search(query, logger('winget')));
  register('winget:install', (_event, ident: string, silent: boolean) => winget.install(ident, silent, logger('kurulum')));
  register('winget:upgrade', (_event, pkg: Package, silent: boolean) => winget.upgrade(pkg, silent, logger('güncelleme')));
  register('winget:upgrade-all', (_event, silent: boolean) => winget.upgradeAll(silent, logger('güncelleme')));
  register('winget:uninstall', (_event, pkg: Package, silent: boolean) => winget.uninstall(pkg, silent, logger('kaldırma')));
  register('winget:download', async (_event, ident: string): Promise<DownloadResult> => winget.download(ident, logger('indirme')));
  register('package-manager:status', () => installersService.managerStatus());
  register('network:speed', () => networkService.networkSpeed());
  register('install:queue', async (
    _event,
    items: InstallItem[],
    silent: boolean,
    requestId?: string,
  ) => {
    let cancelled = false;
    const id = requestId || `install-${Date.now()}`;
    if (requestId) installCancellations.set(id, () => { cancelled = true; });
    try {
      return await installersService.installQueue(items, silent, id, (progress) => {
        mainWindow?.webContents.send('install:progress', progress);
        if (progress.line) emit('kurulum', progress.line);
      }, () => cancelled);
    } finally {
      installCancellations.delete(id);
    }
  });
  register('install:cancel', (_event, requestId: string) => {
    installCancellations.get(requestId)?.();
  });
  register('update:queue', async (
    _event,
    items: Package[],
    silent: boolean,
    requestId?: string,
  ) => {
    let cancelled = false;
    const id = requestId || `update-${Date.now()}`;
    if (requestId) installCancellations.set(id, () => { cancelled = true; });
    try {
      return await installersService.upgradeQueue(items, silent, id, (progress) => {
        mainWindow?.webContents.send('update:queue-progress', progress);
        if (progress.line) emit('güncelleme', progress.line);
      }, () => cancelled);
    } finally {
      installCancellations.delete(id);
    }
  });
  register('update:queue-cancel', (_event, requestId: string) => {
    installCancellations.get(requestId)?.();
  });

  register('apps:installed', async () => {
    let packages: Package[] = [];
    try {
      packages = await winget.listPackages();
    } catch (error) {
      emit('uygulama', `winget listesi alınamadı: ${(error as Error).message}`);
    }
    return appsService.installedApps(packages);
  });
  register('apps:leftovers', (_event, name: string, ident: string) => leftoversService.scanLeftovers(name, ident));
  register('apps:leftovers-batch', async (
    _event,
    targets: Parameters<typeof leftoversService.scanLeftoversBatch>[0],
    requestId?: string,
  ) => {
    let cancelled = false;
    const id = requestId || `scan-${Date.now()}`;
    if (requestId) leftoverCancellations.set(id, () => { cancelled = true; });
    try {
      return await leftoversService.scanLeftoversBatch(targets, {
        requestId: id,
        onProgress: (progress) => mainWindow?.webContents.send('leftovers:progress', progress),
        cancelled: () => cancelled,
      });
    } finally {
      leftoverCancellations.delete(id);
    }
  });
  register('leftovers:cancel', (_event, requestId: string) => {
    leftoverCancellations.get(requestId)?.();
  });
  register('apps:delete-leftovers', (_event, items: Parameters<typeof leftoversService.deleteLeftovers>[0], mode: 'recycle' | 'permanent') =>
    leftoversService.deleteLeftovers(items, mode));

  register('bloatware:scan', () => bloatwareService.scanBloatware());
  register('bloatware:remove', (_event, items: Parameters<typeof bloatwareService.removeBloatware>[0]) =>
    bloatwareService.removeBloatware(items));

  const diskTargets = async (): Promise<CleanTarget[]> => {
    lastDiskTargets = await diskService.targetsWithDrives(await systemService.drives());
    return lastDiskTargets;
  };
  register('disk:targets', diskTargets);
  register('disk:scan', async () => diskService.scan(await diskTargets(), logger('disk')));
  register('disk:clean', async (_event, keys: string[], recycleDrives: string[] = []) => {
    const selected = new Set(keys);
    const source = lastDiskTargets.length ? lastDiskTargets : await diskTargets();
    const items = source.filter((item: CleanTarget) => selected.has(item.key));
    return diskService.clean(items, logger('disk'), recycleDrives);
  });
  register('disk:log-path', () => cleanupLogService.ensureCleanupLog());

  register('registry:scan', (_event, scopes?: RegScanScope[]) => registryService.scanRegistry(scopes));
  register('registry:delete', (_event, issues: RegIssue[]) => registryService.deleteRegistryIssues(issues));
  register('registry:backup-path', () => {
    const folder = registryService.backupFolder();
    try { fs.mkdirSync(folder, { recursive: true }); } catch { /* klasör silme sırasında oluşturulur */ }
    return folder;
  });
  register('registry:export', (_event, format: 'json' | 'csv') => registryService.exportReport(format));

  register('startup:list', () => startupService.scanStartup());
  register('startup:timings', () => startupService.startupTimings());
  register('startup:set', (_event, item: Parameters<typeof startupService.setStartupEnabled>[0], enabled: boolean) =>
    startupService.setStartupEnabled(item, enabled));

  register('firewall:scan', () => firewallService.scanFirewall());
  register('firewall:set', (_event, id: string, enabled: boolean) => firewallService.setFirewallRuleEnabled(id, enabled));
  register('firewall:delete', (_event, id: string) => firewallService.deleteFirewallRule(id));
  register('firewall:backup-path', () => {
    const folder = firewallService.firewallBackupFolder();
    try { fs.mkdirSync(folder, { recursive: true }); } catch { /* klasör silme sırasında oluşturulur */ }
    return folder;
  });

  register('malware:scan', (_event, engines: MalwareEngine[]) => malwareService.scanMalware(engines));

  register('schedule:list', () => schedulerService.listSchedules());
  register('schedule:save', (_event, tasks: ScheduleTask[]) => schedulerService.saveSchedules(tasks));
  register('schedule:run', (_event, task: ScheduleTask) => schedulerService.runSchedule(task, logger('zamanlama')));

  register('drivers:scan', () => driversService.scanDrivers(logger('sürücü')));
  register('drivers:download', (_event, ids: string[]) => driversService.downloadDrivers(ids, logger('sürücü')));
  register('drivers:install', (_event, ids: string[], backup: boolean) => driversService.installDrivers(ids, backup, logger('sürücü')));
  register('drivers:backup', () => driversService.backupDrivers(logger('sürücü')));

  register('locale:list', () => localeService.availableLocales());
  register('locale:dictionary', (_event, language: string) => localeService.localeDictionary(language));
  register('locale:folder', () => localeService.ensureLocaleFolder());
  register('prereq:scan', () => prereqService.scanPrerequisites());
  register('prereq:install', (_event, id: Parameters<typeof prereqService.installPrerequisite>[0]) =>
    prereqService.installPrerequisite(id, logger('gerekli bileşen')));
  register('prereq:auto-install', async () => {
    if (!settingsService.getSettings().enterpriseSilentPrereqs) return [];
    const results = await prereqService.installMissingManagers(logger('kurumsal kurulum'));
    for (const result of results) {
      emit('kurumsal kurulum', `${result.id}: ${result.ok ? result.message : `HATA: ${result.message}`}`);
    }
    return results;
  });
  register('contextMenu:status', () => contextMenuService.contextMenuStatus());
  register('contextMenu:set', (_event, style: Parameters<typeof contextMenuService.setContextMenuStyle>[0]) =>
    contextMenuService.setContextMenuStyle(style, logger('sağ tık menüsü')));
  register('shell-ext:list', () => shellExtensionsService.listShellExtensions());
  register('shell-ext:set', (_event, id: string, enabled: boolean) =>
    shellExtensionsService.setShellExtension(id, enabled, logger('sağ tık eklentisi')));
  register('managedPolicy:files', () => managedPolicyService.managedPolicyFiles());
  register('managedPolicy:save', (_event, id: Parameters<typeof managedPolicyService.saveManagedPolicyFile>[0]) =>
    managedPolicyService.saveManagedPolicyFile(id));
  register('managedPolicy:apply', async (_event, id: Parameters<typeof managedPolicyService.applyManagedPolicyFile>[0]) => {
    const result = await managedPolicyService.applyManagedPolicyFile(id);
    emit('hata ayıklama', result.message);
    return result;
  });

  register('update:check', () => updaterService.checkForUpdate(logger('güncelleyici')));
  register('update:download', (_event, info: Parameters<typeof updaterService.downloadUpdate>[0]) =>
    updaterService.downloadUpdate(
      info,
      (percent, downloaded, total) => mainWindow?.webContents.send('update:progress', { percent, downloaded, total }),
      logger('güncelleyici'),
    ));
  register('update:install', (_event, filePath: string) => updaterService.installUpdate(filePath, logger('güncelleyici')));
  register('update:folder', () => updaterService.updateFolder());

  register('dialog:pick-folders', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Hariç tutulacak klasörleri seçin',
      properties: ['openDirectory', 'multiSelections'],
    });
    if (result.canceled) return [];
    for (const folder of result.filePaths) sessionFolders.add(canonical(folder));
    return result.filePaths;
  });

  register('files:pick-folders', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Taranacak klasörleri seçin',
      properties: ['openDirectory', 'multiSelections'],
    });
    if (result.canceled) return [];
    for (const folder of result.filePaths) sessionFolders.add(canonical(folder));
    return result.filePaths;
  });

  register('settings:get', () => settingsService.getSettings());
  register('settings:set', (_event, patch: Parameters<typeof settingsService.setSettings>[0]) => {
    const next = settingsService.setSettings(patch);
    if (patch.theme) mainWindow?.setBackgroundColor(themeBackground(next.theme));
    if (patch.language) applyLocale(next.language);
    if (patch.startWithWindows !== undefined || patch.startMinimizedToTray !== undefined) void applyStartupSettings();
    return next;
  });

  register('shell:open-path', async (_event, targetPath: string) => {
    try {
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) await shell.openPath(targetPath);
      else shell.showItemInFolder(targetPath);
    } catch (error) {
      emit('sistem', `Yol açılamadı: ${(error as Error).message}`);
    }
  });

  register('shell:open-external', async (_event, url: string) => {
    await shell.openExternal(url);
  });

  // Paket listesi yedeği
  register('package:backup-folder', () => packagesService.backupFolder());
  register('package:backup-list', () => packagesService.listBackups());
  register('package:export', () => packagesService.exportPackages(logger('paket yedeği')));
  register('package:read-backup', (_event, file: string) => packagesService.readBackup(file));
  register('package:import', (_event, file: string, idents: string[]) =>
    packagesService.importPackages(file, idents, logger('paket geri yükleme')));

  // Dosya tarayıcı ve disk analizi
  register('files:scan', (_event, options: Parameters<typeof fileScanService.scanFiles>[0]) =>
    fileScanService.scanFiles(options));
  register('files:delete', (_event, paths: string[], references: string[], mode: 'recycle' | 'permanent') =>
    fileScanService.deleteScannedFiles(paths, references, mode));
  register('analysis:scan', (_event, root: string) => diskAnalysisService.analyzeDisk(root));

  // Sistem onarımı, gelişmiş başlangıç ve gizlilik
  register('repair:backup-folder', () => repairService.backupFolder());
  register('repair:run', (_event, kind: Parameters<typeof repairService.runRepair>[0]) =>
    repairService.runRepair(kind, logger('onarım')));
  register('autoruns:scan', () => autorunsService.scanAutoruns(logger('başlangıç')));
  register('autoruns:set', (_event, item: Parameters<typeof autorunsService.setAutorun>[0], enabled: boolean) =>
    autorunsService.setAutorun(item, enabled, logger('başlangıç')));
  register('privacy:list', () => privacyService.listPrivacy());
  register('privacy:set', (_event, tweak: Parameters<typeof privacyService.setPrivacy>[0], apply: boolean) =>
    privacyService.setPrivacy(tweak, apply, logger('gizlilik')));

  // Sistem ayarları, optimizasyon profilleri ve DNS
  register('tweaks:list', () => tweaksService.listTweaks());
  register('tweaks:set', (_event, id: string, apply: boolean) =>
    tweaksService.setTweak(id, apply, logger('sistem ayarı')));
  register('tweaks:backup-folder', () => tweaksService.tweakBackupFolder());
  register('profile:list', () => tweaksService.profileList());
  register('profile:apply', (_event, id: Parameters<typeof tweaksService.applyProfile>[0], apply: boolean) =>
    tweaksService.applyProfile(id, apply, logger('optimizasyon profili')));
  register('dns:providers', () => dnsService.dnsProviders());
  register('dns:current', () => dnsService.dnsCurrent());
  register('dns:benchmark', () => dnsService.dnsBenchmark(logger('dns ölçümü')));
  register('dns:switch', (_event, id: Parameters<typeof dnsService.dnsSwitch>[0]) =>
    dnsService.dnsSwitch(id, logger('dns değiştirme')));
  register('dns:reset', () => dnsService.dnsReset(logger('dns sıfırlama')));
}

// Tek örnek: ikinci başlatma mevcut pencereyi öne getirip kapanır.
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on('second-instance', () => showMainWindow());

  app.whenReady().then(() => {
    app.setName('Pars Sistem Yöneticisi');
    migrateLegacyData();
    try {
      app.setPath('userData', path.join(app.getPath('appData'), 'pars-sistem-yoneticisi-ts'));
    } catch {
      // Varsayılan yol zaten paket adından gelir.
    }
    applyLocale();
    registerIpc();
    void applyStartupSettings();
    setupTray();
    createWindow();
    nativeTheme.on('updated', () => {
      if (settingsService.getSettings().theme === 'auto') mainWindow?.setBackgroundColor(themeBackground('auto'));
    });
    stopScheduler = schedulerService.startScheduler(logger('zamanlama'));

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else showMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'win32') app.quit();
  });

  app.on('before-quit', () => {
    forceClose = true;
    stopScheduler?.();
    tray?.destroy();
    tray = null;
  });
}
