import fs from 'fs';
import path from 'path';
import type { InstalledApp, Package } from '../../shared/types';
import { directorySize, expandVars, isProtectedPath, isRuntimePath, normalizeName, powershellJson } from '../util';
import { getSettings } from './settings';

type RawApp = InstalledApp;

/** Kayıt defterinde boyut bildirmeyen uygulamalar için en fazla kaç klasör ölçülür. */
const MAX_FOLDER_FALLBACKS = 30;
const MAX_FILES_PER_FOLDER = 5_000;
const FALLBACK_BUDGET_MS = 20_000;

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
      if ($iconPath -and $items.Count -lt 500) {
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
        size = ([int64]$sub.GetValue('EstimatedSize')) * 1024
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

/** Windows'un kendi kaldırıcıları klasör boyutu ölçümü için kullanılmaz. */
const SYSTEM_TOOLS = new Set(['msiexec.exe', 'rundll32.exe', 'sdbinst.exe', 'cmd.exe', 'powershell.exe', 'regsvr32.exe']);

/** "C:\\Path\\app.exe",0 veya "C:\\Path\\unins000.exe" /S biçimindeki ilk mutlak yolu ayıklar. */
function commandPath(value: string): string {
  const text = (value || '').trim();
  if (!text) return '';
  const quoted = text.match(/^"([^"]+)"/);
  if (quoted) return expandVars(quoted[1].split(',')[0].trim());
  const exe = text.match(/^([a-zA-Z]:\\[^|<>?*"]+?\.(?:exe|dll|msi))(?=\s|$)/i);
  const raw = exe ? exe[1] : text.split(/\s+[-/]/)[0].trim();
  return expandVars(raw.split(',')[0].trim());
}

/** Boyutu kayıtta olmayan bir uygulama için aday kurulum klasörleri. */
function folderCandidates(app: InstalledApp): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  for (const value of [app.installLocation, app.displayIcon, app.uninstallString]) {
    const paths = [commandPath(value)];
    // Kaldırıcı komutlarında veri dosyası tırnak içinde geçebilir (ör. sdbinst -u "...sdb").
    for (const quoted of value.match(/"[^"]+"/g) || []) paths.push(quoted.slice(1, -1));
    for (const extracted of paths) {
      if (!extracted || !path.isAbsolute(extracted)) continue;
      if (SYSTEM_TOOLS.has(path.basename(extracted).toLowerCase())) continue;
      let target = extracted;
      try { if (fs.statSync(target).isDirectory() === false) target = path.dirname(target); }
      catch { if (path.extname(target)) target = path.dirname(target); }
      let resolved = '';
      try { resolved = path.resolve(target); } catch { continue; }
      const key = resolved.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (isProtectedPath(resolved) || isRuntimePath(resolved)) continue;
      try {
        if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) continue;
      } catch { continue; }
      candidates.push(resolved);
    }
  }
  return candidates;
}

/** Hariç tutulan klasörleri tek kez okuyup hızlı bir kontrol fonksiyonu üretir. */
function folderSkip(): (target: string) => boolean {
  const excluded = getSettings()
    .excludedFolders.map((folder) => {
      try { return path.resolve(expandVars(folder.trim())).toLowerCase().replace(/[\\/]+$/, ''); }
      catch { return ''; }
    })
    .filter(Boolean);
  return (target: string) => {
    let lower = '';
    try { lower = path.resolve(target).toLowerCase(); } catch { return true; }
    if (excluded.some((folder) => lower === folder || lower.startsWith(`${folder}${path.sep.toLowerCase()}`))) return true;
    return isProtectedPath(target) || isRuntimePath(target);
  };
}

export async function installedApps(wingetPackages: Package[] = []): Promise<InstalledApp[]> {
  const raw = await powershellJson<RawApp[]>(SCRIPT, undefined, 90_000);
  const byName = new Map<string, Package>();
  for (const pkg of wingetPackages) {
    const key = normalizeName(pkg.name);
    if (key && !byName.has(key)) byName.set(key, pkg);
  }
  const skip = folderSkip();
  const deadline = Date.now() + FALLBACK_BUDGET_MS;
  let measured = 0;
  return raw.map((app) => {
    const key = normalizeName(app.name);
    const match = byName.get(key);
    const registrySize = Number.isFinite(app.size) && app.size > 0 ? Math.floor(app.size) : 0;
    let size = registrySize;
    if (!size && measured < MAX_FOLDER_FALLBACKS && Date.now() < deadline) {
      for (const folder of folderCandidates(app)) {
        if (measured >= MAX_FOLDER_FALLBACKS || Date.now() >= deadline) break;
        measured += 1;
        size = directorySize(folder, MAX_FILES_PER_FOLDER, skip);
        if (size > 0) break;
      }
    }
    return {
      ...app,
      size,
      ident: match?.ident || '',
      version: app.version || match?.version || '',
      icon: app.icon || undefined,
    };
  });
}
