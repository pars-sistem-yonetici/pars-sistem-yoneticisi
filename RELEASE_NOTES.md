# Pars Sistem Yöneticisi 1.0.3

1.0.2’e ek olarak tarama performansı, yükleme/güncelleme kuyruğu, ana sayfa iyileştirmeleri ve üçüncü taraf sağ tık menüsü eklentilerinin yönetimi eklendi.

## Bu sürümde

- Toplu güvenlik taraması: 10/10 doğrulama; süre 752,7 ms → 87,8 ms (8,6 kat hızlanma)
- winget kurulum/güncelleme kuyruğu: sıraya alma, iptal, yüzde ve hız göstergesi
- Güncelleme kuyruğu için ana süreç ilerleme (progress) altyapısı
- Anasayfa sekmesi, yeni gruplar, Boyut kolonu, tüm diskler ve başlangıç grafiği
- Kalan-artık dosya temizliği ve ağ hızı ölçümü iyileştirmeleri
- **Sağ tık menüsü eklentileri:** WinRAR / 7-Zip gibi kabuk eklentileri ile klasik komutlar listelenir; tek tıkla kapatılıp açılır. COM eklentilerinde per-user `Blocked\{CLSID}`, klasik komutlarda `ProgrammaticAccessOnly` kullanılır.
- Her değişiklikten önce `.reg` yedeği alınır; yedek başarısızsa değişiklik yapılmaz. Gezgin yeniden başlatılır.
- Uygulama kendi Gezgin menü girdisini **eklemez**; yalnızca mevcut üçüncü taraf eklentileri açıp kapatır.
- Yıkıcı işlemlerde onay + zorunlu yedek; imfasız dağıtım + SHA-256 bütünlük doğrulaması

## İndirme

- **Kurulum:** `Pars Sistem Yoneticisi Setup 1.0.3.exe` (NSIS, başlat menüsü + masaüstü kısayolu)
- **Portable:** `ParsSistemYoneticisi-Portable.exe`

Windows 10 (1809+) / Windows 11 x64 ve güncel App Installer (winget) gereklidir.
Uygulama yönetici izinleriyle çalışır; açılışta UAC onayı görünür.

> İmzasız dağıtım olduğu için SmartScreen uyarısı çıkabilir. İndirme sayfasındaki SHA-256
> özetleriyle dosya bütünlüğünü doğrulayabilirsiniz.
