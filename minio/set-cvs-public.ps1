# Set bucket "cvs" to public (download + upload) so n8n can upload
# Run: .\set-cvs-public.ps1

$mcPath = "$env:USERPROFILE\mc.exe"
$mcUrl = "https://dl.min.io/client/mc/release/windows-amd64/mc.exe"

if (-not (Test-Path $mcPath)) {
    Write-Host "Downloading mc.exe..."
    Invoke-WebRequest -Uri $mcUrl -OutFile $mcPath -UseBasicParsing
}

& $mcPath alias set myminio http://127.0.0.1:9000 minioadmin minioadmin 2>$null
& $mcPath anonymous set download,upload myminio/cvs
Write-Host "Done. Bucket cvs is now public (download + upload)."
& $mcPath anonymous get myminio/cvs
