# Pars Sistem Yöneticisi 1.3.0

Uygulama kütüphanesindeki ikonlar yenilendi: 127 ikon eklendi, 7 bozuk favicon düzeltildi ve 249 girdinin tamamı doğrulandı.

## Bu sürümde

- **Uygulama ikonları tamamlandı:** 249 uygulamanın 35 mevcut ikonu denetlendi ve yanlış/bozuk olmadığı doğrulandı; 127 uygulamaya yeni ikon eklendi. Kütüphane kartlarındaki görsel karmaşası kalktı, eksik veya hatalı logo kalmadı.
- **Marka ikonları:** 155 uygulama için Simple Icons vektör logosu kullanılıyor. CDN sürümü `16.38.1` olarak sabitlendi; tüm URL’ler HTTP 200 döndürüyor ve geçerli `<svg>` içeriği doğrulandı.
- **Doğrudan ve yerel ikonlar:** Simple Icons’ta karşılığı olmayan 6 uygulama için doğrulanmış doğrudan ikon URL’si, 1 uygulama için yerel SVG kullanılıyor. Toplam **162 açık ikon** ve **87 çalışan favicon yedeği** var.
- **Bozuk favicon düzeltmeleri:** 7 uygulamanın çalışmayan favicon bağlantısı yenisiyle değiştirildi. PotPlayer’ın bağlantı sıfırlayan `potplayer.tv/favicon.ico` adresi, HTTP 200 doğrulanan DuckDuckGo ikon servisiyle değiştirildi.
- **Kapsamlı doğrulama:** 249 girdinin tamamı tarandı; geçersiz marka slug’ı **0**, bozuk doğrudan ikon **0**, bozuk favicon **0**. İkonlar `currentColor` ile tema rengini izliyor ve favicon yedeği yalnızca logosu olmayan uygulamalarda devreye giriyor.
- **Arayüz ikonları korundu:** Lucide React eşlemesi ve merkezi `uiIcons.tsx` sözlüğü değişmedi; 203 Türkçe etiket, 115 farklı vektör ikon ve güvenli fallback düzeni sürüyor.
- **Yeni ekran görüntüleri:** Anasayfa, Güncellemeler, Kurulu Uygulamalar, Uygulama Kütüphanesi ve Sağ tık menüsü görselleri 1.3.0 arayüzünden yeniden alındı. README, tanıtım sitesi, Wiki ve bu release notu aynı dosyaları kullanıyor.
- **1.2.0’dan gelenler:** Katalog 249 uygulamaya çıkarıldı; arayüz ikonları vektörleştirildi. Kurucu `winget.exe` eksikse gömülü betikle Microsoft.WinGet.Client üzerinden resmi kaynaktan sessizce kurulum yapıyor; `/S --updated` sırasında ek pencere çıkmıyor. winget kurulamazsa uygulama kurulumu tamamlanıyor ve “Gerekli bileşenler” panelinden yeniden denenebiliyor.
- **Güvenlik modeli korundu:** Yönetici izni, açık onay, zorunlu yedek, salt-okunur tarama varsayılanı ve korumalı kayıt/klasör kuralları değişmedi. `UserChoice`, COM/CLSID, servisler, SharedDLLs, yazı tipleri ve ODBC otomatik silinmez. Eski sürüm algılanıp kaldırılır, uygulama verileri silinmez (`deleteAppDataOnUninstall: false`). Kurumsal sessiz mod varsayılan olarak kapalıdır.

## Ekran görüntüleri

Görseller 1.3.0 arayüzünden alınmıştır; kütüphane ekranı yenilenen ikonları ve 249 uygulamalık kataloğu gösterir.

| Anasayfa | Kurulu Uygulamalar |
| --- | --- |
| ![Anasayfa](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-home.png) | ![Kurulu uygulamalar](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-apps.png) |
| ![Güncellemeler](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-updates.png) | ![Uygulama Kütüphanesi](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-library.png) |
| ![Sağ tık menüsü](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-context.png) | |

## İndirme

- **Kurulum:** `Pars Sistem Yoneticisi Setup 1.3.0.exe` (NSIS, başlat menüsü + masaüstü kısayolu) — 85.426.530 bayt
  - SHA-256: `05c5aae34d26aa5e69fadde121969fa977482b479ec5cdde9d124d7177944a44`
  - SHA-512: `d2e0370fb723ee4c8a5e82dad8168a193bd207c9f6c6dfea0ba430b25c1744d73dd20fb8c05aeaaf89f4a9b58d4645ff7fa2bc1f2f04822a44191ed93aaa7d3c`
- **Portable:** `ParsSistemYoneticisi-Portable.exe` — 85.212.444 bayt
  - SHA-256: `5ba24d8f386f322a8810188310bc6d77babff48625a0cad4075444098c76766f`

Windows 10 (1809+) / Windows 11 x64 gereklidir. Kurulum exe’si winget eksikse resmi kaynaktan kurar; portable sürümde winget “Gerekli bileşenler” panelinden kurulabilir. Chocolatey, npm ve Scoop taramaları yalnızca ilgili araç kuruluysa seçilebilir.
Uygulama yönetici izinleriyle çalışır; açılışta UAC onayı görünür.

> İmzasız dağıtım olduğu için SmartScreen uyarısı çıkabilir. İndirme sayfasındaki SHA-256
> özetleriyle dosya bütünlüğünü doğrulayabilirsiniz.
