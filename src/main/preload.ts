import { contextBridge, ipcRenderer } from 'electron';
import { detectPlatform, getCapabilities } from '../shared/platform';
import type {
  AppApi, InstallItem, InstallProgress, InstallResult, LeftoverProgress, LogEntry, MalwareScanProgress, UpdateProgress,
} from '../shared/types';

const platform = detectPlatform(process.platform);
const capabilities = getCapabilities(platform);

const api: AppApi = {
  platform: () => platform,
  capabilities: () => capabilities,
  onLog: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, entry: LogEntry) => callback(entry);
    ipcRenderer.on('log', listener);
    return () => ipcRenderer.removeListener('log', listener);
  },
  onMaximizedChange: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, maximized: boolean) => callback(maximized);
    ipcRenderer.on('window:maximized', listener);
    return () => ipcRenderer.removeListener('window:maximized', listener);
  },
  windowAction: (action) => ipcRenderer.invoke('window:action', action),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  systemSnapshot: (drive) => ipcRenderer.invoke('system:snapshot', drive),
  systemDrives: () => ipcRenderer.invoke('system:drives'),
  systemDriveLabels: () => ipcRenderer.invoke('system:drive-labels'),
  posixAudit: () => ipcRenderer.invoke('posix:audit'),
  wingetVersion: () => ipcRenderer.invoke('winget:version'),
  wingetSourceUpdate: () => ipcRenderer.invoke('winget:source-update'),
  wingetList: () => ipcRenderer.invoke('winget:list'),
  wingetUpdates: () => ipcRenderer.invoke('winget:updates'),
  updateList: (source) => ipcRenderer.invoke('updates:list', source),
  wingetSearch: (query) => ipcRenderer.invoke('winget:search', query),
  wingetInstall: (ident, silent) => ipcRenderer.invoke('winget:install', ident, silent),
  wingetUpgrade: (pkg, silent) => ipcRenderer.invoke('winget:upgrade', pkg, silent),
  wingetUpgradeAll: (silent) => ipcRenderer.invoke('winget:upgrade-all', silent),
  wingetUninstall: (pkg, silent) => ipcRenderer.invoke('winget:uninstall', pkg, silent),
  wingetDownload: (ident) => ipcRenderer.invoke('winget:download', ident),
  packageManagerStatus: () => ipcRenderer.invoke('package-manager:status'),
  networkSpeed: () => ipcRenderer.invoke('network:speed'),
  installQueue: (items: InstallItem[], silent: boolean, requestId?: string): Promise<InstallResult[]> =>
    ipcRenderer.invoke('install:queue', items, silent, requestId),
  onInstallProgress: (callback: (progress: InstallProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: InstallProgress) => callback(progress);
    ipcRenderer.on('install:progress', listener);
    return () => ipcRenderer.removeListener('install:progress', listener);
  },
  installCancel: (requestId) => ipcRenderer.invoke('install:cancel', requestId),
  updateQueue: (items, silent, requestId) => ipcRenderer.invoke('update:queue', items, silent, requestId),
  onUpdateQueueProgress: (callback: (progress: InstallProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: InstallProgress) => callback(progress);
    ipcRenderer.on('update:queue-progress', listener);
    return () => ipcRenderer.removeListener('update:queue-progress', listener);
  },
  updateQueueCancel: (requestId) => ipcRenderer.invoke('update:queue-cancel', requestId),
  installedApps: () => ipcRenderer.invoke('apps:installed'),
  scanLeftovers: (name, ident) => ipcRenderer.invoke('apps:leftovers', name, ident),
  scanLeftoversBatch: (targets, requestId) => ipcRenderer.invoke('apps:leftovers-batch', targets, requestId),
  onLeftoverProgress: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: LeftoverProgress) => callback(progress);
    ipcRenderer.on('leftovers:progress', listener);
    return () => ipcRenderer.removeListener('leftovers:progress', listener);
  },
  cancelLeftovers: (requestId) => ipcRenderer.invoke('leftovers:cancel', requestId),
  deleteLeftovers: (items, mode) => ipcRenderer.invoke('apps:delete-leftovers', items, mode),
  bloatwareScan: () => ipcRenderer.invoke('bloatware:scan'),
  bloatwareRemove: (items) => ipcRenderer.invoke('bloatware:remove', items),
  diskTargets: () => ipcRenderer.invoke('disk:targets'),
  diskScan: () => ipcRenderer.invoke('disk:scan'),
  diskClean: (keys, recycleDrives) => ipcRenderer.invoke('disk:clean', keys, recycleDrives),
  diskCleanupLogPath: () => ipcRenderer.invoke('disk:log-path'),
  registryScan: (scopes) => ipcRenderer.invoke('registry:scan', scopes),
  registryDelete: (issues) => ipcRenderer.invoke('registry:delete', issues),
  registryBackupPath: () => ipcRenderer.invoke('registry:backup-path'),
  registryExportReport: (format) => ipcRenderer.invoke('registry:export', format),
  startupList: () => ipcRenderer.invoke('startup:list'),
  startupTimings: () => ipcRenderer.invoke('startup:timings'),
  startupSet: (item, enabled) => ipcRenderer.invoke('startup:set', item, enabled),
  firewallScan: () => ipcRenderer.invoke('firewall:scan'),
  firewallSet: (id, enabled) => ipcRenderer.invoke('firewall:set', id, enabled),
  firewallDelete: (id) => ipcRenderer.invoke('firewall:delete', id),
  firewallBackupPath: () => ipcRenderer.invoke('firewall:backup-path'),
  malwareScan: (engines, requestId) => ipcRenderer.invoke('malware:scan', engines, requestId),
  onMalwareProgress: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: MalwareScanProgress) => callback(progress);
    ipcRenderer.on('malware:progress', listener);
    return () => ipcRenderer.removeListener('malware:progress', listener);
  },
  cancelMalwareScan: (requestId) => ipcRenderer.invoke('malware:cancel', requestId),
  malwareExportReport: (content, format) => ipcRenderer.invoke('malware:export', content, format),
  malwareQuarantine: (targets) => ipcRenderer.invoke('malware:quarantine', targets),
  malwareQuarantineList: () => ipcRenderer.invoke('malware:quarantine-list'),
  malwareQuarantineRestore: (ids) => ipcRenderer.invoke('malware:quarantine-restore', ids),
  malwareQuarantineDelete: (ids) => ipcRenderer.invoke('malware:quarantine-delete', ids),
  malwareDeleteFiles: (targets) => ipcRenderer.invoke('malware:delete-files', targets),
  scheduleList: () => ipcRenderer.invoke('schedule:list'),
  scheduleSave: (tasks) => ipcRenderer.invoke('schedule:save', tasks),
  scheduleRun: (task) => ipcRenderer.invoke('schedule:run', task),
  driversScan: () => ipcRenderer.invoke('drivers:scan'),
  driversDownload: (ids) => ipcRenderer.invoke('drivers:download', ids),
  driversInstall: (ids, backup) => ipcRenderer.invoke('drivers:install', ids, backup),
  driversBackup: () => ipcRenderer.invoke('drivers:backup'),
  localeList: () => ipcRenderer.invoke('locale:list'),
  localeDictionary: (language) => ipcRenderer.invoke('locale:dictionary', language),
  localeFolder: () => ipcRenderer.invoke('locale:folder'),
  prereqScan: () => ipcRenderer.invoke('prereq:scan'),
  prereqInstall: (id) => ipcRenderer.invoke('prereq:install', id),
  prereqAutoInstall: () => ipcRenderer.invoke('prereq:auto-install'),
  contextMenuStatus: () => ipcRenderer.invoke('contextMenu:status'),
  contextMenuSet: (style) => ipcRenderer.invoke('contextMenu:set', style),
  shellExtensions: () => ipcRenderer.invoke('shell-ext:list'),
  shellExtensionSet: (id, enabled) => ipcRenderer.invoke('shell-ext:set', id, enabled),
  managedPolicyFiles: () => ipcRenderer.invoke('managedPolicy:files'),
  managedPolicySave: (id) => ipcRenderer.invoke('managedPolicy:save', id),
  managedPolicyApply: (id) => ipcRenderer.invoke('managedPolicy:apply', id),
  onCloseRequest: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('window:close-request', listener);
    return () => ipcRenderer.removeListener('window:close-request', listener);
  },
  onUpdateProgress: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: UpdateProgress) => callback(progress);
    ipcRenderer.on('update:progress', listener);
    return () => ipcRenderer.removeListener('update:progress', listener);
  },
  appUpdateCheck: () => ipcRenderer.invoke('update:check'),
  appUpdateDownload: (info) => ipcRenderer.invoke('update:download', info),
  appUpdateInstall: (filePath) => ipcRenderer.invoke('update:install', filePath),
  appUpdateFolder: () => ipcRenderer.invoke('update:folder'),
  pickFolders: () => ipcRenderer.invoke('dialog:pick-folders'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  openPath: (targetPath) => ipcRenderer.invoke('shell:open-path', targetPath),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  pickScanFolders: () => ipcRenderer.invoke('files:pick-folders'),
  packageBackupFolder: () => ipcRenderer.invoke('package:backup-folder'),
  packageBackupList: () => ipcRenderer.invoke('package:backup-list'),
  packageExport: () => ipcRenderer.invoke('package:export'),
  packageReadBackup: (filePath) => ipcRenderer.invoke('package:read-backup', filePath),
  packageImport: (filePath, idents) => ipcRenderer.invoke('package:import', filePath, idents),
  fileScan: (options) => ipcRenderer.invoke('files:scan', options),
  fileDelete: (paths, references, mode) => ipcRenderer.invoke('files:delete', paths, references, mode),
  diskAnalysis: (root) => ipcRenderer.invoke('analysis:scan', root),
  repairRun: (kind) => ipcRenderer.invoke('repair:run', kind),
  repairBackupFolder: () => ipcRenderer.invoke('repair:backup-folder'),
  autorunScan: () => ipcRenderer.invoke('autoruns:scan'),
  autorunSet: (item, enabled) => ipcRenderer.invoke('autoruns:set', item, enabled),
  tweaksList: () => ipcRenderer.invoke('tweaks:list'),
  tweaksSet: (id, apply) => ipcRenderer.invoke('tweaks:set', id, apply),
  tweaksBackupFolder: () => ipcRenderer.invoke('tweaks:backup-folder'),
  profileList: () => ipcRenderer.invoke('profile:list'),
  profileApply: (id, apply) => ipcRenderer.invoke('profile:apply', id, apply),
  dnsProviders: () => ipcRenderer.invoke('dns:providers'),
  dnsCurrent: () => ipcRenderer.invoke('dns:current'),
  dnsBenchmark: () => ipcRenderer.invoke('dns:benchmark'),
  dnsSwitch: (id) => ipcRenderer.invoke('dns:switch', id),
  dnsReset: () => ipcRenderer.invoke('dns:reset'),
  privacyList: () => ipcRenderer.invoke('privacy:list'),
  privacySet: (tweak, apply) => ipcRenderer.invoke('privacy:set', tweak, apply),
};

contextBridge.exposeInMainWorld('api', api);
