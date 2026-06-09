# Repair corrupted .git (bad tree object HEAD) and push working tree to origin/main.
# Usage (PowerShell):
#   cd C:\Users\DELL\Desktop\screens\Automated-CV-Analysis-from-Gmail-to-HR-Email-IMADPCA
#   powershell -ExecutionPolicy Bypass -File .\scripts\recover-git-and-push.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "`n=== PCA Git recovery ===" -ForegroundColor Cyan
Write-Host "Project: $Root`n"

if (Test-Path ".env") {
  Write-Host "OK: .env present locally (will stay untracked via .gitignore)" -ForegroundColor Green
}

if (Test-Path ".git") {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $backup = Join-Path $env:TEMP "pca-git-corrupt-$stamp"
  Write-Host "Moving broken .git -> $backup (outside project folder)"
  Move-Item -Path ".git" -Destination $backup
}

Write-Host "Initializing fresh git repository..."
git init
git remote add origin "https://github.com/ImadManni/Automated-CV-Analysis-from-Gmail-to-HR-Email.git"

Write-Host "Fetching origin..."
git fetch origin

Write-Host "Checking out main from GitHub..."
git checkout -B main origin/main

Write-Host "Staging project files..."
git add .

Write-Host "`n--- git status (verify no .env) ---"
git status

$hasEnv = git diff --cached --name-only | Select-String -Pattern "^\.env$"
if ($hasEnv) {
  Write-Host "`nERROR: .env is staged. Aborting." -ForegroundColor Red
  git reset HEAD .env
  exit 1
}

$changes = git diff --cached --quiet 2>$null
if ($LASTEXITCODE -eq 0) {
  Write-Host "`nNothing to commit (working tree matches origin/main)." -ForegroundColor Yellow
} else {
  $msg = @"
Sync PCA platform: dashboard, n8n workflow v9, LinkedIn scripts, README.

Includes API/RAG updates, campaign CRUD UI, and latest IMAP-MinIO-OpenAI pipeline.
"@
  git commit -m $msg
  Write-Host "`nCommit created." -ForegroundColor Green
}

Write-Host "`nPushing to origin/main..."
git push -u origin main

Write-Host "`nDone. Verify: https://github.com/ImadManni/Automated-CV-Analysis-from-Gmail-to-HR-Email" -ForegroundColor Green
