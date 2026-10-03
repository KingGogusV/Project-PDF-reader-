param([Parameter(Mandatory=$true)][uint32]$OwnedPid,[Parameter(Mandatory=$true)][string]$ExpectedExecutable)
$ErrorActionPreference='Stop'
$process=Get-Process -Id $OwnedPid
if ($process.Path -ne $ExpectedExecutable -or $process.ProcessName -ne 'folio-desktop') { throw 'Owned process identity mismatch.' }
if ($process.MainWindowHandle -eq 0) { throw 'Owned app has no main window.' }
if (-not $process.CloseMainWindow()) { throw 'The OS close request could not be delivered.' }
Write-Output 'Delivered WM_CLOSE to the owned Folio test window.'
