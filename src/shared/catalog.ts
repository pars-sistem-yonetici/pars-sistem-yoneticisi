import type { PackageSource } from './types';

export interface RecommendedSoftware {
  name: string;
  ident: string;
  category: string;
  description: string;
  essential?: boolean;
  homepage?: string;
  /** Boşsa winget kullanılır. */
  source?: PackageSource;
}

// Tüm kimlikler winget 1.29 ile `winget show --id ... --exact` kullanılarak doğrulanmıştır.
export const CATALOG: RecommendedSoftware[] = [
  // Sistem & Çalışma Zamanı
  { name: '7-Zip', ident: '7zip.7zip', category: 'Sistem & Çalışma Zamanı', description: 'Dosya sıkıştırma/arşivleme', essential: true, homepage: 'https://www.7-zip.org' },
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
  { name: '.NET Desktop Runtime 9', ident: 'Microsoft.DotNet.DesktopRuntime.9', category: 'Sistem & Çalışma Zamanı', description: '.NET masaüstü uygulamaları için', essential: true, homepage: 'https://dotnet.microsoft.com' },
  { name: '.NET Desktop Runtime 8', ident: 'Microsoft.DotNet.DesktopRuntime.8', category: 'Sistem & Çalışma Zamanı', description: '.NET 8 tabanlı uygulamalar için', essential: true, homepage: 'https://dotnet.microsoft.com' },
  { name: '.NET Runtime 9', ident: 'Microsoft.DotNet.Runtime.9', category: 'Sistem & Çalışma Zamanı', description: '.NET konsol ve servis uygulamaları için', homepage: 'https://dotnet.microsoft.com' },
  { name: '.NET Runtime 8', ident: 'Microsoft.DotNet.Runtime.8', category: 'Sistem & Çalışma Zamanı', description: '.NET 8 konsol uygulamaları için', homepage: 'https://dotnet.microsoft.com' },
  { name: '.NET SDK 9', ident: 'Microsoft.DotNet.SDK.9', category: 'Sistem & Çalışma Zamanı', description: '.NET geliştirme araçları', homepage: 'https://dotnet.microsoft.com' },
  { name: '.NET SDK 8', ident: 'Microsoft.DotNet.SDK.8', category: 'Sistem & Çalışma Zamanı', description: '.NET 8 geliştirme araçları', homepage: 'https://dotnet.microsoft.com' },
  { name: 'DirectX End-User Runtime', ident: 'Microsoft.DirectX', category: 'Sistem & Çalışma Zamanı', description: 'Eski oyunlar için DirectX bileşenleri', essential: true, homepage: 'https://www.microsoft.com' },
  { name: 'Windows Terminal', ident: 'Microsoft.WindowsTerminal', category: 'Sistem & Çalışma Zamanı', description: 'Modern komut satırı', essential: true, homepage: 'https://learn.microsoft.com' },
  { name: 'Windows Terminal (Önizleme)', ident: 'Microsoft.WindowsTerminal.Preview', category: 'Sistem & Çalışma Zamanı', description: 'Windows Terminal test sürümü', homepage: 'https://learn.microsoft.com' },
  { name: 'PowerShell 7', ident: 'Microsoft.PowerShell', category: 'Sistem & Çalışma Zamanı', description: 'Modern PowerShell kabuğu', homepage: 'https://learn.microsoft.com' },
  { name: 'Windows Subsystem for Linux', ident: 'Microsoft.WSL', category: 'Sistem & Çalışma Zamanı', description: 'Windows üzerinde Linux alt sistemi', homepage: 'https://learn.microsoft.com' },
  { name: 'PowerToys', ident: 'Microsoft.PowerToys', category: 'Sistem & Çalışma Zamanı', description: 'Windows verimlilik araçları', homepage: 'https://learn.microsoft.com' },
  { name: 'CPU-Z', ident: 'CPUID.CPU-Z', category: 'Sistem & Çalışma Zamanı', description: 'İşlemci ve donanım bilgileri', homepage: 'https://www.cpuid.com' },
  { name: 'HWMonitor', ident: 'CPUID.HWMonitor', category: 'Sistem & Çalışma Zamanı', description: 'Sıcaklık ve voltaj izleme', homepage: 'https://www.cpuid.com' },
  { name: 'CrystalDiskInfo', ident: 'CrystalDewWorld.CrystalDiskInfo', category: 'Sistem & Çalışma Zamanı', description: 'Disk sağlığı izleme', homepage: 'https://crystalmark.info' },
  { name: 'CrystalDiskMark', ident: 'CrystalDewWorld.CrystalDiskMark', category: 'Sistem & Çalışma Zamanı', description: 'Disk hızı ölçümü', homepage: 'https://crystalmark.info' },
  { name: 'GPU-Z', ident: 'TechPowerUp.GPU-Z', category: 'Sistem & Çalışma Zamanı', description: 'Ekran kartı bilgileri', homepage: 'https://www.techpowerup.com' },
  { name: 'Process Explorer', ident: 'Microsoft.Sysinternals.ProcessExplorer', category: 'Sistem & Çalışma Zamanı', description: 'Gelişmiş görev yöneticisi', homepage: 'https://learn.microsoft.com' },
  { name: 'CCleaner', ident: 'Piriform.CCleaner', category: 'Sistem & Çalışma Zamanı', description: 'Geçici dosya ve kayıt temizleme', homepage: 'https://www.ccleaner.com' },
  { name: 'WizTree', ident: 'AntibodySoftware.WizTree', category: 'Sistem & Çalışma Zamanı', description: 'Hızlı disk alanı analizi', homepage: 'https://antibody-software.com' },
  { name: 'Speccy', ident: 'Piriform.Speccy', category: 'Sistem & Çalışma Zamanı', description: 'Sistem donanım özeti', homepage: 'https://www.ccleaner.com' },
  { name: 'Defraggler', ident: 'Piriform.Defraggler', category: 'Sistem & Çalışma Zamanı', description: 'Disk birleştirme aracı', homepage: 'https://www.ccleaner.com' },
  { name: 'Everything', ident: 'voidtools.Everything', category: 'Sistem & Çalışma Zamanı', description: 'Anında dosya arama', homepage: 'https://www.voidtools.com' },

  // Güvenlik
  { name: 'Malwarebytes', ident: 'Malwarebytes.Malwarebytes', category: 'Güvenlik', description: 'Kötü amaçlı yazılım tarayıcısı', homepage: 'https://www.malwarebytes.com' },
  { name: 'Bitdefender Antivirus', ident: 'Bitdefender.Bitdefender', category: 'Güvenlik', description: 'Antivirüs koruması', homepage: 'https://www.bitdefender.com' },
  { name: 'SUPERAntiSpyware', ident: 'SUPERAntiSpyware.SUPERAntiSpyware', category: 'Güvenlik', description: 'Casus yazılım taraması', homepage: 'https://www.superantispyware.com' },
  { name: 'AdGuard', ident: 'AdGuard.AdGuard', category: 'Güvenlik', description: 'Reklam ve izleyici engelleme', homepage: 'https://adguard.com' },
  { name: 'VeraCrypt', ident: 'IDRIX.VeraCrypt', category: 'Güvenlik', description: 'Disk ve dosya şifreleme', homepage: 'https://www.veracrypt.fr' },
  { name: 'KeePass', ident: 'DominikReichl.KeePass', category: 'Güvenlik', description: 'Yerel şifre yöneticisi', homepage: 'https://keepass.info' },
  { name: 'Bitwarden', ident: 'Bitwarden.Bitwarden', category: 'Güvenlik', description: 'Bulut şifre yöneticisi', homepage: 'https://bitwarden.com' },
  { name: '1Password', ident: 'AgileBits.1Password', category: 'Güvenlik', description: 'Şifre ve parola yöneticisi', homepage: 'https://1password.com' },
  { name: 'GnuPG', ident: 'GnuPG.GnuPG', category: 'Güvenlik', description: 'Açık kaynak şifreleme', homepage: 'https://gnupg.org' },
  { name: 'PuTTY', ident: 'PuTTY.PuTTY', category: 'Güvenlik', description: 'SSH / terminal istemcisi', homepage: 'https://www.putty.org' },
  { name: 'OpenVPN Connect', ident: 'OpenVPNTechnologies.OpenVPNConnect', category: 'Güvenlik', description: 'VPN istemcisi', homepage: 'https://openvpn.net' },
  { name: 'Wireshark', ident: 'WiresharkFoundation.Wireshark', category: 'Güvenlik', description: 'Ağ trafiği analizi', homepage: 'https://www.wireshark.org' },
  { name: 'TCPView', ident: 'Microsoft.Sysinternals.TCPView', category: 'Güvenlik', description: 'Ağ bağlantılarını izleme', homepage: 'https://learn.microsoft.com' },

  // Tarayıcı
  { name: 'Google Chrome', ident: 'Google.Chrome', category: 'Tarayıcı', description: 'Web tarayıcısı', homepage: 'https://www.google.com' },
  { name: 'Mozilla Firefox', ident: 'Mozilla.Firefox', category: 'Tarayıcı', description: 'Web tarayıcısı', homepage: 'https://www.mozilla.org' },
  { name: 'Mozilla Firefox ESR', ident: 'Mozilla.Firefox.ESR', category: 'Tarayıcı', description: 'Uzun süreli destek sürümü', homepage: 'https://www.mozilla.org' },
  { name: 'Brave', ident: 'Brave.Brave', category: 'Tarayıcı', description: 'Gizlilik odaklı tarayıcı', homepage: 'https://brave.com' },
  { name: 'Microsoft Edge', ident: 'Microsoft.Edge', category: 'Tarayıcı', description: 'Windows ile gelen tarayıcı', homepage: 'https://www.microsoft.com' },
  { name: 'Opera', ident: 'Opera.Opera', category: 'Tarayıcı', description: 'Yerleşik VPN’li tarayıcı', homepage: 'https://www.opera.com' },
  { name: 'Vivaldi', ident: 'Vivaldi.Vivaldi', category: 'Tarayıcı', description: 'Özelleştirilebilir tarayıcı', homepage: 'https://vivaldi.com' },
  { name: 'Tor Browser', ident: 'TorProject.TorBrowser', category: 'Tarayıcı', description: 'Anonim web tarayıcısı', homepage: 'https://www.torproject.org' },
  { name: 'Waterfox', ident: 'Waterfox.Waterfox', category: 'Tarayıcı', description: 'Gizlilik odaklı Firefox türevi', homepage: 'https://www.waterfox.net' },
  // İletişim
  { name: 'Telegram Desktop', ident: 'Telegram.TelegramDesktop', category: 'İletişim', description: 'Mesajlaşma', homepage: 'https://telegram.org' },
  { name: 'Discord', ident: 'Discord.Discord', category: 'İletişim', description: 'Topluluk ve sesli sohbet', homepage: 'https://discord.com' },
  { name: 'Slack', ident: 'SlackTechnologies.Slack', category: 'İletişim', description: 'Ekip iletişimi', homepage: 'https://slack.com' },
  { name: 'Microsoft Teams', ident: 'Microsoft.Teams', category: 'İletişim', description: 'Toplantı ve ekip çalışması', homepage: 'https://www.microsoft.com' },
  { name: 'Mattermost', ident: 'Mattermost.MattermostDesktop', category: 'İletişim', description: 'Açık kaynak ekip sohbeti', homepage: 'https://mattermost.com' },
  { name: 'Mozilla Thunderbird', ident: 'Mozilla.Thunderbird', category: 'İletişim', description: 'E-posta istemcisi', homepage: 'https://www.thunderbird.net' },
  { name: 'Zoom Workplace', ident: 'Zoom.Zoom', category: 'İletişim', description: 'Görüntülü toplantı', homepage: 'https://zoom.us' },
  { name: 'TeamViewer', ident: 'TeamViewer.TeamViewer', category: 'İletişim', description: 'Uzaktan erişim', homepage: 'https://www.teamviewer.com' },
  { name: 'AnyDesk', ident: 'AnyDesk.AnyDesk', category: 'İletişim', description: 'Hızlı uzaktan erişim', homepage: 'https://anydesk.com' },

  // Verimlilik
  { name: 'LibreOffice', ident: 'TheDocumentFoundation.LibreOffice', category: 'Verimlilik', description: 'Ücretsiz ofis paketi', homepage: 'https://www.libreoffice.org' },
  { name: 'ONLYOFFICE Desktop Editors', ident: 'ONLYOFFICE.DesktopEditors', category: 'Verimlilik', description: 'Ofis belge düzenleyici', homepage: 'https://www.onlyoffice.com' },
  { name: 'WPS Office', ident: 'Kingsoft.WPSOffice', category: 'Verimlilik', description: 'Hafif ofis paketi', homepage: 'https://www.wps.com' },
  { name: 'Notepad++', ident: 'Notepad++.Notepad++', category: 'Verimlilik', description: 'Gelişmiş metin düzenleyici', homepage: 'https://notepad-plus-plus.org' },
  { name: 'Visual Studio Code', ident: 'Microsoft.VisualStudioCode', category: 'Verimlilik', description: 'Kod düzenleyici', homepage: 'https://code.visualstudio.com' },
  { name: 'Obsidian', ident: 'Obsidian.Obsidian', category: 'Verimlilik', description: 'Not alma ve bilgi yönetimi', homepage: 'https://obsidian.md' },
  { name: 'Joplin', ident: 'Joplin.Joplin', category: 'Verimlilik', description: 'Açık kaynak not uygulaması', homepage: 'https://joplinapp.org' },
  { name: 'Freeplane', ident: 'Freeplane.Freeplane', category: 'Verimlilik', description: 'Zihin haritası oluşturma', homepage: 'https://www.freeplane.org' },
  { name: 'ShareX', ident: 'ShareX.ShareX', category: 'Verimlilik', description: 'Ekran görüntüsü ve kayıt', homepage: 'https://getsharex.com' },
  { name: 'SumatraPDF', ident: 'SumatraPDF.SumatraPDF', category: 'Verimlilik', description: 'Hızlı PDF okuyucu', homepage: 'https://www.sumatrapdfreader.org' },
  { name: 'Foxit PDF Reader', ident: 'Foxit.FoxitReader', category: 'Verimlilik', description: 'PDF görüntüleme ve düzenleme', homepage: 'https://www.foxit.com' },
  { name: 'calibre', ident: 'calibre.calibre', category: 'Verimlilik', description: 'E-kitap yönetimi', homepage: 'https://calibre-ebook.com' },
  { name: 'Figma', ident: 'Figma.Figma', category: 'Verimlilik', description: 'Arayüz tasarım iş birliği', homepage: 'https://www.figma.com' },
  { name: 'Notion', ident: 'Notion.Notion', category: 'Verimlilik', description: 'Not, proje ve wiki', homepage: 'https://www.notion.so' },
  { name: 'Microsoft Power BI Desktop', ident: 'Microsoft.PowerBI', category: 'Verimlilik', description: 'Veri görselleştirme', homepage: 'https://powerbi.microsoft.com' },
  { name: 'Toggl Track', ident: 'Toggl.TogglTrack', category: 'Verimlilik', description: 'Zaman takibi', homepage: 'https://toggl.com' },

  // Medya & Tasarım
  { name: 'VLC media player', ident: 'VideoLAN.VLC', category: 'Medya & Tasarım', description: 'Video ve ses oynatıcı', homepage: 'https://www.videolan.org' },
  { name: 'Kodi', ident: 'XBMCFoundation.Kodi', category: 'Medya & Tasarım', description: 'Medya merkezi', homepage: 'https://kodi.tv' },
  { name: 'PotPlayer', ident: 'Daum.PotPlayer', category: 'Medya & Tasarım', description: 'Güçlü video oynatıcı', homepage: 'https://potplayer.daum.net' },
  { name: 'Spotify', ident: 'Spotify.Spotify', category: 'Medya & Tasarım', description: 'Müzik akışı', homepage: 'https://www.spotify.com' },
  { name: 'iTunes', ident: 'Apple.iTunes', category: 'Medya & Tasarım', description: 'Apple cihaz yönetimi', homepage: 'https://www.apple.com' },
  { name: 'Audacity', ident: 'Audacity.Audacity', category: 'Medya & Tasarım', description: 'Ses düzenleme', homepage: 'https://www.audacityteam.org' },
  { name: 'FFmpeg', ident: 'Gyan.FFmpeg', category: 'Medya & Tasarım', description: 'Video/ses dönüştürme araçları', homepage: 'https://ffmpeg.org' },
  { name: 'HandBrake', ident: 'HandBrake.HandBrake', category: 'Medya & Tasarım', description: 'Video transkodlama', homepage: 'https://handbrake.fr' },
  { name: 'OBS Studio', ident: 'OBSProject.OBSStudio', category: 'Medya & Tasarım', description: 'Canlı yayın ve kayıt', homepage: 'https://obsproject.com' },
  { name: 'GIMP', ident: 'GIMP.GIMP', category: 'Medya & Tasarım', description: 'Görsel düzenleme', homepage: 'https://www.gimp.org' },
  { name: 'Krita', ident: 'KDE.Krita', category: 'Medya & Tasarım', description: 'Dijital çizim ve boyama', homepage: 'https://krita.org' },
  { name: 'Inkscape', ident: 'Inkscape.Inkscape', category: 'Medya & Tasarım', description: 'Vektör grafik düzenleme', homepage: 'https://inkscape.org' },
  { name: 'Paint.NET', ident: 'dotPDN.PaintDotNet', category: 'Medya & Tasarım', description: 'Hızlı görsel düzenleme', homepage: 'https://www.getpaint.net' },
  { name: 'Blender', ident: 'BlenderFoundation.Blender', category: 'Medya & Tasarım', description: '3D modelleme ve animasyon', homepage: 'https://www.blender.org' },
  { name: 'IrfanView', ident: 'IrfanSkiljan.IrfanView', category: 'Medya & Tasarım', description: 'Hızlı görüntü görüntüleyici', homepage: 'https://www.irfanview.com' },
  { name: 'ImageMagick', ident: 'ImageMagick.ImageMagick', category: 'Medya & Tasarım', description: 'Komut satırı görsel işleme', homepage: 'https://imagemagick.org' },
  { name: 'Adobe Acrobat Reader', ident: 'Adobe.Acrobat.Reader.64-bit', category: 'Medya & Tasarım', description: 'PDF okuyucu', homepage: 'https://www.adobe.com' },
  { name: 'Plex Media Server', ident: 'Plex.PlexMediaServer', category: 'Medya & Tasarım', description: 'Kişisel medya sunucusu', homepage: 'https://www.plex.tv' },
  { name: 'Plex', ident: 'Plex.Plex', category: 'Medya & Tasarım', description: 'Medya oynatıcı istemcisi', homepage: 'https://www.plex.tv' },
  { name: 'Jellyfin Media Player', ident: 'Jellyfin.JellyfinMediaPlayer', category: 'Medya & Tasarım', description: 'Açık kaynak medya oynatıcı', homepage: 'https://jellyfin.org' },
  { name: 'Jellyfin Server', ident: 'Jellyfin.Server', category: 'Medya & Tasarım', description: 'Açık kaynak medya sunucusu', homepage: 'https://jellyfin.org' },
  { name: 'qBittorrent', ident: 'qBittorrent.qBittorrent', category: 'Medya & Tasarım', description: 'Torrent istemcisi', homepage: 'https://www.qbittorrent.org' },
  { name: 'Transmission', ident: 'Transmission.Transmission', category: 'Medya & Tasarım', description: 'Hafif torrent istemcisi', homepage: 'https://transmissionbt.com' },
  { name: 'WinSCP', ident: 'WinSCP.WinSCP', category: 'Medya & Tasarım', description: 'SFTP / FTP istemcisi', homepage: 'https://winscp.net' },

  // Geliştirme
  { name: 'Git', ident: 'Git.Git', category: 'Geliştirme', description: 'Sürüm kontrol sistemi', homepage: 'https://git-scm.com' },
  { name: 'GitHub Desktop', ident: 'GitHub.GitHubDesktop', category: 'Geliştirme', description: 'Görsel Git istemcisi', homepage: 'https://desktop.github.com' },
  { name: 'TortoiseGit', ident: 'TortoiseGit.TortoiseGit', category: 'Geliştirme', description: 'Windows Explorer Git entegrasyonu', homepage: 'https://tortoisegit.org' },
  { name: 'Python 3.13', ident: 'Python.Python.3.13', category: 'Geliştirme', description: 'Python yorumlayıcısı', homepage: 'https://www.python.org' },
  { name: 'Python 3.12', ident: 'Python.Python.3.12', category: 'Geliştirme', description: 'Python kararlı sürümü', homepage: 'https://www.python.org' },
  { name: 'Node.js LTS', ident: 'OpenJS.NodeJS.LTS', category: 'Geliştirme', description: 'JavaScript çalışma zamanı (LTS)', homepage: 'https://nodejs.org' },
  { name: 'Node.js', ident: 'OpenJS.NodeJS', category: 'Geliştirme', description: 'JavaScript çalışma zamanı (güncel)', homepage: 'https://nodejs.org' },
  { name: 'Docker Desktop', ident: 'Docker.DockerDesktop', category: 'Geliştirme', description: 'Konteyner geliştirme', homepage: 'https://www.docker.com' },
  { name: 'Visual Studio 2022 Community', ident: 'Microsoft.VisualStudio.2022.Community', category: 'Geliştirme', description: 'Ücretsiz IDE', homepage: 'https://visualstudio.microsoft.com' },
  { name: 'Visual Studio Build Tools', ident: 'Microsoft.VisualStudio.2022.BuildTools', category: 'Geliştirme', description: 'Derleme araçları', homepage: 'https://visualstudio.microsoft.com' },
  { name: 'IntelliJ IDEA Community', ident: 'JetBrains.IntelliJIDEA.Community', category: 'Geliştirme', description: 'Java / Kotlin IDE', homepage: 'https://www.jetbrains.com' },
  { name: 'PyCharm Community', ident: 'JetBrains.PyCharm.Community', category: 'Geliştirme', description: 'Python IDE', homepage: 'https://www.jetbrains.com' },
  { name: 'WebStorm', ident: 'JetBrains.WebStorm', category: 'Geliştirme', description: 'JavaScript IDE', homepage: 'https://www.jetbrains.com' },
  { name: 'Rider', ident: 'JetBrains.Rider', category: 'Geliştirme', description: '.NET IDE', homepage: 'https://www.jetbrains.com' },
  { name: 'GoLand', ident: 'JetBrains.GoLand', category: 'Geliştirme', description: 'Go IDE', homepage: 'https://www.jetbrains.com' },
  { name: 'Android Studio', ident: 'Google.AndroidStudio', category: 'Geliştirme', description: 'Android uygulama geliştirme', homepage: 'https://developer.android.com' },
  { name: 'OpenJDK 21', ident: 'Microsoft.OpenJDK.21', category: 'Geliştirme', description: 'Java 21 geliştirme kiti', homepage: 'https://learn.microsoft.com' },
  { name: 'OpenJDK 17', ident: 'Microsoft.OpenJDK.17', category: 'Geliştirme', description: 'Java 17 geliştirme kiti', homepage: 'https://learn.microsoft.com' },
  { name: 'Go', ident: 'GoLang.Go', category: 'Geliştirme', description: 'Go programlama dili', homepage: 'https://go.dev' },
  { name: 'Rustup', ident: 'Rustlang.Rustup', category: 'Geliştirme', description: 'Rust araç zinciri', homepage: 'https://rustup.rs' },
  { name: 'LLVM', ident: 'LLVM.LLVM', category: 'Geliştirme', description: 'Derleyici altyapısı', homepage: 'https://llvm.org' },
  { name: 'CMake', ident: 'Kitware.CMake', category: 'Geliştirme', description: 'Çapraz platform derleme sistemi', homepage: 'https://cmake.org' },
  { name: 'Ninja', ident: 'Ninja-build.Ninja', category: 'Geliştirme', description: 'Hızlı derleme aracı', homepage: 'https://ninja-build.org' },
  { name: 'MSYS2', ident: 'MSYS2.MSYS2', category: 'Geliştirme', description: 'Windows için Unix araçları', homepage: 'https://www.msys2.org' },
  { name: 'Cygwin', ident: 'Cygwin.Cygwin', category: 'Geliştirme', description: 'Windows için POSIX ortamı', homepage: 'https://www.cygwin.com' },
  { name: 'PostgreSQL 16', ident: 'PostgreSQL.PostgreSQL.16', category: 'Geliştirme', description: 'İlişkisel veritabanı', homepage: 'https://www.postgresql.org' },
  { name: 'HeidiSQL', ident: 'HeidiSQL.HeidiSQL', category: 'Geliştirme', description: 'Veritabanı yönetim aracı', homepage: 'https://www.heidisql.com' },
  { name: 'DBeaver Community', ident: 'DBeaver.DBeaver.Community', category: 'Geliştirme', description: 'Evrensel veritabanı aracı', homepage: 'https://dbeaver.io' },

  // Oyun
  { name: 'Steam', ident: 'Valve.Steam', category: 'Oyun', description: 'Oyun platformu', homepage: 'https://store.steampowered.com' },
  { name: 'Epic Games Launcher', ident: 'EpicGames.EpicGamesLauncher', category: 'Oyun', description: 'Oyun platformu', homepage: 'https://www.epicgames.com' },
  { name: 'GOG Galaxy', ident: 'GOG.Galaxy', category: 'Oyun', description: 'DRM’siz oyun platformu', homepage: 'https://www.gog.com' },
  { name: 'Ubisoft Connect', ident: 'Ubisoft.Connect', category: 'Oyun', description: 'Ubisoft oyun platformu', homepage: 'https://www.ubisoft.com' },
  { name: 'Battle.net', ident: 'Blizzard.BattleNet', category: 'Oyun', description: 'Blizzard oyun platformu', homepage: 'https://www.blizzard.com' },
  { name: 'EA Desktop', ident: 'ElectronicArts.EADesktop', category: 'Oyun', description: 'EA oyun platformu', homepage: 'https://www.ea.com' },
  { name: 'Logitech G HUB', ident: 'Logitech.GHUB', category: 'Oyun', description: 'Oyun çevre birimi yazılımı', homepage: 'https://www.logitechg.com' },

  // Chocolatey paketleri (kimlikler choco community repository biçimindedir).
  { name: 'Chocolatey', ident: 'chocolatey', category: 'Paket Yöneticileri', description: 'Windows paket yöneticisinin kendisi', source: 'choco', homepage: 'https://chocolatey.org' },
  { name: 'Git (Chocolatey)', ident: 'git', category: 'Paket Yöneticileri', description: 'Sürüm kontrol sistemi', source: 'choco', homepage: 'https://git-scm.com' },
  { name: '7-Zip (Chocolatey)', ident: '7zip', category: 'Paket Yöneticileri', description: 'Dosya sıkıştırma/arşivleme', source: 'choco', homepage: 'https://www.7-zip.org' },
  { name: 'Visual Studio Code (Chocolatey)', ident: 'vscode', category: 'Paket Yöneticileri', description: 'Kod editörü', source: 'choco', homepage: 'https://code.visualstudio.com' },
  { name: 'Google Chrome (Chocolatey)', ident: 'googlechrome', category: 'Paket Yöneticileri', description: 'Web tarayıcısı', source: 'choco', homepage: 'https://www.google.com/chrome' },
  { name: 'Mozilla Firefox (Chocolatey)', ident: 'firefox', category: 'Paket Yöneticileri', description: 'Web tarayıcısı', source: 'choco', homepage: 'https://www.mozilla.org' },
  { name: 'Node.js (Chocolatey)', ident: 'nodejs', category: 'Paket Yöneticileri', description: 'JavaScript çalışma zamanı', source: 'choco', homepage: 'https://nodejs.org' },
  { name: 'Python 3 (Chocolatey)', ident: 'python3', category: 'Paket Yöneticileri', description: 'Python çalışma zamanı', source: 'choco', homepage: 'https://www.python.org' },
  { name: 'Notepad++ (Chocolatey)', ident: 'notepadplusplus', category: 'Paket Yöneticileri', description: 'Metin düzenleyici', source: 'choco', homepage: 'https://notepad-plus-plus.org' },
  { name: 'PuTTY (Chocolatey)', ident: 'putty', category: 'Paket Yöneticileri', description: 'SSH / terminal istemcisi', source: 'choco', homepage: 'https://www.putty.org' },
  { name: 'VLC (Chocolatey)', ident: 'vlc', category: 'Paket Yöneticileri', description: 'Medya oynatıcı', source: 'choco', homepage: 'https://www.videolan.org' },
  { name: 'Audacity (Chocolatey)', ident: 'audacity', category: 'Paket Yöneticileri', description: 'Ses düzenleyici', source: 'choco', homepage: 'https://www.audacityteam.org' },
  { name: 'GIMP (Chocolatey)', ident: 'gimp', category: 'Paket Yöneticileri', description: 'Görsel düzenleyici', source: 'choco', homepage: 'https://www.gimp.org' },
  { name: 'OBS Studio (Chocolatey)', ident: 'obs-studio', category: 'Paket Yöneticileri', description: 'Ekran kayıt ve yayın', source: 'choco', homepage: 'https://obsproject.com' },
  { name: 'LibreOffice (Chocolatey)', ident: 'libreoffice', category: 'Paket Yöneticileri', description: 'Ofis paketi', source: 'choco', homepage: 'https://www.libreoffice.org' },
  { name: 'Docker Desktop (Chocolatey)', ident: 'docker-desktop', category: 'Paket Yöneticileri', description: 'Konteyner geliştirme ortamı', source: 'choco', homepage: 'https://www.docker.com' },
  { name: 'curl (Chocolatey)', ident: 'curl', category: 'Paket Yöneticileri', description: 'HTTP istemcisi', source: 'choco', homepage: 'https://curl.se' },
  { name: 'jq (Chocolatey)', ident: 'jq', category: 'Paket Yöneticileri', description: 'JSON işleme aracı', source: 'choco', homepage: 'https://jqlang.github.io/jq' },

  // npm global paketleri.
  { name: 'npm (güncelle)', ident: 'npm', category: 'Paket Yöneticileri', description: 'Node paket yöneticisi', source: 'npm', homepage: 'https://www.npmjs.com/package/npm' },
  { name: 'Yarn', ident: 'yarn', category: 'Paket Yöneticileri', description: 'Alternatif Node paket yöneticisi', source: 'npm', homepage: 'https://yarnpkg.com' },
  { name: 'pnpm', ident: 'pnpm', category: 'Paket Yöneticileri', description: 'Hızlı Node paket yöneticisi', source: 'npm', homepage: 'https://pnpm.io' },
  { name: 'TypeScript', ident: 'typescript', category: 'Paket Yöneticileri', description: 'TS derleyicisi', source: 'npm', homepage: 'https://www.typescriptlang.org' },
  { name: 'ts-node', ident: 'ts-node', category: 'Paket Yöneticileri', description: 'TypeScript çalıştırıcı', source: 'npm', homepage: 'https://typestrong.org/ts-node' },
  { name: 'nodemon', ident: 'nodemon', category: 'Paket Yöneticileri', description: 'Geliştirme sunucusu yeniden başlatıcı', source: 'npm', homepage: 'https://nodemon.io' },
  { name: 'PM2', ident: 'pm2', category: 'Paket Yöneticileri', description: 'Node süreç yöneticisi', source: 'npm', homepage: 'https://pm2.keymetrics.io' },
  { name: 'ESLint', ident: 'eslint', category: 'Paket Yöneticileri', description: 'Kod kalite denetimi', source: 'npm', homepage: 'https://eslint.org' },
  { name: 'Prettier', ident: 'prettier', category: 'Paket Yöneticileri', description: 'Kod biçimlendirici', source: 'npm', homepage: 'https://prettier.io' },
  { name: 'Vite', ident: 'vite', category: 'Paket Yöneticileri', description: 'Ön yüz derleme aracı', source: 'npm', homepage: 'https://vite.dev' },
  { name: 'Vue CLI', ident: '@vue/cli', category: 'Paket Yöneticileri', description: 'Vue proje oluşturucu', source: 'npm', homepage: 'https://cli.vuejs.org' },
  { name: 'Angular CLI', ident: '@angular/cli', category: 'Paket Yöneticileri', description: 'Angular proje oluşturucu', source: 'npm', homepage: 'https://angular.dev/tools/cli' },
  { name: 'serve', ident: 'serve', category: 'Paket Yöneticileri', description: 'Yerel statik sunucu', source: 'npm', homepage: 'https://www.npmjs.com/package/serve' },
  { name: 'webpack CLI', ident: 'webpack-cli', category: 'Paket Yöneticileri', description: 'webpack komut satırı', source: 'npm', homepage: 'https://webpack.js.org' },

  // Scoop paketleri.
  { name: 'Scoop', ident: 'scoop', category: 'Paket Yöneticileri', description: 'Kullanıcı bazlı Windows paket yöneticisi', source: 'scoop', homepage: 'https://scoop.sh' },
  { name: 'Git (Scoop)', ident: 'git', category: 'Paket Yöneticileri', description: 'Sürüm kontrol sistemi', source: 'scoop', homepage: 'https://git-scm.com' },
  { name: '7-Zip (Scoop)', ident: '7zip', category: 'Paket Yöneticileri', description: 'Dosya sıkıştırma/arşivleme', source: 'scoop', homepage: 'https://www.7-zip.org' },
  { name: 'curl (Scoop)', ident: 'curl', category: 'Paket Yöneticileri', description: 'HTTP istemcisi', source: 'scoop', homepage: 'https://curl.se' },
  { name: 'wget (Scoop)', ident: 'wget', category: 'Paket Yöneticileri', description: 'Dosya indirici', source: 'scoop', homepage: 'https://www.gnu.org/software/wget' },
  { name: 'jq (Scoop)', ident: 'jq', category: 'Paket Yöneticileri', description: 'JSON işleme aracı', source: 'scoop', homepage: 'https://jqlang.github.io/jq' },
  { name: 'fzf', ident: 'fzf', category: 'Paket Yöneticileri', description: 'Bulansal arama aracı', source: 'scoop', homepage: 'https://github.com/junegunn/fzf' },
  { name: 'ripgrep', ident: 'ripgrep', category: 'Paket Yöneticileri', description: 'Hızlı metin arama', source: 'scoop', homepage: 'https://github.com/BurntSushi/ripgrep' },
  { name: 'fd', ident: 'fd', category: 'Paket Yöneticileri', description: 'Hızlı dosya bulma', source: 'scoop', homepage: 'https://github.com/sharkdp/fd' },
  { name: 'bat', ident: 'bat', category: 'Paket Yöneticileri', description: 'cat yerine gelişmiş görüntüleyici', source: 'scoop', homepage: 'https://github.com/sharkdp/bat' },
  { name: 'eza', ident: 'eza', category: 'Paket Yöneticileri', description: 'Modern dizin listeleme', source: 'scoop', homepage: 'https://github.com/eza-community/eza' },
  { name: 'Neovim', ident: 'neovim', category: 'Paket Yöneticileri', description: 'Modern vim editörü', source: 'scoop', homepage: 'https://neovim.io' },
  { name: 'Visual Studio Code (Scoop)', ident: 'vscode', category: 'Paket Yöneticileri', description: 'Kod editörü', source: 'scoop', homepage: 'https://code.visualstudio.com' },
  { name: 'Python (Scoop)', ident: 'python', category: 'Paket Yöneticileri', description: 'Python çalışma zamanı', source: 'scoop', homepage: 'https://www.python.org' },
  { name: 'Node.js (Scoop)', ident: 'nodejs', category: 'Paket Yöneticileri', description: 'JavaScript çalışma zamanı', source: 'scoop', homepage: 'https://nodejs.org' },
  { name: 'sudo (Scoop)', ident: 'sudo', category: 'Paket Yöneticileri', description: 'Yönetici olarak komut çalıştırma', source: 'scoop', homepage: 'https://github.com/gerardog/gsudo' },
  { name: 'yq', ident: 'yq', category: 'Paket Yöneticileri', description: 'YAML işleme aracı', source: 'scoop', homepage: 'https://github.com/mikefarah/yq' },
  { name: 'make', ident: 'make', category: 'Paket Yöneticileri', description: 'GNU Make', source: 'scoop', homepage: 'https://www.gnu.org/software/make' },
  { name: 'CMake', ident: 'cmake', category: 'Paket Yöneticileri', description: 'Çapraz platform derleme sistemi', source: 'scoop', homepage: 'https://cmake.org' },
  { name: 'GCC (MinGW)', ident: 'gcc', category: 'Paket Yöneticileri', description: 'C/C++ derleyici', source: 'scoop', homepage: 'https://gcc.gnu.org' },
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
  if (!item.homepage) return undefined;
  try {
    const host = new URL(item.homepage).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
  } catch {
    return undefined;
  }
}
