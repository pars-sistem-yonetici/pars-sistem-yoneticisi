import type { ContextMenuActionResult, ContextMenuStatus, ContextMenuStyle } from '../../shared/types';
import { LogFn, runCommand } from '../util';
import { m, mf } from '../i18n-main';

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
  onLine?.(m('Windows Gezgini kapatılıyor…', 'Closing Windows Explorer…'));
  const kill = await runCommand('cmd.exe', ['/c', 'taskkill /f /im explorer.exe'], onLine, 30_000);
  const notRunning = /not found|bulunamad|no process/i.test(`${kill.text} ${kill.stderr}`);
  onLine?.(m('Windows Gezgini yeniden başlatılıyor…', 'Restarting Windows Explorer…'));
  const start = await runCommand('cmd.exe', ['/c', 'start "" explorer.exe'], onLine, 30_000);
  return start.code === 0 || (kill.code === 0 && notRunning);
}

/** HKCU anahtarını değiştirir, ardından Gezgin'i yeniden başlatır. */
export async function setContextMenuStyle(
  style: ContextMenuStyle,
  onLine?: LogFn,
): Promise<ContextMenuActionResult> {
  const command = style === 'windows10' ? REG_ADD_WIN10 : REG_DELETE_WIN11;
  onLine?.(mf('Komut çalıştırılıyor: {command}', 'Running command: {command}', { command }));
  const result = await runCommand('cmd.exe', ['/c', command], onLine, 30_000);
  const combined = `${result.text} ${result.stderr}`;
  const alreadyAbsent = style === 'windows11' && /unable to find the specified registry key|belirtilen kayıt defteri anahtarı/i.test(combined);

  if (result.code !== 0 && !alreadyAbsent) {
    return {
      style,
      ok: false,
      message: result.stderr.trim() || result.text.trim() || m('Kayıt defteri işlemi başarısız oldu.', 'The registry operation failed.'),
      explorerRestarted: false,
    };
  }

  const explorerRestarted = await restartExplorer(onLine);
  const status = await contextMenuStatus();
  const ok = status.style === style;
  const label = style === 'windows10' ? 'Windows 10' : 'Windows 11';
  return {
    style: status.style,
    ok,
    explorerRestarted,
    message: ok
      ? explorerRestarted
        ? mf('{label} sağ tık menüsü etkin. Windows Gezgini yeniden başlatıldı.', '{label} right-click menu is active. Windows Explorer was restarted.', { label })
        : mf('{label} sağ tık menüsü etkin. Windows Gezgini yeniden başlatılamadı; oturumu kapatıp açın.', '{label} right-click menu is active. Windows Explorer could not be restarted; sign out and back in.', { label })
      : m('Kayıt defteri değişikliği doğrulanamadı.', 'The registry change could not be verified.'),
  };
}
