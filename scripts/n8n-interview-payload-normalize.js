// Nœud Code n8n entre « Webhook Invitation Entretien » et « Send Email ».
// Le serveur PCA envoie du JSON ; n8n le met souvent dans item.json.body.

const root = $input.first().json
const b = root.body && typeof root.body === 'object' && !Array.isArray(root.body) ? root.body : root

function cleanEmail(e) {
  if (e == null) return ''
  let s = String(e).trim()
  if (s.toLowerCase().startsWith('mailto:')) s = s.slice(7).split('?')[0].trim()
  const m = s.match(/<([^>]+)>/)
  if (m) return m[1].trim()
  const bare = s.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)
  return bare ? bare[0] : s
}

function cleanName(n) {
  if (n == null) return 'Candidat'
  let s = String(n).trim()
  s = s.replace(/<[^>]+>/g, ' ').replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  if (!s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return 'Candidat'
  const sl = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (
    /^(soft skills|hard skills|technical skills|competences|profil professionnel|resume|summary|objectif professionnel)$/.test(
      sl,
    )
  )
    return 'Candidat'
  return s
}

const type = String(b.interviewType || '').toUpperCase()
let interviewTypeLabel = b.interviewTypeLabel
if (!interviewTypeLabel) {
  if (type.includes('TECH')) interviewTypeLabel = 'Entretien technique'
  else if (type.includes('DIRECT') || type.includes('MANAG')) interviewTypeLabel = 'Entretien avec le directeur'
  else interviewTypeLabel = 'Entretien RH'
}

const email = cleanEmail(b.email)
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error('PCA webhook: email candidat manquant ou invalide (champ email requis).')
}

return [
  {
    json: {
      interviewId: b.interviewId,
      candidatureId: b.candidatureId,
      scheduledAt: b.scheduledAt,
      mode: b.mode,
      location: b.location,
      interviewType: b.interviewType,
      interviewTypeLabel,
      candidateName: cleanName(b.candidateName),
      email,
      toEmail: email,
      subject: String(b.subject || '').trim(),
    },
  },
]
