param([Parameter(Mandatory=$true)][uint32]$OwnedPid)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT' -or $env:GITHUB_ACTIONS -ne 'true' -or $env:CI -ne 'true') {
  throw 'Native runtime inspection is CI-only.'
}
$processes = @(Get-CimInstance Win32_Process)
$owned = [System.Collections.Generic.HashSet[uint32]]::new()
[void]$owned.Add($OwnedPid)
do {
  $before = $owned.Count
  foreach ($process in $processes) {
    if ($owned.Contains([uint32]$process.ParentProcessId)) { [void]$owned.Add([uint32]$process.ProcessId) }
  }
} while ($owned.Count -ne $before)
$rows = foreach ($process in $processes) {
  if (-not $owned.Contains([uint32]$process.ProcessId)) { continue }
  $row = [ordered]@{ pid=$process.ProcessId; parentPid=$process.ParentProcessId; name=$process.Name }
  if ($process.Name -eq 'msedgewebview2.exe') {
    if ($process.ExecutablePath) { $row.version = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($process.ExecutablePath).ProductVersion }
    # Only explicitly permitted browser flags are recorded, never whole command lines or environment.
    foreach ($flag in @('type','user-data-dir','remote-debugging-port','remote-debugging-address','log-file','v')) {
      $match = [regex]::Match($process.CommandLine, '(?:^|\s)(?:"--' + $flag + '=([^"]*)"|--' + $flag + '=(?:"([^"]*)"|([^\s]+)))')
      if ($match.Success) {
        foreach ($group in $match.Groups | Select-Object -Skip 1) {
          if ($group.Success) { $row[$flag] = $group.Value; break }
        }
      }
    }
  }
  [pscustomobject]$row
}
ConvertTo-Json -InputObject @($rows) -Depth 5
