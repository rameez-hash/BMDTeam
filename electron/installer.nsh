!macro customInit
  ; Force kill the app immediately
  nsExec::ExecToLog 'cmd.exe /c taskkill /f /im "BMD HRMS.exe" 2>nul & taskkill /f /t /im "BMD HRMS.exe" 2>nul'
  Sleep 2000
  nsExec::ExecToLog 'cmd.exe /c taskkill /f /im "BMD HRMS.exe" 2>nul'
  Sleep 1000
  
  ; Delete old uninstaller so uninstallOldVersion skips entirely
  Delete "$LOCALAPPDATA\Programs\hrms-desktop\Uninstall BMD HRMS.exe"
!macroend

!macro customCheckAppRunning
  ; Just kill - never show any dialog
  nsExec::ExecToLog 'cmd.exe /c taskkill /f /im "BMD HRMS.exe" 2>nul & taskkill /f /t /im "BMD HRMS.exe" 2>nul'
  Sleep 2000
!macroend

; This macro is checked by handleUninstallResult - if defined, it's called instead
; of the default error check. We just silently continue.
!macro customUnInstallCheck
  ; Silently ignore any uninstall errors - new files will overwrite anyway
  ClearErrors
!macroend
