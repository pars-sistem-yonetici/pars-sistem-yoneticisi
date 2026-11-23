import fs from 'fs';
import os from 'os';
import path from 'path';
import { runCommand } from '../util';

const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';

function backupFolder(): string {
  return path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'ParsSistemYoneticisi', 'registry_backups');
}

async function invoke(args: string[]): Promise<boolean> {
  try {
    const result = await runCommand('reg.exe', args, undefined, 15_000);
    return result.code === 0;
  } catch {
    return false;
  }
}

async function exists(name: string): Promise<boolean> {
  return invoke(['query', RUN_KEY, '/v', name]);
}

async function backup(): Promise<boolean> {
  try {
    fs.mkdirSync(backupFolder(), { recursive: true });
  } catch {
    return false;
  }
  const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const file = path.join(backupFolder(), `login-items_${stamp}.reg`);
  if (!await invoke(['export', RUN_KEY, file, '/y'])) return false;
  try { return fs.existsSync(file) && fs.statSync(file).size > 0; } catch { return false; }
}

/** Yalnızca gerçekten var olan kayıtlar için tek bir yedek alır, sonra siler. */
export async function removeItems(names: string[]): Promise<void> {
  const present: string[] = [];
  for (const name of names) {
    if (await exists(name)) present.push(name);
  }
  if (!present.length) return;
  if (!await backup()) return; // Yedek alınamadıysa hiçbir başlangıç kaydı silinmez.
  for (const name of present) {
    await invoke(['delete', RUN_KEY, '/v', name, '/f']);
  }
}

/** Portable exe için Run kaydı; app.setLoginItemSettings temp klasörünü yazdığı için elle yazılır. */
export async function setItem(name: string, command: string[]): Promise<void> {
  const [executable, ...args] = command;
  const quoted = `"${executable.replace(/"/g, '')}"${args.length ? ` ${args.join(' ')}` : ''}`;
  await invoke(['add', RUN_KEY, '/v', name, '/t', 'REG_SZ', '/d', quoted, '/f']);
}
