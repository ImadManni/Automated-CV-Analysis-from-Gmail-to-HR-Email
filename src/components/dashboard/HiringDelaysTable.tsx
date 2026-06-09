import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import type { Candidature } from '@/store/candidaturesSlice'
import type { MatrixInterview } from '@/components/dashboard/InterviewMatrixTable'
import {
  formatHiringDelayFr,
  globalReceptionToLastInterviewMs,
} from '@/lib/hiringTime'
import { buLabel } from '@/lib/pcaPaymentCenterBu'
import styles from './HiringDelaysTable.module.css'

interface HiringDelaysTableProps {
  items: Candidature[]
  interviews: MatrixInterview[]
  embedded?: boolean
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

/** Normalise la décision (API / n8n : ACCEPTEE, REFUSEE, accents, etc.) → classes RH vert / rouge / neutre. */
function decisionDisplay(raw: string | undefined): { label: string; className: string } {
  const s = String(raw || 'À REVOIR')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
  let variant: 'accept' | 'refuse' | 'nonLisible' | 'revoir' | 'default' = 'default'
  if (s.includes('ACCEPTE') || s === 'ACCEPTEE' || s === 'ACCEPTED') variant = 'accept'
  else if (s.includes('REFUSE') || s === 'REFUSEE' || s === 'REFUSED') variant = 'refuse'
  else if (s.includes('NON_LISIBLE') || (s.includes('NON') && s.includes('LISIBLE'))) variant = 'nonLisible'
  else if (s.includes('REVOIR') || s.includes('A REVOIR') || s === 'REVIEW') variant = 'revoir'

  const labelMap: Record<typeof variant, string> = {
    accept: 'ACCEPTÉE',
    refuse: 'REFUSÉE',
    nonLisible: 'NON_LISIBLE',
    revoir: 'À REVOIR',
    default: raw?.trim() || 'À REVOIR',
  }
  const classByVariant: Record<typeof variant, string> = {
    accept: styles.decisionAccept,
    refuse: styles.decisionRefuse,
    nonLisible: styles.decisionNonLisible,
    revoir: styles.decisionRevoir,
    default: styles.decisionNeutral,
  }
  return { label: labelMap[variant], className: `${styles.decisionBadge} ${classByVariant[variant]}` }
}

/**
 * Tableau séparé : time to interview (réception → RDV) — ne pas mélanger avec Statut / Décision.
 */
export function HiringDelaysTable({ items, interviews, embedded = false }: HiringDelaysTableProps) {
  if (items.length === 0) {
    return (
      <motion.div
        className={`${styles.empty} ${embedded ? styles.emptyEmbedded : ''}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        Aucune candidature pour ce filtre.
      </motion.div>
    )
  }

  const tableInner = (
    <div className={styles.tableSurface}>
      <div className={styles.metaBar}>
        <span className={styles.metaStrong}>
          {items.length} candidatures
        </span>
        <span className={styles.metaSoft}>· statut, analyse, durée recrutement, synthèse · même filtre</span>
        <span className={styles.metaAnchor}>ancrage</span>
      </div>
      <div className={styles.headerBlock}>
        <p className={styles.eyebrow}>SUIVI RH · TIME TO INTERVIEW</p>
        <h3 className={styles.blockTitle}>Réception candidature - entretiens</h3>
        <p className={styles.blockLead}>
          Colonnes Statut / Décision : après 3/3 entretiens validés dans la matrice ; avant cela, Entretiens : x/3.
          Analyse / score puis Durée / time to hire ; par étape (RH, Tech., Dir.), puis réception - dernier RDV et
          étalement.
        </p>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th><span className={styles.thEyebrow}>CANDIDATURE</span><span className={styles.thTitle}>Candidat</span></th>
              <th><span className={styles.thEyebrow}>DOSSIER</span><span className={styles.thTitle}>Objet</span></th>
              <th><span className={styles.thEyebrow}>PCA</span><span className={styles.thTitle}>BU</span></th>
              <th><span className={styles.thEyebrow}>RÉCEPTION</span><span className={styles.thTitle}>Date</span></th>
              <th><span className={styles.thEyebrow}>STATUT</span><span className={styles.thTitle}>Décision</span></th>
              <th><span className={styles.thEyebrow}>ANALYSE</span><span className={styles.thTitle}>Score</span></th>
              <th><span className={styles.thEyebrow}>DURÉE</span><span className={styles.thTitle}>Time to hire</span></th>
              <th><span className={styles.thEyebrow}>SYNTHÈSE</span><span className={styles.thTitle}>Résumé</span></th>
              <th><span className={styles.thEyebrow}>ACTION</span><span className={styles.thTitle}>Détail</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const ivList = interviews.filter((i) => String(i.candidatureId) === String(row.id))
              const toLast = globalReceptionToLastInterviewMs(row.date, ivList)
              const decisionUi = decisionDisplay(row.decision)
              return (
                <tr key={row.id} className={styles.row}>
                  <td>
                    <span className={styles.name}>{row.candidateName}</span>
                    <span className={styles.email}>{row.email}</span>
                  </td>
                  <td className={styles.objet}>{row.subject || 'Sans objet'}</td>
                  <td className={styles.bu}>
                    {row.businessUnit ? buLabel(row.businessUnit) : '—'}
                  </td>
                  <td className={styles.date}>{formatDate(row.date)}</td>
                  <td>
                    <span className={decisionUi.className}>{decisionUi.label}</span>
                  </td>
                  <td className={styles.score}>{row.score != null ? `${row.score} %` : '—'}</td>
                  <td className={styles.timeToHire}>{toLast != null ? formatHiringDelayFr(toLast) : '—'}</td>
                  <td className={styles.resume}>
                    <div className={styles.summaryCell}>
                      <span className={styles.resumeText}>{row.rawSummary || '—'}</span>
                    </div>
                  </td>
                  <td>
                    <Link to={`/candidatures/${row.id}`} className={styles.detailBtn}>Détail</Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <motion.div
      className={styles.wrapper}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {embedded ? tableInner : <div className={styles.tableShell}>{tableInner}</div>}
    </motion.div>
  )
}
