# winget manifest taslağı — Pars Sistem Yöneticisi 1.2.0

Bu klasör, uygulamanın `microsoft/winget-pkgs` kataloğuna gönderilmesi için hazırlanmış **çok dosyalı** manifest taslağıdır (şema 1.28.0). Katalog onaylanmadan kullanıcılar bu komutu kullanamaz:

```powershell
winget install --id ParsSistemYonetici.ParsSistemYoneticisi --exact
```

## Dosyalar

```
winget/manifests/p/ParsSistemYonetici/ParsSistemYoneticisi/1.2.0/
  ParsSistemYonetici.ParsSistemYoneticisi.version.yaml
  ParsSistemYonetici.ParsSistemYoneticisi.defaultLocale.yaml
  ParsSistemYonetici.ParsSistemYoneticisi.installer.yaml
```

Kurulum dosyası: `Pars.Sistem.Yoneticisi.Setup.1.2.0.exe` — 85.424.937 bayt, SHA-256 `1F6A56DE4AAA0F99960F476A53FF896F0DF870C36C9B44E5A87BC59C04534D3B`.

## Yerel doğrulama

```powershell
winget validate --manifest winget/manifests/p/ParsSistemYonetici/ParsSistemYoneticisi/1.2.0
winget install --manifest winget/manifests/p/ParsSistemYonetici/ParsSistemYoneticisi/1.2.0 --silent
```

## Gönderim

1. `microsoft/winget-pkgs` deposunu fork edin.
2. Yukarıdaki `manifests/p/ParsSistemYonetici/ParsSistemYoneticisi/1.2.0/` klasörünü fork’un aynı yoluna kopyalayın.
3. PR başlığı: `New package: ParsSistemYonetici.ParsSistemYoneticisi version 1.2.0`.
4. Yayımcı kimliği (publisher ownership) doğrulaması istenebilir; GitHub deposu ve resmi site kanıt olarak verilebilir.
5. PR onaylandıktan sonra README’deki `winget install` komutu gerçekten çalışır.

> winget-pkgs pull request’i senin açık onayın olmadan açılmadı; taslak yalnızca depoda hazır bekliyor.

## Yeni sürümde

`1.2.0` klasörünü yeni sürüm adıyla kopyalayın; üç YAML dosyasındaki `PackageVersion`, `InstallerUrl`, `InstallerSha256` ve `DisplayVersion` değerlerini güncelleyin. Aynı sürüm için ikinci PR açmayın.
