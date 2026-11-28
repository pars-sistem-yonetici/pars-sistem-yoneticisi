# Pars Sistem Yöneticisi 1.7.0

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

- **Kurulum:** `Pars Sistem Yoneticisi Setup 1.7.0.exe` (NSIS, başlat menüsü + masaüstü kısayolu) — 85.493.782 bayt
  - SHA-256: `a17cffb5561fde97876d6954e2374d37ee9ff6934cb39d329c74b03ff7b72f5d`
  - SHA-512: `441849d53698960802993904ca40efce5fe5926c754d93ab2761a703186b85e5038fd9c89e2ef5dcb4281a9537ecc45c0d34485a894f80eb5a4f0e3bea636638`
- **Portable:** `ParsSistemYoneticisi-Portable.exe` — 85.279.655 bayt
  - SHA-256: `be9eb1a9664e5aa3f3549f78c6330f1b8f3fddb644eae4b647d500197e056980`
  - SHA-512: `b146b0d5ca73c1bddd441a7762facf0a56630d0fd59b2c5d85fd2b95dd9175cf53819957ea7af1b7c64151d309762e79021add120f620d7b9d57596e1b40887c`

Windows 10 (1809+) / Windows 11 x64 gereklidir. Kurulum exe’si winget eksikse resmi kaynaktan kurar; portable sürümde winget “Gerekli bileşenler” panelinden kurulabilir. Chocolatey, npm ve Scoop taramaları yalnızca ilgili araç kuruluysa seçilebilir.
Uygulama yönetici izinleriyle çalışır; açılışta UAC onayı görünür.

> İmzasız dağıtım olduğu için SmartScreen uyarısı çıkabilir. İndirme sayfasındaki SHA-256
> özetleriyle dosya bütünlüğünü doğrulayabilirsiniz.
