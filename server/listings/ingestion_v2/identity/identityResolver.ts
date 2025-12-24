import { createHash } from 'crypto';
import * as cheerio from 'cheerio';

export interface IdentityResult {
  canonicalUrl: string;
  stableSourceKey: string;
  confidence: number;
  matchBasis: 'explicit_id' | 'canonical_url' | 'jsonld' | 'address_geo_fallback';
  canonicalListingId: string;
}

export interface IdentityResolverOptions {
  domain: string;
  url: string;
  finalUrl: string;
  html: string;
  selectors?: {
    listingId?: string;
  };
  urlPatterns?: {
    listingIdPattern?: string;
  };
}

export function resolveListingIdentity(options: IdentityResolverOptions): IdentityResult {
  const { domain, url, finalUrl, html, selectors, urlPatterns } = options;
  const $ = cheerio.load(html);
  
  const canonicalUrl = extractCanonicalUrl($, finalUrl);
  
  const jsonLdResult = tryJsonLdIdentity($, domain);
  if (jsonLdResult) {
    return {
      canonicalUrl,
      stableSourceKey: jsonLdResult.stableKey,
      confidence: 95,
      matchBasis: 'jsonld',
      canonicalListingId: generateCanonicalId(domain, jsonLdResult.stableKey),
    };
  }
  
  if (selectors?.listingId) {
    const domId = $(selectors.listingId).first().text().trim();
    if (domId && domId.length > 0 && domId.length < 100) {
      return {
        canonicalUrl,
        stableSourceKey: domId,
        confidence: 90,
        matchBasis: 'explicit_id',
        canonicalListingId: generateCanonicalId(domain, domId),
      };
    }
  }
  
  const urlIdResult = tryUrlIdentity(canonicalUrl, urlPatterns?.listingIdPattern);
  if (urlIdResult) {
    return {
      canonicalUrl,
      stableSourceKey: urlIdResult,
      confidence: 80,
      matchBasis: 'canonical_url',
      canonicalListingId: generateCanonicalId(domain, urlIdResult),
    };
  }
  
  const addressResult = tryAddressGeoFallback($, domain);
  if (addressResult) {
    return {
      canonicalUrl,
      stableSourceKey: addressResult.stableKey,
      confidence: addressResult.confidence,
      matchBasis: 'address_geo_fallback',
      canonicalListingId: generateCanonicalId(domain, addressResult.stableKey),
    };
  }
  
  const fallbackKey = createHash('sha256').update(canonicalUrl).digest('hex').slice(0, 32);
  return {
    canonicalUrl,
    stableSourceKey: fallbackKey,
    confidence: 40,
    matchBasis: 'canonical_url',
    canonicalListingId: generateCanonicalId(domain, fallbackKey),
  };
}

function extractCanonicalUrl($: cheerio.CheerioAPI, fallbackUrl: string): string {
  const canonicalLink = $('link[rel="canonical"]').attr('href');
  if (canonicalLink) {
    try {
      return new URL(canonicalLink, fallbackUrl).href;
    } catch {
    }
  }
  
  const ogUrl = $('meta[property="og:url"]').attr('content');
  if (ogUrl) {
    try {
      return new URL(ogUrl, fallbackUrl).href;
    } catch {
    }
  }
  
  return fallbackUrl;
}

function tryJsonLdIdentity($: cheerio.CheerioAPI, domain: string): { stableKey: string } | null {
  const scripts = $('script[type="application/ld+json"]');
  
  for (let i = 0; i < scripts.length; i++) {
    try {
      const content = $(scripts[i]).html();
      if (!content) continue;
      
      const data = JSON.parse(content);
      const items = Array.isArray(data) ? data : [data];
      
      for (const item of items) {
        const idFields = ['@id', 'productID', 'sku', 'mlsNumber', 'listingId', 'identifier'];
        for (const field of idFields) {
          if (item[field] && typeof item[field] === 'string') {
            return { stableKey: item[field] };
          }
        }
        
        if (item.identifier) {
          if (typeof item.identifier === 'string') {
            return { stableKey: item.identifier };
          }
          if (typeof item.identifier === 'object' && item.identifier.value) {
            return { stableKey: String(item.identifier.value) };
          }
        }
      }
    } catch {
    }
  }
  
  return null;
}

function tryUrlIdentity(url: string, pattern?: string): string | null {
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname;
    
    if (pattern) {
      const regex = new RegExp(pattern);
      const match = pathname.match(regex);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    const commonPatterns = [
      /\/listing[s]?\/([a-zA-Z0-9_-]+)/i,
      /\/property\/([a-zA-Z0-9_-]+)/i,
      /\/p\/([a-zA-Z0-9_-]+)/i,
      /\/id\/([a-zA-Z0-9_-]+)/i,
      /\/([0-9]+)(?:\/|$)/,
      /[?&]id=([a-zA-Z0-9_-]+)/i,
      /[?&]listingId=([a-zA-Z0-9_-]+)/i,
    ];
    
    for (const p of commonPatterns) {
      const match = (pathname + parsedUrl.search).match(p);
      if (match && match[1] && match[1].length >= 3) {
        return match[1];
      }
    }
    
    const segments = pathname.split('/').filter(s => s.length > 0);
    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      if (lastSegment.length >= 5 && /[a-zA-Z0-9]/.test(lastSegment)) {
        return pathname;
      }
    }
  } catch {
  }
  
  return null;
}

function tryAddressGeoFallback($: cheerio.CheerioAPI, domain: string): { stableKey: string; confidence: number } | null {
  let address = '';
  let lat: number | null = null;
  let lng: number | null = null;
  
  const addressSelectors = [
    '[itemprop="address"]',
    '[class*="address"]',
    '[data-address]',
    '.listing-address',
    '.property-address',
  ];
  
  for (const sel of addressSelectors) {
    const text = $(sel).first().text().trim();
    if (text && text.length > 10 && text.length < 500) {
      address = text;
      break;
    }
  }
  
  const scripts = $('script').toArray();
  for (const script of scripts) {
    const content = $(script).html() || '';
    const latMatch = content.match(/["']?(?:lat|latitude)["']?\s*[:=]\s*(-?\d+\.?\d*)/i);
    const lngMatch = content.match(/["']?(?:lng|longitude|lon)["']?\s*[:=]\s*(-?\d+\.?\d*)/i);
    if (latMatch && lngMatch) {
      lat = parseFloat(latMatch[1]);
      lng = parseFloat(lngMatch[1]);
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        lat = null;
        lng = null;
      } else {
        break;
      }
    }
  }
  
  if (!address) {
    return null;
  }
  
  const normalizedAddress = normalizeAddress(address);
  
  let keyParts = [domain, normalizedAddress];
  let confidence = 55;
  
  if (lat !== null && lng !== null) {
    keyParts.push(lat.toFixed(4));
    keyParts.push(lng.toFixed(4));
    confidence = 65;
  }
  
  const stableKey = createHash('sha256').update(keyParts.join('|')).digest('hex');
  
  return { stableKey, confidence };
}

function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|boulevard|blvd|way|place|pl)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function generateCanonicalId(domain: string, stableKey: string): string {
  return createHash('sha256').update(`${domain}::${stableKey}`).digest('hex');
}

export function isConfidenceAcceptable(confidence: number, threshold: number = 75): boolean {
  return confidence >= threshold;
}
