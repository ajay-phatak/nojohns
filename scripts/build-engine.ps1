# Builds the PyInstaller engine into engine/dist/nojohns-engine.
# Pinned to Python 3.12 (py-slippi is not validated on newer versions).
#
# Native commands write progress to stderr, so don't use
# $ErrorActionPreference = Stop here — check exit codes explicitly.

function Invoke-Step {
    param([string]$Name, [scriptblock]$Cmd)
    & $Cmd
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAILED: $Name (exit $LASTEXITCODE)"
        exit 1
    }
}

$repo = Split-Path -Parent $PSScriptRoot
$engine = Join-Path $repo "engine"
$venv = Join-Path $repo ".venv-build"

if (-not (Test-Path $venv)) {
    Invoke-Step "create venv" { py -3.12 -m venv $venv }
}
Invoke-Step "install engine + pyinstaller" {
    & "$venv\Scripts\pip.exe" install --quiet $engine pyinstaller
}

Set-Location $engine
Invoke-Step "pyinstaller" {
    & "$venv\Scripts\pyinstaller.exe" --onedir --noupx --noconfirm `
        --name nojohns-engine `
        --distpath dist --workpath build `
        engine_entry.py
}

Write-Host "Engine built: $engine\dist\nojohns-engine\nojohns-engine.exe"
