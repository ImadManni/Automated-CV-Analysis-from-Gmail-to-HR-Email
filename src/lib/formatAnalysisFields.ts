/** Affichage lisible des champs d'analyse IA (gère JSON / chaînes mal formées depuis le LLM). */

function stripCodeFence(s: string): string {
  return s
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/u, '')
    .trim()
}

function tryParseJson<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T
  } catch {
    return null
  }
}

/** Ex. {"React","Node"} ou ["a","b"] → liste lisible */
export function formatSkillsForDisplay(raw: unknown): string {
  if (raw == null || raw === '') return ''
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean).join(', ')
  }
  let s = String(raw).trim()
  if (!s) return ''
  s = stripCodeFence(s)

  let parsed: unknown = tryParseJson(s)
  if (typeof parsed === 'string') parsed = tryParseJson(parsed)
  if (Array.isArray(parsed)) {
    return parsed.map((x) => String(x).trim()).filter(Boolean).join(', ')
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const o = parsed as Record<string, unknown>
    if (Array.isArray(o.skills)) {
      return o.skills.map((x) => String(x).trim()).filter(Boolean).join(', ')
    }
    if (typeof o.skills === 'string') return o.skills.trim()
  }

  // Notation type ensemble : { "A", "B" } (non JSON valide)
  if (/^\{[^{}]+\}$/.test(s)) {
    const inner = s.slice(1, -1)
    const parts = inner
      .split(/\s*,\s*/)
      .map((p) => p.replace(/^[\"']|[\"']$/g, '').trim())
      .filter(Boolean)
    if (parts.length) return parts.join(', ')
  }

  return s
}

function formatOneExperienceLine(x: unknown): string {
  if (x == null) return ''
  if (typeof x === 'string') {
    const inner = tryParseJson<unknown>(stripCodeFence(x))
    if (inner != null) return formatOneExperienceLine(inner)
    return x.trim()
  }
  if (Array.isArray(x)) {
    return x.map(formatOneExperienceLine).filter(Boolean).join('\n\n')
  }
  if (typeof x === 'object') {
    const o = x as Record<string, unknown>
    const parts = [o.title, o.role, o.company, o.employer, o.duration, o.description]
      .filter((p) => p != null && String(p).trim() !== '')
      .map(String)
    if (parts.length) return parts.join(' — ')
  }
  return String(x).trim()
}

/** Expérience : tableaux d'objets, JSON échappé, ou texte brut */
export function formatExperienceForDisplay(raw: unknown): string {
  if (raw == null || raw === '') return ''
  if (typeof raw !== 'string') {
    if (Array.isArray(raw)) {
      return raw.map(formatOneExperienceLine).filter(Boolean).join('\n\n')
    }
    if (typeof raw === 'object') {
      return formatOneExperienceLine(raw)
    }
    return String(raw).trim()
  }

  let s = stripCodeFence(String(raw).trim())
  if (!s) return ''

  let parsed: unknown = tryParseJson(s)
  if (typeof parsed === 'string') parsed = tryParseJson(parsed)

  if (Array.isArray(parsed)) {
    return parsed.map(formatOneExperienceLine).filter(Boolean).join('\n\n')
  }
  if (parsed && typeof parsed === 'object') {
    return formatOneExperienceLine(parsed)
  }

  return s
}

/**
 * Texte « Contexte offre » : si ce n’est qu’un collage titre + lieu, le formater comme les autres fiches.
 */
export function formatOfferContextForDisplay(
  offerTitle: string | null | undefined,
  offerDescription: string | null | undefined,
): string {
  const d = (offerDescription || '').trim()
  if (!d) return ''
  const t = (offerTitle || '').trim()
  const looksNarrative =
    /^recherche\b/i.test(d) || (d.length > 45 && /[.!?٫]/.test(d))
  if (looksNarrative) return d
  if (t && /\bchez\b/i.test(d) && d.length < 240) {
    return "Recherche d'une opportunité pour le poste « " + t + " », en lien avec le contexte suivant : " + d + '.'
  }
  if (t && !looksNarrative && d.length < 200) {
    return "Recherche d'une opportunité alignée sur « " + t + ' » : ' + d + '.'
  }
  return d
}
