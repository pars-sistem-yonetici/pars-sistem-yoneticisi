import fs from 'fs';
import os from 'os';
import path from 'path';
import type { SystemSnapshot } from '../../shared/types';
import { getCapabilities } from '../../shared/platform';

/**
 * macOS/Linux için salt-okunur sistem özeti. Komut çalıştırmaz; yalnızca Node
 * çalışma zamanının verdiği bellek bilgilerini ve dosya sistemi istatistiklerini okur.
 */

function safeStatfs(target: string): fs.StatsFs | null {
  try {
    const candidate = path.resolve(target || '/');
    return fs.statfsSync(candidate);
  } catch {
    return null;
  }
}

function diskUsage(target: string): { total: number; free: number } {
  const info = safeStatfs(target);
  if (!info) return { total: 0, free: 0 };
  const block = Math.max(1, info.bsize || 4096);
  const total = info.blocks * block;
  const free = info.bavail * block;
  return { total, free };
}

function percent(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value * 10) / 10)) : 0;
}

/** Anlık CPU yükü; Windows yüzdesiyle birebir aynı değildir, deneysel gösterim içindir. */
function cpuPercent(): number {
  const cores = Math.max(1, os.cpus().length);
  const [oneMinute] = os.loadavg();
  return percent((oneMinute / cores) * 100);
}

export async function snapshot(requestedDrive?: string): Promise<SystemSnapshot> {
  const input = String(requestedDrive || '').trim();
  const target = input && path.isAbsolute(input) ? path.resolve(input) : os.homedir();
  const disk = diskUsage(target);
  const memoryTotal = os.totalmem();
  const memoryAvailable = os.freemem();
  return {
    cpuPercent: cpuPercent(),
    memoryTotal,
    memoryAvailable,
    memoryPercent: memoryTotal > 0 ? percent(((memoryTotal - memoryAvailable) * 100) / memoryTotal) : 0,
    diskTotal: disk.total,
    diskFree: disk.free,
    diskPercent: disk.total > 0 ? percent(((disk.total - disk.free) * 100) / disk.total) : 0,
    diskPath: target,
  };
}

function mounts(): string[] {
  const rows: string[] = [];
  try {
    for (const line of fs.readFileSync('/proc/mounts', 'utf8').split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      const mount = parts[1];
      const type = parts[2] || '';
      if (!mount || !mount.startsWith('/')) continue;
      if (/^(proc|sysfs|devtmpfs|tmpfs|devpts|cgroup|cgroup2|securityfs|debugfs|tracefs|bpf|overlay|squashfs|autofs|fusectl|hugetlbfs|pstore|efivarfs|mqueue|configfs)$/.test(type)) continue;
      if (mount.startsWith('/sys') || mount.startsWith('/proc') || mount.startsWith('/dev')) continue;
      if (mount.includes('/snap/') || mount.includes('/containerd/')) continue;
      try {
        if (!fs.statSync(mount).isDirectory()) continue;
      } catch {
        continue;
      }
      if (!rows.includes(mount)) rows.push(mount);
    }
  } catch {
    // /proc/mounts yoksa aşağıdaki varsayılanlar kullanılır.
  }
  return rows.slice(0, 26);
}

export async function drives(): Promise<string[]> {
  const kind = getCapabilities().kind;
  const rows = ['/'];
  if (kind === 'macos') {
    try {
      for (const entry of fs.readdirSync('/Volumes', { withFileTypes: true })) {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
        const target = path.join('/Volumes', entry.name);
        if (!fs.existsSync(target)) continue;
        if (!rows.includes(target)) rows.push(target);
      }
    } catch {
      // /Volumes okunamıyorsa kök sürücü yeterlidir.
    }
  } else {
    rows.push(...mounts());
    for (const candidate of ['/home', '/mnt', '/media']) {
      try {
        if (fs.statSync(candidate).isDirectory() && !rows.includes(candidate)) rows.push(candidate);
      } catch {
        // Bazı dağıtımlarda bu klasörler bulunmaz.
      }
    }
  }
  return rows.slice(0, 27);
}

/** Sürücü yollarını kullanıcıya anlamlı gelen adlarla eşler. */
export async function driveLabels(): Promise<Record<string, string>> {
  const labels: Record<string, string> = {
    '/': getCapabilities().kind === 'macos' ? 'Macintosh HD' : 'Linux',
  };
  try {
    for (const entry of fs.readdirSync('/Volumes', { withFileTypes: true })) {
      if (!entry.isSymbolicLink() && !entry.isDirectory()) continue;
      const target = path.join('/Volumes', entry.name);
      if (fs.existsSync(target)) labels[target] = entry.name;
    }
  } catch {
    // macOS dışında /Volumes bulunmaz.
  }
  for (const mount of mounts()) {
    let label = path.basename(mount);
    try {
      const info = fs.statfsSync(mount);
      if (info && info.bavail === 0 && info.blocks > 0) label = 'Salt okunur';
    } catch {
      // Etiket için salt okunur bilgi şart değil.
    }
    if (!labels[mount]) labels[mount] = label || mount;
  }
  return labels;
}
