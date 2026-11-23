import type { ContextMenuActionResult, ContextMenuStatus, ContextMenuStyle } from '../../shared/types';
import { LogFn, runCommand } from '../util';

const CLASSIC_KEY = 'HKCU\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}';
const INPROC_KEY = `${CLASSIC_KEY}\\InprocServer32`;

const REG_ADD_WIN10 = `reg add "${INPROC_KEY}" /f /ve`;
const REG_DELETE_WIN11 = `reg delete "${CLASSIC_KEY}" /f`;

/** Kayıt defterinden mevcut menü stilini okur. */
export async function contextMenuStatus(): Promise<ContextMenuStatus> {
  const result = await runCommand('reg.exe', ['query', INPROC_KEY], undefined, 20_000);
  return { style: result.code === 0 ? 'windows10' : 'windows11', detected: true };
}

async function restartExplorer(onLine?: LogFn): Promise<boolean> {
  onLine?.('Windows Gezgini kapatılıyor…');
  const kill = await runCommand('cmd.exe', ['/c', 'taskkill /f /im explorer.exe'], onLine, 30_000);
  const notRunning = /not found|bulunamad|no process/i.test(`${kill.text} ${kill.stderr}`);
  onLine?.('Windows Gezgini yeniden başlatılıyor…');
  const start = await runCommand('cmd.exe', ['/c', 'start "" explorer.exe'], onLine, 30_000);
  return start.code === 0 || (kill.code === 0 && notRunning);
}

/** HKCU anahtarını değiştirir, ardından Gezgin'i yeniden başlatır. */
export async function setContextMenuStyle(
  style: ContextMenuStyle,
  onLine?: LogFn,
): Promise<ContextMenuActionResult> {
  const command = style === 'windows10' ? REG_ADD_WIN10 : REG_DELETE_WIN11;
  onLine?.(`Komut çalıştırılıyor: ${command}`);
  const result = await runCommand('cmd.exe', ['/c', command], onLine, 30_000);
  const combined = `${result.text} ${result.stderr}`;
  const alreadyAbsent = style === 'windows11' && /unable to find the specified registry key|belirtilen kayıt defteri anahtarı/i.test(combined);

  if (result.code !== 0 && !alreadyAbsent) {
    return {
      style,
      ok: false,
      message: result.stderr.trim() || result.text.trim() || 'Kayıt defteri işlemi başarısız oldu.',
      explorerRestarted: false,
    };
  }

  const explorerRestarted = await restartExplorer(onLine);
  const status = await contextMenuStatus();
  const ok = status.style === style;
  return {
    style: status.style,
    ok,
    explorerRestarted,
    message: ok
      ? explorerRestarted
        ? `${style === 'windows10' ? 'Windows 10' : 'Windows 11'} sağ tık menüsü etkin. Windows Gezgini yeniden başlatıldı.`
        : `${style === 'windows10' ? 'Windows 10' : 'Windows 11'} sağ tık menüsü etkin. Windows Gezgini yeniden başlatılamadı; oturumu kapatıp açın.`
      : 'Kayıt defteri değişikliği doğrulanamadı.',
  };
}
