# Pars Sistem Yöneticisi 1.2.0

Arayüz ikonları vektörleştirildi, uygulama kütüphanesi 249 uygulamaya çıkarıldı ve ekran görüntüleri yenilendi.

## Bu sürümde

- **Profesyonel vektör ikonlar:** Arayüzdeki Unicode/emoji simgelerinin yerini Lucide React ikonları aldı. 203 Türkçe etiket ve 115 farklı ikon tek bir sözlükten yönetiliyor; bilinmeyen adlar güvenli bir fallback ikonuna, bilinmeyen etiketler boş değere düşüyor. İkonlar `currentColor` ile tema rengini izliyor, `1em` boyutlandırma eski ölçekleri koruyor ve `prefers-reduced-motion` desteği sürüyor.
- **Genişletilmiş uygulama kütüphanesi:** Katalog 194’ten **249** uygulamaya çıktı. Eklenen 55 uygulamanın winget kimliği yerel `winget show --id ... --exact` komutuyla tek tek doğrulandı; doğrulanamayan kimlikler eklenmedi. 34 uygulamaya Simple Icons vektör logosu (sürüm `16.38.1` ile sabitlenmiş URL) eklendi; URL’ler HTTP 200 ve geçerli `<svg>` açısından doğrulandı. Logosu olmayanlarda mevcut favicon yedeği korundu.
- **Yeni ekran görüntüleri:** Anasayfa, Güncellemeler, Kurulu Uygulamalar, Uygulama Kütüphanesi ve Sağ tık menüsü görselleri 1.2.0 arayüzünden yeniden alındı. README, tanıtım sitesi, Wiki ve bu release notu aynı dosyaları kullanıyor.
- **1.1.0’dan gelenler:** Kurucu `winget.exe` eksikse gömülü betikle Microsoft.WinGet.Client üzerinden resmi kaynaktan sessizce kurulum yapıyor; `/S --updated` sırasında ek pencere çıkmıyor. winget kurulamazsa uygulama kurulumu tamamlanıyor ve “Gerekli bileşenler” panelinden yeniden denenebiliyor.
- **Daha önceki düzeltmeler korundu:** Alt bilgi dağıtımı, kütüphane kategori başlıkları, doğru NSIS anahtarları, eski istemci uyumu, çok kaynaklı salt-okunur tarama ve hata bildirimi etkin.
- **Güvenlik modeli korundu:** Yönetici izni, açık onay, zorunlu yedek, salt-okunur tarama varsayılanı ve korumalı kayıt/klasör kuralları değişmedi. Eski sürüm algılanıp kaldırılır, uygulama verileri silinmez (`deleteAppDataOnUninstall: false`). Kurumsal sessiz mod varsayılan olarak kapalıdır.

## Ekran görüntüleri

Görseller 1.2.0 arayüzünden alınmıştır; kütüphane ekranı yeni ikonları ve genişletilmiş kataloğu gösterir.

| Anasayfa | Kurulu Uygulamalar |
| --- | --- |
| ![Anasayfa](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-home.png) | ![Kurulu uygulamalar](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-apps.png) |
| ![Güncellemeler](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-updates.png) | ![Uygulama Kütüphanesi](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-library.png) |
| ![Sağ tık menüsü](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-context.png) | |

## İndirme

- **Kurulum:** `Pars Sistem Yoneticisi Setup 1.2.0.exe` (NSIS, başlat menüsü + masaüstü kısayolu) — 85.424.937 bayt
  - SHA-256: `1f6a56de4aaa0f99960f476a53ff896f0df870c36c9b44e5a87bc59c04534d3b`
  - SHA-512: `375eaac44cabb053e20c94db3c1740c0ea9e4daf3f1734294484833929524b079a5628a27960d7fbbcf3b80aaf07cb272633ea77b814384795591ed12ae684a2`
- **Portable:** `ParsSistemYoneticisi-Portable.exe` — 85.210.851 bayt
  - SHA-256: `e2479641d8d7dca1d0b54a27ee6c457c5336aaf88216c3a0008aa3278c618ee7`

Windows 10 (1809+) / Windows 11 x64 gereklidir. Kurulum exe’si winget eksikse resmi kaynaktan kurar; portable sürümde winget “Gerekli bileşenler” panelinden kurulabilir. Chocolatey, npm ve Scoop taramaları yalnızca ilgili araç kuruluysa seçilebilir.
Uygulama yönetici izinleriyle çalışır; açılışta UAC onayı görünür.

> İmzasız dağıtım olduğu için SmartScreen uyarısı çıkabilir. İndirme sayfasındaki SHA-256
> özetleriyle dosya bütünlüğünü doğrulayabilirsiniz.
