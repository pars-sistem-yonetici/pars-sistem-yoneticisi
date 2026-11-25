# Pars Sistem Yöneticisi 1.0.7

Güncelleyici artık NSIS kurucusunu doğru anahtarlarla başlatıyor: `/S` ve `--updated`. 1.0.4–1.0.6 sürümlerinden gelen güncellemeler de sessiz kurulabiliyor; disk doluluğu ve bağlantı kesilmesi artık anlaşılır hata mesajı veriyor.

## Bu sürümde

- **Doğru sessiz kurulum:** Uygulama güncelleyicisi `/SILENT` ve `/CLOSEAPPLICATIONS` yerine NSIS'in tanıdığı `/S` ve `--updated` anahtarlarını kullanıyor. `--updated` sayesinde kurulum “güncelleme” olarak algılanıyor; kısayollar korunuyor, gereksiz sihirbaz sayfaları atlanıyor ve çalışan uygulama nazikçe kapatılıyor.
- **Eski sürümlerle uyum:** Kurucunun `preInit` aşamasına `/SILENT` tanıma eklendi. 1.0.4, 1.0.5 ve 1.0.6'yı kullananlar bu sürümü indirdiğinde “uygulama çalışıyor” penceresinde takılmaz; güncelleme sessizce tamamlanır.
- **Başarısız kurulum artık bildiriliyor:** Kurulum işlemi başlatılamazsa (örneğin yönetici izni eksikliği) uygulama “başarılı” demeden hata mesajı gösteriyor; artık sessizce kapanmıyor.
- **Disk alanı kontrolü:** İndirmeye başlamadan önce hedef sürücüde yeterli boş alan denetleniyor. Disk doluysa “kaç MB boş, yaklaşık kaç MB gerekli” bilgisini içeren Türkçe uyarı gösteriliyor; bağlantı kesilmelerinde de anlaşılır mesaj veriliyor.
- **Güvenlik modeli korundu:** Yönetici izni, açık onay, zorunlu yedek, salt-okunur tarama varsayılanı ve korumalı kayıt/klasör kuralları değişmedi. Kurulum manuel onaylıdır; varsayılan kapalı “kurumsal sessiz” mod isteğe bağlıdır. Eski sürüm algılanıp kaldırılır, uygulama verileri silinmez (`deleteAppDataOnUninstall: false`).

### 1.0.6'dan gelenler

Uygulama Kütüphanesi filtreleri dock görünümüne taşındı; Güncellemeler winget yanında Chocolatey, npm ve Scoop kaynaklarından da salt-okunur tarama yapabiliyor; kaynak bilincini koruyan güncelleme kuyruğu ve doğru winget listesi eklendi.

## Ekran görüntüleri

Görüntüler 1.0.6 arayüzünden alınmıştır; 1.0.7 yalnızca güncelleyici düzeltmesi içerdiğinden arayüz görünümü değişmemiştir. Tanıtım sitesi, README ve bu release notu aynı dosyaları kullanır.

| Anasayfa | Kurulu Uygulamalar |
| --- | --- |
| ![Anasayfa](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-home.png) | ![Kurulu uygulamalar](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-apps.png) |
| ![Güncellemeler](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-updates.png) | ![Uygulama Kütüphanesi dock filtreleri](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-library.png) |
| ![Sağ tık menüsü](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-context.png) | |

## İndirme

- **Kurulum:** `Pars Sistem Yoneticisi Setup 1.0.7.exe` (NSIS, başlat menüsü + masaüstü kısayolu)
- **Portable:** `ParsSistemYoneticisi-Portable.exe`

Windows 10 (1809+) / Windows 11 x64 ve güncel App Installer (winget) gereklidir. Chocolatey, npm ve Scoop taramaları yalnızca ilgili araç kuruluysa seçilebilir.
Uygulama yönetici izinleriyle çalışır; açılışta UAC onayı görünür.

> İmzasız dağıtım olduğu için SmartScreen uyarısı çıkabilir. İndirme sayfasındaki SHA-256
> özetleriyle dosya bütünlüğünü doğrulayabilirsiniz.
