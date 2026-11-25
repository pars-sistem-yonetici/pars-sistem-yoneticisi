import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type { RepairKind, RepairResult } from '../../shared/types';
import { LogFn, psLiteral, runCommand, runPowerShell, type CommandResult } from '../util';

const LONG = 30 * 60 * 1000;
const MEDIUM = 15 * 60 * 1000;
const SHORT = 5 * 60 * 1000;

const TITLE: Record<RepairKind, string> = {
  sfc: 'Sistem dosyası denetimi (sfc /scannow)',
  dism: 'Windows görüntüsü onarımı (DISM /RestoreHealth)',
  'restore-point': 'Sistem geri yükleme noktası',
  'dism-check': 'DISM hızlı durumu (/CheckHealth)',
  'dism-scan': 'DISM bileşen deposu taraması (/ScanHealth)',
  'dism-analyze': 'Bileşen deposu analizi (/AnalyzeComponentStore)',
  'sfc-verify': 'Sistem dosyası doğrulaması (sfc /verifyonly)',
  'chkdsk-scan': 'Disk çevrimiçi taraması (chkdsk /scan)',
  'update-reset': 'Windows Update bileşenlerini sıfırla',
  'network-reset': 'Ağ yığınını sıfırla',
  'component-cleanup': 'Bileşen deposu temizliği (/StartComponentCleanup)',
  'store-cache': 'Microsoft Store önbelleğini sıfırla',
  'search-index': 'Windows Search dizinini yeniden oluştur',
  'print-spooler': 'Yazıcı kuyruğunu temizle',
  'full-sequence': 'Tek tıkla sıralı onarım (DISM → SFC → doğrulama)',
  'bcd-backup': 'Önyükleme yapılandırması (BCD) yedeği',
  'advanced-restart': 'Gelişmiş başlatmaya yeniden başlat',
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
    throw new Error(`Zorunlu kayıt defteri yedeği alınamadı (${key}); değişiklik yapılmadı.`);
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
  onLine?.(`BCD yedeği alınıyor: ${target}`);
  const result = await runCommand('bcdedit.exe', ['/export', target], onLine, SHORT);
  if (result.code !== 0 || !fs.existsSync(target) || fs.statSync(target).size < 16) {
    throw new Error('BCD yedeği alınamadı; değişiklik yapılmadı.');
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
      return commandOutcome(ok, ok ? 'Sistem dosyası denetimi tamamlandı.' : 'Bozuk dosyalar düzeltilemedi; CBS.log kaydına bakın.', result);
    }
    case 'dism': {
      const result = await dismRestore(onLine);
      return commandOutcome(result.code === 0, result.code === 0 ? 'Windows görüntüsü onarımı tamamlandı.' : 'DISM görüntüyü onaramadı.', result);
    }
    case 'restore-point': {
      const power = await runPowerShell(RESTORE_SCRIPT, onLine, SHORT);
      const result = { ...power, lines: power.lines };
      const ok = power.code === 0 && power.text.includes('RESTORE_POINT_OK');
      return commandOutcome(ok, ok ? 'Geri yükleme noktası oluşturuldu.' : 'Geri yükleme noktası oluşturulamadı; Sistem Koruması açık olmalıdır.', result);
    }
    case 'dism-check': {
      const result = await runCommand('DISM.exe', ['/Online', '/Cleanup-Image', '/CheckHealth'], onLine, MEDIUM);
      return commandOutcome(result.code === 0, result.code === 0 ? 'Hızlı durum taraması tamamlandı; raporu inceleyin.' : 'DISM hızlı durumu okunamadı.', result);
    }
    case 'dism-scan': {
      const result = await runCommand('DISM.exe', ['/Online', '/Cleanup-Image', '/ScanHealth'], onLine, LONG);
      return commandOutcome(result.code === 0, result.code === 0 ? 'Bileşen deposu taraması tamamlandı; raporu inceleyin.' : 'DISM taraması tamamlanamadı.', result);
    }
    case 'dism-analyze': {
      const result = await runCommand('DISM.exe', ['/Online', '/Cleanup-Image', '/AnalyzeComponentStore'], onLine, MEDIUM);
      return commandOutcome(result.code === 0, result.code === 0 ? 'Bileşen deposu analizi tamamlandı.' : 'Bileşen deposu analiz edilemedi.', result);
    }
    case 'sfc-verify': {
      const result = await sfcVerify(onLine);
      const ok = result.code === 0 && sfcHealthy(linesOf(result).join(' '));
      return commandOutcome(ok, ok ? 'Doğrulama tamamlandı; sistem dosyaları sağlam görünüyor.' : 'Doğrulamada bozuk dosyalar bulundu.', result);
    }
    case 'chkdsk-scan': {
      const target = systemDrive();
      onLine?.(`Disk taraması: ${target} /scan (salt okunur)`);
      const result = await runCommand('chkdsk.exe', [target, '/scan'], onLine, LONG);
      const text = linesOf(result).join(' ');
      const ok = result.code === 0 || (result.code === 1 && /no problems found|sorun bulunamad|hata bulunamad/i.test(text));
      return commandOutcome(ok, ok ? 'Disk çevrimiçi taraması tamamlandı.' : 'Disk taraması tamamlanamadı.', result);
    }
    case 'update-reset': {
      const folder = prepareBackup();
      const regBackup = exportRegistry('HKLM\\SYSTEM\\CurrentControlSet\\Services\\wuauserv', 'update-reset', folder);
      const script = UPDATE_RESET_SCRIPT.replace('__STAMP__', psLiteral(stamp()));
      const power = await runPowerShell(script, onLine, MEDIUM);
      const ok = power.code === 0 && power.text.includes('UPDATE_RESET_OK');
      return commandOutcome(
        ok,
        ok ? 'Windows Update bileşenleri sıfırlandı. Klasörler ".old" adıyla korundu; yeniden başlatın.' : 'Windows Update sıfırlanamadı; servisler eski durumuna döndürüldü.',
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
        all.push(...linesOf(result), `${command} ${args.join(' ')} → kod ${result.code}`);
        if (result.code !== 0) ok = false;
      }
      return {
        ok,
        message: ok ? 'Ağ yığını sıfırlandı. Değişikliğin tamamlanması için yeniden başlatın.' : 'Ağ sıfırlama sırasında bir komut başarısız oldu; kayıt defteri yedeği korundu.',
        lines: all.slice(-250),
        backupPath: regBackup,
        rebootRequired: ok,
      };
    }
    case 'component-cleanup': {
      const folder = prepareBackup();
      const regBackup = exportRegistry('HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing', 'component-cleanup', folder);
      const result = await runCommand('DISM.exe', ['/Online', '/Cleanup-Image', '/StartComponentCleanup'], onLine, LONG);
      return commandOutcome(result.code === 0, result.code === 0 ? 'Bileşen deposu temizlendi (/ResetBase kullanılmadı).' : 'Bileşen deposu temizlenemedi.', result, { backupPath: regBackup });
    }
    case 'store-cache': {
      const result = await runCommand('cmd.exe', ['/d', '/c', 'start "" /wait wsreset.exe'], onLine, MEDIUM);
      return commandOutcome(result.code === 0, result.code === 0 ? 'Store önbelleği sıfırlandı; oturum açmanız gerekebilir.' : 'Store önbelleği sıfırlanamadı.', result);
    }
    case 'search-index': {
      const folder = prepareBackup();
      const regBackup = exportRegistry('HKLM\\SOFTWARE\\Microsoft\\Windows Search', 'search-index', folder);
      const power = await runPowerShell(SEARCH_INDEX_SCRIPT, onLine, SHORT);
      const ok = power.code === 0 && power.text.includes('ARAMA_DIZINI_SIFIRLANDI');
      return commandOutcome(ok, ok ? 'Arama dizini sıfırlandı; yeniden indeksleme birkaç dakika sürebilir.' : 'Arama dizini sıfırlanamadı; kayıt defteri yedeği korundu.', power, { backupPath: regBackup });
    }
    case 'print-spooler': {
      const folder = prepareBackup();
      const regBackup = exportRegistry('HKLM\\SYSTEM\\CurrentControlSet\\Services\\Spooler', 'print-spooler', folder);
      const script = SPOOLER_SCRIPT.replace('__BACKUP__', psLiteral(path.join(folder, `spool_${stamp()}`)));
      const power = await runPowerShell(script, onLine, SHORT);
      const ok = power.code === 0 && power.text.includes('SPOOLER_OK');
      return commandOutcome(ok, ok ? 'Yazıcı kuyruğu temizlendi; dosyalar yedek klasöründe.' : 'Yazıcı kuyruğu temizlenemedi; yedek korundu.', power, { backupPath: regBackup });
    }
    case 'full-sequence': {
      onLine?.('0/3 Geri yükleme noktası');
      const point = await runPowerShell(RESTORE_SCRIPT, onLine, SHORT);
      if (point.code !== 0 || !point.text.includes('RESTORE_POINT_OK')) {
        return {
          ok: false,
          message: 'Geri yükleme noktası oluşturulamadı; değişiklik yapılmadı. Sistem Koruması ayarını kontrol edin.',
          lines: linesOf(point),
        };
      }
      const lines = linesOf(point);
      onLine?.('1/3 DISM /RestoreHealth');
      const dism = await dismRestore(onLine);
      lines.push(...linesOf(dism));
      if (dism.code !== 0) {
        return { ok: false, message: 'Sıralı onarım DISM adımında durdu; devam edilmedi.', lines: lines.slice(-250) };
      }
      onLine?.('2/3 sfc /scannow');
      const scan = await sfcScan(onLine);
      lines.push(...linesOf(scan));
      if (scan.code !== 0 || !sfcHealthy(linesOf(scan).join(' '))) {
        return { ok: false, message: 'Sıralı onarım SFC adımında durdu; CBS.log kaydına bakın.', lines: lines.slice(-250) };
      }
      onLine?.('3/3 sfc /verifyonly');
      const verify = await sfcVerify(onLine);
      lines.push(...linesOf(verify));
      const ok = verify.code === 0 && sfcHealthy(linesOf(verify).join(' '));
      return {
        ok,
        message: ok ? 'Sıralı onarım tamamlandı; doğrulama temiz.' : 'Onarım tamamlandı ancak son doğrulamada sorun görüldü.',
        lines: lines.slice(-250),
      };
    }
    case 'bcd-backup': {
      const target = await backupBcd(onLine);
      return {
        ok: true,
        message: `Önyükleme yapılandırması yedeklendi: ${target}`,
        lines: [`BCD yedeği: ${target}`],
        backupPath: target,
      };
    }
    case 'advanced-restart': {
      const target = await backupBcd(onLine);
      const result = await runCommand('shutdown.exe', ['/r', '/o', '/f', '/t', '10'], onLine, SHORT);
      return commandOutcome(
        result.code === 0,
        result.code === 0 ? 'Gelişmiş başlatma seçenekleri için yeniden başlatılıyor. BCD yedeği alındı.' : 'Yeniden başlatma komutu başarısız oldu; BCD yedeği korundu.',
        result,
        { backupPath: target, rebootRequired: result.code === 0 },
      );
    }
    default:
      throw new Error('Bilinmeyen onarım işlemi.');
  }
}

/** Yönetici gerektiren sistem onarım komutlarını çalıştırır. */
export async function runRepair(kind: RepairKind, onLine?: LogFn): Promise<RepairResult> {
  const started = Date.now();
  onLine?.(`Başlatılıyor: ${TITLE[kind]}`);
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
