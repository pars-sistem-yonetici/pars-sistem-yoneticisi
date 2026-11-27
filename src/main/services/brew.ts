import type { Package } from '../../shared/types';
import { m } from '../i18n-main';
import { LogFn, runCommand } from '../util';

/** Homebrew çağrıları salt-okunur; kurulum/güncelleme komutları burada yok. */
const TIMEOUT = 4 * 60 * 1000;
const CANDIDATES = ['brew', '/opt/homebrew/bin/brew', '/usr/local/bin/brew'];

async function invoke(args: string[], onLine?: LogFn, timeout = TIMEOUT) {
  let lastError: Error | null = null;
  for (const command of CANDIDATES) {
    try {
      const result = await runCommand(command, args, onLine, timeout);
      if (result.code === 0) return result;
      lastError = new Error(result.stderr || result.text || `exit ${result.code}`);
    } catch (error) {
      lastError = error as Error;
    }
  }
  throw lastError ?? new Error('brew unavailable');
}

export async function status(): Promise<{ available: boolean; version: string }> {
  try {
    const result = await invoke(['--version'], undefined, 20_000);
    const version = result.lines.find((line) => /^homebrew/i.test(line.trim()))?.trim()
      || result.lines.find((line) => line.trim())?.trim()
      || '';
    return { available: true, version: version.slice(0, 80) };
  } catch {
    return { available: false, version: '' };
  }
}

interface BrewOutdatedRow {
  name?: unknown;
  installed_versions?: unknown;
  current_version?: unknown;
  installed?: unknown;
  latest?: unknown;
}

function normalizeToken(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function rowsFrom(value: unknown): BrewOutdatedRow[] {
  if (Array.isArray(value)) return value as BrewOutdatedRow[];
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  return [
    ...(Array.isArray(record.formulae) ? record.formulae : []),
    ...(Array.isArray(record.casks) ? record.casks : []),
  ] as BrewOutdatedRow[];
}

/** `brew outdated --json=v2` çıktısından kurulu/son sürümleri çıkarır. */
export function parseOutdated(text: string): Package[] {
  const start = text.search(/[{[]/);
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (start < 0 || end < start) return [];
  let data: unknown;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  const rows: Package[] = [];
  for (const item of rowsFrom(data)) {
    const ident = normalizeToken(item.name);
    const installed = Array.isArray(item.installed_versions)
      ? normalizeToken(item.installed_versions[item.installed_versions.length - 1])
      : normalizeToken(item.installed);
    const available = normalizeToken(item.current_version) || normalizeToken(item.latest);
    if (!ident || !installed || !available || installed === available) continue;
    if (!/^[A-Za-z0-9][A-Za-z0-9@+._/-]*$/.test(ident)) continue;
    if (ident.length > 128) continue;
    rows.push({ name: ident, ident, version: installed, available, source: 'brew' });
  }
  return rows;
}

export async function listUpdates(onLine?: LogFn): Promise<Package[]> {
  const result = await invoke(['outdated', '--json=v2'], onLine);
  return parseOutdated(result.text);
}

export function parseSearch(text: string): Package[] {
  const rows: Package[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const ident = raw.trim();
    if (!ident || ident.startsWith('==>') || ident.includes(' ')) continue;
    if (!/^[A-Za-z0-9][A-Za-z0-9@+._/-]*$/.test(ident) || ident.length > 128) continue;
    if (seen.has(ident)) continue;
    seen.add(ident);
    rows.push({ name: ident, ident, version: '', available: '', source: 'brew' });
  }
  return rows.slice(0, 200);
}

/** Salt-okunur paket araması; sorgu zaten IPC katmanında doğrulanır. */
export async function search(query: string, onLine?: LogFn): Promise<Package[]> {
  const result = await invoke(['search', query], onLine, 60_000);
  return parseSearch(result.text);
}

/** Kurulum/güncelleme için güvenli kimlik doğrulaması ( POSIX yazma kapalıyken de kullanılır). */
export function requireIdent(ident: string): string {
  const value = String(ident || '').trim();
  if (!value || value.length > 128 || !/^[A-Za-z0-9][A-Za-z0-9@+._/-]*$/.test(value)) {
    throw new Error(m('Homebrew: geçersiz paket kimliği.', 'Homebrew: invalid package identifier.'));
  }
  return value;
}
