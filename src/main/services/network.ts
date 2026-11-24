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

export async function networkSpeed(): Promise<number> {
  try {
    const result = await powershellJson<{ bytesPerSec?: number }>(SPEED_SCRIPT, undefined, 10_000);
    const value = Number(result?.bytesPerSec);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}
