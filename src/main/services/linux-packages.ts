/**
 * Linux paket yöneticileri için salt-okunur yardımcılar.
 *
 * Burada yalnızca sürüm, güncelleme ve arama sorguları çalıştırılır. Kurulum,
 * güncelleme, kaldırma, sudo ve kabuk içeren hiçbir komut bulunmaz. Tüm
 * çağrılar child_process.execFile ile argüman dizisi olarak yapılır.
 */
import { execFile } from 'child_process';
import type { Package, PackageSource } from '../../shared/types';
import type { LogFn } from '../util';

export type LinuxSource = 'apt' | 'dnf' | 'pacman' | 'flatpak' | 'snap';

export interface LinuxManagerStatus {
  available: boolean;
  version: string;
  detail?: string;
}

interface CommandPlan {
  command: string;
  args: string[];
}

interface RawResult {
  stdout: string;
  stderr: string;
  failed: boolean;
  code: number;
  message: string;
}

const STATUS_TIMEOUT = 5_000;
const QUERY_TIMEOUT = 10_000;
const MAX_BUFFER = 8 * 1024 * 1024;

/** Yalnızca sürüm sorguları; hiçbiri yazma işlemi yapmaz. */
const STATUS_COMMANDS: Record<LinuxSource, CommandPlan> = {
  apt: { command: 'apt', args: ['--version'] },
  dnf: { command: 'dnf', args: ['--version'] },
  pacman: { command: 'pacman', args: ['--version'] },
  flatpak: { command: 'flatpak', args: ['--version'] },
  snap: { command: 'snap', args: ['version'] },
};

/** Yalnızca okuma sorguları; kurulum/güncelleme/kaldırma komutu yok. */
const OUTDATED_COMMANDS: Record<LinuxSource, CommandPlan> = {
  apt: { command: 'apt', args: ['list', '--upgradable'] },
  dnf: { command: 'dnf', args: ['check-update'] },
  pacman: { command: 'pacman', args: ['-Qu'] },
  flatpak: { command: 'flatpak', args: ['list', '--app', '--columns=application,version,latest'] },
  snap: { command: 'snap', args: ['list'] },
};

export function isLinuxSource(source: PackageSource | string): source is LinuxSource {
  return source === 'apt' || source === 'dnf' || source === 'pacman' || source === 'flatpak' || source === 'snap';
}

/** Arama sorgusu seçenek gibi yorumlanamaz; geçersizse boş döner. */
function requireQuery(query: string): string {
  const value = String(query || '').trim();
  if (!value || value.length > 120 || /^[-/]/.test(value) || /[\r\n\0]/.test(value)) return '';
  return value;
}

function searchCommand(source: LinuxSource, query: string): CommandPlan {
  switch (source) {
    case 'apt': return { command: 'apt-cache', args: ['search', query] };
    case 'dnf': return { command: 'dnf', args: ['--quiet', 'search', query] };
    case 'pacman': return { command: 'pacman', args: ['-Ss', query] };
    case 'flatpak': return { command: 'flatpak', args: ['search', query] };
    case 'snap': return { command: 'snap', args: ['find', query] };
  }
}

/** execFile: kabuk yok, sudo yok, stdin kapalı. Hata olsa da üretilen çıktı korunur. */
function run(plan: CommandPlan, timeout: number, onLine?: LogFn): Promise<RawResult> {
  return new Promise((resolve) => {
    execFile(plan.command, plan.args, {
      timeout,
      maxBuffer: MAX_BUFFER,
      windowsHide: true,
    }, (error, stdout, stderr) => {
      const out = typeof stdout === 'string' ? stdout : String(stdout ?? '');
      const err = typeof stderr === 'string' ? stderr : String(stderr ?? '');
      if (out && onLine) {
        for (const line of out.split(/\r?\n/)) {
          if (line.trim()) onLine(line.trim());
        }
      }
      resolve({
        stdout: out,
        stderr: err,
        failed: Boolean(error),
        code: error ? Number((error as { code?: unknown }).code) || -1 : 0,
        message: error ? (error.message || '').slice(0, 200) : '',
      });
    });
  });
}

function linesOf(text: string): string[] {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function validIdent(value: string): boolean {
  return value.length > 0 && value.length <= 128 && /^[A-Za-z0-9][A-Za-z0-9@.+_-]*$/.test(value);
}

function versionToken(value: string): string {
  const text = value.trim();
  if (!text || text.length > 80 || /[\r\n]/.test(text)) return '';
  return /^[A-Za-z0-9]/.test(text) ? text : '';
}

/** Paket yöneticisinin kurulu olup olmadığını yalnızca sürüm sorusuyla doğrular. */
export async function status(source: LinuxSource): Promise<LinuxManagerStatus> {
  if (!isLinuxSource(source)) return { available: false, version: '' };
  const result = await run(STATUS_COMMANDS[source], STATUS_TIMEOUT);
  if (result.failed) {
    return {
      available: false,
      version: '',
      detail: (result.message || result.stderr || 'unavailable').slice(0, 200),
    };
  }
  const lines = linesOf(result.stdout);
  let version = '';
  if (source === 'snap') {
    const snapLine = lines.find((line) => /^snap\s+/i.test(line));
    version = snapLine ? (snapLine.split(/\s+/)[1] || '') : '';
  } else {
    version = (lines.find((line) => /\d/.test(line)) || lines[0] || '').slice(0, 120);
  }
  return version
    ? { available: true, version }
    : { available: false, version: '', detail: 'no version output' };
}

/** İzin verilen kaynaklar arasından ilk kullanılabilir yöneticinin durumunu döner. */
export async function statusFirstAvailable(sources: readonly PackageSource[]): Promise<LinuxManagerStatus> {
  const candidates = sources.filter(isLinuxSource);
  if (!candidates.length) return { available: false, version: '' };
  const results = await Promise.all(candidates.map((source) => status(source)));
  return results.find((result) => result.available) || results[0] || { available: false, version: '' };
}

/** apt: `curl/stable 8.5 amd64 [upgradable from: 8.4]` */
function parseAptOutdated(text: string): Package[] {
  const rows: Package[] = [];
  for (const line of linesOf(text)) {
    const match = line.match(/^(\S+)\/[^\s]+\s+(\S+)/);
    if (!match) continue;
    const from = line.match(/\[upgradable from:\s*([^\]]+)\]/i);
    const available = versionToken(match[2]);
    const version = from ? versionToken(from[1]) : '';
    if (!validIdent(match[1]) || !available) continue;
    rows.push({ name: match[1], ident: match[1], version, available, source: 'apt' });
  }
  return rows;
}

/** dnf: `vim-enhanced.x86_64  9.0.1-1.fc39  updates` */
function parseDnfOutdated(text: string): Package[] {
  const rows: Package[] = [];
  for (const line of linesOf(text)) {
    if (/^(last metadata|obsoletes|no match|updates information)/i.test(line)) continue;
    const cells = line.split(/\s+/);
    if (cells.length < 2) continue;
    const ident = cells[0].replace(/\.[A-Za-z0-9_]+$/, '');
    const available = versionToken(cells[1]);
    if (!validIdent(ident) || !available) continue;
    rows.push({ name: ident, ident, version: '', available, source: 'dnf' });
  }
  return rows;
}

/** pacman: `curl 8.5.0-1 -> 8.6.0-1` */
function parsePacmanOutdated(text: string): Package[] {
  const rows: Package[] = [];
  for (const line of linesOf(text)) {
    const match = line.match(/^(\S+)\s+(\S+)\s+->\s+(\S+)/);
    if (!match) continue;
    const version = versionToken(match[2]);
    const available = versionToken(match[3]);
    if (!validIdent(match[1]) || !available) continue;
    rows.push({ name: match[1], ident: match[1], version, available, source: 'pacman' });
  }
  return rows;
}

/** flatpak: sekmeyle ayrılmış `application  version  latest` satırları. */
function parseFlatpakOutdated(text: string): Package[] {
  const rows: Package[] = [];
  for (const line of linesOf(text)) {
    const cells = line.split('\t').map((cell) => cell.trim());
    if (cells.length < 3) continue;
    if (/^application$/i.test(cells[0]) || /^version$/i.test(cells[1]) || /^latest$/i.test(cells[2])) continue;
    const version = versionToken(cells[1]);
    const available = versionToken(cells[2]);
    if (!validIdent(cells[0]) || !available || version === available) continue;
    rows.push({ name: cells[0], ident: cells[0], version, available, source: 'flatpak' });
  }
  return rows;
}

/**
 * `snap list` yalnızca kurulu sürümü gösterir. Yalnızca açık `->` biçimi varsa
 * güncelleme sayılır; belirsiz satırlar atlanır.
 */
function parseSnapOutdated(text: string): Package[] {
  const rows: Package[] = [];
  for (const line of linesOf(text)) {
    const match = line.match(/^(\S+)\s+(\S+)\s+->\s+(\S+)/);
    if (!match) continue;
    const version = versionToken(match[2]);
    const available = versionToken(match[3]);
    if (!validIdent(match[1]) || !available) continue;
    rows.push({ name: match[1], ident: match[1], version, available, source: 'snap' });
  }
  return rows;
}

/** Yalnızca salt-okunur güncelleme sorgusu; kaynak yoksa/komut hataysa boş döner. */
export async function listOutdated(source: LinuxSource, onLine?: LogFn): Promise<Package[]> {
  if (!isLinuxSource(source)) return [];
  const result = await run(OUTDATED_COMMANDS[source], QUERY_TIMEOUT, onLine);
  // dnf check-update güncelleme varsa çıkış kodu 100 döndürür; beklenen bir durum.
  if (result.failed && !(source === 'dnf' && result.code === 100)) return [];
  switch (source) {
    case 'apt': return parseAptOutdated(result.stdout);
    case 'dnf': return parseDnfOutdated(result.stdout);
    case 'pacman': return parsePacmanOutdated(result.stdout);
    case 'flatpak': return parseFlatpakOutdated(result.stdout);
    case 'snap': return parseSnapOutdated(result.stdout);
  }
}

function addSearchRow(rows: Package[], source: LinuxSource, ident: string, name: string, version = ''): void {
  if (!validIdent(ident) || rows.length >= 200 || rows.some((row) => row.ident === ident)) return;
  rows.push({
    name: (name || ident).slice(0, 256),
    ident,
    version: versionToken(version),
    available: '',
    source,
  });
}

function parseAptSearch(text: string): Package[] {
  const rows: Package[] = [];
  for (const line of linesOf(text)) {
    const match = line.match(/^(\S+)\s+-\s+(.+)$/);
    if (!match) continue;
    addSearchRow(rows, 'apt', match[1], match[1]);
  }
  return rows;
}

function parseDnfSearch(text: string): Package[] {
  const rows: Package[] = [];
  for (const line of linesOf(text)) {
    if (/^=+/.test(line)) continue;
    const match = line.match(/^(\S+)\s*:\s*(\S)/);
    if (!match) continue;
    addSearchRow(rows, 'dnf', match[1].replace(/\.[A-Za-z0-9_]+$/, ''), match[1]);
  }
  return rows;
}

function parsePacmanSearch(text: string): Package[] {
  const rows: Package[] = [];
  for (const line of linesOf(text)) {
    const match = line.match(/^([^\s/]+)\/(\S+)\s+(\S+)/);
    if (!match) continue;
    addSearchRow(rows, 'pacman', match[2], match[2], match[3]);
  }
  return rows;
}

function parseFlatpakSearch(text: string): Package[] {
  const rows: Package[] = [];
  for (const line of linesOf(text)) {
    const cells = line.split('\t').map((cell) => cell.trim());
    if (cells.length < 2) continue;
    const idPattern = /^[A-Za-z][A-Za-z0-9-]*(\.[A-Za-z0-9-]+)+$/;
    const appId = idPattern.test(cells[2] || '') ? cells[2] : cells.find((cell) => idPattern.test(cell));
    if (!appId) continue;
    addSearchRow(rows, 'flatpak', appId, cells[0] || appId);
  }
  return rows;
}

function parseSnapSearch(text: string): Package[] {
  const rows: Package[] = [];
  const lines = linesOf(text);
  const start = /^Name\s+Version/i.test(lines[0] || '') ? 1 : 0;
  for (const line of lines.slice(start)) {
    const cells = line.split(/\s{2,}/).map((cell) => cell.trim());
    if (cells.length < 2) continue;
    addSearchRow(rows, 'snap', cells[0], cells[0], cells[1]);
  }
  return rows;
}

/** Salt-okunur arama; güvenli okuma sorgusu olmayan kaynak için boş döner. */
export async function search(source: LinuxSource, query: string, onLine?: LogFn): Promise<Package[]> {
  if (!isLinuxSource(source)) return [];
  const safe = requireQuery(query);
  if (!safe) return [];
  const result = await run(searchCommand(source, safe), QUERY_TIMEOUT, onLine);
  if (result.failed) return [];
  switch (source) {
    case 'apt': return parseAptSearch(result.stdout);
    case 'dnf': return parseDnfSearch(result.stdout);
    case 'pacman': return parsePacmanSearch(result.stdout);
    case 'flatpak': return parseFlatpakSearch(result.stdout);
    case 'snap': return parseSnapSearch(result.stdout);
  }
}

/** İzin verilen Linux kaynaklarında arayı birleştirir; tekrar eden kimlikleri atar. */
export async function searchAcross(
  sources: readonly PackageSource[],
  query: string,
  onLine?: LogFn,
): Promise<Package[]> {
  const candidates = sources.filter(isLinuxSource);
  if (!candidates.length || !requireQuery(query)) return [];
  const settled = await Promise.allSettled(candidates.map((source) => search(source, query, onLine)));
  const rows: Package[] = [];
  const seen = new Set<string>();
  for (const entry of settled) {
    if (entry.status !== 'fulfilled') continue;
    for (const pkg of entry.value) {
      const key = `${pkg.source}:${pkg.ident}`;
      if (seen.has(key) || rows.length >= 200) continue;
      seen.add(key);
      rows.push(pkg);
    }
  }
  return rows;
}
