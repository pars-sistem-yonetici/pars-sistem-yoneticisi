# Pars Sistem Yöneticisi 1.4.0

Kötü amaçlı yazılım sekmesi sekiz salt-okunur motorla genişletildi; İngilizce denetimi ana süreç, katalog ve bulgulara kadar yaydırıldı; uygulama ikonları renkli hâle getirildi ve self-update sonrası otomatik yeniden başlatma eklendi.

## Bu sürümde

- **Sekiz salt-okunur güvenlik motoru:** `signatures`, `heuristics`, `scripts`, `integrity`, `persistence`, `defender`, `hosts` ve `browser`. Her motorun ilerlemesi ve iptali ayrı izlenir; `scanned` alanı gerçek incelenen nesne sayısını gösterir.
- **Kullanılabilir bulgu raporu:** Arama, motor/ciddiyet filtreleri, metin ve JSON dışa aktarma eklendi. Bulgu başlıkları ve ayrıntıları İngilizce dil seçiminde çevrilir.
- **Tam İngilizce denetimi:** Ana süreç mesajları, doğrulama hataları, dışa aktarma başlıkları, güncelleyici iletişimi ve 480 anahtarlık uygulama kataloğu İngilizceye taşındı. Görünür Türkçe JSX metni ve çakışan/eksik çeviri anahtarı kalmadı.
- **Renkli uygulama ikonları:** Katalog kartlarında tek renkli logos yerine renkli favicon kullanılıyor; doğrudan renkli ikonlar korunuyor. Kurulu uygulama ikonu `DisplayIcon` üzerinden 500 uygulamaya kadar çıkarılıyor; arama, başlangıç, bloatware ve kalıntı pencerelerinde gerçek ikon gösteriliyor.
- **Güncelleme sonrası yeniden başlatma:** NSIS kurulumu `--force-run` ile tamamlandığında uygulamayı kendiliğinden açıyor; uygulama 1,5 saniye sonra kapanıyor. Portable modda otomatik yeniden başlatma yok, kurulum dosyası dosya gezgininde gösteriliyor.
- **Güvenlik modeli korundu:** Yönetici izni, açık onay, zorunlu yedek, salt-okunur tarama, timeout’lar ve dışlanan yollar değişmedi. `UserChoice`, COM/CLSID, servisler, SharedDLLs, yazı tipleri ve ODBC otomatik silinmez; Geri Dönüşüm Kutusu varsayılan kalır.
- **1.3.0’dan gelenler:** 249 uygulamalık katalog ve doğrulanmış ikonlar, vektör arayüz ikonları, gömülü winget kurulumu ve eski sürüm algılama akışı sürüyor. Uygulama verileri kaldırma sırasında silinmez.

## Ekran görüntüleri

Görseller 1.3.0 arayüzünden alınmıştır; 1.4.0 arayüzü aynı düzeni korur.

| Anasayfa | Kurulu Uygulamalar |
| --- | --- |
| ![Anasayfa](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-home.png) | ![Kurulu uygulamalar](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-apps.png) |
| ![Güncellemeler](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-updates.png) | ![Uygulama Kütüphanesi](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-library.png) |
| ![Sağ tık menüsü](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-context.png) | |

## İndirme

- **Kurulum:** `Pars Sistem Yoneticisi Setup 1.4.0.exe` (NSIS, başlat menüsü + masaüstü kısayolu) — 85.463.607 bayt
  - SHA-256: `59981085f2d3ad08b1ab516004300a27108a668073470b43ad5c1fd3c9ab445a`
  - SHA-512: `6d889c00495e1dd8a74070b6f9ac0cca2d11516366198908a3731601c8b6e0f83b4b5ca0eaa55ce3802c6318b5c11fd65e09ff42b1b8406484a0487a49b96b62`
- **Portable:** `ParsSistemYoneticisi-Portable.exe` — 85.249.524 bayt
  - SHA-256: `b8a30016cccd35a68929493ea68a5354c75fb309804fb5d92929c1feeeef4cc7`

Windows 10 (1809+) / Windows 11 x64 gereklidir. Kurulum exe’si winget eksikse resmi kaynaktan kurar; portable sürümde winget “Gerekli bileşenler” panelinden kurulabilir. Chocolatey, npm ve Scoop taramaları yalnızca ilgili araç kuruluysa seçilebilir.
Uygulama yönetici izinleriyle çalışır; açılışta UAC onayı görünür.

> İmzasız dağıtım olduğu için SmartScreen uyarısı çıkabilir. İndirme sayfasındaki SHA-256
> özetleriyle dosya bütünlüğünü doğrulayabilirsiniz.
