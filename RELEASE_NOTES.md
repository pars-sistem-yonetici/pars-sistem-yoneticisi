# Pars Sistem Yöneticisi 1.0.9

Alt bilgi ve tüm sürüm etiketleri artık her dağıtım kanalında 1.0.9’u gösteriyor; 1.0.7 ve 1.0.8 kullananlar self-updater üzerinden güncelleme onayı alabiliyor.

## Bu sürümde

- **Alt bilgi düzeltmesi dağıtıldı:** 1.0.8 exe’sinin içinde eski `v1.0.7` alt bilgisi kalmıştı. Kaynak artık doğru ve sürüm numarası bir arttığı için güncelleyici 1.0.8 kurulu sistemlerde yeni sürümü algılıyor; SHA-512 doğrulaması ve açık onaydan sonra `/S --updated` ile sessiz kurulum yapılıyor.
- **Site ve Blogger metinleri temizlendi:** İndirme sayfası, Blogger HTML’i ve `blogger.js` içinde kalan `1.0.7` sürüm metinleri ve eski sürüm URL’leri kaldırıldı. İndirme düğmeleri artık doğrudan GitHub Releases adreslerini kullanıyor; JavaScript çalışmasa da bağlantı doğru dosyayı gösteriyor.
- **Yayın üretimi sağlamlaştırıldı:** `ci-release.js` artık manifestteki eski sürüme bakmadan site dosyalarındaki tüm sürüm belirteçlerini hedef sürüme getiriyor. 1.0.9; kaynak dosyalar `main`’e eşitlendikten sonra tek kaynaktan `workflow_dispatch` ile derlendi; etiket ile dosya eşitlemesi arasındaki yarış ortadan kaldırıldı.
- **1.0.8’den gelenler:** Uygulama Kütüphanesi kartları kategori sekmeleriyle aynı sıralamada gruplanıyor; her grubun üstünde sekme ikonu, adı ve kart sayısı, paket yöneticisi seçiliyse kaynak etiketi gösteriliyor.
- **Güvenlik modeli korundu:** Yönetici izni, açık onay, zorunlu yedek, salt-okunur tarama varsayılanı ve korumalı kayıt/klasör kuralları değişmedi. Kurulum manuel onaylıdır; varsayılan kapalı “kurumsal sessiz” mod isteğe bağlıdır. Eski sürüm algılanıp kaldırılır, uygulama verileri silinmez (`deleteAppDataOnUninstall: false`).

### 1.0.8’den gelenler

Uygulama Kütüphanesi’nde gruplu liste ve kaynak etiketleri eklendi. Güncelleyici, NSIS `/S --updated` uyumluluğu, eski istemciler için `preInit` desteği, hata bildirimi ve disk alanı kontrolü 1.0.7’den itibaren etkin.

### 1.0.6’dan gelenler

Uygulama Kütüphanesi filtreleri dock görünümüne taşındı; Güncellemeler winget yanında Chocolatey, npm ve Scoop kaynaklarından da salt-okunur tarama yapabiliyor; kaynak bilincini koruyan güncelleme kuyruğu ve doğru winget listesi eklendi.

## Ekran görüntüleri

Tanıtım sitesi, README ve bu release notu aynı dosyaları kullanır. Görseller 1.0.6 arayüzünden alınmıştır; `screen-library.png` 1.0.8’de eklenen kategori başlıklarını göstermiyor, diğer ekranlar güncel görünümü yansıtır.

| Anasayfa | Kurulu Uygulamalar |
| --- | --- |
| ![Anasayfa](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-home.png) | ![Kurulu uygulamalar](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-apps.png) |
| ![Güncellemeler](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-updates.png) | ![Uygulama Kütüphanesi](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-library.png) |
| ![Sağ tık menüsü](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-context.png) | |

## İndirme

- **Kurulum:** `Pars Sistem Yoneticisi Setup 1.0.9.exe` (NSIS, başlat menüsü + masaüstü kısayolu) — 83.631.421 bayt
  - SHA-256: `5a25a428af9484d6168968c312270bc2527c2c826241321d896bc97fcba089cf`
  - SHA-512: `eb7c869cf9c821ca2f070253fd5a2d59c4acf631e75a5e23117ed0412bcd7f23b150320f1d00b2c20a1651c4e80604e07dd7e4d3685e5a1109c9125fbbcfc040`
- **Portable:** `ParsSistemYoneticisi-Portable.exe` — 83.417.918 bayt
  - SHA-256: `f8ef45551f653390f7b70b94b3ff18258b5f1f963431e0b5a76b288f79e60506`

Windows 10 (1809+) / Windows 11 x64 ve güncel App Installer (winget) gereklidir. Chocolatey, npm ve Scoop taramaları yalnızca ilgili araç kuruluysa seçilebilir.
Uygulama yönetici izinleriyle çalışır; açılışta UAC onayı görünür.

> İmzasız dağıtım olduğu için SmartScreen uyarısı çıkabilir. İndirme sayfasındaki SHA-256
> özetleriyle dosya bütünlüğünü doğrulayabilirsiniz.
