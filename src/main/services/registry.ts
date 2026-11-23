import fs from 'fs';
import os from 'os';
import path from 'path';
import type { RegIssue, RegResult, RegScanResult, RegStats } from '../../shared/types';
import { powershellJson, psLiteral } from '../util';

const SCAN_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$path = 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall'
$protectedWords = @('microsoft','windows','visual c++','visual studio','.net','office','sql server','edge','defender','msxml','directx','onedrive','teams')
$issues = New-Object System.Collections.Generic.List[object]
$stats = @{ scanned = 0; protected = 0; system = 0; broken = 0 }

function Test-Protected([string]$name, [string]$publisher) {
  $text = ($name + ' ' + $publisher).ToLowerInvariant()
  foreach ($word in $protectedWords) { if ($text.Contains($word)) { return $true } }
  return $false
}

function Get-CommandTarget([string]$command) {
  $m = [regex]::Match($command, '^\s*"([^"]+)"')
  if ($m.Success) { return [Environment]::ExpandEnvironmentVariables($m.Groups[1].Value).Trim() }
  $m = [regex]::Match($command, '([A-Za-z]:\\[^"]*?\.(?:exe|msi|bat|cmd|scr|msu))(?=\s|$)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($m.Success) { return [Environment]::ExpandEnvironmentVariables($m.Groups[1].Value).Trim() }
  $parts = $command -split '\s+'
  if ($parts.Count -gt 0) { return [Environment]::ExpandEnvironmentVariables($parts[0].Trim('"')).Trim() }
  return ''
}

function Find-Problem($values) {
  $name = [string]$values.name
  $publisher = [string]$values.publisher
  if ([string]::IsNullOrWhiteSpace($name)) { return $null }
  $isSystem = (Test-Protected $name $publisher) -or ($values.systemComponent -eq 1)

  $command = [string]$values.uninstall
  if ([string]::IsNullOrWhiteSpace($command)) { $command = [string]$values.quiet }
  if ([string]::IsNullOrWhiteSpace($command)) {
    return @{ reason = 'Kaldırma komutu yok'; detail = 'UninstallString/QuietUninstallString bulunamadı.'; system = $isSystem }
  }

  if ($command.ToLowerInvariant().Contains('msiexec')) {
    $guid = [regex]::Match($command, '\{([0-9A-Fa-f-]{36})\}')
    if ($guid.Success) {
      try {
        $installer = New-Object -ComObject WindowsInstaller.Installer
        $product = '{' + $guid.Groups[1].Value.ToUpperInvariant() + '}'
        $state = $installer.ProductState($product)
        if (@(2, -1, 1, 4, -2) -contains [int]$state) {
          return @{ reason = 'MSI ürünü kurulu değil'; detail = $product; system = $isSystem }
        }
      } catch { }
    }
    return $null
  }

  $target = Get-CommandTarget $command
  if ([string]::IsNullOrWhiteSpace($target)) {
    return @{ reason = 'Kaldırma komutu okunamadı'; detail = $command.Substring(0, [Math]::Min(160, $command.Length)); system = $isSystem }
  }
  if ($target -match '^[A-Za-z0-9_.\-]+$') { return $null }
  if (-not [System.IO.Path]::IsPathRooted($target)) { return $null }
  $lower = $target.ToLowerInvariant()
  if ($lower.Contains(' msiexec') -or $lower.Contains('/i ') -or $lower.Contains('/x ')) { return $null }
  $extension = [System.IO.Path]::GetExtension($target).ToLowerInvariant()
  if (@('.exe','.msi','.bat','.cmd','.scr','.msu') -notcontains $extension) { return $null }
  if (Test-Path -LiteralPath $target) { return $null }
  return @{ reason = 'Kaldırma dosyası eksik'; detail = $target; system = $isSystem }
}

function Scan-Root($hive, [string]$label, [int]$viewNumber, [string]$viewName) {
  $view = if ($viewNumber -eq 32) { [Microsoft.Win32.RegistryView]::Registry32 } else { [Microsoft.Win32.RegistryView]::Registry64 }
  try {
    $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive, $view)
    $parent = $base.OpenSubKey($path)
    if (-not $parent) { return }
    foreach ($keyName in $parent.GetSubKeyNames()) {
      $sub = $parent.OpenSubKey($keyName)
      if (-not $sub) { continue }
      $name = [string]$sub.GetValue('DisplayName')
      $publisher = [string]$sub.GetValue('Publisher')
      if (-not [string]::IsNullOrWhiteSpace($name)) { $stats.scanned++ }
      if (Test-Protected $name $publisher) { $stats.protected++ }
      if ($sub.GetValue('SystemComponent') -eq 1) { $stats.system++ }
      $problem = Find-Problem @{
        name = $name
        publisher = $publisher
        systemComponent = $sub.GetValue('SystemComponent')
        uninstall = [string]$sub.GetValue('UninstallString')
        quiet = [string]$sub.GetValue('QuietUninstallString')
      }
      if ($null -ne $problem) {
        $stats.broken++
        $issues.Add([pscustomobject]@{
          hive = $label.Split(' ')[0]
          rootPath = $path
          label = $label
          key = $keyName
          name = $name
          publisher = $publisher
          reason = [string]$problem.reason
          detail = [string]$problem.detail
          view = $viewNumber
          system = [bool]$problem.system
        })
      }
    }
    $parent.Close(); $base.Close()
  } catch { }
}

Scan-Root ([Microsoft.Win32.RegistryHive]::LocalMachine) 'HKLM' 64 '64'
Scan-Root ([Microsoft.Win32.RegistryHive]::LocalMachine) 'HKLM (32-bit)' 32 '32'
Scan-Root ([Microsoft.Win32.RegistryHive]::CurrentUser) 'HKCU' 64 '64'
Scan-Root ([Microsoft.Win32.RegistryHive]::CurrentUser) 'HKCU (32-bit)' 32 '32'

[pscustomobject]@{
  issues = $issues.ToArray()
  stats = $stats
} | ConvertTo-Json -Depth 4 -Compress
`;

export async function scanRegistry(): Promise<RegScanResult> {
  const result = await powershellJson<{ issues?: RegIssue[]; stats?: RegStats }>(SCAN_SCRIPT, undefined, 120_000);
  const issues = Array.isArray(result.issues) ? result.issues : [];
  issues.sort((a, b) => a.label.localeCompare(b.label) || a.name.localeCompare(b.name));
  return {
    issues,
    stats: result.stats || { scanned: 0, protected: 0, system: 0, broken: 0 },
  };
}

export async function deleteRegistryIssues(issues: RegIssue[]): Promise<RegResult[]> {
  if (!issues.length) return [];
  const tempFile = path.join(os.tmpdir(), `yy-reg-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(tempFile, JSON.stringify(issues), 'utf8');

  const script = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$issues = Get-Content -Raw -LiteralPath ${psLiteral(tempFile)} | ConvertFrom-Json
$results = New-Object System.Collections.Generic.List[object]
foreach ($issue in $issues) {
  $view = if ([int]$issue.view -eq 32) { [Microsoft.Win32.RegistryView]::Registry32 } else { [Microsoft.Win32.RegistryView]::Registry64 }
  $regView = if ([int]$issue.view -eq 32) { '32' } else { '64' }
  $hiveShort = [string]$issue.hive
  $fullPath = $hiveShort + '\' + $issue.rootPath + '\' + $issue.key
  $safe = (([string]$issue.label) + '_' + ([string]$issue.key)) -replace '[^A-Za-z0-9_.-]', '_'
  if ($safe.Length -gt 100) { $safe = $safe.Substring(0, 100) }
  $backupFolder = Join-Path $env:LOCALAPPDATA 'ParsSistemYoneticisi\registry_backups'
  New-Item -ItemType Directory -Force -Path $backupFolder | Out-Null
  $backup = Join-Path $backupFolder ($safe + '_' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.reg')
  $regArgs = @('export', $fullPath, $backup, '/y')
  if ($regView -eq '32') { $regArgs += '/reg:32' }
  & reg @regArgs | Out-Null
  if (-not (Test-Path -LiteralPath $backup)) {
    $results.Add([pscustomobject]@{ issue = $issue; ok = $false; message = 'Yedek alınamadı; silinmedi.' })
    continue
  }
  try {
    $hive = if ($hiveShort -eq 'HKLM') { [Microsoft.Win32.RegistryHive]::LocalMachine } else { [Microsoft.Win32.RegistryHive]::CurrentUser }
    $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive, $view)
    $parent = $base.OpenSubKey([string]$issue.rootPath, $true)
    if (-not $parent) { throw 'Üst anahtar açılamadı.' }
    $parent.DeleteSubKey([string]$issue.key, $false)
    $parent.Close(); $base.Close()
    $results.Add([pscustomobject]@{ issue = $issue; ok = $true; message = 'Silindi. Yedek: ' + (Split-Path $backup -Leaf) })
  } catch {
    $results.Add([pscustomobject]@{ issue = $issue; ok = $false; message = $_.Exception.Message })
  }
}
[pscustomobject]@{ results = $results.ToArray() } | ConvertTo-Json -Depth 5 -Compress
`;

  try {
    const result = await powershellJson<{ results?: RegResult[] }>(script, undefined, 180_000);
    return Array.isArray(result.results) ? result.results : [];
  } finally {
    try { fs.unlinkSync(tempFile); } catch { /* ignore */ }
  }
}

export function backupFolder(): string {
  return path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'ParsSistemYoneticisi', 'registry_backups');
}
