import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { Candidature } from '@/store/candidaturesSlice'
import styles from './AnalyticsCharts.module.css'

interface AnalyticsChartsProps {
  stats: {
    total: number
    accepted: number
    refused: number
    nonLisible: number
    aRevoir: number
  }
  items: Candidature[]
}

function formatDay(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

export function AnalyticsCharts({ stats, items }: AnalyticsChartsProps) {
  const segments = useMemo(() => {
    const { total, accepted, refused, nonLisible, aRevoir } = stats
    if (total === 0) return []
    return [
      { label: 'Acceptées', value: accepted, pct: (accepted / total) * 100, color: 'var(--success)' },
      { label: 'Refusées', value: refused, pct: (refused / total) * 100, color: 'var(--danger)' },
      { label: 'Non lisibles', value: nonLisible, pct: (nonLisible / total) * 100, color: 'var(--warning)' },
      { label: 'À revoir', value: aRevoir, pct: (aRevoir / total) * 100, color: 'var(--pca-orange)' },
    ].filter((s) => s.value > 0)
  }, [stats])

  const byDay = useMemo(() => {
    const map = new Map<string, number>()
    items.forEach((c) => {
      if (!c.date) return
      const key = new Date(c.date).toISOString().slice(0, 10)
      map.set(key, (map.get(key) ?? 0) + 1)
    })
    const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    return sorted.slice(-14)
  }, [items])

  const maxByDay = Math.max(1, ...byDay.map(([, v]) => v))

  return (
    <motion.div
      className={styles.wrapper}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className={styles.barWrap}>
        <div className={styles.bar}>
          {segments.map((seg, i) => (
            <motion.div
              key={seg.label}
              className={styles.segment}
              style={{ backgroundColor: seg.color }}
              initial={{ width: 0 }}
              animate={{ width: `${seg.pct}%` }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              title={`${seg.label}: ${seg.value} (${seg.pct.toFixed(0)}%)`}
            />
          ))}
        </div>
      </div>
      <div className={styles.legend}>
        {segments.map((seg) => (
          <div key={seg.label} className={styles.legendItem}>
            <span
              className={styles.legendDot}
              style={{ backgroundColor: seg.color }}
            />
            <span className={styles.legendLabel}>{seg.label}</span>
            <span className={styles.legendValue}>
              {seg.value} ({seg.pct.toFixed(0)}%)
            </span>
          </div>
        ))}
      </div>

      {byDay.length > 0 && (
        <div className={styles.frequency}>
          <h3 className={styles.frequencyTitle}>Fréquence des candidatures (14 derniers jours)</h3>
          <div className={styles.frequencyBars}>
            {byDay.map(([day, count]) => (
              <div key={day} className={styles.frequencyItem}>
                <div className={styles.frequencyBarTrack}>
                  <motion.div
                    className={styles.frequencyBarFill}
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / maxByDay) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <div className={styles.frequencyMeta}>
                  <span className={styles.frequencyLabel}>{formatDay(day)}</span>
                  <span className={styles.frequencyCount}>{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}
