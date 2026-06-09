/**
 * Prépare le stockage Postgres pour n8n :
 * - Si N8N_PG_SCHEMA est défini : CREATE SCHEMA dans la base de DATABASE_URL (aucun CREATEDB).
 * - Sinon : CREATE DATABASE (nécessite un rôle avec droit de création de bases, ex. superuser).
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { readDotenvKey } from './read-dotenv-value.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const databaseUrl = process.env.DATABASE_URL || readDotenvKey(root, 'DATABASE_URL')

if (!databaseUrl) {
  console.error('[n8n:db] Définissez DATABASE_URL dans .env.')
  process.exit(1)
}

const sharedSchema = (
  process.env.N8N_PG_SCHEMA ||
  readDotenvKey(root, 'N8N_PG_SCHEMA') ||
  ''
).trim()

if (sharedSchema) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(sharedSchema)) {
    console.error('[n8n:db] N8N_PG_SCHEMA doit être un identifiant simple (ex. n8n).')
    process.exit(1)
  }
  const client = new pg.Client({ connectionString: databaseUrl })
  try {
    await client.connect()
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${sharedSchema} AUTHORIZATION CURRENT_USER`)
    console.log(
      `[n8n:db] Schéma « ${sharedSchema} » prêt (même base que dans DATABASE_URL ; pas de CREATE DATABASE).`,
    )
  } catch (e) {
    console.error('[n8n:db]', e.message || e)
    console.error(
      `[n8n:db] Manuel (connecté à la base pca) : CREATE SCHEMA IF NOT EXISTS ${sharedSchema} AUTHORIZATION CURRENT_USER;`,
    )
    process.exit(1)
  } finally {
    await client.end().catch(() => {})
  }
  process.exit(0)
}

let baseUrl
try {
  baseUrl = new URL(databaseUrl)
} catch {
  console.error('[n8n:db] DATABASE_URL invalide.')
  process.exit(1)
}

const dbNameRaw = (process.env.N8N_DATABASE || readDotenvKey(root, 'N8N_DATABASE') || 'n8n').trim()
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbNameRaw)) {
  console.error('[n8n:db] N8N_DATABASE doit être un identifiant PostgreSQL simple (ex. n8n).')
  process.exit(1)
}

const adminUrl = new URL(baseUrl.toString())
adminUrl.pathname = '/postgres'

const client = new pg.Client({ connectionString: adminUrl.toString() })

try {
  await client.connect()
  const check = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbNameRaw])
  if (check.rowCount > 0) {
    console.log(`[n8n:db] Base « ${dbNameRaw} » déjà présente.`)
  } else {
    await client.query(`CREATE DATABASE ${dbNameRaw}`)
    console.log(`[n8n:db] Base « ${dbNameRaw} » créée.`)
  }
} catch (e) {
  console.error('[n8n:db]', e.message || e)
  console.error(
    `[n8n:db] Sans droit « créer une base », ajoutez dans .env : N8N_PG_SCHEMA=n8n (schéma dédié dans la base PCA).`,
  )
  console.error(`[n8n:db] Ou en superuser : CREATE DATABASE ${dbNameRaw} OWNER pca_user;`)
  process.exit(1)
} finally {
  await client.end().catch(() => {})
}
