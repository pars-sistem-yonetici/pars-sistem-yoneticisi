import fs from 'fs';
import os from 'os';
import path from 'path';
import type { DriverActionResult, DriverBackupResult, DriverScanResult } from '../../shared/types';
import { m, mf } from '../i18n-main';
import { LogFn, powershellJson, psLiteral } from '../util';

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

/** PowerShell betiğinin yazdığı satırları yalnızca gösterimde çevirir; betik aynen kalır. */
function translatedDriverLog(onLine?: LogFn): LogFn | undefined {
  if (!onLine) return undefined;
  return (line) => {
    const text = line.trim();
    if (text === 'UYARI: Sürücü yedeği alınamadı.') {
      onLine(m('UYARI: Sürücü yedeği alınamadı.', 'WARNING: Driver backup could not be created.'));
    } else if (text.startsWith('Yedek: ')) {
      onLine(mf('Yedek: {path}', 'Backup: {path}', { path: text.slice('Yedek: '.length) }));
    } else {
      const downloading = text.match(/^(\d+) güncelleme indiriliyor…$/);
      const installing = text.match(/^(\d+) güncelleme kuruluyor…$/);
      const status = text.match(/^İndirme durumu: (.+)$/);
      if (downloading) {
        onLine(mf('{count} güncelleme indiriliyor…', 'Downloading {count} update(s)…', { count: downloading[1] }));
      } else if (installing) {
        onLine(mf('{count} güncelleme kuruluyor…', 'Installing {count} update(s)…', { count: installing[1] }));
      } else if (status) {
        onLine(mf('İndirme durumu: {status}', 'Download result: {status}', { status: status[1] }));
      } else {
        onLine(line);
      }
    }
  };
}

/** Betikten gelen sonuç mesajlarını gösterimde çevirir. */
function translatedDriverMessage(message: string): string {
  const text = message || '';
  switch (text) {
    case 'Yönetici izni gerekiyor. Uygulamayı yönetici olarak başlatın.':
      return m('Yönetici izni gerekiyor. Uygulamayı yönetici olarak başlatın.', 'Administrator permission is required. Start the app as an administrator.');
    case 'Güncelleme artık listede yok.':
      return m('Güncelleme artık listede yok.', 'The update is no longer listed.');
    case 'Kuruldu.':
      return m('Kuruldu.', 'Installed.');
    case 'Uyarılarla kuruldu.':
      return m('Uyarılarla kuruldu.', 'Installed with warnings.');
    case 'İndirme tamamlanamadı.':
      return m('İndirme tamamlanamadı.', 'Download could not be completed.');
    case 'İndirildi.':
      return m('İndirildi.', 'Downloaded.');
    case 'İndirilemedi.':
      return m('İndirilemedi.', 'Could not be downloaded.');
    case 'Sürücüler yedeklendi.':
      return m('Sürücüler yedeklendi.', 'Drivers backed up.');
  }
  const errorCode = text.match(/^Hata kodu: (.+)$/);
  if (errorCode) return mf('Hata kodu: {code}', 'Error code: {code}', { code: errorCode[1] });
  const dism = text.match(/^DISM hata kodu: (.+?)\. Yönetici izni gerekebilir\.$/);
  if (dism) {
    return mf('DISM hata kodu: {code}. Yönetici izni gerekebilir.', 'DISM error code: {code}. Administrator permission may be required.', { code: dism[1] });
  }
  return message;
}

function translatedReboot(value: string): string {
  switch (value) {
    case 'Yok': return m('Yok', 'No');
    case 'Olabilir': return m('Olabilir', 'May be');
    case 'Gerekli': return m('Gerekli', 'Required');
    case 'Bilinmiyor': return m('Bilinmiyor', 'Unknown');
    default: return value;
  }
}

export async function scanDrivers(onLine?: LogFn): Promise<DriverScanResult> {
  onLine?.(m('Kurulu sürücüler okunuyor…', 'Reading installed drivers…'));
  const result = await powershellJson<DriverScanResult>(SCAN_SCRIPT, translatedDriverLog(onLine), 5 * 60 * 1000);
  for (const update of result.updates || []) update.reboot = translatedReboot(update.reboot);
  onLine?.(mf('{installed} sürücü, {updates} güncelleme bulundu.', 'Found {installed} drivers and {updates} updates.', {
    installed: result.installed.length, updates: result.updates.length,
  }));
  return result;
}

function actionScript(mode: 'download' | 'install', idFile: string, doBackup: boolean, destination: string): string {
  return String.raw`
$ErrorActionPreference = 'SilentlyContinue'
${ADMIN_CHECK}
$ids = @(Get-Content -Raw -LiteralPath ${psLiteral(idFile)} | ConvertFrom-Json)
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
  $destination = ${psLiteral(destination)}
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
      translatedDriverLog(onLine),
      20 * 60 * 1000,
    );
    const rows = Array.isArray(result.results) ? result.results : [];
    for (const row of rows) row.message = translatedDriverMessage(row.message);
    return rows;
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
  onLine?.(mf('Sürücüler yedekleniyor: {path}', 'Backing up drivers: {path}', { path: destination }));
  const result = await powershellJson<{ ok: boolean; path?: string; message: string }>(String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$destination = ${psLiteral(destination)}
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
`, translatedDriverLog(onLine), 20 * 60 * 1000);
  result.message = translatedDriverMessage(result.message);
  return result;
}
