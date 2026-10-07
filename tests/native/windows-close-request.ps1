param([Parameter(Mandatory=$true)][uint32]$OwnedPid,[Parameter(Mandatory=$true)][string]$ExpectedExecutable,[long]$MainWindowHandle=0,[switch]$CaptureOnly)
$ErrorActionPreference='Stop'
$process=Get-Process -Id $OwnedPid
if ($process.Path -ne $ExpectedExecutable -or $process.ProcessName -ne 'folio-desktop') { throw 'Owned process identity mismatch.' }
if ($MainWindowHandle -eq 0) { $MainWindowHandle=$process.MainWindowHandle.ToInt64() }
if ($MainWindowHandle -eq 0) { throw 'Owned app has no main window.' }
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class FolioOwnedClose {
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
  [DllImport("user32.dll",SetLastError=true)] public static extern bool PostMessage(IntPtr window,uint message,IntPtr wparam,IntPtr lparam);
}
'@
[uint32]$windowPid=0
[void][FolioOwnedClose]::GetWindowThreadProcessId([IntPtr]$MainWindowHandle,[ref]$windowPid)
if ($windowPid -ne $OwnedPid) { throw 'Captured window does not belong to the owned app.' }
if ($CaptureOnly) { Write-Output (@{mainWindowHandle=$MainWindowHandle} | ConvertTo-Json -Compress); exit 0 }
if (-not [FolioOwnedClose]::PostMessage([IntPtr]$MainWindowHandle,0x0010,[IntPtr]::Zero,[IntPtr]::Zero)) { throw 'The OS close request could not be delivered.' }
Write-Output 'Delivered WM_CLOSE to the owned Folio test window.'
