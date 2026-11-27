import fs from 'fs';
import path from 'path';
import { expandVars } from '../util';
import { getSettings } from './settings';
import { m, mf } from '../i18n-main';

/** Kullanıcının hariç tuttuğu uzantıyı güvenli, karşılaştırılabilir biçime çevirir. */
export function normalizeExtension(value: string): string {
  const cleaned = value.trim().replace(/^\*?\.?/, '').toLowerCase();
  if (!/^[a-z0-9]{1,12}$/.test(cleaned)) return '';
  return `.${cleaned}`;
}

function normalizedFolders(): string[] {
  return getSettings()
    .excludedFolders.map((folder) => {
      try {
        return path.resolve(expandVars(folder.trim())).toLowerCase().replace(/[\\/]+$/, '');
      } catch {
        return '';
      }
    })
    .filter(Boolean);
}

function normalizedExtensions(): string[] {
  return getSettings().excludedExtensions.map(normalizeExtension).filter(Boolean);
}

/** Bir yol hariç tutulan klasörlerden birinin içindeyse veya uzantısı hariç tutulmuşsa true. */
export function isExcludedPath(target: string): boolean {
  if (!target) return false;
  let resolved: string;
  try {
    resolved = path.resolve(expandVars(target)).toLowerCase();
  } catch {
    return false;
  }
  if (normalizedExtensions().includes(path.extname(resolved).toLowerCase())) return true;
  return normalizedFolders().some((folder) => resolved === folder || resolved.startsWith(`${folder}${path.sep.toLowerCase()}`));
}

/** Hariç tutma nedenini log mesajı için döndürür. */
/** Klasörün kendisinde veya altında hariç tutulan bir öğe var mı? */
export function hasExcludedDescendant(target: string): boolean {
  if (isExcludedPath(target)) return true;
  const stack = [target];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (isExcludedPath(full)) return true;
      if (entry.isDirectory() && !entry.isSymbolicLink()) stack.push(full);
    }
  }
  return false;
}

export function exclusionReason(target: string): string {
  const ext = path.extname(target).toLowerCase();
  if (ext && normalizedExtensions().includes(ext)) {
    return mf('Hariç tutulan uzantı ({ext})', 'Excluded extension ({ext})', { ext });
  }
  return m('Hariç tutulan klasör', 'Excluded folder');
}
