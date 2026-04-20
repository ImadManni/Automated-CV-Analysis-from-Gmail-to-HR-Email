# PowerShell — Créer la base PCA (PostgreSQL)
# Exécuter depuis la racine du projet ou adapter $ProjectRoot

$ProjectRoot = "C:\Users\DELL\Desktop\Automated CV Analysis from Gmail to HR Email"
$PsqlPath = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
$ScriptPath = "$ProjectRoot\server\sql\create-db-kamla.sql"

Set-Location $ProjectRoot
& $PsqlPath -U postgres -h localhost -f $ScriptPath
