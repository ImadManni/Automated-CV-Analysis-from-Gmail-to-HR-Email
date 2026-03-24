@echo off
REM MinIO bla Docker - bach t-chouf l-CVs uploadin
REM Ila ma 3andkch minio.exe, nzeloh mn: https://dl.minio.io/server/minio/release/windows-amd64/minio.exe
REM 7otou f dossier: minio\minio.exe (7ta n-create l-dossier 7tatek)

set MINIO_DIR=%~dp0minio
set DATA_DIR=%~dp0server\data\minio

if not exist "%MINIO_DIR%\minio.exe" (
  echo.
  echo [ERROR] minio.exe ma lqitouch f: %MINIO_DIR%
  echo Nzel minio.exe mn: https://dl.minio.io/server/minio/release/windows-amd64/minio.exe
  echo 7oto f dossier: %MINIO_DIR%
  echo.
  pause
  exit /b 1
)

if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"

echo.
echo MinIO kay-xdem bla Docker...
echo Console: http://localhost:9001  ^|  Login: minioadmin / minioadmin
echo API (upload): http://localhost:9000
echo Bucket: cv
echo.
"%MINIO_DIR%\minio.exe" server "%DATA_DIR%" --console-address ":9001"
pause
