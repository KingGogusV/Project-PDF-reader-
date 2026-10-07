param(
  [Parameter(Mandatory=$true)][ValidateSet('local','ci')][string]$Mode,
  [Parameter(Mandatory=$true)][string]$Executable,
  [Parameter(Mandatory=$true)][string]$ExpectedSha256,
  [string]$Profile,
  [ValidateSet('isolated','default')][string]$ProfileMode='isolated',
  [string]$ProfileState,
  [Parameter(Mandatory=$true)][int]$Port,
  [Parameter(Mandatory=$true)][string]$ReportPath,
  [Parameter(Mandatory=$true)][string]$StopFile
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($env:OS -ne 'Windows_NT') { throw 'Windows required.' }
if ($ProfileMode -eq 'default' -and $Mode -ne 'ci') { throw 'Default-profile verification is restricted to disposable CI; never use a real local library.' }
if ($ProfileMode -eq 'default' -and $Profile) { throw 'Default-profile mode does not accept a caller-selected profile.' }
if ($ProfileMode -eq 'isolated' -and (-not $Profile -or $ProfileState)) { throw 'Isolated mode requires only its explicit temporary profile.' }
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
$elevated = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($Mode -eq 'ci') {
  if ($env:GITHUB_ACTIONS -ne 'true' -or $env:CI -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or $env:GITHUB_REPOSITORY -ne 'KingGogusV/Project-PDF-reader-') { throw 'CI mode is restricted to this repository on disposable GitHub-hosted runners.' }
  $root = (Resolve-Path -LiteralPath $env:RUNNER_TEMP).Path
} else {
  if ($elevated -or $env:GITHUB_ACTIONS -eq 'true') { throw 'Local mode requires a normal non-elevated user session.' }
  $root = [IO.Path]::GetTempPath()
}
$root = [IO.Path]::GetFullPath($root).TrimEnd('\') + '\'
$exe = (Resolve-Path -LiteralPath $Executable).Path
foreach ($path in @($exe)) {
  if (-not $path.StartsWith($root,[StringComparison]::OrdinalIgnoreCase)) { throw 'App and test profile must stay beneath the selected temporary directory.' }
  $item = Get-Item -Force -LiteralPath $path
  while ($item.FullName.TrimEnd('\') -ne $root.TrimEnd('\')) {
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Reparse points are not allowed in owned native paths.' }
    $item = Get-Item -Force -LiteralPath (Split-Path -Parent $item.FullName)
  }
}
$reportRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../test-results')).TrimEnd('\') + '\'
if ($ProfileMode -eq 'default') {
  if (-not $ProfileState -or -not [IO.Path]::GetFullPath($ProfileState).StartsWith($reportRoot,[StringComparison]::OrdinalIgnoreCase) -or $env:GITHUB_SHA -notmatch '^[a-f0-9]{40}$') { throw 'Default-profile ownership requires a CI source and repository evidence file.' }
  $localRoot=[IO.Path]::GetFullPath([Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)).TrimEnd('\')+'\'
  $profilePath=Join-Path $localRoot 'app.folio.localreader'
  $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $profileFresh=-not (Test-Path -LiteralPath $ProfileState)
  if ($profileFresh -and (Test-Path -LiteralPath $profilePath)) { throw 'Default Folio profile is already occupied; refusing to seed or inspect it.' }
  foreach ($path in @($profilePath,(Join-Path $profilePath 'EBWebView'),[IO.Path]::GetFullPath($ProfileState))) {
    $itemPath=$path
    while (-not (Test-Path -LiteralPath $itemPath)) { $itemPath=Split-Path -Parent $itemPath }
    $item=Get-Item -Force -LiteralPath $itemPath
    while ($item) {
      if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Reparse points are not allowed in default-profile or ownership evidence paths.' }
      $parentPath=Split-Path -Parent $item.FullName
      if (-not $parentPath) { break }
      $item=Get-Item -Force -LiteralPath $parentPath
    }
  }
  if (-not $profileFresh) {
    if (-not (Test-Path -LiteralPath $ProfileState -PathType Leaf)) { throw 'Default-profile ownership evidence is not a file.' }
    $state=Get-Content -LiteralPath $ProfileState -Raw | ConvertFrom-Json
    if ($state.schema -ne 1 -or $state.profile -cne $profilePath -or $state.executable -cne $exe -or $state.sid -cne $sid -or $state.source -cne $env:GITHUB_SHA) { throw 'Default-profile ownership evidence differs from this CI run.' }
  }
  foreach ($hive in @([Microsoft.Win32.Registry]::CurrentUser,[Microsoft.Win32.Registry]::LocalMachine)) {
    foreach ($name in @('UserDataFolder','AdditionalBrowserArguments')) {
      $key=$hive.OpenSubKey('SOFTWARE\Policies\Microsoft\Edge\WebView2\'+$name)
      if ($key) { try { if ($key.ValueCount) { throw 'Existing WebView2 profile/debug policies prevent genuine default-profile verification.' } } finally { $key.Dispose() } }
    }
  }
} else {
  $profilePath=(Resolve-Path -LiteralPath $Profile).Path
  if (-not $profilePath.StartsWith($root,[StringComparison]::OrdinalIgnoreCase)) { throw 'Test profile must stay beneath the selected temporary directory.' }
  $item=Get-Item -Force -LiteralPath $profilePath
  while ($item.FullName.TrimEnd('\') -ne $root.TrimEnd('\')) {
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Reparse points are not allowed in owned native paths.' }
    $item=Get-Item -Force -LiteralPath (Split-Path -Parent $item.FullName)
  }
}
if ([IO.Path]::GetFileName($exe) -ne 'folio-desktop.exe' -or $Port -lt 1024 -or $Port -gt 65535) { throw 'Unexpected executable or port.' }
if ($ExpectedSha256 -notmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ExpectedSha256) { throw 'Installed executable hash mismatch.' }
foreach ($path in @($ReportPath,$StopFile)) {
  if (-not [IO.Path]::GetFullPath($path).StartsWith($reportRoot,[StringComparison]::OrdinalIgnoreCase)) { throw 'Reports must stay in repository test-results.' }
  if (Test-Path -LiteralPath $path) { throw 'Refusing a stale launch report or stop file.' }
}
if ($ProfileMode -eq 'default' -and $profileFresh) {
  # Create ownership only after all inputs pass; retain the synthetic profile
  # and this source/session-bound marker after verification.
  $state=@{schema=1;profile=$profilePath;executable=$exe;sid=$sid;source=$env:GITHUB_SHA} | ConvertTo-Json
  $stream=[IO.File]::Open($ProfileState,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try { $bytes=[Text.UTF8Encoding]::new($false).GetBytes($state);$stream.Write($bytes,0,$bytes.Length) } finally { $stream.Dispose() }
}
Add-Type -Path (Join-Path $PSScriptRoot 'OwnedWindowsProcess.cs')
$result = [ordered]@{ status='starting'; mode=$Mode; profileMode=$ProfileMode; userDataFolderOverride=($ProfileMode -eq 'isolated'); inheritedOverridesCleared=$false; elevated=$elevated; parentPid=$PID; sessionId=(Get-Process -Id $PID).SessionId; policyScope=$null; cleanup=[ordered]@{ ownedJobEmpty=$false; policyRemoved=$false }; startedAt=[DateTime]::UtcNow.ToString('o') }
if ($ProfileMode -eq 'default') { $result.defaultProfileFresh=$profileFresh }
$owned = $null
$entries = [Collections.Generic.List[object]]::new()
function Save-Report { [IO.File]::WriteAllText($ReportPath,($result | ConvertTo-Json -Depth 7),[Text.UTF8Encoding]::new($false)) }
$exitCode = 0
try {
  $arguments = "--remote-debugging-port=$Port --remote-debugging-address=127.0.0.1 --enable-logging --log-file=`"$(Join-Path $profilePath 'webview.log')`""
  # Remove inherited WebView overrides only from this helper's environment.
  foreach ($item in @(Get-ChildItem Env:WEBVIEW2_*)) { [Environment]::SetEnvironmentVariable($item.Name,$null,'Process') }
  $result.inheritedOverridesCleared=$true
  if ($Mode -eq 'ci' -and $elevated) {
    # Official per-executable overrides. Never wildcard policy or sandbox switches.
    # CI-only: no policy writes occur on the developer/user computer.
    $values = @{ AdditionalBrowserArguments=$arguments }
    if ($ProfileMode -eq 'isolated') { $values.UserDataFolder=$profilePath }
    foreach ($name in $values.Keys) {
      $path = 'SOFTWARE\Policies\Microsoft\Edge\WebView2\' + $name
      $key = [Microsoft.Win32.Registry]::LocalMachine.CreateSubKey($path)
      try {
        if ($null -ne $key.GetValue('folio-desktop.exe',$null)) { throw 'Existing Folio test policy must not be overwritten.' }
        $entries.Add(@{ path=$path; value=$values[$name] })
        $key.SetValue('folio-desktop.exe',$values[$name],[Microsoft.Win32.RegistryValueKind]::String)
      } finally { $key.Dispose() }
    }
    $result.policyScope = if ($ProfileMode -eq 'default') { 'HKLM per-executable loopback debugger only; genuine default profile; disposable CI' } else { 'HKLM per-executable folio-desktop.exe; disposable CI only; loopback debugger and owned profile' }
  } else {
    $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = $arguments
    if ($ProfileMode -eq 'isolated') { $env:WEBVIEW2_USER_DATA_FOLDER = $profilePath }
  }
  $owned = [FolioNativeSmoke.OwnedWindowsProcess]::new($exe,(Split-Path -Parent $exe))
  $result.childPid = $owned.Pid; $result.status='launched'; Save-Report
  $deadline = [DateTime]::UtcNow.AddSeconds(210)
  while (-not (Test-Path -LiteralPath $StopFile)) {
    if ($owned.ExitCode -ne 259) {
      if ($owned.ExitCode -eq 0 -and (Test-Path -LiteralPath ($StopFile + '.expected-close'))) { $result.status='closed'; break }
      throw "Installed app exited before test completion: $($owned.ExitCode)"
    }
    if ([DateTime]::UtcNow -ge $deadline) { throw 'Owned native test exceeded its lifetime.' }
    if (-not $result.Contains('webview')) {
      $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$($owned.Pid)" | Where-Object { $_.Name -eq 'msedgewebview2.exe' })
      if ($children.Count -gt 0) {
        if ($children.Count -ne 1) { throw 'Expected one direct WebView2 browser child.' }
        $child = $children[0]
        # A startup CIM snapshot can expose the child before its image metadata.
        # Keep polling within the existing bounded startup/lifetime checks; never
        # claim the runtime is verified without its path, version, profile and port.
        if ([string]::IsNullOrWhiteSpace($child.ExecutablePath)) {
          $result.webviewProbe = 'Waiting for the owned WebView2 image path from Windows'
          Save-Report
          Start-Sleep -Milliseconds 100
          continue
        }
        $match = [regex]::Match($child.CommandLine, '(?:^|\s)(?:"--user-data-dir=([^"]*)"|--user-data-dir=(?:"([^"]*)"|([^\s]+)))')
        if (-not $match.Success) { throw 'Owned WebView2 has no explicit data directory.' }
        $actual = ($match.Groups | Select-Object -Skip 1 | Where-Object Success | Select-Object -First 1).Value
        if ([IO.Path]::GetFullPath($actual).TrimEnd('\') -ne (Join-Path $profilePath 'EBWebView')) { throw 'Owned WebView2 profile differs from the verified test directory.' }
        if ($child.CommandLine -notmatch "(?:^|\s)--remote-debugging-port=$Port(?:\s|$)") { throw 'Owned WebView2 did not honor its test debugging port.' }
        $result.webview = @{ pid=$child.ProcessId; profileVerified=$true; profileMode=$ProfileMode; actualProfile=[IO.Path]::GetFullPath($actual).TrimEnd('\'); portVerified=$true; version=[Diagnostics.FileVersionInfo]::GetVersionInfo($child.ExecutablePath).ProductVersion }
        Save-Report
      }
    }
    Start-Sleep -Milliseconds 100
  }
  if ($result.status -ne 'closed') { $result.status='stopped' }
} catch { $result.status='failed'; $result.error=$_.Exception.Message; $exitCode=1 }
finally {
  if ($owned) {
    try { $owned.Stop(); $result.cleanup.ownedJobEmpty=$owned.Empty }
    catch { $result.cleanup.jobError=$_.Exception.Message; $result.status='failed'; $exitCode=1 }
    finally {
      try { $owned.Dispose() }
      catch { $result.cleanup.disposeError=$_.Exception.Message; $result.status='failed'; $exitCode=1 }
    }
  }
  foreach ($entry in $entries) {
    $key = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey($entry.path,$true)
    try {
      if ($null -ne $key) {
        if ($key.GetValue('folio-desktop.exe',$null) -ne $entry.value) { throw 'Test policy changed externally; refusing to overwrite it during cleanup.' }
        $key.DeleteValue('folio-desktop.exe',$false)
        if ($null -ne $key.GetValue('folio-desktop.exe',$null)) { throw 'Test policy cleanup failed.' }
      }
    } catch { $result.cleanup.policyError=$_.Exception.Message; $result.status='failed'; $exitCode=1 }
    finally { if ($key) { $key.Dispose() } }
  }
  $result.cleanup.policyRemoved = -not $result.cleanup.Contains('policyError')
  $result.completedAt=[DateTime]::UtcNow.ToString('o'); Save-Report
  Write-Output ($result | ConvertTo-Json -Depth 7)
}
exit $exitCode
