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
!endif
