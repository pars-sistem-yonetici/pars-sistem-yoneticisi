/** "Kuruluşunuz tarafından yönetiliyor" bildirimini düzelten .reg dosyalarının tanımları. */
export type ManagedPolicyFixId = 'windows' | 'browsers';

export interface ManagedPolicyFixDefinition {
  id: ManagedPolicyFixId;
  title: string;
  description: string;
  warning: string;
  fileName: string;
  /** .reg dosyasında silinecek anahtarlar; yedekleme ve doğrulama için de kullanılır. */
  keys: string[];
}

const WINDOWS_KEYS = [
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer',
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System',
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Group Policy Objects',
  'HKCU\\Software\\Policies\\Microsoft\\Windows\\Control Panel\\Desktop',
  'HKCU\\Software\\Policies\\Microsoft\\Windows\\Explorer',
  'HKCU\\Software\\Policies\\Microsoft\\Windows\\System',
  'HKCU\\Software\\Policies\\Microsoft\\Windows\\Personalization',
  'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer',
  'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System',
  'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Control Panel\\Desktop',
  'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Explorer',
  'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\System',
  'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Personalization',
  'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate',
  'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows Defender',
  'HKCU\\Software\\Policies\\Microsoft\\Windows Defender',
];

const BROWSER_KEYS = [
  'HKCU\\SOFTWARE\\Policies\\Google\\Chrome',
  'HKLM\\SOFTWARE\\Policies\\Google\\Chrome',
  'HKCU\\SOFTWARE\\Policies\\Google\\Chromium',
  'HKLM\\SOFTWARE\\Policies\\Google\\Chromium',
  'HKCU\\SOFTWARE\\Policies\\Microsoft\\Edge',
  'HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge',
  'HKCU\\SOFTWARE\\Policies\\Mozilla\\Firefox',
  'HKLM\\SOFTWARE\\Policies\\Mozilla\\Firefox',
  'HKCU\\SOFTWARE\\Policies\\BraveSoftware\\Brave',
  'HKLM\\SOFTWARE\\Policies\\BraveSoftware\\Brave',
  'HKCU\\SOFTWARE\\Policies\\Opera Software',
  'HKLM\\SOFTWARE\\Policies\\Opera Software',
  'HKCU\\SOFTWARE\\Policies\\Vivaldi',
  'HKLM\\SOFTWARE\\Policies\\Vivaldi',
  'HKCU\\SOFTWARE\\Policies\\Yandex',
  'HKLM\\SOFTWARE\\Policies\\Yandex',
];

export const MANAGED_POLICY_FIXES: ManagedPolicyFixDefinition[] = [
  {
    id: 'windows',
    title: 'Windows yönetim bildirimi',
    description: 'Windows ayarlarındaki "Kuruluşunuz tarafından yönetiliyor" uyarısına yol açan ilke (policy) anahtarlarını kaldırır.',
    warning: 'Kurumsal bir cihazda bu ilkeler yönetici tarafından konulmuş olabilir. Uygulama öncesi tüm anahtarların .reg yedeği alınır; yedek başarısız olursa hiçbir değişiklik yapılmaz.',
    fileName: 'windows-managed-by-organization.reg',
    keys: WINDOWS_KEYS,
  },
  {
    id: 'browsers',
    title: 'Tarayıcı yönetim bildirimi',
    description: 'Chrome, Edge, Firefox, Brave, Opera, Vivaldi ve Yandex için "Kuruluşunuz tarafından yönetiliyor" uyarısına yol açan ilke anahtarlarını kaldırır.',
    warning: 'Uyguladıktan sonra açık tarayıcıları kapatıp yeniden açın. Kurumsal ilkeler yeniden gelebilir; yedek dosyaları ile geri alınabilir.',
    fileName: 'browsers-managed-by-organization.reg',
    keys: BROWSER_KEYS,
  },
];

/** Dosya pakete gömülmezse arayüzde gösterilecek içeriği üretir. */
export function buildRegFile(fix: ManagedPolicyFixDefinition): string {
  const lines = [
    'Windows Registry Editor Version 5.00',
    '',
    `; ${fix.title}`,
    `; ${fix.description}`,
    '; Uygulama oncesi .reg yedegi alinir; yedek basarisiz olursa degisiklik yapilmaz.',
    '',
    ...fix.keys.flatMap((key) => [`[-${key}]`, '']),
  ];
  return `${lines.join('\r\n')}\r\n`;
}
