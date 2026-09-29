param(
  [switch]$PushToFork
)

$appWorkspace = Split-Path -Parent $PSScriptRoot
$bridgeWorkspace = Join-Path (Split-Path -Parent $appWorkspace) 'naprock'

if (-not (Test-Path -LiteralPath (Join-Path $bridgeWorkspace '.git'))) {
  throw "The sibling naprock workspace was not found at $bridgeWorkspace."
}

$dirty = & git -C $bridgeWorkspace status --porcelain
if ($dirty) {
  throw 'naprock has uncommitted changes. Commit or stash them before syncing partner changes.'
}

& git -C $bridgeWorkspace switch main
if ($LASTEXITCODE -ne 0) { throw 'Could not switch naprock to main.' }

& git -C $bridgeWorkspace fetch upstream main
if ($LASTEXITCODE -ne 0) { throw 'Could not fetch upstream/main.' }

& git -C $bridgeWorkspace merge --ff-only upstream/main
if ($LASTEXITCODE -ne 0) { throw 'upstream/main is not a fast-forward. Review and merge it manually.' }

if ($PushToFork) {
  & git -C $bridgeWorkspace push origin main
  if ($LASTEXITCODE -ne 0) { throw 'Could not push the synchronized main branch to origin.' }
}

Write-Output "naprock is synchronized at $(& git -C $bridgeWorkspace rev-parse --short HEAD)."
