# Pars Sistem Yöneticisi — tanıtım ve indirme sitesi

Uygulamanın grafit/altın temasını kullanan, derleme gerektirmeyen statik web sitesi.

## Dosyalar

| Dosya | Açıklama |
| --- | --- |
| `index.html` | Tanıtım sayfası: hero, uygulama maketi, özellikler, güvenlik yaklaşımı, SSS. |
| `download.html` | İndirme sayfası: kurulum ve portable kartları, SHA-256 özetleri, doğrulama komutu, kurulum adımları ve gereksinimler. |
| `styles.css` | Uygulamayla aynı renk değişkenleri (`--accent: #d2a23f`), duyarlı düzen ve animasyonlar. |
| `app.js` | Mobil menü, aktif menü bağlantısı ve özet kopyalama düğmeleri. |
| `assets/` | Uygulama ikonu ve favicon. |
| `downloads/` | Dağıtılacak iki exe’nin kopyası ve uygulamanın okuduğu `latest.json` güncelleme bildirimi. |
| `blogger.html` | Blogger için tek dosyalık sürüm; CSS, JS ve ikon gömülüdür. |

## Yerel açma

`index.html` dosyasına çift tıklayın veya bir statik sunucu kullanın:

```powershell
cd website
npx serve .
```

Bağlantılar göreli olduğu için site bir alt dizine kopyalandığında da çalışır.

## Yeni sürüm yayınlama kontrol listesi

1. `package.json`, `src/renderer/App.tsx` ve `src/shared/i18n.ts` içinde sürümü artırın.
2. `npm run dist` ile `release/` klasörünü oluşturun.
3. Projeyi paketlediğiniz klasörden şunu çalıştırın:
   ```powershell
   npm run publish -- --website --notes "Kısa sürüm notu"
   ```
   Bu komut iki exe’yi ve `latest.json` dosyasını `website/downloads/` içine kopyalar; SHA-512/SHA-256
   özetleri ile boyutları hesaplar. `app.js` sayfadaki sürümü ve özetleri bu dosyadan okur.
4. Siteyi yükleyin. Uygulamada **Ayarlar → Güncelleme kaynağı** alanına sitenin `downloads` adresini
   yazın, örn. `https://siteniz.com/downloads`. Böylece kurulu sürümler yeni manifest’i görür.
5. Sürüm notunu değiştirmek için `--notes "..."` parametresini kullanın. Türkçe metinlerde PowerShell
   karakter bozulmasını önlemek için UTF-8 bir dosya oluşturup `--notes-file release-notes.txt` deyin.
   Gerekirse dosya adı veya klasör yapısı değiştiyse `download.html` içindeki bağlantıları da gözden geçirin.
6. `--embed` eklerseniz `build\updates\latest.json` da güncellenir ve bir sonraki paketlemede uygulamaya
   gömülür. Mevcut kurulumlara ulaşmak için dış kaynak adresi yine gereklidir.

## Blogger yayını

`blogger.html` dosyası, tanıtım ve indirme sayfalarını tek sayfada birleştirir; CSS, JS ve ikon gömülüdür.
Yeniden üretmek için proje kökünden:

```powershell
npm run build:blogger
```

Ayarları `website/blogger.js` dosyasının başındaki `CONFIG` bloğunda değiştirip yeniden üretin;
böylece sonraki güncellemelerde ayarlarınız korunur:

- `setupUrl` → kurulum exe’sinin tam URL’si
- `portableUrl` → portable exe’sinin tam URL’si
- `latestJsonUrl` → `latest.json` tam URL’si; kullanmayacaksanız `''` bırakın

Üretilen `blogger.html` içindeki `{{SETUP_URL}}`, `{{PORTABLE_URL}}` ve `{{LATEST_JSON_URL}}` yer
tutucuları da doğrudan düzenlenebilir, ancak yeniden üretimde üzerine yazılır.

Ardından dosyanın tamamını **Blogger → Sayfalar → Yeni Sayfa → HTML görünümü** içine yapıştırın.
Exe dosyaları Blogger’a yüklenemez; GitHub Releases veya kendi sunucunuz kullanılmalıdır.
`latest.json` okunamazsa sayfadaki sabit sürüm ve özet değerleri görünmeye devam eder.

## Notlar

- Dosyalar kod imzasıyla yayınlanmadığı için SmartScreen uyarısı görülebilir; sayfada bütünlük özeti ve UAC bilgisi açıkça belirtilmiştir.
- İndirme bağlantıları `download` özniteliği kullanır; tarayıcı dosyayı farklı kaydet dialoguna yönlendirir.
- Siteyi yayımlarken yalnızca `website/` klasörünü yüklemeniz yeterlidir; `release/` klasörüne ihtiyaç yoktur.
