param([ValidateSet('Preflight','Launch')][string]$Mode = 'Preflight')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($env:OS -ne 'Windows_NT' -or $env:GITHUB_ACTIONS -ne 'true' -or $env:CI -ne 'true') {
  throw 'This privilege-reducing helper runs only in Windows GitHub Actions CI.'
}
Add-Type -Path (Join-Path $PSScriptRoot 'WindowsRestrictedProcess.cs')
$result = [ordered]@{ status = 'running'; mode = $Mode; parentPid = $PID; startedAt = [DateTime]::UtcNow.ToString('o') }
$launcher = $null
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
try {
  $result.parentToken = [FolioNativeSmoke.RestrictedProcess]::CurrentToken()
  Save-Report
  $launcher = [FolioNativeSmoke.RestrictedProcess]::new()
  $result.parentToken = $launcher.Parent
  $result.reducedToken = $launcher.Reduced
  $result.status = 'preflight-passed'
  Save-Report
  if ($Mode -eq 'Launch') {
    if (-not $env:FOLIO_NATIVE_EXE -or -not $env:RUNNER_TEMP) { throw 'Installed executable and RUNNER_TEMP required.' }
    $temp = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $env:RUNNER_TEMP).Path).TrimEnd('\') + '\'
    $exe = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $env:FOLIO_NATIVE_EXE).Path)
    if (-not $exe.StartsWith($temp, [StringComparison]::OrdinalIgnoreCase) -or [System.IO.Path]::GetFileName($exe) -ne 'folio-desktop.exe') {
      throw 'Executable must be installed folio-desktop.exe beneath RUNNER_TEMP.'
    }
    if (-not $env:FOLIO_NATIVE_LOG_PATH) { throw 'Owned native log path required.' }
    $logParent = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath ([System.IO.Path]::GetDirectoryName($env:FOLIO_NATIVE_LOG_PATH))).Path)
    if (-not $logParent.StartsWith($temp,[StringComparison]::OrdinalIgnoreCase)) { throw 'Native log directory must be beneath RUNNER_TEMP.' }
    $nativeLog = Join-Path $logParent 'native-process.log'
    if ($nativeLog -ne [System.IO.Path]::GetFullPath($env:FOLIO_NATIVE_LOG_PATH)) { throw 'Expected a new native-process.log in the owned profile.' }
    $profileItem = Get-Item -LiteralPath $logParent
    if (($profileItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0 -or
        -not $profileItem.Name.StartsWith('folio-native-profile-',[StringComparison]::Ordinal) -or
        @(Get-ChildItem -LiteralPath $logParent -Force).Count -ne 0) {
      throw 'Profile preparation requires the fresh empty non-reparse CI test directory.'
    }
    $userSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $result.profileAccess = [ordered]@{ beforeAcl=(Get-ProfileAclFacts $logParent $userSid); changed=$false }
    $result.profileAccess.beforeProbe = $launcher.ProbeProfileWrite($logParent)
    Save-Report
    if (-not $result.profileAccess.beforeProbe.Writable) {
      if ($result.profileAccess.beforeProbe.Error -ne 5) { throw 'Restricted profile probe failed for a reason other than access denied.' }
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
    if (-not $result.profileAccess.afterProbe.Writable) { throw 'Restricted token still cannot write its own test profile.' }
    $launcher.Launch($exe,[System.IO.Path]::GetDirectoryName($exe),$nativeLog)
    $result.childPid = $launcher.Pid
    $result.childToken = $launcher.Child
    $result.status = 'launched'
    Save-Report
    $result.runtimeSnapshots = @()
    # Preserve early evidence even when a native startup panic exits before CDP exists.
    for ($sample=0; $sample -lt 3 -and -not $launcher.Wait(0); $sample++) {
      try {
        $rows = & (Join-Path $PSScriptRoot 'windows-runtime-diagnostics.ps1') -OwnedPid $PID | ConvertFrom-Json
        $result.runtimeSnapshots += @{ at=[DateTime]::UtcNow.ToString('o'); processes=@($rows) }
      } catch { $result.runtimeDiagnosticError = $_.Exception.ToString() }
      Save-Report
      if ($launcher.Wait(500)) { break }
    }
    # Keep the owned helper alive, so Node can terminate only its own PID tree.
    if (-not $launcher.Wait(240000)) {
      & taskkill.exe /PID $launcher.Pid /T /F | Out-String | Write-Output
      throw 'Owned child exceeded helper lifetime.'
    }
    $result.childExitCode = $launcher.ExitCode()
    $result.status = 'exited'
    Save-Report
    exit ([int]$result.childExitCode)
  }
} catch {
  $result.status = 'failed'
  $result.error = $_.Exception.ToString()
  Save-Report
  throw
} finally { if ($null -ne $launcher) { $launcher.Dispose() } }
