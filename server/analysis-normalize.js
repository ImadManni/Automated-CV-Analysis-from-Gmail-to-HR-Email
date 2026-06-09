/**
 * Normalise skills / experience / offer_description issus du LLM (n8n) avant stockage SQL.
 * Évite les chaînes JSON illisibles côté PCA.
 */

function stripFence(s) {
  return String(s || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/u, '')
    .trim()
}

function tryParse(s) {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

export function normalizeSkillsForDb(val) {
  if (val == null) return null
  if (Array.isArray(val)) {
    const out = val.map((x) => String(x).trim()).filter(Boolean).join(', ')
    return out || null
  }
  let s = stripFence(String(val))
  if (!s) return null
  let p = tryParse(s)
  if (typeof p === 'string') p = tryParse(stripFence(p))
  if (Array.isArray(p)) {
    const out = p.map((x) => String(x).trim()).filter(Boolean).join(', ')
    return out || null
  }
  if (p && typeof p === 'object') {
    const sk = p.skills
    if (Array.isArray(sk)) return sk.map(String).join(', ') || null
    if (typeof sk === 'string') return sk.trim() || null
  }
  if (/^\{[^{}]+\}$/.test(s)) {
    const inner = s.slice(1, -1)
    const parts = inner
      .split(/\s*,\s*/)
      .map((x) => x.replace(/^[\"']|[\"']$/g, '').trim())
      .filter(Boolean)
    if (parts.length) return parts.join(', ')
  }
  return s
}

function formatOneExpLine(x) {
  if (x == null) return ''
  if (typeof x === 'string') {
    const inner = tryParse(stripFence(x))
    if (inner != null) return formatOneExpLine(inner)
    return x.trim()
  }
  if (Array.isArray(x)) return x.map(formatOneExpLine).filter(Boolean).join('\n\n')
  if (typeof x === 'object') {
    const o = x
    const parts = [o.title, o.role, o.company, o.employer, o.duration, o.description]
      .filter((p) => p != null && String(p).trim() !== '')
      .map(String)
    if (parts.length) return parts.join(' — ')
  }
  return String(x).trim()
}

export function normalizeExperienceForDb(val) {
  if (val == null) return null
  if (typeof val !== 'string') {
    if (Array.isArray(val)) {
      const out = val.map(formatOneExpLine).filter(Boolean).join('\n\n')
      return out || null
    }
    if (typeof val === 'object') {
      const out = formatOneExpLine(val)
      return out || null
    }
    return String(val).trim() || null
  }
  let s = stripFence(val)
  if (!s) return null
  let p = tryParse(s)
  if (typeof p === 'string') p = tryParse(stripFence(p))
  if (Array.isArray(p)) {
    const out = p.map(formatOneExpLine).filter(Boolean).join('\n\n')
    return out || null
  }
  if (p && typeof p === 'object') {
    const out = formatOneExpLine(p)
    return out || null
  }
  return s
}

/** Préfère le texte narratif offer_context ; sinon fabrique une phrase type fiche RH. */
export function pickOfferDescriptionForDb(body) {
  const b = body || {}
  const llm = (b.offer_context ?? b.offerContext ?? '').toString().trim()
  if (llm.length >= 30) return llm
  if (llm.length > 0) return llm
  const short = (b.offerDescription ?? '').toString().trim()
  const title = (b.offerTitle ?? '').toString().trim()
  if (!short) return null
  if (title) {
    return `Recherche d'une opportunité pour le poste « ${title} », en cohérence avec le profil du candidat : ${short}.`
  }
  return short
}
