import fs from 'fs';
import path from 'path';
import type { DiskAnalysisResult, DiskExtension, DiskTreeNode, LargeFile } from '../../shared/types';
import { directorySize, isProtectedPath, isRuntimePath } from '../util';
import { m } from '../i18n-main';
import { isExcludedPath } from './exclusions';

interface WalkResult {
  size: number;
  files: number;
}

const MAX_DEPTH = 3;
const MAX_CHILDREN = 300;
const MAX_NODES = 6000;
const MAX_TOP_FILES = 60;

/** Bir sürücü/klasörün alan dağılımını tek geçişte çıkarır (salt okunur). */
export function analyzeDisk(rootInput: string): DiskAnalysisResult {
  const started = Date.now();
  const noExtension = m('(uzantısız)', '(no extension)');
  let root = '';
  try { root = path.resolve(rootInput); } catch { /* geçersiz */ }
  const errors: string[] = [];
  const empty: DiskAnalysisResult = {
    root, total: 0, files: 0, folders: 0, topFiles: [], extensions: [], tree: [],
    durationMs: Date.now() - started,
    errors: [m('Taranacak geçerli bir klasör seçilmedi.', 'No valid folder to scan was selected.')],
  };
  if (!root || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) return empty;

  const large: LargeFile[] = [];
  const extensions = new Map<string, { size: number; files: number }>();
  let nodes = 0;
  let folders = 0;

  const walk = (dir: string, depth: number): WalkResult => {
    nodes += 1;
    let size = 0;
    let files = 0;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      if (errors.length < 50) errors.push(`${dir}: ${(error as Error).message}`);
      return { size: 0, files: 0 };
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink() || isExcludedPath(full) || isProtectedPath(full) || isRuntimePath(full)) continue;
      try {
        if (entry.isFile()) {
          const stat = fs.statSync(full);
          size += stat.size;
          files += 1;
          const ext = path.extname(full).toLowerCase() || noExtension;
          const row = extensions.get(ext) || { size: 0, files: 0 };
          row.size += stat.size;
          row.files += 1;
          extensions.set(ext, row);
          if (stat.size >= 20 * 1024 * 1024) {
            large.push({ path: full, size: stat.size, modified: stat.mtime.toISOString() });
          }
        } else if (entry.isDirectory() && nodes < MAX_NODES) {
          folders += 1;
          const child = depth < MAX_DEPTH
            ? walk(full, depth + 1)
            : { size: directorySize(full, 100_000, (target) => isExcludedPath(target) || isProtectedPath(target) || isRuntimePath(target)), files: 0 };
          size += child.size;
          files += child.files;
        }
      } catch (error) {
        if (errors.length < 50) errors.push(`${full}: ${(error as Error).message}`);
      }
    }
    return { size, files };
  };

  const tree: DiskTreeNode[] = [];
  let rootSize = 0;
  let rootFiles = 0;
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch (error) {
    errors.push(`${root}: ${(error as Error).message}`);
  }

  for (const entry of entries) {
    if (tree.length >= MAX_CHILDREN) break;
    const full = path.join(root, entry.name);
    if (entry.isSymbolicLink() || isExcludedPath(full) || isProtectedPath(full) || isRuntimePath(full)) continue;
    try {
      if (entry.isFile()) {
        const stat = fs.statSync(full);
        rootSize += stat.size;
        rootFiles += 1;
        const ext = path.extname(full).toLowerCase() || noExtension;
        const row = extensions.get(ext) || { size: 0, files: 0 };
        row.size += stat.size;
        row.files += 1;
        extensions.set(ext, row);
        if (stat.size >= 20 * 1024 * 1024) large.push({ path: full, size: stat.size, modified: stat.mtime.toISOString() });
      } else if (entry.isDirectory()) {
        folders += 1;
        const result = walk(full, 1);
        rootSize += result.size;
        rootFiles += result.files;
        tree.push({
          name: entry.name,
          path: full,
          size: result.size,
          files: result.files,
          children: [],
        });
      }
    } catch (error) {
      if (errors.length < 50) errors.push(`${full}: ${(error as Error).message}`);
    }
  }

  // Treemap için alt klasörleri de ekle; derinlik sınırı performansı korur.
  for (const node of tree) {
    if (nodes >= MAX_NODES) break;
    let children: fs.Dirent[];
    try { children = fs.readdirSync(node.path, { withFileTypes: true }); } catch { continue; }
    for (const entry of children) {
      if (node.children.length >= 40 || nodes >= MAX_NODES) break;
      const full = path.join(node.path, entry.name);
      if (!entry.isDirectory() || entry.isSymbolicLink() || isExcludedPath(full) || isProtectedPath(full) || isRuntimePath(full)) continue;
      nodes += 1;
      const size = directorySize(full, 100_000, (target) => isExcludedPath(target) || isProtectedPath(target) || isRuntimePath(target));
      node.children.push({ name: entry.name, path: full, size, files: 0, children: [] });
    }
  }

  large.sort((a, b) => b.size - a.size);
  const extensionRows: DiskExtension[] = [...extensions.entries()]
    .map(([extension, row]) => ({ extension, size: row.size, files: row.files }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 40);

  return {
    root,
    total: rootSize,
    files: rootFiles,
    folders,
    topFiles: large.slice(0, MAX_TOP_FILES),
    extensions: extensionRows,
    tree: tree.sort((a, b) => b.size - a.size),
    durationMs: Date.now() - started,
    errors,
  };
}
