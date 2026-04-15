import type { ScraperAdapter } from './scrapers/base';
import { BizBuySellAdapter } from './scrapers/bizbuysell';
import { LoopNetAdapter } from './scrapers/loopnet';
import { CrexiAdapter } from './scrapers/crexi';
import { BusinessBrokerAdapter } from './scrapers/businessbroker';
import { BizQuestAdapter } from './scrapers/bizquest';
import { FranchiseGatorAdapter } from './scrapers/franchisegator';

/**
 * Registry of scraper adapters keyed by `marketplace_sources.scraper_type`.
 *
 * Adding a new adapter: implement ScraperAdapter, register it here, add its
 * domain to the SSRF allowlist (server/listings/ingestion_v2/fetch/ssrfGuard.ts),
 * and seed a marketplace_sources row (scripts/seed_marketplace_sources.mjs).
 */
export const adapterRegistry: Record<string, () => ScraperAdapter> = {
  bizbuysell: () => new BizBuySellAdapter(),
  loopnet: () => new LoopNetAdapter(),
  crexi: () => new CrexiAdapter(),
  businessbroker: () => new BusinessBrokerAdapter(),
  bizquest: () => new BizQuestAdapter(),
  franchisegator: () => new FranchiseGatorAdapter(),
};

export function getAdapterForScraperType(
  scraperType: string,
): ScraperAdapter | null {
  const factory = adapterRegistry[scraperType];
  return factory ? factory() : null;
}

export function listRegisteredScraperTypes(): string[] {
  return Object.keys(adapterRegistry);
}
