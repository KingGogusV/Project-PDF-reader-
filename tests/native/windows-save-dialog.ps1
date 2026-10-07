param(
  [Parameter(Mandatory=$true)][ValidateSet('local','ci')][string]$Mode,
  [Parameter(Mandatory=$true)][uint32]$OwnedPid,
  [Parameter(Mandatory=$true)][string]$ExpectedExecutable,
  [Parameter(Mandatory=$true)][string]$ExpectedSha256,
  [Parameter(Mandatory=$true)][string]$TestRoot,
  [Parameter(Mandatory=$true)][string]$ReportPath,
  [Parameter(Mandatory=$true)][ValidateSet('inspect','cancel','save','confirm-existing')][string]$Action,
  [string]$Destination
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
if ($env:OS -ne 'Windows_NT') { throw 'Windows required.' }
if ($Mode -eq 'ci') {
  if ($env:GITHUB_ACTIONS -ne 'true' -or $env:CI -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or $env:GITHUB_REPOSITORY -ne 'KingGogusV/Project-PDF-reader-') { throw 'Disposable repository CI only.' }
  $temporaryRoot=[IO.Path]::GetFullPath($env:RUNNER_TEMP).TrimEnd('\')+'\'
} else {
  $principal=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
  if ($env:GITHUB_ACTIONS -eq 'true' -or $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Local mode requires a normal user session.' }
  $temporaryRoot=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')+'\'
}
$exe=(Resolve-Path -LiteralPath $ExpectedExecutable).Path
$root=(Resolve-Path -LiteralPath $TestRoot).Path.TrimEnd('\')+'\'
foreach ($path in @($exe,$root.TrimEnd('\'))) {
  if (-not $path.StartsWith($temporaryRoot,[StringComparison]::OrdinalIgnoreCase)) { throw 'Owned executable and test files must remain beneath the temporary root.' }
  $item=Get-Item -LiteralPath $path
  while ($item.FullName.TrimEnd('\') -ne $temporaryRoot.TrimEnd('\')) {
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Reparse points are not permitted in test-owned paths.' }
    $item=Get-Item -LiteralPath (Split-Path -Parent $item.FullName)
  }
}
$process=Get-Process -Id $OwnedPid
if ($process.Path -ne $exe -or $process.ProcessName -ne 'folio-desktop' -or $process.SessionId -ne (Get-Process -Id $PID).SessionId) { throw 'Owned process identity/session mismatch.' }
if ($ExpectedSha256 -notmatch '^[a-f0-9]{64}$') { throw 'Owned executable hash mismatch.' }
# A Windows PowerShell child can inherit a different module search path. Keep
# the executable identity check independent of cmdlet/module availability.
$digestAlgorithm=[Security.Cryptography.SHA256]::Create()
try {
  $executableStream=[IO.File]::OpenRead($exe)
  try { $actualExeSha256=[BitConverter]::ToString($digestAlgorithm.ComputeHash($executableStream)).Replace('-','').ToLowerInvariant() }
  finally { $executableStream.Dispose() }
} finally { $digestAlgorithm.Dispose() }
if ($actualExeSha256 -ne $ExpectedSha256) { throw 'Owned executable hash mismatch.' }
$reportRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../test-results')).TrimEnd('\')+'\'
if (-not [IO.Path]::GetFullPath($ReportPath).StartsWith($reportRoot,[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $ReportPath)) { throw 'Report must be a new file under repository test-results.' }
if ($Action -eq 'save') {
  $Destination=[IO.Path]::GetFullPath($Destination)
  if (-not $Destination.StartsWith($root,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetExtension($Destination) -ne '.pdf') { throw 'Save destination must be a synthetic PDF inside the owned test directory.' }
  $parent=Get-Item -LiteralPath (Split-Path -Parent $Destination)
  while ($parent.FullName.TrimEnd('\') -ne $root.TrimEnd('\')) {
    if (($parent.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Destination parent contains a reparse point.' }
    $parent=Get-Item -LiteralPath (Split-Path -Parent $parent.FullName)
  }
  if ((Test-Path -LiteralPath $Destination) -and ((Get-Item -LiteralPath $Destination).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Destination is a reparse point.' }
}
Add-Type -Path (Join-Path $PSScriptRoot 'OwnedWindowsDialog.cs')
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes
$result=[ordered]@{ action=$Action; ownedPid=$OwnedPid; status='running'; dialogs=@(); controls=@() }
try {
  $deadline=[DateTime]::UtcNow.AddSeconds(15)
  do {
    $windows=@([FolioNativeSmoke.OwnedWindowsDialog]::Dialogs($OwnedPid))
    $available=@($windows | Where-Object Enabled)
    if ($available.Count -gt 1) { throw 'Multiple enabled owned dialogs; refusing ambiguous interaction.' }
    if ($available.Count -eq 1) { break }
    Start-Sleep -Milliseconds 100
  } while ([DateTime]::UtcNow -lt $deadline)
  $result.dialogs=$windows
  if ($available.Count -ne 1) { throw 'No enabled owned native dialog appeared within 15 seconds.' }
  $window=$available[0]
  $element=[Windows.Automation.AutomationElement]::FromHandle([IntPtr]$window.Handle)
  $all=@($element.FindAll([Windows.Automation.TreeScope]::Descendants,[Windows.Automation.Condition]::TrueCondition))
  # Names/values can contain real MRU filenames in a local OS dialog. Keep only
  # the structural metadata required to diagnose owned-control matching.
  $result.controls=@($all | Where-Object { $_.Current.ControlType -in @([Windows.Automation.ControlType]::Edit,[Windows.Automation.ControlType]::Button) } | ForEach-Object { [ordered]@{ id=$_.Current.AutomationId; type=$_.Current.ControlType.ProgrammaticName; enabled=$_.Current.IsEnabled; handle=$_.Current.NativeWindowHandle } })
  if ($Action -eq 'save') {
    $edits=@($all | Where-Object { $_.Current.ControlType -eq [Windows.Automation.ControlType]::Edit -and $_.Current.AutomationId -eq '1148' })
    if ($edits.Count -ne 1) { $edits=@($all | Where-Object { $_.Current.ControlType -eq [Windows.Automation.ControlType]::Edit -and $_.Current.Name -match '^File name:?' }) }
    if ($edits.Count -ne 1) { throw 'Expected exactly one owned File name edit control.' }
    $value=$edits[0].GetCurrentPattern([Windows.Automation.ValuePattern]::Pattern)
    $value.SetValue($Destination)
  }
  if ($Action -ne 'inspect') {
    $buttonId=if ($Action -eq 'cancel') { '2' } elseif ($Action -eq 'confirm-existing') { '6' } else { '1' }
    $buttons=@($all | Where-Object { $_.Current.ControlType -eq [Windows.Automation.ControlType]::Button -and $_.Current.AutomationId -in @($buttonId,"CommandButton_$buttonId") -and $_.Current.IsEnabled })
    if ($buttons.Count -ne 1) { throw "Expected exactly one owned dialog button with ID $buttonId." }
    if ($buttons[0].Current.ProcessId -ne $OwnedPid) { throw 'UI Automation button does not belong to the owned process.' }
    if ($buttons[0].Current.NativeWindowHandle -ne 0) {
      [FolioNativeSmoke.OwnedWindowsDialog]::Click($OwnedPid,$window.Handle,$buttons[0].Current.NativeWindowHandle)
    } else {
      # Modern Windows confirmation buttons can be virtual UI Automation controls.
      $invoke=$buttons[0].GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern)
      $invoke.Invoke()
    }
  }
  $result.status='passed'
} catch { $result.status='failed'; $result.error=$_.Exception.Message; throw }
finally { [IO.File]::WriteAllText($ReportPath,($result | ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false)) }
Write-Output ($result | ConvertTo-Json -Depth 6 -Compress)
