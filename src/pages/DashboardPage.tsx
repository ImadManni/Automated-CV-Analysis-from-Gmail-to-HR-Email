import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  HiUserGroup,
  HiCheckCircle,
  HiXCircle,
  HiExclamation,
  HiDocumentDuplicate,
  HiRefresh,
} from 'react-icons/hi'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { setFilter, setCandidatures, type Decision } from '@/store/candidaturesSlice'
import { fetchCandidatures } from '@/api/candidatures'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { CandidaturesTable } from '@/components/dashboard/CandidaturesTable'
import { AnalyticsCharts } from '@/components/dashboard/AnalyticsCharts'
import { DetailedAnalytics } from '@/components/dashboard/DetailedAnalytics'
import { GrafanaSection } from '@/components/dashboard/GrafanaSection'
import styles from './DashboardPage.module.css'

export function DashboardPage() {
  const dispatch = useAppDispatch()
  const { items, filter } = useAppSelector((s) => s.candidatures)
  const [refreshing, setRefreshing] = useState(false)

  const refreshCandidatures = () => {
    setRefreshing(true)
    fetchCandidatures()
      .then(({ candidatures }) => dispatch(setCandidatures(candidatures)))
      .finally(() => setRefreshing(false))
  }

  const stats = useMemo(() => {
    const accepted = items.filter((c) => c.decision === 'ACCEPTÉE').length
    const refused = items.filter((c) => c.decision === 'REFUSÉE').length
    const nonLisible = items.filter((c) => c.decision === 'NON_LISIBLE').length
    const aRevoir = items.filter((c) => c.decision === 'À REVOIR').length
    return {
      total: items.length,
      accepted,
      refused,
      nonLisible,
      aRevoir,
    }
  }, [items])

  const filteredItems = useMemo(() => {
    if (filter === 'ALL') return items
    return items.filter((c) => c.decision === filter)
  }, [items, filter])

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
          </p>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={refreshCandidatures}
            disabled={refreshing}
            aria-label="Rafraîchir la liste"
          >
            <HiRefresh size={18} className={refreshing ? styles.spin : ''} />
            {refreshing ? 'Chargement…' : 'Rafraîchir'}
          </button>
        </div>

        <StatsCards stats={stats} />

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Répartition & fréquences</h2>
          <AnalyticsCharts stats={stats} items={items} />
        </section>

        <DetailedAnalytics items={items} stats={stats} />

        <GrafanaSection />

        <section className={styles.section}>
          <div className={styles.tableHeader}>
            <h2 className={styles.sectionTitle}>Liste des candidatures</h2>
            <div className={styles.filters}>
              {(
                [
                  ['ALL', 'Toutes', HiUserGroup],
                  ['ACCEPTÉE', 'Acceptées', HiCheckCircle],
                  ['REFUSÉE', 'Refusées', HiXCircle],
                  ['NON_LISIBLE', 'Non lisibles', HiDocumentDuplicate],
                  ['À REVOIR', 'À revoir', HiExclamation],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.filterBtn} ${filter === value ? styles.filterBtnActive : ''}`}
                  onClick={() => dispatch(setFilter(value as Decision | 'ALL'))}
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <CandidaturesTable items={filteredItems} />
        </section>
      </div>
    </div>
  )
}
