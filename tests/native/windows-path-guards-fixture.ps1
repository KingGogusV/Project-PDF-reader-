param([Parameter(Mandatory=$true)][string]$TestRoot)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
if ($env:OS -ne 'Windows_NT' -or $PSVersionTable.PSEdition -ne 'Core') { throw 'This metadata regression requires existing PowerShell 7 on Windows.' }
$temporary=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')+'\'
$root=(Resolve-Path -LiteralPath $TestRoot).Path
if (-not $root.StartsWith($temporary,[StringComparison]::OrdinalIgnoreCase) -or (Split-Path -Leaf $root) -notlike 'FolioPathGuard-*') { throw 'Only the freshly owned temporary metadata fixture is allowed.' }
$hidden=Join-Path $root 'HiddenParent'
$child=Join-Path $hidden 'VisibleChild'
$target=Join-Path $root 'OwnedJunctionTarget'
if (@(Get-ChildItem -LiteralPath $root -Force).Count -ne 2 -or -not (Test-Path -LiteralPath $child -PathType Container) -or -not (Test-Path -LiteralPath $target -PathType Container)) { throw 'Unexpected fixture contents; do not alter external files.' }
foreach ($path in @($root,$hidden,$child,$target)) {
  $item=Get-Item -Force -LiteralPath $path
  if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Initial fixture paths must not be reparse points.' }
}
$hiddenItem=Get-Item -Force -LiteralPath $hidden
$hiddenItem.Attributes=$hiddenItem.Attributes -bor [IO.FileAttributes]::Hidden -bor [IO.FileAttributes]::System
$hiddenItem=Get-Item -Force -LiteralPath $hidden
if (($hiddenItem.Attributes -band [IO.FileAttributes]::Hidden) -eq 0 -or ($hiddenItem.Attributes -band [IO.FileAttributes]::System) -eq 0) { throw 'Fixture hidden/system attributes were not set.' }
$unforcedRejected=$false
try { $null=Get-Item -LiteralPath $hidden -ErrorAction Stop }
catch { if ($_.CategoryInfo.Category -ne [Management.Automation.ErrorCategory]::ObjectNotFound) { throw };$unforcedRejected=$true }
if (-not $unforcedRejected) { throw 'Unforced metadata read did not reproduce the hidden-ancestor failure.' }
$null=Get-Item -Force -LiteralPath $hidden
$readCount=0
$installerAst=$null
foreach ($name in @('windows-upgrade-install.ps1','windows-owned-launch.ps1','windows-save-dialog.ps1','windows-token-launch.ps1')) {
  $tokens=$null;$errors=$null
  $ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $name),[ref]$tokens,[ref]$errors)
  if ($errors.Count) { throw 'Production helper contains a parser error.' }
  if ($name -eq 'windows-upgrade-install.ps1') { $installerAst=$ast }
  $commands=@($ast.FindAll({param($node) $node -is [Management.Automation.Language.CommandAst] -and $node.GetCommandName() -eq 'Get-Item'},$true))
  foreach ($command in $commands) {
    $parameters=@($command.CommandElements | Where-Object { $_ -is [Management.Automation.Language.CommandParameterAst] } | ForEach-Object ParameterName)
    if ('LiteralPath' -notin $parameters -or 'Force' -notin $parameters) { throw 'A literal production metadata guard lost hidden-item support.' }
    $readCount++
  }
}
$definitions=@($installerAst.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Assert-ShortcutPath'},$true))
if ($definitions.Count -ne 1) { throw 'Expected the exact production shortcut ancestor checker.' }
# Load only the read-only metadata function. Never execute installer, registry,
# CI/default-profile logic, UI actions or any user's library inspection here.
. ([scriptblock]::Create($definitions[0].Extent.Text))
Assert-ShortcutPath (Join-Path $child 'future-evidence.json')
$junction=Join-Path $hidden 'OwnedJunction'
$null=New-Item -ItemType Junction -Path $junction -Target $target
$junctionItem=Get-Item -Force -LiteralPath $junction
if (($junctionItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) { throw 'The owned reparse fixture was not created.' }
$reparseRejected=$false
try { Assert-ShortcutPath (Join-Path $junction 'future-evidence.json') }
catch { if ($_.Exception.Message -eq 'Reparse points are not allowed in shortcut/evidence paths.') { $reparseRejected=$true } else { throw } }
if (-not $reparseRejected) { throw 'Production metadata guard failed to reject an owned reparse ancestor.' }
[ordered]@{hiddenSystemAncestor=$true;unforcedReadRejected=$unforcedRejected;forcedReadAccepted=$true;productionHiddenWalkAccepted=$true;productionReparseWalkRejected=$reparseRejected;literalReadsAllForced=$true;literalReadCount=$readCount;retainedFixture=$root} | ConvertTo-Json -Compress
