import type { PackageSource } from './types';

export interface RecommendedSoftware {
  name: string;
  ident: string;
  category: string;
  description: string;
  essential?: boolean;
  homepage?: string;
  /** Vektör marka ikonu; boşsa homepage favicon'una düşülür. */
  icon?: string;
  /** Boşsa winget kullanılır. */
  source?: PackageSource;
}

/** Simple Icons vektör logosu (sürüm sabitlenmiştir; kartlarda keskin görünür). */
const brandIcon = (slug: string): string => `https://cdn.jsdelivr.net/npm/simple-icons@16.38.1/icons/${slug}.svg`;

/** Marka logosu olmayan araçlar için yerel, çevrimdışı çalışan harf ikonu. */
const initialIcon = (label: string, color: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${color}"/><text x="32" y="44" font-family="Segoe UI,Arial,sans-serif" font-size="36" font-weight="700" text-anchor="middle" fill="#fff">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

// Tüm kimlikler winget 1.29 ile `winget show --id ... --exact` kullanılarak doğrulanmıştır.
export const CATALOG: RecommendedSoftware[] = [
  // Sistem & Çalışma Zamanı
  { name: '7-Zip', ident: '7zip.7zip', category: 'Sistem & Çalışma Zamanı', description: 'Dosya sıkıştırma/arşivleme', essential: true, icon: brandIcon('7zip'), homepage: 'https://www.7-zip.org' },
  { name: 'Visual C++ 2015-2022 (x64)', ident: 'Microsoft.VCRedist.2015+.x64', category: 'Sistem & Çalışma Zamanı', description: 'Oyun ve programlar için 64-bit kütüphane', essential: true, homepage: 'https://learn.microsoft.com' },
  { name: 'Visual C++ 2015-2022 (x86)', ident: 'Microsoft.VCRedist.2015+.x86', category: 'Sistem & Çalışma Zamanı', description: '32-bit programlar için kütüphane', essential: true, homepage: 'https://learn.microsoft.com' },
  { name: 'Visual C++ 2013', ident: 'Microsoft.VCRedist.2013.x64', category: 'Sistem & Çalışma Zamanı', description: 'Eski uygulamalar için C++ kütüphanesi', homepage: 'https://learn.microsoft.com' },
  { name: 'Visual C++ 2013 (x86)', ident: 'Microsoft.VCRedist.2013.x86', category: 'Sistem & Çalışma Zamanı', description: 'Eski 32-bit uygulamalar için kütüphane', homepage: 'https://learn.microsoft.com' },
  { name: 'Visual C++ 2012', ident: 'Microsoft.VCRedist.2012.x64', category: 'Sistem & Çalışma Zamanı', description: 'Eski uygulamalar için C++ kütüphanesi', homepage: 'https://learn.microsoft.com' },
  { name: 'Visual C++ 2012 (x86)', ident: 'Microsoft.VCRedist.2012.x86', category: 'Sistem & Çalışma Zamanı', description: 'Eski 32-bit uygulamalar için kütüphane', homepage: 'https://learn.microsoft.com' },
  { name: 'Visual C++ 2010', ident: 'Microsoft.VCRedist.2010.x64', category: 'Sistem & Çalışma Zamanı', description: 'Eski uygulamalar için C++ kütüphanesi', homepage: 'https://learn.microsoft.com' },
  { name: 'Visual C++ 2010 (x86)', ident: 'Microsoft.VCRedist.2010.x86', category: 'Sistem & Çalışma Zamanı', description: 'Eski 32-bit uygulamalar için kütüphane', homepage: 'https://learn.microsoft.com' },
  { name: 'Visual C++ 2008', ident: 'Microsoft.VCRedist.2008.x64', category: 'Sistem & Çalışma Zamanı', description: 'Eski uygulamalar için C++ kütüphanesi', homepage: 'https://learn.microsoft.com' },
  { name: 'Visual C++ 2008 (x86)', ident: 'Microsoft.VCRedist.2008.x86', category: 'Sistem & Çalışma Zamanı', description: 'Eski 32-bit uygulamalar için kütüphane', homepage: 'https://learn.microsoft.com' },
  { name: 'Visual C++ 2005', ident: 'Microsoft.VCRedist.2005.x64', category: 'Sistem & Çalışma Zamanı', description: 'Çok eski uygulamalar için kütüphane', homepage: 'https://learn.microsoft.com' },
  { name: 'Visual C++ 2005 (x86)', ident: 'Microsoft.VCRedist.2005.x86', category: 'Sistem & Çalışma Zamanı', description: 'Çok eski 32-bit uygulamalar için kütüphane', homepage: 'https://learn.microsoft.com' },
  { name: '.NET Desktop Runtime 9', ident: 'Microsoft.DotNet.DesktopRuntime.9', category: 'Sistem & Çalışma Zamanı', description: '.NET masaüstü uygulamaları için', essential: true, icon: brandIcon('dotnet'), homepage: 'https://dotnet.microsoft.com' },
  { name: '.NET Desktop Runtime 8', ident: 'Microsoft.DotNet.DesktopRuntime.8', category: 'Sistem & Çalışma Zamanı', description: '.NET 8 tabanlı uygulamalar için', essential: true, icon: brandIcon('dotnet'), homepage: 'https://dotnet.microsoft.com' },
  { name: '.NET Runtime 9', ident: 'Microsoft.DotNet.Runtime.9', category: 'Sistem & Çalışma Zamanı', description: '.NET konsol ve servis uygulamaları için', icon: brandIcon('dotnet'), homepage: 'https://dotnet.microsoft.com' },
  { name: '.NET Runtime 8', ident: 'Microsoft.DotNet.Runtime.8', category: 'Sistem & Çalışma Zamanı', description: '.NET 8 konsol uygulamaları için', icon: brandIcon('dotnet'), homepage: 'https://dotnet.microsoft.com' },
  { name: '.NET SDK 9', ident: 'Microsoft.DotNet.SDK.9', category: 'Sistem & Çalışma Zamanı', description: '.NET geliştirme araçları', icon: brandIcon('dotnet'), homepage: 'https://dotnet.microsoft.com' },
  { name: '.NET SDK 8', ident: 'Microsoft.DotNet.SDK.8', category: 'Sistem & Çalışma Zamanı', description: '.NET 8 geliştirme araçları', icon: brandIcon('dotnet'), homepage: 'https://dotnet.microsoft.com' },
  { name: 'DirectX End-User Runtime', ident: 'Microsoft.DirectX', category: 'Sistem & Çalışma Zamanı', description: 'Eski oyunlar için DirectX bileşenleri', essential: true, homepage: 'https://www.microsoft.com' },
  { name: 'Windows Terminal', ident: 'Microsoft.WindowsTerminal', category: 'Sistem & Çalışma Zamanı', description: 'Modern komut satırı', essential: true, homepage: 'https://learn.microsoft.com' },
  { name: 'Windows Terminal (Önizleme)', ident: 'Microsoft.WindowsTerminal.Preview', category: 'Sistem & Çalışma Zamanı', description: 'Windows Terminal test sürümü', homepage: 'https://learn.microsoft.com' },
  { name: 'PowerShell 7', ident: 'Microsoft.PowerShell', category: 'Sistem & Çalışma Zamanı', description: 'Modern PowerShell kabuğu', homepage: 'https://learn.microsoft.com' },
  { name: 'Windows Subsystem for Linux', ident: 'Microsoft.WSL', category: 'Sistem & Çalışma Zamanı', description: 'Windows üzerinde Linux alt sistemi', icon: brandIcon('linux'), homepage: 'https://learn.microsoft.com' },
  { name: 'PowerToys', ident: 'Microsoft.PowerToys', category: 'Sistem & Çalışma Zamanı', description: 'Windows verimlilik araçları', homepage: 'https://learn.microsoft.com' },
  { name: 'CPU-Z', ident: 'CPUID.CPU-Z', category: 'Sistem & Çalışma Zamanı', description: 'İşlemci ve donanım bilgileri', homepage: 'https://www.cpuid.com' },
  { name: 'HWMonitor', ident: 'CPUID.HWMonitor', category: 'Sistem & Çalışma Zamanı', description: 'Sıcaklık ve voltaj izleme', homepage: 'https://www.cpuid.com' },
  { name: 'CrystalDiskInfo', ident: 'CrystalDewWorld.CrystalDiskInfo', category: 'Sistem & Çalışma Zamanı', description: 'Disk sağlığı izleme', homepage: 'https://crystalmark.info' },
  { name: 'CrystalDiskMark', ident: 'CrystalDewWorld.CrystalDiskMark', category: 'Sistem & Çalışma Zamanı', description: 'Disk hızı ölçümü', homepage: 'https://crystalmark.info' },
  { name: 'GPU-Z', ident: 'TechPowerUp.GPU-Z', category: 'Sistem & Çalışma Zamanı', description: 'Ekran kartı bilgileri', homepage: 'https://www.techpowerup.com' },
  { name: 'Process Explorer', ident: 'Microsoft.Sysinternals.ProcessExplorer', category: 'Sistem & Çalışma Zamanı', description: 'Gelişmiş görev yöneticisi', homepage: 'https://learn.microsoft.com' },
  { name: 'CCleaner', ident: 'Piriform.CCleaner', category: 'Sistem & Çalışma Zamanı', description: 'Geçici dosya ve kayıt temizleme', icon: brandIcon('ccleaner'), homepage: 'https://www.ccleaner.com' },
  { name: 'WizTree', ident: 'AntibodySoftware.WizTree', category: 'Sistem & Çalışma Zamanı', description: 'Hızlı disk alanı analizi', homepage: 'https://antibody-software.com' },
  { name: 'Speccy', ident: 'Piriform.Speccy', category: 'Sistem & Çalışma Zamanı', description: 'Sistem donanım özeti', homepage: 'https://www.ccleaner.com' },
  { name: 'Defraggler', ident: 'Piriform.Defraggler', category: 'Sistem & Çalışma Zamanı', description: 'Disk birleştirme aracı', homepage: 'https://www.ccleaner.com' },
  { name: 'Everything', ident: 'voidtools.Everything', category: 'Sistem & Çalışma Zamanı', description: 'Anında dosya arama', homepage: 'https://www.voidtools.com' },
  { name: 'WinRAR', ident: 'RARLab.WinRAR', category: 'Sistem & Çalışma Zamanı', description: 'RAR/ZIP arşivleme', homepage: 'https://www.rarlab.com' },
  { name: 'Bandizip', ident: 'Bandisoft.Bandizip', category: 'Sistem & Çalışma Zamanı', description: 'Hızlı arşiv yöneticisi', homepage: 'https://www.bandisoft.com/bandizip' },
  { name: 'TreeSize Free', ident: 'JAMSoftware.TreeSize', category: 'Sistem & Çalışma Zamanı', description: 'Klasör boyutu analizi', homepage: 'https://www.jam-software.com/treesize_free' },
  { name: 'WinDirStat', ident: 'WinDirStat.WinDirStat', category: 'Sistem & Çalışma Zamanı', description: 'Disk kullanım haritası', homepage: 'https://windirstat.net' },
  { name: 'HWiNFO', ident: 'REALiX.HWiNFO', category: 'Sistem & Çalışma Zamanı', description: 'Donanım tanılama ve izleme', homepage: 'https://www.hwinfo.com' },
  { name: 'Autoruns', ident: 'Microsoft.Sysinternals.Autoruns', category: 'Sistem & Çalışma Zamanı', description: 'Otomatik başlangıç girdileri', homepage: 'https://learn.microsoft.com' },
  { name: 'Process Monitor', ident: 'Microsoft.Sysinternals.ProcessMonitor', category: 'Sistem & Çalışma Zamanı', description: 'Süreç, dosya ve kayıt izleme', homepage: 'https://learn.microsoft.com' },

  // Güvenlik
  { name: 'Malwarebytes', ident: 'Malwarebytes.Malwarebytes', category: 'Güvenlik', description: 'Kötü amaçlı yazılım tarayıcısı', icon: brandIcon('malwarebytes'), homepage: 'https://www.malwarebytes.com' },
  { name: 'Bitdefender Antivirus', ident: 'Bitdefender.Bitdefender', category: 'Güvenlik', description: 'Antivirüs koruması', icon: brandIcon('bitdefender'), homepage: 'https://www.bitdefender.com' },
  { name: 'SUPERAntiSpyware', ident: 'SUPERAntiSpyware.SUPERAntiSpyware', category: 'Güvenlik', description: 'Casus yazılım taraması', homepage: 'https://www.superantispyware.com' },
  { name: 'AdGuard', ident: 'AdGuard.AdGuard', category: 'Güvenlik', description: 'Reklam ve izleyici engelleme', icon: brandIcon('adguard'), homepage: 'https://adguard.com' },
  { name: 'VeraCrypt', ident: 'IDRIX.VeraCrypt', category: 'Güvenlik', description: 'Disk ve dosya şifreleme', icon: 'https://icons.duckduckgo.com/ip3/www.veracrypt.fr.ico', homepage: 'https://www.veracrypt.fr' },
  { name: 'KeePass', ident: 'DominikReichl.KeePass', category: 'Güvenlik', description: 'Yerel şifre yöneticisi', homepage: 'https://keepass.info' },
  { name: 'Bitwarden', ident: 'Bitwarden.Bitwarden', category: 'Güvenlik', description: 'Bulut şifre yöneticisi', icon: brandIcon('bitwarden'), homepage: 'https://bitwarden.com' },
  { name: '1Password', ident: 'AgileBits.1Password', category: 'Güvenlik', description: 'Şifre ve parola yöneticisi', icon: brandIcon('1password'), homepage: 'https://1password.com' },
  { name: 'GnuPG', ident: 'GnuPG.GnuPG', category: 'Güvenlik', description: 'Açık kaynak şifreleme', homepage: 'https://gnupg.org' },
  { name: 'PuTTY', ident: 'PuTTY.PuTTY', category: 'Güvenlik', description: 'SSH / terminal istemcisi', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/PuTTY_icon_128px.png/120px-PuTTY_icon_128px.png', homepage: 'https://www.putty.org' },
  { name: 'OpenVPN Connect', ident: 'OpenVPNTechnologies.OpenVPNConnect', category: 'Güvenlik', description: 'VPN istemcisi', icon: brandIcon('openvpn'), homepage: 'https://openvpn.net' },
  { name: 'Wireshark', ident: 'WiresharkFoundation.Wireshark', category: 'Güvenlik', description: 'Ağ trafiği analizi', icon: brandIcon('wireshark'), homepage: 'https://www.wireshark.org' },
  { name: 'TCPView', ident: 'Microsoft.Sysinternals.TCPView', category: 'Güvenlik', description: 'Ağ bağlantılarını izleme', homepage: 'https://learn.microsoft.com' },
  { name: 'KeePassXC', ident: 'KeePassXCTeam.KeePassXC', category: 'Güvenlik', description: 'Açık kaynak şifre kasası', icon: brandIcon('keepassxc'), homepage: 'https://keepassxc.org' },
  { name: 'Bitwarden CLI', ident: 'Bitwarden.CLI', category: 'Güvenlik', description: 'Bitwarden komut satırı aracı', icon: brandIcon('bitwarden'), homepage: 'https://bitwarden.com' },
  { name: 'Proton VPN', ident: 'Proton.ProtonVPN', category: 'Güvenlik', description: 'Gizlilik odaklı VPN', icon: brandIcon('protonvpn'), homepage: 'https://protonvpn.com' },
  { name: 'Tailscale', ident: 'Tailscale.Tailscale', category: 'Güvenlik', description: 'Mesh VPN ağı', icon: brandIcon('tailscale'), homepage: 'https://tailscale.com' },
  { name: 'Nmap', ident: 'Insecure.Nmap', category: 'Güvenlik', description: 'Ağ keşfi ve port taraması', homepage: 'https://nmap.org' },
  { name: 'Gpg4win', ident: 'GnuPG.Gpg4win', category: 'Güvenlik', description: 'Windows için GnuPG şifreleme', homepage: 'https://www.gpg4win.org' },
  { name: 'ESET NOD32 Antivirus', ident: 'ESET.Nod32', category: 'Güvenlik', description: 'Antivirüs koruması', homepage: 'https://www.eset.com' },

  // Tarayıcı
  { name: 'Google Chrome', ident: 'Google.Chrome', category: 'Tarayıcı', description: 'Web tarayıcısı', icon: brandIcon('googlechrome'), homepage: 'https://www.google.com' },
  { name: 'Mozilla Firefox', ident: 'Mozilla.Firefox', category: 'Tarayıcı', description: 'Web tarayıcısı', icon: brandIcon('firefox'), homepage: 'https://www.mozilla.org' },
  { name: 'Mozilla Firefox ESR', ident: 'Mozilla.Firefox.ESR', category: 'Tarayıcı', description: 'Uzun süreli destek sürümü', icon: brandIcon('firefox'), homepage: 'https://www.mozilla.org' },
  { name: 'Brave', ident: 'Brave.Brave', category: 'Tarayıcı', description: 'Gizlilik odaklı tarayıcı', icon: brandIcon('brave'), homepage: 'https://brave.com' },
  { name: 'Microsoft Edge', ident: 'Microsoft.Edge', category: 'Tarayıcı', description: 'Windows ile gelen tarayıcı', homepage: 'https://www.microsoft.com' },
  { name: 'Opera', ident: 'Opera.Opera', category: 'Tarayıcı', description: 'Yerleşik VPN’li tarayıcı', icon: brandIcon('opera'), homepage: 'https://www.opera.com' },
  { name: 'Vivaldi', ident: 'Vivaldi.Vivaldi', category: 'Tarayıcı', description: 'Özelleştirilebilir tarayıcı', icon: brandIcon('vivaldi'), homepage: 'https://vivaldi.com' },
  { name: 'Tor Browser', ident: 'TorProject.TorBrowser', category: 'Tarayıcı', description: 'Anonim web tarayıcısı', icon: brandIcon('torbrowser'), homepage: 'https://www.torproject.org' },
  { name: 'Waterfox', ident: 'Waterfox.Waterfox', category: 'Tarayıcı', description: 'Gizlilik odaklı Firefox türevi', homepage: 'https://www.waterfox.net' },
  { name: 'Google Chrome Beta', ident: 'Google.Chrome.Beta', category: 'Tarayıcı', description: 'Chrome test sürümü', icon: brandIcon('googlechrome'), homepage: 'https://www.google.com/chrome' },
  { name: 'Google Chrome Canary', ident: 'Google.Chrome.Canary', category: 'Tarayıcı', description: 'Chrome günlük sürümü', icon: brandIcon('googlechrome'), homepage: 'https://www.google.com/chrome' },
  { name: 'Microsoft Edge Beta', ident: 'Microsoft.Edge.Beta', category: 'Tarayıcı', description: 'Edge test sürümü', homepage: 'https://www.microsoft.com/edge' },
  { name: 'Brave Beta', ident: 'Brave.Brave.Beta', category: 'Tarayıcı', description: 'Brave test sürümü', icon: brandIcon('brave'), homepage: 'https://brave.com' },
  { name: 'LibreWolf', ident: 'LibreWolf.LibreWolf', category: 'Tarayıcı', description: 'Gizlilik odaklı Firefox', icon: brandIcon('librewolf'), homepage: 'https://librewolf.net' },
  { name: 'DuckDuckGo Browser', ident: 'DuckDuckGo.DesktopBrowser', category: 'Tarayıcı', description: 'Gizlilik odaklı tarayıcı', icon: brandIcon('duckduckgo'), homepage: 'https://duckduckgo.com' },

  // İletişim
  { name: 'Telegram Desktop', ident: 'Telegram.TelegramDesktop', category: 'İletişim', description: 'Mesajlaşma', icon: brandIcon('telegram'), homepage: 'https://telegram.org' },
  { name: 'Discord', ident: 'Discord.Discord', category: 'İletişim', description: 'Topluluk ve sesli sohbet', icon: brandIcon('discord'), homepage: 'https://discord.com' },
  { name: 'Slack', ident: 'SlackTechnologies.Slack', category: 'İletişim', description: 'Ekip iletişimi', homepage: 'https://slack.com' },
  { name: 'Microsoft Teams', ident: 'Microsoft.Teams', category: 'İletişim', description: 'Toplantı ve ekip çalışması', homepage: 'https://www.microsoft.com' },
  { name: 'Mattermost', ident: 'Mattermost.MattermostDesktop', category: 'İletişim', description: 'Açık kaynak ekip sohbeti', icon: brandIcon('mattermost'), homepage: 'https://mattermost.com' },
  { name: 'Mozilla Thunderbird', ident: 'Mozilla.Thunderbird', category: 'İletişim', description: 'E-posta istemcisi', icon: brandIcon('thunderbird'), homepage: 'https://www.thunderbird.net' },
  { name: 'Zoom Workplace', ident: 'Zoom.Zoom', category: 'İletişim', description: 'Görüntülü toplantı', icon: brandIcon('zoom'), homepage: 'https://zoom.us' },
  { name: 'TeamViewer', ident: 'TeamViewer.TeamViewer', category: 'İletişim', description: 'Uzaktan erişim', icon: brandIcon('teamviewer'), homepage: 'https://www.teamviewer.com' },
  { name: 'AnyDesk', ident: 'AnyDesk.AnyDesk', category: 'İletişim', description: 'Hızlı uzaktan erişim', icon: brandIcon('anydesk'), homepage: 'https://anydesk.com' },
  { name: 'Signal', ident: 'OpenWhisperSystems.Signal', category: 'İletişim', description: 'Uçtan uca şifreli mesajlaşma', icon: brandIcon('signal'), homepage: 'https://signal.org' },
  { name: 'Element', ident: 'Element.Element', category: 'İletişim', description: 'Matrix mesajlaşma istemcisi', icon: brandIcon('element'), homepage: 'https://element.io' },
  { name: 'Viber', ident: 'Rakuten.Viber', category: 'İletişim', description: 'Mesajlaşma ve sesli arama', icon: brandIcon('viber'), homepage: 'https://www.viber.com' },
  { name: 'Wire', ident: 'wire.wire', category: 'İletişim', description: 'Güvenli ekip iletişimi', icon: brandIcon('wire'), homepage: 'https://wire.com' },
  { name: 'Zulip', ident: 'Zulip.Zulip', category: 'İletişim', description: 'Konu bazlı ekip sohbeti', icon: brandIcon('zulip'), homepage: 'https://zulip.com' },

  // Verimlilik
  { name: 'LibreOffice', ident: 'TheDocumentFoundation.LibreOffice', category: 'Verimlilik', description: 'Ücretsiz ofis paketi', icon: brandIcon('libreoffice'), homepage: 'https://www.libreoffice.org' },
  { name: 'ONLYOFFICE Desktop Editors', ident: 'ONLYOFFICE.DesktopEditors', category: 'Verimlilik', description: 'Ofis belge düzenleyici', icon: brandIcon('onlyoffice'), homepage: 'https://www.onlyoffice.com' },
  { name: 'WPS Office', ident: 'Kingsoft.WPSOffice', category: 'Verimlilik', description: 'Hafif ofis paketi', homepage: 'https://www.wps.com' },
  { name: 'Notepad++', ident: 'Notepad++.Notepad++', category: 'Verimlilik', description: 'Gelişmiş metin düzenleyici', icon: brandIcon('notepadplusplus'), homepage: 'https://notepad-plus-plus.org' },
  { name: 'Visual Studio Code', ident: 'Microsoft.VisualStudioCode', category: 'Verimlilik', description: 'Kod düzenleyici', homepage: 'https://code.visualstudio.com' },
  { name: 'Obsidian', ident: 'Obsidian.Obsidian', category: 'Verimlilik', description: 'Not alma ve bilgi yönetimi', icon: brandIcon('obsidian'), homepage: 'https://obsidian.md' },
  { name: 'Joplin', ident: 'Joplin.Joplin', category: 'Verimlilik', description: 'Açık kaynak not uygulaması', icon: brandIcon('joplin'), homepage: 'https://joplinapp.org' },
  { name: 'Freeplane', ident: 'Freeplane.Freeplane', category: 'Verimlilik', description: 'Zihin haritası oluşturma', homepage: 'https://www.freeplane.org' },
  { name: 'ShareX', ident: 'ShareX.ShareX', category: 'Verimlilik', description: 'Ekran görüntüsü ve kayıt', icon: brandIcon('sharex'), homepage: 'https://getsharex.com' },
  { name: 'SumatraPDF', ident: 'SumatraPDF.SumatraPDF', category: 'Verimlilik', description: 'Hızlı PDF okuyucu', homepage: 'https://www.sumatrapdfreader.org' },
  { name: 'Foxit PDF Reader', ident: 'Foxit.FoxitReader', category: 'Verimlilik', description: 'PDF görüntüleme ve düzenleme', homepage: 'https://www.foxit.com' },
  { name: 'calibre', ident: 'calibre.calibre', category: 'Verimlilik', description: 'E-kitap yönetimi', homepage: 'https://calibre-ebook.com' },
  { name: 'Figma', ident: 'Figma.Figma', category: 'Verimlilik', description: 'Arayüz tasarım iş birliği', icon: brandIcon('figma'), homepage: 'https://www.figma.com' },
  { name: 'Notion', ident: 'Notion.Notion', category: 'Verimlilik', description: 'Not, proje ve wiki', icon: brandIcon('notion'), homepage: 'https://www.notion.so' },
  { name: 'Microsoft Power BI Desktop', ident: 'Microsoft.PowerBI', category: 'Verimlilik', description: 'Veri görselleştirme', homepage: 'https://powerbi.microsoft.com' },
  { name: 'Toggl Track', ident: 'Toggl.TogglTrack', category: 'Verimlilik', description: 'Zaman takibi', icon: brandIcon('toggltrack'), homepage: 'https://toggl.com' },
  { name: 'Dropbox', ident: 'Dropbox.Dropbox', category: 'Verimlilik', description: 'Bulut dosya senkronizasyonu', icon: brandIcon('dropbox'), homepage: 'https://www.dropbox.com' },
  { name: 'Anki', ident: 'Anki.Anki', category: 'Verimlilik', description: 'Aralıklı tekrarla öğrenme', icon: brandIcon('anki'), homepage: 'https://apps.ankiweb.net' },
  { name: 'Todoist', ident: 'Doist.Todoist', category: 'Verimlilik', description: 'Görev ve proje takibi', icon: brandIcon('todoist'), homepage: 'https://todoist.com' },
  { name: 'Zotero', ident: 'DigitalScholar.Zotero', category: 'Verimlilik', description: 'Araştırma ve kaynak yönetimi', icon: brandIcon('zotero'), homepage: 'https://www.zotero.org' },
  { name: 'AutoHotkey', ident: 'AutoHotkey.AutoHotkey', category: 'Verimlilik', description: 'Windows otomasyon betikleri', icon: brandIcon('autohotkey'), homepage: 'https://www.autohotkey.com' },
  { name: 'Greenshot', ident: 'Greenshot.Greenshot', category: 'Verimlilik', description: 'Ekran görüntüsü aracı', homepage: 'https://getgreenshot.org' },
  { name: 'draw.io', ident: 'JGraph.Draw', category: 'Verimlilik', description: 'Diyagram ve akış şeması', icon: brandIcon('diagramsdotnet'), homepage: 'https://app.diagrams.net' },
  { name: 'Miro', ident: 'Miro.Miro', category: 'Verimlilik', description: 'Çevrimiçi beyin fırtınası', icon: brandIcon('miro'), homepage: 'https://miro.com' },

  // Medya & Tasarım
  { name: 'VLC media player', ident: 'VideoLAN.VLC', category: 'Medya & Tasarım', description: 'Video ve ses oynatıcı', icon: brandIcon('vlcmediaplayer'), homepage: 'https://www.videolan.org' },
  { name: 'Kodi', ident: 'XBMCFoundation.Kodi', category: 'Medya & Tasarım', description: 'Medya merkezi', icon: brandIcon('kodi'), homepage: 'https://kodi.tv' },
  { name: 'PotPlayer', ident: 'Daum.PotPlayer', category: 'Medya & Tasarım', description: 'Güçlü video oynatıcı', icon: 'https://icons.duckduckgo.com/ip3/potplayer.tv.ico', homepage: 'https://potplayer.daum.net' },
  { name: 'Spotify', ident: 'Spotify.Spotify', category: 'Medya & Tasarım', description: 'Müzik akışı', icon: brandIcon('spotify'), homepage: 'https://www.spotify.com' },
  { name: 'iTunes', ident: 'Apple.iTunes', category: 'Medya & Tasarım', description: 'Apple cihaz yönetimi', icon: brandIcon('itunes'), homepage: 'https://www.apple.com' },
  { name: 'Audacity', ident: 'Audacity.Audacity', category: 'Medya & Tasarım', description: 'Ses düzenleme', icon: brandIcon('audacity'), homepage: 'https://www.audacityteam.org' },
  { name: 'FFmpeg', ident: 'Gyan.FFmpeg', category: 'Medya & Tasarım', description: 'Video/ses dönüştürme araçları', icon: brandIcon('ffmpeg'), homepage: 'https://ffmpeg.org' },
  { name: 'HandBrake', ident: 'HandBrake.HandBrake', category: 'Medya & Tasarım', description: 'Video transkodlama', homepage: 'https://handbrake.fr' },
  { name: 'OBS Studio', ident: 'OBSProject.OBSStudio', category: 'Medya & Tasarım', description: 'Canlı yayın ve kayıt', icon: brandIcon('obsstudio'), homepage: 'https://obsproject.com' },
  { name: 'GIMP', ident: 'GIMP.GIMP', category: 'Medya & Tasarım', description: 'Görsel düzenleme', icon: brandIcon('gimp'), homepage: 'https://www.gimp.org' },
  { name: 'Krita', ident: 'KDE.Krita', category: 'Medya & Tasarım', description: 'Dijital çizim ve boyama', icon: brandIcon('krita'), homepage: 'https://krita.org' },
  { name: 'Inkscape', ident: 'Inkscape.Inkscape', category: 'Medya & Tasarım', description: 'Vektör grafik düzenleme', icon: brandIcon('inkscape'), homepage: 'https://inkscape.org' },
  { name: 'Paint.NET', ident: 'dotPDN.PaintDotNet', category: 'Medya & Tasarım', description: 'Hızlı görsel düzenleme', homepage: 'https://www.getpaint.net' },
  { name: 'Blender', ident: 'BlenderFoundation.Blender', category: 'Medya & Tasarım', description: '3D modelleme ve animasyon', icon: brandIcon('blender'), homepage: 'https://www.blender.org' },
  { name: 'IrfanView', ident: 'IrfanSkiljan.IrfanView', category: 'Medya & Tasarım', description: 'Hızlı görüntü görüntüleyici', homepage: 'https://www.irfanview.com' },
  { name: 'ImageMagick', ident: 'ImageMagick.ImageMagick', category: 'Medya & Tasarım', description: 'Komut satırı görsel işleme', homepage: 'https://imagemagick.org' },
  { name: 'Adobe Acrobat Reader', ident: 'Adobe.Acrobat.Reader.64-bit', category: 'Medya & Tasarım', description: 'PDF okuyucu', homepage: 'https://www.adobe.com' },
  { name: 'Plex Media Server', ident: 'Plex.PlexMediaServer', category: 'Medya & Tasarım', description: 'Kişisel medya sunucusu', icon: brandIcon('plex'), homepage: 'https://www.plex.tv' },
  { name: 'Plex', ident: 'Plex.Plex', category: 'Medya & Tasarım', description: 'Medya oynatıcı istemcisi', icon: brandIcon('plex'), homepage: 'https://www.plex.tv' },
  { name: 'Jellyfin Media Player', ident: 'Jellyfin.JellyfinMediaPlayer', category: 'Medya & Tasarım', description: 'Açık kaynak medya oynatıcı', icon: brandIcon('jellyfin'), homepage: 'https://jellyfin.org' },
  { name: 'Jellyfin Server', ident: 'Jellyfin.Server', category: 'Medya & Tasarım', description: 'Açık kaynak medya sunucusu', icon: brandIcon('jellyfin'), homepage: 'https://jellyfin.org' },
  { name: 'qBittorrent', ident: 'qBittorrent.qBittorrent', category: 'Medya & Tasarım', description: 'Torrent istemcisi', icon: brandIcon('qbittorrent'), homepage: 'https://www.qbittorrent.org' },
  { name: 'Transmission', ident: 'Transmission.Transmission', category: 'Medya & Tasarım', description: 'Hafif torrent istemcisi', icon: brandIcon('transmission'), homepage: 'https://transmissionbt.com' },
  { name: 'WinSCP', ident: 'WinSCP.WinSCP', category: 'Medya & Tasarım', description: 'SFTP / FTP istemcisi', homepage: 'https://winscp.net' },
  { name: 'Canva', ident: 'Canva.Canva', category: 'Medya & Tasarım', description: 'Çevrimiçi tasarım aracı', homepage: 'https://www.canva.com' },
  { name: 'foobar2000', ident: 'PeterPawlowski.foobar2000', category: 'Medya & Tasarım', description: 'Hafif ses oynatıcı', icon: brandIcon('foobar2000'), homepage: 'https://www.foobar2000.org' },
  { name: 'AIMP', ident: 'AIMP.AIMP', category: 'Medya & Tasarım', description: 'Zengin özellikli ses oynatıcı', homepage: 'https://www.aimp.ru' },
  { name: 'SMPlayer', ident: 'SMPlayer.SMPlayer', category: 'Medya & Tasarım', description: 'Altyazılı video oynatıcı', homepage: 'https://www.smplayer.info' },
  { name: 'mpv', ident: 'shinchiro.mpv', category: 'Medya & Tasarım', description: 'Hafif video oynatıcı', icon: brandIcon('mpv'), homepage: 'https://mpv.io' },
  { name: 'MPC-HC', ident: 'clsid2.mpc-hc', category: 'Medya & Tasarım', description: 'Klasik HD video oynatıcı', homepage: 'https://github.com/clsid2/mpc-hc' },
  { name: 'Kdenlive', ident: 'KDE.Kdenlive', category: 'Medya & Tasarım', description: 'Video düzenleme stüdyosu', icon: brandIcon('kdenlive'), homepage: 'https://kdenlive.org' },
  { name: 'OpenShot', ident: 'OpenShot.OpenShot', category: 'Medya & Tasarım', description: 'Açık kaynak video editörü', homepage: 'https://www.openshot.org' },
  { name: 'Deluge', ident: 'DelugeTeam.Deluge', category: 'Medya & Tasarım', description: 'Hafif torrent istemcisi', icon: brandIcon('deluge'), homepage: 'https://deluge-torrent.org' },

  // Geliştirme
  { name: 'Git', ident: 'Git.Git', category: 'Geliştirme', description: 'Sürüm kontrol sistemi', icon: brandIcon('git'), homepage: 'https://git-scm.com' },
  { name: 'GitHub Desktop', ident: 'GitHub.GitHubDesktop', category: 'Geliştirme', description: 'Görsel Git istemcisi', icon: brandIcon('github'), homepage: 'https://desktop.github.com' },
  { name: 'TortoiseGit', ident: 'TortoiseGit.TortoiseGit', category: 'Geliştirme', description: 'Windows Explorer Git entegrasyonu', homepage: 'https://tortoisegit.org' },
  { name: 'Python 3.13', ident: 'Python.Python.3.13', category: 'Geliştirme', description: 'Python yorumlayıcısı', icon: brandIcon('python'), homepage: 'https://www.python.org' },
  { name: 'Python 3.12', ident: 'Python.Python.3.12', category: 'Geliştirme', description: 'Python kararlı sürümü', icon: brandIcon('python'), homepage: 'https://www.python.org' },
  { name: 'Node.js LTS', ident: 'OpenJS.NodeJS.LTS', category: 'Geliştirme', description: 'JavaScript çalışma zamanı (LTS)', icon: brandIcon('nodedotjs'), homepage: 'https://nodejs.org' },
  { name: 'Node.js', ident: 'OpenJS.NodeJS', category: 'Geliştirme', description: 'JavaScript çalışma zamanı (güncel)', icon: brandIcon('nodedotjs'), homepage: 'https://nodejs.org' },
  { name: 'Docker Desktop', ident: 'Docker.DockerDesktop', category: 'Geliştirme', description: 'Konteyner geliştirme', icon: brandIcon('docker'), homepage: 'https://www.docker.com' },
  { name: 'Visual Studio 2022 Community', ident: 'Microsoft.VisualStudio.2022.Community', category: 'Geliştirme', description: 'Ücretsiz IDE', homepage: 'https://visualstudio.microsoft.com' },
  { name: 'Visual Studio Build Tools', ident: 'Microsoft.VisualStudio.2022.BuildTools', category: 'Geliştirme', description: 'Derleme araçları', homepage: 'https://visualstudio.microsoft.com' },
  { name: 'IntelliJ IDEA Community', ident: 'JetBrains.IntelliJIDEA.Community', category: 'Geliştirme', description: 'Java / Kotlin IDE', icon: brandIcon('intellijidea'), homepage: 'https://www.jetbrains.com' },
  { name: 'PyCharm Community', ident: 'JetBrains.PyCharm.Community', category: 'Geliştirme', description: 'Python IDE', icon: brandIcon('pycharm'), homepage: 'https://www.jetbrains.com' },
  { name: 'WebStorm', ident: 'JetBrains.WebStorm', category: 'Geliştirme', description: 'JavaScript IDE', icon: brandIcon('webstorm'), homepage: 'https://www.jetbrains.com' },
  { name: 'Rider', ident: 'JetBrains.Rider', category: 'Geliştirme', description: '.NET IDE', icon: brandIcon('rider'), homepage: 'https://www.jetbrains.com' },
  { name: 'GoLand', ident: 'JetBrains.GoLand', category: 'Geliştirme', description: 'Go IDE', icon: brandIcon('goland'), homepage: 'https://www.jetbrains.com' },
  { name: 'Android Studio', ident: 'Google.AndroidStudio', category: 'Geliştirme', description: 'Android uygulama geliştirme', icon: brandIcon('androidstudio'), homepage: 'https://developer.android.com' },
  { name: 'OpenJDK 21', ident: 'Microsoft.OpenJDK.21', category: 'Geliştirme', description: 'Java 21 geliştirme kiti', icon: brandIcon('openjdk'), homepage: 'https://learn.microsoft.com' },
  { name: 'OpenJDK 17', ident: 'Microsoft.OpenJDK.17', category: 'Geliştirme', description: 'Java 17 geliştirme kiti', icon: brandIcon('openjdk'), homepage: 'https://learn.microsoft.com' },
  { name: 'Go', ident: 'GoLang.Go', category: 'Geliştirme', description: 'Go programlama dili', icon: brandIcon('go'), homepage: 'https://go.dev' },
  { name: 'Rustup', ident: 'Rustlang.Rustup', category: 'Geliştirme', description: 'Rust araç zinciri', icon: brandIcon('rust'), homepage: 'https://rustup.rs' },
  { name: 'LLVM', ident: 'LLVM.LLVM', category: 'Geliştirme', description: 'Derleyici altyapısı', icon: brandIcon('llvm'), homepage: 'https://llvm.org' },
  { name: 'CMake', ident: 'Kitware.CMake', category: 'Geliştirme', description: 'Çapraz platform derleme sistemi', icon: brandIcon('cmake'), homepage: 'https://cmake.org' },
  { name: 'Ninja', ident: 'Ninja-build.Ninja', category: 'Geliştirme', description: 'Hızlı derleme aracı', icon: initialIcon('N', '#c84031'), homepage: 'https://ninja-build.org' },
  { name: 'MSYS2', ident: 'MSYS2.MSYS2', category: 'Geliştirme', description: 'Windows için Unix araçları', homepage: 'https://www.msys2.org' },
  { name: 'Cygwin', ident: 'Cygwin.Cygwin', category: 'Geliştirme', description: 'Windows için POSIX ortamı', homepage: 'https://www.cygwin.com' },
  { name: 'PostgreSQL 16', ident: 'PostgreSQL.PostgreSQL.16', category: 'Geliştirme', description: 'İlişkisel veritabanı', icon: brandIcon('postgresql'), homepage: 'https://www.postgresql.org' },
  { name: 'HeidiSQL', ident: 'HeidiSQL.HeidiSQL', category: 'Geliştirme', description: 'Veritabanı yönetim aracı', homepage: 'https://www.heidisql.com' },
  { name: 'DBeaver Community', ident: 'DBeaver.DBeaver.Community', category: 'Geliştirme', description: 'Evrensel veritabanı aracı', icon: brandIcon('dbeaver'), homepage: 'https://dbeaver.io' },
  { name: 'VSCodium', ident: 'VSCodium.VSCodium', category: 'Geliştirme', description: 'Telemetrisiz VS Code', icon: brandIcon('vscodium'), homepage: 'https://vscodium.com' },
  { name: 'Visual Studio Code Insiders', ident: 'Microsoft.VisualStudioCode.Insiders', category: 'Geliştirme', description: 'VS Code günlük sürümü', homepage: 'https://code.visualstudio.com/insiders' },
  { name: 'Sublime Text 4', ident: 'SublimeHQ.SublimeText.4', category: 'Geliştirme', description: 'Hızlı kod düzenleyici', icon: brandIcon('sublimetext'), homepage: 'https://www.sublimetext.com' },
  { name: 'Sourcetree', ident: 'Atlassian.Sourcetree', category: 'Geliştirme', description: 'Görsel Git istemcisi', icon: brandIcon('sourcetree'), homepage: 'https://www.sourcetreeapp.com' },
  { name: 'GitKraken', ident: 'Axosoft.GitKraken', category: 'Geliştirme', description: 'Görsel Git istemcisi', icon: brandIcon('gitkraken'), homepage: 'https://www.gitkraken.com' },
  { name: 'Postman', ident: 'Postman.Postman', category: 'Geliştirme', description: 'API geliştirme ve test', icon: brandIcon('postman'), homepage: 'https://www.postman.com' },
  { name: 'Insomnia', ident: 'Insomnia.Insomnia', category: 'Geliştirme', description: 'API istemcisi', icon: brandIcon('insomnia'), homepage: 'https://insomnia.rest' },
  { name: 'DB Browser for SQLite', ident: 'DBBrowserForSQLite.DBBrowserForSQLite', category: 'Geliştirme', description: 'SQLite veritabanı aracı', icon: brandIcon('sqlite'), homepage: 'https://sqlitebrowser.org' },
  { name: 'Eclipse Temurin JDK 21', ident: 'EclipseAdoptium.Temurin.21.JDK', category: 'Geliştirme', description: 'Açık kaynak Java 21', icon: brandIcon('eclipseadoptium'), homepage: 'https://adoptium.net' },
  { name: 'MongoDB Compass', ident: 'MongoDB.Compass.Full', category: 'Geliştirme', description: 'MongoDB veritabanı aracı', icon: brandIcon('mongodb'), homepage: 'https://www.mongodb.com/products/compass' },
  { name: 'Terraform', ident: 'Hashicorp.Terraform', category: 'Geliştirme', description: 'Altyapı kodlama aracı', icon: brandIcon('terraform'), homepage: 'https://www.terraform.io' },

  // Oyun
  { name: 'Steam', ident: 'Valve.Steam', category: 'Oyun', description: 'Oyun platformu', icon: brandIcon('steam'), homepage: 'https://store.steampowered.com' },
  { name: 'Epic Games Launcher', ident: 'EpicGames.EpicGamesLauncher', category: 'Oyun', description: 'Oyun platformu', icon: brandIcon('epicgames'), homepage: 'https://www.epicgames.com' },
  { name: 'GOG Galaxy', ident: 'GOG.Galaxy', category: 'Oyun', description: 'DRM’siz oyun platformu', icon: brandIcon('gogdotcom'), homepage: 'https://www.gog.com' },
  { name: 'Ubisoft Connect', ident: 'Ubisoft.Connect', category: 'Oyun', description: 'Ubisoft oyun platformu', icon: brandIcon('ubisoft'), homepage: 'https://www.ubisoft.com' },
  { name: 'Battle.net', ident: 'Blizzard.BattleNet', category: 'Oyun', description: 'Blizzard oyun platformu', icon: brandIcon('battledotnet'), homepage: 'https://www.blizzard.com' },
  { name: 'EA Desktop', ident: 'ElectronicArts.EADesktop', category: 'Oyun', description: 'EA oyun platformu', icon: brandIcon('ea'), homepage: 'https://www.ea.com' },
  { name: 'Logitech G HUB', ident: 'Logitech.GHUB', category: 'Oyun', description: 'Oyun çevre birimi yazılımı', homepage: 'https://www.logitechg.com' },
  { name: 'Minecraft Launcher', ident: 'Mojang.MinecraftLauncher', category: 'Oyun', description: 'Minecraft oyun başlatıcısı', homepage: 'https://www.minecraft.net' },
  { name: 'itch', ident: 'ItchIo.Itch', category: 'Oyun', description: 'Bağımsız oyun platformu', icon: brandIcon('itchdotio'), homepage: 'https://itch.io' },

  // Chocolatey paketleri (kimlikler choco community repository biçimindedir).
  { name: 'Chocolatey', ident: 'chocolatey', category: 'Paket Yöneticileri', description: 'Windows paket yöneticisinin kendisi', source: 'choco', icon: brandIcon('chocolatey'), homepage: 'https://chocolatey.org' },
  { name: 'Git (Chocolatey)', ident: 'git', category: 'Paket Yöneticileri', description: 'Sürüm kontrol sistemi', source: 'choco', icon: brandIcon('git'), homepage: 'https://git-scm.com' },
  { name: '7-Zip (Chocolatey)', ident: '7zip', category: 'Paket Yöneticileri', description: 'Dosya sıkıştırma/arşivleme', source: 'choco', icon: brandIcon('7zip'), homepage: 'https://www.7-zip.org' },
  { name: 'Visual Studio Code (Chocolatey)', ident: 'vscode', category: 'Paket Yöneticileri', description: 'Kod editörü', source: 'choco', homepage: 'https://code.visualstudio.com' },
  { name: 'Google Chrome (Chocolatey)', ident: 'googlechrome', category: 'Paket Yöneticileri', description: 'Web tarayıcısı', source: 'choco', icon: brandIcon('googlechrome'), homepage: 'https://www.google.com/chrome' },
  { name: 'Mozilla Firefox (Chocolatey)', ident: 'firefox', category: 'Paket Yöneticileri', description: 'Web tarayıcısı', source: 'choco', icon: brandIcon('firefox'), homepage: 'https://www.mozilla.org' },
  { name: 'Node.js (Chocolatey)', ident: 'nodejs', category: 'Paket Yöneticileri', description: 'JavaScript çalışma zamanı', source: 'choco', icon: brandIcon('nodedotjs'), homepage: 'https://nodejs.org' },
  { name: 'Python 3 (Chocolatey)', ident: 'python3', category: 'Paket Yöneticileri', description: 'Python çalışma zamanı', source: 'choco', icon: brandIcon('python'), homepage: 'https://www.python.org' },
  { name: 'Notepad++ (Chocolatey)', ident: 'notepadplusplus', category: 'Paket Yöneticileri', description: 'Metin düzenleyici', source: 'choco', icon: brandIcon('notepadplusplus'), homepage: 'https://notepad-plus-plus.org' },
  { name: 'PuTTY (Chocolatey)', ident: 'putty', category: 'Paket Yöneticileri', description: 'SSH / terminal istemcisi', source: 'choco', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/PuTTY_icon_128px.png/120px-PuTTY_icon_128px.png', homepage: 'https://www.putty.org' },
  { name: 'VLC (Chocolatey)', ident: 'vlc', category: 'Paket Yöneticileri', description: 'Medya oynatıcı', source: 'choco', icon: brandIcon('vlcmediaplayer'), homepage: 'https://www.videolan.org' },
  { name: 'Audacity (Chocolatey)', ident: 'audacity', category: 'Paket Yöneticileri', description: 'Ses düzenleyici', source: 'choco', icon: brandIcon('audacity'), homepage: 'https://www.audacityteam.org' },
  { name: 'GIMP (Chocolatey)', ident: 'gimp', category: 'Paket Yöneticileri', description: 'Görsel düzenleyici', source: 'choco', icon: brandIcon('gimp'), homepage: 'https://www.gimp.org' },
  { name: 'OBS Studio (Chocolatey)', ident: 'obs-studio', category: 'Paket Yöneticileri', description: 'Ekran kayıt ve yayın', source: 'choco', icon: brandIcon('obsstudio'), homepage: 'https://obsproject.com' },
  { name: 'LibreOffice (Chocolatey)', ident: 'libreoffice', category: 'Paket Yöneticileri', description: 'Ofis paketi', source: 'choco', icon: brandIcon('libreoffice'), homepage: 'https://www.libreoffice.org' },
  { name: 'Docker Desktop (Chocolatey)', ident: 'docker-desktop', category: 'Paket Yöneticileri', description: 'Konteyner geliştirme ortamı', source: 'choco', icon: brandIcon('docker'), homepage: 'https://www.docker.com' },
  { name: 'curl (Chocolatey)', ident: 'curl', category: 'Paket Yöneticileri', description: 'HTTP istemcisi', source: 'choco', icon: brandIcon('curl'), homepage: 'https://curl.se' },
  { name: 'jq (Chocolatey)', ident: 'jq', category: 'Paket Yöneticileri', description: 'JSON işleme aracı', source: 'choco', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Jq_logo.svg/120px-Jq_logo.svg.png', homepage: 'https://jqlang.github.io/jq' },

  // npm global paketleri.
  { name: 'npm (güncelle)', ident: 'npm', category: 'Paket Yöneticileri', description: 'Node paket yöneticisi', source: 'npm', icon: brandIcon('npm'), homepage: 'https://www.npmjs.com/package/npm' },
  { name: 'Yarn', ident: 'yarn', category: 'Paket Yöneticileri', description: 'Alternatif Node paket yöneticisi', source: 'npm', icon: brandIcon('yarn'), homepage: 'https://yarnpkg.com' },
  { name: 'pnpm', ident: 'pnpm', category: 'Paket Yöneticileri', description: 'Hızlı Node paket yöneticisi', source: 'npm', icon: brandIcon('pnpm'), homepage: 'https://pnpm.io' },
  { name: 'TypeScript', ident: 'typescript', category: 'Paket Yöneticileri', description: 'TS derleyicisi', source: 'npm', icon: brandIcon('typescript'), homepage: 'https://www.typescriptlang.org' },
  { name: 'ts-node', ident: 'ts-node', category: 'Paket Yöneticileri', description: 'TypeScript çalıştırıcı', source: 'npm', icon: brandIcon('tsnode'), homepage: 'https://typestrong.org/ts-node' },
  { name: 'nodemon', ident: 'nodemon', category: 'Paket Yöneticileri', description: 'Geliştirme sunucusu yeniden başlatıcı', source: 'npm', icon: brandIcon('nodemon'), homepage: 'https://nodemon.io' },
  { name: 'PM2', ident: 'pm2', category: 'Paket Yöneticileri', description: 'Node süreç yöneticisi', source: 'npm', icon: brandIcon('pm2'), homepage: 'https://pm2.keymetrics.io' },
  { name: 'ESLint', ident: 'eslint', category: 'Paket Yöneticileri', description: 'Kod kalite denetimi', source: 'npm', icon: brandIcon('eslint'), homepage: 'https://eslint.org' },
  { name: 'Prettier', ident: 'prettier', category: 'Paket Yöneticileri', description: 'Kod biçimlendirici', source: 'npm', icon: brandIcon('prettier'), homepage: 'https://prettier.io' },
  { name: 'Vite', ident: 'vite', category: 'Paket Yöneticileri', description: 'Ön yüz derleme aracı', source: 'npm', icon: brandIcon('vite'), homepage: 'https://vite.dev' },
  { name: 'Vue CLI', ident: '@vue/cli', category: 'Paket Yöneticileri', description: 'Vue proje oluşturucu', source: 'npm', icon: brandIcon('vuedotjs'), homepage: 'https://cli.vuejs.org' },
  { name: 'Angular CLI', ident: '@angular/cli', category: 'Paket Yöneticileri', description: 'Angular proje oluşturucu', source: 'npm', icon: brandIcon('angular'), homepage: 'https://angular.dev/tools/cli' },
  { name: 'serve', ident: 'serve', category: 'Paket Yöneticileri', description: 'Yerel statik sunucu', source: 'npm', homepage: 'https://www.npmjs.com/package/serve' },
  { name: 'webpack CLI', ident: 'webpack-cli', category: 'Paket Yöneticileri', description: 'webpack komut satırı', source: 'npm', icon: brandIcon('webpack'), homepage: 'https://webpack.js.org' },

  // Scoop paketleri.
  { name: 'Scoop', ident: 'scoop', category: 'Paket Yöneticileri', description: 'Kullanıcı bazlı Windows paket yöneticisi', source: 'scoop', homepage: 'https://scoop.sh' },
  { name: 'Git (Scoop)', ident: 'git', category: 'Paket Yöneticileri', description: 'Sürüm kontrol sistemi', source: 'scoop', icon: brandIcon('git'), homepage: 'https://git-scm.com' },
  { name: '7-Zip (Scoop)', ident: '7zip', category: 'Paket Yöneticileri', description: 'Dosya sıkıştırma/arşivleme', source: 'scoop', icon: brandIcon('7zip'), homepage: 'https://www.7-zip.org' },
  { name: 'curl (Scoop)', ident: 'curl', category: 'Paket Yöneticileri', description: 'HTTP istemcisi', source: 'scoop', icon: brandIcon('curl'), homepage: 'https://curl.se' },
  { name: 'wget (Scoop)', ident: 'wget', category: 'Paket Yöneticileri', description: 'Dosya indirici', source: 'scoop', homepage: 'https://www.gnu.org/software/wget' },
  { name: 'jq (Scoop)', ident: 'jq', category: 'Paket Yöneticileri', description: 'JSON işleme aracı', source: 'scoop', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Jq_logo.svg/120px-Jq_logo.svg.png', homepage: 'https://jqlang.github.io/jq' },
  { name: 'fzf', ident: 'fzf', category: 'Paket Yöneticileri', description: 'Bulansal arama aracı', source: 'scoop', homepage: 'https://github.com/junegunn/fzf' },
  { name: 'ripgrep', ident: 'ripgrep', category: 'Paket Yöneticileri', description: 'Hızlı metin arama', source: 'scoop', homepage: 'https://github.com/BurntSushi/ripgrep' },
  { name: 'fd', ident: 'fd', category: 'Paket Yöneticileri', description: 'Hızlı dosya bulma', source: 'scoop', homepage: 'https://github.com/sharkdp/fd' },
  { name: 'bat', ident: 'bat', category: 'Paket Yöneticileri', description: 'cat yerine gelişmiş görüntüleyici', source: 'scoop', icon: brandIcon('bat'), homepage: 'https://github.com/sharkdp/bat' },
  { name: 'eza', ident: 'eza', category: 'Paket Yöneticileri', description: 'Modern dizin listeleme', source: 'scoop', homepage: 'https://github.com/eza-community/eza' },
  { name: 'Neovim', ident: 'neovim', category: 'Paket Yöneticileri', description: 'Modern vim editörü', source: 'scoop', icon: brandIcon('neovim'), homepage: 'https://neovim.io' },
  { name: 'Visual Studio Code (Scoop)', ident: 'vscode', category: 'Paket Yöneticileri', description: 'Kod editörü', source: 'scoop', homepage: 'https://code.visualstudio.com' },
  { name: 'Python (Scoop)', ident: 'python', category: 'Paket Yöneticileri', description: 'Python çalışma zamanı', source: 'scoop', homepage: 'https://www.python.org' },
  { name: 'Node.js (Scoop)', ident: 'nodejs', category: 'Paket Yöneticileri', description: 'JavaScript çalışma zamanı', source: 'scoop', homepage: 'https://nodejs.org' },
  { name: 'sudo (Scoop)', ident: 'sudo', category: 'Paket Yöneticileri', description: 'Yönetici olarak komut çalıştırma', source: 'scoop', homepage: 'https://github.com/gerardog/gsudo' },
  { name: 'yq', ident: 'yq', category: 'Paket Yöneticileri', description: 'YAML işleme aracı', source: 'scoop', homepage: 'https://github.com/mikefarah/yq' },
  { name: 'make', ident: 'make', category: 'Paket Yöneticileri', description: 'GNU Make', source: 'scoop', icon: brandIcon('make'), homepage: 'https://www.gnu.org/software/make' },
  { name: 'CMake', ident: 'cmake', category: 'Paket Yöneticileri', description: 'Çapraz platform derleme sistemi', source: 'scoop', icon: brandIcon('cmake'), homepage: 'https://cmake.org' },
  { name: 'GCC (MinGW)', ident: 'gcc', category: 'Paket Yöneticileri', description: 'C/C++ derleyici', source: 'scoop', icon: brandIcon('gnu'), homepage: 'https://gcc.gnu.org' },
];

/** Kütüphane sekmeleri: istenen sıra sabitlenir; katalogda olmayan adlar da görünür. */
export const CATEGORIES = [
  'Tarayıcı',
  'Medya & Tasarım',
  'Oyun',
  'İletişim',
  'Güvenlik',
  'Sistem & Çalışma Zamanı',
  'Verimlilik',
  'Geliştirme',
  'Paket Yöneticileri',
];

/** Aynı kimlik farklı kaynaklarda bulunabileceği için seçim anahtarı kaynağı da içerir. */
export function recKey(item: RecommendedSoftware): string {
  return `${item.source || 'winget'}:${item.ident}`;
}

export function favicon(item: RecommendedSoftware): string | undefined {
  if (item.icon) return item.icon;
  if (!item.homepage) return undefined;
  try {
    const host = new URL(item.homepage).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
  } catch {
    return undefined;
  }
}
