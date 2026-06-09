// Nœud n8n « 11 - Parse LLM JSON » : parse OpenAI puis corrige last_employer.
// 1) Lignes « … — Entreprise — année » dans experience (LLM) → année max.
// 2) Sinon heuristique sur le texte CV (fenêtre élargie + Architecte/Consultant).

const raw = $input.first().json
const content = raw.choices && raw.choices[0] && raw.choices[0].message && raw.choices[0].message.content
if (!content) throw new Error('Réponse OpenAI vide: ' + JSON.stringify(raw).slice(0, 500))
let s = String(content)
  .trim()
  .replace(/^```(?:json)?\s*/i, '')
  .replace(/\s*```$/, '')
  .trim()
let parsed
try {
  parsed = JSON.parse(s)
} catch (e) {
  throw new Error('JSON invalide: ' + e.message + ' — ' + s.slice(0, 300))
}
const meta = $('9 - Assemble LLM payload').first().json
const rawName =
  parsed.candidate_name ??
  parsed.candidateName ??
  parsed.full_name ??
  parsed.nom_candidat ??
  parsed.nomComplet
const candidate_name =
  rawName != null && String(rawName).trim() !== '' ? String(rawName).trim() : null

function nsp(str) {
  return String(str || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function lastEmployerFromExpN8n(exp) {
  const t = String(exp || '').replace(/\r/g, '\n')
  const rows = []
  for (const line of t.split('\n')) {
    const parts = line.split(/[–—-]/).map((p) => nsp(p))
    if (parts.length < 2) continue
    const last = parts[parts.length - 1]
    const ym = last.match(/\b((?:19|20)\d{2})\b/)
    if (!ym) continue
    const y = parseInt(ym[1], 10)
    if (y < 1990 || y > 2040) continue
    let company = parts[parts.length - 2]
    if (!company || company.length < 2 || company.length > 85) continue
    const o = company.indexOf('(')
    if (o > 0) company = nsp(company.slice(0, o))
    rows.push({ company: nsp(company), y })
  }
  if (!rows.length) return null
  rows.sort((a, b) => b.y - a.y)
  return rows[0].company
}

function lastEmployerFromCvN8n(cv) {
  const txt = String(cv || '')
  const linePattern =
    /(?:Stagiaire|Stage|Développeur|Developer|Engineer|Ingénieur|Architecte|Consultant)[^\n–-]{0,90}[–-]\s*([^\n,]+)/gi
  const matches = []
  let m
  while ((m = linePattern.exec(txt)) !== null) {
    if (!m[1]) continue
    const start = m.index
    const company = nsp(m[1].replace(/\s*\([^)]*\)\s*$/, '').trim())
    const slice = txt.slice(Math.max(0, start - 200), Math.min(txt.length, start + 400))
    const years = [...slice.matchAll(/\b(19|20)\d{2}\b/g)]
      .map((mm) => parseInt(mm[0], 10))
      .filter((y) => y >= 1950 && y <= 2040)
    const maxYear = years.length ? Math.max(...years) : null
    const ongoing = /\b(présent|present|actuel|actuelle|en\s+cours|current|now)\b/i.test(slice)
    const yNow = new Date().getFullYear()
    const effectiveYear = ongoing ? Math.max(maxYear || yNow, yNow) : maxYear
    matches.push({ company, effectiveYear: effectiveYear ?? -1, start })
  }
  if (matches.length) {
    matches.sort((a, b) => {
      if (b.effectiveYear !== a.effectiveYear) return b.effectiveYear - a.effectiveYear
      return a.start - b.start
    })
    return matches[0].company
  }
  return null
}

const cvText = String($('8 - Get CV text (PCA, no OpenAI)').first().json.text || '')
const fromCv = lastEmployerFromCvN8n(cvText)
const fromExp = lastEmployerFromExpN8n(parsed.experience)
const llmLe = parsed.last_employer != null ? nsp(parsed.last_employer) : ''
const last_employer = fromExp || fromCv || llmLe || null

return [
  {
    json: {
      ...parsed,
      candidatureId: meta.candidatureId,
      offerTitle: meta.offerTitle,
      offerDescription: meta.offerDescription,
      candidate_name,
      last_employer,
    },
  },
]
