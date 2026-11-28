# Pars Sistem Yöneticisi 1.8.0 — macOS

Bu sürüm macOS için salt-okunur çekirdeği korur ve Kudu’dan uyarlanan **POSIX Denetimi** panelini ekler. Windows’a özgü yazma özellikleri macOS’e taşınmamıştır; genel “Latest” etiketi birleşik `1.8.0` release’indedir.

## Bu sürümde

- **POSIX Denetimi:** LaunchAgents/LaunchDaemons/StartupItems, `launchctl list`, `lsof` ile kurulu ağ bağlantıları, `ps` ile tarayıcı süreçleri, `defaults`/`sysctl`/`sshd_config` gizlilik ayarları, `codesign --verify --deep --strict` imza kontrolleri, önbellek/günlük boyutları ve `~/.Trash` metadata’sı salt-okunur raporlanır.
- **Salt-okunur malware denetimi:** signatures, heuristics, scripts, integrity, persistence, hosts ve browser motorları sürer; Defender motoru macOS’te gösterilmez.
- **Paket tarama:** Homebrew (`brew outdated --json=v2`) ve npm; kurulum/güncelleme/kaldırma komutları çalıştırılmaz.
- **Windows’a özgü sekmeler:** Kayıt defteri, UAC, kabuk menüsü, hizmet, güvenlik duvarı, sürücü ve zamanlama sekmeleri gizlidir ve IPC katmanında reddedilir.
- **Fluent Amber teması:** Dördüncü tema macOS’te de kullanılabilir; tercih `settings.json` içinde saklanır.
- **Self-update kapalıdır:** Uygulama kendisini macOS’te güncellemez.

## İndirme

- `.dmg` — uygulamayı Sürükle & Bırak ile kurun.
- `.zip` — elle açıp `Pars Sistem Yoneticisi.app` dosyasını istediğiniz yere kopyalayın.
- `SHA256SUMS-1.8.0.txt` — birleşik release’deki Windows ve macOS dosya özetlerini doğrulamak için.

Paketler **imzalanmamıştır** ve noterlemeye gönderilmemiştir. macOS Gatekeeper ilk açılışta uyarı gösterebilir: `Sistem Ayarları → Gizlilik ve Güvenlik → Yine de aç` yolunu kullanabilirsiniz. App Store dağıtımı yoktur.

## Güvenlik notları

- Yeni denetim paneli yalnızca okuma yapar: ayar değiştirmez, dosya silmez, süreç kapatmaz, paket kurmaz.
- Tüm komutlar kabuksuz argüman dizileriyle, timeout ve çıktı sınırıyla çalıştırılır; sudo kullanılmaz.
- Sembolik bağlantılar izlenmez; kullanıcı hariç tutmaları ve sistem yolları korunur.

## Bilinen sınırlar

- İmzasız paket nedeniyle Gatekeeper uyarısı normaldir.
- CPU yüzdesi macOS yük ortalamasından tahmin edilir; Windows performans sayacıyla birebir aynı değildir.
- POSIX Denetimi deneyseldir; bazı bölümler yetki veya araç yoksa `Kullanılamıyor` olarak işaretlenir.
