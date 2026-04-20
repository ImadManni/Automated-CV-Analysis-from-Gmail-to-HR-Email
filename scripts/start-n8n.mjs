/**
 * Démarre n8n avec les mêmes .env que PCA : DATABASE_URL → Postgres n8n,
 * schéma N8N_PG_SCHEMA, port N8N_PORT (5678), clé de chiffrement locale si absente.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function loadEnvFile() {
  for (const name of ['.env.pca', '.env']) {
    const p = path.join(root, name)
    if (!fs.existsSync(p)) continue
    let content = fs.readFileSync(p, 'utf8')
    if (content.charCodeAt(0) === 0xfeff) content = content.slice(1)
    for (const line of content.split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
    return
  }
}

async function ensurePostgresSchema(connectionString, schemaRaw) {
  const schema = String(schemaRaw || 'n8n').replace(/^["']|["']$/g, '')
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) return
  try {
    const { Client } = await import('pg')
    const client = new Client({ connectionString })
    await client.connect()
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`)
    await client.end()
    console.log('[start-n8n] Schéma Postgres OK:', schema)
  } catch (e) {
    console.warn('[start-n8n] Schéma n8n (ignorer si OK):', e.message)
  }
}

loadEnvFile()

const dbUrl = process.env.DATABASE_URL
const extra = {}

if (dbUrl) {
  try {
    const u = new URL(dbUrl.replace(/^postgresql:/i, 'http:'))
    extra.DB_TYPE = 'postgresdb'
    extra.DB_POSTGRESDB_HOST = u.hostname
    extra.DB_POSTGRESDB_PORT = u.port || '5432'
    extra.DB_POSTGRESDB_DATABASE = decodeURIComponent((u.pathname || '/').replace(/^\//, '').split('/')[0] || '')
    extra.DB_POSTGRESDB_USER = decodeURIComponent(u.username || '')
    extra.DB_POSTGRESDB_PASSWORD = decodeURIComponent(u.password || '')
    extra.DB_POSTGRESDB_SCHEMA = (process.env.N8N_PG_SCHEMA || 'n8n').replace(/^["']|["']$/g, '')
  } catch (e) {
    console.warn('[start-n8n] DATABASE_URL invalide, n8n utilisera SQLite:', e.message)
  }
}

if (!process.env.N8N_ENCRYPTION_KEY) {
  extra.N8N_ENCRYPTION_KEY = 'pca-local-n8n-encryption-key-32b!!'
}

extra.N8N_PORT = process.env.N8N_PORT || '5678'

const env = { ...process.env, ...extra }

const pgInfo = extra.DB_TYPE
  ? `${extra.DB_POSTGRESDB_HOST}:${extra.DB_POSTGRESDB_PORT}/${extra.DB_POSTGRESDB_DATABASE} (schema=${extra.DB_POSTGRESDB_SCHEMA})`
  : 'SQLite (embedded)'
console.log('[start-n8n] UI: http://localhost:' + extra.N8N_PORT + ' | DB: ' + pgInfo)

await ensurePostgresSchema(dbUrl, extra.DB_POSTGRESDB_SCHEMA || process.env.N8N_PG_SCHEMA)

const child = spawn('npx n8n start', {
  env,
  stdio: 'inherit',
  cwd: root,
  shell: true,
})

child.on('exit', (code) => process.exit(code ?? 0))
