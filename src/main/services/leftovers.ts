import fs from 'fs';
import os from 'os';
import path from 'path';
import type { DeleteResult, Leftover } from '../../shared/types';
import { directorySize, isProtectedPath, isRuntimePath, normalizeName, powershellJson, removeTree, runPowerShell } from '../util';
import { exclusionReason, hasExcludedDescendant, isExcludedPath } from './exclusions';

const GENERIC = new Set([
  'microsoft', 'corporation', 'corp', 'incorporated', 'inc', 'ltd', 'limited', 'company',
  'software', 'systems', 'technologies', 'technology', 'windows', 'win32', 'win64', 'x64',
  'x86', 'amd64', 'setup', 'installer', 'package', 'packages', 'version', 'update', 'updater',
  'application', 'app', 'the', 'free', 'pro', 'plus', 'build', 'release', 'portable', 'latest',
  'desktop',
]);
const SKIP_DIRS = new Set(['node_modules', '__pycache__', '.git', '.svn', '.hg']);

function keywords(name: string, ident: string): { words: Set<string>; full: string } {
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

function match(candidate: string, info: { words: Set<string>; full: string }): string | null {
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

function walk(root: string, depth: number, info: { words: Set<string>; full: string }, found: Set<string>, results: Leftover[]): void {
  if (depth < 0) return;
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (SKIP_DIRS.has(entry.name.toLocaleLowerCase('tr-TR'))) continue;
    if (isProtectedPath(full) || isRuntimePath(full) || isExcludedPath(full)) continue;
    let isDir = false;
    let isFile = false;
    try { isDir = entry.isDirectory() && !entry.isSymbolicLink(); isFile = entry.isFile(); } catch { continue; }
    if (!isDir && !isFile) continue;
    let reason = match(entry.name, info);
    if (reason && isFile && reason !== info.full) {
      if (!match(path.basename(path.dirname(full)), info)) reason = null;
    }
    if (reason && !found.has(full.toLowerCase())) {
      found.add(full.toLowerCase());
      results.push({
        path: full,
        kind: isDir ? 'folder' : 'file',
        size: isDir ? directorySize(full, 20_000, isExcludedPath) : safeSize(full),
        reason,
      });
    }
    if (isDir && depth > 0) walk(full, depth - 1, info, found, results);
  }
}

function safeSize(filePath: string): number {
  try { return fs.statSync(filePath).size; } catch { return 0; }
}

export function scanLeftovers(name: string, ident: string): Leftover[] {
  const info = keywords(name, ident);
  const found = new Set<string>();
  const results: Leftover[] = [];
  for (const root of roots()) {
    walk(root.dir, root.depth, info, found, results);
  }
  return results.slice(0, 300);
}

export async function deleteLeftovers(items: Leftover[], mode: 'recycle' | 'permanent'): Promise<DeleteResult[]> {
  const results: DeleteResult[] = [];
  for (const item of items) {
    if (isExcludedPath(item.path)) {
      results.push({ path: item.path, ok: false, message: `${exclusionReason(item.path)}; atlandı.` });
      continue;
    }
    if (isProtectedPath(item.path) || isRuntimePath(item.path)) {
      results.push({ path: item.path, ok: false, message: 'Korumalı yol; atlandı.' });
      continue;
    }
    if (item.kind === 'folder' && hasExcludedDescendant(item.path)) {
      results.push({ path: item.path, ok: false, message: 'İçinde hariç tutulan öğe var; klasör atlandı.' });
      continue;
    }
    try {
      if (mode === 'permanent') {
        if (item.kind === 'folder') {
          removeTree(item.path, (target) => isExcludedPath(target) || isProtectedPath(target) || isRuntimePath(target));
        } else {
          fs.rmSync(item.path, { force: true });
        }
        results.push({ path: item.path, ok: true, message: 'Kalıcı olarak silindi.' });
      } else {
        const type = item.kind === 'folder' ? 'Directory' : 'File';
        const script = `
Add-Type -AssemblyName Microsoft.VisualBasic
$target = ${JSON.stringify(item.path)}
if (Test-Path -LiteralPath $target) {
  [Microsoft.VisualBasic.FileIO.FileSystem]::Delete${type}($target, 'OnlyErrorDialogs', 'SendToRecycleBin')
  'OK'
} else { 'OK' }
`;
        const result = await runPowerShell(script, undefined, 60_000);
        results.push({
          path: item.path,
          ok: /OK/.test(result.text),
          message: /OK/.test(result.text) ? 'Geri Dönüşüm Kutusu\'na taşındı.' : result.text.slice(0, 160),
        });
      }
    } catch (error) {
      results.push({ path: item.path, ok: false, message: (error as Error).message.slice(0, 160) });
    }
  }
  return results;
}

export async function registryLeftovers(name: string): Promise<Leftover[]> {
  const script = String.raw`
$name = ${JSON.stringify(name)}
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
