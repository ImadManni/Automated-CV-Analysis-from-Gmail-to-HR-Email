/**
 * Keycloak JWT verification (OIDC). Uses JWKS from Keycloak realm.
 * No external deps: fetch + crypto only.
 * Set KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID in env.
 */

import crypto from 'crypto'

function getKeycloakConfig() {
  const url = (process.env.KEYCLOAK_URL || '').replace(/\/$/, '')
  const realm = (process.env.KEYCLOAK_REALM || '').trim()
  const clientId = (process.env.KEYCLOAK_CLIENT_ID || '').trim()
  if (!url || !realm || !clientId) return null
  return { url, realm, clientId }
}

let cachedJwks = null

function getJwksUrl() {
  const c = getKeycloakConfig()
  if (!c) return null
  return `${c.url}/realms/${c.realm}/protocol/openid-connect/certs`
}

async function fetchJwks() {
  const jwksUrl = getJwksUrl()
  if (!jwksUrl) return null
  if (cachedJwks) return cachedJwks
  try {
    const res = await fetch(jwksUrl)
    if (!res.ok) return null
    const data = await res.json()
    cachedJwks = data && data.keys ? data : null
    return cachedJwks
  } catch {
    return null
  }
}

function base64UrlDecode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = base64.length % 4
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64
  return Buffer.from(padded, 'base64').toString('utf8')
}

function findKeyByKid(keys, kid) {
  if (!Array.isArray(keys) || !kid) return null
  return keys.find((k) => k.kid === kid) || null
}

function verifySignature(jwt, key) {
  const parts = jwt.split('.')
  if (parts.length !== 3) return false
  const [headerB64, payloadB64, sigB64] = parts
  try {
    const publicKey = crypto.createPublicKey({
      key: key,
      format: 'jwk',
    })
    const data = `${headerB64}.${payloadB64}`
    const signature = Buffer.from(
      sigB64.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    )
    return crypto.verify(
      'RS256',
      Buffer.from(data, 'utf8'),
      publicKey,
      signature
    )
  } catch {
    return false
  }
}

/**
 * Verify Keycloak access token and return normalized user + roles.
 * @param {string} token - Bearer token (JWT from Keycloak)
 * @returns {Promise<{ id: string, email: string, name: string, roles: string[] } | null>}
 */
export async function verifyKeycloakToken(token) {
  const config = getKeycloakConfig()
  if (!config) return null
  if (!token || typeof token !== 'string') return null

  const parts = token.trim().split('.')
  if (parts.length !== 3) return null

  let header
  let payload
  try {
    header = JSON.parse(base64UrlDecode(parts[0]))
    payload = JSON.parse(base64UrlDecode(parts[1]))
  } catch {
    return null
  }

  const issuer = `${config.url}/realms/${config.realm}`
  if (payload.iss !== issuer) return null
  if (payload.exp != null && Number(payload.exp) * 1000 < Date.now()) return null

  const jwks = await fetchJwks()
  if (!jwks || !jwks.keys) return null
  const key = findKeyByKid(jwks.keys, header.kid)
  if (!key || !verifySignature(token.trim(), key)) return null

  const sub = payload.sub || ''
  const email = payload.email || payload.preferred_username || ''
  const name = payload.name || payload.given_name || payload.preferred_username || email.split('@')[0] || ''

  const roles = []
  if (Array.isArray(payload.realm_access?.roles)) {
    roles.push(...payload.realm_access.roles)
  }
  const resourceAccess = payload.resource_access && payload.resource_access[config.clientId]
  if (resourceAccess && Array.isArray(resourceAccess.roles)) {
    roles.push(...resourceAccess.roles)
  }

  return {
    id: sub,
    email,
    name,
    roles: [...new Set(roles)],
  }
}

export function isKeycloakEnabled() {
  return !!getKeycloakConfig()
}

export function getKeycloakPublicConfig() {
  const c = getKeycloakConfig()
  if (!c) return { enabled: false }
  return {
    enabled: true,
    url: c.url,
    realm: c.realm,
    clientId: c.clientId,
  }
}
