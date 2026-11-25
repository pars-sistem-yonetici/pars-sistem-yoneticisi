import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type { PackageBackupEntry, PackageBackupFile, PackageBackupOverview, PackageBackupResult, PackageImportResult } from '../../shared/types';
import { LogFn, runCommand } from '../util';

/** Yedeklerin uygulama veri klasöründe, exe yanında değil, tutulur. */
export function backupFolder(): string {
  return path.join(app.getPath('userData'), 'package_backups');
}

function ensureFolder(): string {
  const folder = backupFolder();
  fs.mkdirSync(folder, { recursive: true });
  return folder;
}

function stamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

interface WingetExport {
  Sources?: Array<{
    SourceDetails?: { Identifier?: string; Name?: string };
    Packages?: Array<{ PackageIdentifier?: string; Version?: string }>;
  }>;
}

function readExport(file: string): PackageBackupEntry[] {
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as WingetExport;
  const entries: PackageBackupEntry[] = [];
  for (const source of data.Sources || []) {
    const sourceName = String(source.SourceDetails?.Identifier || source.SourceDetails?.Name || 'winget');
    for (const pkg of source.Packages || []) {
      const id = String(pkg.PackageIdentifier || '').trim();
      if (!id) continue;
      entries.push({
        id,
        name: id.split('.').pop() || id,
        version: String(pkg.Version || '').trim(),
        source: sourceName,
        selected: true,
      });
    }
  }
  return entries;
}

export function listBackups(): PackageBackupOverview {
  const folder = backupFolder();
  const files: PackageBackupFile[] = [];
  try {
    for (const name of fs.readdirSync(folder)) {
      if (!name.toLowerCase().endsWith('.json')) continue;
      const full = path.join(folder, name);
      try {
        const stat = fs.statSync(full);
        if (!stat.isFile()) continue;
        const entries = readExport(full);
        files.push({
          path: full,
          name,
          createdAt: stat.mtime.toISOString(),
          count: entries.length,
          size: stat.size,
        });
      } catch {
        // Bozuk/yarıda kalmış yedek dosyaları listelenmez.
      }
    }
  } catch {
    // Klasör henüz oluşmamış olabilir.
  }
  files.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { folder, files };
}

export function readBackup(filePath: string): PackageBackupEntry[] {
  const folder = path.resolve(backupFolder());
  const target = path.resolve(filePath);
  if (!target.startsWith(`${folder}${path.sep}`)) throw new Error('Yedek dosyası yalnızca uygulama yedek klasöründen okunabilir.');
  return readExport(target);
}

export async function exportPackages(onLine?: LogFn): Promise<PackageBackupResult> {
  const folder = ensureFolder();
  const target = path.join(folder, `paket-yedek-${stamp()}.json`);
  try {
    const result = await runCommand(
      'winget',
      ['export', '-o', target, '--accept-source-agreements'],
      onLine,
      5 * 60 * 1000,
    );
    const text = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
    if (result.code !== 0 || !text.trim()) {
      try { if (fs.existsSync(target)) fs.unlinkSync(target); } catch { /* ignore */ }
      return {
        ok: false,
        path: '',
        count: 0,
        message: `winget dışa aktarma başarısız (kod ${result.code}). ${(result.stderr || result.text).slice(-300)}`.trim(),
      };
    }
    const entries = readExport(target);
    if (!entries.length) {
      try { fs.unlinkSync(target); } catch { /* ignore */ }
      return { ok: false, path: '', count: 0, message: 'winget boş bir liste döndürdü; yedek oluşturulmadı.' };
    }
    return { ok: true, path: target, count: entries.length, message: `${entries.length} paket yedeklendi.` };
  } catch (error) {
    try { if (fs.existsSync(target)) fs.unlinkSync(target); } catch { /* ignore */ }
    return { ok: false, path: '', count: 0, message: (error as Error).message };
  }
}

export async function importPackages(filePath: string, idents: string[], onLine?: LogFn): Promise<PackageImportResult> {
  const folder = path.resolve(backupFolder());
  const source = path.resolve(filePath);
  if (!source.startsWith(`${folder}${path.sep}`)) throw new Error('Yedek dosyası yalnızca uygulama yedek klasöründen okunabilir.');
  const entries = readExport(source).filter((item) => idents.includes(item.id));
  if (!entries.length) throw new Error('Geri yüklenecek paket seçilmedi.');

  // seçili paketlerden geçici, winget şemasına uygun bir dosya üretilir.
  const data = JSON.parse(fs.readFileSync(source, 'utf8')) as WingetExport;
  const filtered: WingetExport = {
    ...data,
    Sources: (data.Sources || [])
      .map((group) => ({
        ...group,
        Packages: (group.Packages || []).filter((pkg) => idents.includes(String(pkg.PackageIdentifier || ''))),
      }))
      .filter((group) => (group.Packages || []).length > 0),
  };
  const staging = path.join(ensureFolder(), `import-${stamp()}.json`);
  fs.writeFileSync(staging, JSON.stringify(filtered, null, 2), 'utf8');
  try {
    const result = await runCommand(
      'winget',
      [
        'import', '-i', staging,
        '--accept-source-agreements', '--accept-package-agreements',
        '--ignore-unavailable', '--disable-interactivity',
      ],
      onLine,
      30 * 60 * 1000,
    );
    return {
      total: entries.length,
      ok: result.code === 0,
      message: result.code === 0 ? `${entries.length} paket için içe aktarma tamamlandı.` : `winget içe aktarma kod ${result.code}.`,
      lines: [...result.lines, ...result.stderr.split(/\r?\n/).filter(Boolean)].slice(-200),
    };
  } finally {
    try { fs.unlinkSync(staging); } catch { /* ignore */ }
  }
}
