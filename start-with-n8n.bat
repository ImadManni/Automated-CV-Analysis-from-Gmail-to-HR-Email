@echo off
cd /d "%~dp0"
set "ROOT=%~dp0"
echo Liberation des ports 3004 et 3005...
node scripts\kill-ports.cjs
echo.
echo Demarrage: API (3005) + Front (3004) + n8n (5678)...
echo 1) Importer le workflow JSON dans n8n et ACTIVER le workflow.
echo 2) Configurer SMTP + OpenAI dans n8n (credentials).
echo 3) Les webhooks interview RH/Technique/Directeur doivent correspondre au .env (N8N_INTERVIEW_WEBHOOK_URL_*).
echo.
start "PCA n8n" cmd /k "cd /d ""%ROOT:~0,-1%"" && npm run n8n & pause"
ping -n 4 127.0.0.1 >nul
start "PCA API" cmd /k "cd /d ""%ROOT:~0,-1%"" && set PORT=3005 && npm run server & pause"
ping -n 2 127.0.0.1 >nul
start "PCA Web" cmd /k "cd /d ""%ROOT:~0,-1%"" && npm run dev -- --port 3004 --strictPort & pause"
echo.
echo Trois fenetres: n8n (5678), API (3005), Front (3004).
echo n8n UI: http://localhost:5678
echo App: http://localhost:3004
pause
