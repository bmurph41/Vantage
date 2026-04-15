import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { isLiv2Enabled, LIV2_CONFIG } from './config';
import { liv2Repo } from './storage/repo';
import { runListingScrape } from './runner/runScrape';
import { insertLiv2SourceSchema } from './schema';
import { checkMarketplaceScrapeUrl, getAllowedMarinaDomains } from './fetch/ssrfGuard';
import { findDuplicatesInBatch, findDuplicatesForListing } from './identity/duplicateDetector';
import { parsePagination, paginatedResponse } from '../../utils/pagination';
import { pool } from '../../db';

const router = Router();

// ─── Marina Listings adapter ──────────────────────────────────────────────
// Maps a raw marina_listings row (snake_case) into the Liv2ListingCurrent
// shape the marketplace frontend already consumes. Covers both CRE metrics
// (top-level columns + cre_metrics jsonb) and operating-business metrics
// (business_metrics jsonb).
function mapMarinaRowToLiv2Shape(r: any) {
  const price = r.asking_price != null ? Number(r.asking_price) : null;
  const capRate = r.cap_rate != null ? String(r.cap_rate) : null;
  const noi = r.noi != null ? Math.round(Number(r.noi)) : null;
  const revenue = r.gross_revenue != null ? Math.round(Number(r.gross_revenue)) : null;
  return {
    id: r.id,
    canonicalListingId: r.id,
    sourceId: r.source_platform || '',
    domain: r.source_platform || '',
    title: r.title || r.property_name || null,
    listingType: r.marina_type || r.property_type || null,
    status: r.status || 'active',
    askingPrice: price,
    currency: r.currency || 'USD',
    address1: r.property_address,
    city: r.city,
    state: r.state,
    postalCode: r.zip_code,
    country: r.country || 'US',
    lat: r.latitude != null ? String(r.latitude) : null,
    lng: r.longitude != null ? String(r.longitude) : null,
    description: r.description || r.original_description || null,
    acreage: r.acreage != null ? String(r.acreage) : null,
    waterfrontFeet: r.water_frontage != null ? Math.round(Number(r.water_frontage)) : null,
    slips: r.total_slips,
    dryRacks: r.dry_storage_spaces,
    occupancy: r.occupancy_rate != null ? Math.round(Number(r.occupancy_rate)) : null,
    capRate,
    noi,
    revenue,
    yearBuilt: null,
    zoning: null,
    brokerName: r.broker_name,
    brokerCompany: r.broker_company,
    brokerPhone: r.broker_phone,
    brokerEmail: r.broker_email,
    heroImageUrl: r.hero_image_url,
    imageCount: Array.isArray(r.images) ? r.images.length : 0,
    sourceUrl: r.source_url,
    publishedAt: r.published_at,
    lastExtractedAt: r.last_scraped_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    // Extended universal marketplace fields
    listingCategory: r.listing_category || 'cre_property',
    assetClass: r.asset_class || null,
    creMetrics: r.cre_metrics || null,
    businessMetrics: r.business_metrics || null,
    brokerProfileId: r.broker_profile_id || null,
    priceOnRequest: r.price_on_request || false,
    isLocationConfidential: r.is_location_confidential || false,
    isActive: r.is_active !== false,
  };
}

async function queryMarinaListings(params: {
  limit: number;
  offset: number;
  state?: string;
  domain?: string;
  category?: string;
  assetClass?: string;
  q?: string;
  minRevenue?: number;
  maxRevenue?: number;
  minEbitda?: number;
  maxEbitda?: number;
  minSde?: number;
  maxSde?: number;
}) {
  const where: string[] = ['(is_active IS NULL OR is_active = true)'];
  const vals: any[] = [];
  const add = (clause: string, v: any) => {
    vals.push(v);
    where.push(clause.replace('$?', `$${vals.length}`));
  };
  if (params.state) add('state = $?', params.state);
  if (params.domain) add('source_platform = $?', params.domain);
  if (params.category) add('listing_category = $?', params.category);
  if (params.assetClass) add('asset_class = $?', params.assetClass);
  if (params.q) {
    vals.push(params.q);
    const a = `$${vals.length}`;
    vals.push(`%${params.q}%`);
    const b = `$${vals.length}`;
    where.push(`(search_vector @@ websearch_to_tsquery('english', ${a}) OR title ILIKE ${b} OR city ILIKE ${b} OR description ILIKE ${b})`);
  }
  if (params.minRevenue != null) add("(business_metrics->>'annual_revenue')::numeric >= $?", params.minRevenue);
  if (params.maxRevenue != null) add("(business_metrics->>'annual_revenue')::numeric <= $?", params.maxRevenue);
  if (params.minEbitda != null) add("(business_metrics->>'annual_ebitda')::numeric >= $?", params.minEbitda);
  if (params.maxEbitda != null) add("(business_metrics->>'annual_ebitda')::numeric <= $?", params.maxEbitda);
  if (params.minSde != null) add("(business_metrics->>'annual_cashflow_sde')::numeric >= $?", params.minSde);
  if (params.maxSde != null) add("(business_metrics->>'annual_cashflow_sde')::numeric <= $?", params.maxSde);

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countSql = `SELECT COUNT(*)::int AS total FROM marina_listings ${whereSql}`;
  const listSql = `
    SELECT * FROM marina_listings
    ${whereSql}
    ORDER BY COALESCE(published_at, updated_at, created_at) DESC
    LIMIT ${params.limit} OFFSET ${params.offset}
  `;
  const [countRes, listRes] = await Promise.all([
    pool.query(countSql, vals),
    pool.query(listSql, vals),
  ]);
  return {
    total: countRes.rows[0]?.total ?? 0,
    items: listRes.rows.map(mapMarinaRowToLiv2Shape),
  };
}

function requireLiv2(req: Request, res: Response, next: NextFunction) {
  if (!isLiv2Enabled()) {
    return res.status(404).json({ error: 'Listing Ingestion V2 is not enabled' });
  }
  next();
}

router.use(requireLiv2);

router.post('/sources', async (req, res) => {
  try {
    const data = insertLiv2SourceSchema.parse(req.body);
    const source = await liv2Repo.createSource(data);
    res.status(201).json(source);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('[LIV2] Create source error:', error);
    res.status(500).json({ error: 'Failed to create source' });
  }
});

router.get('/sources', async (req, res) => {
  try {
    const sources = await liv2Repo.getActiveSources();
    res.json(sources);
  } catch (error) {
    console.error('[LIV2] Get sources error:', error);
    res.status(500).json({ error: 'Failed to get sources' });
  }
});

router.get('/sources/:id', async (req, res) => {
  try {
    const source = await liv2Repo.getSourceById(req.params.id);
    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }
    res.json(source);
  } catch (error) {
    console.error('[LIV2] Get source error:', error);
    res.status(500).json({ error: 'Failed to get source' });
  }
});

const scrapeRequestSchema = z.object({
  sourceId: z.string().uuid(),
  urls: z.array(z.string().url()).min(1).max(100),
});

router.post('/scrape', async (req, res) => {
  try {
    const { sourceId, urls } = scrapeRequestSchema.parse(req.body);
    
    const source = await liv2Repo.getSourceById(sourceId);
    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }
    
    const result = await runListingScrape(sourceId, urls);
    
    res.json({
      runId: result.runId,
      status: result.status,
      metrics: result.metrics,
      errors: result.errors.slice(0, 10),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('[LIV2] Scrape error:', error);
    res.status(500).json({ error: 'Scrape failed', message: (error as Error).message });
  }
});

router.get('/runs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const runs = await liv2Repo.getRecentRuns(limit);
    res.json(runs);
  } catch (error) {
    console.error('[LIV2] Get runs error:', error);
    res.status(500).json({ error: 'Failed to get runs' });
  }
});

router.get('/runs/:id', async (req, res) => {
  try {
    const run = await liv2Repo.getRunById(req.params.id);
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }
    res.json(run);
  } catch (error) {
    console.error('[LIV2] Get run error:', error);
    res.status(500).json({ error: 'Failed to get run' });
  }
});

router.get('/listings', async (req, res) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const pag = parsePagination(req.query as Record<string, any>, { pageSize: 25 });
    const num = (v: string | undefined) => (v != null && v !== '' ? Number(v) : undefined);

    // Legacy passthrough for liv2_listings_current (explicit opt-in).
    if (q.legacy === '1') {
      const allListings = await liv2Repo.getCurrentListings({
        domain: q.domain,
        state: q.state,
      });
      const total = allListings.length;
      const paged = allListings.slice(pag.offset, pag.offset + pag.limit);
      const flat = paged.map((l: any) => ({ ...l, listingCategory: 'cre_property' }));
      return res.json(paginatedResponse(flat, total, pag));
    }

    // Default: query the canonical marina_listings table with full filter support.
    const result = await queryMarinaListings({
      limit: pag.limit,
      offset: pag.offset,
      state: q.state,
      domain: q.domain,
      category: q.category,
      assetClass: q.assetClass,
      q: q.q,
      minRevenue: num(q.minRevenue),
      maxRevenue: num(q.maxRevenue),
      minEbitda: num(q.minEbitda),
      maxEbitda: num(q.maxEbitda),
      minSde: num(q.minSde),
      maxSde: num(q.maxSde),
    });
    // Shape the response to match frontend expectation: it reads an array directly
    // (see MarketplaceListings.tsx `res.json()` typed as `Listing[]`), so return
    // the items array. Callers that need pagination can read totalCount header.
    res.setHeader('X-Total-Count', String(result.total));
    res.json(result.items);
  } catch (error) {
    console.error('[LIV2] Get listings error:', error);
    res.status(500).json({ error: 'Failed to get listings' });
  }
});

router.get('/listings/:canonicalListingId', async (req, res) => {
  try {
    const listing = await liv2Repo.getCurrentListingById(req.params.canonicalListingId);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    const assets = await liv2Repo.getListingAssets(req.params.canonicalListingId);
    const history = await liv2Repo.getPayloadHistory(req.params.canonicalListingId);
    
    res.json({
      listing,
      assets,
      payloadHistory: history.slice(0, 10),
    });
  } catch (error) {
    console.error('[LIV2] Get listing error:', error);
    res.status(500).json({ error: 'Failed to get listing' });
  }
});

router.get('/quarantine', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const items = await liv2Repo.getQuarantinedItems(limit);
    res.json(items);
  } catch (error) {
    console.error('[LIV2] Get quarantine error:', error);
    res.status(500).json({ error: 'Failed to get quarantine items' });
  }
});

router.get('/adapter/listing/:id', async (req, res) => {
  try {
    const listing = await liv2Repo.getCurrentListingById(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    const assets = await liv2Repo.getListingAssets(req.params.id);
    
    const dto = {
      id: listing.id,
      externalId: listing.canonicalListingId,
      title: listing.title,
      type: listing.listingType,
      status: listing.status,
      price: listing.askingPrice,
      currency: listing.currency,
      address: listing.address1,
      city: listing.city,
      state: listing.state,
      zip: listing.postalCode,
      country: listing.country,
      lat: listing.lat ? parseFloat(listing.lat) : undefined,
      lng: listing.lng ? parseFloat(listing.lng) : undefined,
      description: listing.description,
      slips: listing.slips,
      dryRacks: listing.dryRacks,
      acreage: listing.acreage ? parseFloat(listing.acreage) : undefined,
      waterfrontFeet: listing.waterfrontFeet,
      capRate: listing.capRate ? parseFloat(listing.capRate) : undefined,
      noi: listing.noi,
      revenue: listing.revenue,
      yearBuilt: listing.yearBuilt,
      zoning: listing.zoning,
      brokerName: listing.brokerName,
      brokerCompany: listing.brokerCompany,
      brokerPhone: listing.brokerPhone,
      brokerEmail: listing.brokerEmail,
      heroImageUrl: listing.heroImageUrl,
      images: assets.filter(a => a.verified).map(a => ({
        url: a.assetUrlNormalized,
        verified: a.verified,
        contentHash: a.contentHash,
      })),
      sourceUrl: listing.sourceUrl,
      sourceDomain: listing.domain,
      publishedAt: listing.publishedAt,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
    };
    
    res.json(dto);
  } catch (error) {
    console.error('[LIV2] Adapter listing error:', error);
    res.status(500).json({ error: 'Failed to get listing' });
  }
});

router.get('/config', (req, res) => {
  res.json({
    enabled: isLiv2Enabled(),
    extractorVersion: LIV2_CONFIG.extractorVersion,
    confidenceThreshold: LIV2_CONFIG.identity.confidenceThreshold,
    maxCandidatesPerRun: LIV2_CONFIG.identity.maxCandidatesPerRun,
  });
});

const marketplaceScrapeSchema = z.object({
  sourceId: z.string().uuid(),
  urls: z.array(z.string().url()).min(1).max(100),
  validateDomain: z.boolean().optional().default(true),
});

router.post('/marketplace/scrape', async (req, res) => {
  try {
    const { sourceId, urls, validateDomain } = marketplaceScrapeSchema.parse(req.body);
    
    const source = await liv2Repo.getSourceById(sourceId);
    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }
    
    const validatedUrls: string[] = [];
    const blockedUrls: Array<{ url: string; reason: string }> = [];
    
    for (const url of urls) {
      if (validateDomain) {
        const ssrfCheck = checkMarketplaceScrapeUrl(url);
        if (!ssrfCheck.allowed) {
          blockedUrls.push({ url, reason: ssrfCheck.reason || 'Blocked by SSRF protection' });
          continue;
        }
      }
      validatedUrls.push(url);
    }
    
    if (validatedUrls.length === 0) {
      return res.status(400).json({
        error: 'No valid URLs to scrape',
        blockedUrls,
        allowedDomains: getAllowedMarinaDomains(),
      });
    }
    
    const result = await runListingScrape(sourceId, validatedUrls);
    
    res.json({
      runId: result.runId,
      status: result.status,
      metrics: result.metrics,
      validatedUrls: validatedUrls.length,
      blockedUrls,
      errors: result.errors.slice(0, 10),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('[LIV2] Marketplace scrape error:', error);
    res.status(500).json({ error: 'Scrape failed', message: (error as Error).message });
  }
});

router.get('/marketplace/allowed-domains', (req, res) => {
  res.json({
    domains: getAllowedMarinaDomains(),
  });
});

const duplicatesQuerySchema = z.object({
  minConfidence: z.string().optional().transform(val => val ? parseInt(val, 10) : 60),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 100),
  domain: z.string().optional(),
  state: z.string().optional(),
});

router.get('/marketplace/duplicates', async (req, res) => {
  try {
    const { minConfidence, limit, domain, state } = duplicatesQuerySchema.parse(req.query);
    
    const listings = await liv2Repo.getCurrentListings({
      domain,
      state,
      limit: Math.min(limit * 2, 500),
    });
    
    if (listings.length === 0) {
      return res.json({
        duplicates: [],
        totalListingsChecked: 0,
        potentialDuplicateCount: 0,
      });
    }
    
    const result = findDuplicatesInBatch(listings, minConfidence);
    
    res.json({
      duplicates: result.duplicates.slice(0, limit).map(d => ({
        confidence: d.confidence,
        matchReasons: d.matchReasons,
        scores: d.scores,
        listing1: {
          id: d.listing1.id,
          canonicalListingId: d.listing1.canonicalListingId,
          title: d.listing1.title,
          city: d.listing1.city,
          state: d.listing1.state,
          slips: d.listing1.slips,
          askingPrice: d.listing1.askingPrice,
          domain: d.listing1.domain,
        },
        listing2: {
          id: d.listing2.id,
          canonicalListingId: d.listing2.canonicalListingId,
          title: d.listing2.title,
          city: d.listing2.city,
          state: d.listing2.state,
          slips: d.listing2.slips,
          askingPrice: d.listing2.askingPrice,
          domain: d.listing2.domain,
        },
      })),
      totalListingsChecked: result.totalListingsChecked,
      potentialDuplicateCount: result.potentialDuplicateCount,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('[LIV2] Get duplicates error:', error);
    res.status(500).json({ error: 'Failed to get duplicates' });
  }
});

const duplicateCheckSchema = z.object({
  canonicalListingId: z.string(),
  minConfidence: z.number().min(0).max(100).optional().default(60),
});

router.post('/marketplace/duplicates/check', async (req, res) => {
  try {
    const { canonicalListingId, minConfidence } = duplicateCheckSchema.parse(req.body);
    
    const listing = await liv2Repo.getCurrentListingById(canonicalListingId);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    const allListings = await liv2Repo.getCurrentListings({ limit: 500 });
    
    const matches = findDuplicatesForListing(listing, allListings, minConfidence);
    
    res.json({
      sourceListingId: canonicalListingId,
      potentialDuplicates: matches.map(m => ({
        confidence: m.confidence,
        matchReasons: m.matchReasons,
        scores: m.scores,
        listing: {
          id: m.listing2.id,
          canonicalListingId: m.listing2.canonicalListingId,
          title: m.listing2.title,
          city: m.listing2.city,
          state: m.listing2.state,
          slips: m.listing2.slips,
          askingPrice: m.listing2.askingPrice,
          domain: m.listing2.domain,
        },
      })),
      count: matches.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('[LIV2] Check duplicates error:', error);
    res.status(500).json({ error: 'Failed to check duplicates' });
  }
});

const mergeListingsSchema = z.object({
  primaryListingId: z.string(),
  secondaryListingId: z.string(),
});

router.post('/marketplace/duplicates/merge', async (req, res) => {
  try {
    const { primaryListingId, secondaryListingId } = mergeListingsSchema.parse(req.body);
    
    if (primaryListingId === secondaryListingId) {
      return res.status(400).json({ error: 'Cannot merge a listing with itself' });
    }
    
    const result = await liv2Repo.mergeListings(primaryListingId, secondaryListingId);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    const mergedListing = await liv2Repo.getCurrentListingById(primaryListingId);
    
    res.json({
      success: true,
      mergedListingId: primaryListingId,
      deletedListingId: secondaryListingId,
      listing: mergedListing,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('[LIV2] Merge listings error:', error);
    res.status(500).json({ error: 'Failed to merge listings' });
  }
});

router.get('/marketplace/sources', async (req, res) => {
  try {
    const sources = await liv2Repo.getActiveSources();
    res.json({
      sources: sources.map(s => ({
        id: s.id,
        name: s.name,
        domain: s.domain,
        isActive: s.isActive,
        lastScrapedAt: s.lastScrapedAt,
        createdAt: s.createdAt,
      })),
      allowedDomains: getAllowedMarinaDomains(),
    });
  } catch (error) {
    console.error('[LIV2] Get marketplace sources error:', error);
    res.status(500).json({ error: 'Failed to get sources' });
  }
});

export default router;
