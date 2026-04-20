import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  HiLocationMarker,
  HiExternalLink,
  HiHome,
  HiChartBar,
  HiQuestionMarkCircle,
} from 'react-icons/hi'
import { FaFacebookF, FaLinkedinIn, FaTwitter, FaInstagram } from 'react-icons/fa'
import styles from './Footer.module.css'

const LOGO_SOURCES = ['/assets/PCA.png', '/pca-logo.png']

const PCA_GOOGLE_MAPS_URL = 'https://maps.app.goo.gl/CFwRuwc2KckJeGQFA'

// Modifier les URLs pour pointer vers les pages PCA (Facebook, LinkedIn, etc.)
const SOCIAL_LINKS = [
  { href: 'https://www.facebook.com', icon: FaFacebookF, label: 'Facebook' },
  { href: 'https://www.linkedin.com', icon: FaLinkedinIn, label: 'LinkedIn' },
  { href: 'https://twitter.com', icon: FaTwitter, label: 'Twitter' },
  { href: 'https://www.instagram.com', icon: FaInstagram, label: 'Instagram' },
]

const footerColumns = [
  {
    title: 'Navigation',
    icon: HiHome,
    links: [
      { label: 'Accueil', to: '/' },
      { label: 'Tableau de bord', to: '/dashboard' },
    ],
  },
  {
    title: 'Ressources',
    icon: HiChartBar,
    links: [
      { label: 'Dashboard', to: '/dashboard' },
      { label: 'Statistiques & analytiques', to: '/dashboard' },
    ],
  },
]

export function Footer() {
  const currentYear = new Date().getFullYear()
  const [logoError, setLogoError] = useState(false)

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.block}>
          <Link to="/" className={styles.brand}>
            {!logoError ? (
              <img
                src={LOGO_SOURCES[0]}
                alt="PCA"
                className={styles.brandLogo}
                onError={() => setLogoError(true)}
              />
            ) : (
              <span className={styles.brandText}>PCA</span>
            )}
            <span className={styles.brandSlogan}>Process your innovation</span>
          </Link>
          <p className={styles.legal}>
            Payment Center for Africa — Analyse des candidatures et recrutement.
          </p>
          <div className={styles.socialWrap}>
            {SOCIAL_LINKS.map(({ href, icon: Icon, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialLink}
                aria-label={label}
              >
                <Icon size={18} />
              </a>
            ))}
          </div>
        </div>

        {footerColumns.map((col) => {
          const Icon = col.icon
          return (
          <div key={col.title} className={styles.block}>
            <h4 className={styles.title}>
              <Icon className={styles.titleIcon} size={14} />
              {col.title}
            </h4>
            <ul className={styles.links}>
              {col.links.map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className={styles.link}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          )
        })}

        <div className={styles.block}>
          <h4 className={styles.title}>
            <HiLocationMarker className={styles.titleIcon} size={14} />
            Localisation
          </h4>
          <p className={styles.mapText}>Trouvez PCA sur la carte</p>
          <a
            href={PCA_GOOGLE_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.mapLink}
          >
            Voir sur Google Maps
            <HiExternalLink size={16} className={styles.mapLinkIcon} />
          </a>
          <Link to="/#localisation" className={styles.mapLinkSecondary}>
            Voir la section localisation
          </Link>
        </div>
      </div>

      <div className={styles.helpBlock}>
        <HiQuestionMarkCircle className={styles.helpIcon} size={22} />
        <p className={styles.helpTitle}>Besoin d&apos;aide ?</p>
        <p className={styles.helpText}>
          Accédez au dashboard pour voir les candidatures, statistiques et analytiques en temps réel.
        </p>
        <div className={styles.helpLinks}>
          <Link to="/dashboard" className={styles.helpLink}>
            Voir le dashboard
          </Link>
          <Link to="/" className={styles.helpLink}>
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>

      <div className={styles.copyright}>
        COPYRIGHT {currentYear} — PCA PAYMENT CENTER FOR AFRICA — TOUS DROITS RÉSERVÉS
      </div>
    </footer>
  )
}
