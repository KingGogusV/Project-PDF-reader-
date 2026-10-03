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
    $launcher.Launch($exe,[System.IO.Path]::GetDirectoryName($exe))
    $result.childPid = $launcher.Pid
    $result.childToken = $launcher.Child
    $result.status = 'launched'
    Save-Report
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
