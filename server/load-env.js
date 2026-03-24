/**
 * Charge .env avant tout autre module (db.js a besoin de DATABASE_URL).
 * À importer en premier dans index.js.
 */
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const roots = [resolve(__dirname, '..'), process.cwd()]
outer: for (const root of roots) {
  for (const name of ['.env.pca', '.env']) {
    const p = resolve(root, name)
    if (existsSync(p)) {
      let content = readFileSync(p, 'utf8')
      if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1)
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) return
        const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
        if (m) {
          const val = m[2].trim().replace(/^["']|["']$/g, '').replace(/\r$/, '')
          process.env[m[1]] = val
        }
      })
      break outer
    }
  }
}
