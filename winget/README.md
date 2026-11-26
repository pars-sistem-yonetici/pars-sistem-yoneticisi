# winget manifest taslağı — Pars Sistem Yöneticisi 1.1.0

Bu klasör, uygulamanın `microsoft/winget-pkgs` kataloğuna gönderilmesi için hazırlanmış **çok dosyalı** manifest taslağıdır (şema 1.28.0). Katalog onaylanmadan kullanıcılar bu komutu kullanamaz:

```powershell
winget install --id ParsSistemYonetici.ParsSistemYoneticisi --exact
```

## Dosyalar

```
winget/manifests/p/ParsSistemYonetici/ParsSistemYoneticisi/1.1.0/
  ParsSistemYonetici.ParsSistemYoneticisi.version.yaml
  ParsSistemYonetici.ParsSistemYoneticisi.defaultLocale.yaml
  ParsSistemYonetici.ParsSistemYoneticisi.installer.yaml
```

Kurulum dosyası: `Pars.Sistem.Yoneticisi.Setup.1.1.0.exe` — 83.632.376 bayt, SHA-256 `DF6DAB2907F93C396B5F498DF093BDEF68977344270EB30872E8EDE6AF87877D`.

## Yerel doğrulama

```powershell
winget validate --manifest winget/manifests/p/ParsSistemYonetici/ParsSistemYoneticisi/1.1.0
winget install --manifest winget/manifests/p/ParsSistemYonetici/ParsSistemYoneticisi/1.1.0 --silent
```

## Gönderim

1. `microsoft/winget-pkgs` deposunu fork edin.
2. Yukarıdaki `manifests/p/ParsSistemYonetici/ParsSistemYoneticisi/1.1.0/` klasörünü fork’un aynı yoluna kopyalayın.
3. PR başlığı: `New package: ParsSistemYonetici.ParsSistemYoneticisi version 1.1.0`.
4. Yayımcı kimliği (publisher ownership) doğrulaması istenebilir; GitHub deposu ve resmi site kanıt olarak verilebilir.
5. PR onaylandıktan sonra README’deki `winget install` komutu gerçekten çalışır.

## Yeni sürümde

`1.1.0` klasörünü yeni sürüm adıyla kopyalayın; üç YAML dosyasındaki `PackageVersion`, `InstallerUrl`, `InstallerSha256` ve `DisplayVersion` değerlerini güncelleyin. Aynı sürüm için ikinci PR açmayın.
