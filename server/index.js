/**
 * API backend PCA — Express + Swagger.
 * Reçoit les candidatures depuis n8n et les sert au frontend.
 * Démarrer : npm run server ou npm run server:3005 (port défaut 3005, voir .env)
 * Swagger UI : http://localhost:3005/docs
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
import { searchWebResults } from './web-search.js'
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

/** Colonnes complètes candidature (SELECT / INSERT RETURNING / PATCH RETURNING). */
const CANDIDATURE_ROW_COLUMNS =
  'id, candidate_id, candidate_name, email, subject, date, decision, score, skills, experience, raw_summary, source, cv_path, school, school_type, phone, experience_count, experience_duration, experience_years_avg, last_employer, offer_title, offer_description, business_unit'

const CANDIDATURES_SELECT = `SELECT ${CANDIDATURE_ROW_COLUMNS} FROM candidatures`

const PCA_BU_CODES = new Set([
  'PROCESSING_MONETIQUE',
  'SOLUTIONS_DIGITALES',
  'GESTION_CARTES',
  'SECURITE_RISQUES',
  'INTEGRATION_IT',
])

/** null = effacer ; undefined = ne pas modifier ; string = code valide uniquement */
function normalizeBusinessUnitInput(raw) {
  if (raw === undefined) return undefined
  const s = raw == null ? '' : String(raw).trim()
  if (!s) return null
  if (PCA_BU_CODES.has(s)) return s
  return false
}

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
  if (cvPath) item.uploadUrl = cvPath
  if (cvUrl) item.cvUrl = cvUrl
  if (r.offer_title) item.offerTitle = r.offer_title
  if (r.offer_description) item.offerDescription = r.offer_description
  if (r.business_unit) item.businessUnit = r.business_unit
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

function normalizeOfferTitleInput(raw) {
  const s = String(raw || '').trim()
  if (!s) return null
  if (/^(sans objet|no subject|sans offre cible|poste|n\/a|null)$/i.test(s)) return null
  // Ignore candidate/CV filenames that are not real offer titles.
  if (/\bcv\b/i.test(s) || /\.(pdf|doc|docx)$/i.test(s)) return null
  return s
}

function normalizeLooseText(raw) {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sanitizeOfferContextForDisplay({
  analysisOfferContext,
  offerDescription,
  offerTitle,
  emailSubject,
  fallbackSubject,
}) {
  const context = String(analysisOfferContext || offerDescription || '').trim()
  if (!context) return null

  // Remove profile/generic student narrative from "Contexte offre".
  const compact = context
    .replace(/\bprofil\s*:\s*[^.]*\./ig, ' ')
    .replace(/\b(?:etudiant|étudiant)\b[^.]*\./ig, ' ')
    .replace(/\bobjectif\b[^.]*\./ig, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (!compact) return null

  const ctxNorm = normalizeLooseText(compact)
  if (!ctxNorm) return null

  // Reject placeholders and ultra-generic contexts.
  if (/^(sans objet|no subject|n a|null|none|offre|poste|job|candidature)$/.test(ctxNorm)) return null

  const refs = [
    offerTitle,
    emailSubject,
    fallbackSubject,
  ]
    .map((v) => normalizeLooseText(v))
    .filter(Boolean)

  // If context is basically identical to title/subject, hide it to avoid duplicates in UI.
  if (refs.some((r) => r === ctxNorm || r.includes(ctxNorm) || ctxNorm.includes(r))) return null

  return compact.slice(0, 380).trim()
}

/**
 * Règle métier demandée RH:
 * - Une candidature reste "À REVOIR" après analyse auto (OpenAI/n8n).
 * - Seul cas auto autorisé: NON_LISIBLE.
 * - Le passage auto à ACCEPTÉE est géré uniquement après 3/3 entretiens validés.
 */
function decisionFromAutoAnalysis(rawDecision) {
  const d = decisionForDb(rawDecision || 'A REVOIR')
  return d === 'NON_LISIBLE' ? 'NON_LISIBLE' : 'A REVOIR'
}

function toCleanText(v) {
  if (v == null) return ''
  return String(v).replace(/\s+/g, ' ').trim()
}

function parseDurationToMonths(raw) {
  const s = toCleanText(raw).toLowerCase()
  if (!s) return null
  let months = 0
  const years = s.match(/(\d+(?:[.,]\d+)?)\s*(an|ans|year|years)/)
  const mons = s.match(/(\d+(?:[.,]\d+)?)\s*(mois|month|months)/)
  if (years) months += Math.round(parseFloat(years[1].replace(',', '.')) * 12)
  if (mons) months += Math.round(parseFloat(mons[1].replace(',', '.')))
  if (!months) {
    const direct = s.match(/^\d+(?:[.,]\d+)?$/)
    if (direct) months = Math.round(parseFloat(direct[0].replace(',', '.')) * 12)
  }
  return months > 0 ? months : null
}

function monthsToDurationLabel(months) {
  if (!Number.isFinite(months) || months <= 0) return null
  if (months < 12) return `${months} mois`
  const y = Math.floor(months / 12)
  const m = months % 12
  if (!m) return `${y} an${y > 1 ? 's' : ''}`
  return `${y} an${y > 1 ? 's' : ''} ${m} mois`
}

function normalizeAnalysisFields(analysis = {}) {
  const out = { ...analysis }
  const moroccanCitySuffixRe = /\b(casablanca|mohammedia|rabat|sale|sal[eé]|fes|f[eè]s|meknes|m[èe]knes|agadir|marrakech|tanger|tetouan|t[ée]touan|oujda|kenitra|k[eé]nitra|safi|el jadida|nador|beni mellal|b[eé]ni mellal|temara|t[ée]mara|khemisset|khouribga|guelmim|laayoune|laayoun|dakhla)\b$/i
  const moroccanCityRaw = '(casablanca|mohammedia|rabat|sale|sal[eé]|fes|f[eè]s|meknes|m[èe]knes|agadir|marrakech|tanger|tetouan|t[ée]touan|oujda|kenitra|k[eé]nitra|safi|el jadida|nador|beni mellal|b[eé]ni mellal|temara|t[ée]mara|khemisset|khouribga|guelmim|laayoune|laayoun|dakhla)'
  const stripTrailingMoroccanCity = (val) => {
    let z = toCleanText(val)
    if (!z) return z
      z = z
      .replace(/\s*\(\s*([^)]+)\s*\)\s*$/i, (m, g1) => (moroccanCitySuffixRe.test(String(g1 || '').trim()) ? '' : m))
      .replace(new RegExp(`\\s*[,\\-–—|]\\s*${moroccanCityRaw}\\s*$`, 'i'), '')
      .replace(new RegExp(`${moroccanCityRaw}\\s*[,\\-–—|()]*\\s*$`, 'i'), '')
      .replace(/\s{2,}/g, ' ')
      .trim()
    if (moroccanCitySuffixRe.test(z)) {
      z = z.replace(moroccanCitySuffixRe, '').replace(/\s{2,}/g, ' ').trim()
    }
      // Also remove glued city suffixes, e.g. "AppliqueesAgadir" or "IZORAIAgadir".
      z = z
        .replace(new RegExp(`${moroccanCityRaw}\\s*$`, 'i'), '')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s*[-–|,()]+\s*$/g, '')
        .trim()
    return z
  }

  const toReadableText = (val) => {
    if (val == null) return null
    if (Array.isArray(val)) {
      return val
        .map((x) => {
          if (typeof x === 'string') return x.trim()
          if (x && typeof x === 'object') {
            const o = x
            return [o.title, o.role, o.employer, o.company, o.duration, o.description]
              .filter(Boolean)
              .map((v) => String(v).trim())
              .join(' — ')
          }
          return ''
        })
        .filter(Boolean)
        .join(' | ')
    }
    if (typeof val === 'object') {
      return [val.title, val.role, val.employer, val.company, val.duration, val.description]
        .filter(Boolean)
        .map((v) => String(v).trim())
        .join(' — ')
    }
    if (typeof val === 'string') {
      const s = val.trim()
      if (!s) return null
      try {
        const parsed = JSON.parse(s)
        return toReadableText(parsed)
      } catch {
        return s
      }
    }
    return String(val)
  }

  const looksDateOnlyExperience = (txt) => {
    const s = toCleanText(txt).toLowerCase()
    if (!s) return true
    const tokens = s.split(/\s+/).filter(Boolean)
    const meaningful = tokens.filter((w) => !/^(janv|janvier|fev|fevrier|mars|avr|avril|mai|juin|juil|juillet|aout|sept|septembre|oct|octobre|nov|novembre|dec|decembre|present|présent|actuel|actuelle|en|cours|[-/]|20\d{2})$/.test(w))
    return meaningful.length <= 3
  }

  const looksNoisyExperience = (txt) => {
    const s = toCleanText(txt).toLowerCase()
    if (!s) return true
    // If text contains contact/profile markers, it's usually a bad merged block.
    if (/@|linkedin|github|tel\b|tél\b|\+\d{7,}|a la recherche d.?un stage|profil\b|comp[eé]tences?\b|software engineer student|etudiant en\s+\d/.test(s)) return true
    // If there is only one chunk while CV has multiple internships/jobs, force rebuild.
    const chunks = s.split('|').map((x) => x.trim()).filter(Boolean)
    if (chunks.length <= 1 && /(stage|developpeur|developer|ingenieur|engineer)/.test(s) && s.length < 90) return true
    return false
  }

  const stripAccents = (t) =>
    String(t || '')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()

  const looksWeakRepeatedExperience = (txt) => {
    const s = toCleanText(txt).toLowerCase()
    if (!s) return false
    const chunks = s.split('|').map((x) => x.trim()).filter(Boolean)
    if (chunks.length < 2) return false

    const roleOnlyLike = chunks.every((c) => {
      const z = stripAccents(c)
      return (
        /(stagiaire|stage|intern|internship|developpeur|developer|ingenieur|engineer)/.test(z) &&
        !/(python|java|sql|api|scraping|cloud|gestion|analyse|dashboard|projet|integration|automatisation)/.test(z)
      )
    })
    if (!roleOnlyLike) return false

    const simplified = chunks
      .map((c) =>
        c
          .replace(/\b\d+\s*(mois|ans?|years?|month|months)\b/gi, '')
          .replace(/\b(19|20)\d{2}\b/g, '')
          .replace(/\b(janv|janvier|fev|fevrier|mars|avr|avril|mai|juin|juil|juillet|aout|sept|septembre|oct|octobre|nov|novembre|dec|decembre|present|présent|actuel|actuelle)\b/gi, '')
          .replace(/[^\p{L}\p{N}\s]/gu, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      )
      .filter(Boolean)

    if (!simplified.length) return true
    const unique = new Set(simplified)
    return unique.size <= 1
  }

  /** Ex. « Stagiaire … — 3 mois | Stagiaire … — 2 mois » sans employeur ni stack (souvent faute LLM). */
  const looksThinBarExperience = (txt) => {
    const s = toCleanText(txt)
    if (!s) return false
    const chunks = s.split('|').map((x) => x.trim()).filter(Boolean)
    if (chunks.length < 2) return false
    const tech = /(spring|react|docker|kubernetes|gitlab|next|postgres|api|microservice|argocd|node|java|python|llama|rag|bootstrap|hibernate)/i
    if (tech.test(s)) return false
    return chunks.every((c) => {
      const t = c.trim()
      return (
        /(stagiaire|stage|intern|ing[ée]nieur|ingenieur|devops|engineer|developer|développeur|developpeur)/i.test(t) &&
        /\d+\s*(mois|ans)\b/i.test(t) &&
        t.length < 220
      )
    })
  }

  const rebuildExperienceFromCvExcerpt = (cv, fallback) => {
    if (
      !looksDateOnlyExperience(fallback) &&
      !looksNoisyExperience(fallback) &&
      !looksWeakRepeatedExperience(fallback) &&
      !looksThinBarExperience(fallback)
    ) {
      return toCleanText(fallback)
    }
    const lines = String(cv || '').split(/\r?\n/).map((l) => toCleanText(l)).filter(Boolean)
    const lowered = lines.map((l) => stripAccents(l))
    const expHeaderIdx = lowered.findIndex((l) => /^(experience|experience professionnelle|experiences|professional experience)\b/.test(l))
    const startIdx = expHeaderIdx >= 0 ? expHeaderIdx + 1 : 0
    const roleRe = /(stage|stage pfe|stage fin d'etudes|stagiaire|intern|internship|développeur|developpeur|developer|développement|developpement|ingénieur|ingenieur|engineer|analyst|consultant|qa|test)/i
    const stopHeaderRe = /(formation|education|competence|competences|comp[eé]tences|skills|langue|langues|projet|projets|atouts|reseaux|reseau|certification)/i
    const bulletLeadRe = /^[-•–—]\s*/
    const outLines = []
    for (let i = startIdx; i < lines.length; i += 1) {
      const line = lines[i]
      if (i > startIdx && stopHeaderRe.test(line)) break
      if (!roleRe.test(line)) continue

      // Take a small window around this role, so we also capture the description bullets.
      const window = []
      for (let k = i; k < Math.min(lines.length, i + 10); k += 1) {
        const t = lines[k]
        if (k !== i && roleRe.test(t)) break
        if (stopHeaderRe.test(t)) break
        window.push(t)
      }

      const joined = window.join(' ')
      const period = joined.match(
        /((janv|janvier|fev|fevrier|mars|avr|avril|mai|juin|juil|juillet|aout|sept|septembre|oct|octobre|nov|novembre|dec|decembre)\s*20\d{2}\s*[-–]\s*(present|présent|actuel|actuelle|(janv|janvier|fev|fevrier|mars|avr|avril|mai|juin|juil|juillet|aout|sept|septembre|oct|octobre|nov|novembre|dec|decembre)\s*20\d{2})|20\d{2}\s*[-–]\s*(20\d{2}|present|présent|actuel|actuelle))/i,
      )
      const p = period ? toCleanText(period[0]) : ''

      const next = window[1] || ''
      const employer = next && !looksDateOnlyExperience(next) ? next : ''

      const desc = window
        .slice(2)
        .map((t) => t.replace(bulletLeadRe, '').trim())
        .filter(Boolean)
        .filter((t) => t.length >= 10 && t.length <= 220)
        .filter((t) => !looksDateOnlyExperience(t))
        .filter((t) => !/@|linkedin|github|tel\b|\b\+\d{7,}/i.test(t))

      const candidateParts = [line, employer, p, ...desc.slice(0, 4)]
      const candidate = candidateParts.filter(Boolean).join(' — ')

      if (candidate && !looksNoisyExperience(candidate) && !outLines.some((x) => x.toLowerCase() === candidate.toLowerCase())) {
        outLines.push(candidate)
      }
      if (outLines.length >= 3) break
    }
    if (outLines.length) return outLines.join(' | ')
    return toCleanText(fallback)
  }

  const cleanExperienceNarrative = (raw) => {
    let s = toCleanText(raw)
    if (!s) return null
    s = s.replace(/\s*[|/]\s*/g, ' | ').replace(/\s*[-–—]{2,}\s*/g, ' — ')
    // Strip contact/profile spillover that sometimes leaks from OCR blocks.
    s = s.replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi, '')
    s = s.replace(/\b(?:https?:\/\/)?(?:www\.)?(?:linkedin|github)\.[^\s|,]+/gi, '')
    s = s.replace(/\+?\d[\d\s().-]{7,}\d/g, '')
    s = s.replace(/\b(a la recherche d.?un stage[^|]*)/gi, '')
    s = s.replace(/\b(inter[eé]t particulier[^|]*)/gi, '')
    s = s.replace(/\b(profil|competences?|skills?)\b[^|]*/gi, '')
    // Remove repeated date-only chunks often produced by OCR/LLM formatting
    s = s.replace(/(\b(?:janv|janvier|fev|fevrier|mars|avr|avril|mai|juin|juil|juillet|aout|sept|septembre|oct|octobre|nov|novembre|dec|decembre)\s+\d{4}\s*[-–]\s*(?:present|présent|actuel|actuelle|(?:janv|janvier|fev|fevrier|mars|avr|avril|mai|juin|juil|juillet|aout|sept|septembre|oct|octobre|nov|novembre|dec|decembre)\s+\d{4})\b)(?:\s*\|\s*\1)+/gi, '$1')
    s = s.replace(/(\b20\d{2}\s*[-–]\s*(?:20\d{2}|present|présent|actuel|actuelle)\b)(?:\s*\|\s*\1)+/gi, '$1')
    // Keep only chunks that look like real work entries.
    const kept = s
      .split('|')
      .map((x) => toCleanText(x))
      .filter(Boolean)
      .filter((chunk) => /(stage|stagiaire|developpeur|developer|ingenieur|engineer|analyst|consultant|full stack|backend|frontend)/i.test(chunk))
      .filter((chunk) => chunk.length >= 8)
    if (kept.length) s = [...new Set(kept)].join(' | ')
    s = s.replace(/\s{2,}/g, ' ').trim()
    return s
  }

  const pickSchoolName = (raw) => {
    const moroccanCityRe = /\b(casablanca|mohammedia|rabat|sale|sal[eé]|fes|f[eè]s|meknes|m[èe]knes|agadir|marrakech|tanger|tetouan|t[ée]touan|oujda|kenitra|k[eé]nitra|safi|el jadida|nador|beni mellal|b[eé]ni mellal|temara|t[ée]mara|khemisset|khouribga|guelmim|laayoune|laayoun|dakhla)\b/i
    const stripMoroccanCitySuffix = (val) => {
      let z = toCleanText(val)
      if (!z) return z
      // Remove trailing city fragments: ", Casablanca", "- Mohammedia", "(Rabat)", "| Fès"
      z = z
        .replace(new RegExp(`\\s*[,\\-|–|—|\\|]\\s*${moroccanCityRe.source}\\s*$`, 'i'), '')
        .replace(new RegExp(`\\s*\\(\\s*${moroccanCityRe.source}\\s*\\)\\s*$`, 'i'), '')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s*[-–|,()]+\s*$/g, '')
        .trim()
      return z
    }

    const s = toCleanText(raw)
    if (!s) return null
    const direct = s.match(/(\bEMSI\b[^,\n]{0,80}|\bENSIAS\b[^,\n]{0,80}|\bINPT\b[^,\n]{0,80}|\bENSET\b[^,\n]{0,80}|\bEST\b[^,\n]{0,80}|\bFST\b[^,\n]{0,80}|\bESI\b[^,\n]{0,80}|École[^,\n]{0,100}|Ecole[^,\n]{0,100}|Faculté[^,\n]{0,100}|Faculte[^,\n]{0,100}|Université[^,\n]{0,100}|Universite[^,\n]{0,100}|\bISTA\b[^,\n]{0,80}|\bISAG\b[^,\n]{0,80})/i)
    if (direct) {
      const base = toCleanText(direct[0])
      // Supprimer les suffixes de période (ex: "Sept. 2024 - Présent").
      const cleaned = base
        // Keep institution label only; cut program/year tails often merged by OCR.
        .replace(/\b(cycle|fili[eè]re|g[ée]nie|licence|master|bachelor|bac|classe pr[eé]paratoire|cpge)\b.*$/i, '')
        .replace(/\b(janv|janvier|fev|fevrier|mars|avr|avril|mai|juin|juil|juillet|aout|sept|septembre|oct|octobre|nov|novembre|dec|decembre|ete|été|present|présent)\b.*$/i, '')
        .replace(/\b\d{1,2}\s*[\/.-]\s*(19|20)\d{2}\b/g, '')
        .replace(/\b(19|20)\d{2}\s*[\/.-]\s*\d{1,2}\b/g, '')
        .replace(/\b(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}\b/g, '')
        .replace(/\b(19|20)\d{2}\b/g, '')
        .replace(/\s*[-–|,()]+\s*$/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
      return stripTrailingMoroccanCity(stripMoroccanCitySuffix(cleaned)) || null
    }
    // Si aucune signature école claire, on préfère null au lieu d'afficher un texte parasite.
    return null
  }

  const inferSchoolFromCvExcerpt = (cv) => {
    const s = toCleanText(cv)
    if (!s) return null
    const hit = s.match(/(\bEMSI\b[^,\n]{0,90}|\bENSIAS\b[^,\n]{0,90}|\bINPT\b[^,\n]{0,90}|\bENSET\b[^,\n]{0,90}|\bEST\b[^,\n]{0,90}|\bFST\b[^,\n]{0,90}|\bESI\b[^,\n]{0,90}|École[^,\n]{0,120}|Ecole[^,\n]{0,120}|Faculté[^,\n]{0,120}|Faculte[^,\n]{0,120}|Université[^,\n]{0,120}|Universite[^,\n]{0,120}|\bISTA\b[^,\n]{0,90}|\bISAG\b[^,\n]{0,90})/i)
    if (!hit) return null
    return stripTrailingMoroccanCity(toCleanText(hit[0]))
      .replace(/\b(cycle|fili[eè]re|g[ée]nie|licence|master|bachelor|bac|classe pr[eé]paratoire|cpge)\b.*$/i, '')
      .replace(/\b(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}\b/g, '')
      .replace(/\b(19|20)\d{2}\b/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
  }

  const cleanEmployerName = (raw) => {
    const s = toCleanText(raw)
    if (!s) return null
    if (/^(present|présent|actuel|actuelle|actuellement)$/i.test(s)) return null
    // Nettoyer les suffixes date/saison/ville collés à la fin.
    let cleaned = s.replace(/\b(janv|janvier|fev|fevrier|mars|avr|avril|mai|juin|juil|juillet|aout|sept|septembre|oct|octobre|nov|novembre|dec|decembre|ete|été|hiver|printemps|automne|present|présent|20\d{2})\b.*$/i, '').trim()
    cleaned = cleaned
      .replace(new RegExp(`\\s*[,\\-–—|]\\s*${moroccanCityRaw}\\s*$`, 'i'), '')
      .replace(new RegExp(`\\s*\\(\\s*${moroccanCityRaw}\\s*\\)\\s*$`, 'i'), '')
      .replace(new RegExp(`${moroccanCityRaw}\\s*[,\\-–—|()]*\\s*$`, 'i'), '')
      .replace(new RegExp(`${moroccanCityRaw}\\s*$`, 'i'), '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s*[-–|,()]+\s*$/g, '')
      .trim()
    // Cas OCR collé type "SGTMPFA" -> garder la raison sociale principale.
    const glued = cleaned.match(/^([A-Z]{2,10})(PFA|PFE|RABAT|CASABLANCA)$/)
    if (glued) cleaned = glued[1]
    return stripTrailingMoroccanCity(cleaned) || null
  }

  out.skills = toReadableText(out.skills)
  out.experience = toReadableText(out.experience)
  out.experience = rebuildExperienceFromCvExcerpt(out.cv_excerpt, out.experience)
  out.experience = cleanExperienceNarrative(out.experience)
  out.last_employer = stripTrailingMoroccanCity(cleanEmployerName(out.last_employer))

  const rawSchool = pickSchoolName(out.school)
  const lowSchool = rawSchool ? rawSchool.toLowerCase() : ''
  const schoolLooksNoise =
    !rawSchool ||
    rawSchool.length < 3 ||
    /^(ecole|école|school|universite|université|formation|education)$/i.test(rawSchool) ||
    /^(n\/a|na|null|unknown|non renseigne)$/i.test(rawSchool)
  out.school = schoolLooksNoise ? null : stripTrailingMoroccanCity(rawSchool)
  if (!out.school) {
    const schoolFromCv = inferSchoolFromCvExcerpt(out.cv_excerpt)
    out.school = stripTrailingMoroccanCity(schoolFromCv) || null
  }
  if (out.school) {
    out.school = out.school
      .replace(/\b(19|20)\d{2}\b/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s*[-–|,()]+\s*$/g, '')
      .trim() || null
  }

  if (!out.school_type && out.school) {
    if (/(emsi|enset|fst|ensias|inpt|ensam|ensa|est|ofppt|supmti|esca|isga|uic)/i.test(lowSchool)) {
      out.school_type = /emsi|supmti|esca|isga|uic/i.test(lowSchool) ? 'PRIVE' : out.school_type
    }
  }
  if (out.school_type !== 'PUBLIC' && out.school_type !== 'PRIVE') out.school_type = null

  const count = Number.isFinite(Number(out.experience_count))
    ? Math.max(0, parseInt(String(out.experience_count), 10))
    : 0
  let avgYears = Number.isFinite(Number(out.experience_years_avg)) ? Number(out.experience_years_avg) : null
  let totalMonths = parseDurationToMonths(out.experience_duration)
  const scoreRaw = Number.isFinite(Number(out.score)) ? Number(out.score) : null

  if (count <= 0) {
    out.experience_count = 0
    out.experience_duration = null
    out.experience_years_avg = null
    return out
  }

  out.experience_count = count
  if (!totalMonths && avgYears && avgYears > 0) {
    totalMonths = Math.max(1, Math.round(avgYears * 12 * count))
  }
  if (totalMonths && count > 1) {
    const maxPlausibleAvgMonths = totalMonths
    if (avgYears && Math.round(avgYears * 12) > maxPlausibleAvgMonths) {
      avgYears = Number((totalMonths / 12 / count).toFixed(2))
    }
  }
  out.experience_duration = totalMonths ? monthsToDurationLabel(totalMonths) : null
  out.experience_years_avg = avgYears && avgYears > 0 ? Number(avgYears.toFixed(2)) : null
  if (scoreRaw != null) {
    let capped = Math.max(0, Math.min(100, Math.round(scoreRaw)))
    const offerCtx = String(out.offer_title || out.offerTitle || out.offer_context || '').toLowerCase()
    const strictInternOffer = /(backend|java|spring|microservices|qa|test|automation|business analyst|miage)/.test(offerCtx)
    if (totalMonths && totalMonths <= 6) capped = Math.min(capped, 80)
    else if (totalMonths && totalMonths <= 12) capped = Math.min(capped, 85)
    if (count > 0 && count <= 2 && avgYears != null && avgYears < 0.5) capped = Math.min(capped, 82)
    if (strictInternOffer && totalMonths && totalMonths <= 6) capped = Math.min(capped, 76)
    out.score = capped
  }
  return out
}

/** Insérer une candidature en base, retourne l’item au format API */
async function insertCandidatureIntoDb(item) {
  const dateVal = item.date != null ? (typeof item.date === 'string' ? item.date : new Date(item.date).toISOString()) : new Date().toISOString()
  const decisionDb = decisionForDb(item.decision || 'À REVOIR')
  const buRaw = normalizeBusinessUnitInput(item.businessUnit ?? item.business_unit)
  const buVal = buRaw === false ? null : buRaw ?? null
  const res = await query(
    `INSERT INTO candidatures (candidate_id, candidate_name, email, subject, "date", decision, score, skills, experience, raw_summary, source, cv_path, business_unit)
     VALUES ($1::uuid, $2, $3, $4, $5::timestamptz, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING ${CANDIDATURE_ROW_COLUMNS}`,
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
      buVal,
    ]
  )
  return mapCandidatureRow(res.rows[0])
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

/** Candidature par UUID candidat (n8n GET /cv-text) */
async function getCandidatureByCandidateId(candidateId) {
  const cid = (candidateId || '').toString().trim()
  if (!cid) return null
  if (useDb) {
    const res = await query(`${CANDIDATURES_SELECT} WHERE candidate_id = $1::uuid`, [cid])
    if (!res.rows.length) return null
    return mapCandidatureRow(res.rows[0])
  }
  return candidatures.find((x) => String(x.candidateId) === cid) || null
}

/** Mettre à jour une candidature en DB (analyse OpenAI) */
async function updateCandidatureAnalysisInDb(id, analysis) {
  const numId = typeof id === 'string' ? parseInt(id, 10) : id
  if (!Number.isInteger(numId) || numId < 1) return
  const normalized = normalizeAnalysisFields(analysis)
  const decisionDb = decisionFromAutoAnalysis(normalized.decision || 'À REVOIR')
  const schoolType = normalized.school_type === 'PUBLIC' || normalized.school_type === 'PRIVE' ? normalized.school_type : null
  await query(
    `UPDATE candidatures
       SET raw_summary = $1, skills = $2, experience = $3, score = $4, decision = $5,
           school = $6, school_type = $7, phone = $8, experience_count = $9, experience_duration = $10, experience_years_avg = $11, last_employer = $12,
           updated_at = NOW()
     WHERE id = $13`,
    [
      normalized.summary || null,
      normalized.skills || null,
      normalized.experience || null,
      normalized.score ?? null,
      decisionDb,
      normalized.school || null,
      schoolType,
      normalized.phone || null,
      normalized.experience_count ?? null,
      normalized.experience_duration || null,
      normalized.experience_years_avg ?? null,
      normalized.last_employer || null,
      numId,
    ]
  )
}

function buildCvFetchCandidates(inputPath) {
  const raw = String(inputPath || '').trim()
  if (!raw) return []
  const base = (process.env.MINIO_PUBLIC_URL || 'http://localhost:9000').replace(/\/$/, '')
  const out = []
  const add = (u) => {
    const v = String(u || '').trim()
    if (v && !out.includes(v)) out.push(v)
  }

  const encodePathSegments = (p) =>
    p
      .split('/')
      .filter(Boolean)
      .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
      .join('/')

  if (/^https?:\/\//i.test(raw)) {
    add(raw)
    try {
      const u = new URL(raw)
      const encodedPath = encodePathSegments(u.pathname || '')
      add(`${u.origin}/${encodedPath}${u.search || ''}`)
      const decodedPath = decodeURIComponent((u.pathname || '').replace(/^\/+/, ''))
      add(`${u.origin}/${decodedPath}${u.search || ''}`)
    } catch {
      add(raw)
    }
    return out
  }

  const pathClean = raw.replace(/^\/+/, '')
  add(`${base}/${pathClean}`)
  try {
    add(`${base}/${encodePathSegments(pathClean)}`)
  } catch {
    add(`${base}/${pathClean}`)
  }
  try {
    const decoded = decodeURIComponent(pathClean)
    add(`${base}/${decoded}`)
    add(`${base}/${encodePathSegments(decoded)}`)
  } catch {
    // ignore malformed URI component
  }
  return out
}

/** Récupérer le texte du CV depuis MinIO (PDF) avec fallback URL/path */
async function fetchCVTextFromMinIO(cvPath) {
  if (!pdfParse) throw new Error('pdf-parse not installed: npm install pdf-parse')
  const candidates = buildCvFetchCandidates(cvPath)
  if (!candidates.length) throw new Error('Empty CV path')

  let lastError = null
  for (const url of candidates) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`MinIO fetch failed: ${res.status} ${url}`)
      const buffer = Buffer.from(await res.arrayBuffer())
      const { text } = await pdfParse(buffer)
      const cleaned = (text || '').trim()
      if (cleaned.length >= 20) {
        return { text: cleaned, urlTried: url }
      }
      lastError = new Error(`Extracted text too short from ${url}`)
    } catch (e) {
      lastError = e
    }
  }
  throw lastError || new Error('Could not extract readable text from candidate CV paths')
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

function fallbackCampaigns() {
  return [
    { id: 'PCA-SW', name: 'Stages PFE - 2026', code: 'PCA-SW', status: 'active', results_count: 5 },
    { id: 'PCA-DATA', name: 'Data & BI - 2026', code: 'PCA-DATA', status: 'active', results_count: 4 },
    { id: 'PCA-CLOUD', name: 'Cloud / DevOps - 2026', code: 'PCA-CLOUD', status: 'active', results_count: 3 },
  ]
}

function fallbackOffersByCampaign(campaignId) {
  const pca = 'Payment Center For Africa - PCA'
  const map = {
    'PCA-SW': [
      { id: 'SW-1', title: 'Ingénieur de Développement Mobile (Spring boot / React Native)', company: pca, location: 'Casablanca Metropolitan Area', redirect_url: 'https://www.linkedin.com/jobs/view/4400543122/' },
      { id: 'SW-2', title: 'UX/UI Designer', company: pca, location: 'Casablanca Metropolitan Area', redirect_url: 'https://www.linkedin.com/jobs/view/4083438439/' },
      { id: 'SW-3', title: 'Ingénieur de Développement Full Stack Senior (Java / Spring / React.js)', company: pca, location: 'Casablanca Metropolitan Area', redirect_url: null },
      { id: 'SW-4', title: 'Ingénieur Test et Validation (QA)', company: pca, location: 'Casablanca Metropolitan Area', redirect_url: null },
      { id: 'SW-5', title: 'Responsable Test & Validation', company: pca, location: 'Casablanca Metropolitan Area', redirect_url: null },
    ],
    'pca-sw': [
      { id: 'SW-1', title: 'Ingénieur de Développement Mobile (Spring boot / React Native)', company: pca, location: 'Casablanca Metropolitan Area', redirect_url: 'https://www.linkedin.com/jobs/view/4400543122/' },
      { id: 'SW-2', title: 'UX/UI Designer', company: pca, location: 'Casablanca Metropolitan Area', redirect_url: 'https://www.linkedin.com/jobs/view/4083438439/' },
      { id: 'SW-3', title: 'Ingénieur de Développement Full Stack Senior (Java / Spring / React.js)', company: pca, location: 'Casablanca Metropolitan Area', redirect_url: null },
      { id: 'SW-4', title: 'Ingénieur Test et Validation (QA)', company: pca, location: 'Casablanca Metropolitan Area', redirect_url: null },
      { id: 'SW-5', title: 'Responsable Test & Validation', company: pca, location: 'Casablanca Metropolitan Area', redirect_url: null },
    ],
    'PCA-DATA': [
      { id: 'DATA-1', title: 'Stage PFE - Data Analyst / BI (Power BI)', company: pca, location: 'Casablanca', redirect_url: null },
      { id: 'DATA-2', title: 'Stage PFE - Data Engineer (Python/SQL/Airflow)', company: pca, location: 'Casablanca', redirect_url: null },
      { id: 'DATA-3', title: 'Stage PFE - AI/ML Engineer (NLP & Scoring Automation)', company: pca, location: 'Casablanca', redirect_url: null },
      { id: 'DATA-4', title: 'Stage PFE - Data Governance & Reporting (MIAGE)', company: pca, location: 'Casablanca', redirect_url: null },
    ],
    'pca-data': [
      { id: 'DATA-1', title: 'Stage PFE - Data Analyst / BI (Power BI)', company: pca, location: 'Casablanca', redirect_url: null },
      { id: 'DATA-2', title: 'Stage PFE - Data Engineer (Python/SQL/Airflow)', company: pca, location: 'Casablanca', redirect_url: null },
      { id: 'DATA-3', title: 'Stage PFE - AI/ML Engineer (NLP & Scoring Automation)', company: pca, location: 'Casablanca', redirect_url: null },
      { id: 'DATA-4', title: 'Stage PFE - Data Governance & Reporting (MIAGE)', company: pca, location: 'Casablanca', redirect_url: null },
    ],
    'PCA-CLOUD': [
      { id: 'CLOUD-1', title: 'Stage PFE - Cloud Engineer (Azure/AWS)', company: pca, location: 'Casablanca', redirect_url: null },
      { id: 'CLOUD-2', title: 'Stage PFE - DevOps & CI/CD (Docker/Kubernetes)', company: pca, location: 'Casablanca', redirect_url: null },
      { id: 'CLOUD-3', title: 'Stage PFE - Payment Integration Engineer (API Monetique)', company: pca, location: 'Casablanca', redirect_url: null },
    ],
    'pca-cloud': [
      { id: 'CLOUD-1', title: 'Stage PFE - Cloud Engineer (Azure/AWS)', company: pca, location: 'Casablanca', redirect_url: null },
      { id: 'CLOUD-2', title: 'Stage PFE - DevOps & CI/CD (Docker/Kubernetes)', company: pca, location: 'Casablanca', redirect_url: null },
      { id: 'CLOUD-3', title: 'Stage PFE - Payment Integration Engineer (API Monetique)', company: pca, location: 'Casablanca', redirect_url: null },
    ],
  }
  return map[String(campaignId)] || []
}

async function getOffersCatalogFromDb() {
  const rows = (
    await query(
      `SELECT o.id,
              o.campaign_id,
              o.title,
              o.reference,
              o.description,
              c.name AS campaign_name,
              c.code AS campaign_code
         FROM offers o
         JOIN campaigns c ON c.id = o.campaign_id
        WHERE COALESCE(o.reference, '') NOT ILIKE 'AUTO-%'
          AND COALESCE(c.name, '') NOT ILIKE '%remotive%'
          AND COALESCE(c.code, '') NOT ILIKE '%remotive%'
          AND COALESCE(o.title, '') NOT ILIKE '%remotive%'
          AND COALESCE(c.name, '') NOT ILIKE '%offres remote%'
        ORDER BY c.id ASC, o.id ASC`
    )
  ).rows
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    reference: r.reference,
    description: r.description,
    redirect_url: resolveOfferExternalUrl({
      reference: r.reference,
      title: r.title,
      description: r.description,
    }),
    campaignId: r.campaign_id,
    campaignName: r.campaign_name,
    campaignCode: r.campaign_code,
  }))
}

function extractOfferExternalUrl(description) {
  const s = String(description || '')
  const tagged = s.match(/(?:^|\n)\s*LINKEDIN_URL\s*:\s*(https?:\/\/[^\s)]+)/i)
  if (tagged) return tagged[1]
  const m = s.match(/https?:\/\/[^\s)]+/i)
  return m ? m[0] : null
}

function mergeDescriptionWithLinkedinUrl(description, linkedinUrl) {
  const base = String(description || '').replace(/(?:^|\n)\s*LINKEDIN_URL\s*:\s*https?:\/\/[^\s)]+\s*$/gi, '').trim()
  const link = String(linkedinUrl || '').trim()
  if (!link) return base || null
  return `${base ? `${base}\n\n` : ''}LINKEDIN_URL: ${link}`.trim()
}

const PCA_LINKEDIN_COMPANY_NUMERIC_ID = '10432840'
const PCA_LINKEDIN_COMPANY_JOBS = 'https://www.linkedin.com/company/payment-center-for-africa---pca/jobs/'

function buildPcaLinkedInSearchUrl(title) {
  const keywords = encodeURIComponent(String(title || '').trim())
  if (!keywords) return PCA_LINKEDIN_COMPANY_JOBS
  return `https://www.linkedin.com/jobs/search/?keywords=${keywords}&f_C=${PCA_LINKEDIN_COMPANY_NUMERIC_ID}`
}

function resolveOfferExternalUrl({ reference, title, description }) {
  const fromDescription = extractOfferExternalUrl(description)
  if (fromDescription) return fromDescription

  const ref = String(reference || '').trim().toUpperCase()
  const idMatch = ref.match(/PCA-LI-(\d{6,})/)
  if (idMatch) return `https://www.linkedin.com/jobs/view/${idMatch[1]}/`

  if (/^PCA-LI-SEARCH-/.test(ref)) return buildPcaLinkedInSearchUrl(title)
  if (/^PCA-(DATA|CLOUD)-\d+/.test(ref)) return buildPcaLinkedInSearchUrl(title)

  return buildPcaLinkedInSearchUrl(title)
}

function stripHtml(input) {
  return String(input || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractLinkedInDescriptionFromHtml(html) {
  const raw = String(html || '')
  if (!raw) return null

  const normalizeExtracted = (text) =>
    stripHtml(
      String(text || '')
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\u003c/gi, '<')
        .replace(/\\u003e/gi, '>')
        .replace(/\\u0026/gi, '&')
    )
      .replace(/\s+\.\.\.\s*See this and similar jobs on LinkedIn\.?/gi, '')
      .trim()

  const isWeakSnippet = (text) => {
    const s = String(text || '').trim()
    if (!s) return true
    if (s.length < 120) return true
    if (/see this and similar jobs on linkedin/i.test(s) && s.length < 400) return true
    return false
  }

  // Public LinkedIn pages often expose the full description in this block.
  const markupCandidates = [
    raw.match(/show-more-less-html__markup[^>]*>([\s\S]{150,20000}?)<\/div>/i),
    raw.match(/jobs-description__content[^>]*>([\s\S]{150,20000}?)<\/div>/i),
    raw.match(/jobs-box__html-content[^>]*>([\s\S]{150,20000}?)<\/div>/i),
  ]
  for (const m of markupCandidates) {
    const txt = normalizeExtracted(m?.[1] || '')
    if (!isWeakSnippet(txt)) return txt
  }

  // Best effort: capture the "About the job" section block first.
  const aboutBlockMatch =
    raw.match(/About the job[\s\S]{200,12000}?(?:Seniority level|Employment type|Job function|Industries|Show less|$)/i) ||
    raw.match(/À propos du poste[\s\S]{200,12000}?(?:Niveau hiérarchique|Type d'emploi|Fonction|Secteurs|Voir moins|$)/i)
  if (aboutBlockMatch?.[0]) {
    const section = normalizeExtracted(aboutBlockMatch[0])
      .replace(/^About the job\s*/i, '')
      .replace(/^À propos du poste\s*/i, '')
      .trim()
    if (!isWeakSnippet(section)) return section
  }

  // JSON payloads used by LinkedIn pages (fallback before meta tags).
  const jsonCandidates = [
    raw.match(/"jobPostingDescription"\s*:\s*"([^"]{120,30000})"/i),
    raw.match(/"description"\s*:\s*"([^"]{120,30000})"\s*,\s*"employmentType"/i),
    raw.match(/"description"\s*:\s*"([^"]{120,30000})"\s*,\s*"industry"/i),
    raw.match(/"description"\s*:\s*"([^"]{120,30000})"/i),
  ]
  for (const m of jsonCandidates) {
    const txt = normalizeExtracted(m?.[1] || '')
    if (!isWeakSnippet(txt)) return txt
  }

  // Last resort: OpenGraph / meta description snippet.
  const metaMatch =
    raw.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{80,})["']/i) ||
    raw.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{80,})["']/i)
  if (metaMatch?.[1]) {
    const text = normalizeExtracted(metaMatch[1])
    if (!isWeakSnippet(text)) return text
  }

  return null
}

function extractAboutJobFromPlainText(text) {
  const raw = String(text || '').replace(/\r/g, '').trim()
  if (!raw) return null
  const m =
    raw.match(/About the job[\s\S]{120,12000}?(?=\n(?:Seniority level|Employment type|Job function|Industries)\b|$)/i) ||
    raw.match(/À propos du poste[\s\S]{120,12000}?(?=\n(?:Niveau hiérarchique|Type d'emploi|Fonction|Secteurs)\b|$)/i)
  const out = (m ? m[0] : raw)
    .replace(/^About the job\s*/i, '')
    .replace(/^À propos du poste\s*/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return out.length >= 120 ? out : null
}

async function fetchLinkedInDescription(url) {
  const u = String(url || '').trim()
  if (!/^https?:\/\/(www\.)?linkedin\.com\//i.test(u)) return null
  try {
    const res = await fetch(u, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) return null
    const html = await res.text()
    const direct = extractLinkedInDescriptionFromHtml(html)
    if (direct) return direct
  } catch {
    // try fallback below
  }

  // Fallback: text mirror often bypasses LinkedIn anti-bot and keeps "About the job".
  try {
    const mirror = `https://r.jina.ai/http://${u.replace(/^https?:\/\//i, '')}`
    const res = await fetch(mirror, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/plain' },
    })
    if (!res.ok) return null
    const text = await res.text()
    return extractAboutJobFromPlainText(text)
  } catch {
    return null
  }
}

async function getCampaignsFromDb() {
  const rows = (
    await query(
      `SELECT c.id, c.name, c.code, c.status, c.start_date, c.end_date,
              COUNT(o.id)::int AS results_count
         FROM campaigns c
         LEFT JOIN offers o ON o.campaign_id = c.id
                           AND COALESCE(o.reference, '') NOT ILIKE 'AUTO-%'
                           AND COALESCE(o.title, '') NOT ILIKE '%remotive%'
                           AND COALESCE(c.name, '') NOT ILIKE '%remotive%'
                           AND COALESCE(c.code, '') NOT ILIKE '%remotive%'
                           AND COALESCE(c.name, '') NOT ILIKE '%offres remote%'
        WHERE COALESCE(c.name, '') NOT ILIKE '%remotive%'
          AND COALESCE(c.code, '') NOT ILIKE '%remotive%'
          AND COALESCE(c.name, '') NOT ILIKE '%offres remote%'
        GROUP BY c.id, c.name, c.code, c.status, c.start_date, c.end_date
        ORDER BY c.id ASC`
    )
  ).rows
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    status: String(r.status || '').toLowerCase(),
    start_date: r.start_date ? new Date(r.start_date).toISOString() : null,
    end_date: r.end_date ? new Date(r.end_date).toISOString() : null,
    results_count: Number(r.results_count || 0),
  }))
}

async function getCampaignByIdFromDb(id) {
  const key = String(id || '').trim()
  if (!key) return null
  const rows = (
    await query(
      `SELECT id, name, code, description, status, start_date, end_date
         FROM campaigns
        WHERE id::text = $1 OR lower(code) = lower($1)
        LIMIT 1`,
      [key]
    )
  ).rows
  if (!rows.length) return null
  const r = rows[0]
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    description: r.description || null,
    status: String(r.status || '').toLowerCase(),
    start_date: r.start_date ? new Date(r.start_date).toISOString() : null,
    end_date: r.end_date ? new Date(r.end_date).toISOString() : null,
  }
}

async function getOffersByCampaignFromDb(campaignId) {
  const campaign = await getCampaignByIdFromDb(campaignId)
  if (!campaign) return []
  const rows = (
    await query(
      `SELECT id, campaign_id, title, reference, description, location, status
         FROM offers
        WHERE campaign_id = $1
          AND COALESCE(reference, '') NOT ILIKE 'AUTO-%'
          AND COALESCE(title, '') NOT ILIKE '%remotive%'
        ORDER BY id ASC`,
      [campaign.id]
    )
  ).rows
  const isStagesPfeCampaign = /stages?\s*pfe/i.test(String(campaign.name || ''))

  return Promise.all(
    rows.map(async (r) => {
      const redirectUrl = resolveOfferExternalUrl({
        reference: r.reference,
        title: r.title,
        description: r.description,
      })
      let liveDescription = null
      if (isStagesPfeCampaign && redirectUrl) {
        liveDescription = await fetchLinkedInDescription(redirectUrl)
      }
      return {
        id: r.id,
        campaignId: r.campaign_id,
        title: r.title,
        reference: r.reference,
        description: liveDescription || r.description,
        location: r.location,
        status: String(r.status || '').toLowerCase(),
        company: 'Payment Center For Africa - PCA',
        redirect_url: redirectUrl,
      }
    })
  )
}

async function findCanonicalCampaignIdByName(nameHint) {
  const key = String(nameHint || '').trim()
  if (!key) return null
  const rows = (
    await query(
      `SELECT id
         FROM campaigns
        WHERE lower(coalesce(name, '')) LIKE lower($1)
        ORDER BY id ASC
        LIMIT 1`,
      [`%${key}%`]
    )
  ).rows
  return rows.length ? rows[0].id : null
}

async function findCanonicalCampaignIdByCode(codeHint) {
  const key = String(codeHint || '').trim().toUpperCase()
  if (!key) return null
  const rows = (
    await query(
      `SELECT id
         FROM campaigns
        WHERE upper(coalesce(code, '')) = $1
        ORDER BY id ASC
        LIMIT 1`,
      [key]
    )
  ).rows
  return rows.length ? rows[0].id : null
}

async function enforceOfferCampaignCanonicalRouting() {
  if (!useDb) return
  try {
    const pfeCampaignId =
      await findCanonicalCampaignIdByName('stages pfe – 2026') ||
      await findCanonicalCampaignIdByName("stages pfe - 2026") ||
      await findCanonicalCampaignIdByName('stages pfe 2026')

    const expCampaignId =
      await findCanonicalCampaignIdByName('recrutements expérimentés – 2026') ||
      await findCanonicalCampaignIdByName('recrutements experimentes – 2026') ||
      await findCanonicalCampaignIdByName("recrutements expérimentés - 2026") ||
      await findCanonicalCampaignIdByName("recrutements experimentes - 2026") ||
      await findCanonicalCampaignIdByName('recrutements expérimentés 2026') ||
      await findCanonicalCampaignIdByName('recrutements experimentes 2026')

    if (pfeCampaignId) {
      const movedPfe = await query(
        `UPDATE offers
            SET campaign_id = $1,
                updated_at = NOW()
          WHERE coalesce(title, '') ~* '^\s*stage\s*pfe\b'`,
        [pfeCampaignId]
      )
      if ((movedPfe.rowCount || 0) > 0) {
        console.log('[offers] routed to Stages PFE – 2026:', movedPfe.rowCount)
      }
    }

    if (expCampaignId) {
      const movedExp = await query(
        `UPDATE offers
            SET campaign_id = $1,
                updated_at = NOW()
          WHERE coalesce(title, '') ~* '(full\s*stack\s*senior|ing[ée]nieur\s*test\s*et\s*validation|responsable\s*test\s*&?\s*validation|\bqa\b)'`,
        [expCampaignId]
      )
      if ((movedExp.rowCount || 0) > 0) {
        console.log('[offers] routed to Recrutements expérimentés – 2026:', movedExp.rowCount)
      }
    }
  } catch (e) {
    console.warn('[offers] canonical campaign routing failed:', e.message)
  }
}

async function enforceOfferCampaignStrictRoutingByTitle() {
  if (!useDb) return
  try {
    // Prefer stable campaign codes first to avoid name/accent mismatches.
    const pfeCampaignId =
      await findCanonicalCampaignIdByCode('PCA-SW') ||
      await findCanonicalCampaignIdByName('stages pfe – 2026') ||
      await findCanonicalCampaignIdByName("stages pfe - 2026") ||
      await findCanonicalCampaignIdByName('stages pfe 2026')
    const emploiCampaignId =
      await findCanonicalCampaignIdByCode('PCA-DATA') ||
      await findCanonicalCampaignIdByName('offres d’emploi – 2026') ||
      await findCanonicalCampaignIdByName("offres d'emploi – 2026") ||
      await findCanonicalCampaignIdByName('offres d’emploi 2026') ||
      await findCanonicalCampaignIdByName("offres d'emploi 2026")
    const expCampaignId =
      await findCanonicalCampaignIdByCode('PCA-CLOUD') ||
      await findCanonicalCampaignIdByName('recrutements expérimentés – 2026') ||
      await findCanonicalCampaignIdByName('recrutements experimentes – 2026') ||
      await findCanonicalCampaignIdByName("recrutements expérimentés - 2026") ||
      await findCanonicalCampaignIdByName("recrutements experimentes - 2026") ||
      await findCanonicalCampaignIdByName('recrutements expérimentés 2026') ||
      await findCanonicalCampaignIdByName('recrutements experimentes 2026')

    if (!pfeCampaignId && !emploiCampaignId && !expCampaignId) return

    // 1) Any "Stage PFE ..." must be in "Stages PFE – 2026".
    if (pfeCampaignId) {
      await query(
        `UPDATE offers
            SET campaign_id = $1,
                updated_at = NOW()
          WHERE coalesce(title, '') ILIKE 'Stage PFE%'`,
        [pfeCampaignId]
      )
    }

    // 2) QA/Test experienced offers must be in "Recrutements expérimentés – 2026".
    if (expCampaignId) {
      await query(
        `UPDATE offers
            SET campaign_id = $1,
                updated_at = NOW()
          WHERE (
            coalesce(title, '') ILIKE '%Ingénieur Test et Validation%'
            OR coalesce(title, '') ILIKE '%Ingenieur Test et Validation%'
            OR coalesce(title, '') ILIKE '%Responsable Test%'
            OR coalesce(title, '') ILIKE '%Full Stack Senior%'
            OR coalesce(title, '') ILIKE '%(QA)%'
          )
          AND coalesce(title, '') NOT ILIKE 'Stage PFE%'`,
        [expCampaignId]
      )
    }

    // 3) Explicitly keep non-stage mobile/full-stack senior in "Offres d’emploi – 2026".
    if (emploiCampaignId) {
      await query(
        `UPDATE offers
            SET campaign_id = $1,
                updated_at = NOW()
          WHERE (
            coalesce(title, '') ILIKE '%Développement Mobile%'
            OR coalesce(title, '') ILIKE '%Developpement Mobile%'
            OR coalesce(title, '') ILIKE '%UX/UI Designer%'
            OR coalesce(title, '') ILIKE '%Full Stack Senior%'
          )
          AND coalesce(title, '') NOT ILIKE 'Stage PFE%'
          AND coalesce(title, '') NOT ILIKE '%Test et Validation%'
          AND coalesce(title, '') NOT ILIKE '%Responsable Test%'`,
        [emploiCampaignId]
      )
    }
  } catch (e) {
    console.warn('[offers] strict title routing failed:', e.message)
  }
}

async function upsertCandidatureOfferLink({ candidatureId, offerTitle, offerMatchScore }) {
  if (!useDb) return
  const candId = Number(candidatureId)
  if (!Number.isFinite(candId)) return
  const title = String(offerTitle || '').trim()
  if (!title) return

  const offerRows = (
    await query(
      `WITH i AS (
         SELECT regexp_replace(
                  lower(
                    translate(
                      coalesce($1, ''),
                      'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖòóôõöÙÚÛÜùúûüÝýÿ',
                      'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOoooooUUUUuuuuYyy'
                    )
                  ),
                  '[^a-z0-9]+',
                  ' ',
                  'g'
                ) AS norm_input
       ),
       cand AS (
         SELECT o.id,
                regexp_replace(
                  lower(
                    translate(
                      coalesce(o.title, ''),
                      'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖòóôõöÙÚÛÜùúûüÝýÿ',
                      'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOoooooUUUUuuuuYyy'
                    )
                  ),
                  '[^a-z0-9]+',
                  ' ',
                  'g'
                ) AS norm_title
           FROM offers o
          WHERE COALESCE(o.reference, '') NOT ILIKE 'AUTO-%'
       )
       SELECT c.id
         FROM cand c, i
        WHERE btrim(i.norm_input) <> ''
          AND (
            btrim(c.norm_title) = btrim(i.norm_input)
            OR btrim(c.norm_title) LIKE '%' || btrim(i.norm_input) || '%'
            OR btrim(i.norm_input) LIKE '%' || btrim(c.norm_title) || '%'
          )
        ORDER BY
          CASE
            WHEN btrim(c.norm_title) = btrim(i.norm_input) THEN 0
            ELSE 1
          END,
          abs(length(c.norm_title) - length(i.norm_input)) ASC,
          c.id DESC
        LIMIT 1`,
      [title]
    )
  ).rows
  if (!offerRows.length) return
  const offerId = Number(offerRows[0].id)
  if (!Number.isFinite(offerId)) return

  const scoreVal = Number.isFinite(Number(offerMatchScore)) ? Number(offerMatchScore) : null
  const candRows = (
    await query(
      `SELECT decision
         FROM candidatures
        WHERE id = $1
        LIMIT 1`,
      [candId]
    )
  ).rows
  const d = String(candRows[0]?.decision || '').toUpperCase()
  const statusVal =
    d.includes('ACCEP') ? 'ACCEPTEE'
      : d.includes('REFUS') ? 'REFUSEE'
        : d.includes('NON') ? 'NON_LISIBLE'
          : 'A REVOIR'

  const existing = (
    await query(
      `SELECT id
         FROM candidature_offer
        WHERE candidature_id = $1 AND offer_id = $2
        LIMIT 1`,
      [candId, offerId]
    )
  ).rows

  if (existing.length) {
    await query(
      `UPDATE candidature_offer
          SET score = COALESCE($2, score),
              updated_at = NOW()
        WHERE id = $1`,
      [existing[0].id, scoreVal]
    )
    return
  }

  await query(
    `INSERT INTO candidature_offer (candidature_id, offer_id, status, score, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())`,
    [candId, offerId, statusVal, scoreVal]
  )
}

async function backfillCandidatureOfferLinksFromExistingData() {
  if (!useDb) return
  try {
    // Keep offers table clean: never auto-create offers from email subjects.
    // Platform/HR-managed offers are the only allowed source.
    const deleted = await query(
      `DELETE FROM offers
        WHERE COALESCE(reference, '') ILIKE 'AUTO-%'
           OR COALESCE(description, '') ILIKE 'Auto-created from candidature title/subject%'`
    )
    if ((deleted.rowCount || 0) > 0) {
      console.log('[offers] removed auto-generated rows:', deleted.rowCount)
    }

    const result = await query(
      `WITH base AS (
         SELECT id,
                score,
                decision,
                COALESCE(NULLIF(btrim(offer_title), ''), NULLIF(btrim(subject), '')) AS label
           FROM candidatures
       ),
       norm_base AS (
         SELECT b.id,
                b.score,
                b.decision,
                b.label,
                regexp_replace(
                  lower(
                    translate(
                      coalesce(b.label, ''),
                      'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖòóôõöÙÚÛÜùúûüÝýÿ',
                      'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOoooooUUUUuuuuYyy'
                    )
                  ),
                  '[^a-z0-9]+',
                  ' ',
                  'g'
                ) AS norm_label
           FROM base b
       ),
       norm_offers AS (
         SELECT o.id,
                regexp_replace(
                  lower(
                    translate(
                      coalesce(o.title, ''),
                      'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖòóôõöÙÚÛÜùúûüÝýÿ',
                      'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOoooooUUUUuuuuYyy'
                    )
                  ),
                  '[^a-z0-9]+',
                  ' ',
                  'g'
                ) AS norm_title
           FROM offers o
          WHERE COALESCE(o.reference, '') NOT ILIKE 'AUTO-%'
       ),
       pairs AS (
         SELECT nb.id AS candidature_id,
                nof.id AS offer_id,
                nb.score,
                nb.decision,
                row_number() OVER (
                  PARTITION BY nb.id
                  ORDER BY
                    CASE
                      WHEN btrim(nof.norm_title) = btrim(nb.norm_label) THEN 0
                      ELSE 1
                    END,
                    abs(length(nof.norm_title) - length(nb.norm_label)) ASC,
                    nof.id DESC
                ) AS rn
           FROM norm_base nb
           JOIN norm_offers nof
             ON btrim(nb.norm_label) <> ''
            AND (
              btrim(nof.norm_title) = btrim(nb.norm_label)
              OR btrim(nof.norm_title) LIKE '%' || btrim(nb.norm_label) || '%'
              OR btrim(nb.norm_label) LIKE '%' || btrim(nof.norm_title) || '%'
            )
          WHERE nb.label IS NOT NULL
       )
       INSERT INTO candidature_offer (candidature_id, offer_id, status, score, created_at, updated_at)
       SELECT p.candidature_id,
              p.offer_id,
              CASE
                WHEN upper(coalesce(p.decision, '')) LIKE '%ACCEP%' THEN 'ACCEPTEE'
                WHEN upper(coalesce(p.decision, '')) LIKE '%REFUS%' THEN 'REFUSEE'
                WHEN upper(coalesce(p.decision, '')) LIKE '%NON%' THEN 'NON_LISIBLE'
                ELSE 'A REVOIR'
              END,
              CASE
                WHEN p.score IS NULL THEN NULL
                ELSE GREATEST(0, LEAST(100, p.score::numeric))
              END,
              NOW(),
              NOW()
         FROM pairs p
        WHERE p.rn = 1
          AND NOT EXISTS (
            SELECT 1
              FROM candidature_offer co
             WHERE co.candidature_id = p.candidature_id
          )
        `
    )
    console.log('[candidature_offer] backfill inserted:', result.rowCount || 0)
  } catch (e) {
    console.warn('[candidature_offer] backfill failed:', e.message)
  }
}

app.get('/api/campaigns', async (req, res) => {
  try {
    if (useDb) {
      await enforceOfferCampaignStrictRoutingByTitle()
      const campaigns = await getCampaignsFromDb()
      return res.json({ campaigns })
    }
    const campaigns = await getAdzunaCampaigns()
    res.json({ campaigns })
  } catch (e) {
    console.error('[campaigns]', e.message)
    res.json({ campaigns: fallbackCampaigns() })
  }
})

app.post('/api/campaigns', async (req, res) => {
  if (!useDb) return res.status(503).json({ error: 'Campaign management requires PostgreSQL' })
  try {
    const body = req.body || {}
    const name = String(body.name || '').trim()
    if (!name) return res.status(400).json({ error: 'name is required' })
    const code = String(body.code || '').trim().toUpperCase()
    if (!code) return res.status(400).json({ error: 'code is required' })
    const status = String(body.status || 'ACTIVE').trim().toUpperCase()
    if (!['ACTIVE', 'CLOSED', 'DRAFT'].includes(status)) {
      return res.status(400).json({ error: 'status must be ACTIVE, CLOSED, or DRAFT' })
    }
    const description = body.description != null ? String(body.description).trim() : null
    const startDate = body.start_date ? new Date(String(body.start_date)) : null
    const endDate = body.end_date ? new Date(String(body.end_date)) : null
    if (startDate && Number.isNaN(startDate.getTime())) {
      return res.status(400).json({ error: 'start_date is invalid' })
    }
    if (endDate && Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'end_date is invalid' })
    }

    const row = (
      await query(
        `INSERT INTO campaigns (name, code, description, status, start_date, end_date, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING id, name, code, description, status, start_date, end_date`,
        [name, code, description, status, startDate, endDate]
      )
    ).rows[0]

    return res.status(201).json({
      campaign: {
        id: row.id,
        name: row.name,
        code: row.code,
        description: row.description || null,
        status: String(row.status || '').toLowerCase(),
        start_date: row.start_date ? new Date(row.start_date).toISOString() : null,
        end_date: row.end_date ? new Date(row.end_date).toISOString() : null,
        results_count: 0,
      },
    })
  } catch (e) {
    return res.status(500).json({ error: 'Failed to create campaign', message: e.message })
  }
})

app.patch('/api/campaigns/:id', async (req, res) => {
  if (!useDb) return res.status(503).json({ error: 'Campaign management requires PostgreSQL' })
  try {
    const rows = (
      await query(
        `SELECT id, name, code, description, status, start_date, end_date
         FROM campaigns
         WHERE id::text = $1
         LIMIT 1`,
        [String(req.params.id)]
      )
    ).rows
    if (!rows.length) return res.status(404).json({ error: 'Campaign not found' })
    const existing = rows[0]
    const body = req.body || {}
    const name = body.name != null ? String(body.name).trim() : existing.name
    const code = body.code != null ? String(body.code).trim().toUpperCase() : existing.code
    const description = body.description !== undefined ? (body.description != null ? String(body.description).trim() : null) : existing.description
    const status = body.status != null ? String(body.status).trim().toUpperCase() : String(existing.status || '').toUpperCase()
    const startDate = body.start_date !== undefined
      ? (body.start_date ? new Date(String(body.start_date)) : null)
      : existing.start_date
    const endDate = body.end_date !== undefined
      ? (body.end_date ? new Date(String(body.end_date)) : null)
      : existing.end_date
    if (!name) return res.status(400).json({ error: 'name cannot be empty' })
    if (!code) return res.status(400).json({ error: 'code cannot be empty' })
    if (!['ACTIVE', 'CLOSED', 'DRAFT'].includes(status)) {
      return res.status(400).json({ error: 'status must be ACTIVE, CLOSED, or DRAFT' })
    }
    if (startDate && Number.isNaN(new Date(startDate).getTime())) {
      return res.status(400).json({ error: 'start_date is invalid' })
    }
    if (endDate && Number.isNaN(new Date(endDate).getTime())) {
      return res.status(400).json({ error: 'end_date is invalid' })
    }

    const row = (
      await query(
        `UPDATE campaigns
            SET name = $1,
                code = $2,
                description = $3,
                status = $4,
                start_date = $5,
                end_date = $6,
                updated_at = NOW()
          WHERE id = $7
          RETURNING id, name, code, description, status, start_date, end_date`,
        [name, code, description, status, startDate, endDate, existing.id]
      )
    ).rows[0]

    const countRow = (
      await query(`SELECT COUNT(*)::int AS cnt FROM offers WHERE campaign_id = $1`, [existing.id])
    ).rows[0]

    return res.json({
      campaign: {
        id: row.id,
        name: row.name,
        code: row.code,
        description: row.description || null,
        status: String(row.status || '').toLowerCase(),
        start_date: row.start_date ? new Date(row.start_date).toISOString() : null,
        end_date: row.end_date ? new Date(row.end_date).toISOString() : null,
        results_count: Number(countRow?.cnt || 0),
      },
    })
  } catch (e) {
    return res.status(500).json({ error: 'Failed to update campaign', message: e.message })
  }
})

app.delete('/api/campaigns/:id', async (req, res) => {
  if (!useDb) return res.status(503).json({ error: 'Campaign management requires PostgreSQL' })
  try {
    const rows = (
      await query(`SELECT id FROM campaigns WHERE id::text = $1 LIMIT 1`, [String(req.params.id)])
    ).rows
    if (!rows.length) return res.status(404).json({ error: 'Campaign not found' })
    const campaignId = rows[0].id
    await query(`DELETE FROM offers WHERE campaign_id = $1`, [campaignId])
    await query(`DELETE FROM campaigns WHERE id = $1`, [campaignId])
    return res.json({ ok: true, deletedCampaignId: campaignId })
  } catch (e) {
    return res.status(500).json({ error: 'Failed to delete campaign', message: e.message })
  }
})

// ——— GET /api/campaigns/:id — Détail campagne (Adzuna)
app.get('/api/campaigns/:id', async (req, res) => {
  try {
    if (useDb) {
      const campaign = await getCampaignByIdFromDb(req.params.id)
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
      return res.json({ campaign })
    }
    const campaigns = await getAdzunaCampaigns()
    const campaign = campaigns.find((c) => String(c.id) === String(req.params.id))
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
    res.json({ campaign })
  } catch (e) {
    console.error('[campaigns/:id]', e.message)
    const campaign = fallbackCampaigns().find((c) => String(c.id) === String(req.params.id))
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
    res.json({ campaign })
  }
})

// ——— GET /api/campaigns/:id/offers — Offres pour une campagne (Adzuna)
app.get('/api/campaigns/:id/offers', async (req, res) => {
  try {
    if (useDb) {
      await enforceOfferCampaignStrictRoutingByTitle()
      const campaign = await getCampaignByIdFromDb(req.params.id)
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
      const offers = await getOffersByCampaignFromDb(req.params.id)
      return res.json({ offers })
    }
    const offers = await getAdzunaOffers(req.params.id)
    res.json({ offers })
  } catch (e) {
    console.error('[campaigns/:id/offers]', e.message)
    res.json({ offers: fallbackOffersByCampaign(req.params.id) })
  }
})

// ——— GET /api/offers/catalog — Toutes les offres (n8n « Fetch Offers Catalog »)
app.get('/api/offers/catalog', async (req, res) => {
  try {
    if (useDb) {
      const dbOffers = await getOffersCatalogFromDb()
      if (dbOffers.length > 0) {
        return res.json({ offers: dbOffers })
      }
      console.warn('[offers/catalog] PostgreSQL sans offres — fallback catalogue PCA (Adzuna)')
    }
    const campaigns = await getAdzunaCampaigns()
    const offers = []
    const seen = new Set()
    for (const c of campaigns || []) {
      let list = []
      try {
        list = await getAdzunaOffers(c.id)
      } catch (e) {
        console.error('[offers/catalog]', c.id, e.message)
      }
      if (!list || list.length === 0) list = fallbackOffersByCampaign(c.id)
      for (const o of list) {
        const key = o.id != null ? String(o.id) : `${c.id}-${offers.length}`
        if (seen.has(key)) continue
        seen.add(key)
        offers.push({
          ...o,
          campaignId: c.id,
          campaignName: c.name,
          campaignCode: c.code,
        })
      }
    }
    res.json({ offers })
  } catch (e) {
    console.error('[offers/catalog]', e.message)
    const campaigns = fallbackCampaigns()
    const offers = []
    const seen = new Set()
    for (const c of campaigns) {
      for (const o of fallbackOffersByCampaign(c.id)) {
        const key = o.id != null ? String(o.id) : `${c.id}-${offers.length}`
        if (seen.has(key)) continue
        seen.add(key)
        offers.push({
          ...o,
          campaignId: c.id,
          campaignName: c.name,
          campaignCode: c.code,
        })
      }
    }
    res.json({ offers })
  }
})

app.post('/api/campaigns/:id/offers', async (req, res) => {
  if (!useDb) return res.status(503).json({ error: 'Offer management requires PostgreSQL' })
  try {
    const campaign = await getCampaignByIdFromDb(req.params.id)
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
    const body = req.body || {}
    const title = String(body.title || '').trim()
    if (!title) return res.status(400).json({ error: 'title is required' })
    const status = String(body.status || 'ACTIVE').trim().toUpperCase()
    if (!['ACTIVE', 'CLOSED', 'DRAFT'].includes(status)) {
      return res.status(400).json({ error: 'status must be ACTIVE, CLOSED, or DRAFT' })
    }
    const reference =
      String(body.reference || '').trim() ||
      `OFF-${String(campaign.code || 'PCA').toUpperCase()}-${Date.now()}`
    const description = mergeDescriptionWithLinkedinUrl(body.description, body.redirect_url)

    const row = (
      await query(
        `INSERT INTO offers (campaign_id, title, reference, description, location, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING id, campaign_id, title, reference, description, location, status`,
        [campaign.id, title, reference, description, body.location || null, status]
      )
    ).rows[0]

    await enforceOfferCampaignStrictRoutingByTitle()
    return res.status(201).json({
      offer: {
        id: row.id,
        campaignId: row.campaign_id,
        title: row.title,
        reference: row.reference,
        description: row.description,
        location: row.location,
        status: String(row.status || '').toLowerCase(),
        company: 'Payment Center For Africa - PCA',
        redirect_url: resolveOfferExternalUrl({
          reference: row.reference,
          title: row.title,
          description: row.description,
        }),
      },
    })
  } catch (e) {
    return res.status(500).json({ error: 'Failed to create offer', message: e.message })
  }
})

app.patch('/api/offers/:id', async (req, res) => {
  if (!useDb) return res.status(503).json({ error: 'Offer management requires PostgreSQL' })
  try {
    const rows = (
      await query(
        `SELECT id, campaign_id, title, reference, description, location, status
         FROM offers
         WHERE id::text = $1
         LIMIT 1`,
        [String(req.params.id)]
      )
    ).rows
    if (!rows.length) return res.status(404).json({ error: 'Offer not found' })
    const existing = rows[0]

    const body = req.body || {}
    const title = body.title != null ? String(body.title).trim() : existing.title
    const reference = body.reference != null ? String(body.reference).trim() : existing.reference
    const status = body.status != null ? String(body.status).trim().toUpperCase() : String(existing.status || '').toUpperCase()
    let nextCampaignId = existing.campaign_id
    if (body.campaignId != null || body.campaignCode != null) {
      const campaignKey = String(body.campaignId != null ? body.campaignId : body.campaignCode || '').trim()
      if (!campaignKey) return res.status(400).json({ error: 'campaignId/campaignCode cannot be empty' })
      const nextCampaign = await getCampaignByIdFromDb(campaignKey)
      if (!nextCampaign) return res.status(400).json({ error: 'Target campaign not found' })
      nextCampaignId = nextCampaign.id
    }
    const nextDescription = mergeDescriptionWithLinkedinUrl(
      body.description !== undefined ? body.description : existing.description,
      body.redirect_url
    )
    if (!title) return res.status(400).json({ error: 'title cannot be empty' })
    if (!reference) return res.status(400).json({ error: 'reference cannot be empty' })
    if (!['ACTIVE', 'CLOSED', 'DRAFT'].includes(status)) {
      return res.status(400).json({ error: 'status must be ACTIVE, CLOSED, or DRAFT' })
    }

    const row = (
      await query(
        `UPDATE offers
            SET campaign_id = $1,
                title = $2,
                reference = $3,
                description = $4,
                location = $5,
                status = $6,
                updated_at = NOW()
          WHERE id = $7
          RETURNING id, campaign_id, title, reference, description, location, status`,
        [
          nextCampaignId,
          title,
          reference,
          nextDescription,
          body.location !== undefined ? body.location : existing.location,
          status,
          existing.id,
        ]
      )
    ).rows[0]

    await enforceOfferCampaignStrictRoutingByTitle()
    return res.json({
      offer: {
        id: row.id,
        campaignId: row.campaign_id,
        title: row.title,
        reference: row.reference,
        description: row.description,
        location: row.location,
        status: String(row.status || '').toLowerCase(),
        company: 'Payment Center For Africa - PCA',
        redirect_url: resolveOfferExternalUrl({
          reference: row.reference,
          title: row.title,
          description: row.description,
        }),
      },
    })
  } catch (e) {
    return res.status(500).json({ error: 'Failed to update offer', message: e.message })
  }
})

app.delete('/api/offers/:id', async (req, res) => {
  if (!useDb) return res.status(503).json({ error: 'Offer management requires PostgreSQL' })
  try {
    const rows = (
      await query(`SELECT id FROM offers WHERE id::text = $1 LIMIT 1`, [String(req.params.id)])
    ).rows
    if (!rows.length) return res.status(404).json({ error: 'Offer not found' })
    await query(`DELETE FROM offers WHERE id = $1`, [rows[0].id])
    return res.json({ ok: true, deletedOfferId: rows[0].id })
  } catch (e) {
    return res.status(500).json({ error: 'Failed to delete offer', message: e.message })
  }
})

// ——— GET /api/hr-kpi — KPI RH pour dashboard (fallback safe) ———
app.get('/api/hr-kpi', async (req, res) => {
  try {
    const list = useDb ? await getCandidaturesFromDb() : candidatures
    const ivRows = useDb
      ? (await query(
          `SELECT id, candidature_id, scheduled_at, mode, location, status, notes_rh
           FROM interviews
           ORDER BY scheduled_at DESC, id DESC`
        )).rows.map((r) => ({
          id: r.id,
          candidatureId: r.candidature_id,
          scheduledAt: r.scheduled_at ? new Date(r.scheduled_at).toISOString() : null,
          mode: r.mode,
          location: r.location,
          status: r.status,
          notesRh: r.notes_rh,
        }))
      : interviews.map((i) => ({
          id: i.id,
          candidatureId: i.candidature_id,
          scheduledAt: i.scheduled_at || null,
          mode: i.mode,
          location: i.location,
          status: i.status,
          notesRh: i.notes_rh,
        }))

    const withInterview = new Set(ivRows.map((x) => String(x.candidatureId)))
    const byOffer = new Map()
    let retainedWithInterview = 0
    for (const c of list) {
      const offerLabel = normalizeOfferTitleInput(c.offerTitle) || 'Sans offre cible'
      if (!byOffer.has(offerLabel)) {
        byOffer.set(offerLabel, {
          offerLabel,
          applicationsCount: 0,
          retainedCount: 0,
          selectedForInterviewCount: 0,
          retainedWithInterviewCount: 0,
        })
      }
      const row = byOffer.get(offerLabel)
      row.applicationsCount += 1
      const hasIv = withInterview.has(String(c.id))
      if (hasIv) row.selectedForInterviewCount += 1
      if (String(c.decision || '').toUpperCase() === 'ACCEPTÉE' || String(c.decision || '').toUpperCase() === 'ACCEPTEE') {
        row.retainedCount += 1
        if (hasIv) {
          row.retainedWithInterviewCount += 1
          retainedWithInterview += 1
        }
      }
    }

    return res.json({
      totalApplicants: list.length,
      selectedForInterview: withInterview.size,
      retainedWithInterview,
      candidaturesWithTwoPlusInterviews: 0,
      medianSpanFirstToLastMs: null,
      avgSpanFirstToLastMs: null,
      candidaturesWithInterviewScheduled: withInterview.size,
      medianReceptionToLastInterviewMs: null,
      avgReceptionToLastInterviewMs: null,
      interviewSpanByCandidature: [],
      byOffer: [...byOffer.values()],
    })
  } catch (e) {
    console.error('[hr-kpi]', e.message)
    return res.json({
      totalApplicants: 0,
      selectedForInterview: 0,
      retainedWithInterview: 0,
      candidaturesWithTwoPlusInterviews: 0,
      medianSpanFirstToLastMs: null,
      avgSpanFirstToLastMs: null,
      candidaturesWithInterviewScheduled: 0,
      medianReceptionToLastInterviewMs: null,
      avgReceptionToLastInterviewMs: null,
      interviewSpanByCandidature: [],
      byOffer: [],
    })
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

// ——— GET /api/candidatures/cv-text — PDF MinIO → texte (sans auth, pour n8n)
app.get('/api/candidatures/cv-text', async (req, res) => {
  try {
    const candidateId = (req.query.candidateId || '').toString().trim()
    if (!candidateId) {
      return res.status(400).json({ error: 'candidateId query parameter required' })
    }
    const candidature = await getCandidatureByCandidateId(candidateId)
    if (!candidature) {
      return res.status(404).json({ error: 'Candidature not found', candidateId })
    }
    const pathCandidates = [
      candidature.cv_path,
      candidature.uploadUrl,
      candidature.cvPath,
      `/cvs/${candidature.candidateId || candidateId}`,
    ].filter(Boolean)

    let extracted = null
    for (const p of pathCandidates) {
      try {
        extracted = await fetchCVTextFromMinIO(p)
        if (extracted && extracted.text && extracted.text.length >= 20) break
      } catch (e) {
        // try next candidate path
      }
    }

    const text = extracted?.text || ''
    if (!text || text.length < 20) {
      return res.status(400).json({ error: 'CV text too short or empty', hint: 'Vérifiez le PDF sur MinIO.' })
    }
    return res.json({ text, candidateId, sourceUrl: extracted?.urlTried || null })
  } catch (e) {
    console.error('[cv-text]', e.message)
    return res.status(500).json({ error: 'Could not extract CV text', message: e.message })
  }
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

function normalizeCandidateNameInput(rawName, candidateEmail = '') {
  const raw = String(rawName || '').trim()
  if (!raw) return null
  // Convert "Name <email@x>" -> "Name"
  const stripped = raw.replace(/\s*<[^>]+>\s*/g, '').trim()
  if (!stripped) return null
  const n = stripped.toLowerCase()
  const emailLower = String(candidateEmail || '').toLowerCase().trim()
  const mailboxEmail = String(process.env.IMAP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER || '').toLowerCase().trim()
  const localParts = [
    emailLower.includes('@') ? emailLower.split('@')[0] : '',
    mailboxEmail.includes('@') ? mailboxEmail.split('@')[0] : '',
  ].filter(Boolean)

  // Reject obvious non-candidate placeholders/inbox owner echoes.
  if (
    /^(candidat|candidate|unknown|inconnu|n\/a|null|undefined|sans nom|test candidate|candidat test analyse)$/i.test(stripped) ||
    localParts.some((lp) => lp && (n === lp || n.includes(lp)))
  ) {
    return null
  }
  return stripped
}

function deriveCandidateNameFromEmail(candidateEmail = '') {
  const email = String(candidateEmail || '').trim().toLowerCase()
  if (!email.includes('@')) return null
  const local = email.split('@')[0].replace(/[._-]+/g, ' ').trim()
  if (!local) return null
  const bad = /^(candidat|candidate|unknown|inconnu|n\/a|null|undefined|sans nom|test candidate|candidat test analyse)$/i
  if (bad.test(local)) return null
  return local
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
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
    // Invitation / convocation d'entretien (emails RH sortants qui reviennent dans inbox)
    'invitation à un entretien', 'invitation a un entretien', 'convocation entretien',
    'entretien rh', 'entretien technique', 'entretien directeur',
    'nous vous invitons à un entretien', 'nous vous invitons a un entretien',
    'date et heure :', 'lieu / lien visio',
    /^alert\s*[-:]/, /security\s+alert/i,
    /invitation\s+[aà]\s+un\s+entretien/i,
    /convocation\s+(d['’]?\s*)?entretien/i,
    /\bentretien\s+(rh|technique|directeur)\b/i,
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
  // Règle métier RH: toute nouvelle candidature arrive "À REVOIR" par défaut.
  const decision = 'À REVOIR'
  const score = body.score != null ? Number(body.score) : undefined
  const candidateNameRaw = body.candidateName || body.candidat || ''
  const candidateName = normalizeCandidateNameInput(candidateNameRaw, email) || 'Candidat'
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
        businessUnit: body.businessUnit ?? body.business_unit,
      })
      return res.status(201).json(item)
    } catch (e) {
      console.error('[candidatures] insert:', e.message, e.code, e.detail || '')
      return res.status(500).json({ error: 'Database error', message: e.message })
    }
  }

  const maxId = candidatures.length === 0 ? 0 : Math.max(0, ...candidatures.map((c) => (typeof c.id === 'number' ? c.id : 0)))
  const id = typeof body.id === 'number' ? body.id : maxId + 1
  const buNew = normalizeBusinessUnitInput(body.businessUnit ?? body.business_unit)
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
    ...(buNew && buNew !== false ? { businessUnit: buNew } : {}),
  }
  candidatures.unshift(item)
  saveData()
  const uploadUrl = body.uploadUrl || `/cvs/${candidateId}`
  res.status(201).json({ ...item, uploadUrl })
})

// ——— PATCH /api/candidatures/:id — Mise à jour décision / score / BU (action RH) ———
app.patch('/api/candidatures/:id', async (req, res) => {
  const id = req.params.id
  const numId = parseInt(id, 10)
  if (!Number.isInteger(numId) || numId < 1) {
    return res.status(400).json({ error: 'Invalid id' })
  }

  const body = req.body || {}
  const buIn = normalizeBusinessUnitInput(body.businessUnit ?? body.business_unit)
  if (buIn === false) {
    return res.status(400).json({
      error: 'Invalid businessUnit',
      message: `Code BU attendu : ${[...PCA_BU_CODES].join(', ')}`,
    })
  }

  if (!useDb) {
    const c = candidatures.find((x) => Number(x.id) === numId)
    if (!c) return res.status(404).json({ error: 'Candidature not found' })
    if (body.decision) {
      let decision = String(body.decision).trim().toUpperCase()
      if (!['ACCEPTÉE', 'REFUSÉE', 'À REVOIR', 'NON_LISIBLE'].includes(decision)) {
        if (decision.includes('ACCEPTEE') || decision === 'ACCEPTED') decision = 'ACCEPTÉE'
        else if (decision.includes('REFUSEE') || decision === 'REFUSED') decision = 'REFUSÉE'
        else if (decision.includes('REVOIR') || decision === 'REVIEW') decision = 'À REVOIR'
        else if (decision.includes('NON_LISIBLE')) decision = 'NON_LISIBLE'
        else decision = 'À REVOIR'
      }
      c.decision = decision
    }
    if (body.score != null && !Number.isNaN(Number(body.score))) c.score = Number(body.score)
    if (buIn !== undefined) {
      if (buIn) c.businessUnit = buIn
      else delete c.businessUnit
    }
    saveData()
    const out = await getCandidatureById(numId)
    return res.json(out)
  }

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
  if (buIn !== undefined) {
    fields.push('business_unit')
    values.push(buIn)
  }

  if (!fields.length) {
    return res.status(400).json({ error: 'No updatable fields provided' })
  }

  fields.push('updated_at')
  values.push(new Date().toISOString())

  const setSql = fields.map((f, i) => `${f} = $${i + 1}`).join(', ')

  try {
    const result = await query(
      `UPDATE candidatures SET ${setSql} WHERE id = $${fields.length + 1} RETURNING ${CANDIDATURE_ROW_COLUMNS}`,
      [...values, numId]
    )
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Candidature not found' })
    }
    const out = mapCandidatureRow(result.rows[0])

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
  const fullNameRaw = (body.fullName || body.candidateName || body.candidat || '').trim()
  const fullName = normalizeCandidateNameInput(fullNameRaw, email) || 'Candidat'
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
    const fullNameRaw = (body.fullName || body.candidateName || '').trim()
    const fullName = normalizeCandidateNameInput(fullNameRaw, email) || 'Candidat Test Analyse'
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
        c.decision = decisionForApi(decisionFromAutoAnalysis(analysis.decision))
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
        decision: decisionForApi(decisionFromAutoAnalysis(analysis.decision)),
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

    const offerTitle = normalizeOfferTitleInput((req.body?.offerTitle || '').toString().trim()) || null
    const offerDescription = (req.body?.offerDescription || '').toString().trim() || null
    const offerContext = (req.body?.offerContext || '').trim() ||
      [offerTitle, offerDescription].filter(Boolean).map(String).join('. ')
    const analysis = await analyzeCVWithOpenAI(cvText, { offerContext: offerContext || undefined })

    if (useDb) {
      await updateCandidatureAnalysisInDb(id, analysis)
      // Sauvegarder aussi "Offre cible" + "Contexte offre" côté RH.
      // - offer_title = titre réel de l'offre associée
      // - offer_description = texte généré "offer_context" (cohérent avec le CV) fallback sur la description brute si absent
      const offerContextForDisplay = sanitizeOfferContextForDisplay({
        analysisOfferContext: analysis.offer_context,
        offerDescription,
        offerTitle,
        emailSubject: req.body?.emailSubject || '',
        fallbackSubject: candidature.subject || '',
        analysisSummary: analysis.summary,
        analysisSkills: analysis.skills,
        analysisExperience: analysis.experience,
      })
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
        c.decision = decisionForApi(decisionFromAutoAnalysis(analysis.decision))
        c.school = analysis.school || null
        c.schoolType = analysis.school_type || null
        c.phone = analysis.phone || null
        c.experienceCount = analysis.experience_count ?? null
        c.experienceDuration = analysis.experience_duration || null
        c.experienceYearsAvg = analysis.experience_years_avg ?? null
        c.lastEmployer = analysis.last_employer || null
        if (offerTitle) c.offerTitle = offerTitle
        const offerContextForDisplay = sanitizeOfferContextForDisplay({
          analysisOfferContext: analysis.offer_context,
          offerDescription,
          offerTitle,
          emailSubject: req.body?.emailSubject || '',
          fallbackSubject: candidature.subject || '',
          analysisSummary: analysis.summary,
          analysisSkills: analysis.skills,
          analysisExperience: analysis.experience,
        })
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
        decision: decisionForApi(decisionFromAutoAnalysis(analysis.decision)),
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

/** Enregistre l’analyse produite par OpenAI dans n8n (sans ré-appeler OpenAI côté PCA). */
async function handleAnalysisResultFromN8n(req, res) {
  try {
    const id = req.params.id
    const candidature = await getCandidatureById(id)
    if (!candidature) {
      return res.status(404).json({ error: 'Candidature not found', id })
    }
    const body = req.body || {}
    const analysis = normalizeAnalysisFields({
      summary: body.summary,
      skills: body.skills,
      experience: body.experience,
      strengths: body.strengths,
      risks: body.risks,
      score: body.score != null ? Number(body.score) : null,
      decision: body.decision,
      offer_context: body.offer_context,
      school: body.school,
      school_type: body.school_type,
      phone: body.phone,
      experience_count: body.experience_count,
      experience_duration: body.experience_duration,
      experience_years_avg: body.experience_years_avg != null ? Number(body.experience_years_avg) : null,
      last_employer: body.last_employer,
      cv_excerpt: body.cv_excerpt,
    })
    const offerTitle =
      normalizeOfferTitleInput((body.offerTitle || '').toString().trim()) ||
      normalizeOfferTitleInput((body.emailSubject || '').toString().trim()) ||
      normalizeOfferTitleInput((candidature.subject || '').toString().trim()) ||
      null
    const offerDescription = (body.offerDescription || '').toString().trim() || null
    // Global scoring calibration by offer family (campaign/offer-aware).
    // Protects from both under-rated and over-rated outcomes across ALL offers.
    {
      const roleText = `${offerTitle || ''} ${offerDescription || ''} ${body.emailSubject || ''}`.toLowerCase()
      const profileText = `${analysis.skills || ''} ${analysis.experience || ''} ${analysis.summary || ''}`.toLowerCase()
      if (Number.isFinite(Number(analysis.score))) {
        let adjusted = Number(analysis.score)
        const families = [
          {
            role: /(data engineer|data engineering|etl|airflow|data warehouse|bi)/,
            must: [/\bpython\b/, /\bsql\b/, /\b(airflow|etl|data warehouse|ssis|ssrs)\b/],
          },
          {
            role: /(ai|ml|nlp|machine learning|deep learning|scoring automation)/,
            must: [/\b(python|tensorflow|scikit-learn|pytorch)\b/, /\b(nlp|machine learning|deep learning|model)\b/, /\b(sql|power bi|tableau|etl)\b/],
          },
          {
            role: /(mobile|react native|spring boot|android|ios)/,
            must: [/\b(spring boot|springboot|java)\b/, /\b(react native|react-native|expo|android|ios)\b/],
          },
          {
            role: /(cloud|devops|sre|infra|aws|azure|gcp|kubernetes|docker)/,
            must: [/\b(aws|azure|gcp)\b/, /\b(docker|kubernetes|k8s|terraform|ci\/cd|jenkins)\b/],
          },
          {
            role: /(full[ -]?stack|web|frontend|backend|javascript|typescript|react|node)/,
            must: [/\b(javascript|typescript)\b/, /\b(react|angular|vue|node|express|spring)\b/],
          },
          {
            role: /(qa|test|automation|sdet)/,
            must: [/\b(test|qa|automation)\b/, /\b(selenium|cypress|playwright|junit|postman)\b/],
          },
          {
            role: /(ux|ui|designer|design)/,
            must: [/\b(figma|ui|ux)\b/, /\b(prototype|wireframe|design system)\b/],
          },
        ]
        for (const fam of families) {
          if (!fam.role.test(roleText)) continue
          const hit = fam.must.reduce((n, re) => n + (re.test(profileText) ? 1 : 0), 0)
          if (hit === 0) adjusted = Math.min(adjusted, 45)
          else if (hit === 1) adjusted = Math.min(adjusted, 55)
          else if (hit >= 2 && adjusted < 66) adjusted = 66
        }

        const isDataRole = /data engineer|data engineering|airflow|etl|pipeline/.test(roleText)
        if (isDataRole) {
          let bonus = 0
          if (/\bpython\b/.test(profileText)) bonus += 6
          if (/\bsql\b/.test(profileText)) bonus += 6
          if (/\b(airflow|etl|data warehouse|ssis|ssrs)\b/.test(profileText)) bonus += 8
          if (/\b(power bi|tableau)\b/.test(profileText)) bonus += 3
          const boosted = Math.max(0, Math.min(100, adjusted + bonus))
          adjusted = /\bpython\b/.test(profileText) && /\bsql\b/.test(profileText) && boosted < 70 ? 70 : boosted
        }

        const isMobileRole = /mobile|react native|spring boot|android|ios/.test(roleText)
        if (isMobileRole) {
          const hasSpringBoot = /spring boot|springboot|java/.test(profileText)
          const hasReactNative = /react native|react-native|expo|android|ios/.test(profileText)
          let mobileBonus = 0
          if (hasSpringBoot) mobileBonus += 6
          if (hasReactNative) mobileBonus += 6
          if (/\b(rest|jwt|postgres|mysql|api)\b/.test(profileText)) mobileBonus += 4
          adjusted = Math.max(0, Math.min(100, adjusted + mobileBonus))
          if (hasSpringBoot && hasReactNative && adjusted < 68) adjusted = 68
          if (!hasSpringBoot || !hasReactNative) adjusted = Math.min(adjusted, 55)
          if (!hasReactNative) adjusted = Math.min(adjusted, 50)
        }

        analysis.score = adjusted
      }
    }
    if (analysis.decision !== 'NON_LISIBLE') {
      if (analysis.score >= 78) analysis.decision = 'ACCEPTEE'
      else if (analysis.score <= 40) analysis.decision = 'REFUSEE'
      else analysis.decision = 'A REVOIR'
    }
    const finalDecision = decisionForApi(decisionFromAutoAnalysis(analysis.decision))
    const offerContextForDisplay = sanitizeOfferContextForDisplay({
      analysisOfferContext: analysis.offer_context,
      offerDescription,
      offerTitle,
      emailSubject: body.emailSubject || '',
      fallbackSubject: candidature.subject || '',
      analysisSummary: analysis.summary,
      analysisSkills: analysis.skills,
      analysisExperience: analysis.experience,
    })

    if (useDb) {
      await updateCandidatureAnalysisInDb(id, analysis)
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
      const candName =
        normalizeCandidateNameInput((body.candidate_name || '').toString().trim(), candidature.email || '') ||
        (finalDecision === 'NON_LISIBLE' ? deriveCandidateNameFromEmail(candidature.email || '') : null)
      if (candName) {
        await query(
          `UPDATE candidatures SET candidate_name = $1, updated_at = NOW() WHERE id = $2`,
          [candName, parseInt(id, 10)]
        )
      }

      // Real-time link candidature -> offer in DB table `candidature_offer`
      try {
        const linkLabel =
          String(offerTitle || '').trim() ||
          String(candidature.offerTitle || candidature.subject || '').trim()
        await upsertCandidatureOfferLink({
          candidatureId: parseInt(id, 10),
          offerTitle: linkLabel,
          offerMatchScore: body.offerMatchScore,
        })
      } catch (linkErr) {
        console.warn('[analysis-result] candidature_offer link skipped:', linkErr.message)
      }
    } else {
      const c = candidatures.find((x) => x.id === parseInt(id, 10))
      if (c) {
        if (analysis.summary != null) c.rawSummary = analysis.summary
        if (analysis.skills != null) c.skills = analysis.skills
        if (analysis.experience != null) c.experience = analysis.experience
        if (analysis.score != null && !Number.isNaN(analysis.score)) c.score = analysis.score
        c.decision = decisionForApi(decisionFromAutoAnalysis(analysis.decision))
        if (analysis.school != null) c.school = analysis.school
        if (analysis.school_type != null) c.schoolType = analysis.school_type
        if (analysis.phone != null) c.phone = analysis.phone
        if (analysis.experience_count != null) c.experienceCount = analysis.experience_count
        if (analysis.experience_duration != null) c.experienceDuration = analysis.experience_duration
        if (analysis.experience_years_avg != null) c.experienceYearsAvg = analysis.experience_years_avg
        if (analysis.last_employer != null) c.lastEmployer = analysis.last_employer
        if (offerTitle) c.offerTitle = offerTitle
        if (offerContextForDisplay) c.offerDescription = offerContextForDisplay
        const candName =
          normalizeCandidateNameInput((body.candidate_name || '').toString().trim(), c.email || '') ||
          (finalDecision === 'NON_LISIBLE' ? deriveCandidateNameFromEmail(c.email || '') : null)
        if (candName) c.candidateName = candName
        saveData()
      }
    }

    console.log('[analysis-result] Candidature', id, '→', finalDecision, 'score', analysis.score)
    const updated = await getCandidatureById(id)
    return res.json({ ok: true, candidature: updated })
  } catch (e) {
    console.error('[analysis-result]', e.message)
    return res.status(500).json({ error: 'Failed to save analysis', message: e.message })
  }
}

// ——— POST /api/candidatures/:id/analysis-result ——— Résultat LLM depuis n8n (sans auth)
app.post('/api/candidatures/:id/analysis-result', handleAnalysisResultFromN8n)

// ——— API Entretiens (interviews) ———
// Modèle attendu en base (table interviews) :
// id (serial), candidature_id (int), scheduled_at (timestamptz), mode (text), location (text), status (text), notes_rh (text)

/** Webhook n8n : .env peut utiliser N8N_INTERVIEW_WEBHOOK_URL (unique) ou N8N_INTERVIEW_WEBHOOK_URL_RH / _TECHNIQUE / _DIRECTEUR. */
function resolveInterviewWebhookUrl(body = {}) {
  const raw = (body.interviewType || body.interview_type || '').toString().trim().toUpperCase()
  let specific = ''
  if (raw.includes('DIRECTEUR')) specific = process.env.N8N_INTERVIEW_WEBHOOK_URL_DIRECTEUR || ''
  else if (raw.includes('TECHNIQUE')) specific = process.env.N8N_INTERVIEW_WEBHOOK_URL_TECHNIQUE || ''
  else specific = process.env.N8N_INTERVIEW_WEBHOOK_URL_RH || ''
  specific = String(specific || '').trim()
  if (specific) return specific
  return String(process.env.N8N_INTERVIEW_WEBHOOK_URL || '').trim()
}

function interviewTypeBucket(notesRh) {
  const raw = String(notesRh || '').toUpperCase()
  if (raw.includes('DIRECT')) return 'DIRECTEUR'
  if (raw.includes('TECH')) return 'TECHNIQUE'
  return 'RH'
}

function interviewTimeValue(row) {
  if (row && row.scheduled_at) {
    const t = new Date(row.scheduled_at).getTime()
    if (!Number.isNaN(t)) return t
  }
  return 0
}

function latestByInterviewType(rows) {
  const out = {}
  for (const r of rows || []) {
    const key = interviewTypeBucket(r.notes_rh)
    const prev = out[key]
    if (!prev) {
      out[key] = r
      continue
    }
    const ta = interviewTimeValue(prev)
    const tb = interviewTimeValue(r)
    if (tb > ta || (tb === ta && Number(r.id || 0) > Number(prev.id || 0))) {
      out[key] = r
    }
  }
  return out
}

function allInterviewStepsValidated(rows) {
  const latest = latestByInterviewType(rows)
  return ['RH', 'TECHNIQUE', 'DIRECTEUR'].every((k) => {
    const row = latest[k]
    return row && String(row.status || '').toUpperCase() === 'REALISE'
  })
}

async function autoAcceptIfAllInterviewsValidated(candidatureId) {
  const cid = parseInt(String(candidatureId), 10)
  if (!Number.isInteger(cid) || cid < 1) return false
  if (useDb) {
    const rowsRes = await query(
      `SELECT id, scheduled_at, status, notes_rh
       FROM interviews
       WHERE candidature_id = $1`,
      [cid]
    )
    const rows = rowsRes.rows || []
    if (!allInterviewStepsValidated(rows)) return false
    await query(
      `UPDATE candidatures
       SET decision = $1, updated_at = NOW()
       WHERE id = $2`,
      [decisionForDb('ACCEPTÉE'), cid]
    )
    return true
  }
  const rows = (interviews || []).filter((i) => Number(i.candidature_id) === cid)
  if (!allInterviewStepsValidated(rows)) return false
  const c = candidatures.find((x) => Number(x.id) === cid)
  if (!c) return false
  c.decision = 'ACCEPTÉE'
  saveData()
  return true
}

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

  const interviewTypeLabel =
    (body.interviewType || body.interview_type || 'ENTRETIEN RH').toString().trim() || 'ENTRETIEN RH'

  try {
    let row
    if (useDb) {
      const result = await query(
        `INSERT INTO interviews (candidature_id, scheduled_at, mode, location, status, notes_rh)
         VALUES ($1, $2::timestamptz, $3, $4, 'PLANIFIE', $5)
         RETURNING id, candidature_id, scheduled_at, mode, location, status, notes_rh`,
        [numId, scheduledAt.toISOString(), mode, location, interviewTypeLabel]
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
        notes_rh: interviewTypeLabel,
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
    const webhookUrl = resolveInterviewWebhookUrl(body)
    if (webhookUrl) {
      const relatedCandidature = await getCandidatureById(numId)
      const payload = {
        interviewId: out.id,
        candidatureId: out.candidatureId,
        scheduledAt: out.scheduledAt,
        mode: out.mode,
        location: out.location,
        status: out.status,
        interviewType: interviewTypeLabel,
        emailBody: typeof body.emailBody === 'string' ? body.emailBody.trim() : '',
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
    const list = (interviews || [])
      .map((row) => {
        const c = candidatures.find((x) => Number(x.id) === Number(row.candidature_id))
        return {
          id: row.id,
          candidatureId: row.candidature_id,
          scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : null,
          mode: row.mode,
          location: row.location,
          status: row.status,
          notesRh: row.notes_rh,
          candidateName: c?.candidateName || null,
          email: c?.email || null,
          subject: c?.subject || null,
        }
      })
      .filter((i) => !statusFilter || String(i.status || '').toUpperCase() === statusFilter)
    return res.json({ interviews: list })
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
    const list = (interviews || [])
      .filter((i) => Number(i.candidature_id) === numId)
      .map((row) => ({
        id: row.id,
        candidatureId: row.candidature_id,
        scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : null,
        mode: row.mode,
        location: row.location,
        status: row.status,
        notesRh: row.notes_rh,
      }))
    return res.json({ interviews: list })
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

    if (String(out.status || '').toUpperCase() === 'REALISE') {
      try {
        const changed = await autoAcceptIfAllInterviewsValidated(out.candidatureId)
        if (changed) {
          console.log('[interviews] auto-decision:', out.candidatureId, '-> ACCEPTÉE (3/3 validés)')
        }
      } catch (e) {
        console.warn('[interviews] auto-decision failed:', e.message)
      }
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

function isCurrentDateTimeQuestion(message) {
  const t = String(message || '').toLowerCase()
  if (!t) return false
  // Avoid false positives such as "time to hire/interview"
  if (/\btime\s*to\s*(hire|interview)\b/.test(t)) return false
  // If user asks about platform entities, do not short-circuit to date/time answer.
  if (/\b(candidatures?|applications?|dashboard|tableau de bord|offres?|campagnes?|entretiens?|interviews?|statistiques?|kpi|indicateurs?)\b/.test(t)) return false
  const hasDateIntent = /\b(today|aujourd(?:'|’)hui|aujourd|lyom|lyoum|date|day|jour|quel jour|chno nhar|nhar)\b/.test(t)
  const hasClockIntent = /\b(time|hour|heure|sa3a|clock|daba)\b/.test(t)
  const hasQuestionIntent = /\b(chno|chnoo|shno|ashno|wach|what|quel|quelle)\b/.test(t)
  // Date-only questions should behave like explicit datetime asks only when no domain intent exists.
  return (hasDateIntent || hasClockIntent) && (hasQuestionIntent || hasClockIntent)
}

function buildCurrentDateTimeAnswer(message) {
  const t = String(message || '').toLowerCase()
  const isDarija = /\b(chno|shno|ashno|wach|lyom|lyoum|nhar|sa3a|daba)\b/.test(t)
  const isEnglish = /\b(today|date|day|time|hour)\b/.test(t)
  const locale = isEnglish ? 'en-GB' : 'fr-FR'
  const tz = process.env.ASSISTANT_TIMEZONE || 'Africa/Casablanca'
  const now = new Date()
  const day = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: tz }).format(now)
  const fullDate = new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tz }).format(now)
  const fullTime = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: tz }).format(now)

  if (isEnglish) {
    return { answer: `Today is ${day}, ${fullDate}. Current time is ${fullTime} (${tz}).`, language: 'en' }
  }
  if (isDarija) {
    return { answer: `Lyom howa ${day}. Date: ${fullDate}. Sa3a daba: ${fullTime} (${tz}).`, language: 'darija' }
  }
  return { answer: `Aujourd'hui c'est ${day}. Date: ${fullDate}. Heure actuelle: ${fullTime} (${tz}).`, language: 'fr' }
}

function isLikelyAssistantNoiseCandidature(row) {
  const email = String(row?.email || '').toLowerCase().trim()
  const subject = String(row?.subject || '').toLowerCase().trim()
  const name = String(row?.candidateName || row?.candidate_name || '').toLowerCase().trim()

  const isNoReply = /\b(no-?reply|noreply|do-?not-?reply)\b/.test(email)
  const hasInvoiceSignals = /\b(invoice|facture|receipt|billing|payment|paiement|google cloud platform & apis)\b/.test(subject)
  const isGenericCandidate = !name || name === 'candidat' || name === 'candidate'
  const hasNoScore = row?.score == null
  const reviewLikeDecision = String(row?.decision || '').toUpperCase().includes('REVOIR')

  // Strictly target operational noise only; keep normal candidatures.
  if (isNoReply && hasInvoiceSignals) return true
  if (isNoReply && isGenericCandidate && hasNoScore && reviewLikeDecision) return true
  return false
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
    if (isCurrentDateTimeQuestion(message)) {
      return res.json(buildCurrentDateTimeAnswer(message))
    }

    const lower = message.toLowerCase()
    const openaiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()
    const wantsWebSearch = /\bweb\s*search|websearch|recherche web|temps r[eé]el|real[-\s]?time|google|linkedin\b/.test(lower)
    if (wantsWebSearch) {
      const serperKey = process.env.SERPER_API_KEY && process.env.SERPER_API_KEY.trim()
      if (!serperKey) {
        return res.json({
          answer: 'La recherche web n’est pas activée côté serveur. Ajoutez `SERPER_API_KEY` dans `.env`, puis redémarrez l’API.',
          language: 'fr',
        })
      }
      const web = await searchWebResults(message, { maxResults: 6 })
      if (!web.length) {
        return res.json({
          answer: 'Je n’ai trouvé aucun résultat web exploitable pour cette requête (ou la recherche est temporairement indisponible).',
          language: 'fr',
        })
      }
      if (openaiKey) {
        try {
          const compact = web
            .map((r, i) => `${i + 1}. ${r.title}\nURL: ${r.link}\nExtrait: ${r.snippet}`)
            .join('\n\n')
          const prompt = `Question utilisateur: ${message}

Résultats web (temps réel):
${compact}

Réponds en français (ou la langue de l'utilisateur), de façon directe et concise.
Utilise uniquement les résultats web ci-dessus. Ajoute les URLs utilisées à la fin.`
          const { answer } = await chatGeneralOpenAI(prompt, { max_tokens: 900 })
          return res.json({ answer, language: 'fr' })
        } catch (e) {
          // Fallback texte brut si OpenAI indisponible
        }
      }
      const lines = web
        .map((r, i) => `- ${i + 1}) ${r.title || 'Résultat'}\n  ${r.link}${r.snippet ? `\n  ${r.snippet}` : ''}`)
        .join('\n')
      return res.json({ answer: `Résultats web trouvés:\n${lines}`, language: 'fr' })
    }
    // Considérer davantage de variantes (anglais + fautes) comme des questions PCA
    const looksLikePersonName = /^[a-zàâäéèêëïîôùûüA-ZÀÂÄÉÈÊËÏÎÔÙÛÜ][\w'’\-àâäéèêëïîôùûü]{1,30}(?:\s+[a-zàâäéèêëïîôùûüA-ZÀÂÄÉÈÊËÏÎÔÙÛÜ][\w'’\-àâäéèêëïîôùûü]{1,30}){1,4}\s*$/i.test(message.trim())
    const isPcaQuestion = /\bpca\b|dashboard|tableau de bord|candidature|candidatures|campagnes?|offres?\b|offers?\b|recrutements?|emploi|entretiens?|entreties|interviews?|rdv|rendez[\s-]?vous|cv|n8n|minio|plateforme|plateform|platform|api\/candidatures|api\/campaigns|api\/interviews|kpi|indicateurs?|statut|decision|d[eé]cision|score|\bbu\b|business\s*unit|synth[eè]se|r[eé]sum[eé]|summary|contexte\s*offre|nombre\s*d.?exp[eé]rience|dur[ée]e\s*d.?exp[eé]rience|experience\s*count|experience\s*duration|dernier\s*employeur|[ée]cole|school|phone|t[eé]l|email|e-mail|mail|adresse\s*(mail|email)|time to interview|time to hire|offre cible|offres cibles|stage\s*pfe|stages\s*pfe|\bpfe\b|ajout[eé]es?\s+aujourd|aujourd(?:'|’)hui|today|hier|yesterday|postulants?|base\s*rh|pipeline|retenus?|sans entretien|dur[ée]e?\s*moyenne|m[eé]diane|reception candidature|date de reception|date\s*reception|reception\s*date|reception\s+pour|date d.?ajout|ajout[eé]e?\s+le|\bresultat\b/.test(lower) || looksLikePersonName

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
      const toItem = (c) => ({
        id: c.id,
        candidateId: c.candidateId,
        candidateName: c.candidateName,
        email: c.email,
        subject: c.subject,
        offerTitle: c.offerTitle,
        offerDescription: c.offerDescription,
        date: c.date,
        businessUnit: c.businessUnit,
        decision: c.decision,
        rawSummary: c.rawSummary,
        school: c.school,
        schoolType: c.schoolType,
        phone: c.phone,
        lastEmployer: c.lastEmployer,
        experienceCount: c.experienceCount,
        experienceDuration: c.experienceDuration,
        experienceYearsAvg: c.experienceYearsAvg,
        score: c.score,
      })

      // Keep KPI totals aligned with dashboard cards (full DB list),
      // while detailed assistant lists stay noise-filtered.
      const allItemsRaw = list.map(toItem)
      const assistantList = list.filter((c) => !isLikelyAssistantNoiseCandidature(c))
      const allItemsFiltered = assistantList.map(toItem)

      const accepted = allItemsRaw.filter((c) => {
        const d = String(c.decision || '').toUpperCase()
        return d === 'ACCEPTÉE' || d === 'ACCEPTEE' || d === 'ACCEPTED'
      }).length
      const refused = allItemsRaw.filter((c) => {
        const d = String(c.decision || '').toUpperCase()
        return d === 'REFUSÉE' || d === 'REFUSEE' || d === 'REFUSED'
      }).length
      const toReview = allItemsRaw.filter((c) => (c.decision || '').toUpperCase() === 'À REVOIR' || (c.decision || '').includes('REVOIR')).length
      const nonLisible = allItemsRaw.filter((c) => (c.decision || '').toUpperCase() === 'NON_LISIBLE' || (c.decision || '').includes('NON')).length

      context.total = allItemsRaw.length
      context.accepted = accepted
      context.refused = refused
      context.toReview = toReview
      context.nonLisible = nonLisible
      context.items = allItemsFiltered
      context.itemsRaw = allItemsRaw
    }

    try {
      let campaigns = []
      const allOffers = []
      if (useDb) {
        // Keep RAG fully aligned with platform pages (/api/campaigns and /api/campaigns/:id/offers).
        campaigns = await getCampaignsFromDb()
        for (const camp of campaigns || []) {
          const offers = await getOffersByCampaignFromDb(camp.id)
          for (const o of offers || []) {
            allOffers.push({ ...o, campaignName: camp.name, campaignCode: camp.code })
          }
        }
      } else {
        campaigns = await getAdzunaCampaigns()
        for (const camp of campaigns || []) {
          const offers = await getAdzunaOffers(camp.id)
          for (const o of offers || []) {
            allOffers.push({ ...o, campaignName: camp.name, campaignCode: camp.code })
          }
        }
      }
      context.campaigns = campaigns || []
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
    // For PCA-domain questions, always return real-time grounded answer directly
    // from platform context (candidatures, interviews, campaigns, offers, KPIs).
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
  console.log('GET  http://localhost:' + PORT + '/api/offers/catalog  (all offers, n8n)')
  console.log('GET  http://localhost:' + PORT + '/api/candidatures')
  console.log('GET  http://localhost:' + PORT + '/api/candidatures/cv-text?candidateId=…  (PDF→texte, n8n)')
  console.log('POST http://localhost:' + PORT + '/api/candidatures')
  console.log('POST http://localhost:' + PORT + '/api/test/candidatures  (mock, no auth)')
  console.log('POST http://localhost:' + PORT + '/api/candidatures/:id/analyze  (OpenAI CV analysis, no auth)')
  console.log('POST http://localhost:' + PORT + '/api/candidatures/:id/analysis-result  (résultat LLM n8n → DB)')
  console.log('POST http://localhost:' + PORT + '/api/test/analyze  (test: create + analyze with body.text)')
  console.log('Swagger UI http://localhost:' + PORT + '/docs')
  if (useDb) console.log('Database: PostgreSQL (DATABASE_URL)')
  else console.log('Database: JSON files (server/data)')
  backfillCandidatureOfferLinksFromExistingData().catch(() => {})
  enforceOfferCampaignCanonicalRouting().catch(() => {})
  enforceOfferCampaignStrictRoutingByTitle().catch(() => {})
  testKeycloakAdminConnection().catch(() => {})
})
