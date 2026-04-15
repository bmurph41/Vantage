import { ScraperAdapter } from './base';
import type { RawListing, NormalizedListing, ListingCategory } from './base';
import { classifyFromText } from '@shared/marketplace/asset-class-taxonomy';

/**
 * BizBuySell adapter.
 *
 * IMPORTANT: BizBuySell does not expose a public API, and scraping their HTML
 * without a data-sharing agreement likely violates their ToS. Live fetching is
 * intentionally disabled here. The adapter plumbing (normalize + metadata)
 * is fully implemented so that a real fetcher — once licensed, behind a
 * compliant crawler with robots.txt respect, user-agent identification, and
 * rate limiting — can be wired into fetchListings() without touching the
 * rest of the pipeline.
 *
 * Do NOT enable live scraping without human legal review.
 */
export class BizBuySellAdapter extends ScraperAdapter {
  readonly sourceDomain = 'bizbuysell.com';
  readonly sourceName = 'BizBuySell';
  readonly defaultCategory: ListingCategory = 'operating_business';

  async fetchListings(_options: {
    maxListings?: number;
    sinceHours?: number;
  }): Promise<RawListing[]> {
    // TODO: Wire up a compliant fetcher (licensed feed or approved crawler).
    // Must respect robots.txt, set a proper User-Agent, throttle to the
    // source's rateLimitPerMin, and honor any retry-after headers. Until
    // that is in place, return an empty array so runScrape() completes
    // cleanly with listingsFound=0.
    console.warn(
      '[bizbuysell] Live scraping not yet enabled — returning empty result set. ' +
        'See server/ingestion/scrapers/bizbuysell.ts for details.',
    );
    return [];
  }

  normalize(raw: RawListing): NormalizedListing {
    const categoryLabel = raw.rawCategoryLabel || raw.title || '';
    const assetClass = classifyFromText(categoryLabel) || 'biz_restaurant';

    // BizBuySell field names (observed in public listing pages) vary between
    // "cashFlow" / "cash_flow" / "sde" and "grossRevenue" / "revenue". Handle
    // both snake_case and camelCase so the adapter is robust to source shape.
    const src = raw.raw || {};
    const pickNum = (...keys: string[]): number | undefined => {
      for (const k of keys) {
        const v = src[k];
        if (typeof v === 'number' && isFinite(v)) return v;
        if (typeof v === 'string') {
          const n = Number(v.replace(/[^0-9.\-]/g, ''));
          if (isFinite(n) && n !== 0) return n;
        }
      }
      return undefined;
    };
    const pickBool = (...keys: string[]): boolean | undefined => {
      for (const k of keys) {
        const v = src[k];
        if (typeof v === 'boolean') return v;
        if (typeof v === 'string') {
          const s = v.toLowerCase().trim();
          if (s === 'yes' || s === 'true') return true;
          if (s === 'no' || s === 'false') return false;
        }
      }
      return undefined;
    };

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
        annualRevenue: pickNum('annualRevenue', 'annual_revenue', 'grossRevenue', 'gross_revenue', 'revenue'),
        annualCashflowSde: pickNum('cashFlow', 'cash_flow', 'sde', 'annualCashflowSde', 'annual_cashflow_sde'),
        annualEbitda: pickNum('ebitda', 'annualEbitda', 'annual_ebitda'),
        employeeCount: pickNum('employees', 'employeeCount', 'employee_count'),
        yearEstablished: pickNum('yearEstablished', 'year_established', 'established'),
        realEstateIncluded: pickBool(
          'realEstateIncluded',
          'real_estate_included',
          'realEstate',
        ),
        leaseAssumable: pickBool('leaseAssumable', 'lease_assumable'),
        sellerFinancingAvailable: pickBool(
          'sellerFinancing',
          'seller_financing',
          'sellerFinancingAvailable',
          'seller_financing_available',
        ),
        reasonForSelling:
          typeof src.reasonForSelling === 'string'
            ? src.reasonForSelling
            : typeof src.reason_for_selling === 'string'
              ? src.reason_for_selling
              : undefined,
        trainingOffered: pickBool('training', 'trainingOffered', 'training_offered'),
        inventoryValue: pickNum('inventory', 'inventoryValue', 'inventory_value'),
        ffeValue: pickNum('ffe', 'ffeValue', 'ffe_value', 'furnitureFixturesEquipment'),
      },
    };
  }
}
