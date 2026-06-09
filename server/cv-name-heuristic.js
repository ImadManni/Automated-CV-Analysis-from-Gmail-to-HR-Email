/**
 * Extrait un nom probable depuis le début du texte CV (prioritaire sur le nom expéditeur / LLM).
 */

const NOISE_LINE = /^cv\b|^curriculum|^resumé|^resume\b|^profil\b|^profile\b|^coordonnées\b|^contact\b/i

/** Lignes type intitulé de poste (éviter « Full Stack Developer » pris pour un nom). */
const JOB_TITLE_IN_LINE =
  /\b(développeur|developer|ingénieur|engineer|stagiaire|architecte|architect|analyst|analyste|consultant|consultante|designer|manager|lead|devops|full[\s-]*stack|data\s+science|cloud\s+engineer|software|étudiant|etudiant|student)\b/i

/** Titres de section CV (souvent 2–4 mots — ne jamais les prendre pour un nom). */
function foldAscii(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

const SECTION_TITLE_LINE =
  /^(à propos de moi|a propos de moi|about me|presentation|présentation|profil|profile|objectif|objectifs|formation|éducation|education|certifications|certificats|compétences|competences|skills|langues|languages|expérience|experience|parcours professionnel|projects?|projets|références|references|centres? d intérêt|loisirs|atouts)\b/i

/**
 * Nom candidat manifestement faux (LLM ou heuristique).
 * @param {string|null|undefined} name
 * @returns {boolean}
 */
export function isNoiseCandidateName(name) {
  const raw = String(name || '').trim()
  if (!raw) return true
  const s = foldAscii(raw)
  if (SECTION_TITLE_LINE.test(s)) return true
  if (/^(soft skills|hard skills|technical skills|resume|summary|curriculum vitae|cv)\b/.test(s)) return true
  if (/\bpropos\b/.test(s) && /\bmoi\b/.test(s)) return true
  if (/\babout\b/.test(s) && /\bme\b/.test(s)) return true
  return false
}

function titleCaseWord(w) {
  if (!w) return w
  const lower = w.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

function stripLeadingEnum(l) {
  return l.replace(/^\d+[\d./\s-]*\s*/, '').trim()
}

function lineTooNoisy(l) {
  if (l.length > 85) return true
  if (NOISE_LINE.test(l)) return true
  if (/[@/]|https?:|linkedin\.|github\.|gitlab\.|^\d[\d\s.\-+]{6,}|tél|tel\b/i.test(l)) return true
  return false
}

/**
 * @param {string[]} parts
 * @returns {string | null}
 */
function nameFromParts(parts) {
  if (parts.length < 2 || parts.length > 6) return null
  const joined = parts.join(' ')
  if (!/^[\p{L}][\p{L}'\-\s]+$/u.test(joined)) return null
  if (JOB_TITLE_IN_LINE.test(joined)) return null

  const allCaps = parts.every((p) => /^[A-ZÀÂÄÉÈÊËÎÏÔÙÛÜÇ'’\-]+$/.test(p))
  if (allCaps) {
    return parts.map((p) => titleCaseWord(p.replace(/['’]/g, "'"))).join(' ')
  }

  const mixedOk = parts.every((p) => /^[\p{L}][\p{L}'’\-]*$/u.test(p))
  if (mixedOk && parts.length === 2) {
    return parts.map((p) => titleCaseWord(p.replace(/['’]/g, "'"))).join(' ')
  }

  return null
}

/**
 * @param {string} text
 * @returns {string | null}
 */
export function extractNameFromCvText(text) {
  const raw = String(text || '').trim()
  if (raw.length < 12) return null

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const max = Math.min(32, lines.length)
  for (let i = 0; i < max; i++) {
    let l = lines[i]
    if (lineTooNoisy(l)) continue

    l = stripLeadingEnum(l)
    if (l.length < 4) continue

    if (SECTION_TITLE_LINE.test(foldAscii(l))) continue

    const parts = l.split(/\s+/).filter(Boolean)
    const name = nameFromParts(parts)
    if (name && !isNoiseCandidateName(name)) return name
  }

  for (let i = 0; i < Math.min(31, lines.length - 1); i++) {
    let a = lines[i]
    let b = lines[i + 1]
    if (lineTooNoisy(a) || lineTooNoisy(b)) continue
    a = stripLeadingEnum(a)
    b = stripLeadingEnum(b)
    if (SECTION_TITLE_LINE.test(foldAscii(a)) || SECTION_TITLE_LINE.test(foldAscii(b))) continue
    const wa = a.split(/\s+/).filter(Boolean)
    const wb = b.split(/\s+/).filter(Boolean)
    if (wa.length === 1 && wb.length === 1) {
      const name = nameFromParts([wa[0], wb[0]])
      if (name && !isNoiseCandidateName(name)) return name
    }
  }

  return null
}
