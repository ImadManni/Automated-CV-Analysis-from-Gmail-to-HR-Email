/** Valeurs proposées à la planification (normalisées côté serveur). */
export const INTERVIEW_TYPE_VALUES = [
  'ENTRETIEN RH',
  'ENTRETIEN TECHNIQUE',
  'ENTRETIEN DIRECTEUR',
] as const

export type InterviewTypeValue = (typeof INTERVIEW_TYPE_VALUES)[number]

/** Choix affichés sur le formulaire de planification (3 types). */
export const INTERVIEW_TYPE_OPTIONS: { value: InterviewTypeValue; label: string; hint: string }[] = [
  { value: 'ENTRETIEN RH', label: 'RH', hint: 'Entretien RH' },
  { value: 'ENTRETIEN TECHNIQUE', label: 'Technique', hint: 'Entretien technique' },
  { value: 'ENTRETIEN DIRECTEUR', label: 'Directeur', hint: 'Entretien directeur' },
]

/** Filtre liste : types courants + entrées historiques encore en base. */
export const INTERVIEW_TYPE_FILTER_OPTIONS: { value: string; label: string }[] = [
  ...INTERVIEW_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.hint })),
  { value: 'ENTRETIEN MANAGER', label: 'Entretien manager (historique)' },
]

const LEGACY_LABELS: Record<string, string> = {
  'ENTRETIEN MANAGER': 'Entretien manager',
}

/**
 * Colonne matrice dashboard : agrège les types en 3 colonnes (manager historique → directeur).
 */
export function interviewTypeMatrixKey(raw?: string | null): InterviewTypeValue {
  const v = String(raw || '').toUpperCase().trim()
  if (v.includes('TECH')) return 'ENTRETIEN TECHNIQUE'
  if (v.includes('DIRECT') || v.includes('MANAG')) return 'ENTRETIEN DIRECTEUR'
  return 'ENTRETIEN RH'
}

/** Libellé court pour en-têtes de tableau (dashboard). */
export function interviewTypeMatrixHeader(type: InterviewTypeValue): string {
  const row = INTERVIEW_TYPE_OPTIONS.find((o) => o.value === type)
  return row ? row.hint : type
}

/** Libellé FR pour affichage (API en majuscules). */
export function interviewTypeLabel(raw?: string | null): string {
  const key = String(raw || 'ENTRETIEN RH').toUpperCase().trim()
  const row = INTERVIEW_TYPE_OPTIONS.find((o) => o.value === key)
  if (row) return row.hint
  if (LEGACY_LABELS[key]) return LEGACY_LABELS[key]
  return raw?.trim() || 'Entretien RH'
}
