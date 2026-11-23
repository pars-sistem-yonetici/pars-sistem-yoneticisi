import type { InstalledApp, Package } from '../../shared/types';
import { normalizeName, powershellJson } from '../util';

interface RawApp extends InstalledApp {
  size?: number;
}

const SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Drawing
$path = 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
$items = New-Object System.Collections.Generic.List[object]
$seen = New-Object System.Collections.Generic.HashSet[string]

function Clean([string]$value) {
  if ($null -eq $value) { return '' }
  return [regex]::Replace($value, '[\u0000-\u001F]', ' ')
}

function Add-Apps($hive, $viewName) {
  $view = if ($viewName -eq '32') { [Microsoft.Win32.RegistryView]::Registry32 } else { [Microsoft.Win32.RegistryView]::Registry64 }
  try {
    $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive, $view)
    $key = $base.OpenSubKey($path)
    if (-not $key) { return }
    foreach ($subName in $key.GetSubKeyNames()) {
      $sub = $key.OpenSubKey($subName)
      if (-not $sub) { continue }
      $name = [string]$sub.GetValue('DisplayName')
      if ([string]::IsNullOrWhiteSpace($name)) { continue }
      if ($sub.GetValue('SystemComponent') -eq 1) { continue }
      $normalized = $name.ToLowerInvariant()
      if (-not $seen.Add($normalized)) { continue }
      $iconPath = [string]$sub.GetValue('DisplayIcon')
      $iconB64 = $null
      if ($iconPath -and $items.Count -lt 140) {
        $iconPath = $iconPath -replace '^"|"$',''
        $iconPath = ($iconPath -split ',')[0]
        $iconPath = [Environment]::ExpandEnvironmentVariables($iconPath)
        if (Test-Path -LiteralPath $iconPath -PathType Leaf) {
          try {
            $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($iconPath)
            if ($icon) {
              $bmp = $icon.ToBitmap()
              $ms = New-Object System.IO.MemoryStream
              $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
              $iconB64 = 'data:image/png;base64,' + [Convert]::ToBase64String($ms.ToArray())
              $ms.Dispose(); $bmp.Dispose(); $icon.Dispose()
            }
          } catch { $iconB64 = $null }
        }
      }
      $items.Add([pscustomobject]@{
        name = (Clean $name)
        ident = ''
        version = (Clean ([string]$sub.GetValue('DisplayVersion')))
        publisher = (Clean ([string]$sub.GetValue('Publisher')))
        installLocation = (Clean ([string]$sub.GetValue('InstallLocation')))
        displayIcon = (Clean ([string]$sub.GetValue('DisplayIcon')))
        uninstallString = (Clean ([string]$sub.GetValue('UninstallString')))
        icon = $iconB64
        size = 0
      })
    }
    $key.Close(); $base.Close()
  } catch { }
}

Add-Apps ([Microsoft.Win32.RegistryHive]::LocalMachine) '64'
Add-Apps ([Microsoft.Win32.RegistryHive]::LocalMachine) '32'
Add-Apps ([Microsoft.Win32.RegistryHive]::CurrentUser) '64'
$items | ConvertTo-Json -Depth 3 -Compress
`;

export async function installedApps(wingetPackages: Package[] = []): Promise<InstalledApp[]> {
  const raw = await powershellJson<RawApp[]>(SCRIPT, undefined, 90_000);
  const byName = new Map<string, Package>();
  for (const pkg of wingetPackages) {
    const key = normalizeName(pkg.name);
    if (key && !byName.has(key)) byName.set(key, pkg);
  }
  return raw.map((app) => {
    const key = normalizeName(app.name);
    const match = byName.get(key);
    const { size: _size, ...clean } = app;
    return {
      ...clean,
      ident: match?.ident || '',
      version: app.version || match?.version || '',
      icon: app.icon || undefined,
    };
  });
}
