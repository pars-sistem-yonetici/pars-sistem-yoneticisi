import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import * as diskService from './disk';
import type { LogFn } from '../util';
import { m, mf } from '../i18n-main';

export type ScheduleKind = 'weekly-full' | 'daily-light' | 'monthly-deep' | 'custom';

export interface ScheduleTask {
  id: string;
  kind: ScheduleKind;
  name: string;
  enabled: boolean;
  time: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  intervalDays?: number;
  lastRun?: string;
  nextRun?: string;
}

export interface ScheduleRunResult {
  taskId: string;
  ran: boolean;
  message: string;
  results?: unknown[];
}

const DEFAULTS: ScheduleTask[] = [
  { id: 'weekly-full', kind: 'weekly-full', name: m('Haftalık tam temizlik', 'Weekly full cleanup'), enabled: false, time: '03:00', dayOfWeek: 0 },
  { id: 'daily-light', kind: 'daily-light', name: m('Günlük hafif temizlik', 'Daily light cleanup'), enabled: false, time: '03:30' },
  { id: 'monthly-deep', kind: 'monthly-deep', name: m('Aylık derin temizlik', 'Monthly deep cleanup'), enabled: false, time: '04:00', dayOfMonth: 1 },
  { id: 'custom', kind: 'custom', name: m('Özel temizlik', 'Custom cleanup'), enabled: false, time: '04:30', intervalDays: 7 },
];

const KEYS_BY_KIND: Record<ScheduleKind, readonly string[]> = {
  'daily-light': ['user_temp', 'internet_cache', 'dns', 'thumbnails'],
  'weekly-full': ['user_temp', 'windows_temp', 'thumbnails', 'error_reports', 'internet_cache', 'dns'],
  'monthly-deep': ['user_temp', 'windows_temp', 'thumbnails', 'windows_update', 'error_reports', 'internet_cache', 'dns'],
  custom: ['user_temp', 'windows_temp', 'thumbnails', 'error_reports', 'internet_cache', 'dns'],
};

let cache: ScheduleTask[] | null = null;

function file(): string {
  return path.join(app.getPath('userData'), 'schedules.json');
}

function asObject(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function isScheduleKind(value: unknown): value is ScheduleKind {
  return value === 'weekly-full' || value === 'daily-light' || value === 'monthly-deep' || value === 'custom';
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function numberField(record: Record<string, unknown>, key: string, fallback: number): number {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function dateField(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function normalizeTime(value: string, fallback: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return fallback;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return fallback;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function fallbackFor(raw: unknown, index: number): ScheduleTask {
  const record = asObject(raw);
  const id = typeof record.id === 'string' && record.id ? record.id : `custom-${index + 1}`;
  return { id, kind: 'custom', name: m('Özel temizlik', 'Custom cleanup'), enabled: false, time: '04:30', intervalDays: 7 };
}

function normalizeTask(raw: unknown, fallback: ScheduleTask): ScheduleTask {
  const record = asObject(raw);
  const kind = isScheduleKind(record.kind) ? record.kind : fallback.kind;
  const task: ScheduleTask = {
    id: typeof record.id === 'string' && record.id ? record.id : fallback.id,
    kind,
    name: typeof record.name === 'string' && record.name.trim() ? record.name : fallback.name,
    enabled: typeof record.enabled === 'boolean' ? record.enabled : fallback.enabled,
    time: normalizeTime(typeof record.time === 'string' ? record.time : fallback.time, fallback.time),
  };

  if (kind === 'weekly-full') {
    task.dayOfWeek = clampInt(numberField(record, 'dayOfWeek', fallback.dayOfWeek ?? 0), 0, 6);
  } else if (kind === 'monthly-deep') {
    task.dayOfMonth = clampInt(numberField(record, 'dayOfMonth', fallback.dayOfMonth ?? 1), 1, 28);
  } else if (kind === 'custom') {
    task.intervalDays = clampInt(numberField(record, 'intervalDays', fallback.intervalDays ?? 7), 1, 365);
  }

  const lastRun = dateField(record.lastRun);
  if (lastRun) task.lastRun = lastRun;
  return task;
}

function timeParts(time: string): [number, number] {
  const pieces = time.split(':').map(Number);
  return [pieces[0], pieces[1]];
}

function atTime(base: Date, hour: number, minute: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, minute, 0, 0);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, date.getHours(), date.getMinutes(), 0, 0);
}

function addMonthsClamped(date: Date, months: number, day: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth() + months, 1, date.getHours(), date.getMinutes(), 0, 0);
  result.setDate(clampInt(day, 1, 28));
  return result;
}

/** Zamanlanmış anı, "geçmişe kaydırmadan" bulur (bu hafta/ay veya son çalıştırma + aralık). */
function scheduledAt(task: ScheduleTask, now: Date): Date {
  const [hour, minute] = timeParts(task.time);

  if (task.kind === 'weekly-full') {
    const targetDay = clampInt(task.dayOfWeek ?? 0, 0, 6);
    const diff = (now.getDay() - targetDay + 7) % 7;
    return atTime(addDays(now, -diff), hour, minute);
  }
  if (task.kind === 'monthly-deep') {
    const day = clampInt(task.dayOfMonth ?? 1, 1, 28);
    return new Date(now.getFullYear(), now.getMonth(), day, hour, minute, 0, 0);
  }
  if (task.kind === 'custom') {
    const interval = clampInt(task.intervalDays ?? 7, 1, 365);
    const lastRun = dateField(task.lastRun);
    const base = lastRun ? new Date(lastRun) : now;
    return atTime(addDays(base, interval), hour, minute);
  }
  return atTime(now, hour, minute);
}

function advance(task: ScheduleTask, date: Date): Date {
  if (task.kind === 'weekly-full') return addDays(date, 7);
  if (task.kind === 'monthly-deep') {
    return addMonthsClamped(date, 1, clampInt(task.dayOfMonth ?? 1, 1, 28));
  }
  if (task.kind === 'custom') return addDays(date, clampInt(task.intervalDays ?? 7, 1, 365));
  return addDays(date, 1);
}

function computeNextRun(task: ScheduleTask, now: Date): Date {
  let candidate = scheduledAt(task, now);
  for (let guard = 0; guard < 1000 && candidate < now; guard += 1) {
    candidate = advance(task, candidate);
  }
  return candidate;
}

function withComputedNextRun(task: ScheduleTask, now = new Date()): ScheduleTask {
  return { ...task, nextRun: computeNextRun(task, now).toISOString() };
}

function isDueByRules(task: ScheduleTask, now: Date): boolean {
  let scheduled = scheduledAt(task, now);
  const lastRun = dateField(task.lastRun);
  if (lastRun) {
    const last = new Date(lastRun);
    for (let guard = 0; guard < 1000 && scheduled <= last; guard += 1) {
      scheduled = advance(task, scheduled);
    }
  }
  return scheduled <= now;
}

function writeTasks(tasks: ScheduleTask[]): ScheduleTask[] {
  cache = tasks.map((task) => ({ ...task }));
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.writeFileSync(file(), JSON.stringify(cache, null, 2), 'utf8');
  } catch {
    // Zamanlamalar bellekte tutulmaya devam eder.
  }
  return listSchedules();
}

function loadTasks(): ScheduleTask[] {
  if (cache) return cache;

  let stored: unknown = [];
  try {
    stored = JSON.parse(fs.readFileSync(file(), 'utf8')) as unknown;
  } catch {
    stored = [];
  }
  const list = Array.isArray(stored) ? stored : [];
  const tasks: ScheduleTask[] = [];
  const seen = new Set<string>();

  for (const fallback of DEFAULTS) {
    const raw = list.find((item) => {
      const record = asObject(item);
      return record.id === fallback.id;
    });
    const task = withComputedNextRun(normalizeTask(raw, fallback));
    tasks.push(task);
    seen.add(task.id);
  }

  list.forEach((raw, index) => {
    const fallback = fallbackFor(raw, index);
    if (seen.has(fallback.id)) return;
    const task = withComputedNextRun(normalizeTask(raw, fallback));
    tasks.push(task);
    seen.add(task.id);
  });

  cache = tasks;
  if (!fs.existsSync(file())) writeTasks(tasks);
  return cache;
}

export function listSchedules(): ScheduleTask[] {
  return loadTasks().map((task) => ({ ...task }));
}

export function saveSchedules(tasks: ScheduleTask[]): ScheduleTask[] {
  const now = new Date();
  const normalized = tasks.map((task, index) => {
    const fallback = DEFAULTS.find((item) => item.id === task.id) ?? fallbackFor(task, index);
    return withComputedNextRun(normalizeTask(task, fallback), now);
  });
  return writeTasks(normalized);
}

export function dueTasks(now?: Date): ScheduleTask[] {
  const reference = now ?? new Date();
  return listSchedules().filter((task) => {
    if (!task.enabled) return false;
    if (task.nextRun) {
      const next = new Date(task.nextRun);
      if (!Number.isNaN(next.getTime())) return next <= reference;
    }
    return isDueByRules(task, reference);
  });
}

function markRun(task: ScheduleTask): void {
  const now = new Date();
  const updated: ScheduleTask = { ...task, lastRun: now.toISOString() };
  updated.nextRun = computeNextRun(updated, now).toISOString();

  let found = false;
  const tasks = loadTasks().map((item) => {
    if (item.id !== task.id) return item;
    found = true;
    return updated;
  });
  if (!found) tasks.push(updated);
  writeTasks(tasks);
}

export async function runSchedule(task: ScheduleTask, onLine?: LogFn): Promise<ScheduleRunResult> {
  onLine?.(mf('Zamanlı görev başlatıldı: {name}', 'Scheduled task started: {name}', { name: task.name }));
  try {
    const wanted = KEYS_BY_KIND[task.kind] ?? KEYS_BY_KIND.custom;
    const available = diskService.targets();
    const items = available.filter((target) => (
      wanted.includes(target.key)
      && target.key !== 'recycle'
      && (target.available || target.dirs.some((dir) => fs.existsSync(dir)))
    ));

    const results = await diskService.clean(items, onLine);
    markRun(task);
    const message = mf('{name} tamamlandı: {count} temizlik hedefi işlendi.', '{name} completed: {count} cleanup target(s) processed.', {
      name: task.name,
      count: results.length,
    });
    onLine?.(message);
    return { taskId: task.id, ran: true, message, results };
  } catch (error) {
    markRun(task);
    const detail = error instanceof Error ? error.message : String(error);
    const message = mf('{name} çalıştırılamadı: {detail}', '{name} could not be run: {detail}', {
      name: task.name,
      detail: detail.slice(0, 200),
    });
    onLine?.(message);
    return { taskId: task.id, ran: false, message };
  }
}

export function startScheduler(onLine?: LogFn): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    void (async () => {
      try {
        for (const task of dueTasks()) {
          await runSchedule(task, onLine);
        }
      } catch {
        // Bir tick hatası sonraki çalıştırmayı engellemez.
      } finally {
        running = false;
      }
    })();
  }, 60_000);

  return () => {
    clearInterval(timer);
  };
}
