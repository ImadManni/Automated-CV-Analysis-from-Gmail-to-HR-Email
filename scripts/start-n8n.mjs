/**
 * Démarre n8n avec les mêmes .env que PCA : DATABASE_URL → Postgres n8n,
 * schéma N8N_PG_SCHEMA, port N8N_PORT (5678), clé de chiffrement locale si absente.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
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

function readExistingN8nEncryptionKey() {
  try {
    const configPath = path.join(os.homedir(), '.n8n', 'config')
    if (!fs.existsSync(configPath)) return null
    const raw = fs.readFileSync(configPath, 'utf8')
    const parsed = JSON.parse(raw)
    const key = String(parsed?.encryptionKey || '').trim()
    return key || null
  } catch {
    return null
  }
}

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
  const existingKey = readExistingN8nEncryptionKey()
  extra.N8N_ENCRYPTION_KEY = existingKey || 'pca-local-n8n-encryption-key-32b!!'
}

extra.N8N_PORT = process.env.N8N_PORT || '5678'

const env = { ...process.env, ...extra }

const pgInfo = extra.DB_TYPE
  ? `${extra.DB_POSTGRESDB_HOST}:${extra.DB_POSTGRESDB_PORT}/${extra.DB_POSTGRESDB_DATABASE} (schema=${extra.DB_POSTGRESDB_SCHEMA})`
  : 'SQLite (embedded)'
console.log('[start-n8n] UI: http://localhost:' + extra.N8N_PORT + ' | DB: ' + pgInfo)

await ensurePostgresSchema(dbUrl, extra.DB_POSTGRESDB_SCHEMA || process.env.N8N_PG_SCHEMA)

const localN8nCli = path.join(root, 'node_modules', 'n8n', 'bin', 'n8n')
const hasLocalCli = fs.existsSync(localN8nCli)

let command = hasLocalCli
  ? process.execPath
  : (process.platform === 'win32' ? 'npx.cmd' : 'npx')
let args = hasLocalCli
  ? [localN8nCli]
  : ['n8n']
const shell = false

const child = spawn(command, args, {
  env,
  stdio: 'inherit',
  cwd: root,
  shell,
})

child.on('error', (e) => {
  console.error('[start-n8n] Launch failed:', e.message)
  process.exit(1)
})
child.on('exit', (code, signal) => {
  if (signal) {
    console.warn('[start-n8n] n8n stopped by signal:', signal)
  } else {
    console.warn('[start-n8n] n8n exited with code:', code ?? 0)
  }
  process.exit(code ?? 0)
})
