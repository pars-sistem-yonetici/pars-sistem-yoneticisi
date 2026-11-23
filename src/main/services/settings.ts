import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { DEFAULT_UPDATE_SOURCE } from '../../shared/constants';
import type { Settings } from '../../shared/types';

const DEFAULTS: Settings = {
  language: 'tr',
  theme: 'default',
  wingetVersion: '',
  wingetAvailable: false,
  autoUpdateScan: true,
  autoLeftoverScan: true,
  silentInstall: true,
  drive: 'C:\\',
  startWithWindows: true,
  startMinimizedToTray: true,
  closeBehavior: 'ask',
  updateSource: DEFAULT_UPDATE_SOURCE,
  updateCheckOnStartup: true,
  excludedFolders: [],
  excludedExtensions: [],
};

let cache: Settings | null = null;

function file(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

export function getSettings(): Settings {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(fs.readFileSync(file(), 'utf8')) as Partial<Settings>;
    cache = { ...DEFAULTS, ...parsed };
    cache.updateSource = typeof parsed.updateSource === 'string' && parsed.updateSource.trim()
      ? parsed.updateSource.trim()
      : DEFAULT_UPDATE_SOURCE;
    cache.closeBehavior = ['ask', 'tray', 'quit'].includes(String(parsed.closeBehavior))
      ? parsed.closeBehavior as Settings['closeBehavior']
      : 'ask';
    cache.updateCheckOnStartup = parsed.updateCheckOnStartup !== false;
    cache.excludedFolders = Array.isArray(parsed.excludedFolders) ? parsed.excludedFolders.filter((item) => typeof item === 'string') : [];
    cache.excludedExtensions = Array.isArray(parsed.excludedExtensions) ? parsed.excludedExtensions.filter((item) => typeof item === 'string') : [];
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

export function setSettings(patch: Partial<Settings>): Settings {
  cache = { ...getSettings(), ...patch };
  if (patch.updateSource !== undefined) {
    cache.updateSource = typeof patch.updateSource === 'string' && patch.updateSource.trim()
      ? patch.updateSource.trim()
      : DEFAULT_UPDATE_SOURCE;
  }
  if (patch.closeBehavior !== undefined) {
    cache.closeBehavior = ['ask', 'tray', 'quit'].includes(String(patch.closeBehavior))
      ? patch.closeBehavior as Settings['closeBehavior']
      : 'ask';
  }
  if (patch.updateCheckOnStartup !== undefined) cache.updateCheckOnStartup = patch.updateCheckOnStartup !== false;
  if (patch.excludedFolders !== undefined) cache.excludedFolders = Array.isArray(patch.excludedFolders) ? patch.excludedFolders.filter((item) => typeof item === 'string') : [];
  if (patch.excludedExtensions !== undefined) cache.excludedExtensions = Array.isArray(patch.excludedExtensions) ? patch.excludedExtensions.filter((item) => typeof item === 'string') : [];
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.writeFileSync(file(), JSON.stringify(cache, null, 2), 'utf8');
  } catch {
    // Ayarlar bellekte tutulmaya devam eder.
  }
  return cache;
}
