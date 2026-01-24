import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { isLiv2Enabled, LIV2_CONFIG } from '../listings/ingestion_v2/config';
import { liv2Repo } from '../listings/ingestion_v2/storage/repo';
import { runListingScrape } from '../listings/ingestion_v2/runner/runScrape';
import { checkMarketplaceScrapeUrl, getAllowedMarinaDomains } from '../listings/ingestion_v2/fetch/ssrfGuard';
import { findDuplicatesInBatch, findDuplicatesForListing } from '../listings/ingestion_v2/identity/duplicateDetector';
import { BROKER_SOURCES, getActiveBrokerSources, getBrokerSourcesByType, getBrokerSourcesByFrequency } from '../listings/ingestion_v2/brokerSources';

const router = Router();

function checkLiv2Enabled(req: Request, res: Response, next: () => void) {
  if (!isLiv2Enabled()) {
    return res.status(503).json({ 
      error: 'Marketplace scraping is not enabled',
      hint: 'Set LISTING_INGESTION_V2=true environment variable to enable',
    });
  }
  next();
}

const scrapeRequestSchema = z.object({
  sourceId: z.string().uuid(),
  urls: z.array(z.string().url()).min(1).max(100),
  validateDomain: z.boolean().optional().default(true),
});

router.post('/scrape', checkLiv2Enabled, async (req, res) => {
  try {
    const { sourceId, urls, validateDomain } = scrapeRequestSchema.parse(req.body);
    
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
    console.error('[Marketplace] Scrape error:', error);
    res.status(500).json({ error: 'Scrape failed', message: (error as Error).message });
  }
});

router.get('/sources', checkLiv2Enabled, async (req, res) => {
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
    console.error('[Marketplace] Get sources error:', error);
    res.status(500).json({ error: 'Failed to get sources' });
  }
});

router.get('/allowed-domains', (req, res) => {
  res.json({
    domains: getAllowedMarinaDomains(),
    ssrfProtection: {
      enabled: true,
      blockedRanges: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8', '169.254.0.0/16'],
      blockedProtocols: ['file://', 'ftp://', 'gopher://'],
      maxRedirects: 5,
      timeoutMs: LIV2_CONFIG.fetch.timeoutMs,
    },
  });
});

const duplicatesQuerySchema = z.object({
  minConfidence: z.string().optional().transform(val => val ? parseInt(val, 10) : 60),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 100),
  domain: z.string().optional(),
  state: z.string().optional(),
});

router.get('/duplicates', checkLiv2Enabled, async (req, res) => {
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
    console.error('[Marketplace] Get duplicates error:', error);
    res.status(500).json({ error: 'Failed to get duplicates' });
  }
});

const mergeSchema = z.object({
  primaryListingId: z.string(),
  secondaryListingId: z.string(),
});

router.post('/duplicates/merge', checkLiv2Enabled, async (req, res) => {
  try {
    const { primaryListingId, secondaryListingId } = mergeSchema.parse(req.body);
    
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
    console.error('[Marketplace] Merge error:', error);
    res.status(500).json({ error: 'Failed to merge listings' });
  }
});

router.get('/status', (req, res) => {
  res.json({
    enabled: isLiv2Enabled(),
    config: {
      extractorVersion: LIV2_CONFIG.extractorVersion,
      confidenceThreshold: LIV2_CONFIG.identity.confidenceThreshold,
      maxCandidatesPerRun: LIV2_CONFIG.identity.maxCandidatesPerRun,
      fetchTimeout: LIV2_CONFIG.fetch.timeoutMs,
    },
    ssrfProtection: {
      enabled: true,
      blockedRanges: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8'],
      maxRedirects: 5,
    },
    allowedDomains: getAllowedMarinaDomains(),
  });
});

router.get('/broker-sources', (req, res) => {
  const { type, frequency, activeOnly } = req.query;
  
  let sources = BROKER_SOURCES;
  
  if (type && typeof type === 'string') {
    sources = getBrokerSourcesByType(type as any);
  }
  
  if (frequency && typeof frequency === 'string') {
    sources = sources.filter(s => s.frequency === frequency);
  }
  
  if (activeOnly === 'true') {
    sources = sources.filter(s => s.isActive);
  }
  
  res.json({
    sources: sources.map(s => ({
      name: s.name,
      domain: s.domain,
      type: s.type,
      sourceType: s.sourceType,
      frequency: s.frequency,
      isActive: s.isActive,
      description: s.description,
      rules: {
        urlPatterns: s.rules.urlPatterns,
        rateLimit: s.rules.rateLimit,
      },
    })),
    totalCount: sources.length,
    activeCount: sources.filter(s => s.isActive).length,
    bySourceType: {
      broker: sources.filter(s => s.sourceType === 'broker').length,
      listing_site: sources.filter(s => s.sourceType === 'listing_site').length,
      mls: sources.filter(s => s.sourceType === 'mls').length,
    },
    byFrequency: {
      weekly: sources.filter(s => s.frequency === 'weekly').length,
      'bi-weekly': sources.filter(s => s.frequency === 'bi-weekly').length,
      daily: sources.filter(s => s.frequency === 'daily').length,
      monthly: sources.filter(s => s.frequency === 'monthly').length,
    },
  });
});

router.post('/broker-sources/seed', checkLiv2Enabled, async (req, res) => {
  try {
    const activeSources = getActiveBrokerSources();
    const results: Array<{ domain: string; status: 'created' | 'exists' | 'error'; id?: string; error?: string }> = [];
    
    for (const source of activeSources) {
      try {
        const existing = await liv2Repo.getSourceByDomain(source.domain);
        
        if (existing) {
          results.push({ domain: source.domain, status: 'exists', id: existing.id });
          continue;
        }
        
        const created = await liv2Repo.createSource({
          name: source.name,
          domain: source.domain,
          type: source.type,
          rules: source.rules,
          isActive: source.isActive,
        });
        
        results.push({ domain: source.domain, status: 'created', id: created.id });
      } catch (error) {
        results.push({ domain: source.domain, status: 'error', error: (error as Error).message });
      }
    }
    
    res.json({
      success: true,
      summary: {
        total: activeSources.length,
        created: results.filter(r => r.status === 'created').length,
        existing: results.filter(r => r.status === 'exists').length,
        errors: results.filter(r => r.status === 'error').length,
      },
      results,
    });
  } catch (error) {
    console.error('[Marketplace] Seed broker sources error:', error);
    res.status(500).json({ error: 'Failed to seed broker sources', message: (error as Error).message });
  }
});

router.get('/identity-resolution/:listingId', checkLiv2Enabled, async (req, res) => {
  try {
    const { listingId } = req.params;
    const listing = await liv2Repo.getCurrentListingById(listingId);
    
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    const allListings = await liv2Repo.getCurrentListings({ limit: 500 });
    const duplicates = findDuplicatesForListing(listing, allListings, 50);
    
    const getVerificationStatus = (confidence: number): 'verified' | 'unverified' | 'potential_duplicate' => {
      if (confidence >= 90) return 'potential_duplicate';
      if (confidence >= 70) return 'unverified';
      return 'verified';
    };
    
    const getConfidenceTier = (confidence: number): 'high' | 'medium' | 'low' => {
      if (confidence >= 90) return 'high';
      if (confidence >= 70) return 'medium';
      return 'low';
    };
    
    res.json({
      listing: {
        id: listing.id,
        canonicalListingId: listing.canonicalListingId,
        title: listing.title,
        city: listing.city,
        state: listing.state,
        domain: listing.domain,
      },
      identityResolution: {
        isVerified: duplicates.length === 0,
        verificationStatus: duplicates.length > 0 
          ? getVerificationStatus(duplicates[0].confidence) 
          : 'verified',
        potentialDuplicates: duplicates.length,
        matches: duplicates.map(d => ({
          matchedListingId: d.listing2.canonicalListingId,
          matchedTitle: d.listing2.title,
          matchedDomain: d.listing2.domain,
          confidence: d.confidence,
          confidencePercent: `${d.confidence}%`,
          confidenceTier: getConfidenceTier(d.confidence),
          matchReasons: d.matchReasons,
          scores: d.scores,
        })),
      },
    });
  } catch (error) {
    console.error('[Marketplace] Identity resolution error:', error);
    res.status(500).json({ error: 'Failed to get identity resolution data' });
  }
});

export default router;
