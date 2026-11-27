import { spawn } from 'child_process';
import crypto from 'crypto';
import { once } from 'events';
import { app, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import type { AppUpdateInfo, UpdateDownloadResult, UpdateInstallResult } from '../../shared/types';
import type { LogFn } from '../util';
import { m, mf } from '../i18n-main';
import { getSettings } from './settings';

interface Manifest {
  version?: unknown;
  notes?: unknown;
  fileName?: unknown;
  sha512?: unknown;
  size?: unknown;
  url?: unknown;
}

interface ResolvedManifest {
  version: string;
  notes: string;
  fileName: string;
  expectedHash: string;
  size: number;
  target: string;
  source: string;
}

type ProgressFn = (percent: number, downloaded: number, total: number) => void;

const MAX_UPDATE_SIZE = 2 * 1024 * 1024 * 1024;

function isHttp(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isPortable(): boolean {
  return Boolean(process.env.PORTABLE_EXECUTABLE_FILE);
}

export function updateFolder(): string {
  const folder = path.join(app.getPath('userData'), 'updates');
  try { fs.mkdirSync(folder, { recursive: true }); } catch { /* sonraki indirmede tekrar denenir */ }
  return folder;
}

function freeSpaceBytes(folder: string): number {
  try {
    const stats = fs.statfsSync(folder);
    return stats.bavail * stats.bsize;
  } catch {
    return 0;
  }
}

function downloadErrorMessage(error: unknown): string {
  const raw = (error as Error)?.message || 'bilinmeyen hata';
  const code = (error as NodeJS.ErrnoException)?.code;
  if (code === 'ENOSPC') return m('Diskte yeterli alan kalmadı; güncelleme indirilemedi. Lütfen alan açıp yeniden deneyin.', 'Not enough free disk space; the update could not be downloaded. Please free space and try again.');
  if (/terminated|aborted|socket hang up|network/i.test(raw)) {
    return mf('Bağlantı kesildi; güncelleme indirilemedi. Lütfen yeniden deneyin. ({raw})', 'Connection lost; the update could not be downloaded. Please try again. ({raw})', { raw });
  }
  return mf('Güncelleme indirilemedi: {raw}', 'Update could not be downloaded: {raw}', { raw });
}

function normalizeHash(value: unknown): string {
  if (typeof value !== 'string') return '';
  const text = value.trim().replace(/^sha512[-:]?/i, '').replace(/\s/g, '');
  if (/^[0-9a-f]{128}$/i.test(text)) return text.toLowerCase();
  try {
    const hex = Buffer.from(text, 'base64').toString('hex');
    return /^[0-9a-f]{128}$/i.test(hex) ? hex : '';
  } catch {
    return '';
  }
}

function cleanVersion(value: unknown): string {
  if (typeof value !== 'string') return '';
  const match = value.trim().match(/^v?(\d+\.\d+(?:\.\d+)?)/i);
  return match ? match[1] : '';
}

function compareVersions(left: string, right: string): number {
  const parts = (value: string): number[] => {
    const result = cleanVersion(value).split('.').map((item) => Number.parseInt(item, 10) || 0);
    while (result.length < 3) result.push(0);
    return result.slice(0, 3);
  };
  const a = parts(left);
  const b = parts(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

async function readManifest(): Promise<ResolvedManifest> {
  const configured = (getSettings().updateSource || '').trim();
  let manifestUrl: string | undefined;
  let manifestFile: string | undefined;
  let source: string;

  if (!configured) {
    const candidates = [
      path.join(process.resourcesPath, 'updates', 'latest.json'),
      path.join(path.dirname(app.getPath('exe')), 'updates', 'latest.json'),
      path.join(app.getAppPath(), 'build', 'updates', 'latest.json'),
    ];
    const found = candidates.find((item) => fs.existsSync(item));
    if (!found) {
      throw new Error(m('Güncelleme kaynağı tanımlı değil ve varsayılan latest.json bulunamadı.', 'No update source is configured and the default latest.json was not found.'));
    }
    manifestFile = found;
    source = found;
  } else if (isHttp(configured)) {
    manifestUrl = configured.toLowerCase().endsWith('.json')
      ? configured
      : `${configured.replace(/\/+$/, '')}/latest.json`;
    source = manifestUrl;
  } else {
    const resolved = path.resolve(configured);
    manifestFile = resolved.toLowerCase().endsWith('.json') ? resolved : path.join(resolved, 'latest.json');
    if (!fs.existsSync(manifestFile)) {
      throw new Error(mf('Güncelleme bildirimi bulunamadı: {file}', 'Update manifest not found: {file}', { file: manifestFile }));
    }
    source = manifestFile;
  }

  let raw: string;
  if (manifestUrl) {
    const response = await fetch(manifestUrl, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(mf('Güncelleme bildirimi alınamadı (HTTP {status}).', 'Update manifest could not be fetched (HTTP {status}).', { status: response.status }));
    raw = await response.text();
  } else {
    raw = fs.readFileSync(manifestFile!, 'utf8');
  }

  let manifest: Manifest;
  try {
    manifest = JSON.parse(raw) as Manifest;
  } catch {
    throw new Error(m('Güncelleme bildirimi geçerli JSON değil.', 'The update manifest is not valid JSON.'));
  }

  const version = cleanVersion(manifest.version);
  const fileName = typeof manifest.fileName === 'string' ? path.basename(manifest.fileName.trim()) : '';
  const expectedHash = normalizeHash(manifest.sha512);
  const size = typeof manifest.size === 'number' && Number.isFinite(manifest.size) && manifest.size > 0
    ? Math.floor(manifest.size)
    : 0;

  if (!version) throw new Error(m('Güncelleme bildiriminde geçerli bir sürüm yok.', 'The update manifest has no valid version.'));
  if (!fileName || !/\.exe$/i.test(fileName) || /[\\/]/.test(manifest.fileName as string)) {
    throw new Error(m('Güncelleme bildiriminde geçerli bir exe dosya adı yok.', 'The update manifest has no valid exe file name.'));
  }
  if (!expectedHash) throw new Error(m('Güncelleme bildiriminde geçerli bir SHA-512 özeti yok; indirme engellendi.', 'The update manifest has no valid SHA-512 hash; download blocked.'));
  if (size > MAX_UPDATE_SIZE) throw new Error(m('Güncelleme dosyası izin verilen boyutu aşıyor.', 'The update file exceeds the allowed size.'));

  const rawTarget = typeof manifest.url === 'string' && manifest.url.trim() ? manifest.url.trim() : fileName;
  let target: string;
  if (manifestUrl) {
    target = new URL(rawTarget, manifestUrl).href;
  } else {
    target = path.resolve(path.dirname(manifestFile!), rawTarget);
  }

  return {
    version,
    notes: typeof manifest.notes === 'string' ? manifest.notes.trim() : '',
    fileName,
    expectedHash,
    size,
    target,
    source,
  };
}

function emptyInfo(message: string): AppUpdateInfo {
  return {
    available: false,
    currentVersion: app.getVersion(),
    latestVersion: '',
    notes: '',
    fileName: '',
    sha512: '',
    size: 0,
    source: '',
    portable: isPortable(),
    message,
  };
}

export async function checkForUpdate(_logger?: LogFn): Promise<AppUpdateInfo> {
  const current = app.getVersion();
  try {
    const resolved = await readManifest();
    const available = compareVersions(resolved.version, current) > 0;
    if (!available) {
      return {
        ...emptyInfo(mf('Güncel sürüm: {version}', 'Current version: {version}', { version: current })),
        latestVersion: current,
        source: resolved.source,
      };
    }
    return {
      available: true,
      currentVersion: current,
      latestVersion: resolved.version,
      notes: resolved.notes,
      fileName: resolved.fileName,
      sha512: resolved.expectedHash,
      size: resolved.size,
      source: resolved.source,
      portable: isPortable(),
      message: `${current} → ${resolved.version}`,
    };
  } catch (error) {
    return emptyInfo((error as Error).message);
  }
}

async function* responseChunks(response: Response): AsyncGenerator<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error(m('Güncelleme yanıtı okunamadı.', 'The update response could not be read.'));
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) yield Buffer.from(value);
    }
  } finally {
    reader.releaseLock();
  }
}

export async function downloadUpdate(info: AppUpdateInfo, onProgress: ProgressFn, logger?: LogFn): Promise<UpdateDownloadResult> {
  let resolved: ResolvedManifest;
  try {
    resolved = await readManifest();
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
  if (resolved.version !== info.latestVersion || resolved.fileName !== info.fileName) {
    return { ok: false, message: m('Güncelleme bildirimi değişti. Lütfen yeniden kontrol edin.', 'The update manifest changed. Please check again.') };
  }
  if (resolved.expectedHash !== info.sha512) {
    return { ok: false, message: m('Güncelleme özeti değişti; indirme iptal edildi.', 'The update hash changed; download cancelled.') };
  }

  const destination = path.join(updateFolder(), resolved.fileName);
  const hash = crypto.createHash('sha512');
  const total = resolved.size || 0;
  let downloaded = 0;
  let source: AsyncIterable<Buffer>;

  const free = freeSpaceBytes(path.dirname(destination));
  const needed = total + 64 * 1024 * 1024;
  if (free && free < needed) {
    return {
      ok: false,
      message: mf('Güncelleme için yeterli disk alanı yok ({free} MB boş, yaklaşık {needed} MB gerekli). Lütfen {folder} sürücüsünde alan açın.', 'Not enough disk space for the update ({free} MB free, about {needed} MB required). Please free space on {folder}.', {
        free: Math.round(free / 1024 / 1024),
        needed: Math.round(needed / 1024 / 1024),
        folder: path.dirname(destination),
      }),
    };
  }

  try {
    if (isHttp(resolved.target)) {
      logger?.(mf('Güncelleme indiriliyor: {url}', 'Downloading update: {url}', { url: resolved.target }));
      const response = await fetch(resolved.target);
      if (!response.ok) throw new Error(mf('Güncelleme indirilemedi (HTTP {status}).', 'Update could not be downloaded (HTTP {status}).', { status: response.status }));
      source = responseChunks(response);
    } else {
      logger?.(mf('Güncelleme kopyalanıyor: {url}', 'Writing update: {url}', { url: resolved.target }));
      source = fs.createReadStream(resolved.target);
    }

    const out = fs.createWriteStream(destination);
    for await (const chunk of source) {
      hash.update(chunk);
      downloaded += chunk.length;
      if (downloaded > MAX_UPDATE_SIZE) throw new Error(m('Güncelleme dosyası izin verilen boyutu aşıyor.', 'The update file exceeds the allowed size.'));
      if (!out.write(chunk)) await once(out, 'drain');
      if (total) onProgress(Math.min(99, Math.round((downloaded / total) * 100)), downloaded, total);
      else onProgress(0, downloaded, 0);
    }
    out.end();
    await once(out, 'finish');

    const actual = hash.digest('hex');
    if (actual !== resolved.expectedHash) {
      fs.rmSync(destination, { force: true });
      return { ok: false, message: m('SHA-512 doğrulaması başarısız; dosya silindi.', 'SHA-512 verification failed; the file was deleted.') };
    }
    if (total && downloaded !== total) {
      fs.rmSync(destination, { force: true });
      return { ok: false, message: m('İndirilen dosya boyutu bildirimle uyuşmuyor.', 'The downloaded file size does not match the manifest.') };
    }
    onProgress(100, downloaded, total || downloaded);
    logger?.(mf('Güncelleme doğrulandı: {file}', 'Update verified: {file}', { file: resolved.fileName }));
    return { ok: true, message: mf('{file} indirildi ve doğrulandı.', '{file} downloaded and verified.', { file: resolved.fileName }), path: destination };
  } catch (error) {
    fs.rmSync(destination, { force: true });
    return { ok: false, message: downloadErrorMessage(error) };
  }
}

export async function installUpdate(filePath: string, logger?: LogFn): Promise<UpdateInstallResult> {
  const target = path.resolve(filePath);
  const folder = path.resolve(updateFolder());
  if (path.dirname(target).toLowerCase() !== folder.toLowerCase() || !/\.exe$/i.test(target) || !fs.existsSync(target)) {
    return { ok: false, message: m('Kurulum için doğrulanmış güncelleme dosyası bulunamadı.', 'No verified update file was found for installation.'), restarting: false };
  }

  if (isPortable()) {
    shell.showItemInFolder(target);
    return {
      ok: true,
      message: m('Portable sürümde dosya değiştirilemez. İndirilen exe’nin üzerine kopyalayıp uygulamayı yeniden başlatın.', 'In portable mode the file cannot be replaced. Copy the downloaded exe over the old one and restart the app.'),
      restarting: false,
    };
  }

  try {
    logger?.(mf('Güncelleme kurulumu başlatılıyor: {file}', 'Starting update installer: {file}', { file: target }));
    // --force-run: NSIS, sessiz kurulum bitince uygulamayı kendisi yeniden başlatır.
    // Uygulama 1,5 sn içinde kapanır; böylece kurucu dosyaları değiştirebilir.
    const child = spawn(target, ['/S', '--updated', '--force-run'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    await new Promise<void>((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
    child.unref();
    const timer = setTimeout(() => app.exit(0), 1500);
    timer.unref();
    return { ok: true, message: m('Kurulum başlatıldı. Uygulama güncellendikten sonra yeniden başlayacak...', 'Installation started. The app will restart after the update...'), restarting: true };
  } catch (error) {
    return { ok: false, message: mf('Kurulum başlatılamadı: {message}', 'Installation could not be started: {message}', { message: (error as Error).message }), restarting: false };
  }
}
