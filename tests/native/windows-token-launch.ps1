param([ValidateSet('Preflight','Launch','Cleanup')][string]$Mode = 'Preflight', [string]$AccountName, [string]$AccountSid)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($env:OS -ne 'Windows_NT' -or $env:GITHUB_ACTIONS -ne 'true' -or $env:CI -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted') {
  throw 'Temporary-account native tests run only in disposable GitHub-hosted Windows CI.'
}
Add-Type -Path (Join-Path $PSScriptRoot 'WindowsStandardUserProcess.cs')
if ($Mode -eq 'Cleanup') {
  if (-not [FolioNativeSmoke.StandardUserProcess]::RemoveExactAccount($AccountName,$AccountSid)) { throw 'Exact temporary account cleanup failed.' }
  Write-Output 'Exact temporary account is absent.'
  exit 0
}
$result = [ordered]@{ status = 'running'; mode = $Mode; parentPid = $PID; startedAt = [DateTime]::UtcNow.ToString('o') }
$launcher = $null
$diagnosticProfile = $null
$scriptExit = 0
function Save-Report {
  $json = $result | ConvertTo-Json -Depth 8
  if ($env:FOLIO_TOKEN_REPORT) {
    # Node/CI selects a project test-results path; no account or environment values are serialized.
    [System.IO.File]::WriteAllText($env:FOLIO_TOKEN_REPORT, $json, [System.Text.UTF8Encoding]::new($false))
  }
  Write-Output $json
}
function Get-ProfileAclFacts([string]$Path, [System.Security.Principal.SecurityIdentifier]$UserSid) {
  $facts = [ordered]@{ userAllowWrite=$false; userDenyWrite=$false; adminAllowWrite=$false; adminDenyWrite=$false }
  $acl = Get-Acl -LiteralPath $Path
  foreach ($rule in $acl.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])) {
    if (($rule.FileSystemRights -band [System.Security.AccessControl.FileSystemRights]::Write) -eq 0) { continue }
    $allow = $rule.AccessControlType -eq [System.Security.AccessControl.AccessControlType]::Allow
    if ($rule.IdentityReference.Value -eq $UserSid.Value) {
      if ($allow) { $facts.userAllowWrite=$true } else { $facts.userDenyWrite=$true }
    }
    if ($rule.IdentityReference.IsWellKnown([System.Security.Principal.WellKnownSidType]::BuiltinAdministratorsSid)) {
      if ($allow) { $facts.adminAllowWrite=$true } else { $facts.adminDenyWrite=$true }
    }
  }
  return $facts
}
function Get-SingletonPathFacts([string]$Root, [System.Security.Principal.SecurityIdentifier]$UserSid) {
  # Exactly the owned UDF and singleton file; never recurse, follow reparse points or change permissions.
  $rows = @()
  foreach ($relative in @('EBWebView','EBWebView\lockfile')) {
    $path = Join-Path $Root $relative
    $facts = [ordered]@{ relativePath=$relative; exists=$false }
    try {
      $item = Get-Item -LiteralPath $path -Force -ErrorAction Stop
      $facts.exists=$true
      $facts.directory=$item.PSIsContainer
      $facts.reparsePoint=($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0
      $facts.attributes=$item.Attributes.ToString()
      if ($facts.reparsePoint) { $rows += $facts; break }
      if (-not $item.PSIsContainer) { $facts.bytes=$item.Length }
      $acl = Get-Acl -LiteralPath $path
      $facts.ownerIsStandardUser=$acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -eq $UserSid.Value
      $facts.protectedAcl=$acl.AreAccessRulesProtected
      $facts.rules=@(foreach ($rule in $acl.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])) {
        $sid = $rule.IdentityReference
        $role = if ($sid.Value -eq $UserSid.Value) { 'created-standard-user' }
          elseif ($sid.IsWellKnown([System.Security.Principal.WellKnownSidType]::BuiltinAdministratorsSid)) { 'Administrators' }
          elseif ($sid.IsWellKnown([System.Security.Principal.WellKnownSidType]::BuiltinUsersSid)) { 'Users' }
          elseif ($sid.IsWellKnown([System.Security.Principal.WellKnownSidType]::AuthenticatedUserSid)) { 'AuthenticatedUsers' }
          elseif ($sid.IsWellKnown([System.Security.Principal.WellKnownSidType]::WorldSid)) { 'Everyone' }
          elseif ($sid.IsWellKnown([System.Security.Principal.WellKnownSidType]::LocalSystemSid)) { 'System' }
          else { 'other' }
        @{ role=$role; type=$rule.AccessControlType.ToString(); rights=$rule.FileSystemRights.ToString(); inherited=$rule.IsInherited }
      })
    } catch { $facts.error=$_.Exception.Message; $facts.errorId=$_.FullyQualifiedErrorId }
    $rows += $facts
    if (-not $facts.exists) { break }
  }
  return $rows
}
try {
  $result.parentToken = [FolioNativeSmoke.StandardUserProcess]::CurrentToken()
  Save-Report
  $receipt = [System.Action[string,string]]{ param($createdName,$createdSid)
    $result.account = @{ name=$createdName; sid=$createdSid; createdByHelper=$true }
    Save-Report
  }
  $launcher = [FolioNativeSmoke.StandardUserProcess]::new($receipt)
  $result.parentToken = $launcher.Parent
  $result.standardToken = $launcher.Standard
  $result.account = @{ name=$launcher.AccountName; sid=$launcher.AccountSid; createdByHelper=$true }
  $result.privateDesktop = $launcher.PrivateDesktop
  $result.status = 'preflight-passed'
  Save-Report
  if ($Mode -eq 'Launch') {
    if (-not $env:FOLIO_NATIVE_EXE -or -not $env:RUNNER_TEMP) { throw 'Installed executable and RUNNER_TEMP required.' }
    $temp = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $env:RUNNER_TEMP).Path).TrimEnd('\') + '\'
    $exe = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $env:FOLIO_NATIVE_EXE).Path)
    if (-not $exe.StartsWith($temp, [StringComparison]::OrdinalIgnoreCase) -or [System.IO.Path]::GetFileName($exe) -ne 'folio-desktop.exe') {
      throw 'Executable must be installed folio-desktop.exe beneath RUNNER_TEMP.'
    }
    if (-not $env:FOLIO_NATIVE_PROFILE) { throw 'Owned native profile required.' }
    $logParent = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $env:FOLIO_NATIVE_PROFILE).Path)
    if (-not $logParent.StartsWith($temp,[StringComparison]::OrdinalIgnoreCase)) { throw 'Native profile must be beneath RUNNER_TEMP.' }
    $profileItem = Get-Item -LiteralPath $logParent
    if (($profileItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0 -or
        -not $profileItem.Name.StartsWith('folio-native-profile-',[StringComparison]::Ordinal) -or
        @(Get-ChildItem -LiteralPath $logParent -Force).Count -ne 0) {
      throw 'Profile preparation requires the fresh empty non-reparse CI test directory.'
    }
    $diagnosticProfile = $logParent
    $userSid = [System.Security.Principal.SecurityIdentifier]::new($launcher.AccountSid)
    $result.profileAccess = [ordered]@{ beforeAcl=(Get-ProfileAclFacts $logParent $userSid); changed=$false }
    $result.profileAccess.beforeProbe = $launcher.ProbeProfileWrite($logParent)
    Save-Report
    if (-not $result.profileAccess.beforeProbe.Writable) {
      if ($result.profileAccess.beforeProbe.Error -ne 5) { throw 'Standard-user profile probe failed for a reason other than access denied.' }
      # Only the new owned test profile: retain all existing rules; never change an ancestor or a user profile.
      $acl = Get-Acl -LiteralPath $logParent
      $rule = [System.Security.AccessControl.FileSystemAccessRule]::new($userSid,
        [System.Security.AccessControl.FileSystemRights]::Modify,
        [System.Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit',
        [System.Security.AccessControl.PropagationFlags]::None,[System.Security.AccessControl.AccessControlType]::Allow)
      $acl.AddAccessRule($rule)
      Set-Acl -LiteralPath $logParent -AclObject $acl
      $result.profileAccess.changed = $true
    }
    $result.profileAccess.afterAcl = Get-ProfileAclFacts $logParent $userSid
    $result.profileAccess.afterProbe = $launcher.ProbeProfileWrite($logParent)
    Save-Report
    if (-not $result.profileAccess.afterProbe.Writable) { throw 'Standard user still cannot write its own test profile.' }
    if (-not $env:FOLIO_NATIVE_STOP_FILE) { throw 'Owned stop signal path is required for account cleanup.' }
    $result.launchApi = 'CreateProcessWithLogonW'
    $result.nativeOutput = @{ available=$false; reason='Plain CreateProcessWithLogonW startup uses no inherited standard handles; browser file logging remains enabled.' }
    $result.singletonDiagnostics = [ordered]@{
      coverage='Upstream Chromium mutex-name probe may not match Edge. Random mutex tests the impersonated helper namespace, not necessarily the child namespace. File probe is metadata-only, not write/delete access.'
      beforeMutex=$launcher.ProbeUpstreamSingletonMutex()
      freshSessionMutex=$launcher.ProbeFreshSessionMutex()
    }
    $launcher.Launch($exe,[System.IO.Path]::GetDirectoryName($exe))
    $result.childPid = $launcher.Pid
    $result.childToken = $launcher.Child
    $result.status = 'launched'
    Save-Report
    $result.runtimeSnapshots = @()
    # Preserve early evidence even when a native startup panic exits before CDP exists.
    for ($sample=0; $sample -lt 8 -and -not $launcher.Wait(0); $sample++) {
      try {
        $rows = & (Join-Path $PSScriptRoot 'windows-runtime-diagnostics.ps1') -OwnedPid $launcher.Pid | ConvertFrom-Json
        foreach ($row in $rows) {
          if ($row.name -eq 'msedgewebview2.exe') {
            $captured = $launcher.ObserveRuntime([uint32]$row.pid)
            $row | Add-Member -NotePropertyName ownedHandleCaptured -NotePropertyValue $captured
            if ($captured) {
              try { $row | Add-Member -NotePropertyName token -NotePropertyValue ($launcher.RuntimeToken([uint32]$row.pid)) }
              catch { $row | Add-Member -NotePropertyName tokenError -NotePropertyValue $_.Exception.Message }
            }
          }
        }
        $result.runtimeSnapshots += @{ at=[DateTime]::UtcNow.ToString('o'); processes=@($rows) }
        $result.runtimeExitsBeforeCleanup = @($launcher.RuntimeExits())
      } catch { $result.runtimeDiagnosticError = $_.Exception.ToString() }
      Save-Report
      if ($launcher.Wait(500)) { break }
    }
    # Graceful parent signal leaves this helper alive to empty its job and remove its exact account.
    $deadline = [DateTime]::UtcNow.AddSeconds(240)
    while (-not $launcher.Wait(250) -and -not (Test-Path -LiteralPath $env:FOLIO_NATIVE_STOP_FILE)) {
      if ([DateTime]::UtcNow -ge $deadline) { throw 'Owned child exceeded helper lifetime.' }
    }
    if ($launcher.Wait(0)) { $result.childExitCode = $launcher.ExitCode(); $scriptExit = [int]$result.childExitCode }
    # These are actual process-handle observations before closing our kill-on-close job.
    $result.runtimeExitsBeforeCleanup = @($launcher.RuntimeExits())
    $result.status = if ($launcher.Wait(0)) { 'exited' } else { 'stop-requested' }
    Save-Report
  }
} catch {
  $result.status = 'failed'
  $result.error = $_.Exception.ToString()
  $scriptExit = 1
  Save-Report
} finally {
  if ($null -ne $launcher) {
    if ($null -ne $diagnosticProfile) {
      try {
        if (-not $result.Contains('singletonDiagnostics')) { $result.singletonDiagnostics=[ordered]@{} }
        $result.singletonDiagnostics.afterMutex=$launcher.ProbeUpstreamSingletonMutex()
        $result.singletonDiagnostics.paths=@(Get-SingletonPathFacts $diagnosticProfile ([System.Security.Principal.SecurityIdentifier]::new($launcher.AccountSid)))
        $inner = Join-Path $diagnosticProfile 'EBWebView'
        if (Test-Path -LiteralPath $inner -PathType Container) {
          $item = Get-Item -LiteralPath $inner -Force
          if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -eq 0) {
            $result.singletonDiagnostics.existingFileProbe=$launcher.ProbeExistingSingletonFile($inner)
          }
        }
      } catch { $result.singletonDiagnosticError=$_.Exception.ToString() }
    }
    $launcher.Dispose()
    $result.cleanup = $launcher.Cleanup
    if ($result.cleanup.Errors.Count -gt 0) { $result.status='failed'; $scriptExit=1 }
  }
  Save-Report
}
exit $scriptExit
