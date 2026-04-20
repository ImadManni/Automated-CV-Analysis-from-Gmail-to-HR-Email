/**
 * OAuth (Google, GitHub) — redirect flow, then JWT for session.
 * If Keycloak admin client is configured, users are auto-created in Keycloak (see keycloak-admin.js).
 */
import { findOrCreateUserByOAuth, signToken } from './auth.js'
import { ensureUserInKeycloak } from './keycloak-admin.js'

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3003'

function redirectWithToken(res, token, user) {
  const params = new URLSearchParams()
  params.set('token', token)
  if (user?.name) params.set('name', user.name)
  if (user?.email) params.set('email', user.email)
  res.redirect(`${FRONTEND_URL}/login?${params.toString()}`)
}

function redirectWithError(res, message) {
  res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(message || 'OAuth failed')}`)
}

/** GET /api/auth/google — redirect to Google consent */
export function googleAuth(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return redirectWithError(res, 'Google OAuth not configured')
  }
  const redirectUri = `${getApiOrigin(req)}/api/auth/google/callback`
  const scope = 'openid email profile'
  const url = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`
  res.redirect(url)
}

/** GET /api/auth/google/callback — exchange code for profile, create/find user, JWT, redirect to frontend */
export async function googleCallback(req, res) {
  const { code } = req.query || {}
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return redirectWithError(res, 'Google OAuth not configured')
  if (!code) return redirectWithError(res, 'Missing code')

  const redirectUri = `${getApiOrigin(req)}/api/auth/google/callback`
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!tokenRes.ok) return redirectWithError(res, 'Google token exchange failed')
  const tokens = await tokenRes.json()
  const accessToken = tokens.access_token
  if (!accessToken) return redirectWithError(res, 'No access token')

  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!profileRes.ok) return redirectWithError(res, 'Google profile failed')
  const profile = await profileRes.json()
  const user = await findOrCreateUserByOAuth('google', {
    id: profile.id,
    email: profile.email,
    name: profile.name || profile.given_name,
  })
  if (!user) return redirectWithError(res, 'User creation failed')
  ensureUserInKeycloak({
    email: user.email,
    name: user.name,
    firstName: profile.given_name,
    lastName: profile.family_name,
  })
    .then((ok) => {
      if (ok) console.log('[oauth] User provisioned to Keycloak:', user.email)
    })
    .catch((err) => console.error('[oauth] Keycloak provision failed:', err.message))
  const token = signToken({ id: user.id, email: user.email })
  redirectWithToken(res, token, user)
}

/** GET /api/auth/github — redirect to GitHub */
export function githubAuth(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID
  if (!clientId) return redirectWithError(res, 'GitHub OAuth not configured')
  const redirectUri = `${getApiOrigin(req)}/api/auth/github/callback`
  const scope = 'user:email read:user'
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`
  res.redirect(url)
}

/** GET /api/auth/github/callback */
export async function githubCallback(req, res) {
  const { code } = req.query || {}
  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET
  if (!clientId || !clientSecret) return redirectWithError(res, 'GitHub OAuth not configured')
  if (!code) return redirectWithError(res, 'Missing code')

  const redirectUri = `${getApiOrigin(req)}/api/auth/github/callback`
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  })
  if (!tokenRes.ok) return redirectWithError(res, 'GitHub token exchange failed')
  const tokens = await tokenRes.json()
  const accessToken = tokens.access_token
  if (!accessToken) return redirectWithError(res, 'No access token')

  const profileRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github.v3+json' },
  })
  if (!profileRes.ok) return redirectWithError(res, 'GitHub profile failed')
  const profile = await profileRes.json()
  let email = profile.email
  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github.v3+json' },
    })
    if (emailsRes.ok) {
      const emails = await emailsRes.json()
      const primary = emails.find((e) => e.primary) || emails[0]
      email = primary?.email
    }
  }
  if (!email) email = `${profile.id}+github@users.noreply.github.com`
  const user = await findOrCreateUserByOAuth('github', {
    id: profile.id,
    email,
    name: profile.name || profile.login,
  })
  if (!user) return redirectWithError(res, 'User creation failed')
  ensureUserInKeycloak({ email: user.email, name: user.name })
    .then((ok) => {
      if (ok) console.log('[oauth] User provisioned to Keycloak:', user.email)
    })
    .catch((err) => console.error('[oauth] Keycloak provision failed:', err.message))
  const token = signToken({ id: user.id, email: user.email })
  redirectWithToken(res, token, user)
}

function getApiOrigin(req) {
  // Toujours utiliser l'origine du backend pour éviter redirect_uri_mismatch (Google exige une URL exacte)
  const port = process.env.PORT || 3005
  if (process.env.API_ORIGIN) return String(process.env.API_ORIGIN).replace(/\/$/, '')
  return `http://localhost:${port}`
}
