param(
  [ValidateSet('local','ci')][string]$Mode = 'local',
  [Parameter(Mandatory=$true)][ValidateSet('install','upgrade','uninstall')][string]$Action,
  [Parameter(Mandatory=$true)][string]$Target,
  [string]$Installer,
  [string]$InstallerSha256,
  [Parameter(Mandatory=$true)][string]$ExecutableSha256,
  [Parameter(Mandatory=$true)][string]$Version,
  [switch]$CheckShortcuts,
  [string]$ShortcutState,
  [switch]$DefaultProfile
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($CheckShortcuts -and $Mode -ne 'ci') { throw 'Shortcut verification is restricted to disposable CI; never alter local user shortcuts.' }
if ([bool]$CheckShortcuts -ne [bool]$ShortcutState) { throw 'Shortcut verification requires its owned evidence file.' }
if ($DefaultProfile -and ($Mode -ne 'ci' -or -not $CheckShortcuts)) { throw 'Default-profile installer verification requires disposable CI with owned shortcut verification.' }
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
$item = Get-Item -Force -LiteralPath $targetPath
while ($item.FullName.TrimEnd('\') -ne $root.TrimEnd('\')) {
  if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'No reparse points in installer target.' }
  $item = Get-Item -Force -LiteralPath (Split-Path -Parent $item.FullName)
}
if (@(Get-Process -Name folio-desktop -ErrorAction SilentlyContinue).Count) { throw 'Close existing Folio processes; never terminate user applications.' }
$registryPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Folio'
$entries = @(Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall' -ErrorAction SilentlyContinue | Get-ItemProperty | Where-Object { $_.PSObject.Properties['DisplayName'] -and $_.DisplayName -eq 'Folio' })
$exe = Join-Path $targetPath 'folio-desktop.exe'
$uninstaller = Join-Path $targetPath 'uninstall.exe'
$shortcutResult=$null
if ($DefaultProfile -and $Action -eq 'install') {
  $defaultPath=Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)) 'app.folio.localreader'
  if (Test-Path -LiteralPath $defaultPath) { throw 'Default Folio profile is already occupied; refusing to install or inspect it.' }
  $ancestor=Get-Item -Force -LiteralPath (Split-Path -Parent $defaultPath)
  while ($ancestor) {
    if (($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Default profile ancestors must not be reparse points.' }
    $parent=Split-Path -Parent $ancestor.FullName
    if (-not $parent) { break }
    $ancestor=Get-Item -Force -LiteralPath $parent
  }
  foreach ($hive in @([Microsoft.Win32.Registry]::CurrentUser,[Microsoft.Win32.Registry]::LocalMachine)) {
    foreach ($name in @('UserDataFolder','AdditionalBrowserArguments')) {
      $key=$hive.OpenSubKey('SOFTWARE\Policies\Microsoft\Edge\WebView2\'+$name)
      if ($key) { try { if ($key.ValueCount) { throw 'Existing WebView2 profile/debug policies prevent genuine default-profile verification.' } } finally { $key.Dispose() } }
    }
  }
}
if ($CheckShortcuts) {
  $reportRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../test-results')).TrimEnd('\')+'\'
  if (-not [IO.Path]::GetFullPath($ShortcutState).StartsWith($reportRoot,[StringComparison]::OrdinalIgnoreCase)) { throw 'Shortcut ownership evidence must stay beneath repository test-results.' }
  function Assert-ShortcutPath($path) {
    $itemPath=$path
    while (-not (Test-Path -LiteralPath $itemPath)) { $itemPath=Split-Path -Parent $itemPath }
    while ($itemPath) {
      $item=Get-Item -Force -LiteralPath $itemPath
      if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Reparse points are not allowed in shortcut/evidence paths.' }
      $itemPath=Split-Path -Parent $item.FullName
    }
  }
  $programRoots=@(@([Environment]::GetFolderPath([Environment+SpecialFolder]::Programs),[Environment]::GetFolderPath([Environment+SpecialFolder]::CommonPrograms)) | Sort-Object -Unique)
  $desktopRoots=@(@([Environment]::GetFolderPath([Environment+SpecialFolder]::DesktopDirectory),[Environment]::GetFolderPath([Environment+SpecialFolder]::CommonDesktopDirectory)) | Sort-Object -Unique)
  if (@($programRoots+$desktopRoots | Where-Object { -not $_ }).Count) { throw 'Windows shortcut folders are unavailable.' }
  $allowedLinks=@($programRoots | ForEach-Object { Join-Path $_ 'Folio.lnk';Join-Path $_ 'Folio/Folio.lnk' })+@($desktopRoots | ForEach-Object { Join-Path $_ 'Folio.lnk' })
  foreach ($path in @($allowedLinks)+@([IO.Path]::GetFullPath($ShortcutState))) { Assert-ShortcutPath $path }
  function Read-OwnedShortcut($path) {
    $shell=New-Object -ComObject WScript.Shell
    $link=$null
    try {
      $link=$shell.CreateShortcut($path)
      if ([IO.Path]::GetFullPath($link.TargetPath) -cne $exe -or $link.Arguments) { throw 'Shortcut does not target only the exact owned Folio executable.' }
      return @{path=$path;target=$exe;sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()}
    } finally {
      if ($link) { $null=[Runtime.InteropServices.Marshal]::FinalReleaseComObject($link) }
      $null=[Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)
    }
  }
  if ($Action -eq 'install') {
    if ((Test-Path -LiteralPath $ShortcutState) -or @($allowedLinks | Where-Object { Test-Path -LiteralPath $_ }).Count -or @($programRoots | Where-Object { Test-Path -LiteralPath (Join-Path $_ 'Folio') }).Count) { throw 'Existing Folio shortcut/evidence paths must be preserved; refusing this CI installation.' }
    $shortcutData=@{schema=1;target=$targetPath;links=@()}
  } else {
    $shortcutData=Get-Content -LiteralPath $ShortcutState -Raw | ConvertFrom-Json
    if ($shortcutData.schema -ne 1 -or $shortcutData.target -cne $targetPath -or -not @($shortcutData.links).Count) { throw 'Shortcut ownership evidence differs from the owned installation.' }
    foreach ($link in $shortcutData.links) {
      if ($link.path -notin $allowedLinks -or $link.target -cne $exe -or $link.sha256 -notmatch '^[a-f0-9]{64}$' -or -not (Test-Path -LiteralPath $link.path)) { throw 'Shortcut ownership evidence is invalid or its captured link is missing.' }
      $current=Read-OwnedShortcut $link.path
      if ($current.sha256 -cne $link.sha256) { throw 'Captured shortcut changed externally; refusing installer or cleanup.' }
    }
    foreach ($path in $allowedLinks) {
      if ((Test-Path -LiteralPath $path) -and -not @($shortcutData.links | Where-Object path -eq $path).Count) { throw 'Unexpected Folio shortcut appeared; refusing installer or cleanup.' }
    }
  }
}
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
  # Real normal upgrade path, no /UPDATE shortcut. Historical mode alone uses
  # /NS; candidate mode verifies actual installer-created shortcuts.
  $installArguments=@('/S')
  if (-not $CheckShortcuts) { $installArguments+='/NS' }
  $installArguments+="/D=$targetPath"
  $process = Start-Process -FilePath $Installer -ArgumentList $installArguments -WindowStyle Hidden -PassThru
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
if ($CheckShortcuts) {
  if ($Action -eq 'uninstall') {
    # /UPDATE retains links. Delete only our captured, unchanged exact files;
    # never remove their containing folders or any profile/data directory.
    foreach ($link in $shortcutData.links) {
      Assert-ShortcutPath $link.path
      $current=Read-OwnedShortcut $link.path
      if ($current.sha256 -cne $link.sha256) { throw 'Captured shortcut changed during uninstall; refusing cleanup.' }
    }
    foreach ($link in $shortcutData.links) {
      Assert-ShortcutPath $link.path
      if ((Read-OwnedShortcut $link.path).sha256 -cne $link.sha256) { throw 'Captured shortcut changed before removal; refusing cleanup.' }
      Remove-Item -LiteralPath $link.path
      if (Test-Path -LiteralPath $link.path) { throw 'Captured shortcut removal was not completed.' }
    }
    $shortcutResult=@{verified=$true;capturedCount=@($shortcutData.links).Count;removedCount=@($shortcutData.links).Count;unchangedBeforeRemoval=$true;startMenuVerified=$true}
  } else {
    $captured=@($allowedLinks | Where-Object { Test-Path -LiteralPath $_ } | ForEach-Object { Read-OwnedShortcut $_ })
    $startLinks=@($captured | Where-Object { $path=$_.path; @($programRoots | Where-Object { $path.StartsWith($_.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase) }).Count })
    if (-not $startLinks.Count) { throw 'Installer did not create a Start-menu shortcut to the exact owned executable.' }
    $shortcutData=@{schema=1;target=$targetPath;links=$captured}
    [IO.File]::WriteAllText($ShortcutState,($shortcutData | ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
    $shortcutResult=@{verified=$true;startMenuVerified=$true;capturedCount=$captured.Count;links=$captured}
  }
}
[ordered]@{action=$Action;version=$Version;mode=$Mode;elevated=$elevated;exitCode=$process.ExitCode;target=$targetPath;shortcuts=$shortcutResult;completedAt=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Depth 6 -Compress
