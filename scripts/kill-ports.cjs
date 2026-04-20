/**
 * Libère des ports TCP (LISTEN) sur Windows — tue le PID associé.
 * Usage:
 *   node scripts/kill-ports.cjs           → 3004 + 3005 (Vite + API)
 *   node scripts/kill-ports.cjs 3005      → API seulement (recommandé avant npm run server)
 *   node scripts/kill-ports.cjs 3004 3005 → explicite
 */
const { execSync } = require('child_process')
const argvPorts = process.argv
  .slice(2)
  .map((x) => parseInt(x, 10))
  .filter((n) => Number.isInteger(n) && n > 0 && n < 65536)
const ports = argvPorts.length > 0 ? argvPorts : [3004, 3005]

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
}

function getPidsListening(port) {
  try {
    const ps = [
      'powershell -NoProfile -Command',
      `"Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`,
    ].join(' ')
    const out = run(ps)
    if (!out) return []
    return out
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter((x) => /^\d+$/.test(x) && x !== '0')
  } catch {
    return []
  }
}

function getPidsFromNetstat(port) {
  try {
    const out = run(`netstat -ano -p tcp | findstr :${port}`)
    if (!out) return []
    return out
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/).pop())
      .filter((x) => x && /^\d+$/.test(x) && x !== '0')
  } catch {
    return []
  }
}

function killPort(port) {
  const pids = new Set([...getPidsListening(port), ...getPidsFromNetstat(port)])
  if (pids.size === 0) {
    console.log(`Port ${port}: rien à libérer.`)
    return
  }

  for (const pid of pids) {
    try {
      run(`taskkill /PID ${pid} /F`)
      console.log(`Port ${port}: processus ${pid} arrêté.`)
    } catch {
      console.log(`Port ${port}: impossible d'arrêter ${pid} (droits/état).`)
    }
  }
}

console.log(`Libération des ports: ${ports.join(', ')}...`)
ports.forEach(killPort)
console.log('Terminé.')
