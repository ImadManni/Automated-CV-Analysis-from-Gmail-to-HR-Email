/**
 * Keycloak Admin API — create user in realm when someone logs in via direct OAuth (Google/GitHub).
 * Requires a Keycloak client with Service account (client_credentials) and role manage-users.
 * Set KEYCLOAK_ADMIN_CLIENT_ID and KEYCLOAK_ADMIN_CLIENT_SECRET in .env (see docs/keycloak-setup.md).
 */
let cachedToken = null
let cachedTokenExpiry = 0

function getConfig() {
  const url = (process.env.KEYCLOAK_URL || '').replace(/\/$/, '')
  const realm = (process.env.KEYCLOAK_REALM || 'pca').trim()
  const adminClientId = (process.env.KEYCLOAK_ADMIN_CLIENT_ID || '').trim()
  const adminClientSecret = (process.env.KEYCLOAK_ADMIN_CLIENT_SECRET || '').trim()
  return { url, realm, adminClientId, adminClientSecret }
}

function isConfigured() {
  const { url, realm, adminClientId, adminClientSecret } = getConfig()
  return !!(url && realm && adminClientId && adminClientSecret)
}

async function getAdminToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry) return cachedToken
  const { url, realm, adminClientId, adminClientSecret } = getConfig()
  const tokenUrl = `${url}/realms/${realm}/protocol/openid-connect/token`
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: adminClientId,
    client_secret: adminClientSecret,
  })
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Keycloak admin token failed: ${res.status} ${text}`)
  }
  const data = await res.json()
  cachedToken = data.access_token
  const expiresIn = (data.expires_in || 60) * 1000
  cachedTokenExpiry = Date.now() + expiresIn - 5000
  return cachedToken
}

/**
 * Ensure a user exists in Keycloak realm (by email). Create if not found.
 * @param {{ email: string, firstName?: string, lastName?: string }} user
 * @returns {Promise<boolean>} true if user was created or already existed
 */
export async function ensureUserInKeycloak(user) {
  if (!isConfigured()) {
    console.warn('[keycloak-admin] NOT configured: set KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_ADMIN_CLIENT_ID, KEYCLOAK_ADMIN_CLIENT_SECRET')
    return false
  }
  const email = (user?.email || '').trim().toLowerCase()
  if (!email) {
    console.warn('[keycloak-admin] ensureUserInKeycloak: no email')
    return false
  }

  try {
    const token = await getAdminToken()
    const { url, realm } = getConfig()
    const base = `${url}/admin/realms/${realm}`

    const searchRes = await fetch(
      `${base}/users?email=${encodeURIComponent(email)}&exact=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!searchRes.ok) {
      const errText = await searchRes.text()
      console.error('[keycloak-admin] search users failed:', searchRes.status, errText)
      return false
    }
    const existing = await searchRes.json()
    if (Array.isArray(existing) && existing.length > 0) return true

    const nameParts = (user.name || '').trim().split(/\s+/)
    const firstName = (user.firstName || nameParts[0] || email.split('@')[0]).trim()
    const lastName = (user.lastName || nameParts.slice(1).join(' ') || '').trim()
    const username = email.replace(/@.+$/, '').replace(/[^a-z0-9._-]/gi, '_').slice(0, 255) || `user_${Date.now()}`

    const createRes = await fetch(`${base}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        username,
        email,
        firstName: firstName || username,
        lastName: lastName || '',
        enabled: true,
        emailVerified: true,
      }),
    })
    if (createRes.status === 201) return true
    if (createRes.status === 409) return true
    const text = await createRes.text()
    console.error('[keycloak-admin] create user failed:', createRes.status, text)
    return false
  } catch (err) {
    console.error('[keycloak-admin] ensureUserInKeycloak error:', err.message)
    if (process.env.NODE_ENV !== 'production') console.error(err)
    return false
  }
}

/** Test connexion Keycloak Admin au démarrage (optionnel). */
export async function testKeycloakAdminConnection() {
  if (!isConfigured()) return
  try {
    const token = await getAdminToken()
    const { url, realm } = getConfig()
    const base = `${url}/admin/realms/${realm}`
    const res = await fetch(`${base}/users?max=1`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      console.log('[keycloak-admin] Connexion OK — création des users (signup/login/OAuth) → Keycloak realm', realm)
    } else {
      console.error('[keycloak-admin] Test échoué:', res.status, await res.text())
    }
  } catch (err) {
    console.error('[keycloak-admin] Test connexion échoué:', err.message)
  }
}
