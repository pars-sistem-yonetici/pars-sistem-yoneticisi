import fs from 'fs';
import os from 'os';
import path from 'path';
import type { DriverActionResult, DriverBackupResult, DriverScanResult } from '../../shared/types';
import { LogFn, powershellJson } from '../util';

const ADMIN_CHECK = `$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)`;

const SCAN_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
${ADMIN_CHECK}
$installed = @()
try {
  $drivers = Get-CimInstance Win32_PnPSignedDriver | Where-Object { $_.DeviceName } | Sort-Object DeviceName
  foreach ($driver in $drivers) {
    $date = ''
    try {
      if ($driver.DriverDate) { $date = $driver.ConvertToDateTime($driver.DriverDate).ToString('yyyy-MM-dd') }
    } catch { }
    $installed += [pscustomobject]@{
      device = [string]$driver.DeviceName
      manufacturer = [string]$driver.Manufacturer
      provider = [string]$driver.DriverProviderName
      version = [string]$driver.DriverVersion
      date = $date
      deviceClass = [string]$driver.DeviceClass
      inf = [string]$driver.InfName
      signed = [bool]$driver.IsSigned
      status = [string]$driver.Status
    }
  }
} catch { }

$updates = @()
try {
  $session = New-Object -ComObject Microsoft.Update.Session
  $searcher = $session.CreateUpdateSearcher()
  $searcher.Online = $true
  $result = $searcher.Search("IsInstalled=0 and Type='Driver'")
  foreach ($update in $result.Updates) {
    $manufacturer = ''
    $model = ''
    $version = ''
    try {
      foreach ($driverVersion in $update.DriverVersions) {
        if (-not $manufacturer) { $manufacturer = [string]$driverVersion.Manufacturer }
        if (-not $model) { $model = [string]$driverVersion.Model }
        if (-not $version) { $version = [string]$driverVersion.Version }
      }
    } catch { }
    $reboot = 'Bilinmiyor'
    try {
      $reboot = switch ([int]$update.InstallationBehavior.RebootBehavior) {
        0 { 'Yok' }
        1 { 'Olabilir' }
        2 { 'Gerekli' }
        3 { 'Gerekli' }
        default { 'Bilinmiyor' }
      }
    } catch { $reboot = 'Bilinmiyor' }
    $updates += [pscustomobject]@{
      id = [string]$update.Identity.UpdateID
      title = [string]$update.Title
      description = [string]$update.Description
      version = $version
      manufacturer = $manufacturer
      model = $model
      size = [int64]$update.MaxDownloadSize
      downloaded = [bool]$update.IsDownloaded
      mandatory = [bool]$update.IsMandatory
      reboot = [string]$reboot
    }
  }
} catch { }

[pscustomobject]@{
  installed = @($installed)
  updates = @($updates)
  isAdmin = [bool]$isAdmin
} | ConvertTo-Json -Depth 5 -Compress
`;

function backupPath(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'ParsSistemYoneticisi', 'driver_backups', stamp);
}

function writeIdFile(ids: string[]): string {
  const file = path.join(os.tmpdir(), `yy-drivers-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(ids), 'utf8');
  return file;
}

function removeIdFile(file: string): void {
  try { fs.unlinkSync(file); } catch { /* ignore */ }
}

export async function scanDrivers(onLine?: LogFn): Promise<DriverScanResult> {
  onLine?.('Kurulu sürücüler okunuyor…');
  const result = await powershellJson<DriverScanResult>(SCAN_SCRIPT, onLine, 5 * 60 * 1000);
  onLine?.(`${result.installed.length} sürücü, ${result.updates.length} güncelleme bulundu.`);
  return result;
}

function actionScript(mode: 'download' | 'install', idFile: string, doBackup: boolean, destination: string): string {
  return String.raw`
$ErrorActionPreference = 'SilentlyContinue'
${ADMIN_CHECK}
$ids = @(Get-Content -Raw -LiteralPath ${JSON.stringify(idFile)} | ConvertFrom-Json)
$results = @()
if ($ids.Count -eq 0) {
  [pscustomobject]@{ results = @() } | ConvertTo-Json -Depth 4 -Compress
  exit
}
if ('${mode}' -eq 'install' -and -not $isAdmin) {
  foreach ($id in $ids) {
    $results += [pscustomobject]@{ id = [string]$id; title = [string]$id; ok = $false; message = 'Yönetici izni gerekiyor. Uygulamayı yönetici olarak başlatın.'; rebootRequired = $false }
  }
  [pscustomobject]@{ results = @($results) } | ConvertTo-Json -Depth 4 -Compress
  exit
}
if ('${mode}' -eq 'install' -and ${doBackup ? '$true' : '$false'}) {
  $destination = ${JSON.stringify(destination)}
  try {
    New-Item -ItemType Directory -Force -Path $destination | Out-Null
    & dism /online /export-driver /destination:$destination | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Output 'UYARI: Sürücü yedeği alınamadı.' } else { Write-Output ('Yedek: ' + $destination) }
  } catch { Write-Output 'UYARI: Sürücü yedeği alınamadı.' }
}
try {
  $session = New-Object -ComObject Microsoft.Update.Session
  $searcher = $session.CreateUpdateSearcher()
  $searcher.Online = $true
  $found = $searcher.Search("IsInstalled=0 and Type='Driver'")
  $wanted = @($found.Updates | Where-Object { $ids -contains [string]$_.Identity.UpdateID })
  foreach ($id in $ids) {
    if (-not ($wanted | Where-Object { [string]$_.Identity.UpdateID -eq $id })) {
      $results += [pscustomobject]@{ id = [string]$id; title = [string]$id; ok = $false; message = 'Güncelleme artık listede yok.'; rebootRequired = $false }
    }
  }
  if ($wanted.Count -gt 0) {
    $needDownload = @($wanted | Where-Object { -not $_.IsDownloaded })
    if ($needDownload.Count -gt 0) {
      Write-Output ($needDownload.Count.ToString() + ' güncelleme indiriliyor…')
      $downloader = $session.CreateUpdateDownloader()
      $downloader.Updates = $needDownload
      $downloadResult = $downloader.Download()
      Write-Output ('İndirme durumu: ' + $downloadResult.ResultCode)
    }
    if ('${mode}' -eq 'install') {
      $ready = @($wanted | Where-Object { $_.IsDownloaded })
      if ($ready.Count -gt 0) {
        Write-Output ($ready.Count.ToString() + ' güncelleme kuruluyor…')
        $installer = $session.CreateUpdateInstaller()
        $installer.Updates = $ready
        $installResult = $installer.Install()
        $reboot = [bool]$installResult.RebootRequired
        $code = [int]$installResult.ResultCode
        foreach ($update in $ready) {
          $results += [pscustomobject]@{
            id = [string]$update.Identity.UpdateID
            title = [string]$update.Title
            ok = ($code -eq 0 -or $code -eq 2)
            message = if ($code -eq 0) { 'Kuruldu.' } elseif ($code -eq 2) { 'Uyarılarla kuruldu.' } else { ('Hata kodu: ' + $code) }
            rebootRequired = $reboot
          }
        }
      } else {
        foreach ($update in $wanted) {
          $results += [pscustomobject]@{ id = [string]$update.Identity.UpdateID; title = [string]$update.Title; ok = $false; message = 'İndirme tamamlanamadı.'; rebootRequired = $false }
        }
      }
    } else {
      foreach ($update in $wanted) {
        $results += [pscustomobject]@{
          id = [string]$update.Identity.UpdateID
          title = [string]$update.Title
          ok = [bool]$update.IsDownloaded
          message = if ($update.IsDownloaded) { 'İndirildi.' } else { 'İndirilemedi.' }
          rebootRequired = $false
        }
      }
    }
  }
} catch {
  $results += [pscustomobject]@{ id = ''; title = 'Windows Update'; ok = $false; message = $_.Exception.Message; rebootRequired = $false }
}
[pscustomobject]@{ results = @($results) } | ConvertTo-Json -Depth 4 -Compress
`;
}

async function runAction(
  mode: 'download' | 'install',
  ids: string[],
  backup: boolean,
  onLine?: LogFn,
): Promise<DriverActionResult[]> {
  if (!ids.length) return [];
  const idFile = writeIdFile(ids);
  const destination = backupPath();
  try {
    const result = await powershellJson<{ results?: DriverActionResult[] }>(
      actionScript(mode, idFile, backup, destination),
      onLine,
      20 * 60 * 1000,
    );
    return Array.isArray(result.results) ? result.results : [];
  } finally {
    removeIdFile(idFile);
  }
}

export function downloadDrivers(ids: string[], onLine?: LogFn): Promise<DriverActionResult[]> {
  return runAction('download', ids, false, onLine);
}

export function installDrivers(ids: string[], backup: boolean, onLine?: LogFn): Promise<DriverActionResult[]> {
  return runAction('install', ids, backup, onLine);
}

export async function backupDrivers(onLine?: LogFn): Promise<DriverBackupResult> {
  const destination = backupPath();
  onLine?.(`Sürücüler yedekleniyor: ${destination}`);
  const result = await powershellJson<{ ok: boolean; path?: string; message: string }>(String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$destination = ${JSON.stringify(destination)}
try {
  New-Item -ItemType Directory -Force -Path $destination | Out-Null
  & dism /online /export-driver /destination:$destination | Out-Null
  if ($LASTEXITCODE -eq 0) {
    [pscustomobject]@{ ok = $true; path = $destination; message = 'Sürücüler yedeklendi.' } | ConvertTo-Json -Compress
  } else {
    [pscustomobject]@{ ok = $false; message = ('DISM hata kodu: ' + $LASTEXITCODE + '. Yönetici izni gerekebilir.') } | ConvertTo-Json -Compress
  }
} catch {
  [pscustomobject]@{ ok = $false; message = $_.Exception.Message } | ConvertTo-Json -Compress
}
`, onLine, 20 * 60 * 1000);
  return result;
}
