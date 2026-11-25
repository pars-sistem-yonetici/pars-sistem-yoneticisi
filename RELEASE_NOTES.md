# Pars Sistem Yöneticisi 1.0.4

1.0.3’e ek olarak altı yeni özellik, simgeli/daraltılabilir sol gezinme, destek ve lisans bağlantıları, disk adları, güncelleme ikonları ve eski sürümü algılayan kurulum eklendi.

## Bu sürümde

- **Yazılım Yedeği:** `winget export` ile kurulu paket listesini JSON olarak yedekler; yeni kurulumda yedeği inceleyip yalnızca seçtiğiniz paketleri `winget import` ile geri yükler. Yedekler uygulama veri klasöründe saklanır ve klasör dışından okunamaz.
- **Dosya Tarayıcı:** SHA-256 ile doğrulanmış yinelenen dosya grupları, 20 MB üzeri dosyalar, boş dosya/klasörler ve geri kazanılabilir alan. Referans klasörleri koruma, sembolik bağlantı atlama, varsayılan Geri Dönüşüm Kutusu silme ve açık onaylı kalıcı silme.
- **Disk Analizi:** Salt okunur tek geçişli tarama; klasör ağacı, treemap alan haritası, en büyük dosyalar ve uzantı istatistikleri.
- **Sistem Onarımı:** `sfc /scannow`, `DISM /RestoreHealth` ve geri yükleme noktasına ek olarak 5 salt okunur tanılama (`/CheckHealth`, `/ScanHealth`, `/AnalyzeComponentStore`, `sfc /verifyonly`, `chkdsk /scan`), Windows Update bileşen sıfırlama (klasörler ".old" olarak korunur), ağ yığını sıfırlama, bileşen deposu/Store/Search/yazıcı kuyruğu bakımı, tek tıkla sıralı onarım ve WinRE komut rehberi. Değişiklik yapan işlemlerde onay ve zorunlu yedek; yedek başarısızsa değişiklik yapılmaz. BCD yedeği ve Gelişmiş başlatmaya yeniden başlatma ayrıca sunulur.
- **Gelişmiş Başlangıç:** Zamanlı görevler, servisler, Winlogon, AppInit, IFEO ve WMI aboneliklerini listeleyen Autoruns benzeri görünüm; filtreleme ve yedek zorunlu aç/kapat. Winlogon ve WMI girdileri salt okunur.
- **Gizlilik Ayarları:** Telemetri, reklam kimliği, arama önerileri, Widgets/haber akışı, dosya uzantıları ve gizli dosyalar için önizlemeli, geri alınabilir ayarlar. Her değişiklikte `.reg` yedeği ve özgün değer kaydı zorunludur.
- **Genişletilmiş Kayıt Defteri Taraması:** Uninstall detaylarına ek olarak App Paths, COM/Shell bileşenleri, HKCU CLSID geçersiz kılma şüphesi (imza kontrolü), dosya ilişkilendirmeleri, hizmet/sürücü yolları, SharedDLLs, yazı tipleri ve ODBC taranır. Tüm kapsamlar varsayılan olarak salt okunurdur; `UserChoice`, COM, servis ve referans kayıtlarına dokunulmaz. Kategori/risk filtreleri ve JSON/CSV rapor dışa aktarma eklendi. Yalnızca kanıtlanmış bozuk Uninstall/App Paths girdileri zorunlu `.reg` yedek + onayla silinebilir.
- **Genişletilmiş Disk Temizleme:** Delivery Optimization önbelleği, Edge/Chrome/Firefox yalnızca cache alt klasörleri ve npm/NuGet/pip önbellekleri eklendi. Özyinelemeli koruma/sembolik bağlantı denetimi güçlendirildi; her temizleme kalıcı JSONL kaydına yazılıyor.
- **Paket Yöneticisi Kurulumu:** Ayarlar artık winget / Chocolatey / npm / Scoop durumunu gösterir. Manuel kurulum açık onayla yapılır; varsayılan kapalı olan **Kurumsal sessiz kurulum** açıldığında eksik paket yöneticileri açılışta arka planda, penceresiz ve loglu kurulur. npm için Node.js LTS MSI'si SHA-256 + Authenticode ile doğrulanır.
- 38 yeni doğrulama geçti: dosya tarama/silme, referans koruması, disk analizi, winget yedek/okuma, gizlilik listesi, başlangıç taraması ve IPC şemaları. Kayıt defteri tarama betiği 2.362 kayıt üzerinde doğrulandı; yanlış pozitif bozuk bulgusu yok.
- Yıkıcı işlemlerde onay + zorunlu yedek; yedek başarısızsa değişiklik yapılmaz.
- Hariç tutma kuralları, korumalı yollar ve salt-okunur tarama varsayılanı tüm yeni servislerde geçerlidir.
- **Uygulama Kütüphanesi:** “Önerilen yazılımlar” sekmesi yeniden düzenlendi. Kategoriler Tümü, Tarayıcı, Medya & Tasarım, Oyun, İletişim, Güvenlik, Sistem & Çalışma Zamanı, Verimlilik, Geliştirme ve Paket Yöneticileri sırasında; kart tıklaması uygulamayı seçer, seçilenler sağ panelde listelenir ve **Yükle** düğmesi kurulumu başlatır. winget, Chocolatey, npm ve Scoop uygunluk durumu artık ilgili düğmenin içinde gösterilir.
- **Tek örnek ve sistem tepsisi:** Aynı anda yalnızca bir uygulama penceresi açılır; ikinci başlatma mevcut pencereyi küçültülmüş/gizli olsa bile geri yükleyip öne getirir. Tepsi simgesi ve “Pencereyi göster” kısayolu artık küçültülmüş pencereyi de açar; simge paket dışından yüklenerek asar kaynaklı görünmezliğe karşı sağlamlaştırıldı.
- **Sol gezinme paneli:** Grup başlıkları artık simgeli; sekmeler dock görünümlü küçük bir panelde toplanır. Brand alanındaki düğme paneli tamamen daraltıp genişletir; daraltılmış halde simgeler ve grup ikonları görünür kalır. Kişiselleştirme grubu ayrı bir grup olarak listelenir.
- **Destek ve lisans:** Ayarlar’a Buy me a coffee, GitHub deposu, web sitesi ve MIT lisansı/telif hakkı kartı eklendi. Sol alt kısımda aynı bağlantılara hızlı erişim düğmeleri var; bağlantılar yalnızca onaylı HTTPS adreslerinde tarayıcıda açılır.
- **Anasayfa ve güncellemeler:** Disk kartlarında sürücü harfiyle birlikte birim adı gösterilir; bilgiler okunurken “Disk bilgileri alınıyor…” animasyonu görünür. Güncelleme tablosunda uygulama ikonları ve mevcut sürüm kırmızı baloncukta gösterilir. Uygulama Kütüphanesi kartları kategori sırasına göre sıralanır.
- **Kurulum:** NSIS kurulumu eski sürümü kayıt defterinden algılar, yükseltmede eski sürümü kaldırıp yeniden kurar; kurulum günlüğünde durum açıkça belirtilir. Uygulama verileri (`deleteAppDataOnUninstall: false`) korunur.
- İmzasız dağıtım + SHA-256 bütünlük doğrulaması sürüyor.

### 1.0.3’ten gelenler

Toplu güvenlik taraması (8,6 kat hızlanma), kurulum/güncelleme kuyruğu, ana sayfa iyileştirmeleri ve WinRAR/7-Zip gibi üçüncü taraf sağ tık menüsü eklentilerinin yönetimi.

## Ekran görüntüleri

Görüntüler 1.0.4 arayüzünden alınmıştır; tanıtım sitesi, README ve bu release notu aynı dosyaları kullanır.

| Anasayfa | Kurulu Uygulamalar |
| --- | --- |
| ![Anasayfa](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-home.png) | ![Kurulu uygulamalar](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-apps.png) |
| ![Güncellemeler](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-updates.png) | ![Sağ tık menüsü](https://raw.githubusercontent.com/pars-sistem-yonetici/pars-sistem-yoneticisi/main/website/assets/screen-context.png) |

## İndirme

- **Kurulum:** `Pars Sistem Yoneticisi Setup 1.0.4.exe` (NSIS, başlat menüsü + masaüstü kısayolu)
- **Portable:** `ParsSistemYoneticisi-Portable.exe`

Windows 10 (1809+) / Windows 11 x64 ve güncel App Installer (winget) gereklidir.
Uygulama yönetici izinleriyle çalışır; açılışta UAC onayı görünür.

> İmzasız dağıtım olduğu için SmartScreen uyarısı çıkabilir. İndirme sayfasındaki SHA-256
> özetleriyle dosya bütünlüğünü doğrulayabilirsiniz.
