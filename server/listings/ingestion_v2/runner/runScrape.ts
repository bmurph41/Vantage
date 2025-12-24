import { ssrfSafeFetch } from '../fetch/ssrfFetch';
import { resolveListingIdentity, isConfidenceAcceptable } from '../identity/identityResolver';
import { extractListingImages, selectHeroImage, downloadAndHashImage } from '../parse/images';
import { validateListingPayload, sanitizePayload, shouldQuarantine } from '../validate/validate';
import { checkSSRF } from '../fetch/ssrfGuard';
import { liv2Repo } from '../storage/repo';
import { LIV2_CONFIG } from '../config';
import type { ListingPayloadV2, Liv2Source, Liv2RunMetrics } from '../schema';
import * as cheerio from 'cheerio';

export interface ScrapeResult {
  runId: string;
  status: 'success' | 'partial' | 'failed';
  metrics: Liv2RunMetrics;
  errors: string[];
}

export async function runListingScrape(
  sourceId: string,
  urls: string[]
): Promise<ScrapeResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  
  const metrics: Liv2RunMetrics = {
    pagesDiscovered: urls.length,
    pagesFetched: 0,
    pagesFailed: 0,
    listingsExtracted: 0,
    listingsQuarantined: 0,
    imagesProcessed: 0,
    imagesVerified: 0,
    durationMs: 0,
  };
  
  const source = await liv2Repo.getSourceById(sourceId);
  if (!source) {
    throw new Error(`Source not found: ${sourceId}`);
  }
  
  const run = await liv2Repo.createRun(sourceId);
  
  try {
    for (const url of urls) {
      try {
        const ssrfCheck = checkSSRF(url);
        if (!ssrfCheck.allowed) {
          errors.push(`SSRF blocked: ${url} - ${ssrfCheck.reason}`);
          metrics.pagesFailed++;
          continue;
        }
        
        const result = await processListingUrl(run.id, source, url, metrics);
        
        if (result.success) {
          metrics.listingsExtracted++;
        } else if (result.quarantined) {
          metrics.listingsQuarantined++;
        } else {
          errors.push(result.error || `Failed to process: ${url}`);
        }
        
      } catch (error) {
        metrics.pagesFailed++;
        errors.push(`Error processing ${url}: ${(error as Error).message}`);
      }
    }
    
    metrics.durationMs = Date.now() - startTime;
    
    const status = metrics.pagesFailed > metrics.pagesFetched ? 'failed' : 
                   metrics.pagesFailed > 0 ? 'partial' : 'success';
    
    await liv2Repo.completeRun(run.id, status, metrics);
    
    return {
      runId: run.id,
      status,
      metrics,
      errors,
    };
    
  } catch (error) {
    metrics.durationMs = Date.now() - startTime;
    await liv2Repo.completeRun(run.id, 'failed', metrics);
    throw error;
  }
}

async function processListingUrl(
  runId: string,
  source: Liv2Source,
  url: string,
  metrics: Liv2RunMetrics
): Promise<{ success: boolean; quarantined?: boolean; error?: string }> {
  
  const fetchResult = await ssrfSafeFetch(url, {
    timeoutMs: LIV2_CONFIG.fetch.timeoutMs,
    maxRedirects: 5,
  });
  
  if (!fetchResult.success || !fetchResult.html) {
    metrics.pagesFailed++;
    
    const isSSRFBlocked = fetchResult.error?.startsWith('SSRF blocked');
    
    if (isSSRFBlocked) {
      await liv2Repo.quarantine({
        sourceId: source.id,
        url,
        canonicalUrl: fetchResult.finalUrl,
        canonicalListingId: '',
        identityConfidence: 0,
        reason: fetchResult.error || 'SSRF blocked',
      });
    }
    
    await liv2Repo.storeRawPage({
      runId,
      sourceId: source.id,
      url,
      finalUrl: fetchResult.finalUrl,
      statusCode: fetchResult.statusCode,
      error: fetchResult.error,
    });
    
    return { 
      success: false, 
      quarantined: isSSRFBlocked,
      error: fetchResult.error 
    };
  }
  
  metrics.pagesFetched++;
  
  await liv2Repo.storeRawPage({
    runId,
    sourceId: source.id,
    url,
    finalUrl: fetchResult.finalUrl,
    statusCode: fetchResult.statusCode,
    html: fetchResult.html,
  });
  
  const identity = resolveListingIdentity({
    domain: source.domain,
    url,
    finalUrl: fetchResult.finalUrl,
    html: fetchResult.html,
    selectors: source.rules?.contentSelectors,
  });
  
  const hasConflict = await liv2Repo.checkIdentityConflict(
    source.id,
    identity.canonicalUrl,
    identity.canonicalListingId
  );
  
  if (hasConflict) {
    await liv2Repo.quarantine({
      sourceId: source.id,
      url,
      canonicalUrl: identity.canonicalUrl,
      canonicalListingId: identity.canonicalListingId,
      identityConfidence: identity.confidence,
      reason: 'identity_conflict: canonical listing ID changed for same URL',
    });
    
    await liv2Repo.storeCandidate({
      runId,
      sourceId: source.id,
      url,
      canonicalUrl: identity.canonicalUrl,
      stableSourceKey: identity.stableSourceKey,
      identityConfidence: identity.confidence,
      canonicalListingId: identity.canonicalListingId,
      status: 'quarantined',
      reason: 'identity_conflict',
    });
    
    return { success: false, quarantined: true, error: 'Identity conflict detected' };
  }
  
  const payload = await extractPayload(source, url, fetchResult.html, fetchResult.finalUrl, identity);
  const sanitized = sanitizePayload(payload);
  const validation = validateListingPayload(sanitized);
  
  const quarantineCheck = shouldQuarantine(sanitized, validation);
  
  if (quarantineCheck.quarantine) {
    await liv2Repo.quarantine({
      sourceId: source.id,
      url,
      canonicalUrl: identity.canonicalUrl,
      canonicalListingId: identity.canonicalListingId,
      identityConfidence: identity.confidence,
      payload: sanitized,
      validation,
      reason: quarantineCheck.reason,
    });
    
    await liv2Repo.storeCandidate({
      runId,
      sourceId: source.id,
      url,
      canonicalUrl: identity.canonicalUrl,
      stableSourceKey: identity.stableSourceKey,
      identityConfidence: identity.confidence,
      canonicalListingId: identity.canonicalListingId,
      status: 'quarantined',
      reason: quarantineCheck.reason,
    });
    
    return { success: false, quarantined: true, error: quarantineCheck.reason };
  }
  
  await liv2Repo.storePayload({
    canonicalListingId: identity.canonicalListingId,
    sourceId: source.id,
    extractorVersion: LIV2_CONFIG.extractorVersion,
    payload: sanitized,
    validation,
  });
  
  for (const image of sanitized.media.images) {
    metrics.imagesProcessed++;
    
    let contentHash: string | undefined;
    let bytes: number | undefined;
    
    if (image.verified) {
      const downloaded = await downloadAndHashImage(
        image.urlNormalized,
        LIV2_CONFIG.images.maxImageBytes,
        LIV2_CONFIG.images.downloadTimeout
      );
      
      if (downloaded) {
        contentHash = downloaded.contentHash;
        bytes = downloaded.bytes;
        metrics.imagesVerified++;
      }
    }
    
    await liv2Repo.storeAsset({
      canonicalListingId: identity.canonicalListingId,
      sourceId: source.id,
      assetType: 'image',
      assetUrl: image.url,
      assetUrlNormalized: image.urlNormalized,
      originUrl: url,
      contentHash,
      bytes,
      verified: image.verified,
      verificationReason: image.verified ? 'Extracted from listing page' : undefined,
    });
  }
  
  await liv2Repo.upsertCurrentListing(sanitized, source.id);
  
  const importantFields = ['title', 'price', 'address', 'slips'];
  for (const field of importantFields) {
    const value = getFieldValue(sanitized, field);
    if (value !== undefined) {
      await liv2Repo.storeFieldProvenance({
        canonicalListingId: identity.canonicalListingId,
        sourceId: source.id,
        fieldName: field,
        fieldValue: value,
        originUrl: url,
        extractorVersion: LIV2_CONFIG.extractorVersion,
      });
    }
  }
  
  await liv2Repo.storeCandidate({
    runId,
    sourceId: source.id,
    url,
    canonicalUrl: identity.canonicalUrl,
    stableSourceKey: identity.stableSourceKey,
    identityConfidence: identity.confidence,
    canonicalListingId: identity.canonicalListingId,
    status: 'extracted',
  });
  
  return { success: true };
}

async function extractPayload(
  source: Liv2Source,
  url: string,
  html: string,
  finalUrl: string,
  identity: ReturnType<typeof resolveListingIdentity>
): Promise<ListingPayloadV2> {
  const $ = cheerio.load(html);
  const selectors = source.rules?.contentSelectors || {};
  
  const extractText = (selector: string | undefined, fallbacks: string[] = []): string | undefined => {
    if (selector) {
      const text = $(selector).first().text().trim();
      if (text) return text;
    }
    for (const fb of fallbacks) {
      const text = $(fb).first().text().trim();
      if (text) return text;
    }
    return undefined;
  };
  
  const title = extractText(selectors.title, ['h1', '.listing-title', '.property-title', '[itemprop="name"]']);
  const description = extractText(selectors.description, ['.description', '.listing-description', '[itemprop="description"]']);
  const priceText = extractText(selectors.price, ['.price', '.listing-price', '[itemprop="price"]']);
  const addressText = extractText(selectors.address, ['.address', '.listing-address', '[itemprop="address"]']);
  const brokerText = extractText(selectors.broker, ['.broker', '.agent', '.contact-name']);
  
  const price = parsePrice(priceText);
  const location = parseLocation(addressText, $);
  
  const images = extractListingImages({
    html,
    originUrl: finalUrl,
    domain: source.domain,
    gallerySelector: selectors.gallery,
    imageAllowPatterns: source.rules?.imageAllowPatterns,
  });
  
  const heroImageUrl = selectHeroImage(images);
  
  return {
    source: {
      domain: source.domain,
      url,
      canonicalUrl: identity.canonicalUrl,
      stableKey: identity.stableSourceKey,
    },
    identity: {
      canonicalListingId: identity.canonicalListingId,
      confidence: identity.confidence,
      matchBasis: identity.matchBasis,
    },
    core: {
      title,
      listingType: detectListingType(title, description),
      status: 'active',
    },
    pricing: {
      price: price ? { amount: price, currency: 'USD' } : undefined,
      priceType: 'asking',
    },
    location,
    details: {
      description,
      slips: extractSlips(description, $),
      acreage: extractAcreage(description, $),
      waterfrontFeet: extractWaterfrontFeet(description, $),
    },
    contacts: {
      brokerName: brokerText,
    },
    media: {
      images: images.map(i => ({
        url: i.url,
        urlNormalized: i.urlNormalized,
        verified: i.verified,
      })),
      heroImageUrl,
    },
    timestamps: {
      scrapedAt: new Date().toISOString(),
    },
  };
}

function parsePrice(priceText: string | undefined): number | undefined {
  if (!priceText) return undefined;
  
  const text = priceText.toLowerCase().trim();
  
  const millionMatch = text.match(/\$?([\d,.]+)\s*(m|mm|million)/i);
  if (millionMatch) {
    const num = parseFloat(millionMatch[1].replace(/,/g, ''));
    if (!isNaN(num)) return Math.round(num * 1_000_000);
  }
  
  const thousandMatch = text.match(/\$?([\d,.]+)\s*(k|thousand)/i);
  if (thousandMatch) {
    const num = parseFloat(thousandMatch[1].replace(/,/g, ''));
    if (!isNaN(num)) return Math.round(num * 1_000);
  }
  
  const cleaned = priceText.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  if (!isNaN(num) && num > 10000) return Math.round(num);
  
  return undefined;
}

function parseLocation(addressText: string | undefined, $: cheerio.CheerioAPI): ListingPayloadV2['location'] {
  const location: ListingPayloadV2['location'] = {};
  
  if (addressText) {
    location.address1 = addressText;
    
    const stateMatch = addressText.match(/\b([A-Z]{2})\b(?:\s+\d{5})?/);
    if (stateMatch) {
      location.state = stateMatch[1];
    }
    
    const zipMatch = addressText.match(/\b(\d{5})(?:-\d{4})?\b/);
    if (zipMatch) {
      location.postalCode = zipMatch[1];
    }
  }
  
  const lat = $('[itemprop="latitude"]').attr('content') || $('[data-lat]').attr('data-lat');
  const lng = $('[itemprop="longitude"]').attr('content') || $('[data-lng]').attr('data-lng');
  
  if (lat && lng) {
    location.lat = parseFloat(lat);
    location.lng = parseFloat(lng);
    location.geoPrecision = 'rooftop';
  }
  
  return location;
}

function detectListingType(title?: string, description?: string): ListingPayloadV2['core']['listingType'] {
  const text = `${title || ''} ${description || ''}`.toLowerCase();
  
  if (/\bmarina\b/.test(text)) return 'marina';
  if (/\brv\s*park\b/.test(text) || /\bcampground\b/.test(text)) return 'rv_park';
  if (/\bmixed[- ]?use\b/.test(text)) return 'mixed_use';
  if (/\bland\b/.test(text) && !/\bwaterfront\b/.test(text)) return 'land';
  if (/\bbusiness\b/.test(text) && !/\breal\s*estate\b/.test(text)) return 'business_only';
  
  return 'marina';
}

function extractSlips(description: string | undefined, $: cheerio.CheerioAPI): number | undefined {
  const text = `${description || ''} ${$('body').text()}`;
  const match = text.match(/(\d+)\s*(?:wet\s*)?slips?/i);
  if (match) return parseInt(match[1], 10);
  return undefined;
}

function extractAcreage(description: string | undefined, $: cheerio.CheerioAPI): number | undefined {
  const text = `${description || ''} ${$('body').text()}`;
  const match = text.match(/([\d.]+)\s*(?:acres?|ac\.?)/i);
  if (match) return parseFloat(match[1]);
  return undefined;
}

function extractWaterfrontFeet(description: string | undefined, $: cheerio.CheerioAPI): number | undefined {
  const text = `${description || ''} ${$('body').text()}`;
  const match = text.match(/([\d,]+)\s*(?:feet|ft\.?|linear\s*feet|lf)\s*(?:of\s*)?(?:waterfront|shoreline|water)/i);
  if (match) return parseInt(match[1].replace(/,/g, ''), 10);
  return undefined;
}

function getFieldValue(payload: ListingPayloadV2, field: string): unknown {
  switch (field) {
    case 'title': return payload.core?.title;
    case 'price': return payload.pricing?.price?.amount;
    case 'address': return payload.location?.address1;
    case 'slips': return payload.details?.slips;
    default: return undefined;
  }
}
