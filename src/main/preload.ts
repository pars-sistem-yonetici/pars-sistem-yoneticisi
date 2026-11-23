import { contextBridge, ipcRenderer } from 'electron';
import type { AppApi, LogEntry, UpdateProgress } from '../shared/types';

const api: AppApi = {
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
  wingetVersion: () => ipcRenderer.invoke('winget:version'),
  wingetSourceUpdate: () => ipcRenderer.invoke('winget:source-update'),
  wingetList: () => ipcRenderer.invoke('winget:list'),
  wingetUpdates: () => ipcRenderer.invoke('winget:updates'),
  wingetSearch: (query) => ipcRenderer.invoke('winget:search', query),
  wingetInstall: (ident, silent) => ipcRenderer.invoke('winget:install', ident, silent),
  wingetUpgrade: (pkg, silent) => ipcRenderer.invoke('winget:upgrade', pkg, silent),
  wingetUpgradeAll: (silent) => ipcRenderer.invoke('winget:upgrade-all', silent),
  wingetUninstall: (pkg, silent) => ipcRenderer.invoke('winget:uninstall', pkg, silent),
  wingetDownload: (ident) => ipcRenderer.invoke('winget:download', ident),
  installedApps: () => ipcRenderer.invoke('apps:installed'),
  scanLeftovers: (name, ident) => ipcRenderer.invoke('apps:leftovers', name, ident),
  deleteLeftovers: (items, mode) => ipcRenderer.invoke('apps:delete-leftovers', items, mode),
  diskTargets: () => ipcRenderer.invoke('disk:targets'),
  diskScan: () => ipcRenderer.invoke('disk:scan'),
  diskClean: (keys) => ipcRenderer.invoke('disk:clean', keys),
  registryScan: () => ipcRenderer.invoke('registry:scan'),
  registryDelete: (issues) => ipcRenderer.invoke('registry:delete', issues),
  registryBackupPath: () => ipcRenderer.invoke('registry:backup-path'),
  startupList: () => ipcRenderer.invoke('startup:list'),
  startupSet: (item, enabled) => ipcRenderer.invoke('startup:set', item, enabled),
  firewallScan: () => ipcRenderer.invoke('firewall:scan'),
  firewallSet: (id, enabled) => ipcRenderer.invoke('firewall:set', id, enabled),
  firewallDelete: (id) => ipcRenderer.invoke('firewall:delete', id),
  firewallBackupPath: () => ipcRenderer.invoke('firewall:backup-path'),
  malwareScan: (engines) => ipcRenderer.invoke('malware:scan', engines),
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
  contextMenuStatus: () => ipcRenderer.invoke('contextMenu:status'),
  contextMenuSet: (style) => ipcRenderer.invoke('contextMenu:set', style),
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
};

contextBridge.exposeInMainWorld('api', api);
