<#
  publish.ps1 - publish the game to GitHub Pages (https://moshe0408.github.io/hayeled/).

  Usage (from any folder, Windows PowerShell 5.1 or PowerShell 7):
    powershell -ExecutionPolicy Bypass -File .\publish.ps1
    powershell -ExecutionPolicy Bypass -File .\publish.ps1 -Message "New leagues"
    powershell -ExecutionPolicy Bypass -File .\publish.ps1 -NoBump

  What it does:
    1. Works in the folder of this script (safe for paths with Hebrew letters and spaces).
    2. First run only: git init -b main + remote origin https://github.com/Moshe0408/hayeled.git
    3. Checks that VERSION in sw.js equals APP_VERSION in js/config.js (aborts if not).
    4. If there are changes: bumps the patch version in BOTH files (1.0.3 -> 1.0.4) so phones get
       the update banner, unless -NoBump is given.
    5. git add -A, git commit (skipped when nothing changed), git push -u origin main.
    6. Prints the site URL.

  This file is intentionally ASCII-only (Windows PowerShell 5.1 reads BOM-less files as ANSI).
#>
param(
  [string]$Message = "",
  [switch]$NoBump
)

# 'Continue': in Windows PowerShell 5.1 git's normal stderr output must not abort the script.
$ErrorActionPreference = 'Continue'
Set-Location -LiteralPath $PSScriptRoot

$RemoteUrl = 'https://github.com/Moshe0408/hayeled.git'
$SiteUrl = 'https://moshe0408.github.io/hayeled/'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Fail([string]$text) {
  Write-Host ""
  Write-Host "ERROR: $text" -ForegroundColor Red
  exit 1
}

function Read-Text([string]$rel) {
  $p = Join-Path $PSScriptRoot $rel
  if (-not (Test-Path -LiteralPath $p)) { Fail "$rel not found" }
  return [System.IO.File]::ReadAllText($p, $Utf8NoBom)
}

function Write-Text([string]$rel, [string]$text) {
  $p = Join-Path $PSScriptRoot $rel
  [System.IO.File]::WriteAllText($p, $text, $Utf8NoBom)
}

# --- git available? ---------------------------------------------------------
$git = Get-Command git -ErrorAction SilentlyContinue
if ($null -eq $git) { Fail "git is not installed (https://git-scm.com/download/win)" }

# --- first run: init repo -----------------------------------------------------
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot '.git'))) {
  Write-Host "Initialising git repository..."
  git init -b main
  if ($LASTEXITCODE -ne 0) { Fail "git init failed" }
}
$remotes = @(git remote)
if ($remotes -notcontains 'origin') {
  git remote add origin $RemoteUrl
  if ($LASTEXITCODE -ne 0) { Fail "git remote add failed" }
}
$branch = (git symbolic-ref --short HEAD)
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($branch)) { Fail "could not read the current git branch" }
$branch = $branch.Trim()
if ($branch -ne 'main') { Fail "current branch is '$branch'. Switch to main first: git checkout main" }

# --- versions -----------------------------------------------------------------
$swText = Read-Text 'sw.js'
$cfgText = Read-Text 'js/config.js'
$swRe = "const VERSION = '(\d+)\.(\d+)\.(\d+)'"
$cfgRe = "export const APP_VERSION = '(\d+)\.(\d+)\.(\d+)'"
$swM = [regex]::Match($swText, $swRe)
$cfgM = [regex]::Match($cfgText, $cfgRe)
if (-not $swM.Success) { Fail "VERSION not found in sw.js" }
if (-not $cfgM.Success) { Fail "APP_VERSION not found in js/config.js" }
$swVer = "$($swM.Groups[1].Value).$($swM.Groups[2].Value).$($swM.Groups[3].Value)"
$cfgVer = "$($cfgM.Groups[1].Value).$($cfgM.Groups[2].Value).$($cfgM.Groups[3].Value)"
if ($swVer -ne $cfgVer) {
  Fail "sw.js VERSION ($swVer) differs from js/config.js APP_VERSION ($cfgVer). Make them equal and run again."
}

$changes = @(git status --porcelain)
if ($LASTEXITCODE -ne 0) { Fail "git status failed" }

$version = $cfgVer
if ($changes.Count -gt 0 -and -not $NoBump) {
  $patch = [int]$cfgM.Groups[3].Value + 1
  $version = "$($cfgM.Groups[1].Value).$($cfgM.Groups[2].Value).$patch"
  $swText = (New-Object System.Text.RegularExpressions.Regex($swRe)).Replace($swText, "const VERSION = '$version'", 1)
  $cfgText = (New-Object System.Text.RegularExpressions.Regex($cfgRe)).Replace($cfgText, "export const APP_VERSION = '$version'", 1)
  Write-Text 'sw.js' $swText
  Write-Text 'js/config.js' $cfgText
  Write-Host "Version bumped: $cfgVer -> $version"
}

# --- commit -------------------------------------------------------------------
if ([string]::IsNullOrWhiteSpace($Message)) {
  $Message = "Update " + (Get-Date -Format 'yyyy-MM-dd HH:mm') + " (v$version)"
}

git add -A
if ($LASTEXITCODE -ne 0) { Fail "git add failed" }

$staged = @(git diff --cached --name-only)
if ($staged.Count -gt 0) {
  git commit -m $Message
  if ($LASTEXITCODE -ne 0) {
    Fail "git commit failed. If git asks who you are, run once:`n  git config --global user.name ""Your Name""`n  git config --global user.email ""you@example.com"""
  }
} else {
  Write-Host "Nothing new to commit."
}

# --- push ---------------------------------------------------------------------
git push -u origin main
if ($LASTEXITCODE -ne 0) {
  Fail "git push failed. Check your GitHub login, and that the repo $RemoteUrl exists. If GitHub already has commits you do not have locally, run: git pull --rebase origin main   and then publish again."
}

Write-Host ""
Write-Host "Published v$version" -ForegroundColor Green
Write-Host "Site: $SiteUrl"
Write-Host "First time only: on GitHub open Settings -> Pages -> Build and deployment -> Deploy from a branch -> main / (root) -> Save."
Write-Host "GitHub Pages usually updates within 1-2 minutes. Phones show the 'new version' banner on the next visit."
