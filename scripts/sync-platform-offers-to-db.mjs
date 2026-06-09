/**
 * Sync platform campaigns/offers (adzuna.js catalog) into PostgreSQL.
 * Usage: node scripts/sync-platform-offers-to-db.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { getAdzunaCampaigns, getAdzunaOffers } from '../server/adzuna.js'

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

function toDbStatus(status) {
  const s = String(status || '').trim().toUpperCase()
  if (s === 'CLOSED') return 'CLOSED'
  if (s === 'DRAFT') return 'DRAFT'
  return 'ACTIVE'
}

loadEnvFile()
const connectionString = String(process.env.DATABASE_URL || '').trim()
if (!connectionString) {
  console.error('[sync-platform-offers] DATABASE_URL is missing.')
  process.exit(1)
}

const client = new Client({ connectionString })
await client.connect()

let campaignsSynced = 0
let offersSynced = 0

try {
  await client.query('BEGIN')

  const campaigns = await getAdzunaCampaigns()
  for (const campaign of campaigns) {
    const existingCampaign = (
      await client.query(`SELECT id FROM campaigns WHERE lower(code) = lower($1) LIMIT 1`, [campaign.code])
    ).rows[0]
    let c
    if (existingCampaign) {
      c = (
        await client.query(
          `UPDATE campaigns
              SET name = $1,
                  description = $2,
                  status = $3,
                  start_date = $4,
                  end_date = $5,
                  updated_at = NOW()
            WHERE id = $6
            RETURNING id, code`,
          [
            campaign.name,
            `Synced from platform catalog (${campaign.code})`,
            toDbStatus(campaign.status),
            campaign.start_date || null,
            campaign.end_date || null,
            existingCampaign.id,
          ]
        )
      ).rows[0]
    } else {
      c = (
        await client.query(
          `INSERT INTO campaigns (name, code, description, status, start_date, end_date, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
           RETURNING id, code`,
          [
            campaign.name,
            campaign.code,
            `Synced from platform catalog (${campaign.code})`,
            toDbStatus(campaign.status),
            campaign.start_date || null,
            campaign.end_date || null,
          ]
        )
      ).rows[0]
    }
    campaignsSynced += 1

    const offers = await getAdzunaOffers(campaign.id)
    for (const offer of offers) {
      const reference =
        String(offer.reference || '').trim() ||
        `SYNC-${String(campaign.code || 'PCA').toUpperCase()}-${String(offer.id || '').toUpperCase()}`
      const existingOffer = (
        await client.query(
          `SELECT id
             FROM offers
            WHERE lower(reference) = lower($1)
               OR (campaign_id = $2 AND lower(title) = lower($3))
            LIMIT 1`,
          [reference, c.id, offer.title]
        )
      ).rows[0]
      if (existingOffer) {
        await client.query(
          `UPDATE offers
              SET campaign_id = $1,
                  title = $2,
                  reference = $3,
                  description = $4,
                  location = $5,
                  status = $6,
                  updated_at = NOW()
            WHERE id = $7`,
          [
            c.id,
            offer.title,
            reference,
            offer.description || null,
            offer.location || null,
            toDbStatus(offer.status),
            existingOffer.id,
          ]
        )
      } else {
        await client.query(
          `INSERT INTO offers (campaign_id, title, reference, description, location, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [
            c.id,
            offer.title,
            reference,
            offer.description || null,
            offer.location || null,
            toDbStatus(offer.status),
          ]
        )
      }
      offersSynced += 1
    }
  }

  await client.query('COMMIT')
  console.log(`[sync-platform-offers] done: campaigns=${campaignsSynced}, offers=${offersSynced}`)
} catch (e) {
  await client.query('ROLLBACK')
  console.error('[sync-platform-offers] failed:', e.message)
  process.exitCode = 1
} finally {
  await client.end()
}

