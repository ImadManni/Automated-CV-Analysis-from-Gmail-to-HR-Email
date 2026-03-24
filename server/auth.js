/**
 * Auth util: JWT + bcrypt. Users dans PostgreSQL (si DATABASE_URL) ou server/data/users.json
 */
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { useDb, query } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const USERS_FILE = path.join(__dirname, 'data', 'users.json')
const JWT_SECRET = process.env.JWT_SECRET || 'pca-dev-secret-change-in-production'
const SALT_ROUNDS = 10

function ensureDataDir() {
  const dir = path.dirname(USERS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function loadUsers() {
  ensureDataDir()
  if (!fs.existsSync(USERS_FILE)) return []
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8')
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveUsers(users) {
  ensureDataDir()
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8')
}

function rowToUser(row) {
  if (!row) return null
  return {
    id: String(row.id),
    email: row.email || '',
    name: row.name || (row.email || '').split('@')[0],
    passwordHash: row.password_hash,
    provider: row.provider,
    providerId: row.provider_id,
  }
}

export async function findUserByEmail(email) {
  const norm = (email || '').trim().toLowerCase()
  if (!norm) return null
  if (useDb) {
    try {
      const res = await query('SELECT * FROM users WHERE LOWER(TRIM(email)) = $1', [norm])
      return res.rows[0] ? rowToUser(res.rows[0]) : null
    } catch (e) {
      console.warn('[auth] findUserByEmail:', e.message)
      return null
    }
  }
  return loadUsers().find((u) => (u.email || '').trim().toLowerCase() === norm) || null
}

export async function findUserByProvider(provider, providerId) {
  if (useDb) {
    try {
      const res = await query('SELECT * FROM users WHERE provider = $1 AND provider_id = $2', [provider, String(providerId)])
      return res.rows[0] ? rowToUser(res.rows[0]) : null
    } catch (e) {
      console.warn('[auth] findUserByProvider:', e.message)
      return null
    }
  }
  return loadUsers().find((u) => u.provider === provider && u.providerId === providerId) || null
}

export async function findUserById(id) {
  if (!id) return null
  if (useDb) {
    try {
      const res = await query('SELECT * FROM users WHERE id = $1', [id])
      return res.rows[0] ? rowToUser(res.rows[0]) : null
    } catch (e) {
      console.warn('[auth] findUserById:', e.message)
      return null
    }
  }
  const user = loadUsers().find((u) => u.id === id) || null
  if (!user) return null
  return { id: user.id, email: user.email, name: user.name || (user.email || '').split('@')[0] }
}

export async function findOrCreateUserByOAuth(provider, { id: providerId, email, name }) {
  const normEmail = (email || '').trim().toLowerCase()
  if (!normEmail) return null
  let user = await findUserByProvider(provider, String(providerId))
  if (user) return { id: user.id, email: user.email, name: user.name || name || normEmail.split('@')[0] }
  user = await findUserByEmail(normEmail)
  if (user) {
    if (useDb) {
      try {
        await query(
          'UPDATE users SET provider = $1, provider_id = $2, updated_at = NOW() WHERE id = $3',
          [provider, String(providerId), user.id]
        )
      } catch (e) {
        console.warn('[auth] update OAuth:', e.message)
      }
    } else {
      const users = loadUsers()
      const i = users.findIndex((u) => u.id === user.id)
      if (i >= 0) {
        users[i] = { ...users[i], provider, providerId: String(providerId) }
        saveUsers(users)
      }
    }
    return { id: user.id, email: user.email, name: user.name || name || normEmail.split('@')[0] }
  }
  const newName = (name || '').trim() || normEmail.split('@')[0]
  if (useDb) {
    try {
      const res = await query(
        `INSERT INTO users (email, name, provider, provider_id) VALUES ($1, $2, $3, $4) RETURNING id, email, name`,
        [normEmail, newName, provider, String(providerId)]
      )
      const row = res.rows[0]
      return { id: String(row.id), email: row.email, name: row.name }
    } catch (e) {
      console.error('[auth] insert OAuth user:', e.message)
      return null
    }
  }
  const newUser = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    email: normEmail,
    name: newName,
    provider,
    providerId: String(providerId),
    passwordHash: null,
    createdAt: new Date().toISOString(),
  }
  const users = loadUsers()
  users.push(newUser)
  saveUsers(users)
  return { id: newUser.id, email: newUser.email, name: newUser.name }
}

export async function createUser({ email, password, name }) {
  const normEmail = (email || '').trim().toLowerCase()
  if (!normEmail || !password) throw new Error('Email and password required')
  const existing = await findUserByEmail(normEmail)
  if (existing) throw new Error('User already exists')
  const hash = await bcrypt.hash(password, SALT_ROUNDS)
  const userName = (name || '').trim() || normEmail.split('@')[0]
  if (useDb) {
    try {
      const res = await query(
        `INSERT INTO users (email, name, password_hash, provider) VALUES ($1, $2, $3, 'local') RETURNING id, email, name`,
        [normEmail, userName, hash]
      )
      const row = res.rows[0]
      return { id: String(row.id), email: row.email, name: row.name }
    } catch (e) {
      console.error('[auth] createUser:', e.message)
      throw e
    }
  }
  const user = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    email: normEmail,
    passwordHash: hash,
    name: userName,
    provider: 'local',
    createdAt: new Date().toISOString(),
  }
  const users = loadUsers()
  users.push(user)
  saveUsers(users)
  return { id: user.id, email: user.email, name: user.name }
}

export async function verifyUser(email, password) {
  const user = await findUserByEmail(email)
  if (!user) return null
  const hash = useDb ? (await query('SELECT password_hash FROM users WHERE id = $1', [user.id])).rows[0]?.password_hash : user.passwordHash
  if (!hash) return null
  const ok = await bcrypt.compare(password, hash)
  if (!ok) return null
  return { id: user.id, email: user.email, name: user.name }
}

export function signToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn })
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

async function resolveUserFromToken(token) {
  try {
    const { verifyKeycloakToken, isKeycloakEnabled } = await import('./keycloak.js')
    if (isKeycloakEnabled()) {
      const kc = await verifyKeycloakToken(token)
      if (kc) return kc
    }
  } catch {
    // ignore
  }
  const payload = verifyToken(token)
  if (payload) {
    return { id: payload.id, email: payload.email, name: payload.name, roles: [] }
  }
  return null
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Token required' })
  }
  resolveUserFromToken(token).then((user) => {
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' })
    }
    req.user = user
    next()
  }).catch(() => {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' })
  })
}

export function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return next()
  resolveUserFromToken(token).then((user) => {
    if (user) req.user = user
    next()
  }).catch(() => next())
}
