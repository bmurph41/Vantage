/**
 * Shared HTML extraction helpers used by scraper adapters.
 *
 * Most major CRE and business-brokerage sites embed schema.org structured
 * data (JSON-LD) for SEO. Where present this is by far the most reliable
 * source of canonical fields: @type, name, url, price, address, image, etc.
 * These helpers give adapters a uniform way to pull that out so they don't
 * each reinvent cheerio selectors.
 */

import * as cheerio from 'cheerio';

export interface ExtractedMeta {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogImage?: string;
}

export interface SchemaOrgEntity {
  type: string;
  raw: Record<string, any>;
}

export function loadHtml(html: string): cheerio.CheerioAPI {
  return cheerio.load(html);
}

/** Pull common <meta>/<link> tags used for title, description, canonical url, OG image. */
export function extractMeta($: cheerio.CheerioAPI): ExtractedMeta {
  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="twitter:title"]').attr('content') ||
    $('title').first().text() ||
    undefined;
  const description =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    undefined;
  const canonicalUrl =
    $('link[rel="canonical"]').attr('href') ||
    $('meta[property="og:url"]').attr('content') ||
    undefined;
  const ogImage =
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content') ||
    undefined;
  return {
    title: title?.trim(),
    description: description?.trim(),
    canonicalUrl: canonicalUrl?.trim(),
    ogImage: ogImage?.trim(),
  };
}

/**
 * Extract all JSON-LD entities from a page. Returns them flattened — entries
 * with @graph are expanded, and any nested arrays are flattened. Type is
 * coerced to a string (schema.org @type can be a string or array).
 */
export function extractJsonLd($: cheerio.CheerioAPI): SchemaOrgEntity[] {
  const out: SchemaOrgEntity[] = [];
  const collect = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach(collect);
      return;
    }
    if (Array.isArray(obj['@graph'])) {
      obj['@graph'].forEach(collect);
    }
    const raw = obj as Record<string, any>;
    const t = raw['@type'];
    if (t) {
      const type = Array.isArray(t) ? String(t[0]) : String(t);
      out.push({ type, raw });
    }
  };

  $('script[type="application/ld+json"]').each((_, el) => {
    const txt = $(el).contents().text();
    if (!txt) return;
    try {
      const parsed = JSON.parse(txt);
      collect(parsed);
    } catch {
      // Some sites emit invalid JSON-LD with trailing commas — tolerate silently.
    }
  });
  return out;
}

/** Find the first JSON-LD entity whose @type matches any of the candidates. */
export function findSchemaEntity(
  entities: SchemaOrgEntity[],
  typeCandidates: string[],
): Record<string, any> | null {
  const set = new Set(typeCandidates.map((t) => t.toLowerCase()));
  for (const e of entities) {
    if (set.has(e.type.toLowerCase())) return e.raw;
  }
  return null;
}

/** Coerce a schema.org PostalAddress into {city, state, zip, country}. */
export function coerceAddress(addr: any): {
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
} {
  if (!addr || typeof addr !== 'object') return {};
  return {
    city: strOrUndef(addr.addressLocality),
    state: strOrUndef(addr.addressRegion),
    zip: strOrUndef(addr.postalCode),
    country: strOrUndef(addr.addressCountry),
  };
}

/** Coerce a schema.org Offer / offers[] into a number price. */
export function coercePrice(offers: any): number | undefined {
  if (!offers) return undefined;
  const first = Array.isArray(offers) ? offers[0] : offers;
  if (!first || typeof first !== 'object') return undefined;
  const raw = first.price ?? first.priceSpecification?.price;
  if (raw == null) return undefined;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^0-9.\-]/g, ''));
  return isFinite(n) && n > 0 ? n : undefined;
}

export function coerceCurrency(offers: any): string | undefined {
  if (!offers) return undefined;
  const first = Array.isArray(offers) ? offers[0] : offers;
  return strOrUndef(first?.priceCurrency ?? first?.priceSpecification?.priceCurrency);
}

export function coerceImages(image: any): string[] {
  if (!image) return [];
  if (typeof image === 'string') return [image];
  if (Array.isArray(image)) {
    return image
      .map((i) => (typeof i === 'string' ? i : typeof i === 'object' ? i?.url : null))
      .filter((s): s is string => typeof s === 'string' && s.length > 0);
  }
  if (typeof image === 'object' && typeof image.url === 'string') return [image.url];
  return [];
}

function strOrUndef(v: any): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

/** Parse a number from arbitrary text ($1,250,000 → 1250000). */
export function parseMoney(text: string | null | undefined): number | undefined {
  if (!text) return undefined;
  const cleaned = String(text).replace(/[^0-9.\-]/g, '');
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return isFinite(n) && n > 0 ? n : undefined;
}
