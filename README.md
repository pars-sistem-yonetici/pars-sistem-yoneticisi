# Pars Sistem Yöneticisi (TypeScript / Electron)

Windows için winget tabanlı sistem bakım ve yazılım yöneticisi paneli. Mevcut Python uygulamasının
TypeScript + Electron + React karşılığıdır; eski `YazilimYoneticisi/` klasörüne dokunulmaz.

Arayüz, grafit/gümüş palet ve koyu sarı vurgularla temalandırılmıştır. **Ayarlar → Tema** üzerinden
Windows 11 açık temasına anında geçilebilir; tercih `settings.json` içinde saklanır. Windows'un native
başlık çubuğu yerine temayla uyumlu, sürüklenebilir özel pencere çerçevesi kullanılır;
küçültme/büyütme/kapatma düğmeleri de aynı paleti izler. Anasayfadaki CPU/RAM/boş depolama kartlarında
durum ikonları bulunur.

## Hazır çıktılar

`release/` klasöründe:

- `Pars Sistem Yoneticisi Setup 1.0.2.exe` — NSIS kurulum dosyası (başlat menüsü + masaüstü kısayolu)
- `ParsSistemYoneticisi-Portable.exe` — tek dosya, kurulum gerektirmeyen sürüm
- `win-unpacked/` — açılmış uygulama klasörü

## Tanıtım ve indirme sitesi

`website/` klasöründe uygulamanın grafit/altın paletini kullanan bağımsız bir statik site vardır:

- `index.html` — tanıtım, özellikler, güvenlik yaklaşımı ve sık sorulan sorular
- `download.html` — kurulum/portable indirme kartları, SHA-256 doğrulama ve kurulum adımları
- `downloads/` — `release/` içindeki iki exe’nin kopyası; site tek başına yayınlanabilir
- `blogger.html` — Blogger için CSS/JS/ikon gömülü tek dosyalık sürüm (`npm run build:blogger`)

Yerel görüntülemek için `website/index.html` dosyasını tarayıcıda açın. Yeni sürüm çıktığında exe’leri
`release/` içinden `website/downloads/` klasörüne kopyalayıp `download.html` dosyasındaki sürüm, boyut
ve SHA-256 değerlerini güncelleyin. Ayrıntılar `website/README.md` dosyasındadır.

## Özellikler

| Sekme | Yapılan iş |
| --- | --- |
| **Anasayfa** | CPU, RAM ve seçili sürücüde boş alan kartları (15 sn’de bir yenilenir) ve sistem özeti. |
| **Güncellemeler** | winget ile güncellemesi olan paketleri listeler; seçilenleri veya tümünü günceller. |
| **Kurulu Uygulamalar** | Kayıt defterinden gerçek ikonlarla uygulamaları listeler; arama, seçim, winget ile kaldırma ve kaldırma sonrası kalıntı taraması. Kaldırma bitince liste birkaç kez yenilenip kaldırılan uygulama kaybolana kadar bekler; güncelleme listesi de otomatik tazelenir. Toplu kaldırmada tarama yalnızca tüm kaldırma işlemleri bittikten sonra başlar; başarısız kaldırmalar taranmaz. Kalıntılar Geri Dönüşüm Kutusu’na taşınabilir veya iki aşamalı onayla kalıcı silinebilir. |
| **Başlangıç** | Windows ile açılan uygulamaları (HKCU/HKLM `Run`, `RunOnce` ve Başlangıç klasörleri) listeler; tek tıkla kapatıp açar. Devre dışı bırakılan kayıt girdileri yedeklenir, kısayollar `.disabled` olarak yeniden adlandırılır; geri açma anında geçerlidir. |
| **Güvenlik Duvarı** | Etkin gelen kuralları denetler; kapsamı geniş (`Any`/`0.0.0.0/0`), programı belirtilmemiş, dosya yolu eksik veya imzasız/bozuk imzalı ikilileri **KRİTİK**, tek başına sorunlu olanları **ORTA** olarak işaretler. Seçilen kural tek tıkla devre dışı bırakılabilir veya silinebilir; silmeden önce kural + filtreler JSON olarak yedeklenir (yedek alınamazsa silinmez). |
| **Kötü Amaçlı Yazılım** | Beş yerel, salt-okunur motor: imzalar (Run/task/process kalıpları), sezgisel analiz (user-writable imzasız ikililer, çift uzantı), betik analizi (PowerShell profilleri, WMI abonelikleri, başlangıç betikleri), sistem bütünlüğü (kritik sistem ikililerinin imzası, Winlogon ayarları) ve kalıcılık (WMI, zamanlı görevler, servisler, AppInit/IFEO). Motorlar ayrı ayrı açılıp kapatılabilir; dosya silmez, işlem sonlandırmaz, antivirüs yerine geçmez. |
| **Disk Temizleme** | Geçici dosyalar, küçük resim önbelleği, Windows Update indirmeleri, hata raporları, internet önbelleği, DNS ve Geri Dönüşüm Kutusu kategorilerini tarar; seçilenleri onay sonrası temizler. |
| **Sürücüler** | Win32_PnPSignedDriver ile kurulu sürücüleri listeler; Windows Update Agent COM API ile sürücü güncellemelerini tarar, indirir ve kurar. Kurulum öncesi `dism /export-driver` ile yedek alma seçeneği vardır. Yönetici izni gerektiren işlemler açıkça bildirilir. |
| **Önerilen Yazılımlar** | 7 kategoride winget ile doğrulanmış **142 uygulama**. Eksik sistem bileşenleri vurgulanır; arama, kategori filtresi, çoklu seçim veya çift tıklama ile kurulum. |
| **Kayıt Defteri** | Bozuk `Uninstall` girdilerini HKLM/HKCU (64-bit ve 32-bit) üzerinde tarar; Microsoft/Windows/.NET gibi korumalı sistem bileşenleri de dahil edilir ve `SİSTEM` rozetiyle işaretlenir. Silmeden önce her girdi `.reg` olarak yedeklenir; yedek alınamazsa silinmez. Sistem girdileri için onay penceresinde ek uyarı gösterilir. |
| **Zamanlama** | Haftalık tam temizlik, günlük hafif temizlik, aylık derin temizlik ve özel aralık olmak üzere dört devre dışı hazır plan. Saat/gün/aralık düzenlenebilir, planlar açıkça "Şimdi çalıştır" ile test edilebilir. Çalışma uygulama açıkken 60 saniyelik zamanlayıcı ile yapılır; Geri Dönüşüm Kutusu hiçbir plana dahil edilmez. |
| **Uygulama Ara** | winget kataloğunda arama, indirme (`winget download`) ve kurulum. |
| **Sağ tık menüsü** | Windows 10 klasik menüsü ile Windows 11 modern menüsü arasında geçiş yapar. Gizli `cmd` ile ilgili `HKCU\Software\Classes\CLSID\{86ca1aa0-…}` anahtarını ekler/siler, işlem bitince Windows Gezgini’ni otomatik yeniden başlatır. Değişiklik yalnızca oturum açan kullanıcıyı etkiler. **Yapılandırma** grubundadır. |
| **Hata Ayıklama** | "Kuruluşunuz tarafından yönetiliyor" bildirimini düzelten iki `.reg` dosyası: Windows ilkeleri ve tarayıcı (Chrome/Edge/Firefox/Brave/Opera/Vivaldi/Yandex) ilkeleri. İçerik arayüzde gösterilir, dosya olarak kaydedilebilir veya doğrudan uygulanabilir. Uygulama öncesi mevcut anahtarların 64/32-bit `.reg` yedekleri alınır; yedek başarısız olursa hiçbir anahtar silinmez. |
| **Ayarlar** | Arayüz dili (Türkçe, İngilizce ve Electron dil paketlerindeki **55 dil**; anında uygulanır), tema (varsayılan grafit/altın veya Windows 11 açık), **Windows ile başlat** ve **sistem tepsisinde başlat** anahtarları, **Hariç Tutulanlar** (klasör ve `.uzantı` listesi; tarama/temizleme/silme işlemleri bunlara dokunmaz), **Gerekli bileşenler** (winget / PowerShell / Visual C++ taraması, eksikler için gömülü onarım betiği veya imza doğrulamalı indirme), **Uygulama güncelleyici** (kendi sürümünü kontrol eder, SHA-512 doğrulamalı indirir ve onayla kurar), kayıt defteri `.reg` ve güvenlik duvarı JSON yedek klasörleri ("klasörü aç" düğmeleriyle), son işlemler listesi, winget durumu/sürümü (yalnızca burada), kaynak güncelleme, sessiz kurulum, kaldırma sonrası otomatik kalıntı taraması ve sürücü seçimi. **Kapatma davranışı** seçeneği "Her zaman sor" (varsayılan), "Sistem tepsisine küçült" veya "Uygulamayı kapat" olabilir; kapatırken "Bu tercihi hatırla" işaretlenirse seçim kalıcı hale gelir ve bu listeden değiştirilebilir. Alt+F4 de aynı akışı izler. Tepsiye küçültme sonrası programdan çıkmak için tepsi menüsündeki **Çıkış** kullanılır. |

Sol menüdeki sekmeler **Genel**, **Yazılım Yönetimi**, **Sistem Bakımı**, **Güvenlik** ve **Yapılandırma** gruplarında toplanır. Grup başlığındaki ok tıklanınca ilgili sekmeler aşağı doğru animasyonla açılır; aynı anda yalnızca bir grup açık kalır, etkin sekmenin grubu açılışta otomatik genişler. **Yapılandırma** grubu: **Sağ tık menüsü**, **Hata Ayıklama** ve **Ayarlar**.

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
öncesi bildirimdeki SHA-512 özeti doğrulanır, özet uyuşmazsa dosya silinir. Kurulumdan önce ikinci
bir onay alınır ve NSIS kurucusu sessiz modda başlatılır. Portable sürümde exe değiştirilemediği için
indirilenler klasörü açılır ve dosyayı elle kopyalama yönergesi gösterilir.

Varsayılan kaynak, exe yanındaki `updates\latest.json` dosyasıdır (pakete `build/updates/` altından
eklenir). Ayarlar → **Güncelleme kaynağı** alanına bir http(s) adresi veya yerel klasör yazabilirsiniz.
Bildirim biçimi:

```json
{
  "version": "1.0.2",
  "notes": "Yeni özellikler ve düzeltmeler",
  "fileName": "Pars Sistem Yoneticisi Setup 1.0.2.exe",
  "sha512": "<exe dosyasının base64 veya hex SHA-512 özeti>",
  "size": 83530329,
  "url": "Pars Sistem Yoneticisi Setup 1.0.2.exe"
}
```

`url` bildirim dosyasına göreli olabilir; verilmezse `fileName` kullanılır. Özeti üretmek için:

```powershell
certutil -hashfile ".\release\Pars Sistem Yoneticisi Setup 1.0.2.exe" SHA512
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

Yeni sürüm yayınlarken `package.json` içindeki `version`, `App.tsx` içindeki sidebar sürüm metni,
`i18n.ts` içindeki sürüm çevirisi ve `latest.json` birlikte güncellenmelidir. İndirilen kurulum
dosyaları `%APPDATA%\pars-sistem-yoneticisi-ts\updates` altında tutulur.

## Güvenlik

- Uygulama ve kurulum dosyası **`requireAdministrator`** manifest’i ile derlenir; Windows her açılışta
  UAC onayı ister. winget işlemleri, sürücü kurulumu, DISM yedeği ve yönetici gerektiren disk işlemleri
  yükseltilmiş oturumda çalışır.
- Disk temizlemede yalnızca tanımlı klasörlerin **içeriği** silinir; sembolik bağlantılar, korumalı kökler
  ve uygulamanın kendi klasörü atlanır. Kilitli dosyalar atlanıp işlem devam eder.
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
  boyut uyuşmazsa indirme iptal edilir ve dosya silinir. Kurulum yalnızca kullanıcı onayından sonra başlar.
- Sürücü kurulumu yönetici izni gerektirir; yedekler `%LOCALAPPDATA%\ParsSistemYoneticisi\driver_backups` altına yazılır.
  Kurulumdan önce yedek alma varsayılan olarak açıktır.

## Dosya yapısı

```
src/main/        Electron ana süreç, IPC, PowerShell/winget servisleri
src/renderer/    React arayüzü
src/shared/      Tipler, i18n ve doğrulanmış yazılım kataloğu
build/icon.ico   Uygulama ikonu
build/prereqs/   Pakete gömülen küçük winget onarım betiği
release/         Üretilen .exe dosyaları
```
