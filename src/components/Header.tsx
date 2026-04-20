import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { HiMenuAlt3, HiX, HiChartBar, HiLogin, HiLogout } from 'react-icons/hi'
import { HEADER_ANIMATION_ENABLED } from '@/config/ui'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { logout } from '@/store/authSlice'
import { doLogin as keycloakLogin, isKeycloakFrontendEnabled } from '@/keycloak'
import styles from './Header.module.css'

// Navigation principale (desktop + mobile).
// Simplifiée pour se concentrer sur les écrans clés de la plateforme.
const navLinks: { to: string; label: string; end?: boolean; icon?: typeof HiChartBar }[] = [
  { to: '/dashboard', label: 'Dashboard', end: true, icon: HiChartBar },
  { to: '/entretiens', label: 'Entretiens', end: true },
  { to: '/campaigns', label: 'Campagnes', end: false },
]

const LOGO_SOURCES = ['/assets/PCA.png', '/pca-logo.png']

export function Header() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { token, user, avatar } = useAppSelector((s) => s.auth)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [logoIndex, setLogoIndex] = useState(0)
  const logoError = logoIndex >= LOGO_SOURCES.length
  const location = useLocation()

  const handleLogout = () => {
    closeMobile()
    dispatch(logout())
    navigate('/', { replace: true })
  }

  const isActive = (to: string, end?: boolean) => {
    if (to === '/') return location.pathname === '/'
    if (to.startsWith('/#')) return location.pathname === '/' && location.hash === to.slice(1)
    return end ? location.pathname === to : location.pathname.startsWith(to)
  }

  const closeMobile = () => setMobileOpen(false)

  const scrollToLocalisation = (e: React.MouseEvent) => {
    if (location.pathname !== '/') return // laisser le Link naviguer vers /
    e.preventDefault()
    window.history.pushState(null, '', '/#localisation')
    const el = document.getElementById('localisation')
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    closeMobile()
  }

  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mq.matches)
    const handler = () => setReduceMotion(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const animateHeader = HEADER_ANIMATION_ENABLED && !reduceMotion

  const HeaderWrapper = animateHeader ? motion.header : 'header'
  const headerProps = animateHeader
    ? {
        initial: { y: -20, opacity: 0 },
        animate: { y: 0, opacity: 1 },
        transition: { duration: 0.35, ease: 'easeOut' },
        className: styles.header,
      }
    : { className: styles.header }

  return (
    <HeaderWrapper {...headerProps}>
      <div className={styles.container}>
        <button
          type="button"
          className={styles.menuBtn}
          aria-label="Ouvrir le menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((o) => !o)}
        >
          {mobileOpen ? <HiX size={26} /> : <HiMenuAlt3 size={26} />}
        </button>

        <Link to="/" className={`${styles.logo} ${reduceMotion ? styles.logoReduceMotion : ''}`}>
          {!logoError ? (
            <img
              src={LOGO_SOURCES[logoIndex]}
              alt="PCA Payment Center for Africa - Process your innovation"
              className={styles.logoImg}
              width={180}
              height={52}
              onError={() => setLogoIndex((i) => i + 1)}
            />
          ) : (
            <span className={styles.logoFallback}>PCA</span>
          )}
        </Link>

        <nav className={styles.nav} aria-label="Navigation principale">
          {token && user ? (
            <span className={styles.authWrap}>
              <Link to="/account" className={styles.authAvatarLink} title="Mon compte">
                {avatar ? (
                  <img src={avatar} alt="" className={styles.authAvatar} />
                ) : (
                  <span className={styles.authAvatarPlaceholder}>{user.name?.[0] || user.email?.[0] || '?'}</span>
                )}
              </Link>
              <button type="button" className={styles.authLink} onClick={handleLogout}>
                <HiLogout size={18} /> Déconnexion
              </button>
            </span>
          ) : (
            <span className={styles.authWrap}>
              {isKeycloakFrontendEnabled() && (
                <button
                  type="button"
                  className={styles.authLink}
                  onClick={() => {
                    closeMobile()
                    keycloakLogin()
                  }}
                >
                  <HiLogin size={18} /> Connexion
                </button>
              )}
            </span>
          )}
        </nav>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            className={styles.mobileNav}
            aria-label="Menu mobile"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {navLinks.map((link) => {
              const Icon = link.icon
              const isLocalisation = link.to === '/#localisation'
              const handleMobileNavClick = (e: React.MouseEvent) => {
                if (isLocalisation) {
                  scrollToLocalisation(e)
                } else {
                  e.preventDefault()
                  navigate(link.to)
                  closeMobile()
                }
              }
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={styles.mobileLink}
                  onClick={handleMobileNavClick}
                >
                  {Icon && <Icon size={20} />}
                  {link.label}
                </Link>
              )
            })}
            {token && user ? (
              <div className={styles.mobileAuth}>
                <Link
                  to="/account"
                  className={styles.mobileAvatarLink}
                  onClick={closeMobile}
                  title="Mon compte"
                >
                  {avatar ? (
                    <img src={avatar} alt="" className={styles.mobileAvatar} />
                  ) : (
                    <span className={styles.mobileAvatarPlaceholder}>
                      {user.name?.[0] || user.email?.[0] || '?'}
                    </span>
                  )}
                </Link>
                <button
                  type="button"
                  className={styles.mobileAuthBtn}
                  onClick={() => {
                    navigate('/account')
                    closeMobile()
                  }}
                >
                  Profil
                </button>
                <button type="button" className={styles.mobileAuthBtn} onClick={handleLogout}>
                  <HiLogout size={20} />
                  Déconnexion
                </button>
              </div>
            ) : (
              <div className={styles.mobileAuth}>
                {isKeycloakFrontendEnabled() && (
                  <button
                    type="button"
                    className={styles.mobileAuthBtn}
                    onClick={() => {
                      closeMobile()
                      keycloakLogin()
                    }}
                  >
                    <HiLogin size={20} />
                    Connexion
                  </button>
                )}
              </div>
            )}
          </motion.nav>
        )}
      </AnimatePresence>
    </HeaderWrapper>
  )
}
