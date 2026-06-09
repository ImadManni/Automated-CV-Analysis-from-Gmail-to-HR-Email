import fs from 'fs'
import path from 'path'

const logPath = path.join(process.cwd(), 'patch-pca8-reliability.log')
const log = []

try {
  const root = process.cwd()
  const target = fs.readdirSync(root).find((n) => n.endsWith('PCA (8).json'))
  if (!target) throw new Error('PCA (8).json not found')

  const filePath = path.join(root, target)
  const raw = fs.readFileSync(filePath, 'utf8')
  const doc = JSON.parse(raw)

  const node9 = doc.nodes.find((n) => n.name === '9 - Assemble LLM payload')
  const node11 = doc.nodes.find((n) => n.name === '11 - Parse LLM JSON')
  const node12 = doc.nodes.find((n) => n.name === '12 - Save analysis (PCA API)')
  if (!node9 || !node11 || !node12) throw new Error('Required nodes not found')

  let s9 = String(node9.parameters?.jsCode || '')
  let s11 = String(node11.parameters?.jsCode || '')
  let s12 = String(node12.parameters?.jsonBody || '')

  // 1) Strengthen system prompt coherence rule (global, all offers)
  if (!s9.includes('offer_context doit rester strictement cohérent avec le score final')) {
    const anchor = '- Pour toute nouvelle offre, appliquer une logique de couverture des exigences: faible couverture compétences coeur => score plafonné, bonne couverture + preuves d’expérience/projets => score rehaussé.'
    if (!s9.includes(anchor)) throw new Error('Node 9 anchor not found')
    s9 = s9.replace(
      anchor,
      `${anchor}\\n- offer_context doit rester strictement cohérent avec le score final: score < 60 => contexte prudent avec écarts explicites; score 60-74 => contexte nuancé; score >= 75 => contexte positif mais factuel, basé uniquement sur preuves CV.`
    )
    log.push('node9: coherence rule inserted')
  } else {
    log.push('node9: coherence rule already present')
  }

  // 2) Blend LLM score + deterministic score in node 11
  if (!s11.includes('const llmScoreRaw = Number(parsed.score);')) {
    const anchor11 = "let score = deterministicScore(meta.offerTitle, meta.offerDescription, meta.emailSubject || '', skills, experience, expCount, experience_years_avg);"
    if (!s11.includes(anchor11)) throw new Error('Node 11 score anchor not found')
    s11 = s11.replace(
      anchor11,
      `${anchor11}
const llmScoreRaw = Number(parsed.score);
if (Number.isFinite(llmScoreRaw)) {
  // Keep deterministic scoring as primary, but preserve LLM nuance.
  score = Math.round(score * 0.72 + Math.max(0, Math.min(100, llmScoreRaw)) * 0.28);
}`
    )
    log.push('node11: score blend inserted')
  } else {
    log.push('node11: score blend already present')
  }

  // 3) Bound node 12 recalibration to avoid heavy under/over-shoots
  if (!s12.includes('const maxDownShift = 12;')) {
    const tailAnchor = 'adjusted = Math.min(adjusted, 90); return Math.max(0, Math.min(100, adjusted));'
    if (!s12.includes(tailAnchor)) throw new Error('Node 12 tail anchor not found')
    s12 = s12.replace(
      tailAnchor,
      `const maxDownShift = 12;
const maxUpShift = 8;
adjusted = Math.max(base - maxDownShift, Math.min(base + maxUpShift, adjusted));
if (base >= 75 && hasGlobalProfileSignal && adjusted < 60) adjusted = 60;
if (base <= 45 && !hasGlobalProfileSignal && adjusted > 68) adjusted = 68;
adjusted = Math.min(adjusted, 90); return Math.max(0, Math.min(100, adjusted));`
    )
    log.push('node12: bounded recalibration inserted')
  } else {
    log.push('node12: bounded recalibration already present')
  }

  node9.parameters.jsCode = s9
  node11.parameters.jsCode = s11
  node12.parameters.jsonBody = s12

  fs.writeFileSync(filePath, JSON.stringify(doc, null, 2) + '\n', 'utf8')
  log.push('done')
} catch (e) {
  log.push(`error: ${e.message}`)
  fs.writeFileSync(logPath, log.join('\n') + '\n', 'utf8')
  throw e
}

fs.writeFileSync(logPath, log.join('\n') + '\n', 'utf8')
