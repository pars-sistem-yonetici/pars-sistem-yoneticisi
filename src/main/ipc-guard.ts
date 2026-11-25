/**
 * Renderer -> ana surec sinirinda calisan hafif IPC dogrulayicilari.
 *
 * Amac: harici bagimlilik (zod vb.) eklemeden gelen argumanlarin turunu ve
 * sinirlarini kontrol etmek; hatali/strlenmis argumanin servislere ulasmasini
 * engellemek. Her dogrulayici degeri oldugu gibi veya (strip modunda) sadece
 * bilinen alanlari dondurur.
 */

export type Validator = (value: unknown, field: string) => unknown;

export class IpcValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IpcValidationError';
  }
}

function fail(field: string, detail: string): never {
  throw new IpcValidationError(`${field}: ${detail}`);
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('değer', 'nesne bekleniyor');
  }
  return value as Record<string, unknown>;
}

interface StringOptions {
  min?: number;
  max?: number;
  pattern?: RegExp;
  allowEmpty?: boolean;
}

export function str(options: StringOptions = {}): Validator {
  return (value, field) => {
    if (typeof value !== 'string') fail(field, 'metin bekleniyor');
    const text = value as string;
    if (!options.allowEmpty && !text.trim()) fail(field, 'boş olamaz');
    if (options.min !== undefined && text.length < options.min) fail(field, `en az ${options.min} karakter olmalı`);
    if (options.max !== undefined && text.length > options.max) fail(field, `en fazla ${options.max} karakter olabilir`);
    if (options.pattern && !options.pattern.test(text)) fail(field, 'geçersiz biçim');
    return text;
  };
}

export const bool: Validator = (value, field) => {
  if (typeof value !== 'boolean') fail(field, 'doğru/yanlış bekleniyor');
  return value;
};

export const num: Validator = (value, field) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(field, 'sayı bekleniyor');
  return value;
};

export function oneOf<T extends string | number>(values: readonly T[]): Validator {
  return (value, field) => {
    if (!values.includes(value as T)) fail(field, `izin verilenler: ${values.join(', ')}`);
    return value;
  };
}

export function arr(item: Validator, max = 1000): Validator {
  return (value, field) => {
    if (!Array.isArray(value)) fail(field, 'dizi bekleniyor');
    if (value.length > max) fail(field, `en fazla ${max} öğe olabilir`);
    return value.map((entry, index) => item(entry, `${field}[${index}]`));
  };
}

interface FieldSpec {
  validate: Validator;
  optional?: boolean;
}

/** Nesnedeki bilinen alanları doğrular. strip=true ise bilinmeyen alanları atar. */
export function shape(fields: Record<string, FieldSpec>, strip = false): Validator {
  return (value, field) => {
    const source = record(value);
    const output: Record<string, unknown> = {};
    for (const [key, spec] of Object.entries(fields)) {
      if (!(key in source)) {
        if (!spec.optional) fail(`${field}.${key}`, 'eksik');
        continue;
      }
      output[key] = spec.validate(source[key], `${field}.${key}`);
    }
    return strip ? output : source;
  };
}

/** winget paket kimliği: en az bir nokta içermeli, kabuk/argüman özel karakteri taşımamalı. */
export const ident: Validator = str({
  min: 3,
  max: 128,
  pattern: /^[A-Za-z0-9][A-Za-z0-9._+-]*\.[A-Za-z0-9][A-Za-z0-9._+-]*$/,
});

/** winget search sorgusu: seçenek gibi yorumlanmaması için '-' ile başlayamaz. */
export const searchQuery: Validator = str({
  min: 1,
  max: 120,
  pattern: /^[^\s-][^\r\n]*$/,
});

export const wingetPkg: Validator = shape({
  name: { validate: str({ max: 512, pattern: /^[^\s-/][^\r\n]*$/ }) },
  ident: { validate: str({ max: 128 }) },
  version: { validate: str({ allowEmpty: true, max: 128 }) },
  available: { validate: str({ allowEmpty: true, max: 128 }) },
  source: { validate: str({ allowEmpty: true, max: 128 }) },
});

export const regIssue: Validator = shape({
  hive: { validate: oneOf(['HKLM', 'HKCU'] as const) },
  rootPath: { validate: str({ max: 512 }) },
  label: { validate: str({ allowEmpty: true, max: 512 }) },
  key: { validate: str({ max: 2048 }) },
  name: { validate: str({ allowEmpty: true, max: 512 }) },
  publisher: { validate: str({ allowEmpty: true, max: 512 }) },
  reason: { validate: str({ allowEmpty: true, max: 512 }) },
  detail: { validate: str({ allowEmpty: true, max: 2048 }) },
  view: { validate: oneOf([64, 32] as const) },
  system: { validate: bool, optional: true },
  category: {
    validate: oneOf(['uninstall', 'app-paths', 'com-shell', 'com-hijack', 'file-assoc', 'service', 'shared-dll', 'font', 'odbc'] as const),
    optional: true,
  },
  risk: { validate: oneOf(['info', 'warning', 'critical'] as const), optional: true },
  fixable: { validate: bool, optional: true },
  recommendation: { validate: str({ allowEmpty: true, max: 512 }), optional: true },
  signature: { validate: str({ allowEmpty: true, max: 64 }), optional: true },
  valueName: { validate: str({ allowEmpty: true, max: 2048 }), optional: true },
});

export const scheduleTask: Validator = shape({
  id: { validate: str({ max: 128 }) },
  kind: { validate: oneOf(['weekly-full', 'daily-light', 'monthly-deep', 'custom'] as const) },
  name: { validate: str({ max: 256 }) },
  enabled: { validate: bool },
  time: { validate: str({ pattern: /^([01]\d|2[0-3]):[0-5]\d$/, max: 5 }) },
  dayOfWeek: { validate: num, optional: true },
  dayOfMonth: { validate: num, optional: true },
  intervalDays: { validate: num, optional: true },
  lastRun: { validate: str({ allowEmpty: true, max: 64 }), optional: true },
  nextRun: { validate: str({ allowEmpty: true, max: 64 }), optional: true },
});

export const startupItem: Validator = shape({
  id: { validate: str({ max: 512 }) },
  name: { validate: str({ max: 512 }) },
  command: { validate: str({ allowEmpty: true, max: 4096 }) },
  location: { validate: str({ allowEmpty: true, max: 512 }) },
  enabled: { validate: bool },
  kind: { validate: oneOf(['registry', 'folder'] as const) },
  scope: { validate: oneOf(['user', 'machine'] as const) },
  sourcePath: { validate: str({ allowEmpty: true, max: 2048 }) },
  valueName: { validate: str({ allowEmpty: true, max: 256 }) },
  valueType: { validate: str({ allowEmpty: true, max: 64 }) },
});

export const leftover: Validator = shape({
  path: { validate: str({ max: 4096 }) },
  kind: { validate: oneOf(['file', 'folder', 'registry'] as const) },
  size: { validate: num },
  reason: { validate: str({ allowEmpty: true, max: 512 }) },
});

export const leftoverScanTarget: Validator = shape({
  name: { validate: str({ max: 512 }) },
  ident: { validate: str({ allowEmpty: true, max: 256 }) },
}, true);

export const installItem: Validator = shape({
  name: { validate: str({ max: 256 }) },
  ident: { validate: str({ max: 128 }) },
  source: { validate: oneOf(['winget', 'choco', 'npm', 'scoop'] as const) },
}, true);

export const bloatwareItem: Validator = shape({
  id: { validate: str({ max: 512 }) },
  name: { validate: str({ max: 512 }) },
  publisher: { validate: str({ allowEmpty: true, max: 512 }) },
  version: { validate: str({ allowEmpty: true, max: 128 }) },
  kind: { validate: oneOf(['windows-app', 'oem-app'] as const) },
  ident: { validate: str({ allowEmpty: true, max: 256 }) },
  packageName: { validate: str({ allowEmpty: true, max: 256 }) },
  packageFullName: { validate: str({ allowEmpty: true, max: 512 }) },
  provisioned: { validate: bool },
  detail: { validate: str({ allowEmpty: true, max: 2048 }) },
  reason: { validate: str({ allowEmpty: true, max: 512 }) },
}, true);

export const updateInfo: Validator = shape({
  available: { validate: bool },
  currentVersion: { validate: str({ max: 32 }) },
  latestVersion: { validate: str({ max: 32 }) },
  notes: { validate: str({ allowEmpty: true, max: 20000 }) },
  fileName: { validate: str({ max: 512 }) },
  sha512: { validate: str({ min: 16, max: 512 }) },
  size: { validate: num },
  source: { validate: str({ max: 2048 }) },
  portable: { validate: bool },
  message: { validate: str({ allowEmpty: true, max: 2000 }) },
});

export const settingsPatch: Validator = shape({
  language: { validate: str({ max: 64 }), optional: true },
  theme: { validate: oneOf(['default', 'windows11', 'auto'] as const), optional: true },
  wingetVersion: { validate: str({ allowEmpty: true, max: 128 }), optional: true },
  wingetAvailable: { validate: bool, optional: true },
  autoUpdateScan: { validate: bool, optional: true },
  autoLeftoverScan: { validate: bool, optional: true },
  silentInstall: { validate: bool, optional: true },
  enterpriseSilentPrereqs: { validate: bool, optional: true },
  drive: { validate: str({ allowEmpty: true, max: 16 }), optional: true },
  startWithWindows: { validate: bool, optional: true },
  startMinimizedToTray: { validate: bool, optional: true },
  closeBehavior: { validate: oneOf(['ask', 'tray', 'quit'] as const), optional: true },
  updateSource: { validate: str({ allowEmpty: true, max: 2048 }), optional: true },
  updateCheckOnStartup: { validate: bool, optional: true },
  excludedFolders: { validate: arr(str({ max: 4096 }), 500), optional: true },
  excludedExtensions: { validate: arr(str({ min: 1, max: 32 }), 500), optional: true },
}, true);

export const filePath: Validator = str({ min: 2, max: 4096 });
export const pathList: Validator = arr(filePath, 2000);

export const fileScanOptions: Validator = shape({
  roots: { validate: pathList },
  referenceRoots: { validate: pathList },
  minSize: { validate: num },
  maxResults: { validate: num },
}, true);

export const autorunItem: Validator = shape({
  id: { validate: str({ max: 1024 }) },
  category: { validate: oneOf(['task', 'service', 'winlogon', 'appinit', 'ifeo', 'wmi'] as const) },
  name: { validate: str({ max: 512 }) },
  location: { validate: str({ allowEmpty: true, max: 1024 }) },
  command: { validate: str({ allowEmpty: true, max: 4096 }) },
  enabled: { validate: bool },
  publisher: { validate: str({ allowEmpty: true, max: 512 }) },
  sourcePath: { validate: str({ allowEmpty: true, max: 2048 }) },
  risk: { validate: oneOf(['normal', 'elevated'] as const) },
  state: { validate: str({ allowEmpty: true, max: 128 }) },
}, true);

export const privacyTweak: Validator = shape({
  id: { validate: str({ max: 64 }) },
  title: { validate: str({ max: 256 }) },
  description: { validate: str({ allowEmpty: true, max: 1024 }) },
  category: { validate: oneOf(['telemetry', 'privacy', 'interface'] as const) },
  hive: { validate: oneOf(['HKCU', 'HKLM'] as const) },
  location: { validate: str({ max: 1024 }) },
  name: { validate: str({ max: 256 }) },
  value: { validate: str({ max: 256 }) },
  applied: { validate: bool },
  current: { validate: str({ allowEmpty: true, max: 256 }) },
  admin: { validate: bool },
}, true);

/** child, parent klasörünün içinde mi? (sembolik bağlantılar çözülmüş yollarla karşılaştırılır) */
export function isInside(child: string, parent: string): boolean {
  const relative = pathRelative(normalize(parent), normalize(child));
  return relative === '' || (!relative.startsWith('..') && !absolute(relative));
}

function normalize(value: string): string {
  return value.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
}

function pathRelative(parent: string, child: string): string {
  if (child === parent) return '';
  if (child.startsWith(`${parent}\\`)) return child.slice(parent.length + 1);
  return `..${child}`;
}

function absolute(value: string): boolean {
  return /^[a-z]:/i.test(value) || value.startsWith('\\\\');
}
