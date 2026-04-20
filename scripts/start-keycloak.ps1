# Start Keycloak (dev mode) - PowerShell
# Usage: .\scripts\start-keycloak.ps1
# Or from project root: powershell -ExecutionPolicy Bypass -File .\scripts\start-keycloak.ps1

$ErrorActionPreference = "Stop"

# 1. JAVA_HOME - use existing or detect from java
if (-not $env:JAVA_HOME -or -not (Test-Path $env:JAVA_HOME)) {
    try {
        $javaHome = (java -XshowSettings:properties -version 2>&1) | Select-String "java.home\s*=\s*(.+)" | ForEach-Object { $_.Matches.Groups[1].Value.Trim() }
        if ($javaHome) { $env:JAVA_HOME = $javaHome; Write-Host "JAVA_HOME set to: $javaHome" }
    } catch {}
    if (-not $env:JAVA_HOME -or -not (Test-Path $env:JAVA_HOME)) {
        $defaultJava = "C:\Program Files\Java\jdk-17"
        if (Test-Path $defaultJava) { $env:JAVA_HOME = $defaultJava } else { Write-Host "JAVA_HOME not set and Java not found. Install JDK 17 or set JAVA_HOME."; exit 1 }
    }
}

# 2. Ensure System32 in PATH (for findstr used by kc.bat)
$env:Path = "C:\Windows\System32;C:\Windows;" + $env:Path

# 3. Keycloak directory - project folder or Desktop
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$keycloakDir = $null
foreach ($name in @("keycloak-26.5.4", "keycloak-26", "keycloak")) {
    $p = Join-Path $projectRoot $name
    if (Test-Path (Join-Path $p "bin\kc.bat")) { $keycloakDir = $p; break }
}
if (-not $keycloakDir) {
    $desktop = [Environment]::GetFolderPath("Desktop")
    foreach ($name in @("keycloak-26.5.4", "keycloak-26", "keycloak")) {
        $p = Join-Path $desktop $name
        if (Test-Path (Join-Path $p "bin\kc.bat")) { $keycloakDir = $p; break }
    }
}
if (-not $keycloakDir) {
    Write-Host "Keycloak folder not found. Place keycloak-26.5.4 in project root or on Desktop."
    exit 1
}

Write-Host "Starting Keycloak from: $keycloakDir"
Write-Host "JAVA_HOME: $env:JAVA_HOME"
Write-Host "Open http://localhost:8080 when ready."
Set-Location $keycloakDir
& .\bin\kc.bat start-dev
