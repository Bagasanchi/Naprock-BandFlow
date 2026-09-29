# Updates the sibling naprock workspace from the shared repository
# (origin = https://github.com/Tuvshu0-coder/naprock).
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

& git -C $bridgeWorkspace pull --rebase origin main
if ($LASTEXITCODE -ne 0) { throw 'Could not update naprock from origin/main. Resolve the conflict in naprock, then run this again.' }

Write-Output "naprock is synchronized at $(& git -C $bridgeWorkspace rev-parse --short HEAD)."
