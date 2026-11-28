# winget manifest — Pars Sistem Yöneticisi 1.7.0

Bu klasör, uygulamanın `microsoft/winget-pkgs` kataloğuna gönderilen çok dosyalı manifesti içerir (şema 1.28.0). Onaylanana kadar aşağıdaki komut çalışmaz:

```powershell
winget install --id ParsSistemYonetici.ParsSistemYoneticisi --exact
```

Açık pull request: <https://github.com/microsoft/winget-pkgs/pull/491800> — branch `pars-sistem-yonetici/winget-pkgs:new-package-1.6.0`, sürüm `1.6.0`. Bu branch, yeni `1.7.0` manifestleriyle güncellenecek; **ikinci bir PR açılmayacak**.

## Dosyalar

```
winget/manifests/p/ParsSistemYonetici/ParsSistemYoneticisi/1.7.0/
  ParsSistemYonetici.ParsSistemYoneticisi.version.yaml
  ParsSistemYonetici.ParsSistemYoneticisi.defaultLocale.yaml
  ParsSistemYonetici.ParsSistemYoneticisi.installer.yaml
```

Kurulum dosyası: `Pars.Sistem.Yoneticisi.Setup.1.7.0.exe` — 85.493.782 bayt, SHA-256 `A17CFFB5561FDE97876D6954E2374D37EE9FF6934CB39D329C74B03FF7B72F5D`.

## Yerel doğrulama

```powershell
winget validate --manifest winget/manifests/p/ParsSistemYonetici/ParsSistemYoneticisi/1.7.0
winget install --manifest winget/manifests/p/ParsSistemYonetici/ParsSistemYoneticisi/1.7.0 --silent
```

## Gönderim durumu

1. `microsoft/winget-pkgs` fork’u: `pars-sistem-yonetici/winget-pkgs`.
2. PR #491800 açık; başlık `New package: ParsSistemYonetici.ParsSistemYoneticisi version 1.6.0`.
3. Sürüm yükseltmesi aynı PR’ın branch’ine `1.7.0` manifestleriyle gönderilir; PR başlığı ve gövdesi de `1.7.0` olarak güncellenir.
4. Yayımcı kimliği (publisher ownership) doğrulaması istenebilir; GitHub deposu ve resmi site kanıt olarak verilebilir.
5. PR onaylandıktan sonra yukarıdaki `winget install` komutu gerçekten çalışır.

> PR, kullanıcının açık onayı olmadan açılmadı. Yeni sürüm güncellemesi de aynı PR üzerinden yapılır.

## Yeni sürümde

`1.7.0` klasörünü yeni sürüm adıyla kopyalayın; üç YAML dosyasındaki `PackageVersion`, `InstallerUrl`, `InstallerSha256` ve `DisplayVersion` değerlerini güncelleyin. Aynı sürüm için ikinci PR açmayın.
