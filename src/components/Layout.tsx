import { ReactNode, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Header } from './Header'
import { Footer } from './Footer'
import { RagAiAssistant } from './RagAiAssistant/RagAiAssistant'
import styles from './Layout.module.css'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mq.matches)
    const handler = () => setReduceMotion(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <motion.div
      initial={{ opacity: reduceMotion ? 1 : 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 1.1, ease: 'easeOut' }}
    >
      <Header />
      <div className={styles.sponsorStrip} role="banner" aria-label="Partenaires">
        <div className={styles.sponsorStripInner}>
          <div className={styles.sponsorTrack}>
            <div className={styles.sponsorSlot} aria-hidden>
              <img src="/assets/PCA.png" alt="" className={styles.sponsorLogo} />
            </div>
            <div className={styles.sponsorSlot}>
              <img
                src="/assets/PCA.png"
                alt="PCA Payment Center for Africa"
                className={styles.sponsorLogo}
              />
            </div>
          </div>
        </div>
      </div>
      <main>{children}</main>
      <Footer />
      <RagAiAssistant />
    </motion.div>
  )
}
