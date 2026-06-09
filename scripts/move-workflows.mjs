import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const wfDir = path.join(root, 'n8n', 'workflows')
fs.mkdirSync(wfDir, { recursive: true })

function moveIfJson (dir, name) {
  const src = path.join(dir, name)
  if (!name.endsWith('.json') || !fs.statSync(src).isFile()) return
  const dest = path.join(wfDir, name)
  if (!fs.existsSync(dest)) fs.renameSync(src, dest)
  console.log('moved:', name)
}

for (const name of fs.readdirSync(root)) {
  if (name.startsWith('PCA - IMAP') || name.startsWith('n8n-workflow')) {
    moveIfJson(root, name)
  }
}

const n8nDir = path.join(root, 'n8n')
for (const name of fs.readdirSync(n8nDir)) {
  if (name === 'workflows') continue
  const full = path.join(n8nDir, name)
  if (fs.statSync(full).isFile() && name.endsWith('.json')) moveIfJson(n8nDir, name)
}

console.log('workflows count:', fs.readdirSync(wfDir).filter((f) => f.endsWith('.json')).length)
