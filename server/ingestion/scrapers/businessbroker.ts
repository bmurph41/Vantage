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
 * BusinessBroker.net adapter — operating businesses for sale.
 *
 * Listings are server-rendered HTML with a visible fact table (asking price,
 * gross revenue, cash flow, SDE, inventory, FF&E, real estate included).
 * This adapter parses that table by row label and falls back to JSON-LD
 * Product markup when present. Live fetching is gated on
 * INGESTION_V3_LIVE_FETCH=true.
 */
export class BusinessBrokerAdapter extends ScraperAdapter {
  readonly sourceDomain = 'businessbroker.net';
  readonly sourceName = 'BusinessBroker.net';
  readonly defaultCategory: ListingCategory = 'operating_business';

  private readonly searchUrl = 'https://www.businessbroker.net/businesses-for-sale/';
  private readonly rateLimitPerMin = 15;

  async fetchListings(options: {
    maxListings?: number;
  }): Promise<RawListing[]> {
    if (process.env.INGESTION_V3_LIVE_FETCH !== 'true') {
      console.warn(
        '[businessbroker] Live fetch disabled (set INGESTION_V3_LIVE_FETCH=true to enable). Returning [].',
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
            `[businessbroker] Skipped ${url}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    } catch (err) {
      console.error(
        '[businessbroker] Index fetch failed:',
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
        const absolute = new URL(href, 'https://www.businessbroker.net').toString();
        if (/\/business-for-sale\/[^/]+\/\d+/.test(absolute)) urls.add(absolute);
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

    const facts = this.extractFactTable($);

    const askingPrice =
      parseMoney(facts['asking price']) ??
      parseMoney(facts['price']);
    const revenue =
      parseMoney(facts['gross revenue']) ??
      parseMoney(facts['annual revenue']);
    const sde =
      parseMoney(facts['cash flow']) ??
      parseMoney(facts["seller's discretionary earnings"]) ??
      parseMoney(facts['sde']);
    const ebitda = parseMoney(facts['ebitda']);
    const yearEst = parseMoney(facts['year established']);
    const employees = parseMoney(facts['employees']);
    const inventory = parseMoney(facts['inventory']);
    const ffe = parseMoney(facts['ff&e']) ?? parseMoney(facts['ffe']);
    const realEstate = /yes/i.test(facts['real estate'] || '');
    const sellerFinancing = /yes/i.test(facts['financing'] || facts['seller financing'] || '');

    const title = product.name || meta.title;
    if (!title) return null;

    const address = coerceAddress(product.address);
    const sourceListingId = (() => {
      const m = url.match(/\/business-for-sale\/[^/]+\/(\d+)/);
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

  private extractFactTable($: ReturnType<typeof loadHtml>): Record<string, string> {
    const out: Record<string, string> = {};
    // Observed markup: <tr><td class="label">Asking Price</td><td>$XXX</td></tr>
    // plus a dl/dt/dd variant. Collect both.
    $('table tr').each((_, tr) => {
      const cells = $(tr).find('td, th');
      if (cells.length >= 2) {
        const key = $(cells[0]).text().trim().toLowerCase();
        const val = $(cells[1]).text().trim();
        if (key && val) out[key] = val;
      }
    });
    $('dl dt').each((_, dt) => {
      const key = $(dt).text().trim().toLowerCase();
      const val = $(dt).next('dd').text().trim();
      if (key && val) out[key] = val;
    });
    return out;
  }

  private extractBroker($: ReturnType<typeof loadHtml>) {
    const name = $('.broker-name').first().text().trim() || undefined;
    const company = $('.broker-company').first().text().trim() || undefined;
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
