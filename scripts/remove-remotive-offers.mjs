import 'dotenv/config'
import pg from 'pg'

const { Client } = pg

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query('BEGIN')

    const delLinks = await client.query(`
      DELETE FROM candidature_offer co
      USING offers o, campaigns c
      WHERE co.offer_id = o.id
        AND o.campaign_id = c.id
        AND (
          c.name ILIKE '%remotive%'
          OR c.code ILIKE '%remotive%'
          OR c.name ILIKE '%offres remote%'
          OR o.title ILIKE '%remotive%'
          OR o.title ILIKE '%remote%software dev%'
        )
    `)

    const delOffers = await client.query(`
      DELETE FROM offers o
      USING campaigns c
      WHERE o.campaign_id = c.id
        AND (
          c.name ILIKE '%remotive%'
          OR c.code ILIKE '%remotive%'
          OR c.name ILIKE '%offres remote%'
          OR o.title ILIKE '%remotive%'
          OR o.title ILIKE '%remote%software dev%'
        )
    `)

    const delCampaigns = await client.query(`
      DELETE FROM campaigns
      WHERE name ILIKE '%remotive%'
         OR code ILIKE '%remotive%'
         OR name ILIKE '%offres remote%'
    `)

    await client.query('COMMIT')
    console.log(
      JSON.stringify(
        {
          deleted_candidature_offer: delLinks.rowCount || 0,
          deleted_offers: delOffers.rowCount || 0,
          deleted_campaigns: delCampaigns.rowCount || 0,
        },
        null,
        2
      )
    )
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('[remove-remotive-offers] failed:', e.message)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

run()
