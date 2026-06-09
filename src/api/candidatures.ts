/**
 * API client pour les candidatures (backend PCA — alimenté par n8n).
 * GET nécessite un JWT (auth).
 */

const API_BASE = import.meta.env.VITE_API_URL || ''

function getAuthHeaders(): HeadersInit {
  const token =
    typeof localStorage !== 'undefined'
      ? (() => {
          try {
            const raw = localStorage.getItem('pca_auth')
            if (!raw) return null
            const data = JSON.parse(raw)
            return data?.token ?? null
          } catch {
            return null
          }
        })()
      : null
  const headers: HeadersInit = { Accept: 'application/json' }
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  return headers
}

export interface CandidaturePayload {
  id?: string
  candidateName?: string
  candidat?: string
  email?: string
  subject?: string
  date?: string
  decision?: string
  score?: number
  skills?: string
  competences?: string
  experience?: string
  rawSummary?: string
  synthese?: string
  text?: string
  from?: { value?: Array<{ address?: string }> }
}

export async function fetchCandidatures(): Promise<{ candidatures: import('@/store/candidaturesSlice').Candidature[] }> {
  const res = await fetch(`${API_BASE}/api/candidatures`, {
    method: 'GET',
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function updateCandidatureDecision(
  id: number | string,
  payload: { decision: string; score?: number },
): Promise<import('@/store/candidaturesSlice').Candidature> {
  return patchCandidature(id, payload)
}

/** Mise à jour partielle RH : décision, score, BU (codes PCA_PAYMENT_CENTER_AF_BU). */
export async function patchCandidature(
  id: number | string,
  payload: { decision?: string; score?: number; businessUnit?: string | null },
): Promise<import('@/store/candidaturesSlice').Candidature> {
  const body: Record<string, unknown> = {}
  if (payload.decision !== undefined) body.decision = payload.decision
  if (payload.score !== undefined) body.score = payload.score
  if (payload.businessUnit !== undefined) body.businessUnit = payload.businessUnit
  const res = await fetch(`${API_BASE}/api/candidatures/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}
