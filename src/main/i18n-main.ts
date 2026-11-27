import { getSettings } from './services/settings';

/**
 * Ana süreçten renderer'a giden kullanıcı mesajları için dil seçimi.
 * Ayarlar henüz okunamadığında LC_LANGUAGE (main.ts applyLocale) kullanılır.
 */
export function m(tr: string, en: string): string {
  let language = process.env.LC_LANGUAGE || 'tr';
  try {
    language = getSettings().language || language;
  } catch {
    // Ayar dosyası ilk açılışta henüz yok olabilir.
  }
  // Renderer'da olduğu gibi: yalnızca Türkçe açıkça seçilirse Türkçe,
  // İngilizce ve çeviri dosyası olan/olmayan tüm diğer diller İngilizceye düşer.
  return language === 'tr' ? tr : en;
}

/** Ana süreç mesajlarında {alan} değişkenlerini doldurur. */
export function mf(tr: string, en: string, vars: Record<string, string | number>): string {
  return m(tr, en).replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''));
}
