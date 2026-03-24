import { motion } from 'framer-motion'
import type { Candidature } from '@/store/candidaturesSlice'
import styles from './CandidaturesTable.module.css'

interface CandidaturesTableProps {
  items: Candidature[]
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

function DecisionBadge({ decision }: { decision: Candidature['decision'] }) {
  const map: Record<Candidature['decision'], { className: string; label: string }> = {
    ACCEPTÉE: { className: styles.badgeSuccess, label: 'Acceptée' },
    REFUSÉE: { className: styles.badgeDanger, label: 'Refusée' },
    NON_LISIBLE: { className: styles.badgeWarning, label: 'Non lisible' },
    'À REVOIR': { className: styles.badgeOrange, label: 'À revoir' },
  }
  const { className, label } = map[decision]
  return <span className={`${styles.badge} ${className}`}>{label}</span>
}

export function CandidaturesTable({ items }: CandidaturesTableProps) {
  if (items.length === 0) {
    return (
      <motion.div
        className={styles.empty}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        Aucune candidature pour ce filtre.
      </motion.div>
    )
  }

  return (
    <motion.div
      className={styles.wrapper}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Candidat</th>
              <th>Objet</th>
              <th>Date</th>
              <th>Décision</th>
              <th>Score</th>
              <th>Résumé</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className={styles.row}>
                <td>
                  <span className={styles.name}>{row.candidateName}</span>
                  <span className={styles.email}>{row.email}</span>
                </td>
                <td className={styles.subject}>{row.subject}</td>
                <td className={styles.date}>{formatDate(row.date)}</td>
                <td>
                  <DecisionBadge decision={row.decision} />
                </td>
                <td>
                  {row.score != null ? (
                    <span className={styles.score}>{row.score} %</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className={styles.summary}>
                  {row.rawSummary ? (
                    <span title={row.rawSummary}>
                      {row.rawSummary.length > 50
                        ? `${row.rawSummary.slice(0, 50)}…`
                        : row.rawSummary}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  <a href={`/candidatures/${row.id}`} className={styles.detailLink}>
                    Détail
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}
