import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type { PrivacyActionResult, PrivacyTweak } from '../../shared/types';
import { LogFn, powershellJson, psLiteral, runPowerShell } from '../util';

interface TweakDefinition {
  id: string;
  title: string;
  description: string;
  category: PrivacyTweak['category'];
  hive: 'HKCU' | 'HKLM';
  location: string;
  name: string;
  value: string;
}

/** Yalnızca tersine çevrilebilir, iyi bilinen ayarlar; tümü tek değer değiştirir. */
const DEFINITIONS: TweakDefinition[] = [
  {
    id: 'telemetry',
    title: 'Telemetriyi en aza indir',
    description: 'Windows tanılama verisi gönderimini temel düzeye çeker (HKLM ilke ayarı, yönetici gerektirir).',
    category: 'telemetry',
    hive: 'HKLM',
    location: 'SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection',
    name: 'AllowTelemetry',
    value: '1',
  },
  {
    id: 'advertising',
    title: 'Reklam kimliğini kapat',
    description: 'Uygulamaların kişiselleştirilmiş reklam için reklam kimliğini kullanmasını engeller.',
    category: 'privacy',
    hive: 'HKCU',
    location: 'Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo',
    name: 'Enabled',
    value: '0',
  },
  {
    id: 'web-search',
    title: 'Arama önerilerini kapat',
    description: 'Başlat menüsü aramasında web sonuçlarını ve Bing önerilerini gizler.',
    category: 'privacy',
    hive: 'HKCU',
    location: 'Software\\Microsoft\\Windows\\CurrentVersion\\Search',
    name: 'BingSearchEnabled',
    value: '0',
  },
  {
    id: 'widgets',
    title: 'Widget panelini kapat',
    description: 'Windows 11 görev çubuğundaki Widgets/Haberler düğmesini gizler.',
    category: 'interface',
    hive: 'HKCU',
    location: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced',
    name: 'TaskbarDa',
    value: '0',
  },
  {
    id: 'news',
    title: 'Haber ve ilgi alanlarını kapat',
    description: 'Görev çubuğundaki haber akışını devre dışı bırakır.',
    category: 'interface',
    hive: 'HKCU',
    location: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced',
    name: 'ShowNewsAndInterests',
    value: '0',
  },
  {
    id: 'extensions',
    title: 'Dosya uzantılarını göster',
    description: 'Bilinen dosya türlerinin uzantılarını gizlemeyi kaldırır; zararlı çift uzantıları görünür kılar.',
    category: 'interface',
    hive: 'HKCU',
    location: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced',
    name: 'HideFileExt',
    value: '0',
  },
  {
    id: 'hidden',
    title: 'Gizli dosyaları göster',
    description: 'Gizli dosya ve klasörleri Gezgin’de görünür yapar.',
    category: 'interface',
    hive: 'HKCU',
    location: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced',
    name: 'Hidden',
    value: '1',
  },
];

function definition(id: string): TweakDefinition {
  const found = DEFINITIONS.find((item) => item.id === id);
  if (!found) throw new Error('Bilinmeyen gizlilik ayarı.');
  return found;
}

function backupFolder(): string {
  return path.join(app.getPath('userData'), 'privacy_backups');
}

function readRows(): string {
  return DEFINITIONS.map((item) =>
    `  [pscustomobject]@{ id = ${psLiteral(item.id)}; value = Get-RegistryValue ${psLiteral(item.hive)} ${psLiteral(item.location)} ${psLiteral(item.name)} },`).join('\n').replace(/,$/, '');
}

export async function listPrivacy(): Promise<PrivacyTweak[]> {
  const script = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
function Get-RegistryValue([string]$hiveName, [string]$subPath, [string]$valueName) {
  try {
    $hive = $(if ($hiveName -eq 'HKLM') { [Microsoft.Win32.RegistryHive]::LocalMachine } else { [Microsoft.Win32.RegistryHive]::CurrentUser })
    $key = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive, [Microsoft.Win32.RegistryView]::Registry64)
    $sub = $key.OpenSubKey($subPath)
    if (-not $sub) { return '' }
    $value = $sub.GetValue($valueName, $null)
    $sub.Close(); $key.Close()
    if ($null -eq $value) { return '' }
    return [string]$value
  } catch { return '' }
}
$rows = @(
${readRows()}
)
[pscustomobject]@{ rows = @($rows) } | ConvertTo-Json -Depth 4 -Compress
`;
  try {
    const parsed = await powershellJson<{ rows?: Array<{ id: string; value: string }> | { id: string; value: string } }>(script, undefined, 60_000);
    const raw = parsed?.rows;
    const rows = !raw ? [] : Array.isArray(raw) ? raw : [raw];
    const byId = new Map(rows.map((row) => [row.id, String(row.value ?? '')]));
    return DEFINITIONS.map((item) => {
      const current = byId.get(item.id) ?? '';
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        category: item.category,
        hive: item.hive,
        location: item.location,
        name: item.name,
        value: item.value,
        current,
        applied: current === item.value,
        admin: item.hive === 'HKLM',
      };
    });
  } catch {
    return DEFINITIONS.map((item) => ({
      ...item, current: '', applied: false, admin: item.hive === 'HKLM',
    }));
  }
}

function backupRegistry(def: TweakDefinition, stamp: string): string {
  const folder = backupFolder();
  fs.mkdirSync(folder, { recursive: true });
  const target = `${def.hive}\\${def.location}`;
  const regFile = path.join(folder, `${def.id}_${stamp}.reg`);
  const exportResult = spawnSync('reg.exe', ['export', target, regFile, '/y'], { windowsHide: true });
  if (exportResult.status !== 0 || !fs.existsSync(regFile)) throw new Error('Kayıt defteri yedeği alınamadı; değişiklik yapılmadı.');
  return regFile;
}

/** Ayarı uygular veya özgün değerine döndürür; her iki durumda da .reg yedeği alınır. */
export async function setPrivacy(tweak: PrivacyTweak, apply: boolean, onLine?: LogFn): Promise<PrivacyActionResult> {
  const def = definition(tweak.id);
  const folder = backupFolder();
  try { fs.mkdirSync(folder, { recursive: true }); } catch { /* ignore */ }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const metaFile = path.join(folder, `${def.id}_${stamp}.json`);
  let backupPath = '';
  try {
    backupPath = backupRegistry(def, stamp);
    let targetValue = def.value;
    if (!apply) {
      // Son uygulama öncesindeki değeri geri getirir; hiç yoksa değeri siler.
      const previous = fs.readdirSync(folder)
        .filter((name) => name.startsWith(`${def.id}_`) && name.endsWith('.json'))
        .sort()
        .pop();
      if (previous) {
        const meta = JSON.parse(fs.readFileSync(path.join(folder, previous), 'utf8')) as { original?: string };
        targetValue = meta.original ?? '';
      } else {
        targetValue = tweak.current || '';
      }
    } else {
      fs.writeFileSync(metaFile, JSON.stringify({ original: tweak.current, at: new Date().toISOString() }, null, 2), 'utf8');
    }

    const hivePath = `HKEY_${def.hive === 'HKLM' ? 'LOCAL_MACHINE' : 'CURRENT_USER'}\\${def.location}`;
    const script = targetValue
      ? `New-Item -Path 'Registry::${hivePath.replace(/'/g, "''")}' -Force | Out-Null\nSet-ItemProperty -Path 'Registry::${hivePath.replace(/'/g, "''")}' -Name ${psLiteral(def.name)} -Value ${psLiteral(targetValue)} -Type String -ErrorAction Stop\n'PRIVACY_OK'`
      : `Remove-ItemProperty -Path 'Registry::${hivePath.replace(/'/g, "''")}' -Name ${psLiteral(def.name)} -ErrorAction SilentlyContinue\n'PRIVACY_OK'`;
    const result = await runPowerShell(script, onLine, 60_000);
    if (result.code !== 0 || !result.text.includes('PRIVACY_OK')) {
      throw new Error((result.stderr || result.text || 'Ayar yazılamadı.').slice(-300));
    }
    if (!apply) {
      try { if (fs.existsSync(metaFile)) fs.unlinkSync(metaFile); } catch { /* ignore */ }
    }
    return {
      id: def.id,
      ok: true,
      applied: apply,
      current: targetValue,
      backupPath,
      message: apply ? 'Ayar uygulandı.' : 'Özgün ayar geri yüklendi.',
    };
  } catch (error) {
    return {
      id: def.id,
      ok: false,
      applied: !apply,
      current: tweak.current,
      backupPath,
      message: (error as Error).message.slice(0, 300),
    };
  }
}

/** Yalnızca test/doğrulama için kullanılır. */
export function privacyDefinitionCount(): number {
  return DEFINITIONS.length;
}
