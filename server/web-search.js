/**
 * Web search for CV analysis (e.g. school type: public/private).
 * Uses Serper (google.serper.dev) — set SERPER_API_KEY in .env.
 * If not set, search is skipped and the caller keeps the model's initial guess.
 */

const SERPER_URL = 'https://google.serper.dev/search'

/**
 * Run a web search and return text snippets from the first results.
 * @param {string} query - Search query (e.g. "EMSI Morocco school private public")
 * @param {{ maxResults?: number }} [options]
 * @returns {Promise<string[]>} Array of snippet strings (empty if no key or error)
 */
export async function searchWeb(query, options = {}) {
  const apiKey = process.env.SERPER_API_KEY && process.env.SERPER_API_KEY.trim()
  if (!apiKey || !query || !String(query).trim()) {
    return []
  }

  const maxResults = options.maxResults ?? 8

  try {
    const res = await fetch(SERPER_URL, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: String(query).trim() }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      console.warn('[web-search] Serper error:', res.status, await res.text().catch(() => ''))
      return []
    }

    const data = await res.json().catch(() => ({}))
    const organic = data.organic || []
    const snippets = organic
      .slice(0, maxResults)
      .map((o) => (o.snippet || o.title || '').trim())
      .filter(Boolean)
    return snippets
  } catch (e) {
    console.warn('[web-search]', e.message)
    return []
  }
}

/**
 * Search for whether a school/establishment is public or private, then return snippets for LLM.
 * @param {string} schoolName - Name of the school (e.g. "EMSI", "École Marocaine des Sciences de l'Ingénieur")
 * @returns {Promise<string[]>} Snippets that may contain "public", "privé", "private", etc.
 */
export async function searchSchoolType(schoolName) {
  if (!schoolName || !String(schoolName).trim()) return []
  const q = `${String(schoolName).trim()} école université public privé private school`
  return searchWeb(q, { maxResults: 6 })
}
