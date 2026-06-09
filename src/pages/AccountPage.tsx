import { Link } from 'react-router-dom'
import { useRef } from 'react'
import { motion } from 'framer-motion'
import { HiUser, HiMail, HiArrowLeft, HiPhotograph } from 'react-icons/hi'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { setAvatar } from '@/store/authSlice'
import styles from './AccountPage.module.css'

const AVATAR_SIZE = 200
const AVATAR_QUALITY = 0.88

function resizeImageToDataUrl(file: File, maxSize: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const w = img.naturalWidth
      const h = img.naturalHeight
      let width = w
      let height = h
      if (w > maxSize || h > maxSize) {
        if (w > h) {
          width = maxSize
          height = Math.round((h * maxSize) / w)
        } else {
          height = maxSize
          width = Math.round((w * maxSize) / h)
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas not supported'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      try {
        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Invalid image'))
    }
    img.src = url
  })
}

export function AccountPage() {
  const dispatch = useAppDispatch()
  const { user, avatar, roles } = useAppSelector((s) => s.auth)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    e.target.value = ''
    try {
      const dataUrl = await resizeImageToDataUrl(file, AVATAR_SIZE, AVATAR_QUALITY)
      dispatch(setAvatar(dataUrl))
    } catch {
      // ignore
    }
  }

  const handleRemoveAvatar = () => {
    dispatch(setAvatar(null))
  }

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <p className={styles.subtitle}>Session expirée. Veuillez vous reconnecter.</p>
          <Link to="/login" className={styles.backLink}>
            <HiArrowLeft size={18} /> Connexion
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link to="/dashboard" className={styles.backLink}>
            <HiArrowLeft size={18} /> Retour au tableau de bord
          </Link>
          <h1 className={styles.title}>Mon compte</h1>
          <p className={styles.subtitle}>
            Informations de votre compte PCA. Ces données sont utilisées pour votre accès au tableau de bord et aux candidatures.
          </p>
        </motion.div>

        <motion.section
          className={styles.section}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
        >
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <HiUser size={24} className={styles.cardIcon} />
              <h2 className={styles.sectionTitle}>Informations personnelles</h2>
            </div>
            <div className={styles.avatarBlock}>
              <div className={styles.avatarWrap} aria-hidden>
                {avatar ? (
                  <img src={avatar} alt="" className={styles.avatarImg} />
                ) : (
                  <span className={styles.avatarPlaceholder}>
                    <HiPhotograph size={48} />
                  </span>
                )}
              </div>
              <div className={styles.avatarActions}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className={styles.avatarInput}
                  onChange={handleAvatarChange}
                  aria-label="Choisir une photo"
                />
                <button
                  type="button"
                  className={styles.avatarBtn}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatar ? 'Changer la photo' : 'Ajouter une photo'}
                </button>
                {avatar && (
                  <button
                    type="button"
                    className={styles.avatarBtnSecondary}
                    onClick={handleRemoveAvatar}
                  >
                    Supprimer
                  </button>
                )}
              </div>
            </div>
            <dl className={styles.infoList}>
              <div className={styles.infoRow}>
                <dt className={styles.infoLabel}>Nom</dt>
                <dd className={styles.infoValue}>{user.name || '—'}</dd>
              </div>
              <div className={styles.infoRow}>
                <dt className={styles.infoLabel}>Email</dt>
                <dd className={styles.infoValue}>
                  <span className={styles.emailWrap}>
                    <HiMail size={18} aria-hidden />
                    {user.email}
                  </span>
                </dd>
              </div>
              {Array.isArray(roles) && roles.length > 0 && (
                <div className={styles.infoRow}>
                  <dt className={styles.infoLabel}>Rôles</dt>
                  <dd className={styles.infoValue}>{roles.join(', ')}</dd>
                </div>
              )}
            </dl>
          </div>
        </motion.section>

        <motion.section
          className={styles.section}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.12 }}
        >
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Plateforme</h2>
            <p className={styles.platformText}>
              Vous êtes connecté à la plateforme <strong>PCA — Automated CV Analysis from Gmail to HR Email</strong>.
              Accédez au tableau de bord pour consulter les candidatures et les statistiques en temps réel.
            </p>
            <Link to="/dashboard" className={styles.ctaLink}>
              Accéder au tableau de bord →
            </Link>
          </div>
        </motion.section>
      </div>
    </div>
  )
}
