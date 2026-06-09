/**
 * Durée totale cohérente : nombre de postes × durée moyenne (années).
 * Remplace un libellé LLM parfois confondu avec une seule mission.
 * @param {number|null|undefined} count
 * @param {number|null|undefined} avgYears
 * @returns {string|null}
 */
export function formatTotalExperienceFromCountAndAvg(count, avgYears) {
  const c = typeof count === 'number' ? count : parseInt(String(count), 10)
  const a = typeof avgYears === 'number' ? avgYears : parseFloat(String(avgYears))
  if (!Number.isFinite(c) || c < 1 || !Number.isFinite(a) || a < 0) return null

  const totalYears = c * a
  if (totalYears < 1 / 24) return null

  const totalMonths = Math.max(1, Math.round(totalYears * 12))
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths % 12

  if (y === 0) return m <= 1 ? '1 mois' : `${m} mois`
  if (m === 0) return y === 1 ? '1 an' : `${y} ans`
  if (y === 1) return m === 1 ? '1 an et 1 mois' : `1 an et ${m} mois`
  return `${y} ans et ${m} mois`
}
