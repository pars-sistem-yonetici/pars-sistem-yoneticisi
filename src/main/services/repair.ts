import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type { RepairKind, RepairResult } from '../../shared/types';
import { LogFn, psLiteral, runCommand, runPowerShell, type CommandResult } from '../util';
import { m, mf } from '../i18n-main';

const LONG = 30 * 60 * 1000;
const MEDIUM = 15 * 60 * 1000;
const SHORT = 5 * 60 * 1000;

const TITLE: Record<RepairKind, string> = {
  sfc: m('Sistem dosyası denetimi (sfc /scannow)', 'System file check (sfc /scannow)'),
  dism: m('Windows görüntüsü onarımı (DISM /RestoreHealth)', 'Windows image repair (DISM /RestoreHealth)'),
  'restore-point': m('Sistem geri yükleme noktası', 'System restore point'),
  'dism-check': m('DISM hızlı durumu (/CheckHealth)', 'DISM quick health check (/CheckHealth)'),
  'dism-scan': m('DISM bileşen deposu taraması (/ScanHealth)', 'DISM component store scan (/ScanHealth)'),
  'dism-analyze': m('Bileşen deposu analizi (/AnalyzeComponentStore)', 'Component store analysis (/AnalyzeComponentStore)'),
  'sfc-verify': m('Sistem dosyası doğrulaması (sfc /verifyonly)', 'System file verification (sfc /verifyonly)'),
  'chkdsk-scan': m('Disk çevrimiçi taraması (chkdsk /scan)', 'Online disk scan (chkdsk /scan)'),
  'update-reset': m('Windows Update bileşenlerini sıfırla', 'Reset Windows Update components'),
  'network-reset': m('Ağ yığınını sıfırla', 'Reset the network stack'),
  'component-cleanup': m('Bileşen deposu temizliği (/StartComponentCleanup)', 'Component store cleanup (/StartComponentCleanup)'),
  'store-cache': m('Microsoft Store önbelleğini sıfırla', 'Reset the Microsoft Store cache'),
  'search-index': m('Windows Search dizinini yeniden oluştur', 'Rebuild the Windows Search index'),
  'print-spooler': m('Yazıcı kuyruğunu temizle', 'Clear the print queue'),
  'full-sequence': m('Tek tıkla sıralı onarım (DISM → SFC → doğrulama)', 'One-click sequential repair (DISM → SFC → verification)'),
  'bcd-backup': m('Önyükleme yapılandırması (BCD) yedeği', 'Boot configuration (BCD) backup'),
  'advanced-restart': m('Gelişmiş başlatmaya yeniden başlat', 'Restart into Advanced Startup'),
  'nic-latency': m('NIC sürücüsü düşük gecikme varsayılanları', 'NIC driver low-latency defaults'),
  'nic-latency-revert': m('NIC sürücü ayarlarını geri yükle', 'Restore NIC driver settings'),
  'prefetch-cleanup': m('Prefetch önbelleği temizliği', 'Prefetch cache cleanup'),
  'counters-wmi': m('Performans sayaçları ve WMI yeniden oluşturma', 'Rebuild performance counters and WMI'),
  'installer-perms': m('Installer 2502/2503 yetki onarımı', 'Installer 2502/2503 permission repair'),
  'time-sync': m('w32tm NTP zaman senkronizasyonu', 'w32tm NTP time synchronization'),
  'safe-mode-status': m('Güvenli Mod durumu (salt okunur)', 'Safe Mode status (read-only)'),
  'safe-mode-on': m('Güvenli Mod’u etkinleştir (sonraki açılış)', 'Enable Safe Mode (next boot)'),
  'safe-mode-off': m('Güvenli Mod’u kaldır', 'Disable Safe Mode'),
};

const RESTORE_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$done = $false
try {
  Checkpoint-Computer -Description 'Pars Sistem Yöneticisi' -RestorePointType 'MODIFY_SETTINGS' -ErrorAction Stop | Out-Null
  $done = $true
} catch {
  try {
    $class = Get-CimInstance -Namespace 'root\default' -ClassName SystemRestore -ErrorAction Stop
    $result = $class.CreateRestorePoint('Pars Sistem Yöneticisi', 14, 100)
    $done = [int]$result.ReturnValue -eq 0
    if (-not $done) { throw ('SystemRestore kodu: ' + $result.ReturnValue) }
  } catch {
    throw ('Geri yükleme noktası oluşturulamadı: ' + $_.Exception.Message)
  }
}
if ($done) { 'RESTORE_POINT_OK' }
`;

const UPDATE_RESET_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$stamp = __STAMP__
$svcNames = @('wuauserv', 'cryptsvc', 'bits', 'msiserver')
$original = @{}
foreach ($n in $svcNames) {
  $s = Get-Service -Name $n -ErrorAction SilentlyContinue
  if ($s) { $original[$n] = [int]$s.Status }
}
$renamed = @()
try {
  foreach ($n in $svcNames) {
    $s = Get-Service -Name $n -ErrorAction SilentlyContinue
    if ($s -and $s.Status -ne 'Stopped') { Stop-Service -Name $n -Force -ErrorAction Stop }
  }
  $sources = @(
    (Join-Path $env:WINDIR 'SoftwareDistribution'),
    (Join-Path $env:WINDIR 'System32\catroot2')
  )
  foreach ($src in $sources) {
    if (-not (Test-Path -LiteralPath $src)) { Write-Output ('ATLANDI: ' + $src); continue }
    $newName = [IO.Path]::GetFileName($src) + '.' + $stamp + '.old'
    Rename-Item -LiteralPath $src -NewName $newName -ErrorAction Stop
    $renamed += (Join-Path (Split-Path -Parent $src) $newName)
    Write-Output ('YENIDEN_ADLANDIRILDI: ' + $src + ' -> ' + $newName)
  }
} catch {
  foreach ($item in $renamed) {
    try {
      $parent = Split-Path -Parent $item
      $name = [IO.Path]::GetFileName($item)
      $baseName = $name -replace ('\.' + [regex]::Escape($stamp) + '\.old$'), ''
      if ($baseName -and -not (Test-Path -LiteralPath (Join-Path $parent $baseName))) {
        Rename-Item -LiteralPath $item -NewName $baseName -ErrorAction SilentlyContinue
      }
    } catch { }
  }
  throw
} finally {
  foreach ($n in $svcNames) {
    try {
      $s = Get-Service -Name $n -ErrorAction SilentlyContinue
      if ($s -and $s.Status -eq 'Stopped' -and $original.ContainsKey($n) -and $original[$n] -ne 0) {
        Start-Service -Name $n -ErrorAction Stop
      }
    } catch { Write-Output ('UYARI: servis baslatilamadi: ' + $n) }
  }
}
'UPDATE_RESET_OK'
`;

const SEARCH_INDEX_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$svc = Get-Service -Name 'WSearch' -ErrorAction SilentlyContinue
$wasRunning = $svc -and $svc.Status -ne 'Stopped'
try {
  if ($wasRunning) { Stop-Service -Name 'WSearch' -Force -ErrorAction Stop }
  New-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows Search' -Name 'SetupCompletedSuccessfully' -Value 0 -PropertyType DWord -Force -ErrorAction Stop | Out-Null
  Write-Output 'ARAMA_DIZINI_SIFIRLANDI'
} finally {
  if ($wasRunning) {
    try { Start-Service -Name 'WSearch' -ErrorAction Stop }
    catch { Write-Output 'UYARI: WSearch baslatilamadi; dizin yeniden baslatmada tamamlanacak.' }
  }
}
`;

const SPOOLER_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$backup = __BACKUP__
New-Item -ItemType Directory -Path $backup -Force -ErrorAction Stop | Out-Null
$spool = Join-Path $env:WINDIR 'System32\spool\PRINTERS'
$svc = Get-Service -Name 'Spooler' -ErrorAction SilentlyContinue
$wasRunning = $svc -and $svc.Status -ne 'Stopped'
try {
  if ($wasRunning) { Stop-Service -Name 'Spooler' -Force -ErrorAction Stop }
  $files = @(Get-ChildItem -LiteralPath $spool -File -ErrorAction SilentlyContinue)
  foreach ($f in $files) {
    Copy-Item -LiteralPath $f.FullName -Destination (Join-Path $backup $f.Name) -Force -ErrorAction Stop
  }
  if ($files.Count -gt 0) {
    $copied = @(Get-ChildItem -LiteralPath $backup -File -ErrorAction SilentlyContinue).Count
    if ($copied -lt $files.Count) { throw 'Yazici kuyrugu yedegi dogrulanamadi; temizlik yapilmadi.' }
    foreach ($f in $files) { Remove-Item -LiteralPath $f.FullName -Force -ErrorAction Stop }
  }
  Write-Output ('YEDeklenen_kuyruk_dosyasi: ' + $files.Count)
} finally {
  if ($wasRunning) {
    try { Start-Service -Name 'Spooler' -ErrorAction Stop }
    catch { Write-Output 'UYARI: Spooler baslatilamadi; yazdirma hizmetini elden kontrol edin.' }
  }
}
'SPOOLER_OK'
`;

const NIC_LATENCY_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$meta = __META__
$props = @(
  @{ Name = 'Interrupt Moderation'; Value = 'Disabled' },
  @{ Name = 'Interrupt Moderation Rate'; Value = 'Off' },
  @{ Name = 'Adaptive Interframe Spacing'; Value = 'Disabled' },
  @{ Name = 'Flow Control'; Value = 'Disabled' },
  @{ Name = 'Green Ethernet'; Value = 'Disabled' },
  @{ Name = 'Energy Efficient Ethernet'; Value = 'Disabled' }
)
$original = @()
foreach ($a in @(Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Up' })) {
  foreach ($p in $props) {
    $found = @(Get-NetAdapterAdvancedProperty -InterfaceDescription $a.InterfaceDescription -DisplayName $p.Name -ErrorAction SilentlyContinue)
    foreach ($entry in $found) {
      $original += [pscustomobject]@{
        adapter = [string]$a.InterfaceDescription
        name = [string]$entry.DisplayName
        value = [string]$entry.DisplayValue
      }
      try {
        Set-NetAdapterAdvancedProperty -InterfaceDescription $a.InterfaceDescription -DisplayName $p.Name -DisplayValue $p.Value -ErrorAction Stop
      } catch {
        Write-Output ('ATLANDI: ' + $a.Name + ' / ' + $p.Name)
      }
    }
  }
}
Set-Content -LiteralPath $meta -Value (@{ original = @($original) } | ConvertTo-Json -Compress -Depth 5) -Encoding utf8
'NIC_LATENCY_OK'
`;

const NIC_LATENCY_REVERT_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$raw = __ORIGINAL__
if ($raw) {
  foreach ($i in @($raw | ConvertFrom-Json)) {
    try {
      Set-NetAdapterAdvancedProperty -InterfaceDescription $i.adapter -DisplayName $i.name -DisplayValue $i.value -ErrorAction Stop
    } catch { Write-Output ('GERI_ALINAMADI: ' + $i.name) }
  }
}
'NIC_LATENCY_OK'
`;

const PREFETCH_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$backup = __BACKUP__
$source = Join-Path $env:WINDIR 'Prefetch'
if (-not (Test-Path -LiteralPath $source)) { 'PREFETCH_YOK'; exit }
New-Item -ItemType Directory -Path $backup -Force -ErrorAction Stop | Out-Null
$files = @(Get-ChildItem -LiteralPath $source -File -Filter '*.pf' -ErrorAction Stop)
foreach ($f in $files) { Copy-Item -LiteralPath $f.FullName -Destination (Join-Path $backup $f.Name) -Force -ErrorAction Stop }
$copied = @(Get-ChildItem -LiteralPath $backup -File -Filter '*.pf' -ErrorAction SilentlyContinue).Count
if ($copied -lt $files.Count) { throw 'Prefetch yedeği doğrulanamadı; temizlik yapılmadı.' }
foreach ($f in $files) { Remove-Item -LiteralPath $f.FullName -Force -ErrorAction Stop }
Write-Output ('PREFETCH_TEMIZLENDI: ' + $files.Count)
'PREFETCH_OK'
`;

const COUNTERS_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$backup = __BACKUP__
New-Item -ItemType Directory -Path $backup -Force -ErrorAction Stop | Out-Null
$repoBackup = Join-Path $backup 'wmi_repository'
& winmgmt.exe /backuprepository $repoBackup 2>&1 | ForEach-Object { Write-Output ([string]$_) }
if (-not (Test-Path -LiteralPath $repoBackup)) { throw 'Zorunlu WMI deposu yedeği alınamadı; değişiklik yapılmadı.' }
& lodctr.exe /R 2>&1 | ForEach-Object { Write-Output ([string]$_) }
& winmgmt.exe /resyncperf 2>&1 | ForEach-Object { Write-Output ([string]$_) }
$status = & winmgmt.exe /status 2>&1 | Out-String
Write-Output $status.Trim()
'COUNTERS_OK'
`;

const INSTALLER_PERMS_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$folder = __BACKUP__
New-Item -ItemType Directory -Path $folder -Force -ErrorAction Stop | Out-Null
$dirs = @((Join-Path $env:WINDIR 'Temp'), (Join-Path $env:WINDIR 'Installer'))
$grant = '*S-1-5-32-544:(OI)(CI)F'
$n = 0
foreach ($dir in $dirs) {
  if (-not (Test-Path -LiteralPath $dir)) { Write-Output ('ATLANDI: ' + $dir); continue }
  $aclFile = Join-Path $folder ('acl_' + $n + '_' + [guid]::NewGuid().ToString('N') + '.txt')
  & icacls.exe $dir '/save' $aclFile '/T' '/C' | Out-Null
  if (-not (Test-Path -LiteralPath $aclFile) -or (Get-Item -LiteralPath $aclFile).Length -lt 20) {
    throw ('Zorunlu ACL yedeği alınamadı: ' + $dir)
  }
  & icacls.exe $dir '/grant' $grant '/T' '/C' | Out-Null
  Write-Output ('YETKI_VERILDI: ' + $dir + ' (yedek: ' + $aclFile + ')')
  $n++
}
'INSTALLER_PERMS_OK'
`;

const TIME_SYNC_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
try { Start-Service -Name 'W32Time' -ErrorAction SilentlyContinue } catch { }
$before = & w32tm.exe /query /status 2>&1 | Out-String
Write-Output ('ONCE: ' + ($before -replace '\s+', ' ').Trim())
$result = & w32tm.exe /resync /force 2>&1 | Out-String
Write-Output ('SENKRON: ' + ($result -replace '\s+', ' ').Trim())
$after = & w32tm.exe /query /status 2>&1 | Out-String
Write-Output ('SONRA: ' + ($after -replace '\s+', ' ').Trim())
'TIME_SYNC_OK'
`;

const SAFE_MODE_STATUS_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$text = & bcdedit.exe /enum '{current}' 2>&1 | Out-String
$line = @($text -split '\r?\n' | Where-Object { $_ -match '(?i)safeboot' }) -join ' '
if ($line -match '(?i)safeboot') {
  Write-Output ('GUVENLI_MOD: ACIK — ' + $line.Trim())
} else {
  Write-Output 'GUVENLI_MOD: KAPALI'
}
'SAFE_MODE_OK'
`;

export function backupFolder(): string {
  return path.join(app.getPath('userData'), 'repair_backups');
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function prepareBackup(): string {
  const folder = backupFolder();
  fs.mkdirSync(folder, { recursive: true });
  return folder;
}

/** Değişiklikten önce zorunlu .reg yedeği; başarısızsa caller değişikliği yapmaz. */
function exportRegistry(key: string, name: string, folder: string): string {
  const target = path.join(folder, `${name}_${stamp()}.reg`);
  const result = spawnSync('reg.exe', ['export', key, target, '/y'], { windowsHide: true });
  if (result.status !== 0 || !fs.existsSync(target) || fs.statSync(target).size < 20) {
    throw new Error(mf('Zorunlu kayıt defteri yedeği alınamadı ({key}); değişiklik yapılmadı.', 'Required registry backup could not be created ({key}); no changes were made.', { key }));
  }
  return target;
}

function systemDrive(): string {
  return (process.env.SystemDrive || 'C:').replace(/\\+$/, '');
}

function linesOf(result: CommandResult): string[] {
  return [...result.lines, ...result.stderr.split(/\r?\n/).filter(Boolean)].slice(-250);
}

function sfcHealthy(text: string): boolean {
  return !/düzeltilemedi|could not correct|unable to fix|unrepairable|onaramadı/i.test(text);
}

function commandOutcome(ok: boolean, message: string, result: CommandResult, extra: OutcomeExtra = {}): Outcome {
  return { ok, message, lines: linesOf(result), ...extra };
}

interface OutcomeExtra {
  backupPath?: string;
  rebootRequired?: boolean;
}

interface Outcome {
  ok: boolean;
  message: string;
  lines: string[];
  backupPath?: string;
  rebootRequired?: boolean;
}

async function backupBcd(onLine?: LogFn): Promise<string> {
  const folder = prepareBackup();
  const target = path.join(folder, `bcd_${stamp()}`);
  onLine?.(mf('BCD yedeği alınıyor: {path}', 'Backing up BCD: {path}', { path: target }));
  const result = await runCommand('bcdedit.exe', ['/export', target], onLine, SHORT);
  if (result.code !== 0 || !fs.existsSync(target) || fs.statSync(target).size < 16) {
    throw new Error(m('BCD yedeği alınamadı; değişiklik yapılmadı.', 'BCD backup failed; no changes were made.'));
  }
  return target;
}

async function dismRestore(onLine?: LogFn): Promise<CommandResult> {
  return runCommand('DISM.exe', ['/Online', '/Cleanup-Image', '/RestoreHealth'], onLine, LONG);
}

async function sfcScan(onLine?: LogFn): Promise<CommandResult> {
  return runCommand('cmd.exe', ['/d', '/c', 'sfc /scannow'], onLine, LONG);
}

async function sfcVerify(onLine?: LogFn): Promise<CommandResult> {
  return runCommand('cmd.exe', ['/d', '/c', 'sfc /verifyonly'], onLine, LONG);
}

/** Tek bir onarım/tarama işlemini yürütür; tüm değişiklikler burada onaylanmış kabul edilir. */
async function execute(kind: RepairKind, onLine?: LogFn): Promise<Outcome> {
  switch (kind) {
    case 'sfc': {
      const result = await sfcScan(onLine);
      const ok = result.code === 0 && sfcHealthy(linesOf(result).join(' '));
      return commandOutcome(ok, ok ? m('Sistem dosyası denetimi tamamlandı.', 'System file check completed.') : m('Bozuk dosyalar düzeltilemedi; CBS.log kaydına bakın.', 'Corrupt files could not be fixed; see the CBS.log file.'), result);
    }
    case 'dism': {
      const result = await dismRestore(onLine);
      return commandOutcome(result.code === 0, result.code === 0 ? m('Windows görüntüsü onarımı tamamlandı.', 'Windows image repair completed.') : m('DISM görüntüyü onaramadı.', 'DISM could not repair the image.'), result);
    }
    case 'restore-point': {
      const power = await runPowerShell(RESTORE_SCRIPT, onLine, SHORT);
      const result = { ...power, lines: power.lines };
      const ok = power.code === 0 && power.text.includes('RESTORE_POINT_OK');
      return commandOutcome(ok, ok ? m('Geri yükleme noktası oluşturuldu.', 'Restore point created.') : m('Geri yükleme noktası oluşturulamadı; Sistem Koruması açık olmalıdır.', 'Could not create a restore point; System Protection must be enabled.'), result);
    }
    case 'dism-check': {
      const result = await runCommand('DISM.exe', ['/Online', '/Cleanup-Image', '/CheckHealth'], onLine, MEDIUM);
      return commandOutcome(result.code === 0, result.code === 0 ? m('Hızlı durum taraması tamamlandı; raporu inceleyin.', 'Quick health scan completed; review the report.') : m('DISM hızlı durumu okunamadı.', 'Could not read the DISM quick health status.'), result);
    }
    case 'dism-scan': {
      const result = await runCommand('DISM.exe', ['/Online', '/Cleanup-Image', '/ScanHealth'], onLine, LONG);
      return commandOutcome(result.code === 0, result.code === 0 ? m('Bileşen deposu taraması tamamlandı; raporu inceleyin.', 'Component store scan completed; review the report.') : m('DISM taraması tamamlanamadı.', 'The DISM scan could not be completed.'), result);
    }
    case 'dism-analyze': {
      const result = await runCommand('DISM.exe', ['/Online', '/Cleanup-Image', '/AnalyzeComponentStore'], onLine, MEDIUM);
      return commandOutcome(result.code === 0, result.code === 0 ? m('Bileşen deposu analizi tamamlandı.', 'Component store analysis completed.') : m('Bileşen deposu analiz edilemedi.', 'The component store could not be analyzed.'), result);
    }
    case 'sfc-verify': {
      const result = await sfcVerify(onLine);
      const ok = result.code === 0 && sfcHealthy(linesOf(result).join(' '));
      return commandOutcome(ok, ok ? m('Doğrulama tamamlandı; sistem dosyaları sağlam görünüyor.', 'Verification completed; system files appear healthy.') : m('Doğrulamada bozuk dosyalar bulundu.', 'Corrupt files were found during verification.'), result);
    }
    case 'chkdsk-scan': {
      const target = systemDrive();
      onLine?.(mf('Disk taraması: {target} /scan (salt okunur)', 'Disk scan: {target} /scan (read-only)', { target }));
      const result = await runCommand('chkdsk.exe', [target, '/scan'], onLine, LONG);
      const text = linesOf(result).join(' ');
      const ok = result.code === 0 || (result.code === 1 && /no problems found|sorun bulunamad|hata bulunamad/i.test(text));
      return commandOutcome(ok, ok ? m('Disk çevrimiçi taraması tamamlandı.', 'Online disk scan completed.') : m('Disk taraması tamamlanamadı.', 'The disk scan could not be completed.'), result);
    }
    case 'update-reset': {
      const folder = prepareBackup();
      const regBackup = exportRegistry('HKLM\\SYSTEM\\CurrentControlSet\\Services\\wuauserv', 'update-reset', folder);
      const script = UPDATE_RESET_SCRIPT.replace('__STAMP__', psLiteral(stamp()));
      const power = await runPowerShell(script, onLine, MEDIUM);
      const ok = power.code === 0 && power.text.includes('UPDATE_RESET_OK');
      return commandOutcome(
        ok,
        ok ? m('Windows Update bileşenleri sıfırlandı. Klasörler ".old" adıyla korundu; yeniden başlatın.', 'Windows Update components were reset. Folders were kept with an ".old" suffix; restart your computer.') : m('Windows Update sıfırlanamadı; servisler eski durumuna döndürüldü.', 'Windows Update could not be reset; services were returned to their previous state.'),
        power,
        { backupPath: regBackup, rebootRequired: ok },
      );
    }
    case 'network-reset': {
      const folder = prepareBackup();
      const regBackup = exportRegistry('HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters', 'network-reset', folder);
      const commands: Array<[string, string[]]> = [
        ['netsh.exe', ['winsock', 'reset']],
        ['netsh.exe', ['int', 'ip', 'reset']],
        ['ipconfig.exe', ['/flushdns']],
        ['ipconfig.exe', ['/registerdns']],
      ];
      const all: string[] = [];
      let ok = true;
      for (const [command, args] of commands) {
        onLine?.(`${command} ${args.join(' ')}`);
        const result = await runCommand(command, args, onLine, SHORT);
        all.push(...linesOf(result), mf('{command} {args} → kod {code}', '{command} {args} → code {code}', { command, args: args.join(' '), code: result.code }));
        if (result.code !== 0) ok = false;
      }
      return {
        ok,
        message: ok ? m('Ağ yığını sıfırlandı. Değişikliğin tamamlanması için yeniden başlatın.', 'Network stack reset. Restart your computer to complete the change.') : m('Ağ sıfırlama sırasında bir komut başarısız oldu; kayıt defteri yedeği korundu.', 'A command failed during the network reset; the registry backup was kept.'),
        lines: all.slice(-250),
        backupPath: regBackup,
        rebootRequired: ok,
      };
    }
    case 'component-cleanup': {
      const folder = prepareBackup();
      const regBackup = exportRegistry('HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing', 'component-cleanup', folder);
      const result = await runCommand('DISM.exe', ['/Online', '/Cleanup-Image', '/StartComponentCleanup'], onLine, LONG);
      return commandOutcome(result.code === 0, result.code === 0 ? m('Bileşen deposu temizlendi (/ResetBase kullanılmadı).', 'Component store cleaned (/ResetBase was not used).') : m('Bileşen deposu temizlenemedi.', 'The component store could not be cleaned.'), result, { backupPath: regBackup });
    }
    case 'store-cache': {
      const result = await runCommand('cmd.exe', ['/d', '/c', 'start "" /wait wsreset.exe'], onLine, MEDIUM);
      return commandOutcome(result.code === 0, result.code === 0 ? m('Store önbelleği sıfırlandı; oturum açmanız gerekebilir.', 'Store cache reset; you may need to sign in again.') : m('Store önbelleği sıfırlanamadı.', 'The Store cache could not be reset.'), result);
    }
    case 'search-index': {
      const folder = prepareBackup();
      const regBackup = exportRegistry('HKLM\\SOFTWARE\\Microsoft\\Windows Search', 'search-index', folder);
      const power = await runPowerShell(SEARCH_INDEX_SCRIPT, onLine, SHORT);
      const ok = power.code === 0 && power.text.includes('ARAMA_DIZINI_SIFIRLANDI');
      return commandOutcome(ok, ok ? m('Arama dizini sıfırlandı; yeniden indeksleme birkaç dakika sürebilir.', 'Search index reset; reindexing may take a few minutes.') : m('Arama dizini sıfırlanamadı; kayıt defteri yedeği korundu.', 'The search index could not be reset; the registry backup was kept.'), power, { backupPath: regBackup });
    }
    case 'print-spooler': {
      const folder = prepareBackup();
      const regBackup = exportRegistry('HKLM\\SYSTEM\\CurrentControlSet\\Services\\Spooler', 'print-spooler', folder);
      const script = SPOOLER_SCRIPT.replace('__BACKUP__', psLiteral(path.join(folder, `spool_${stamp()}`)));
      const power = await runPowerShell(script, onLine, SHORT);
      const ok = power.code === 0 && power.text.includes('SPOOLER_OK');
      return commandOutcome(ok, ok ? m('Yazıcı kuyruğu temizlendi; dosyalar yedek klasöründe.', 'Print queue cleared; the files are in the backup folder.') : m('Yazıcı kuyruğu temizlenemedi; yedek korundu.', 'The print queue could not be cleared; the backup was kept.'), power, { backupPath: regBackup });
    }
    case 'full-sequence': {
      onLine?.(m('0/3 Geri yükleme noktası', '0/3 Restore point'));
      const point = await runPowerShell(RESTORE_SCRIPT, onLine, SHORT);
      if (point.code !== 0 || !point.text.includes('RESTORE_POINT_OK')) {
        return {
          ok: false,
          message: m('Geri yükleme noktası oluşturulamadı; değişiklik yapılmadı. Sistem Koruması ayarını kontrol edin.', 'Could not create a restore point; no changes were made. Check the System Protection setting.'),
          lines: linesOf(point),
        };
      }
      const lines = linesOf(point);
      onLine?.('1/3 DISM /RestoreHealth');
      const dism = await dismRestore(onLine);
      lines.push(...linesOf(dism));
      if (dism.code !== 0) {
        return { ok: false, message: m('Sıralı onarım DISM adımında durdu; devam edilmedi.', 'Sequential repair stopped at the DISM step; no further steps were run.'), lines: lines.slice(-250) };
      }
      onLine?.('2/3 sfc /scannow');
      const scan = await sfcScan(onLine);
      lines.push(...linesOf(scan));
      if (scan.code !== 0 || !sfcHealthy(linesOf(scan).join(' '))) {
        return { ok: false, message: m('Sıralı onarım SFC adımında durdu; CBS.log kaydına bakın.', 'Sequential repair stopped at the SFC step; see the CBS.log file.'), lines: lines.slice(-250) };
      }
      onLine?.('3/3 sfc /verifyonly');
      const verify = await sfcVerify(onLine);
      lines.push(...linesOf(verify));
      const ok = verify.code === 0 && sfcHealthy(linesOf(verify).join(' '));
      return {
        ok,
        message: ok ? m('Sıralı onarım tamamlandı; doğrulama temiz.', 'Sequential repair completed; verification is clean.') : m('Onarım tamamlandı ancak son doğrulamada sorun görüldü.', 'Repair completed, but the final verification reported a problem.'),
        lines: lines.slice(-250),
      };
    }
    case 'bcd-backup': {
      const target = await backupBcd(onLine);
      return {
        ok: true,
        message: mf('Önyükleme yapılandırması yedeklendi: {path}', 'Boot configuration backed up: {path}', { path: target }),
        lines: [mf('BCD yedeği: {path}', 'BCD backup: {path}', { path: target })],
        backupPath: target,
      };
    }
    case 'advanced-restart': {
      const target = await backupBcd(onLine);
      const result = await runCommand('shutdown.exe', ['/r', '/o', '/f', '/t', '10'], onLine, SHORT);
      return commandOutcome(
        result.code === 0,
        result.code === 0 ? m('Gelişmiş başlatma seçenekleri için yeniden başlatılıyor. BCD yedeği alındı.', 'Restarting into Advanced Startup options. A BCD backup was created.') : m('Yeniden başlatma komutu başarısız oldu; BCD yedeği korundu.', 'The restart command failed; the BCD backup was kept.'),
        result,
        { backupPath: target, rebootRequired: result.code === 0 },
      );
    }
    case 'nic-latency': {
      const folder = prepareBackup();
      const regBackup = exportRegistry('SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e972-e325-11ce-bfc1-08002be10318}', 'nic-latency', folder);
      const meta = path.join(folder, `nic_latency_${stamp()}.json`);
      const power = await runPowerShell(NIC_LATENCY_SCRIPT.replace('__META__', psLiteral(meta)), onLine, SHORT);
      const ok = power.code === 0 && power.text.includes('NIC_LATENCY_OK');
      return commandOutcome(
        ok,
        ok ? m('NIC gelişmiş sürücü ayarları düşük gecikme için düzenlendi; özgün değerler JSON yedeğinde.', 'Advanced NIC driver settings were adjusted for low latency; original values are in the JSON backup.') : m('NIC ayarları uygulanamadı; kayıt defteri yedeği korundu.', 'NIC settings could not be applied; the registry backup was kept.'),
        power,
        { backupPath: regBackup, rebootRequired: ok },
      );
    }
    case 'nic-latency-revert': {
      const folder = prepareBackup();
      const files = fs.readdirSync(folder).filter((name) => name.startsWith('nic_latency_') && name.endsWith('.json')).sort();
      const latest = files.length ? path.join(folder, files[files.length - 1]) : '';
      if (!latest) return { ok: false, message: m('Geri yüklenecek NIC ayar yedeği bulunamadı.', 'No NIC settings backup was found to restore.'), lines: [] };
      const meta = JSON.parse(fs.readFileSync(latest, 'utf8')) as { original?: unknown };
      const script = NIC_LATENCY_REVERT_SCRIPT.replace('__ORIGINAL__', psLiteral(JSON.stringify(meta.original ?? [])));
      const power = await runPowerShell(script, onLine, SHORT);
      const ok = power.code === 0 && power.text.includes('NIC_LATENCY_OK');
      return commandOutcome(ok, ok ? m('NIC sürücü ayarları yedeğe döndürüldü.', 'NIC driver settings were restored from backup.') : m('NIC ayarları geri yüklenemedi; yedek korundu.', 'NIC settings could not be restored; the backup was kept.'), power, { backupPath: latest, rebootRequired: ok });
    }
    case 'prefetch-cleanup': {
      const folder = prepareBackup();
      const backup = path.join(folder, `prefetch_${stamp()}`);
      const power = await runPowerShell(PREFETCH_SCRIPT.replace('__BACKUP__', psLiteral(backup)), onLine, SHORT);
      const ok = power.code === 0 && /PREFETCH_OK|PREFETCH_YOK/.test(power.text);
      return commandOutcome(ok, ok ? m('Prefetch dosyaları yedeklenip temizlendi.', 'Prefetch files were backed up and cleared.') : m('Prefetch temizlenemedi; yedek klasörü korundu.', 'Prefetch could not be cleared; the backup folder was kept.'), power, { backupPath: backup });
    }
    case 'counters-wmi': {
      const folder = prepareBackup();
      const regBackup = exportRegistry('SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Perflib', 'counters-wmi', folder);
      const power = await runPowerShell(COUNTERS_SCRIPT.replace('__BACKUP__', psLiteral(path.join(folder, `counters_${stamp()}`))), onLine, MEDIUM);
      const ok = power.code === 0 && power.text.includes('COUNTERS_OK');
      return commandOutcome(ok, ok ? m('Performans sayaçları yeniden kaydedildi ve WMI deposu yedeklendi.', 'Performance counters were reregistered and the WMI repository was backed up.') : m('Sayaç/WMI onarımı tamamlanamadı; yedek korundu.', 'Counter/WMI repair could not be completed; the backup was kept.'), power, { backupPath: regBackup });
    }
    case 'installer-perms': {
      const folder = prepareBackup();
      const power = await runPowerShell(INSTALLER_PERMS_SCRIPT.replace('__BACKUP__', psLiteral(path.join(folder, `installer_acl_${stamp()}`))), onLine, SHORT);
      const ok = power.code === 0 && power.text.includes('INSTALLER_PERMS_OK');
      return commandOutcome(ok, ok ? m('Installer/Temp yetkileri düzeltildi; özgün ACL’ler yedeklendi.', 'Installer/Temp permissions were fixed; the original ACLs were backed up.') : m('Yetki onarımı tamamlanamadı; alınan ACL yedekleri korundu.', 'Permission repair could not be completed; the ACL backups were kept.'), power, { backupPath: folder });
    }
    case 'time-sync': {
      const folder = prepareBackup();
      const regBackup = exportRegistry('SYSTEM\\CurrentControlSet\\Services\\W32Time\\Parameters', 'time-sync', folder);
      const power = await runPowerShell(TIME_SYNC_SCRIPT, onLine, SHORT);
      const ok = power.code === 0 && power.text.includes('TIME_SYNC_OK');
      return commandOutcome(ok, ok ? m('Saat NTP ile senkronize edildi; W32Time yapılandırması yedeklendi.', 'The clock was synchronized with NTP; the W32Time configuration was backed up.') : m('Zaman senkronizasyonu başarısız oldu; yapılandırma değiştirilmedi.', 'Time synchronization failed; the configuration was not changed.'), power, { backupPath: regBackup });
    }
    case 'safe-mode-status': {
      const power = await runPowerShell(SAFE_MODE_STATUS_SCRIPT, onLine, SHORT);
      const ok = power.code === 0 && power.text.includes('SAFE_MODE_OK');
      return commandOutcome(ok, ok ? m('Güvenli Mod durumu okundu.', 'Safe Mode status was read.') : m('Güvenli Mod durumu okunamadı.', 'Safe Mode status could not be read.'), power);
    }
    case 'safe-mode-on': {
      const target = await backupBcd(onLine);
      const result = await runCommand('bcdedit.exe', ['/set', '{current}', 'safeboot', 'minimal'], onLine, SHORT);
      return commandOutcome(result.code === 0, result.code === 0 ? m('Güvenli Mod sonraki açılış için etkinleştirildi; BCD yedeği alındı.', 'Safe Mode was enabled for the next boot; a BCD backup was created.') : m('Güvenli Mod etkinleştirilemedi; BCD yedeği korundu.', 'Safe Mode could not be enabled; the BCD backup was kept.'), result, { backupPath: target, rebootRequired: result.code === 0 });
    }
    case 'safe-mode-off': {
      const target = await backupBcd(onLine);
      const result = await runCommand('bcdedit.exe', ['/deletevalue', '{current}', 'safeboot'], onLine, SHORT);
      const ok = result.code === 0 || /not found|bulunamad/i.test(result.stderr || '');
      return commandOutcome(ok, ok ? m('Güvenli Mod ayarı kaldırıldı; BCD yedeği alındı.', 'Safe Mode setting was removed; a BCD backup was created.') : m('Güvenli Mod kaldırılamadı; BCD yedeği korundu.', 'Safe Mode could not be disabled; the BCD backup was kept.'), result, { backupPath: target, rebootRequired: ok });
    }
    default:
      throw new Error(m('Bilinmeyen onarım işlemi.', 'Unknown repair operation.'));
  }
}

/** Yönetici gerektiren sistem onarım komutlarını çalıştırır. */
export async function runRepair(kind: RepairKind, onLine?: LogFn): Promise<RepairResult> {
  const started = Date.now();
  onLine?.(mf('Başlatılıyor: {title}', 'Starting: {title}', { title: TITLE[kind] }));
  try {
    const outcome = await execute(kind, onLine);
    return { kind, ...outcome, durationMs: Date.now() - started };
  } catch (error) {
    return {
      kind,
      ok: false,
      message: (error as Error).message,
      lines: [],
      durationMs: Date.now() - started,
    };
  }
}
