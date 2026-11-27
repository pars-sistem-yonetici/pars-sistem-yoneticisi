import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { EN } from '../../shared/i18n';

const BUILT_IN = ['tr', 'en'];

/** Kullanıcının koyduğu ek çevirilerin okunacağı klasör. */
export function localeFolder(): string {
  return path.join(app.getPath('userData'), 'translations');
}

/** Yerleşik diller + gerçek çeviri dosyası bulunan diller. */
export function availableLocales(): string[] {
  const codes = new Set<string>(BUILT_IN);
  for (const folder of [localeFolder(), ...(process.resourcesPath ? [path.join(process.resourcesPath, 'translations')] : [])]) {
    try {
      for (const name of fs.readdirSync(folder)) {
        if (name.endsWith('.json')) codes.add(name.slice(0, -5));
      }
    } catch {
      // Klasör henüz oluşmamış olabilir.
    }
  }
  return [...codes].sort((a, b) => a.localeCompare(b, 'en'));
}

/**
 * Dil sözlüğü: İngilizce varsayılan + kullanıcının translations/<kod>.json dosyası.
 * Türkçe, kaynak metinlerin kendisi olduğu için boş döndürülür.
 */
export function localeDictionary(language: string): Record<string, string> {
  if (language === 'tr') return {};
  // Yerleşik İngilizce sözlük, kullanıcı dosyasıyla geçersiz kılınamaz.
  if (language === 'en') return { ...EN };
  const dictionary: Record<string, string> = { ...EN };
  const candidates = [
    localeFolder(),
    ...(process.resourcesPath ? [path.join(process.resourcesPath, 'translations')] : []),
  ];
  for (const folder of candidates) {
    const file = path.join(folder, `${path.basename(language)}.json`);
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string') dictionary[key] = value;
      }
    } catch {
      // Dosya yoksa veya bozuksa İngilizce varsayılan kullanılır.
    }
  }
  return dictionary;
}

/** Çeviri klasörünü oluşturup yolunu döndürür; arayüz "klasörü aç" için kullanır. */
export function ensureLocaleFolder(): string {
  const folder = localeFolder();
  try { fs.mkdirSync(folder, { recursive: true }); } catch { /* zaten var */ }
  return folder;
}
