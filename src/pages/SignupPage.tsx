/**
 * Inscription classique: email / mot de passe (sans bouton Keycloak).
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppDispatch } from '@/store/hooks'
import { setAuth } from '@/store/authSlice'
import { signup } from '@/api/auth'
import { HiArrowLeft } from 'react-icons/hi'
import styles from './AuthPage.module.css'

export function SignupPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token, user } = await signup({ email, password, name })
      dispatch(setAuth({ token, user }))
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de créer le compte")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <Link to="/" className={styles.backLink}>
          <HiArrowLeft size={18} /> Retour à l&apos;accueil
        </Link>
        <h1 className={styles.title}>Inscription</h1>
        <p className={styles.subtitle}>Créez votre compte pour accéder au tableau de bord</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}
          <label className={styles.label}>
            Nom complet (optionnel)
            <input
              type="text"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Votre nom"
            />
          </label>
          <label className={styles.label}>
            Email
            <input
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="vous@exemple.com"
            />
          </label>
          <label className={styles.label}>
            Mot de passe
            <input
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </label>
          <button type="submit" className={styles.btn} disabled={loading}>
            {loading ? 'Création du compte…' : 'Créer un compte'}
          </button>
        </form>

        <p className={styles.link}>
          Déjà un compte ? <Link to="/login">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
