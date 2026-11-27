import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type {
  OptimizationProfile, ProfileApplyResult, ProfileId, SystemTweak, TweakActionResult, TweakCategory,
} from '../../shared/types';
import { PROFILE_IDS, TWEAK_CATEGORIES } from '../../shared/types';
import { LogFn, powershellJson, psLiteral, runPowerShell } from '../util';
import { m, mf } from '../i18n-main';

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
  reg('tcp-ack-frequency', m('TCPAckFrequency', 'TCPAckFrequency'), m('Gecikmeli ACK yerine anında onay; bazı oyunlarda gecikmeyi azaltır.', 'Immediate acknowledgement instead of delayed ACK; can reduce latency in some games.'), 'network', 'HKLM', TCP, 'TcpAckFrequency', '1'),
  reg('tcp-no-delay', m('TcpNoDelay', 'TcpNoDelay'), m('Nagle algoritmasını kapatır; küçük paketler anında gönderilir.', 'Disables Nagle’s algorithm; small packets are sent immediately.'), 'network', 'HKLM', TCP, 'TcpNoDelay', '1'),
  reg('network-throttling-index', m('NetworkThrottlingIndex', 'NetworkThrottlingIndex'), m('Multimedia ağ kısıtlamasını kaldırır (0xFFFFFFFF).', 'Removes multimedia network throttling (0xFFFFFFFF).'), 'network', 'HKLM', MULTIMEDIA, 'NetworkThrottlingIndex', '4294967295', 'QWord'),
  reg('ecn', m('ECN', 'ECN'), m('Açık tıkanıklık bildirimini etkinleştirir.', 'Enables Explicit Congestion Notification.'), 'network', 'HKLM', TCP, 'EnableECN', '1'),
  cmd('rsc', m('Receive Segment Coalescing', 'Receive Segment Coalescing'), m('RSC birleştirmeyi kapatır; yüksek hızlı NIC’lerde gecikmeyi azaltabilir.', 'Disables RSC coalescing; may reduce latency on high-speed NICs.'),
    'network',
    `$o = (& netsh.exe int tcp show global) -join '\\n'; if ($o -match '(?i)Receive Segment Coalescing[^:]*:\\s*(\\w+)') { $Matches[1].ToLowerInvariant() } else { '' }`,
    `& netsh.exe int tcp set global rsc=disabled | Out-Null; 'META_OK'`,
    `$v = __ORIGINAL__; if ($v) { & netsh.exe int tcp set global rsc=$v | Out-Null }; 'META_OK'`,
    'disabled', true, true, TCP),
  reg('dns-cache-ttl', m('DNS önbellek süresi', 'DNS cache lifetime'), m('DNS yanıtlarının önbellekte tutulma süresini uzatır (MaxCacheTtl).', 'Extends how long DNS responses are cached (MaxCacheTtl).'), 'network', 'HKLM', DNSCACHE, 'MaxCacheTtl', '86400'),
  cmd('nic-power-saving', m('NIC güç tasarrufu', 'NIC power saving'), m('Etkin fiziksel ağ bağdaştırıcılarında Green Ethernet / EEE özelliklerini kapatır.', 'Disables Green Ethernet / EEE features on active physical network adapters.'),
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
  reg('smb1', m('SMBv1', 'SMBv1'), m('SMBv1 protokolünü kapatır; modern Windows sürümleriyle uyumludur.', 'Disables the SMBv1 protocol; compatible with modern Windows versions.'), 'network', 'HKLM', 'SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters', 'SMB1', '0', 'DWord', true),
  cmd('netbios', m('NetBIOS over TCP/IP', 'NetBIOS over TCP/IP'), m('Tüm TCP/IP arabirimlerinde NetBIOS’u kapatır (NetbiosOptions=2).', 'Disables NetBIOS on all TCP/IP interfaces (NetbiosOptions=2).'), 'network',
    `$k = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\NetBT\\Parameters\\Interfaces\\Tcpip_*'; ` +
    `$v = @(Get-ItemProperty -Path $k -ErrorAction SilentlyContinue); if ($v.Count -gt 0 -and @($v | Where-Object { $_.NetbiosOptions -ne 2 }).Count -eq 0) { '2' } else { '0' }`,
    `$k = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\NetBT\\Parameters\\Interfaces\\Tcpip_*'; ` +
    `Get-ChildItem -Path $k -ErrorAction SilentlyContinue | ForEach-Object { New-ItemProperty -Path $_.PSPath -Name NetbiosOptions -Value 2 -PropertyType DWord -Force | Out-Null }; 'META_OK'`,
    `$v = __ORIGINAL__; $k = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\NetBT\\Parameters\\Interfaces\\Tcpip_*'; ` +
    `if ($v -eq '2') { Get-ChildItem -Path $k -ErrorAction SilentlyContinue | ForEach-Object { New-ItemProperty -Path $_.PSPath -Name NetbiosOptions -Value 0 -PropertyType DWord -Force | Out-Null } }; 'META_OK'`,
    '2', true, true, 'SYSTEM\\CurrentControlSet\\Services\\NetBT\\Parameters\\Interfaces'),
  cmd('dca', m('Data Center TCP (DCA)', 'Data Center TCP (DCA)'), m('Veri merkezi TCP algoritmasını kapatır; masaüstü/gaming için önerilir.', 'Disables the Data Center TCP algorithm; recommended for desktop and gaming.'), 'network',
    `$o = (& netsh.exe int tcp show global) -join '\\n'; if ($o -match '(?i)DCA[^:]*:\\s*(\\w+)') { $Matches[1].ToLowerInvariant() } else { '' }`,
    `& netsh.exe int tcp set global dca=disabled | Out-Null; 'META_OK'`,
    `$v = __ORIGINAL__; if ($v) { & netsh.exe int tcp set global dca=$v | Out-Null }; 'META_OK'`,
    'disabled', true, false, TCP),
  reg('tcp-timestamps', m('TCP zaman damgaları', 'TCP timestamps'), m('RFC 7323 zaman damgalarını etkinleştirir (Tcp1323Opts=1).', 'Enables RFC 7323 timestamps (Tcp1323Opts=1).'), 'network', 'HKLM', TCP, 'Tcp1323Opts', '1'),
];

/** Sistem & Performans — 14 */
const PERFORMANCE: Definition[] = [
  reg('game-dvr', m('GameDVR', 'GameDVR'), m('Oyun kaydını ve arka plan yakalamayı kapatır.', 'Disables game recording and background capture.'), 'performance', 'HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR', 'AppCaptureEnabled', '0'),
  reg('hags', m('Donanım hızlandırılmış GPU zamanlama', 'Hardware-accelerated GPU scheduling'), m('HAGS’ı etkinleştirir (HwSchMode=2); destekleyen sürücülerde gecikmeyi azaltır.', 'Enables HAGS (HwSchMode=2); reduces latency on supported drivers.'), 'performance', 'HKLM', 'SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers', 'HwSchMode', '2', 'DWord', true),
  reg('mmcss', m('Multimedia önceliği', 'Multimedia priority'), m('Multimedia alt sisteminin CPU payını optimize eder (SystemResponsiveness=10).', 'Optimizes the CPU share of the multimedia subsystem (SystemResponsiveness=10).'), 'performance', 'HKLM', MULTIMEDIA, 'SystemResponsiveness', '10'),
  cmd('power-plan', m('Yüksek performans güç planı', 'High-performance power plan'), m('Aktif güç planını Yüksek performans olarak ayarlar; özgün plan GUID’i saklanır.', 'Sets the active power plan to High performance; the original plan GUID is saved.'), 'performance',
    `$o = (& powercfg.exe /getactivescheme) -join ' '; if ($o -match '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})') { $Matches[1].ToLowerInvariant() } else { '' }`,
    `& powercfg.exe /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c | Out-Null; 'META_OK'`,
    `$v = __ORIGINAL__; if ($v) { & powercfg.exe /setactive $v | Out-Null }; 'META_OK'`,
    '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c', true, true, 'SYSTEM\\CurrentControlSet\\Control\\Power\\User\\PowerSchemes'),
  cmd('ntfs-8dot3', m('NTFS 8.3 kısa adlar', 'NTFS 8.3 short names'), m('8.3 dosya adı üretimini kapatır (fsutil behavior set disable8dot3 1).', 'Disables 8.3 file name generation (fsutil behavior set disable8dot3 1).'), 'performance',
    `$o = (& fsutil.exe behavior query disable8dot3) -join ' '; if ($o -match '(\\d+)') { $Matches[1] } else { '' }`,
    `& fsutil.exe behavior set disable8dot3 1 | Out-Null; 'META_OK'`,
    `$v = __ORIGINAL__; if ($v) { & fsutil.exe behavior set disable8dot3 $v | Out-Null }; 'META_OK'`,
    '1', true, true),
  cmd('last-access', m('NTFS son erişim zamanı', 'NTFS last access time'), m('Son erişim damgası güncellemelerini kapatır (disablelastaccess=1).', 'Disables last-access timestamp updates (disablelastaccess=1).'), 'performance',
    `$o = (& fsutil.exe behavior query disablelastaccess) -join ' '; if ($o -match '(\\d+)') { $Matches[1] } else { '' }`,
    `& fsutil.exe behavior set disablelastaccess 1 | Out-Null; 'META_OK'`,
    `$v = __ORIGINAL__; if ($v) { & fsutil.exe behavior set disablelastaccess $v | Out-Null }; 'META_OK'`,
    '1', true, false),
  cmd('hibernation', m('Hibernasyon', 'Hibernation'), m('Hiberfil.sys alanını kaldırır (powercfg /hibernate off).', 'Removes the Hiberfil.sys file and frees its space (powercfg /hibernate off).'), 'performance',
    `$o = (& powercfg.exe /a) -join ' '; if ($o -match '(?i)hibernation available') { '1' } else { '0' }`,
    `& powercfg.exe /hibernate off | Out-Null; 'META_OK'`,
    `& powercfg.exe /hibernate on | Out-Null; 'META_OK'`,
    '0', true, true, 'SYSTEM\\CurrentControlSet\\Control\\Power'),
  reg('fast-startup', m('Hızlı başlatma', 'Fast startup'), m('Hızlı başlatmayı kapatır; kapanış/Güvenli Mod sorunlarını azaltır.', 'Disables fast startup; reduces shutdown and Safe Mode issues.'), 'performance', 'HKLM', `${SESSION}\\Power`, 'HiberbootEnabled', '0', 'DWord', true),
  reg('background-apps', m('Arka plan uygulamaları', 'Background apps'), m('Uygulamaların arka planda çalışmasını genel olarak kapatır.', 'Globally prevents apps from running in the background.'), 'performance', 'HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications', 'GlobalUserDisabled', '1'),
  serviceTweak('sysmain', m('SysMain (Superfetch)', 'SysMain (Superfetch)'), m('SysMain hizmetini devre dışı bırakır; özgün başlangıç türü saklanır.', 'Disables the SysMain service; the original startup type is saved.'), 'SysMain', 'performance'),
  reg('storage-sense', m('Depolama Algısı', 'Storage Sense'), m('Otomatik Depolama Algısı temizliğini kapatır.', 'Disables automatic Storage Sense cleanup.'), 'performance', 'HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\StorageSense\\Parameters\\StoragePolicy', '01', '0'),
  reg('visual-effects', m('Görsel efektler', 'Visual effects'), m('En iyi performans görsel efekt profilini uygular (VisualFXSetting=2).', 'Applies the best-performance visual effects profile (VisualFXSetting=2).'), 'performance', 'HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects', 'VisualFXSetting', '2'),
  reg('disable-paging-executive', m('Çekirdek sayfalanması', 'Kernel paging'), m('Çekirdek kodunun diskine yazılmasını engeller (DisablePagingExecutive=1).', 'Prevents kernel code from being paged to disk (DisablePagingExecutive=1).'), 'performance', 'HKLM', `${SESSION}\\Memory Management`, 'DisablePagingExecutive', '1', 'DWord', true),
  reg('min-animate', m('Pencere animasyonları', 'Window animations'), m('Pencere aç/kapat animasyonlarını kapatır.', 'Disables window open/close animations.'), 'performance', 'HKCU', 'Control Panel\\Desktop\\WindowMetrics', 'MinAnimate', '0'),
];

/** Arayüz & Deneyim — 17 */
const INTERFACE: Definition[] = [
  cmd('classic-context-menu', m('Klasik sağ tık menüsü', 'Classic right-click menu'), m('Windows 11 için Windows 10 tarzı klasik Gezgin menüsünü etkinleştirir.', 'Enables the classic Windows 10-style File Explorer menu on Windows 11.'), 'interface',
    `$v = Get-ItemProperty -Path 'HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32' -ErrorAction SilentlyContinue; if ($v) { '1' } else { '0' }`,
    `New-Item -Path 'HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32' -Force | Out-Null; 'META_OK'`,
    `Remove-Item -Path 'HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32' -Force -ErrorAction SilentlyContinue; 'META_OK'`,
    '1', false, true, 'Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}'),
  reg('taskbar-alignment', m('Görev çubuğu hizası', 'Taskbar alignment'), m('Windows 11 görev çubuğu simgelerini sola hizalar (TaskbarAl=0).', 'Left-aligns Windows 11 taskbar icons (TaskbarAl=0).'), 'interface', 'HKCU', ADVANCED, 'TaskbarAl', '0'),
  reg('taskbar-search', m('Görev çubuğu arama', 'Taskbar search'), m('Görev çubuğundaki arama kutusunu gizler.', 'Hides the search box on the taskbar.'), 'interface', 'HKCU', ADVANCED, 'SearchboxTaskbarMode', '0'),
  reg('taskbar-chat', m('Görev çubuğu sohbet', 'Taskbar chat'), m('Windows 11 sohbet (Teams) düğmesini gizler.', 'Hides the Windows 11 Chat (Teams) button.'), 'interface', 'HKCU', ADVANCED, 'TaskbarMn', '0'),
  reg('taskbar-small-icons', m('Küçük görev çubuğu simgeleri', 'Small taskbar icons'), m('Windows 10 görev çubuğunda küçük simge düzenini uygular.', 'Applies the small icon layout on the Windows 10 taskbar.'), 'interface', 'HKCU', ADVANCED, 'TaskbarSmallIcons', '1'),
  reg('taskbar-task-view', m('Görev görünümü düğmesi', 'Task View button'), m('Görev çubuğundaki Görev Görünümü düğmesini gizler.', 'Hides the Task View button on the taskbar.'), 'interface', 'HKCU', ADVANCED, 'ShowTaskViewButton', '0'),
  reg('explorer-launch-to', m('Gezgin açılış sayfası', 'Explorer startup page'), m('Dosya Gezgini’ni Bu Bilgisayar ile açar.', 'Opens File Explorer to This PC.'), 'interface', 'HKCU', ADVANCED, 'LaunchTo', '1'),
  reg('explorer-status-bar', m('Gezgin durum çubuğu', 'Explorer status bar'), m('Dosya Gezgini durum çubuğunu gösterir.', 'Shows the File Explorer status bar.'), 'interface', 'HKCU', ADVANCED, 'ShowStatusBar', '1'),
  reg('recent-files', m('Son dosyalar', 'Recent files'), m('Başlat menüsünde son açılan belgeleri gizler.', 'Hides recently opened documents from the Start menu.'), 'interface', 'HKCU', ADVANCED, 'Start_TrackDocs', '0'),
  reg('frequent-apps', m('Sık kullanılan uygulamalar', 'Most used apps'), m('Başlat menüsünde sık kullanılan uygulama listesini kapatır.', 'Turns off the most-used app list on the Start menu.'), 'interface', 'HKCU', ADVANCED, 'Start_TrackProgs', '0'),
  reg('snap-assist', m('Snap Assist', 'Snap Assist'), m('Pencere yapıştırma önerilerini etkinleştirir.', 'Enables window snapping suggestions.'), 'interface', 'HKCU', ADVANCED, 'SnapAssist', '1'),
  reg('snap-flyout', m('Snap açılır paneli', 'Snap flyout'), m('Yapıştırma düzenleri açılır panelini kapatır.', 'Turns off the snap layouts flyout panel.'), 'interface', 'HKCU', ADVANCED, 'EnableSnapAssistFlyout', '0'),
  reg('verbose-status', m('Ayrıntılı açılış/kapanış durumu', 'Verbose startup/shutdown status'), m('Açılış ve kapanış sırasında ayrıntılı durum iletilerini gösterir.', 'Shows detailed status messages during startup and shutdown.'), 'interface', 'HKLM', POLICIES_SYSTEM, 'VerboseStatus', '1'),
  cmd('dark-mode', m('Koyu mod', 'Dark mode'), m('Uygulama ve sistem temasını koyuya ayarlar; özgün değerler saklanır.', 'Sets app and system themes to dark; original values are saved.'), 'interface',
    `$p='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize'; $a=(Get-ItemProperty -Path $p -ErrorAction SilentlyContinue).AppsUseLightTheme; $s=(Get-ItemProperty -Path $p -ErrorAction SilentlyContinue).SystemUsesLightTheme; "$a|$s"`,
    `$p='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize'; New-ItemProperty -Path $p -Name AppsUseLightTheme -Value 0 -PropertyType DWord -Force | Out-Null; New-ItemProperty -Path $p -Name SystemUsesLightTheme -Value 0 -PropertyType DWord -Force | Out-Null; 'META_OK'`,
    `$v=__ORIGINAL__; $p='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize'; $x=$v.Split('|'); ` +
    `if ($x[0] -ne '') { New-ItemProperty -Path $p -Name AppsUseLightTheme -Value ([int]$x[0]) -PropertyType DWord -Force | Out-Null }; ` +
    `if ($x.Length -gt 1 -and $x[1] -ne '') { New-ItemProperty -Path $p -Name SystemUsesLightTheme -Value ([int]$x[1]) -PropertyType DWord -Force | Out-Null }; 'META_OK'`,
    '0|0', false, false, 'Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize'),
  reg('titlebar-accent', m('Başlık çubuğu vurgusu', 'Title bar accent'), m('Pencerelerde vurgu rengini başlık çubuğuna uygular.', 'Applies the accent color to window title bars.'), 'interface', 'HKCU', 'Software\\Microsoft\\Windows\\DWM', 'ColorPrevalence', '1'),
  reg('transparency', m('Şeffaflık efektleri', 'Transparency effects'), m('Windows şeffaflık efektlerini kapatır.', 'Disables Windows transparency effects.'), 'interface', 'HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', 'EnableTransparency', '0'),
  cmd('show-seconds', m('Saatte saniye', 'Show seconds in clock'), m('Görev çubuğu saatine saniye gösterir; özgün biçim saklanır.', 'Shows seconds in the taskbar clock; the original format is saved.'), 'interface',
    `$v = (Get-ItemProperty -Path 'HKCU:\\Control Panel\\International' -ErrorAction SilentlyContinue).sTimeFormat; if ($v) { [string]$v } else { '' }`,
    `$p='HKCU:\\Control Panel\\International'; $v=(Get-ItemProperty -Path $p -Name sTimeFormat -ErrorAction SilentlyContinue).sTimeFormat; if (-not $v) { $v='HH:mm:ss' }; ` +
    `$new = if ($v -like '*ss*') { $v } else { $v -replace 'mm', 'mm:ss' }; Set-ItemProperty -Path $p -Name sTimeFormat -Value $new -ErrorAction SilentlyContinue; 'META_OK'`,
    `$v = __ORIGINAL__; if ($v) { Set-ItemProperty -Path 'HKCU:\\Control Panel\\International' -Name sTimeFormat -Value $v -ErrorAction SilentlyContinue }; 'META_OK'`,
    'HH:mm:ss', false, false, 'Control Panel\\International'),
];

/** Gizlilik & Telemetri — 11 */
const PRIVACY: Definition[] = [
  serviceTweak('diagtrack', m('Tanılama hizmeti (DiagTrack)', 'Diagnostic service (DiagTrack)'), m('Connected User Experiences and Telemetry hizmetini devre dışı bırakır.', 'Disables the Connected User Experiences and Telemetry service.'), 'DiagTrack', 'privacy'),
  reg('advertising-id', m('Reklam kimliği', 'Advertising ID'), m('Uygulamaların kişiselleştirilmiş reklam kimliğini kullanmasını engeller.', 'Prevents apps from using the personalized advertising ID.'), 'privacy', 'HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo', 'Enabled', '0'),
  reg('tailored-experiences', m('Uyarlanmış deneyimler', 'Tailored experiences'), m('Tanılama verisiyle kişiselleştirilmiş önerileri kapatır.', 'Turns off personalized offers based on diagnostic data.'), 'privacy', 'HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\Privacy', 'TailoredExperiencesWithDiagnosticDataEnabled', '0'),
  reg('activity-history', m('Etkinlik geçmişi', 'Activity history'), m('Etkinlik akışını ve bulut eşitlemesini kapatır.', 'Disables the activity feed and cloud synchronization.'), 'privacy', 'HKLM', 'SOFTWARE\\Policies\\Microsoft\\Windows\\System', 'EnableActivityFeed', '0'),
  reg('web-search', m('Web arama önerileri', 'Web search suggestions'), m('Başlat menüsünde Bing/web sonuçlarını gizler.', 'Hides Bing/web results from the Start menu.'), 'privacy', 'HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\Search', 'BingSearchEnabled', '0'),
  reg('cortana', m('Cortana / arama asistanı', 'Cortana / search assistant'), m('Arama asistanı onayını kapatır.', 'Turns off search assistant consent.'), 'privacy', 'HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\Search', 'CortanaConsent', '0'),
  reg('copilot', m('Copilot düğmesi', 'Copilot button'), m('Görev çubuğundaki Copilot düğmesini gizler.', 'Hides the Copilot button on the taskbar.'), 'privacy', 'HKCU', ADVANCED, 'ShowCopilotButton', '0'),
  reg('recall', m('Windows Recall', 'Windows Recall'), m('Recall özelliğini ilke ile devre dışı bırakır.', 'Disables the Recall feature via policy.'), 'privacy', 'HKLM', 'SOFTWARE\\Policies\\Microsoft\\Windows\\Recall', 'DisableRecall', '1'),
  reg('location', m('Konum izinleri', 'Location permissions'), m('Konum izin deposunu Deny olarak ayarlar.', 'Sets the location consent store to Deny.'), 'privacy', 'HKLM', 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\location', 'Value', 'Deny', 'String'),
  reg('feedback-frequency', m('Geri bildirim sıklığı', 'Feedback frequency'), m('Windows geri bildirim istemlerini en aza indirger.', 'Minimizes Windows feedback prompts.'), 'privacy', 'HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\Feedback', 'FeedbackFrequency', '0'),
  reg('instrumentation', m('Kullanım telemetrisi', 'Usage telemetry'), m('Windows kullanım ölçümünü (NoInstrumentation) kapatır.', 'Disables Windows usage instrumentation (NoInstrumentation).'), 'privacy', 'HKLM', 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer', 'NoInstrumentation', '1'),
];

/** Servis Yönetimi — 10 */
const SERVICES: Definition[] = [
  serviceTweak('spooler', m('Yazdırma Biriktiricisi', 'Print Spooler'), m('Spooler hizmetini devre dışı bırakır; yazdırma gerekirse geri açılabilir.', 'Disables the Spooler service; can be re-enabled if printing is needed.'), 'Spooler'),
  serviceTweak('fax', m('Faks', 'Fax'), m('Faks hizmetini devre dışı bırakır.', 'Disables the Fax service.'), 'Fax'),
  serviceTweak('remote-registry', m('Uzak Kayıt Defteri', 'Remote Registry'), m('RemoteRegistry hizmetini devre dışı bırakır; uzaktan kayıt defteri erişimini kapatır.', 'Disables the RemoteRegistry service and closes remote registry access.'), 'RemoteRegistry'),
  serviceTweak('xbl-auth', m('Xbox Live kimlik doğrulama', 'Xbox Live authentication'), m('XblAuthManager hizmetini devre dışı bırakır.', 'Disables the XblAuthManager service.'), 'XblAuthManager'),
  serviceTweak('xbl-game-save', m('Xbox oyun kaydı', 'Xbox game save'), m('XblGameSave hizmetini devre dışı bırakır.', 'Disables the XblGameSave service.'), 'XblGameSave'),
  serviceTweak('xbox-gip', m('Xbox giriş cihazı', 'Xbox input device'), m('XboxGipSvc hizmetini devre dışı bırakır.', 'Disables the XboxGipSvc service.'), 'XboxGipSvc'),
  serviceTweak('bluetooth-user', m('Bluetooth kullanıcı hizmeti', 'Bluetooth user service'), m('BluetoothUserService hizmetini devre dışı bırakır; Bluetooth gerekirse geri açılabilir.', 'Disables the BluetoothUserService service; can be re-enabled if Bluetooth is needed.'), 'BluetoothUserService'),
  serviceTweak('user-data-svc', m('Bağlı kullanıcı deneyimleri', 'Connected user experiences'), m('UserDataSvc hizmetini devre dışı bırakır.', 'Disables the UserDataSvc service.'), 'UserDataSvc'),
  serviceTweak('maps-broker', m('Haritalar', 'Maps'), m('MapsBroker hizmetini devre dışı bırakır.', 'Disables the MapsBroker service.'), 'MapsBroker'),
  serviceTweak('dmwappush', m('WAP itme hizmeti', 'WAP push service'), m('dmwappushservice hizmetini devre dışı bırakır.', 'Disables the dmwappushservice service.'), 'dmwappushservice'),
];

const DEFINITIONS: Definition[] = [...NETWORK, ...PERFORMANCE, ...INTERFACE, ...PRIVACY, ...SERVICES];

const PROFILES: OptimizationProfile[] = [
  {
    id: 'competitive-gamer', title: m('Rekabetçi Oyuncu', 'Competitive Gamer'), icon: 'Gamepad2',
    description: m('Ağ gecikmesini azaltan ve oyun önceliğini artıran ayarlar; görsel efektler sadeleştirilir.', 'Settings that reduce network latency and increase gaming priority; visual effects are simplified.'),
    tweakIds: ['tcp-ack-frequency', 'tcp-no-delay', 'network-throttling-index', 'ecn', 'rsc', 'dca', 'dns-cache-ttl', 'tcp-timestamps', 'game-dvr', 'hags', 'mmcss', 'power-plan', 'visual-effects', 'min-animate'],
  },
  {
    id: 'low-latency-network', title: m('Düşük Gecikme Ağ', 'Low-Latency Network'), icon: 'Globe',
    description: m('NIC güç yönetimi, SMB/NetBIOS, DNS önbelleği ve TCP ayarları üzerinde odaklanır.', 'Focuses on NIC power management, SMB/NetBIOS, DNS caching and TCP settings.'),
    tweakIds: ['tcp-ack-frequency', 'tcp-no-delay', 'network-throttling-index', 'ecn', 'rsc', 'dns-cache-ttl', 'nic-power-saving', 'smb1', 'netbios', 'dca', 'tcp-timestamps'],
  },
  {
    id: 'balanced', title: m('Dengeli Optimizasyon', 'Balanced Optimization'), icon: 'Scale',
    description: m('Güvenlik ve kullanılabilirliği koruyan orta düzey performans ayarları.', 'Moderate performance settings that preserve security and usability.'),
    tweakIds: ['game-dvr', 'mmcss', 'storage-sense', 'visual-effects', 'fast-startup', 'taskbar-search', 'snap-assist', 'recent-files', 'feedback-frequency', 'sysmain'],
  },
  {
    id: 'safe-privacy', title: m('Güvenli Gizlilik', 'Privacy Focused'), icon: 'Lock',
    description: m('Telemetri, reklam kimliği, konum, Copilot/Recall ve gereksiz hizmetleri kapatır.', 'Turns off telemetry, the advertising ID, location, Copilot/Recall and unnecessary services.'),
    tweakIds: ['diagtrack', 'advertising-id', 'tailored-experiences', 'activity-history', 'web-search', 'cortana', 'copilot', 'recall', 'location', 'feedback-frequency', 'instrumentation', 'remote-registry', 'xbl-auth', 'dmwappush'],
  },
];

function definition(id: string): Definition {
  const found = DEFINITIONS.find((item) => item.id === id);
  if (!found) throw new Error(mf('Bilinmeyen sistem ayarı: {id}', 'Unknown system setting: {id}', { id }));
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
  throw new Error(mf('Zorunlu kayıt defteri yedeği alınamadı ({key}); değişiklik yapılmadı.', 'Required registry backup could not be created ({key}); no changes were made.', { key: def.backupKey }));
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
    onLine?.(mf('{title}: {action}', '{title}: {action}', { title: def.title, action: apply ? m('uygulanıyor', 'applying') : m('geri alınıyor', 'reverting') }));
    const result = await runPowerShell(script, onLine, 120_000);
    const text = `${result.text}\n${result.stderr}`;
    const ok = result.code === 0 && /TWEAK_OK|META_OK/.test(text);
    if (!ok) throw new Error(text.trim().slice(-300) || m('Ayar uygulanamadı.', 'The setting could not be applied.'));

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
      backupPath: backupPath || file, message: apply ? m('Ayar uygulandı.', 'Setting applied.') : m('Özgün ayar geri yüklendi.', 'Original setting restored.'),
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
  if (!profile) throw new Error(m('Bilinmeyen optimizasyon profili.', 'Unknown optimization profile.'));
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
      ? mf('{title} profili {status}: {count} ayar.', '{title} profile {status}: {count} settings.', { title: profile.title, status: apply ? m('uygulandı', 'applied') : m('geri alındı', 'reverted'), count: applied.length })
      : mf('{ok} ayar tamamlandı, {bad} ayar başarısız. Ayrıntıları inceleyin.', '{ok} settings completed, {bad} settings failed. Review the details.', { ok: applied.length, bad: failed.length }),
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
