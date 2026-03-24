@echo off
cd /d "%~dp0"
set "ROOT=%~dp0"
echo Liberation des ports 3004 et 3005...
node scripts\kill-ports.cjs
echo.
echo Demarrage API (3005) et Front (3004)...
start "PCA API" cmd /k "cd /d ""%ROOT:~0,-1%"" && npm run server & pause"
ping -n 3 127.0.0.1 >nul
start "PCA Web" cmd /k "cd /d ""%ROOT:~0,-1%"" && npm run dev -- --port 3004 & pause"
echo.
echo Deux fenetres ouvertes: API (3005) et Front (3004). Ferme-les pour arreter.
echo Ouvre http://localhost:3004 dans le navigateur.
pause
