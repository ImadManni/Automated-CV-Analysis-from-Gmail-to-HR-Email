# Remove non-project files and organize n8n workflows under n8n/workflows/
$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "=== Clean repo for GitHub ===" -ForegroundColor Cyan

# --- Delete folders unrelated to the PCA app ---
$removeDirs = @(
  "rapport-pfe",
  "test-cvs-overleaf",
  ".git.corrupt-backup"
)
foreach ($d in $removeDirs) {
  if (Test-Path $d) {
    Remove-Item -Recurse -Force $d
    Write-Host "Removed dir: $d"
  }
}

# --- Delete root junk / debug / template artifacts ---
$removeFiles = @(
  "SFE_Template_5IIR_26.docx",
  "TEMPLATE_STRUCTURE_SUMMARY.md",
  "template-analysis-report.md",
  "template-extract-copy.txt",
  "template-extract.txt",
  "__tmp_check.txt",
  "_dbg.txt",
  "_dbg_dir.txt",
  "_git_cmd_out.txt",
  "_git_fsck.txt",
  "_head_InterviewsPage.tsx",
  "_size.txt",
  ".auto-fix-stderr.txt",
  ".auto-fix-stdout.txt",
  ".cmd-report.txt",
  ".deps-check.txt",
  ".git-restore-status.txt",
  ".node-test-out.txt",
  ".restore-size-report.txt",
  ".restore-tmp-cv-heuristic.js",
  ".restore-tmp-index.js",
  ".tmp-node11.js",
  ".tmp-node9.js",
  ".tmp-regenerate-log.txt",
  "extract-log-copy.txt",
  "force-fill-report.json",
  "git-diag-out.txt",
  "node-exit.txt",
  "npm-config-debug.json",
  "out1.txt",
  "push-log.txt",
  "push-summary.b64",
  "push-summary.json",
  "sync-platform-offers.exit.txt",
  "tmp-test.txt",
  "tmp-wf8.json",
  "tmp_edit_workflow.js",
  "tmp_test.txt",
  "zzz_test.tmp",
  "diag-edit.json"
)
foreach ($f in $removeFiles) {
  if (Test-Path $f) {
    Remove-Item -Force $f
    Write-Host "Removed file: $f"
  }
}

# --- scripts/ debug dumps ---
$scriptJunk = @(
  "scripts\_escaped.txt",
  "scripts\_sim-out.txt",
  "scripts\_sp-out.txt",
  "scripts\dump-out.txt",
  "scripts\patch-n8n-debug.txt"
)
foreach ($f in $scriptJunk) {
  if (Test-Path $f) { Remove-Item -Force $f; Write-Host "Removed: $f" }
}

# --- Move UML diagram into docs ---
if (Test-Path "CLASS DIAGRAM UML.png") {
  New-Item -ItemType Directory -Force -Path "docs\uml" | Out-Null
  $dest = "docs\uml\CLASS-DIAGRAM-UML.png"
  if (-not (Test-Path $dest)) {
    Move-Item -Force "CLASS DIAGRAM UML.png" $dest
    Write-Host "Moved CLASS DIAGRAM UML.png -> docs/uml/"
  }
}

# --- Organize n8n workflow JSON files ---
$wfDir = "n8n\workflows"
New-Item -ItemType Directory -Force -Path $wfDir | Out-Null

$patterns = @("PCA - IMAP*.json", "n8n-workflow*.json")
foreach ($pat in $patterns) {
  Get-ChildItem -Path $Root -Filter $pat -File -ErrorAction SilentlyContinue | ForEach-Object {
    $dest = Join-Path $wfDir $_.Name
    if (-not (Test-Path $dest)) {
      Move-Item -Force $_.FullName $dest
      Write-Host "Moved workflow: $($_.Name)"
    }
  }
}

# Move existing n8n/*.json (except if already in workflows)
Get-ChildItem -Path "n8n" -Filter "*.json" -File -ErrorAction SilentlyContinue |
  Where-Object { $_.DirectoryName -notmatch "workflows" } |
  ForEach-Object {
    $dest = Join-Path $wfDir $_.Name
    if (-not (Test-Path $dest)) {
      Move-Item -Force $_.FullName $dest
      Write-Host "Moved workflow: $($_.Name)"
    }
  }

# Remove .bak workflow backups
Get-ChildItem -Path $wfDir -Filter "*.bak*" -File -ErrorAction SilentlyContinue | Remove-Item -Force

Write-Host "Running move-workflows.mjs..."
node (Join-Path $PSScriptRoot "move-workflows.mjs")

$wfCount = (Get-ChildItem -Path $wfDir -Filter "*.json" -File -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Host "`nDone. n8n workflows: $wfCount files in n8n\workflows\" -ForegroundColor Green
