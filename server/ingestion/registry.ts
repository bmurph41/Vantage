import type { ScraperAdapter } from './scrapers/base';
import { BizBuySellAdapter } from './scrapers/bizbuysell';

/**
 * Registry of scraper adapters keyed by `marketplace_sources.scraper_type`.
 * Step 11 will add more (BizQuest, Flippa, Crexi, etc.).
 */
export const adapterRegistry: Record<string, () => ScraperAdapter> = {
  bizbuysell: () => new BizBuySellAdapter(),
};

export function getAdapterForScraperType(
  scraperType: string,
): ScraperAdapter | null {
  const factory = adapterRegistry[scraperType];
  return factory ? factory() : null;
}
