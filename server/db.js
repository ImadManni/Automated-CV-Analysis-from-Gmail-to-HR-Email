/**
 * Connexion PostgreSQL — utilisée si DATABASE_URL est défini dans .env
 */
import pg from 'pg'

const { Pool } = pg

const DATABASE_URL = (process.env.DATABASE_URL || '').trim()
export const useDb = !!DATABASE_URL

let pool = null
if (useDb) {
  try {
    pool = new Pool({ connectionString: DATABASE_URL })
    pool.on('error', (err) => console.warn('[db] Pool error:', err.message))
  } catch (e) {
    console.warn('[db] Failed to create pool:', e.message)
  }
}

export function getPool() {
  return pool
}

export async function query(text, params) {
  if (!pool) throw new Error('Database not configured')
  return pool.query(text, params)
}
