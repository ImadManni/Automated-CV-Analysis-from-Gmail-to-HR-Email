import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { retainedWithInterviewCountResolved, type HrKpiPayload } from '@/api/hrKpi'
import { formatHiringDelayFr } from '@/lib/hiringTime'
import styles from './HrProfessionalKpi.module.css'

const COL_SLATE = '#94a3b8'
const COL_ORANGE = '#e85d04'
const COL_ORANGE_LIGHT = '#f48c06'
const COL_SUCCESS = '#2d9d78'

interface HrProfessionalKpiProps {
  data: HrKpiPayload | null
  loading?: boolean
  error?: string | null
}

type DurationSource = 'span' | 'rec' | 'none'

function finiteMs(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function resolveMedianInterviewDuration(data: HrKpiPayload): {
  ms: number | null
  source: DurationSource
} {
  const msSpanM = finiteMs(data.medianSpanFirstToLastMs)
  if (msSpanM != null) return { ms: msSpanM, source: 'span' }
  const msRecM = finiteMs(data.medianReceptionToLastInterviewMs)
  if (msRecM != null) return { ms: msRecM, source: 'rec' }
  return { ms: null, source: 'none' }
}

function resolveAverageInterviewDuration(data: HrKpiPayload): {
  ms: number | null
  source: DurationSource
} {
  const msRecA = finiteMs(data.avgReceptionToLastInterviewMs)
  if (msRecA != null) return { ms: msRecA, source: 'rec' }
  const msSpanA = finiteMs(data.avgSpanFirstToLastMs)
  if (msSpanA != null) return { ms: msSpanA, source: 'span' }
  return { ms: null, source: 'none' }
}

function truncateLabel(s: string, max: number) {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, Math.max(0, max - 1))}…`
}

function formatInterviewDateTimeFr(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function formatCompactDelay(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—'
  const hTotal = Math.floor(ms / (1000 * 60 * 60))
  const d = Math.floor(hTotal / 24)
  const h = hTotal % 24
  if (d > 0 && h > 0) return `${d}j${h}h`
  if (d > 0) return `${d}j`
  return `${h}h`
}

function PipelineTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: { name?: string; value?: number } }>
}) {
  if (!active || !payload?.length) return null
  const p = payload[0]?.payload
  const v = p?.value ?? 0
  return (
    <div className={styles.chartTooltip}>
      <span className={styles.chartTooltipName}>{p?.name}</span>
      <span className={styles.chartTooltipValue}>{v} postulant{v !== 1 ? 's' : ''}</span>
    </div>
  )
}

function OfferBarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ dataKey?: string | number; name?: string; value?: number; color?: string; payload?: { fullLabel?: string } }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  return (
    <div className={styles.chartTooltip}>
      <span className={styles.chartTooltipName}>{row?.fullLabel ?? label}</span>
      <div className={styles.chartTooltipRows}>
        {payload.map((entry) => (
          <span key={String(entry.dataKey)} className={styles.chartTooltipRow}>
            <span className={styles.chartTooltipDot} style={{ background: entry.color }} />
            {entry.name} : <strong>{entry.value}</strong>
          </span>
        ))}
      </div>
    </div>
  )
}

export function HrProfessionalKpi({ data, loading, error }: HrProfessionalKpiProps) {
  const analytics = useMemo(() => {
    if (!data || data.totalApplicants <= 0) return null
    const total = data.totalApplicants
    const withIv = data.selectedForInterview
    const sansEntretien = Math.max(0, total - withIv)
    const totalRetained = data.byOffer.reduce((s, r) => s + r.retainedCount, 0)
    const retainedIv =
      typeof data.retainedWithInterview === 'number' && !Number.isNaN(data.retainedWithInterview)
        ? data.retainedWithInterview
        : null
    const pctWithInterview = (withIv / total) * 100
    const pctRetained = (totalRetained / total) * 100
    const pctRetentionAmongSelected =
      retainedIv != null && withIv > 0 ? (retainedIv / withIv) * 100 : null

    const pieData = [
      { key: 'sans', name: 'Sans entretien enregistré', value: sansEntretien, fill: COL_SLATE },
      { key: 'avec', name: 'Avec au moins un entretien', value: withIv, fill: COL_ORANGE },
    ].filter((d) => d.value > 0)

    const volumeRows = [...data.byOffer]
      .filter((r) => r.applicationsCount > 0)
      .sort((a, b) => b.applicationsCount - a.applicationsCount)
      .slice(0, 10)

    const barData = volumeRows.map((r) => ({
      name: truncateLabel(r.offerLabel, 30),
      fullLabel: r.offerLabel,
      Postulants: r.applicationsCount,
      Entretiens: r.selectedForInterviewCount,
      Retenus: r.retainedCount,
    }))

    return {
      totalRetained,
      retainedWithInterviewCount: retainedIv,
      pctWithInterview,
      pctRetained,
      pctRetentionAmongSelected,
      pieData,
      barData,
    }
  }, [data])

  const averageDuration = useMemo(
    () => (data ? resolveAverageInterviewDuration(data) : { ms: null as number | null, source: 'none' as DurationSource }),
    [data],
  )
  const medianDuration = useMemo(
    () => (data ? resolveMedianInterviewDuration(data) : { ms: null as number | null, source: 'none' as DurationSource }),
    [data],
  )

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Indicateurs RH · candidatures & offres cibles</h2>

      {loading && <p className={styles.loading}>Chargement des KPI…</p>}
      {error && !loading && <p className={styles.error}>{error}</p>}

      {!loading && !error && data && (
        <>
          <div className={styles.cardsStack}>
            <div className={styles.cardsRow}>
              <motion.div className={styles.card} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className={styles.cardEyebrow}>POSTULANTS (BASE RH)</div>
                <div className={styles.cardValue}>{data.totalApplicants}</div>
                <p className={styles.cardHint}>Volume total enregistré en base RH</p>
              </motion.div>
              <motion.div className={styles.card} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className={styles.cardEyebrow}>PIPELINE ENTRETIENS</div>
                <div className={styles.cardValue}>{data.selectedForInterview}</div>
                <p className={styles.cardHint}>Candidats avec au moins un entretien planifié / enregistré</p>
              </motion.div>
              <motion.div className={styles.card} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className={styles.cardEyebrow}>SANS ENTRETIEN</div>
                <div className={styles.cardValue}>{Math.max(0, data.totalApplicants - data.selectedForInterview)}</div>
                <p className={styles.cardHint}>Pas encore de ligne entretien pour cette candidature</p>
              </motion.div>
            </div>
            <div className={styles.cardsRow}>
              <motion.div className={styles.card} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className={styles.cardEyebrow}>RETENUS (DÉCISION)</div>
                <div className={styles.cardValue}>{data.byOffer.reduce((s, r) => s + r.retainedCount, 0)}</div>
                <p className={styles.cardHint}>Décision ACCEPTEE (toutes candidatures)</p>
              </motion.div>
              <motion.div className={styles.card} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className={styles.cardEyebrow}>RETENUS APRÈS ENTRETIEN</div>
                <div className={styles.cardValue}>{retainedWithInterviewCountResolved(data)}</div>
                <p className={styles.cardHint}>ACCEPTÉE parmi ceux qui ont au moins un entretien</p>
              </motion.div>
              <motion.div className={styles.card} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className={styles.cardEyebrow}>DURÉE MOYENNE</div>
                <div className={styles.cardValue}>{formatCompactDelay(averageDuration.ms)}</div>
                <p className={styles.cardHint}>
                  Moyenne réception - dernier RDV · base {data.candidaturesWithInterviewScheduled ?? data.selectedForInterview} candidats
                </p>
              </motion.div>
            </div>
            <div className={styles.cardsRowSingle}>
              <motion.div className={`${styles.card} ${styles.cardSingle}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className={styles.cardEyebrow}>MÉDIANE</div>
                <div className={styles.cardValue}>{formatCompactDelay(medianDuration.ms)}</div>
                <p className={styles.cardHint}>
                  Médiane 1er - dernier RDV · base {data.candidaturesWithTwoPlusInterviews ?? 0} candidats (≥2 RDV)
                </p>
              </motion.div>
            </div>
          </div>

          {analytics && (
            <div className={styles.analyticsBlock}>
              <div className={styles.chartsRow}>
                <div className={styles.chartCard}>
                  <h4 className={styles.chartTitle}>Pipeline — répartition (donut)</h4>
                  <div className={styles.chartFrame} style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                        <Pie
                          data={analytics.pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={58}
                          outerRadius={88}
                          paddingAngle={2}
                          animationDuration={600}
                          labelLine={false}
                          label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                        >
                          {analytics.pieData.map((d) => (
                            <Cell key={d.key} fill={d.fill} stroke="#ffffff" strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip content={<PipelineTooltip />} />
                        <Legend
                          verticalAlign="bottom"
                          wrapperStyle={{ fontSize: '12px', paddingTop: 8 }}
                          formatter={(value) => <span className={styles.legendText}>{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className={styles.chartCard}>
                  <h4 className={styles.chartTitle}>Par offre cible — volumes (barres groupées)</h4>
                  {analytics.barData.length === 0 ? (
                    <p className={styles.chartEmpty}>Aucune donnée à afficher.</p>
                  ) : (
                    <div className={styles.chartFrame} style={{ height: 340 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={analytics.barData}
                          layout="vertical"
                          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                          barCategoryGap="12%"
                          barGap={4}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 11, fill: '#495057' }} allowDecimals={false} />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={148}
                            tick={{ fontSize: 11, fill: '#495057' }}
                          />
                          <Tooltip
                            cursor={{ fill: 'rgba(232, 93, 4, 0.06)' }}
                            content={<OfferBarTooltip />}
                          />
                          <Legend
                            wrapperStyle={{ fontSize: '12px', paddingTop: 4 }}
                            formatter={(value) => <span className={styles.legendText}>{value}</span>}
                          />
                          <Bar dataKey="Postulants" fill={COL_ORANGE} radius={[0, 4, 4, 0]} animationDuration={550} />
                          <Bar dataKey="Entretiens" fill={COL_ORANGE_LIGHT} radius={[0, 4, 4, 0]} animationDuration={550} />
                          <Bar dataKey="Retenus" fill={COL_SUCCESS} radius={[0, 4, 4, 0]} animationDuration={550} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className={`${styles.tableWrap} ${styles.offerTableScroll}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Offre cible (titre)</th>
                  <th>Postulants</th>
                  <th>Sélection entretien</th>
                  <th>Retenus (décision)</th>
                  <th>Retenus avec entretien</th>
                </tr>
              </thead>
              <tbody>
                {data.byOffer.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.tableEmpty}>
                      Aucune candidature : les lignes par offre cible apparaîtront après réception de CV.
                    </td>
                  </tr>
                ) : (
                  data.byOffer.map((row) => (
                    <tr key={row.offerLabel}>
                      <td className={styles.offerTitle}>{row.offerLabel}</td>
                      <td className={styles.num}>{row.applicationsCount}</td>
                      <td className={styles.num}>{row.selectedForInterviewCount}</td>
                      <td className={styles.num}>{row.retainedCount}</td>
                      <td className={styles.num}>{row.retainedWithInterviewCount ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
