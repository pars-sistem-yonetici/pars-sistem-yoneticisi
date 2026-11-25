// Uygulamanın kendi güncellemelerini aldığı varsayılan HTTPS kaynağı.
// Yeni kurulumlarda Ayarlar → Güncelleme kaynağı bu değerle başlar.
export const DEFAULT_UPDATE_SOURCE = 'https://pars-sistem-yonetici.github.io/pars-sistem-yoneticisi/downloads';

/** Ayarlar ve alt menüde kullanılan resmi bağlantılar. */
export const APP_LINKS = {
  github: 'https://github.com/pars-sistem-yonetici/pars-sistem-yoneticisi',
  website: 'https://pars-sistem-yonetici.github.io/pars-sistem-yoneticisi/',
  coffee: 'https://buymeacoffee.com/parssistemyonetici',
  license: 'https://github.com/pars-sistem-yonetici/pars-sistem-yoneticisi/blob/main/LICENSE',
} as const;
