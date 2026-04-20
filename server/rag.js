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
  const asksDate = /\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday|aujourd|today|hier|yesterday|lbar7|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/.test(t)
  return asksCandidatures && asksDate
}

function asIsoDay(v) {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
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
  if (/\b(aujourd|today|lyoum|lyoum)\b/.test(t)) {
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
  // Tolérant aux fautes : campagns, trouvees, plateforme/Campagnes, etc.
  return /\bcampagnes|campagne|campagns|campagn|offres|offre|campaigns|offers|donner.*campagn|quelles? campagn|liste.*offres|trouv[eé]es?.*plateforme|plateforme.*campagn|page.*campagnes?|\/campagnes\b/.test(t)
}

// Sujets réservés aux utilisateurs connectés : pas de détail pour les visiteurs non connectés (dashboard, candidatures, campagnes, entretiens, etc.)
function wantsRestrictedTopic(message) {
  const t = (message || '').toLowerCase()
  return /\bdashboard|tableau de bord|statistiques|stats|candidatures|candidature|campagnes|campagne|campagns|offres\b|offre\b|entretiens?|interviews?|confidentialit[eé]|confidentiality|r[eé]sum[eé]|summary|combien|how many|accept[eé]e|refus[eé]e|revoir|non lisible|d[eé]cision|applications|r[eé]sultats|results|d[eé]tail|detailed|mes candidatures|mes applications|donn[eé]es personnelles|données|personal data\b/.test(t)
}

function wantsInterviews(message) {
  const t = (message || '').toLowerCase()
  return /\bentretiens?|interviews?|rendez-vous|planifi[eé]s?|agenda|calendrier|quels? entretiens|liste.*entretiens/.test(t)
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

function buildCampaignsOffersBlock(context, lang) {
  const campaigns = context && Array.isArray(context.campaigns) ? context.campaigns : []
  const offers = context && Array.isArray(context.offers) ? context.offers : []
  if (campaigns.length === 0 && offers.length === 0) return ''
  const linesFr = campaigns.map((c) => `• ${c.name || c.code} (${c.code}) — ${c.results_count != null ? c.results_count + ' offres' : ''}`)
  const linesEn = campaigns.map((c) => `• ${c.name || c.code} (${c.code}) — ${c.results_count != null ? c.results_count + ' offers' : ''}`)
  const linesDarija = campaigns.map((c) => `• ${c.name || c.code} (${c.code}) — ${c.results_count != null ? c.results_count + ' offres' : ''}`)
  const listFr = linesFr.length ? `\n\nCampagnes sur la plateforme :\n${linesFr.join('\n')}` : ''
  const listEn = linesEn.length ? `\n\nCampaigns on the platform:\n${linesEn.join('\n')}` : ''
  const listDarija = linesDarija.length ? `\n\nCampagnes f l-plateforme:\n${linesDarija.join('\n')}` : ''
  let offerSampleFr = ''
  let offerSampleEn = ''
  let offerSampleDarija = ''
  if (offers.length > 0) {
    const sample = offers.slice(0, 8).map((o) => `${o.title || o.reference}${o.company ? ' — ' + o.company : ''} (${o.location || '—'})`)
    offerSampleFr = `\n\nExemples d’offres :\n${sample.map((s) => `• ${s}`).join('\n')}`
    offerSampleEn = `\n\nSample offers:\n${sample.map((s) => `• ${s}`).join('\n')}`
    offerSampleDarija = `\n\nExemples d’offres:\n${sample.map((s) => `• ${s}`).join('\n')}`
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

  // Find best matching chunk
  let best = { index: -1, score: 0 }
  KNOWLEDGE.forEach((chunk, i) => {
    const s = scoreMatch(trimmed, chunk.keywords)
    if (s > best.score) best = { index: i, score: s }
  })

  let answer
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

  // Campagnes / offres : injecter les données réelles si la question le demande et qu’on a des données
  const hasCampaigns = context && Array.isArray(context.campaigns) && context.campaigns.length > 0
  const hasOffers = context && Array.isArray(context.offers) && context.offers.length > 0
  if (wantsCampaignsOrOffers(trimmed) && (hasCampaigns || hasOffers)) {
    const block = buildCampaignsOffersBlock(context, lang)
    if (block) {
      const intro = {
        fr: 'Sur la plateforme PCA vous trouverez les campagnes et offres suivantes (données temps réel) :',
        en: 'On the PCA platform you will find the following campaigns and offers (real-time data):',
        darija: 'F l-plateforme PCA l-campagnes w l-offres li kaynin (données temps réel) :',
      }
      answer = (intro[lang] || intro.fr) + block
    }
  }

  // Entretiens : injecter la liste des entretiens si la question le demande
  const hasInterviews = context && Array.isArray(context.interviews) && context.interviews.length > 0
  if (wantsInterviews(trimmed) && hasInterviews) {
    const block = buildInterviewsBlock(context, lang)
    if (block) {
      const intro = {
        fr: 'Voici les entretiens enregistrés sur la plateforme :',
        en: 'Here are the interviews recorded on the platform:',
        darija: 'Hna l-entretiens li mregistrin f l-plateforme :',
      }
      answer = (intro[lang] || intro.fr) + block
    }
  }

  // If user is connected and we have dashboard stats, append a short summary
  if (dashboardContext && typeof dashboardContext.total === 'number' && dashboardContext.total >= 0) {
    const total = dashboardContext.total
    const accepted = dashboardContext.accepted ?? 0
    const refused = dashboardContext.refused ?? 0
    const toReview = dashboardContext.toReview ?? 0
    const nonLisible = dashboardContext.nonLisible ?? 0
    const interviewCount = (dashboardContext.interviews && dashboardContext.interviews.length) || 0
    const summaryFr = `\n\n--- Résumé de votre tableau de bord ---\nTotal : ${total} candidature(s). Acceptées : ${accepted}, Refusées : ${refused}, À revoir : ${toReview}, Non lisibles : ${nonLisible}.${interviewCount > 0 ? ` Entretiens enregistrés : ${interviewCount}.` : ''}`
    const summaryEn = `\n\n--- Your dashboard summary ---\nTotal: ${total} application(s). Accepted: ${accepted}, Refused: ${refused}, To review: ${toReview}, Unreadable: ${nonLisible}.${interviewCount > 0 ? ` Recorded interviews: ${interviewCount}.` : ''}`
    const summaryDarija = `\n\n--- Résumé dyal l-dashboard dyalek ---\nTotal: ${total} candidature(s). Acceptées: ${accepted}, Refusées: ${refused}, À revoir: ${toReview}, Non lisibles: ${nonLisible}.${interviewCount > 0 ? ` Entretiens mregistrin: ${interviewCount}.` : ''}`
    const summaries = { fr: summaryFr, en: summaryEn, darija: summaryDarija }
    answer += summaries[lang] || summaryFr

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
