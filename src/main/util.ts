import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export type LogFn = (line: string) => void;

export interface CommandResult {
  code: number;
  lines: string[];
  text: string;
  stderr: string;
}

/** Komutu konsol penceresi açmadan çalıştırır, çıktıyı satır satır döndürür. */
export function runCommand(
  command: string,
  args: string[],
  onLine?: LogFn,
  timeout = 15 * 60 * 1000,
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // stdout ve stderr asla tek akışta birleştirilmez; aksi halde PowerShell
    // progress/CLIXML çıktısı JSON'un ortasına girebilir.
    // Baytları biriktirip en sonda bir kez çözümlüyoruz; parça parça UTF-8 çözümü
    // çok baytlı karakterlerin parça sınırına denk gelmesinde JSON'u bozuyor.
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        reject(new Error(`${command} zaman aşımına uğradı: ${args.join(' ')}`));
      }
    }, timeout);

    const collect = (chunk: Buffer, target: Buffer[]) => {
      target.push(chunk);
      if (!onLine) return;
      for (const raw of chunk.toString('utf8').split(/\r?\n/)) {
        const line = raw.replace(/\r$/, '');
        if (line) onLine(line);
      }
    };

    child.stdout?.on('data', (chunk: Buffer) => collect(chunk, stdoutChunks));
    child.stderr?.on('data', (chunk: Buffer) => collect(chunk, stderrChunks));
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`${command} başlatılamadı: ${error.message}`));
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const decode = (chunks: Buffer[]): string[] => {
        const text = Buffer.concat(chunks).toString('utf8');
        const result = text.split(/\r?\n/).map((line) => line.replace(/\r$/, ''));
        while (result.length && result[result.length - 1] === '') result.pop();
        return result;
      };
      const lines = decode(stdoutChunks);
      resolve({ code: code ?? -1, lines, text: lines.join('\n'), stderr: decode(stderrChunks).join('\n') });
    });
  });
}

/** PowerShell'i gizli, encoded komut olarak çalıştırır. */
export function runPowerShell(script: string, onLine?: LogFn, timeout?: number): Promise<CommandResult> {
  // Progress akışı CLIXML üretir ve stderr'e yazar; JSON çıktısını bozmasın.
  const wrapped = `$ProgressPreference = 'SilentlyContinue'\n[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n${script}`;
  const encoded = Buffer.from(wrapped, 'utf16le').toString('base64');
  return runCommand(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
    onLine,
    timeout,
  );
}

/** Metindeki ilk JSON nesnesini/dizisini dengeli olarak bulur (kuyruk CLIXML'ini yok sayar). */
function extractJson(text: string): string {
  const start = text.search(/[[{]/);
  if (start < 0) throw new Error(`PowerShell JSON döndürmedi: ${text.slice(0, 200)}`);

  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') { inString = true; continue; }
    if (char === '{' || char === '[') { stack.push(char); continue; }
    if (char === '}' || char === ']') {
      stack.pop();
      if (stack.length === 0) return text.slice(start, index + 1);
    }
  }
  throw new Error('PowerShell JSON çıktısı eksik veya bozuk.');
}

/** PowerShell çıktısındaki JSON nesnesini/dizisini ayrıştırır. */
export function parsePowerShellJson<T>(text: string): T {
  const raw = extractJson(text);
  // Ham kontrol karakterleri JSON string'inde yasaktır; kaçışlı (\n) diziler etkilenmez.
  const cleaned = raw.replace(/[\u0000-\u001F]/g, ' ');
  return JSON.parse(cleaned) as T;
}

export async function powershellJson<T>(script: string, onLine?: LogFn, timeout?: number): Promise<T> {
  const result = await runPowerShell(script, onLine, timeout);
  return parsePowerShellJson<T>(result.text);
}

export function humanSize(size: number): string {
  let value = size;
  for (const unit of ['B', 'KB', 'MB', 'GB', 'TB']) {
    if (value < 1024 || unit === 'TB') {
      return unit === 'B' ? `${Math.round(value)} ${unit}` : `${value.toFixed(1)} ${unit}`;
    }
    value /= 1024;
  }
  return `${value.toFixed(1)} TB`;
}

export function nowTime(): string {
  return new Date().toLocaleTimeString('tr-TR', { hour12: false });
}

/** Korumalı kök dizinlerin kendisinin silinmesini engeller. */
export function isProtectedPath(target: string): boolean {
  let resolved: string;
  try {
    resolved = path.resolve(target);
  } catch {
    return true;
  }
  const lower = resolved.toLowerCase().replace(/[\\/]+$/, '');
  const env = process.env;
  const home = path.resolve(env.USERPROFILE || path.join(env.HOME || '', 'Users', 'x'));
  const roots = [
    path.parse(resolved).root,
    env.WINDIR || 'C:\\Windows',
    env.ProgramFiles || 'C:\\Program Files',
    env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
    env.PROGRAMDATA || 'C:\\ProgramData',
    home,
    path.join(home, 'AppData'),
    path.join(home, 'Desktop'),
    env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'),
    env.APPDATA || path.join(home, 'AppData', 'Roaming'),
  ].map((item) => path.resolve(item).toLowerCase().replace(/[\\/]+$/, ''));

  if (roots.includes(lower)) return true;
  return resolved.split(path.sep).filter(Boolean).length < 3;
}

/** Uygulamanın kendi çalışma klasörü hiçbir zaman temizlenmez. */
export function isRuntimePath(target: string): boolean {
  const exeDir = path.dirname(process.execPath).toLowerCase();
  const resolved = path.resolve(target).toLowerCase();
  return (
    resolved.startsWith(exeDir) ||
    /(^|[\\])_mei[^\\]*[\\]/.test(resolved)
  );
}

/** Reparse point / sembolik bağlantıları atlamak için güvenli giriş kontrolü. */
export function isSafeEntry(entryPath: string, root: string): boolean {
  try {
    const stat = fs.lstatSync(entryPath);
    if (stat.isSymbolicLink()) return false;
    const resolved = path.resolve(entryPath).toLowerCase();
    const base = path.resolve(root).toLowerCase();
    if (resolved === base || !resolved.startsWith(base + path.sep.toLowerCase())) return false;
    if (isRuntimePath(entryPath) || isProtectedPath(entryPath)) return false;
    return true;
  } catch {
    return false;
  }
}

export function directorySize(target: string, limit = 100_000, shouldSkip?: (target: string) => boolean): number {
  let total = 0;
  let counted = 0;
  const stack = [target];
  while (stack.length) {
    const current = stack.pop();
    if (!current || shouldSkip?.(current)) continue;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      try {
        if (entry.isDirectory() && !entry.isSymbolicLink()) {
          stack.push(full);
        } else if (entry.isFile()) {
          if (shouldSkip?.(full)) continue;
          total += fs.statSync(full).size;
          counted += 1;
          if (counted >= limit) return total;
        }
      } catch {
        // Kilitli dosyalar atlanır.
      }
    }
  }
  return total;
}

/**
 * Bir klasörü, atlanması gereken alt yolları koruyarak siler.
 * shouldSkip true dönen dosya/klasörlere hiç dokunulmaz.
 */
export function removeTree(target: string, shouldSkip?: (target: string) => boolean, onLine?: LogFn): number {
  let freed = 0;
  const removeDir = (dir: string): void => {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (shouldSkip?.(full)) {
        onLine?.(`ATLANDI: ${full}`);
        continue;
      }
      try {
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          removeDir(full);
        } else if (entry.isFile()) {
          freed += fs.statSync(full).size;
          fs.rmSync(full, { force: true });
        }
      } catch {
        // Kilitli dosyalar atlanır.
      }
    }
    try { fs.rmdirSync(dir); } catch { /* içinde hariç tutulan öğe kalmış olabilir */ }
  };
  try {
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink() || shouldSkip?.(target)) return 0;
    if (stat.isDirectory()) removeDir(target);
    else { freed = stat.size; fs.rmSync(target, { force: true }); }
  } catch {
    return freed;
  }
  return freed;
}

export function expandVars(value: string): string {
  return value.replace(/%([^%]+)%/g, (_match, name: string) => process.env[name] || '');
}

export function normalizeName(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9çğıöşü]+/gi, '')
    .trim();
}
