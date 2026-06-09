/** Lit une clé simple dans `.env` à la racine du projet (sans dépendance dotenv). */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export function readDotenvKey(projectRoot, key) {
  const envPath = join(projectRoot, '.env')
  if (!existsSync(envPath)) return undefined
  const text = readFileSync(envPath, 'utf8')
  const re = new RegExp(`^${key}=(.*)$`, 'm')
  const m = text.match(re)
  if (!m) return undefined
  return m[1].trim().replace(/^["']|["']$/g, '')
}
