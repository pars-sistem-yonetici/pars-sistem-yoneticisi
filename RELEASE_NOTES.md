# Pars Sistem Yöneticisi 1.8.0

Kudu’nun macOS ve Linux denetimleri salt-okunur denetim paneli olarak eklendi; Fluent Amber teması dördüncü tema seçeneği olarak sunuldu. Windows davranışı korunurken POSIX tarafına yazma, silme, süreç kapatma, bulut ve daemon özellikleri taşınmadı.

## Bu sürümde

- **POSIX Denetimi:** macOS/Linux için sekiz bölümlük salt-okunur rapor eklendi: başlangıç öğeleri, hizmetler, ağ bağlantıları, tarayıcı süreçleri, gizlilik ayarları, kötü amaçlı yazılım imza/ClamAV kontrolleri, temizlik adayları ve çöp kutusu metadata’sı.
- **Kudu kaynaklı okuma mantığı:** `launchctl`, `systemctl`, `ss`, `lsof`, `ps`, `codesign`, `clamscan`, `defaults`, `gsettings`, `sysctl`, `sshd_config`, LaunchAgents/Daemons, autostart ve `.desktop.disabled` girdileri yalnızca okunuyor.
- **Fluent Amber teması:** Grafit arka plan, kehribar vurgu ve yoğun veri düzeniyle yeni bir tema eklendi. Mevcut `default`, `windows11` ve `auto` temaları değişmeden korundu; tercih `settings.json` içinde saklanıyor.
- **Güvenlik modeli korundu:** Yönetici onayı, açık kullanıcı onayı, zorunlu yedek, salt-okunur tarama varsayılanı ve POSIX’te read-only çekirdek aynı. macOS/Linux’ta yazma işlemleri ve self-update kapalı; telemetri, uzak komut ve CLI/headless mod yok.
- **1.7.0’dan gelenler:** Sekiz salt-okunur güvenlik motoru, aranabilir bulgu raporu, tam İngilizce denetimi, renkli uygulama ikonları ve self-update sonrası otomatik yeniden başlatma sürüyor.

## Platform kapsamı

- **Windows 10/11 x64:** Tam kapsam; winget tabanlı yazılım yönetimi ve onaylı/yedekli sistem değişiklikleri.
- **macOS 13+ · arm64/x64:** Salt-okunur çekirdek ve yeni POSIX Denetimi paneli. İmzasız dağıtım nedeniyle Gatekeeper uyarısı normaldir.
- **Linux x64:** Salt-okunur çekirdek, apt/dnf/pacman/flatpak/snap arama-listeleme ve yeni POSIX Denetimi paneli. AppImage ve `.deb` paketleri sunulur.

## Doğrulama

- `npm run build` başarılı; TypeScript ve Vite derlemesi tamamlandı.
- POSIX IPC smoke testleri macOS ve Linux workflow’lerinde çalışır; yazma kanallarının reddedildiğini doğrular.
- Tüm paketlerin SHA-256 özetleri release içindeki `SHA256SUMS-1.8.0.txt` ve `SHA256SUMS-Linux.txt` dosyalarındadır.

## İndirme

[1.8.0 release sayfası](https://github.com/pars-sistem-yonetici/pars-sistem-yoneticisi/releases/tag/1.8.0) üzerinden Windows kurulum/portable, macOS `arm64`/`x64` DMG/ZIP ve Linux AppImage/deb dosyalarını indirebilirsiniz.

| Windows dosyası | Boyut | SHA-256 |
| --- | --- | --- |
| `Pars.Sistem.Yoneticisi.Setup.1.8.0.exe` | 85.501.299 bayt | `e6639c4c8c3e2753d4138c5f5e06343b7aa31ae9459ded6ba938ccafd423b14b` |
| `ParsSistemYoneticisi-Portable.exe` | 85.287.074 bayt | `49736bf115719b3915b5161232dfa74a544692b841efba7e20547f5100f6e394` |

> İmzasız dağıtım olduğu için SmartScreen ve Gatekeeper uyarıları çıkabilir. İndirmeden önce release içindeki SHA-256 özetleriyle dosya bütünlüğünü doğrulayın.
