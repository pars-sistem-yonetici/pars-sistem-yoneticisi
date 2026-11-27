import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { StringDecoder } from 'string_decoder';
import { detectPlatform } from '../shared/platform';
import { m, mf } from './i18n-main';

const platform = detectPlatform(process.platform);

export type LogFn = (line: string) => void;

export interface CommandResult {
  code: number;
  lines: string[];
  text: string;
  stderr: string;
}

function cmdArgument(value: string): string {
  if (/^[\w./:@+=-]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/** Komutu konsol penceresi açmadan çalıştırır, çıktıyı satır satır döndürür. */
export function runCommand(
  command: string,
  args: string[],
  onLine?: LogFn,
  timeout = 15 * 60 * 1000,
  signal?: AbortSignal,
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error(mf('{command} iptal edildi', '{command} was canceled', { command })));
      return;
    }
    // Node, Windows'ta .cmd/.bat dosyalarını doğrudan spawn edemiyor (EINVAL).
    // Kabuk gerektiren bu komutlar cmd.exe /c ile, diğerleri doğrudan çalıştırılır.
    const isBatch = /\.(?:cmd|bat)$/i.test(command);
    const child = isBatch
      ? spawn('cmd.exe', ['/d', '/s', '/c', `"${[cmdArgument(command), ...args.map(cmdArgument)].join(' ')}"`], {
        windowsHide: true,
        windowsVerbatimArguments: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      : spawn(command, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

    // stdout ve stderr asla tek akışta birleştirilmez; aksi halde PowerShell
    // progress/CLIXML çıktısı JSON'un ortasına girebilir.
    // Baytları biriktirip en sonda bir kez çözümlüyoruz; parça parça UTF-8 çözümü
    // çok baytlı karakterlerin parça sınırına denk gelmesinde JSON'u bozuyor.
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    // Paket yöneticileri ilerlemeyi genelde bare \r ile günceller; \r\n, \n ve
    // bare \r ayrımı yapılabilmesi için akış başına decoder + satır tamponu.
    const stdoutDecoder = new StringDecoder('utf8');
    const stderrDecoder = new StringDecoder('utf8');
    const stdoutPending: string[] = [];
    const stderrPending: string[] = [];
    let settled = false;
    const onAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      reject(new Error(mf('{command} iptal edildi', '{command} was canceled', { command })));
    };
    const cleanup = () => signal?.removeEventListener('abort', onAbort);
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        child.kill();
        reject(new Error(mf('{command} zaman aşımına uğradı: {args}', '{command} timed out: {args}', {
          command,
          args: args.join(' '),
        })));
      }
    }, timeout);
    if (signal) signal.addEventListener('abort', onAbort, { once: true });

    const flushLines = (text: string, pending: string[]) => {
      const parts = text.split(/\r\n|\n|\r/);
      for (let index = 0; index < parts.length - 1; index += 1) {
        const line = parts[index].trimEnd();
        if (line) onLine?.(line);
      }
      const remainder = parts[parts.length - 1];
      if (remainder) pending.push(remainder);
    };
    const collect = (chunk: Buffer, target: Buffer[], decoder: StringDecoder, pending: string[]) => {
      target.push(chunk);
      if (!onLine) return;
      flushLines(decoder.write(chunk), pending);
    };

    child.stdout?.on('data', (chunk: Buffer) => collect(chunk, stdoutChunks, stdoutDecoder, stdoutPending));
    child.stderr?.on('data', (chunk: Buffer) => collect(chunk, stderrChunks, stderrDecoder, stderrPending));
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      reject(new Error(mf('{command} başlatılamadı: {message}', '{command} could not be started: {message}', {
        command,
        message: error.message,
      })));
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      if (onLine) {
        flushLines(stdoutDecoder.end(), stdoutPending);
        flushLines(stderrDecoder.end(), stderrPending);
        for (const line of [...stdoutPending, ...stderrPending]) {
          if (line.trim()) onLine(line.trim());
        }
      }
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

/**
 * PowerShell tek tırnaklı literal üretir. Tek tırnak `''` olarak kaçışlanır;
 * `$`, backtick ve backslash olduğu gibi kalır. JSON.stringify PowerShell'de
 * güvenli değildir: `\"` dizeyi sonlandırır, `\\` ise çift backslash bırakır.
 */
export function psLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
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
  if (start < 0) throw new Error(mf('PowerShell JSON döndürmedi: {text}', 'PowerShell did not return JSON: {text}', { text: text.slice(0, 200) }));

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
  throw new Error(m('PowerShell JSON çıktısı eksik veya bozuk.', 'PowerShell JSON output is missing or malformed.'));
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
  const home = path.resolve(env.USERPROFILE || env.HOME || '');
  const roots = (platform === 'windows'
    ? [
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
    ]
    : [
      path.parse(resolved).root,
      '/System', '/usr', '/bin', '/sbin', '/etc', '/var', '/Library', '/Applications', '/opt', '/private',
      home,
      path.join(home, 'Library'),
      path.join(home, '.config'),
      path.join(home, 'Desktop'),
      path.join(home, 'Downloads'),
    ]).map((item) => path.resolve(item).toLowerCase().replace(/[\\/]+$/, ''));

  if (roots.includes(lower)) return true;
  return resolved.split(path.sep).filter(Boolean).length < (platform === 'windows' ? 3 : 2);
}

/** Uygulamanın kendi çalışma klasörü hiçbir zaman temizlenmez. */
export function isRuntimePath(target: string): boolean {
  const exeDir = path.dirname(process.execPath).toLowerCase();
  const resolved = path.resolve(target).toLowerCase();
  const parts = process.execPath.split(path.sep);
  const appIndex = parts.findIndex((part) => part.endsWith('.app'));
  const bundle = appIndex >= 0 ? parts.slice(0, appIndex + 1).join(path.sep).toLowerCase() : '';
  return (
    resolved.startsWith(exeDir) ||
    Boolean(bundle && (resolved === bundle || resolved.startsWith(bundle + path.sep.toLowerCase()))) ||
    /(^|[\\/])_mei[^\\/]*[\\/]/.test(resolved)
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
 * shouldSkip true dönen dosya/klasörlere hiç dokunulmaz. Korumalı kökler,
 * uygulamanın çalışma klasörü ve reparse point'ler her düzeyde tekrar denetlenir.
 */
export function removeTree(target: string, shouldSkip?: (target: string) => boolean, onLine?: LogFn): number {
  let freed = 0;
  const blocked = (targetPath: string): boolean =>
    Boolean(shouldSkip?.(targetPath) || isProtectedPath(targetPath) || isRuntimePath(targetPath));
  const removeDir = (dir: string): void => {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (blocked(full)) {
        onLine?.(mf('ATLANDI: {path}', 'SKIPPED: {path}', { path: full }));
        continue;
      }
      try {
        const stat = fs.lstatSync(full);
        if (stat.isSymbolicLink()) continue;
        if (stat.isDirectory()) {
          removeDir(full);
        } else if (stat.isFile()) {
          fs.rmSync(full, { force: true });
          freed += stat.size;
        }
      } catch {
        // Kilitli dosyalar atlanır.
      }
    }
    try { fs.rmdirSync(dir); } catch { /* içinde hariç tutulan öğe kalmış olabilir */ }
  };
  try {
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink() || blocked(target)) return 0;
    if (stat.isDirectory()) removeDir(target);
    else { freed = stat.size; fs.rmSync(target, { force: true }); }
  } catch {
    return freed;
  }
  return freed;
}

/**
 * Komutu PATH üzerinde ve bilinen kurulum konumlarında arar. Kurulumdan sonra
 * süreç PATH'i yenilenmediği için yedek konumların denenmesi gerekir.
 */
export function commandCandidates(command: string, fallbacks: string[] = []): string[] {
  const found: string[] = [];
  const add = (candidate: string): void => {
    const key = path.resolve(candidate).toLowerCase();
    if (!found.some((item) => path.resolve(item).toLowerCase() === key)) found.push(candidate);
  };
  const extensions = path.extname(command) ? [''] : ['.exe', '.cmd', '.bat', ''];
  for (const folder of (process.env.PATH || process.env.Path || '').split(path.delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = path.join(folder, command + extension);
      if (fs.existsSync(candidate)) add(candidate);
    }
  }
  for (const fallback of fallbacks) {
    if (fallback && fs.existsSync(fallback)) add(fallback);
  }
  if (!found.length) found.push(command);
  return found;
}

export function expandVars(value: string): string {
  let result = value.replace(/%([^%]+)%/g, (_match, name: string) => process.env[name] || '');
  if (platform !== 'windows') {
    result = result.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g,
      (_match, braced: string, plain: string) => process.env[braced || plain] || '');
  }
  return result;
}

export function normalizeName(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9çğıöşü]+/gi, '')
    .trim();
}
