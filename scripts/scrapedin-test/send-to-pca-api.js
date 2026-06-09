/**
 * Envoie le texte profil (output de test-one-profile.js) vers l'API PCA
 * puis déclenche analyse via POST /api/test/analyze
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') })

const fs = require('fs')
const path = require('path')

const API = (process.env.PCA_API_URL || 'http://127.0.0.1:3005').replace(/\/$/, '')
const txtPath = path.join(__dirname, 'output', 'profile-as-cv-text.txt')
const jsonPath = path.join(__dirname, 'output', 'profile.json')

if (!fs.existsSync(txtPath)) {
  console.error('Lance d\'abord: npm run test:one')
  process.exit(1)
}

const cvText = fs.readFileSync(txtPath, 'utf8')
let profile = {}
try {
  profile = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
} catch {
  profile = {}
}

const email =
  profile.email ||
  process.env.TEST_EMAIL ||
  'linkedin-test@pca.local'
const fullName = profile.name || 'Candidat LinkedIn Test'
const location = profile.location || 'Maroc'
const linkedinUrl = process.env.TEST_PROFILE_URL || ''

async function main() {
  const analyzeBody = {
    email,
    fullName,
    candidateName: fullName,
    subject: `Candidature LinkedIn — ${location}`,
    source: 'linkedin',
    text: cvText,
    offerTitle: process.env.TEST_OFFER_TITLE || 'Stage PFE - Test LinkedIn',
    offerDescription: `Profil LinkedIn importé pour test PFE.\nLINKEDIN_URL: ${linkedinUrl}`,
  }

  console.log('POST', `${API}/api/test/analyze`)
  const res = await fetch(`${API}/api/test/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(analyzeBody),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error('Erreur API', res.status, data)
    process.exit(1)
  }

  console.log('Candidature créée + analysée:', {
    id: data.id,
    candidateId: data.candidateId,
    decision: data.decision,
    score: data.score,
  })
  console.log('Voir dashboard PCA / CandidatureDetailPage')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
