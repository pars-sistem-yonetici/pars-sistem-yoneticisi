import { app } from 'electron';
import os from 'os';
import { detectPlatform, getCapabilities } from '../shared/platform';
import type { PosixAuditReport } from '../shared/types';
import { isInside } from './ipc-guard';
import { invokeForSmoke, registerIpc } from './main';
import { parseOutdated } from './services/brew';
import { parseDesktopEntry, parseLaunchctl, parseLsof, parseSs, parseSystemdUnits } from './services/posix-audit';

/**
 * macOS/Linux runner'larda çalışan IPC smoke testi. Gerçek pencere açmadan
 * handler'ları kaydeder; salt-okunur kanalların çalıştığını ve yazma kanallarının
 * renderer'dan gelse bile reddedildiğini doğrular.
 */

const failures: string[] = [];

function check(name: string, ok: boolean, detail = ''): void {
  const status = ok ? 'OK  ' : 'FAIL';
  console.log(`[smoke] ${status} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
}

async function mustReject(name: string, channel: string, ...args: unknown[]): Promise<void> {
  try {
    await invokeForSmoke(channel, ...args);
    check(name, false, 'kanal beklenmedik şekilde kabul edildi');
  } catch (error) {
    check(name, true, (error as Error).message.slice(0, 120));
  }
}

function capCheck(): void {
  const kind = detectPlatform(process.platform);
  const capabilities = getCapabilities(kind);
  check('platform macOS/Linux', kind === 'macos' || kind === 'linux', String(process.platform));
  check('yazma işlemleri kapalı', capabilities.allowWriteActions === false);
  check('kendini güncelleme kapalı', capabilities.allowSelfUpdate === false);
  check('registry sekmesi gizli', !capabilities.tabs.includes('registry'));
  check('Defender motoru yok', !capabilities.malwareEngines.includes('defender'));
  check('POSIX denetim sekmesi açık', capabilities.tabs.includes('posixaudit'));
  if (kind === 'linux') {
    check(
      'Linux paket kaynakları',
      ['npm', 'apt', 'dnf', 'pacman', 'flatpak', 'snap'].every((source) =>
        capabilities.packageSources.includes(source as typeof capabilities.packageSources[number]),
      ),
      capabilities.packageSources.join(', '),
    );
  } else {
    check('Homebrew POSIX kaynağı', capabilities.packageSources.includes('brew'));
  }
}

function guardCheck(): void {
  check('isInside pozitif', isInside('/Users/test/Downloads/a.txt', '/Users/test/Downloads'));
  check('isInside negatif', !isInside('/etc/passwd', '/Users/test/Downloads'));
  check('isInside path traversal', !isInside('/Users/test/Downloads/../etc/passwd', '/Users/test/Downloads'));
  const rows = parseOutdated(JSON.stringify({
    formulae: [{ name: 'curl', installed_versions: ['8.0'], current_version: '8.1' }],
    casks: [],
  }));
  check('brew JSON ayrıştırma', rows.length === 1 && rows[0].ident === 'curl' && rows[0].available === '8.1');
  check('launchctl ayrıştırma', parseLaunchctl('PID\tStatus\tLabel\n123\t0\tcom.example.app').some((item) => item.status === 'running'));
  check('systemd ayrıştırma', parseSystemdUnits('UNIT LOAD ACTIVE SUB DESCRIPTION\nx.service loaded active running Example').some((item) => item.status === 'running'));
  check('ss loopback filtresi', parseSs('State Recv-Q Send-Q Local Peer\nESTAB 0 0 127.0.0.1:1 127.0.0.1:2').length === 0);
  check('ss uzak adres', parseSs('State Recv-Q Send-Q Local Peer Process\nESTAB 0 0 192.0.2.1:400 198.51.100.2:443 users:(("x"))')
    .some((item) => item.label === '192.0.2.1:400' && item.detail.includes('198.51.100.2:443')));
  check('desktop.disabled algılandı', parseDesktopEntry('x.desktop.disabled', '/home/u/.config/autostart/x.desktop.disabled', '[Desktop Entry]\nName=X\nExec=x').status === 'disabled');
  check('lsof ayrıştırma', parseLsof('p42\nn1.2.3.4:443->5.6.7.8:1234').some((item) => item.detail.includes('42')));
}

async function ipcCheck(): Promise<void> {
  registerIpc();

  const snapshot = await invokeForSmoke('system:snapshot', os.homedir()) as { diskPath?: string };
  check('system:snapshot salt okunur', typeof snapshot?.diskPath === 'string', snapshot?.diskPath || 'boş');

  const drives = await invokeForSmoke('system:drives') as string[];
  check('system:drives kök sürücü', Array.isArray(drives) && drives.includes('/'), drives.join(', '));

  const labels = await invokeForSmoke('system:drive-labels') as Record<string, string>;
  check('system:drive-labels', Boolean(labels && labels['/']), labels?.['/'] || 'boş');

  const audit = await invokeForSmoke('posix:audit') as PosixAuditReport;
  check('POSIX denetim raporu', audit?.sections?.length === 8 && audit.sections.every((item) => Array.isArray(item.rows)),
    `${audit?.platform || '?'} · ${audit?.sections?.length ?? 0} bölüm`);

  const scan = await invokeForSmoke('malware:scan', ['hosts', 'signatures'], `smoke-${Date.now()}`) as {
    findings?: unknown[];
    scanned?: Record<string, number>;
  };
  check('malware:scan POSIX', Array.isArray(scan?.findings) && Boolean(scan?.scanned?.hosts !== undefined),
    `bulgu=${scan?.findings?.length ?? '?'}`);

  await mustReject('malware:scan defender reddi', 'malware:scan', ['defender'], 'smoke-defender');
  await mustReject('updates:list winget reddi', 'updates:list', 'winget');
  await mustReject('winget:install yazma reddi', 'winget:install', 'curl', true);
  await mustReject('registry:scan yazma reddi', 'registry:scan');
  await mustReject('files:delete yazma reddi', 'files:delete', [], [], 'permanent');
  const malwareWriteTarget = [{ id: 'x', path: '/tmp/ornek.exe', engine: 'signatures', title: 'test' }];
  await mustReject('malware:quarantine yazma reddi', 'malware:quarantine', malwareWriteTarget);
  await mustReject('malware:quarantine-restore yazma reddi', 'malware:quarantine-restore', ['x']);
  await mustReject('malware:quarantine-delete yazma reddi', 'malware:quarantine-delete', ['x']);
  await mustReject('malware:delete-files yazma reddi', 'malware:delete-files', malwareWriteTarget);
  await mustReject('update:check yazma reddi', 'update:check');
  await mustReject('schedule:save yazma reddi', 'schedule:save', []);
  await mustReject('prereq:scan yazma reddi', 'prereq:scan');
}

app.whenReady().then(async () => {
  capCheck();
  guardCheck();
  try {
    await ipcCheck();
  } catch (error) {
    check('IPC çağrıları', false, (error as Error).message);
  }
  console.log(`[smoke] ${failures.length ? `FAILED (${failures.length})` : 'PASSED'}`);
  app.exit(failures.length ? 1 : 0);
}).catch((error: Error) => {
  console.error('[smoke] başlatma hatası:', error);
  app.exit(1);
});
