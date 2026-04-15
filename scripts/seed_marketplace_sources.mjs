/**
 * Seed marketplace_sources rows for every registered scraper adapter.
 *
 * Run with: `node scripts/seed_marketplace_sources.mjs`
 *
 * Idempotent — uses ON CONFLICT (domain) DO UPDATE so re-running bumps
 * the display name / category / scraper type / rate limit without creating
 * duplicate rows. Does not touch stats columns (lastRunAt, successRate,
 * totalListingsIngested) so a re-seed won't wipe history.
 */

import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const SOURCES = [
  {
    name: 'BizBuySell',
    domain: 'bizbuysell.com',
    category: 'business',
    scraperType: 'bizbuysell',
    rateLimitPerMin: 15,
    notes: 'Largest US business-for-sale marketplace. Live fetch gated on INGESTION_V3_LIVE_FETCH.',
    termsOfServiceUrl: 'https://www.bizbuysell.com/terms/',
  },
  {
    name: 'BusinessBroker.net',
    domain: 'businessbroker.net',
    category: 'business',
    scraperType: 'businessbroker',
    rateLimitPerMin: 15,
    notes: 'Operating business listings with fact-table extraction.',
    termsOfServiceUrl: 'https://www.businessbroker.net/terms-of-use/',
  },
  {
    name: 'BizQuest',
    domain: 'bizquest.com',
    category: 'business',
    scraperType: 'bizquest',
    rateLimitPerMin: 15,
    notes: 'Operating business listings. dt/dd fact list + JSON-LD.',
    termsOfServiceUrl: 'https://www.bizquest.com/terms/',
  },
  {
    name: 'LoopNet',
    domain: 'loopnet.com',
    category: 'cre',
    scraperType: 'loopnet',
    rateLimitPerMin: 20,
    notes: 'CoStar-owned CRE marketplace. JSON-LD Product + dt/dd fact list.',
    termsOfServiceUrl: 'https://www.loopnet.com/xNet/MainSite/Utilities/TermsOfUse.aspx',
  },
  {
    name: 'Crexi',
    domain: 'crexi.com',
    category: 'cre',
    scraperType: 'crexi',
    rateLimitPerMin: 20,
    notes: 'CRE marketplace. JSON-LD + Next.js __NEXT_DATA__ fallback.',
    termsOfServiceUrl: 'https://www.crexi.com/terms-of-use',
  },
  {
    name: 'Franchise Gator',
    domain: 'franchisegator.com',
    category: 'franchise',
    scraperType: 'franchisegator',
    rateLimitPerMin: 15,
    notes: 'Franchise directory. Parses investment economics (min/max, franchise fee, royalty).',
    termsOfServiceUrl: 'https://www.franchisegator.com/terms-of-use/',
  },
];

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const s of SOURCES) {
      await client.query(
        `INSERT INTO marketplace_sources
           (name, domain, category, scraper_type, enabled, rate_limit_per_min,
            respects_robots_txt, attribution_required, terms_of_service_url, notes)
         VALUES ($1, $2, $3, $4, $5, $6, true, true, $7, $8)
         ON CONFLICT (domain) DO UPDATE SET
           name = EXCLUDED.name,
           category = EXCLUDED.category,
           scraper_type = EXCLUDED.scraper_type,
           rate_limit_per_min = EXCLUDED.rate_limit_per_min,
           terms_of_service_url = EXCLUDED.terms_of_service_url,
           notes = EXCLUDED.notes,
           updated_at = now()`,
        [
          s.name,
          s.domain,
          s.category,
          s.scraperType,
          true,
          s.rateLimitPerMin,
          s.termsOfServiceUrl,
          s.notes,
        ],
      );
      console.log(`  upserted ${s.name} (${s.domain})`);
    }
    await client.query('COMMIT');
    const { rows } = await client.query(
      'SELECT name, domain, category, scraper_type, rate_limit_per_min FROM marketplace_sources ORDER BY name',
    );
    console.log(`\nmarketplace_sources now has ${rows.length} rows:`);
    for (const r of rows) {
      console.log(`  - ${r.name} (${r.domain}) [${r.category}/${r.scraper_type}] rpm=${r.rate_limit_per_min}`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
