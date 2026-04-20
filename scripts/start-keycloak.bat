@echo off
cd /d "%~dp0\.."
set "KEYCLOAK_DIR="
if exist "keycloak-26.5.4\bin\kc.bat" set "KEYCLOAK_DIR=keycloak-26.5.4"
if exist "keycloak-24\bin\kc.bat" set "KEYCLOAK_DIR=keycloak-24"
if exist "keycloak\bin\kc.bat" set "KEYCLOAK_DIR=keycloak"
if not defined KEYCLOAK_DIR (
  echo.
  echo Keycloak non trouve. Pour lancer Keycloak en local sans Docker :
  echo.
  echo 1. Telechargez Keycloak : https://www.keycloak.org/downloads
  echo    Choisissez "Keycloak 24" ou "26" puis "ZIP".
  echo 2. Extrayez le ZIP dans ce dossier du projet.
  echo 3. Renommez le dossier en "keycloak-26.5.4" ou "keycloak-24" ou "keycloak".
  echo 4. Relancez ce script : scripts\start-keycloak.bat
  echo.
  echo Ensuite configurez le realm "pca-app" et le client "pca-web".
  echo Voir docs\keycloak-integration-step-by-step.md
  echo.
  pause
  exit /b 1
)
echo Demarrage de Keycloak depuis %KEYCLOAK_DIR%...
echo Keycloak sera accessible sur http://localhost:8080
echo Pour arreter : fermez cette fenetre ou Ctrl+C.
echo.
call "%KEYCLOAK_DIR%\bin\kc.bat" start-dev
