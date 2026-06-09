/**
 * OpenAI Chat Completions (for RAG + LLM assistant).
 * Uses OPENAI_API_KEY from environment. Native fetch — no extra dependencies.
 * If OPENAI_API_KEY is not set, caller falls back to RAG-only.
 * Optionally uses web search (SERPER_API_KEY) to improve school_type (public/privé).
 */

import { searchSchoolType } from './web-search.js'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

function normalizeSpaces(s) {
  return String(s || '').replace(/\s+/g, ' ').trim()
}

function extractPhoneFromText(cvText) {
  const txt = String(cvText || '')
  // Formats marocains courants: +212 6XXXXXXXX, 06XXXXXXXX, avec espaces/points/tirets
  const morocco = txt.match(/(?:\+212|0)\s*[5-7]\d(?:[\s.\-]?\d{2}){4}/)
  if (morocco && morocco[0]) return normalizeSpaces(morocco[0])
  // Fallback générique (8+ digits), éviter dates/années courtes
  const generic = txt.match(/\+?\d[\d\s.\-]{7,}\d/)
  return generic && generic[0] ? normalizeSpaces(generic[0]) : null
}

function extractSchoolFromText(cvText) {
  const txt = String(cvText || '')
  const patterns = [
    /(?:EMSI[^\n]*)/i,
    /(?:ENSA[^\n]*)/i,
    /(?:Facult[ée][^\n]*)/i,
    /(?:[ÉE]cole[^\n]*)/i,
    /(?:University[^\n]*)/i,
  ]
  for (const p of patterns) {
    const m = txt.match(p)
    if (m && m[0]) return normalizeSpaces(m[0])
  }
  return null
}

function fallbackSchoolTypeFromName(school) {
  const s = String(school || '').toLowerCase()
  if (!s) return null
  if (/\bemsi\b|\bprivate\b|priv[ée]/i.test(s)) return 'PRIVE'
  if (/\bensa\b|\bfacult[ée]\b|\buniversit[ée]\b|nationale/i.test(s)) return 'PUBLIC'
  return null
}

function extractExperienceCountFromText(cvText) {
  const txt = String(cvText || '')
  const matches = txt.match(/(?:stagiaire|stage|développeur|developer|engineer|ingénieur)/gi) || []
  if (matches.length === 0) return null
  // borne haute pour éviter les faux positifs
  return Math.min(matches.length, 12)
}

function extractLastEmployerFromText(cvText) {
  const txt = String(cvText || '')
  // Ex: "Stagiaire Développeur ...\nIZORAI" ou "Full Stack Developer – Partisoft"
  const linePattern = /(?:Stagiaire|Stage|Développeur|Developer|Engineer|Ingénieur)[^\n–-]{0,80}[–-]\s*([^\n,]+)/gi
  let lastMatch = null
  let m
  while ((m = linePattern.exec(txt)) !== null) {
    if (m[1]) lastMatch = normalizeSpaces(m[1])
  }
  if (lastMatch) return lastMatch

  // Pattern entreprise seule sur ligne après poste (cas CV template)
  const lines = txt.split('\n').map((l) => l.trim()).filter(Boolean)
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (/(stagiaire|stage|développeur|developer|engineer|ingénieur)/i.test(lines[i])) {
      const next = lines[i + 1]
      if (next && !/(agadir|casablanca|rabat|\d{4}|profil|formation|projets?)/i.test(next)) {
        return normalizeSpaces(next)
      }
    }
  }
  return null
}

/**
 * Call OpenAI Chat Completions with PCA/RAG context.
 * @param {string} userMessage - User's message
 * @param {string} ragContext - Context from RAG (answer or knowledge summary) to guide the model
 * @param {{ model?: string, max_tokens?: number }} [options]
 * @returns {Promise<{ answer: string }>}
 */
async function _callOpenAI(userMessage, ragContext, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }

  const model = options.model || 'gpt-4o-mini'
  const maxTokens = options.max_tokens ?? 1024

  const systemContent =
    `You are the PCA (Payment Center for Africa) HR assistant. You answer in French, English, or Moroccan Darija depending on the user's language. Be precise and use only the data provided in the CONTEXT.

The CONTEXT below contains **only real data** from the PCA platform: candidatures (with names, emails, subjects, decisions, school, phone, last employer, score), recruitment campaigns, job offers, and interviews (scheduled, completed, cancelled). You must:
- Base your answers **only** on what appears in the CONTEXT. Never invent names, emails, subjects, dates, decisions, campaigns, offers or interviews.
- When the RH asks for candidatures (recent, detailed, list): use exactly the candidatures from the CONTEXT; include school, phone, last employer, score when available; if the CONTEXT has fewer items than asked, say how many are available and list only those.
- When the RH asks for campaigns or offers: use only the campaigns/offers listed in the CONTEXT (names, codes, number of offers).
- When the RH asks for entretiens/interviews: use only the interviews listed in the CONTEXT (candidate, subject, date, mode, status).
- If the requested data is not in the CONTEXT, say clearly that it is not available. Do not fabricate examples.
- Never contradict the numbers, decisions or details in the CONTEXT.
Answer as a helpful HR assistant for PCA using this real data.\n\nCONTEXT (real PCA data):\n${ragContext || 'No specific context.'}`.trim()

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: userMessage },
      ],
    }),
    signal: controller.signal,
  })

  clearTimeout(timeoutId)

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const msg = data?.error?.message || response.statusText || `HTTP ${response.status}`
    throw new Error(msg)
  }

  const choice = data.choices && data.choices[0]
  const content = choice && choice.message && choice.message.content
  if (typeof content !== 'string') {
    throw new Error('Invalid OpenAI response: no content')
  }
  return { answer: content.trim() }
}

export async function chatWithOpenAI(userMessage, ragContext, options = {}) {
  try {
    return await _callOpenAI(userMessage, ragContext, options)
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('OpenAI request timeout')
    }
    throw err
  }
}

/**
 * General-purpose OpenAI chat without PCA context.
 * Used when the user asks a question complètement hors plateforme (ex: Banque BCP).
 * @param {string} userMessage
 * @param {{ model?: string, max_tokens?: number }} [options]
 * @returns {Promise<{ answer: string }>}
 */
export async function chatGeneralOpenAI(userMessage, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')

  const model = options.model || 'gpt-4o-mini'
  const maxTokens = options.max_tokens ?? 768

  const systemContent = `You are a helpful AI assistant. You can answer any general question using your own knowledge.
You may answer in French, English or Moroccan Darija depending on the user's language.
Do not mention PCA or any internal platform unless the user explicitly asks about it.`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: userMessage },
      ],
    }),
    signal: controller.signal,
  })

  clearTimeout(timeoutId)

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const msg = data?.error?.message || response.statusText || `HTTP ${response.status}`
    throw new Error(msg)
  }

  const choice = data.choices && data.choices[0]
  const content = choice && choice.message && choice.message.content
  if (typeof content !== 'string') {
    throw new Error('Invalid OpenAI response: no content')
  }
  return { answer: content.trim() }
}

/**
 * À partir d'extraits web (recherche Serper), demande à OpenAI de déduire si l'établissement est PUBLIC ou PRIVE.
 * @param {string[]} snippets - Extraits de résultats de recherche
 * @param {string} schoolName - Nom de l'école
 * @param {string} apiKey - Clé OpenAI
 * @param {string} model - Modèle à utiliser
 * @returns {Promise<'PUBLIC'|'PRIVE'|null>}
 */
async function inferSchoolTypeFromWebSnippets(snippets, schoolName, apiKey, model) {
  const text = snippets.slice(0, 6).join('\n\n')
  if (!text.trim()) return null
  const system = `Tu es un expert. À partir UNIQUEMENT des extraits de recherche web ci-dessous concernant l'établissement "${schoolName}", détermine si c'est un établissement PUBLIC (université publique, école d'État) ou PRIVE (école privée, business school, école d'ingénieurs privée). Réponds par un seul mot : PUBLIC, PRIVE ou INCONNU si les extraits ne permettent pas de trancher.`
  const user = `Extraits :\n${text}\n\nRéponse (PUBLIC, PRIVE ou INCONNU) :`
  try {
    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: 10,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
      signal: AbortSignal.timeout(15000),
    })
    const data = await res.json().catch(() => ({}))
    const content = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || ''
    const word = content.trim().toUpperCase().replace(/\u00C9/g, 'E')
    if (word.startsWith('PUBLIC')) return 'PUBLIC'
    if (word.startsWith('PRIVE') || word.startsWith('PRIVÉ')) return 'PRIVE'
    return null
  } catch {
    return null
  }
}

/**
 * Analyse un CV (texte) avec OpenAI : résumé pro FR, compétences (dont stacks IT), expérience détaillée, score, décision.
 * Extraction : école, type école (public/privé), téléphone, nombre et durée d'expérience, dernier employeur.
 * Si SERPER_API_KEY est défini, une recherche web est faite pour améliorer school_type (public/privé).
 * Si offerContext est fourni, le score et la décision sont basés sur l'adéquation à cette offre.
 * @param {string} cvText - Texte brut du CV
 * @param {{ model?: string, max_tokens?: number, offerContext?: string }} [options]
 * @returns {Promise<{ summary, skills, experience, strengths, risks, score, decision, offer_context, school, school_type, phone, experience_count, experience_duration, last_employer }>}
 */
export async function analyzeCVWithOpenAI(cvText, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')

  const model = options.model || process.env.OPENAI_CV_MODEL || 'gpt-4.1'
  const maxTokens = options.max_tokens ?? 2800
  const offerContext = (options.offerContext || '').trim()

  const offerInstruction = offerContext
    ? `\n\nOFFRE CIBLE (évalue l'adéquation du CV par rapport à cette offre) :\n${offerContext}\n\nLe score (0-100) et la décision doivent refléter l'adéquation du candidat à CETTE offre.`
    : '\n\nLe score (0-100) reflète l\'adéquation à un poste type (générique).'

  const systemContent = `Tu es un expert RH. Analyse le CV fourni et réponds UNIQUEMENT en JSON valide (pas de texte avant/après) avec exactement ces clés :

- summary: résumé professionnel en français (2-4 phrases)
- skills: compétences principales avec les STACKS IT explicites si présents (ex: JavaScript, React, Node.js, Python, SQL, AWS, Docker, etc.). Liste en français, séparées par des virgules. Si aucun stack IT, indique les compétences métier.
- experience: UNE SEULE chaîne de caractères (texte libre) décrivant les expériences (postes, entreprises, durées, missions). Pas un tableau ni un objet. Exemple: "Développeur chez Wovoiture (2023–présent). Stage chez X (2022)."
- strengths: points forts (liste courte)
- risks: points d'attention ou manques (liste courte, ou "Aucun" si rien)
- score: nombre entre 0 et 100 (adéquation au poste)
- decision: une seule valeur parmi "ACCEPTEE", "REFUSEE", "A REVOIR", "NON_LISIBLE"
- offer_context: texte en français (1-3 phrases) décrivant le "Contexte offre" pour ce candidat, cohérent avec l'offre cible (offerContext) ET basé sur le CV. Doit être formulé comme : "Recherche d’une opportunité pour ..." et mentionner 1-2 axes liés aux compétences/expériences du candidat.

Extraction candidat (à partir du CV uniquement) :
- school: nom de l'établissement de formation principal (école, université, grande école). Chaîne vide si non trouvé.
- school_type: "PUBLIC" ou "PRIVE" selon la nature réelle de l'établissement. RÈGLES: Universités publiques et écoles d'État = PUBLIC. Toute école privée (marocaine ou non), business school, école d'ingénieurs privée = PRIVE. Exemples à classer PRIVE: EMSI (École Marocaine des Sciences de l'Ingénieur), INSEA (si privé), écoles des sciences de l'ingénieur privées, HEC, ESC, etc. En cas de doute pour une école marocaine ou une "école des sciences de l'ingénieur", mets PRIVE. Si inconnu ou ambigu: null.
- phone: numéro de téléphone du candidat si présent (format libre). Chaîne vide si absent.
- experience_count: nombre d'expériences professionnelles ou stages listés (entier, 0 si aucune)
- experience_duration: durée totale d'expérience en texte (ex: "3 ans", "1 an 6 mois", "6 mois")
- experience_years_avg: nombre décimal = durée totale en années (ex: 2.5 pour 2 ans 6 mois). null si aucune expérience.
- last_employer: nom du dernier employeur ou entreprise actuelle. Chaîne vide si non trouvé.
${offerInstruction}`

  const userContent = `Analyse ce CV et retourne le JSON demandé:\n\n${(cvText || '').slice(0, 12000)}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000)

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
    }),
    signal: controller.signal,
  })

  clearTimeout(timeoutId)

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const msg = data?.error?.message || response.statusText || `HTTP ${response.status}`
    throw new Error(msg)
  }

  const choice = data.choices && data.choices[0]
  const content = choice && choice.message && choice.message.content
  if (typeof content !== 'string') throw new Error('Invalid OpenAI response: no content')

  let parsed
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('OpenAI analysis: invalid JSON')
  }

  // OpenAI peut renvoyer des tableaux ou objets — on normalise en string lisible
  const toStr = (v) => {
    if (v == null) return ''
    if (typeof v === 'string') return v.trim()
    if (Array.isArray(v)) {
      return v
        .map((x) => {
          if (typeof x === 'string') return x
          if (x != null && typeof x === 'object') {
            const parts = [x.company, x.employer, x.role, x.title, x.duration, x.description].filter(Boolean)
            if (parts.length) return parts.join(' — ')
            return JSON.stringify(x)
          }
          return String(x)
        })
        .join(' · ')
        .trim()
    }
    if (typeof v === 'object') return JSON.stringify(v).replace(/^\[|\]$/g, '').trim() || ''
    return String(v).trim()
  }

  const score = typeof parsed.score === 'number' ? parsed.score : parseInt(parsed.score, 10)
  const decision = (parsed.decision || 'A REVOIR').toString().trim().toUpperCase()
  const validDecision = ['ACCEPTEE', 'REFUSEE', 'A REVOIR', 'NON_LISIBLE'].includes(decision) ? decision : 'A REVOIR'

  let schoolType = (parsed.school_type || '').toString().trim().toUpperCase()
  if (schoolType !== 'PUBLIC' && schoolType !== 'PRIVE') schoolType = null

  const schoolName = toStr(parsed.school)
  if (schoolName && process.env.SERPER_API_KEY && process.env.SERPER_API_KEY.trim()) {
    try {
      const snippets = await searchSchoolType(schoolName)
      if (snippets.length > 0) {
        const inferred = await inferSchoolTypeFromWebSnippets(snippets, schoolName, apiKey, model)
        if (inferred === 'PUBLIC' || inferred === 'PRIVE') schoolType = inferred
      }
    } catch (e) {
      console.warn('[analyze CV] Web search for school_type:', e.message)
    }
  }

  let expCount = parsed.experience_count != null ? parseInt(parsed.experience_count, 10) : null
  const experienceYearsAvg = parsed.experience_years_avg != null ? parseFloat(parsed.experience_years_avg) : null

  const phoneFromCv = extractPhoneFromText(cvText)
  const schoolFromCv = extractSchoolFromText(cvText)
  const lastEmployerFromCv = extractLastEmployerFromText(cvText)
  if (!(Number.isInteger(expCount) && expCount >= 0)) {
    expCount = extractExperienceCountFromText(cvText)
  }

  const phoneOut = toStr(parsed.phone) || phoneFromCv || null
  const schoolOut = toStr(parsed.school) || schoolFromCv || null
  const lastEmployerOut = toStr(parsed.last_employer) || lastEmployerFromCv || null
  if (!schoolType) {
    schoolType = fallbackSchoolTypeFromName(schoolOut)
  }

  return {
    summary: toStr(parsed.summary) || 'Non fourni',
    skills: toStr(parsed.skills),
    experience: toStr(parsed.experience),
    strengths: toStr(parsed.strengths),
    risks: toStr(parsed.risks),
    score: Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 50,
    decision: validDecision,
    offer_context: toStr(parsed.offer_context) || null,
    school: schoolOut,
    school_type: schoolType,
    phone: phoneOut,
    experience_count: Number.isInteger(expCount) && expCount >= 0 ? expCount : null,
    experience_duration: toStr(parsed.experience_duration) || null,
    experience_years_avg: Number.isFinite(experienceYearsAvg) ? experienceYearsAvg : null,
    last_employer: lastEmployerOut,
  }
}
