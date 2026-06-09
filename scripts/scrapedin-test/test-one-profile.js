/**
 * Test scrapedin — 1 profil LinkedIn
 * Repo: https://github.com/linkedtales/scrapedin
 *
 * ATTENTION:
 * - Projet daté 2020, Puppeteer 1.x → peut casser sur Node 18+
 * - LinkedIn peut bloquer login automatisé (captcha, vérif)
 * - Pas d'extraction du PDF "CV" du profil : seulement données profil (texte)
 * - Usage réservé à tests PFE / compte perso, pas scraping massif Maroc
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') })

const fs = require('fs')
const path = require('path')

const email = process.env.LINKEDIN_EMAIL
const password = process.env.LINKEDIN_PASSWORD
const profileUrl = process.env.TEST_PROFILE_URL

if (!profileUrl) {
  console.error('Définir TEST_PROFILE_URL dans scripts/scrapedin-test/.env')
  process.exit(1)
}

function profileToCvText(profile) {
  const p = profile || {}
  const name = p.name || [p.firstName, p.lastName].filter(Boolean).join(' ')
  const headline = p.headline || p.occupation || ''
  const location = p.location || ''
  const about = p.description || p.summary || ''
  const skills = Array.isArray(p.skills)
    ? p.skills.map((s) => (typeof s === 'string' ? s : s.name)).filter(Boolean).join(', ')
    : ''
  const jobs = Array.isArray(p.jobs)
    ? p.jobs
        .map((j) => {
          const title = j.title || j.position || ''
          const company = j.companyName || j.company || ''
          const dates = [j.dateRange, j.duration].filter(Boolean).join(' ')
          return [title, company, dates].filter(Boolean).join(' — ')
        })
        .filter(Boolean)
        .join('\n')
    : ''

  const parts = [
    name && `Nom: ${name}`,
    headline && `Titre: ${headline}`,
    location && `Localisation: ${location}`,
    about && `À propos:\n${about}`,
    skills && `Compétences: ${skills}`,
    jobs && `Expérience:\n${jobs}`,
  ].filter(Boolean)

  return parts.join('\n\n')
}

async function main() {
  console.log('Node', process.version)
  console.log('Profil:', profileUrl)

  let scrapedin
  try {
    scrapedin = require('scrapedin')
  } catch (e) {
    console.error('Installe d\'abord: cd scripts/scrapedin-test && npm install')
    process.exit(1)
  }

  const opts = { isHeadless: false, hasToLog: true }
  if (email && password) {
    opts.email = email
    opts.password = password
  } else {
    console.warn('Pas de LINKEDIN_EMAIL/PASSWORD → données publiques limitées')
  }

  console.log('Connexion LinkedIn via Puppeteer (peut prendre 30–90 s)...')
  const scrape = await scrapedin(opts)
  const profile = await scrape(profileUrl, 3000)

  const outDir = path.join(__dirname, 'output')
  fs.mkdirSync(outDir, { recursive: true })

  const jsonPath = path.join(outDir, 'profile.json')
  fs.writeFileSync(jsonPath, JSON.stringify(profile, null, 2), 'utf8')

  const cvText = profileToCvText(profile)
  const txtPath = path.join(outDir, 'profile-as-cv-text.txt')
  fs.writeFileSync(txtPath, cvText, 'utf8')

  console.log('\nOK — fichiers générés:')
  console.log(' ', jsonPath)
  console.log(' ', txtPath)
  console.log('\nLongueur texte CV synthétique:', cvText.length, 'car.')
  if (cvText.length < 50) {
    console.warn('Texte trop court pour PCA — login ou profil incomplet')
  }

  console.log('\nProchaine étape: npm run send:pca')
  process.exit(0)
}

main().catch((err) => {
  console.error('\nÉCHEC scrapedin:', err.message)
  console.error('\nCauses fréquentes:')
  console.error('  - Node trop récent + vieux Puppeteer 1.13')
  console.error('  - Captcha / vérif LinkedIn')
  console.error('  - URL profil invalide')
  console.error('  - Compte LinkedIn restreint')
  process.exit(1)
})
