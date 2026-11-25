import type { SystemSnapshot } from '../../shared/types';
import { powershellJson, psLiteral } from '../util';

export async function snapshot(requestedDrive?: string): Promise<SystemSnapshot> {
  const safeDrive = requestedDrive && /^[A-Za-z]:\\?$/.test(requestedDrive.trim())
    ? `${requestedDrive.trim()[0].toUpperCase()}:`
    : '';
  const script = `
$ErrorActionPreference = 'Stop'
$cpu = 0.0
try {
  $cpu = [double]((Get-Counter '\\Processor(_Total)\\% Processor Time' -SampleInterval 1 -MaxSamples 1 -ErrorAction Stop).CounterSamples | Select-Object -First 1).CookedValue
} catch {
  try { $cpu = [double]((Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average) } catch { $cpu = 0.0 }
}
$os = Get-CimInstance Win32_OperatingSystem
$selectedDrive = ${psLiteral(safeDrive)}
$driveName = $(if ($selectedDrive) { $selectedDrive.TrimEnd(':') } else { $env:SystemDrive.TrimEnd(':') })
$drive = Get-PSDrive -Name $driveName -PSProvider FileSystem -ErrorAction Stop
$totalMem = [double]$os.TotalVisibleMemorySize * 1024
$freeMem = [double]$os.FreePhysicalMemory * 1024
$totalDisk = [double]$drive.Used + [double]$drive.Free
[pscustomobject]@{
  cpuPercent = [math]::Round($cpu, 1)
  memoryTotal = [int64]$totalMem
  memoryAvailable = [int64]$freeMem
  memoryPercent = [math]::Round(($totalMem - $freeMem) * 100 / $totalMem, 1)
  diskTotal = [int64]$totalDisk
  diskFree = [int64]$drive.Free
  diskPercent = [math]::Round(($totalDisk - [double]$drive.Free) * 100 / $totalDisk, 1)
  diskPath = ($driveName + ':\\')
} | ConvertTo-Json -Compress
`;
  return powershellJson<SystemSnapshot>(script, undefined, 30_000);
}

export async function drives(): Promise<string[]> {
  const script = `
$names = @(Get-PSDrive -PSProvider FileSystem | ForEach-Object { $_.Name + ':\\' })
$names | ConvertTo-Json -Compress
`;
  const result = await powershellJson<string | string[]>(script, undefined, 20_000);
  return (Array.isArray(result) ? result : [result]).map((item) => item.trim()).filter(Boolean);
}

/** Sürücü harflerini kullanıcıya anlamlı gelen birim adlarına eşler. */
export async function driveLabels(): Promise<Record<string, string>> {
  const script = `
$ErrorActionPreference = 'Stop'
$items = @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object {
  [pscustomobject]@{
    DeviceID = $_.DeviceID
    VolumeName = $_.VolumeName
    Caption = $_.Caption
  }
})
$items | ConvertTo-Json -Compress
`;
  const result = await powershellJson<
    Array<{ DeviceID?: string; VolumeName?: string; Caption?: string }> | Record<string, { DeviceID?: string; VolumeName?: string; Caption?: string }>
  >(script, undefined, 20_000);
  const rows = Array.isArray(result) ? result : Object.values(result || {});
  const labels: Record<string, string> = {};
  const systemDrive = (process.env.SystemDrive || 'C:').toUpperCase();
  for (const row of rows) {
    const letter = String(row.DeviceID || '').replace('\\', '').toUpperCase();
    if (!/^[A-Z]:$/.test(letter)) continue;
    const name = String(row.VolumeName || '').trim();
    const label = name || (letter === systemDrive ? 'Windows' : 'Yerel Disk');
    labels[letter] = label;
    labels[`${letter}\\`] = label;
  }
  if (!labels[systemDrive]) {
    labels[systemDrive] = 'Windows';
    labels[`${systemDrive}\\`] = 'Windows';
  }
  return labels;
}
