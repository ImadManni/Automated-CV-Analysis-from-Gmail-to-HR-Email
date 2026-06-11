/**
 * RAG-style assistant: knowledge base (FR, EN, Moroccan Darija) + simple retrieval.
 * No external LLM required; answers from predefined chunks + optional dashboard context.
 */

// Keywords (lowercase) → answer in 3 languages
const KNOWLEDGE = [
  {
    keywords: ['salam', 'salem', 'slm', 'hello', 'hi', 'bonjour', 'bonsoir', 'sbah lkhir', 'marhba', 'ahlan', 'ahlan bik', 'hey', 'coucou', 'salut', 'good morning', 'good evening', 'asalam', 'salamu', 'مرحبا', 'أهلا'],
    fr: 'Salut ! Je suis l’assistant PCA. Posez-moi vos questions sur la plateforme, le tableau de bord ou PCA — en français, anglais ou darija. Si vous êtes connecté, je peux vous donner un résumé de vos candidatures.',
    en: 'Hi! I’m the PCA assistant. Ask me anything about the platform, dashboard or PCA — in French, English or Darija. If you’re logged in, I can give you a summary of your applications.',
    darija: 'Salam! Ana l-assistant PCA. Jreb tsoual 3la l-plateforme, l-dashboard wla PCA — b français, anglais wla darija. Ila kunti connecté, nqder n3tik résumé dyal l-candidatures dyalek.',
  },
  {
    keywords: ['labas', 'labas 3lik', 'labas 3likum', 'labs', 'kifach', 'kifacha', 'kidayr', 'kif dayer', 'ça va', 'cava', 'cv', 'va bien', 'how are you', 'how do you do', 'nik', 'nqra', 'bikhir', 'bixir', 'mzyan', 'sir', 'sir 3lik', 'hamdullah', 'alhamdulillah', 'hamdoullah', 'bien', 'good', 'fine', 'wakha', 'waxa', 'ok', 'all good'],
    fr: 'Ça va bien, merci ! Je suis l’assistant PCA. Posez vos questions sur la plateforme, le dashboard ou PCA — en français, anglais ou darija. Si vous êtes connecté, je peux vous donner un résumé de vos candidatures.',
    en: 'All good, thanks! I’m the PCA assistant. Ask me anything about the platform, dashboard or PCA — in French, English or Darija. If you’re logged in, I can give you a summary of your applications.',
    darija: 'Labas, hamdullah! Ana l-assistant PCA. Jreb tsoual 3la l-plateforme, l-dashboard wla PCA — b français, anglais wla darija. Ila kunti connecté, nqder n3tik résumé dyal l-candidatures dyalek.',
  },
  {
    keywords: ['plateform', 'platform', 'c\'est quoi', 'what is', 'chno', 'what is this', 'quest ce que', 'definition'],
    fr: 'La plateforme PCA « Automated CV Analysis » permet de suivre les candidatures reçues par e-mail. Le workflow (Gmail → n8n → extraction PDF/DOCX → analyse IA) envoie les résultats vers ce tableau de bord. Vous pouvez vous connecter pour voir les statistiques et les candidatures.',
    en: 'The PCA platform "Automated CV Analysis" tracks job applications received by email. The workflow (Gmail → n8n → PDF/DOCX extraction → AI analysis) sends results to this dashboard. Log in to see statistics and applications.',
    darija: 'Plateforme PCA hiya "Automated CV Analysis" bach tsuivi l-candidatures li jayn f email. L-workflow (Gmail → n8n → extraction PDF/DOCX → analyse IA) kayb3ath l-résultats l had l-dashboard. Qrabt compte bach tchouf l-statistiques w l-candidatures.',
  },
  {
    keywords: ['dashboard', 'tableau de bord', 'statistiques', 'stats', 'candidatures', 'applications', 'résultats', 'results'],
    fr: 'Le tableau de bord affiche les candidatures avec leur décision (acceptée, refusée, à revoir, non lisible), des statistiques et des graphiques. Connectez-vous pour y accéder.',
    en: 'The dashboard shows applications with their decision (accepted, refused, to review, unreadable), statistics and charts. Log in to access it.',
    darija: 'L-dashboard kaywerri l-candidatures m3a l-décision (acceptée, refusée, à revoir, non lisible), statistiques w graphiques. Qrabt bach tdkhol.',
  },
  {
    keywords: ['connect', 'connexion', 'login', 'inscription', 'signup', 'compte', 'account', 'qrabt', 'dkhol'],
    fr: 'Pour vous connecter : cliquez sur « Connexion » en haut à droite, ou « Inscription » pour créer un compte. Une fois connecté, vous accédez au tableau de bord des candidatures.',
    en: 'To log in: click "Connexion" (Login) at the top right, or "Inscription" (Sign up) to create an account. Once logged in, you can access the candidatures dashboard.',
    darija: 'Bach tqrabt: dghya 3la "Connexion" f l3lya l-yemin, wla "Inscription" bach t3mel compte. Melli tkon connecté, tqder tdkhoul l-dashboard dyal l-candidatures.',
  },
  {
    keywords: ['pca', 'company', 'société', 'entreprise', 'payment center', 'africa', 'maroc', 'morocco'],
    fr: 'PCA (Payment Center for Africa) est l\'entreprise porteuse de cette plateforme. La solution « Automated CV Analysis from Gmail to HR Email » automatise la réception et l\'analyse des CV par e-mail (workflow n8n, extraction, IA) et centralise les résultats pour les RH.',
    en: 'PCA (Payment Center for Africa) is the company behind this platform. The "Automated CV Analysis from Gmail to HR Email" solution automates receiving and analyzing CVs by email (n8n workflow, extraction, AI) and centralizes results for HR.',
    darija: 'PCA (Payment Center for Africa) hiya l-company li 3andha had l-plateforme. L-solution "Automated CV Analysis" t automatiser l-reception w l-analyse dyal CV f email (n8n, extraction, IA) w tjmou3 l-résultats l RH.',
  },
  {
    keywords: ['workflow', 'n8n', 'gmail', 'email', 'automat', 'automatisation'],
    fr: 'Le workflow part de Gmail : les e-mails avec pièce jointe (CV PDF/DOCX) déclenchent n8n, qui extrait le texte, appelle l\'IA pour analyser et décider (accepté/refusé/à revoir/non lisible), puis envoie la fiche vers cette API et le dashboard.',
    en: 'The workflow starts from Gmail: emails with attachments (CV PDF/DOCX) trigger n8n, which extracts text, calls AI to analyze and decide (accepted/refused/to review/unreadable), then sends the record to this API and dashboard.',
    darija: 'L-workflow kaybda mn Gmail: l-emails m3a l-CV (PDF/DOCX) kayt7arko n8n, li kaystakhrej n-nass, kaynadi l-IA bach t7akem (accepté/refusé/à revoir/non lisible), w mba3d kayb3ath l-fiche l had l-API w l-dashboard.',
  },
  {
    keywords: ['acceptée', 'refusée', 'revoir', 'non lisible', 'accepted', 'refused', 'review', 'unreadable', 'decision'],
    fr: 'Chaque candidature reçoit une décision : ACCEPTÉE, REFUSÉE, À REVOIR ou NON_LISIBLE. Vous pouvez filtrer par décision dans le tableau de bord après connexion.',
    en: 'Each application gets a decision: ACCEPTED, REFUSED, TO REVIEW or UNREADABLE. You can filter by decision on the dashboard after logging in.',
    darija: 'Kol candidature kaytlaqa décision: ACCEPTÉE, REFUSÉE, À REVOIR wla NON_LISIBLE. Tqder tfiltrer b l-décision f l-dashboard mba3d ma tqrabt.',
  },
  {
    keywords: ['résumé', 'summary', 'stats', 'statistiques', 'combien', 'how many', 'chal', 'summary dashboard'],
    fr: 'Connectez-vous pour voir le tableau de bord. Une fois connecté, posez à nouveau une question et je vous donnerai un résumé de vos candidatures (total, acceptées, refusées, à revoir, non lisibles).',
    en: 'Log in to access the dashboard. Once logged in, ask again and I will give you a summary of your applications (total, accepted, refused, to review, unreadable).',
    darija: 'Qrabt bach tchouf l-dashboard. Mba3d ma tqrabt, tsoual marra jra w n3tik résumé dyal l-candidatures (total, acceptées, refusées, à revoir, non lisibles).',
  },
  {
    keywords: ['help', 'aide', '3awni', 'comment', 'how', 'kifach', 'kifacha', 'where', 'fin', 'win', 'chno', 'ashno', 'wach'],
    fr: 'Vous pouvez poser des questions sur la plateforme, le tableau de bord, PCA ou le workflow. Je réponds en français, anglais ou darija marocaine. Si vous êtes connecté, je peux vous donner un résumé de vos candidatures.',
    en: 'You can ask about the platform, dashboard, PCA or the workflow. I answer in French, English or Moroccan Darija. If you are logged in, I can give you a summary of your applications.',
    darija: 'Tqder tsoual 3la l-plateforme, l-dashboard, PCA wla l-workflow. Kanjaweb b français, anglais wla darija. Ila kunti connecté, nqder n3tik résumé dyal l-candidatures dyalek.',
  },
  {
    keywords: ['chokran', 'shokran', 'merci', 'thanks', 'thank you', 'mrc', 'bslama', 'bsslama', 'allah i3tik', 'saha', 'bye', 'au revoir'],
    fr: 'Avec plaisir ! N’hésitez pas à poser d’autres questions sur la plateforme, le dashboard ou PCA — en français, anglais ou darija. Si vous êtes connecté, je peux vous donner un résumé de vos candidatures.',
    en: 'You\'re welcome! Feel free to ask more about the platform, dashboard or PCA — in French, English or Darija. If you\'re logged in, I can give you a summary of your applications.',
    darija: 'Bla jmil! Ma t7echchach tsoual 3la l-plateforme, l-dashboard wla PCA — b français, anglais wla darija. Ila kunti connecté, nqder n3tik résumé dyal l-candidatures.',
  },
  {
    keywords: ['campagnes', 'campagne', 'campagns', 'offres', 'offre', 'campaigns', 'campaign', 'offers', 'offer', 'remotive', 'recrutement', 'emploi', 'jobs', 'donner moi les campagnes', 'quelles campagnes', 'liste des offres', 'plateforme', 'trouvees', 'trouvées'],
    fr: 'Sur la plateforme PCA vous avez accès aux campagnes de recrutement et à leurs offres. Les données sont synchronisées en temps réel (ex. offres remote Software Dev). Consultez la page « Campagnes » dans le menu ou l’API GET /api/campaigns et GET /api/campaigns/{id}/offers.',
    en: 'On the PCA platform you can access recruitment campaigns and their job offers. Data is synced in real time (e.g. remote Software Dev offers). See the « Campagnes » page in the menu or the API GET /api/campaigns and GET /api/campaigns/{id}/offers.',
    darija: 'F l-plateforme PCA 3andek l-campagnes dyal recrutement w l-offres dyalhom. Données kayt synchronisiw f temps réel (b7al offres remote Software Dev). Chouf l-page « Campagnes » f l-menu wla l-API GET /api/campaigns w GET /api/campaigns/{id}/offers.',
  },
  {
    keywords: ['entretien', 'entretiens', 'interview', 'interviews', 'rendez-vous', 'planifiés', 'planifié', 'agenda', 'calendrier'],
    fr: 'Sur la plateforme PCA vous pouvez consulter et planifier les entretiens (rendez-vous) avec les candidats. La page « Entretiens » liste les entretiens planifiés, réalisés ou annulés. Chaque entretien est lié à une candidature.',
    en: 'On the PCA platform you can view and schedule interviews (appointments) with candidates. The « Entretiens » page lists planned, completed or cancelled interviews. Each interview is linked to an application.',
    darija: 'F l-plateforme PCA tqder tchouf w tplanifi l-entretiens m3a l-candidats. L-page « Entretiens » katwerri l-entretiens li planifiyn, li ttemmu wla annulés. Kol entretien mrabot b candidature.',
  },
]

// Detect language from query (simple heuristics)
function detectLanguage(text) {
  const t = (text || '').toLowerCase().trim()
  const darija = /\b(salam|salem|slm|labas|labs|marhba|ahlan|chno|wach|kifach|kifacha|kidayr|fin|win|3awni|bghit|mzyan|sir|daba|kayen|3and|m3a|dial|dyalek|ghadi|kant|kayna|nik|nqra|bikhir|bixir|hamdullah|wakha|waxa|qrabt|dkhol|tqder|nqder|hiya|hadi|shno|ashno)\b/.test(t) ||
    /[\u0600-\u06FF]/.test(t)
  if (darija) return 'darija'
  const en = /\b(what|how|where|when|who|which|dashboard|platform|login|help|company|hello|hi|good|fine)\b/.test(t)
  if (en) return 'en'
  return 'fr'
}

// Score a chunk against the query (keyword overlap)
function scoreMatch(query, keywords) {
  const q = (query || '').toLowerCase().replace(/[^\w\s\u0600-\u06FF]/g, ' ').split(/\s+/).filter(Boolean)
  const k = keywords.map((x) => x.toLowerCase())
  let score = 0
  for (const w of q) {
    if (k.some((kw) => kw.includes(w) || w.includes(kw))) score += 1
    if (k.includes(w)) score += 2
  }
  return score
}

function wantsDetailedList(message) {
  const t = (message || '').toLowerCase()
  return /\bdétail|detaill|detailed|liste|list|kol candidature|kol candidatures|ga3 l.?candidatures|detailed candidatures|infos complètes|r[eé]centes?|recentes?|derni[eè]res?|dernieres?|plus r[eé]centes?|plus recentes?|latest/.test(t)
}

function wantsDateFilteredCandidatures(message) {
  const t = (message || '').toLowerCase()
  const asksCandidatures = /\bcandidatures?|applications?\b|kol candidatures|ga3 l.?candidatures/.test(t)
  const asksDate = /\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday|aujourd(?:hui)?|aujourdh(?:'|’)?ui|today|hier|yesterday|lbar7|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/.test(t)
  return asksCandidatures && asksDate
}

function wantsOfferLinkedCandidaturesCount(message) {
  const t = (message || '').toLowerCase()
  return /\b(nombre|combien|count|nb)\b.*\bcandidatures?\b.*\b(li[eé]es?|associees?|rattach[eé]es?)\b.*\boffre\b|\bcandidatures?\b.*\boffre\b.*\b(nombre|combien|count|nb)\b/.test(t)
}

function wantsOfferTargetMetrics(message) {
  if (wantsOfferTargetList(message)) return false
  const t = normLoose(message)
  return (
    ((/\boffre\b/.test(t) && /\b(postulants?|selection|entretien|retenus?|decision|pipeline|kpi|indicateurs?)\b/.test(t)) ||
      /\bindicateurs?\b.*\boffre\b|\boffre\b.*\bindicateurs?\b/.test(t) ||
      !!extractOfferQueryFromMessage(message))
  )
}

function normalizeOfferTitleForKpi(raw) {
  const s = String(raw || '').trim()
  if (!s) return null
  if (/^(sans objet|no subject|sans offre cible|poste|n\/a|null)$/i.test(s)) return null
  if (/\bcv\b/i.test(s) || /\.(pdf|doc|docx)$/i.test(s)) return null
  return s
}

/** Tableau dashboard « Offre cible (titre) » — pas les KPI globaux RH. */
function wantsOfferTargetList(message) {
  const raw = String(message || '').trim()
  const t = normLoose(raw)
  if (!t) return false
  const mentionsTargetOffer = /\boffre\s+cible\b/.test(t) || /\boffres?\s+cibles?\b/.test(t)
  if (!mentionsTargetOffer) return false
  if (/^offre\s+cible(\s*\(titre\))?$/i.test(raw)) return true
  if (/^offres?\s+cibles?(\s*\(titre\))?$/i.test(raw)) return true
  if (/\b(titre|liste|tableau|colonnes?|par\s+offre|volumes?)\b/.test(t)) return true
  if (/\b(liste|donner|donne|montre|affiche|quelles?|quels?)\b/.test(t)) return true
  return false
}

function getDecisionFilterFromMessage(message) {
  const t = normLoose(message)
  if (!t) return null
  const asksApplications = /\bcandidatures?\b|\bapplications?\b/.test(t)
  const asksDecision = /\bdecision\b|\bdecision\d+\b|\bstatut\b|\bstatus\b/.test(t)
  if (!asksApplications && !asksDecision) return null
  if (/accep|retenu|accepted/.test(t)) return 'ACCEPTEE'
  if (/refus|rejet|rejected|refused/.test(t)) return 'REFUSEE'
  if (/non\s*lisible|illisible|unreadable/.test(t)) return 'NON_LISIBLE'
  if (/a\s*revoir|to\s*review|review/.test(t)) return 'A_REVOIR'
  return null
}

function countCandidaturesForOfferFromMessage(message, items) {
  if (!Array.isArray(items) || !items.length) return null
  const raw = String(message || '')
  const m =
    raw.match(/offre\s+["“]?(.+?)["”]?$/i) ||
    raw.match(/offre\s+(.+?)\s*$/i)
  if (!m || !m[1]) return null
  const query = normLoose(m[1])
  if (!query || query.length < 3) return null

  const matches = items.filter((c) => {
    const offer = normLoose(c?.offerTitle || '')
    const subject = normLoose(c?.subject || '')
    if (!offer && !subject) return false
    if (offer && (offer.includes(query) || query.includes(offer))) return true
    if (subject && (subject.includes(query) || query.includes(subject))) return true
    const qTokens = query.split(' ').filter((x) => x.length >= 3)
    if (qTokens.length < 2) return false
    const target = `${offer} ${subject}`.trim()
    const overlap = qTokens.filter((t) => target.includes(t)).length
    return overlap >= Math.max(2, Math.ceil(qTokens.length * 0.5))
  })

  return { count: matches.length, query: m[1].trim(), samples: matches.slice(0, 6) }
}

function extractOfferQueryFromMessage(message) {
  const raw = String(message || '')
  const m =
    raw.match(/offre(?:\s*cible)?\s*(?:\(titre\))?\s*[:\-]?\s*["“]?(.+?)["”]?\s*$/i) ||
    raw.match(/(?:infos?|informations?|details?)\s+(?:sur|de|pour)\s+l'?offre\s+["“]?(.+?)["”]?\s*$/i) ||
    raw.match(/offre\s+["“]?(.+?)["”]?\s*$/i)
  if (!m || !m[1]) {
    const candidate = String(raw || '').trim()
    const n = normLoose(candidate)
    const looksLikeTitle =
      /\b(stage\s*pfe|pfe|engineer|ingenieur|developer|developpement|analyst|bi|data|ai|ml|cloud|devops|api|integration|qa|test|mobile|full\s*stack)\b/.test(n) &&
      !/\b(donner|donne|combien|nombre|postulants?|selection|retenus?|kpi|indicateurs?|candidatures?|campagnes?|entretiens?|rdv|decision|statut)\b/.test(n)
    if (looksLikeTitle) return candidate
    return ''
  }
  return String(m[1]).trim()
}

function getOfferMetricsFromContext(message, context) {
  const items = context && Array.isArray(context.itemsRaw)
    ? context.itemsRaw
    : (context && Array.isArray(context.items) ? context.items : [])
  const interviews = context && Array.isArray(context.interviews) ? context.interviews : []
  if (!items.length) return null
  const qRaw = extractOfferQueryFromMessage(message)
  const q = normLoose(qRaw)
  if (!q || q.length < 3) return null

  const matches = items.filter((c) => {
    const offer = normLoose(c?.offerTitle || '')
    const subject = normLoose(c?.subject || '')
    if (!offer && !subject) return false
    if (offer && (offer.includes(q) || q.includes(offer))) return true
    if (subject && (subject.includes(q) || q.includes(subject))) return true
    const qTokens = q.split(' ').filter((x) => x.length >= 3)
    if (qTokens.length < 2) return false
    const target = `${offer} ${subject}`.trim()
    const overlap = qTokens.filter((t) => target.includes(t)).length
    return overlap >= Math.max(2, Math.ceil(qTokens.length * 0.5))
  })
  if (!matches.length) return null

  const ids = new Set(matches.map((c) => Number(c.id)).filter((id) => Number.isFinite(id)))
  const selectedForInterview = new Set(
    interviews
      .map((i) => Number(i?.candidatureId))
      .filter((id) => Number.isFinite(id) && ids.has(id))
  ).size
  const retained = matches.filter((c) => /accep|accept/i.test(String(c?.decision || ''))).length
  const total = matches.length
  const interviewRate = total > 0 ? Math.round((selectedForInterview * 1000) / total) / 10 : 0
  const retainedRate = total > 0 ? Math.round((retained * 1000) / total) / 10 : 0
  const sampleTitle = matches[0]?.offerTitle || matches[0]?.subject || qRaw
  return {
    query: qRaw,
    title: sampleTitle,
    total,
    selectedForInterview,
    retained,
    interviewRate,
    retainedRate,
  }
}

function normLoose(v) {
  return String(v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getMergedContextItems(context) {
  if (!context) return []
  const filtered = Array.isArray(context.items) ? context.items : []
  const raw = Array.isArray(context.itemsRaw) ? context.itemsRaw : []
  const byId = new Map()
  for (const c of [...filtered, ...raw]) {
    if (!c || c.id == null) continue
    const id = String(c.id)
    const prev = byId.get(id)
    byId.set(id, prev ? { ...prev, ...c, candidateName: c.candidateName || prev.candidateName } : c)
  }
  return Array.from(byId.values())
}

function nameQueryTokens(message) {
  const q = normLoose(message)
  return q
    .replace(/\b(donner|donne|moi|le|la|les|des|du|de|pour|sur|candidature|candidat|profil|resultat|resume|synthese|score|statut|decision|email|mail|telephone|tel|ecole|bu|nom|rdv|entretien|entretiens|reception|date|contexte|offre|nombre|duree|time|to|hire|interview|qui|est|ce|quoi|what|who|about|propos)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((t) => t.length >= 2)
}

function findBestCandidateByName(message, items) {
  const q = normLoose(message)
  if (!q || !Array.isArray(items) || !items.length) return null

  const ranked = []
  for (const c of items) {
    const name = normLoose(c?.candidateName)
    if (!name || isNoiseCandidateName(name)) continue
    const nTokens = name.split(' ').filter((t) => t.length >= 2)
    if (nTokens.length < 2) continue

    let score = 0
    if (q.includes(name)) {
      score = 100 + nTokens.length
    } else {
      const qTokens = nameQueryTokens(message)
      const overlap = nTokens.filter((t) => qTokens.includes(t) || q.includes(t)).length
      const required = Math.max(2, Math.ceil(nTokens.length * 0.6))
      if (overlap >= required) score = overlap * 10 + (overlap === nTokens.length ? 5 : 0)
    }
    if (score > 0) ranked.push({ c, score, name })
  }
  if (!ranked.length) return null
  ranked.sort((a, b) => b.score - a.score)
  if (ranked.length > 1 && ranked[0].score === ranked[1].score && ranked[0].name !== ranked[1].name) return null
  return ranked[0].c
}

function findCandidateByName(message, items) {
  return findBestCandidateByName(message, items)
}

function isBareCandidateNameQuery(message, hit) {
  if (!hit?.candidateName) return false
  const name = normLoose(hit.candidateName)
  const qTokens = nameQueryTokens(message)
  const nameTokens = name.split(' ').filter((t) => t.length >= 2)
  if (!nameTokens.length || !qTokens.length) return false
  const overlap = nameTokens.filter((t) => qTokens.includes(t)).length
  if (overlap < Math.min(2, nameTokens.length)) return false
  const noise = /\b(score|resume|synthese|decision|statut|resultat|email|ecole|telephone|rdv|entretien|candidature|offre|contexte|bu|nombre|duree|time|hire|reception|date)\b/g
  const extra = normLoose(message).replace(name, ' ').replace(noise, ' ').trim()
  return extra.split(' ').filter((t) => t.length >= 2).length <= 1
}

function isCandidateFocusedQuery(message, hit) {
  if (!hit) return false
  if (isBareCandidateNameQuery(message, hit)) return true
  if (!hasCandidateLookupIntent(message)) return false
  return (
    wantsSpecificCandidateResult(message) ||
    wantsCandidateSummary(message) ||
    wantsCandidateDecision(message) ||
    wantsCandidateNameField(message) ||
    wantsCandidateEmailField(message) ||
    wantsCandidatePhoneField(message) ||
    wantsCandidateSubjectField(message) ||
    wantsCandidateDateField(message) ||
    wantsCandidateSchoolField(message) ||
    wantsCandidateLastEmployerField(message) ||
    wantsCandidateOfferTitleField(message) ||
    wantsCandidateBusinessUnit(message) ||
    wantsCandidateReceptionDate(message) ||
    wantsCandidateOfferContext(message) ||
    wantsCandidateSkillsField(message) ||
    wantsCandidateExperienceField(message) ||
    wantsCandidateExperienceCount(message) ||
    wantsCandidateExperienceDuration(message) ||
    wantsCandidateTimeToHire(message) ||
    wantsCandidateRdv(message) ||
    wantsCandidateInterviewValidity(message) ||
    wantsHrSectionsCandidateSearch(message)
  )
}

function asIsoDay(v) {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  const tz = process.env.ASSISTANT_TIMEZONE || 'Africa/Casablanca'
  // Use business timezone to avoid UTC day drift in "today" filters.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  if (!y || !m || !day) return null
  return `${y}-${m}-${day}`
}

function parseTargetDayFromMessage(message, now = new Date()) {
  const t = (message || '').toLowerCase()
  const explicit = t.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/)
  if (explicit) {
    const dd = parseInt(explicit[1], 10)
    const mm = parseInt(explicit[2], 10)
    const yyyy = parseInt(explicit[3], 10)
    const year = yyyy < 100 ? 2000 + yyyy : yyyy
    const d = new Date(Date.UTC(year, mm - 1, dd))
    if (!Number.isNaN(d.getTime())) {
      return { isoDay: d.toISOString().slice(0, 10), label: `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${year}` }
    }
  }
  if (/\b(aujourd(?:hui)?|aujourdh(?:'|’)?ui|today|lyoum|lyom)\b/.test(t)) {
    return { isoDay: asIsoDay(now), label: 'aujourd\'hui' }
  }
  if (/\b(hier|yesterday|lbar7)\b/.test(t)) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - 1)
    return { isoDay: asIsoDay(d), label: 'hier' }
  }
  const weekdays = {
    dimanche: 0, sunday: 0,
    lundi: 1, monday: 1,
    mardi: 2, tuesday: 2,
    mercredi: 3, wednesday: 3,
    jeudi: 4, thursday: 4,
    vendredi: 5, friday: 5,
    samedi: 6, saturday: 6,
  }
  const dayWord = Object.keys(weekdays).find((k) => new RegExp(`\\b${k}\\b`).test(t))
  if (dayWord) {
    const target = weekdays[dayWord]
    const d = new Date(now)
    const current = d.getUTCDay()
    const diff = (current - target + 7) % 7
    d.setUTCDate(d.getUTCDate() - diff)
    return { isoDay: asIsoDay(d), label: dayWord }
  }
  return null
}

function wantsCampaignsOrOffers(message) {
  const t = (message || '').toLowerCase()
  const n = normLoose(message)
  // Tolérant aux fautes : campagns, trouvees, plateforme/Campagnes, etc.
  return (
    /\bcampagnes|campagne|campagns|campagn|offres|offre|campaigns|offers|donner.*campagn|quelles? campagn|liste.*offres|trouv[eé]es?.*plateforme|plateforme.*campagn|page.*campagnes?|\/campagnes\b/.test(t) ||
    /\b(stages?\s+pfe|offres?\s+d?\s*emploi|recrutements?\s+experimentes?)\b/.test(n)
  )
}

// Sujets réservés aux utilisateurs connectés : pas de détail pour les visiteurs non connectés (dashboard, candidatures, campagnes, entretiens, etc.)
function wantsRestrictedTopic(message) {
  const t = (message || '').toLowerCase()
  return /\bdashboard|tableau de bord|statistiques|stats|candidatures|candidature|campagnes|campagne|campagns|offres\b|offre\b|entretiens?|interviews?|confidentialit[eé]|confidentiality|r[eé]sum[eé]|summary|combien|how many|accept[eé]e|refus[eé]e|revoir|non lisible|d[eé]cision|applications|r[eé]sultats|results|d[eé]tail|detailed|mes candidatures|mes applications|donn[eé]es personnelles|données|personal data\b/.test(t)
}

function wantsInterviews(message) {
  const t = (message || '').toLowerCase()
  return /\bentretiens?|entreties|interviews?|rendez-vous|planifi[eé]s?|agenda|calendrier|quels? entretiens|liste.*entretiens/.test(t)
}

function wantsHrTracking(message) {
  const t = (message || '').toLowerCase()
  return /\bsuivi\s*rh|time\s*to\s*interview|time\s*to\s*hire|duree?\s*moyenne|dur[ée]e?\s*m[eé]diane|mediane|median|moyenne|delai|d[eé]lai|reception.*entretien|kpi\b/.test(t)
}

function wantsRhIndicators(message) {
  if (wantsOfferTargetList(message)) return false
  const t = (message || '').toLowerCase()
  if (/\bindicateurs?\s*rh|postulants?\s*\(?.*base\s*rh|base\s*rh|candidatures?\s*&\s*offres?\s*cibles?|pipeline\s*entretiens|sans\s*entretien/.test(t)) return true
  return /\b(retenus?|dur[ée]e?\s*moyenne|m[eé]diane|postulants?)\b/.test(t) &&
    /\b(indicateurs?|rh|kpi|pipeline|dashboard|tableau)\b/.test(t)
}

function wantsSpecificCandidateResult(message) {
  const t = (message || '').toLowerCase()
  return /\br[eé]sultat\b|resultat\s+de\b|resultat.*candidature|candidature\s+de|candidature\s+\w+|pour\s+la\s+candidature|profil\s+de|donner.*candidat|infos?.*candidat|detail.*candidat|statut|d[eé]cision|score\b|note\b|time\s*to\s*hire|dur[ée]e\s*time\s*to\s*hire|time\s*to\s*interview|suivi\s*rh|r[eé]ception\s*candidature|entretiens?|search|chercher|cherche|qelleb|9elleb|qleb\b/.test(t)
}

function wantsCandidateDecision(message) {
  const t = (message || '').toLowerCase()
  return /\bstatut|d[eé]cision|decision|accept[eé]e?|refus[eé]e?|a revoir|non lisible\b/.test(t)
}

function wantsCandidateBusinessUnit(message) {
  const t = (message || '').toLowerCase()
  return /\bbu\b|business\s*unit|integration\/it|integration it|business unit/.test(t)
}

function wantsCandidateReceptionDate(message) {
  const t = (message || '').toLowerCase()
  return /\br[eé]ception\b.*\bdate\b|\bdate\b.*\br[eé]ception\b|date de reception|date d.?ajout|ajout[eé]e? le/.test(t)
}

function wantsCandidateSummary(message) {
  const t = (message || '').toLowerCase()
  return /\bsynth[eè]se\b|\br[eé]sum[eé]\b|\bsummary\b/.test(t)
}

function wantsCandidateNameField(message) {
  const t = (message || '').toLowerCase()
  return /\bnom\b|\bcandidate\s*name\b|nom du candidat/.test(t)
}

function wantsCandidateEmailField(message) {
  const t = (message || '').toLowerCase()
  return /\bemail\b|\bmail\b|\be-mail\b|adresse\s*(mail|email)|gmail|outlook/.test(t)
}

function wantsCandidatePhoneField(message) {
  const t = (message || '').toLowerCase()
  return /\bt[eé]l[eé]phone\b|\bnum[eé]ro\b|\bphone\b|\bt[eé]l\b/.test(t)
}

function wantsCandidateSubjectField(message) {
  const t = (message || '').toLowerCase()
  return /\bobjet\b|\bsubject\b|offre demand[eé]e/.test(t)
}

function wantsCandidateDateField(message) {
  const t = (message || '').toLowerCase()
  return /\bdate\b/.test(t) && !wantsCandidateReceptionDate(message)
}

function wantsCandidateSchoolField(message) {
  const t = (message || '').toLowerCase()
  return /(^|[\s:;,.!?()'"-])(ecole|école|school|universite|université|fac|faculte|faculté)(?=$|[\s:;,.!?()'"-])/.test(t)
}

function wantsCandidateLastEmployerField(message) {
  const t = (message || '').toLowerCase()
  return /\bdernier\s*employeur\b|last\s*employer|entreprise actuelle|societe actuelle/.test(t)
}

function wantsCandidateOfferTitleField(message) {
  if (wantsOfferTargetList(message)) return false
  const t = (message || '').toLowerCase()
  return /\boffre\s*cible\b|offer\s*title|titre\s*offre/.test(t)
}

function wantsCandidateOfferContext(message) {
  const t = (message || '').toLowerCase()
  return /\bcontexte\s*offre\b|offer\s*context/.test(t)
}

function wantsCandidateSkillsField(message) {
  const t = (message || '').toLowerCase()
  return /\bcomp[eé]tences?\b|\bskills\b|\bhard\s*skills\b|\bsoft\s*skills\b/.test(t)
}

function wantsCandidateExperienceField(message) {
  if (wantsCandidateExperienceCount(message) || wantsCandidateExperienceDuration(message)) return false
  const t = (message || '').toLowerCase()
  return /\bexp[eé]riences?\b|\bexperience\b|\bparcours\s*professionnel\b/.test(t)
}

function wantsCandidateExperienceCount(message) {
  const t = (message || '').toLowerCase()
  return /\bnombre\s*d.?exp[eé]rience|experience\s*count|combien\s*d.?exp[eé]riences?/.test(t)
}

function wantsCandidateExperienceDuration(message) {
  const t = (message || '').toLowerCase()
  return /\bdur[ée]e\s*d.?exp[eé]rience|experience\s*duration|anciennet[eé]\b/.test(t)
}

function wantsCandidateTimeToHire(message) {
  const t = (message || '').toLowerCase()
  return /\btime\s*to\s*hire|time\s*to\s*interview|dur[ée]e|delai|d[eé]lai|temps.*embauche|temps.*entretien\b/.test(t)
}

function wantsCandidateRdv(message) {
  const t = (message || '').toLowerCase()
  return /\brdv|rendez[\s-]?vous|entretien|interview|date.*entretien|horaire|planning\b/.test(t)
}

function wantsCandidateInterviewValidity(message) {
  const t = (message || '').toLowerCase()
  return /\b(entretien|interview)\s*rh\b.*\b(valide|valid[eé]|pas encore|done|termine|realise)\b|\bvalide\b.*\b(entretien|interview)\s*rh\b/.test(t)
}

function wantsRhInterviewScope(message) {
  const t = (message || '').toLowerCase()
  return /\b(entretien|interview)\s*rh\b|\brh\b/.test(t)
}

function parseInterviewTypeScope(message) {
  const t = normLoose(message)
  if (/\b(rh|human resources|ressources humaines|entretien rh)\b/.test(t)) return 'RH'
  if (/\b(technique|tech|entretien technique)\b/.test(t)) return 'TECHNIQUE'
  if (/\b(directeur|direction|manager|entretien directeur)\b/.test(t)) return 'DIRECTEUR'
  return null
}

function interviewMatchesType(i, typeScope) {
  if (!typeScope) return true
  const notes = normLoose(i?.notesRh || '')
  const mode = normLoose(i?.mode || '')
  const status = normLoose(i?.status || '')
  const hay = `${notes} ${mode} ${status}`.trim()
  if (typeScope === 'RH') return /\b(rh|human resources|ressources humaines|entretien rh)\b/.test(hay)
  if (typeScope === 'TECHNIQUE') return /\b(technique|tech|entretien technique)\b/.test(hay)
  if (typeScope === 'DIRECTEUR') return /\b(directeur|direction|manager|entretien directeur)\b/.test(hay)
  return true
}

function wantsCandidatesWithAtLeastOneInterview(message) {
  const t = normLoose(message)
  return /(\bcandidatures?\b|\bcandidats?\b).*(au moins|minimum|>=|plus de|avec).*(un|1).*(entretien|interview)/.test(t) ||
    /(entretien|interview).*(au moins|minimum|>=|plus de).*(un|1).*(candidatures?|candidats?)/.test(t)
}

function wantsValidatedInterviews(message) {
  const t = (message || '').toLowerCase()
  return /\b(entretiens?|interviews?|rdv|rendez[\s-]?vous)\b.*\b(valid[eé]s?|validees?|pass[eé]s?|realis[eé]s?|termin[eé]s?|done|completed)\b|\b(valid[eé]s?|validees?|pass[eé]s?|realis[eé]s?)\b.*\b(entretiens?|interviews?|rdv)\b/.test(t)
}

function wantsPendingInterviews(message) {
  const t = (message || '').toLowerCase()
  return /\b(pas encore|not yet|en attente|pending|non valide|non valid[eé]|a venir|à venir)\b/.test(t)
}

function hasCandidateLookupIntent(message) {
  const t = (message || '').toLowerCase()
  if (/\bpour\s+|de\s+[a-zàâäéèêëïîôùûü]|candidature\s+de|profil\s+de|candidate\s+|candidat\s+|nom\b|\bscore\b|\br[eé]sum[eé]\b|\bsynth[eè]se\b|\bresultat\b|\bd[eé]cision\b|\bcomp[eé]tences?\b|\bskills\b|\bexp[eé]riences?\b|\bexperience\b|\bcontexte\s*offre\b/.test(t)) return true
  return /^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜ][\w'’\-àâäéèêëïîôùûü]{1,30}(?:\s+[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜ][\w'’\-àâäéèêëïîôùûü]{1,30}){1,4}\s*$/.test((message || '').trim())
}

function isNoiseCandidateName(name) {
  const n = normLoose(name)
  return !n || /^(a propos de moi|about me|soft skills|hard skills|formation|projets?|competences|skills|resume|summary|profil)$/i.test(n)
}

function findInterviewsByCandidateName(message, interviews) {
  const q = normLoose(message)
  if (!q || !Array.isArray(interviews) || !interviews.length) return []
  return interviews
    .filter((i) => {
      const n = normLoose(i?.candidateName)
      if (isNoiseCandidateName(n)) return false
      if (!n) return false
      if (n.length >= 4 && q.includes(n)) return true
      const parts = n.split(' ').filter(Boolean)
      return parts.length >= 2 && parts.every((p) => p.length >= 2 && q.includes(p))
    })
    .sort((a, b) => new Date(a?.scheduledAt || 0).getTime() - new Date(b?.scheduledAt || 0).getTime())
}

function wantsHrSectionsCandidateSearch(message) {
  const t = (message || '').toLowerCase()
  const asksSearch = /\bchercher|cherche|search|find|qelleb|9elleb|qleb\b/.test(t)
  const asksSections = /\bsuivi\s*rh|time\s*to\s*interview|r[eé]ception\s*candidature|entretiens?\b/.test(t)
  const asksCandidature = /\bcandidature|candidat|candidate|profil|nom\b/.test(t)
  return (asksSections && asksCandidature) || (asksSearch && asksSections)
}

function findClosestCandidateNames(message, items, limit = 3) {
  const q = normLoose(message)
  if (!q || !Array.isArray(items) || !items.length) return []
  const qTokens = q.split(' ').filter((x) => x.length >= 3)
  const scored = []
  for (const c of items) {
    const name = normLoose(c?.candidateName)
    if (isNoiseCandidateName(name)) continue
    if (!name) continue
    const nTokens = name.split(' ').filter((x) => x.length >= 3)
    if (!nTokens.length) continue
    const overlap = nTokens.filter((t) => qTokens.includes(t)).length
    if (overlap > 0) scored.push({ name: c.candidateName, overlap })
  }
  return scored
    .sort((a, b) => b.overlap - a.overlap)
    .map((x) => x.name)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, limit)
}

function buildCandidateTimeToHireLine(hit, interviews) {
  const cid = Number(hit?.id)
  if (!Number.isFinite(cid) || !Array.isArray(interviews) || !interviews.length) return null
  const iv = interviews
    .filter((i) => Number(i?.candidatureId) === cid && i?.scheduledAt)
    .map((i) => new Date(i.scheduledAt))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())
  if (!iv.length) return null
  const recv = hit?.date ? new Date(hit.date) : null
  if (!recv || Number.isNaN(recv.getTime())) return null
  const diffMs = iv[0].getTime() - recv.getTime()
  if (!Number.isFinite(diffMs) || diffMs < 0) return null
  const hours = Math.round(diffMs / (1000 * 60 * 60))
  const d = Math.floor(hours / 24)
  const h = hours % 24
  return `${d}j ${h}h (reception -> 1er entretien)`
}

function buildCandidateRdvLines(hit, interviews, opts = {}) {
  const cid = Number(hit?.id)
  if (!Number.isFinite(cid) || !Array.isArray(interviews) || !interviews.length) return []
  const rhOnly = !!opts.rhOnly
  const typeScope = opts.typeScope || null
  const validatedOnly = !!opts.validatedOnly
  const pendingOnly = !!opts.pendingOnly
  const isValidated = (status) => /\bvalide|valid[eé]|realise|realisee|termine|done|completed|effectue\b/i.test(String(status || ''))
  return interviews
    .filter((i) => {
      if (Number(i?.candidatureId) !== cid) return false
      if (!interviewMatchesType(i, typeScope)) return false
      if (rhOnly) {
        const notes = normLoose(i?.notesRh || '')
        const mode = normLoose(i?.mode || '')
        const status = normLoose(i?.status || '')
        const isRh = /\brh\b|human resources|entretien rh/.test(notes) || /\brh\b/.test(mode) || /\brh\b/.test(status)
        if (!isRh) return false
      }
      if (validatedOnly && !isValidated(i?.status)) return false
      if (pendingOnly && isValidated(i?.status)) return false
      return true
    })
    .map((i) => {
      const when = i?.scheduledAt ? new Date(i.scheduledAt) : null
      const date = when && !Number.isNaN(when.getTime()) ? when.toISOString().replace('T', ' ').slice(0, 16) : 'date non definie'
      return {
        date,
        mode: i?.mode || '—',
        status: i?.status || '—',
        location: i?.location || '—',
      }
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

function getCandidateRhInterviewValidity(hit, interviews) {
  const cid = Number(hit?.id)
  if (!Number.isFinite(cid) || !Array.isArray(interviews) || !interviews.length) {
    return { hasRh: false, validated: false, statuses: [] }
  }
  const rhRows = interviews.filter((i) => {
    if (Number(i?.candidatureId) !== cid) return false
    const notes = normLoose(i?.notesRh || '')
    const mode = normLoose(i?.mode || '')
    const status = normLoose(i?.status || '')
    return /\brh\b|human resources|entretien rh/.test(notes) || /\brh\b/.test(mode) || /\brh\b/.test(status)
  })
  if (!rhRows.length) return { hasRh: false, validated: false, statuses: [] }
  const statuses = rhRows.map((r) => String(r?.status || '').trim()).filter(Boolean)
  const validated = rhRows.some((r) => {
    const st = normLoose(r?.status || '')
    return /\bvalide|valid[eé]|realise|realisee|termine|done|completed|effectue\b/.test(st)
  })
  return { hasRh: true, validated, statuses }
}

function median(values) {
  if (!Array.isArray(values) || values.length === 0) return null
  const v = values.slice().sort((a, b) => a - b)
  const mid = Math.floor(v.length / 2)
  if (v.length % 2 === 1) return v[mid]
  return (v[mid - 1] + v[mid]) / 2
}

function computeTimeToInterviewMetrics(context) {
  const items = context && Array.isArray(context.items) ? context.items : []
  const interviews = context && Array.isArray(context.interviews) ? context.interviews : []
  if (!items.length || !interviews.length) {
    return { totalLinked: 0, avgDays: null, medianDays: null, latest: [] }
  }

  const itemById = new Map()
  for (const c of items) {
    const id = Number(c?.id)
    if (Number.isFinite(id)) itemById.set(id, c)
  }

  const firstInterviewByCand = new Map()
  for (const i of interviews) {
    const cid = Number(i?.candidatureId)
    const dt = i?.scheduledAt ? new Date(i.scheduledAt) : null
    if (!Number.isFinite(cid) || !dt || Number.isNaN(dt.getTime())) continue
    const prev = firstInterviewByCand.get(cid)
    if (!prev || dt.getTime() < prev.getTime()) firstInterviewByCand.set(cid, dt)
  }

  const pairs = []
  for (const [cid, firstIv] of firstInterviewByCand.entries()) {
    const c = itemById.get(cid)
    const received = c?.date ? new Date(c.date) : null
    if (!received || Number.isNaN(received.getTime())) continue
    const diffMs = firstIv.getTime() - received.getTime()
    if (!Number.isFinite(diffMs) || diffMs < 0) continue
    const days = diffMs / (1000 * 60 * 60 * 24)
    pairs.push({
      candidatureId: cid,
      candidateName: c?.candidateName || 'Candidat',
      subject: c?.subject || 'Sans objet',
      days,
      receivedAt: received,
      firstInterviewAt: firstIv,
    })
  }

  if (!pairs.length) return { totalLinked: 0, avgDays: null, medianDays: null, latest: [] }
  const values = pairs.map((p) => p.days)
  const avgDays = values.reduce((a, b) => a + b, 0) / values.length
  const medianDays = median(values)
  const latest = pairs
    .slice()
    .sort((a, b) => b.firstInterviewAt.getTime() - a.firstInterviewAt.getTime())
    .slice(0, 8)

  return { totalLinked: pairs.length, avgDays, medianDays, latest }
}

function buildHrTrackingBlock(context, lang) {
  const m = computeTimeToInterviewMetrics(context)
  if (!m.totalLinked) return ''

  const formatDays = (v) => (v == null ? '—' : `${Math.round(v * 10) / 10} j`)
  const latestLines = m.latest.map((x, idx) => {
    const iv = x.firstInterviewAt.toISOString().slice(0, 10)
    return `${idx + 1}. ${x.candidateName} — ${x.subject} — ${formatDays(x.days)} (1er entretien: ${iv})`
  })

  const blocks = {
    fr:
      `\n\n--- Suivi RH - Time to interview ---\n` +
      `Candidatures reliees: ${m.totalLinked}\n` +
      `Duree moyenne reception -> 1er entretien: ${formatDays(m.avgDays)}\n` +
      `Mediane reception -> 1er entretien: ${formatDays(m.medianDays)}\n` +
      `Derniers delais calcules:\n${latestLines.join('\n')}`,
    en:
      `\n\n--- HR tracking - Time to interview ---\n` +
      `Linked applications: ${m.totalLinked}\n` +
      `Average reception -> first interview: ${formatDays(m.avgDays)}\n` +
      `Median reception -> first interview: ${formatDays(m.medianDays)}\n` +
      `Latest calculated delays:\n${latestLines.join('\n')}`,
    darija:
      `\n\n--- Suivi RH - Time to interview ---\n` +
      `Candidatures mrabtin: ${m.totalLinked}\n` +
      `Moyenne reception -> 1er entretien: ${formatDays(m.avgDays)}\n` +
      `Mediane reception -> 1er entretien: ${formatDays(m.medianDays)}\n` +
      `A5er delais li t7sebo:\n${latestLines.join('\n')}`,
  }
  return blocks[lang] || blocks.fr
}

function formatDaysToJH(days) {
  if (!Number.isFinite(days)) return '—'
  const totalHours = Math.round(days * 24)
  const d = Math.floor(totalHours / 24)
  const h = totalHours % 24
  return `${d}j ${h}h`
}

function formatCompactDelayFromMs(ms) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—'
  const hTotal = Math.floor(ms / (1000 * 60 * 60))
  const d = Math.floor(hTotal / 24)
  const h = hTotal % 24
  if (d > 0 && h > 0) return `${d}j${h}h`
  if (d > 0) return `${d}j`
  return `${h}h`
}

function buildRhIndicatorsBlock(context, lang) {
  const items = context && Array.isArray(context.itemsRaw) ? context.itemsRaw : (context && Array.isArray(context.items) ? context.items : [])
  const interviews = context && Array.isArray(context.interviews) ? context.interviews : []
  if (!items.length) return ''

  const total = items.length
  const withInterview = new Set(
    interviews
      .map((i) => Number(i?.candidatureId))
      .filter((id) => Number.isFinite(id))
  )
  const pipeline = withInterview.size
  const sansEntretien = Math.max(0, total - pipeline)
  const retained = items.filter((c) => {
    const d = String(c?.decision || '').toUpperCase()
    return d.includes('ACCEP')
  }).length

  // Align with dashboard KPI cards:
  // - DURÉE MOYENNE = moyenne réception -> dernier RDV
  // - MÉDIANE = médiane 1er -> dernier RDV
  const candDateById = new Map()
  for (const c of items) {
    const t = c?.date ? new Date(c.date).getTime() : NaN
    if (!Number.isNaN(t)) candDateById.set(String(c.id), t)
  }
  const byCand = new Map()
  for (const iv of interviews) {
    if (!iv?.scheduledAt) continue
    const t = new Date(iv.scheduledAt).getTime()
    if (Number.isNaN(t)) continue
    const key = String(iv.candidatureId)
    if (!byCand.has(key)) byCand.set(key, [])
    byCand.get(key).push(t)
  }
  const receptionToLast = []
  const spanFirstToLast = []
  byCand.forEach((times, cid) => {
    const recv = candDateById.get(cid)
    if (recv == null) return
    const sorted = [...times].sort((a, b) => a - b)
    const last = sorted[sorted.length - 1]
    if (last >= recv) receptionToLast.push(last - recv)
    if (sorted.length >= 2) {
      const first = sorted[0]
      if (last >= first) spanFirstToLast.push(last - first)
    }
  })
  const avgReceptionToLastMs = receptionToLast.length
    ? Math.round(receptionToLast.reduce((a, b) => a + b, 0) / receptionToLast.length)
    : null
  const sortedSpan = [...spanFirstToLast].sort((a, b) => a - b)
  const medianSpanMs = sortedSpan.length ? sortedSpan[Math.floor(sortedSpan.length / 2)] : null
  const avgJH = formatCompactDelayFromMs(avgReceptionToLastMs)
  const medJH = formatCompactDelayFromMs(medianSpanMs)

  const blocks = {
    fr:
      `\n\n--- Indicateurs RH : candidatures & offres cibles ---\n` +
      `POSTULANTS (BASE RH): ${total}\n` +
      `PIPELINE ENTRETIENS: ${pipeline}\n` +
      `SANS ENTRETIEN: ${sansEntretien}\n` +
      `RETENUS (DECISION): ${retained}\n` +
      `DUREE MOYENNE: ${avgJH}\n` +
      `MEDIANE: ${medJH}`,
    en:
      `\n\n--- HR Indicators: applications & target offers ---\n` +
      `APPLICANTS (HR BASE): ${total}\n` +
      `INTERVIEW PIPELINE: ${pipeline}\n` +
      `WITHOUT INTERVIEW: ${sansEntretien}\n` +
      `RETAINED (DECISION): ${retained}\n` +
      `AVERAGE DURATION: ${avgJH}\n` +
      `MEDIAN: ${medJH}`,
    darija:
      `\n\n--- Indicateurs RH: candidatures & offres cibles ---\n` +
      `POSTULANTS (BASE RH): ${total}\n` +
      `PIPELINE ENTRETIENS: ${pipeline}\n` +
      `SANS ENTRETIEN: ${sansEntretien}\n` +
      `RETENUS (DECISION): ${retained}\n` +
      `DUREE MOYENNE: ${avgJH}\n` +
      `MEDIANE: ${medJH}`,
  }
  return blocks[lang] || blocks.fr
}

function buildOfferTargetListBlock(context, lang) {
  const items = context && Array.isArray(context.itemsRaw) && context.itemsRaw.length
    ? context.itemsRaw
    : (context && Array.isArray(context.items) ? context.items : [])
  const interviews = context && Array.isArray(context.interviews) ? context.interviews : []
  if (!items.length) return ''

  const withInterview = new Set(
    interviews
      .map((i) => String(i?.candidatureId))
      .filter(Boolean)
  )
  const byOffer = new Map()
  for (const c of items) {
    const offerLabel = normalizeOfferTitleForKpi(c?.offerTitle) || 'Sans offre cible'
    if (!byOffer.has(offerLabel)) {
      byOffer.set(offerLabel, {
        offerLabel,
        applicationsCount: 0,
        selectedForInterviewCount: 0,
        retainedCount: 0,
      })
    }
    const row = byOffer.get(offerLabel)
    row.applicationsCount += 1
    if (withInterview.has(String(c?.id))) row.selectedForInterviewCount += 1
    const d = String(c?.decision || '').toUpperCase()
    if (d.includes('ACCEP')) row.retainedCount += 1
  }

  const rows = [...byOffer.values()].sort((a, b) => b.applicationsCount - a.applicationsCount)
  const lines = rows.slice(0, 50).map((r, idx) =>
    `${idx + 1}. ${r.offerLabel} — Postulants: ${r.applicationsCount} — Sélection entretien: ${r.selectedForInterviewCount} — Retenus (décision): ${r.retainedCount}`
  )

  const blocks = {
    fr:
      `\n\n--- Offres cibles (tableau RH) ---\n` +
      `Colonnes : Offre cible (titre) | Postulants | Sélection entretien | Retenus (décision)\n\n` +
      lines.join('\n'),
    en:
      `\n\n--- Target offers (HR table) ---\n` +
      `Columns: Target offer (title) | Applicants | Interview selection | Retained (decision)\n\n` +
      lines.map((l) => l.replace('Sélection entretien', 'Interview selection').replace('Retenus (décision)', 'Retained (decision)')).join('\n'),
    darija:
      `\n\n--- Offres cibles (tableau RH) ---\n` +
      lines.join('\n'),
  }
  return blocks[lang] || blocks.fr
}

function buildInterviewsBlock(context, lang) {
  const list = context && Array.isArray(context.interviews) ? context.interviews : []
  if (list.length === 0) return ''
  const linesFr = list.slice(0, 15).map((i, idx) => {
    const date = i.scheduledAt ? new Date(i.scheduledAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
    return `${idx + 1}. ${i.candidateName || 'Candidat'} — ${i.subject || 'Sans objet'} — ${date} — ${i.mode || '—'} — ${i.status || '—'}`
  })
  const linesEn = list.slice(0, 15).map((i, idx) => {
    const date = i.scheduledAt ? new Date(i.scheduledAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—'
    return `${idx + 1}. ${i.candidateName || 'Candidate'} — ${i.subject || 'No subject'} — ${date} — ${i.mode || '—'} — ${i.status || '—'}`
  })
  const introFr = `\n\n--- Entretiens sur la plateforme (${list.length} au total) ---\n`
  const introEn = `\n\n--- Interviews on the platform (${list.length} total) ---\n`
  const introDarija = `\n\n--- Entretiens f l-plateforme (${list.length} en tout) ---\n`
  const blocks = {
    fr: introFr + linesFr.join('\n'),
    en: introEn + linesEn.join('\n'),
    darija: introDarija + linesFr.join('\n'),
  }
  return blocks[lang] || blocks.fr
}

function pickRequestedCampaign(message, campaigns) {
  const q = normLoose(message)
  if (!q || !Array.isArray(campaigns) || campaigns.length === 0) return null
  const hinted =
    q.match(/offres?\s+(?:de|du|des|d)\s+(.+)$/)?.[1]?.trim() ||
    q.match(/campagnes?\s+(?:de|du|des|d)\s+(.+)$/)?.[1]?.trim() ||
    ''
  const query = hinted || q
  let best = null
  let bestOverlap = 0
  for (const c of campaigns) {
    const name = normLoose(c?.name)
    const code = normLoose(c?.code)
    if (!name && !code) continue
    const hitExact = (name && query.includes(name)) || (code && query.includes(code))
    const hitPartial =
      (name && name.split(' ').filter(Boolean).length >= 2 && name.split(' ').filter(Boolean).every((p) => p.length >= 3 ? query.includes(p) : true)) ||
      (code && query.includes(code.replace(/\s+/g, '')))
    const qTokens = query.split(' ').filter((t) => t.length >= 3)
    const nTokens = name.split(' ').filter((t) => t.length >= 3)
    const overlap = qTokens.length && nTokens.length ? qTokens.filter((t) => nTokens.includes(t)).length : 0
    if (hitExact) return c
    if (hitPartial && !best) best = c
    if (overlap > bestOverlap) {
      bestOverlap = overlap
      best = c
    }
  }
  return bestOverlap >= 2 ? best : best
}

function buildCampaignsOffersBlock(context, lang, message = '') {
  const campaigns = context && Array.isArray(context.campaigns) ? context.campaigns : []
  const offers = context && Array.isArray(context.offers) ? context.offers : []
  if (campaigns.length === 0 && offers.length === 0) return ''
  const requestedCampaign = pickRequestedCampaign(message, campaigns)
  const viewCampaigns = requestedCampaign ? [requestedCampaign] : campaigns
  const viewOffers = requestedCampaign
    ? offers.filter((o) => {
        const cn = normLoose(o?.campaignName)
        const cc = normLoose(o?.campaignCode)
        const rn = normLoose(requestedCampaign?.name)
        const rc = normLoose(requestedCampaign?.code)
        return (rn && cn === rn) || (rc && cc === rc) || (rn && cn.includes(rn)) || (rc && cc.includes(rc))
      })
    : offers
  const linesFr = viewCampaigns.map((c) => `• ${c.name || c.code} (${c.code}) — ${c.results_count != null ? c.results_count + ' offres' : ''}`)
  const linesEn = viewCampaigns.map((c) => `• ${c.name || c.code} (${c.code}) — ${c.results_count != null ? c.results_count + ' offers' : ''}`)
  const linesDarija = viewCampaigns.map((c) => `• ${c.name || c.code} (${c.code}) — ${c.results_count != null ? c.results_count + ' offres' : ''}`)
  const listFr = linesFr.length ? `\n\nCampagnes sur la plateforme :\n${linesFr.join('\n')}` : ''
  const listEn = linesEn.length ? `\n\nCampaigns on the platform:\n${linesEn.join('\n')}` : ''
  const listDarija = linesDarija.length ? `\n\nCampagnes f l-plateforme:\n${linesDarija.join('\n')}` : ''
  let offerSampleFr = ''
  let offerSampleEn = ''
  let offerSampleDarija = ''
  if (viewOffers.length > 0) {
    const sample = viewOffers.slice(0, requestedCampaign ? 30 : 8).map((o) => `${o.title || o.reference}${o.company ? ' — ' + o.company : ''} (${o.location || '—'})`)
    const sectionTitleFr = requestedCampaign
      ? `\n\nOffres specifiques de ${requestedCampaign.name || requestedCampaign.code} (${viewOffers.length}) :\n`
      : `\n\nExemples d’offres :\n`
    const sectionTitleEn = requestedCampaign
      ? `\n\nSpecific offers for ${requestedCampaign.name || requestedCampaign.code} (${viewOffers.length}):\n`
      : `\n\nSample offers:\n`
    const sectionTitleDarija = requestedCampaign
      ? `\n\nOffres specifiques dyal ${requestedCampaign.name || requestedCampaign.code} (${viewOffers.length}) :\n`
      : `\n\nExemples d’offres:\n`
    offerSampleFr = sectionTitleFr + sample.map((s) => `• ${s}`).join('\n')
    offerSampleEn = sectionTitleEn + sample.map((s) => `• ${s}`).join('\n')
    offerSampleDarija = sectionTitleDarija + sample.map((s) => `• ${s}`).join('\n')
  } else if (requestedCampaign) {
    const noDataFr = `\n\nAucune offre trouvee pour ${requestedCampaign.name || requestedCampaign.code}.`
    const noDataEn = `\n\nNo offers found for ${requestedCampaign.name || requestedCampaign.code}.`
    const noDataDarija = `\n\nMa lqina hta offre f ${requestedCampaign.name || requestedCampaign.code}.`
    offerSampleFr = noDataFr
    offerSampleEn = noDataEn
    offerSampleDarija = noDataDarija
  }
  const blocks = {
    fr: listFr + offerSampleFr,
    en: listEn + offerSampleEn,
    darija: listDarija + offerSampleDarija,
  }
  return blocks[lang] || blocks.fr
}

/**
 * Get RAG answer for a message.
 * @param {string} message - User message
 * @param {{ total?: number, accepted?: number, refused?: number, toReview?: number, nonLisible?: number, items?: Array<any>, campaigns?: Array<any>, offers?: Array<any> }} [context] - Optional: dashboard stats (when logged in) and/or campaigns/offers (injected automatically)
 * @returns {{ answer: string, language: 'fr'|'en'|'darija' }}
 */
export function getRagAnswer(message, context = null) {
  const dashboardContext = context && (typeof context.total === 'number' || Array.isArray(context.campaigns)) ? context : null
  const lang = detectLanguage(message)
  let forceDirect = false
  const trimmed = (message || '').trim()
  if (!trimmed) {
    const empty = {
      fr: 'Posez une question sur la plateforme, le dashboard ou PCA.',
      en: 'Ask a question about the platform, dashboard or PCA.',
      darija: 'Jreb tsoual 3la l-plateforme, l-dashboard wla PCA.',
    }
    return { answer: empty[lang], language: lang }
  }

  const mergedItems = getMergedContextItems(dashboardContext)
  const resolvedCandidate = mergedItems.length ? findBestCandidateByName(trimmed, mergedItems) : null
  const candidateFocused = !!(resolvedCandidate && isCandidateFocusedQuery(trimmed, resolvedCandidate))
  const offerTargetListQuery = wantsOfferTargetList(trimmed)

  let answer = ''
  if (!candidateFocused && !offerTargetListQuery) {
  // Find best matching chunk
  let best = { index: -1, score: 0 }
  KNOWLEDGE.forEach((chunk, i) => {
    const s = scoreMatch(trimmed, chunk.keywords)
    if (s > best.score) best = { index: i, score: s }
  })

  if (best.score > 0) {
    const chunk = KNOWLEDGE[best.index]
    answer = chunk[lang] || chunk.fr
  } else {
    const fallback = {
      fr: 'Je n\'ai pas trouvé de réponse précise. Vous pouvez demander : "C\'est quoi la plateforme ?", "Comment accéder au dashboard ?", "Qui est PCA ?" ou vous connecter pour obtenir un résumé de vos candidatures.',
      en: 'I didn\'t find an exact match. You can ask: "What is the platform?", "How to access the dashboard?", "Who is PCA?" or log in to get a summary of your applications.',
      darija: 'Ma lqitouch jawab m7addar. Tqder tsoual: "C\'est quoi la plateforme?", "Kifach ndkhol l-dashboard?", "Shno PCA?" wla qrabt bach n3tik résumé dyal l-candidatures.',
    }
    answer = fallback[lang] || fallback.fr
    }
  }

  const hasCandidateCardIntentEarly = candidateFocused || (
    hasCandidateLookupIntent(trimmed) &&
    (
      wantsSpecificCandidateResult(trimmed) ||
      wantsCandidateDecision(trimmed) ||
      wantsCandidateNameField(trimmed) ||
      wantsCandidateEmailField(trimmed) ||
      wantsCandidatePhoneField(trimmed) ||
      wantsCandidateSubjectField(trimmed) ||
      wantsCandidateDateField(trimmed) ||
      wantsCandidateSchoolField(trimmed) ||
      wantsCandidateLastEmployerField(trimmed) ||
      wantsCandidateOfferTitleField(trimmed) ||
      wantsCandidateBusinessUnit(trimmed) ||
      wantsCandidateReceptionDate(trimmed) ||
      wantsCandidateSummary(trimmed) ||
      wantsCandidateOfferContext(trimmed) ||
      wantsCandidateSkillsField(trimmed) ||
      wantsCandidateExperienceField(trimmed) ||
      wantsCandidateExperienceCount(trimmed) ||
      wantsCandidateExperienceDuration(trimmed) ||
      wantsCandidateTimeToHire(trimmed) ||
      wantsCandidateRdv(trimmed) ||
      wantsCandidateInterviewValidity(trimmed) ||
      wantsHrSectionsCandidateSearch(trimmed)
    )
  )

  // Tableau « Offre cible (titre) » — avant les KPI globaux (évite confusion + doublon).
  if (offerTargetListQuery && dashboardContext) {
    const table = buildOfferTargetListBlock(dashboardContext, lang)
    if (table) {
      const intro = {
        fr: 'Voici les donnees dynamiques par offre cible (alignees sur le tableau de bord RH) :',
        en: 'Here is the live data per target offer (aligned with the HR dashboard table):',
        darija: 'Hna donnees dyal kol offre cible (b7al tableau RH) :',
      }
      return { answer: `${intro[lang] || intro.fr}${table}`, language: lang, forceDirect: true }
    }
  }

  // Hard priority for RH indicators only on global KPI requests (not candidate card lookups).
  if (wantsRhIndicators(trimmed) && !hasCandidateCardIntentEarly) {
    const indicators = buildRhIndicatorsBlock(context, lang)
    if (indicators) {
      const intro = {
        fr: 'Voici les donnees dynamiques des indicateurs RH:',
        en: 'Here is the dynamic HR indicators data:',
        darija: 'Hna donnees dynamiques dyal indicateurs RH:',
      }
      return { answer: `${intro[lang] || intro.fr}${indicators}`, language: lang, forceDirect: true }
    }
  }

  const dynamicBlocks = []

  // Campagnes / offres : injecter les données réelles si la question le demande et qu’on a des données
  const hasCampaigns = context && Array.isArray(context.campaigns) && context.campaigns.length > 0
  const hasOffers = context && Array.isArray(context.offers) && context.offers.length > 0
  const isCampaignOfferQuery = wantsCampaignsOrOffers(trimmed) && !hasCandidateCardIntentEarly
  if (isCampaignOfferQuery && (hasCampaigns || hasOffers)) {
    const block = buildCampaignsOffersBlock(context, lang, trimmed)
    if (block) dynamicBlocks.push(block)
  }

  // Entretiens : injecter la liste des entretiens si la question le demande
  const hasInterviews = context && Array.isArray(context.interviews) && context.interviews.length > 0
  if (wantsInterviews(trimmed) && hasInterviews) {
    const block = buildInterviewsBlock(context, lang)
    if (block) dynamicBlocks.push(block)
  }
  if (wantsValidatedInterviews(trimmed) && hasInterviews) {
    const validated = (context.interviews || []).filter((i) => {
      const st = normLoose(i?.status || '')
      return /\bvalide|valid[eé]|realise|realisee|termine|done|completed|effectue\b/.test(st)
    })
    if (validated.length) {
      const lines = validated.slice(0, 20).map((i, idx) => {
        const date = i.scheduledAt ? new Date(i.scheduledAt).toISOString().replace('T', ' ').slice(0, 16) : '—'
        return `${idx + 1}. ${i.candidateName || 'Candidat'} — ${i.subject || 'Sans objet'} — ${date} — ${i.mode || '—'} — ${i.status || '—'}`
      })
      const intro = {
        fr: `\n\nEntretiens validés/réalisés (${validated.length}) :\n`,
        en: `\n\nValidated/completed interviews (${validated.length}):\n`,
        darija: `\n\nEntretiens valides/realisés (${validated.length}) :\n`,
      }
      dynamicBlocks.push((intro[lang] || intro.fr) + lines.join('\n'))
    }
  }

  if (wantsHrTracking(trimmed)) {
    const block = buildHrTrackingBlock(context, lang)
    if (block) dynamicBlocks.push(block)
  }
  // Les indicateurs RH globaux sont retournés en early-return (pas de doublon ici).

  if (dynamicBlocks.length > 0) {
    const intro = {
      fr: 'Voici les donnees dynamiques de la plateforme:',
      en: 'Here is the dynamic platform data:',
      darija: 'Hna les donnees dynamiques dyal plateforme:',
    }
    answer = `${intro[lang] || intro.fr}\n${dynamicBlocks.join('\n')}`
    forceDirect = true
  }

  // If user asks offer metrics, prioritize metrics response before generic campaigns block.
  if (dashboardContext && typeof dashboardContext.total === 'number' && dashboardContext.total >= 0 && wantsOfferTargetMetrics(message)) {
    const metrics = getOfferMetricsFromContext(message, dashboardContext)
    if (metrics) {
      const fr =
        `Indicateurs pour l'offre "${metrics.title}":\n` +
        `- Postulants: ${metrics.total}\n` +
        `- Sélection entretien: ${metrics.selectedForInterview}\n` +
        `- Retenus (décision): ${metrics.retained}\n` +
        `- Taux sélection entretien: ${metrics.interviewRate}%\n` +
        `- Taux retenus: ${metrics.retainedRate}%`
      const en =
        `Metrics for offer "${metrics.title}":\n` +
        `- Applicants: ${metrics.total}\n` +
        `- Interview selected: ${metrics.selectedForInterview}\n` +
        `- Retained (decision): ${metrics.retained}\n` +
        `- Interview selection rate: ${metrics.interviewRate}%\n` +
        `- Retained rate: ${metrics.retainedRate}%`
      const darija =
        `Indicateurs dyal l'offre "${metrics.title}":\n` +
        `- Postulants: ${metrics.total}\n` +
        `- Selection entretien: ${metrics.selectedForInterview}\n` +
        `- Retenus (decision): ${metrics.retained}\n` +
        `- Taux selection entretien: ${metrics.interviewRate}%\n` +
        `- Taux retenus: ${metrics.retainedRate}%`
      return { answer: ({ fr, en, darija }[lang] || fr), language: lang, forceDirect: true }
    }
  }

  // For explicit campaigns/offers questions, return only offers/campaigns response
  // (no generic knowledge text and no dashboard summary suffix).
  if (isCampaignOfferQuery) {
    if (dynamicBlocks.length > 0) return { answer, language: lang, forceDirect: true }
    const noData = {
      fr: 'Aucune campagne/offre disponible pour le moment dans le contexte plateforme.',
      en: 'No campaign/offer is currently available in platform context.',
      darija: 'Ma kaynach campagne/offre daba f contexte dyal plateforme.',
    }
    return { answer: (noData[lang] || noData.fr), language: lang, forceDirect: true }
  }

  // If user is connected and we have dashboard stats, append a short summary
  if (dashboardContext && typeof dashboardContext.total === 'number' && dashboardContext.total >= 0) {
    if (wantsCandidatesWithAtLeastOneInterview(message) && Array.isArray(dashboardContext.items) && Array.isArray(dashboardContext.interviews)) {
      const ids = new Set(
        dashboardContext.interviews
          .map((i) => Number(i?.candidatureId))
          .filter((id) => Number.isFinite(id))
      )
      const filtered = dashboardContext.items.filter((c) => ids.has(Number(c?.id)))
      const lines = filtered.slice(0, 40).map((c, i) => {
        const date = c.date ? new Date(c.date).toISOString().slice(0, 10) : 'N/A'
        return `${i + 1}. ${c.candidateName || 'Candidat'} — ${c.subject || 'Sans objet'} — Décision: ${c.decision || '—'} — Date: ${date}`
      })
      const fr = `Candidatures ayant passe au moins un entretien: ${filtered.length}${lines.length ? `\n\n${lines.join('\n')}` : '\n\nAucun resultat.'}`
      const en = `Applications with at least one interview: ${filtered.length}${lines.length ? `\n\n${lines.join('\n')}` : '\n\nNo results.'}`
      const darija = `Candidatures li dwzo au moins un entretien: ${filtered.length}${lines.length ? `\n\n${lines.join('\n')}` : '\n\nMa kayn hta resultat.'}`
      return { answer: ({ fr, en, darija }[lang] || fr), language: lang, forceDirect: true }
    }

    if (Array.isArray(dashboardContext.items) && dashboardContext.items.length > 0) {
      const decisionFilter = getDecisionFilterFromMessage(message)
      if (decisionFilter) {
        const filtered = dashboardContext.items.filter((c) => {
          const d = normLoose(c?.decision || '')
          if (decisionFilter === 'A_REVOIR') return d.includes('revoir') || d.includes('to review')
          if (decisionFilter === 'NON_LISIBLE') return d.includes('non lisible') || d.includes('unreadable')
          if (decisionFilter === 'ACCEPTEE') return d.includes('accep') || d.includes('accept')
          if (decisionFilter === 'REFUSEE') return d.includes('refus') || d.includes('reject')
          return false
        })
        const lines = filtered.slice(0, 30).map((c, i) => {
          const date = c.date ? new Date(c.date).toISOString().slice(0, 10) : 'N/A'
          return `${i + 1}. ${c.candidateName || 'Candidat'} — ${c.email || 'email inconnu'} — "${c.subject || 'Sans objet'}" — Décision: ${c.decision || '—'} — Date: ${date}`
        })
        const label = decisionFilter === 'ACCEPTEE' ? 'ACCEPTEE' : decisionFilter === 'REFUSEE' ? 'REFUSEE' : decisionFilter === 'NON_LISIBLE' ? 'NON_LISIBLE' : 'A_REVOIR'
        const fr = `Candidatures filtrées par décision (${label}) : ${filtered.length}${lines.length ? `\n\n${lines.join('\n')}` : '\n\nAucun résultat.'}`
        const en = `Applications filtered by decision (${label}): ${filtered.length}${lines.length ? `\n\n${lines.join('\n')}` : '\n\nNo results.'}`
        const darija = `Candidatures mfiltrin b décision (${label}): ${filtered.length}${lines.length ? `\n\n${lines.join('\n')}` : '\n\nMa kayn hta resultat.'}`
        return { answer: ({ fr, en, darija }[lang] || fr), language: lang, forceDirect: true }
      }
    }

    if (wantsOfferLinkedCandidaturesCount(message) && Array.isArray(dashboardContext.items) && dashboardContext.items.length > 0) {
      const counted = countCandidaturesForOfferFromMessage(message, dashboardContext.items)
      if (counted && counted.query) {
        const sample = counted.samples.map((c, i) => `${i + 1}. ${c.candidateName || 'Candidat'} — ${c.offerTitle || c.subject || 'Sans objet'}`).join('\n')
        const fr = `Nombre de candidatures liées à l'offre "${counted.query}": ${counted.count}${sample ? `\n\nExemples:\n${sample}` : ''}`
        const en = `Number of applications linked to offer "${counted.query}": ${counted.count}${sample ? `\n\nExamples:\n${sample}` : ''}`
        const darija = `3adad l-candidatures li mrboutin b l-offre "${counted.query}": ${counted.count}${sample ? `\n\nExemples:\n${sample}` : ''}`
        return { answer: ({ fr, en, darija }[lang] || fr), language: lang, forceDirect: true }
      }
    }

    const total = dashboardContext.total
    const accepted = dashboardContext.accepted ?? 0
    const refused = dashboardContext.refused ?? 0
    const toReview = dashboardContext.toReview ?? 0
    const nonLisible = dashboardContext.nonLisible ?? 0
    const interviewCount = (dashboardContext.interviews && dashboardContext.interviews.length) || 0
    if (!isCampaignOfferQuery && !candidateFocused && !offerTargetListQuery) {
    const summaryFr = `\n\n--- Résumé de votre tableau de bord ---\nTotal : ${total} candidature(s). Acceptées : ${accepted}, Refusées : ${refused}, À revoir : ${toReview}, Non lisibles : ${nonLisible}.${interviewCount > 0 ? ` Entretiens enregistrés : ${interviewCount}.` : ''}`
    const summaryEn = `\n\n--- Your dashboard summary ---\nTotal: ${total} application(s). Accepted: ${accepted}, Refused: ${refused}, To review: ${toReview}, Unreadable: ${nonLisible}.${interviewCount > 0 ? ` Recorded interviews: ${interviewCount}.` : ''}`
    const summaryDarija = `\n\n--- Résumé dyal l-dashboard dyalek ---\nTotal: ${total} candidature(s). Acceptées: ${accepted}, Refusées: ${refused}, À revoir: ${toReview}, Non lisibles: ${nonLisible}.${interviewCount > 0 ? ` Entretiens mregistrin: ${interviewCount}.` : ''}`
    const summaries = { fr: summaryFr, en: summaryEn, darija: summaryDarija }
    answer += summaries[lang] || summaryFr
    }

    // If user asks a specific candidature by candidate name, answer directly from context.
    const wantsCandidateCardField =
      wantsCandidateDecision(message) ||
      wantsCandidateNameField(message) ||
      wantsCandidateEmailField(message) ||
      wantsCandidatePhoneField(message) ||
      wantsCandidateSubjectField(message) ||
      wantsCandidateDateField(message) ||
      wantsCandidateSchoolField(message) ||
      wantsCandidateLastEmployerField(message) ||
      wantsCandidateOfferTitleField(message) ||
      wantsCandidateBusinessUnit(message) ||
      wantsCandidateReceptionDate(message) ||
      wantsCandidateSummary(message) ||
      wantsCandidateOfferContext(message) ||
      wantsCandidateSkillsField(message) ||
      wantsCandidateExperienceField(message) ||
      wantsCandidateExperienceCount(message) ||
      wantsCandidateExperienceDuration(message) ||
      wantsCandidateTimeToHire(message) ||
      wantsCandidateRdv(message) ||
      wantsCandidateInterviewValidity(message) ||
      wantsHrSectionsCandidateSearch(message)

    const candidateLookupOk = hasCandidateLookupIntent(message) || (resolvedCandidate && isBareCandidateNameQuery(message, resolvedCandidate))
    if ((wantsSpecificCandidateResult(message) || wantsCandidateCardField || (resolvedCandidate && isBareCandidateNameQuery(message, resolvedCandidate))) && candidateLookupOk && mergedItems.length > 0) {
      const hit = findBestCandidateByName(message, mergedItems) || resolvedCandidate
      if (hit) {
        const date = hit.date ? new Date(hit.date).toISOString().slice(0, 10) : 'N/A'
        const tth = buildCandidateTimeToHireLine(hit, dashboardContext.interviews || [])
        const fr = `Résultat candidature: ${hit.candidateName || 'Candidat'}\nEmail: ${hit.email || '—'}\nObjet: ${hit.subject || 'Sans objet'}\nDécision: ${hit.decision || 'À REVOIR'}\nScore: ${hit.score != null ? hit.score + '%' : '—'}\nDate: ${date}${tth ? `\nDURÉE Time to hire: ${tth}` : ''}${hit.school ? `\nÉcole: ${hit.school}${hit.schoolType ? ` (${hit.schoolType})` : ''}` : ''}${hit.phone ? `\nTél: ${hit.phone}` : ''}${hit.lastEmployer ? `\nDernier employeur: ${hit.lastEmployer}` : ''}`
        const en = `Application result: ${hit.candidateName || 'Candidate'}\nEmail: ${hit.email || '—'}\nSubject: ${hit.subject || 'No subject'}\nDecision: ${hit.decision || 'TO REVIEW'}\nScore: ${hit.score != null ? hit.score + '%' : '—'}\nDate: ${date}`
        const darija = `Resultat candidature: ${hit.candidateName || 'Candidat'}\nEmail: ${hit.email || '—'}\nObjet: ${hit.subject || 'bla objet'}\nDecision: ${hit.decision || 'A REVOIR'}\nScore: ${hit.score != null ? hit.score + '%' : '—'}\nDate: ${date}${tth ? `\nDuree Time to hire: ${tth}` : ''}${hit.school ? `\nEcole: ${hit.school}${hit.schoolType ? ` (${hit.schoolType})` : ''}` : ''}${hit.phone ? `\nTel: ${hit.phone}` : ''}${hit.lastEmployer ? `\nDernier employeur: ${hit.lastEmployer}` : ''}`
        if (wantsCandidateDecision(message)) {
          const frDecision = `STATUT Décision pour ${hit.candidateName || 'ce candidat'}: ${hit.decision || 'À REVOIR'}`
          const enDecision = `Decision status for ${hit.candidateName || 'this candidate'}: ${hit.decision || 'TO REVIEW'}`
          const dzDecision = `Statut decision dyal ${hit.candidateName || 'had candidat'}: ${hit.decision || 'A REVOIR'}`
          answer = ({ fr: frDecision, en: enDecision, darija: dzDecision }[lang] || frDecision)
          forceDirect = true
          return { answer, language: lang, forceDirect }
        }
        if (wantsCandidateNameField(message)) {
          const value = hit.candidateName || '—'
          const frName = `Nom pour cette candidature: ${value}`
          const enName = `Candidate name: ${value}`
          const dzName = `Smia dyal had candidature: ${value}`
          answer = ({ fr: frName, en: enName, darija: dzName }[lang] || frName)
          forceDirect = true
          return { answer, language: lang, forceDirect }
        }
        if (wantsCandidateEmailField(message)) {
          const value = hit.email || '—'
          const frEmail = `Email pour ${hit.candidateName || 'ce candidat'}: ${value}`
          const enEmail = `Email for ${hit.candidateName || 'this candidate'}: ${value}`
          const dzEmail = `Email dyal ${hit.candidateName || 'had candidat'}: ${value}`
          answer = ({ fr: frEmail, en: enEmail, darija: dzEmail }[lang] || frEmail)
          forceDirect = true
          return { answer, language: lang, forceDirect }
        }
        if (wantsCandidatePhoneField(message)) {
          const value = hit.phone || '—'
          const frPhone = `Numéro de téléphone pour ${hit.candidateName || 'ce candidat'}: ${value}`
          const enPhone = `Phone number for ${hit.candidateName || 'this candidate'}: ${value}`
          const dzPhone = `Numéro téléphone dyal ${hit.candidateName || 'had candidat'}: ${value}`
          answer = ({ fr: frPhone, en: enPhone, darija: dzPhone }[lang] || frPhone)
          forceDirect = true
          return { answer, language: lang, forceDirect }
        }
        if (wantsCandidateSubjectField(message)) {
          const value = hit.subject || '—'
          const frSubject = `Objet pour ${hit.candidateName || 'ce candidat'}: ${value}`
          const enSubject = `Subject for ${hit.candidateName || 'this candidate'}: ${value}`
          const dzSubject = `Objet dyal ${hit.candidateName || 'had candidat'}: ${value}`
          answer = ({ fr: frSubject, en: enSubject, darija: dzSubject }[lang] || frSubject)
          forceDirect = true
          return { answer, language: lang, forceDirect }
        }
        if (wantsCandidateDateField(message)) {
          const value = hit.date ? new Date(hit.date).toISOString().slice(0, 10) : '—'
          const frDateAny = `Date pour ${hit.candidateName || 'ce candidat'}: ${value}`
          const enDateAny = `Date for ${hit.candidateName || 'this candidate'}: ${value}`
          const dzDateAny = `Date dyal ${hit.candidateName || 'had candidat'}: ${value}`
          answer = ({ fr: frDateAny, en: enDateAny, darija: dzDateAny }[lang] || frDateAny)
          forceDirect = true
          return { answer, language: lang, forceDirect }
        }
        if (wantsCandidateSchoolField(message)) {
          const value = [hit.school || '', hit.schoolType ? `(${hit.schoolType})` : ''].join(' ').trim() || '—'
          const frSchool = `École pour ${hit.candidateName || 'ce candidat'}: ${value}`
          const enSchool = `School for ${hit.candidateName || 'this candidate'}: ${value}`
          const dzSchool = `Ecole dyal ${hit.candidateName || 'had candidat'}: ${value}`
          answer = ({ fr: frSchool, en: enSchool, darija: dzSchool }[lang] || frSchool)
          forceDirect = true
          return { answer, language: lang, forceDirect }
        }
        if (wantsCandidateLastEmployerField(message)) {
          const value = hit.lastEmployer || '—'
          const frEmp = `Dernier employeur pour ${hit.candidateName || 'ce candidat'}: ${value}`
          const enEmp = `Last employer for ${hit.candidateName || 'this candidate'}: ${value}`
          const dzEmp = `Dernier employeur dyal ${hit.candidateName || 'had candidat'}: ${value}`
          answer = ({ fr: frEmp, en: enEmp, darija: dzEmp }[lang] || frEmp)
          forceDirect = true
          return { answer, language: lang, forceDirect }
        }
        if (wantsCandidateOfferTitleField(message)) {
          const value = hit.offerTitle || hit.subject || '—'
          const frOffer = `Offre cible pour ${hit.candidateName || 'ce candidat'}: ${value}`
          const enOffer = `Target offer for ${hit.candidateName || 'this candidate'}: ${value}`
          const dzOffer = `Offre cible dyal ${hit.candidateName || 'had candidat'}: ${value}`
          answer = ({ fr: frOffer, en: enOffer, darija: dzOffer }[lang] || frOffer)
          forceDirect = true
          return { answer, language: lang, forceDirect }
        }
        if (wantsCandidateBusinessUnit(message)) {
          const bu = hit.businessUnit || '—'
          const frBu = `BU pour ${hit.candidateName || 'ce candidat'}: ${bu}`
          const enBu = `Business Unit for ${hit.candidateName || 'this candidate'}: ${bu}`
          const dzBu = `BU dyal ${hit.candidateName || 'had candidat'}: ${bu}`
          answer = ({ fr: frBu, en: enBu, darija: dzBu }[lang] || frBu)
          forceDirect = true
          return { answer, language: lang, forceDirect }
        }
        if (wantsCandidateReceptionDate(message)) {
          const d = hit.date ? new Date(hit.date).toISOString().slice(0, 10) : '—'
          const frDate = `RÉCEPTION Date pour ${hit.candidateName || 'ce candidat'}: ${d}`
          const enDate = `Reception date for ${hit.candidateName || 'this candidate'}: ${d}`
          const dzDate = `Date de réception dyal ${hit.candidateName || 'had candidat'}: ${d}`
          answer = ({ fr: frDate, en: enDate, darija: dzDate }[lang] || frDate)
          forceDirect = true
          return { answer, language: lang, forceDirect }
        }
        if (wantsCandidateSummary(message)) {
          const s = String(hit.rawSummary || '').trim()
          const summary = s || 'Résumé indisponible pour cette candidature.'
          const frSummary = `SYNTHÈSE Résumé de ${hit.candidateName || 'ce candidat'}:\n${summary}`
          const enSummary = `Summary for ${hit.candidateName || 'this candidate'}:\n${summary}`
          const dzSummary = `Synthèse dyal ${hit.candidateName || 'had candidat'}:\n${summary}`
          answer = ({ fr: frSummary, en: enSummary, darija: dzSummary }[lang] || frSummary)
          forceDirect = true
          return { answer, language: lang, forceDirect }
        }
        if (/\bscore\b|\bnote\b/.test(normLoose(message)) && !wantsCandidateSummary(message)) {
          const value = hit.score != null ? `${hit.score}%` : '—'
          const frScore = `Score pour ${hit.candidateName || 'ce candidat'}: ${value}`
          const enScore = `Score for ${hit.candidateName || 'this candidate'}: ${value}`
          const dzScore = `Score dyal ${hit.candidateName || 'had candidat'}: ${value}`
          answer = ({ fr: frScore, en: enScore, darija: dzScore }[lang] || frScore)
          forceDirect = true
          return { answer, language: lang, forceDirect }
        }
        if (wantsCandidateOfferContext(message)) {
          const ctx = String(hit.offerDescription || '').trim() || 'Contexte offre indisponible.'
          const frCtx = `Contexte offre pour ${hit.candidateName || 'ce candidat'}:\n${ctx}`
          const enCtx = `Offer context for ${hit.candidateName || 'this candidate'}:\n${ctx}`
          const dzCtx = `Contexte offre dyal ${hit.candidateName || 'had candidat'}:\n${ctx}`
          answer = ({ fr: frCtx, en: enCtx, darija: dzCtx }[lang] || frCtx)
          forceDirect = true
          return { answer, language: lang, forceDirect }
        }
        if (wantsCandidateSkillsField(message)) {
          const value = String(hit.skills || '').trim() || 'Compétences non renseignées pour cette candidature.'
          const frSkills = `Compétences de ${hit.candidateName || 'ce candidat'}:\n${value}`
          const enSkills = `Skills for ${hit.candidateName || 'this candidate'}:\n${value}`
          const dzSkills = `Compétences dyal ${hit.candidateName || 'had candidat'}:\n${value}`
          answer = ({ fr: frSkills, en: enSkills, darija: dzSkills }[lang] || frSkills)
          forceDirect = true
          return { answer, language: lang, forceDirect }
        }
        if (wantsCandidateExperienceField(message)) {
          const value = String(hit.experience || '').trim() || 'Expérience non renseignée pour cette candidature.'
          const frExp = `Expérience de ${hit.candidateName || 'ce candidat'}:\n${value}`
          const enExp = `Experience for ${hit.candidateName || 'this candidate'}:\n${value}`
          const dzExp = `Expérience dyal ${hit.candidateName || 'had candidat'}:\n${value}`
          answer = ({ fr: frExp, en: enExp, darija: dzExp }[lang] || frExp)
          forceDirect = true
          return { answer, language: lang, forceDirect }
        }
        if (wantsCandidateExperienceCount(message)) {
          const count = hit.experienceCount != null ? hit.experienceCount : '—'
          const frCount = `Nombre d’expérience pour ${hit.candidateName || 'ce candidat'}: ${count}`
          const enCount = `Experience count for ${hit.candidateName || 'this candidate'}: ${count}`
          const dzCount = `Nombre d'expérience dyal ${hit.candidateName || 'had candidat'}: ${count}`
          answer = ({ fr: frCount, en: enCount, darija: dzCount }[lang] || frCount)
          forceDirect = true
          return { answer, language: lang, forceDirect }
        }
        if (wantsCandidateExperienceDuration(message)) {
          const duration = String(hit.experienceDuration || '').trim() || '—'
          const frDuration = `Durée d’expérience pour ${hit.candidateName || 'ce candidat'}: ${duration}`
          const enDuration = `Experience duration for ${hit.candidateName || 'this candidate'}: ${duration}`
          const dzDuration = `Durée d'expérience dyal ${hit.candidateName || 'had candidat'}: ${duration}`
          answer = ({ fr: frDuration, en: enDuration, darija: dzDuration }[lang] || frDuration)
          forceDirect = true
          return { answer, language: lang, forceDirect }
        }
        if (wantsCandidateTimeToHire(message)) {
          const value = tth || 'non disponible (aucun entretien planifie pour cette candidature)'
          const frTth = `DURÉE Time to hire pour ${hit.candidateName || 'ce candidat'}: ${value}`
          const enTth = `Time to hire for ${hit.candidateName || 'this candidate'}: ${value}`
          const dzTth = `Duree Time to hire dyal ${hit.candidateName || 'had candidat'}: ${value}`
          answer = ({ fr: frTth, en: enTth, darija: dzTth }[lang] || frTth)
          forceDirect = true
          return { answer, language: lang, forceDirect }
        }
        if (wantsCandidateRdv(message)) {
          const rhOnly = wantsRhInterviewScope(message)
          const typeScope = parseInterviewTypeScope(message)
          const wantsValidated = wantsValidatedInterviews(message)
          const wantsPending = wantsPendingInterviews(message)
          const rdv = buildCandidateRdvLines(hit, dashboardContext.interviews || [], {
            rhOnly,
            typeScope,
            validatedOnly: wantsValidated && !wantsPending,
            pendingOnly: wantsPending && !wantsValidated,
          })
          if (rdv.length && (wantsValidated || wantsPending)) {
            const validatedRows = rdv.filter((r) => /\bvalide|valid[eé]|realise|realisee|termine|done|completed|effectue\b/i.test(String(r.status || '')))
            const pendingRows = rdv.filter((r) => !/\bvalide|valid[eé]|realise|realisee|termine|done|completed|effectue\b/i.test(String(r.status || '')))
            const render = (rows) => rows.map((r, idx) => `${idx + 1}. ${r.date} — ${r.mode} — ${r.status} — ${r.location}`).join('\n')
            const parts = []
            if (wantsValidated) parts.push(`Entretiens validés/réalisés:\n${validatedRows.length ? render(validatedRows) : 'Aucun.'}`)
            if (wantsPending) parts.push(`Entretiens pas encore validés:\n${pendingRows.length ? render(pendingRows) : 'Aucun.'}`)
            const frMix = `RDV pour ${hit.candidateName || 'ce candidat'}:\n${parts.join('\n\n')}`
            const enMix = `Interviews for ${hit.candidateName || 'this candidate'}:\n${parts.join('\n\n')}`
            const dzMix = `RDV dyal ${hit.candidateName || 'had candidat'}:\n${parts.join('\n\n')}`
            answer = ({ fr: frMix, en: enMix, darija: dzMix }[lang] || frMix)
            forceDirect = true
            return { answer, language: lang, forceDirect }
          }
          if (!rdv.length) {
            const byName = findInterviewsByCandidateName(message, dashboardContext.interviews || [])
            const byNameFiltered = byName.filter((i) => {
              if (!interviewMatchesType(i, typeScope)) return false
              if (!rhOnly) return true
              const notes = normLoose(i?.notesRh || '')
              const mode = normLoose(i?.mode || '')
              const status = normLoose(i?.status || '')
              return /\brh\b|human resources|entretien rh/.test(notes) || /\brh\b/.test(mode) || /\brh\b/.test(status)
            })
            if (byNameFiltered.length) {
              const lines = byNameFiltered.slice(0, 20).map((i, idx) => {
                const date = i?.scheduledAt ? new Date(i.scheduledAt).toISOString().replace('T', ' ').slice(0, 16) : 'date non definie'
                return `${idx + 1}. ${date} — ${i?.mode || '—'} — ${i?.status || '—'} — ${i?.location || '—'}`
              })
              const frByName = `RDV pour ${hit.candidateName || 'ce candidat'}:\n${lines.join('\n')}`
              const enByName = `Interviews for ${hit.candidateName || 'this candidate'}:\n${lines.join('\n')}`
              const dzByName = `RDV dyal ${hit.candidateName || 'had candidat'}:\n${lines.join('\n')}`
              answer = ({ fr: frByName, en: enByName, darija: dzByName }[lang] || frByName)
              forceDirect = true
              return { answer, language: lang, forceDirect }
            }
            const frNo = `RDV pour ${hit.candidateName || 'ce candidat'}: aucun entretien planifie pour le moment.`
            const enNo = `Interview for ${hit.candidateName || 'this candidate'}: no scheduled interview yet.`
            const dzNo = `RDV dyal ${hit.candidateName || 'had candidat'}: mazal ma kayn hta entretien planifie.`
            answer = ({ fr: frNo, en: enNo, darija: dzNo }[lang] || frNo)
            forceDirect = true
            return { answer, language: lang, forceDirect }
          }
          const lines = rdv.map((r, idx) => `${idx + 1}. ${r.date} — ${r.mode} — ${r.status} — ${r.location}`)
          const frRdv = `RDV pour ${hit.candidateName || 'ce candidat'}:\n${lines.join('\n')}`
          const enRdv = `Interviews for ${hit.candidateName || 'this candidate'}:\n${lines.join('\n')}`
          const dzRdv = `RDV dyal ${hit.candidateName || 'had candidat'}:\n${lines.join('\n')}`
          answer = ({ fr: frRdv, en: enRdv, darija: dzRdv }[lang] || frRdv)
          forceDirect = true
          return { answer, language: lang, forceDirect }
        }
        if (wantsCandidateInterviewValidity(message)) {
          const v = getCandidateRhInterviewValidity(hit, dashboardContext.interviews || [])
          let fr
          let en
          let darija
          if (!v.hasRh) {
            fr = `Entretien RH pour ${hit.candidateName || 'ce candidat'}: pas encore (aucun entretien RH trouve).`
            en = `HR interview for ${hit.candidateName || 'this candidate'}: not yet (no HR interview found).`
            darija = `Entretien RH dyal ${hit.candidateName || 'had candidat'}: mazal (ma kayn hta entretien RH).`
          } else if (v.validated) {
            const last = v.statuses.length ? ` Statut: ${v.statuses[v.statuses.length - 1]}.` : ''
            fr = `Entretien RH pour ${hit.candidateName || 'ce candidat'}: valide.${last}`
            en = `HR interview for ${hit.candidateName || 'this candidate'}: validated.${last}`
            darija = `Entretien RH dyal ${hit.candidateName || 'had candidat'}: valide.${last}`
          } else {
            const statuses = v.statuses.length ? ` Statut actuel: ${v.statuses.join(' | ')}.` : ''
            fr = `Entretien RH pour ${hit.candidateName || 'ce candidat'}: pas encore valide.${statuses}`
            en = `HR interview for ${hit.candidateName || 'this candidate'}: not validated yet.${statuses}`
            darija = `Entretien RH dyal ${hit.candidateName || 'had candidat'}: mazal ma validadch.${statuses}`
          }
          answer = ({ fr, en, darija }[lang] || fr)
          forceDirect = true
          return { answer, language: lang, forceDirect }
        }
        if (wantsHrSectionsCandidateSearch(message)) {
          const tth = buildCandidateTimeToHireLine(hit, dashboardContext.interviews || [])
          const rdv = buildCandidateRdvLines(hit, dashboardContext.interviews || [])
          const rdvLines = rdv.length
            ? rdv.map((r, idx) => `${idx + 1}. ${r.date} — ${r.mode} — ${r.status} — ${r.location}`).join('\n')
            : 'Aucun entretien planifie.'
          const fr = `Recherche RH pour ${hit.candidateName || 'ce candidat'}\n\n--- Suivi RH - Time to interview ---\n${tth ? `Duree: ${tth}` : 'Duree: non disponible'}\n\n--- Reception candidature - entretiens ---\n${rdvLines}`
          const en = `HR search for ${hit.candidateName || 'this candidate'}\n\n--- HR tracking - Time to interview ---\n${tth ? `Duration: ${tth}` : 'Duration: not available'}\n\n--- Candidature reception - interviews ---\n${rdvLines}`
          const darija = `Recherche RH dyal ${hit.candidateName || 'had candidat'}\n\n--- Suivi RH - Time to interview ---\n${tth ? `Duree: ${tth}` : 'Duree: ma kaynach'}\n\n--- Reception candidature - entretiens ---\n${rdvLines}`
          answer = ({ fr, en, darija }[lang] || fr)
          forceDirect = true
          return { answer, language: lang, forceDirect }
        }
        answer = ({ fr, en, darija }[lang] || fr)
        forceDirect = true
        return { answer, language: lang, forceDirect }
      } else if (candidateLookupOk && (wantsCandidateDecision(message) || wantsCandidateNameField(message) || wantsCandidateEmailField(message) || wantsCandidatePhoneField(message) || wantsCandidateSubjectField(message) || wantsCandidateDateField(message) || wantsCandidateSchoolField(message) || wantsCandidateLastEmployerField(message) || wantsCandidateOfferTitleField(message) || wantsCandidateBusinessUnit(message) || wantsCandidateReceptionDate(message) || wantsCandidateSummary(message) || wantsCandidateOfferContext(message) || wantsCandidateSkillsField(message) || wantsCandidateExperienceField(message) || wantsCandidateExperienceCount(message) || wantsCandidateExperienceDuration(message) || wantsCandidateTimeToHire(message) || wantsCandidateRdv(message) || wantsCandidateInterviewValidity(message) || wantsHrSectionsCandidateSearch(message) || wantsSpecificCandidateResult(message))) {
        const suggestions = findClosestCandidateNames(message, mergedItems)
        if (suggestions.length) {
          const fr = `Ma lqit-ch candidate exact b had smiya f context. Peut-etre qsedti: ${suggestions.join(', ')}`
          const en = `I could not find an exact candidate with that name. Maybe you meant: ${suggestions.join(', ')}`
          const darija = `Ma lqit-ch smiya exact. Ymken qsedti: ${suggestions.join(', ')}`
          answer = ({ fr, en, darija }[lang] || fr)
          forceDirect = true
        }
      }
    }

    if (hasCandidateLookupIntent(message) && wantsCandidateRdv(message) && Array.isArray(dashboardContext.interviews) && dashboardContext.interviews.length > 0) {
      const ivHits = findInterviewsByCandidateName(message, dashboardContext.interviews)
      if (ivHits.length) {
        const lines = ivHits.slice(0, 20).map((i, idx) => {
          const date = i?.scheduledAt ? new Date(i.scheduledAt).toISOString().replace('T', ' ').slice(0, 16) : 'date non definie'
          return `${idx + 1}. ${date} — ${i?.mode || '—'} — ${i?.status || '—'} — ${i?.location || '—'}`
        })
        const who = ivHits[0]?.candidateName || 'ce candidat'
        const fr = `RDV pour ${who}:\n${lines.join('\n')}`
        const en = `Interviews for ${who}:\n${lines.join('\n')}`
        const darija = `RDV dyal ${who}:\n${lines.join('\n')}`
        return { answer: ({ fr, en, darija }[lang] || fr), language: lang, forceDirect: true }
      }
    }

    // Optionnel : liste détaillée des dernières candidatures (avec école, téléphone, dernier employeur si dispo)
    if (wantsDetailedList(message) && Array.isArray(dashboardContext.items) && dashboardContext.items.length > 0) {
      const items = dashboardContext.items
      const extra = (c) => {
        const parts = []
        if (c.school) parts.push(`École: ${c.school}${c.schoolType ? ' (' + c.schoolType + ')' : ''}`)
        if (c.phone) parts.push(`Tél: ${c.phone}`)
        if (c.lastEmployer) parts.push(`Dernier employeur: ${c.lastEmployer}`)
        if (c.score != null) parts.push(`Score: ${c.score}`)
        return parts.length ? ' — ' + parts.join(', ') : ''
      }
      const linesFr = items.map((c, idx) => {
        const date = c.date ? new Date(c.date).toISOString().slice(0, 10) : 'N/A'
        return `- ${idx + 1}. ${c.candidateName || 'Candidat'} — ${c.email || 'email inconnu'} — \"${c.subject || 'Sans objet'}\" — Décision : ${c.decision || 'À REVOIR'} — Date : ${date}${extra(c)}`
      })
      const linesEn = items.map((c, idx) => {
        const date = c.date ? new Date(c.date).toISOString().slice(0, 10) : 'N/A'
        return `- ${idx + 1}. ${c.candidateName || 'Candidate'} — ${c.email || 'unknown email'} — \"${c.subject || 'No subject'}\" — Decision: ${c.decision || 'TO REVIEW'} — Date: ${date}${extra(c)}`
      })
      const linesDarija = items.map((c, idx) => {
        const date = c.date ? new Date(c.date).toISOString().slice(0, 10) : 'N/A'
        return `- ${idx + 1}. ${c.candidateName || 'Candidat'} — ${c.email || 'email ma3rouf-ch'} — \"${c.subject || 'bla objet'}\" — Décision: ${c.decision || 'À REVOIR'} — Date: ${date}${extra(c)}`
      })

      const blockFr = `\n\nDétail des dernières candidatures :\n${linesFr.join('\n')}`
      const blockEn = `\n\nDetails of your latest applications:\n${linesEn.join('\n')}`
      const blockDarija = `\n\nDétail dyal a5er candidatures:\n${linesDarija.join('\n')}`

      const detailBlocks = { fr: blockFr, en: blockEn, darija: blockDarija }
      answer += detailBlocks[lang] || blockFr
    }

    if (wantsDateFilteredCandidatures(message) && Array.isArray(dashboardContext.items) && dashboardContext.items.length > 0) {
      const target = parseTargetDayFromMessage(message, new Date())
      if (target && target.isoDay) {
        const filtered = dashboardContext.items
          .filter((c) => asIsoDay(c.date) === target.isoDay)
          .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
        const lines = filtered.map((c, idx) => {
          const extra = []
          if (c.school) extra.push(`École: ${c.school}${c.schoolType ? ' (' + c.schoolType + ')' : ''}`)
          if (c.phone) extra.push(`Tél: ${c.phone}`)
          if (c.lastEmployer) extra.push(`Dernier employeur: ${c.lastEmployer}`)
          if (c.score != null) extra.push(`Score: ${c.score}`)
          const suffix = extra.length ? ` — ${extra.join(', ')}` : ''
          return `${idx + 1}. ${c.candidateName || 'Candidat'} — ${c.email || 'email inconnu'} — "${c.subject || 'Sans objet'}" — Décision: ${c.decision || 'À REVOIR'}${suffix}`
        })
        const noData = {
          fr: `Je n'ai trouvé aucune candidature ajoutée le ${target.label} (${target.isoDay}).`,
          en: `I found no applications added on ${target.label} (${target.isoDay}).`,
          darija: `Malqitch 7ta candidature tzadet nhar ${target.label} (${target.isoDay}).`,
        }
        const intro = {
          fr: `Candidatures ajoutées le ${target.label} (${target.isoDay}) : ${filtered.length}`,
          en: `Applications added on ${target.label} (${target.isoDay}): ${filtered.length}`,
          darija: `Candidatures li tzadou nhar ${target.label} (${target.isoDay}): ${filtered.length}`,
        }
        answer = filtered.length
          ? `${intro[lang] || intro.fr}\n\n${lines.join('\n')}`
          : (noData[lang] || noData.fr)
        forceDirect = true
      }
    }
  }

  if (candidateFocused && !String(answer || '').trim()) {
    const notFound = {
      fr: 'Je n\'ai pas trouvé ce candidat dans les candidatures de la plateforme. Vérifiez l\'orthographe du nom.',
      en: 'I could not find this candidate in platform applications. Please check the name spelling.',
      darija: 'Ma lqit-ch had candidat f candidatures dyal plateforme. Verifi smiya.',
    }
    answer = notFound[lang] || notFound.fr
    forceDirect = true
  }

  // Utilisateur non connecté qui pose une question sur un sujet réservé → pas de détail, inviter à se connecter
  if (context && context.authenticated !== true && wantsRestrictedTopic(trimmed)) {
    const restrictedMsg = {
      fr: 'Cette information est réservée aux utilisateurs connectés. Connectez-vous ou créez un compte pour accéder au tableau de bord, aux candidatures et aux statistiques.',
      en: 'This information is for logged-in users only. Log in or create an account to access the dashboard, applications and statistics.',
      darija: 'Had l-ma3louma m7afuza l users li connectin. Qrabt wla 3mel compte bach tdkhoul l-dashboard, l-candidatures w l-statistiques.',
    }
    answer = restrictedMsg[lang] || restrictedMsg.fr
  }

  return { answer, language: lang, forceDirect }
}
