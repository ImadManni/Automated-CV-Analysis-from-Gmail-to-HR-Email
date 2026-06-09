/**
 * Supprime les exécutables orphelins `node_modules/.bin/n8n*` qui pointent vers un paquet
 * `node_modules/n8n` absent → évite MODULE_NOT_FOUND au `npx n8n`.
 * À relancer si l’erreur réapparaît (ex. après un npm install partiel).
 */
import { readdirSync, existsSync, unlinkSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')
const binDir = join(projectRoot, 'node_modules', '.bin')
const n8nPkg = join(projectRoot, 'node_modules', 'n8n')

let removed = 0
if (existsSync(binDir)) {
  for (const name of readdirSync(binDir)) {
    if (!name.startsWith('n8n')) continue
    try {
      unlinkSync(join(binDir, name))
      removed += 1
    } catch (_) {
      /* ignore */
    }
  }
}

if (existsSync(n8nPkg)) {
  const hasPkg = existsSync(join(n8nPkg, 'package.json'))
  const hasBin = existsSync(join(n8nPkg, 'bin', 'n8n'))
  if (!hasPkg || !hasBin) {
    try {
      rmSync(n8nPkg, { recursive: true, force: true })
      console.log('[fix:n8n-shims] Dossier node_modules/n8n incomplet supprimé.')
    } catch (_) {
      /* ignore */
    }
  }
}

console.log(
  `[fix:n8n-shims] ${removed} entrée(s) .bin supprimée(s). ` +
    `Si n8n global nvm est cassé : npm uninstall -g n8n. ` +
    `Puis : npx --yes --package=n8n@2.13.2 n8n`,
)
