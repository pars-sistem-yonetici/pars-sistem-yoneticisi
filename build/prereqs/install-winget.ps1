# Yazılım Yoneticisi - winget kurtarma betiği (küçük, kurulum paketine gömülür)
# Microsoft'un resmi Microsoft.WinGet.Client modülünü kullanır.
# Kurucu (NSIS) ve uygulama içindeki "Gerekli bileşenler" paneli aynı betiği kullanır.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Test-Winget {
  if (Get-Command winget.exe -ErrorAction SilentlyContinue) { return $true }
  $userAlias = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\winget.exe'
  return (Test-Path -LiteralPath $userAlias)
}

try {
  if (Test-Winget) {
    Write-Output 'OK'
    exit 0
  }
  Write-Output 'winget için Microsoft.WinGet.Client modülü kontrol ediliyor...'
  if (-not (Get-PackageProvider -Name NuGet -ListAvailable -ErrorAction SilentlyContinue)) {
    Write-Output 'NuGet paket sağlayıcısı kuruluyor...'
    Install-PackageProvider -Name NuGet -Force -Confirm:$false -Scope CurrentUser | Out-Null
  }
  if (-not (Get-Module -ListAvailable -Name Microsoft.WinGet.Client)) {
    Write-Output 'Microsoft.WinGet.Client modülü indiriliyor...'
    Install-Module -Name Microsoft.WinGet.Client -Force -Confirm:$false -Scope CurrentUser -Repository PSGallery | Out-Null
  }
  Write-Output 'winget bileşenleri onarılıyor (Repair-WinGetPackageManager)...'
  Import-Module Microsoft.WinGet.Client -Force
  Repair-WinGetPackageManager -AllUsers -Force
  if (Test-Winget) {
    Write-Output 'OK'
    exit 0
  }
  throw 'winget.exe hâlâ bulunamadı.'
} catch {
  Write-Output ('HATA: ' + $_.Exception.Message)
  exit 1
}
