# Yazılım Yoneticisi - winget kurtarma betiği (küçük, kurulum paketine gömülür)
# Microsoft'un resmi Microsoft.WinGet.Client modülünü kullanır.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try {
  Write-Output 'winget için Microsoft.WinGet.Client modülü kontrol ediliyor...'
  if (-not (Get-PackageProvider -Name NuGet -ListAvailable -ErrorAction SilentlyContinue)) {
    Write-Output 'NuGet paket sağlayıcısı kuruluyor...'
    Install-PackageProvider -Name NuGet -Force -Scope CurrentUser | Out-Null
  }
  if (-not (Get-Module -ListAvailable -Name Microsoft.WinGet.Client)) {
    Write-Output 'Microsoft.WinGet.Client modülü indiriliyor...'
    Install-Module -Name Microsoft.WinGet.Client -Force -Scope CurrentUser -Repository PSGallery | Out-Null
  }
  Write-Output 'winget bileşenleri onarılıyor (Repair-WinGetPackageManager)...'
  Import-Module Microsoft.WinGet.Client -Force
  Repair-WinGetPackageManager -AllUsers -Force
  if (Get-Command winget.exe -ErrorAction SilentlyContinue) {
    Write-Output 'OK'
  } else {
    throw 'winget.exe hâlâ bulunamadı.'
  }
} catch {
  Write-Output ('HATA: ' + $_.Exception.Message)
}
