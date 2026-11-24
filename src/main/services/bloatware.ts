import type { BloatwareItem, BloatwareRemoveResult } from '../../shared/types';
import { normalizeName, powershellJson, psLiteral } from '../util';
import * as winget from './winget';

/**
 * Kaldırılmasına izin verilen Windows paketleri. Sistem için gerekli kabuk,
 * Start menüsü, arama ve mağaza paketleri hiçbir zaman listeye alınmaz.
 */
const WINDOWS_APPS = [
  'Microsoft.BingNews', 'Microsoft.BingWeather', 'Microsoft.BingSearch',
  'Microsoft.BingSports', 'Microsoft.BingFinance', 'Microsoft.BingTravel',
  'Microsoft.BingFoodAndDrink', 'Microsoft.BingHealthAndFitness',
  'Microsoft.Copilot', 'Microsoft.GetHelp', 'Microsoft.Getstarted',
  'Microsoft.Microsoft3DViewer', 'Microsoft.MicrosoftOfficeHub',
  'Microsoft.MicrosoftSolitaireCollection', 'Microsoft.MicrosoftStickyNotes',
  'Microsoft.MixedReality.Portal', 'Microsoft.People', 'Microsoft.PowerAutomateDesktop',
  'Microsoft.SkypeApp', 'Microsoft.Todos', 'Microsoft.WindowsAlarms',
  'Microsoft.WindowsCamera', 'Microsoft.WindowsCommunicationsApps',
  'Microsoft.WindowsFeedbackHub', 'Microsoft.WindowsMaps',
  'Microsoft.WindowsSoundRecorder', 'Microsoft.Xbox.TCUI', 'Microsoft.XboxApp',
  'Microsoft.XboxGameOverlay', 'Microsoft.XboxGamingOverlay',
  'Microsoft.XboxIdentityProvider', 'Microsoft.XboxSpeechToTextOverlay',
  'Microsoft.YourPhone', 'Microsoft.ZuneMusic', 'Microsoft.ZuneVideo',
  'Clipchamp.Clipchamp',
];

const CRITICAL_APPS = new Set([
  'Microsoft.Windows.ShellExperienceHost', 'Microsoft.Windows.StartMenuExperienceHost',
  'Microsoft.Windows.Search', 'Microsoft.Windows.DesktopAppInstaller',
  'Microsoft.WindowsStore', 'Microsoft.StorePurchaseApp', 'Microsoft.AAD.BrokerPlugin',
]);

const OEM_PUBLISHERS = [
  'hewlett-packard', 'hp inc', 'dell inc', 'dell technologies', 'lenovo',
  'asus', 'acer', 'toshiba', 'samsung electronics', 'micro-star', 'msi',
  'mcafee', 'symantec', 'nortonlifelock', 'avast', 'avg technologies',
  'wildtangent', 'cyberlink', 'cybersoft', 'olivegarden', 'packard bell',
  'gateway', 'benq', 'lg electronics', 'panasonic', 'razer',
];

const OEM_NAMES = [
  'support assistant', 'supportassist', 'vantage', 'live update',
  'mcafee', 'norton', 'symantec', 'avast', 'avg ', 'wildtangent',
  'candy crush', 'farmville', 'bejeweled', 'ebay', 'olive garden',
];

interface RawItem {
  kind: string;
  id: string;
  name: string;
  publisher: string;
  version: string;
  packageName: string;
  packageFullName: string;
  provisioned: boolean;
  detail: string;
}

const SCAN_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$items = New-Object System.Collections.Generic.List[object]
$prov = @{}
try {
  foreach ($p in (Get-AppxProvisionedPackage -Online)) { $prov[[string]$p.PackageName] = $true }
} catch {}
try {
  $appx = Get-AppxPackage -AllUsers | Where-Object { -not $_.IsFramework -and -not $_.IsResourcePackage }
  foreach ($p in $appx) {
    $pn = [string]$p.Name
    $items.Add([pscustomobject]@{
      kind = 'windows-app'
      id = [string]$p.PackageFullName
      name = [string]$p.Name
      publisher = [string]$p.Publisher
      version = [string]$p.Version
      packageName = $pn
      packageFullName = [string]$p.PackageFullName
      provisioned = $prov.ContainsKey($pn)
      detail = ''
    })
  }
} catch {}

$path = 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
$seen = New-Object System.Collections.Generic.HashSet[string]
function Add-Oem($hive, $viewName, $prefix) {
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
      $items.Add([pscustomobject]@{
        kind = 'oem-app'
        id = ($prefix + ':' + $subName)
        name = $name
        publisher = [string]$sub.GetValue('Publisher')
        version = [string]$sub.GetValue('DisplayVersion')
        packageName = ''
        packageFullName = ''
        provisioned = $false
        detail = [string]$sub.GetValue('InstallLocation')
      })
    }
    $key.Close(); $base.Close()
  } catch {}
}
Add-Oem ([Microsoft.Win32.RegistryHive]::LocalMachine) '64' 'LM64'
Add-Oem ([Microsoft.Win32.RegistryHive]::LocalMachine) '32' 'LM32'
Add-Oem ([Microsoft.Win32.RegistryHive]::CurrentUser) '64' 'CU64'
$items | ConvertTo-Json -Depth 3 -Compress
`;

function windowsAppAllowed(packageName: string): boolean {
  if (!packageName || CRITICAL_APPS.has(packageName)) return false;
  return WINDOWS_APPS.some((prefix) => packageName === prefix || packageName.startsWith(`${prefix}.`));
}

function oemAllowed(name: string, publisher: string): boolean {
  const app = name.toLocaleLowerCase('tr-TR');
  const vendor = publisher.toLocaleLowerCase('tr-TR');
  return OEM_PUBLISHERS.some((part) => vendor.includes(part)) || OEM_NAMES.some((part) => app.includes(part));
}

/** Yalnızca taramanın ürettiği güvenli kimlikler kaldırılabilir. */
function removable(raw: RawItem): boolean {
  if (raw.kind === 'windows-app') {
    return windowsAppAllowed(raw.packageName) && !!raw.packageFullName;
  }
  if (raw.kind === 'oem-app') {
    return oemAllowed(raw.name, raw.publisher);
  }
  return false;
}

function toItem(raw: RawItem, ident: string): BloatwareItem {
  const windows = raw.kind === 'windows-app';
  return {
    id: raw.id,
    name: raw.name,
    publisher: raw.publisher,
    version: raw.version,
    kind: windows ? 'windows-app' : 'oem-app',
    ident,
    packageName: raw.packageName,
    packageFullName: raw.packageFullName,
    provisioned: !!raw.provisioned,
    detail: raw.detail,
    reason: windows
      ? raw.provisioned ? 'Windows ile gelir; yeni kullanıcılar için de kaldırılır.' : 'Windows ile birlikte yüklenmiştir.'
      : 'Üretici veya ön yüklü üçüncü taraf yazılımı.',
  };
}

export async function scanBloatware(): Promise<BloatwareItem[]> {
  const raw = await powershellJson<RawItem[] | RawItem>(SCAN_SCRIPT, undefined, 120_000);
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const byName = new Map<string, string>();
  try {
    for (const pkg of await winget.listPackages()) {
      const key = normalizeName(pkg.name);
      if (key && !byName.has(key) && pkg.ident) byName.set(key, pkg.ident);
    }
  } catch {
    // winget yoksa OEM öğeleri adla kaldırılmaya çalışılır.
  }
  return rows
    .filter(removable)
    .map((row) => toItem(row, byName.get(normalizeName(row.name)) ?? ''))
    .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, 'tr') : a.kind === 'windows-app' ? -1 : 1));
}

export async function removeBloatware(items: BloatwareItem[]): Promise<BloatwareRemoveResult[]> {
  const safe = items.filter(removable);
  const results: BloatwareRemoveResult[] = items.map((item) => ({
    id: item.id,
    ok: false,
    message: safe.includes(item) ? 'İşlem bekleniyor.' : 'Güvenli liste dışında; kaldırılmadı.',
  }));
  if (!safe.length) return results;

  const rows = safe.map((item) => {
    const ident = /^[A-Za-z0-9][A-Za-z0-9._+-]*\.[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(item.ident) ? item.ident : '';
    const name = item.name.length <= 512 && !/[\r\n]/.test(item.name) ? item.name : '';
    return `  [pscustomobject]@{
    id = ${psLiteral(item.id)}
    kind = '${item.kind}'
    p = ${psLiteral(item.packageFullName)}
    pn = ${psLiteral(item.packageName)}
    provisioned = ${item.provisioned ? '$true' : '$false'}
    ident = ${psLiteral(ident)}
    name = ${psLiteral(name)}
  },`;
  });
  rows[rows.length - 1] = rows[rows.length - 1].replace(/,$/, '');

  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$targets = @(
${rows.join('\n')}
)
$out = @()
foreach ($target in $targets) {
  $ok = $false
  $msg = ''
  try {
    if ($target.kind -eq 'windows-app') {
      Remove-AppxPackage -Package $target.p -ErrorAction Stop
      if ($target.provisioned) {
        Remove-AppxProvisionedPackage -Online -PackageName $target.pn -ErrorAction SilentlyContinue | Out-Null
      }
      $ok = $true
      $msg = 'Kaldırıldı.'
    } else {
      if ($target.ident) {
        & winget uninstall --id $target.ident --exact --accept-source-agreements --disable-interactivity --nowarn --silent
      } elseif ($target.name) {
        & winget uninstall --name $target.name --exact --accept-source-agreements --disable-interactivity --nowarn --silent
      } else {
        throw 'Geçersiz uygulama adı.'
      }
      if ($LASTEXITCODE -eq 0) {
        $ok = $true
        $msg = 'Kaldırıldı.'
      } else {
        $msg = 'winget çıkış kodu ' + $LASTEXITCODE
      }
    }
  } catch { $msg = $_.Exception.Message }
  $out += [pscustomobject]@{ id = $target.id; ok = $ok; msg = $msg }
}
@{ items = @($out) } | ConvertTo-Json -Compress -Depth 4
`;
  try {
    const parsed = await powershellJson<{ items?: Array<{ id: string; ok: boolean; msg: string }> | { id: string; ok: boolean; msg: string } }>(script, undefined, 600_000);
    const rawItems = parsed?.items;
    const returned = !rawItems ? [] : Array.isArray(rawItems) ? rawItems : [rawItems];
    const byId = new Map(returned.map((row) => [String(row.id), row]));
    for (const item of safe) {
      const row = byId.get(item.id);
      const target = results.find((entry) => entry.id === item.id);
      if (target) {
        target.ok = !!row?.ok;
        target.message = String(row?.msg || 'PowerShell sonucu alınamadı.').slice(0, 200);
      }
    }
  } catch (error) {
    for (const item of safe) {
      const target = results.find((entry) => entry.id === item.id);
      if (target) target.message = (error as Error).message.slice(0, 200);
    }
  }
  return results;
}
