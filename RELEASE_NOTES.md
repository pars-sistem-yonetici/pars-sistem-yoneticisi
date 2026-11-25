# Pars Sistem Yöneticisi 1.0.8

Uygulama Kütüphanesi’ndeki kartlar artık üstteki kategori sekmeleriyle aynı sıralamada gruplanıyor; her grubun üstünde kategori ikonu, adı ve kart sayısı gösteriliyor. 1.0.7’deki güncelleyici düzeltmeleri de korunuyor.

## Bu sürümde

- **Sekmelere göre gruplu liste:** Uygulama Kütüphanesi’nde kartlar kategori sekmelerindeki sırayla diziliyor ve her kategori grubunun üstüne o sekmenin ikonu, kategori adı ve kaç uygulama içerdiği bilgisi ekleniyor. Arama veya paket yöneticisi filtresi uygulandığında başlıklar ve sayılar otomatik güncelleniyor.
- **Seçili kaynak görünürlüğü:** Paket yöneticisi sekmelerinden biri seçildiğinde (winget, Chocolatey, npm veya Scoop) grup başlıklarında hangi kaynağın görüntülendiği ayrı bir etiketle gösteriliyor. “Tümü” seçiliyken bu etiket gizleniyor.
- **1.0.7 güncelleyici düzeltmeleri korundu:** NSIS kurucusu `/S --updated` ile başlatılıyor; eski 1.0.4–1.0.6 istemcilerinin `/SILENT` çağrıları `preInit` uyumluluğuyla sessiz kurulum yapabiliyor. Kurulum hatası artık bildiriliyor, indirmeden önce disk alanı denetleniyor.
- **Güvenlik modeli korundu:** Yönetici izni, açık onay, zorunlu yedek, salt-okunur tarama varsayılanı ve korumalı kayıt/klasör kuralları değişmedi. Kurulum manuel onaylıdır; varsayılan kapalı “kurumsal sessiz” mod isteğe bağlıdır. Eski sürüm algılanıp kaldırılır, uygulama verileri silinmez (`deleteAppDataOnUninstall: false`).

### 1.0.7’den gelenler

Güncelleyici doğru NSIS anahtarlarını kullanıyor, eski istemcilerle uyumlu sessiz kurulum ve anlaşılır disk/bağlantı hata mesajları eklendi.

### 1.0.6’dan gelenler

Uygulama Kütüphanesi filtreleri dock görünümüne taşındı; Güncellemeler winget yanında Chocolatey, npm ve Scoop kaynaklarından da salt-okunur tarama yapabiliyor; kaynak bilincini koruyan güncelleme kuyruğu ve doğru winget listesi eklendi.

## Ekran görüntüleri

Tanıtım sitesi, README ve bu release notu aynı dosyaları kullanır. Görseller 1.0.6 arayüzünden alınmıştır; 1.0.7 yalnızca güncelleyici düzeltmesi içerdiğinden arayüz aynı kalmıştı. 1.0.8’de Uygulama Kütüphanesi’ne eklenen kategori başlıkları nedeniyle `screen-library.png` eski görünümü göstermektedir; diğer ekranlar güncel görünümü yansıtır.

| Anasayfa | Kurulu Uygulamalar |
| --- | --- |
| ![Anasayfa](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-home.png) | ![Kurulu uygulamalar](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-apps.png) |
| ![Güncellemeler](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-updates.png) | ![Uygulama Kütüphanesi](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-library.png) |
| ![Sağ tık menüsü](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-context.png) | |

## İndirme

- **Kurulum:** `Pars Sistem Yoneticisi Setup 1.0.8.exe` (NSIS, başlat menüsü + masaüstü kısayolu)
- **Portable:** `ParsSistemYoneticisi-Portable.exe`

Windows 10 (1809+) / Windows 11 x64 ve güncel App Installer (winget) gereklidir. Chocolatey, npm ve Scoop taramaları yalnızca ilgili araç kuruluysa seçilebilir.
Uygulama yönetici izinleriyle çalışır; açılışta UAC onayı görünür.

> İmzasız dağıtım olduğu için SmartScreen uyarısı çıkabilir. İndirme sayfasındaki SHA-256
> özetleriyle dosya bütünlüğünü doğrulayabilirsiniz.
