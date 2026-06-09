import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import styles from './CampaignOffersPage.module.css'

function normalizeApiBase(raw: string): string {
  let s = raw.replace(/\/+$/, '')
  if (s.endsWith('/api')) s = s.slice(0, -4).replace(/\/+$/, '')
  return s
}

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL || '')

function cleanOfferDescription(desc?: string | null): string {
  return String(desc || '')
    .replace(/(?:^|\n)\s*LINKEDIN_URL\s*:\s*https?:\/\/[^\s)]+\s*$/gi, '')
    .trim()
}

type Offer = {
  id: number | string
  campaignId?: number | string
  title: string
  reference: string
  status: string
  description?: string | null
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
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manageMsg, setManageMsg] = useState<string | null>(null)
  const [editingOfferId, setEditingOfferId] = useState<number | string | null>(null)
  const [descriptionModal, setDescriptionModal] = useState<{ title: string; description: string } | null>(null)
  const [offerForm, setOfferForm] = useState({
    campaignId: campaignId || '',
    title: '',
    reference: '',
    location: '',
    status: 'active',
    description: '',
    redirect_url: '',
  })
  const load = async () => {
    if (!campaignId) return
    setLoading(true)
    setError(null)
    try {
      const [campaignRes, offersRes, campaignsRes] = await Promise.all([
        fetch(`${API_BASE}/api/campaigns/${campaignId}`),
        fetch(`${API_BASE}/api/campaigns/${campaignId}/offers`),
        fetch(`${API_BASE}/api/campaigns`),
      ])
      if (campaignRes.ok) {
        const c = await campaignRes.json()
        setCampaign(c.campaign ?? c)
      }
      if (offersRes.ok) {
        const o = await offersRes.json()
        setOffers(o.offers ?? o)
      }
      if (campaignsRes.ok) {
        const cList = await campaignsRes.json()
        setCampaigns(cList.campaigns ?? cList)
      }
      if (!campaignRes.ok && !offersRes.ok) {
        throw new Error('No API implemented yet')
      }
    } catch (e) {
      setError('Impossible de charger les offres pour cette campagne.')
      setCampaign(null)
      setOffers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!campaignId) return
    const run = async () => {
      setLoading(true)
      await load()
    }
    void run()
  }, [campaignId])

  useEffect(() => {
    setOfferForm((prev) => ({ ...prev, campaignId: campaignId || '' }))
  }, [campaignId])

  const resetForm = () => {
    setOfferForm({ campaignId: campaignId || '', title: '', reference: '', location: '', status: 'active', description: '', redirect_url: '' })
    setEditingOfferId(null)
  }

  const createOffer = async () => {
    if (!campaignId) return
    setManageMsg(null)
    try {
      const targetCampaignId = String(offerForm.campaignId || campaignId || '').trim()
      if (!targetCampaignId) throw new Error('Campaign cible requise')
      const res = await fetch(`${API_BASE}/api/campaigns/${targetCampaignId}/offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offerForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`)
      setManageMsg('Offre creee avec succes.')
      resetForm()
      await load()
    } catch (e: unknown) {
      setManageMsg(`Erreur creation offre: ${e instanceof Error ? e.message : 'inconnue'}`)
    }
  }

  const startEdit = (o: Offer) => {
    setEditingOfferId(o.id)
    setOfferForm({
      campaignId: String(o.campaignId || campaignId || ''),
      title: o.title || '',
      reference: o.reference || '',
      location: o.location || '',
      status: (o.status || 'active').toLowerCase(),
      description: o.description || '',
      redirect_url: o.redirect_url || '',
    })
  }

  const saveOffer = async () => {
    if (!editingOfferId) return
    setManageMsg(null)
    try {
      const res = await fetch(`${API_BASE}/api/offers/${editingOfferId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offerForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`)
      setManageMsg('Offre mise a jour avec succes.')
      resetForm()
      await load()
    } catch (e: unknown) {
      setManageMsg(`Erreur mise a jour offre: ${e instanceof Error ? e.message : 'inconnue'}`)
    }
  }

  const deleteOffer = async (id: number | string) => {
    setManageMsg(null)
    try {
      const res = await fetch(`${API_BASE}/api/offers/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`)
      setManageMsg('Offre supprimee avec succes.')
      if (String(editingOfferId) === String(id)) resetForm()
      await load()
    } catch (e: unknown) {
      setManageMsg(`Erreur suppression offre: ${e instanceof Error ? e.message : 'inconnue'}`)
    }
  }

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

        <div className={styles.manageWrap}>
          <h3 className={styles.manageTitle}>Management RH — Offres</h3>
          <div className={styles.formGrid}>
            <input
              className={styles.input}
              placeholder="Titre offre"
              value={offerForm.title}
              onChange={(e) => setOfferForm((p) => ({ ...p, title: e.target.value }))}
            />
            <input
              className={styles.input}
              placeholder="Reference"
              value={offerForm.reference}
              onChange={(e) => setOfferForm((p) => ({ ...p, reference: e.target.value }))}
            />
            <input
              className={styles.input}
              placeholder="Localisation"
              value={offerForm.location}
              onChange={(e) => setOfferForm((p) => ({ ...p, location: e.target.value }))}
            />
            <select
              className={styles.input}
              value={offerForm.status}
              onChange={(e) => setOfferForm((p) => ({ ...p, status: e.target.value }))}
            >
              <option value="active">active</option>
              <option value="draft">draft</option>
              <option value="closed">closed</option>
            </select>
            <select
              className={styles.input}
              value={offerForm.campaignId}
              onChange={(e) => setOfferForm((p) => ({ ...p, campaignId: e.target.value }))}
            >
              <option value="">Campaign cible</option>
              {campaigns.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
            <input
              className={styles.input}
              placeholder="LinkedIn URL (optional)"
              value={offerForm.redirect_url}
              onChange={(e) => setOfferForm((p) => ({ ...p, redirect_url: e.target.value }))}
            />
          </div>
          <textarea
            className={styles.textarea}
            placeholder="Description (optional)"
            value={offerForm.description}
            onChange={(e) => setOfferForm((p) => ({ ...p, description: e.target.value }))}
          />
          <div className={styles.manageActions}>
            {editingOfferId ? (
              <>
                <button type="button" className={styles.actionBtn} onClick={() => void saveOffer()}>
                  Save
                </button>
                <button type="button" className={styles.cancelBtn} onClick={resetForm}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" className={styles.actionBtn} onClick={() => void createOffer()}>
                Add Offer
              </button>
            )}
          </div>
          {manageMsg && <p className={styles.info}>{manageMsg}</p>}
        </div>

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
                  <th>Reference</th>
                  <th>Entreprise</th>
                  <th>Localisation</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((o) => (
                  <tr key={String(o.id)}>
                    <td>{o.title}</td>
                    <td>{o.reference || '—'}</td>
                    <td>{o.company || '—'}</td>
                    <td>{o.location || '—'}</td>
                    <td>{o.status || '—'}</td>
                    <td className={styles.rowActions}>
                      {o.redirect_url && (
                        <a
                          href={o.redirect_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.smallLinkBtn}
                        >
                          Voir sur LinkedIn
                        </a>
                      )}
                      <button
                        type="button"
                        className={styles.smallInfoBtn}
                        onClick={() =>
                          setDescriptionModal({
                            title: o.title || 'Offre',
                            description: cleanOfferDescription(o.description) || 'Aucune description disponible.',
                          })
                        }
                      >
                        Description
                      </button>
                      <button type="button" className={styles.smallBtn} onClick={() => startEdit(o)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className={styles.smallDangerBtn}
                        onClick={() => void deleteOffer(o.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {descriptionModal && (
          <div className={styles.modalOverlay} onClick={() => setDescriptionModal(null)}>
            <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>{descriptionModal.title}</h3>
                <button type="button" className={styles.modalClose} onClick={() => setDescriptionModal(null)}>
                  ✕
                </button>
              </div>
              <p className={styles.modalText}>{descriptionModal.description}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

