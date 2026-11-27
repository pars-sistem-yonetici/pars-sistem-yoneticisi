import fs from 'fs';
import path from 'path';
import type { CleanResult, CleanTarget } from '../../shared/types';
import { LogFn, directorySize, humanSize, isProtectedPath, isRuntimePath, isSafeEntry, removeTree, runCommand, runPowerShell } from '../util';
import { appendCleanupLog, type CleanupLogEntry } from './cleanupLog';
import { exclusionReason, isExcludedPath } from './exclusions';
import { m, mf } from '../i18n-main';

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
      description: mf('{drive} sürücüsündeki kök Temp klasörü.', 'Root Temp folder on drive {drive}.', { drive }),
      dirs: [tempRoot], files: [], action: '', needsAdmin: true,
      size: 0, count: 0, available: true,
    });
  }
  return items;
}

/** Yalnızca gerçek alt klasörleri döner; sembolik bağlantıları asla izlemez. */
function childDirs(root: string): string[] {
  try {
    return fs.readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
      .map((entry) => path.join(root, entry.name));
  } catch {
    return [];
  }
}

/**
 * Edge/Chrome profillerinin yalnızca cache alt klasörleri ile Firefox cache2
 * klasörleri. Profil köklerinin kendisi hiçbir zaman hedefe eklenmez.
 */
function browserCacheDirs(local: string): string[] {
  const roots: string[] = [];
  for (const userData of [
    path.join(local, 'Microsoft', 'Edge', 'User Data'),
    path.join(local, 'Google', 'Chrome', 'User Data'),
  ]) {
    for (const profile of childDirs(userData)) {
      for (const cache of ['Cache', 'Code Cache', 'GPUCache']) {
        const candidate = path.join(profile, cache);
        if (fs.existsSync(candidate)) roots.push(candidate);
      }
    }
  }
  const firefox = path.join(local, 'Mozilla', 'Firefox', 'Profiles');
  for (const profile of childDirs(firefox)) {
    const candidate = path.join(profile, 'cache2');
    if (fs.existsSync(candidate)) roots.push(candidate);
  }
  return roots;
}

/** Yalnızca yeniden indirilebilir paket önbellekleri; proje/node_modules değil. */
function developerCacheDirs(local: string, home: string): string[] {
  return [
    path.join(local, 'npm-cache'),
    path.join(local, 'npm', 'cache'),
    path.join(home, '.nuget', 'packages'),
    path.join(local, 'pip', 'Cache'),
  ];
}

export function targets(): CleanTarget[] {
  const home = env('USERPROFILE', 'C:\\Users\\user');
  const local = env('LOCALAPPDATA', path.join(home, 'AppData', 'Local'));
  const windows = env('WINDIR', 'C:\\Windows');
  const programData = env('PROGRAMDATA', 'C:\\ProgramData');
  const temp = env('TEMP', path.join(local, 'Temp'));
  const explorer = path.join(local, 'Microsoft', 'Windows', 'Explorer');

  const items: CleanTarget[] = [
    { key: 'user_temp', name: m('Kullanıcı Geçici Dosyaları', 'User Temporary Files'), description: m('Uygulamaların oluşturduğu geçici dosyalar (%TEMP%).', 'Temporary files created by applications (%TEMP%).'), dirs: [temp], files: [], action: '', needsAdmin: false, size: 0, count: 0, available: false },
    { key: 'windows_temp', name: m('Windows Geçici Dosyaları', 'Windows Temporary Files'), description: m('Sistem genelindeki geçici dosyalar; bazıları açık uygulamalarca kullanılabilir.', 'System-wide temporary files; some may be in use by open applications.'), dirs: [path.join(windows, 'Temp')], files: [], action: '', needsAdmin: true, size: 0, count: 0, available: false },
    { key: 'thumbnails', name: m('Küçük Resim Önbelleği', 'Thumbnail Cache'), description: m('Gezginin küçük resim/simge veritabanları; gerektiğinde yeniden oluşturulur.', 'Explorer thumbnail/icon databases; recreated as needed.'), dirs: [], files: [path.join(explorer, 'thumbcache_*.db'), path.join(explorer, 'iconcache_*.db')], action: '', needsAdmin: false, size: 0, count: 0, available: false },
    { key: 'windows_update', name: m('Windows Update İndirmeleri', 'Windows Update Downloads'), description: m('İndirilen güncelleme kurulum dosyaları; gerekirse yeniden indirilir.', 'Downloaded update installation files; can be downloaded again if needed.'), dirs: [path.join(windows, 'SoftwareDistribution', 'Download')], files: [], action: '', needsAdmin: true, size: 0, count: 0, available: false },
    { key: 'error_reports', name: m('Hata Raporları', 'Error Reports'), description: m('Windows Error Reporting kuyruğu ve arşivi.', 'Windows Error Reporting queue and archive.'), dirs: [
      path.join(local, 'Microsoft', 'Windows', 'WER', 'ReportQueue'),
      path.join(local, 'Microsoft', 'Windows', 'WER', 'ReportArchive'),
      path.join(programData, 'Microsoft', 'Windows', 'WER', 'ReportQueue'),
      path.join(programData, 'Microsoft', 'Windows', 'WER', 'ReportArchive'),
    ], files: [], action: '', needsAdmin: false, size: 0, count: 0, available: false },
    { key: 'internet_cache', name: m('İnternet Önbelleği', 'Internet Cache'), description: m('WinINet geçici internet dosyaları.', 'WinINet temporary internet files.'), dirs: [path.join(local, 'Microsoft', 'Windows', 'INetCache')], files: [], action: '', needsAdmin: false, size: 0, count: 0, available: false },
    {
      key: 'delivery_optimization', name: m('Delivery Optimization Önbelleği', 'Delivery Optimization Cache'),
      description: m('Windows Update eşler arası indirme önbelleği; gerektiğinde yeniden indirilir.', 'Windows Update peer-to-peer download cache; can be downloaded again if needed.'),
      dirs: [path.join(local, 'Microsoft', 'Windows', 'DeliveryOptimization'), path.join(windows, 'SoftwareDistribution', 'DeliveryOptimization')],
      files: [], action: '', needsAdmin: true, size: 0, count: 0, available: false,
    },
    {
      key: 'browser_cache', name: m('Tarayıcı Önbellekleri', 'Browser Caches'),
      description: m('Yalnızca Edge/Chrome Cache, Code Cache, GPUCache ve Firefox cache2 klasörleri. Çerez, geçmiş ve parolalara dokunulmaz.', 'Only Edge/Chrome Cache, Code Cache, GPUCache and Firefox cache2 folders. Cookies, history and passwords are untouched.'),
      dirs: browserCacheDirs(local), files: [], action: '', needsAdmin: false, size: 0, count: 0, available: false,
    },
    {
      key: 'developer_cache', name: m('Geliştirici Paket Önbellekleri', 'Developer Package Caches'),
      description: m('npm, NuGet ve pip önbellekleri. Paketler gerektiğinde yeniden indirilir; proje klasörleri dahil edilmez.', 'npm, NuGet and pip caches. Packages can be downloaded again if needed; project folders are not included.'),
      dirs: developerCacheDirs(local, home), files: [], action: '', needsAdmin: false, size: 0, count: 0, available: false,
    },
    { key: 'dns', name: m('DNS Önbelleği', 'DNS Cache'), description: m('Çözülmüş alan adı kayıtlarını temizler (ipconfig /flushdns).', 'Clears resolved domain name records (ipconfig /flushdns).'), dirs: [], files: [], action: 'flushdns', needsAdmin: false, size: 0, count: 0, available: true },
    { key: 'recycle', name: m('Geri Dönüşüm Kutusu', 'Recycle Bin'), description: m('Silinmiş dosyaları kalıcı olarak kaldırır. GERİ ALINAMAZ!', 'Permanently removes deleted files. CANNOT BE UNDONE!'), dirs: [], files: [], action: 'recycle', needsAdmin: false, size: 0, count: 0, available: true },
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
    onLine?.(mf('Taranıyor: {name} — {count} öğe, {size}', 'Scanning: {name} — {count} items, {size}', { name: target.name, count, size: humanSize(total) }));
  }
  return items;
}

function safeFileSize(filePath: string): number {
  try { return fs.statSync(filePath).size; } catch { return 0; }
}

export async function clean(items: CleanTarget[], onLine?: LogFn, recycleDrives: string[] = []): Promise<CleanResult[]> {
  const results: CleanResult[] = [];
  const logEntries: CleanupLogEntry[] = [];
  const letters = [...new Set(recycleDrives.map((drive) => drive.replace(/[:\\/]/g, '').toUpperCase()).filter((letter) => /^[A-Z]$/.test(letter)))];
  for (const target of items) {
    let freed = 0;
    let failures = 0;
    let ok = true;
    let message = '';

    if (target.action === 'flushdns') {
      const result = await runCommand('ipconfig', ['/flushdns'], onLine, 60_000);
      ok = result.code === 0;
      message = ok ? m('DNS önbelleği temizlendi', 'DNS cache flushed') : (result.text.trim().slice(0, 200) || m('ipconfig hatası', 'ipconfig error'));
    } else if (target.action === 'recycle') {
      const list = letters.length ? letters : [(env('SystemDrive', 'C:').replace(/[:\\/]/g, '') || 'C').toUpperCase()];
      const driveList = list.map((letter) => `'${letter}'`).join(', ');
      const script = `
$hepsiBasarili = $true
foreach ($harf in @(${driveList})) {
  try { Clear-RecycleBin -DriveLetter $harf -Force -ErrorAction Stop }
  catch { $hepsiBasarili = $false }
}
if ($hepsiBasarili) { 'OK' } else { 'HATA' }
`;
      const result = await runPowerShell(script, onLine, 120_000);
      ok = /OK/.test(result.text);
      message = ok ? mf('{drives}: Geri Dönüşüm Kutusu boşaltıldı', '{drives}: Recycle Bin emptied', { drives: list.join(', ') }) : m('Geri Dönüşüm Kutusu boşaltılamadı', 'Could not empty the Recycle Bin');
    } else {
      for (const entry of entries(target)) {
        try {
          if (isExcludedPath(entry.filePath)) {
            onLine?.(mf('ATLANDI: {path} — {reason}', 'SKIPPED: {path} — {reason}', { path: entry.filePath, reason: exclusionReason(entry.filePath) }));
            continue;
          }
          if (isProtectedPath(entry.filePath) || isRuntimePath(entry.filePath)) continue;
          if (entry.isDir) {
            freed += removeTree(entry.filePath, isExcludedPath, onLine);
          } else {
            const size = safeFileSize(entry.filePath);
            fs.rmSync(entry.filePath, { force: true });
            freed += size;
          }
        } catch (error) {
          failures += 1;
          if (failures <= 5) onLine?.(mf('ATLANDI: {path} — {reason}', 'SKIPPED: {path} — {reason}', { path: entry.filePath, reason: (error as Error).message.slice(0, 120) }));
        }
      }
      ok = failures === 0;
      message = mf('{size} alan açıldı', '{size} of disk space freed', { size: humanSize(freed) });
      if (failures) message += mf(', {count} öğe atlandı', ', {count} items skipped', { count: failures });
    }

    results.push({ key: target.key, name: target.name, ok, freed, message });
    logEntries.push({
      time: new Date().toISOString(),
      key: target.key,
      name: target.name,
      action: target.action || 'delete',
      ok,
      freed,
      message,
      count: target.count,
      dirs: target.dirs,
      files: target.files,
      ...(target.action === 'recycle' ? { recycleDrives: letters } : {}),
    });
    onLine?.(mf('{status}: {name} — {message}', '{status}: {name} — {message}', { status: ok ? m('TAMAM', 'OK') : m('UYARI', 'WARNING'), name: target.name, message }));
  }
  appendCleanupLog(logEntries);
  return results;
}
