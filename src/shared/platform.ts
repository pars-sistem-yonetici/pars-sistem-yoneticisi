import { MALWARE_ENGINE_IDS, TAB_IDS } from './types';
import type { MalwareEngine, PackageSource, PlatformCapabilities, PlatformKind, TabId } from './types';

/**
 * Platform algılama tek merkezde tutulur. Ana süreçte `process.platform`,
 * renderer'da Electron kullanıcı aracısı kullanılır; ikisi de yoksa Windows
 * varsayılır ve mevcut davranış korunur.
 */
type GlobalHints = {
  process?: { platform?: string };
  navigator?: { platform?: string; userAgent?: string; userAgentData?: { platform?: string } };
};

/** POSIX denetimi yalnızca macOS/Linux için; Windows listesinde yer almaz. */
const WINDOWS_TABS: readonly TabId[] = TAB_IDS.filter((id): id is TabId => id !== 'posixaudit');

/**
 * 1.5 macOS kapsamı: salt-okunur çekirdek. Kayıt defteri, UAC, kabuk, hizmet,
 * güvenlik duvarı, sürücü ve planlanmış görev sekmeleri POSIX'te açılmaz.
 */
const POSIX_TABS: readonly TabId[] = [
  'home', 'updates', 'malware', 'duplicates', 'analysis', 'recommended', 'search', 'settings', 'debugging', 'posixaudit',
];

const WINDOWS_SOURCES: readonly PackageSource[] = ['winget', 'choco', 'npm', 'scoop'];
const MACOS_SOURCES: readonly PackageSource[] = ['brew', 'npm'];
const LINUX_SOURCES: readonly PackageSource[] = ['npm', 'apt', 'dnf', 'pacman', 'flatpak', 'snap'];

const POSIX_ENGINES: readonly MalwareEngine[] = MALWARE_ENGINE_IDS.filter(
  (id): id is MalwareEngine => id !== 'defender',
);

export function detectPlatform(override?: string): PlatformKind {
  const hints = globalThis as unknown as GlobalHints;
  const value = [override, hints.process?.platform, hints.navigator?.userAgentData?.platform,
    hints.navigator?.platform, hints.navigator?.userAgent]
    .filter((item): item is string => typeof item === 'string' && item.length > 0)
    .join(' ')
    .toLowerCase();

  if (/\bdarwin\b|\bmacos\b|\bmac os\b|\bmacintel\b|\bmacintosh\b/.test(value)) return 'macos';
  if (/\blinux\b|\bx11\b|\bunix\b/.test(value)) return 'linux';
  if (/\bwin32\b|\bwindows\b|\bwin64\b/.test(value)) return 'windows';
  // Bilinmeyen ortamda mevcut Windows davranışını bozmayacak şekilde güvenli varsayım.
  return 'windows';
}

export const PLATFORM: PlatformKind = detectPlatform();

export function isWindows(platform: PlatformKind = PLATFORM): boolean {
  return platform === 'windows';
}

export function getCapabilities(platform: PlatformKind = PLATFORM): PlatformCapabilities {
  switch (platform) {
    case 'macos':
      return {
        kind: 'macos',
        label: 'macOS',
        experimental: true,
        tabs: POSIX_TABS,
        packageSources: MACOS_SOURCES,
        malwareEngines: POSIX_ENGINES,
        allowWriteActions: false,
        allowSelfUpdate: false,
      };
    case 'linux':
      return {
        kind: 'linux',
        label: 'Linux',
        experimental: true,
        tabs: POSIX_TABS,
        packageSources: LINUX_SOURCES,
        malwareEngines: POSIX_ENGINES,
        allowWriteActions: false,
        allowSelfUpdate: false,
      };
    case 'windows':
    default:
      return {
        kind: 'windows',
        label: 'Windows',
        experimental: false,
        tabs: WINDOWS_TABS,
        packageSources: WINDOWS_SOURCES,
        malwareEngines: MALWARE_ENGINE_IDS,
        allowWriteActions: true,
        allowSelfUpdate: true,
      };
  }
}

export const CAPABILITIES: PlatformCapabilities = getCapabilities();

export function supportsTab(id: TabId, platform: PlatformKind = PLATFORM): boolean {
  return getCapabilities(platform).tabs.includes(id);
}

export function defaultDrive(platform: PlatformKind = PLATFORM): string {
  return platform === 'windows' ? 'C:\\' : '/';
}
