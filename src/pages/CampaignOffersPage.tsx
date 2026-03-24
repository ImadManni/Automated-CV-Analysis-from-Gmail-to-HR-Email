import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import styles from './CampaignOffersPage.module.css'

const API_BASE = import.meta.env.VITE_API_URL || ''

type Offer = {
  id: number | string
  title: string
  reference: string
  status: string
  location?: string | null
  company?: string | null
  redirect_url?: string | null
}

type Campaign = {
  id: number | string
  name: string
  code: string
}

export function CampaignOffersPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!campaignId) return
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [campaignRes, offersRes] = await Promise.all([
          fetch(`${API_BASE}/api/campaigns/${campaignId}`),
          fetch(`${API_BASE}/api/campaigns/${campaignId}/offers`),
        ])
        if (campaignRes.ok) {
          const c = await campaignRes.json()
          setCampaign(c.campaign ?? c)
        }
        if (offersRes.ok) {
          const o = await offersRes.json()
          setOffers(o.offers ?? o)
        }
        if (!campaignRes.ok && !offersRes.ok) {
          throw new Error('No API implemented yet')
        }
      } catch (e) {
        setError('Impossible de charger les offres pour cette campagne (API en cours de mise en place).')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [campaignId])

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Link to="/campaigns" className={styles.backLink}>
          ← Retour aux campagnes
        </Link>

        <motion.h1
          className={styles.title}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          Offres de la campagne
        </motion.h1>

        {campaign && (
          <p className={styles.subtitle}>
            <strong>{campaign.name}</strong> ({campaign.code}) — résultats en
            temps réel, avec ouverture directe sur LinkedIn Jobs.
          </p>
        )}

        {error && <p className={styles.error}>{error}</p>}

        {loading ? (
          <p className={styles.info}>Chargement des offres…</p>
        ) : offers.length === 0 ? (
          <p className={styles.info}>Aucune offre trouvée pour cette campagne pour le moment.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Titre</th>
                  <th>Entreprise</th>
                  <th>Localisation</th>
                  <th>Voir sur LinkedIn</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((o) => (
                  <tr key={String(o.id)}>
                    <td>{o.title}</td>
                    <td>{o.company || '—'}</td>
                    <td>{o.location || '—'}</td>
                    <td>
                      {o.redirect_url ? (
                        <a
                          href={o.redirect_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.linkButton}
                        >
                          Voir sur LinkedIn
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

