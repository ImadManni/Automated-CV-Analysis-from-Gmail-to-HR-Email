import { useMemo, useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { HiArrowLeft } from 'react-icons/hi'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { patchCandidatureItem } from '@/store/candidaturesSlice'
import { patchCandidature } from '@/api/candidatures'
import { PCA_PAYMENT_CENTER_AF_BU, buLabel } from '@/lib/pcaPaymentCenterBu'
import styles from './CandidatureDetailPage.module.css'

function normalizeApiBase(raw: string): string {
  let s = raw.replace(/\/+$/, '')
  if (s.endsWith('/api')) s = s.slice(0, -4).replace(/\/+$/, '')
  return s
}

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL || '')

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

  // État pour les entretiens
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [interviewsLoading, setInterviewsLoading] = useState(false)
  const [interviewsError, setInterviewsError] = useState<string | null>(null)
  const [businessUnitCode, setBusinessUnitCode] = useState<string>('')
  const [buSaving, setBuSaving] = useState(false)

  // Formulaire de planification d'entretien
  const [interviewType, setInterviewType] = useState<'ENTRETIEN RH' | 'ENTRETIEN TECHNIQUE' | 'ENTRETIEN DIRECTEUR'>(
    'ENTRETIEN RH',
  )
  const [interviewDateTime, setInterviewDateTime] = useState('')
  const [interviewMode, setInterviewMode] = useState<'PRESENTIEL' | 'VISIO' | 'TELEPHONE'>('VISIO')
  const [interviewLocation, setInterviewLocation] = useState('')
  const [showInterviewEmailPopup, setShowInterviewEmailPopup] = useState(false)
  const [interviewEmailBody, setInterviewEmailBody] = useState('')

  const candidature = useMemo(
    () => items.find((c) => String(c.id) === String(id)),
    [items, id],
  )

  useEffect(() => {
    if (!candidature) return
    setBusinessUnitCode(candidature.businessUnit || '')
  }, [candidature?.id, candidature?.businessUnit])

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

  const buildInterviewEmailDraft = () => {
    const candidate = candidature.candidateName || 'Candidat'
    const subject = candidature.subject || 'Candidature'
    const typeLabel =
      interviewType === 'ENTRETIEN TECHNIQUE'
        ? 'entretien technique'
        : interviewType === 'ENTRETIEN DIRECTEUR'
          ? 'entretien avec le directeur'
          : 'entretien RH'
    const when = interviewDateTime || 'date/heure à confirmer'
    return `Madame, Monsieur ${candidate},

Suite à l'étude de votre candidature pour le poste "${subject}", nous vous invitons à un ${typeLabel}.

- Date et heure : ${when}
- Mode : ${interviewMode}
- Lieu / lien visio : ${interviewLocation}

Cordialement,
Équipe RH — PCA`
  }

  const saveBusinessUnit = async (nextCode: string) => {
    if (!id) return
    setBuSaving(true)
    setInterviewsError(null)
    try {
      const updated = await patchCandidature(id, { businessUnit: nextCode ? nextCode : null })
      dispatch(patchCandidatureItem({ id: updated.id, ...updated }))
      setBusinessUnitCode(updated.businessUnit || '')
    } catch (e: unknown) {
      setInterviewsError(e instanceof Error ? e.message : 'Impossible d’enregistrer la BU.')
    } finally {
      setBuSaving(false)
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
    setInterviewEmailBody(buildInterviewEmailDraft())
    setShowInterviewEmailPopup(true)
  }

  const confirmInterviewPlanning = async () => {
    if (!id) return
    setInterviewsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/candidatures/${id}/interviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewType,
          scheduledAt: interviewDateTime,
          mode: interviewMode,
          location: interviewLocation,
          emailBody: interviewEmailBody,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const created = (await res.json()) as Interview
      setInterviews((prev) => [created, ...prev])
      setInterviewDateTime('')
      setInterviewMode('VISIO')
      setInterviewLocation('')
      setInterviewEmailBody('')
      setShowInterviewEmailPopup(false)
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

  const receptionToLastInterview = (() => {
    if (interviews.length === 0) return '—'
    const receptionTs = new Date(candidature.date).getTime()
    const latestInterviewTs = interviews
      .map((iv) => (iv.scheduledAt ? new Date(iv.scheduledAt).getTime() : NaN))
      .filter((x) => !Number.isNaN(x))
      .sort((a, b) => b - a)[0]
    if (!latestInterviewTs || Number.isNaN(receptionTs) || latestInterviewTs < receptionTs) return '—'
    const hours = Math.floor((latestInterviewTs - receptionTs) / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    const remHours = hours % 24
    return days > 0 ? `${days}j ${remHours}h` : `${hours}h`
  })()

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
        <p className={styles.sectionLead} style={{ marginBottom: '0.9rem' }}>
          Fiche unique : identité, décision IA, synthèse, planification d&apos;entretiens — même style de cartes que le choix du type d&apos;entretien.
        </p>

        <section className={styles.section}>
          <p className={styles.blockEyebrow}>DOSSIER CANDIDAT</p>
          <h2 className={styles.sectionTitle}>Identité, contact & parcours</h2>
          <p className={styles.sectionLead}>Données issues du CV et du message (école, expérience, offre cible).</p>
          <div className={styles.planBlock} style={{ marginBottom: '0.9rem' }}>
            <p className={styles.blockEyebrow}>TYPE D&apos;INFORMATION</p>
            <p className={styles.blockHelp}>
              Une carte par champ — même logique visuelle que le choix RH / Technique / Directeur (bordures, fond blanc).
            </p>
          </div>
          <div className={`${styles.grid} ${styles.dossierGrid}`}>
            <div className={styles.infoCard}>
              <p className={styles.label}>Nom</p>
              <p className={styles.value}>{candidature.candidateName}</p>
            </div>
            <div className={styles.infoCard}>
              <p className={styles.label}>Email</p>
              <p className={styles.value}>{normalizeEmailDisplay(candidature.email)}</p>
            </div>
            <div className={styles.infoCard}>
              <p className={styles.label}>Numéro de téléphone</p>
              <p className={styles.value}>{candidature.phone || '—'}</p>
            </div>
            <div className={styles.infoCard}>
              <p className={styles.label}>Objet</p>
              <p className={styles.value}>{candidature.subject}</p>
            </div>
            <div className={styles.infoCard}>
              <p className={styles.label}>Date</p>
              <p className={styles.value}>{dateLabel}</p>
            </div>
            <div className={styles.infoCard}>
              <p className={styles.label}>Score (%)</p>
              <p className={styles.value}>
                {candidature.score != null && Number.isFinite(Number(candidature.score))
                  ? `${Math.round(Number(candidature.score))} %`
                  : '—'}
              </p>
            </div>
            <div className={styles.infoCard}>
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
            <div className={styles.infoCard}>
              <p className={styles.label}>Nombre d’expérience</p>
              <p className={styles.value}>
                {candidature.experienceCount != null ? candidature.experienceCount : '—'}
              </p>
            </div>
            <div className={styles.infoCard}>
              <p className={styles.label}>Moyenne d’expérience</p>
              <p className={styles.value}>
                {candidature.experienceYearsAvg != null
                  ? `${candidature.experienceYearsAvg} an(s)`
                  : '—'}
              </p>
            </div>
            <div className={styles.infoCard}>
              <p className={styles.label}>Durée d’expérience</p>
              <p className={styles.value}>{candidature.experienceDuration || '—'}</p>
            </div>
            <div className={styles.infoCard}>
              <p className={styles.label}>Dernier employeur</p>
              <p className={styles.value}>{candidature.lastEmployer || '—'}</p>
            </div>
            <div className={styles.infoCard}>
              <p className={styles.label}>Offre cible</p>
              <p className={styles.value}>{candidature.offerTitle || '—'}</p>
            </div>
            <div className={styles.infoCard} style={{ gridColumn: '1 / -1' }}>
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
          <p className={styles.blockHelp}>Chaque bloc est une carte blanche comme « Type d’entretien / champs dossier » — bordure grise, labels uppercase.</p>
          <div className={styles.textBlocks}>
            <div className={styles.infoCard}>
              <p className={styles.label}>Résumé</p>
              <p className={styles.text}>{candidature.rawSummary || '—'}</p>
            </div>
            <div className={styles.infoCard}>
              <p className={styles.label}>Compétences</p>
              <p className={styles.text}>{candidature.skills || '—'}</p>
            </div>
            <div className={styles.infoCard}>
              <p className={styles.label}>Expérience</p>
              <p className={styles.text}>{formatExperience(candidature.experience) || '—'}</p>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.blockEyebrow}>PLANIFICATION</p>
              <h2 className={styles.sectionTitle}>Entretiens</h2>
            </div>
            <Link to="/entretiens" className={styles.linkEntretiens}>
              Voir tous les entretiens planifiés
            </Link>
          </div>
          <p className={styles.sectionLead}>
            Type d’entretien (cartes), date, mode, lieu — aligné avec la page Entretiens planifiés.
          </p>

          <div className={styles.planBlock}>
            <p className={styles.blockEyebrow}>TYPE D&apos;ENTRETIEN</p>
            <p className={styles.blockHelp}>Choix RH — sélectionnez une carte (obligatoire)</p>
            <div className={styles.typeCards}>
              <button
                type="button"
                className={`${styles.typeCard} ${interviewType === 'ENTRETIEN RH' ? styles.typeCardActive : ''}`}
                onClick={() => setInterviewType('ENTRETIEN RH')}
              >
                <span className={styles.typeCardTitle}>RH</span>
                <span className={styles.typeCardSub}>Entretien RH</span>
              </button>
              <button
                type="button"
                className={`${styles.typeCard} ${interviewType === 'ENTRETIEN TECHNIQUE' ? styles.typeCardActive : ''}`}
                onClick={() => setInterviewType('ENTRETIEN TECHNIQUE')}
              >
                <span className={styles.typeCardTitle}>Technique</span>
                <span className={styles.typeCardSub}>Entretien technique</span>
              </button>
              <button
                type="button"
                className={`${styles.typeCard} ${interviewType === 'ENTRETIEN DIRECTEUR' ? styles.typeCardActive : ''}`}
                onClick={() => setInterviewType('ENTRETIEN DIRECTEUR')}
              >
                <span className={styles.typeCardTitle}>Directeur</span>
                <span className={styles.typeCardSub}>Entretien directeur</span>
              </button>
            </div>
          </div>

          <div className={styles.planBlock}>
            <p className={styles.blockEyebrow}>BU — PCA</p>
            <p className={styles.blockHelp}>
              Même principe que le type d’entretien : choix enregistré sur la candidature — visible dans « Réception candidature - entretiens » (colonne PCA BU).
            </p>
            <label className={styles.label} htmlFor="unit-metier">
              Unité métier (filière RH)
            </label>
            <select
              id="unit-metier"
              className={styles.input}
              value={businessUnitCode}
              disabled={buSaving}
              onChange={(e) => {
                const v = e.target.value
                setBusinessUnitCode(v)
                void saveBusinessUnit(v)
              }}
            >
              <option value="">— Non renseigné —</option>
              {PCA_PAYMENT_CENTER_AF_BU.map((bu) => (
                <option key={bu.code} value={bu.code}>
                  {bu.label}
                </option>
              ))}
            </select>
            {buSaving && <p className={styles.blockHelp}>Enregistrement…</p>}
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
                Planifier (préparer e-mail)
              </button>
            </div>
          </form>

          {showInterviewEmailPopup && (
            <div className={styles.offerModalOverlay}>
              <button
                type="button"
                className={styles.offerModalBackdrop}
                aria-label="Fermer la fenêtre de message d’entretien"
                onClick={() => setShowInterviewEmailPopup(false)}
              />
              <div className={styles.offerModalPanel}>
                <h3 className={styles.offerModalTitle}>Message e-mail entretien (n8n)</h3>
                <p className={styles.offerModalText}>
                  Modifiez le corps du mail puis confirmez. Ce message sera envoyé au webhook n8n avec la planification.
                </p>
                <label className={styles.offerModalLabel} htmlFor="interview-email-body">
                  Corps du message
                </label>
                <textarea
                  id="interview-email-body"
                  className={styles.messageTextarea}
                  value={interviewEmailBody}
                  onChange={(e) => setInterviewEmailBody(e.target.value)}
                />
                <div className={styles.offerModalActions}>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => setShowInterviewEmailPopup(false)}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    disabled={interviewsLoading}
                    onClick={() => void confirmInterviewPlanning()}
                  >
                    Confirmer & envoyer au workflow
                  </button>
                </div>
              </div>
            </div>
          )}

          {interviewsError && <p className={styles.error}>{interviewsError}</p>}

          <div className={styles.delayPanel}>
            <p className={styles.blockEyebrow}>DÉLAIS (RÉCEPTION CANDIDATURE — ENTRETIENS)</p>
            <p className={styles.blockHelp}>Parcours jusqu’au dernier RDV : {receptionToLastInterview}</p>
          </div>

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
              const interviewTypeLabel =
                ((iv as any).interviewType as string | undefined) ||
                (iv.notesRh?.toLowerCase().includes('directeur')
                  ? 'Entretien directeur'
                  : iv.notesRh?.toLowerCase().includes('tech')
                    ? 'Entretien technique'
                    : 'Entretien RH')
              const delayFromReception = (() => {
                if (!iv.scheduledAt) return '—'
                const start = new Date(candidature.date).getTime()
                const end = new Date(iv.scheduledAt).getTime()
                if (Number.isNaN(start) || Number.isNaN(end) || end < start) return '—'
                const hours = Math.floor((end - start) / (1000 * 60 * 60))
                const days = Math.floor(hours / 24)
                const remHours = hours % 24
                return days > 0 ? `${days}j ${remHours}h` : `${hours}h`
              })()
              return (
                <div key={iv.id} className={styles.interviewItem}>
                  <div className={styles.interviewMain}>
                    <p className={styles.interviewDatetime}>{dt}</p>
                    <p className={styles.interviewTypePill}>{interviewTypeLabel}</p>
                    <p className={styles.interviewMeta}>
                      {iv.mode.toLowerCase()} · {iv.location}
                    </p>
                    <p className={styles.interviewMeta}>Délai réception — ce RDV : {delayFromReception}</p>
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

      </div>
    </div>
  )
}

