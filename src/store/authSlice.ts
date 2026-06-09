import { createSlice } from '@reduxjs/toolkit'

const STORAGE_KEY = 'pca_auth'

export interface AuthUser {
  email: string
  name: string
  roles?: string[]
}

export interface AuthState {
  token: string | null
  user: AuthUser | null
  avatar: string | null
  roles: string[]
}

function loadFromStorage(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { token: null, user: null, avatar: null, roles: [] }
    const data = JSON.parse(raw)
    if (data?.token && data?.user) {
      return {
        token: data.token,
        user: data.user,
        avatar: data.avatar ?? null,
        roles: Array.isArray(data.user?.roles) ? data.user.roles : [],
      }
    }
  } catch {
    /* ignore */
  }
  return { token: null, user: null, avatar: null, roles: [] }
}

function saveToStorage(token: string | null, user: AuthUser | null, avatar?: string | null) {
  if (token && user) {
    const existing = (() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) return JSON.parse(raw)
      } catch { /* ignore */ }
      return {}
    })()
    const payload = {
      token,
      user: { ...user, roles: user.roles },
      avatar: avatar !== undefined ? avatar : existing?.avatar ?? null,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

const initialState: AuthState = loadFromStorage()

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth(state, action: { payload: { token: string; user: AuthUser } }) {
      state.token = action.payload.token
      state.user = action.payload.user
      state.roles = action.payload.user?.roles ?? []
      const existingAvatar = state.avatar
      saveToStorage(action.payload.token, action.payload.user, existingAvatar)
    },
    logout(state) {
      state.token = null
      state.user = null
      state.avatar = null
      state.roles = []
      saveToStorage(null, null, null)
    },
    setAvatar(state, action: { payload: string | null }) {
      state.avatar = action.payload
      if (state.token && state.user) {
        saveToStorage(state.token, state.user, action.payload)
      }
    },
    loadStored(state) {
      const stored = loadFromStorage()
      state.token = stored.token
      state.user = stored.user
      state.avatar = stored.avatar
      state.roles = stored.roles ?? []
    },
  },
})

export const { setAuth, logout, setAvatar, loadStored } = authSlice.actions
export default authSlice.reducer

export function getStoredToken(): string | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    return data?.token ?? null
  } catch {
    return null
  }
}

/** Vrai si la chaîne a la forme d'un JWT (header.payload.signature, base64url). */
export function looksLikeJwt(s: string | null): boolean {
  if (!s || typeof s !== 'string') return false
  const parts = s.trim().split('.')
  return parts.length === 3 && parts[0].startsWith('eyJ')
}
