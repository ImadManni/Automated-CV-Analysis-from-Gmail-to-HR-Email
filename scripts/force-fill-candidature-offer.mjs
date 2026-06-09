import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Client } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function loadEnvFile() {
  for (const name of ['.env.pca', '.env']) {
    const p = path.join(root, name)
    if (!fs.existsSync(p)) continue
    let content = fs.readFileSync(p, 'utf8')
    if (content.charCodeAt(0) === 0xfeff) content = content.slice(1)
    for (const line of content.split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
    return
  }
}

function norm(v) {
  return String(v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim()
}

loadEnvFile()
const cs = String(process.env.DATABASE_URL || '').trim()
if (!cs) {
  console.error('DATABASE_URL missing')
  process.exit(1)
}

const c = new Client({ connectionString: cs })
await c.connect()

try {
  await c.query('BEGIN')

  let campaignId = null
  const campRows = (await c.query('SELECT id FROM public.campaigns ORDER BY id ASC LIMIT 1')).rows
  if (campRows.length) {
    campaignId = campRows[0].id
  } else {
    campaignId = (
      await c.query(
        `INSERT INTO public.campaigns (name, code, description, status, created_at, updated_at)
         VALUES ('Auto Campaign', 'AUTO-CAMP', 'Created for candidature_offer linking', 'ACTIVE', NOW(), NOW())
         RETURNING id`
      )
    ).rows[0].id
  }

  const offers = (await c.query('SELECT id, title FROM public.offers')).rows
  const offerByNorm = new Map()
  for (const o of offers) {
    const k = norm(o.title)
    if (k && !offerByNorm.has(k)) offerByNorm.set(k, o.id)
  }

  const candRows = (
    await c.query(
      `SELECT id, score, offer_title, subject
       FROM public.candidatures
       ORDER BY id ASC`
    )
  ).rows

  let createdOffers = 0
  let insertedLinks = 0

  for (const cand of candRows) {
    const label = String(cand.offer_title || cand.subject || '').trim()
    if (!label) continue
    const key = norm(label)
    if (!key) continue

    let offerId = offerByNorm.get(key)
    if (!offerId) {
      const ref = `AUTO-${cand.id}`
      const newOffer = (
        await c.query(
          `INSERT INTO public.offers (campaign_id, title, reference, description, location, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
           RETURNING id`,
          [campaignId, label, ref, 'Auto-created from candidature title/subject', null, 'ACTIVE']
        )
      ).rows[0]
      offerId = newOffer.id
      offerByNorm.set(key, offerId)
      createdOffers += 1
    }

    const exists = (
      await c.query(
        'SELECT 1 FROM public.candidature_offer WHERE candidature_id = $1 AND offer_id = $2 LIMIT 1',
        [cand.id, offerId]
      )
    ).rows.length
    if (exists) continue

    await c.query(
      `INSERT INTO public.candidature_offer (candidature_id, offer_id, status, score, created_at, updated_at)
       VALUES ($1, $2, 'MATCHED', $3, NOW(), NOW())`,
      [cand.id, offerId, cand.score == null ? null : Math.max(0, Math.min(100, Number(cand.score)))]
    )
    insertedLinks += 1
  }

  await c.query('COMMIT')
  const total = (await c.query('SELECT COUNT(*)::int AS n FROM public.candidature_offer')).rows[0].n
  const payload = { ok: true, createdOffers, insertedLinks, totalLinks: total }
  fs.writeFileSync(path.join(root, 'force-fill-report.json'), JSON.stringify(payload, null, 2))
  console.log(JSON.stringify(payload))
} catch (e) {
  await c.query('ROLLBACK')
  const payload = { ok: false, error: e.message || String(e) }
  fs.writeFileSync(path.join(root, 'force-fill-report.json'), JSON.stringify(payload, null, 2))
  console.error(e.message)
  process.exit(1)
} finally {
  await c.end()
}

