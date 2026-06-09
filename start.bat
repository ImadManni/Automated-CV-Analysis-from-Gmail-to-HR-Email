@echo off
cd /d "%~dp0"
set "ROOT=%~dp0"
set "ROOTTRIM=%ROOT:~0,-1%"

echo Liberation des ports 3004 (Vite) et 3005 (API)...
node scripts\kill-ports.cjs
if errorlevel 1 (
  echo [AVERTISSEMENT] kill-ports: erreur — verifie que Node est dans le PATH.
)

echo.
echo Demarrage API sur port 3005 (routes n8n: /api/offers/catalog, /api/candidatures/cv-text, /analysis-result^)...
REM Double kill 3005 + demarrage direct server\index.js = meme logique que npm run server:3005
start "PCA API (3005)" cmd /k "cd /d ""%ROOTTRIM%"" && set PORT=3005&& node scripts\kill-ports.cjs 3005&& node server\index.js & pause"

ping -n 3 127.0.0.1 >nul

echo Demarrage frontend sur port 3004...
start "PCA Web (3004)" cmd /k "cd /d ""%ROOTTRIM%"" && if exist node_modules\\vite\\bin\\vite.js (node node_modules\\vite\\bin\\vite.js --port 3004 --strictPort) else (npm run dev -- --port 3004 --strictPort) & pause"

echo.
echo Deux fenetres ouvertes: API (3005) et Front (3004). Ferme-les pour arreter.
echo Test rapide: http://127.0.0.1:3005/api/offers/catalog
echo Ouvre http://localhost:3004 dans le navigateur.
pause
