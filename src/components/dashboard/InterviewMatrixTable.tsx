import { useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import type { Candidature } from '@/store/candidaturesSlice'
import {
  INTERVIEW_TYPE_VALUES,
  interviewTypeMatrixHeader,
  type InterviewTypeValue,
} from '@/lib/interviewTypes'
import {
  buildInterviewCellsByCandidature,
  type InterviewColumnCells,
  type InterviewPipelineRow,
} from '@/lib/interviewPipeline'
import {
  delayReceptionToInterviewStartMs,
  formatHiringDelayFr,
  globalReceptionToLastInterviewMs,
  spanFirstToLastInterviewMs,
} from '@/lib/hiringTime'
import { buLabel } from '@/lib/pcaPaymentCenterBu'
import styles from './InterviewMatrixTable.module.css'

export type MatrixInterview = InterviewPipelineRow & {
  mode: string
  location: string
}

function formatCellDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function statusLabel(status: string): { className: string; text: string } {
  const u = String(status || '').toUpperCase()
  if (u === 'REALISE') return { className: styles.badgeDone, text: 'Validé' }
  if (u === 'ANNULE') return { className: styles.badgeCancel, text: 'Annulé' }
  return { className: styles.badgePlan, text: 'Planifié' }
}

/** Exporté pour aligner la barre landing du bloc « time to interview » sur la matrice. */
export const MATRIX_COMPACT_VISIBLE_ROWS = 4

const API_BASE = import.meta.env.VITE_API_URL || ''

/** Entretien planifié : on ne valide pas la colonne suivante tant qu’une colonne précédente est encore « planifiée ». */
function canValidateInterviewStep(
  cells: InterviewColumnCells,
  column: InterviewTypeValue,
  iv: MatrixInterview,
): boolean {
  if (String(iv.status || '').toUpperCase() !== 'PLANIFIE') return false
  const idx = INTERVIEW_TYPE_VALUES.indexOf(column)
  for (let i = 0; i < idx; i++) {
    const prev = cells[INTERVIEW_TYPE_VALUES[i]]
    if (prev && String(prev.status || '').toUpperCase() === 'PLANIFIE') return false
  }
  return true
}

interface InterviewMatrixTableProps {
  candidatures: Candidature[]
  interviews: MatrixInterview[]
  /** Après validation (PATCH), recharger la liste depuis le parent. */
  onInterviewValidated?: () => void | Promise<void>
}

export function InterviewMatrixTable({
  candidatures,
  interviews,
  onInterviewValidated,
}: InterviewMatrixTableProps) {
  const [patchingId, setPatchingId] = useState<number | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const patchValidate = useCallback(
    async (iv: MatrixInterview) => {
      setLocalError(null)
      setPatchingId(iv.id)
      try {
        const res = await fetch(`${API_BASE}/api/interviews/${iv.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'REALISE' }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error((err && err.message) || `HTTP ${res.status}`)
        }
        await onInterviewValidated?.()
      } catch (e: unknown) {
        setLocalError(e instanceof Error ? e.message : 'Validation impossible.')
      } finally {
        setPatchingId(null)
      }
    },
    [onInterviewValidated],
  )

  const cellsByCandidature = useMemo(() => buildInterviewCellsByCandidature(interviews), [interviews])

  const candidatureIdSet = useMemo(() => new Set(candidatures.map((c) => String(c.id))), [candidatures])

  const rows = useMemo(() => {
    const scored = candidatures.map((c) => {
      const cells = cellsByCandidature.get(String(c.id)) || {}
      const hasAny = INTERVIEW_TYPE_VALUES.some((t) => cells[t] != null)
      return { c, hasAny, cells }
    })
    return scored.sort((a, b) => {
      if (a.hasAny !== b.hasAny) return a.hasAny ? -1 : 1
      return 0
    })
  }, [candidatures, cellsByCandidature])

  const matrixOnlyCount = useMemo(() => {
    const seen = new Set(interviews.map((i) => String(i.candidatureId)))
    return [...seen].filter((cid) => !candidatureIdSet.has(cid)).length
  }, [interviews, candidatureIdSet])

  if (candidatures.length === 0) {
    return (
      <div id="pca-dashboard-entretiens-matrix" className={styles.wrap}>
        <p className={styles.empty}>Aucune candidature pour ce filtre — la matrice entretiens est vide.</p>
      </div>
    )
  }

  const rowCount = rows.length
  const needsScrollHint = rowCount > MATRIX_COMPACT_VISIBLE_ROWS

  return (
    <div id="pca-dashboard-entretiens-matrix" className={styles.wrap}>
      {localError && (
        <p className={styles.matrixError} role="alert">
          {localError}
        </p>
      )}
      <div className={styles.scrollHintBar}>
        <span className={styles.scrollHintStrong}>
          {rowCount} candidature{rowCount > 1 ? 's' : ''}
        </span>
        {needsScrollHint ? (
          <span className={styles.scrollHintSoft}>
            {' '}
            · faites défiler verticalement ou horizontalement (~{MATRIX_COMPACT_VISIBLE_ROWS} lignes visibles)
          </span>
        ) : (
          <span className={styles.scrollHintSoft}> · vue compacte</span>
        )}
        <span className={styles.scrollHintSoft}>
          {' '}
          · <strong>Délai</strong> : réception candidature → début de l&apos;entretien ; ligne candidat : parcours
          jusqu&apos;au dernier RDV
        </span>
      </div>
      <div className={styles.bodyViewport}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.stickyCol}>Candidature</th>
              {INTERVIEW_TYPE_VALUES.map((t) => (
                <th key={t}>{interviewTypeMatrixHeader(t)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, cells }) => {
              const ivsForC = interviews.filter((i) => String(i.candidatureId) === String(c.id))
              const globalToLast = globalReceptionToLastInterviewMs(c.date, ivsForC)
              const spanRdv = spanFirstToLastInterviewMs(ivsForC)
              return (
              <tr key={c.id}>
                <td className={styles.stickyCol}>
                  <div className={styles.candidateCell}>
                    <span className={styles.name}>{c.candidateName || '—'}</span>
                    {c.businessUnit && (
                      <span className={styles.buTag} title={`BU : ${buLabel(c.businessUnit)}`}>
                        BU : {buLabel(c.businessUnit)}
                      </span>
                    )}
                    {c.subject && <span className={styles.subject}>{c.subject}</span>}
                    {globalToLast != null && (
                      <span className={styles.hiringGlobal} title="Réception de la candidature → dernier entretien planifié">
                        Parcours : {formatHiringDelayFr(globalToLast)}
                      </span>
                    )}
                    {spanRdv != null && (
                      <span className={styles.hiringSpan} title="Écart entre le premier et le dernier RDV">
                        Étalement RDV : {formatHiringDelayFr(spanRdv)}
                      </span>
                    )}
                    <Link to={`/candidatures/${c.id}`} className={styles.link}>
                      Ouvrir la fiche
                    </Link>
                  </div>
                </td>
                {INTERVIEW_TYPE_VALUES.map((t) => {
                  const iv = cells[t]
                  if (!iv) {
                    return (
                      <td key={t}>
                        <span className={styles.cellEmpty}>Non planifié</span>
                      </td>
                    )
                  }
                  const st = statusLabel(iv.status)
                  const statusU = String(iv.status || '').toUpperCase()
                  const canVal = canValidateInterviewStep(cells, t, iv)
                  const isPatching = patchingId === iv.id

                  const delaiMs = delayReceptionToInterviewStartMs(c.date, iv.scheduledAt)
                  return (
                    <td key={t}>
                      <div className={styles.cellInner}>
                        <span className={`${styles.badge} ${st.className}`}>{st.text}</span>
                        <span className={styles.date}>{formatCellDate(iv.scheduledAt)}</span>
                        <span className={styles.hiringCell} title="Depuis la date de réception de la candidature">
                          Δ réception → RDV : {formatHiringDelayFr(delaiMs)}
                        </span>
                        <span className={styles.meta} title={iv.location}>
                          {iv.mode} ·{' '}
                          {iv.location ? (iv.location.length > 42 ? `${iv.location.slice(0, 40)}…` : iv.location) : '—'}
                        </span>
                        {statusU === 'REALISE' && (
                          <label className={styles.validateDone}>
                            <input type="checkbox" checked readOnly disabled className={styles.validateCheckbox} />
                            <span>Entretien validé</span>
                          </label>
                        )}
                        {statusU === 'PLANIFIE' && canVal && (
                          <label className={styles.validateActive}>
                            <input
                              type="checkbox"
                              className={styles.validateCheckbox}
                              disabled={isPatching}
                              checked={false}
                              onChange={(e) => {
                                if (!e.target.checked) return
                                e.target.checked = false
                                void patchValidate(iv)
                              }}
                              aria-label={`Marquer l'entretien ${interviewTypeMatrixHeader(t)} comme validé`}
                            />
                            <span className={styles.validateLabelText}>Marquer comme validé</span>
                          </label>
                        )}
                        {statusU === 'PLANIFIE' && !canVal && (
                          <p className={styles.validateBlocked}>
                            Validez d&apos;abord l&apos;étape précédente encore « planifiée ».
                          </p>
                        )}
                        {statusU === 'ANNULE' && (
                          <p className={styles.validateBlocked}>Aucune validation — entretien annulé.</p>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className={styles.legend}>
        <span>
          <strong>Planifié</strong> · à venir
        </span>
        <span className={styles.legendSep}>|</span>
        <span>
          <strong>Validé</strong> · fait
        </span>
        <span className={styles.legendSep}>|</span>
        <span>
          <strong>Annulé</strong>
        </span>
        <span className={styles.legendSep}>|</span>
        <span>
          Case <strong>Marquer validé</strong> = valider l&apos;étape (ordre RH → tech. → dir.)
        </span>
        {matrixOnlyCount > 0 && (
          <>
            <span className={styles.legendSep}>|</span>
            <span>
              +{matrixOnlyCount} hors filtre
            </span>
          </>
        )}
      </div>
    </div>
  )
}
