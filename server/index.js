/**
 * API backend PCA — Express + Swagger.
 * Reçoit les candidatures depuis n8n et les sert au frontend.
 * Démarrer : npm run server (port 3001)
 * Swagger UI : http://localhost:3001/docs
 */
import './load-env.js'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// Log Keycloak admin provisioning status (for OAuth → create user in Keycloak)
const kcAdmin = process.env.KEYCLOAK_ADMIN_CLIENT_ID && process.env.KEYCLOAK_ADMIN_CLIENT_SECRET
if (kcAdmin) {
  console.log('Keycloak admin (OAuth→Users): configured — les connexions Google/GitHub créeront l’utilisateur dans Keycloak.')
} else {
  console.log('Keycloak admin (OAuth→Users): NOT configured — pour créer les users dans Keycloak, définir KEYCLOAK_ADMIN_CLIENT_ID et KEYCLOAK_ADMIN_CLIENT_SECRET dans .env.pca')
}

import express from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import fs from 'fs'
import path from 'path'
import { spec } from './swagger.js'
import {
  createUser,
  verifyUser,
  signToken,
  authMiddleware,
  optionalAuthMiddleware,
  findUserById,
} from './auth.js'
import { getRagAnswer } from './rag.js'
import { chatWithOpenAI, chatGeneralOpenAI, analyzeCVWithOpenAI } from './openai.js'
import { initRedis } from './redis-client.js'
import { rateLimitOpenAI } from './rate-limit-openai.js'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
let pdfParse
try {
  pdfParse = require('pdf-parse')
} catch {
  pdfParse = null
}
import {
  googleAuth,
  googleCallback,
  githubAuth,
  githubCallback,
} from './oauth.js'
import { ensureUserInKeycloak, testKeycloakAdminConnection } from './keycloak-admin.js'
import { getKeycloakPublicConfig } from './keycloak.js'
import { useDb, query } from './db.js'
import { getAdzunaCampaigns, getAdzunaOffers } from './adzuna.js'

const DATA_FILE = path.join(__dirname, 'data', 'candidatures.json')

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))
// Gestion body JSON invalide (ex: n8n envoie du texte au lieu de JSON)
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON body', message: err.message })
  }
  next(err)
})

let candidatures = []
// En mode JSON (sans PostgreSQL), on garde aussi les entretiens en mémoire
let interviews = []
/** Compteur pour l’auto-increment de l’id sur POST /api/test/candidatures (mock non enregistré) */
let testIdCounter = 0

function loadData() {
  try {
    const dir = path.dirname(DATA_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8')
      candidatures = JSON.parse(raw)
      if (!Array.isArray(candidatures)) candidatures = []
    }
  } catch (e) {
    console.warn('Could not load data:', e.message)
    candidatures = []
  }
}

function saveData() {
  try {
    const dir = path.dirname(DATA_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(DATA_FILE, JSON.stringify(candidatures, null, 2), 'utf8')
  } catch (e) {
    console.warn('Could not save data:', e.message)
  }
}

loadData()
// Initialiser Redis (si disponible) pour le rate limiting OpenAI
initRedis().catch(() => {
  console.warn('Redis: init skipped (connection error)')
})

const CANDIDATURES_SELECT =
  'SELECT id, candidate_id, candidate_name, email, subject, date, decision, score, skills, experience, raw_summary, source, cv_path, school, school_type, phone, experience_count, experience_duration, experience_years_avg, last_employer, offer_title, offer_description FROM candidatures'

/** Candidatures depuis PostgreSQL (format API: id, candidateId, candidateName, …) */
async function getCandidaturesFromDb() {
  try {
    const res = await query(`${CANDIDATURES_SELECT} ORDER BY id DESC`)
    return res.rows.map((r) => mapCandidatureRow(r))
  } catch (e) {
    console.warn('[candidatures] getCandidaturesFromDb:', e.message)
    return []
  }
}

function mapCandidatureRow(r) {
  const baseCv = (process.env.MINIO_PUBLIC_URL || 'http://localhost:9000').replace(/\/$/, '')
  // Fallback: si cv_path est nul mais qu'on a un candidate_id, utiliser /cvs/<candidate_id>
  const cvPath = r.cv_path || (r.candidate_id ? `/cvs/${r.candidate_id}` : null)
  const cvUrl = cvPath ? `${baseCv}/${String(cvPath).replace(/^\//, '')}` : null
  const item = {
    id: r.id,
    candidateId: r.candidate_id,
    candidateName: r.candidate_name,
    email: r.email ? getEmailString(r.email) : (r.email || ''),
    subject: r.subject,
    date: r.date ? new Date(r.date).toISOString() : '',
    decision: decisionForApi(r.decision),
  }
  if (r.score != null) item.score = Number(r.score)
  if (r.skills) item.skills = r.skills
  if (r.experience) item.experience = r.experience
  if (r.raw_summary) item.rawSummary = r.raw_summary
  if (r.source) item.source = r.source
  if (r.school) item.school = r.school
  if (r.school_type) item.schoolType = r.school_type
  if (r.phone) item.phone = r.phone
  if (r.experience_count != null) item.experienceCount = r.experience_count
  if (r.experience_duration) item.experienceDuration = r.experience_duration
  if (r.experience_years_avg != null) item.experienceYearsAvg = Number(r.experience_years_avg)
  if (r.last_employer) item.lastEmployer = r.last_employer
  if (cvUrl) item.cvUrl = cvUrl
  if (r.offer_title) item.offerTitle = r.offer_title
  if (r.offer_description) item.offerDescription = r.offer_description
  return item
}

function decisionForDb(decision) {
  const d = (decision || 'À REVOIR').trim().toUpperCase()
  const map = { ACCEPTÉE: 'ACCEPTEE', REFUSÉE: 'REFUSEE', 'À REVOIR': 'A REVOIR', NON_LISIBLE: 'NON_LISIBLE' }
  return map[d] || d.replace(/\u00C0/g, 'A').replace(/\u00C9/g, 'E')
}
function decisionForApi(decision) {
  if (!decision) return 'À REVOIR'
  const d = decision.trim().toUpperCase()
  const map = { ACCEPTEE: 'ACCEPTÉE', REFUSEE: 'REFUSÉE', 'A REVOIR': 'À REVOIR', NON_LISIBLE: 'NON_LISIBLE' }
  return map[d] || decision
}

/** Insérer une candidature en base, retourne l’item au format API */
async function insertCandidatureIntoDb(item) {
  const dateVal = item.date != null ? (typeof item.date === 'string' ? item.date : new Date(item.date).toISOString()) : new Date().toISOString()
  const decisionDb = decisionForDb(item.decision || 'À REVOIR')
  const res = await query(
    `INSERT INTO candidatures (candidate_id, candidate_name, email, subject, "date", decision, score, skills, experience, raw_summary, source, cv_path)
     VALUES ($1::uuid, $2, $3, $4, $5::timestamptz, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id, candidate_id, candidate_name, email, subject, date, decision, score, skills, experience, raw_summary, source, cv_path`,
    [
      item.candidateId,
      item.candidateName,
      item.email,
      item.subject || null,
      dateVal,
      decisionDb,
      item.score ?? null,
      item.skills || null,
      item.experience || null,
      item.rawSummary || null,
      item.source || null,
      item.cv_path || `/cvs/${item.candidateId}`,
    ]
  )
  const r = res.rows[0]
  const out = {
    id: r.id,
    candidateId: r.candidate_id,
    candidateName: r.candidate_name,
    email: r.email,
    subject: r.subject,
    date: r.date ? new Date(r.date).toISOString() : '',
    decision: decisionForApi(r.decision),
  }
  if (r.score != null) out.score = Number(r.score)
  if (r.skills) out.skills = r.skills
  if (r.experience) out.experience = r.experience
  if (r.raw_summary) out.rawSummary = r.raw_summary
  if (r.source) out.source = r.source
  const baseCv = (process.env.MINIO_PUBLIC_URL || 'http://localhost:9000').replace(/\/$/, '')
  const cvPath = r.cv_path || `/cvs/${r.candidate_id}`
  const cvUrl = `${baseCv}/${String(cvPath).replace(/^\//, '')}`
  out.uploadUrl = cvPath
  out.cvUrl = cvUrl
  return out
}

/** Récupérer une candidature par id (DB ou JSON) */
async function getCandidatureById(id) {
  const numId = typeof id === 'string' ? parseInt(id, 10) : id
  if (!Number.isInteger(numId) || numId < 1) return null
  if (useDb) {
    const res = await query(`${CANDIDATURES_SELECT} WHERE id = $1`, [numId])
    if (!res.rows.length) return null
    return mapCandidatureRow(res.rows[0])
  }
  const c = candidatures.find((x) => x.id === numId)
  return c || null
}

/** Mettre à jour une candidature en DB (analyse OpenAI) */
async function updateCandidatureAnalysisInDb(id, analysis) {
  const numId = typeof id === 'string' ? parseInt(id, 10) : id
  if (!Number.isInteger(numId) || numId < 1) return
  const decisionDb = decisionForDb('À REVOIR')
  const schoolType = analysis.school_type === 'PUBLIC' || analysis.school_type === 'PRIVE' ? analysis.school_type : null
  await query(
    `UPDATE candidatures
       SET raw_summary = $1, skills = $2, experience = $3, score = $4, decision = $5,
           school = $6, school_type = $7, phone = $8, experience_count = $9, experience_duration = $10, experience_years_avg = $11, last_employer = $12,
           updated_at = NOW()
     WHERE id = $13`,
    [
      analysis.summary || null,
      analysis.skills || null,
      analysis.experience || null,
      analysis.score ?? null,
      decisionDb,
      analysis.school || null,
      schoolType,
      analysis.phone || null,
      analysis.experience_count ?? null,
      analysis.experience_duration || null,
      analysis.experience_years_avg ?? null,
      analysis.last_employer || null,
      numId,
    ]
  )
}

/** Récupérer le texte du CV depuis MinIO (PDF) ou depuis le body */
async function fetchCVTextFromMinIO(cvPath) {
  const base = (process.env.MINIO_PUBLIC_URL || 'http://localhost:9000').replace(/\/$/, '')
  const pathClean = (cvPath || '').trim().replace(/^\//, '')
  const url = `${base}/${pathClean}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`MinIO fetch failed: ${res.status} ${url}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  if (!pdfParse) throw new Error('pdf-parse not installed: npm install pdf-parse')
  const { text } = await pdfParse(buffer)
  return (text || '').trim()
}

// ——— Swagger UI ———
app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'API Candidatures PCA' }))

// ——— Auth: Signup ———
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body || {}
    const user = await createUser({ email, password, name })
    ensureUserInKeycloak({ email: user.email, name: user.name })
      .then((ok) => { if (ok) console.log('[auth] User provisioned to Keycloak:', user.email) })
      .catch((err) => console.error('[auth] Keycloak provision failed:', err.message))
    const token = signToken({ id: user.id, email: user.email })
    res.status(201).json({ token, user: { email: user.email, name: user.name } })
  } catch (e) {
    res.status(400).json({ error: e.message || 'Signup failed' })
  }
})

// ——— Auth: Login ———
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' })
    }
    const user = await verifyUser(email, password)
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }
    ensureUserInKeycloak({ email: user.email, name: user.name })
      .then((ok) => { if (ok) console.log('[auth] User provisioned to Keycloak:', user.email) })
      .catch((err) => console.error('[auth] Keycloak provision failed:', err.message))
    const token = signToken({ id: user.id, email: user.email })
    res.json({ token, user: { email: user.email, name: user.name } })
  } catch (e) {
    res.status(500).json({ error: e.message || 'Login failed' })
  }
})

// ——— Racourcis : si on ouvre le backend (3005) au lieu du front (3003), rediriger
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3003'
app.get('/', (req, res) => res.redirect(frontendUrl))
app.get('/login', (req, res) => res.redirect(frontendUrl + '/login'))

// ——— OAuth: Google ———
app.get('/api/auth/google', googleAuth)
app.get('/api/auth/google/callback', googleCallback)

// ——— OAuth: GitHub ———
app.get('/api/auth/github', githubAuth)
app.get('/api/auth/github/callback', githubCallback)

// ——— GET /api/auth/keycloak-config — Config pour le front (pas de secret)
app.get('/api/auth/keycloak-config', (req, res) => {
  res.json(getKeycloakPublicConfig())
})

// ——— GET /api/auth/me — Qui est connecté (JWT requis, login ou OAuth ou Keycloak)
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const dbUser = await findUserById(req.user.id)
  const user = dbUser || { id: req.user.id, email: req.user.email || '', name: req.user.name || (req.user.email ? req.user.email.split('@')[0] : '') }
  const payload = { id: user.id, email: user.email, name: user.name }
  if (Array.isArray(req.user.roles)) payload.roles = req.user.roles
  res.json({ user: payload })
})

// ——— GET /api/campaigns — Campagnes Adzuna (temps réel)
app.get('/api/campaigns', async (req, res) => {
  try {
    const campaigns = await getAdzunaCampaigns()
    res.json({ campaigns })
  } catch (e) {
    console.error('[campaigns]', e.message)
    res.status(500).json({ error: 'Failed to load campaigns', message: e.message })
  }
})

// ——— GET /api/campaigns/:id — Détail campagne (Adzuna)
app.get('/api/campaigns/:id', async (req, res) => {
  try {
    const campaigns = await getAdzunaCampaigns()
    const campaign = campaigns.find((c) => String(c.id) === String(req.params.id))
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
    res.json({ campaign })
  } catch (e) {
    console.error('[campaigns/:id]', e.message)
    res.status(500).json({ error: 'Failed to load campaign', message: e.message })
  }
})

// ——— GET /api/campaigns/:id/offers — Offres Adzuna pour une campagne
app.get('/api/campaigns/:id/offers', async (req, res) => {
  try {
    const offers = await getAdzunaOffers(req.params.id)
    res.json({ offers })
  } catch (e) {
    console.error('[campaigns/:id/offers]', e.message)
    res.status(500).json({ error: 'Failed to load offers', message: e.message })
  }
})

// ——— GET /api/candidatures (public — utilisé par le dashboard même sans login) ———
app.get('/api/candidatures', async (req, res) => {
  const list = useDb ? await getCandidaturesFromDb() : candidatures
  res.json({ candidatures: list })
})

// ——— GET /api/test/candidatures — Liste (sans auth, debug/Swagger) ———
app.get('/api/test/candidatures', async (req, res) => {
  const list = useDb ? await getCandidaturesFromDb() : candidatures
  res.json({ candidatures: list })
})

// ——— POST /api/candidatures ———
/** Extrait une adresse email propre (évite duplication "Name <email> email"). */
function getEmailString (val) {
  if (!val) return ''
  if (typeof val === 'string') {
    const s = val.trim()
    const match = s.match(/<([^>]+)>/)
    if (match) return match[1].trim()
    if (/@/.test(s)) return s
    return s
  }
  if (val.value && Array.isArray(val.value) && val.value[0] && val.value[0].address) return val.value[0].address
  return ''
}

/** Retourne true si l'email ressemble à une alerte/notification (pas une candidature CV) — à rejeter. */
function looksLikeNonCandidatureEmail(subject, bodySnippet) {
  const raw = `${(subject || '')} ${(bodySnippet || '')}`.toLowerCase()
  const blocklist = [
    'security alert', 'alerte de sécurité', 'critical security alert',
    'notification', 'notifications', 'alert -', 'alert:', 'imad\'s org',
    'youtube', 'finish setting up', 'set up your', 'mongodb atlas', 'ollama',
    'dar khabar', 'is live now', 'black diamond', 'open for tours',
    'automatically paused', 'your iphone with google', 'nvidia hardware',
    /^alert\s*[-:]/, /security\s+alert/i,
  ]
  for (const term of blocklist) {
    if (typeof term === 'string' && raw.includes(term)) return true
    if (term instanceof RegExp && term.test(raw)) return true
  }
  return false
}

app.post('/api/candidatures', async (req, res) => {
  const body = req.body || {}
  const subject = (body.subject || '').trim() || 'Sans objet'
  const bodySnippet = typeof body.text === 'string' ? body.text.slice(0, 500) : (body.snippet || '')
  if (looksLikeNonCandidatureEmail(subject, bodySnippet)) {
    console.warn('[candidatures] Rejected non-candidature email:', subject.slice(0, 80))
    return res.status(400).json({
      error: 'Not a candidature',
      message: 'Cet email ne ressemble pas à une candidature (CV). Alertes, notifications et emails non liés aux candidatures sont ignorés.',
      rejectedSubject: subject.slice(0, 120),
    })
  }

  const email = getEmailString(body.email) || getEmailString(body.from) || 'inconnu@email.com'
  const date = (body.date || new Date().toISOString()).trim()
  let decision = (body.decision || '').trim().toUpperCase()
  if (!['ACCEPTÉE', 'REFUSÉE', 'À REVOIR', 'NON_LISIBLE'].includes(decision)) {
    if (decision.includes('ACCEPTEE') || decision === 'ACCEPTED') decision = 'ACCEPTÉE'
    else if (decision.includes('REFUSEE') || decision === 'REFUSED') decision = 'REFUSÉE'
    else if (decision.includes('REVOIR') || decision === 'REVIEW') decision = 'À REVOIR'
    else if (decision.includes('NON_LISIBLE') || decision.includes('NON LISIBLE')) decision = 'NON_LISIBLE'
    else decision = 'À REVOIR'
  }
  const score = body.score != null ? Number(body.score) : undefined
  const candidateName = (body.candidateName || body.candidat || '').trim() || 'Candidat'
  const skills = (body.skills || body.competences || '').trim() || undefined
  const experience = (body.experience || '').trim() || undefined
  const rawSummary = (body.rawSummary || body.synthese || body.text || '').trim() || undefined
  const candidateId = body.candidateId || crypto.randomUUID()

  if (useDb) {
    try {
      const item = await insertCandidatureIntoDb({
        candidateId,
        candidateName,
        email,
        subject,
        date,
        decision,
        score,
        skills,
        experience,
        rawSummary,
        source: body.source || null,
      })
      return res.status(201).json(item)
    } catch (e) {
      console.error('[candidatures] insert:', e.message, e.code, e.detail || '')
      return res.status(500).json({ error: 'Database error', message: e.message })
    }
  }

  const maxId = candidatures.length === 0 ? 0 : Math.max(0, ...candidatures.map((c) => (typeof c.id === 'number' ? c.id : 0)))
  const id = typeof body.id === 'number' ? body.id : maxId + 1
  const item = {
    id,
    candidateId,
    candidateName,
    email,
    subject,
    date,
    decision,
    ...(score != null && !Number.isNaN(score) && { score }),
    ...(skills && { skills }),
    ...(experience && { experience }),
    ...(rawSummary && { rawSummary }),
  }
  candidatures.unshift(item)
  saveData()
  const uploadUrl = body.uploadUrl || `/cvs/${candidateId}`
  res.status(201).json({ ...item, uploadUrl })
})

// ——— PATCH /api/candidatures/:id — Mise à jour décision / score (action RH) ———
app.patch('/api/candidatures/:id', async (req, res) => {
  const id = req.params.id
  const numId = parseInt(id, 10)
  if (!Number.isInteger(numId) || numId < 1) {
    return res.status(400).json({ error: 'Invalid id' })
  }

  const body = req.body || {}
  const fields = []
  const values = []

  if (body.decision) {
    fields.push('decision')
    values.push(decisionForDb(body.decision))
  }
  if (body.score != null) {
    fields.push('score')
    values.push(Number(body.score))
  }

  if (!fields.length) {
    return res.status(400).json({ error: 'No updatable fields provided' })
  }

  fields.push('updated_at')
  values.push(new Date().toISOString())

  const setSql = fields.map((f, i) => `${f} = $${i + 1}`).join(', ')

  try {
    const result = await query(
      `UPDATE candidatures SET ${setSql} WHERE id = $${fields.length + 1} RETURNING id, candidate_id, candidate_name, email, subject, date, decision, score, skills, experience, raw_summary, source, cv_path, school, school_type, phone, experience_count, experience_duration, experience_years_avg, last_employer`,
      [...values, numId]
    )
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Candidature not found' })
    }
    const out = mapCandidatureRow(result.rows[0])

    // Notifier n8n (si configuré) pour envoyer un email au candidat
    // Ici on ne déclenche le webhook QUE quand la décision finale est ACCEPTÉE.
    const webhookUrl = process.env.N8N_DECISION_WEBHOOK_URL && process.env.N8N_DECISION_WEBHOOK_URL.trim()
    if (webhookUrl && out.decision === 'ACCEPTÉE') {
      const payload = {
        candidatureId: out.id,
        candidateId: out.candidateId,
        email: out.email,
        candidateName: out.candidateName,
        subject: out.subject,
        decision: out.decision,
      }
      // Fire-and-forget : n'affecte pas la réponse API principale
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch((e) => {
        console.warn('[n8n webhook] decision notification failed:', e.message)
      })
    }

    return res.json(out)
  } catch (e) {
    console.error('[candidatures] patch:', e.message, e.code, e.detail || '')
    return res.status(500).json({ error: 'Database error', message: e.message })
  }
})

// ——— POST /api/test/candidatures ——— Mock API for n8n workflow testing (no auth)
app.post('/api/test/candidatures', async (req, res) => {
  const body = req.body || {}
  const subject = (body.subject || '').trim() || ''
  const bodySnippet = typeof body.text === 'string' ? body.text.slice(0, 500) : (body.snippet || '')
  if (looksLikeNonCandidatureEmail(subject, bodySnippet)) {
    console.warn('[test/candidatures] Rejected non-candidature email:', subject.slice(0, 80))
    return res.status(400).json({
      error: 'Not a candidature',
      message: 'Cet email ne ressemble pas à une candidature (CV). Ignoré.',
      rejectedSubject: subject.slice(0, 120),
    })
  }
  const email = (body.email && body.email.trim()) || (body.from && String(body.from).trim()) || 'test@example.com'
  const fullName = (body.fullName || body.candidateName || body.candidat || '').trim() || 'Test Candidate'
  const source = (body.source || '').trim() || 'email'
  const candidateId = crypto.randomUUID()

  if (useDb) {
    try {
      const item = await insertCandidatureIntoDb({
        candidateId,
        candidateName: fullName,
        email,
        subject: body.subject || 'Test CV',
        date: new Date().toISOString(),
        decision: 'À REVOIR',
        source,
      })
      console.log('[test/candidatures] Mock candidate created (DB):', { id: item.id, candidateId, email, fullName })
      return res.status(201).json({ ...item, _mock: true })
    } catch (e) {
      console.error('[test/candidatures] insert:', e.message, e.code, e.detail || '')
      return res.status(500).json({ error: 'Database error', message: e.message })
    }
  }

  testIdCounter += 1
  const id = testIdCounter
  const uploadUrl = body.uploadUrl || `/cvs/${candidateId}`
  const mockItem = {
    id,
    candidateId,
    candidateName: fullName,
    email,
    subject: body.subject || 'Test CV',
    date: new Date().toISOString(),
    decision: 'À REVOIR',
    source,
    _mock: true,
    uploadUrl,
  }
  console.log('[test/candidatures] Mock candidate created:', { id, candidateId, email, fullName })
  res.status(201).json({ ...mockItem, uploadUrl })
})

// ——— POST /api/test/analyze ——— Crée une candidature test + lance l’analyse CV (body.text) en un seul appel
app.post('/api/test/analyze', async (req, res) => {
  const body = req.body || {}
  const cvText = (body.text || '').trim()
  if (!cvText || cvText.length < 50) {
    return res.status(400).json({
      error: 'Body "text" required',
      hint: 'Send { "text": "Contenu du CV ici... (min 50 caractères)" }',
    })
  }
  const openaiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()
  if (!openaiKey) {
    return res.status(503).json({ error: 'OPENAI_API_KEY not set' })
  }
  try {
    // 1) Créer candidature test (comme POST /api/test/candidatures)
    const email = (body.email || body.from || '').trim() || 'test-analyze@example.com'
    const fullName = (body.fullName || body.candidateName || '').trim() || 'Candidat Test Analyse'
    const subject = (body.subject || '').trim() || 'Test analyse CV'
    const source = (body.source || '').trim() || 'test'
    const candidateId = crypto.randomUUID()

    let candidature
    if (useDb) {
      candidature = await insertCandidatureIntoDb({
        candidateId,
        candidateName: fullName,
        email,
        subject,
        date: new Date().toISOString(),
        decision: 'À REVOIR',
        source,
      })
    } else {
      testIdCounter += 1
      candidature = {
        id: testIdCounter,
        candidateId,
        candidateName: fullName,
        email,
        subject,
        date: new Date().toISOString(),
        decision: 'À REVOIR',
        source,
        _mock: true,
      }
      candidatures.unshift(candidature)
      saveData()
    }

    // 2) Analyser avec OpenAI (optionnel : contexte offre pour score/décision basés sur l'offre)
    const offerContext = (body.offerContext || '').trim() ||
      [body.offerTitle, body.offerDescription].filter(Boolean).map(String).join('. ')
    const analysis = await analyzeCVWithOpenAI(cvText, { offerContext: offerContext || undefined })

    if (useDb) {
      await updateCandidatureAnalysisInDb(candidature.id, analysis)
    } else {
      const c = candidatures.find((x) => x.id === candidature.id)
      if (c) {
        c.rawSummary = analysis.summary
        c.skills = analysis.skills
        c.experience = analysis.experience
        c.score = analysis.score
        c.decision = decisionForApi(analysis.decision)
        saveData()
      }
    }

    console.log('[test/analyze] Candidature', candidature.id, '→', analysis.decision, 'score', analysis.score)
    return res.status(201).json({
      candidature: {
        id: candidature.id,
        candidateId: candidature.candidateId,
        candidateName: candidature.candidateName,
        email: candidature.email,
        subject: candidature.subject,
      },
      analysis: {
        summary: analysis.summary,
        skills: analysis.skills,
        experience: analysis.experience,
        strengths: analysis.strengths,
        risks: analysis.risks,
        score: analysis.score,
        decision: decisionForApi(analysis.decision),
      },
    })
  } catch (e) {
    console.error('[test/analyze]', e.message)
    return res.status(500).json({ error: 'Analysis failed', message: e.message })
  }
})

// Handler partagé pour l’analyse CV (utilisé par /api/candidatures/:id/analyze et /api/test/candidatures/:id/analyze)
async function handleAnalyzeCandidature(req, res) {
  try {
    const id = req.params.id
    const candidature = await getCandidatureById(id)
    if (!candidature) {
      return res.status(404).json({ error: 'Candidature not found', id })
    }

    let cvText = (req.body && req.body.text) ? String(req.body.text).trim() : ''
    if (!cvText) {
      const cvPath = candidature.cv_path || (candidature.uploadUrl || `/cvs/${candidature.candidateId}`)
      try {
        cvText = await fetchCVTextFromMinIO(cvPath)
      } catch (e) {
        console.error('[analyze] MinIO/PDF error:', e.message)
        return res.status(400).json({
          error: 'Could not get CV text',
          message: e.message,
          hint: 'Send body { "text": "..." } with extracted CV text, or ensure CV is in MinIO and pdf-parse is installed.',
        })
      }
    }
    if (!cvText || cvText.length < 50) {
      return res.status(400).json({ error: 'CV text too short or missing', hint: 'Send body.text or ensure PDF is in MinIO.' })
    }

    const openaiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()
    if (!openaiKey) {
      return res.status(503).json({ error: 'OPENAI_API_KEY not set' })
    }

    const offerTitle = (req.body?.offerTitle || '').toString().trim() || null
    const offerDescription = (req.body?.offerDescription || '').toString().trim() || null
    const offerContext = (req.body?.offerContext || '').trim() ||
      [offerTitle, offerDescription].filter(Boolean).map(String).join('. ')
    const analysis = await analyzeCVWithOpenAI(cvText, { offerContext: offerContext || undefined })

    if (useDb) {
      await updateCandidatureAnalysisInDb(id, analysis)
      // Sauvegarder aussi "Offre cible" + "Contexte offre" côté RH.
      // - offer_title = titre réel de l'offre associée
      // - offer_description = texte généré "offer_context" (cohérent avec le CV) fallback sur la description brute si absent
      const offerContextForDisplay = (analysis.offer_context || offerDescription || null) && String(analysis.offer_context || offerDescription).trim() ? String(analysis.offer_context || offerDescription).trim() : null
      if (offerTitle || offerContextForDisplay) {
        await query(
          `UPDATE candidatures
             SET offer_title = COALESCE($1, offer_title),
                 offer_description = COALESCE($2, offer_description),
                 updated_at = NOW()
           WHERE id = $3`,
          [offerTitle, offerContextForDisplay, parseInt(id, 10)]
        )
      }
    } else {
      const c = candidatures.find((x) => x.id === parseInt(id, 10))
      if (c) {
        c.rawSummary = analysis.summary
        c.skills = analysis.skills
        c.experience = analysis.experience
        c.score = analysis.score
        c.decision = decisionForApi(analysis.decision)
        c.school = analysis.school || null
        c.schoolType = analysis.school_type || null
        c.phone = analysis.phone || null
        c.experienceCount = analysis.experience_count ?? null
        c.experienceDuration = analysis.experience_duration || null
        c.experienceYearsAvg = analysis.experience_years_avg ?? null
        c.lastEmployer = analysis.last_employer || null
        if (offerTitle) c.offerTitle = offerTitle
        const offerContextForDisplay = (analysis.offer_context || offerDescription || '').toString().trim() || null
        if (offerContextForDisplay) c.offerDescription = offerContextForDisplay
        saveData()
      }
    }

    console.log('[analyze] Candidature', id, '→', analysis.decision, 'score', analysis.score)

    // Retourner la candidature mise à jour (incluant offre cible) pour affichage immédiat côté frontend
    const updated = await getCandidatureById(id)
    return res.json({
      id: parseInt(id, 10),
      candidateId: candidature.candidateId,
      candidature: updated,
      analysis: {
        summary: analysis.summary,
        skills: analysis.skills,
        experience: analysis.experience,
        strengths: analysis.strengths,
        risks: analysis.risks,
        score: analysis.score,
        decision: decisionForApi(analysis.decision),
      },
    })
  } catch (e) {
    console.error('[analyze]', e.message)
    return res.status(500).json({ error: 'Analysis failed', message: e.message })
  }
}

// ——— POST /api/candidatures/:id/analyze ——— Analyse CV (sans auth, pour n8n) + rate limiting OpenAI
app.post('/api/candidatures/:id/analyze', rateLimitOpenAI, handleAnalyzeCandidature)
// Alias pour n8n qui appelle /api/test/candidatures/:id/analyze
app.post('/api/test/candidatures/:id/analyze', rateLimitOpenAI, handleAnalyzeCandidature)

// ——— API Entretiens (interviews) ———
// Modèle attendu en base (table interviews) :
// id (serial), candidature_id (int), scheduled_at (timestamptz), mode (text), location (text), status (text), notes_rh (text)

// POST /api/candidatures/:id/interviews — planifier un nouvel entretien
app.post('/api/candidatures/:id/interviews', async (req, res) => {
  const id = req.params.id
  const numId = parseInt(id, 10)
  if (!Number.isInteger(numId) || numId < 1) {
    return res.status(400).json({ error: 'Invalid candidature id' })
  }

  const body = req.body || {}
  const scheduledAtRaw = body.scheduledAt || body.scheduled_at
  const modeRaw = body.mode
  const locationRaw = body.location

  if (!scheduledAtRaw || !modeRaw || !locationRaw) {
    return res.status(400).json({ error: 'scheduledAt, mode et location sont requis' })
  }

  const scheduledAt = new Date(String(scheduledAtRaw))
  if (Number.isNaN(scheduledAt.getTime())) {
    return res.status(400).json({ error: 'scheduledAt invalide (date/heure)' })
  }

  const mode = String(modeRaw).trim().toUpperCase()
  const location = String(locationRaw).trim()
  const allowedModes = ['PRESENTIEL', 'VISIO', 'TELEPHONE']
  if (!allowedModes.includes(mode)) {
    return res.status(400).json({ error: `mode invalide. Valeurs possibles: ${allowedModes.join(', ')}` })
  }

  try {
    let row
    if (useDb) {
      const result = await query(
        `INSERT INTO interviews (candidature_id, scheduled_at, mode, location, status)
         VALUES ($1, $2::timestamptz, $3, $4, 'PLANIFIE')
         RETURNING id, candidature_id, scheduled_at, mode, location, status, notes_rh`,
        [numId, scheduledAt.toISOString(), mode, location]
      )
      if (!result.rows.length) {
        return res.status(500).json({ error: 'Insert interview failed' })
      }
      row = result.rows[0]
    } else {
      // Fallback JSON (dev sans DB)
      const maxId = interviews.length === 0 ? 0 : Math.max(0, ...interviews.map((i) => (typeof i.id === 'number' ? i.id : 0)))
      row = {
        id: maxId + 1,
        candidature_id: numId,
        scheduled_at: scheduledAt.toISOString(),
        mode,
        location,
        status: 'PLANIFIE',
        notes_rh: null,
      }
      interviews.push(row)
    }

    const out = {
      id: row.id,
      candidatureId: row.candidature_id,
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : scheduledAt.toISOString(),
      mode: row.mode,
      location: row.location,
      status: row.status,
      notesRh: row.notes_rh,
    }

    // Notifier n8n pour envoyer l'invitation à l'entretien (optionnel)
    const webhookUrl =
      process.env.N8N_INTERVIEW_WEBHOOK_URL && process.env.N8N_INTERVIEW_WEBHOOK_URL.trim()
    if (webhookUrl) {
      const relatedCandidature = await getCandidatureById(numId)
      const payload = {
        interviewId: out.id,
        candidatureId: out.candidatureId,
        scheduledAt: out.scheduledAt,
        mode: out.mode,
        location: out.location,
        status: out.status,
        candidateName: relatedCandidature?.candidateName || null,
        email: relatedCandidature?.email || null,
        subject: relatedCandidature?.subject || null,
      }
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch((e) => {
        console.warn('[n8n webhook] interview notification failed:', e.message)
      })
    }

    return res.status(201).json(out)
  } catch (e) {
    console.error('[interviews] post:', e.message, e.code, e.detail || '')
    return res.status(500).json({ error: 'Database error', message: e.message })
  }
})

// GET /api/interviews — liste de tous les entretiens (optionnel ?status=PLANIFIE) avec infos candidature
app.get('/api/interviews', async (req, res) => {
  const statusFilter = (req.query.status || '').toString().trim().toUpperCase()
  try {
    let rows = []
    if (useDb) {
      const sql = statusFilter && ['PLANIFIE', 'REALISE', 'ANNULE'].includes(statusFilter)
        ? `SELECT i.id, i.candidature_id, i.scheduled_at, i.mode, i.location, i.status, i.notes_rh,
            c.candidate_name, c.email, c.subject
           FROM interviews i
           JOIN candidatures c ON c.id = i.candidature_id
           WHERE i.status = $1
           ORDER BY i.scheduled_at ASC, i.id ASC`
        : `SELECT i.id, i.candidature_id, i.scheduled_at, i.mode, i.location, i.status, i.notes_rh,
            c.candidate_name, c.email, c.subject
           FROM interviews i
           JOIN candidatures c ON c.id = i.candidature_id
           ORDER BY i.scheduled_at DESC, i.id DESC`
      const result = statusFilter && ['PLANIFIE', 'REALISE', 'ANNULE'].includes(statusFilter)
        ? await query(sql, [statusFilter])
        : await query(sql)
      rows = result.rows
    } else {
      rows = interviews
        .map((i) => {
          const c = candidatures.find((x) => x.id === i.candidature_id)
          return {
            ...i,
            candidate_name: c ? c.candidateName : null,
            email: c ? c.email : null,
            subject: c ? c.subject : null,
          }
        })
        .filter((i) => !statusFilter || i.status === statusFilter)
        .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at))
    }
    const list = rows.map((row) => ({
      id: row.id,
      candidatureId: row.candidature_id,
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : null,
      mode: row.mode,
      location: row.location,
      status: row.status,
      notesRh: row.notes_rh,
      candidateName: row.candidate_name || null,
      email: row.email || null,
      subject: row.subject || null,
    }))
    return res.json({ interviews: list })
  } catch (e) {
    console.error('[interviews] list all:', e.message, e.code, e.detail || '')
    return res.status(500).json({ error: 'Database error', message: e.message })
  }
})

// GET /api/candidatures/:id/interviews — liste des entretiens pour une candidature
app.get('/api/candidatures/:id/interviews', async (req, res) => {
  const id = req.params.id
  const numId = parseInt(id, 10)
  if (!Number.isInteger(numId) || numId < 1) {
    return res.status(400).json({ error: 'Invalid candidature id' })
  }

  try {
    let rows = []
    if (useDb) {
      const result = await query(
        `SELECT id, candidature_id, scheduled_at, mode, location, status, notes_rh
         FROM interviews
         WHERE candidature_id = $1
         ORDER BY scheduled_at DESC, id DESC`,
        [numId]
      )
      rows = result.rows
    } else {
      rows = interviews
        .filter((i) => Number(i.candidature_id) === numId)
        .sort((a, b) => String(b.scheduled_at).localeCompare(String(a.scheduled_at)))
    }

    const list = rows.map((row) => ({
      id: row.id,
      candidatureId: row.candidature_id,
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : null,
      mode: row.mode,
      location: row.location,
      status: row.status,
      notesRh: row.notes_rh,
    }))

    return res.json({ interviews: list })
  } catch (e) {
    console.error('[interviews] list:', e.message, e.code, e.detail || '')
    return res.status(500).json({ error: 'Database error', message: e.message })
  }
})

// PATCH /api/interviews/:id — mise à jour status + notes_rh
app.patch('/api/interviews/:id', async (req, res) => {
  const id = req.params.id
  const numId = parseInt(id, 10)
  if (!Number.isInteger(numId) || numId < 1) {
    return res.status(400).json({ error: 'Invalid interview id' })
  }

  const body = req.body || {}
  const fields = []
  const values = []

  if (body.status) {
    const status = String(body.status).trim().toUpperCase()
    const allowedStatuses = ['PLANIFIE', 'REALISE', 'ANNULE']
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: `status invalide. Valeurs possibles: ${allowedStatuses.join(', ')}` })
    }
    fields.push('status')
    values.push(status)
  }

  if (typeof body.notes_rh === 'string' || typeof body.notesRh === 'string') {
    const notes = String(body.notes_rh || body.notesRh).trim()
    fields.push('notes_rh')
    values.push(notes || null)
  }

  if (!fields.length) {
    return res.status(400).json({ error: 'Aucun champ à mettre à jour (status, notes_rh)' })
  }

  try {
    let row
    if (useDb) {
      const setSql = fields.map((f, i) => `${f} = $${i + 1}`).join(', ')
      const result = await query(
        `UPDATE interviews
         SET ${setSql}
         WHERE id = $${fields.length + 1}
         RETURNING id, candidature_id, scheduled_at, mode, location, status, notes_rh`,
        [...values, numId]
      )
      if (!result.rows.length) {
        return res.status(404).json({ error: 'Interview not found' })
      }
      row = result.rows[0]
    } else {
      const idx = interviews.findIndex((i) => Number(i.id) === numId)
      if (idx === -1) {
        return res.status(404).json({ error: 'Interview not found' })
      }
      const current = interviews[idx]
      const updated = { ...current }
      if (fields.includes('status')) {
        updated.status = values[fields.indexOf('status')]
      }
      if (fields.includes('notes_rh')) {
        updated.notes_rh = values[fields.indexOf('notes_rh')]
      }
      interviews[idx] = updated
      row = updated
    }

    const out = {
      id: row.id,
      candidatureId: row.candidature_id,
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : null,
      mode: row.mode,
      location: row.location,
      status: row.status,
      notesRh: row.notes_rh,
    }

    return res.json(out)
  } catch (e) {
    console.error('[interviews] patch:', e.message, e.code, e.detail || '')
    return res.status(500).json({ error: 'Database error', message: e.message })
  }
})

/** Liste des entretiens (pour l'assistant RAG). */
async function getInterviewsList() {
  try {
    if (useDb) {
      const result = await query(
        `SELECT i.id, i.candidature_id, i.scheduled_at, i.mode, i.location, i.status, i.notes_rh,
                c.candidate_name, c.email, c.subject
         FROM interviews i
         JOIN candidatures c ON c.id = i.candidature_id
         ORDER BY i.scheduled_at DESC NULLS LAST, i.id DESC`
      )
      return (result.rows || []).map((row) => ({
        id: row.id,
        candidatureId: row.candidature_id,
        scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : null,
        mode: row.mode,
        location: row.location,
        status: row.status,
        notesRh: row.notes_rh,
        candidateName: row.candidate_name,
        email: row.email,
        subject: row.subject,
      }))
    }
    return interviews
      .map((i) => {
        const c = candidatures.find((x) => String(x.id) === String(i.candidature_id))
        return {
          id: i.id,
          candidatureId: i.candidature_id,
          scheduledAt: i.scheduled_at,
          mode: i.mode,
          location: i.location,
          status: i.status,
          notesRh: i.notes_rh,
          candidateName: c ? c.candidateName : null,
          email: c ? c.email : null,
          subject: c ? c.subject : null,
        }
      })
      .sort((a, b) => new Date(b.scheduledAt || 0) - new Date(a.scheduledAt || 0))
  } catch (e) {
    return []
  }
}

// ——— POST /api/rag/chat ——— Assistant PCA (plateforme + questions générales)
// - Si la question concerne PCA / dashboard / candidatures / campagnes / entretiens : RAG + OpenAI avec contexte réel.
// - Sinon (question générale) : OpenAI direct (sans contexte PCA).
app.post('/api/rag/chat', optionalAuthMiddleware, rateLimitOpenAI, async (req, res) => {
  try {
    const message = (req.body && req.body.message) ? String(req.body.message).trim() : ''
    if (!message) {
      return res.json({ answer: 'Posez une question sur la plateforme PCA, le dashboard ou tout autre sujet.', language: 'fr' })
    }

    const lower = message.toLowerCase()
    // Considérer davantage de variantes (anglais + fautes) comme des questions PCA
    const isPcaQuestion = /\bpca\b|dashboard|tableau de bord|candidature|candidatures|campagnes?|offres?\b|offers?\b|entretiens?|interviews?|cv|n8n|minio|plateforme|plateform|platform|api\/candidatures|api\/campaigns|api\/interviews/.test(lower)

    const openaiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()

    // 1) Question générale hors PCA → modèle OpenAI "ouvert" (chatGeneralOpenAI)
    if (!isPcaQuestion) {
      if (!openaiKey) {
        return res.json({
          answer: 'Je peux surtout vous aider pour la plateforme PCA. Pour les questions générales (comme sur une banque, une technologie ou un concept), OPENAI_API_KEY doit être configuré côté serveur.',
          language: 'fr',
        })
      }
      try {
        const { answer } = await chatGeneralOpenAI(message, {})
        return res.json({ answer, language: 'fr' })
      } catch (e) {
        return res.status(500).json({ error: 'OpenAI error', message: e.message })
      }
    }

    // 2) Question liée à PCA → RAG + OpenAI contraint par le contexte réel
    const context = { authenticated: true }

    const list = useDb ? await getCandidaturesFromDb() : candidatures
    if (Array.isArray(list)) {
      const accepted = list.filter((c) => (c.decision || '').toUpperCase() === 'ACCEPTÉE' || (c.decision || '').toUpperCase() === 'ACCEPTED').length
      const refused = list.filter((c) => (c.decision || '').toUpperCase() === 'REFUSÉE' || (c.decision || '').toUpperCase() === 'REFUSED').length
      const toReview = list.filter((c) => (c.decision || '').toUpperCase() === 'À REVOIR' || (c.decision || '').includes('REVOIR')).length
      const nonLisible = list.filter((c) => (c.decision || '').toUpperCase() === 'NON_LISIBLE' || (c.decision || '').includes('NON')).length
      const recentItems = list.slice(0, 15).map((c) => ({
        id: c.id,
        candidateId: c.candidateId,
        candidateName: c.candidateName,
        email: c.email,
        subject: c.subject,
        date: c.date,
        decision: c.decision,
        school: c.school,
        schoolType: c.schoolType,
        phone: c.phone,
        lastEmployer: c.lastEmployer,
        experienceCount: c.experienceCount,
        experienceDuration: c.experienceDuration,
        score: c.score,
      }))
      context.total = list.length
      context.accepted = accepted
      context.refused = refused
      context.toReview = toReview
      context.nonLisible = nonLisible
      context.items = recentItems
    }

    try {
      const campaigns = await getAdzunaCampaigns()
      context.campaigns = campaigns || []
      const allOffers = []
      if (campaigns && campaigns.length > 0) {
        for (const camp of campaigns) {
          const offers = await getAdzunaOffers(camp.id)
          for (const o of offers || []) {
            allOffers.push({ ...o, campaignName: camp.name, campaignCode: camp.code })
          }
        }
      }
      context.offers = allOffers
    } catch (e) {
      context.campaigns = []
      context.offers = []
    }

    try {
      context.interviews = await getInterviewsList()
    } catch (e) {
      context.interviews = []
    }

    const { answer: ragAnswer, language } = getRagAnswer(message, context)

    if (openaiKey) {
      try {
        const { answer } = await chatWithOpenAI(message, ragAnswer)
        return res.json({ answer, language })
      } catch (e) {
        console.warn('OpenAI fallback to RAG:', e.message)
        return res.json({ answer: ragAnswer, language })
      }
    }

    res.json({ answer: ragAnswer, language })
  } catch (e) {
    res.status(500).json({ error: 'RAG error', message: e.message })
  }
})

// ——— POST /api/rag/chat-with-cv ——— Assistant avec CV PDF uploadé (analyse ponctuelle de CV) ———
app.post('/api/rag/chat-with-cv', optionalAuthMiddleware, rateLimitOpenAI, async (req, res) => {
  try {
    const body = req.body || {}
    const message = (body.message || '').toString().trim()
    const fileBase64 = (body.fileBase64 || '').toString().trim()
    const fileName = (body.fileName || '').toString().trim() || 'CV.pdf'
    if (!fileBase64) {
      return res.status(400).json({ error: 'fileBase64 required', message: 'Aucun CV fourni.' })
    }
    const openaiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()
    if (!openaiKey) {
      return res.status(503).json({ error: 'OPENAI_API_KEY not set' })
    }
    if (!pdfParse) {
      return res.status(503).json({ error: 'pdf-parse not installed' })
    }
    const buffer = Buffer.from(fileBase64, 'base64')
    const { text } = await pdfParse(buffer)
    const cvText = (text || '').trim()
    if (!cvText) {
      return res.status(400).json({ error: 'Empty CV text', message: 'Impossible de lire le contenu du CV.' })
    }
    const question =
      message ||
      `Fais un résumé professionnel, les principales compétences (stacks IT), et les points forts/faibles de ce CV pour un RH. Détaille aussi les expériences principales.`
    const prompt = `CV du candidat (${fileName}) :\n\n${cvText.slice(
      0,
      12000,
    )}\n\nQuestion RH : ${question}\n\nRéponds en français (ou dans la langue de la question) de façon structurée pour un recruteur.`
    const { answer } = await chatGeneralOpenAI(prompt, {})
    return res.json({ answer, language: 'fr' })
  } catch (e) {
    return res.status(500).json({ error: 'RAG CV error', message: e.message })
  }
})

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

const PORT = process.env.PORT || 3005
app.listen(PORT, () => {
  console.log(`PCA API (Express) running at http://localhost:${PORT}`)
  const apiOrigin = process.env.API_ORIGIN ? process.env.API_ORIGIN.replace(/\/$/, '') : `http://localhost:${process.env.PORT || 3005}`
  console.log('Google OAuth:', process.env.GOOGLE_CLIENT_ID ? 'configured' : 'NOT configured')
  if (process.env.GOOGLE_CLIENT_ID) console.log('  → Dans Google Console, URI de redirection EXACT :', apiOrigin + '/api/auth/google/callback')
  const openaiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()
  console.log('AI Assistant: OpenAI', openaiKey ? 'configured (RAG + LLM)' : 'not set (RAG-only)')
  console.log('GET  http://localhost:' + PORT + '/api/campaigns  (Adzuna)')
  console.log('GET  http://localhost:' + PORT + '/api/candidatures')
  console.log('POST http://localhost:' + PORT + '/api/candidatures')
  console.log('POST http://localhost:' + PORT + '/api/test/candidatures  (mock, no auth)')
  console.log('POST http://localhost:' + PORT + '/api/candidatures/:id/analyze  (OpenAI CV analysis, no auth)')
  console.log('POST http://localhost:' + PORT + '/api/test/analyze  (test: create + analyze with body.text)')
  console.log('Swagger UI http://localhost:' + PORT + '/docs')
  if (useDb) console.log('Database: PostgreSQL (DATABASE_URL)')
  else console.log('Database: JSON files (server/data)')
  testKeycloakAdminConnection().catch(() => {})
})
