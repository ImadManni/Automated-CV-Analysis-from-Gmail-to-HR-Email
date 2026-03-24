import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { HiAcademicCap, HiTag } from 'react-icons/hi'
import type { Candidature } from '@/store/candidaturesSlice'
import styles from './DetailedAnalytics.module.css'

interface DetailedAnalyticsProps {
  items: Candidature[]
  stats: { total: number; accepted: number; refused: number; nonLisible: number; aRevoir: number }
}

export function DetailedAnalytics({ items, stats }: DetailedAnalyticsProps) {
  const { total, accepted } = stats

  const scoreRanges = useMemo(() => {
    const withScore = items.filter((c) => c.score != null) as (Candidature & { score: number })[]
    const ranges = [
      { label: '0-40', min: 0, max: 40, count: 0 },
      { label: '41-60', min: 41, max: 60, count: 0 },
      { label: '61-80', min: 61, max: 80, count: 0 },
      { label: '81-100', min: 81, max: 100, count: 0 },
    ]
    withScore.forEach((c) => {
      const r = ranges.find((x) => c.score >= x.min && c.score <= x.max)
      if (r) r.count++
    })
    const maxCount = Math.max(1, ...ranges.map((r) => r.count))
    return ranges.map((r) => ({ ...r, pct: (r.count / maxCount) * 100 }))
  }, [items])

  const skillsCount = useMemo(() => {
    const map = new Map<string, number>()
    items.forEach((c) => {
      if (!c.skills) return
      c.skills.split(/[,;]/).forEach((s) => {
        const key = s.trim()
        if (key) map.set(key, (map.get(key) ?? 0) + 1)
      })
    })
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  }, [items])

  const conversionRate = total > 0 ? ((accepted / total) * 100).toFixed(1) : '0'
  const avgScore = useMemo(() => {
    const withScore = items.filter((c) => c.score != null) as (Candidature & { score: number })[]
    if (withScore.length === 0) return null
    const sum = withScore.reduce((a, c) => a + c.score, 0)
    return (sum / withScore.length).toFixed(1)
  }, [items])

  return (
    <motion.div
      className={styles.wrapper}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <h3 className={styles.panelTitle}>Analytics détaillées</h3>

      <div className={styles.kpiStrip}>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Taux d&apos;acceptation</span>
          <span className={styles.kpiValue}>{conversionRate}%</span>
        </div>
        {avgScore != null && (
          <div className={styles.kpi}>
            <span className={styles.kpiLabel}>Score moyen</span>
            <span className={styles.kpiValue}>{avgScore}</span>
          </div>
        )}
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Candidatures avec score</span>
          <span className={styles.kpiValue}>
            {items.filter((c) => c.score != null).length} / {total}
          </span>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.block}>
          <div className={styles.blockHeader}>
            <HiAcademicCap size={20} />
            <span>Distribution des scores</span>
          </div>
          <div className={styles.scoreRanges}>
            {scoreRanges.map((r) => (
              <div key={r.label} className={styles.rangeRow}>
                <span className={styles.rangeLabel}>{r.label}</span>
                <div className={styles.rangeTrack}>
                  <motion.div
                    className={styles.rangeFill}
                    initial={{ width: 0 }}
                    animate={{ width: `${r.pct}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
                <span className={styles.rangeCount}>{r.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.block}>
          <div className={styles.blockHeader}>
            <HiTag size={20} />
            <span>Top compétences</span>
          </div>
          <div className={styles.skillsList}>
            {skillsCount.length === 0 ? (
              <p className={styles.empty}>Aucune compétence renseignée</p>
            ) : (
              skillsCount.map(([skill, count]) => {
                const maxS = Math.max(...skillsCount.map(([, c]) => c))
                const pct = (count / maxS) * 100
                return (
                  <div key={skill} className={styles.skillRow}>
                    <span className={styles.skillName}>{skill}</span>
                    <div className={styles.skillBarWrap}>
                      <motion.div
                        className={styles.skillBar}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.4 }}
                      />
                    </div>
                    <span className={styles.skillCount}>{count}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
