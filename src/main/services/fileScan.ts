import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { DeleteResult, DuplicateGroup, EmptyItem, FileScanOptions, FileScanResult, LargeFile } from '../../shared/types';
import { isProtectedPath, isRuntimePath } from '../util';
import { m } from '../i18n-main';
import { isExcludedPath } from './exclusions';
import { deleteLeftovers } from './leftovers';

interface Candidate {
  path: string;
  size: number;
  modified: string;
}

function normalizedRoot(value: string): string {
  try { return path.resolve(value); } catch { return ''; }
}

function underRoots(target: string, roots: string[]): boolean {
  const lower = target.toLowerCase();
  return roots.some((root) => {
    // Sürücü harfi ve klasör adlarının büyük/küçüklüğü Windows'ta anlamsızdır.
    const base = root.toLowerCase().replace(/[\\/]+$/, '');
    return lower === base || lower.startsWith(`${base}${path.sep.toLowerCase()}`);
  });
}

function hashFile(file: string): string {
  const hash = crypto.createHash('sha256');
  const handle = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let read = 0;
    // eslint-disable-next-line no-cond-assign
    while ((read = fs.readSync(handle, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, read));
    }
  } finally {
    fs.closeSync(handle);
  }
  return hash.digest('hex');
}

/**
 * Seçilen köklerde yinelenen, büyük ve boş dosyaları tarar.
 * Sembolik bağlantılar, korumalı sistem yolları ve hariç tutulanlar asla izlenmez.
 */
export function scanFiles(options: FileScanOptions): FileScanResult {
  const started = Date.now();
  const roots = options.roots.map(normalizedRoot).filter((root) => {
    if (!root) return false;
    try { return fs.statSync(root).isDirectory(); } catch { return false; }
  });
  const minSize = Math.max(1024, Math.min(1024 * 1024 * 1024, options.minSize || 1024 * 1024));
  const maxResults = Math.max(1000, Math.min(500_000, options.maxResults || 200_000));
  const bySize = new Map<number, Candidate[]>();
  const large: LargeFile[] = [];
  const empty: EmptyItem[] = [];
  const errors: string[] = [];
  let scanned = 0;

  for (const root of roots) {
    const stack: string[] = [root];
    while (stack.length) {
      if (scanned >= maxResults) break;
      const dir = stack.pop();
      if (!dir) continue;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (error) {
        if (errors.length < 50) errors.push(`${dir}: ${(error as Error).message}`);
        continue;
      }
      let children = 0;
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const lower = full.toLowerCase();
        if (entry.isSymbolicLink()) continue;
        if (isExcludedPath(full) || isProtectedPath(full) || isRuntimePath(full)) continue;
        if (lower.endsWith('.disabled')) continue;
        children += 1;
        try {
          if (entry.isDirectory()) {
            stack.push(full);
            continue;
          }
          if (!entry.isFile()) continue;
          const stat = fs.statSync(full);
          scanned += 1;
          if (stat.size === 0) {
            if (empty.length < 500) empty.push({ path: full, kind: 'file', size: 0 });
            continue;
          }
          if (stat.size >= 20 * 1024 * 1024) {
            large.push({ path: full, size: stat.size, modified: stat.mtime.toISOString() });
          }
          if (stat.size >= minSize) {
            const group = bySize.get(stat.size) || [];
            group.push({ path: full, size: stat.size, modified: stat.mtime.toISOString() });
            bySize.set(stat.size, group);
          }
        } catch (error) {
          if (errors.length < 50) errors.push(`${full}: ${(error as Error).message}`);
        }
      }
      if (children === 0 && dir !== root && !isExcludedPath(dir) && !isProtectedPath(dir) && !isRuntimePath(dir)) {
        if (empty.length < 500) empty.push({ path: dir, kind: 'folder', size: 0 });
      }
    }
  }

  const duplicates: DuplicateGroup[] = [];
  let hashed = 0;
  for (const [size, candidates] of bySize) {
    if (candidates.length < 2) continue;
    const byHash = new Map<string, string[]>();
    for (const candidate of candidates) {
      if (hashed >= 20_000) break;
      try {
        const hash = hashFile(candidate.path);
        hashed += 1;
        const list = byHash.get(hash) || [];
        list.push(candidate.path);
        byHash.set(hash, list);
      } catch (error) {
        if (errors.length < 50) errors.push(`${candidate.path}: ${(error as Error).message}`);
      }
    }
    for (const [hash, files] of byHash) {
      if (files.length < 2) continue;
      duplicates.push({ hash, size, files: files.sort((a, b) => a.localeCompare(b)) });
    }
  }
  duplicates.sort((a, b) => b.size * (b.files.length - 1) - a.size * (a.files.length - 1));
  large.sort((a, b) => b.size - a.size);
  empty.sort((a, b) => a.path.localeCompare(b.path));

  const wasted = duplicates.reduce((total, group) => total + group.size * (group.files.length - 1), 0);
  if (!roots.length) errors.unshift(m('Taranacak geçerli klasör seçilmedi.', 'No valid folder to scan was selected.'));
  // Referans kökleri yalnızca silmede korunur; taramada görünür kalır.
  return {
    scanned,
    duplicates: duplicates.slice(0, 500),
    large: large.slice(0, 100),
    empty: empty.slice(0, 200),
    wasted,
    durationMs: Date.now() - started,
    errors,
  };
}

/** Seçilen dosyaları referans köklerine dokunmadan Geri Dönüşüm Kutusu'na/ kalıcı olarak kaldırır. */
export async function deleteScannedFiles(paths: string[], referenceRoots: string[], mode: 'recycle' | 'permanent'): Promise<DeleteResult[]> {
  const references = referenceRoots.map(normalizedRoot).filter(Boolean);
  const allowed: string[] = [];
  const blocked = new Set<string>();
  for (const item of paths) {
    if (underRoots(normalizedRoot(item), references)) blocked.add(item);
    else allowed.push(item);
  }
  const items = allowed.map((item) => {
    let size = 0;
    let kind: 'file' | 'folder' = 'file';
    try {
      const stat = fs.statSync(item);
      size = stat.isDirectory() ? 0 : stat.size;
      kind = stat.isDirectory() ? 'folder' : 'file';
    } catch { /* zaten silinmiş olabilir */ }
    return { path: item, kind, size, reason: m('Dosya tarayıcı seçimi', 'File scanner selection') };
  });
  const processed = await deleteLeftovers(items, mode);
  const byPath = new Map(processed.map((result) => [result.path, result]));
  return paths.map((item) => blocked.has(item)
    ? { path: item, ok: false, message: m('Referans klasör; atlandı.', 'Reference folder; skipped.') }
    : byPath.get(item) || { path: item, ok: false, message: m('İşlem sonucu alınamadı.', 'No operation result was received.') });
}
