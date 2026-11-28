# Pars Sistem Yöneticisi 1.5.0 — macOS

Bu, macOS için ilk **kararlı** sürümdür. Kapsam salt-okunur çekirdektir; Windows'a özgü yazma özellikleri macOS'e taşınmamıştır. Windows `1.4.0` kararlı sürümü ve GitHub "Latest" etiketi etkilenmez.

## İndirme

- `.dmg` — uygulamayı Sürükle & Bırak ile kurun.
- `.zip` — elle açıp `Pars Sistem Yoneticisi.app` dosyasını istediğiniz yere kopyalayın.
- `SHA256SUMS-macOS.txt` — dosya özetlerini doğrulamak için.

Paketler **imzalanmamıştır** ve noterlemeye gönderilmemiştir. macOS Gatekeeper ilk açılışta uyarı gösterebilir:
`Sistem Ayarları → Gizlilik ve Güvenlik → Yine de aç` yolunu kullanabilirsiniz. App Store dağıtımı yoktur.

## Bu sürümde

- macOS için platform algılama ve yetenek katmanı; Windows davranışı korunur.
- Salt-okunur malware denetimi: imzalar, sezgisel analiz, betik analizi, sistem bütünlüğü, kalıcılık, HOSTS/DNS ve tarayıcı eklentileri. Defender motoru macOS'te gösterilmez.
- Paket tarama: Homebrew (`brew outdated --json=v2`) ve npm; kurulum/güncelleme/kaldırma komutları çalıştırılmaz.
- Windows'a özgü kayıt defteri, UAC, kabuk menüsü, hizmet, güvenlik duvarı, sürücü ve zamanlama sekmeleri gizlidir ve IPC katmanında reddedilir.
- Uygulamanın kendini güncelleme özelliği macOS'te devre dışıdır.
- Homebrew olmayan ortamlarda paket taraması boş döner; uygulama yine kullanılabilir.

## Güvenlik notları

- Tarama salt okunurdur: dosya silme, karantinaya taşıma, işlem sonlandırma veya kayıt yazma işlemi yoktur.
- Sembolik bağlantılar izlenmez; sistem/yürütme zamanı yolları ve kullanıcı hariç tutmaları atlanır.
- Süre sınırları: toplam tarama ~90 saniye, motor başına ~20 saniye.

## Bilinen sınırlar

- İmzasız paket nedeniyle Gatekeeper uyarısı normaldir.
- CPU yüzdesi macOS yük ortalamasından tahmin edilir; Windows performans sayacıyla birebir aynı değildir.
- GitHub "Latest" etiketi Windows `1.4.0` sürümünde kalır; macOS `1.5.0` kararlı olmasına rağmen genel "en yeni sürüm" olarak işaretlenmez.
- Linux paketleri (AppImage + `.deb`) `2.0` sürümünde planlanmıştır.
