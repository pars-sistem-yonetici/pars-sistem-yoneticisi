# Pars Sistem Yöneticisi 1.0.2

GitHub Actions otomasyonu eklendi: sürüm artık Windows runner üzerinde otomatik derleniyor, iki exe Release’a yükleniyor ve site manifesti ile SHA-256 özetleri otomatik güncelleniyor. Güncelleme kaynağı yeni kurulumlarda varsayılan olarak tanımlıdır.

## Bu sürümde

- winget ile güncelleme, kurulum, kaldırma ve katalog arama (142 doğrulanmış uygulama)
- Disk temizleme, başlangıç yönetimi, sürücü güncelleme, kayıt defteri ve güvenlik duvarı denetimi
- Beş motorlu, salt okunur kötü amaçlı yazılım taraması
- Yıkıcı işlemlerde zorunlu yedek + onay; yedek alınamazsa silme yapılmaz
- Güncelleme kaynağından SHA-512 doğrulamalı kendi kendini güncelleme (varsayılan adres gömülü)
- Grafit/altın tema, Windows 11 açık teması, Türkçe/İngilizce arayüz
- Ayarlar’da **Varsayılan kaynağa dön** düğmesi
- Otomatik sürüm yayınlama (GitHub Actions)

## İndirme

- **Kurulum:** `Pars Sistem Yoneticisi Setup 1.0.2.exe` (NSIS, başlat menüsü + masaüstü kısayolu)
- **Portable:** `ParsSistemYoneticisi-Portable.exe`

Windows 10 (1809+) / Windows 11 x64 ve güncel App Installer (winget) gereklidir.
Uygulama yönetici izinleriyle çalışır; açılışta UAC onayı görünür.

> İmzasız dağıtım olduğu için SmartScreen uyarısı çıkabilir. İndirme sayfasındaki SHA-256
> özetleriyle dosya bütünlüğünü doğrulayabilirsiniz.
