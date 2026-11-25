import fs from 'fs';
import path from 'path';

export interface CleanupLogEntry {
  time: string;
  key: string;
  name: string;
  action: string;
  ok: boolean;
  freed: number;
  message: string;
  count: number;
  dirs: string[];
  files: string[];
  recycleDrives?: string[];
}

function folder(): string {
  const local = process.env.LOCALAPPDATA;
  const base = local && local.trim() ? local : path.join(process.env.USERPROFILE || '.', 'AppData', 'Local');
  return path.join(base, 'ParsSistemYoneticisi', 'logs');
}

/** Disk temizleme kaydının kalıcı JSONL dosyası. */
export function cleanupLogPath(): string {
  return path.join(folder(), 'disk-cleanup.jsonl');
}

export function ensureCleanupLog(): string {
  const file = cleanupLogPath();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // İlk temizlikten önce de "Temizlik kaydını aç" çalışsın diye boş dosyayı oluştur.
    fs.closeSync(fs.openSync(file, 'a'));
  } catch { /* dosya zaten var veya yazılamıyor */ }
  return file;
}

/** Temizleme sonuçlarını yalnızca ekleyerek yazar; önceki kayıtlar korunur. */
export function appendCleanupLog(entries: CleanupLogEntry[]): void {
  if (!entries.length) return;
  try {
    const file = ensureCleanupLog();
    fs.appendFileSync(file, `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`, 'utf8');
  } catch {
    // Kayıt yazılamazsa temizlik sonucu yine de kullanıcıya döndürülür.
  }
}
