import type { StartupItem } from '../../shared/types';
import { powershellJson } from '../util';
import { isExcludedPath } from './exclusions';

const BACKUP_KEY = 'HKCU:\\Software\\ParsSistemYoneticisi\\StartupDisabled';

/** PowerShell tek tırnaklı dize içine güvenli ekleme. */
function ps(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

const SCAN_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$items = New-Object System.Collections.ArrayList
$backup = 'HKCU:\Software\ParsSistemYoneticisi\StartupDisabled'
$disabled = @{}
if (Test-Path -LiteralPath $backup) {
  $bk = Get-ItemProperty -LiteralPath $backup
  foreach ($p in $bk.PSObject.Properties) {
    if ($p.Name -like 'PS*') { continue }
    try {
      $d = $p.Value | ConvertFrom-Json
      $disabled[([string]$d.key).ToLowerInvariant()] = $d
    } catch { }
  }
}
function Get-LinkCommand([string]$file) {
  try {
    $sh = New-Object -ComObject WScript.Shell
    $lnk = $sh.CreateShortcut($file)
    $cmd = ([string]$lnk.TargetPath + ' ' + [string]$lnk.Arguments).Trim()
    if ($cmd) { return $cmd }
  } catch { }
  return $file
}
function Get-IdHash([string]$text) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($text))
    return ([System.BitConverter]::ToString($bytes) -replace '-', '').Substring(0, 16)
  } finally { $sha.Dispose() }
}

$registryKeys = @(
  @{ Path = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'; Scope = 'user' },
  @{ Path = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run'; Scope = 'machine' },
  @{ Path = 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run'; Scope = 'machine' },
  @{ Path = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce'; Scope = 'user' },
  @{ Path = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce'; Scope = 'machine' }
)
foreach ($k in $registryKeys) {
  if (-not (Test-Path -LiteralPath $k.Path)) { continue }
  $regKey = Get-Item -LiteralPath $k.Path
  foreach ($name in $regKey.GetValueNames()) {
    if ([string]::IsNullOrWhiteSpace($name)) { continue }
    $value = [string]$regKey.GetValue($name)
    if ([string]::IsNullOrWhiteSpace($value)) { continue }
    $kind = 'String'
    try { $kind = $regKey.GetValueKind($name).ToString() } catch { }
    $id = 'reg|' + $k.Path + '|' + $name
    $folderName = ($k.Path -split '\\')[-1]
    [void]$items.Add([pscustomobject]@{
      id = $id; name = $name; command = $value; location = $folderName
      enabled = $true; kind = 'registry'; scope = $k.Scope
      sourcePath = $k.Path; valueName = $name; valueType = $kind
    })
  }
}
foreach ($entry in $disabled.Values) {
  if ([string]$entry.kind -ne 'registry') { continue }
  $key = [string]$entry.key
  $path = [string]$entry.path
  if ($disabled.ContainsKey($key.ToLowerInvariant()) -and $key -eq ('reg|' + $path + '|' + [string]$entry.name)) {
    $already = $false
    foreach ($it in $items) { if ($it.id -eq $key) { $already = $true; break } }
    if (-not $already) {
      [void]$items.Add([pscustomobject]@{
        id = $key; name = [string]$entry.name; command = [string]$entry.value
        location = (( $path -split '\\')[-1] ); enabled = $false
        kind = 'registry'; scope = [string]$entry.scope
        sourcePath = $path; valueName = [string]$entry.name; valueType = [string]$entry.type
      })
    }
  }
}

$startupFolders = @(
  @{ Path = (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'); Scope = 'user' },
  @{ Path = (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\Startup'); Scope = 'machine' }
)
foreach ($f in $startupFolders) {
  if (-not (Test-Path -LiteralPath $f.Path)) { continue }
  foreach ($file in (Get-ChildItem -LiteralPath $f.Path -File)) {
    $isDisabled = $file.Extension -eq '.disabled'
    if (-not ($isDisabled -or $file.Extension -eq '.lnk')) { continue }
    $base = $file.Name
    if ($isDisabled) { $base = $base.Substring(0, $base.Length - 9) }
    $display = $base
    if ($display.EndsWith('.lnk')) { $display = $display.Substring(0, $display.Length - 4) }
    $command = Get-LinkCommand $file.FullName
    if (-not (Test-Path -LiteralPath $f.Path)) { continue }
    $id = 'folder|' + $f.Path + '|' + $file.Name
    [void]$items.Add([pscustomobject]@{
      id = $id; name = $display; command = $command
      location = 'Başlangıç klasörü'
      enabled = (-not $isDisabled); kind = 'folder'; scope = $f.Scope
      sourcePath = $f.Path; valueName = $file.Name; valueType = ''
    })
  }
}
$result = @($items)
$result | ConvertTo-Json -Depth 6 -Compress
`;

export async function scanStartup(): Promise<StartupItem[]> {
  const result = await powershellJson<StartupItem[] | StartupItem>(SCAN_SCRIPT, undefined, 60_000);
  const items = Array.isArray(result) ? result : result ? [result] : [];
  return items.filter((item) => !isExcludedPath(item.sourcePath));
}

export async function setStartupEnabled(item: StartupItem, enabled: boolean): Promise<string> {
  if (isExcludedPath(item.sourcePath)) throw new Error('Bu öğe hariç tutulan bir klasörde; işlem yapılmadı.');
  const hashResult = await powershellJson<{ hash: string }>(
    `$sha = [System.Security.Cryptography.SHA256]::Create()\n` +
    `$bytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes(${ps(item.id)}))\n` +
    `@{ hash = ([System.BitConverter]::ToString($bytes) -replace '-','').Substring(0,16) } | ConvertTo-Json -Compress\n`,
    undefined,
    20_000,
  );
  const idHash = hashResult.hash;

  if (item.kind === 'folder') {
    const folder = item.sourcePath;
    const current = item.valueName;
    const target = enabled ? current.replace(/\.disabled$/i, '') : `${current}.disabled`;
    const script =
      `$ErrorActionPreference = 'Stop'\n` +
      `$from = Join-Path ${ps(folder)} ${ps(current)}\n` +
      `$to = Join-Path ${ps(folder)} ${ps(target)}\n` +
      `if (-not (Test-Path -LiteralPath $from)) { throw 'Dosya bulunamadı: ' + $from }\n` +
      `Rename-Item -LiteralPath $from -NewName ([System.IO.Path]::GetFileName($to))\n` +
      `@{ ok = $true } | ConvertTo-Json -Compress`;
    await powershellJson<{ ok: boolean }>(script, undefined, 20_000);
    return enabled ? 'Başlangıç öğesi etkinleştirildi.' : 'Başlangıç öğesi devre dışı bırakıldı.';
  }

  const backup = BACKUP_KEY;
  let script: string;
  if (enabled) {
    script =
      `$ErrorActionPreference = 'Stop'\n` +
      `$backup = ${ps(backup)}\n` +
      `$raw = (Get-ItemProperty -LiteralPath $backup -Name ${ps(idHash)}).${idHash}\n` +
      `$d = $raw | ConvertFrom-Json\n` +
      `$path = [string]$d.path\n` +
      `$name = [string]$d.name\n` +
      `$value = $d.value\n` +
      `$type = [string]$d.type\n` +
      `if ($type -eq 'Binary') { $value = [byte[]]@($value) }\n` +
      `elseif ($type -eq 'MultiString') { $value = [string[]]@($value) }\n` +
      `New-ItemProperty -LiteralPath $path -Name $name -Value $value -PropertyType $type -Force | Out-Null\n` +
      `Remove-ItemProperty -LiteralPath $backup -Name ${ps(idHash)} -ErrorAction SilentlyContinue\n` +
      `@{ ok = $true } | ConvertTo-Json -Compress`;
  } else {
    const payload = JSON.stringify({
      key: item.id,
      path: item.sourcePath,
      name: item.valueName,
      value: item.command,
      type: item.valueType || 'String',
      scope: item.scope,
      kind: 'registry',
    });
    script =
      `$ErrorActionPreference = 'Stop'\n` +
      `$backup = ${ps(backup)}\n` +
      `$path = ${ps(item.sourcePath)}\n` +
      `$name = ${ps(item.valueName || '')}\n` +
      `$value = (Get-ItemProperty -LiteralPath $path -Name $name).$name\n` +
      `$type = 'String'\n` +
      `try { $regKey = Get-Item -LiteralPath $path; $type = $regKey.GetValueKind($name).ToString() } catch { }\n` +
      `$payload = ${ps(payload)}\n` +
      `New-Item -Path $backup -Force | Out-Null\n` +
      `New-ItemProperty -LiteralPath $backup -Name ${ps(idHash)} -Value $payload -PropertyType String -Force | Out-Null\n` +
      `Remove-ItemProperty -LiteralPath $path -Name $name\n` +
      `@{ ok = $true } | ConvertTo-Json -Compress`;
  }
  await powershellJson<{ ok: boolean }>(script, undefined, 20_000);
  return enabled ? 'Başlangıç öğesi etkinleştirildi.' : 'Başlangıç öğesi devre dışı bırakıldı.';
}
