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
