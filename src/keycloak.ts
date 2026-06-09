// Frontend Keycloak helper: simple redirect-based login
// Uses VITE_KEYCLOAK_URL, VITE_KEYCLOAK_REALM, VITE_KEYCLOAK_CLIENT_ID

const KC_URL = (import.meta.env.VITE_KEYCLOAK_URL || '').replace(/\/$/, '')
const KC_REALM = (import.meta.env.VITE_KEYCLOAK_REALM || '').trim()
const KC_CLIENT_ID = (import.meta.env.VITE_KEYCLOAK_CLIENT_ID || '').trim()

export function isKeycloakFrontendEnabled(): boolean {
  return !!KC_URL && !!KC_REALM && !!KC_CLIENT_ID
}

function getRedirectUri(path: string): string {
  if (typeof window === 'undefined') return ''
  const base = window.location.origin.replace(/\/$/, '')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${cleanPath}`
}

export function buildKeycloakLoginUrl(nextPath = '/dashboard'): string | null {
  if (!isKeycloakFrontendEnabled()) return null
  const redirectUri = encodeURIComponent(getRedirectUri(nextPath))
  return (
    `${KC_URL}/realms/${KC_REALM}/protocol/openid-connect/auth` +
    `?client_id=${encodeURIComponent(KC_CLIENT_ID)}` +
    `&response_type=code` +
    `&scope=openid%20profile%20email` +
    `&redirect_uri=${redirectUri}`
  )
}

export function doLogin(nextPath = '/dashboard'): void {
  const url = buildKeycloakLoginUrl(nextPath)
  if (!url) return
  if (typeof window !== 'undefined') {
    window.location.href = url
  }
}

