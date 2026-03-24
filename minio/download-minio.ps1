# Download MinIO for Windows (run once)
$minioUrl = "https://dl.minio.io/server/minio/release/windows-amd64/minio.exe"
$outDir = $PSScriptRoot
$outPath = Join-Path $outDir "minio.exe"

Write-Host "Downloading MinIO to $outPath ..."
try {
    Invoke-WebRequest -Uri $minioUrl -OutFile $outPath -UseBasicParsing
    Write-Host "Done. Run MinIO with: .\minio.exe server ..\server\data\minio --console-address `":9001`""
} catch {
    Write-Host "Error: $_"
    Write-Host "Download manually from: $minioUrl"
    Write-Host "Save as: $outPath"
}
