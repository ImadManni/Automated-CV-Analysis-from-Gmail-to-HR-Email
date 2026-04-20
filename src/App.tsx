import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { HomePage } from '@/pages/HomePage'
import { DashboardPage } from '@/pages/DashboardPage'
import { SignupPage } from '@/pages/SignupPage'
import { AccountPage } from '@/pages/AccountPage'
import { CampaignsPage } from '@/pages/CampaignsPage'
import { CampaignOffersPage } from '@/pages/CampaignOffersPage'
import { CandidatureDetailPage } from '@/pages/CandidatureDetailPage'
import { InterviewsPage } from '@/pages/InterviewsPage'
import { useAppDispatch } from '@/store/hooks'
import { setCandidatures } from '@/store/candidaturesSlice'
import { loadStored, setAuth } from '@/store/authSlice'
import { fetchCandidatures } from '@/api/candidatures'

function App() {
  const dispatch = useAppDispatch()

  useEffect(() => {
    dispatch(loadStored())
  }, [dispatch])

  // Si on revient de Keycloak avec ?code=..., marquer l'utilisateur comme connecté côté front
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (!code) return
    // Pour l'instant, on ne fait qu'un "fake" auth front pour activer la vue utilisateur.
    dispatch(
      setAuth({
        token: `keycloak:${code}`,
        user: {
          name: 'Utilisateur Keycloak',
          email: '',
          roles: [],
        },
      })
    )
  }, [dispatch])

  useEffect(() => {
    fetchCandidatures()
      .then(({ candidatures }) => dispatch(setCandidatures(candidatures)))
      .catch(() => { /* API non disponible ou erreur réseau */ })
  }, [dispatch])

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/campaigns/:campaignId/offers" element={<CampaignOffersPage />} />
        <Route path="/candidatures/:id" element={<CandidatureDetailPage />} />
        <Route path="/entretiens" element={<InterviewsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
