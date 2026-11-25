!ifndef BUILD_UNINSTALLER
# Kurulum başlarken aynı uygulamanın önceki sürümünü algılar.
# electron-builder'ın yerleşik uninstallOldVersion akışı eski sürümü kaldırıp
# ardından yeni dosyaları kurar; bu macro yalnızca durumu görünür kılar.

Var /GLOBAL parsOldVersion
Var /GLOBAL parsOldLocation

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
