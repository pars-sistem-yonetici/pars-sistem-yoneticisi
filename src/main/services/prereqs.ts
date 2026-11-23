import fs from 'fs';
import os from 'os';
import path from 'path';
import type { PrereqActionResult, Prerequisite, PrerequisiteId } from '../../shared/types';
import { LogFn, parsePowerShellJson, runCommand, runPowerShell } from '../util';
import * as winget from './winget';

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

export async function scanPrerequisites(): Promise<Prerequisite[]> {
  const [wingetResult, powershellResult, vcResult] = await Promise.all([
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
  ]);

  const psMajor = Number(powershellResult.split('.')[0]) || 0;

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
  try {
    const result = await runPsFile(VC_REDIST_SCRIPT, onLine);
    const parsed = parseResult(result.code, result.lines, 'Visual C++ kurulumu tamamlanamadı.');
    return { ...parsed, id, message: parsed.ok ? (parsed.rebootRequired ? 'Kuruldu; yeniden başlatma gerekiyor.' : 'Kuruldu.') : parsed.message };
  } catch (error) {
    return { id, ok: false, message: (error as Error).message };
  }
}
