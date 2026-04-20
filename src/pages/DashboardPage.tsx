import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  HiRefresh,
} from 'react-icons/hi'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { setCandidatures } from '@/store/candidaturesSlice'
import { fetchCandidatures } from '@/api/candidatures'
import { fetchHrKpi, type HrKpiPayload } from '@/api/hrKpi'
import { HrProfessionalKpi } from '@/components/dashboard/HrProfessionalKpi'
import { InterviewMatrixTable, type MatrixInterview } from '@/components/dashboard/InterviewMatrixTable'
import { HiringDelaysTable } from '@/components/dashboard/HiringDelaysTable'
import styles from './DashboardPage.module.css'

function normalizeApiBase(raw: string): string {
  let s = raw.replace(/\/+$/, '')
  if (s.endsWith('/api')) s = s.slice(0, -4).replace(/\/+$/, '')
  return s
}

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL || '')
const MATRIX_TYPES = ['ENTRETIEN RH', 'ENTRETIEN TECHNIQUE', 'ENTRETIEN DIRECTEUR'] as const

function inferInterviewType(
  interview: {
    interviewType?: string | null
    notesRh?: string | null
    location?: string | null
    mode?: string | null
  },
  rank: number,
) {
  const raw = String(
    interview.interviewType || interview.notesRh || interview.location || interview.mode || '',
  ).toUpperCase()
  if (raw.includes('TECH')) return 'ENTRETIEN TECHNIQUE'
  if (raw.includes('DIRECT') || raw.includes('MANAG')) return 'ENTRETIEN DIRECTEUR'
  if (raw.includes(' RH') || raw.startsWith('RH')) return 'ENTRETIEN RH'
  return MATRIX_TYPES[Math.min(rank, MATRIX_TYPES.length - 1)]
}

export function DashboardPage() {
  const dispatch = useAppDispatch()
  const { items } = useAppSelector((s) => s.candidatures)
  const [refreshing, setRefreshing] = useState(false)
  const [hrKpi, setHrKpi] = useState<HrKpiPayload | null>(null)
  const [hrKpiLoading, setHrKpiLoading] = useState(false)
  const [hrKpiError, setHrKpiError] = useState<string | null>(null)
  const [interviews, setInterviews] = useState<MatrixInterview[]>([])
  const [interviewsError, setInterviewsError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const dashboardSignatureRef = useRef<string>('')
  const isRefreshingRef = useRef(false)

  const buildDashboardSignature = useCallback(
    (candidatures: Array<{ id?: string | number; date?: string | null; decision?: string | null }>, rawInterviews: MatrixInterview[]) => {
      const candidateCount = candidatures.length
      const candidateLast = candidatures.reduce((max, c) => {
        const t = c.date ? new Date(c.date).getTime() : 0
        return Number.isFinite(t) ? Math.max(max, t) : max
      }, 0)
      const decisionCounts = candidatures.reduce(
        (acc, c) => {
          const d = String(c.decision || '')
          if (d === 'ACCEPTÉE') acc.accepted += 1
          else if (d === 'REFUSÉE') acc.refused += 1
          else if (d === 'À REVOIR') acc.aRevoir += 1
          else if (d === 'NON_LISIBLE') acc.nonLisible += 1
          return acc
        },
        { accepted: 0, refused: 0, aRevoir: 0, nonLisible: 0 },
      )
      const interviewsCount = rawInterviews.length
      const interviewsLast = rawInterviews.reduce((max, iv) => {
        const t = iv.scheduledAt ? new Date(iv.scheduledAt).getTime() : 0
        return Number.isFinite(t) ? Math.max(max, t) : max
      }, 0)
      return [
        candidateCount,
        candidateLast,
        decisionCounts.accepted,
        decisionCounts.refused,
        decisionCounts.aRevoir,
        decisionCounts.nonLisible,
        interviewsCount,
        interviewsLast,
      ].join('|')
    },
    [],
  )

  const refreshDashboard = useCallback(async (showSpinner = true) => {
    if (isRefreshingRef.current) return
    isRefreshingRef.current = true
    if (showSpinner) setRefreshing(true)
    setHrKpiLoading(true)
    setHrKpiError(null)
    setInterviewsError(null)
    try {
      const [candidaturesRes, hrKpiRes, interviewsRes] = await Promise.all([
        fetchCandidatures(),
        fetchHrKpi().catch((e: unknown) => {
          setHrKpiError(e instanceof Error ? e.message : 'Erreur KPI RH')
          return null
        }),
        fetch(`${API_BASE}/api/interviews`).then(async (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json()
        }).catch((e: unknown) => {
          setInterviewsError(e instanceof Error ? e.message : 'Erreur interviews')
          return { interviews: [] }
        }),
      ])

      dispatch(setCandidatures(candidaturesRes.candidatures))
      setHrKpi(hrKpiRes)

      const byCandidature = new Map<string, MatrixInterview[]>()
      const rawInterviews = (interviewsRes?.interviews ?? []) as MatrixInterview[]
      for (const iv of rawInterviews) {
        const key = String(iv.candidatureId)
        if (!byCandidature.has(key)) byCandidature.set(key, [])
        byCandidature.get(key)!.push(iv)
      }

      const normalized = rawInterviews.map((iv) => {
        const group = [...(byCandidature.get(String(iv.candidatureId)) ?? [])].sort((a, b) => {
          const ta = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0
          const tb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0
          return ta - tb
        })
        const rank = Math.max(0, group.findIndex((x) => x.id === iv.id))
        const interviewType = inferInterviewType(iv, rank)
        return { ...iv, interviewType }
      })

      setInterviews(normalized)
      dashboardSignatureRef.current = buildDashboardSignature(candidaturesRes.candidatures, rawInterviews)
      setLastUpdated(new Date().toLocaleTimeString('fr-FR'))
    } finally {
      if (showSpinner) setRefreshing(false)
      setHrKpiLoading(false)
      isRefreshingRef.current = false
    }
  }, [buildDashboardSignature, dispatch])

  useEffect(() => {
    void refreshDashboard()
  }, [refreshDashboard])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (isRefreshingRef.current) return
      void (async () => {
        try {
          const [candidaturesRes, interviewsRes] = await Promise.all([
            fetchCandidatures(),
            fetch(`${API_BASE}/api/interviews`).then(async (r) => {
              if (!r.ok) throw new Error(`HTTP ${r.status}`)
              return r.json()
            }),
          ])
          const nextSignature = buildDashboardSignature(
            candidaturesRes.candidatures,
            (interviewsRes?.interviews ?? []) as MatrixInterview[],
          )
          if (nextSignature !== dashboardSignatureRef.current) {
            void refreshDashboard(false)
          }
        } catch {
          // Silent polling: ignore transient errors.
        }
      })()
    }, 15000)
    return () => window.clearInterval(id)
  }, [buildDashboardSignature, refreshDashboard])

  const filteredItems = useMemo(() => items, [items])
  const computedHrKpi = useMemo(() => {
    if (!hrKpi) return null
    const candDateById = new Map<string, number>()
    for (const c of items) {
      const t = c.date ? new Date(c.date).getTime() : NaN
      if (!Number.isNaN(t)) candDateById.set(String(c.id), t)
    }

    const byCand = new Map<string, number[]>()
    for (const iv of interviews) {
      if (!iv.scheduledAt) continue
      const t = new Date(iv.scheduledAt).getTime()
      if (Number.isNaN(t)) continue
      const id = String(iv.candidatureId)
      if (!byCand.has(id)) byCand.set(id, [])
      byCand.get(id)!.push(t)
    }

    const receptionToLast: number[] = []
    const spanFirstToLast: number[] = []
    byCand.forEach((times, cid) => {
      const recv = candDateById.get(cid)
      if (recv == null) return
      const sorted = [...times].sort((a, b) => a - b)
      const last = sorted[sorted.length - 1]
      if (last >= recv) receptionToLast.push(last - recv)
      if (sorted.length >= 2) {
        const first = sorted[0]
        if (last >= first) spanFirstToLast.push(last - first)
      }
    })

    const avgRec =
      receptionToLast.length > 0
        ? Math.round(receptionToLast.reduce((a, b) => a + b, 0) / receptionToLast.length)
        : null
    const sortedSpan = [...spanFirstToLast].sort((a, b) => a - b)
    const medSpan =
      sortedSpan.length > 0
        ? sortedSpan[Math.floor(sortedSpan.length / 2)]
        : null

    return {
      ...hrKpi,
      candidaturesWithInterviewScheduled:
        receptionToLast.length > 0 ? receptionToLast.length : hrKpi.candidaturesWithInterviewScheduled,
      avgReceptionToLastInterviewMs: avgRec ?? hrKpi.avgReceptionToLastInterviewMs ?? null,
      candidaturesWithTwoPlusInterviews:
        spanFirstToLast.length > 0 ? spanFirstToLast.length : hrKpi.candidaturesWithTwoPlusInterviews,
      medianSpanFirstToLastMs: medSpan ?? hrKpi.medianSpanFirstToLastMs ?? null,
    }
  }, [hrKpi, items, interviews])

  const stats = useMemo(() => {
    const accepted = items.filter((c) => c.decision === 'ACCEPTÉE').length
    const refused = items.filter((c) => c.decision === 'REFUSÉE').length
    const nonLisible = items.filter((c) => c.decision === 'NON_LISIBLE').length
    const aRevoir = items.filter((c) => c.decision === 'À REVOIR').length
    return { total: items.length, accepted, refused, nonLisible, aRevoir }
  }, [items])

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <motion.h1
          className={styles.title}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          Tableau de bord
        </motion.h1>
        <div className={styles.subtitleRow}>
          <p className={styles.subtitle}>
            Résultats en temps réel du workflow « Automated CV Analysis from Gmail to HR Email »
            {lastUpdated ? ` · Dernière mise à jour: ${lastUpdated}` : ''}
          </p>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => void refreshDashboard()}
            disabled={refreshing}
            aria-label="Rafraîchir la liste"
          >
            <HiRefresh size={18} className={refreshing ? styles.spin : ''} />
            {refreshing ? 'Chargement…' : 'Rafraîchir'}
          </button>
        </div>

        <section className={styles.section}>
          <HrProfessionalKpi data={computedHrKpi} loading={hrKpiLoading} error={hrKpiError} />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Réception candidature — entretiens</h2>
          {interviewsError && <p className={styles.subtitle}>Erreur entretiens: {interviewsError}</p>}
          <InterviewMatrixTable
            candidatures={filteredItems}
            interviews={interviews}
            onInterviewValidated={refreshDashboard}
          />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Suivi RH - Time to interview</h2>
          <HiringDelaysTable items={filteredItems} interviews={interviews} embedded />
        </section>
      </div>
    </div>
  )
}
