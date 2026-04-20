import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { HiChartBar, HiMail, HiDocumentText, HiArrowRight, HiLocationMarker } from 'react-icons/hi'
import { HERO_AUTO_ROTATE_ENABLED, HERO_ROTATE_INTERVAL_MS } from '@/config/ui'
import styles from './HomePage.module.css'

// Chemins des images hero
// URLs encodées pour les noms avec espaces
const HERO_SLOTS = [
  ['/assets/PCA%20WORKSPACE%201.jpg', '/hero-pca-1.jpg', '/hero-pca-1.png'],
  ['/assets/PCA%20WORKSPACE%202.jpg', '/hero-pca-2.jpg', '/hero-pca-2.png'],
  ['/assets/PCA%20WORKSPACE.jpg', '/assets/PCA%20WORKSPACE%20.jpg', '/hero-pca-3.jpg', '/hero-pca-3.png'],
]
function getHeroSrc(index: number, tryNext: number) {
  const slot = HERO_SLOTS[index % HERO_SLOTS.length]
  return slot[Math.min(tryNext, slot.length - 1)] ?? slot[0]
}

export function HomePage() {
  const location = useLocation()
  const [heroIndex, setHeroIndex] = useState(0)
  const [heroFallbackIndex, setHeroFallbackIndex] = useState<Record<number, number>>({})
  const fallback = heroFallbackIndex[heroIndex] ?? 0
  const currentHeroSrc = getHeroSrc(heroIndex, fallback)

  useEffect(() => {
    if (location.hash !== '#localisation') return
    const el = document.getElementById('localisation')
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [location.pathname, location.hash])

  useEffect(() => {
    if (!HERO_AUTO_ROTATE_ENABLED) return
    const t = setInterval(() => {
      setHeroIndex((i) => (i + 1) % HERO_SLOTS.length)
    }, HERO_ROTATE_INTERVAL_MS)
    return () => clearInterval(t)
  }, [])

  const onHeroImgError = () => {
    const slot = HERO_SLOTS[heroIndex % HERO_SLOTS.length]
    const next = (heroFallbackIndex[heroIndex] ?? 0) + 1
    if (next < slot.length) {
      setHeroFallbackIndex((prev) => ({ ...prev, [heroIndex]: next }))
    }
  }

  return (
    <div className={styles.page}>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroBg}>
          <AnimatePresence mode="wait">
            <motion.img
              key={currentHeroSrc}
              src={currentHeroSrc}
              alt="PCA workspace"
              className={styles.heroBgImg}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              onError={onHeroImgError}
            />
          </AnimatePresence>
          <div className={styles.heroOverlay} aria-hidden />
        </div>
        <motion.div
          className={styles.heroContent}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className={styles.heroLabel}>Analyse candidatures</p>
          <h1 className={styles.heroTitle}>
            Suivez les candidatures en temps réel et pilotez vos recrutements.
          </h1>
          <p className={styles.heroSubtitle}>
            Workflow automatisé Gmail → extraction PDF/DOCX → analyse IA → synthèse RH.
            Accédez au tableau de bord pour suivre les candidatures.
          </p>
          <Link to="/dashboard" className={styles.cta}>
            Accéder au tableau de bord
            <HiArrowRight className={styles.ctaIcon} size={20} />
          </Link>
        </motion.div>
        <div className={styles.heroDots}>
          {HERO_SLOTS.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.heroDot} ${i === heroIndex ? styles.heroDotActive : ''}`}
              aria-label={`Image ${i + 1}`}
              onClick={() => setHeroIndex(i)}
            />
          ))}
        </div>
      </section>

      {/* Section Avatar 3D PCA */}
      <section className={`${styles.section} ${styles.avatarSection}`}>
        <div className={styles.sectionInner}>
          <p className={styles.sectionLabel}>Votre avatar 3D</p>
          <div className={styles.avatarLayout}>
            <div className={styles.avatarViewer}>
              <iframe
                src="https://www.3daistudio.com/public/fdbee784-53eb-45c7-9380-2cf8d3c9a6b5?+2576478!+SelfS1"
                title="Avatar 3D PCA"
                loading="lazy"
                className={styles.avatarIframe}
                allow="fullscreen; xr-spatial-tracking; gyroscope; accelerometer"
              />
            </div>
            <div className={styles.avatarText}>
              <h2 className={styles.avatarTitle}>Votre avatar PCA, au cœur de l’analyse IA</h2>
              <p className={styles.avatarSubtitle}>
                Un robot 3D convivial qui incarne la plateforme PCA et accompagne vos équipes RH au quotidien.
              </p>
              <p className={styles.avatarBody}>
                Cet avatar représente l’agent PCA qui surveille vos campagnes de recrutement, analyse les CV en temps
                réel et synthétise les points clés pour vos décideurs. Il illustre la philosophie de la plateforme&nbsp;:
                <strong> transparence, automatisation et expérience utilisateur premium</strong> pour vos processus
                RH.
              </p>
              <p className={styles.avatarBody}>
                Dans l’interface, il est le visage de « Votre AI Assistant » : il centralise les questions, explique les
                scores des candidatures et vous aide à piloter vos workflows n8n, MinIO, PostgreSQL et OpenAI directement
                depuis le dashboard PCA.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section NOTRE PROCESSUS */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <p className={styles.sectionLabel}>Notre processus</p>
          <h2 className={styles.sectionTitle}>De la réception à la décision</h2>
          <div className={styles.cards}>
            <motion.div
              className={styles.card}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <HiMail className={styles.cardIcon} size={32} />
              <h3>Réception Gmail</h3>
              <p>Les candidatures avec pièce jointe (PDF/DOCX) déclenchent le workflow n8n.</p>
            </motion.div>
            <motion.div
              className={styles.card}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <HiDocumentText className={styles.cardIcon} size={32} />
              <h3>Extraction & analyse IA</h3>
              <p>Extraction du texte, analyse par IA (GPT-4O Mini) et décision : accepté, refusé ou à revoir.</p>
            </motion.div>
            <motion.div
              className={styles.card}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
            >
              <HiChartBar className={styles.cardIcon} size={32} />
              <h3>Dashboard & Grafana</h3>
              <p>Tableau de bord candidatures, analytics détaillées et métriques temps réel via Grafana (workflow, pipelines n8n).</p>
              <Link to="/dashboard" className={styles.cardLink}>
                Voir le dashboard
                <HiArrowRight size={16} style={{ marginLeft: '0.35rem', verticalAlign: 'middle' }} />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section Dashboard & statistiques */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.sectionInner}>
          <p className={styles.sectionLabel}>Dashboard</p>
          <h2 className={styles.sectionTitle}>Résultats et indicateurs</h2>
          <p className={styles.sectionIntro}>
            Candidatures acceptées, refusées ou à revoir : synthèse en temps réel.
          </p>
          <div className={styles.sectionCta}>
            <Link to="/dashboard" className={styles.ctaSecondary}>
              Ouvrir le tableau de bord
            </Link>
          </div>
        </div>
      </section>

      {/* Section CTA finale */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaSectionInner}>
          <p className={styles.ctaSectionLabel}>Plateforme PCA</p>
          <h2 className={styles.ctaSectionTitle}>
            Automated CV Analysis — workflow Gmail vers tableau de bord RH
          </h2>
          <div className={styles.ctaSectionBtns}>
            <Link to="/dashboard" className={styles.ctaPrimary}>
              Accéder au tableau de bord
            </Link>
            <Link to="/" className={styles.ctaSecondary}>
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </section>

      {/* Section Localisation PCA - carte visible graphiquement */}
      <section className={styles.locationSection} id="localisation">
        <div className={styles.locationInner}>
          <p className={styles.sectionLabel}>Nous trouver</p>
          <h2 className={styles.sectionTitle}>Notre localisation</h2>
          <p className={styles.locationText}>
            PCA Payment Center for Africa — Carte ci-dessous. Pour l&apos;itinéraire exact, ouvrez le lien Google Maps.
          </p>
          <div className={styles.mapEmbedWrapper} title="Carte - Localisation PCA">
            <iframe
              src="https://www.openstreetmap.org/export/embed.html?bbox=-7.64%2C33.57%2C-7.60%2C33.61&layer=mapnik&marker=33.59%2C-7.62"
              className={styles.mapEmbed}
              title="Carte OpenStreetMap - zone PCA"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <a
            href="https://maps.app.goo.gl/CFwRuwc2KckJeGQFA"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.locationCta}
          >
            <HiLocationMarker size={22} />
            Voir l&apos;emplacement PCA sur Google Maps
          </a>
        </div>
      </section>
    </div>
  )
}
