import { app, dialog, BrowserWindow } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  buildRegFile,
  MANAGED_POLICY_FIXES,
  type ManagedPolicyFixDefinition,
  type ManagedPolicyFixId,
} from '../../shared/managedPolicy';
import type { ManagedPolicyApplyResult, ManagedPolicyFile, ManagedPolicySaveResult } from '../../shared/types';
import { powershellJson, psLiteral, runCommand } from '../util';

const CHECK_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$keys = __KEYS__
$roots = @{
  'HKCU' = [Microsoft.Win32.RegistryHive]::CurrentUser
  'HKLM' = [Microsoft.Win32.RegistryHive]::LocalMachine
}
$views = @(
  @{ name = '64'; value = [Microsoft.Win32.RegistryView]::Registry64 }
  @{ name = '32'; value = [Microsoft.Win32.RegistryView]::Registry32 }
)
$found = New-Object System.Collections.Generic.List[object]
foreach ($entry in $keys) {
  $parts = $entry -split '\\', 2
  if ($parts.Count -ne 2) { continue }
  $hiveName = $parts[0]
  $subKey = $parts[1]
  if (-not $roots.ContainsKey($hiveName)) { continue }
  foreach ($view in $views) {
    try {
      $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($roots[$hiveName], $view.value)
      $key = $base.OpenSubKey($subKey)
      if ($null -ne $key) {
        $found.Add([pscustomobject]@{ key = $entry; view = $view.name })
        $key.Close()
      }
      $base.Close()
    } catch { }
  }
}
[pscustomobject]@{ keys = $found.ToArray() } | ConvertTo-Json -Depth 3 -Compress
`;

function definition(id: ManagedPolicyFixId): ManagedPolicyFixDefinition {
  const fix = MANAGED_POLICY_FIXES.find((item) => item.id === id);
  if (!fix) throw new Error('Bilinmeyen .reg dosyası.');
  return fix;
}

function sourcePath(fix: ManagedPolicyFixDefinition): string {
  const packaged = path.join(process.resourcesPath, 'regfix', fix.fileName);
  if (fs.existsSync(packaged)) return packaged;
  return path.join(app.getAppPath(), 'build', 'regfix', fix.fileName);
}

function backupFolder(): string {
  return path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'ParsSistemYoneticisi', 'registry_backups');
}

function fullKey(key: string): string {
  return key
    .replace(/^HKCU\\/i, 'HKEY_CURRENT_USER\\')
    .replace(/^HKLM\\/i, 'HKEY_LOCAL_MACHINE\\');
}

async function existingKeys(keys: string[]): Promise<Array<{ key: string; view: string }>> {
  const script = CHECK_SCRIPT.replace('__KEYS__', `@(${keys.map(psLiteral).join(', ')})`);
  const result = await powershellJson<{ keys?: Array<{ key: string; view: string }> }>(script, undefined, 60_000);
  return Array.isArray(result.keys) ? result.keys : [];
}

export function managedPolicyFiles(): ManagedPolicyFile[] {
  return MANAGED_POLICY_FIXES.map((fix) => {
    let content = buildRegFile(fix);
    let bundled = false;
    try {
      content = fs.readFileSync(sourcePath(fix), 'utf8');
      bundled = true;
    } catch {
      // Paketlenmemişse tanımdan üretilen içerik kullanılır.
    }
    return { ...fix, content, bundled };
  });
}

export async function saveManagedPolicyFile(id: ManagedPolicyFixId): Promise<ManagedPolicySaveResult> {
  const fix = definition(id);
  const options = {
    title: fix.fileName,
    defaultPath: path.join(app.getPath('documents'), fix.fileName),
    filters: [{ name: 'Registry dosyası', extensions: ['reg'] }],
  };
  const parent = BrowserWindow.getFocusedWindow();
  const result = parent ? await dialog.showSaveDialog(parent, options) : await dialog.showSaveDialog(options);
  if (result.canceled || !result.filePath) return { ok: false, message: 'Kaydetme iptal edildi.' };
  try {
    fs.copyFileSync(sourcePath(fix), result.filePath);
    return { ok: true, message: `Dosya kaydedildi: ${result.filePath}`, path: result.filePath };
  } catch (error) {
    return { ok: false, message: `Dosya kaydedilemedi: ${(error as Error).message}` };
  }
}

/** Yedek almadan hiçbir ilke anahtarına dokunmaz; yedek başarısızsa işlem iptal edilir. */
export async function applyManagedPolicyFile(id: ManagedPolicyFixId): Promise<ManagedPolicyApplyResult> {
  const fix = definition(id);
  const folder = backupFolder();
  const empty: ManagedPolicyApplyResult = {
    ok: false,
    message: '',
    applied: false,
    backupFolder: folder,
    backups: 0,
  };

  const targets = await existingKeys(fix.keys);
  if (!targets.length) {
    return { ...empty, ok: true, message: 'Bu dosyadaki ilke anahtarları zaten yok; değişiklik gerekmedi.' };
  }

  try {
    fs.mkdirSync(folder, { recursive: true });
  } catch (error) {
    return { ...empty, message: `Yedek klasörü oluşturulamadı: ${(error as Error).message}. Değişiklik yapılmadı.` };
  }

  const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  for (const target of targets) {
    const safe = target.key.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 90);
    const backup = path.join(folder, `managed_${fix.id}_${target.view}_${safe}_${stamp}.reg`);
    const args = ['export', fullKey(target.key), backup, '/y'];
    args.push(target.view === '32' ? '/reg:32' : '/reg:64');
    const result = await runCommand('reg.exe', args, undefined, 30_000);
    let saved = false;
    try { saved = fs.existsSync(backup) && fs.statSync(backup).size > 0; } catch { saved = false; }
    if (result.code !== 0 || !saved) {
      return {
        ...empty,
        message: 'Yedek alınamadı; hiçbir ilke anahtarı silinmedi. Yedek klasörünü kontrol edin.',
      };
    }
  }

  const regFile = sourcePath(fix);
  const errors: string[] = [];
  for (const view of ['64', '32']) {
    const args = ['import', regFile];
    args.push(view === '32' ? '/reg:32' : '/reg:64');
    const result = await runCommand('reg.exe', args, undefined, 60_000);
    if (result.code !== 0) errors.push(`${view}-bit: ${result.stderr.trim() || result.text.trim()}`);
  }

  const remaining = await existingKeys(fix.keys);
  if (remaining.length) {
    return {
      ...empty,
      applied: true,
      backups: targets.length,
      message: `Bazı ilke anahtarları hâlâ mevcut (${remaining.length}). Yönetici ilkeleri yeniden uygulamış olabilir. Yedekler: ${folder}`,
    };
  }
  if (errors.length) {
    return {
      ...empty,
      ok: false,
      applied: true,
      backups: targets.length,
      message: `İçe aktarma sırasında hata oluştu: ${errors.join(' | ')}. Yedekler: ${folder}`,
    };
  }

  return {
    ok: true,
    applied: true,
    backups: targets.length,
    backupFolder: folder,
    message: `${targets.length} ilke anahtarı kaldırıldı. Yedekler: ${folder}`,
  };
}

export function managedPolicyBackupFolder(): string {
  return backupFolder();
}
