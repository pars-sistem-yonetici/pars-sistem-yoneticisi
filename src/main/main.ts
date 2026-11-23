import { app, BrowserWindow, dialog, ipcMain, Menu, shell, Tray } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { CleanTarget, DownloadResult, LogEntry, MalwareEngine, Package, RegIssue, ScheduleTask, WindowAction } from '../shared/types';
import * as appsService from './services/apps';
import * as contextMenuService from './services/contextMenu';
import * as diskService from './services/disk';
import * as firewallService from './services/firewall';
import * as driversService from './services/drivers';
import * as localeService from './services/locales';
import * as loginItemService from './services/loginItem';
import * as managedPolicyService from './services/managedPolicy';
import * as prereqService from './services/prereqs';
import * as leftoversService from './services/leftovers';
import * as malwareService from './services/malware';
import * as registryService from './services/registry';
import * as schedulerService from './services/scheduler';
import * as settingsService from './services/settings';
import * as startupService from './services/startup';
import * as systemService from './services/system';
import * as updaterService from './services/updater';
import * as winget from './services/winget';
import {
  arr, bool, ident, IpcValidationError, isInside, leftover, oneOf, regIssue,
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

function setupTray(): void {
  if (tray) return;
  try {
    tray = new Tray(path.join(__dirname, '..', '..', 'dist', 'icon.ico'));
    tray.setToolTip('Pars Sistem Yöneticisi');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Pencereyi göster', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
      { type: 'separator' },
      { label: 'Çıkış', click: () => app.exit(0) },
    ]));
    tray.on('click', () => { mainWindow?.show(); mainWindow?.focus(); });
  } catch {
    tray = null;
  }
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
    backgroundColor: settingsService.getSettings().theme === 'windows11' ? '#f3f3f3' : '#171719',
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

function deniedRoots(resolved: string): string[] {
  return [
    path.win32.parse(resolved).root,
    process.env.SystemRoot || 'C:\\Windows',
    process.env.ProgramFiles || 'C:\\Program Files',
    process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
  ].map(canonical);
}

/** Yalnızca uygulamanın kullandığı klasörler ve kullanıcının seçtiği klasörler açılabilir. */
const openPath: Validator = (value, field) => {
  const input = str({ max: 4096 })(value, field) as string;
  const resolved = canonical(input);
  if (deniedRoots(resolved).some((root) => isInside(resolved, root))) reject(field, 'sistem klasörü açılamaz');
  if (!allowedOpenRoots().some((root) => isInside(resolved, root))) reject(field, 'izin verilmeyen yol');
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
  'apps:leftovers': [str({ max: 256 }), str({ max: 128 })],
  'apps:delete-leftovers': [arr(leftover, 500), oneOf(['recycle', 'permanent'] as const)],
  'disk:clean': [arr(str({ max: 128 }), 100)],
  'registry:delete': [arr(regIssue, 1000)],
  'startup:set': [startupItem, bool],
  'firewall:set': [str({ max: 512 }), bool],
  'firewall:delete': [str({ max: 512 })],
  'malware:scan': [arr(oneOf(['signatures', 'heuristics', 'scripts', 'integrity', 'persistence'] as const), 5)],
  'schedule:save': [arr(scheduleTask, 100)],
  'schedule:run': [scheduleTask],
  'drivers:download': [arr(str({ max: 256 }), 500)],
  'drivers:install': [arr(str({ max: 256 }), 500), bool],
  'locale:dictionary': [str({ max: 64 })],
  'prereq:install': [oneOf(['winget', 'powershell', 'vcredist'] as const)],
  'contextMenu:set': [oneOf(['windows10', 'windows11'] as const)],
  'managedPolicy:save': [oneOf(['windows', 'browsers'] as const)],
  'managedPolicy:apply': [oneOf(['windows', 'browsers'] as const)],
  'update:download': [updateInfo],
  'update:install': [updateInstallPath],
  'settings:set': [settingsPatch],
  'shell:open-path': [openPath],
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

  register('winget:version', async () => {
    const result = await winget.version();
    settingsService.setSettings({ wingetAvailable: result.available, wingetVersion: result.version });
    return result;
  });
  register('winget:source-update', () => winget.updateSources(logger('winget')));
  register('winget:list', () => winget.listPackages(logger('winget')));
  register('winget:updates', () => winget.listUpdates(logger('winget')));
  register('winget:search', (_event, query: string) => winget.search(query, logger('winget')));
  register('winget:install', (_event, ident: string, silent: boolean) => winget.install(ident, silent, logger('kurulum')));
  register('winget:upgrade', (_event, pkg: Package, silent: boolean) => winget.upgrade(pkg, silent, logger('güncelleme')));
  register('winget:upgrade-all', (_event, silent: boolean) => winget.upgradeAll(silent, logger('güncelleme')));
  register('winget:uninstall', (_event, pkg: Package, silent: boolean) => winget.uninstall(pkg, silent, logger('kaldırma')));
  register('winget:download', async (_event, ident: string): Promise<DownloadResult> => winget.download(ident, logger('indirme')));

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
  register('apps:delete-leftovers', (_event, items: Parameters<typeof leftoversService.deleteLeftovers>[0], mode: 'recycle' | 'permanent') =>
    leftoversService.deleteLeftovers(items, mode));

  register('disk:targets', () => diskService.targets());
  register('disk:scan', () => diskService.scan(diskService.targets(), logger('disk')));
  register('disk:clean', (_event, keys: string[]) => {
    const selected = new Set(keys);
    const items = diskService.targets().filter((item: CleanTarget) => selected.has(item.key));
    return diskService.clean(items, logger('disk'));
  });

  register('registry:scan', () => registryService.scanRegistry());
  register('registry:delete', (_event, issues: RegIssue[]) => registryService.deleteRegistryIssues(issues));
  register('registry:backup-path', () => {
    const folder = registryService.backupFolder();
    try { fs.mkdirSync(folder, { recursive: true }); } catch { /* klasör silme sırasında oluşturulur */ }
    return folder;
  });

  register('startup:list', () => startupService.scanStartup());
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
  register('contextMenu:status', () => contextMenuService.contextMenuStatus());
  register('contextMenu:set', (_event, style: Parameters<typeof contextMenuService.setContextMenuStyle>[0]) =>
    contextMenuService.setContextMenuStyle(style, logger('sağ tık menüsü')));
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

  register('settings:get', () => settingsService.getSettings());
  register('settings:set', (_event, patch: Parameters<typeof settingsService.setSettings>[0]) => {
    const next = settingsService.setSettings(patch);
    if (patch.theme) mainWindow?.setBackgroundColor(next.theme === 'windows11' ? '#f3f3f3' : '#171719');
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
}

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
  stopScheduler = schedulerService.startScheduler(logger('zamanlama'));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow?.show();
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
