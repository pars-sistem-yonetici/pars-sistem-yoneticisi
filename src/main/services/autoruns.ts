import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type { AutorunActionResult, AutorunItem, AutorunScanResult } from '../../shared/types';
import { LogFn, powershellJson, psLiteral, runPowerShell } from '../util';

const SCAN_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$items = New-Object System.Collections.Generic.List[object]

Get-ScheduledTask | Select-Object -First 400 | ForEach-Object {
  $task = $_
  $execute = ''
  $arguments = ''
  if ($task.Actions.Count -gt 0) {
    $execute = [string]$task.Actions[0].Execute
    $arguments = [string]$task.Actions[0].Arguments
  }
  $runLevel = [string]$task.Principal.RunLevel
  $items.Add([pscustomobject]@{
    id = 'task|' + $task.TaskPath + '\' + $task.TaskName
    category = 'task'
    name = [string]$task.TaskName
    location = [string]$task.TaskPath
    command = ($execute + ' ' + $arguments).Trim()
    enabled = ($task.State -ne 'Disabled')
    publisher = ''
    sourcePath = $execute
    risk = $(if ($runLevel -eq 'Highest') { 'elevated' } else { 'normal' })
    state = [string]$task.State
  })
}

Get-CimInstance Win32_Service | Select-Object -First 300 | ForEach-Object {
  $service = $_
  $items.Add([pscustomobject]@{
    id = 'service|' + $service.Name
    category = 'service'
    name = [string]$service.Name
    location = 'SCM'
    command = [string]$service.PathName
    enabled = ($service.StartMode -ne 'Disabled')
    publisher = [string]$service.DisplayName
    sourcePath = [string]$service.PathName
    risk = $(if ([string]$service.StartName -match 'LocalSystem') { 'elevated' } else { 'normal' })
    state = [string]$service.StartMode
  })
}

function Add-RegistryValue([string]$hiveLabel, [string]$subPath, [string]$valueName, [string]$category) {
  try {
    $hive = $(if ($hiveLabel -eq 'HKLM') { [Microsoft.Win32.RegistryHive]::LocalMachine } else { [Microsoft.Win32.RegistryHive]::CurrentUser })
    $key = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive, [Microsoft.Win32.RegistryView]::Registry64)
    $sub = $key.OpenSubKey($subPath)
    if (-not $sub) { return }
    $value = [string]$sub.GetValue($valueName)
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      $items.Add([pscustomobject]@{
        id = $category + '|' + $subPath + '|' + $valueName
        category = $category
        name = $valueName
        location = $subPath
        command = $value
        enabled = $true
        publisher = ''
        sourcePath = $value
        risk = 'elevated'
        state = $value
      })
    }
    $sub.Close(); $key.Close()
  } catch { }
}

$winlogon = 'SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon'
foreach ($name in @('Shell','Userinit','AppSetup','GinaDLL')) { Add-RegistryValue 'HKLM' $winlogon $name 'winlogon' }
Add-RegistryValue 'HKLM' 'SOFTWARE\Microsoft\Windows NT\CurrentVersion\Windows' 'AppInit_DLLs' 'appinit'

$ifeoRoot = 'SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options'
try {
  $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::LocalMachine, [Microsoft.Win32.RegistryView]::Registry64)
  $parent = $base.OpenSubKey($ifeoRoot)
  if ($parent) {
    foreach ($keyName in $parent.GetSubKeyNames()) {
      $sub = $parent.OpenSubKey($keyName)
      if (-not $sub) { continue }
      $debugger = [string]$sub.GetValue('Debugger')
      if (-not [string]::IsNullOrWhiteSpace($debugger)) {
        $items.Add([pscustomobject]@{
          id = 'ifeo|' + $keyName
          category = 'ifeo'
          name = $keyName
          location = $ifeoRoot
          command = $debugger
          enabled = $true
          publisher = ''
          sourcePath = $debugger
          risk = 'elevated'
          state = $debugger
        })
      }
      $sub.Close()
    }
    $parent.Close()
  }
  $base.Close()
} catch { }

try {
  Get-CimInstance -Namespace 'root\subscription' -ClassName '__EventFilter' | ForEach-Object {
    $items.Add([pscustomobject]@{
      id = 'wmi|filter|' + [string]$_.Name
      category = 'wmi'
      name = [string]$_.Name
      location = 'root\subscription\__EventFilter'
      command = [string]$_.Query
      enabled = $true
      publisher = ''
      sourcePath = ''
      risk = 'elevated'
      state = ''
    })
  }
  Get-CimInstance -Namespace 'root\subscription' -ClassName 'CommandLineEventConsumer' | ForEach-Object {
    $items.Add([pscustomobject]@{
      id = 'wmi|consumer|' + [string]$_.Name
      category = 'wmi'
      name = [string]$_.Name
      location = 'root\subscription\CommandLineEventConsumer'
      command = [string]$_.CommandLineTemplate
      enabled = $true
      publisher = ''
      sourcePath = ''
      risk = 'elevated'
      state = ''
    })
  }
} catch { }

[pscustomobject]@{ items = $items.ToArray() } | ConvertTo-Json -Depth 5 -Compress
`;

export async function scanAutoruns(onLine?: LogFn): Promise<AutorunScanResult> {
  const started = Date.now();
  try {
    const parsed = await powershellJson<{ items?: AutorunItem[] | AutorunItem }>(SCAN_SCRIPT, onLine, 180_000);
    const raw = parsed?.items;
    const items = !raw ? [] : Array.isArray(raw) ? raw : [raw];
    const clean = items
      .filter((item) => item && item.id && item.name)
      .map((item) => ({
        ...item,
        category: String(item.category) as AutorunItem['category'],
        risk: item.risk === 'elevated' ? 'elevated' as const : 'normal' as const,
        command: String(item.command || '').slice(0, 1000),
      }));
    return { items: clean, errors: [], durationMs: Date.now() - started };
  } catch (error) {
    return { items: [], errors: [(error as Error).message], durationMs: Date.now() - started };
  }
}

function backupFolder(): string {
  return path.join(app.getPath('userData'), 'autoruns_backups');
}

function taskScript(item: AutorunItem, enabled: boolean): string {
  const action = enabled ? 'Enable-ScheduledTask' : 'Disable-ScheduledTask';
  return `
$ErrorActionPreference = 'Stop'
${action} -TaskName ${psLiteral(item.name)} -TaskPath ${psLiteral(item.location || '\\')} | Out-Null
'AUTORUN_OK'
`;
}

function serviceScript(item: AutorunItem, enabled: boolean): string {
  const mode = enabled
    ? ['Automatic', 'Manual', 'AutomaticDelayedStart'].includes(item.state) ? item.state : 'Automatic'
    : 'Disabled';
  return `
$ErrorActionPreference = 'Stop'
Set-Service -Name ${psLiteral(item.name)} -StartupType ${mode} -ErrorAction Stop
'SERVICE_MODE=' + (Get-Service -Name ${psLiteral(item.name)}).StartType
`;
}

function registryTarget(item: AutorunItem): { key: string; value: string } | null {
  if (item.category === 'appinit') {
    return { key: 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Windows', value: 'AppInit_DLLs' };
  }
  if (item.category === 'ifeo') {
    return {
      key: `HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\${item.name}`,
      value: 'Debugger',
    };
  }
  return null;
}

function registryScript(item: AutorunItem, enabled: boolean, backup: string): string {
  const target = registryTarget(item)!;
  const value = enabled ? item.state : '';
  return `
$ErrorActionPreference = 'Stop'
& reg.exe export ${psLiteral(target.key)} ${psLiteral(backup)} /y | Out-Null
if (-not (Test-Path -LiteralPath ${psLiteral(backup)})) { throw 'Yedek alınamadı; değişiklik yapılmadı.' }
Set-ItemProperty -Path 'Registry::HKEY_LOCAL_MACHINE\\${target.key.replace(/^HKLM\\/, '').replace(/'/g, "''")}' -Name ${psLiteral(target.value)} -Value ${psLiteral(value)} -Type String -ErrorAction Stop
'REGISTRY_OK'
`;
}

/** Görev, servis veya AppInit/IFEO girdisini yedekleyerek açar/kapatır. */
export async function setAutorun(item: AutorunItem, enabled: boolean, onLine?: LogFn): Promise<AutorunActionResult> {
  const folder = backupFolder();
  try { fs.mkdirSync(folder, { recursive: true }); } catch { /* ignore */ }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safe = item.id.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 100);
  const backup = path.join(folder, `${safe}_${stamp}.${item.category === 'task' || item.category === 'service' ? 'json' : 'reg'}`);
  try {
    if (item.category === 'task' || item.category === 'service') {
      // Mevcut durum geri alınabilsin diye yedeklenir.
      fs.writeFileSync(backup, JSON.stringify(item, null, 2), 'utf8');
      const result = await runPowerShell(item.category === 'task' ? taskScript(item, enabled) : serviceScript(item, enabled), onLine, 120_000);
      if (result.code !== 0) throw new Error((result.stderr || result.text || 'Komut başarısız.').slice(-300));
      return { ok: true, enabled, backupPath: backup, message: enabled ? 'Etkinleştirildi.' : 'Devre dışı bırakıldı.' };
    }
    if (item.category === 'winlogon' || item.category === 'wmi') {
      return {
        ok: false,
        enabled: item.enabled,
        backupPath: '',
        message: 'Bu girdi sistem açılışı için kritik olduğundan otomatik değiştirilmez. İnceleyip elle müdahale edin.',
      };
    }
    const result = await runPowerShell(registryScript(item, enabled, backup), onLine, 120_000);
    if (result.code !== 0) throw new Error((result.stderr || result.text || 'Komut başarısız.').slice(-300));
    return { ok: true, enabled, backupPath: backup, message: enabled ? 'Özgün değer geri yazıldı.' : 'Değer boşaltıldı; kayıt yedeği alındı.' };
  } catch (error) {
    try { if (fs.existsSync(backup)) fs.unlinkSync(backup); } catch { /* ignore */ }
    return { ok: false, enabled: item.enabled, backupPath: '', message: (error as Error).message.slice(0, 300) };
  }
}
