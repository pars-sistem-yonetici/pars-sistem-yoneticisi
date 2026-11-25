import fs from 'fs';
import os from 'os';
import path from 'path';
import { app, BrowserWindow, dialog } from 'electron';
import { REG_SCAN_SCOPES } from '../../shared/types';
import type {
  RegExportResult, RegIssue, RegResult, RegRisk, RegScanResult, RegScanScope, RegStats,
} from '../../shared/types';
import { powershellJson, psLiteral } from '../util';

/**
 * Kayıt defteri taraması salt okunurdur. Yalnızca Uninstall ve App Paths
 * girdileri fixable olarak işaretlenir; diğer bulgular rapor amaçlıdır.
 */
function buildScanScript(scopes: RegScanScope[]): string {
  return String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$scopes = ${psLiteral(JSON.stringify(scopes))} | ConvertFrom-Json
if ($null -eq $scopes) { $scopes = @() }
function Has-Scope([string]$name) { return $scopes -contains $name }
$issues = New-Object System.Collections.Generic.List[object]
$stats = @{ scanned = 0; protected = 0; system = 0; broken = 0; findings = 0 }

function Add-Issue([hashtable]$i) {
  $issues.Add([pscustomobject]@{
    hive = [string]$i.hive
    rootPath = [string]$i.rootPath
    label = [string]$i.label
    key = [string]$i.key
    name = [string]$i.name
    publisher = [string]$i.publisher
    reason = [string]$i.reason
    detail = [string]$i.detail
    view = [int]$i.view
    system = [bool]$i.system
    category = [string]$i.category
    risk = [string]$i.risk
    fixable = [bool]$i.fixable
    recommendation = [string]$i.recommendation
    signature = [string]$i.signature
    valueName = [string]$i.valueName
  })
  $stats.findings++
}

function Expand-Value([string]$value) {
  $v = [Environment]::ExpandEnvironmentVariables([string]$value).Trim()
  if ($v.StartsWith('"') -and $v.EndsWith('"') -and $v.Length -gt 1) { $v = $v.Substring(1, $v.Length - 2) }
  return $v
}

function Expand-Target([string]$command) {
  $m = [regex]::Match([string]$command, '^\s*"([^"]+)"')
  if ($m.Success) { return Expand-Value $m.Groups[1].Value }
  $m = [regex]::Match([string]$command, '([A-Za-z]:\\[^"\r\n]*?\.(?:exe|dll|sys|msi|bat|cmd|scr|msu))(?=\s|$)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($m.Success) { return Expand-Value $m.Groups[1].Value }
  $text = ([string]$command).Trim()
  # Boşluk içeren ve uzantısız bir değeri bölmek "C:\Program" gibi yanlış hedef üretir.
  if ($text -match '^[^\s]+$') { return Expand-Value $text }
  $first = ($text -split '\s+')[0]
  # "winget uninstall ..." gibi yol içermeyen komutlar geçerli kabul edilir.
  if ($first -notmatch '[\\/]') { return Expand-Value $first }
  return ''
}

function Test-TargetMissing([string]$target) {
  if ([string]::IsNullOrWhiteSpace($target)) { return $false }
  if ($target.StartsWith('\') -or $target.StartsWith('/')) { return $false }
  if (-not [System.IO.Path]::IsPathRooted($target)) { return $false }
  if ($target -match '^(https?|mailto|file|steam|ms-windows-store|microsoft-windows):') { return $false }
  if ($target.Contains('*') -or $target.Contains('?')) { return $false }
  return -not (Test-Path -LiteralPath $target)
}

function Test-UserWritable([string]$target) {
  $lower = ([string]$target).ToLowerInvariant()
  foreach ($part in @('\temp\', '\appdata\', '\users\public\', '\programdata\')) {
    if ($lower.Contains($part)) { return $true }
  }
  return $false
}

function Get-SignatureStatus([string]$target) {
  if (-not (Test-Path -LiteralPath $target)) { return 'Unknown' }
  try {
    $signature = Get-AuthenticodeSignature -LiteralPath $target -ErrorAction Stop
    return [string]$signature.Status
  } catch { return 'Unknown' }
}

function Get-ComTarget($key) {
  if (-not $key) { return '' }
  foreach ($child in @('InprocServer32', 'LocalServer32', 'InprocHandler32')) {
    $sub = $key.OpenSubKey($child)
    if ($sub) {
      $value = [string]$sub.GetValue('')
      $sub.Close()
      if (-not [string]::IsNullOrWhiteSpace($value)) { return Expand-Target $value }
    }
  }
  return ''
}

$uninstallPath = 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall'
$protectedWords = @('microsoft','windows','visual c++','visual studio','.net','office','sql server','edge','defender','msxml','directx','onedrive','teams')

function Test-Protected([string]$name, [string]$publisher) {
  $text = ($name + ' ' + $publisher).ToLowerInvariant()
  foreach ($word in $protectedWords) { if ($text.Contains($word)) { return $true } }
  return $false
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

  $target = Expand-Target $command
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

$uninstallKeys = New-Object System.Collections.Generic.List[object]

function Scan-Uninstall($hive, [string]$label, [int]$viewNumber) {
  $view = if ($viewNumber -eq 32) { [Microsoft.Win32.RegistryView]::Registry32 } else { [Microsoft.Win32.RegistryView]::Registry64 }
  try {
    $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive, $view)
    $parent = $base.OpenSubKey($uninstallPath)
    if (-not $parent) { return }
    foreach ($keyName in $parent.GetSubKeyNames()) {
      $sub = $parent.OpenSubKey($keyName)
      if (-not $sub) { continue }
      $name = [string]$sub.GetValue('DisplayName')
      $publisher = [string]$sub.GetValue('Publisher')
      $uninstall = [string]$sub.GetValue('UninstallString')
      $quiet = [string]$sub.GetValue('QuietUninstallString')
      $icon = [string]$sub.GetValue('DisplayIcon')
      $location = [string]$sub.GetValue('InstallLocation')
      $component = [int]$sub.GetValue('SystemComponent')
      $isSystem = (Test-Protected $name $publisher) -or ($component -eq 1)
      if (-not [string]::IsNullOrWhiteSpace($name)) { $stats.scanned++ }
      if (Test-Protected $name $publisher) { $stats.protected++ }
      if ($component -eq 1) { $stats.system++ }
      $uninstallKeys.Add([pscustomobject]@{
        hive = $label.Split(' ')[0]; label = $label; rootPath = $uninstallPath; key = $keyName; view = $viewNumber
        name = $name; publisher = $publisher; uninstall = $uninstall; quiet = $quiet
        icon = $icon; location = $location; system = $isSystem
      })
      $problem = Find-Problem @{
        name = $name; publisher = $publisher; systemComponent = $component
        uninstall = $uninstall; quiet = $quiet
      }
      if ($null -ne $problem) {
        $stats.broken++
        Add-Issue @{
          hive = $label.Split(' ')[0]; rootPath = $uninstallPath; label = $label; key = $keyName
          name = $name; publisher = $publisher; view = $viewNumber; system = [bool]$problem.system
          reason = [string]$problem.reason; detail = [string]$problem.detail
          category = 'uninstall'; risk = $(if ($problem.system) { 'critical' } else { 'warning' })
          fixable = $true; recommendation = 'Yedek alıp silin veya üreticinin kaldırıcısını kullanın.'
        }
      }
      $sub.Close()
    }
    $parent.Close(); $base.Close()
  } catch { }
}

if (Has-Scope 'uninstall') {
  Scan-Uninstall ([Microsoft.Win32.RegistryHive]::LocalMachine) 'HKLM' 64
  Scan-Uninstall ([Microsoft.Win32.RegistryHive]::LocalMachine) 'HKLM (32-bit)' 32
  Scan-Uninstall ([Microsoft.Win32.RegistryHive]::CurrentUser) 'HKCU' 64
  Scan-Uninstall ([Microsoft.Win32.RegistryHive]::CurrentUser) 'HKCU (32-bit)' 32

  $groups = @{}
  foreach ($entry in $uninstallKeys) {
    if ([string]::IsNullOrWhiteSpace($entry.name)) { continue }
    $groupKey = $entry.name.Trim().ToLowerInvariant()
    if (-not $groups.ContainsKey($groupKey)) { $groups[$groupKey] = New-Object System.Collections.Generic.List[object] }
    $groups[$groupKey].Add($entry)
  }
  foreach ($groupKey in $groups.Keys) {
    $same = $groups[$groupKey]
    if ($same.Count -lt 2) { continue }
    $where = (($same | ForEach-Object { $_.label + ': ' + $_.key }) -join '; ')
    if ($where.Length -gt 400) { $where = $where.Substring(0, 400) + '...' }
    $first = $same[0]
    Add-Issue @{
      hive = $first.hive; rootPath = $uninstallPath; label = $first.label; key = $first.key
      name = $first.name; publisher = $first.publisher; view = $first.view; system = $first.system
      reason = 'Yinelenen uygulama kaydı'; detail = $where
      category = 'uninstall'; risk = 'info'; fixable = $false
      recommendation = 'Girdileri elle karşılaştırın; otomatik silmeyin.'
    }
  }

  foreach ($entry in $uninstallKeys) {
    $baseIssue = @{
      hive = $entry.hive; rootPath = $uninstallPath; label = $entry.label; key = $entry.key
      name = $(if ([string]::IsNullOrWhiteSpace($entry.name)) { $entry.key } else { $entry.name })
      publisher = $entry.publisher; view = $entry.view; system = $entry.system
      category = 'uninstall'; fixable = $false
    }
    if ([string]::IsNullOrWhiteSpace($entry.name)) {
      Add-Issue ($baseIssue + @{
        reason = 'Uygulama adı boş'; detail = 'DisplayName değeri yok; girdi Add/Remove listesinde görünmez.'
        risk = 'info'; recommendation = 'Üretici adı ve kaldırıcıyı doğrulayın.'
      })
    }
    if (-not [string]::IsNullOrWhiteSpace($entry.icon)) {
      $iconPath = [regex]::Replace((Expand-Value $entry.icon), ',\s*-?\d+\s*$', '')
      if (Test-TargetMissing $iconPath) {
        Add-Issue ($baseIssue + @{
          reason = 'Simge dosyası eksik'; detail = $iconPath
          risk = 'info'; recommendation = 'Uygulamayı onarıp yeniden kurmayı değerlendirin.'
        })
      }
    }
    if (-not [string]::IsNullOrWhiteSpace($entry.location)) {
      $folder = Expand-Value $entry.location
      if (Test-TargetMissing $folder) {
        Add-Issue ($baseIssue + @{
          reason = 'Kurulum klasörü eksik'; detail = $folder
          risk = 'info'; recommendation = 'Klasör taşınmış olabilir; silmeden önce doğrulayın.'
        })
      }
    }
    $uninstallTarget = Expand-Target $(if ($entry.uninstall) { $entry.uninstall } else { $entry.quiet })
    if (-not [string]::IsNullOrWhiteSpace($uninstallTarget) -and $uninstallTarget.ToLowerInvariant().Contains('\temp\')) {
      Add-Issue ($baseIssue + @{
        reason = 'Kaldırıcı geçici dizinde'; detail = $uninstallTarget
        risk = 'warning'; recommendation = 'Geçici kaldırıcıya güvenmeyin; üreticiden yeniden indirin.'
      })
    }
  }
}

# --- App Paths: (Default) değeri gerçek çalıştırılabilir dosyayı göstermeli ---
if (Has-Scope 'app-paths') {
  $appPaths = 'SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths'
  foreach ($label in @('HKLM', 'HKLM (32-bit)', 'HKCU')) {
    $hive = if ($label -like 'HKLM*') { [Microsoft.Win32.RegistryHive]::LocalMachine } else { [Microsoft.Win32.RegistryHive]::CurrentUser }
    $viewNumber = if ($label -like '*32-bit*') { 32 } else { 64 }
    $view = if ($viewNumber -eq 32) { [Microsoft.Win32.RegistryView]::Registry32 } else { [Microsoft.Win32.RegistryView]::Registry64 }
    try {
      $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive, $view)
      $parent = $base.OpenSubKey($appPaths)
      if (-not $parent) { continue }
      foreach ($keyName in $parent.GetSubKeyNames()) {
        $sub = $parent.OpenSubKey($keyName)
        if (-not $sub) { continue }
        $stats.scanned++
        $useUrl = [string]$sub.GetValue('UseUrl')
        $default = [string]$sub.GetValue('')
        $extraPath = [string]$sub.GetValue('Path')
        if ($useUrl -eq '1') { $sub.Close(); continue }
        $rawTarget = Expand-Value $default
        $target = Expand-Target $default
        $appText = ($keyName + ' ' + $rawTarget).ToLowerInvariant()
        $isSystemApp = $appText.Contains('microsoft') -or $appText.Contains('windows') -or $appText.Contains('edge')
        $extension = if ([string]::IsNullOrWhiteSpace($target)) { '' } else { [System.IO.Path]::GetExtension($target).ToLowerInvariant() }
        if ($extension -eq '.exe' -and (Test-TargetMissing $target)) {
          Add-Issue @{
            hive = $label.Split(' ')[0]; rootPath = $appPaths; label = $label; key = $keyName
            name = $keyName; publisher = ''; view = $viewNumber; system = $isSystemApp
            reason = 'Uygulama yolu eksik'; detail = $target
            category = 'app-paths'; risk = $(if ($isSystemApp) { 'critical' } else { 'warning' }); fixable = (-not $isSystemApp)
            recommendation = $(if ($isSystemApp) { 'Sistem uygulamasıdır; yalnızca raporlanır.' } else { 'Yedek alıp silin veya uygulamayı yeniden kurun.' })
          }
        } elseif ([string]::IsNullOrWhiteSpace($target) -and -not [string]::IsNullOrWhiteSpace($rawTarget)) {
          Add-Issue @{
            hive = $label.Split(' ')[0]; rootPath = $appPaths; label = $label; key = $keyName
            name = $keyName; publisher = ''; view = $viewNumber; system = $isSystemApp
            reason = 'Uygulama yolu çalıştırılabilir değil'; detail = $rawTarget
            category = 'app-paths'; risk = 'info'; fixable = $false
            recommendation = 'Klasör yolu olabilir; yalnızca raporlanır.'
          }
        } elseif ([string]::IsNullOrWhiteSpace($target) -and [string]::IsNullOrWhiteSpace($extraPath)) {
          Add-Issue @{
            hive = $label.Split(' ')[0]; rootPath = $appPaths; label = $label; key = $keyName
            name = $keyName; publisher = ''; view = $viewNumber; system = $isSystemApp
            reason = 'Uygulama yolu boş'; detail = '(Default) ve Path değerleri boş.'
            category = 'app-paths'; risk = 'info'; fixable = $false
            recommendation = 'Yalnızca rapor; uygulama takma adı olabilir.'
          }
        }
        $sub.Close()
      }
      $parent.Close(); $base.Close()
    } catch { }
  }
}

# --- COM / Shell uzantıları: kayıtlı sunucu dosyası yoksa raporla ---
$machineGuids = New-Object System.Collections.Generic.HashSet[string]
if ((Has-Scope 'com-shell') -or (Has-Scope 'com-hijack')) {
  try {
    $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::LocalMachine, [Microsoft.Win32.RegistryView]::Registry64)
    $parent = $base.OpenSubKey('SOFTWARE\Classes\CLSID')
    if ($parent) {
      foreach ($guid in $parent.GetSubKeyNames()) {
        if ($guid -match '^\{[0-9A-Fa-f-]{36\}$') { [void]$machineGuids.Add($guid) }
      }
      $parent.Close()
    }
    $base.Close()
  } catch { }
}

if (Has-Scope 'com-shell') {
  $clsidTargets = @(
    @{ hive = [Microsoft.Win32.RegistryHive]::LocalMachine; label = 'HKLM'; path = 'SOFTWARE\Classes\CLSID'; number = 64 },
    @{ hive = [Microsoft.Win32.RegistryHive]::LocalMachine; label = 'HKLM (32-bit)'; path = 'SOFTWARE\Classes\CLSID'; number = 32 },
    @{ hive = [Microsoft.Win32.RegistryHive]::CurrentUser; label = 'HKCU'; path = 'Software\Classes\CLSID'; number = 64 }
  )
  $comCount = 0
  foreach ($target in $clsidTargets) {
    if ($comCount -ge 200) { break }
    $view = if ($target.number -eq 32) { [Microsoft.Win32.RegistryView]::Registry32 } else { [Microsoft.Win32.RegistryView]::Registry64 }
    try {
      $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($target.hive, $view)
      $parent = $base.OpenSubKey($target.path)
      if (-not $parent) { continue }
      foreach ($guid in $parent.GetSubKeyNames()) {
        if ($comCount -ge 200) { break }
        if ($guid -notmatch '^\{[0-9A-Fa-f-]{36\}$') { continue }
        $sub = $parent.OpenSubKey($guid)
        if (-not $sub) { continue }
        $stats.scanned++
        $server = Get-ComTarget $sub
        if ((Test-TargetMissing $server) -and $server -notmatch 'mscoree\.dll') {
          Add-Issue @{
            hive = $target.label.Split(' ')[0]; rootPath = $target.path; label = $target.label; key = $guid
            name = $guid; publisher = ''; view = $target.number; system = $false
            reason = 'COM bileşen dosyası eksik'; detail = $server
            category = 'com-shell'; risk = 'info'; fixable = $false
            recommendation = 'Bileşen kaydını elle silmeyin; uygulamayı onarın.'
          }
          $comCount++
        }
        $sub.Close()
      }
      $parent.Close(); $base.Close()
    } catch { }
  }

  $shellLocations = @(
    @{ hive = [Microsoft.Win32.RegistryHive]::LocalMachine; label = 'HKLM'; path = 'SOFTWARE\Classes\*\ShellEx\ContextMenuHandlers' },
    @{ hive = [Microsoft.Win32.RegistryHive]::LocalMachine; label = 'HKLM'; path = 'SOFTWARE\Classes\Directory\ShellEx\ContextMenuHandlers' },
    @{ hive = [Microsoft.Win32.RegistryHive]::LocalMachine; label = 'HKLM'; path = 'SOFTWARE\Classes\Directory\Background\ShellEx\ContextMenuHandlers' },
    @{ hive = [Microsoft.Win32.RegistryHive]::LocalMachine; label = 'HKLM'; path = 'SOFTWARE\Classes\Drive\ShellEx\ContextMenuHandlers' },
    @{ hive = [Microsoft.Win32.RegistryHive]::CurrentUser; label = 'HKCU'; path = 'Software\Classes\*\ShellEx\ContextMenuHandlers' },
    @{ hive = [Microsoft.Win32.RegistryHive]::CurrentUser; label = 'HKCU'; path = 'Software\Classes\Directory\ShellEx\ContextMenuHandlers' },
    @{ hive = [Microsoft.Win32.RegistryHive]::LocalMachine; label = 'HKLM'; path = 'SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\ShellIconOverlayIdentifiers' },
    @{ hive = [Microsoft.Win32.RegistryHive]::CurrentUser; label = 'HKCU'; path = 'Software\Microsoft\Windows\CurrentVersion\Explorer\ShellIconOverlayIdentifiers' }
  )
  $shellCount = 0
  foreach ($location in $shellLocations) {
    if ($shellCount -ge 100) { break }
    try {
      $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($location.hive, [Microsoft.Win32.RegistryView]::Registry64)
      $parent = $base.OpenSubKey($location.path)
      if (-not $parent) { continue }
      foreach ($name in $parent.GetSubKeyNames()) {
        $sub = $parent.OpenSubKey($name)
        if (-not $sub) { continue }
        $stats.scanned++
        $guid = [string]$sub.GetValue('')
        if ($guid -match '^\{[0-9A-Fa-f-]{36\}$') {
          $registered = [Microsoft.Win32.Registry]::ClassesRoot.OpenSubKey('CLSID\' + $guid)
          if (-not $registered) {
            Add-Issue @{
              hive = $location.label; rootPath = $location.path; label = $location.label; key = $name
              name = $name; publisher = ''; view = 64; system = $false
              reason = 'Shell uzantısı kaydı eksik'; detail = $guid + ' için CLSID kaydı yok.'
              category = 'com-shell'; risk = 'info'; fixable = $false
              recommendation = 'Üçüncü taraf uzantıyı kaldırın; elle CLSID silmeyin.'
            }
            $shellCount++
          } else { $registered.Close() }
        }
        $sub.Close()
      }
      $parent.Close(); $base.Close()
    } catch { }
  }
}

# --- HKCU CLSID geçersiz kılmaları: yalnızca kullanıcı yazılabilir + imzasızsa şüpheli ---
if (Has-Scope 'com-hijack') {
  try {
    $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser, [Microsoft.Win32.RegistryView]::Registry64)
    $parent = $base.OpenSubKey('Software\Classes\CLSID')
    if ($parent) {
      $hijackCount = 0
      foreach ($guid in $parent.GetSubKeyNames()) {
        if ($hijackCount -ge 100) { break }
        if (-not $machineGuids.Contains($guid)) { continue }
        $sub = $parent.OpenSubKey($guid)
        if (-not $sub) { continue }
        $stats.scanned++
        $server = Get-ComTarget $sub
        if ([string]::IsNullOrWhiteSpace($server) -or -not (Test-Path -LiteralPath $server)) { $sub.Close(); continue }
        if (-not (Test-UserWritable $server)) { $sub.Close(); continue }
        $signature = Get-SignatureStatus $server
        if ($signature -eq 'Valid') { $sub.Close(); continue }
        Add-Issue @{
          hive = 'HKCU'; rootPath = 'Software\Classes\CLSID'; label = 'HKCU'; key = $guid
          name = $guid; publisher = ''; view = 64; system = $false
          reason = 'COM geçersiz kılma şüphesi'; detail = $server
          category = 'com-hijack'; risk = 'critical'; fixable = $false
          recommendation = 'Anahtarı silmeyin; kötü amaçlı yazılım taraması ve imza doğrulaması yapın.'
          signature = $signature
        }
        $hijackCount++
        $sub.Close()
      }
      $parent.Close()
    }
    $base.Close()
  } catch { }
}

# --- Dosya ilişkilendirmeleri: ölü ProgID / UserChoice ---
if (Has-Scope 'file-assoc') {
  $classes = [Microsoft.Win32.Registry]::ClassesRoot
  $assocCount = 0
  function Test-ProgId($name) {
    if ([string]::IsNullOrWhiteSpace($name)) { return $true }
    if ($name -match '^(AppX|Microsoft\.|Windows\.|Applications\\)') { return $true }
    return ($null -ne $classes.OpenSubKey($name))
  }
  foreach ($extension in $classes.GetSubKeyNames()) {
    if ($assocCount -ge 150) { break }
    if (-not $extension.StartsWith('.')) { continue }
    $extKey = $classes.OpenSubKey($extension)
    if (-not $extKey) { continue }
    $stats.scanned++
    $defaultProg = [string]$extKey.GetValue('')
    if (-not (Test-ProgId $defaultProg)) {
      Add-Issue @{
        hive = 'HKLM'; rootPath = 'HKEY_CLASSES_ROOT'; label = 'HKCR'; key = $extension
        name = $extension; publisher = ''; view = 64; system = $false
        reason = 'Varsayılan ProgID eksik'; detail = $defaultProg
        category = 'file-assoc'; risk = 'info'; fixable = $false
        recommendation = 'Varsayılan uygulamalar ayarından düzeltin.'
      }
      $assocCount++
    }
    $openWith = $extKey.OpenSubKey('OpenWithProgids')
    if ($openWith) {
      foreach ($prog in $openWith.GetValueNames()) {
        if ($assocCount -ge 150) { break }
        if (Test-ProgId $prog) { continue }
        Add-Issue @{
          hive = 'HKLM'; rootPath = 'HKEY_CLASSES_ROOT'; label = 'HKCR'; key = $extension; valueName = $prog
          name = $extension; publisher = ''; view = 64; system = $false
          reason = 'Aç ile uygulama kaydı eksik'; detail = $prog
          category = 'file-assoc'; risk = 'info'; fixable = $false
          recommendation = 'Yalnızca rapor; OpenWithProgids değerini elle silmeyin.'
        }
        $assocCount++
      }
      $openWith.Close()
    }
    $extKey.Close()
  }

  try {
    $userExtRoot = 'Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts'
    $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser, [Microsoft.Win32.RegistryView]::Registry64)
    $parent = $base.OpenSubKey($userExtRoot)
    if ($parent) {
      foreach ($extension in $parent.GetSubKeyNames()) {
        if ($assocCount -ge 150) { break }
        $extKey = $parent.OpenSubKey($extension)
        if (-not $extKey) { continue }
        $choice = $extKey.OpenSubKey('UserChoice')
        if ($choice) {
          $prog = [string]$choice.GetValue('Progid')
          if (-not (Test-ProgId $prog)) {
            Add-Issue @{
              hive = 'HKCU'; rootPath = $userExtRoot; label = 'HKCU'; key = $extension; valueName = 'Progid'
              name = $extension; publisher = ''; view = 64; system = $false
              reason = 'Kullanıcı varsayılan uygulaması eksik'; detail = $prog
              category = 'file-assoc'; risk = 'warning'; fixable = $false
              recommendation = 'UserChoice anahtarı silinmez; Ayarlar > Varsayılan uygulamalar ile düzeltin.'
            }
            $assocCount++
          }
          $choice.Close()
        }
        $extKey.Close()
      }
      $parent.Close()
    }
    $base.Close()
  } catch { }
}

# --- Servis / sürücü ImagePath: eksik binary, kritik sistem etiketli ---
if (Has-Scope 'service') {
  try {
    $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::LocalMachine, [Microsoft.Win32.RegistryView]::Registry64)
    $parent = $base.OpenSubKey('SYSTEM\CurrentControlSet\Services')
    if ($parent) {
      $serviceCount = 0
      foreach ($name in $parent.GetSubKeyNames()) {
        if ($serviceCount -ge 200) { break }
        $sub = $parent.OpenSubKey($name)
        if (-not $sub) { continue }
        $image = [string]$sub.GetValue('ImagePath')
        $type = [int]$sub.GetValue('Type')
        $start = [int]$sub.GetValue('Start')
        if ([string]::IsNullOrWhiteSpace($image) -or $start -eq 4) { $sub.Close(); continue }
        $stats.scanned++
        $image = Expand-Value $image
        if ($image.StartsWith('\??\')) { $image = $image.Substring(4) }
        if ($image -match 'svchost\.exe') { $sub.Close(); continue }
        $binary = Expand-Target $image
        if ((Test-TargetMissing $binary) -and $binary -match '\.(exe|sys)$') {
          $critical = ($type -eq 1 -or $type -eq 2)
          Add-Issue @{
            hive = 'HKLM'; rootPath = 'SYSTEM\CurrentControlSet\Services'; label = 'HKLM'; key = $name
            name = $name; publisher = ''; view = 64; system = $true
            reason = 'Servis dosyası eksik'; detail = $binary
            category = 'service'; risk = $(if ($critical) { 'critical' } else { 'warning' }); fixable = $false
            recommendation = 'Kayıt anahtarını silmeyin; servisi kaldırma programıyla kaldırın.'
          }
          $serviceCount++
        }
        $sub.Close()
      }
      $parent.Close()
    }
    $base.Close()
  } catch { }
}

# --- SharedDLLs referans sayacı: yalnızca rapor ---
if (Has-Scope 'shared-dll') {
  try {
    $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::LocalMachine, [Microsoft.Win32.RegistryView]::Registry64)
    $parent = $base.OpenSubKey('SOFTWARE\Microsoft\Windows\CurrentVersion\SharedDLLs')
    if ($parent) {
      $count = 0
      foreach ($valueName in $parent.GetValueNames()) {
        if ($count -ge 200) { break }
        $stats.scanned++
        $target = Expand-Value $valueName
        if (Test-TargetMissing $target) {
          Add-Issue @{
            hive = 'HKLM'; rootPath = 'SOFTWARE\Microsoft\Windows\CurrentVersion\SharedDLLs'; label = 'HKLM'
            key = '(değer)'; valueName = $valueName; name = $target; publisher = ''; view = 64; system = $true
            reason = 'Paylaşımlı dosya kaydı eksik'; detail = $target
            category = 'shared-dll'; risk = 'info'; fixable = $false
            recommendation = 'Referans sayacıdır; silmek paylaşımlı uygulamaları bozabilir.'
          }
          $count++
        }
      }
      $parent.Close()
    }
    $base.Close()
  } catch { }
}

# --- Fontlar: eksik yazı tipi dosyası ---
if (Has-Scope 'font') {
  try {
    $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::LocalMachine, [Microsoft.Win32.RegistryView]::Registry64)
    $parent = $base.OpenSubKey('SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts')
    if ($parent) {
      $count = 0
      $fontFolders = @((Expand-Value '%WINDIR%\Fonts'), (Expand-Value '%LOCALAPPDATA%\Microsoft\Windows\Fonts'))
      foreach ($valueName in $parent.GetValueNames()) {
        if ($count -ge 150) { break }
        $stats.scanned++
        $file = Expand-Value ([string]$parent.GetValue($valueName))
        if ([string]::IsNullOrWhiteSpace($file)) { continue }
        $exists = $false
        if ([System.IO.Path]::IsPathRooted($file)) { $exists = Test-Path -LiteralPath $file }
        else { foreach ($folder in $fontFolders) { if (Test-Path -LiteralPath (Join-Path $folder $file)) { $exists = $true; break } } }
        if (-not $exists) {
          Add-Issue @{
            hive = 'HKLM'; rootPath = 'SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts'; label = 'HKLM'
            key = '(değer)'; valueName = $valueName; name = $valueName; publisher = ''; view = 64; system = $false
            reason = 'Yazı tipi dosyası eksik'; detail = $file
            category = 'font'; risk = 'info'; fixable = $false
            recommendation = 'Yazı tipini yeniden kurun; kaydı elle silmeyin.'
          }
          $count++
        }
      }
      $parent.Close()
    }
    $base.Close()
  } catch { }
}

# --- ODBC sürücü yolları ---
if (Has-Scope 'odbc') {
  try {
    $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::LocalMachine, [Microsoft.Win32.RegistryView]::Registry64)
    $parent = $base.OpenSubKey('SOFTWARE\ODBC\ODBCINST.INI')
    if ($parent) {
      $count = 0
      foreach ($name in $parent.GetSubKeyNames()) {
        if ($count -ge 100) { break }
        if ($name -eq 'ODBC Drivers' -or $name -eq 'ODBC Translators') { continue }
        $sub = $parent.OpenSubKey($name)
        if (-not $sub) { continue }
        $stats.scanned++
        $driver = Expand-Value ([string]$sub.GetValue('Driver'))
        if (Test-TargetMissing $driver) {
          Add-Issue @{
            hive = 'HKLM'; rootPath = 'SOFTWARE\ODBC\ODBCINST.INI'; label = 'HKLM'; key = $name
            name = $name; publisher = ''; view = 64; system = $false
            reason = 'ODBC sürücü dosyası eksik'; detail = $driver
            category = 'odbc'; risk = 'info'; fixable = $false
            recommendation = 'Sürücüyü yeniden kurun; kaydı elle silmeyin.'
          }
          $count++
        }
        $sub.Close()
      }
      $parent.Close()
    }
    $base.Close()
  } catch { }
}

[pscustomobject]@{ issues = $issues.ToArray(); stats = $stats } | ConvertTo-Json -Depth 5 -Compress
`;
}

const DEFAULT_STATS: RegStats = { scanned: 0, protected: 0, system: 0, broken: 0, findings: 0 };
let lastReport: RegScanResult | null = null;
let lastScopes: RegScanScope[] = [...REG_SCAN_SCOPES];

function normalizeRisk(value: unknown): RegRisk {
  return value === 'info' || value === 'critical' || value === 'warning' ? value : 'warning';
}

function normalizeCategory(value: unknown): RegScanScope {
  return typeof value === 'string' && (REG_SCAN_SCOPES as readonly string[]).includes(value)
    ? value as RegScanScope
    : 'uninstall';
}

export async function scanRegistry(scopes?: RegScanScope[]): Promise<RegScanResult> {
  lastScopes = scopes?.length
    ? REG_SCAN_SCOPES.filter((scope) => scopes.includes(scope))
    : [...REG_SCAN_SCOPES];
  const result = await powershellJson<{ issues?: RegIssue[]; stats?: Partial<RegStats> }>(
    buildScanScript(lastScopes), undefined, 180_000,
  );
  const issues: RegIssue[] = (Array.isArray(result.issues) ? result.issues : []).map((raw) => ({
    hive: raw.hive === 'HKCU' ? 'HKCU' : 'HKLM',
    rootPath: String(raw.rootPath || ''),
    label: String(raw.label || ''),
    key: String(raw.key || ''),
    name: String(raw.name || ''),
    publisher: String(raw.publisher || ''),
    reason: String(raw.reason || ''),
    detail: String(raw.detail || ''),
    view: raw.view === 32 ? 32 : 64,
    system: raw.system === true,
    category: normalizeCategory(raw.category),
    risk: normalizeRisk(raw.risk),
    fixable: raw.fixable === true,
    recommendation: String(raw.recommendation || ''),
    signature: String(raw.signature || ''),
    valueName: String(raw.valueName || ''),
  }));
  issues.sort((a, b) =>
    (a.category || '').localeCompare(b.category || '')
    || a.label.localeCompare(b.label)
    || a.name.localeCompare(b.name));
  const stats: RegStats = { ...DEFAULT_STATS, ...(result.stats || {}) };
  stats.findings = issues.length;
  lastReport = { issues, stats };
  return lastReport;
}

/** Yalnızca fixable ve bilinen iki kategorideki girdiler silinebilir. */
export async function deleteRegistryIssues(issues: RegIssue[]): Promise<RegResult[]> {
  if (!issues.length) return [];
  const tempFile = path.join(os.tmpdir(), `yy-reg-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(tempFile, JSON.stringify(issues), 'utf8');

  const script = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$issues = Get-Content -Raw -LiteralPath ${psLiteral(tempFile)} | ConvertFrom-Json
$results = New-Object System.Collections.Generic.List[object]
$allowed = @('uninstall', 'app-paths')
foreach ($issue in $issues) {
  if ((-not $issue.fixable) -or ($allowed -notcontains [string]$issue.category)) {
    $results.Add([pscustomobject]@{ issue = $issue; ok = $false; message = 'Bu bulgu yalnızca rapor amaçlı; silinmedi.' })
    continue
  }
  $view = if ([int]$issue.view -eq 32) { [Microsoft.Win32.RegistryView]::Registry32 } else { [Microsoft.Win32.RegistryView]::Registry64 }
  $regView = if ([int]$issue.view -eq 32) { '32' } else { '64' }
  $hiveShort = [string]$issue.hive
  $fullPath = $hiveShort + '\' + $issue.rootPath + '\' + $issue.key
  $safe = (([string]$issue.category) + '_' + ([string]$issue.label) + '_' + ([string]$issue.key)) -replace '[^A-Za-z0-9_.-]', '_'
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

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
}

function toCsv(report: RegScanResult): string {
  const header = [
    'Kategori', 'Risk', 'Uygulama', 'Yayıncı', 'Sorun', 'Detay', 'Kök', 'Anahtar',
    'Değer', 'Öneri', 'İmza', 'Silinebilir', 'Kök Kodu',
  ];
  const rows = report.issues.map((issue) => [
    issue.category || 'uninstall', issue.risk || 'warning', issue.name, issue.publisher,
    issue.reason, issue.detail, issue.label, issue.key, issue.valueName || '',
    issue.recommendation || '', issue.signature || '', issue.fixable ? 'evet' : 'hayır', issue.hive,
  ].map(csvCell).join(','));
  return [header.map(csvCell).join(','), ...rows].join('\r\n');
}

export async function exportReport(format: 'json' | 'csv'): Promise<RegExportResult> {
  if (!lastReport) return { ok: false, message: 'Önce kayıt defteri taraması yapın.', path: '' };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const extension = format === 'csv' ? 'csv' : 'json';
  const options = {
    title: 'Kayıt defteri tarama raporu',
    defaultPath: path.join(app.getPath('documents'), `kayit-defteri-tarama-${stamp}.${extension}`),
    filters: format === 'csv'
      ? [{ name: 'CSV raporu', extensions: ['csv'] }]
      : [{ name: 'JSON raporu', extensions: ['json'] }],
  };
  const parent = BrowserWindow.getFocusedWindow();
  const target = parent ? await dialog.showSaveDialog(parent, options) : await dialog.showSaveDialog(options);
  if (target.canceled || !target.filePath) return { ok: false, message: 'Kaydetme iptal edildi.', path: '' };
  try {
    const content = format === 'csv'
      ? `\uFEFF${toCsv(lastReport)}`
      : JSON.stringify({
        generatedAt: new Date().toISOString(),
        scopes: lastScopes,
        stats: lastReport.stats,
        issues: lastReport.issues,
      }, null, 2);
    fs.writeFileSync(target.filePath, content, 'utf8');
    return { ok: true, message: `Rapor kaydedildi: ${target.filePath}`, path: target.filePath };
  } catch (error) {
    return { ok: false, message: `Rapor kaydedilemedi: ${(error as Error).message}`, path: '' };
  }
}

export function backupFolder(): string {
  return path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'ParsSistemYoneticisi', 'registry_backups');
}
