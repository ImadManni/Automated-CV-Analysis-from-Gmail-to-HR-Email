/**
 * Choisit l'offre catalogue la plus cohérente avec le sujet du mail.
 */

const STOP = new Set([
  'le',
  'la',
  'les',
  'des',
  'une',
  'un',
  'pour',
  'avec',
  'sans',
  'stage',
  'pfe',
  'offre',
  'emploi',
  'candidature',
  'poste',
  'job',
])

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^re:\s*|^fwd:\s*/gi, '')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[_\u2013\u2014\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(s) {
  return norm(s)
    .split(/[^a-z0-9\u00c0-\u024f]+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
}

function sigTokens(s) {
  return tokens(s).filter((t) => t.length >= 4 || ['aws', 'bi', 'sql', 'etl', 'gcp'].includes(t))
}

function hasWord(hay, w) {
  const i = hay.indexOf(w)
  if (i < 0) return false
  const before = i === 0 || !/[a-z0-9\u00c0-\u024f]/i.test(hay[i - 1])
  const after = i + w.length >= hay.length || !/[a-z0-9\u00c0-\u024f]/i.test(hay[i + w.length])
  return before && after
}

function cloudSignals(h) {
  return (
    hasWord(h, 'cloud') ||
    hasWord(h, 'azure') ||
    hasWord(h, 'aws') ||
    hasWord(h, 'docker') ||
    hasWord(h, 'devops') ||
    hasWord(h, 'kubernetes')
  )
}

function fullStackSignals(h) {
  return (
    (hasWord(h, 'full') && hasWord(h, 'stack')) ||
    hasWord(h, 'react') ||
    hasWord(h, 'angular') ||
    hasWord(h, 'javascript') ||
    hasWord(h, 'vue')
  )
}

function dataSignals(h) {
  return hasWord(h, 'data') || hasWord(h, 'analyst') || hasWord(h, 'power') || hasWord(h, 'etl')
}

/** Sujet email nettoyé pour le matching (préfixes types LinkedIn / RH). */
export function normalizeSubjectForOfferMatch(subjectRaw) {
  let s = String(subjectRaw || '').trim()
  if (!s) return ''
  s = s.replace(/^re:\s*|^fwd:\s*|^tr:\s*/gi, '')
  s = s.replace(
    /^(offre\s+d['\u2019]?\s*emploi|candidature|application|poste\s+ouvert)\s*[-–—:\s]+/i,
    '',
  )
  return s.replace(/\s+/g, ' ').trim()
}

/** Sujet type « BI / Power BI » (à ne pas rabattre sur une offre full-stack seule). */
function biPowerSubjectSignals(subjectNorm) {
  const hasPowerBi = /\bpower\s*bi\b/.test(subjectNorm) || (hasWord(subjectNorm, 'power') && hasWord(subjectNorm, 'bi'))
  const eng = hasWord(subjectNorm, 'engineer') || hasWord(subjectNorm, 'ingenieur')
  return hasPowerBi || (eng && (hasWord(subjectNorm, 'bi') || hasWord(subjectNorm, 'power')))
}

function biPowerTitleSignals(titleNorm) {
  return (
    (hasWord(titleNorm, 'power') && hasWord(titleNorm, 'bi')) ||
    (hasWord(titleNorm, 'bi') && (hasWord(titleNorm, 'engineer') || hasWord(titleNorm, 'analyst')))
  )
}

function tokenSetOverlap(subj, title) {
  const A = new Set(sigTokens(subj))
  const B = new Set(sigTokens(title))
  let n = 0
  for (const t of A) if (B.has(t)) n++
  return n
}

function scorePair(subjectRaw, titleRaw) {
  const subjectNorm = norm(subjectRaw)
  const titleNorm = norm(titleRaw)
  let score = 0

  const cs = cloudSignals(subjectNorm)
  const ct = cloudSignals(titleNorm)
  const fs = fullStackSignals(subjectNorm)
  const ft = fullStackSignals(titleNorm)
  const ds = dataSignals(subjectNorm)
  const dt = dataSignals(titleNorm)

  if (cs && ct) score += 58
  if (cs && ft && !ct) score -= 72
  if (ds && dt) score += 52
  if (ds && ft && !dt) score -= 60
  if (fs && ft) score += 46
  if (fs && ct && !ft) score -= 55

  if (hasWord(subjectNorm, 'devops') && hasWord(titleNorm, 'devops')) score += 44
  if (hasWord(subjectNorm, 'devops') && !hasWord(titleNorm, 'devops') && ft && !ct) score -= 35

  score += tokenSetOverlap(subjectRaw, titleRaw) * 15

  if (
    subjectNorm.length > 12 &&
    titleNorm.length > 12 &&
    (subjectNorm === titleNorm || subjectNorm.includes(titleNorm) || titleNorm.includes(subjectNorm))
  ) {
    score += 92
  }

  return score
}

/**
 * @param {string} subjectRaw
 * @param {Array<{ title?: string, company?: string, location?: string }>} offers
 * @returns {{ title: string, description: string, score: number } | null}
 */
export function pickBestOfferForSubject(subjectRaw, offers) {
  const list = Array.isArray(offers) ? offers : []
  if (!list.length || !String(subjectRaw || '').trim()) return null

  const subject = String(subjectRaw).trim()
  let best = null
  let bestScore = -1e9

  for (const o of list) {
    const title = String(o.title || '')
    if (!title) continue
    const sc = scorePair(subject, title)
    if (sc > bestScore) {
      bestScore = sc
      best = o
    }
  }

  const MIN = 15
  if (!best || bestScore < MIN) return null

  const description = [best.company, best.location].filter(Boolean).join(' - ')
  return { title: best.title, description, score: bestScore }
}
