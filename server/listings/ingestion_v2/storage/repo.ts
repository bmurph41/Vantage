import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '../../../db';
import { createHash } from 'crypto';
import {
  liv2Sources,
  liv2ScrapeRuns,
  liv2RawPages,
  liv2ListingCandidates,
  liv2ListingPayloads,
  liv2ListingAssets,
  liv2Quarantine,
  liv2FieldProvenance,
  liv2ListingsCurrent,
  type Liv2Source,
  type InsertLiv2Source,
  type Liv2ScrapeRun,
  type Liv2ListingPayload,
  type Liv2ListingAsset,
  type Liv2Quarantine,
  type ListingPayloadV2,
  type ValidationResult,
  type Liv2RunMetrics,
  type Liv2ListingCurrent,
} from '../schema';

export const liv2Repo = {
  async createSource(data: InsertLiv2Source): Promise<Liv2Source> {
    const [source] = await db.insert(liv2Sources).values(data).returning();
    return source;
  },

  async getSourceById(id: string): Promise<Liv2Source | undefined> {
    return db.query.liv2Sources?.findFirst({
      where: eq(liv2Sources.id, id),
    });
  },

  async getSourceByDomain(domain: string): Promise<Liv2Source | undefined> {
    const [source] = await db.select().from(liv2Sources).where(eq(liv2Sources.domain, domain));
    return source;
  },

  async getActiveSources(): Promise<Liv2Source[]> {
    return db.select().from(liv2Sources).where(eq(liv2Sources.isActive, true));
  },

  async createRun(sourceId: string): Promise<Liv2ScrapeRun> {
    const [run] = await db.insert(liv2ScrapeRuns).values({
      sourceId,
      status: 'running',
    }).returning();
    return run;
  },

  async completeRun(runId: string, status: 'success' | 'partial' | 'failed', metrics: Liv2RunMetrics): Promise<void> {
    await db.update(liv2ScrapeRuns)
      .set({
        status,
        completedAt: new Date(),
        metrics,
      })
      .where(eq(liv2ScrapeRuns.id, runId));
  },

  async getRunById(runId: string): Promise<Liv2ScrapeRun | undefined> {
    const [run] = await db.select().from(liv2ScrapeRuns).where(eq(liv2ScrapeRuns.id, runId));
    return run;
  },

  async getRecentRuns(limit: number = 20): Promise<Liv2ScrapeRun[]> {
    return db.select().from(liv2ScrapeRuns).orderBy(desc(liv2ScrapeRuns.startedAt)).limit(limit);
  },

  async storeRawPage(data: {
    runId: string;
    sourceId: string;
    url: string;
    finalUrl?: string;
    statusCode?: number;
    headers?: Record<string, string>;
    html?: string;
    error?: string;
  }): Promise<string> {
    const bodyHash = data.html ? createHash('sha256').update(data.html).digest('hex') : undefined;
    const [page] = await db.insert(liv2RawPages).values({
      ...data,
      bodyHash,
    }).returning();
    return page.id;
  },

  async storeCandidate(data: {
    runId: string;
    sourceId: string;
    url: string;
    canonicalUrl?: string;
    stableSourceKey?: string;
    identityConfidence: number;
    canonicalListingId?: string;
    status?: 'pending' | 'extracted' | 'quarantined' | 'error';
    reason?: string;
  }): Promise<string> {
    const [candidate] = await db.insert(liv2ListingCandidates).values(data).returning();
    return candidate.id;
  },

  async storePayload(data: {
    canonicalListingId: string;
    sourceId: string;
    extractorVersion: string;
    payload: ListingPayloadV2;
    validation?: ValidationResult;
  }): Promise<string> {
    const payloadHash = createHash('sha256').update(JSON.stringify(data.payload)).digest('hex');
    
    const existing = await db.select()
      .from(liv2ListingPayloads)
      .where(and(
        eq(liv2ListingPayloads.canonicalListingId, data.canonicalListingId),
        eq(liv2ListingPayloads.payloadHash, payloadHash)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      return existing[0].id;
    }
    
    const [payload] = await db.insert(liv2ListingPayloads).values({
      ...data,
      payloadHash,
    }).returning();
    
    return payload.id;
  },

  async storeAsset(data: {
    canonicalListingId: string;
    sourceId: string;
    assetType: 'image';
    assetUrl: string;
    assetUrlNormalized: string;
    originUrl: string;
    contentHash?: string;
    bytes?: number;
    width?: number;
    height?: number;
    verified: boolean;
    verificationReason?: string;
  }): Promise<string> {
    const existing = await db.select()
      .from(liv2ListingAssets)
      .where(and(
        eq(liv2ListingAssets.canonicalListingId, data.canonicalListingId),
        eq(liv2ListingAssets.assetUrlNormalized, data.assetUrlNormalized)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      await db.update(liv2ListingAssets)
        .set({
          contentHash: data.contentHash || existing[0].contentHash,
          bytes: data.bytes || existing[0].bytes,
          verified: data.verified || existing[0].verified,
          verificationReason: data.verificationReason || existing[0].verificationReason,
        })
        .where(eq(liv2ListingAssets.id, existing[0].id));
      return existing[0].id;
    }
    
    const [asset] = await db.insert(liv2ListingAssets).values(data).returning();
    return asset.id;
  },

  async quarantine(data: {
    sourceId: string;
    url: string;
    canonicalUrl?: string;
    canonicalListingId?: string;
    identityConfidence?: number;
    payload?: Partial<ListingPayloadV2>;
    validation?: ValidationResult;
    reason: string;
  }): Promise<string> {
    const [q] = await db.insert(liv2Quarantine).values(data).returning();
    return q.id;
  },

  async storeFieldProvenance(data: {
    canonicalListingId: string;
    sourceId: string;
    fieldName: string;
    fieldValue: unknown;
    originUrl: string;
    extractorVersion: string;
  }): Promise<void> {
    const fieldValueHash = createHash('sha256').update(JSON.stringify(data.fieldValue)).digest('hex');
    
    await db.insert(liv2FieldProvenance).values({
      canonicalListingId: data.canonicalListingId,
      sourceId: data.sourceId,
      fieldName: data.fieldName,
      fieldValueHash,
      originUrl: data.originUrl,
      extractorVersion: data.extractorVersion,
    }).onConflictDoNothing();
  },

  async checkIdentityConflict(sourceId: string, canonicalUrl: string, canonicalListingId: string): Promise<boolean> {
    const existing = await db.select()
      .from(liv2ListingCandidates)
      .where(and(
        eq(liv2ListingCandidates.sourceId, sourceId),
        eq(liv2ListingCandidates.canonicalUrl, canonicalUrl)
      ))
      .limit(1);
    
    if (existing.length === 0) {
      return false;
    }
    
    return existing[0].canonicalListingId !== canonicalListingId;
  },

  async upsertCurrentListing(payload: ListingPayloadV2, sourceId: string): Promise<string> {
    const payloadHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    
    const existing = await db.select()
      .from(liv2ListingsCurrent)
      .where(eq(liv2ListingsCurrent.canonicalListingId, payload.identity.canonicalListingId))
      .limit(1);
    
    const data = {
      canonicalListingId: payload.identity.canonicalListingId,
      sourceId,
      domain: payload.source.domain,
      title: payload.core?.title,
      listingType: payload.core?.listingType,
      status: payload.core?.status,
      askingPrice: payload.pricing?.price?.amount,
      currency: payload.pricing?.price?.currency || 'USD',
      priceType: payload.pricing?.priceType,
      address1: payload.location?.address1,
      city: payload.location?.city,
      state: payload.location?.state,
      postalCode: payload.location?.postalCode,
      country: payload.location?.country,
      lat: payload.location?.lat?.toString(),
      lng: payload.location?.lng?.toString(),
      geoPrecision: payload.location?.geoPrecision,
      description: payload.details?.description,
      acreage: payload.details?.acreage?.toString(),
      waterfrontFeet: payload.details?.waterfrontFeet,
      slips: payload.details?.slips,
      dryRacks: payload.details?.dryRacks,
      occupancy: payload.details?.occupancy,
      capRate: payload.details?.capRate?.toString(),
      noi: payload.details?.noi,
      revenue: payload.details?.revenue,
      yearBuilt: payload.details?.yearBuilt,
      zoning: payload.details?.zoning,
      brokerName: payload.contacts?.brokerName,
      brokerCompany: payload.contacts?.brokerCompany,
      brokerPhone: payload.contacts?.brokerPhone,
      brokerEmail: payload.contacts?.brokerEmail,
      heroImageUrl: payload.media?.heroImageUrl,
      imageCount: payload.media?.images?.length || 0,
      sourceUrl: payload.source.url,
      canonicalUrl: payload.source.canonicalUrl,
      publishedAt: payload.timestamps?.publishedAt ? new Date(payload.timestamps.publishedAt) : undefined,
      lastPayloadHash: payloadHash,
      lastExtractedAt: new Date(),
      updatedAt: new Date(),
    };
    
    if (existing.length > 0) {
      await db.update(liv2ListingsCurrent)
        .set(data)
        .where(eq(liv2ListingsCurrent.canonicalListingId, payload.identity.canonicalListingId));
      return existing[0].id;
    }
    
    const [listing] = await db.insert(liv2ListingsCurrent).values({
      ...data,
      createdAt: new Date(),
    }).returning();
    
    return listing.id;
  },

  async getCurrentListings(options?: {
    domain?: string;
    state?: string;
    limit?: number;
    offset?: number;
  }): Promise<Liv2ListingCurrent[]> {
    let query = db.select().from(liv2ListingsCurrent);
    
    const conditions = [];
    if (options?.domain) {
      conditions.push(eq(liv2ListingsCurrent.domain, options.domain));
    }
    if (options?.state) {
      conditions.push(eq(liv2ListingsCurrent.state, options.state));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    return query
      .orderBy(desc(liv2ListingsCurrent.updatedAt))
      .limit(options?.limit || 50)
      .offset(options?.offset || 0);
  },

  async getCurrentListingById(canonicalListingId: string): Promise<Liv2ListingCurrent | undefined> {
    const [listing] = await db.select()
      .from(liv2ListingsCurrent)
      .where(eq(liv2ListingsCurrent.canonicalListingId, canonicalListingId));
    return listing;
  },

  async getListingAssets(canonicalListingId: string): Promise<Liv2ListingAsset[]> {
    return db.select()
      .from(liv2ListingAssets)
      .where(eq(liv2ListingAssets.canonicalListingId, canonicalListingId))
      .orderBy(liv2ListingAssets.createdAt);
  },

  async getQuarantinedItems(limit: number = 50): Promise<Liv2Quarantine[]> {
    return db.select()
      .from(liv2Quarantine)
      .orderBy(desc(liv2Quarantine.createdAt))
      .limit(limit);
  },

  async getPayloadHistory(canonicalListingId: string): Promise<Liv2ListingPayload[]> {
    return db.select()
      .from(liv2ListingPayloads)
      .where(eq(liv2ListingPayloads.canonicalListingId, canonicalListingId))
      .orderBy(desc(liv2ListingPayloads.extractedAt));
  },
};
