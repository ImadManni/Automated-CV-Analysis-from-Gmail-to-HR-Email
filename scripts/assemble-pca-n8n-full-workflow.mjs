/**
 * Assemble un seul workflow n8n : branche IMAP (candidatures) + 3 webhooks entretien (RH / Tech / Dir).
 * From SMTP dans les nœuds Send Email : texte fixe (défaut PCA ci‑dessous). Ne pas utiliser $env dans n8n.
 *
 * Usage : node scripts/assemble-pca-n8n-full-workflow.mjs
 * Sortie : racine du projet (n8n-workflow-pca-full-imap-and-interviews.json) + copie n8n/pca-workflow-full-combined.json
 */
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

/** Même adresse que le credential SMTP Gmail PCA — inchangé dans les JSON exportés. */
const DEFAULT_N8N_SMTP_FROM = 'hydragaming595@gmail.com'

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
  throw new Error('PCA webhook: champ email manquant ou invalide dans le JSON (attendu une adresse valide).');
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

function emailParams(fromAddr) {
  return {
    resource: 'email',
    operation: 'send',
    fromEmail: fromAddr,
    toEmail: '={{ String($json.toEmail || $json.email || \'\').trim() }}',
    subject: "=PCA — {{ $json.interviewTypeLabel }} — {{ $json.subject || 'Candidature' }}",
    emailFormat: 'text',
    text: '=Madame, Monsieur {{ $json.candidateName }},\n\nNous vous confirmons la planification du {{ $json.interviewTypeLabel }} concernant « {{ $json.subject }} ».\n\n- Date et heure : {{ $json.scheduledAt }}\n- Mode : {{ $json.mode }}\n- Lieu / lien : {{ $json.location }}\n\nCordialement,\nÉquipe RH — PCA (Payment Center for Africa)',
    options: {},
  }
}

function uuid() {
  return crypto.randomUUID()
}

function makeInterviewChain(routePath, label, y) {
  const whName = `Webhook (PCA) — ${label}`
  const normName = `Normalize — ${label}`
  const mailName = `Email — ${label}`
  const whId = uuid()
  const normId = uuid()
  const mailId = uuid()
  const nodes = [
    {
      parameters: { httpMethod: 'POST', path: routePath, options: {} },
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2.1,
      position: [0, y],
      id: whId,
      name: whName,
      webhookId: uuid(),
    },
    {
      parameters: { jsCode: NORMALIZE_JS },
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [300, y],
      id: normId,
      name: normName,
    },
    {
      parameters: emailParams(DEFAULT_N8N_SMTP_FROM),
      type: 'n8n-nodes-base.emailSend',
      typeVersion: 2.1,
      position: [620, y],
      id: mailId,
      name: mailName,
      credentials: {
        smtp: {
          id: 'REPLACE_ME',
          name: 'SMTP account',
        },
      },
    },
  ]
  const connections = {
    [whName]: { main: [[{ node: normName, type: 'main', index: 0 }]] },
    [normName]: { main: [[{ node: mailName, type: 'main', index: 0 }]] },
  }
  return { nodes, connections }
}

try {
const imapPath = path.join(root, 'n8n-workflow-imap-openai-in-n8n4.json')
if (!fs.existsSync(imapPath)) {
  console.error('[assemble] Missing', imapPath)
  process.exit(1)
}
const imap = JSON.parse(fs.readFileSync(imapPath, 'utf8'))

const shiftY = 620
for (const n of imap.nodes) {
  if (Array.isArray(n.position) && n.position.length >= 2) {
    n.position = [n.position[0], n.position[1] + shiftY]
  }
}

const rh = makeInterviewChain('pca-interview-rh', 'Entretien RH', 0)
const tech = makeInterviewChain('pca-interview-technique', 'Entretien technique', 200)
const dir = makeInterviewChain('pca-interview-directeur', 'Entretien directeur', 400)

const stickyNote = {
  parameters: {
    content: [
      '## E-mails « Email — Entretien … » (PCA)',
      '',
      `1. **From** : texte fixe \`${DEFAULT_N8N_SMTP_FROM}\` (identique au compte SMTP n8n). Pas de $env sur From.`,
      '',
      '2. **Resource = Email**, **Operation = Send** sur Send Email v2.1 (obligatoire).',
      '',
      '3. **To** : un seul `=` : `={{ String(...).trim() }}`. Jamais `=={{` (casse le To).',
      '',
      '4. Credential SMTP ; .env : N8N_INTERVIEW_WEBHOOK_URL_* → …/webhook/pca-interview-*',
    ].join('\n'),
    height: 380,
    width: 460,
  },
  type: 'n8n-nodes-base.stickyNote',
  typeVersion: 1,
  position: [-60, -320],
  id: uuid(),
  name: 'LISEZ — SMTP sans $env',
}

const combined = {
  name: 'PCA — Full (IMAP candidatures + 3 webhooks entretien)',
  meta: {
    description: `Workflow unique : import unique dans n8n. From SMTP = ${DEFAULT_N8N_SMTP_FROM} (texte fixe dans le JSON, pas $env). Remplacer REPLACE_ME sur les 3 nœuds Email par votre credential SMTP. Telemetry : npm run n8n (N8N_DIAGNOSTICS_ENABLED=false dans run-n8n-pg.mjs).`,
    instanceId: '',
  },
  nodes: [stickyNote, ...rh.nodes, ...tech.nodes, ...dir.nodes, ...imap.nodes],
  connections: {
    ...rh.connections,
    ...tech.connections,
    ...dir.connections,
    ...imap.connections,
  },
  pinData: {},
}

const payload = JSON.stringify(combined, null, 2) + '\n'
const outRoot = path.join(root, 'n8n-workflow-pca-full-imap-and-interviews.json')
const outN8n = path.join(root, 'n8n', 'pca-workflow-full-combined.json')
fs.mkdirSync(path.dirname(outN8n), { recursive: true })
fs.writeFileSync(outRoot, payload, 'utf8')
fs.writeFileSync(outN8n, payload, 'utf8')
console.log('[assemble] Wrote', outRoot, 'and', outN8n, '| From =', DEFAULT_N8N_SMTP_FROM)
} catch (e) {
  console.error('[assemble] Failed:', e && e.message)
  process.exit(1)
}
