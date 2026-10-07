param(
  [ValidateSet('local','ci')][string]$Mode = 'local',
  [Parameter(Mandatory=$true)][ValidateSet('install','upgrade','uninstall')][string]$Action,
  [Parameter(Mandatory=$true)][string]$Target,
  [string]$Installer,
  [string]$InstallerSha256,
  [Parameter(Mandatory=$true)][string]$ExecutableSha256,
  [Parameter(Mandatory=$true)][string]$Version
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
$elevated = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($Mode -eq 'ci') {
  if ($env:GITHUB_ACTIONS -ne 'true' -or $env:CI -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or $env:GITHUB_REPOSITORY -ne 'KingGogusV/Project-PDF-reader-') { throw 'CI mode requires this repository on a disposable GitHub-hosted runner.' }
  $root = [IO.Path]::GetFullPath($env:RUNNER_TEMP).TrimEnd('\') + '\'
} else {
  if ($elevated -or $env:GITHUB_ACTIONS -eq 'true') { throw 'Use a non-elevated local Windows session.' }
  $root = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
}
$targetPath = (Resolve-Path -LiteralPath $Target).Path
if (-not $targetPath.StartsWith($root,[StringComparison]::OrdinalIgnoreCase) -or (Split-Path -Leaf $targetPath) -notlike 'FolioUpgrade-*' -or $targetPath -match '\s') { throw 'Only a uniquely named temporary upgrade installation is allowed.' }
$item = Get-Item -LiteralPath $targetPath
while ($item.FullName.TrimEnd('\') -ne $root.TrimEnd('\')) {
  if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'No reparse points in installer target.' }
  $item = Get-Item -LiteralPath (Split-Path -Parent $item.FullName)
}
if (@(Get-Process -Name folio-desktop -ErrorAction SilentlyContinue).Count) { throw 'Close existing Folio processes; never terminate user applications.' }
$registryPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Folio'
$entries = @(Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall' -ErrorAction SilentlyContinue | Get-ItemProperty | Where-Object { $_.PSObject.Properties['DisplayName'] -and $_.DisplayName -eq 'Folio' })
$exe = Join-Path $targetPath 'folio-desktop.exe'
$uninstaller = Join-Path $targetPath 'uninstall.exe'
if ($Action -eq 'install') {
  if ($entries.Count -or @(Get-ChildItem -LiteralPath $targetPath -Force).Count) { throw 'Existing installation or occupied target needs preservation.' }
  # Fail before installing when the execution sandbox cannot inspect owned processes.
  $null = Get-CimInstance Win32_Process -Filter "ProcessId=$PID"
  $probe = 'HKCU:\Software\' + (Split-Path -Leaf $targetPath) + '-RegistryProbe'
  if (Test-Path -LiteralPath $probe) { throw 'Registry probe path is occupied.' }
  try {
    $null = New-Item -Path $probe
    $null = New-ItemProperty -LiteralPath $probe -Name 'OwnedTarget' -Value $targetPath
    if ((Get-ItemPropertyValue -LiteralPath $probe -Name 'OwnedTarget') -ne $targetPath) { throw 'Registry writes are unavailable.' }
  } finally {
    if (Test-Path -LiteralPath $probe) { Remove-Item -LiteralPath $probe }
  }
} else {
  if ($entries.Count -eq 0 -and $Action -eq 'uninstall') {
    # A restricted installer can write its temporary files but fail registration.
    # Exact target/hash guards still apply; never allow an unregistered upgrade.
  } elseif ($entries.Count -ne 1 -or $entries[0].PSPath -notlike '*HKEY_CURRENT_USER*' -or $entries[0].UninstallString -ne ('"' + $uninstaller + '"')) { throw 'Registered installation is not the owned test installation.' }
  if ((Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ExecutableSha256) { throw 'Unexpected pre-operation executable.' }
}
if ($Action -eq 'uninstall') {
  # /UPDATE explicitly prevents app-data deletion and shortcut changes.
  $process = Start-Process -FilePath $uninstaller -ArgumentList @('/S','/UPDATE',"_?=$targetPath") -WindowStyle Hidden -PassThru
} else {
  if ($InstallerSha256 -notmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath $Installer -Algorithm SHA256).Hash.ToLowerInvariant() -ne $InstallerSha256) { throw 'Installer digest mismatch.' }
  # Real normal upgrade path, no /UPDATE shortcut; /NS suppresses new shortcuts.
  $process = Start-Process -FilePath $Installer -ArgumentList @('/S','/NS',"/D=$targetPath") -WindowStyle Hidden -PassThru
}
if (-not $process.WaitForExit(120000)) { throw 'Installer exceeded 120 seconds; do not forcibly terminate an unowned installer.' }
if ($process.ExitCode -ne 0) { throw "Installer failed: $($process.ExitCode)" }
if ($Action -eq 'uninstall') {
  if (Test-Path -LiteralPath $registryPath) { throw 'Owned uninstall registration remains.' }
  if (Test-Path -LiteralPath $exe) { throw 'Owned installed executable remains.' }
} else {
  $registration = Get-ItemProperty -LiteralPath $registryPath
  if ($registration.DisplayVersion -ne $Version -or $registration.UninstallString -ne ('"' + $uninstaller + '"')) { throw 'Installer version or directory differs from the requested test target.' }
  if (-not (Test-Path -LiteralPath (Join-Path $targetPath 'third-party-notices/manifest.json'))) { throw 'Bundled notice manifest missing.' }
  if ($Action -eq 'install' -and (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ExecutableSha256) { throw 'Installed baseline differs from published provenance.' }
}
[ordered]@{action=$Action;version=$Version;mode=$Mode;elevated=$elevated;exitCode=$process.ExitCode;target=$targetPath;completedAt=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Compress
