import { ScraperAdapter } from './base';
import type { RawListing, NormalizedListing, ListingCategory } from './base';
import { classifyFromText } from '@shared/marketplace/asset-class-taxonomy';
import { DEFAULT_USER_AGENT, politeGet } from '../fetch/http-client';
import {
  coerceAddress,
  coerceCurrency,
  coerceImages,
  coercePrice,
  extractJsonLd,
  extractMeta,
  findSchemaEntity,
  loadHtml,
  parseMoney,
} from '../fetch/html-extract';

/**
 * Crexi adapter — commercial real estate listings.
 *
 * Crexi detail pages ship a JSON-LD `Product` block plus a client-side
 * Next.js data blob in `#__NEXT_DATA__`. This adapter prefers JSON-LD and
 * falls back to __NEXT_DATA__ for fields that aren't in the public schema
 * markup. Live fetching is gated on INGESTION_V3_LIVE_FETCH=true.
 */
export class CrexiAdapter extends ScraperAdapter {
  readonly sourceDomain = 'crexi.com';
  readonly sourceName = 'Crexi';
  readonly defaultCategory: ListingCategory = 'cre_property';

  private readonly searchUrl = 'https://www.crexi.com/properties/for-sale';
  private readonly rateLimitPerMin = 20;

  async fetchListings(options: {
    maxListings?: number;
  }): Promise<RawListing[]> {
    if (process.env.INGESTION_V3_LIVE_FETCH !== 'true') {
      console.warn(
        '[crexi] Live fetch disabled (set INGESTION_V3_LIVE_FETCH=true to enable). Returning [].',
      );
      return [];
    }

    const max = Math.min(options.maxListings ?? 50, 200);
    const listings: RawListing[] = [];
    try {
      const index = await politeGet(this.searchUrl, {
        userAgent: DEFAULT_USER_AGENT,
        requestsPerMinute: this.rateLimitPerMin,
      });
      const urls = this.extractDetailUrlsFromSearch(index.text).slice(0, max);
      for (const url of urls) {
        try {
          const detail = await politeGet(url, {
            userAgent: DEFAULT_USER_AGENT,
            requestsPerMinute: this.rateLimitPerMin,
          });
          const parsed = this.parseDetailPage(url, detail.text);
          if (parsed) listings.push(parsed);
        } catch (err) {
          console.warn(
            `[crexi] Skipped ${url}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    } catch (err) {
      console.error(
        '[crexi] Index fetch failed:',
        err instanceof Error ? err.message : err,
      );
    }
    return listings;
  }

  extractDetailUrlsFromSearch(html: string): string[] {
    const $ = loadHtml(html);
    const urls = new Set<string>();
    $('a[href*="/properties/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      try {
        const absolute = new URL(href, 'https://www.crexi.com').toString();
        if (/\/properties\/[^/]+\/[^/?#]+/.test(absolute)) urls.add(absolute);
      } catch {
        /* ignore */
      }
    });
    return Array.from(urls);
  }

  parseDetailPage(url: string, html: string): RawListing | null {
    const $ = loadHtml(html);
    const meta = extractMeta($);
    const jsonLd = extractJsonLd($);
    const product =
      findSchemaEntity(jsonLd, [
        'Product',
        'Place',
        'LocalBusiness',
        'RealEstateListing',
      ]) || {};

    const nextData = this.parseNextData($);
    const listingNode = this.findListingInNextData(nextData);

    const title = product.name || meta.title || listingNode?.name;
    if (!title) return null;

    const address = coerceAddress(product.address) ?? {};
    if (!address.city && listingNode?.city) address.city = listingNode.city;
    if (!address.state && listingNode?.state) address.state = listingNode.state;

    const price =
      coercePrice(product.offers) ??
      (typeof listingNode?.askingPrice === 'number' ? listingNode.askingPrice : undefined);
    const currency = coerceCurrency(product.offers) ?? 'USD';
    const images = coerceImages(product.image);
    if (images.length === 0 && meta.ogImage) images.push(meta.ogImage);

    const sourceListingId = listingNode?.id || listingNode?.listingId || url;
    const capRate =
      typeof listingNode?.capRate === 'number'
        ? listingNode.capRate
        : parseMoney(listingNode?.capRate);
    const noi =
      typeof listingNode?.netOperatingIncome === 'number'
        ? listingNode.netOperatingIncome
        : parseMoney(listingNode?.noi);
    const sqft =
      typeof listingNode?.squareFeet === 'number'
        ? listingNode.squareFeet
        : parseMoney(listingNode?.sqft);

    return {
      sourceListingId: String(sourceListingId),
      sourceUrl: meta.canonicalUrl || url,
      title: String(title).trim(),
      description: product.description || meta.description,
      askingPrice: price,
      currency,
      location: {
        city: address.city,
        state: address.state,
        zip: address.zip,
        country: address.country || 'US',
      },
      images,
      rawCategoryLabel:
        product.category || listingNode?.propertyType || meta.title,
      broker: listingNode?.broker
        ? {
            name: listingNode.broker.name,
            company: listingNode.broker.company,
            email: listingNode.broker.email,
            phone: listingNode.broker.phone,
          }
        : undefined,
      publishedAt: listingNode?.dateListed ? new Date(listingNode.dateListed) : undefined,
      raw: { jsonLd: product, nextDataListing: listingNode, capRate, noi, sqft },
    };
  }

  private parseNextData($: ReturnType<typeof loadHtml>): any {
    const txt = $('#__NEXT_DATA__').first().contents().text();
    if (!txt) return null;
    try {
      return JSON.parse(txt);
    } catch {
      return null;
    }
  }

  /** Walk the Next.js data blob looking for the first object that looks like a listing. */
  private findListingInNextData(root: any): any | null {
    if (!root || typeof root !== 'object') return null;
    const seen = new Set<any>();
    const queue: any[] = [root];
    while (queue.length > 0) {
      const node = queue.shift();
      if (!node || typeof node !== 'object' || seen.has(node)) continue;
      seen.add(node);
      if (
        typeof node.id !== 'undefined' &&
        (typeof node.askingPrice === 'number' ||
          typeof node.propertyType === 'string' ||
          typeof node.squareFeet === 'number')
      ) {
        return node;
      }
      for (const key of Object.keys(node)) {
        const child = node[key];
        if (child && typeof child === 'object') queue.push(child);
      }
    }
    return null;
  }

  normalize(raw: RawListing): NormalizedListing {
    const assetClass =
      classifyFromText(raw.rawCategoryLabel || raw.title) || 'office_class_b';
    const src = raw.raw || {};
    return {
      listingCategory: this.defaultCategory,
      assetClass,
      source: {
        id: this.sourceDomain,
        name: this.sourceName,
        domain: this.sourceDomain,
      },
      raw,
      creMetrics: {
        cap_rate: src.capRate,
        noi: src.noi,
        sqft: src.sqft,
      },
    };
  }
}
