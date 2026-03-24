import { motion } from 'framer-motion'
import { HiUserGroup, HiCheckCircle, HiXCircle, HiDocumentDuplicate, HiExclamation } from 'react-icons/hi'
import styles from './StatsCards.module.css'

interface StatsCardsProps {
  stats: {
    total: number
    accepted: number
    refused: number
    nonLisible: number
    aRevoir: number
  }
}

const cards = [
  { key: 'total' as const, label: 'Total', icon: HiUserGroup, color: 'var(--pca-silver)' },
  { key: 'accepted' as const, label: 'Acceptées', icon: HiCheckCircle, color: 'var(--success)' },
  { key: 'refused' as const, label: 'Refusées', icon: HiXCircle, color: 'var(--danger)' },
  { key: 'nonLisible' as const, label: 'Non lisibles', icon: HiDocumentDuplicate, color: 'var(--warning)' },
  { key: 'aRevoir' as const, label: 'À revoir', icon: HiExclamation, color: 'var(--pca-orange)' },
]

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <motion.div
      className={styles.grid}
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
    >
      {cards.map(({ key, label, icon: Icon, color }) => (
        <motion.div
          key={key}
          className={styles.card}
          variants={{
            hidden: { opacity: 0, y: 16 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.3 }}
        >
          <div className={styles.iconWrap} style={{ color }}>
            <Icon size={28} />
          </div>
          <div className={styles.content}>
            <span className={styles.value}>{stats[key]}</span>
            <span className={styles.label}>{label}</span>
          </div>
        </motion.div>
      ))}
    </motion.div>
  )
}
