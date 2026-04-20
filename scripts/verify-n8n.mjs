/**
 * Après npm install : vérifie que le package n8n est présent (devDependency).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = path.join(root, 'node_modules', 'n8n', 'package.json')
if (!fs.existsSync(pkg)) {
  console.warn('[postinstall] n8n absent de node_modules — lance: npm install')
  process.exit(0)
}
const v = JSON.parse(fs.readFileSync(pkg, 'utf8')).version
console.log('[postinstall] n8n OK:', v)
