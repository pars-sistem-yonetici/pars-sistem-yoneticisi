# Pars Sistem Yöneticisi 1.0.5

1.0.4’e ek olarak 63 tersine çevrilebilir Windows & ağ ayarı, 4 optimizasyon profili, 9 gelişmiş onarım aracı ve 5 sağlayıcılı DNS karşılaştırma/switcher eklendi.

## Bu sürümde

- **Sistem Ayarları (63):** Beş kategoride toplanan ayarlar — Ağ & Gecikme 11, Sistem & Performans 14, Arayüz & Deneyim 17, Gizlilik & Telemetri 11, Servis Yönetimi 10. TCP ACK/Nagle/ECN, NIC güç yönetimi, DNS önbelleği, SMBv1/NetBIOS, güç planı, NTFS davranışı, HAGS, hızlı başlatma, görev çubuğu/Gezgin/tema, telemetri, reklam kimliği, konum, Recall/Copilot ve gereksiz hizmetler tek listede yönetilir.
- **Güvenli yazma:** Hiçbir ayar otomatik uygulanmaz. Her değişiklikten önce ilgili kayıt anahtarının `.reg` yedeği alınır; özgün değer ayrıca JSON dosyasına kaydedilir. Yedek alınamazsa değişiklik yapılmaz. `UserChoice`, COM/CLSID, sertifika depoları, dosya ilişkilendirme sahipliği ve korumalı sistem girdileri katalogda yer almaz. Ayarlar tek tek geri alınabilir.
- **Optimizasyon Profilleri (4):** Rekabetçi Oyuncu (14 ayar), Düşük Gecikme Ağ (11), Dengeli Optimizasyon (10) ve Güvenli Gizlilik (14). Profiller yalnızca açık onayla uygulanır; her ayar kendi yedeğini üretir, başarısız ayarlar raporlanır ve diğerleri çalışmaya devam eder. Geri alma aynı ayarları ters sırada özgün değerlerine döndürür.
- **DNS Karşılaştırma ve Switcher:** Cloudflare `1.1.1.1`, Google `8.8.8.8`, Quad9 `9.9.9.9`, AdGuard `94.140.14.14` ve OpenDNS `208.67.222.222` için ikişer `nslookup` sorgusu yapılır; en düşük gecikme “en hızlı” olarak işaretlenir. Seçilen sağlayıcı etkin tüm bağdaştırıcılara uygulanır; değişiklik öncesi arabirim kayıt defteri zorunlu yedeklenir. “DHCP’ye sıfırla” özel DNS sunucularını kaldırır ve adresleri yeniden DHCP’den alır. Ölçüm salt okunurdur.
- **Gelişmiş Onarımlar (9):** NIC sürücüsü düşük gecikme varsayılanları ve geri yükleme, Prefetch temizliği (dosyalar önce yedeklenir), performans sayaçları/WMI deposu yeniden oluşturma (`lodctr /R`, `winmgmt /resyncperf`), Installer 2502/2503 yetki onarımı (`icacls /save` + yönetici tam yetkisi), `w32tm` NTP senkronizasyonu, Güvenli Mod durumu sorgulama ve Güvenli Mod aç/kapat (`bcdedit` + zorunlu BCD yedeği).
- **Arayüz:** “Optimizasyon & Ağ” grubu altında Sistem Ayarları, Optimizasyon Profilleri ve DNS Karşılaştırma sekmeleri; kategori filtresi, ayar arama, yedek klasörü gösterimi, profil sonuç kartı ve DNS gecikme tablosu eklendi. İngilizce çeviriler tamamlandı.
- **Güvenlik modeli korundu:** Yönetici izni, açık onay, zorunlu yedek, salt-okunur tarama varsayılanı ve korumalı kayıt/klasör kuralları tüm yeni işlemlerde geçerlidir. Kurulum manuel onaylıdır; varsayılan kapalı “kurumsal sessiz” mod isteğe bağlıdır. Eski sürüm algılanıp kaldırılır, uygulama verileri silinmez (`deleteAppDataOnUninstall: false`).

### 1.0.4’ten gelenler

Yazılım yedeği, dosya tarayıcı, disk analizi, 17 onarım aracı, gelişmiş başlangıç, 7 gizlilik ayarı, genişletilmiş kayıt defteri taraması, paket yöneticisi kurulumu, uygulama kütüphanesi, sistem tepsisi ve destek/lisans bağlantıları.

## Ekran görüntüleri

Görüntüler 1.0.4 arayüzünden alınmıştır; tanıtım sitesi, README ve bu release notu aynı dosyaları kullanır.

| Anasayfa | Kurulu Uygulamalar |
| --- | --- |
| ![Anasayfa](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-home.png) | ![Kurulu uygulamalar](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-apps.png) |
| ![Güncellemeler](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-updates.png) | ![Sağ tık menüsü](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-context.png) |

## İndirme

- **Kurulum:** `Pars Sistem Yoneticisi Setup 1.0.5.exe` (NSIS, başlat menüsü + masaüstü kısayolu)
- **Portable:** `ParsSistemYoneticisi-Portable.exe`

Windows 10 (1809+) / Windows 11 x64 ve güncel App Installer (winget) gereklidir.
Uygulama yönetici izinleriyle çalışır; açılışta UAC onayı görünür.

> İmzasız dağıtım olduğu için SmartScreen uyarısı çıkabilir. İndirme sayfasındaki SHA-256
> özetleriyle dosya bütünlüğünü doğrulayabilirsiniz.
