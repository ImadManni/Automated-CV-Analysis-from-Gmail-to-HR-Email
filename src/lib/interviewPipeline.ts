import {
  INTERVIEW_TYPE_VALUES,
  interviewTypeMatrixKey,
  type InterviewTypeValue,
} from './interviewTypes'

/** Données minimales pour agréger la matrice RH → technique → directeur */
export type InterviewPipelineRow = {
  id: number
  candidatureId: number
  scheduledAt: string | null
  status: string
  interviewType?: string | null
}

export type InterviewColumnCells = Partial<Record<InterviewTypeValue, InterviewPipelineRow>>

function pickLatest(a: InterviewPipelineRow, b: InterviewPipelineRow): InterviewPipelineRow {
  const ta = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0
  const tb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0
  if (tb !== ta) return tb >= ta ? b : a
  return b.id >= a.id ? b : a
}

export function buildInterviewCellsByCandidature(
  interviews: InterviewPipelineRow[],
): Map<string, InterviewColumnCells> {
  const map = new Map<string, InterviewColumnCells>()
  for (const iv of interviews) {
    const cid = String(iv.candidatureId)
    const col = interviewTypeMatrixKey(iv.interviewType)
    if (!map.has(cid)) map.set(cid, {})
    const cell = map.get(cid)!
    const prev = cell[col]
    cell[col] = prev ? pickLatest(prev, iv) : iv
  }
  return map
}

function statusU(s: string | undefined): string {
  return String(s || '').toUpperCase()
}

/** Les 3 colonnes ont un entretien au statut REALISE (dernier par colonne). */
export function isInterviewPipelineComplete(cells: InterviewColumnCells): boolean {
  return INTERVIEW_TYPE_VALUES.every((t) => {
    const iv = cells[t]
    return iv != null && statusU(iv.status) === 'REALISE'
  })
}

export function countRealisedColumns(cells: InterviewColumnCells): number {
  return INTERVIEW_TYPE_VALUES.filter((t) => {
    const iv = cells[t]
    return iv != null && statusU(iv.status) === 'REALISE'
  }).length
}

/** Au moins une colonne porte un entretien annulé (et le parcours n’est pas entièrement réalisé). */
export function hasPipelineCancellation(cells: InterviewColumnCells): boolean {
  if (isInterviewPipelineComplete(cells)) return false
  return INTERVIEW_TYPE_VALUES.some((t) => {
    const iv = cells[t]
    return iv != null && statusU(iv.status) === 'ANNULE'
  })
}
