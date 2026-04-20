import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { HiArrowLeft } from 'react-icons/hi'
import styles from './InterviewsPage.module.css'

const API_BASE = import.meta.env.VITE_API_URL || ''

type InterviewItem = {
  id: number
  candidatureId: number
  scheduledAt: string | null
  mode: string
  location: string
  status: string
  notesRh: string | null
  candidateName: string | null
  email: string | null
  subject: string | null
}

export function InterviewsPage() {
  const navigate = useNavigate()
  const [interviews, setInterviews] = useState<InterviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('PLANIFIE')
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  const loadInterviews = async () => {
    setLoading(true)
    setError(null)
    try {
      const url = statusFilter
        ? `${API_BASE}/api/interviews?status=${encodeURIComponent(statusFilter)}`
        : `${API_BASE}/api/interviews`
      const res = await fetch(url)
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      setInterviews(data.interviews ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les entretiens.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInterviews()
  }, [statusFilter])

  const updateStatus = async (interviewId: number, status: 'REALISE' | 'ANNULE') => {
    setUpdatingId(interviewId)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/interviews/${interviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      await loadInterviews()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la mise Ã  jour.')
    } finally {
      setUpdatingId(null)
    }
  }

  const formatDate = (s: string | null) => {
    if (!s) return 'â€”'
    try {
      return new Date(s).toLocaleString('fr-FR')
    } catch {
      return s
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <button type="button" onClick={() => navigate(-1)} className={styles.backBtn}>
          <HiArrowLeft size={18} />
          Retour
        </button>

        <motion.h1
          className={styles.title}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          Entretiens planifiÃ©s
        </motion.h1>

        <div className={styles.toolbar}>
          <p className={styles.subtitle}>
            Liste des entretiens avec dÃ©tails et actions (mÃªme couleurs et boutons que la fiche candidature).
          </p>
          <div className={styles.filters}>
            <label className={styles.filterLabel}>
              Statut
              <select
                className={styles.select}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="PLANIFIE">PlanifiÃ©s</option>
                <option value="REALISE">RÃ©alisÃ©s</option>
                <option value="ANNULE">AnnulÃ©s</option>
                <option value="">Tous</option>
              </select>
            </label>
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        {loading ? (
          <p className={styles.info}>Chargement des entretiensâ€¦</p>
        ) : interviews.length === 0 ? (
          <p className={styles.info}>Aucun entretien pour ce filtre.</p>
        ) : (
          <div className={styles.list}>
            {interviews.map((iv) => (
              <div key={iv.id} className={styles.card}>
                <div className={styles.cardMain}>
                  <p className={styles.cardTitle}>
                    {iv.candidateName || 'Candidat'} â€” {iv.subject || 'Sans objet'}
                  </p>
                  <p className={styles.cardMeta}>
                    {formatDate(iv.scheduledAt)} Â· {iv.mode} Â· {iv.location}
                  </p>
                  <p className={styles.cardEmail}>{iv.email || 'â€”'}</p>
                  <p className={styles.cardStatus}>
                    Statut : <span data-status={iv.status}>{iv.status}</span>
                  </p>
                  {iv.notesRh && (
                    <p className={styles.cardNotes}>Notes RH : {iv.notesRh}</p>
                  )}
                </div>
                <div className={styles.cardActions}>
                  <Link
                    to={`/candidatures/${iv.candidatureId}`}
                    className={styles.secondaryBtn}
                  >
                    Voir la candidature
                  </Link>
                  <button
                    type="button"
                    className={styles.btnRealise}
                    disabled={updatingId !== null || iv.status === 'REALISE'}
                    onClick={() => updateStatus(iv.id, 'REALISE')}
                  >
                    Marquer comme rÃ©alisÃ©
                  </button>
                  <button
                    type="button"
                    className={styles.btnAnnule}
                    disabled={updatingId !== null || iv.status === 'ANNULE'}
                    onClick={() => updateStatus(iv.id, 'ANNULE')}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
