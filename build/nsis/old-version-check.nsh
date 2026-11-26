!ifndef BUILD_UNINSTALLER
# Kurulum başlarken aynı uygulamanın önceki sürümünü algılar.
# electron-builder'ın yerleşik uninstallOldVersion akışı eski sürümü kaldırıp
# ardından yeni dosyaları kurar; bu macro yalnızca durumu görünür kılar.

Var /GLOBAL parsOldVersion
Var /GLOBAL parsOldLocation
Var /GLOBAL parsCmdLine
Var /GLOBAL parsCmdOption

# 1.0.4-1.0.6 istemcileri kurucuyu /SILENT /CLOSEAPPLICATIONS ile başlatır.
# Bu anahtarlar NSIS'te tanınmaz ve "uygulama çalışıyor" penceresinde beklenir.
# preInit, bu kontrolün öncesinde çalışır; eski istemciler de sessiz kurulabilir.
!macro preInit
  ${GetParameters} $parsCmdLine
  ${GetOptions} $parsCmdLine "/SILENT" $parsCmdOption
  ${IfNot} ${Errors}
    SetSilent silent
  ${EndIf}
!macroend

!macro customInit
  StrCpy $parsOldVersion ""
  StrCpy $parsOldLocation ""

  ReadRegStr $parsOldVersion SHELL_CONTEXT "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "DisplayVersion"
  ReadRegStr $parsOldLocation SHELL_CONTEXT "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "InstallLocation"

  ${If} $parsOldVersion == ""
    ReadRegStr $parsOldVersion HKEY_CURRENT_USER "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "DisplayVersion"
    ReadRegStr $parsOldLocation HKEY_CURRENT_USER "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "InstallLocation"
  ${EndIf}

  ${If} $parsOldVersion != ""
    DetailPrint "Onceki surum algilandir ($parsOldVersion); guncelleme icin kaldirilip yeniden kurulacak."
  ${ElseIf} $parsOldLocation != ""
    DetailPrint "Onceki kurulum algilandir; guncelleme icin kaldirilip yeniden kurulacak."
  ${Else}
    DetailPrint "Onceki surum bulunamadi; temiz kurulum yapilacak."
  ${EndIf}
!macroend

# winget eksikse kurulum sirasinda Microsoft'un resmi WinGet.Client moduluyle
# App Installer onarilir. nsExec konsol penceresi acmadan calistirir;
# /S --updated ile yapilan sessiz guncellemede de kullanicaya pencere cikmaz.
# Hata durumunda uygulama kurulumu yarim birakilmaz, sadece uyarı yazılır.

Var /GLOBAL parsWingetCode
Var /GLOBAL parsWingetOutput
Var /GLOBAL parsWingetScript

!macro customInstall
  Call EnsureWingetInstalled
!macroend

Function EnsureWingetInstalled
  StrCpy $parsWingetScript "$INSTDIR\resources\prereqs\install-winget.ps1"
  ${IfNot} ${FileExists} "$parsWingetScript"
    DetailPrint "UYARI: winget betigi pakette bulunamadi; otomatik kurulum atlandi."
    Return
  ${EndIf}

  DetailPrint "winget denetimi yapiliyor..."
  nsExec::ExecToStack /TIMEOUT=60000 `"$WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -Command "if (Get-Command winget.exe -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"`
  Pop $parsWingetCode
  Pop $parsWingetOutput
  ${If} $parsWingetCode == "0"
    DetailPrint "winget zaten kurulu; otomatik kurulum atlandi."
    Return
  ${EndIf}

  DetailPrint "winget eksik; resmi kaynaktan kuruluyor (birkac dakika surebilir)..."
  nsExec::ExecToStack /TIMEOUT=900000 `"$WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$parsWingetScript"`
  Pop $parsWingetCode
  Pop $parsWingetOutput
  ${If} $parsWingetOutput != ""
    DetailPrint $parsWingetOutput
  ${EndIf}

  nsExec::ExecToStack /TIMEOUT=60000 `"$WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -Command "if (Get-Command winget.exe -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"`
  Pop $parsWingetCode
  Pop $parsWingetOutput
  ${If} $parsWingetCode == "0"
    DetailPrint "winget kuruldu ve dogrulandi."
  ${Else}
    DetailPrint "UYARI: winget otomatik kurulumu tamamlanamadi. Uygulama kuruldu; Gerekli bilesenler panelinden yeniden deneyebilirsiniz."
  ${EndIf}
FunctionEnd
!endif
