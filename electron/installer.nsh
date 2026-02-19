!macro customInit
  ; Kill running BMD HRMS process before installing
  nsExec::ExecToLog 'taskkill /f /im "BMD HRMS.exe"'
  Sleep 1000
!macroend
