# Pars Sistem Yöneticisi (TypeScript / Electron)

Windows için winget tabanlı sistem bakım ve yazılım yöneticisi paneli. Mevcut Python uygulamasının
TypeScript + Electron + React karşılığıdır; eski `YazilimYoneticisi/` klasörüne dokunulmaz.

[![Son sürüm](https://img.shields.io/github/v/release/pars-sistem-yonetici/pars-sistem-yoneticisi?label=s%C3%BCr%C3%BCm&style=for-the-badge)](https://github.com/pars-sistem-yonetici/pars-sistem-yoneticisi/releases/latest)
[![İndirmeler](https://img.shields.io/github/downloads/pars-sistem-yonetici/pars-sistem-yoneticisi/total?label=indirme&style=for-the-badge)](https://github.com/pars-sistem-yonetici/pars-sistem-yoneticisi/releases)
[![Lisans](https://img.shields.io/badge/lisans-MIT-gold?style=for-the-badge)](LICENSE)
[![Windows](https://img.shields.io/badge/Windows-10%2F11-x64-blue?style=for-the-badge)](https://pars-sistem-yonetici.github.io/pars-sistem-yoneticisi/download.html)

Arayüz, grafit/gümüş palet ve koyu sarı vurgularla temalandırılmıştır. **Ayarlar → Tema** üzerinden
Windows 11 açık temasına anında geçilebilir; tercih `settings.json` içinde saklanır. Windows'un native
başlık çubuğu yerine temayla uyumlu, sürüklenebilir özel pencere çerçevesi kullanılır;
küçültme/büyütme/kapatma düğmeleri de aynı paleti izler. Anasayfadaki CPU/RAM/boş depolama kartlarında
durum ikonları bulunur. Aynı anda yalnızca bir uygulama örneği çalışır; ikinci başlatma mevcut pencereyi
geri yükleyip öne getirir. Sistem tepsisindeki simge ve “Pencereyi göster” kısayolu da küçültülmüş veya
gizlenmiş pencereyi açar.

## 1.1.0 yenilikleri

- **Kurucuya winget kurulumu:** NSIS kurulumu `winget.exe` denetler; eksikse gömülü `install-winget.ps1` betiğiyle Microsoft.WinGet.Client üzerinden resmi kaynaktan sessizce kurar ve doğrular. `/S --updated` ile yapılan sessiz güncellemelerde de aynı akış çalışır; ek onay penceresi çıkmaz.
- **Hata toleransı:** winget kurulamazsa uygulama kurulumu tamamlanır, NSIS günlüğüne uyarı yazılır ve “Gerekli bileşenler” panelinden yeniden denenebilir. Betik tekrar çalıştırıldığında winget varsa doğrudan `OK` döner.
- **Site metinleri:** İndirme sayfası ve ana sayfa, kurucunun otomatik winget kurulumunu ve portable sürümdeki elle kurulum seçeneğini açıklıyor.
- **1.0.9 ve önceki düzeltmeler korundu:** Alt bilgi dağıtımı, kütüphane kategori başlıkları, doğru NSIS anahtarları, eski istemci uyumu ve salt-okunur tarama sürüyor.
- **Güvenlik modeli korundu:** Yönetici izni, açık onay, zorunlu yedek, salt-okunur tarama ve `deleteAppDataOnUninstall: false` değişmedi.

Ayrıntılar için [RELEASE_NOTES.md](RELEASE_NOTES.md) dosyasına bakın.

## 1.0.9 yenilikleri

- **Alt bilgi dağıtıldı:** 1.0.8 exe’sinin içinde kalan `v1.0.7` yazısı düzeltildi. Sürüm arttığı için 1.0.7 ve 1.0.8 kullanıcıları self-updater ile güncelleme onayı alıyor; indirme SHA-512 ile doğrulanıyor.
- **Site ve Blogger metinleri:** İndirme sayfası ve Blogger çıktısındaki eski `1.0.7` metin/URL’leri temizlendi; indirme düğmeleri doğrudan GitHub Releases adreslerini kullanıyor.
- **Yayın üretimi:** `ci-release.js` site dosyalarındaki sürüm belirteçlerini artık manifestteki eski sürüme bakmadan güncelliyor. 1.0.9, kaynaklar `main`’e eşitlendikten sonra tek kaynaktan üretildi; etiket/dosya yarışı kaldırıldı.
- **1.0.8 ve 1.0.7 düzeltmeleri korundu:** Kütüphane kategori başlıkları, doğru NSIS anahtarları, eski istemci uyumu, hata bildirimi ve disk alanı kontrolü sürüyor.
- **Güvenlik modeli korundu:** Yönetici izni, açık onay, zorunlu yedek, salt-okunur tarama ve `deleteAppDataOnUninstall: false` değişmedi.

Ayrıntılar için [RELEASE_NOTES.md](RELEASE_NOTES.md) dosyasına bakın.

## 1.0.8 yenilikleri

- **Kategori başlıkları:** Uygulama Kütüphanesi’ndeki kartlar üstteki kategori sekmeleriyle aynı sıralamada gruplanıyor. Her grubun üstünde o sekmenin ikonu, kategori adı ve içerdiği uygulama sayısı gösteriliyor; arama ve paket yöneticisi filtresi uygulandığında başlıklar ve sayılar güncelleniyor.
- **Kaynak etiketi:** Paket yöneticisi sekmelerinden biri seçildiğinde grup başlıklarında hangi kaynağın görüntülendiği (winget, Chocolatey, npm, Scoop) ayrıca belirtiliyor; “Tümü” seçiliyken etiket gizleniyor.
- **1.0.7 düzeltmeleri korundu:** Doğru NSIS anahtarları (`/S --updated`), eski istemciler için `/SILENT` uyumluluğu, kurulum hata bildirimi ve disk alanı kontrolü sürüyor.
- **Güvenlik modeli korundu:** Yönetici izni, açık onay, zorunlu yedek, salt-okunur tarama ve `deleteAppDataOnUninstall: false` değişmedi.

Ayrıntılar için [RELEASE_NOTES.md](RELEASE_NOTES.md) dosyasına bakın.

## 1.0.7 yenilikleri

- **Doğru sessiz güncelleme:** Uygulama güncelleyicisi NSIS kurucusunu artık `/S` ve `--updated` anahtarlarıyla başlatıyor. Eski `/SILENT` ve `/CLOSEAPPLICATIONS` anahtarları bu kurucu tarafından tanınmadığı için güncelleme “uygulama çalışıyor” penceresinde takılıyordu; `--updated` ile kurulum güncelleme olarak algılanıyor, kısayollar korunuyor.
- **Eski sürüm uyumu:** Kurucuya `preInit` aşamasında `/SILENT` tanıma eklendi. 1.0.4, 1.0.5 ve 1.0.6 kullanıcıları bu sürümü indirdiğinde eski argümanlarla da olsa sessiz kurulum yapılabiliyor.
- **Anlaşılır hatalar:** Kurulum başlatılamazsa artık hata mesajı gösteriliyor; sessizce “başarılı” denip kapanmıyor. İndirmeden önce disk alanı kontrolü yapılıyor; disk doluysa veya bağlantı koparsa Türkçe uyarı veriliyor.
- **Güvenlik modeli korundu:** Yönetici izni, açık onay, zorunlu yedek, salt-okunur tarama ve `deleteAppDataOnUninstall: false` değişmedi.

Ayrıntılar için [RELEASE_NOTES.md](RELEASE_NOTES.md) dosyasına bakın.

## 1.0.6 yenilikleri

- **Dock filtreleri:** Uygulama Kütüphanesi’ndeki kategori ve paket yöneticisi satırları, sol gezinmeyle aynı dock görünümünde iki yatay seçiciye dönüştürüldü. Aktif seçim, ikonlar, kullanılabilirlik durumu ve klavye/erişilebilirlik özellikleri korundu.
- **Çok kaynaklı güncellemeler:** Güncellemeler sekmesinde `Tümü / winget / Chocolatey / npm / Scoop` seçicisi eklendi. Taramalar salt okunurdur; başarısız kaynak diğerlerini etkilemez. Sahte winget uyarı satırı filtrelendi.
- **Kaynak güvenliği:** Her kaynak için ayrı kimlik doğrulama kalıbı uygulanır; güncellemeler kendi paket yöneticisiyle uygulanır. Kurulum yine manuel onaylıdır, varsayılan salt-okunur davranış değişmedi.

Ayrıntılar için [RELEASE_NOTES.md](RELEASE_NOTES.md) dosyasına bakın.

## 1.0.5 yenilikleri

- **Sistem Ayarları:** 63 tersine çevrilebilir Windows & ağ ayarı; Ağ & Gecikme 11, Sistem & Performans 14, Arayüz & Deneyim 17, Gizlilik & Telemetri 11, Servis Yönetimi 10. Hiçbiri otomatik uygulanmaz; her değişiklikte zorunlu `.reg` + JSON yedeği alınır.
- **Optimizasyon Profilleri:** Rekabetçi Oyuncu, Düşük Gecikme Ağ, Dengeli Optimizasyon ve Güvenli Gizlilik. Profiller açık onayla uygulanır/geri alınır; başarısız ayarlar raporlanır.
- **DNS Karşılaştırma:** Cloudflare, Google, Quad9, AdGuard ve OpenDNS gecikmeleri ölçülür; en hızlı sağlayıcı tek tıkla uygulanır, DHCP sıfırlama ve zorunlu yedek vardır. Ölçüm salt okunurdur.
- **Gelişmiş Onarımlar:** NIC düşük gecikme ayarları (+ geri yükleme), Prefetch temizliği, performans sayaçları/WMI rebuild, Installer 2502/2503 `icacls` yetki onarımı, `w32tm` NTP senkronizasyonu ve `bcdedit` Güvenli Mod aç/kapat + durum sorgulama.
- Sol gezinmede yeni **Optimizasyon & Ağ** grubu; kategori filtresi, ayar arama ve sonuç kartları eklendi.

Ayrıntılar için [RELEASE_NOTES.md](RELEASE_NOTES.md) dosyasına bakın.

## Ekran görüntüleri (1.0.6)

Aşağıdaki görüntüler 1.0.6 arayüzünden alınmıştır; 1.0.7 yalnızca güncelleyici düzeltmesi içerdiğinden
arayüz aynı kalmıştı. 1.0.8’de Uygulama Kütüphanesi’ne eklenen kategori başlıkları nedeniyle
`screen-library.png` eski görünümü gösterir; diğer ekranlar güncel görünümü yansıtır. Tanıtım sitesi
ve GitHub Releases sayfası da aynı dosyaları kullanır.

| Anasayfa | Kurulu Uygulamalar |
| --- | --- |
| ![Pars Sistem Yöneticisi anasayfa ekranı](website/assets/screen-home.png) | ![Kurulu uygulamalar listesi](website/assets/screen-apps.png) |
| ![Güncellemeler ekranı](website/assets/screen-updates.png) | ![Uygulama Kütüphanesi dock filtreleri](website/assets/screen-library.png) |
| ![Sağ tık menüsü eklentileri](website/assets/screen-context.png) | |

## Hızlı kurulum

- **Son sürüm:** [GitHub Releases](https://github.com/pars-sistem-yonetici/pars-sistem-yoneticisi/releases/latest)
- **Kurulum dosyası (1.1.0):** [`Pars.Sistem.Yoneticisi.Setup.1.1.0.exe`](https://github.com/pars-sistem-yonetici/pars-sistem-yoneticisi/releases/download/1.1.0/Pars.Sistem.Yoneticisi.Setup.1.1.0.exe)
- **Portable (1.1.0):** [`ParsSistemYoneticisi-Portable.exe`](https://github.com/pars-sistem-yonetici/pars-sistem-yoneticisi/releases/download/1.1.0/ParsSistemYoneticisi-Portable.exe)
- **Doğrulama:** [İndirme sayfasındaki SHA-256 özetleri](https://pars-sistem-yonetici.github.io/pars-sistem-yoneticisi/download.html)

winget kataloğuna alındığında tek satır kurulum:

```powershell
winget install --id ParsSistemYonetici.ParsSistemYoneticisi --exact
```

Kurulum UAC onayı ister; `winget.exe` eksikse kurucu Microsoft.WinGet.Client üzerinden resmi kaynaktan sessizce kurar. Manifest taslağı `winget/` klasöründedir.

## Hazır çıktılar

`release/` klasöründe:

- `Pars Sistem Yoneticisi Setup 1.1.0.exe` — NSIS kurulum dosyası (başlat menüsü + masaüstü kısayolu); eski sürümü algılar, yükseltmede kaldırıp yeniden kurar, uygulama verilerini korur ve winget eksikse resmi kaynaktan otomatik kurar
- `ParsSistemYoneticisi-Portable.exe` — tek dosya, kurulum gerektirmeyen sürüm
- `win-unpacked/` — derleme sırasında oluşan geçici klasör; dağıtıma dahil edilmez ve temizlenir

GitHub Releases’taki kurulum dosyasının adı noktalıdır:
`Pars.Sistem.Yoneticisi.Setup.1.1.0.exe`. Yerel kopyalar
`YazilimYoneticisiTS\release\` ve `GitHubYukleme\02_GITHUB_RELEASE_EXELERI\`
klasörlerinde tutulur; depoya eklenmez.

## Tanıtım ve indirme sitesi

`website/` klasöründe uygulamanın grafit/altın paletini kullanan bağımsız bir statik site vardır:

- `index.html` — tanıtım, özellikler, güvenlik yaklaşımı ve sık sorulan sorular
- `download.html` — kurulum/portable indirme kartları, SHA-256 doğrulama ve kurulum adımları
- `downloads/latest.json` — son sürüm bildirimi
- `blogger.html` — Blogger için CSS/JS/ikon gömülü tek dosyalık sürüm (`npm run build:blogger`)

Yerel görüntülemek için `website/index.html` dosyasını tarayıcıda açın. Yayınlanan site `docs/`
klasöründen GitHub Pages üzerinde durur. Sürüm, URL, SHA özetleri ve Blogger teması
`.github/workflows/release.yml` tarafından otomatik üretilir; elle kopyalama gerekmez.
Ayrıntılar `GitHubYukleme\05_ACTIONS_REHBER.md` dosyasındadır. Kullanım kılavuzu ve sık sorulan
sorular [GitHub Wiki](https://github.com/pars-sistem-yonetici/pars-sistem-yoneticisi/wiki) sayfasındadır.

## Özellikler

| Sekme | Yapılan iş |
| --- | --- |
| **Anasayfa** | CPU, RAM ve seçili sürücüde boş alan kartları (15 sn’de bir yenilenir) ve sistem özeti. Disk kartlarında birim adı (ör. `Windows`, `Yerel Disk`) gösterilir; bilgiler okunurken animasyonlu “Disk bilgileri alınıyor…” durumu görünür. |
| **Güncellemeler** | `Tümü / winget / Chocolatey / npm / Scoop` kaynak seçicisiyle güncelleme tarar; seçilenleri veya tümünü kendi paket yöneticisiyle günceller. Taramalar salt okunurdur, başarısız kaynaklar diğerlerini engellemez. Tabloda kurulu uygulama/katalog ikonu, okunabilir kaynak adı ve mevcut sürüm gösterilir. winget’in saptanamayan sürüm uyarısı sahte satır olarak eklenmez. |
| **Kurulu Uygulamalar** | Kayıt defterinden gerçek ikonlarla uygulamaları listeler; arama, seçim, winget ile kaldırma ve kaldırma sonrası kalıntı taraması. Kaldırma bitince liste birkaç kez yenilenip kaldırılan uygulama kaybolana kadar bekler; güncelleme listesi de otomatik tazelenir. Toplu kaldırmada tarama yalnızca tüm kaldırma işlemleri bittikten sonra başlar; başarısız kaldırmalar taranmaz. Kalıntılar Geri Dönüşüm Kutusu’na taşınabilir veya açık onayla kalıcı silinebilir. |
| **Yazılım Yedeği** | `winget export` ile kurulu paket listesini JSON olarak yedekler; yeni kurulumdan sonra yedek dosyasını inceleyip yalnızca seçtiğiniz paketleri `winget import` ile geri yükler. Yedekler uygulama veri klasöründe tutulur, dosya yolu dışarıdan okunamaz. Program verileri yedeklenmez. |
| **Başlangıç** | Windows ile açılan uygulamaları (HKCU/HKLM `Run`, `RunOnce` ve Başlangıç klasörleri) listeler; tek tıkla kapatıp açar. Devre dışı bırakılan kayıt girdileri yedeklenir, kısayollar `.disabled` olarak yeniden adlandırılır; geri açma anında geçerlidir. |
| **Güvenlik Duvarı** | Etkin gelen kuralları denetler; kapsamı geniş (`Any`/`0.0.0.0/0`), programı belirtilmemiş, dosya yolu eksik veya imzasız/bozuk imzalı ikilileri **KRİTİK**, tek başına sorunlu olanları **ORTA** olarak işaretler. Seçilen kural tek tıkla devre dışı bırakılabilir veya silinebilir; silmeden önce kural + filtreler JSON olarak yedeklenir (yedek alınamazsa silinmez). |
| **Kötü Amaçlı Yazılım** | Beş yerel, salt-okunur motor: imzalar (Run/task/process kalıpları), sezgisel analiz (user-writable imzasız ikililer, çift uzantı), betik analizi (PowerShell profilleri, WMI abonelikleri, başlangıç betikleri), sistem bütünlüğü (kritik sistem ikililerinin imzası, Winlogon ayarları) ve kalıcılık (WMI, zamanlı görevler, servisler, AppInit/IFEO). Motorlar ayrı ayrı açılıp kapatılabilir; dosya silmez, işlem sonlandırmaz, antivirüs yerine geçmez. |
| **Disk Temizleme** | Geçici dosyalar, küçük resim önbelleği, Windows Update indirmeleri, hata raporları, internet önbelleği, Delivery Optimization, yalnızca cache alt klasörleri (Edge/Chrome/Firefox), npm/NuGet/pip önbellekleri, DNS ve Geri Dönüşüm Kutusu kategorilerini tarar; seçilenleri onay sonrası temizler. Her temizleme `%LOCALAPPDATA%\ParsSistemYoneticisi\logs\disk-cleanup.jsonl` dosyasına kalıcı olarak kaydedilir ve "Temizlik kaydını aç" düğmesiyle görüntülenebilir. |
| **Dosya Tarayıcı** | Seçtiğiniz köklerde yinelenen dosyaları SHA-256 ile doğrulayıp gruplar, 20 MB üzeri dosyaları ve boş dosya/klasörleri listeler. Referans olarak eklediğiniz klasörler taramada görünür ama asla silinmez; sembolik bağlantılar, korumalı sistem yolları ve hariç tutulanlar atlanır. Silme varsayılan olarak Geri Dönüşüm Kutusu’na yapılır, kalıcı silme açık onay ister. |
| **Disk Analizi** | Bir sürücü/klasörün toplam boyutunu, klasör ağacını, uzantı dağılımını ve en büyük dosyaları tek geçişte çıkarır; treemap üzerinden klasörleri açar. Tamamen salt okunurdur, hiçbir şey silmez. |
| **Sistem Onarımı** | `sfc /scannow`, `DISM /RestoreHealth` ve geri yükleme noktasının yanında salt okunur tanılama (`/CheckHealth`, `/ScanHealth`, `/AnalyzeComponentStore`, `sfc /verifyonly`, `chkdsk /scan`), Windows Update ve ağ yığını sıfırlama, bileşen deposu/Store/Search/yazıcı kuyruğu bakımı, tek tıkla sıralı onarım ve WinRE komut rehberi sunar. Değişiklik yapan işlemlerde onay ve zorunlu yedek vardır; yedek başarısızsa değişiklik yapılmaz. WinRE öncesi BCD yedeği alınabilir. |
| **Sürücüler** | Win32_PnPSignedDriver ile kurulu sürücüleri listeler; Windows Update Agent COM API ile sürücü güncellemelerini tarar, indirir ve kurar. Kurulum öncesi `dism /export-driver` ile yedek alma seçeneği vardır. Yönetici izni gerektiren işlemler açıkça bildirilir. |
| **Uygulama Kütüphanesi** | 9 kategoride winget, Chocolatey, npm ve Scoop uygulamaları. Kategori ve paket yöneticisi filtreleri dock görünümünde yatay seçicilerdir; kurulu olmayan yöneticiler devre dışıdır. Kartlar kategori sırasına göre sıralanır; kart tıklamasıyla seçim, sağ panelde seçili liste ve **Yükle** düğmesi. |
| **Kayıt Defteri** | Dokuz kapsamda **salt okunur** tarama: `Uninstall` (yinelenen/boş ad, eksik simge-kurulum klasörü, Temp altındaki kaldırıcı), `App Paths`, COM/`InprocServer32`/`LocalServer32`, HKCU CLSID geçersiz kılma şüphesi (imza kontrolü), dosya ilişkilendirmeleri, hizmet/sürücü `ImagePath`, `SharedDLLs`, yazı tipleri ve ODBC. Kapsamlar ayrı seçilir; tabloda kategori, risk ve öneri sütunları ile `Tümü / Bozuk / Güvenlik uyarısı / Sistem kritik` filtreleri vardır. `UserChoice`, COM, servis, SharedDLLs, font ve ODBC kayıtları **asla otomatik değiştirilmez**. Yalnızca kanıtlanmış bozuk `Uninstall`/`App Paths` girdileri `fixable` işaretlenir; bunlar için zorunlu `.reg` yedek + açık onay gerekir, yedek alınamazsa silinmez. Sistem/korumalı girdilerde onay penceresinde ek uyarı gösterilir. Tarama sonucu JSON veya CSV olarak dışa aktarılabilir; rapor yedeğin yerine geçmez. |
| **Zamanlama** | Haftalık tam temizlik, günlük hafif temizlik, aylık derin temizlik ve özel aralık olmak üzere dört devre dışı hazır plan. Saat/gün/aralık düzenlenebilir, planlar açıkça "Şimdi çalıştır" ile test edilebilir. Çalışma uygulama açıkken 60 saniyelik zamanlayıcı ile yapılır; Geri Dönüşüm Kutusu hiçbir plana dahil edilmez. |
| **Uygulama Ara** | winget kataloğunda arama, indirme (`winget download`) ve kurulum. |
| **Gelişmiş Başlangıç** | Zamanlı görevler, servisler, Winlogon/AppInit/IFEO kayıt değerleri ve WMI aboneliklerini Autoruns benzeri biçimde listeler; filtreler, yüksek yetkili girdi uyarısı, önizlemeli aç/kapat ve yedek zorunluluğu vardır. Winlogon ve WMI girdileri sistem açılışı için kritik olduğundan otomatik değiştirilmez. |
| **Gizlilik Ayarları** | Telemetri, reklam kimliği, arama önerileri, Widgets/haber akışı, dosya uzantıları ve gizli dosyalar gibi iyi bilinen Windows ayarlarını önizlemeli uygular. Her değişiklikten önce `.reg` yedeği alınır, özgün değer saklanır ve ayar tek tek geri alınabilir. |
| **Sağ tık menüsü** | Windows 10 klasik menüsü ile Windows 11 modern menüsü arasında geçiş yapar. Gizli `cmd` ile ilgili `HKCU\Software\Classes\CLSID\{86ca1aa0-…}` anahtarını ekler/siler, işlem bitince Windows Gezgini’ni otomatik yeniden başlatır. Değişiklik yalnızca oturum açan kullanıcıyı etkiler. **Yapılandırma** grubundadır. |
| **Hata Ayıklama** | "Kuruluşunuz tarafından yönetiliyor" bildirimini düzelten iki `.reg` dosyası: Windows ilkeleri ve tarayıcı (Chrome/Edge/Firefox/Brave/Opera/Vivaldi/Yandex) ilkeleri. İçerik arayüzde gösterilir, dosya olarak kaydedilebilir veya doğrudan uygulanabilir. Uygulama öncesi mevcut anahtarların 64/32-bit `.reg` yedekleri alınır; yedek başarısız olursa hiçbir anahtar silinmez. |
| **Ayarlar** | Arayüz dili (Türkçe, İngilizce ve Electron dil paketlerindeki **55 dil**; anında uygulanır), tema (varsayılan grafit/altın veya Windows 11 açık), **Windows ile başlat** ve **sistem tepsisinde başlat** anahtarları, **Hariç Tutulanlar** (klasör ve `.uzantı` listesi; tarama/temizleme/silme işlemleri bunlara dokunmaz), **Gerekli bileşenler** (winget / Chocolatey / npm / Scoop / PowerShell / Visual C++ taraması, eksikler için açık onaylı kurulum; kurumsal sessiz mod açıldığında eksik paket yöneticileri açılışta penceresiz ve onaysız kurulur), **Uygulama güncelleyici** (kendi sürümünü kontrol eder, SHA-512 doğrulamalı indirir ve onayla kurar), kayıt defteri `.reg` ve güvenlik duvarı JSON yedek klasörleri ("klasörü aç" düğmeleriyle), son işlemler listesi, winget durumu/sürümü (yalnızca burada), kaynak güncelleme, sessiz kurulum, kaldırma sonrası otomatik kalıntı taraması ve sürücü seçimi. **Destek ve bağlantılar** kartında Buy me a coffee, GitHub deposu, web sitesi ve MIT lisansı/telif hakkı bağlantıları vardır; aynı bağlantılar sol alt köşede de bulunur. **Kapatma davranışı** seçeneği "Her zaman sor" (varsayılan), "Sistem tepsisine küçült" veya "Uygulamayı kapat" olabilir; kapatırken "Bu tercihi hatırla" işaretlenirse seçim kalıcı hale gelir ve bu listeden değiştirilebilir. Alt+F4 de aynı akışı izler. Tepsiye küçültme sonrası programdan çıkmak için tepsi menüsündeki **Çıkış** kullanılır. |

Sol menüdeki sekmeler **Genel**, **Yazılım Yönetimi**, **Sistem Bakımı**, **Güvenlik**, **Kişiselleştirme** ve **Yapılandırma** gruplarında toplanır. Grup başlıklarında simge ve ok vardır; tıklanınca ilgili sekmeler dock görünümlü bir panelde aşağı doğru animasyonla açılır, aynı anda yalnızca bir grup açık kalır ve etkin sekmenin grubu açılışta otomatik genişler. Brand alanındaki düğme paneli tamamen daraltıp genişletir; daraltılmış halde simgeler görünür kalır. Ayarlar sol alt köşeye sabitlenmiştir. **Yapılandırma** grubu: **Sağ tık menüsü**, **Hata Ayıklama** ve **Ayarlar**.

Türkçe ve İngilizce tam çevirilidir. Diğer diller Electron/Chromium dil paketlerinden listelenir; arayüz
metinleri eksik çeviri dosyalarında İngilizceye döner. Kendi çevirinizi eklemek için Ayarlar’daki
**Çeviri klasörünü aç** düğmesini kullanıp `%APPDATA%\pars-sistem-yoneticisi-ts\translations\<dil-kodu>.json`
dosyasına Türkçe kaynak metin → çeviri anahtarlarını yazabilirsiniz.

## Geliştirme

```powershell
npm install
npm run dev       # Vite + Electron geliştirme modu
npm run build     # TypeScript + Vite derlemesi
npm run dist      # release/ içine NSIS + portable exe üretir
npm run publish   # publish/updates içine latest.json + setup exe hazırlar
```

Node.js 20+ gerekir. Windows 10 (1809+) / Windows 11 ve güncel App Installer (winget) önerilir.

## Uygulama güncellemesi

Uygulama, winget ile diğer yazılımları güncellemekten ayrı olarak **kendi sürümünü** de kontrol edebilir.
Açılışta kontrol varsayılan olarak açıktır; yeni sürüm bulunursa onay penceresi gösterilir. İndirme
öncesi bildirimdeki SHA-512 özeti doğrulanır, özet uyuşmazsa dosya silinir. İndirmeden önce hedef
sürücüde yeterli boş alan denetlenir; disk doluysa veya bağlantı koparsa anlaşılır hata mesajı gösterilir.
Kurulumdan önce ikinci bir onay alınır ve NSIS kurucusu `/S --updated` anahtarlarıyla sessiz modda
başlatılır. Kurulum başlatılamazsa uygulama “başarılı” demeden hatayı bildirir. 1.0.4–1.0.6 sürümlerinden
gelen istemciler de yeni kurucuyu `/SILENT` ile çağırsa bile `preInit` uyumluluğu sayesinde sessizce kurulur.
Portable sürümde exe değiştirilemediği için indirilenler klasörü açılır ve dosyayı elle kopyalama yönergesi gösterilir.

Varsayılan kaynak, projenin Pages adresindeki `downloads/latest.json` dosyasıdır
(`https://pars-sistem-yonetici.github.io/pars-sistem-yoneticisi/downloads`). Pakete ayrıca
`build/updates/latest.json` örnek bildirimi eklenir; Ayarlar → **Güncelleme kaynağı** alanına bir
http(s) adresi veya yerel klasör yazılarak başka bir kaynak kullanılabilir.
Bildirim biçimi:

```json
{
  "version": "1.1.0",
  "notes": "Yeni özellikler ve düzeltmeler",
  "fileName": "Pars Sistem Yoneticisi Setup 1.1.0.exe",
  "sha512": "<exe dosyasının base64 veya hex SHA-512 özeti>",
  "size": 83631421,
  "url": "Pars Sistem Yoneticisi Setup 1.1.0.exe"
}
```

`url` bildirim dosyasına göreli olabilir; verilmezse `fileName` kullanılır. Özeti üretmek için:

```powershell
certutil -hashfile ".\release\Pars Sistem Yoneticisi Setup 1.1.0.exe" SHA512
```

Bu adımları otomatik yapan `npm run publish` komutu da vardır. `package.json` sürümünü okur,
`release/` içindeki setup exe’yi bulur, SHA-512 ve boyutu hesaplar; exe’yi ve `latest.json` dosyasını
`publish/updates/` klasörüne kopyalar. Web’e yükleme yapmaz; klasörü siz yayınlarsınız.

```powershell
npm run publish
npm run publish -- --notes "Küçük düzeltmeler"
npm run publish -- --notes-file release-notes.txt
npm run publish -- --out C:\Yayin\updates
npm run publish -- --embed     # ayrıca build/updates/latest.json güncellenir
npm run publish -- --website   # website/downloads klasörünü de günceller
```

Web sitesini güncelleme kaynağı olarak kullanmak için `--website` ile yayınlayın ve uygulamada
**Güncelleme kaynağı** alanına sitenin `downloads` adresini yazın, örn.
`https://siteniz.com/downloads`. Site ayrıca `downloads/latest.json` dosyasını okuyup son sürümü ve
özetleri sayfada gösterir.

Türkçe sürüm notlarını komut satırında yazmak PowerShell’de karakter bozulmasına yol açabilir;
`--notes-file release-notes.txt` kullanın (dosya UTF-8 olmalı). `--out` ile ağ klasörünü veya web’e
yükleyeceğiniz klasörü doğrudan hedefleyebilirsiniz. `--embed`
yalnızca bir sonraki paketlemede gömülü manifest’i günceller; mevcut kurulu sürümlere ulaşmak için
güncelleme kaynağının sabit bir URL veya klasör olarak ayarlanması gerekir.

Yeni sürüm yayınlarken sürüm numarasını tek komutla güncelleyin (örnek: bir sonraki sürüm 1.2.0):

```powershell
npm run bump -- 1.2.0
```

Bu komut `package.json`, `package-lock.json` (ilk iki alan), `i18n.ts` başlığı, `README.md`,
`RELEASE_NOTES.md` ve `build/updates/latest.json` dosyalarındaki sürümü yazar. `website/` ve `docs/`
dosyalarına dokunmaz; onları workflow üretir. `RELEASE_NOTES.md` içeriğini gözden geçirdikten sonra
GitHub → Actions → **Sürüm yayınla** → **Run workflow** ile sürümü yazın. İndirilen kurulum dosyaları
`%APPDATA%\pars-sistem-yoneticisi-ts\updates` altında tutulur.

> `npm run publish` yalnızca el ile yayın yapıldığında gerekir; GitHub Actions akışı manifest’i
> kendisi üretir. `--check` ile `node scripts/bump-version.js 1.2.0 --check` değişiklikleri
> yazmadan görebilirsiniz.

## Güvenlik

- Uygulama ve kurulum dosyası **`requireAdministrator`** manifest’i ile derlenir; Windows her açılışta
  UAC onayı ister. winget işlemleri, sürücü kurulumu, DISM yedeği ve yönetici gerektiren disk işlemleri
  yükseltilmiş oturumda çalışır.
- Disk temizlemede yalnızca tanımlı klasörlerin **içeriği** silinir; sembolik bağlantılar, korumalı kökler
  ve uygulamanın kendi klasörü **her özyineleme düzeyinde** yeniden denetlenir. Kilitli dosyalar atlanıp işlem devam eder.
  Tarama salt okunurdur; silme yalnızca açık onayla başlar ve sonuçlar JSONL denetim kaydına yazılır.
  Zamanlanmış temizlik yeni önbellek kategorilerini içermez.
- Kurumsal sessiz bileşen kurulumu varsayılan olarak kapalıdır. Açıldığında yalnızca eksik paket yöneticileri
  arka planda kurulur; Chocolatey ve Scoop resmi kurulum betikleriyle, npm Node.js LTS MSI'nin SHA-256 ve
  Authenticode doğrulamasıyla kurulur. Kurulumlar günlüğe yazılır; manuel kurulumda her zaman onay istenir.
- **Hariç Tutulanlar** ayarındaki klasörler ve uzantılar disk temizleme, kalıntı, malware, başlangıç ve
  güvenlik duvarı program yollarında tamamen atlanır. Klasör silinirken içindeki hariç tutulmuş öğeler
  korunur; bu yüzden üst klasörün tamamı atlanır.
- Kalıntı silmede varsayılan yöntem Geri Dönüşüm Kutusu’dur; kalıcı silme ayrı onay ister.
- Kayıt defteri silme işlemi yalnızca işaretli girdilerle sınırlıdır ve `reg export` yedeği zorunludur.
  Yedekler `%LOCALAPPDATA%\ParsSistemYoneticisi\registry_backups` altındadır.
- Güvenlik duvarı kural silme işlemi de yedek zorunluluğuna tabidir; kural ve port/uygulama filtreleri
  `%LOCALAPPDATA%\ParsSistemYoneticisi\firewall_backups` altına JSON olarak yazılır. Yedek başarısızsa kural silinmez.
- Kötü amaçlı yazılım sekmesi salt okunur denetim yapar; hiçbir dosyayı, işlemi, kayıt girdisini veya
  güvenlik duvarı kuralını değiştirmez.
- Sağ tık menüsü değişikliği `HKCU` altında tek bir CLSID kaydını ekler/siler ve Gezgin’i yeniden
  başlatır. İşlemden önce onay istenir; açık dosya pencereleri kapanabilir.
- Uygulama güncelleyici yalnızca bildirimde geçerli SHA-512 özeti olan dosyaları kabul eder; özet veya
  boyut uyuşmazsa indirme iptal edilir ve dosya silinir. İndirme öncesi disk alanı denetlenir; yetersiz
  alan, bağlantı kesilmesi veya kurulum başlatılamaması durumunda açık hata mesajı gösterilir. Kurulum
  yalnızca kullanıcı onayından sonra başlar; NSIS `/S --updated` ile sessiz kurulur ve eski istemcilerin
  `/SILENT` çağrıları kurucu tarafından uyumluluk için tanınır.
- Sürücü kurulumu yönetici izni gerektirir; yedekler `%LOCALAPPDATA%\ParsSistemYoneticisi\driver_backups` altına yazılır.
  Kurulumdan önce yedek alma varsayılan olarak açıktır.
- Renderer’dan gelen IPC argümanları `src/main/ipc-guard.ts` içindeki şemalarla doğrulanır; eksik, yanlış
  tipli veya sınır dışı argüman servislere ulaşmadan reddedilir ve güvenlik kaydına yazılır.
- `shell:open-path` yalnızca uygulamanın kendi klasörleri, indirmeler, geçici klasör ve kullanıcının
  dialog ile seçtiği klasörler için çalışır; Windows/Program Files kökleri her zaman reddedilir.
- winget kimliği ve arama sorguları seçenek/enjeksiyon karakterlerine karşı doğrulanır. PowerShell
  betiklerine gömülen tüm değişkenler tek tırnaklı literal olarak kaçışlanır (`psLiteral`).
- Dosya tarayıcı sembolik bağlantıları izlemez; korumalı kökler, çalışma zamanı klasörleri ve hariç
  tutulan yollar taramada ve silmede atlanır. Referans klasörler büyük/küçük harf farkı gözetilmeden
  korunur; atlanan dosyalar sonuçta açıkça "Referans klasör; atlandı." olarak bildirilir.
- Paket yedeği yalnızca uygulamanın `package_backups` klasöründen okunabilir; dışarıdan yol verilmesi
  reddedilir. Geri yükleme, seçilen kimliklerden geçici bir winget dosyası oluşturur ve bitince siler.
- Gelişmiş başlangıçta görev/servis değişikliği özgün durum JSON olarak, kayıt değeri değişikliği
  `.reg` olarak yedeklenir; yedek alınamazsa değişiklik yapılmaz. Winlogon ve WMI girdileri salt okunurdur.
- Gizlilik ayarları tek değerle sınırlıdır; her uygulama/geri alma `.reg` yedeği ve özgün değer kaydı
  üretir. Yedek başarısızsa ayar yazılmaz.
- Disk analizi ve dosya tarama salt okunurdur; silme yalnızca açık seçim ve onay sonrasında, tercihen
  Geri Dönüşüm Kutusu üzerinden yapılır.

## Dosya yapısı

```
src/main/        Electron ana süreç, IPC, PowerShell/winget servisleri
src/renderer/    React arayüzü
src/shared/      Tipler, i18n ve doğrulanmış yazılım kataloğu
build/icon.ico   Uygulama ikonu
build/prereqs/   Pakete gömülen küçük winget onarım betiği
scripts/         Yayın, site ve sürüm yardımcı betikleri
release/         Üretilen .exe dosyaları (depoya eklenmez)
```

## GitHub yayını

Site `docs/` altında bulunur ve GitHub Pages üzerinden yayınlanır. Kurulum dosyaları depoya
eklenmez; **Releases** bölümünde tutulur. Sürüm akışı `GitHubYukleme\05_ACTIONS_REHBER.md`,
Blogger teması `GitHubYukleme\08_BLOGGER_TEMA\OKUNMAMI_REHBER.md` dosyalarında anlatılır.

## Destek

Uygulamayı faydalı bulduysanız geliştirmenin sürmesine yardımcı olabilirsiniz:
[Buy me a coffee](https://buymeacoffee.com/parssistemyonetici)

İndirme, güncelleme ve tüm temel özellikler her zaman ücretsizdir. Bu bağlantı yalnızca
gönüllü destek içindir; uygulama içindeki **Ayarlar → Destek ve Lisans** kartından da açılır.

## Lisans & Telif Hakkı

Pars Sistem Yöneticisi **MIT Lisansı** ile dağıtılır.

- Telif hakkı: **Copyright (c) 2026 Pars Sistem Yöneticisi**
- Kullanım, kopyalama, değiştirme, birleştirme, yayımlama ve dağıtım koşulları depodaki
  [`LICENSE`](LICENSE) dosyasında yer alır.
- Uygulama içinde bu bilgi **Ayarlar → Lisans & Telif Hakkı** kartında gösterilir.
- Üçüncü taraf bileşenler (Electron, React, winget ve diğer paket yöneticileri) kendi
  lisanslarına tabidir; bu proje onların telif haklarını kapsamaz.
