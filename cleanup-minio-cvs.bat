@echo off
REM Libere l'espace MinIO (bucket cvs) — corrige erreur 507 XMinioStorageFull
REM Donnees MinIO : C:\minio-data  |  Console : http://localhost:9001

echo.
echo ========================================
echo  Nettoyage MinIO - bucket cvs
echo ========================================
echo.
echo CAUSE frequente du workflow casse :
echo   507 XMinioStorageFull = disque plein (C: ou C:\minio-data)
echo.
echo ETAPES (recommande) :
echo   1. Demarrer MinIO : .\start-minio.bat
echo   2. Ouvrir http://localhost:9001  (minioadmin / minioadmin)
echo   3. Object Browser ^> bucket "cvs" ^> selectionner vieux PDF ^> Delete
echo   4. Verifier espace libre sur le disque C:
echo   5. Relancer n8n + renvoyer un CV test
echo.

set DATA=C:\minio-data
if exist "%DATA%" (
  echo Dossier MinIO : %DATA%
  dir "%DATA%" 2>nul
  echo.
  echo Taille approximative du dossier cvs :
  powershell -NoProfile -Command "if (Test-Path '%DATA%\cvs') { $s=(Get-ChildItem '%DATA%\cvs' -Recurse -File -EA SilentlyContinue | Measure-Object Length -Sum).Sum; Write-Host ([math]::Round($s/1MB,2)) ' MB' } else { Write-Host 'bucket cvs introuvable' }"
  echo.
  powershell -NoProfile -Command "Get-PSDrive C | Select-Object @{N='Disque';E={'C:'}}, @{N='Libre_Go';E={[math]::Round($_.Free/1GB,2)}}"
) else (
  echo Dossier %DATA% introuvable.
)

echo.
echo Dans n8n : node "3 - Upload CV to MinIO" — si erreur 507, ne pas continuer
echo le workflow (desactiver "Continue On Fail" sur ce node).
echo.
pause
