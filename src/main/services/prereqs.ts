import fs from 'fs';
import os from 'os';
import path from 'path';
import type { PrereqActionResult, Prerequisite, PrerequisiteId } from '../../shared/types';
import { LogFn, commandCandidates, parsePowerShellJson, runCommand, runPowerShell } from '../util';
import * as winget from './winget';

const MANAGER_IDS: PrerequisiteId[] = ['winget', 'choco', 'npm', 'scoop'];

function bundledScript(name: string): string {
  const packaged = process.resourcesPath ? path.join(process.resourcesPath, 'prereqs', name) : '';
  if (packaged && fs.existsSync(packaged)) return packaged;
  return path.join(__dirname, '..', '..', '..', 'build', 'prereqs', name);
}

async function runPsFile(script: string, onLine?: LogFn, timeout = 10 * 60 * 1000) {
  const folder = path.join(os.tmpdir(), 'pars-sistem-yoneticisi-prereq');
  const file = path.join(folder, `${process.pid}-${Date.now()}.ps1`);
  try {
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(file, `\uFEFF$ProgressPreference = 'SilentlyContinue'\n${script}`, 'utf8');
    return await runCommand(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file],
      onLine,
      timeout,
    );
  } finally {
    try { fs.unlinkSync(file); } catch { /* zaten silinmiş */ }
  }
}

function parseResult(code: number, lines: string[], fallback: string): PrereqActionResult {
  const last = [...lines].reverse().find((line) => line.trim())?.trim() || fallback;
  if (/^OK(?:_REBOOT)?$/i.test(last)) {
    return { id: 'winget', ok: true, rebootRequired: /REBOOT/i.test(last), message: 'Bileşen kuruldu.' };
  }
  if (/^HATA:/i.test(last)) return { id: 'winget', ok: false, message: last.replace(/^HATA:\s*/i, '') };
  return { id: 'winget', ok: code === 0, message: last || fallback, rebootRequired: /3010/.test(last) };
}

const VC_REDIST_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$url = 'https://aka.ms/vs/17/release/vc_redist.x64.exe'
$target = Join-Path $env:TEMP 'ParsSistemYoneticisi_vc_redist.x64.exe'
try {
  Write-Output 'Visual C++ 2015-2022 yeniden dağıtılabilir paketi indiriliyor...'
  Invoke-WebRequest -Uri $url -OutFile $target -UseBasicParsing -ErrorAction Stop
  $signature = Get-AuthenticodeSignature -FilePath $target -ErrorAction Stop
  if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Microsoft') {
    throw 'İndirilen dosyanın Microsoft imzası doğrulanamadı; kurulum yapılmadı.'
  }
  Write-Output 'İmza doğrulandı, sessiz kurulum başlatılıyor...'
  $process = Start-Process -FilePath $target -ArgumentList '/install /quiet /norestart' -Wait -PassThru
  if ($process.ExitCode -in @(0, 3010)) {
    if ($process.ExitCode -eq 3010) { Write-Output 'OK_REBOOT' } else { Write-Output 'OK' }
  } else {
    throw ('Kurulum kodu: ' + $process.ExitCode)
  }
} catch {
  Write-Output ('HATA: ' + $_.Exception.Message)
} finally {
  Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue
}
`;

const CHOCO_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$target = Join-Path $env:TEMP 'ParsSistemYoneticisi_choco_install.ps1'
function Test-Choco {
  if (Get-Command choco.exe -ErrorAction SilentlyContinue) { return $true }
  $candidate = Join-Path $env:ProgramData 'chocolatey\bin\choco.exe'
  return (Test-Path -LiteralPath $candidate)
}
try {
  if (Test-Choco) { Write-Output 'OK'; return }
  Write-Output 'Chocolatey kurulum betiği indiriliyor...'
  Invoke-WebRequest -Uri 'https://community.chocolatey.org/install.ps1' -OutFile $target -UseBasicParsing -ErrorAction Stop
  & $target -ErrorAction Stop | Out-Null
  if (Test-Choco) { Write-Output 'OK' } else { throw 'choco.exe kurulum sonrası doğrulanamadı.' }
} catch {
  Write-Output ('HATA: ' + $_.Exception.Message)
} finally {
  Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue
}
`;

const SCOOP_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$target = Join-Path $env:TEMP 'ParsSistemYoneticisi_scoop_install.ps1'
$shim = Join-Path $env:USERPROFILE 'scoop\shims\scoop.cmd'
function Test-Scoop {
  if (Get-Command scoop.cmd -ErrorAction SilentlyContinue) { return $true }
  return (Test-Path -LiteralPath $shim)
}
try {
  if (Test-Scoop) { Write-Output 'OK'; return }
  $env:CI = 'true'
  Write-Output 'Scoop kurulum betiği indiriliyor...'
  Invoke-WebRequest -Uri 'https://get.scoop.sh' -OutFile $target -UseBasicParsing -ErrorAction Stop
  & $target -RunAsAdmin -ErrorAction Stop *>$null
  if (Test-Scoop) { Write-Output 'OK' } else { throw 'scoop.cmd kurulum sonrası doğrulanamadı.' }
} catch {
  Write-Output ('HATA: ' + $_.Exception.Message)
} finally {
  Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue
}
`;

const NPM_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
function Test-Npm {
  if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { return $true }
  $candidates = @()
  if ($env:ProgramFiles) { $candidates += (Join-Path $env:ProgramFiles 'nodejs\npm.cmd') }
  $programFilesX86 = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
  if ($programFilesX86) { $candidates += (Join-Path $programFilesX86 'nodejs\npm.cmd') }
  if ($env:LOCALAPPDATA) { $candidates += (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\npm.cmd') }
  foreach ($candidate in $candidates) { if (Test-Path -LiteralPath $candidate) { return $true } }
  return $false
}
try {
  if (Test-Npm) { Write-Output 'OK'; return }
  $base = 'https://nodejs.org/dist/latest/'
  Write-Output 'Node.js sürüm listesi alınıyor...'
  $sums = (Invoke-WebRequest -Uri ($base + 'SHASUMS256.txt') -UseBasicParsing -ErrorAction Stop).Content
  $line = ($sums -split '\r?\n') | Where-Object { $_ -match '\snode-v\d+\.\d+\.\d+-x64\.msi\s*$' } | Select-Object -First 1
  if (-not $line) { throw 'Node.js x64 MSI sürümü bulunamadı.' }
  $parts = $line -split '\s+', 2
  $expected = $parts[0]
  $file = $parts[1].Trim()
  $target = Join-Path $env:TEMP $file
  Write-Output ('Node.js indiriliyor: ' + $file)
  Invoke-WebRequest -Uri ($base + $file) -OutFile $target -UseBasicParsing -ErrorAction Stop
  $actual = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
  if ($actual -ine $expected) { throw 'Node.js MSI SHA-256 doğrulaması başarısız; kurulum yapılmadı.' }
  $signature = Get-AuthenticodeSignature -LiteralPath $target -ErrorAction Stop
  if ($signature.Status -ne 'Valid') { throw 'Node.js MSI imzası geçerli değil; kurulum yapılmadı.' }
  $process = Start-Process -FilePath 'msiexec.exe' -ArgumentList @('/i', ('"' + $target + '"'), '/qn', '/norestart') -Wait -PassThru
  if ($process.ExitCode -notin @(0, 3010)) { throw ('Node.js kurulum kodu: ' + $process.ExitCode) }
  if (-not (Test-Npm)) { throw 'npm kurulum sonrası doğrulanamadı.' }
  if ($process.ExitCode -eq 3010) { Write-Output 'OK_REBOOT' } else { Write-Output 'OK' }
} catch {
  Write-Output ('HATA: ' + $_.Exception.Message)
} finally {
  if ($target -and (Test-Path -LiteralPath $target)) { Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue }
}
`;

const MANAGER_SCRIPTS: Partial<Record<PrerequisiteId, string>> = {
  choco: CHOCO_SCRIPT,
  npm: NPM_SCRIPT,
  scoop: SCOOP_SCRIPT,
};

function managerFallbacks(): Record<Exclude<PrerequisiteId, 'winget' | 'powershell' | 'vcredist'>, string[]> {
  const home = process.env.USERPROFILE || '';
  const programData = process.env.PROGRAMDATA || 'C:\\ProgramData';
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  return {
    choco: [path.join(programData, 'chocolatey', 'bin', 'choco.exe')],
    npm: [
      path.join(programFiles, 'nodejs', 'npm.cmd'),
      path.join(programFilesX86, 'nodejs', 'npm.cmd'),
      path.join(local, 'Programs', 'nodejs', 'npm.cmd'),
    ],
    scoop: [path.join(home, 'scoop', 'shims', 'scoop.cmd')],
  };
}

/** Paket yöneticisini PATH veya bilinen kurulum konumlarından tespit eder. */
export async function probeManager(source: 'choco' | 'npm' | 'scoop'): Promise<{ available: boolean; version: string }> {
  const commands = { choco: 'choco', npm: 'npm.cmd', scoop: 'scoop.cmd' };
  for (const candidate of commandCandidates(commands[source], managerFallbacks()[source])) {
    try {
      const result = await runCommand(candidate, ['--version'], undefined, 20_000);
      const version = result.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)[0] || '';
      if (result.code === 0 && version) return { available: true, version: version.slice(0, 80) };
    } catch {
      // Sıradaki aday denenir.
    }
  }
  return { available: false, version: '' };
}

export async function scanPrerequisites(): Promise<Prerequisite[]> {
  const [wingetResult, powershellResult, vcResult, chocoResult, npmResult, scoopResult] = await Promise.all([
    winget.version().catch(() => ({ available: false, version: 'denetlenemedi' })),
    runPowerShell('[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n[System.Version]$v = $PSVersionTable.PSVersion; $v.ToString()', undefined, 30_000)
      .then((result) => result.lines.find((line) => /^\d+\.\d+/.test(line.trim()))?.trim() || 'bilinmiyor')
      .catch(() => 'bilinmiyor'),
    runPowerShell(String.raw`
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$paths = @(
  'HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\X64',
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\X64'
)
$installed = $false
$version = ''
foreach ($p in $paths) {
  if (Test-Path -LiteralPath $p) {
    $item = Get-ItemProperty -LiteralPath $p -ErrorAction SilentlyContinue
    if ($item -and [int]$item.Installed -eq 1) { $installed = $true; $version = [string]$item.Version; break }
  }
}
@{ installed = $installed; version = $version } | ConvertTo-Json -Compress
`, undefined, 30_000)
      .then((result) => parsePowerShellJson<{ installed?: boolean; version?: string }>(result.text))
      .catch(() => ({ installed: false, version: '' })),
    probeManager('choco'),
    probeManager('npm'),
    probeManager('scoop'),
  ]);

  const psMajor = Number(powershellResult.split('.')[0]) || 0;
  const managerRows: Prerequisite[] = [
    {
      id: 'choco', name: 'Chocolatey', description: 'Toplu ve sessiz uygulama kurulumları için paket yöneticisi.',
      required: false, installed: chocoResult.available, version: chocoResult.version, installable: true, bundled: false,
      message: chocoResult.available ? 'Kurulu.' : 'Kurulu değil; resmi kurulum betiğiyle arka planda kurulabilir.',
    },
    {
      id: 'npm', name: 'npm (Node.js)', description: 'Node.js tabanlı araçların kurulması için gerekir.',
      required: false, installed: npmResult.available, version: npmResult.version, installable: true, bundled: false,
      message: npmResult.available ? 'Kurulu.' : 'Kurulu değil; Node.js LTS MSI imza/SHA-256 doğrulamalı kurulabilir.',
    },
    {
      id: 'scoop', name: 'Scoop', description: 'Kullanıcı alanında taşınabilir uygulama kurulumları için paket yöneticisi.',
      required: false, installed: scoopResult.available, version: scoopResult.version, installable: true, bundled: false,
      message: scoopResult.available ? 'Kurulu.' : 'Kurulu değil; resmi kurulum betiğiyle arka planda kurulabilir.',
    },
  ];

  return [
    {
      id: 'winget',
      name: 'winget (App Installer)',
      description: 'Uygulama kurma, kaldırma ve güncelleme işlemleri için gerekir.',
      required: true,
      installed: wingetResult.available,
      version: wingetResult.version,
      installable: true,
      bundled: true,
      message: wingetResult.available ? 'Kullanılabilir.' : 'Eksik; gömülü onarım betiğiyle kurulabilir.',
    },
    ...managerRows,
    {
      id: 'powershell',
      name: 'Windows PowerShell 5.1',
      description: 'Sistem denetimleri ve yedekleme işlemleri için gerekir.',
      required: true,
      installed: psMajor >= 5,
      version: powershellResult,
      installable: false,
      bundled: false,
      message: psMajor >= 5 ? 'Kullanılabilir.' : 'Windows 10/11 ile birlikte gelir; elle güncellenmelidir.',
    },
    {
      id: 'vcredist',
      name: 'Visual C++ 2015-2022 x64',
      description: 'Bazı kurulum paketleri ve yerel bileşenler için çalışma zamanı sağlar.',
      required: false,
      installed: Boolean(vcResult.installed),
      version: vcResult.version || '',
      installable: true,
      bundled: false,
      message: vcResult.installed ? 'Kurulu.' : 'Kurulu değil; Microsoft sitesinden indirilip sessizce kurulabilir.',
    },
  ];
}

export async function installPrerequisite(id: PrerequisiteId, onLine?: LogFn): Promise<PrereqActionResult> {
  if (id === 'powershell') {
    return { id, ok: false, message: 'PowerShell 5.1 otomatik kurulamaz; Windows güncellemelerini kullanın.' };
  }
  if (id === 'winget') {
    try {
      const script = fs.readFileSync(bundledScript('install-winget.ps1'), 'utf8');
      const result = await runPsFile(script, onLine);
      const parsed = parseResult(result.code, result.lines, 'winget kurulumu tamamlanamadı.');
      parsed.id = id;
      if (!parsed.ok) return parsed;
      const check = await winget.version();
      return check.available
        ? { id, ok: true, message: 'winget kuruldu ve doğrulandı.' }
        : { id, ok: false, message: 'Kurulum tamamlandı ancak winget doğrulanamadı: ' + check.version };
    } catch (error) {
      return { id, ok: false, message: (error as Error).message };
    }
  }
  const script = MANAGER_SCRIPTS[id] || VC_REDIST_SCRIPT;
  try {
    const result = await runPsFile(script, onLine, 15 * 60 * 1000);
    const parsed = parseResult(result.code, result.lines, 'Bileşen kurulumu tamamlanamadı.');
    const rebootMessage = parsed.rebootRequired ? 'Kuruldu; yeniden başlatma gerekiyor.' : 'Kuruldu ve doğrulandı.';
    return { ...parsed, id, message: parsed.ok ? rebootMessage : parsed.message };
  } catch (error) {
    return { id, ok: false, message: (error as Error).message };
  }
}

/** Kurumsal sessiz mod: yalnızca eksik paket yöneticilerini, onaysız ve arka planda kurar. */
export async function installMissingManagers(onLine?: LogFn): Promise<PrereqActionResult[]> {
  const list = await scanPrerequisites();
  const missing = list.filter((item) => MANAGER_IDS.includes(item.id) && item.installable && !item.installed);
  const results: PrereqActionResult[] = [];
  for (const item of missing) {
    onLine?.(`Kurumsal sessiz kurulum: ${item.name}`);
    results.push(await installPrerequisite(item.id, onLine));
  }
  return results;
}
