import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type {
  OptimizationProfile, ProfileApplyResult, ProfileId, SystemTweak, TweakActionResult, TweakCategory,
} from '../../shared/types';
import { PROFILE_IDS, TWEAK_CATEGORIES } from '../../shared/types';
import { LogFn, powershellJson, psLiteral, runPowerShell } from '../util';

/**
 * Yerel Windows & ağ ayarları. Yalnızca tersine çevrilebilir, iyi bilinen ayarlar bulunur.
 * UserChoice, COM/CLSID, sertifika depolan ve dosya ilişkilendirme sahipliği değiştirilmez.
 * Her değişiklik öncesi .reg yedeği (mümkünse) ve özgün değer JSON kaydı zorunludur.
 */
interface Definition {
  id: string;
  title: string;
  description: string;
  category: TweakCategory;
  mode: 'registry' | 'command';
  hive: 'HKCU' | 'HKLM';
  location: string;
  name: string;
  value: string;
  type: 'DWord' | 'String' | 'QWord';
  admin: boolean;
  rebootRequired: boolean;
  backupKey?: string;
  read?: string;
  apply?: string;
  revert?: string;
}

const TCP = 'SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters';
const MULTIMEDIA = 'SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile';
const DNSCACHE = 'SYSTEM\\CurrentControlSet\\Services\\Dnscache\\Parameters';
const ADVANCED = 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced';
const SESSION = 'SYSTEM\\CurrentControlSet\\Control\\Session Manager';
const POLICIES_SYSTEM = 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System';

function reg(
  id: string, title: string, description: string, category: TweakCategory,
  hive: 'HKCU' | 'HKLM', location: string, name: string, value: string,
  type: 'DWord' | 'String' | 'QWord' = 'DWord', rebootRequired = false,
): Definition {
  return {
    id, title, description, category, mode: 'registry', hive, location, name, value, type,
    admin: hive === 'HKLM', rebootRequired,
    backupKey: `${hive}\\${location}`,
  };
}

function cmd(
  id: string, title: string, description: string, category: TweakCategory,
  read: string, apply: string, revert: string, desired: string,
  admin = true, rebootRequired = false, backupKey?: string,
): Definition {
  return {
    id, title, description, category, mode: 'command', hive: 'HKLM',
    location: '', name: '', value: desired, type: 'String', admin, rebootRequired,
    read, apply, revert, backupKey,
  };
}

function serviceTweak(id: string, title: string, description: string, serviceName: string, category: TweakCategory = 'services'): Definition {
  const name = psLiteral(serviceName);
  return cmd(
    id, title, description, category,
    `$s = Get-Service -Name ${name} -ErrorAction SilentlyContinue; if ($s) { [string]$s.StartType } else { '' }`,
    `Set-Service -Name ${name} -StartupType Disabled -ErrorAction Stop\n` +
    `$s = Get-Service -Name ${name} -ErrorAction SilentlyContinue\n` +
    `if ($s -and $s.Status -ne 'Stopped') { Stop-Service -Name ${name} -Force -ErrorAction SilentlyContinue }\n'META_OK'`,
    `$v = __ORIGINAL__\nif ($v) { Set-Service -Name ${name} -StartupType $v -ErrorAction Stop }\n'META_OK'`,
    'Disabled', true, false, `SYSTEM\\CurrentControlSet\\Services\\${serviceName}`,
  );
}

/** Ağ & Gecikme — 11 */
const NETWORK: Definition[] = [
  reg('tcp-ack-frequency', 'TCPAckFrequency', 'Gecikmeli ACK yerine anında onay; bazı oyunlarda gecikmeyi azaltır.', 'network', 'HKLM', TCP, 'TcpAckFrequency', '1'),
  reg('tcp-no-delay', 'TcpNoDelay', 'Nagle algoritmasını kapatır; küçük paketler anında gönderilir.', 'network', 'HKLM', TCP, 'TcpNoDelay', '1'),
  reg('network-throttling-index', 'NetworkThrottlingIndex', 'Multimedia ağ kısıtlamasını kaldırır (0xFFFFFFFF).', 'network', 'HKLM', MULTIMEDIA, 'NetworkThrottlingIndex', '4294967295', 'QWord'),
  reg('ecn', 'ECN', 'Açık tıkanıklık bildirimini etkinleştirir.', 'network', 'HKLM', TCP, 'EnableECN', '1'),
  cmd('rsc', 'Receive Segment Coalescing', 'RSC birleştirmeyi kapatır; yüksek hızlı NIC’lerde gecikmeyi azaltabilir.',
    'network',
    `$o = (& netsh.exe int tcp show global) -join '\\n'; if ($o -match '(?i)Receive Segment Coalescing[^:]*:\\s*(\\w+)') { $Matches[1].ToLowerInvariant() } else { '' }`,
    `& netsh.exe int tcp set global rsc=disabled | Out-Null; 'META_OK'`,
    `$v = __ORIGINAL__; if ($v) { & netsh.exe int tcp set global rsc=$v | Out-Null }; 'META_OK'`,
    'disabled', true, true, TCP),
  reg('dns-cache-ttl', 'DNS önbellek süresi', 'DNS yanıtlarının önbellekte tutulma süresini uzatır (MaxCacheTtl).', 'network', 'HKLM', DNSCACHE, 'MaxCacheTtl', '86400'),
  cmd('nic-power-saving', 'NIC güç tasarrufu', 'Etkin fiziksel ağ bağdaştırıcılarında Green Ethernet / EEE özelliklerini kapatır.',
    'network',
    `$p = @(Get-NetAdapterAdvancedProperty -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match 'Green Ethernet|Energy Efficient Ethernet' }); ` +
    `if ($p.Count -eq 0) { '0' } else { [string](@($p | Where-Object { $_.DisplayValue -ne 'Disabled' }).Count) }`,
    `$items = @(Get-NetAdapterAdvancedProperty -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match 'Green Ethernet|Energy Efficient Ethernet' }); ` +
    `$meta = @(); foreach ($i in $items) { $meta += [pscustomobject]@{ adapter = $i.InterfaceDescription; name = $i.DisplayName; value = [string]$i.DisplayValue }; ` +
    `try { Set-NetAdapterAdvancedProperty -InterfaceDescription $i.InterfaceDescription -DisplayName $i.DisplayName -DisplayValue 'Disabled' -ErrorAction Stop } catch { } }; ` +
    `Set-Content -LiteralPath __META__ -Value (@{ original = ($meta | ConvertTo-Json -Compress -Depth 4) } | ConvertTo-Json -Compress) -Encoding utf8; 'META_OK'`,
    `$raw = __ORIGINAL__; if ($raw) { $items = $raw | ConvertFrom-Json; foreach ($i in $items) { ` +
    `try { Set-NetAdapterAdvancedProperty -InterfaceDescription $i.adapter -DisplayName $i.name -DisplayValue $i.value -ErrorAction Stop } catch { } } }; 'META_OK'`,
    '0', true, true),
  reg('smb1', 'SMBv1', 'SMBv1 protokolünü kapatır; modern Windows sürümleriyle uyumludur.', 'network', 'HKLM', 'SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters', 'SMB1', '0', 'DWord', true),
  cmd('netbios', 'NetBIOS over TCP/IP', 'Tüm TCP/IP arabirimlerinde NetBIOS’u kapatır (NetbiosOptions=2).', 'network',
    `$k = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\NetBT\\Parameters\\Interfaces\\Tcpip_*'; ` +
    `$v = @(Get-ItemProperty -Path $k -ErrorAction SilentlyContinue); if ($v.Count -gt 0 -and @($v | Where-Object { $_.NetbiosOptions -ne 2 }).Count -eq 0) { '2' } else { '0' }`,
    `$k = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\NetBT\\Parameters\\Interfaces\\Tcpip_*'; ` +
    `Get-ChildItem -Path $k -ErrorAction SilentlyContinue | ForEach-Object { New-ItemProperty -Path $_.PSPath -Name NetbiosOptions -Value 2 -PropertyType DWord -Force | Out-Null }; 'META_OK'`,
    `$v = __ORIGINAL__; $k = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\NetBT\\Parameters\\Interfaces\\Tcpip_*'; ` +
    `if ($v -eq '2') { Get-ChildItem -Path $k -ErrorAction SilentlyContinue | ForEach-Object { New-ItemProperty -Path $_.PSPath -Name NetbiosOptions -Value 0 -PropertyType DWord -Force | Out-Null } }; 'META_OK'`,
    '2', true, true, 'SYSTEM\\CurrentControlSet\\Services\\NetBT\\Parameters\\Interfaces'),
  cmd('dca', 'Data Center TCP (DCA)', 'Veri merkezi TCP algoritmasını kapatır; masaüstü/gaming için önerilir.', 'network',
    `$o = (& netsh.exe int tcp show global) -join '\\n'; if ($o -match '(?i)DCA[^:]*:\\s*(\\w+)') { $Matches[1].ToLowerInvariant() } else { '' }`,
    `& netsh.exe int tcp set global dca=disabled | Out-Null; 'META_OK'`,
    `$v = __ORIGINAL__; if ($v) { & netsh.exe int tcp set global dca=$v | Out-Null }; 'META_OK'`,
    'disabled', true, false, TCP),
  reg('tcp-timestamps', 'TCP zaman damgaları', 'RFC 7323 zaman damgalarını etkinleştirir (Tcp1323Opts=1).', 'network', 'HKLM', TCP, 'Tcp1323Opts', '1'),
];

/** Sistem & Performans — 14 */
const PERFORMANCE: Definition[] = [
  reg('game-dvr', 'GameDVR', 'Oyun kaydını ve arka plan yakalamayı kapatır.', 'performance', 'HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR', 'AppCaptureEnabled', '0'),
  reg('hags', 'Donanım hızlandırılmış GPU zamanlama', 'HAGS’ı etkinleştirir (HwSchMode=2); destekleyen sürücülerde gecikmeyi azaltır.', 'performance', 'HKLM', 'SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers', 'HwSchMode', '2', 'DWord', true),
  reg('mmcss', 'Multimedia önceliği', 'Multimedia alt sisteminin CPU payını optimize eder (SystemResponsiveness=10).', 'performance', 'HKLM', MULTIMEDIA, 'SystemResponsiveness', '10'),
  cmd('power-plan', 'Yüksek performans güç planı', 'Aktif güç planını Yüksek performans olarak ayarlar; özgün plan GUID’i saklanır.', 'performance',
    `$o = (& powercfg.exe /getactivescheme) -join ' '; if ($o -match '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})') { $Matches[1].ToLowerInvariant() } else { '' }`,
    `& powercfg.exe /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c | Out-Null; 'META_OK'`,
    `$v = __ORIGINAL__; if ($v) { & powercfg.exe /setactive $v | Out-Null }; 'META_OK'`,
    '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c', true, true, 'SYSTEM\\CurrentControlSet\\Control\\Power\\User\\PowerSchemes'),
  cmd('ntfs-8dot3', 'NTFS 8.3 kısa adlar', '8.3 dosya adı üretimini kapatır (fsutil behavior set disable8dot3 1).', 'performance',
    `$o = (& fsutil.exe behavior query disable8dot3) -join ' '; if ($o -match '(\\d+)') { $Matches[1] } else { '' }`,
    `& fsutil.exe behavior set disable8dot3 1 | Out-Null; 'META_OK'`,
    `$v = __ORIGINAL__; if ($v) { & fsutil.exe behavior set disable8dot3 $v | Out-Null }; 'META_OK'`,
    '1', true, true),
  cmd('last-access', 'NTFS son erişim zamanı', 'Son erişim damgası güncellemelerini kapatır (disablelastaccess=1).', 'performance',
    `$o = (& fsutil.exe behavior query disablelastaccess) -join ' '; if ($o -match '(\\d+)') { $Matches[1] } else { '' }`,
    `& fsutil.exe behavior set disablelastaccess 1 | Out-Null; 'META_OK'`,
    `$v = __ORIGINAL__; if ($v) { & fsutil.exe behavior set disablelastaccess $v | Out-Null }; 'META_OK'`,
    '1', true, false),
  cmd('hibernation', 'Hibernasyon', 'Hiberfil.sys alanını kaldırır (powercfg /hibernate off).', 'performance',
    `$o = (& powercfg.exe /a) -join ' '; if ($o -match '(?i)hibernation available') { '1' } else { '0' }`,
    `& powercfg.exe /hibernate off | Out-Null; 'META_OK'`,
    `& powercfg.exe /hibernate on | Out-Null; 'META_OK'`,
    '0', true, true, 'SYSTEM\\CurrentControlSet\\Control\\Power'),
  reg('fast-startup', 'Hızlı başlatma', 'Hızlı başlatmayı kapatır; kapanış/Güvenli Mod sorunlarını azaltır.', 'performance', 'HKLM', `${SESSION}\\Power`, 'HiberbootEnabled', '0', 'DWord', true),
  reg('background-apps', 'Arka plan uygulamaları', 'Uygulamaların arka planda çalışmasını genel olarak kapatır.', 'performance', 'HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications', 'GlobalUserDisabled', '1'),
  serviceTweak('sysmain', 'SysMain (Superfetch)', 'SysMain hizmetini devre dışı bırakır; özgün başlangıç türü saklanır.', 'SysMain', 'performance'),
  reg('storage-sense', 'Depolama Algısı', 'Otomatik Depolama Algısı temizliğini kapatır.', 'performance', 'HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\StorageSense\\Parameters\\StoragePolicy', '01', '0'),
  reg('visual-effects', 'Görsel efektler', 'En iyi performans görsel efekt profilini uygular (VisualFXSetting=2).', 'performance', 'HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects', 'VisualFXSetting', '2'),
  reg('disable-paging-executive', 'Çekirdek sayfalanması', 'Çekirdek kodunun diskine yazılmasını engeller (DisablePagingExecutive=1).', 'performance', 'HKLM', `${SESSION}\\Memory Management`, 'DisablePagingExecutive', '1', 'DWord', true),
  reg('min-animate', 'Pencere animasyonları', 'Pencere aç/kapat animasyonlarını kapatır.', 'performance', 'HKCU', 'Control Panel\\Desktop\\WindowMetrics', 'MinAnimate', '0'),
];

/** Arayüz & Deneyim — 17 */
const INTERFACE: Definition[] = [
  cmd('classic-context-menu', 'Klasik sağ tık menüsü', 'Windows 11 için Windows 10 tarzı klasik Gezgin menüsünü etkinleştirir.', 'interface',
    `$v = Get-ItemProperty -Path 'HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32' -ErrorAction SilentlyContinue; if ($v) { '1' } else { '0' }`,
    `New-Item -Path 'HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32' -Force | Out-Null; 'META_OK'`,
    `Remove-Item -Path 'HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32' -Force -ErrorAction SilentlyContinue; 'META_OK'`,
    '1', false, true, 'Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}'),
  reg('taskbar-alignment', 'Görev çubuğu hizası', 'Windows 11 görev çubuğu simgelerini sola hizalar (TaskbarAl=0).', 'interface', 'HKCU', ADVANCED, 'TaskbarAl', '0'),
  reg('taskbar-search', 'Görev çubuğu arama', 'Görev çubuğundaki arama kutusunu gizler.', 'interface', 'HKCU', ADVANCED, 'SearchboxTaskbarMode', '0'),
  reg('taskbar-chat', 'Görev çubuğu sohbet', 'Windows 11 sohbet (Teams) düğmesini gizler.', 'interface', 'HKCU', ADVANCED, 'TaskbarMn', '0'),
  reg('taskbar-small-icons', 'Küçük görev çubuğu simgeleri', 'Windows 10 görev çubuğunda küçük simge düzenini uygular.', 'interface', 'HKCU', ADVANCED, 'TaskbarSmallIcons', '1'),
  reg('taskbar-task-view', 'Görev görünümü düğmesi', 'Görev çubuğundaki Görev Görünümü düğmesini gizler.', 'interface', 'HKCU', ADVANCED, 'ShowTaskViewButton', '0'),
  reg('explorer-launch-to', 'Gezgin açılış sayfası', 'Dosya Gezgini’ni Bu Bilgisayar ile açar.', 'interface', 'HKCU', ADVANCED, 'LaunchTo', '1'),
  reg('explorer-status-bar', 'Gezgin durum çubuğu', 'Dosya Gezgini durum çubuğunu gösterir.', 'interface', 'HKCU', ADVANCED, 'ShowStatusBar', '1'),
  reg('recent-files', 'Son dosyalar', 'Başlat menüsünde son açılan belgeleri gizler.', 'interface', 'HKCU', ADVANCED, 'Start_TrackDocs', '0'),
  reg('frequent-apps', 'Sık kullanılan uygulamalar', 'Başlat menüsünde sık kullanılan uygulama listesini kapatır.', 'interface', 'HKCU', ADVANCED, 'Start_TrackProgs', '0'),
  reg('snap-assist', 'Snap Assist', 'Pencere yapıştırma önerilerini etkinleştirir.', 'interface', 'HKCU', ADVANCED, 'SnapAssist', '1'),
  reg('snap-flyout', 'Snap açılır paneli', 'Yapıştırma düzenleri açılır panelini kapatır.', 'interface', 'HKCU', ADVANCED, 'EnableSnapAssistFlyout', '0'),
  reg('verbose-status', 'Ayrıntılı açılış/kapanış durumu', 'Açılış ve kapanış sırasında ayrıntılı durum iletilerini gösterir.', 'interface', 'HKLM', POLICIES_SYSTEM, 'VerboseStatus', '1'),
  cmd('dark-mode', 'Koyu mod', 'Uygulama ve sistem temasını koyuya ayarlar; özgün değerler saklanır.', 'interface',
    `$p='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize'; $a=(Get-ItemProperty -Path $p -ErrorAction SilentlyContinue).AppsUseLightTheme; $s=(Get-ItemProperty -Path $p -ErrorAction SilentlyContinue).SystemUsesLightTheme; "$a|$s"`,
    `$p='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize'; New-ItemProperty -Path $p -Name AppsUseLightTheme -Value 0 -PropertyType DWord -Force | Out-Null; New-ItemProperty -Path $p -Name SystemUsesLightTheme -Value 0 -PropertyType DWord -Force | Out-Null; 'META_OK'`,
    `$v=__ORIGINAL__; $p='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize'; $x=$v.Split('|'); ` +
    `if ($x[0] -ne '') { New-ItemProperty -Path $p -Name AppsUseLightTheme -Value ([int]$x[0]) -PropertyType DWord -Force | Out-Null }; ` +
    `if ($x.Length -gt 1 -and $x[1] -ne '') { New-ItemProperty -Path $p -Name SystemUsesLightTheme -Value ([int]$x[1]) -PropertyType DWord -Force | Out-Null }; 'META_OK'`,
    '0|0', false, false, 'Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize'),
  reg('titlebar-accent', 'Başlık çubuğu vurgusu', 'Pencerelerde vurgu rengini başlık çubuğuna uygular.', 'interface', 'HKCU', 'Software\\Microsoft\\Windows\\DWM', 'ColorPrevalence', '1'),
  reg('transparency', 'Şeffaflık efektleri', 'Windows şeffaflık efektlerini kapatır.', 'interface', 'HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', 'EnableTransparency', '0'),
  cmd('show-seconds', 'Saatte saniye', 'Görev çubuğu saatine saniye gösterir; özgün biçim saklanır.', 'interface',
    `$v = (Get-ItemProperty -Path 'HKCU:\\Control Panel\\International' -ErrorAction SilentlyContinue).sTimeFormat; if ($v) { [string]$v } else { '' }`,
    `$p='HKCU:\\Control Panel\\International'; $v=(Get-ItemProperty -Path $p -Name sTimeFormat -ErrorAction SilentlyContinue).sTimeFormat; if (-not $v) { $v='HH:mm:ss' }; ` +
    `$new = if ($v -like '*ss*') { $v } else { $v -replace 'mm', 'mm:ss' }; Set-ItemProperty -Path $p -Name sTimeFormat -Value $new -ErrorAction SilentlyContinue; 'META_OK'`,
    `$v = __ORIGINAL__; if ($v) { Set-ItemProperty -Path 'HKCU:\\Control Panel\\International' -Name sTimeFormat -Value $v -ErrorAction SilentlyContinue }; 'META_OK'`,
    'HH:mm:ss', false, false, 'Control Panel\\International'),
];

/** Gizlilik & Telemetri — 11 */
const PRIVACY: Definition[] = [
  serviceTweak('diagtrack', 'Tanılama hizmeti (DiagTrack)', 'Connected User Experiences and Telemetry hizmetini devre dışı bırakır.', 'DiagTrack', 'privacy'),
  reg('advertising-id', 'Reklam kimliği', 'Uygulamaların kişiselleştirilmiş reklam kimliğini kullanmasını engeller.', 'privacy', 'HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo', 'Enabled', '0'),
  reg('tailored-experiences', 'Uyarlanmış deneyimler', 'Tanılama verisiyle kişiselleştirilmiş önerileri kapatır.', 'privacy', 'HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\Privacy', 'TailoredExperiencesWithDiagnosticDataEnabled', '0'),
  reg('activity-history', 'Etkinlik geçmişi', 'Etkinlik akışını ve bulut eşitlemesini kapatır.', 'privacy', 'HKLM', 'SOFTWARE\\Policies\\Microsoft\\Windows\\System', 'EnableActivityFeed', '0'),
  reg('web-search', 'Web arama önerileri', 'Başlat menüsünde Bing/web sonuçlarını gizler.', 'privacy', 'HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\Search', 'BingSearchEnabled', '0'),
  reg('cortana', 'Cortana / arama asistanı', 'Arama asistanı onayını kapatır.', 'privacy', 'HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\Search', 'CortanaConsent', '0'),
  reg('copilot', 'Copilot düğmesi', 'Görev çubuğundaki Copilot düğmesini gizler.', 'privacy', 'HKCU', ADVANCED, 'ShowCopilotButton', '0'),
  reg('recall', 'Windows Recall', 'Recall özelliğini ilke ile devre dışı bırakır.', 'privacy', 'HKLM', 'SOFTWARE\\Policies\\Microsoft\\Windows\\Recall', 'DisableRecall', '1'),
  reg('location', 'Konum izinleri', 'Konum izin deposunu Deny olarak ayarlar.', 'privacy', 'HKLM', 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\location', 'Value', 'Deny', 'String'),
  reg('feedback-frequency', 'Geri bildirim sıklığı', 'Windows geri bildirim istemlerini en aza indirger.', 'privacy', 'HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\Feedback', 'FeedbackFrequency', '0'),
  reg('instrumentation', 'Kullanım telemetrisi', 'Windows kullanım ölçümünü (NoInstrumentation) kapatır.', 'privacy', 'HKLM', 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer', 'NoInstrumentation', '1'),
];

/** Servis Yönetimi — 10 */
const SERVICES: Definition[] = [
  serviceTweak('spooler', 'Yazdırma Biriktiricisi', 'Spooler hizmetini devre dışı bırakır; yazdırma gerekirse geri açılabilir.', 'Spooler'),
  serviceTweak('fax', 'Faks', 'Faks hizmetini devre dışı bırakır.', 'Fax'),
  serviceTweak('remote-registry', 'Uzak Kayıt Defteri', 'RemoteRegistry hizmetini devre dışı bırakır; uzaktan kayıt defteri erişimini kapatır.', 'RemoteRegistry'),
  serviceTweak('xbl-auth', 'Xbox Live kimlik doğrulama', 'XblAuthManager hizmetini devre dışı bırakır.', 'XblAuthManager'),
  serviceTweak('xbl-game-save', 'Xbox oyun kaydı', 'XblGameSave hizmetini devre dışı bırakır.', 'XblGameSave'),
  serviceTweak('xbox-gip', 'Xbox giriş cihazı', 'XboxGipSvc hizmetini devre dışı bırakır.', 'XboxGipSvc'),
  serviceTweak('bluetooth-user', 'Bluetooth kullanıcı hizmeti', 'BluetoothUserService hizmetini devre dışı bırakır; Bluetooth gerekirse geri açılabilir.', 'BluetoothUserService'),
  serviceTweak('user-data-svc', 'Bağlı kullanıcı deneyimleri', 'UserDataSvc hizmetini devre dışı bırakır.', 'UserDataSvc'),
  serviceTweak('maps-broker', 'Haritalar', 'MapsBroker hizmetini devre dışı bırakır.', 'MapsBroker'),
  serviceTweak('dmwappush', 'WAP itme hizmeti', 'dmwappushservice hizmetini devre dışı bırakır.', 'dmwappushservice'),
];

const DEFINITIONS: Definition[] = [...NETWORK, ...PERFORMANCE, ...INTERFACE, ...PRIVACY, ...SERVICES];

const PROFILES: OptimizationProfile[] = [
  {
    id: 'competitive-gamer', title: 'Rekabetçi Oyuncu', icon: 'Gamepad2',
    description: 'Ağ gecikmesini azaltan ve oyun önceliğini artıran ayarlar; görsel efektler sadeleştirilir.',
    tweakIds: ['tcp-ack-frequency', 'tcp-no-delay', 'network-throttling-index', 'ecn', 'rsc', 'dca', 'dns-cache-ttl', 'tcp-timestamps', 'game-dvr', 'hags', 'mmcss', 'power-plan', 'visual-effects', 'min-animate'],
  },
  {
    id: 'low-latency-network', title: 'Düşük Gecikme Ağ', icon: 'Globe',
    description: 'NIC güç yönetimi, SMB/NetBIOS, DNS önbelleği ve TCP ayarları üzerinde odaklanır.',
    tweakIds: ['tcp-ack-frequency', 'tcp-no-delay', 'network-throttling-index', 'ecn', 'rsc', 'dns-cache-ttl', 'nic-power-saving', 'smb1', 'netbios', 'dca', 'tcp-timestamps'],
  },
  {
    id: 'balanced', title: 'Dengeli Optimizasyon', icon: 'Scale',
    description: 'Güvenlik ve kullanılabilirliği koruyan orta düzey performans ayarları.',
    tweakIds: ['game-dvr', 'mmcss', 'storage-sense', 'visual-effects', 'fast-startup', 'taskbar-search', 'snap-assist', 'recent-files', 'feedback-frequency', 'sysmain'],
  },
  {
    id: 'safe-privacy', title: 'Güvenli Gizlilik', icon: 'Lock',
    description: 'Telemetri, reklam kimliği, konum, Copilot/Recall ve gereksiz hizmetleri kapatır.',
    tweakIds: ['diagtrack', 'advertising-id', 'tailored-experiences', 'activity-history', 'web-search', 'cortana', 'copilot', 'recall', 'location', 'feedback-frequency', 'instrumentation', 'remote-registry', 'xbl-auth', 'dmwappush'],
  },
];

function definition(id: string): Definition {
  const found = DEFINITIONS.find((item) => item.id === id);
  if (!found) throw new Error(`Bilinmeyen sistem ayarı: ${id}`);
  return found;
}

export function tweakBackupFolder(): string {
  return path.join(app.getPath('userData'), 'tweak_backups');
}

function metaPath(id: string, stamp: string): string {
  return path.join(tweakBackupFolder(), `${id}_${stamp}.json`);
}

function readRows(): string {
  return DEFINITIONS.map((item) => {
    const expression = item.mode === 'registry'
      ? `Get-RegValue ${psLiteral(item.hive)} ${psLiteral(item.location)} ${psLiteral(item.name)}`
      : `& { ${item.read ?? "''"} }`;
    return `  [pscustomobject]@{ id = ${psLiteral(item.id)}; value = [string](${expression}) }`;
  }).join('\n');
}

const LIST_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
function Get-RegValue([string]$hiveName, [string]$subPath, [string]$valueName) {
  try {
    $hive = $(if ($hiveName -eq 'HKLM') { [Microsoft.Win32.RegistryHive]::LocalMachine } else { [Microsoft.Win32.RegistryHive]::CurrentUser })
    $key = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive, [Microsoft.Win32.RegistryView]::Registry64)
    $sub = $key.OpenSubKey($subPath)
    if (-not $sub) { return '' }
    $value = $sub.GetValue($valueName, $null)
    $sub.Close(); $key.Close()
    if ($null -eq $value) { return '' }
    return [string]$value
  } catch { return '' }
}
$rows = @(
${readRows()}
)
[pscustomobject]@{ rows = @($rows) } | ConvertTo-Json -Depth 4 -Compress
`;

async function readValues(): Promise<Map<string, string>> {
  try {
    const parsed = await powershellJson<{ rows?: Array<{ id: string; value: string }> | { id: string; value: string } }>(LIST_SCRIPT, undefined, 120_000);
    const raw = parsed?.rows;
    const rows = !raw ? [] : Array.isArray(raw) ? raw : [raw];
    return new Map(rows.map((row) => [row.id, String(row.value ?? '')]));
  } catch {
    return new Map();
  }
}

export async function listTweaks(): Promise<SystemTweak[]> {
  const values = await readValues();
  return DEFINITIONS.map((def) => {
    const current = values.get(def.id) ?? '';
    return {
      id: def.id, title: def.title, description: def.description, category: def.category,
      mode: def.mode, hive: def.hive, location: def.location, name: def.name, value: def.value,
      current, applied: current === def.value, admin: def.admin, rebootRequired: def.rebootRequired,
      original: current,
    };
  });
}

function backupRegistry(def: Definition, stamp: string): string {
  if (!def.backupKey) return '';
  const target = path.join(tweakBackupFolder(), `${def.id}_${stamp}.reg`);
  const result = spawnSync('reg.exe', ['export', def.backupKey, target, '/y'], { windowsHide: true });
  if (result.status === 0 && fs.existsSync(target) && fs.statSync(target).size >= 20) return target;
  // Anahtar hiç yoksa "yok" durumu da geçerli bir yedektir; geri alma değeri siler.
  const query = spawnSync('reg.exe', ['query', def.backupKey], { windowsHide: true, encoding: 'utf8' });
  if (query.status !== 0 && /ERROR|not found|bulunamad/i.test(String(query.stderr || '') + String(query.stdout || ''))) {
    fs.writeFileSync(target, `; ${def.backupKey} anahtarı değişiklik öncesinde yoktu.\r\n`, 'utf8');
    return target;
  }
  throw new Error(`Zorunlu kayıt defteri yedeği alınamadı (${def.backupKey}); değişiklik yapılmadı.`);
}

function registryScript(def: Definition, value: string): string {
  const hive = `HKEY_${def.hive === 'HKLM' ? 'LOCAL_MACHINE' : 'CURRENT_USER'}`;
  const key = `Registry::${hive}\\${def.location}`.replace(/'/g, "''");
  if (value === '') {
    return `Remove-ItemProperty -LiteralPath '${key}' -Name ${psLiteral(def.name)} -ErrorAction SilentlyContinue\n'TWEAK_OK'`;
  }
  const type = def.type === 'String' ? 'String' : def.type === 'QWord' ? 'QWord' : 'DWord';
  const literal = type === 'String' ? psLiteral(value) : `${type === 'QWord' ? '[uint64]' : '[int]'}${/^-?\d+$/.test(value) ? value : '0'}`;
  return `New-Item -Path '${key}' -Force | Out-Null\n` +
    `New-ItemProperty -LiteralPath '${key}' -Name ${psLiteral(def.name)} -Value ${literal} -PropertyType ${type} -Force | Out-Null\n'TWEAK_OK'`;
}

export async function setTweak(id: string, apply: boolean, onLine?: LogFn): Promise<TweakActionResult> {
  const def = definition(id);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = metaPath(id, stamp);
  let backupPath = '';
  let current = '';
  try {
    fs.mkdirSync(tweakBackupFolder(), { recursive: true });
    const values = await readValues();
    current = values.get(id) ?? '';
    backupPath = backupRegistry(def, stamp);

    let original = current;
    if (!apply) {
      const previous = fs.readdirSync(tweakBackupFolder())
        .filter((name) => name.startsWith(`${id}_`) && name.endsWith('.json'))
        .sort()
        .pop();
      if (previous) {
        const meta = JSON.parse(fs.readFileSync(path.join(tweakBackupFolder(), previous), 'utf8')) as { original?: string };
        if (typeof meta.original === 'string') original = meta.original;
      }
      fs.writeFileSync(file, JSON.stringify({ original, at: new Date().toISOString(), reverted: true }, null, 2), 'utf8');
    } else {
      fs.writeFileSync(file, JSON.stringify({ original, at: new Date().toISOString(), applied: true }, null, 2), 'utf8');
    }

    let script: string;
    if (def.mode === 'registry') {
      script = registryScript(def, apply ? def.value : original);
    } else if (apply) {
      script = (def.apply ?? "'TWEAK_OK'").replace('__META__', psLiteral(file));
    } else {
      script = (def.revert ?? "'TWEAK_OK'").replace('__ORIGINAL__', psLiteral(original));
    }
    onLine?.(`${def.title}: ${apply ? 'uygulanıyor' : 'geri alınıyor'}`);
    const result = await runPowerShell(script, onLine, 120_000);
    const text = `${result.text}\n${result.stderr}`;
    const ok = result.code === 0 && /TWEAK_OK|META_OK/.test(text);
    if (!ok) throw new Error(text.trim().slice(-300) || 'Ayar uygulanamadı.');

    // Komut tabanlı ayarlar kendi özgün durumlarını JSON içine yazabilir.
    if (apply && def.mode === 'command' && fs.existsSync(file)) {
      try {
        const meta = JSON.parse(fs.readFileSync(file, 'utf8')) as { original?: string };
        if (typeof meta.original === 'string') original = meta.original;
        fs.writeFileSync(file, JSON.stringify({ original, at: new Date().toISOString(), applied: true }, null, 2), 'utf8');
      } catch { /* meta zaten geçerli varsayılanı korur */ }
    }

    return {
      id, ok: true, applied: apply, current: apply ? def.value : original,
      backupPath: backupPath || file, message: apply ? 'Ayar uygulandı.' : 'Özgün ayar geri yüklendi.',
      rebootRequired: def.rebootRequired,
    };
  } catch (error) {
    return {
      id, ok: false, applied: apply, current, backupPath: backupPath || file,
      message: (error as Error).message.slice(0, 300), rebootRequired: false,
    };
  }
}

export function profileList(): OptimizationProfile[] {
  return PROFILES.map((profile) => ({
    ...profile,
    tweakIds: profile.tweakIds.filter((id) => DEFINITIONS.some((def) => def.id === id)),
  }));
}

export async function applyProfile(id: ProfileId, apply: boolean, onLine?: LogFn): Promise<ProfileApplyResult> {
  const profile = PROFILES.find((item) => item.id === id);
  if (!profile) throw new Error('Bilinmeyen optimizasyon profili.');
  const applied: string[] = [];
  const failed: Array<{ id: string; message: string }> = [];
  let rebootRequired = false;
  const ids = apply ? profile.tweakIds : [...profile.tweakIds].reverse();
  for (const tweakId of ids) {
    const result = await setTweak(tweakId, apply, onLine);
    if (result.ok) {
      applied.push(tweakId);
      rebootRequired = rebootRequired || result.rebootRequired;
    } else {
      failed.push({ id: tweakId, message: result.message });
    }
  }
  return {
    id, ok: failed.length === 0, applied, failed,
    backupPath: tweakBackupFolder(), rebootRequired,
    message: failed.length === 0
      ? `${profile.title} profili ${apply ? 'uygulandı' : 'geri alındı'}: ${applied.length} ayar.`
      : `${applied.length} ayar tamamlandı, ${failed.length} ayar başarısız. Ayrıntıları inceleyin.`,
  };
}

/** Yalnızca test/doğrulama için kullanılır. */
export function tweakDefinitionCounts(): Record<TweakCategory, number> {
  const counts = Object.fromEntries(TWEAK_CATEGORIES.map((category) => [category, 0])) as Record<TweakCategory, number>;
  for (const def of DEFINITIONS) counts[def.category] += 1;
  return counts;
}

export function tweakDefinitionIds(): string[] {
  return DEFINITIONS.map((def) => def.id);
}

export function profileIds(): ProfileId[] {
  return [...PROFILE_IDS];
}
