export interface Package {
  name: string;
  ident: string;
  version: string;
  available: string;
  source: string;
}

export interface InstalledApp {
  name: string;
  ident: string;
  version: string;
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

export interface RegStats {
  scanned: number;
  protected: number;
  system: number;
  broken: number;
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

export interface Leftover {
  path: string;
  kind: 'file' | 'folder' | 'registry';
  size: number;
  reason: string;
}

export interface DeleteResult {
  path: string;
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
export type Theme = 'default' | 'windows11';
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

export interface Settings {
  language: Language;
  theme: Theme;
  wingetVersion: string;
  wingetAvailable: boolean;
  autoUpdateScan: boolean;
  autoLeftoverScan: boolean;
  silentInstall: boolean;
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

export type MalwareEngine = 'signatures' | 'heuristics' | 'scripts' | 'integrity' | 'persistence';
export type MalwareSeverity = 'critical' | 'medium' | 'low' | 'info';

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
  scanned: Record<MalwareEngine, number>;
  durationMs: number;
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

export type PrerequisiteId = 'winget' | 'powershell' | 'vcredist';

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

export interface AppApi {
  onLog: (callback: (entry: LogEntry) => void) => () => void;
  onMaximizedChange: (callback: (maximized: boolean) => void) => () => void;
  windowAction: (action: WindowAction) => Promise<void>;
  isMaximized: () => Promise<boolean>;
  systemSnapshot: (drive?: string) => Promise<SystemSnapshot>;
  systemDrives: () => Promise<string[]>;
  wingetVersion: () => Promise<{ available: boolean; version: string }>;
  wingetSourceUpdate: () => Promise<number>;
  wingetList: () => Promise<Package[]>;
  wingetUpdates: () => Promise<Package[]>;
  wingetSearch: (query: string) => Promise<Package[]>;
  wingetInstall: (ident: string, silent: boolean) => Promise<number>;
  wingetUpgrade: (pkg: Package, silent: boolean) => Promise<number>;
  wingetUpgradeAll: (silent: boolean) => Promise<number>;
  wingetUninstall: (pkg: Package, silent: boolean) => Promise<number>;
  wingetDownload: (ident: string) => Promise<DownloadResult>;
  installedApps: () => Promise<InstalledApp[]>;
  scanLeftovers: (name: string, ident: string) => Promise<Leftover[]>;
  deleteLeftovers: (items: Leftover[], mode: 'recycle' | 'permanent') => Promise<DeleteResult[]>;
  diskTargets: () => Promise<CleanTarget[]>;
  diskScan: () => Promise<CleanTarget[]>;
  diskClean: (keys: string[]) => Promise<CleanResult[]>;
  registryScan: () => Promise<RegScanResult>;
  registryDelete: (issues: RegIssue[]) => Promise<RegResult[]>;
  registryBackupPath: () => Promise<string>;
  startupList: () => Promise<StartupItem[]>;
  startupSet: (item: StartupItem, enabled: boolean) => Promise<string>;
  firewallScan: () => Promise<FirewallRule[]>;
  firewallSet: (id: string, enabled: boolean) => Promise<string>;
  firewallDelete: (id: string) => Promise<string>;
  firewallBackupPath: () => Promise<string>;
  malwareScan: (engines: MalwareEngine[]) => Promise<MalwareScanResult>;
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
  contextMenuStatus: () => Promise<ContextMenuStatus>;
  contextMenuSet: (style: ContextMenuStyle) => Promise<ContextMenuActionResult>;
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
}

declare global {
  interface Window {
    api: AppApi;
  }
}
