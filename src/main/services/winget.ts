import type { Package } from '../../shared/types';
import { LogFn, runCommand } from '../util';

const AGREEMENTS = ['--accept-source-agreements', '--accept-package-agreements'];
const QUIET = ['--disable-interactivity', '--nowarn'];

export class WingetError extends Error {}

/** winget kimliği: en az bir nokta içerir, seçenek/kaçış karakteri taşımaz. */
const IDENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]*\.[A-Za-z0-9][A-Za-z0-9._+-]*$/;

function requireIdent(ident: string, action: string): string {
  const value = ident.trim();
  if (value.length < 3 || value.length > 128 || !IDENT_PATTERN.test(value)) {
    throw new WingetError(`${action}: geçersiz paket kimliği.`);
  }
  return value;
}

function requireQuery(query: string): string {
  const value = query.trim();
  if (!value || value.length > 120 || /^[-/]/.test(value) || /[\r\n]/.test(value)) {
    throw new WingetError('Arama sorgusu geçersiz.');
  }
  return value;
}

function byName(ident: string): boolean {
  const value = ident.trim();
  return !value || value.includes('\\') || !/^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(value);
}

export function hasUpdate(pkg: Package): boolean {
  const value = pkg.available.trim().toLowerCase();
  return Boolean(value) && !['unknown', 'n/a', '-'].includes(value);
}

/**
 * winget'in sürümü belirlenemeyen paketler hakkındaki bilgilendirme satırı
 * tablo sütunlarına yayılır; gerçek bir paket gibi görünmesin diye birleşik
 * metinden ayıklanır. `--include-unknown` bilinçli olarak kullanılmıyor.
 */
function isNoticeRow(...cells: string[]): boolean {
  const text = cells.join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!text) return false;
  return /package\(s\) have version numbers that cannot be determined/i.test(text)
    || /include-unknown/i.test(text)
    || /^\d+\s+upgrades? available\.?$/i.test(text)
    || /^\d+\s+package\(s\)/i.test(text);
}

async function run(args: string[], onLine?: LogFn, timeout = 15 * 60 * 1000) {
  try {
    return await runCommand('winget', args, onLine, timeout);
  } catch (error) {
    throw new WingetError(`winget.exe bulunamadı. Windows 10/11 ve App Installer gerekli. (${(error as Error).message})`);
  }
}

export async function version(): Promise<{ available: boolean; version: string }> {
  try {
    const result = await run(['--version'], undefined, 30_000);
    return { available: result.code === 0, version: result.lines.filter((line) => line.trim()).join(' ').trim() || 'bilinmiyor' };
  } catch (error) {
    return { available: false, version: (error as Error).message };
  }
}

function fromJson(text: string): Package[] {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('JSON yok');
  const data = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  const rows = (data.Packages || data.InstalledPackages || []) as Record<string, unknown>[];
  return rows
    .map((row) => ({
      name: String(row.PackageName || row.Name || row.PackageIdentifier || ''),
      ident: String(row.PackageIdentifier || ''),
      version: String(row.Version || ''),
      available: String(row.AvailableVersion || ''),
      source: String(row.Source || ''),
    }))
    .filter((pkg) => pkg.name.length > 0)
    .filter((pkg) => !isNoticeRow(pkg.name, pkg.version, pkg.available));
}

function parseTable(text: string): Package[] {
  const lines = text.split(/\r?\n/);
  let headerIndex = -1;
  let header = '';
  for (let index = 0; index < lines.length - 1; index += 1) {
    const line = lines[index];
    if (/\bName\b/i.test(line) && /\bId\b/i.test(line) && /\bVersion\b/i.test(line)) {
      headerIndex = index;
      header = line;
      break;
    }
  }
  if (headerIndex < 0) return [];
  if (!/^[\s-]+$/.test(lines[headerIndex + 1] || '')) return [];

  const labels = ['name', 'id', 'version', 'available', 'source'];
  const positions = new Map<string, number>();
  for (const match of header.matchAll(/\S+/g)) {
    positions.set(match[0].toLowerCase(), match.index ?? 0);
  }
  const starts = labels
    .filter((label) => positions.has(label))
    .map((label) => positions.get(label) as number);
  if (!positions.has('name') || !positions.has('id') || !positions.has('version')) return [];

  const spans = starts.map((start, index) => ({
    start,
    end: index + 1 < starts.length ? starts[index + 1] : undefined,
  }));
  const packages: Package[] = [];
  for (const line of lines.slice(headerIndex + 2)) {
    if (!line.trim() || /^[\s-]+$/.test(line)) continue;
    const cells = spans.map(({ start, end }) => line.slice(start, end).trim());
    while (cells.length < 5) cells.push('');
    const [name, ident, versionText, available, source] = cells;
    if (!name || !ident) continue;
    const lowered = name.toLowerCase();
    if (/^(no installed package|no available package|the following)/.test(lowered)) continue;
    if (isNoticeRow(name, ident, versionText, available, source)) continue;
    if (!hasUpdate({ name, ident, version: versionText, available, source })) continue;
    packages.push({ name, ident, version: versionText, available, source });
  }
  return packages;
}

async function list(args: string[], onLine?: LogFn): Promise<Package[]> {
  const jsonResult = await run([...args, '--output', 'json'], undefined, 5 * 60 * 1000);
  if (jsonResult.text.trimStart().startsWith('{')) {
    try {
      return fromJson(jsonResult.text);
    } catch {
      // Bozuk JSON -> tablo ayrıştırıcısına düş.
    }
  }
  const result = await run(args, onLine, 5 * 60 * 1000);
  return parseTable(result.text);
}

export function listPackages(onLine?: LogFn): Promise<Package[]> {
  return list(['list', ...QUIET, '--accept-source-agreements'], onLine);
}

export function listUpdates(onLine?: LogFn): Promise<Package[]> {
  return list(['list', ...QUIET, '--accept-source-agreements', '--upgrade-available'], onLine);
}

export async function search(query: string, onLine?: LogFn): Promise<Package[]> {
  const result = await run(['search', requireQuery(query), ...QUIET, '--accept-source-agreements'], onLine, 3 * 60 * 1000);
  const parsed = parseTable(result.text);
  if (parsed.length) return parsed;
  try {
    return fromJson(result.text);
  } catch {
    return [];
  }
}

function targetArgs(pkg: Package): string[] {
  if (byName(pkg.ident)) {
    const name = pkg.name.trim();
    if (!name || name.length > 512 || /^[-/]/.test(name) || /[\r\n]/.test(name)) {
      throw new WingetError('İşlem: geçersiz paket adı.');
    }
    return ['--name', name, '--exact'];
  }
  return ['--id', requireIdent(pkg.ident, 'İşlem'), '--exact'];
}

function silentFlag(silent: boolean): string[] {
  return silent ? ['--silent'] : [];
}

export async function install(ident: string, silent: boolean, onLine?: LogFn): Promise<number> {
  const result = await run(['install', '--id', requireIdent(ident, 'Kurulum'), '--exact', ...AGREEMENTS, ...QUIET, ...silentFlag(silent)], onLine);
  return result.code;
}

export async function upgrade(pkg: Package, silent: boolean, onLine?: LogFn): Promise<number> {
  const result = await run(['upgrade', ...targetArgs(pkg), ...AGREEMENTS, ...QUIET, ...silentFlag(silent)], onLine);
  return result.code;
}

export async function upgradeAll(silent: boolean, onLine?: LogFn): Promise<number> {
  const result = await run(['upgrade', '--all', ...AGREEMENTS, ...QUIET, ...silentFlag(silent)], onLine);
  return result.code;
}

export async function uninstall(pkg: Package, silent: boolean, onLine?: LogFn): Promise<number> {
  const result = await run(['uninstall', ...targetArgs(pkg), '--accept-source-agreements', ...QUIET, ...silentFlag(silent)], onLine);
  return result.code;
}

export async function updateSources(onLine?: LogFn): Promise<number> {
  const result = await run(['source', 'update', ...QUIET], onLine, 10 * 60 * 1000);
  return result.code;
}

export async function download(ident: string, onLine?: LogFn) {
  const downloads = (process.env.USERPROFILE
    ? `${process.env.USERPROFILE}\\Downloads`
    : process.cwd());
  const result = await run(
    ['download', '--id', requireIdent(ident, 'İndirme'), '--exact', ...AGREEMENTS, ...QUIET, '--download-directory', downloads],
    onLine,
    10 * 60 * 1000,
  );
  if (result.code === 0) {
    return { ok: true, message: `İndirme tamamlandı: ${downloads}`, path: downloads };
  }
  return {
    ok: false,
    message: result.text.split(/\r?\n/).filter((line) => /error|failed|hata|not support/i.test(line)).slice(-1)[0]
      || 'winget download bu sürümde desteklenmiyor. Kurulum sekmesinden yükleyebilirsiniz.',
  };
}
