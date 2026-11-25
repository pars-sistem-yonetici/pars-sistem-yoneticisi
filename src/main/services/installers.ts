import type { InstallItem, InstallProgress, InstallResult, Package, PackageManagerStatus, PackageSource } from '../../shared/types';
import { LogFn, runCommand } from '../util';
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
};

const LABELS: Record<PackageSource, string> = {
  winget: 'winget', choco: 'Chocolatey', npm: 'npm', scoop: 'Scoop',
};

export function requireInstallItem(item: InstallItem): InstallItem {
  const source = item.source || 'winget';
  if (!(source in IDENT_PATTERNS)) throw new Error(`Desteklenmeyen paket kaynağı: ${source}`);
  const ident = String(item.ident || '').trim();
  const pattern = IDENT_PATTERNS[source];
  if (ident.length < 1 || ident.length > 128 || !pattern.test(ident)) {
    throw new Error(`${LABELS[source]}: geçersiz paket kimliği.`);
  }
  const name = String(item.name || '').trim();
  if (name.length < 1 || name.length > 256 || /[\r\n]/.test(name)) {
    throw new Error('Geçersiz uygulama adı.');
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
        command: 'npm.cmd',
        args: ['install', '-g', ident, '--no-audit', '--no-fund', '--progress=true', ...(silent ? ['--silent'] : [])],
      };
    case 'scoop':
      return { command: 'scoop.cmd', args: ['install', ident] };
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
    throw new Error(`${LABELS[safe.source]} başlatılamadı: ${(error as Error).message}`);
  }
}

/** Paket yöneticilerinin kurulu olup olmadığını ve sürümlerini döner. */
export async function managerStatus(): Promise<PackageManagerStatus[]> {
  const [wingetResult, chocoResult, npmResult, scoopResult] = await Promise.all([
    winget.version().catch(() => ({ available: false, version: '' })),
    probeManager('choco'),
    probeManager('npm'),
    probeManager('scoop'),
  ]);
  const rows: Array<{ source: PackageSource; available: boolean; version: string }> = [
    { source: 'winget', available: wingetResult.available, version: wingetResult.version },
    { source: 'choco', ...chocoResult },
    { source: 'npm', ...npmResult },
    { source: 'scoop', ...scoopResult },
  ];
  return rows.map((row) => ({
    source: row.source,
    label: LABELS[row.source],
    available: row.available,
    version: (row.version || '').slice(0, 80),
  }));
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
      emit('done', ok ? task.doneText : `Çıkış kodu ${code}`, ok);
      results.push({
        name: task.name, ident: task.ident, source: task.source,
        ok, code, message: ok ? task.doneText : `Çıkış kodu ${code}`,
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
    doneText: 'Kurulum tamamlandı.',
  })), requestId, onProgress, cancelled);
}

function requireUpgradeItem(pkg: Package): Package {
  const name = String(pkg?.name || '').trim();
  const ident = String(pkg?.ident || '').trim();
  if (name.length < 1 || name.length > 512 || /^[-/]/.test(name) || /[\r\n]/.test(name)) {
    throw new Error('Geçersiz güncelleme paketi adı.');
  }
  if (ident.length > 128 || /[\r\n]/.test(ident)) {
    throw new Error('Geçersiz güncelleme kimliği.');
  }
  return { name, ident, version: String(pkg.version || ''), available: String(pkg.available || ''), source: 'winget' };
}

/** winget güncellemeleri sırayla uygulanır; her adım canlı yüzde/hız bildirir. */
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
    source: 'winget' as const,
    run: (onLine) => winget.upgrade(pkg, silent, onLine),
    doneText: 'Güncelleme tamamlandı.',
  })), requestId, onProgress, cancelled);
}
