import { useMemo, useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { HiArrowLeft, HiExternalLink } from 'react-icons/hi'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { setCandidatures } from '@/store/candidaturesSlice'
import { fetchCandidatures, updateCandidatureDecision } from '@/api/candidatures'
import styles from './CandidatureDetailPage.module.css'

const API_BASE = import.meta.env.VITE_API_URL || ''

/** Affiche uniquement l'adresse email (évite "Name <email> email"). */
function normalizeEmailDisplay(email: string | undefined | null): string {
  if (!email) return ''
  const s = email.trim()
  const match = s.match(/<([^>]+)>/)
  if (match) return match[1].trim()
  return s
}

/** Affiche l'expérience en texte (évite "[object Object]"). */
function formatExperience(exp: unknown): string {
  if (exp == null) return ''
  if (typeof exp === 'string') return exp.trim()
  if (Array.isArray(exp)) {
    return exp
      .map((x) => {
        if (typeof x === 'string') return x
        if (x != null && typeof x === 'object') {
          const o = x as Record<string, unknown>
          const parts = [o.company, o.employer, o.role, o.title, o.duration, o.description].filter(Boolean) as string[]
          if (parts.length) return parts.join(' — ')
          return JSON.stringify(o)
        }
        return String(x)
      })
      .join(' · ')
      .trim()
  }
  if (typeof exp === 'object') return JSON.stringify(exp)
  return String(exp)
}

type OfferOption = {
  id: number | string
  label: string
  title: string
  description: string
}

type Interview = {
  id: number
  candidatureId: number
  scheduledAt: string | null
  mode: string
  location: string
  status: string
  notesRh: string | null
}

export function CandidatureDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const items = useAppSelector((s) => s.candidatures.items)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offerModalOpen, setOfferModalOpen] = useState(false)
  const [offersLoading, setOffersLoading] = useState(false)
  const [offersError, setOffersError] = useState<string | null>(null)
  const [offers, setOffers] = useState<OfferOption[]>([])
  const [selectedOfferId, setSelectedOfferId] = useState<number | string | null>(null)

  // État pour les entretiens
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [interviewsLoading, setInterviewsLoading] = useState(false)
  const [interviewsError, setInterviewsError] = useState<string | null>(null)

  // Formulaire de planification d'entretien
  const [interviewDateTime, setInterviewDateTime] = useState('')
  const [interviewMode, setInterviewMode] = useState<'PRESENTIEL' | 'VISIO' | 'TELEPHONE'>('VISIO')
  const [interviewLocation, setInterviewLocation] = useState('')

  const candidature = useMemo(
    () => items.find((c) => String(c.id) === String(id)),
    [items, id],
  )

  const loadInterviews = async () => {
    if (!id) return
    setInterviewsLoading(true)
    setInterviewsError(null)
    try {
      const res = await fetch(`${API_BASE}/api/candidatures/${id}/interviews`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setInterviews(data.interviews ?? [])
    } catch (e: any) {
      setInterviewsError(e?.message || 'Impossible de charger les entretiens.')
    } finally {
      setInterviewsLoading(false)
    }
  }

  useEffect(() => {
    if (id) void loadInterviews()
  }, [id])

  if (!id) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <p className={styles.error}>Identifiant de candidature manquant.</p>
          <button type="button" onClick={() => navigate(-1)} className={styles.backBtn}>
            <HiArrowLeft size={18} />
            Retour
          </button>
        </div>
      </div>
    )
  }

  if (!candidature) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <p className={styles.error}>Candidature introuvable dans les données chargées.</p>
          <button type="button" onClick={() => navigate('/dashboard')} className={styles.backBtn}>
            <HiArrowLeft size={18} />
            Retour au tableau de bord
          </button>
        </div>
      </div>
    )
  }

  const dateLabel = (() => {
    try {
      return new Date(candidature.date).toLocaleString('fr-FR')
    } catch {
      return candidature.date
    }
  })()

  const loadOffersForAssociation = async () => {
    setOfferModalOpen(true)
    setOffersLoading(true)
    setOffersError(null)
    try {
      const res = await fetch(`${API_BASE}/api/campaigns`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const campaigns = data.campaigns ?? data ?? []
      const collected: OfferOption[] = []
      for (const c of campaigns) {
        const r = await fetch(`${API_BASE}/api/campaigns/${c.id}/offers`)
        if (!r.ok) continue
        const od = await r.json()
        const list = od.offers ?? od ?? []
        for (const o of list) {
          const baseLabel = `${c.name} — ${o.title}`
          const label =
            o.location && typeof o.location === 'string'
              ? `${baseLabel} (${o.location})`
              : baseLabel
          const descParts: string[] = []
          if (o.company && typeof o.company === 'string') descParts.push(o.company)
          if (o.location && typeof o.location === 'string') descParts.push(o.location)
          collected.push({
            id: o.id,
            label,
            title: o.title as string,
            description: descParts.join(' · '),
          })
        }
      }
      setOffers(collected)
      setSelectedOfferId(collected[0]?.id ?? null)
    } catch (e: any) {
      setOffersError(e?.message || 'Impossible de charger les offres.')
    } finally {
      setOffersLoading(false)
    }
  }

  const analyzeForSelectedOffer = async () => {
    if (!id || !selectedOfferId) return
    const offer = offers.find((o) => String(o.id) === String(selectedOfferId))
    if (!offer) return
    setUpdating(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/candidatures/${id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerTitle: offer.title,
          offerDescription: offer.description,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json().catch(() => ({} as any))
      const updatedCandidature = data?.candidature
      if (updatedCandidature && updatedCandidature.id != null) {
        dispatch(
          setCandidatures(
            items.map((c) => (String(c.id) === String(updatedCandidature.id) ? updatedCandidature : c)),
          ),
        )
      } else {
        // fallback: recharger tout si la réponse ne contient pas la candidature
        const { candidatures } = await fetchCandidatures()
        dispatch(setCandidatures(candidatures))
      }
      setOfferModalOpen(false)
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la ré-analyse avec le contexte offre.')
    } finally {
      setUpdating(false)
    }
  }

  const changeDecision = async (newDecision: string) => {
    if (!id) return
    setUpdating(true)
    setError(null)
    try {
      await updateCandidatureDecision(id, { decision: newDecision })
      const { candidatures } = await fetchCandidatures()
      dispatch(setCandidatures(candidatures))
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la mise à jour')
    } finally {
      setUpdating(false)
    }
  }

  const planInterview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    if (!interviewDateTime || !interviewMode || !interviewLocation.trim()) {
      setInterviewsError('Veuillez renseigner la date/heure, le mode et le lieu/lien.')
      return
    }
    setInterviewsError(null)
    setInterviewsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/candidatures/${id}/interviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledAt: interviewDateTime,
          mode: interviewMode,
          location: interviewLocation,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const created = (await res.json()) as Interview
      setInterviews((prev) => [created, ...prev])
      setInterviewDateTime('')
      setInterviewMode('VISIO')
      setInterviewLocation('')
    } catch (e: any) {
      setInterviewsError(e?.message || 'Erreur lors de la planification de l’entretien.')
    } finally {
      setInterviewsLoading(false)
    }
  }

  const updateInterviewStatus = async (interviewId: number, status: 'REALISE' | 'ANNULE') => {
    setInterviewsError(null)
    setInterviewsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/interviews/${interviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const updated = (await res.json()) as Interview
      setInterviews((prev) => prev.map((iv) => (iv.id === updated.id ? updated : iv)))
    } catch (e: any) {
      setInterviewsError(e?.message || 'Erreur lors de la mise à jour de l’entretien.')
    } finally {
      setInterviewsLoading(false)
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
          Détail de la candidature
        </motion.h1>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Candidat</h2>
          <div className={styles.grid}>
            <div>
              <p className={styles.label}>Nom</p>
              <p className={styles.value}>{candidature.candidateName}</p>
            </div>
            <div>
              <p className={styles.label}>Email</p>
              <p className={styles.value}>{normalizeEmailDisplay(candidature.email)}</p>
            </div>
            <div>
              <p className={styles.label}>Numéro de téléphone</p>
              <p className={styles.value}>{candidature.phone || '—'}</p>
            </div>
            <div>
              <p className={styles.label}>Objet</p>
              <p className={styles.value}>{candidature.subject}</p>
            </div>
            <div>
              <p className={styles.label}>Date</p>
              <p className={styles.value}>{dateLabel}</p>
            </div>
            <div>
              <p className={styles.label}>École</p>
              <p className={styles.value}>
                {candidature.school || '—'}
                {candidature.schoolType && (
                  <span className={styles.schoolBadge} data-type={candidature.schoolType}>
                    {candidature.schoolType === 'PUBLIC' ? 'Public' : 'Privé'}
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className={styles.label}>Nombre d’expérience</p>
              <p className={styles.value}>
                {candidature.experienceCount != null ? candidature.experienceCount : '—'}
              </p>
            </div>
            <div>
              <p className={styles.label}>Moyenne d’expérience</p>
              <p className={styles.value}>
                {candidature.experienceYearsAvg != null
                  ? `${candidature.experienceYearsAvg} an(s)`
                  : '—'}
              </p>
            </div>
            <div>
              <p className={styles.label}>Durée d’expérience</p>
              <p className={styles.value}>{candidature.experienceDuration || '—'}</p>
            </div>
            <div>
              <p className={styles.label}>Dernier employeur</p>
              <p className={styles.value}>{candidature.lastEmployer || '—'}</p>
            </div>
            <div>
              <p className={styles.label}>Offre cible</p>
              <p className={styles.value}>{candidature.offerTitle || '—'}</p>
            </div>
            <div>
              <p className={styles.label}>Contexte offre</p>
              <p className={styles.valueMuted}>{candidature.offerDescription || '—'}</p>
            </div>
          </div>

          <div className={styles.actions} style={{ marginTop: '1rem' }}>
            {candidature.cvUrl ? (
              <a href={candidature.cvUrl} target="_blank" rel="noopener noreferrer" className={styles.secondaryBtn}>
                Consulter le CV
              </a>
            ) : (
              <span className={styles.disabledBtn}>CV non disponible</span>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Décision globale</h2>
          <div className={styles.grid}>
            <div>
              <p className={styles.label}>Décision</p>
              <p className={styles.value}>{candidature.decision}</p>
            </div>
            <div>
              <p className={styles.label}>Score</p>
              <p className={styles.value}>
                {candidature.score != null ? `${candidature.score} %` : '—'}
              </p>
            </div>
          </div>
          <div className={styles.decisionActions}>
            <button
              type="button"
              className={styles.decisionBtnAccept}
              onClick={() => changeDecision('ACCEPTÉE')}
              disabled={updating}
            >
              Marquer comme acceptée
            </button>
            <button
              type="button"
              className={styles.decisionBtnRefuse}
              onClick={() => changeDecision('REFUSÉE')}
              disabled={updating}
            >
              Marquer comme refusée
            </button>
            <button
              type="button"
              className={styles.decisionBtnReview}
              onClick={() => changeDecision('À REVOIR')}
              disabled={updating}
            >
              Remettre en à revoir
            </button>
          </div>
          {error && <p className={styles.error}>{error}</p>}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Synthèse IA</h2>
          <div className={styles.textBlocks}>
            <div>
              <p className={styles.label}>Résumé</p>
              <p className={styles.text}>{candidature.rawSummary || '—'}</p>
            </div>
            <div>
              <p className={styles.label}>Compétences</p>
              <p className={styles.text}>{candidature.skills || '—'}</p>
            </div>
            <div>
              <p className={styles.label}>Expérience</p>
              <p className={styles.text}>{formatExperience(candidature.experience) || '—'}</p>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Entretien</h2>
            <Link to="/entretiens" className={styles.linkEntretiens}>
              Voir tous les entretiens planifiés
            </Link>
          </div>

          <form className={styles.interviewForm} onSubmit={planInterview}>
            <div className={styles.interviewGrid}>
              <div className={styles.interviewField}>
                <label className={styles.label} htmlFor="interview-datetime">
                  Date &amp; heure
                </label>
                <input
                  id="interview-datetime"
                  type="datetime-local"
                  className={styles.input}
                  value={interviewDateTime}
                  onChange={(e) => setInterviewDateTime(e.target.value)}
                />
              </div>
              <div className={styles.interviewField}>
                <label className={styles.label} htmlFor="interview-mode">
                  Mode
                </label>
                <select
                  id="interview-mode"
                  className={styles.input}
                  value={interviewMode}
                  onChange={(e) => setInterviewMode(e.target.value as any)}
                >
                  <option value="VISIO">Visio</option>
                  <option value="PRESENTIEL">Présentiel</option>
                  <option value="TELEPHONE">Téléphone</option>
                </select>
              </div>
              <div className={styles.interviewField}>
                <label className={styles.label} htmlFor="interview-location">
                  Lieu / lien visio
                </label>
                <input
                  id="interview-location"
                  type="text"
                  className={styles.input}
                  placeholder="Adresse ou lien Teams/Zoom..."
                  value={interviewLocation}
                  onChange={(e) => setInterviewLocation(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.interviewActions}>
              <button
                type="submit"
                className={styles.primaryBtn}
                disabled={interviewsLoading}
              >
                Planifier un entretien
              </button>
            </div>
          </form>

          {interviewsError && <p className={styles.error}>{interviewsError}</p>}

          <div className={styles.interviewList}>
            {interviewsLoading && interviews.length === 0 && (
              <p className={styles.infoText}>Chargement des entretiens…</p>
            )}
            {!interviewsLoading && interviews.length === 0 && !interviewsError && (
              <p className={styles.infoText}>Aucun entretien planifié pour le moment.</p>
            )}
            {interviews.map((iv) => {
              const dt = iv.scheduledAt
                ? (() => {
                    try {
                      return new Date(iv.scheduledAt).toLocaleString('fr-FR')
                    } catch {
                      return iv.scheduledAt
                    }
                  })()
                : '—'
              return (
                <div key={iv.id} className={styles.interviewItem}>
                  <div className={styles.interviewMain}>
                    <p className={styles.interviewDatetime}>{dt}</p>
                    <p className={styles.interviewMeta}>
                      {iv.mode} · {iv.location}
                    </p>
                    <p className={styles.interviewStatus}>
                      Statut : <span>{iv.status}</span>
                    </p>
                    {iv.notesRh && (
                      <p className={styles.interviewNotes}>
                        Notes RH : <span>{iv.notesRh}</span>
                      </p>
                    )}
                  </div>
                  <div className={styles.interviewButtons}>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      disabled={interviewsLoading || iv.status === 'REALISE'}
                      onClick={() => updateInterviewStatus(iv.id, 'REALISE')}
                    >
                      Marquer comme réalisé
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      disabled={interviewsLoading || iv.status === 'ANNULE'}
                      onClick={() => updateInterviewStatus(iv.id, 'ANNULE')}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Actions</h2>
          <div className={styles.actions}>
            <Link to="/dashboard" className={styles.secondaryBtn}>
              Retour au dashboard
            </Link>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={loadOffersForAssociation}
              disabled={updating}
            >
              <HiExternalLink size={16} />
              Associer à une offre de campagne
            </button>
          </div>
        </section>

        {offerModalOpen && (
          <div className={styles.offerModalOverlay}>
            <div className={styles.offerModalBackdrop} onClick={() => setOfferModalOpen(false)} />
            <div className={styles.offerModalPanel}>
              <h2 className={styles.offerModalTitle}>Associer à une offre</h2>
              <p className={styles.offerModalText}>
                Choisis une offre de campagne (mock LinkedIn) pour contextualiser l’analyse IA de ce CV.
              </p>
              {offersLoading ? (
                <p className={styles.offerModalInfo}>Chargement des offres…</p>
              ) : offersError ? (
                <p className={styles.error}>{offersError}</p>
              ) : offers.length === 0 ? (
                <p className={styles.offerModalInfo}>
                  Aucune offre disponible pour le moment. Vérifie la page Campagnes.
                </p>
              ) : (
                <div className={styles.offerModalBody}>
                  <label className={styles.offerModalLabel} htmlFor="offer-select">
                    Offre cible
                  </label>
                  <select
                    id="offer-select"
                    className={styles.offerModalSelect}
                    value={selectedOfferId != null ? String(selectedOfferId) : ''}
                    onChange={(e) => setSelectedOfferId(e.target.value)}
                  >
                    {offers.map((o) => (
                      <option key={String(o.id)} value={String(o.id)}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className={styles.offerModalActions}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setOfferModalOpen(false)}
                >
                  Fermer
                </button>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={analyzeForSelectedOffer}
                  disabled={updating || offers.length === 0}
                >
                  Relancer l’analyse avec cette offre
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

