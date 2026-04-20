/**
 * Démarre n8n avec PostgreSQL (pas de SQLite).
 * Lit DATABASE_URL du .env.
 *
 * - Si N8N_PG_SCHEMA est défini : même base que DATABASE_URL (ex. pca), schéma dédié
 *   (évite CREATE DATABASE si pca_user n’a pas CREATEDB).
 * - Sinon : base N8N_DATABASE (défaut n8n) sur le même hôte.
 *
 * Utilise `npx --package=n8n@…` pour forcer le paquet npm (évite une install
 * globale cassée sous nvm qui provoque des MODULE_NOT_FOUND).
 * Version : N8N_CLI_VERSION (défaut 2.13.2).
 *
 * Si `npx n8n` échoue encore : npm uninstall -g n8n
 *
 * Usage : npm run n8n   ou   npm run n8n:start
 */
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readDotenvKey } from './read-dotenv-value.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const databaseUrl = process.env.DATABASE_URL || readDotenvKey(root, 'DATABASE_URL')

if (!databaseUrl) {
  console.error('[n8n] Définissez DATABASE_URL dans .env ou dans l’environinement.')
  process.exit(1)
}

let u
try {
  u = new URL(databaseUrl)
} catch {
  console.error('[n8n] DATABASE_URL invalide.')
  process.exit(1)
}

const password = decodeURIComponent(u.password || '')
const user = decodeURIComponent(u.username || '')
const host = u.hostname
const port = String(u.port || '5432')
const appDb = decodeURIComponent(u.pathname.replace(/^\//, '').split('?')[0] || 'pca')
const pgSchema = (
  process.env.N8N_PG_SCHEMA ||
  readDotenvKey(root, 'N8N_PG_SCHEMA') ||
  ''
).trim()
const dbName = pgSchema
  ? appDb
  : (process.env.N8N_DATABASE || readDotenvKey(root, 'N8N_DATABASE') || 'n8n').trim()

/** Variable d’environnement puis, si absent, clé dans `.env` à la racine. */
function envFromProcessOrDotenv(key, defaultValue) {
  const fromProc = process.env[key]
  if (fromProc != null && String(fromProc).trim() !== '') return String(fromProc).trim()
  const fromFile = readDotenvKey(root, key)
  if (fromFile != null && String(fromFile).trim() !== '') return String(fromFile).trim()
  return defaultValue
}

const env = {
  ...process.env,
  /** Évite les erreurs `TelemetryController` / Rudder (`fetch failed`, `ECONNRESET`) si le réseau bloque n8n.io. */
  N8N_DIAGNOSTICS_ENABLED: envFromProcessOrDotenv('N8N_DIAGNOSTICS_ENABLED', 'false'),
  N8N_VERSION_NOTIFICATIONS_ENABLED: envFromProcessOrDotenv('N8N_VERSION_NOTIFICATIONS_ENABLED', 'false'),
  /** Permet `$env.VAR` dans les nœuds Code ; pour le SMTP, les workflows PCA utilisent plutôt un From fixe (sans `$env`). */
  N8N_BLOCK_ENV_ACCESS_IN_NODE: envFromProcessOrDotenv('N8N_BLOCK_ENV_ACCESS_IN_NODE', 'false'),
  DB_TYPE: 'postgresdb',
  DB_POSTGRESDB_HOST: host,
  DB_POSTGRESDB_PORT: port,
  DB_POSTGRESDB_USER: user,
  DB_POSTGRESDB_PASSWORD: password,
  DB_POSTGRESDB_DATABASE: dbName,
  ...(pgSchema ? { DB_POSTGRESDB_SCHEMA: pgSchema } : {}),
}

const n8nCliVersion = process.env.N8N_CLI_VERSION || '2.13.2'
// Windows : spawn(..., { shell: false }) vers npx/cmd provoque souvent EINVAL ; le shell résout npx correctement.
const win = process.platform === 'win32'
const child = spawn('npx', ['--yes', `--package=n8n@${n8nCliVersion}`, 'n8n', 'start'], {
  env,
  cwd: root,
  shell: win,
  stdio: 'inherit',
})

child.on('exit', (code) => process.exit(code == null ? 1 : code))
