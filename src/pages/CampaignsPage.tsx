import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { demoCampaigns, demoCampaignOffers } from '@/mock/demoData'
import styles from './CampaignsPage.module.css'
const USE_DEMO_FALLBACK = import.meta.env.VITE_USE_DEMO_FALLBACK === 'true'

function normalizeApiBase(raw: string): string {
  let s = raw.replace(/\/+$/, '')
  if (s.endsWith('/api')) s = s.slice(0, -4).replace(/\/+$/, '')
  return s
}

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL || '')

type Campaign = {
  id: number | string
  name: string
  code: string
  status: string
  start_date?: string | null
  end_date?: string | null
  results_count?: number
}

type Offer = {
  id: number | string
  title: string
  company?: string | null
  location?: string | null
  redirect_url?: string | null
}

export function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | string | null>(null)
  const [overlayOffers, setOverlayOffers] = useState<Offer[]>([])
  const [overlayLoading, setOverlayLoading] = useState(false)
  const [overlayError, setOverlayError] = useState<string | null>(null)

  const loadCampaigns = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/campaigns`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setCampaigns(data.campaigns ?? data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les campagnes (API ou réseau).')
      setCampaigns(USE_DEMO_FALLBACK ? demoCampaigns : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCampaigns()
  }, [])

  useEffect(() => {
    if (selectedCampaignId == null) return
    const stillExists = campaigns.some((c) => String(c.id) === String(selectedCampaignId))
    if (!stillExists) setSelectedCampaignId(null)
  }, [campaigns, selectedCampaignId])

  useEffect(() => {
    // Charger quelques offres pour la campagne sélectionnée afin d'afficher des détails façon LinkedIn
    if (selectedCampaignId == null) {
      setOverlayOffers([])
      setOverlayError(null)
      setOverlayLoading(false)
      return
    }
    const loadOffers = async () => {
      setOverlayLoading(true)
      setOverlayError(null)
      try {
        const res = await fetch(`${API_BASE}/api/campaigns/${selectedCampaignId}/offers`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setOverlayOffers(data.offers ?? data)
      } catch (e: unknown) {
        setOverlayError(
          e instanceof Error
            ? e.message
            : 'Impossible de charger les offres de cette campagne (API ou réseau).'
        )
        setOverlayOffers(USE_DEMO_FALLBACK ? (demoCampaignOffers[String(selectedCampaignId)] ?? []) : [])
      } finally {
        setOverlayLoading(false)
      }
    }
    loadOffers()
  }, [selectedCampaignId])

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <motion.h1
          className={styles.title}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          Campagnes de recrutement
        </motion.h1>

        <div className={styles.subtitle} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <span>
            Point d&apos;entrée pour la RH : visualisez les campagnes synchronisées (API), puis basculez vers le tableau de
            bord candidatures, la matrice d&apos;entretiens et le time to interview.
          </span>
          <button type="button" className={styles.moreBtn} onClick={() => void loadCampaigns()}>
            Rafraîchir
          </button>
        </div>

        <div className={styles.summaryGrid} style={{ marginBottom: '1.25rem' }}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Candidatures & pipeline</span>
            <span className={styles.summaryValue} style={{ fontSize: '1rem' }}>Tableau de bord</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Planification</span>
            <span className={styles.summaryValue} style={{ fontSize: '1rem' }}>Entretiens & RDV</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Sourcing</span>
            <span className={styles.summaryValue} style={{ fontSize: '1rem' }}>Catalogue campagnes</span>
          </div>
        </div>

        {!loading && campaigns.length > 0 && (
          <p className={styles.subtitle}>
            Visualisez les campagnes d&apos;offres de recrutement PCA (Software / IA, Data & BI, Cloud / DevOps)
            et accédez en un clic aux offres détaillées. Utilisez cette vue pour avoir une vision rapide
            du volume d&apos;offres par campagne.
          </p>
        )}

        {!loading && campaigns.length > 0 && (
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Campagnes actives</span>
              <span className={styles.summaryValue}>{campaigns.length}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Offres totales</span>
              <span className={styles.summaryValue}>
                {campaigns
                  .reduce((sum, c) => sum + (c.results_count ?? 0), 0)
                  .toLocaleString('fr-FR')}
              </span>
            </div>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        {loading ? (
          <p className={styles.info}>Chargement des campagnes…</p>
        ) : campaigns.length === 0 ? (
          <p className={styles.info}>
            Aucune campagne trouvée. Cette page sera pleinement fonctionnelle une fois l&apos;API campagnes implémentée.
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Code</th>
                  <th>Offres</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={String(c.id)}>
                    <td>{c.name}</td>
                    <td>{c.code}</td>
                    <td>{c.results_count != null ? c.results_count.toLocaleString('fr-FR') : '—'}</td>
                    <td>{c.status}</td>
                    <td className={styles.actionsCell}>
                      <button
                        type="button"
                        className={styles.moreBtn}
                        onClick={() => setSelectedCampaignId(c.id)}
                      >
                        Plus d&apos;infos
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedCampaignId != null && (
          <div className={styles.overlay}>
            <div className={styles.overlayBackdrop} onClick={() => setSelectedCampaignId(null)} />
            <div className={styles.overlayPanel}>
              {(() => {
                const c = campaigns.find((x) => String(x.id) === String(selectedCampaignId))
                if (!c) return null
                const offersLabel =
                  c.results_count && c.results_count > 0
                    ? `${c.results_count.toLocaleString('fr-FR')} offre(s) importée(s)`
                    : 'Aucune offre importée pour le moment'
                const sampleOffers = overlayOffers.slice(0, 3)
                return (
                  <>
                    <div className={styles.overlayHeader}>
                      <h2 className={styles.overlayTitle}>{c.name}</h2>
                      <button
                        type="button"
                        className={styles.overlayClose}
                        onClick={() => setSelectedCampaignId(null)}
                      >
                        ✕
                      </button>
                    </div>
                    <p className={styles.overlayText}>
                      Code campagne : <strong>{c.code}</strong> – Statut :{' '}
                      <strong>{c.status}</strong>
                    </p>
                    <p className={styles.overlayText}>{offersLabel} connectée(s) à cette campagne.</p>

                    {overlayLoading && (
                      <p className={styles.overlayText}>Chargement des offres détaillées…</p>
                    )}
                    {overlayError && <p className={styles.error}>{overlayError}</p>}

                    {!overlayLoading && !overlayError && sampleOffers.length > 0 && (
                      <div className={styles.overlayOffers}>
                        <ul className={styles.overlayOffersList}>
                          {sampleOffers.map((o) => (
                            <li key={String(o.id)} className={styles.overlayOfferItem}>
                              <div className={styles.overlayOfferMain}>
                                <span className={styles.overlayOfferTitle}>{o.title}</span>
                                {o.company && (
                                  <span className={styles.overlayOfferCompany}>{o.company}</span>
                                )}
                                {o.location && (
                                  <span className={styles.overlayOfferLocation}>{o.location}</span>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className={styles.overlayText}>
                      En ouvrant les offres, tu peux accéder aux annonces détaillées et aux liens
                      externes (LinkedIn Jobs) pour voir les résultats en temps réel, comme sur un
                      vrai job board externe à la plateforme.
                    </p>
                    <div className={styles.overlayActions}>
                      <Link
                        to={`/campaigns/${c.id}/offers`}
                        className={styles.overlayPrimary}
                        onClick={() => setSelectedCampaignId(null)}
                      >
                        Voir les offres de cette campagne
                      </Link>
                      <button
                        type="button"
                        className={styles.overlaySecondary}
                        onClick={() => setSelectedCampaignId(null)}
                      >
                        Fermer
                      </button>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

