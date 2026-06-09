@echo off
REM MinIO (sans Docker). Donnees: C:\minio-data | API :9000 | Console :9001
REM Si minio.exe manque: npm run minio:download

set MINIO_DIR=%~dp0minio
set DATA_DIR=C:\minio-data

if not exist "%MINIO_DIR%\minio.exe" (
  echo.
  echo [ERROR] minio.exe introuvable: %MINIO_DIR%
  echo Lance: npm run minio:download
  echo Ou: https://dl.min.io/server/minio/release/windows-amd64/minio.exe
  echo Place-le dans: %MINIO_DIR%
  echo.
  pause
  exit /b 1
)

if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"

echo.
echo MinIO demarre...
echo Console: http://localhost:9001  ^|  Defaut: minioadmin / minioadmin
echo API:     http://localhost:9000
echo Donnees: %DATA_DIR%
echo.
"%MINIO_DIR%\minio.exe" server "%DATA_DIR%" --console-address ":9001"
pause
