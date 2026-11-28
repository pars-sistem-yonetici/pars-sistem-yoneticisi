import { getCapabilities } from '../../shared/platform';
import type { Package, PackageSource } from '../../shared/types';
import { LogFn, runCommand } from '../util';
import * as brew from './brew';
import * as linux from './linux-packages';
import * as winget from './winget';

/** Tüm güncelleme taramaları salt okunur; hiçbiri kendiliğinden kurulum yapmaz. */
const TIMEOUT = 4 * 60 * 1000;

/**
 * Chocolatey: `id|kurulu|son|sabitlenmiş` biçiminde satır döndürür.
 * Örnek: `7zip|19.00|24.09|false`
 */
export function parseChocoUpdates(text: string): Package[] {
  const rows: Package[] = [];
  for (const line of text.split(/\r?\n/)) {
    const cells = line.trim().split('|').map((cell) => cell.trim());
    if (cells.length < 3) continue;
    const [ident, current, available, pinned] = cells;
    if (!ident || !current || !available || current === available) continue;
    if (pinned && /^true$/i.test(pinned)) continue;
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(ident)) continue;
    rows.push({ name: ident, ident, version: current, available, source: 'choco' });
  }
  return rows;
}

/**
 * npm: `npm outdated -g --json` nesne döndürür; çıkış kodu 1 olsa bile
 * gövde geçerli JSON olabilir. `error` anahtarı varsa kayıt yok sayılır.
 */
export function parseNpmUpdates(text: string): Package[] {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) return [];
  let data: Record<string, { current?: string; wanted?: string; latest?: string }>;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!data || typeof data !== 'object' || (data as Record<string, unknown>).error) return [];
  const rows: Package[] = [];
  for (const [ident, info] of Object.entries(data)) {
    if (!ident || !info || typeof info !== 'object') continue;
    const current = String(info.current || '').trim();
    const available = String(info.latest || info.wanted || '').trim();
    if (!current || !available || current === available) continue;
    if (!/^(?:@[A-Za-z0-9][A-Za-z0-9._-]*\/)?[A-Za-z0-9][A-Za-z0-9._-]*$/.test(ident)) continue;
    rows.push({ name: ident, ident, version: current, available, source: 'npm' });
  }
  return rows;
}

/**
 * Scoop: `scoop status` tablosundaki `Ad Kurulu Son` sütunlarını okur.
 * Tek boşlukla hizalanmış çıktıya da dayanıklıdır.
 */
export function parseScoopUpdates(text: string): Package[] {
  const rows: Package[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || /^(name|-{3,}|scoop|everything|no apps|güncel)/i.test(trimmed)) continue;
    let cells = trimmed.split(/\s{2,}/).map((cell) => cell.trim());
    if (cells.length < 3) cells = trimmed.split(/\s+/).map((cell) => cell.trim());
    if (cells.length < 3) continue;
    const [ident, current, available] = cells;
    if (!ident || !current || !available || current === available) continue;
    if (!/^[A-Za-z0-9][A-Za-z0-9._@/-]*$/.test(ident)) continue;
    if (!/[A-Za-z0-9]/.test(current) || !/[A-Za-z0-9]/.test(available)) continue;
    rows.push({ name: ident, ident, version: current, available, source: 'scoop' });
  }
  return rows;
}

/** Belirtilen kaynaktan güncelleme listesi; hata yalnızca o kaynağı etkiler. */
export async function listUpdates(source: PackageSource, onLine?: LogFn): Promise<Package[]> {
  switch (source) {
    case 'winget':
      return winget.listUpdates(onLine);
    case 'choco': {
      const result = await runCommand('choco', ['outdated', '--limit-output', '--no-color'], onLine, TIMEOUT);
      return parseChocoUpdates(result.text);
    }
    case 'npm': {
      const command = getCapabilities().kind === 'windows' ? 'npm.cmd' : 'npm';
      const result = await runCommand(command, ['outdated', '-g', '--json', '--no-audit', '--no-fund'], onLine, TIMEOUT);
      return parseNpmUpdates(result.text);
    }
    case 'scoop': {
      const result = await runCommand('scoop.cmd', ['status'], onLine, TIMEOUT);
      return parseScoopUpdates(result.text);
    }
    case 'brew':
      return brew.listUpdates(onLine);
    case 'apt':
    case 'dnf':
    case 'pacman':
    case 'flatpak':
    case 'snap':
      // Linux kaynakları yalnızca o platformun yetenek listesindeyse taranır.
      return getCapabilities().packageSources.includes(source) ? linux.listOutdated(source, onLine) : [];
  }
}

/** Tüm kaynaklar paralel taranır; başarısız kaynaklar listeyi bozmaz. */
export async function listAllUpdates(onLine?: LogFn): Promise<Package[]> {
  const sources: readonly PackageSource[] = getCapabilities().packageSources;
  const settled = await Promise.allSettled(sources.map((source) => listUpdates(source, onLine)));
  return settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
}
