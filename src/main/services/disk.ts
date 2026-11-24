import fs from 'fs';
import path from 'path';
import type { CleanResult, CleanTarget } from '../../shared/types';
import { LogFn, directorySize, humanSize, isProtectedPath, isRuntimePath, isSafeEntry, psLiteral, removeTree, runCommand, runPowerShell } from '../util';
import { exclusionReason, isExcludedPath } from './exclusions';

function env(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

/**
 * Sistem sürücüsündeki hedeflere ek olarak, verilen diğer sabit sürücülerdeki
 * kök Temp klasörlerini de taramaya ekler. Kullanıcı yalnızca temp verisini
 * temizleyebilir; sürücü köklerinin kendisi hiçbir zaman silinmez.
 */
export function targetsWithDrives(drives: string[] = []): CleanTarget[] {
  const items = targets();
  const systemDrive = (env('SystemDrive', 'C:') || 'C:').replace(/[:\\/]/g, '').toUpperCase();
  for (const drive of drives) {
    const letter = drive.replace(/[:\\/]/g, '').toUpperCase();
    if (!/^[A-Z]$/.test(letter) || letter === systemDrive) continue;
    const tempRoot = `${letter}:\\Temp`;
    if (!fs.existsSync(tempRoot)) continue;
    items.push({
      key: `drive_temp_${letter}`,
      name: `${letter}: Temp`,
      description: `${drive} sürücüsündeki kök Temp klasörü.`,
      dirs: [tempRoot], files: [], action: '', needsAdmin: true,
      size: 0, count: 0, available: true,
    });
  }
  return items;
}

export function targets(): CleanTarget[] {
  const home = env('USERPROFILE', 'C:\\Users\\user');
  const local = env('LOCALAPPDATA', path.join(home, 'AppData', 'Local'));
  const windows = env('WINDIR', 'C:\\Windows');
  const programData = env('PROGRAMDATA', 'C:\\ProgramData');
  const temp = env('TEMP', path.join(local, 'Temp'));
  const explorer = path.join(local, 'Microsoft', 'Windows', 'Explorer');

  const items: CleanTarget[] = [
    { key: 'user_temp', name: 'Kullanıcı Geçici Dosyaları', description: 'Uygulamaların oluşturduğu geçici dosyalar (%TEMP%).', dirs: [temp], files: [], action: '', needsAdmin: false, size: 0, count: 0, available: false },
    { key: 'windows_temp', name: 'Windows Geçici Dosyaları', description: 'Sistem genelindeki geçici dosyalar; bazıları açık uygulamalarca kullanılabilir.', dirs: [path.join(windows, 'Temp')], files: [], action: '', needsAdmin: true, size: 0, count: 0, available: false },
    { key: 'thumbnails', name: 'Küçük Resim Önbelleği', description: 'Gezginin küçük resim/simge veritabanları; gerektiğinde yeniden oluşturulur.', dirs: [], files: [path.join(explorer, 'thumbcache_*.db'), path.join(explorer, 'iconcache_*.db')], action: '', needsAdmin: false, size: 0, count: 0, available: false },
    { key: 'windows_update', name: 'Windows Update İndirmeleri', description: 'İndirilen güncelleme kurulum dosyaları; gerekirse yeniden indirilir.', dirs: [path.join(windows, 'SoftwareDistribution', 'Download')], files: [], action: '', needsAdmin: true, size: 0, count: 0, available: false },
    { key: 'error_reports', name: 'Hata Raporları', description: 'Windows Error Reporting kuyruğu ve arşivi.', dirs: [
      path.join(local, 'Microsoft', 'Windows', 'WER', 'ReportQueue'),
      path.join(local, 'Microsoft', 'Windows', 'WER', 'ReportArchive'),
      path.join(programData, 'Microsoft', 'Windows', 'WER', 'ReportQueue'),
      path.join(programData, 'Microsoft', 'Windows', 'WER', 'ReportArchive'),
    ], files: [], action: '', needsAdmin: false, size: 0, count: 0, available: false },
    { key: 'internet_cache', name: 'İnternet Önbelleği', description: 'WinINet geçici internet dosyaları.', dirs: [path.join(local, 'Microsoft', 'Windows', 'INetCache')], files: [], action: '', needsAdmin: false, size: 0, count: 0, available: false },
    { key: 'dns', name: 'DNS Önbelleği', description: 'Çözülmüş alan adı kayıtlarını temizler (ipconfig /flushdns).', dirs: [], files: [], action: 'flushdns', needsAdmin: false, size: 0, count: 0, available: true },
    { key: 'recycle', name: 'Geri Dönüşüm Kutusu', description: 'Silinmiş dosyaları kalıcı olarak kaldırır. GERİ ALINAMAZ!', dirs: [], files: [], action: 'recycle', needsAdmin: false, size: 0, count: 0, available: true },
  ];

  for (const item of items) {
    if (item.action) continue;
    item.available = item.dirs.some((dir) => fs.existsSync(dir)) || item.files.some((pattern) => matchGlob(pattern).length > 0);
  }
  return items;
}

function matchGlob(pattern: string): string[] {
  const dir = path.dirname(pattern);
  const regex = new RegExp(`^${path.basename(pattern).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`, 'i');
  try {
    return fs.readdirSync(dir).filter((name) => regex.test(name)).map((name) => path.join(dir, name));
  } catch {
    return [];
  }
}

interface Entry { filePath: string; isDir: boolean }

function entries(target: CleanTarget): Entry[] {
  const seen = new Set<string>();
  const result: Entry[] = [];
  for (const root of target.dirs) {
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) continue;
    let children: fs.Dirent[];
    try { children = fs.readdirSync(root, { withFileTypes: true }); } catch { continue; }
    for (const child of children) {
      const full = path.join(root, child.name);
      if (seen.has(full.toLowerCase()) || !isSafeEntry(full, root) || isExcludedPath(full)) continue;
      seen.add(full.toLowerCase());
      result.push({ filePath: full, isDir: child.isDirectory() && !child.isSymbolicLink() });
    }
  }
  for (const pattern of target.files) {
    for (const full of matchGlob(pattern)) {
      if (seen.has(full.toLowerCase()) || !isSafeEntry(full, path.dirname(pattern)) || isExcludedPath(full)) continue;
      seen.add(full.toLowerCase());
      result.push({ filePath: full, isDir: false });
    }
  }
  return result;
}

export function scan(items: CleanTarget[], onLine?: LogFn): CleanTarget[] {
  for (const target of items) {
    if (target.action) {
      target.size = 0;
      target.count = 0;
      target.available = true;
      continue;
    }
    let total = 0;
    let count = 0;
    for (const entry of entries(target)) {
      total += entry.isDir ? directorySize(entry.filePath, 100_000, isExcludedPath) : safeFileSize(entry.filePath);
      count += 1;
    }
    target.size = total;
    target.count = count;
    target.available = count > 0;
    onLine?.(`Taranıyor: ${target.name} — ${count} öğe, ${humanSize(total)}`);
  }
  return items;
}

function safeFileSize(filePath: string): number {
  try { return fs.statSync(filePath).size; } catch { return 0; }
}

export async function clean(items: CleanTarget[], onLine?: LogFn, recycleDrives: string[] = []): Promise<CleanResult[]> {
  const results: CleanResult[] = [];
  for (const target of items) {
    let freed = 0;
    let failures = 0;
    let ok = true;
    let message = '';

    if (target.action === 'flushdns') {
      const result = await runCommand('ipconfig', ['/flushdns'], onLine, 60_000);
      ok = result.code === 0;
      message = ok ? 'DNS önbelleği temizlendi' : (result.text.trim().slice(0, 200) || 'ipconfig hatası');
    } else if (target.action === 'recycle') {
      const letters = [...new Set(recycleDrives.map((drive) => drive.replace(/[:\\/]/g, '').toUpperCase()).filter((letter) => /^[A-Z]$/.test(letter)))];
      const list = letters.length ? letters : [(env('SystemDrive', 'C:').replace(/[:\\/]/g, '') || 'C').toUpperCase()];
      const script = list.map((letter) => `
Clear-RecycleBin -DriveLetter ${psLiteral(letter)} -Force -ErrorAction SilentlyContinue
`).join('') + '\nif ($?) { "OK" } else { "HATA" }';
      const result = await runPowerShell(script, onLine, 120_000);
      ok = /OK/.test(result.text);
      message = ok ? `${list.join(', ')}: Geri Dönüşüm Kutusu boşaltıldı` : 'Geri Dönüşüm Kutusu boşaltılamadı';
    } else {
      for (const entry of entries(target)) {
        try {
          if (isExcludedPath(entry.filePath)) {
            onLine?.(`ATLANDI: ${entry.filePath} — ${exclusionReason(entry.filePath)}`);
            continue;
          }
          if (isProtectedPath(entry.filePath) || isRuntimePath(entry.filePath)) continue;
          if (entry.isDir) {
            freed += removeTree(entry.filePath, isExcludedPath, onLine);
          } else {
            freed += safeFileSize(entry.filePath);
            fs.rmSync(entry.filePath, { force: true });
          }
        } catch (error) {
          failures += 1;
          if (failures <= 5) onLine?.(`ATLANDI: ${entry.filePath} — ${(error as Error).message.slice(0, 120)}`);
        }
      }
      ok = failures === 0;
      message = `${humanSize(freed)} alan açıldı`;
      if (failures) message += `, ${failures} öğe atlandı`;
    }

    results.push({ key: target.key, name: target.name, ok, freed, message });
    onLine?.(`${ok ? 'TAMAM' : 'UYARI'}: ${target.name} — ${message}`);
  }
  return results;
}
