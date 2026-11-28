import { getCapabilities } from '../../shared/platform';
import type { InstallItem, InstallProgress, InstallResult, Package, PackageManagerStatus, PackageSource } from '../../shared/types';
import { m, mf } from '../i18n-main';
import { LogFn, runCommand } from '../util';
import * as brew from './brew';
import * as linux from './linux-packages';
import { probeManager } from './prereqs';
import * as winget from './winget';

export type InstallProgressFn = (progress: InstallProgress) => void;

/**
 * Kaynak başına kimlik biçimi. Komut satırına yalnızca bu kalıptan geçen
 * değerler gider; seçenek/enjeksiyon karakterleri kabul edilmez.
 */
const IDENT_PATTERNS: Record<PackageSource, RegExp> = {
  winget: /^[A-Za-z0-9][A-Za-z0-9._+-]*\.[A-Za-z0-9][A-Za-z0-9._+-]*$/,
  choco: /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
  npm: /^(?:@[A-Za-z0-9][A-Za-z0-9._-]*\/)?[A-Za-z0-9][A-Za-z0-9._-]*$/,
  scoop: /^(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)?[A-Za-z0-9][A-Za-z0-9._-]*$/,
  brew: /^[A-Za-z0-9][A-Za-z0-9@+._/-]*$/,
  apt: /^[A-Za-z0-9][A-Za-z0-9+._-]*$/,
  dnf: /^[A-Za-z0-9][A-Za-z0-9+._-]*$/,
  pacman: /^[A-Za-z0-9][A-Za-z0-9@+._-]*$/,
  flatpak: /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
  snap: /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
};

const LABELS: Record<PackageSource, string> = {
  winget: 'winget', choco: 'Chocolatey', npm: 'npm', scoop: 'Scoop', brew: 'Homebrew',
  apt: 'APT', dnf: 'DNF', pacman: 'Pacman', flatpak: 'Flatpak', snap: 'Snap',
};

/** Kaynağa göre paket kimliğini doğrular; komut satırına yalnızca geçerli değer gider. */
export function requireIdent(source: PackageSource, ident: string): string {
  if (!(source in IDENT_PATTERNS)) {
    throw new Error(mf('Desteklenmeyen paket kaynağı: {source}', 'Unsupported package source: {source}', { source }));
  }
  const value = String(ident || '').trim();
  const pattern = IDENT_PATTERNS[source];
  if (value.length < 1 || value.length > 128 || !pattern.test(value)) {
    throw new Error(mf('{label}: geçersiz paket kimliği.', '{label}: invalid package identifier.', { label: LABELS[source] }));
  }
  return value;
}

export function requireInstallItem(item: InstallItem): InstallItem {
  const source = item.source || 'winget';
  const ident = requireIdent(source, String(item.ident || ''));
  const name = String(item.name || '').trim();
  if (name.length < 1 || name.length > 256 || /[\r\n]/.test(name)) {
    throw new Error(m('Geçersiz uygulama adı.', 'Invalid application name.'));
  }
  return { name, ident, source };
}

/** winget/choco/npm/scoop çıktısından yüzde ve indirme hızı çıkarır. */
export function parseProgress(line: string): { percent: number; speed: string } {
  const percentMatch = line.match(/(\d{1,3})\s*%/);
  const speedMatch = line.match(/(\d+(?:[.,]\d+)?)\s*(B|KB|MB|GB|TB)\s*\/\s*s\b/i);
  let percent = 0;
  if (percentMatch) {
    const value = Number(percentMatch[1]);
    if (Number.isFinite(value)) percent = Math.max(0, Math.min(100, value));
  }
  const speed = speedMatch ? `${speedMatch[1].replace(',', '.')} ${speedMatch[2].toUpperCase()}/s` : '';
  return { percent, speed };
}

/** Yüzde yoksa aşama metninden makul bir ilerleme tahmini üretir. */
function phasePercent(line: string, current: number): number {
  const text = line.toLowerCase();
  if (/download|indiriliyor|downloading|fetch/.test(text)) return Math.max(current, 15);
  if (/install|kuruluyor|installing|unpack|extract|extracting/.test(text)) return Math.max(current, 55);
  if (/configur|ayarlan|post-install/.test(text)) return Math.max(current, 80);
  if (/complete|successful|tamamland|installed/.test(text)) return 100;
  return current;
}

function commandFor(source: PackageSource, ident: string, silent: boolean): { command: string; args: string[] } {
  switch (source) {
    case 'winget':
      return {
        command: 'winget',
        args: [
          'install', '--id', ident, '--exact',
          '--accept-source-agreements', '--accept-package-agreements',
          '--disable-interactivity', '--nowarn',
          ...(silent ? ['--silent'] : []),
        ],
      };
    case 'choco':
      return {
        command: 'choco',
        args: ['install', ident, '-y', '--no-progress', '--limit-output', ...(silent ? ['--quiet'] : [])],
      };
    case 'npm':
      return {
        command: getCapabilities().kind === 'windows' ? 'npm.cmd' : 'npm',
        args: ['install', '-g', ident, '--no-audit', '--no-fund', '--progress=true', ...(silent ? ['--silent'] : [])],
      };
    case 'scoop':
      return { command: 'scoop.cmd', args: ['install', ident] };
    case 'brew':
      return { command: 'brew', args: ['install', ident] };
    default:
      // Linux paket kaynakları salt okunurdur; yazma komutu üretilmez.
      throw new Error(mf('{label}: yazma işlemleri bu platformda devre dışı.', '{label}: write actions are disabled on this platform.', { label: LABELS[source] }));
  }
}

async function installOne(item: InstallItem, silent: boolean, onLine?: LogFn): Promise<number> {
  const safe = requireInstallItem(item);
  if (safe.source === 'winget') return winget.install(safe.ident, silent, onLine);
  const { command, args } = commandFor(safe.source, safe.ident, silent);
  try {
    const result = await runCommand(command, args, onLine, 20 * 60 * 1000);
    return result.code;
  } catch (error) {
    throw new Error(mf('{label} başlatılamadı: {message}', 'Could not start {label}: {message}', {
      label: LABELS[safe.source], message: (error as Error).message,
    }));
  }
}

/** Paket yöneticilerinin kurulu olup olmadığını ve sürümlerini döner. */
export async function managerStatus(): Promise<PackageManagerStatus[]> {
  const sources = getCapabilities().packageSources;
  const probes: Record<PackageSource, () => Promise<{ available: boolean; version: string }>> = {
    winget: () => winget.version().catch(() => ({ available: false, version: '' })),
    choco: () => probeManager('choco'),
    npm: () => probeManager('npm'),
    scoop: () => probeManager('scoop'),
    brew: () => brew.status(),
    apt: () => linux.status('apt'),
    dnf: () => linux.status('dnf'),
    pacman: () => linux.status('pacman'),
    flatpak: () => linux.status('flatpak'),
    snap: () => linux.status('snap'),
  };
  const rows = await Promise.all(sources.map(async (source) => ({
    source,
    ...await probes[source]().catch(() => ({ available: false, version: '' })),
  })));
  return rows.map((row) => ({
    source: row.source,
    label: LABELS[row.source],
    available: row.available,
    version: (row.version || '').slice(0, 80),
  }));
}

/** Salt-okunur Linux köprüsü: sürüm sorgusu, yazma işlemi içermez. */
export function linuxVersion(sources: readonly PackageSource[]): ReturnType<typeof linux.statusFirstAvailable> {
  return linux.statusFirstAvailable(sources);
}

/** Salt-okunur Linux köprüsü: arama sorgusu, yazma işlemi içermez. */
export function linuxSearch(
  sources: readonly PackageSource[],
  query: string,
  onLine?: LogFn,
): ReturnType<typeof linux.searchAcross> {
  return linux.searchAcross(sources, query, onLine);
}

interface QueueTask {
  name: string;
  ident: string;
  source: PackageSource;
  run: (onLine: LogFn) => Promise<number>;
  doneText: string;
}

/**
 * Paralel işlem yerine tek sıra: bir öğe bitmeden sonrakine geçilmez.
 * İlerleme olayları ana süreçten renderer'a iletilir; iptal bayrağı her adımda
 * ve her çıktı satırında kontrol edilir.
 */
async function runQueue(
  tasks: QueueTask[],
  requestId: string,
  onProgress: InstallProgressFn,
  cancelled: () => boolean,
): Promise<InstallResult[]> {
  const results: InstallResult[] = [];
  const total = tasks.length;
  let lastEmit = 0;

  for (let index = 0; index < total; index += 1) {
    if (cancelled()) break;
    const task = tasks[index];
    let percent = 0;
    let speed = '';
    const emit = (phase: InstallProgress['phase'], line = '', ok?: boolean) => {
      onProgress({
        requestId, index, total, name: task.name, source: task.source,
        percent: phase === 'done' ? 100 : percent,
        speed: phase === 'done' ? '' : speed,
        line: line.slice(0, 200), phase, ok,
      });
    };
    emit('start', `${LABELS[task.source]}: ${task.ident}`);

    const onLine: LogFn = (line) => {
      if (cancelled()) return;
      const parsed = parseProgress(line);
      if (parsed.percent > percent) percent = parsed.percent;
      if (parsed.speed) speed = parsed.speed;
      percent = Math.max(percent, phasePercent(line, percent));
      const now = Date.now();
      if (now - lastEmit > 120 || parsed.percent || parsed.speed) {
        lastEmit = now;
        emit('progress', line);
      }
    };

    try {
      const code = await task.run(onLine);
      const ok = code === 0;
      percent = 100;
      const message = ok ? task.doneText : mf('Çıkış kodu {code}', 'Exit code {code}', { code });
      emit('done', message, ok);
      results.push({
        name: task.name, ident: task.ident, source: task.source,
        ok, code, message,
      });
    } catch (error) {
      const message = (error as Error).message.slice(0, 250);
      emit('done', message, false);
      results.push({ name: task.name, ident: task.ident, source: task.source, ok: false, code: -1, message });
    }
  }
  return results;
}

export async function installQueue(
  items: InstallItem[],
  silent: boolean,
  requestId: string,
  onProgress: InstallProgressFn,
  cancelled: () => boolean,
): Promise<InstallResult[]> {
  // Hiçbir kurulum başlamadan tüm kimlikleri doğrula.
  const safe = items.map(requireInstallItem);
  return runQueue(safe.map((item) => ({
    name: item.name,
    ident: item.ident,
    source: item.source,
    run: (onLine) => installOne(item, silent, onLine),
    doneText: m('Kurulum tamamlandı.', 'Installation completed.'),
  })), requestId, onProgress, cancelled);
}

function requireUpgradeItem(pkg: Package): Package {
  const source: PackageSource = (pkg?.source || 'winget') as PackageSource;
  if (!(source in IDENT_PATTERNS)) {
    throw new Error(mf('Desteklenmeyen güncelleme kaynağı: {source}', 'Unsupported update source: {source}', { source }));
  }
  const name = String(pkg?.name || '').trim();
  if (name.length < 1 || name.length > 512 || /^[-/]/.test(name) || /[\r\n]/.test(name)) {
    throw new Error(m('Geçersiz güncelleme paketi adı.', 'Invalid update package name.'));
  }
  const ident = requireIdent(source, String(pkg?.ident || ''));
  return {
    name, ident,
    version: String(pkg.version || '').slice(0, 80),
    available: String(pkg.available || '').slice(0, 80),
    source,
  };
}

/** Kaynağa göre güncelleme komutu; kimlik yukarıda doğrulanır. */
function upgradeOne(pkg: Package, silent: boolean, onLine?: LogFn): Promise<number> {
  if (pkg.source === 'winget') return winget.upgrade(pkg, silent, onLine);
  const ident = requireIdent(pkg.source as PackageSource, pkg.ident);
  let command: string;
  let args: string[];
  switch (pkg.source) {
    case 'choco':
      command = 'choco';
      args = ['upgrade', ident, '-y', '--no-progress', '--limit-output', ...(silent ? ['--quiet'] : [])];
      break;
    case 'npm':
      command = getCapabilities().kind === 'windows' ? 'npm.cmd' : 'npm';
      args = ['update', '-g', ident, '--no-audit', '--no-fund', ...(silent ? ['--silent'] : [])];
      break;
    case 'scoop':
      command = 'scoop.cmd';
      args = ['update', ident];
      break;
    case 'brew':
      command = 'brew';
      args = ['upgrade', ident];
      break;
    default:
      throw new Error(mf('Desteklenmeyen güncelleme kaynağı: {source}', 'Unsupported update source: {source}', { source: pkg.source }));
  }
  return runCommand(command, args, onLine, 20 * 60 * 1000)
    .then((result) => result.code)
    .catch((error) => {
      throw new Error(mf('{label} güncellemesi başlatılamadı: {message}', 'Could not start the {label} update: {message}', {
        label: LABELS[pkg.source as PackageSource], message: (error as Error).message,
      }));
    });
}

/** Seçilen güncellemeler kaynaklarına göre sırayla uygulanır; her adım canlı ilerleme bildirir. */
export async function upgradeQueue(
  items: Package[],
  silent: boolean,
  requestId: string,
  onProgress: InstallProgressFn,
  cancelled: () => boolean,
): Promise<InstallResult[]> {
  const safe = items.map(requireUpgradeItem);
  return runQueue(safe.map((pkg) => ({
    name: pkg.name,
    ident: pkg.ident,
    source: pkg.source as PackageSource,
    run: (onLine) => upgradeOne(pkg, silent, onLine),
    doneText: m('Güncelleme tamamlandı.', 'Update completed.'),
  })), requestId, onProgress, cancelled);
}
