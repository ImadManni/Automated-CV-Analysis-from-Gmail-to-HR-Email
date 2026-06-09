/**
 * Libère les ports 3002 et 3005 puis lance l'API et le front (Windows-friendly).
 * Usage: node scripts/start.cjs
 */
const { execSync, spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

function logErr(msg, err) {
  console.error(msg, err && err.message)
  try { fs.writeFileSync(path.join(__dirname, '..', 'start-error.log'), (err && err.stack) || msg) } catch (e) {}
}

const ports = [3002, 3005]

function killPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
    const lines = out.trim().split('\n').filter(Boolean)
    const pids = new Set()
    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      const pid = parts[parts.length - 1]
      if (pid && pid !== '0' && /^\d+$/.test(pid)) pids.add(pid)
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'pipe' })
        console.log(`Port ${port}: processus ${pid} arrêté.`)
      } catch (e) {}
    }
  } catch (e) {}
}

console.log('Libération des ports 3002 et 3005...')
ports.forEach(killPort)
console.log('Démarrage API (3005) + Front (3002)...\n')

const root = path.resolve(__dirname, '..')
const serverPath = path.join(root, 'server', 'index.js')

let api, web
try {
  api = spawn(process.execPath, [serverPath], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, PORT: '3005' },
  })
} catch (err) {
  console.error('Impossible de lancer l\'API:', err.message)
  process.exit(1)
}

try {
  web = spawn('npx', ['vite'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  })
} catch (err) {
  console.error('Impossible de lancer Vite:', err.message)
  api.kill()
  process.exit(1)
}

function exit() {
  api.kill('SIGTERM')
  web.kill('SIGTERM')
  process.exit(0)
}

process.on('SIGINT', exit)
process.on('SIGTERM', exit)

api.on('error', (err) => {
  console.error('API error:', err)
})
web.on('error', (err) => {
  console.error('Web error:', err)
})

api.on('exit', (code) => {
  if (code !== 0 && code !== null && web) web.kill()
})
web.on('exit', (code) => {
  if (code !== 0 && code !== null && api) api.kill()
})

process.stdin.resume()
