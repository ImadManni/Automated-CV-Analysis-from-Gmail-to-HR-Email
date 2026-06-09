/**
 * Ajoute les contraintes skills / experience / offer_context au nœud « 9 - Assemble LLM payload ».
 * Usage : node scripts/patch-n8n-system-prompt.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const wf = path.join(__dirname, '..', 'n8n-workflow-imap-openai-in-n8n.json')

// Dans le jsCode n8n, les sauts de ligne du prompt LLM sont des \n littéraux (backslash + n).
const INSERT = `\\nContraintes de format :\\n- skills : string uniquement, compétences séparées par des virgules. Jamais tableau JSON ni accolades type liste.\\n- experience : string uniquement, paragraphe ou blocs séparés par des retours à la ligne, lisible pour un RH. Jamais JSON imbriqué dans ce champ.\\n- offer_context : 2 à 4 phrases en français, style fiche RH (souvent Recherche d'une opportunité pour...), sur le profil recherché et les enjeux ; ne pas se limiter au titre de l'offre et au lieu.\\n- summary, strengths, risks : prose française.\\n`

const j = JSON.parse(fs.readFileSync(wf, 'utf8'))
const n = j.nodes.find((x) => x.name === '9 - Assemble LLM payload')
if (!n?.parameters?.jsCode) {
  console.error('Nœud introuvable')
  process.exit(1)
}
const c = n.parameters.jsCode
const needle = 'last_employer.\\nLe score et'
if (!c.includes(needle)) {
  const i = c.indexOf('last_employer')
  console.error('Motif introuvable (workflow déjà patché ?). Extrait :', JSON.stringify(c.slice(i, i + 120)))
  process.exit(1)
}
n.parameters.jsCode = c.replace(needle, `last_employer.${INSERT}Le score et`)
fs.writeFileSync(wf, JSON.stringify(j, null, 2) + '\n', 'utf8')
console.log('OK', wf)
