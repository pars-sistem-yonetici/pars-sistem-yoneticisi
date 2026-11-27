# winget manifest taslağı — Pars Sistem Yöneticisi 1.3.0

Bu klasör, uygulamanın `microsoft/winget-pkgs` kataloğuna gönderilmesi için hazırlanmış **çok dosyalı** manifest taslağıdır (şema 1.28.0). Katalog onaylanmadan kullanıcılar bu komutu kullanamaz:

```powershell
winget install --id ParsSistemYonetici.ParsSistemYoneticisi --exact
```

## Dosyalar

```
winget/manifests/p/ParsSistemYonetici/ParsSistemYoneticisi/1.3.0/
  ParsSistemYonetici.ParsSistemYoneticisi.version.yaml
  ParsSistemYonetici.ParsSistemYoneticisi.defaultLocale.yaml
  ParsSistemYonetici.ParsSistemYoneticisi.installer.yaml
```

Kurulum dosyası: `Pars.Sistem.Yoneticisi.Setup.1.3.0.exe` — 85.427.326 bayt, SHA-256 `55567EC3E35F5FB04CD0CB1A24C816A2F226A7E03334B49EA734428D295C4677`.

## Yerel doğrulama

```powershell
winget validate --manifest winget/manifests/p/ParsSistemYonetici/ParsSistemYoneticisi/1.3.0
winget install --manifest winget/manifests/p/ParsSistemYonetici/ParsSistemYoneticisi/1.3.0 --silent
```

## Gönderim

1. `microsoft/winget-pkgs` deposunu fork edin.
2. Yukarıdaki `manifests/p/ParsSistemYonetici/ParsSistemYoneticisi/1.3.0/` klasörünü fork’un aynı yoluna kopyalayın.
3. PR başlığı: `New package: ParsSistemYonetici.ParsSistemYoneticisi version 1.3.0`.
4. Yayımcı kimliği (publisher ownership) doğrulaması istenebilir; GitHub deposu ve resmi site kanıt olarak verilebilir.
5. PR onaylandıktan sonra README’deki `winget install` komutu gerçekten çalışır.

> winget-pkgs pull request’i senin açık onayın olmadan açılmadı; taslak yalnızca depoda hazır bekliyor.

## Yeni sürümde

`1.3.0` klasörünü yeni sürüm adıyla kopyalayın; üç YAML dosyasındaki `PackageVersion`, `InstallerUrl`, `InstallerSha256` ve `DisplayVersion` değerlerini güncelleyin. Aynı sürüm için ikinci PR açmayın.
