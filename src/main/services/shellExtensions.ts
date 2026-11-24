import type { ShellExtensionActionResult, ShellExtensionItem } from '../../shared/types';
import { LogFn, psLiteral, powershellJson, runCommand, runPowerShell } from '../util';
import { backupFolder } from './registry';

/**
 * Windows Gezgini sağ tık menüsüne üçüncü taraf yazılımların eklediği kabuk
 * eklentilerini listeler ve kapatır/açar.
 *
 * COM eklentileri (WinRAR, 7-Zip vb.) için per-user, geri alınabilir
 * `HKCU\...\Shell Extensions\Blocked\{CLSID}` mekanizması kullanılır.
 * Klasik `shell\<verb>` komutları için `ProgrammaticAccessOnly` değeri
 * eklenir/kaldırılır. Hiçbir üçüncü taraf anahtarı silinmez; her değişiklikten
 * önce ilgili anahtar .reg olarak yedeklenir.
 */

const ROOTS = ['*', 'Directory', 'Directory\\Background', 'Folder', 'Drive'] as const;

const SCAN_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$roots = @('*', 'Directory', 'Directory\Background', 'Folder', 'Drive')
$hives = @(
  @{ p = 'HKCU'; b = 'HKCU:\Software\Classes' },
  @{ p = 'HKLM'; b = 'HKLM:\SOFTWARE\Classes' }
)
$blockedKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Shell Extensions\Blocked'
$blockedNames = @()
if (Test-Path -LiteralPath $blockedKey) {
  $blockedNames = @((Get-Item -LiteralPath $blockedKey).GetValueNames())
}
$systemNames = @('Windows', 'Microsoft', 'Defender', 'EPP', 'Cloud', 'FileSyncEx', 'OneDrive', 'WorkFolders', 'Sharing', 'Open With', 'HwShareMenu', 'Copilot', 'Photos', 'PowerShell', 'Terminal', 'pintohome', 'removeproperties', 'UpdateEncryptionSettingsWork')
function Get-Clsid($text) {
  if ($text -and $text.Length -eq 38 -and $text.StartsWith('{') -and $text.EndsWith('}')) { return $text }
  return ''
}
$seen = @{}
$items = @()
foreach ($hive in $hives) {
  foreach ($root in $roots) {
    $folders = @(
      @{ kind = 'shellex'; folder = 'shellex\ContextMenuHandlers' },
      @{ kind = 'verb'; folder = 'shell' }
    )
    foreach ($entry in $folders) {
      $full = Join-Path $hive.b ($root + '\' + $entry.folder)
      if (-not (Test-Path -LiteralPath $full)) { continue }
      foreach ($key in (Get-ChildItem -LiteralPath $full -ErrorAction SilentlyContinue)) {
        $name = $key.PSChildName
        $itemId = $root + '|' + $entry.kind + '|' + $name
        if ($seen.ContainsKey($itemId)) { continue }
        $seen[$itemId] = $true
        $default = [string]$key.GetValue('')
        $clsid = ''
        $strategy = 'unsupported'
        $enabled = $true
        if ($entry.kind -eq 'shellex') {
          $candidate = $default.TrimStart('-')
          if ($candidate.Length -eq 38 -and $candidate.StartsWith('{') -and $candidate.EndsWith('}')) {
            $clsid = $candidate
          } elseif ($candidate) {
            $progIdKey = 'Registry::HKEY_CLASSES_ROOT\' + $candidate + '\CLSID'
            if (Test-Path -LiteralPath $progIdKey) {
              $resolved = [string](Get-Item -LiteralPath $progIdKey).GetValue('')
              if ($resolved.Length -eq 38 -and $resolved.StartsWith('{') -and $resolved.EndsWith('}')) { $clsid = $resolved }
            }
          }
          if ($clsid) {
            $strategy = 'blocked'
            $enabled = -not ($blockedNames -contains $clsid)
          }
        } else {
          $strategy = 'access-only'
          $enabled = ($null -eq $key.GetValue('ProgrammaticAccessOnly'))
          $commandPath = $key.PSPath + '\command'
          if (Test-Path -LiteralPath $commandPath) {
            $default = [string](Get-Item -LiteralPath $commandPath).GetValue('')
          } else {
            $fallbackPath = 'Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Classes\' + $root + '\' + $entry.folder + '\' + $name + '\command'
            if (Test-Path -LiteralPath $fallbackPath) {
              $default = [string](Get-Item -LiteralPath $fallbackPath).GetValue('')
            }
          }
        }
        $label = if ($entry.kind -eq 'verb' -and $default) { $default } else { $name }
        if ($clsid) {
          foreach ($prefix in @('Registry::HKEY_CLASSES_ROOT\CLSID\', 'Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Classes\CLSID\')) {
            $classKey = $prefix + $clsid
            if (Test-Path -LiteralPath $classKey) {
              $friendly = [string](Get-Item -LiteralPath $classKey).GetValue('')
              if ($friendly) { $label = $friendly }
              break
            }
          }
        }
        $isSystem = $false
        foreach ($pattern in $systemNames) {
          if ($name -like '*' + $pattern + '*' -or $label -like '*' + $pattern + '*' -or $default -like '*' + $pattern + '*') {
            $isSystem = $true
            break
          }
        }
        $items += [pscustomobject]@{
          id = $itemId
          label = $label
          name = $name
          root = $root
          kind = $entry.kind
          location = $hive.p
          value = $default
          clsid = $clsid
          strategy = $strategy
          enabled = $enabled
          isSystem = $isSystem
        }
      }
    }
  }
}
$items | Sort-Object -Property label | ConvertTo-Json -Depth 4 -Compress
`;

/** Gezgin eklentilerini tarar; sonuçlar hem arayüze hem doğrulamaya kullanılır. */
export async function listShellExtensions(): Promise<ShellExtensionItem[]> {
  try {
    const rows = await powershellJson<ShellExtensionItem[] | ShellExtensionItem>(SCAN_SCRIPT, undefined, 90_000);
    const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
    return list.filter((item) => item && typeof item.id === 'string' && ROOTS.includes(item.root as typeof ROOTS[number]));
  } catch {
    return [];
  }
}

async function restartExplorer(onLine?: LogFn): Promise<boolean> {
  onLine?.('Windows Gezgini kapatılıyor…');
  const kill = await runCommand('taskkill.exe', ['/f', '/im', 'explorer.exe'], onLine, 30_000);
  const notRunning = /not found|bulunamad|no process/i.test(`${kill.text} ${kill.stderr}`);
  onLine?.('Windows Gezgini yeniden başlatılıyor…');
  try {
    const start = await runPowerShell("Start-Process -FilePath 'explorer.exe' -ErrorAction Stop", onLine, 20_000);
    return start.code === 0 || (kill.code === 0 && notRunning);
  } catch {
    return kill.code === 0 && notRunning;
  }
}

/**
 * Tarama sonucundan gelen id ile eklentiyi açar/kapatır. İstemci yalnızca id
 * gönderir; registry yolu, CLSID ve yöntem sunucu tarafındaki taramadan alınır.
 */
export async function setShellExtension(
  id: string,
  enabled: boolean,
  onLine?: LogFn,
): Promise<ShellExtensionActionResult> {
  const item = (await listShellExtensions()).find((candidate) => candidate.id === id);
  if (!item) {
    return { ok: false, enabled: !enabled, message: 'Eklenti bulunamadı; liste yenilenmeli.', backupPath: '', explorerRestarted: false };
  }
  if (item.strategy === 'unsupported') {
    return {
      ok: false,
      enabled: item.enabled,
      backupPath: '',
      explorerRestarted: false,
      message: 'Bu girdi için güvenli bir kapatma yöntemi bulunamadı.',
    };
  }
  if (item.enabled === enabled) {
    return { ok: true, enabled: item.enabled, backupPath: '', explorerRestarted: false, message: 'Değişiklik gerekmedi.' };
  }

  const folder = item.kind === 'shellex' ? 'shellex\\ContextMenuHandlers' : 'shell';
  const kindLiteral = psLiteral(item.kind);
  const script = String.raw`
$ErrorActionPreference = 'Stop'
$id = ${psLiteral(id)}
$enabled = ${enabled ? '$true' : '$false'}
$clsid = ${psLiteral(item.clsid)}
$strategy = ${psLiteral(item.strategy)}
$root = ${psLiteral(item.root)}
$folder = ${psLiteral(folder)}
$name = ${psLiteral(item.name)}
$location = ${psLiteral(item.location)}
$backupRoot = ${psLiteral(backupFolder())}
$allowed = @('*', 'Directory', 'Directory\Background', 'Folder', 'Drive')
if ($allowed -notcontains $root) { throw 'Geçersiz kök.' }
if ($name -notmatch '^[A-Za-z0-9 _.,+(){}*-]{1,120}$') { throw 'Geçersiz girdi adı.' }
if ($id -ne ($root + '|' + ${kindLiteral} + '|' + $name)) { throw 'Geçersiz kimlik.' }
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$useUserKey = ($location -eq 'HKCU' -or -not $isAdmin)
if ($strategy -eq 'blocked') {
  $targetBase = 'HKCU:\Software\Classes'
} elseif ($useUserKey) {
  $targetBase = 'HKCU:\Software\Classes'
} else {
  $targetBase = 'HKLM:\SOFTWARE\Classes'
}
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$safe = ($id -replace '[^A-Za-z0-9_.-]', '_')
$backupPath = Join-Path $backupRoot ('shellext_' + $safe + '_' + $stamp + '.reg')
if ($strategy -eq 'blocked') {
  $backupTarget = 'HKCU\Software\Microsoft\Windows\CurrentVersion\Shell Extensions'
} else {
  $relative = $root + '\' + $folder + '\' + $name
  $regBase = if ($targetBase.StartsWith('HKCU')) { 'HKCU\Software\Classes' } else { 'HKLM\SOFTWARE\Classes' }
  $backupTarget = $regBase + '\' + $relative
  if (-not (Test-Path -LiteralPath ($targetBase + '\' + $relative))) {
    $backupTarget = $regBase + '\' + $root + '\' + $folder
  }
}
& reg.exe export $backupTarget $backupPath /y | Out-Null
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $backupPath)) {
  throw 'Yedek alınamadı; kayıt defteri değiştirilmedi.'
}
if ($strategy -eq 'blocked') {
  $blocked = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Shell Extensions\Blocked'
  if (-not (Test-Path -LiteralPath $blocked)) { New-Item -Path $blocked -Force | Out-Null }
  if ($enabled) {
    Remove-ItemProperty -LiteralPath $blocked -Name $clsid -ErrorAction SilentlyContinue
  } else {
    New-ItemProperty -LiteralPath $blocked -Name $clsid -Value '1' -PropertyType String -Force | Out-Null
  }
  $names = @((Get-Item -LiteralPath $blocked).GetValueNames())
  $nowEnabled = -not ($names -contains $clsid)
} else {
  $targetKey = $regBase + '\' + $relative
  if ($enabled) {
    & reg.exe delete $targetKey /v ProgrammaticAccessOnly /f | Out-Null
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 1) { throw 'ProgrammaticAccessOnly kaldırılamadı.' }
  } else {
    & reg.exe add $targetKey /v ProgrammaticAccessOnly /t REG_SZ /d 1 /f | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'ProgrammaticAccessOnly yazılamadı.' }
  }
  & reg.exe query $targetKey /v ProgrammaticAccessOnly | Out-Null
  $nowEnabled = ($LASTEXITCODE -ne 0)
}
[pscustomobject]@{
  ok = ($nowEnabled -eq $enabled)
  enabled = $nowEnabled
  backupPath = $backupPath
} | ConvertTo-Json -Compress
`;

  try {
    const result = await powershellJson<{ ok?: boolean; backupPath?: string }>(script, onLine, 90_000);
    let explorerRestarted = false;
    try { explorerRestarted = await restartExplorer(onLine); } catch { /* Gezgin yeniden başlamazsa oturum kapatma gerekir. */ }
    const after = (await listShellExtensions()).find((candidate) => candidate.id === id);
    return {
      ok: Boolean(result.ok) && after?.enabled === enabled,
      enabled: after?.enabled ?? !enabled,
      backupPath: result.backupPath || '',
      explorerRestarted,
      message: after?.enabled === enabled
        ? enabled
          ? 'Sağ tık eklentisi yeniden açıldı.'
          : 'Sağ tık eklentisi kapatıldı; Gezgin menüsünde görünmez.'
        : 'Değişiklik doğrulanamadı; yedek dosyasını içe aktararak geri alabilirsiniz.',
    };
  } catch (error) {
    return {
      ok: false,
      enabled: item.enabled,
      backupPath: '',
      explorerRestarted: false,
      message: (error as Error).message,
    };
  }
}
