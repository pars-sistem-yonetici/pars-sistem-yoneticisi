import path from 'path';
import os from 'os';
import { powershellJson } from '../util';
import { isExcludedPath } from './exclusions';

export interface FirewallRule {
  id: string;
  name: string;
  enabled: boolean;
  direction: string;
  action: string;
  program: string;
  remoteAddress: string;
  localPort: string;
  remotePort: string;
  protocol: string;
  profile: string;
  signature: string;
  severity: 'critical' | 'medium' | 'low';
  reasons: string[];
}

interface FirewallScanRow {
  id?: unknown;
  name?: unknown;
  enabled?: unknown;
  direction?: unknown;
  action?: unknown;
  program?: unknown;
  remoteAddress?: unknown;
  localPort?: unknown;
  remotePort?: unknown;
  protocol?: unknown;
  profile?: unknown;
  signature?: unknown;
  fileExists?: unknown;
}

interface FirewallCommandResult {
  ok?: boolean;
  message?: string;
}

/** PowerShell tek tırnaklı dize içine güvenli ekleme. */
function psLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function asBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function lower(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

function isMissingProgram(program: string): boolean {
  const value = lower(program);
  return value === '' || value === 'any' || value === '*';
}

function isBroadScope(remoteAddress: string, localPort: string, remotePort: string): boolean {
  const address = lower(remoteAddress);
  const broadAddress =
    address === 'any' || address === '*' || address === '0.0.0.0/0' || address === '::/0';
  return broadAddress || (lower(remotePort) === 'any' && lower(localPort) === 'any');
}

function isUnsignedSignature(signature: string): boolean {
  const value = lower(signature);
  return value === 'notsigned' || value === 'hashmismatch' || value === 'unknown';
}

const SCAN_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$findings = [System.Collections.Generic.List[object]]::new()
$rules = @()
try {
  $rules = @(Get-NetFirewallRule -Direction Inbound -Enabled True -ErrorAction SilentlyContinue)
} catch {
  $rules = @()
}
# Filtreleri kural başına sorgulamak çok yavaş olduğu için tek seferde alıp InstanceID ile eşleştir.
$portMap = @{}
$appMap = @{}
$sigCache = @{}
try { foreach ($f in @(Get-NetFirewallPortFilter -ErrorAction SilentlyContinue)) { $k = [string]$f.InstanceID; if ($k -and -not $portMap.ContainsKey($k)) { $portMap[$k] = $f } } } catch {}
try { foreach ($f in @(Get-NetFirewallApplicationFilter -ErrorAction SilentlyContinue)) { $k = [string]$f.InstanceID; if ($k -and -not $appMap.ContainsKey($k)) { $appMap[$k] = $f } } } catch {}
foreach ($rule in $rules) {
  try {
    $isEnabled = $false
    try { $isEnabled = [bool]$rule.Enabled } catch { $isEnabled = $false }
    if (-not $isEnabled) { continue }

    $ruleKey = ''
    try { $ruleKey = [string]$rule.InstanceID } catch { $ruleKey = '' }
    if (-not $ruleKey) { try { $ruleKey = [string]$rule.Name } catch { $ruleKey = '' } }
    $port = $null
    $application = $null
    if ($ruleKey -and $portMap.ContainsKey($ruleKey)) { $port = $portMap[$ruleKey] }
    if ($ruleKey -and $appMap.ContainsKey($ruleKey)) { $application = $appMap[$ruleKey] }

    $remoteAddress = ''
    $localPort = ''
    $remotePort = ''
    $protocolText = ''
    try { $remoteAddress = [string]$rule.RemoteAddress } catch { $remoteAddress = '' }
    try { if ($null -ne $port) { $localPort = [string]$port.LocalPort } } catch { $localPort = '' }
    try { if ($null -ne $port) { $remotePort = [string]$port.RemotePort } } catch { $remotePort = '' }
    try { if ($null -ne $port) { $protocolText = [string]$port.Protocol } } catch { $protocolText = '' }

    $program = ''
    try { if ($null -ne $application) { $program = [string]$application.Program } } catch { $program = '' }
    $programTrimmed = $program.Trim()
    $programMissing = [string]::IsNullOrWhiteSpace($programTrimmed) -or (@('Any', '*') -contains $programTrimmed)

    $ruleName = ''
    try { $ruleName = [string]$rule.Name } catch { $ruleName = '' }
    $displayName = ''
    try { $displayName = [string]$rule.DisplayName } catch { $displayName = '' }
    if ([string]::IsNullOrWhiteSpace($displayName)) { $displayName = $ruleName }
    # Paketlenmiş Windows uygulamalarının varsayılan AppContainer kuralları "Any" program kullanır; denetim gürültüsü olmasın.
    if ($displayName -like '@{*' -or $displayName -match 'ms-resource:') { continue }
    $ruleDirection = ''
    try { $ruleDirection = [string]$rule.Direction } catch { $ruleDirection = '' }
    $ruleAction = ''
    try { $ruleAction = [string]$rule.Action } catch { $ruleAction = '' }
    $ruleProfile = ''
    try { $ruleProfile = [string]$rule.Profile } catch { $ruleProfile = '' }

    $fileExists = $false
    $signature = 'Yok'
    if (-not $programMissing) {
      $expanded = $programTrimmed.Trim([char]34)
      try { $expanded = [Environment]::ExpandEnvironmentVariables($expanded).Trim() } catch { $expanded = $expanded.Trim() }
      try {
        if (-not [string]::IsNullOrWhiteSpace($expanded)) {
          $fileExists = [System.IO.Path]::IsPathRooted($expanded) -and [System.IO.File]::Exists($expanded)
        }
      } catch { $fileExists = $false }
      if ($fileExists) {
        $cacheKey = $expanded.ToLowerInvariant()
        if ($sigCache.ContainsKey($cacheKey)) {
          $signature = [string]$sigCache[$cacheKey]
        } else {
          try {
            $signatureResult = Get-AuthenticodeSignature -FilePath $expanded -ErrorAction Stop
            $signature = [string]$signatureResult.Status
          } catch {
            $signature = 'Unknown'
          }
          $sigCache[$cacheKey] = $signature
        }
      } else {
        $signature = 'Dosya eksik'
      }
    }

    $findings.Add([pscustomobject]@{
      id = $ruleName
      name = $displayName
      enabled = $isEnabled
      direction = $ruleDirection
      action = $ruleAction
      program = $program
      remoteAddress = $remoteAddress
      localPort = $localPort
      remotePort = $remotePort
      protocol = $protocolText
      profile = $ruleProfile
      signature = $signature
      fileExists = $fileExists
    })
  } catch { }
}
try {
  $list = @($findings.ToArray())
  $json = ConvertTo-Json -InputObject $list -Depth 6 -Compress
  if ([string]::IsNullOrWhiteSpace($json)) {
    $json = '[]'
  } elseif (-not $json.TrimStart().StartsWith('[')) {
    $json = '[' + $json + ']'
  }
} catch {
  $json = '[]'
}
$json
`;

export async function scanFirewall(): Promise<FirewallRule[]> {
  const raw = await powershellJson<unknown>(SCAN_SCRIPT, undefined, 180_000);
  const rows: FirewallScanRow[] = Array.isArray(raw)
    ? (raw as FirewallScanRow[])
    : typeof raw === 'object' && raw !== null
      ? [raw as FirewallScanRow]
      : [];

  const severityOrder: Record<FirewallRule['severity'], number> = {
    critical: 0,
    medium: 1,
    low: 2,
  };
  const rules: FirewallRule[] = [];

  for (const row of rows) {
    const enabled = asBoolean(row.enabled);
    if (!enabled) continue;

    const program = asText(row.program);
    const signature = asText(row.signature);
    const remoteAddress = asText(row.remoteAddress);
    const localPort = asText(row.localPort);
    const remotePort = asText(row.remotePort);
    const broad = isBroadScope(remoteAddress, localPort, remotePort);
    const missingProgram = isMissingProgram(program);
    const missingFile = !missingProgram && !asBoolean(row.fileExists);
    const unsigned = isUnsignedSignature(signature);
    const hashMismatch = lower(signature) === 'hashmismatch';

    const reasons: string[] = [];
    if (broad) reasons.push('Kapsam çok geniş');
    if (missingProgram) reasons.push('Program belirtilmemiş');
    if (unsigned) reasons.push('İmzasız ikili');
    if (missingFile) reasons.push('Dosya yolu eksik');
    if (reasons.length === 0) continue;
    if (program && !isMissingProgram(program) && isExcludedPath(program)) continue;

    const severity: FirewallRule['severity'] =
      (broad && (unsigned || missingProgram || missingFile)) || hashMismatch ? 'critical' : 'medium';

    rules.push({
      id: asText(row.id),
      name: asText(row.name),
      enabled,
      direction: asText(row.direction),
      action: asText(row.action),
      program,
      remoteAddress,
      localPort,
      remotePort,
      protocol: asText(row.protocol),
      profile: asText(row.profile),
      signature,
      severity,
      reasons,
    });
  }

  rules.sort(
    (a, b) =>
      severityOrder[a.severity] - severityOrder[b.severity] ||
      a.name.localeCompare(b.name, 'tr-TR') ||
      a.id.localeCompare(b.id, 'tr-TR'),
  );
  return rules.slice(0, 300);
}

export async function setFirewallRuleEnabled(id: string, enabled: boolean): Promise<string> {
  const script = String.raw`
$ErrorActionPreference = 'Stop'
function New-CommandJson([bool]$ok, [string]$message) {
  try {
    ConvertTo-Json -InputObject ([pscustomobject]@{ ok = $ok; message = $message }) -Depth 3 -Compress
  } catch {
    '{"ok":false,"message":"JSON çıktısı oluşturulamadı."}'
  }
}
try {
  # Bu cmdlet Enabled değerini(System.Boolean yerine) NetSecurity.Enabled enum'u olarak bekliyor.
  Set-NetFirewallRule -Name ${psLiteral(id)} -Enabled ${enabled ? 'True' : 'False'} -ErrorAction Stop
  New-CommandJson $true 'Kural güncellendi.'
} catch {
  New-CommandJson $false ('Kural güncellenemedi: ' + $_.Exception.Message)
}
`;

  const result = await powershellJson<FirewallCommandResult>(script, undefined, 30_000);
  if (result.ok !== true) throw new Error(result.message || 'Kural güncellenemedi.');
  return enabled ? 'Kural etkinleştirildi.' : 'Kural devre dışı bırakıldı.';
}

/** Kural yedeklerinin yazıldığı uygulama klasörü. */
export function firewallBackupFolder(): string {
  return path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'ParsSistemYoneticisi', 'firewall_backups');
}

export async function deleteFirewallRule(id: string): Promise<string> {
  const safeId =
    id
      .replace(/[^A-Za-z0-9_.-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80) || 'kural';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `${safeId}_${stamp}.json`;
  const folder = firewallBackupFolder();
  const backupFile = path.join(folder, backupName);

  const script = String.raw`
$ErrorActionPreference = 'Stop'
function New-CommandJson([bool]$ok, [string]$message) {
  try {
    ConvertTo-Json -InputObject ([pscustomobject]@{ ok = $ok; message = $message }) -Depth 3 -Compress
  } catch {
    '{"ok":false,"message":"JSON çıktısı oluşturulamadı."}'
  }
}
$ruleName = ${psLiteral(id)}
$backupFolder = ${psLiteral(folder)}
$backupFile = ${psLiteral(backupFile)}
try {
  New-Item -ItemType Directory -Force -Path $backupFolder -ErrorAction Stop | Out-Null
  $rule = Get-NetFirewallRule -Name $ruleName -ErrorAction Stop
  $ports = @()
  $applications = @()
  try { $ports = @(Get-NetFirewallPortFilter -AssociatedNetFirewallRule $rule -ErrorAction Stop) } catch { $ports = @() }
  try { $applications = @(Get-NetFirewallApplicationFilter -AssociatedNetFirewallRule $rule -ErrorAction Stop) } catch { $applications = @() }
  $backupObject = [pscustomobject]@{
    rule = $rule
    portFilters = @($ports)
    applicationFilters = @($applications)
    backedUpAt = [DateTime]::UtcNow.ToString('o')
  }
  $json = ConvertTo-Json -InputObject $backupObject -Depth 10
  [System.IO.File]::WriteAllText($backupFile, $json)
  if (-not [System.IO.File]::Exists($backupFile)) { throw 'Yedek dosyası doğrulanamadı.' }
} catch {
  New-CommandJson $false ('Yedek alınamadı; kural silinmedi: ' + $_.Exception.Message)
  exit
}
try {
  Remove-NetFirewallRule -Name $ruleName -ErrorAction Stop
  New-CommandJson $true 'Kural silindi.'
} catch {
  New-CommandJson $false ('Kural silinemedi: ' + $_.Exception.Message)
}
`;

  const result = await powershellJson<FirewallCommandResult>(script, undefined, 60_000);
  if (result.ok !== true) throw new Error(result.message || 'Kural silinemedi.');
  return `Kural silindi. Yedek: ${backupName}`;
}
