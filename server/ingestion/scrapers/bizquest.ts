import { ScraperAdapter } from './base';
import type { RawListing, NormalizedListing, ListingCategory } from './base';
import { classifyFromText } from '@shared/marketplace/asset-class-taxonomy';
import { DEFAULT_USER_AGENT, politeGet } from '../fetch/http-client';
import {
  coerceAddress,
  coerceImages,
  extractJsonLd,
  extractMeta,
  findSchemaEntity,
  loadHtml,
  parseMoney,
} from '../fetch/html-extract';

/**
 * BizQuest adapter — operating businesses for sale.
 *
 * BizQuest detail pages publish a dt/dd fact list under
 * `.business-facts`, with consistent labels like "Asking Price",
 * "Gross Revenue", "Cash Flow", "EBITDA", "Inventory", etc. This adapter
 * pulls that list plus JSON-LD product markup when available. Live fetching
 * is gated on INGESTION_V3_LIVE_FETCH=true.
 */
export class BizQuestAdapter extends ScraperAdapter {
  readonly sourceDomain = 'bizquest.com';
  readonly sourceName = 'BizQuest';
  readonly defaultCategory: ListingCategory = 'operating_business';

  private readonly searchUrl = 'https://www.bizquest.com/businesses-for-sale/';
  private readonly rateLimitPerMin = 15;

  async fetchListings(options: {
    maxListings?: number;
  }): Promise<RawListing[]> {
    if (process.env.INGESTION_V3_LIVE_FETCH !== 'true') {
      console.warn(
        '[bizquest] Live fetch disabled (set INGESTION_V3_LIVE_FETCH=true to enable). Returning [].',
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
            `[bizquest] Skipped ${url}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    } catch (err) {
      console.error(
        '[bizquest] Index fetch failed:',
        err instanceof Error ? err.message : err,
      );
    }
    return listings;
  }

  extractDetailUrlsFromSearch(html: string): string[] {
    const $ = loadHtml(html);
    const urls = new Set<string>();
    $('a[href*="/business-for-sale/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      try {
        const absolute = new URL(href, 'https://www.bizquest.com').toString();
        if (/\/business-for-sale\/[^/]+\/BW\d+/i.test(absolute)) urls.add(absolute);
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
    const product = findSchemaEntity(jsonLd, ['Product', 'LocalBusiness']) || {};

    const facts: Record<string, string> = {};
    $('.business-facts dt, .business-details dt, dl dt').each((_, dt) => {
      const key = $(dt).text().trim().toLowerCase();
      const val = $(dt).next('dd').text().trim();
      if (key && val) facts[key] = val;
    });
    // Also harvest definition-list-like rows rendered as <li><strong>Label</strong> Value</li>.
    $('li').each((_, li) => {
      const strong = $(li).find('strong, b').first();
      if (!strong.length) return;
      const key = strong.text().trim().toLowerCase().replace(/:$/, '');
      const val = $(li).text().replace(strong.text(), '').trim();
      if (key && val && !(key in facts)) facts[key] = val;
    });

    const askingPrice = parseMoney(facts['asking price'] || facts['price']);
    const revenue = parseMoney(facts['gross revenue'] || facts['annual revenue']);
    const sde = parseMoney(facts['cash flow'] || facts['sde']);
    const ebitda = parseMoney(facts['ebitda']);
    const yearEst = parseMoney(facts['year established']);
    const employees = parseMoney(facts['employees']);
    const inventory = parseMoney(facts['inventory']);
    const ffe = parseMoney(facts['ff&e'] || facts['ffe']);
    const realEstate = /yes|included/i.test(facts['real estate'] || '');
    const sellerFinancing = /yes|available/i.test(
      facts['seller financing'] || facts['financing'] || '',
    );

    const title = product.name || meta.title;
    if (!title) return null;

    const address = coerceAddress(product.address);
    const sourceListingId = (() => {
      const m = url.match(/\/(BW\d+)/i);
      return m ? m[1] : url;
    })();
    const images = coerceImages(product.image);
    if (images.length === 0 && meta.ogImage) images.push(meta.ogImage);

    return {
      sourceListingId,
      sourceUrl: meta.canonicalUrl || url,
      title: String(title).trim(),
      description: product.description || meta.description,
      askingPrice,
      currency: 'USD',
      location: {
        city: address.city ?? facts['city'],
        state: address.state ?? facts['state'],
        zip: address.zip,
        country: 'US',
      },
      images,
      rawCategoryLabel: facts['business category'] || facts['industry'] || title,
      broker: this.extractBroker($),
      raw: {
        facts,
        revenue,
        sde,
        ebitda,
        yearEst,
        employees,
        inventory,
        ffe,
        realEstate,
        sellerFinancing,
      },
    };
  }

  private extractBroker($: ReturnType<typeof loadHtml>) {
    const name = $('.broker-name').first().text().trim() || undefined;
    const company = $('.broker-office').first().text().trim() || undefined;
    const phone = $('a[href^="tel:"]').first().attr('href')?.replace('tel:', '');
    const email = $('a[href^="mailto:"]').first().attr('href')?.replace('mailto:', '');
    if (!name && !company && !phone && !email) return undefined;
    return { name, company, phone, email };
  }

  normalize(raw: RawListing): NormalizedListing {
    const assetClass =
      classifyFromText(raw.rawCategoryLabel || raw.title) || 'biz_services';
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
        annualRevenue: src.revenue,
        annualCashflowSde: src.sde,
        annualEbitda: src.ebitda,
        yearEstablished: src.yearEst,
        employeeCount: src.employees,
        inventoryValue: src.inventory,
        ffeValue: src.ffe,
        realEstateIncluded: src.realEstate,
        sellerFinancingAvailable: src.sellerFinancing,
      },
    };
  }
}
