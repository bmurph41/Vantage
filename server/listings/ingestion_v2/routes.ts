import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { isLiv2Enabled, LIV2_CONFIG } from './config';
import { liv2Repo } from './storage/repo';
import { runListingScrape } from './runner/runScrape';
import { insertLiv2SourceSchema } from './schema';
import { checkMarketplaceScrapeUrl, getAllowedMarinaDomains } from './fetch/ssrfGuard';
import { findDuplicatesInBatch, findDuplicatesForListing } from './identity/duplicateDetector';

const router = Router();

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
    const { domain, state, limit, offset } = req.query;
    const listings = await liv2Repo.getCurrentListings({
      domain: domain as string,
      state: state as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    res.json(listings);
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
