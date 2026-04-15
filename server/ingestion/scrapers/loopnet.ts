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
 * LoopNet adapter — commercial real estate listings.
 *
 * LoopNet publishes schema.org/Product and schema.org/RealEstateListing JSON-LD
 * on public detail pages, which this adapter parses. Live crawling is gated
 * behind INGESTION_V3_LIVE_FETCH=true to prevent accidental ToS violations;
 * the default is to return an empty result set so runScrape() records a
 * clean run. Do not enable live crawling without a licensed feed or an
 * approved crawler agreement with CoStar / LoopNet.
 */
export class LoopNetAdapter extends ScraperAdapter {
  readonly sourceDomain = 'loopnet.com';
  readonly sourceName = 'LoopNet';
  readonly defaultCategory: ListingCategory = 'cre_property';

  private readonly searchUrl = 'https://www.loopnet.com/for-sale/';
  private readonly rateLimitPerMin = 20;

  async fetchListings(options: {
    maxListings?: number;
    sinceHours?: number;
  }): Promise<RawListing[]> {
    if (process.env.INGESTION_V3_LIVE_FETCH !== 'true') {
      console.warn(
        '[loopnet] Live fetch disabled (set INGESTION_V3_LIVE_FETCH=true to enable). Returning [].',
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
            `[loopnet] Skipped ${url}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    } catch (err) {
      console.error(
        '[loopnet] Search index fetch failed:',
        err instanceof Error ? err.message : err,
      );
    }

    return listings;
  }

  /** Pull detail-page URLs out of a LoopNet search results page. */
  extractDetailUrlsFromSearch(html: string): string[] {
    const $ = loadHtml(html);
    const urls = new Set<string>();
    $('a[href*="/Listing/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      try {
        const absolute = new URL(href, 'https://www.loopnet.com').toString();
        if (absolute.includes('/Listing/')) urls.add(absolute);
      } catch {
        /* ignore */
      }
    });
    return Array.from(urls);
  }

  /** Parse a LoopNet detail page into a RawListing. */
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

    const address = coerceAddress(product.address);
    const price = coercePrice(product.offers) ?? parseMoney(meta.description);
    const currency = coerceCurrency(product.offers) ?? 'USD';
    const images = coerceImages(product.image);
    if (images.length === 0 && meta.ogImage) images.push(meta.ogImage);

    // LoopNet detail pages render a dt/dd list of listing facts; harvest
    // the cap rate / NOI / building size / year built fallbacks here.
    const facts: Record<string, string> = {};
    $('dt').each((_, dt) => {
      const key = $(dt).text().trim().toLowerCase();
      const val = $(dt).next('dd').text().trim();
      if (key && val) facts[key] = val;
    });

    const capRate = parseMoney(facts['cap rate']);
    const noi = parseMoney(facts['noi'] || facts['net operating income']);
    const sqft = parseMoney(facts['building size'] || facts['rentable building area']);
    const yearBuilt = parseMoney(facts['year built']);
    const lotSize = parseMoney(facts['lot size']);

    const title = product.name || meta.title;
    if (!title) return null;

    const sourceListingId = (() => {
      const match = url.match(/\/Listing\/(?:[^/]+\/)?(\d+)/i);
      return match ? match[1] : url;
    })();

    return {
      sourceListingId,
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
        product.category || product.additionalType || meta.title || title,
      broker: this.extractBroker($),
      publishedAt: product.datePosted ? new Date(product.datePosted) : undefined,
      raw: {
        jsonLd: product,
        facts,
        capRate,
        noi,
        sqft,
        yearBuilt,
        lotSize,
      },
    };
  }

  private extractBroker($: ReturnType<typeof loadHtml>) {
    const name =
      $('[data-qa-id="broker-name"]').first().text().trim() ||
      $('.broker-card__name').first().text().trim() ||
      undefined;
    const company =
      $('[data-qa-id="broker-company"]').first().text().trim() ||
      $('.broker-card__company').first().text().trim() ||
      undefined;
    const email = $('a[href^="mailto:"]').first().attr('href')?.replace('mailto:', '');
    const phone = $('a[href^="tel:"]').first().attr('href')?.replace('tel:', '');
    if (!name && !company && !email && !phone) return undefined;
    return { name, company, email, phone };
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
        year_built: src.yearBuilt,
        lot_size_sqft: src.lotSize,
      },
    };
  }
}
