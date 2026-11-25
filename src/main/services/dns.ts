import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type {
  DnsBenchmarkResult, DnsCurrentResult, DnsProvider, DnsProviderId, DnsSwitchResult,
} from '../../shared/types';
import { LogFn, parsePowerShellJson, powershellJson, psLiteral, runPowerShell } from '../util';

export const DNS_PROVIDERS: DnsProvider[] = [
  { id: 'cloudflare', name: 'Cloudflare', primary: '1.1.1.1', secondary: '1.0.0.1' },
  { id: 'google', name: 'Google', primary: '8.8.8.8', secondary: '8.8.4.4' },
  { id: 'quad9', name: 'Quad9', primary: '9.9.9.9', secondary: '149.112.112.112' },
  { id: 'adguard', name: 'AdGuard', primary: '94.140.14.14', secondary: '94.140.15.15' },
  { id: 'opendns', name: 'OpenDNS', primary: '208.67.222.222', secondary: '208.67.220.220' },
];

const SAMPLE_HOST = 'example.com';
const BACKUP_KEY = 'SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces';

export function dnsProviders(): DnsProvider[] {
  return DNS_PROVIDERS.map((item) => ({ ...item }));
}

export function dnsBackupFolder(): string {
  return path.join(app.getPath('userData'), 'dns_backups');
}

const CURRENT_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$items = @()
foreach ($adapter in (Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Up' })) {
  $addresses = @(Get-DnsClientServerAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ServerAddresses)
  $items += [pscustomobject]@{ name = [string]$adapter.Name; index = [int]$adapter.InterfaceIndex; servers = @($addresses | Where-Object { $_ }) }
}
[pscustomobject]@{ adapters = @($items) } | ConvertTo-Json -Depth 5 -Compress
`;

export async function dnsCurrent(): Promise<DnsCurrentResult> {
  try {
    const parsed = await powershellJson<{ adapters?: unknown }>(CURRENT_SCRIPT, undefined, 60_000);
    const raw = parsed?.adapters;
    const list = !raw ? [] : Array.isArray(raw) ? raw : [raw];
    const adapters = list.map((item) => {
      const row = item as { name?: string; index?: number; servers?: unknown };
      const servers = !row.servers ? [] : Array.isArray(row.servers) ? row.servers : [row.servers];
      return {
        name: String(row.name ?? ''),
        index: Number(row.index ?? 0),
        servers: servers.map((value) => String(value)),
      };
    });
    return { adapters, message: adapters.length ? `${adapters.length} etkin bağdaştırıcı bulundu.` : 'Etkin ağ bağdaştırıcısı bulunamadı.' };
  } catch (error) {
    return { adapters: [], message: (error as Error).message.slice(0, 200) };
  }
}

/** Her sağlayıcı için iki kez nslookup yapıp en düşük gecikmeyi raporlar. */
export async function dnsBenchmark(onLine?: LogFn): Promise<DnsBenchmarkResult> {
  const started = Date.now();
  const rows = [];
  for (const provider of DNS_PROVIDERS) {
    onLine?.(`${provider.name} ölçülüyor: ${provider.primary}`);
    const samples: number[] = [];
    let ok = false;
    let detail = '';
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = spawnSync('nslookup.exe', ['-timeout=2', '-retry=0', SAMPLE_HOST, provider.primary], {
        encoding: 'utf8', windowsHide: true, timeout: 6000,
      });
      const text = `${result.stdout || ''}\n${result.stderr || ''}`;
      const match = text.match(/(?:time|süre)\s*[:=]\s*(\d+)\s*ms|(\d+)\s*ms/i);
      const latency = Number(match?.[1] ?? match?.[2] ?? 0);
      if (latency > 0) {
        samples.push(latency);
        ok = true;
      }
      detail = result.status === 0 || latency > 0
        ? `nslookup ${SAMPLE_HOST} → ${provider.primary}`
        : (text.split(/\r?\n/).filter(Boolean).slice(-1)[0] || 'Yanıt alınamadı.').slice(0, 160);
    }
    rows.push({
      id: provider.id, name: provider.name, primary: provider.primary, secondary: provider.secondary,
      latencyMs: samples.length ? Math.min(...samples) : null,
      ok, detail, durationMs: 0,
    });
  }
  return {
    rows,
    sample: SAMPLE_HOST,
    durationMs: Date.now() - started,
  };
}

function mandatoryBackup(stamp: string): string {
  const folder = dnsBackupFolder();
  fs.mkdirSync(folder, { recursive: true });
  const regFile = path.join(folder, `interfaces_${stamp}.reg`);
  const result = spawnSync('reg.exe', ['export', BACKUP_KEY, regFile, '/y'], { windowsHide: true });
  if (result.status !== 0 || !fs.existsSync(regFile) || fs.statSync(regFile).size < 20) {
    throw new Error('DNS arabirim kayıt defteri yedeği alınamadı; değişiklik yapılmadı.');
  }
  return regFile;
}

async function changeDns(
  provider: DnsProvider | null, label: string, onLine?: LogFn,
): Promise<DnsSwitchResult> {
  const id: DnsProviderId = provider?.id ?? 'cloudflare';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  let backupPath = '';
  try {
    const current = await dnsCurrent();
    backupPath = mandatoryBackup(stamp);
    const meta = path.join(dnsBackupFolder(), `${label}_${stamp}.json`);
    fs.writeFileSync(meta, JSON.stringify({
      at: new Date().toISOString(),
      adapters: current.adapters,
      provider: provider ? { id, primary: provider.primary, secondary: provider.secondary } : null,
    }, null, 2), 'utf8');

    const addresses = provider
      ? `@(${psLiteral(provider.primary)},${psLiteral(provider.secondary)})`
      : '@()';
    const action = provider
      ? `Set-DnsClientServerAddress -InterfaceIndex $idx -ServerAddresses $addresses -ErrorAction Stop`
      : `Set-DnsClientServerAddress -InterfaceIndex $idx -ResetServerAddresses -ErrorAction Stop`;
    const script = String.raw`
$ErrorActionPreference = 'Stop'
$addresses = ${addresses}
$indexes = @(Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Up' } | ForEach-Object { [int]$_.InterfaceIndex })
if ($indexes.Count -eq 0) { throw 'Etkin ağ bağdaştırıcısı bulunamadı.' }
foreach ($idx in $indexes) {
  ${action}
  Write-Output ('DNS: ' + $idx + ' -> ' + ($(if ($addresses.Count) { $addresses -join ',' } else { 'DHCP' })))
}
'DNS_OK'
`;
    const result = await runPowerShell(script, onLine, 60_000);
    const text = `${result.text}\n${result.stderr}`;
    if (result.code !== 0 || !text.includes('DNS_OK')) throw new Error(text.trim().slice(-300) || 'DNS değiştirilemedi.');
    const previous = current.adapters.flatMap((adapter) => adapter.servers);
    return {
      ok: true, id,
      message: provider
        ? `${provider.name} DNS sunucuları ${current.adapters.length} bağdaştırıcıya uygulandı.`
        : 'DNS sunucuları DHCP’den alınacak şekilde sıfırlandı.',
      backupPath, previous,
    };
  } catch (error) {
    return {
      ok: false, id, message: (error as Error).message.slice(0, 300), backupPath, previous: [],
    };
  }
}

export async function dnsSwitch(id: DnsProviderId, onLine?: LogFn): Promise<DnsSwitchResult> {
  const provider = DNS_PROVIDERS.find((item) => item.id === id);
  if (!provider) throw new Error('Bilinmeyen DNS sağlayıcısı.');
  return changeDns(provider, 'switch', onLine);
}

export async function dnsReset(onLine?: LogFn): Promise<DnsSwitchResult> {
  return changeDns(null, 'reset', onLine);
}

/** Test/doğrulama için sağlayıcı adreslerini döndürür. */
export function dnsProviderAddresses(): Array<{ id: DnsProviderId; primary: string; secondary: string }> {
  return DNS_PROVIDERS.map(({ id, primary, secondary }) => ({ id, primary, secondary }));
}

/** PowerShell JSON çıktısını doğrudan test etmek için kullanılır. */
export function parseDnsCurrent(text: string): { adapters: Array<{ name: string; index: number; servers: string[] }> } {
  return parsePowerShellJson<{ adapters: Array<{ name: string; index: number; servers: string[] }> }>(text);
}
