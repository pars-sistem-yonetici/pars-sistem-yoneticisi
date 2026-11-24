import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AppLeftovers, DeleteResult, Leftover, LeftoverScanTarget } from '../../shared/types';
import { directorySize, isProtectedPath, isRuntimePath, normalizeName, powershellJson, psLiteral, removeTree } from '../util';
import { exclusionReason, hasExcludedDescendant, isExcludedPath } from './exclusions';

const GENERIC = new Set([
  'microsoft', 'corporation', 'corp', 'incorporated', 'inc', 'ltd', 'limited', 'company',
  'software', 'systems', 'technologies', 'technology', 'windows', 'win32', 'win64', 'x64',
  'x86', 'amd64', 'setup', 'installer', 'package', 'packages', 'version', 'update', 'updater',
  'application', 'app', 'the', 'free', 'pro', 'plus', 'build', 'release', 'portable', 'latest',
  'desktop',
]);
const SKIP_DIRS = new Set(['node_modules', '__pycache__', '.git', '.svn', '.hg']);
/** Uygulama başına sonuç üst sınırı; sınıra ulaşan uygulama için tarama durur. */
const PER_APP_LIMIT = 300;

interface MatchInfo {
  words: Set<string>;
  full: string;
}

interface ScanState {
  infos: MatchInfo[];
  found: Set<string>[];
  results: Leftover[][];
  /** Aynı klasörün boyutu birden çok uygulama için yeniden hesaplanmasın. */
  sizes: Map<string, number>;
  /** Sonuç sınırına ulaşan uygulama sayısı; hepsi dolunca gezmeyi bırakırız. */
  full: number;
  scanned: number;
  aborted: boolean;
}

interface PendingItem {
  index: number;
  item: Leftover;
}

export interface LeftoverProgress {
  requestId: string;
  rootIndex: number;
  rootsTotal: number;
  scanned: number;
  matches: number;
  percent: number;
}

export interface LeftoverScanOptions {
  requestId?: string;
  onProgress?: (progress: LeftoverProgress) => void;
  cancelled?: () => boolean;
}

function keywords(name: string, ident: string): MatchInfo {
  const parts = [name];
  if (ident) parts.push(ident.split('\\').pop()!.replace(/[._]/g, ' '));
  const words = new Set<string>();
  for (const part of parts) {
    for (const token of part.split(/[^A-Za-z0-9çğıöşüÇĞİÖŞÜ]+/)) {
      const lower = token.toLocaleLowerCase('tr-TR');
      if (lower.length >= 3 && !/^\d+$/.test(lower) && !GENERIC.has(lower)) words.add(lower);
      else if (/^v\d+$/.test(lower)) words.add(lower);
    }
  }
  return { words, full: normalizeName(name) };
}

function match(candidate: string, info: MatchInfo): string | null {
  const normalized = normalizeName(candidate);
  if (!normalized) return null;
  if (info.full.length >= 4 && normalized.includes(info.full)) return info.full;
  const hits = [...info.words].filter((word) => normalized.includes(word));
  const accepted = hits.filter((word) => word.length >= 4 || normalized === word);
  return accepted.sort((a, b) => a.length - b.length)[0] || null;
}

function roots(): Array<{ dir: string; depth: number }> {
  const home = process.env.USERPROFILE || os.homedir();
  const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  const roaming = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
  const programData = process.env.PROGRAMDATA || 'C:\\ProgramData';
  const windows = process.env.WINDIR || 'C:\\Windows';
  const publicDir = process.env.PUBLIC || path.join(home, 'Public');
  const candidates: Array<[string, number]> = [
    [local, 2], [roaming, 2], [path.join(home, 'AppData', 'LocalLow'), 1], [programData, 1],
    [process.env.ProgramFiles || 'C:\\Program Files', 1],
    [process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 1],
    [process.env.TEMP || path.join(local, 'Temp'), 1],
    [path.join(windows, 'Temp'), 1],
    [path.join(home, 'Desktop'), 1], [path.join(publicDir, 'Desktop'), 1],
    [path.join(programData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'), 2],
    [path.join(roaming, 'Microsoft', 'Windows', 'Start Menu', 'Programs'), 2],
  ];
  return candidates
    .filter(([dir]) => fs.existsSync(dir))
    .map(([dir, depth]) => ({ dir, depth }));
}

const yieldEventLoop = () => new Promise<void>((resolve) => setImmediate(resolve));

function emitProgress(state: ScanState, options: LeftoverScanOptions, rootIndex: number, rootsTotal: number): void {
  if (!options.requestId || !options.onProgress) return;
  const matches = state.results.reduce((total, list) => total + list.length, 0);
  options.onProgress({
    requestId: options.requestId,
    rootIndex,
    rootsTotal,
    scanned: state.scanned,
    matches,
    percent: Math.min(100, Math.round(((rootIndex + 1) / Math.max(1, rootsTotal)) * 100)),
  });
}

/**
 * Kökleri bir kez gezer, her girişi tüm uygulamaların anahtar kelimeleriyle
 * aynı anda karşılaştırır. Eski davranışta N uygulama = N kez tam tarama vardı.
 * Parçalı async yapı sayesinde iptal edilebilir ve ilerleme bildirir.
 */
async function walkBatch(
  root: string,
  depth: number,
  state: ScanState,
  options: LeftoverScanOptions,
  rootIndex: number,
  rootsTotal: number,
): Promise<void> {
  if (depth < 0 || state.full === state.infos.length || state.aborted) return;
  let entries: fs.Dirent[];
  try { entries = await fs.promises.readdir(root, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (state.aborted || options.cancelled?.()) { state.aborted = true; break; }
    if (state.full === state.infos.length) break;
    state.scanned += 1;
    const full = path.join(root, entry.name);
    if (SKIP_DIRS.has(entry.name.toLocaleLowerCase('tr-TR'))) continue;
    if (isProtectedPath(full) || isRuntimePath(full) || isExcludedPath(full)) continue;
    let isDir = false;
    let isFile = false;
    try { isDir = entry.isDirectory() && !entry.isSymbolicLink(); isFile = entry.isFile(); } catch { continue; }
    if (!isDir && !isFile) continue;

    const key = full.toLowerCase();
    let cachedSize: number | undefined;
    for (let index = 0; index < state.infos.length; index += 1) {
      if (state.results[index].length >= PER_APP_LIMIT) continue;
      const info = state.infos[index];
      let reason = match(entry.name, info);
      if (reason && isFile && reason !== info.full) {
        if (!match(path.basename(path.dirname(full)), info)) reason = null;
      }
      if (!reason || state.found[index].has(key)) continue;
      state.found[index].add(key);

      let size = 0;
      if (isDir) {
        if (cachedSize === undefined) {
          const stored = state.sizes.get(key);
          if (stored !== undefined) cachedSize = stored;
          else {
            cachedSize = directorySize(full, 20_000, isExcludedPath);
            state.sizes.set(key, cachedSize);
          }
        }
        size = cachedSize;
      } else {
        size = safeSize(full);
      }

      state.results[index].push({
        path: full,
        kind: isDir ? 'folder' : 'file',
        size,
        reason,
      });
      if (state.results[index].length === PER_APP_LIMIT) state.full += 1;
      if (state.full === state.infos.length) break;
    }
    if (isDir && depth > 0) await walkBatch(full, depth - 1, state, options, rootIndex, rootsTotal);
    if (state.scanned % 200 === 0) {
      emitProgress(state, options, rootIndex, rootsTotal);
      await yieldEventLoop();
    }
  }
  emitProgress(state, options, rootIndex, rootsTotal);
}

function safeSize(filePath: string): number {
  try { return fs.statSync(filePath).size; } catch { return 0; }
}

/**
 * Birden çok uygulamanın kalıntılarını tek taramada bulur.
 * Her uygulama için en fazla 300 sonuç döner; iptal edilirse o ana kadarki sonuçlar döner.
 */
export async function scanLeftoversBatch(targets: LeftoverScanTarget[], options: LeftoverScanOptions = {}): Promise<AppLeftovers[]> {
  if (!targets.length) return [];
  const state: ScanState = {
    infos: targets.map((target) => keywords(target.name, target.ident)),
    found: targets.map(() => new Set<string>()),
    results: targets.map(() => [] as Leftover[]),
    sizes: new Map(),
    full: 0,
    scanned: 0,
    aborted: false,
  };
  const list = roots();
  for (let index = 0; index < list.length; index += 1) {
    if (state.full === state.infos.length || state.aborted) break;
    await walkBatch(list[index].dir, list[index].depth, state, options, index, list.length);
    await yieldEventLoop();
  }
  if (state.aborted && options.onProgress) {
    options.onProgress({
      requestId: options.requestId ?? '',
      rootIndex: list.length,
      rootsTotal: list.length,
      scanned: state.scanned,
      matches: state.results.reduce((total, items) => total + items.length, 0),
      percent: 100,
    });
  }
  return targets.map((target, index) => ({ ...target, items: state.results[index] }));
}

/** Tek uygulama için kolaylık sarmalayıcısı (mevcut çağrılar bozulmasın). */
export async function scanLeftovers(name: string, ident: string, options?: LeftoverScanOptions): Promise<Leftover[]> {
  return (await scanLeftoversBatch([{ name, ident }], options))[0]?.items ?? [];
}

/** Geri dönüşüm kutusuna taşınacak öğeleri tek PowerShell oturumunda işler. */
async function recycleBatch(pending: PendingItem[], results: DeleteResult[]): Promise<void> {
  if (!pending.length) return;
  const rows = pending.map(({ index, item }) =>
    `  [pscustomobject]@{ i = ${index}; p = ${psLiteral(item.path)}; t = '${item.kind === 'folder' ? 'Directory' : 'File'}' },`);
  rows[rows.length - 1] = rows[rows.length - 1].replace(/,$/, '');
  const script = `
Add-Type -AssemblyName Microsoft.VisualBasic
$targets = @(
${rows.join('\n')}
)
$out = @()
foreach ($target in $targets) {
  $ok = $false
  $err = ''
  try {
    if (-not (Test-Path -LiteralPath $target.p)) {
      $ok = $true
    } else {
      if ($target.t -eq 'Directory') {
        [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($target.p, 'OnlyErrorDialogs', 'SendToRecycleBin')
      } else {
        [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($target.p, 'OnlyErrorDialogs', 'SendToRecycleBin')
      }
      $ok = $true
    }
  } catch { $err = $_.Exception.Message }
  $out += [pscustomobject]@{ i = [int]$target.i; ok = $ok; err = $err }
}
@{ items = @($out) } | ConvertTo-Json -Compress -Depth 4
`;
  const timeout = Math.min(600_000, Math.max(60_000, pending.length * 3_000));
  try {
    const parsed = await powershellJson<{ items?: Array<{ i: number; ok: boolean; err?: string }> | { i: number; ok: boolean; err?: string } }>(script, undefined, timeout);
    const raw = parsed?.items;
    const returned = !raw ? [] : Array.isArray(raw) ? raw : [raw];
    const byIndex = new Map(returned.map((row) => [Number(row.i), row]));
    for (const { index, item } of pending) {
      const row = byIndex.get(index);
      results[index] = row?.ok
        ? { path: item.path, ok: true, message: 'Geri Dönüşüm Kutusu\'na taşındı.' }
        : { path: item.path, ok: false, message: String(row?.err || 'PowerShell sonucu alınamadı.').slice(0, 160) };
    }
  } catch (error) {
    for (const { index, item } of pending) {
      results[index] = { path: item.path, ok: false, message: (error as Error).message.slice(0, 160) };
    }
  }
}

export async function deleteLeftovers(items: Leftover[], mode: 'recycle' | 'permanent'): Promise<DeleteResult[]> {
  const results: DeleteResult[] = new Array(items.length);
  const pending: PendingItem[] = [];

  // Önce tüm güvenlik kontrolleri yapılır; yalnızca geçenler silme kuyruğuna girer.
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (isExcludedPath(item.path)) {
      results[index] = { path: item.path, ok: false, message: `${exclusionReason(item.path)}; atlandı.` };
      continue;
    }
    if (isProtectedPath(item.path) || isRuntimePath(item.path)) {
      results[index] = { path: item.path, ok: false, message: 'Korumalı yol; atlandı.' };
      continue;
    }
    if (item.kind === 'folder' && hasExcludedDescendant(item.path)) {
      results[index] = { path: item.path, ok: false, message: 'İçinde hariç tutulan öğe var; klasör atlandı.' };
      continue;
    }
    pending.push({ index, item });
  }

  if (mode === 'permanent') {
    for (const { index, item } of pending) {
      try {
        if (item.kind === 'folder') {
          removeTree(item.path, (target) => isExcludedPath(target) || isProtectedPath(target) || isRuntimePath(target));
        } else {
          fs.rmSync(item.path, { force: true });
        }
        results[index] = { path: item.path, ok: true, message: 'Kalıcı olarak silindi.' };
      } catch (error) {
        results[index] = { path: item.path, ok: false, message: (error as Error).message.slice(0, 160) };
      }
    }
  } else {
    await recycleBatch(pending, results);
  }
  return results;
}

export async function registryLeftovers(name: string): Promise<Leftover[]> {
  const script = String.raw`
$name = ${psLiteral(name)}
$path = 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall'
$found = @()
foreach ($hive in @([Microsoft.Win32.RegistryHive]::LocalMachine, [Microsoft.Win32.RegistryHive]::CurrentUser)) {
  $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive, [Microsoft.Win32.RegistryView]::Registry64)
  $key = $base.OpenSubKey($path)
  if (-not $key) { continue }
  foreach ($subName in $key.GetSubKeyNames()) {
    $sub = $key.OpenSubKey($subName)
    $display = [string]$sub.GetValue('DisplayName')
    if ($display -and $display.ToLowerInvariant().Contains($name.ToLowerInvariant())) {
      $found += [pscustomobject]@{ path = ($hive.ToString() + '\' + $path + '\' + $subName); kind = 'registry'; size = 0; reason = $display }
    }
  }
}
$found | ConvertTo-Json -Compress
`;
  try {
    const result = await powershellJson<Leftover[] | Leftover>(script, undefined, 60_000);
    return Array.isArray(result) ? result : result ? [result] : [];
  } catch {
    return [];
  }
}
