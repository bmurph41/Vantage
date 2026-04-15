import { eq } from 'drizzle-orm';
import { db } from '../db';
import { marinaListings } from '@shared/schema';
import { classifyFromText } from '@shared/marketplace/asset-class-taxonomy';
import { computeDedupeHash } from './dedupe';
import type { NormalizedListing } from './scrapers/base';

export interface PersistResult {
  inserted: number;
  updated: number;
  failed: number;
}

/**
 * Persist a batch of normalized listings into marina_listings.
 * Dedupes via hash (title + city + state + askingPrice). Each listing is
 * wrapped in its own try/catch so one bad row cannot kill the batch.
 */
export async function persistNormalizedListings(
  listings: NormalizedListing[],
  sourceId: string,
  orgId: string,
): Promise<PersistResult> {
  const result: PersistResult = { inserted: 0, updated: 0, failed: 0 };

  for (const listing of listings) {
    try {
      const raw = listing.raw;
      const dedupeHash = computeDedupeHash({
        title: raw.title,
        city: raw.location?.city,
        state: raw.location?.state,
        askingPrice: raw.askingPrice,
      });

      const assetClass =
        listing.assetClass ||
        classifyFromText(raw.rawCategoryLabel || raw.title || '') ||
        null;

      const now = new Date();

      const existing = await db
        .select({ id: marinaListings.id })
        .from(marinaListings)
        .where(eq(marinaListings.dedupeHash, dedupeHash))
        .limit(1);

      if (existing.length > 0) {
        const updatePatch: Record<string, any> = {
          lastSeenAt: now,
          lastScrapedAt: now,
          isActive: true,
          updatedAt: now,
          title: raw.title,
          sourceUrl: raw.sourceUrl,
          description: raw.description ?? null,
          originalDescription: raw.description ?? null,
          city: raw.location?.city ?? null,
          state: raw.location?.state ?? null,
          zipCode: raw.location?.zip ?? null,
          country: raw.location?.country ?? 'US',
          currency: raw.currency ?? 'USD',
          isLocationConfidential: raw.location?.isConfidential ?? false,
          latitude:
            typeof raw.location?.lat === 'number' ? String(raw.location.lat) : null,
          longitude:
            typeof raw.location?.lon === 'number' ? String(raw.location.lon) : null,
          askingPrice:
            typeof raw.askingPrice === 'number' ? String(raw.askingPrice) : null,
          listingCategory: listing.listingCategory,
          assetClass,
          creMetrics: listing.creMetrics ?? null,
          businessMetrics: listing.businessMetrics ?? null,
          images: raw.images ?? null,
          heroImageUrl: raw.images?.[0] ?? null,
          brokerName: raw.broker?.name ?? null,
          brokerCompany: raw.broker?.company ?? null,
          brokerEmail: raw.broker?.email ?? null,
          brokerPhone: raw.broker?.phone ?? null,
          publishedAt: raw.publishedAt ?? null,
          sourceListingIdCanonical: raw.sourceListingId,
          scrapeRunId: sourceId,
        };

        await db
          .update(marinaListings)
          .set(updatePatch)
          .where(eq(marinaListings.id, existing[0].id));

        result.updated += 1;
      } else {
        await db.insert(marinaListings).values({
          orgId,
          scope: 'org',
          sourcePlatform: listing.source.domain,
          sourceUrl: raw.sourceUrl,
          sourceListingId: raw.sourceListingId,
          sourceListingIdCanonical: raw.sourceListingId,
          scrapeRunId: sourceId,
          dedupeHash,
          title: raw.title,
          description: raw.description ?? null,
          originalDescription: raw.description ?? null,
          city: raw.location?.city ?? null,
          state: raw.location?.state ?? null,
          zipCode: raw.location?.zip ?? null,
          country: raw.location?.country ?? 'US',
          currency: raw.currency ?? 'USD',
          isLocationConfidential: raw.location?.isConfidential ?? false,
          latitude:
            typeof raw.location?.lat === 'number' ? String(raw.location.lat) : null,
          longitude:
            typeof raw.location?.lon === 'number' ? String(raw.location.lon) : null,
          askingPrice:
            typeof raw.askingPrice === 'number' ? String(raw.askingPrice) : null,
          listingCategory: listing.listingCategory,
          assetClass,
          creMetrics: listing.creMetrics ?? null,
          businessMetrics: listing.businessMetrics ?? null,
          images: raw.images ?? null,
          heroImageUrl: raw.images?.[0] ?? null,
          brokerName: raw.broker?.name ?? null,
          brokerCompany: raw.broker?.company ?? null,
          brokerEmail: raw.broker?.email ?? null,
          brokerPhone: raw.broker?.phone ?? null,
          publishedAt: raw.publishedAt ?? null,
          lastSeenAt: now,
          lastScrapedAt: now,
          isActive: true,
          status: 'active',
        });

        result.inserted += 1;
      }
    } catch (err) {
      result.failed += 1;
      console.error(
        `[ingestion] Failed to persist listing ${listing.raw?.sourceListingId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return result;
}
