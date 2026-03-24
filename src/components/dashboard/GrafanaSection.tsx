import { motion } from 'framer-motion'
import { HiExternalLink, HiChartBar } from 'react-icons/hi'
import { GRAFANA_DASHBOARD_URL } from '@/config/ui'
import styles from './GrafanaSection.module.css'

export function GrafanaSection() {
  return (
    <motion.section
      className={styles.section}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className={styles.card}>
        <div className={styles.header}>
          <HiChartBar className={styles.icon} size={28} />
          <div>
            <h2 className={styles.title}>Dashboard Grafana</h2>
            <p className={styles.subtitle}>
              Métriques avancées, pipelines n8n et monitoring du workflow en temps réel
            </p>
          </div>
        </div>
        <p className={styles.description}>
          Visualisez les performances du workflow « Automated CV Analysis », taux de traitement,
          latences et alertes depuis une seule interface.
        </p>
        <a
          href={GRAFANA_DASHBOARD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.cta}
        >
          Ouvrir Grafana
          <HiExternalLink size={18} />
        </a>
      </div>
    </motion.section>
  )
}
