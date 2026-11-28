/**
 * Kudu'nun macOS/Linux denetimlerinin salt-okunur karşılığı.
 *
 *Bu servis yalnızca okuma yapar: ayar değiştirmez, dosya silmez, süreç
 *kapatmaz, paket kurmaz. Tüm komutlar kabuksuz `execFile` ile sabit
 *argüman dizilerinden çalıştırılır; kullanıcıdan yol veya ifade alınmaz.
 * Bulut/daemon/CLI modları bilinçli olarak dahil edilmez.
 */
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { PosixAuditReport, PosixAuditRow, PosixAuditSection, PosixAuditSectionId, PosixAuditStatus } from '../../shared/types';
import { getCapabilities } from '../../shared/platform';

const QUERY_TIMEOUT = 6_000;
const SCAN_TIMEOUT = 45_000;
const MAX_OUTPUT = 2 * 1024 * 1024;
const MAX_ROWS = 120;
const MAX_ENTRIES = 5_000;

interface ReadResult {
  code: number;
  text: string;
  stderr: string;
}

interface Entry {
  name: string;
  path: string;
  directory: boolean;
  symlink: boolean;
}

function read(command: string, args: string[], timeout = QUERY_TIMEOUT): Promise<ReadResult> {
  return new Promise((resolve) => {
    execFile(command, args, { timeout, maxBuffer: MAX_OUTPUT, windowsHide: true }, (error, stdout, stderr) => {
      const out = typeof stdout === 'string' ? stdout : String(stdout ?? '');
      const err = typeof stderr === 'string' ? stderr : String(stderr ?? '');
      resolve({
        code: error ? Number((error as { code?: unknown }).code) || -1 : 0,
        text: out.slice(0, MAX_OUTPUT),
        stderr: err.slice(0, 2_000),
      });
    });
  });
}

async function readFirst(candidates: readonly string[], args: readonly string[], timeout = QUERY_TIMEOUT): Promise<ReadResult | null> {
  let fallback: ReadResult | null = null;
  for (const command of candidates) {
    try {
      const result = await read(command, [...args], timeout);
      if (result.code === 0 && !fallback) return result;
      if ((result.text || result.stderr) && !fallback) fallback = result;
    } catch {
      // Komut yolda yoksa sonraki aday denenir.
    }
  }
  return fallback;
}

function lines(text: string): string[] {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function row(label: string, detail: string, status?: PosixAuditStatus, extra: Partial<PosixAuditRow> = {}): PosixAuditRow {
  return { label: label.slice(0, 240), detail: detail.slice(0, 600), status, ...extra };
}

function section(id: PosixAuditSectionId, rows: PosixAuditRow[], error?: string): PosixAuditSection {
  return { id, rows: rows.slice(0, MAX_ROWS), ...(error ? { error: error.slice(0, 240) } : {}) };
}

async function safeSection(id: PosixAuditSectionId, build: () => Promise<PosixAuditRow[]>): Promise<PosixAuditSection> {
  try {
    return section(id, await build());
  } catch (error) {
    return section(id, [], (error as Error).message);
  }
}

function entries(folder: string, max = 80): Entry[] {
  const output: Entry[] = [];
  let listing: fs.Dirent[];
  try {
    listing = fs.readdirSync(folder, { withFileTypes: true });
  } catch {
    return output;
  }
  for (const item of listing) {
    if (output.length >= max) break;
    if (item.name.startsWith('.')) continue;
    output.push({
      name: item.name,
      path: path.join(folder, item.name),
      directory: item.isDirectory(),
      symlink: item.isSymbolicLink(),
    });
  }
  return output;
}

function readText(file: string, max = 20_000): string {
  try {
    return fs.readFileSync(file, 'utf8').slice(0, max);
  } catch {
    return '';
  }
}

/** Klasör boyutunu sembolik bağlantıları izlemeden ve girdi sayısını sınırlayarak okur. */
export function folderSize(target: string): { bytes: number; entries: number } {
  let bytes = 0;
  let count = 0;
  const walk = (folder: string, depth: number): void => {
    if (depth > 5 || count >= MAX_ENTRIES) return;
    let listing: fs.Dirent[];
    try {
      listing = fs.readdirSync(folder, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of listing) {
      if (count >= MAX_ENTRIES) break;
      if (item.isSymbolicLink()) continue;
      const child = path.join(folder, item.name);
      try {
        if (item.isDirectory()) {
          walk(child, depth + 1);
        } else if (item.isFile()) {
          bytes += fs.statSync(child).size;
          count += 1;
        }
      } catch {
        // Kısıtlı klasörler boyuta dahil edilmez.
      }
    }
  };
  walk(target, 0);
  return { bytes, entries: count };
}

function sizeRows(targets: readonly string[]): PosixAuditRow[] {
  return targets
    .filter((target) => {
      try { return fs.statSync(target).isDirectory(); } catch { return false; }
    })
    .map((target) => {
      const size = folderSize(target);
      return row(target, `${size.entries} dosya`, undefined, { size: size.bytes });
    });
}

function plistValue(text: string, key: string): string {
  const match = text.match(new RegExp(`<key>\\s*${key}\\s*</key>\\s*(?:<string>([^<]*)</string>|<true\\s*/>|<false\\s*/>|<integer>([^<]*)</integer>)`, 'i'));
  if (!match) return '';
  if (match[1]) return match[1].trim();
  if (/<true/i.test(match[0])) return 'true';
  if (/<false/i.test(match[0])) return 'false';
  return match[2]?.trim() ?? '';
}

/** `launchctl list`: PID, durum, etiket. Apple sistem servisleri atlanır. */
export function parseLaunchctl(text: string): PosixAuditRow[] {
  const rows: PosixAuditRow[] = [];
  for (const line of lines(text).slice(1)) {
    const cells = line.split(/\s+/);
    if (cells.length < 3) continue;
    const [pid, status, label] = cells;
    if (!label || label.startsWith('com.apple.')) continue;
    rows.push(row(label, `PID ${pid}`, pid === '-' ? 'stopped' : status === '0' ? 'running' : 'finding'));
  }
  return rows;
}

/** `systemctl list-units --all`: not-found birimleri rapora girmez. */
export function parseSystemdUnits(text: string): PosixAuditRow[] {
  const rows: PosixAuditRow[] = [];
  for (const line of lines(text).slice(1)) {
    const cells = line.trim().split(/\s+/);
    if (cells.length < 4) continue;
    const [unit, load, active, , ...rest] = cells;
    if (!unit || load === 'not-found') continue;
    rows.push(row(unit, rest.join(' '), active === 'active' ? 'running' : 'stopped'));
  }
  return rows;
}

/** `ss -tunap state established`: loopback adresleri dışlanır. */
export function parseSs(text: string): PosixAuditRow[] {
  const rows: PosixAuditRow[] = [];
  const seen = new Set<string>();
  for (const line of lines(text).slice(1)) {
    const cells = line.trim().split(/\s+/);
    // ss -tunap: State Recv-Q Send-Q Local Peer Process
    if (cells.length < 5) continue;
    const [state, , , local, peer, ...process] = cells;
    if (/127\.|::1|localhost|\[::1\]/.test(local) || /127\.|::1|localhost|\[::1\]/.test(peer)) continue;
    const key = `${local}|${peer}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row(local, `${state} → ${peer} ${process.join(' ')}`.trim()));
  }
  return rows;
}

/** `lsof -i -n -P +c0 -sTCP:ESTABLISHED -F pn`: p<pid> ve n<adres> çiftleri. */
export function parseLsof(text: string): PosixAuditRow[] {
  const rows: PosixAuditRow[] = [];
  let pid = '';
  for (const line of lines(text)) {
    if (/^p\d+$/.test(line)) {
      pid = line.slice(1);
      continue;
    }
    if (!line.startsWith('n')) continue;
    const address = line.slice(1);
    if (/127\.|::1|localhost/.test(address)) continue;
    rows.push(row(address, `PID ${pid || '-'}`));
    pid = '';
  }
  return rows;
}

const BROWSER_NAMES = [
  'Safari', 'Google Chrome', 'chromium', 'firefox', 'Brave Browser', 'Opera', 'Microsoft Edge',
  'librewolf', 'zen', 'Vivaldi', 'Tor Browser',
];

/** `ps -axo comm=`: yalnızca tam process adı eşleşmesi; pkill/pkill -f yok. */
export function parseBrowsers(text: string): PosixAuditRow[] {
  const rows: PosixAuditRow[] = [];
  const seen = new Set<string>();
  for (const line of lines(text)) {
    const name = path.basename(line.trim());
    if (!name) continue;
    if (!BROWSER_NAMES.some((browser) => browser.toLowerCase() === name.toLowerCase())) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    rows.push(row(name, 'ps -axo comm=', 'running'));
  }
  return rows;
}

/** `recently-used.xbel` / `.trashinfo` gibi dosyalardaki yol girdileri. */
export function parsePathEntries(text: string, marker: string): number {
  let count = 0;
  const pattern = new RegExp(`^\\s*${marker}`, 'm');
  for (const line of lines(text)) {
    if (pattern.test(line)) count += 1;
  }
  return count;
}

export function parseClam(text: string): PosixAuditRow[] {
  return lines(text)
    .filter((line) => /FOUND$/i.test(line))
    .map((line) => row(line.replace(/\s+FOUND$/i, ''), 'clamscan', 'finding'));
}

async function macStartup(): Promise<PosixAuditRow[]> {
  const home = os.homedir();
  const folders = [
    path.join(home, 'Library', 'LaunchAgents'),
    '/Library/LaunchAgents',
    '/Library/LaunchDaemons',
    '/Library/StartupItems',
  ];
  const rows: PosixAuditRow[] = [];
  for (const folder of folders) {
    for (const item of entries(folder, 60)) {
      if (item.symlink) continue;
      if (/\.plist$/i.test(item.name)) {
        const text = readText(item.path);
        const label = plistValue(text, 'Label') || item.name;
        const program = plistValue(text, 'ProgramArguments') || plistValue(text, 'Program');
        const disabled = /<key>\s*Disabled\s*<\/key>\s*<true/i.test(text) || plistValue(text, 'RunAtLoad') === 'false';
        rows.push(row(label, `${item.path}${program ? ` · ${program}` : ''}`, disabled ? 'disabled' : 'enabled'));
      } else if (item.directory && folder.endsWith('StartupItems')) {
        rows.push(row(item.name, item.path, 'enabled'));
      }
    }
  }
  return rows;
}

async function macServices(): Promise<PosixAuditRow[]> {
  const result = await readFirst(['/bin/launchctl', 'launchctl'], ['list']);
  return result ? parseLaunchctl(result.text) : [];
}

async function macNetwork(): Promise<PosixAuditRow[]> {
  const result = await readFirst(['/usr/sbin/lsof', 'lsof'], ['-i', '-n', '-P', '+c0', '-sTCP:ESTABLISHED', '-F', 'pn']);
  return result ? parseLsof(result.text) : [];
}

async function browserProcesses(): Promise<PosixAuditRow[]> {
  const result = await readFirst(['/bin/ps', 'ps'], ['-axo', 'comm=']);
  return result ? parseBrowsers(result.text) : [];
}

async function macPrivacy(): Promise<PosixAuditRow[]> {
  const rows: PosixAuditRow[] = [];
  const defaults: Array<[string, string]> = [
    ['com.apple.Safari', 'AutoOpenSafeDownloads'],
    ['com.apple.Safari', 'RestoreLastSessionOnLaunch'],
    ['com.apple.AdLib', 'allowsPersonalization'],
    ['NSGlobalDomain', 'NSRecentDocumentsLimit'],
  ];
  for (const [domain, key] of defaults) {
    const result = await readFirst(['/usr/bin/defaults', 'defaults'], ['read', domain, key], 3_000);
    rows.push(row(`${domain} · ${key}`, result?.text.trim() || '-', result?.text.trim() ? 'enabled' : 'unavailable'));
  }
  for (const name of ['net.inet.ip.forwarding', 'kern.kclient']) {
    const result = await readFirst(['/usr/sbin/sysctl', 'sysctl', '/bin/sysctl'], ['-n', name], 3_000);
    rows.push(row(`sysctl ${name}`, result?.text.trim() || '-', result?.text.trim() ? undefined : 'unavailable'));
  }
  const sshd = readText('/etc/ssh/sshd_config', 60_000);
  for (const directive of ['PasswordAuthentication', 'PermitRootLogin', 'PermitEmptyPasswords']) {
    const match = sshd.split(/\r?\n/).find((line) => new RegExp(`^\\s*${directive}\\b`, 'i').test(line));
    rows.push(row(`sshd_config · ${directive}`, match?.trim() || 'yok', match ? 'enabled' : 'unavailable'));
  }
  return rows;
}

async function macMalware(): Promise<PosixAuditRow[]> {
  const home = os.homedir();
  const folders = [
    path.join(home, 'Downloads'), path.join(home, 'Desktop'), path.join(home, 'Documents'),
    path.join(home, 'Library', 'LaunchAgents'), '/Library/LaunchAgents', '/Library/LaunchDaemons',
    '/usr/local/bin', '/opt/local/bin', os.tmpdir(), '/private/tmp',
  ];
  const targets: string[] = [];
  for (const folder of folders) {
    for (const item of entries(folder, 60)) {
      if (item.symlink) continue;
      if (/\.(app|dylib|so|bundle)$/i.test(item.name)) targets.push(item.path);
      if (targets.length >= 24) break;
    }
    if (targets.length >= 24) break;
  }
  if (!targets.length) return [row('codesign', '-', 'unavailable')];
  const rows: PosixAuditRow[] = [];
  for (const target of targets) {
    const result = await readFirst(['/usr/bin/codesign', 'codesign'], ['--verify', '--deep', '--strict', target], 10_000);
    if (result && result.code !== 0) rows.push(row(target, (result.stderr || result.text).split(/\r?\n/)[0] || 'geçersiz imza', 'finding'));
  }
  return rows.length ? rows : [row('codesign', `${targets.length} dosya imzası geçerli`)];
}

async function macCleanup(): Promise<PosixAuditRow[]> {
  const home = os.homedir();
  return sizeRows([
    os.tmpdir(),
    '/private/tmp',
    path.join(home, 'Library', 'Logs'),
    path.join(home, 'Library', 'DiagnosticReports'),
    path.join(home, 'Library', 'Caches', 'com.apple.QuickLook'),
    path.join(home, 'Library', 'Developer', 'Xcode', 'DerivedData'),
    path.join(home, 'Library', 'Caches', 'org.swift.swiftpm'),
    path.join(home, 'Library', 'Application Support', 'iTunes', 'DeviceSupport'),
    ...entries(path.join(home, 'Library', 'Containers'), 8)
      .filter((item) => item.directory)
      .map((item) => path.join(item.path, 'Data', 'Library', 'Caches')),
  ]);
}

async function macTrash(): Promise<PosixAuditRow[]> {
  const trash = path.join(os.homedir(), '.Trash');
  let count = 0;
  try {
    count = entries(trash, MAX_ROWS).length;
  } catch {
    // Çöp kutusu klasörü yoksa sıfır döner.
  }
  const size = folderSize(trash);
  return [row(trash, `${size.entries} dosya`, undefined, { size: size.bytes, count })];
}

/** `.desktop`, `.desktop.disabled` ve systemd kullanıcı birimi satırları. */
export function parseDesktopEntry(name: string, fullPath: string, text: string): PosixAuditRow {
  const label = text.match(/^Name=(.+)$/im)?.[1]?.trim() || name;
  const exec = text.match(/^Exec=(.+)$/im)?.[1]?.trim() || '';
  const disabled = /\.desktop\.disabled$/i.test(name)
    || /^Hidden=true/im.test(text)
    || /^X-GNOME-Autostart-enabled=false/im.test(text);
  return row(label, `${fullPath}${exec ? ` · ${exec}` : ''}`, disabled ? 'disabled' : 'enabled');
}

async function linuxStartup(): Promise<PosixAuditRow[]> {
  const base = path.join(os.homedir(), '.config');
  const folders = [path.join(base, 'autostart'), path.join(base, 'systemd', 'user')];
  const rows: PosixAuditRow[] = [];
  for (const folder of folders) {
    for (const item of entries(folder, 80)) {
      if (item.symlink || !/\.(desktop|desktop\.disabled|service)$/i.test(item.name)) continue;
      rows.push(parseDesktopEntry(item.name, item.path, readText(item.path, 20_000)));
    }
  }
  return rows;
}

async function linuxServices(): Promise<PosixAuditRow[]> {
  const units = await readFirst(['/usr/bin/systemctl', 'systemctl'], ['list-units', '--type=service', '--no-pager', '--plain', '--all']);
  const rows = units ? parseSystemdUnits(units.text) : [];
  const defaults = await readFirst(['/usr/bin/systemctl', 'systemctl'], ['get-default'], 3_000);
  const sessions = await readFirst(['/usr/bin/loginctl', 'loginctl'], ['list-sessions', '--no-legend'], 3_000);
  rows.unshift(row('systemctl get-default', `${defaults?.text.trim() || '-'} · ${lines(sessions?.text || '').length} oturum`));
  return rows;
}

async function linuxNetwork(): Promise<PosixAuditRow[]> {
  const result = await readFirst(['/usr/sbin/ss', '/bin/ss', 'ss'], ['-tunap', 'state', 'established']);
  const rows = result ? parseSs(result.text) : [];
  const resolv = readText('/etc/resolv.conf', 20_000);
  const servers = lines(resolv).filter((line) => /^nameserver\s+/i.test(line)).map((line) => line.replace(/^nameserver\s+/i, ''));
  rows.push(row('/etc/resolv.conf', servers.join(', ') || '-', servers.length ? undefined : 'unavailable'));
  const nmcli = await readFirst(['/usr/bin/nmcli', 'nmcli'], ['-t', '-f', 'NAME,TYPE', 'connection', 'show'], 3_000);
  if (nmcli) {
    for (const line of lines(nmcli.text).slice(0, 30)) {
      const [name, type] = line.split(':');
      if (name && type) rows.push(row(name, `nmcli · ${type}`));
    }
  }
  return rows;
}

async function linuxPrivacy(): Promise<PosixAuditRow[]> {
  const rows: PosixAuditRow[] = [];
  const settings: Array<[string, string]> = [
    ['org.gnome.desktop.privacy', 'remember-recent-files'],
    ['org.gnome.desktop.privacy', 'send-software-usage-stats'],
    ['org.gnome.desktop.search-providers', 'disable-external'],
  ];
  for (const [schema, key] of settings) {
    const result = await readFirst(['/usr/bin/gsettings', 'gsettings'], ['get', schema, key], 3_000);
    rows.push(row(`gsettings ${schema} ${key}`, result?.text.trim() || '-', result?.text.trim() ? 'enabled' : 'unavailable'));
  }
  for (const name of ['net.ipv4.ip_forward', 'net.ipv4.conf.all.accept_redirects', 'kernel.kptr_restrict', 'kernel.dmesg_restrict']) {
    const result = await readFirst(['/usr/sbin/sysctl', 'sysctl', '/bin/sysctl'], ['-n', name], 3_000);
    rows.push(row(`sysctl ${name}`, result?.text.trim() || '-', result?.text.trim() ? undefined : 'unavailable'));
  }
  const sshd = readText('/etc/ssh/sshd_config', 60_000);
  for (const directive of ['PasswordAuthentication', 'PermitRootLogin', 'PermitEmptyPasswords']) {
    const match = sshd.split(/\r?\n/).find((line) => new RegExp(`^\\s*${directive}\\b`, 'i').test(line));
    rows.push(row(`sshd_config · ${directive}`, match?.trim() || 'yok', match ? 'enabled' : 'unavailable'));
  }
  const kde = readText(path.join(os.homedir(), '.config', 'kdeglobals'), 60_000);
  const recent = kde.match(/^MaximumNumberOfRecentFiles=(.+)$/im)?.[1]?.trim();
  if (recent) rows.push(row('kdeglobals · MaximumNumberOfRecentFiles', recent, 'enabled'));
  return rows;
}

async function linuxMalware(): Promise<PosixAuditRow[]> {
  const home = os.homedir();
  const folders = [path.join(home, 'Downloads'), path.join(home, 'Desktop'), path.join(home, 'Documents'), '/tmp', '/var/tmp']
    .filter((folder) => {
      try { return fs.statSync(folder).isDirectory(); } catch { return false; }
    })
    .slice(0, 4);
  if (!folders.length || !fs.existsSync('/usr/bin/clamscan')) return [row('clamscan', '-', 'unavailable')];
  const rows: PosixAuditRow[] = [];
  for (const folder of folders) {
    const result = await read('/usr/bin/clamscan', ['--no-summary', '--infected', folder], SCAN_TIMEOUT);
    if (result.code === 2) {
      rows.push(row(folder, 'clamscan hatası', 'unavailable'));
      continue;
    }
    const findings = parseClam(result.text);
    rows.push(...findings.slice(0, 30));
    if (!findings.length) rows.push(row(folder, 'clamscan · bulgu yok'));
  }
  return rows;
}

async function linuxCleanup(): Promise<PosixAuditRow[]> {
  const home = os.homedir();
  const rows = sizeRows([
    '/tmp', '/var/tmp',
    path.join(home, '.cache', 'thumbnails'),
    path.join(home, '.cache', 'fontconfig'),
    path.join(home, '.cache', 'gstreamer-1.0'),
    path.join(home, '.local', 'share', 'crash'),
    path.join(home, '.local', 'share', 'tracker'),
    '/var/cache/apt/archives', '/var/cache/dnf', '/var/cache/pacman/pkg', '/var/cache/zypp',
    '/var/lib/snapd/cache', '/var/lib/systemd/coredump',
  ]);
  const journal = await readFirst(['/usr/bin/journalctl', 'journalctl'], ['--disk-usage'], 3_000);
  if (journal?.text.trim()) rows.push(row('journalctl --disk-usage', journal.text.trim()));
  return rows;
}

async function linuxTrash(): Promise<PosixAuditRow[]> {
  const base = path.join(os.homedir(), '.local', 'share', 'Trash');
  const info = path.join(base, 'info');
  let count = 0;
  for (const item of entries(info, MAX_ROWS)) {
    if (/\.trashinfo$/i.test(item.name) && !item.symlink) count += 1;
  }
  const size = folderSize(path.join(base, 'files'));
  return [row(base, `${size.entries} dosya`, undefined, { size: size.bytes, count })];
}

/** Tüm denetimleri paralel başlatır; bölüm hataları raporu düşürmez. */
export async function audit(): Promise<PosixAuditReport> {
  const kind = getCapabilities().kind;
  if (kind === 'windows') throw new Error('POSIX denetimi yalnızca macOS ve Linux üzerinde kullanılabilir.');
  const mac = kind === 'macos';
  const builders: Array<[PosixAuditSectionId, () => Promise<PosixAuditRow[]>]> = mac
    ? [
      ['startup', macStartup], ['services', macServices], ['network', macNetwork], ['browsers', browserProcesses],
      ['privacy', macPrivacy], ['malware', macMalware], ['cleanup', macCleanup], ['trash', macTrash],
    ]
    : [
      ['startup', linuxStartup], ['services', linuxServices], ['network', linuxNetwork], ['browsers', browserProcesses],
      ['privacy', linuxPrivacy], ['malware', linuxMalware], ['cleanup', linuxCleanup], ['trash', linuxTrash],
    ];
  const sections = await Promise.all(builders.map(([id, build]) => safeSection(id, build)));
  return { platform: kind, startedAt: new Date().toISOString(), sections };
}
