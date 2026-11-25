# Pars Sistem Yöneticisi 1.0.6

1.0.5’e ek olarak Uygulama Kütüphanesi filtreleri dock görünümüne taşındı; Güncellemeler artık winget yanında Chocolatey, npm ve Scoop kaynaklarından da salt-okunur tarama yapabiliyor.

## Bu sürümde

- **Dock filtreleri:** Uygulama Kütüphanesi’ndeki “Tümü / Tarayıcı / Medya & Tasarım …” kategori satırı ve “Tümü / winget / Chocolatey / npm / Scoop” paket yöneticisi satırı, sol gezinmedeki dock paneliyle aynı dilde iki yatay seçiciye dönüştürüldü. Aktif seçim altın vurgu, ikon ve `aria-pressed` ile belirtiliyor; kurulu olmayan yöneticiler devre dışı, dar ekranlarda seçiciler sarıyor.
- **Çok kaynaklı güncellemeler:** Güncellemeler sekmesine “Tümü / winget / Chocolatey / npm / Scoop” kaynak seçicisi eklendi. `Tümü` dört kaynağı paralel tarar; bir kaynak hata verirse diğerlerinin sonucu korunur. Chocolatey `choco outdated --limit-output`, npm `npm outdated -g --json`, Scoop `scoop status`, winget `--upgrade-available` kullanılır. Tüm taramalar salt okunurdur; hiçbiri kendiliğinden kurulum yapmaz.
- **Kaynak bilincini koruyan kuyruk:** Seçilen güncellemeler artık kendi paket yöneticisiyle güncellenir; kimlikler kaynağa özel düzenli ifadelerle doğrulanır, seçenek/enjeksiyon karakterleri komut satırına geçmez. Aynı kimlik farklı kaynaklarda olsa bile seçimler birbirine karışmaz.
- **Doğru winget listesi:** “1 package(s) have version numbers that cannot be determined …” bilgilendirme satırı tabloda sahte uygulama olarak görünmez. `--include-unknown` kullanılmaya devam edilmez; bilgilendirme yalnızca uyarı niteliğindedir.
- **Görünür kaynak adları:** Güncelleme tablosu ve kütüphane kartları `choco` yerine `Chocolatey`, `npm`, `Scoop`, `winget` etiketlerini gösterir; yeni İngilizce çeviriler eklendi.
- **Güvenlik modeli korundu:** Yönetici izni, açık onay, zorunlu yedek, salt-okunur tarama varsayılanı ve korumalı kayıt/klasör kuralları değişmedi. Kurulum manuel onaylıdır; varsayılan kapalı “kurumsal sessiz” mod isteğe bağlıdır. Eski sürüm algılanıp kaldırılır, uygulama verileri silinmez (`deleteAppDataOnUninstall: false`).

### 1.0.5’ten gelenler

63 tersine çevrilebilir Windows & ağ ayarı, 4 optimizasyon profili, 5 sağlayıcılı DNS karşılaştırma/switcher, 9 gelişmiş onarım aracı, yazılım yedeği, dosya tarayıcı, disk analizi, paket yöneticisi kurulumu, uygulama kütüphanesi, sistem tepsisi ve destek/lisans bağlantıları.

## Ekran görüntüleri

Görüntüler 1.0.4 arayüzünden alınmıştır; tanıtım sitesi, README ve bu release notu aynı dosyaları kullanır.

| Anasayfa | Kurulu Uygulamalar |
| --- | --- |
| ![Anasayfa](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-home.png) | ![Kurulu uygulamalar](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-apps.png) |
| ![Güncellemeler](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-updates.png) | ![Sağ tık menüsü](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-context.png) |

## İndirme

- **Kurulum:** `Pars Sistem Yoneticisi Setup 1.0.6.exe` (NSIS, başlat menüsü + masaüstü kısayolu)
- **Portable:** `ParsSistemYoneticisi-Portable.exe`

Windows 10 (1809+) / Windows 11 x64 ve güncel App Installer (winget) gereklidir. Chocolatey, npm ve Scoop taramaları yalnızca ilgili araç kuruluysa seçilebilir.
Uygulama yönetici izinleriyle çalışır; açılışta UAC onayı görünür.

> İmzasız dağıtım olduğu için SmartScreen uyarısı çıkabilir. İndirme sayfasındaki SHA-256
> özetleriyle dosya bütünlüğünü doğrulayabilirsiniz.
