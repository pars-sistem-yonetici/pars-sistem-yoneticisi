import fs from 'fs';
import { getCapabilities } from '../../shared/platform';
import { powershellJson } from '../util';

/**
 * Windows performans sayaçlarından anlık ağ alış hızını (bayt/saniye) okur.
 * winget/choco/npm çıktısında hız bildirilmediğinde arayüzde gösterilir.
 */
const SPEED_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
function Get-Total {
  $stats = Get-NetAdapterStatistics
  if (-not $stats) { return 0 }
  return [double](($stats | Measure-Object -Property ReceivedBytes -Sum).Sum)
}
$before = Get-Total
Start-Sleep -Seconds 1
$after = Get-Total
$delta = $after - $before
if ($delta -lt 0) { $delta = 0 }
@{ bytesPerSec = [math]::Round($delta) } | ConvertTo-Json -Compress
`;

/** Linux'ta /proc/net/dev salt okunur; macOS'ta karşılığı olmadığından 0 döner. */
function posixRxBytes(): number {
  try {
    let total = 0;
    for (const line of fs.readFileSync('/proc/net/dev', 'utf8').split(/\r?\n/).slice(2)) {
      const columns = line.split(':');
      if (columns.length < 2) continue;
      const receive = Number(columns[1].trim().split(/\s+/)[0]);
      if (Number.isFinite(receive) && receive > 0) total += receive;
    }
    return total;
  } catch {
    return 0;
  }
}

export async function networkSpeed(): Promise<number> {
  if (getCapabilities().kind !== 'windows') {
    if (getCapabilities().kind !== 'linux') return 0;
    const before = posixRxBytes();
    await new Promise((resolve) => { setTimeout(resolve, 1000); });
    const after = posixRxBytes();
    const delta = after - before;
    return Number.isFinite(delta) && delta > 0 ? delta : 0;
  }
  try {
    const result = await powershellJson<{ bytesPerSec?: number }>(SPEED_SCRIPT, undefined, 10_000);
    const value = Number(result?.bytesPerSec);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}
