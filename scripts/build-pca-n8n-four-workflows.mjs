/**
 * Génère n8n/pca-four-workflows.json : tableau de 4 workflows (1 IMAP + 3 webhooks entretien).
 * Usage : node scripts/build-pca-n8n-four-workflows.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const imapPath = path.join(root, 'n8n-workflow-imap-openai-in-n8n4.json')
const outPath = path.join(root, 'n8n', 'pca-four-workflows.json')

const NORMALIZE_JS = `const root = $input.first().json;
const b = root.body && typeof root.body === 'object' && !Array.isArray(root.body) ? root.body : root;
function cleanEmail(e) {
  if (e == null) return '';
  let s = String(e).trim();
  if (s.toLowerCase().startsWith('mailto:')) s = s.slice(7).split('?')[0].trim();
  const m = s.match(/<([^>]+)>/);
  if (m) return m[1].trim();
  const bare = s.match(/\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b/i);
  return bare ? bare[0] : s;
}
function cleanName(n) {
  if (n == null) return 'Candidat';
  let s = String(n).trim();
  s = s.replace(/<[^>]+>/g, ' ').replace(/\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b/gi, ' ');
  s = s.replace(/\\s+/g, ' ').trim();
  if (!s || /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(s)) return 'Candidat';
  const sl = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/^(soft skills|hard skills|technical skills|competences|profil professionnel|resume|summary|objectif professionnel)$/.test(sl)) return 'Candidat';
  return s;
}
const type = String(b.interviewType || '').toUpperCase();
let interviewTypeLabel = b.interviewTypeLabel;
if (!interviewTypeLabel) {
  if (type.includes('TECH')) interviewTypeLabel = 'Entretien technique';
  else if (type.includes('DIRECT') || type.includes('MANAG')) interviewTypeLabel = 'Entretien avec le directeur';
  else interviewTypeLabel = 'Entretien RH';
}
const email = cleanEmail(b.email);
if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
  throw new Error('PCA webhook: email candidat manquant ou invalide (champ email requis).');
}
return [{
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
}];`

function uuid() {
  return crypto.randomUUID()
}

function makeWebhookWorkflow(name, routePath, hint) {
  const whId = uuid()
  const normId = uuid()
  const mailId = uuid()
  return {
    name,
    meta: {
      description:
        `${hint} Méthode POST. Sur PCA : activer le workflow et renseigner l’URL complète (${routePath}) dans .env.`,
      instanceId: '',
    },
    nodes: [
      {
        parameters: { httpMethod: 'POST', path: routePath, options: {} },
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2.1,
        position: [0, 200],
        id: whId,
        name: 'Webhook (PCA)',
        webhookId: uuid(),
      },
      {
        parameters: { jsCode: NORMALIZE_JS },
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [240, 200],
        id: normId,
        name: 'Normalize payload',
      },
      {
        parameters: {
          resource: 'email',
          operation: 'send',
          fromEmail: 'hydragaming595@gmail.com',
          toEmail: "={{ String($json.toEmail || $json.email || '').trim() }}",
          subject: '=PCA — {{ $json.interviewTypeLabel }} — {{ $json.subject || \'Candidature\' }}',
          emailFormat: 'text',
          text: '=Madame, Monsieur {{ $json.candidateName }},\n\nNous vous confirmons la planification du {{ $json.interviewTypeLabel }} concernant « {{ $json.subject }} ».\n\n- Date et heure : {{ $json.scheduledAt }}\n- Mode : {{ $json.mode }}\n- Lieu / lien : {{ $json.location }}\n\nCordialement,\nÉquipe RH — PCA (Payment Center for Africa)',
          options: {},
        },
        type: 'n8n-nodes-base.emailSend',
        typeVersion: 2.1,
        position: [480, 200],
        id: mailId,
        name: 'Email au candidat',
        credentials: {
          smtp: {
            id: 'REPLACE_ME',
            name: 'SMTP account',
          },
        },
      },
    ],
    connections: {
      'Webhook (PCA)': { main: [[{ node: 'Normalize payload', type: 'main', index: 0 }]] },
      'Normalize payload': { main: [[{ node: 'Email au candidat', type: 'main', index: 0 }]] },
    },
    pinData: {},
  }
}

const imap = JSON.parse(fs.readFileSync(imapPath, 'utf8'))
const wfRh = makeWebhookWorkflow(
  'PCA — Invitation entretien RH',
  'pca-interview-rh',
  'Webhook RH — N8N_INTERVIEW_WEBHOOK_URL_RH',
)
const wfTech = makeWebhookWorkflow(
  'PCA — Invitation entretien technique',
  'pca-interview-technique',
  'Webhook technique — N8N_INTERVIEW_WEBHOOK_URL_TECHNIQUE',
)
const wfDir = makeWebhookWorkflow(
  'PCA — Invitation entretien directeur',
  'pca-interview-directeur',
  'Webhook directeur — N8N_INTERVIEW_WEBHOOK_URL_DIRECTEUR',
)

const bundle = {
  note:
    "n8n importe un workflow à la fois : menu « … » > Import from File pour chaque entrée de « workflows », ou utiliser node scripts/extract-n8n-workflow-from-bundle.mjs <index>.",
  workflows: [imap, wfRh, wfTech, wfDir],
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(bundle, null, 2) + '\n')
console.log('Wrote', outPath)
