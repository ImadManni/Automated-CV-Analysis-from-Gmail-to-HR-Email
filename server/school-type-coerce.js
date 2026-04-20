/** Normalise espaces et retire accents pour tests robustes sur le nom d'école. */
function foldSchoolName(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * Corrige school_type (PUBLIC | PRIVE) à partir du nom d'établissement.
 * Utile quand le LLM ou Serper classe mal (ex. EMSI en public).
 * @param {string|null|undefined} school
 * @param {'PUBLIC'|'PRIVE'|null|undefined} currentType
 * @returns {'PUBLIC'|'PRIVE'|null}
 */
export function coerceSchoolTypeFromSchoolName(school, currentType) {
  const folded = foldSchoolName(school)
  if (!folded) {
    return currentType === 'PUBLIC' || currentType === 'PRIVE' ? currentType : null
  }

  const knownPrivate =
    /\bemsi\b/.test(folded) ||
    /ecole marocaine des sciences de l ingenieur|ecole marocaine des sciences/.test(folded) ||
    /\bsupinfo\b/.test(folded) ||
    /\b1337\b/.test(folded) ||
    /\bschool 42\b|\b42 network\b|\b42network\b/.test(folded) ||
    /\bhem\b.*\b(maroc|casablanca|rabat|marrakech)\b/.test(folded) ||
    /\bhec\b.*\b(maroc|casablanca|rabat)\b/.test(folded)

  if (knownPrivate) return 'PRIVE'

  const knownPublic =
    /\bfaculte\b/.test(folded) ||
    /^fst\s|\bfst\b/.test(folded) ||
    /\buniversite\s/.test(folded) ||
    /\bens[at]\b/.test(folded) ||
    /\bum5\b|\buiz\b/.test(folded)

  if (knownPublic && !/prive|private|privee/.test(folded)) return 'PUBLIC'

  return currentType === 'PUBLIC' || currentType === 'PRIVE' ? currentType : null
}
