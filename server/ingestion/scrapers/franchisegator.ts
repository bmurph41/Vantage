import { ScraperAdapter } from './base';
import type { RawListing, NormalizedListing, ListingCategory } from './base';
import { classifyFromText } from '@shared/marketplace/asset-class-taxonomy';
import { DEFAULT_USER_AGENT, politeGet } from '../fetch/http-client';
import {
  coerceImages,
  extractJsonLd,
  extractMeta,
  findSchemaEntity,
  loadHtml,
  parseMoney,
} from '../fetch/html-extract';

/**
 * Franchise Gator adapter — franchise opportunities.
 *
 * Franchise Gator detail pages expose a deterministic block of franchise
 * economics (minimum investment, franchise fee, liquid capital required,
 * cash investment, royalty, total units, year founded). Live fetching is
 * gated on INGESTION_V3_LIVE_FETCH=true.
 */
export class FranchiseGatorAdapter extends ScraperAdapter {
  readonly sourceDomain = 'franchisegator.com';
  readonly sourceName = 'Franchise Gator';
  readonly defaultCategory: ListingCategory = 'franchise';

  private readonly searchUrl = 'https://www.franchisegator.com/directory/';
  private readonly rateLimitPerMin = 15;

  async fetchListings(options: {
    maxListings?: number;
  }): Promise<RawListing[]> {
    if (process.env.INGESTION_V3_LIVE_FETCH !== 'true') {
      console.warn(
        '[franchisegator] Live fetch disabled (set INGESTION_V3_LIVE_FETCH=true to enable). Returning [].',
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
            `[franchisegator] Skipped ${url}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    } catch (err) {
      console.error(
        '[franchisegator] Index fetch failed:',
        err instanceof Error ? err.message : err,
      );
    }
    return listings;
  }

  extractDetailUrlsFromSearch(html: string): string[] {
    const $ = loadHtml(html);
    const urls = new Set<string>();
    $('a[href*="/franchise/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      try {
        const absolute = new URL(href, 'https://www.franchisegator.com').toString();
        if (/\/franchise\/[^/]+\/?$/.test(absolute)) urls.add(absolute);
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
      findSchemaEntity(jsonLd, ['Product', 'Organization', 'LocalBusiness']) || {};

    // Franchise sites use distinctive label rows; collect from tables and dl.
    const facts: Record<string, string> = {};
    $('table tr').each((_, tr) => {
      const cells = $(tr).find('td, th');
      if (cells.length >= 2) {
        const key = $(cells[0]).text().trim().toLowerCase();
        const val = $(cells[1]).text().trim();
        if (key && val) facts[key] = val;
      }
    });
    $('dl dt').each((_, dt) => {
      const key = $(dt).text().trim().toLowerCase();
      const val = $(dt).next('dd').text().trim();
      if (key && val) facts[key] = val;
    });

    const minInvestment =
      parseMoney(facts['minimum investment']) ??
      parseMoney(facts['min investment']) ??
      parseMoney(facts['total investment']);
    const maxInvestment = parseMoney(facts['maximum investment']);
    const franchiseFee = parseMoney(facts['franchise fee']);
    const liquidCapital =
      parseMoney(facts['liquid capital required']) ?? parseMoney(facts['liquid capital']);
    const cashInvestment = parseMoney(facts['cash investment']);
    const royaltyFee = parseMoney(facts['royalty fee']);
    const totalUnits = parseMoney(facts['total units']);
    const yearFounded = parseMoney(facts['year founded'] || facts['founded']);

    const title = product.name || meta.title;
    if (!title) return null;

    const sourceListingId = (() => {
      const m = url.match(/\/franchise\/([^/?#]+)/);
      return m ? m[1] : url;
    })();
    const images = coerceImages(product.image);
    if (images.length === 0 && meta.ogImage) images.push(meta.ogImage);

    return {
      sourceListingId,
      sourceUrl: meta.canonicalUrl || url,
      title: String(title).trim(),
      description: product.description || meta.description,
      askingPrice: minInvestment, // Franchises quote minimum investment rather than price
      currency: 'USD',
      location: { isConfidential: true, country: 'US' },
      images,
      rawCategoryLabel: facts['industry'] || facts['category'] || title,
      raw: {
        facts,
        minInvestment,
        maxInvestment,
        franchiseFee,
        liquidCapital,
        cashInvestment,
        royaltyFee,
        totalUnits,
        yearFounded,
      },
    };
  }

  normalize(raw: RawListing): NormalizedListing {
    const assetClass =
      classifyFromText(raw.rawCategoryLabel || raw.title) || 'franchise_food_service';
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
      businessMetrics: {
        yearEstablished: src.yearFounded,
      },
      creMetrics: {
        min_investment: src.minInvestment,
        max_investment: src.maxInvestment,
        franchise_fee: src.franchiseFee,
        liquid_capital_required: src.liquidCapital,
        cash_investment: src.cashInvestment,
        royalty_fee_pct: src.royaltyFee,
        total_units: src.totalUnits,
      },
    };
  }
}
