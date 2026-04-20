/** Base API sans slash final ni suffixe `/api` (évite `…/api/api/...` → 404). */
function normalizeApiBase(raw: string): string {
  let s = raw.replace(/\/+$/, '')
  if (s.endsWith('/api')) s = s.slice(0, -4).replace(/\/+$/, '')
  return s
}

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL || '')

export interface HrKpiOfferRow {
  offerLabel: string
  applicationsCount: number
  retainedCount: number
  selectedForInterviewCount: number
  /** Avec entretien + ACCEPTÉE, pour cette offre (somme = rétention post-sélection si total agrégé absent). */
  retainedWithInterviewCount?: number
}

/** Une ligne du tableau « durée 1er → dernier RDV » (GET /api/hr-kpi). */
export interface HrKpiInterviewSpanRow {
  candidatureId: number
  candidateName: string
  firstScheduledAt: string | null
  lastScheduledAt: string | null
  interviewCount: number
  spanFirstToLastMs: number
}

export interface HrKpiPayload {
  totalApplicants: number
  selectedForInterview: number
  /** Avec ≥1 entretien ET décision ACCEPTÉE (taux rétention = / selectedForInterview) */
  retainedWithInterview?: number
  /** Candidats avec au moins 2 RDV planifiés (pour médiane / moyenne parcours). */
  candidaturesWithTwoPlusInterviews?: number
  /** Médiane (ms) entre 1er et dernier RDV. */
  medianSpanFirstToLastMs?: number | null
  /** Moyenne (ms) entre 1er et dernier RDV. */
  avgSpanFirstToLastMs?: number | null
  /** Candidats avec ≥1 RDV planifié (base médiane réception → dernier RDV). */
  candidaturesWithInterviewScheduled?: number
  medianReceptionToLastInterviewMs?: number | null
  avgReceptionToLastInterviewMs?: number | null
  /** Détail par candidature : dates du 1er et dernier entretien + écart. */
  interviewSpanByCandidature?: HrKpiInterviewSpanRow[]
  byOffer: HrKpiOfferRow[]
}

function hrKpiUrl() {
  const path = '/api/hr-kpi'
  return API_BASE ? `${API_BASE}${path}` : path
}

/** Cohérent avec l’API Node : nombre entier ≥ 0 (fallback somme `byOffer` si champ racine absent ou typé en string). */
export function retainedWithInterviewCountResolved(data: HrKpiPayload): number {
  const raw = data.retainedWithInterview
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.round(raw))
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw)
    if (Number.isFinite(n)) return Math.max(0, Math.round(n))
  }
  let sum = 0
  for (const r of data.byOffer) {
    const c = r.retainedWithInterviewCount
    if (typeof c === 'number' && Number.isFinite(c)) sum += Math.round(c)
    else if (typeof c === 'string' && c.trim() !== '') {
      const n = Number(c)
      if (Number.isFinite(n)) sum += Math.round(n)
    }
  }
  return Math.max(0, sum)
}

export async function fetchHrKpi(): Promise<HrKpiPayload> {
  const res = await fetch(hrKpiUrl())
  if (!res.ok) throw new Error(`KPI RH HTTP ${res.status}`)
  return (await res.json()) as HrKpiPayload
}
