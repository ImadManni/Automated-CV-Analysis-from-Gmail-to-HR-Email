/**
 * API client for RAG AI Assistant (FR, EN, Moroccan Darija).
 * Pass token from Redux so that after logout no Bearer is sent (restricted topics then get "connect to access").
 */

const API_BASE = import.meta.env.VITE_API_URL || ''

function getAuthHeaders(token: string | null | undefined): HeadersInit {
  const headers: HeadersInit = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  if (token && typeof token === 'string' && token.trim()) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }
  return headers
}

export interface RagChatResponse {
  answer: string
  language: 'fr' | 'en' | 'darija'
}

/**
 * @param message - User message
 * @param token - Current auth token from Redux (pass null when logged out so backend treats as unauthenticated)
 */
export async function ragChat(message: string, token?: string | null): Promise<RagChatResponse> {
  const res = await fetch(`${API_BASE}/api/rag/chat`, {
    method: 'POST',
    headers: getAuthHeaders(token ?? null),
    body: JSON.stringify({ message: message.trim() }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message || `API error: ${res.status}`)
  }
  return res.json()
}

export interface RagChatWithCvPayload {
  message: string
  fileName: string
  fileBase64: string
}

export async function ragChatWithCv(payload: RagChatWithCvPayload, token?: string | null): Promise<RagChatResponse> {
  const res = await fetch(`${API_BASE}/api/rag/chat-with-cv`, {
    method: 'POST',
    headers: getAuthHeaders(token ?? null),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message || `API error: ${res.status}`)
  }
  return res.json()
}
