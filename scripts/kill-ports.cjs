/**
 * Libère les ports 3003 (frontend) et 3005 (API) sur Windows.
 * Usage: node scripts/kill-ports.cjs
 */
const { execSync } = require('child_process')
const ports = [3003, 3005]

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
      } catch (e) {
        // ignore
      }
    }
    if (pids.size === 0) console.log(`Port ${port}: aucun processus trouvé.`)
  } catch (e) {
    console.log(`Port ${port}: rien à libérer.`)
  }
}

console.log('Libération des ports 3003 et 3005...')
ports.forEach(killPort)
console.log('Terminé. Tu peux lancer npm run start')
