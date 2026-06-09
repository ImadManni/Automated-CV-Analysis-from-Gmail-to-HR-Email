# Fix commit and push to origin/main
# Usage (from project root):
#   .\scripts\fix-commit-and-push.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host ""
Write-Host "=== Fix commit + push main ===" -ForegroundColor Cyan

Write-Host "Cleaning non-project files..."
& (Join-Path $PSScriptRoot "clean-repo-for-github.ps1")

$branch = (git rev-parse --abbrev-ref HEAD 2>$null)
Write-Host "Current branch: $branch"

$removePaths = @(
  ".git.corrupt-backup",
  "rapport-pfe",
  "test-cvs-overleaf",
  "server/data/candidatures.json",
  "server/data/users.json"
)
foreach ($p in $removePaths) {
  if (Test-Path $p) {
    git rm -r --cached --ignore-unmatch $p 2>$null | Out-Null
  }
}

git add .gitignore
git add -A

Write-Host ""
Write-Host "--- Staged files (sample) ---"
git diff --cached --name-only | Select-Object -First 40
$count = (git diff --cached --name-only | Measure-Object).Count
Write-Host "... total staged: $count"

if (git diff --cached --name-only | Select-String -Pattern "^\.env$") {
  Write-Host "ERROR: .env is staged. Run: git reset HEAD .env" -ForegroundColor Red
  exit 1
}

if ((git diff --cached --name-only | Measure-Object).Count -eq 0) {
  Write-Host "Nothing to amend." -ForegroundColor Yellow
} else {
  git commit --amend -m "Clean PCA repo: app code, docs, n8n workflows; updated README"
  Write-Host "Commit amended." -ForegroundColor Green
}

git branch -M main

Write-Host ""
Write-Host "Fetching origin..."
git fetch origin

Write-Host "Pushing to origin/main (force-with-lease)..."
git push -u origin main --force-with-lease

Write-Host ""
Write-Host "Done: https://github.com/ImadManni/Automated-CV-Analysis-from-Gmail-to-HR-Email" -ForegroundColor Green
