/**
 * Métriques « time to interview » : écart entre la date de réception de la candidature
 * (entrée dashboard / champ date) et le début de chaque entretien.
 */

/** Δ en ms entre réception candidature et début de l'entretien (plancher 0 si horloge/tz bizarre). */
export function delayReceptionToInterviewStartMs(
  candidatureDateIso: string | null | undefined,
  interviewScheduledIso: string | null | undefined,
): number | null {
  if (!candidatureDateIso || !interviewScheduledIso) return null
  const t0 = new Date(candidatureDateIso).getTime()
  const t1 = new Date(interviewScheduledIso).getTime()
  if (Number.isNaN(t0) || Number.isNaN(t1)) return null
  const d = t1 - t0
  return d < 0 ? 0 : d
}

export function formatHiringDelayFr(ms: number | null | undefined): string {
  if (ms == null) return '—'
  const minutes = Math.floor(ms / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const h = hours % 24
  const m = minutes % 60
  if (days >= 1) return `${days} j ${h} h`
  if (hours >= 1) return `${hours} h ${m} min`
  if (minutes >= 1) return `${minutes} min`
  return '< 1 min'
}

/** Réception → date du dernier RDV planifié (max scheduledAt) parmi les entretiens fournis. */
export function globalReceptionToLastInterviewMs(
  candidatureDateIso: string | null | undefined,
  interviews: { scheduledAt: string | null }[],
): number | null {
  const times = interviews
    .map((i) => (i.scheduledAt ? new Date(i.scheduledAt).getTime() : NaN))
    .filter((t) => !Number.isNaN(t))
  if (!candidatureDateIso || times.length === 0) return null
  const tMax = Math.max(...times)
  const t0 = new Date(candidatureDateIso).getTime()
  if (Number.isNaN(t0)) return null
  const d = tMax - t0
  return d < 0 ? 0 : d
}

/** Écart entre le premier et le dernier RDV (étalement du parcours). */
export function spanFirstToLastInterviewMs(interviews: { scheduledAt: string | null }[]): number | null {
  const times = interviews
    .map((i) => (i.scheduledAt ? new Date(i.scheduledAt).getTime() : NaN))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b)
  if (times.length < 2) return null
  const d = times[times.length - 1]! - times[0]!
  return d < 0 ? 0 : d
}
