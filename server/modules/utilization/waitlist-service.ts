import { db } from '../../db';
import { eq, and, sql, desc, asc, count, avg, inArray } from 'drizzle-orm';
import {
  waitlists,
  waitlistEntries,
  waitlistOffers,
} from '../../../shared/schema';

export async function createWaitlist(data: {
  orgId: string;
  propertyId: string;
  unitType: string;
  bandKey?: string | null;
  name: string;
  constraints?: Record<string, any>;
  maxEntries?: number | null;
}) {
  const [wl] = await db.insert(waitlists).values({
    orgId: data.orgId,
    propertyId: data.propertyId,
    unitType: data.unitType,
    bandKey: data.bandKey ?? null,
    name: data.name,
    constraints: data.constraints ?? {},
    maxEntries: data.maxEntries ?? null,
  }).returning();
  return wl;
}

export async function getWaitlistsForProperty(
  orgId: string,
  propertyId: string,
  unitType?: string,
  bandKey?: string
) {
  const conditions = [
    eq(waitlists.orgId, orgId),
    eq(waitlists.propertyId, propertyId),
  ];
  if (unitType) conditions.push(eq(waitlists.unitType, unitType));
  if (bandKey) conditions.push(eq(waitlists.bandKey, bandKey));

  const rows = await db.select().from(waitlists).where(and(...conditions)).orderBy(asc(waitlists.unitType), asc(waitlists.bandKey));
  return rows;
}

export async function getWaitlistById(waitlistId: string, orgId: string) {
  const [wl] = await db.select().from(waitlists).where(
    and(eq(waitlists.id, waitlistId), eq(waitlists.orgId, orgId))
  );
  return wl ?? null;
}

export async function addWaitlistEntry(data: {
  waitlistId: string;
  orgId: string;
  contactName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactId?: string | null;
  boatLengthFt?: string | null;
  boatBeamFt?: string | null;
  boatDraftFt?: string | null;
  boatName?: string | null;
  preferredBandKey?: string | null;
  notes?: string | null;
  priority?: number;
}) {
  const maxPos = await db.select({ max: sql<number>`COALESCE(MAX(position), 0)` })
    .from(waitlistEntries)
    .where(eq(waitlistEntries.waitlistId, data.waitlistId));

  const nextPosition = (maxPos[0]?.max ?? 0) + 1;

  const [entry] = await db.insert(waitlistEntries).values({
    waitlistId: data.waitlistId,
    orgId: data.orgId,
    contactName: data.contactName,
    contactEmail: data.contactEmail ?? null,
    contactPhone: data.contactPhone ?? null,
    contactId: data.contactId ?? null,
    boatLengthFt: data.boatLengthFt ?? null,
    boatBeamFt: data.boatBeamFt ?? null,
    boatDraftFt: data.boatDraftFt ?? null,
    boatName: data.boatName ?? null,
    preferredBandKey: data.preferredBandKey ?? null,
    notes: data.notes ?? null,
    priority: data.priority ?? 0,
    position: nextPosition,
  }).returning();
  return entry;
}

export async function getWaitlistEntries(waitlistId: string, orgId: string) {
  const entries = await db.select().from(waitlistEntries).where(
    and(eq(waitlistEntries.waitlistId, waitlistId), eq(waitlistEntries.orgId, orgId))
  ).orderBy(asc(waitlistEntries.position));
  return entries;
}

export async function sendOffer(data: {
  entryId: string;
  waitlistId: string;
  orgId: string;
  unitId: string;
  unitCode?: string | null;
  expiresAt?: Date | null;
  notes?: string | null;
}) {
  const [entry] = await db.select().from(waitlistEntries).where(
    and(
      eq(waitlistEntries.id, data.entryId),
      eq(waitlistEntries.waitlistId, data.waitlistId),
      eq(waitlistEntries.orgId, data.orgId)
    )
  );
  if (!entry) throw new Error('Entry not found or does not belong to this waitlist');
  if (entry.status !== 'waiting') throw new Error(`Entry is not in waiting status (current: ${entry.status})`);

  await db.update(waitlistEntries)
    .set({ status: 'offered', offeredAt: new Date(), updatedAt: new Date() })
    .where(eq(waitlistEntries.id, data.entryId));

  const [offer] = await db.insert(waitlistOffers).values({
    entryId: data.entryId,
    waitlistId: data.waitlistId,
    orgId: data.orgId,
    unitId: data.unitId,
    unitCode: data.unitCode ?? null,
    expiresAt: data.expiresAt ?? null,
    notes: data.notes ?? null,
  }).returning();
  return offer;
}

export async function acceptOffer(offerId: string, orgId: string) {
  const [offer] = await db.select().from(waitlistOffers).where(
    and(eq(waitlistOffers.id, offerId), eq(waitlistOffers.orgId, orgId))
  );
  if (!offer) throw new Error('Offer not found');

  await db.update(waitlistOffers)
    .set({ status: 'accepted', respondedAt: new Date(), updatedAt: new Date() })
    .where(eq(waitlistOffers.id, offerId));

  await db.update(waitlistEntries)
    .set({ status: 'accepted', resolvedAt: new Date(), updatedAt: new Date() })
    .where(eq(waitlistEntries.id, offer.entryId));

  return { ...offer, status: 'accepted' as const };
}

export async function declineOffer(offerId: string, orgId: string) {
  const [offer] = await db.select().from(waitlistOffers).where(
    and(eq(waitlistOffers.id, offerId), eq(waitlistOffers.orgId, orgId))
  );
  if (!offer) throw new Error('Offer not found');

  await db.update(waitlistOffers)
    .set({ status: 'declined', respondedAt: new Date(), updatedAt: new Date() })
    .where(eq(waitlistOffers.id, offerId));

  await db.update(waitlistEntries)
    .set({ status: 'declined', resolvedAt: new Date(), updatedAt: new Date() })
    .where(eq(waitlistEntries.id, offer.entryId));

  return { ...offer, status: 'declined' as const };
}

export async function expireOffer(offerId: string, orgId: string) {
  const [offer] = await db.select().from(waitlistOffers).where(
    and(eq(waitlistOffers.id, offerId), eq(waitlistOffers.orgId, orgId))
  );
  if (!offer) throw new Error('Offer not found');

  await db.update(waitlistOffers)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(eq(waitlistOffers.id, offerId));

  await db.update(waitlistEntries)
    .set({ status: 'expired', resolvedAt: new Date(), updatedAt: new Date() })
    .where(eq(waitlistEntries.id, offer.entryId));

  return { ...offer, status: 'expired' as const };
}

export async function getOffersForEntry(entryId: string, orgId: string) {
  return db.select().from(waitlistOffers).where(
    and(eq(waitlistOffers.entryId, entryId), eq(waitlistOffers.orgId, orgId))
  ).orderBy(desc(waitlistOffers.offeredAt));
}

export async function getWaitlistMetrics(orgId: string, propertyId: string) {
  const wls = await db.select().from(waitlists).where(
    and(eq(waitlists.orgId, orgId), eq(waitlists.propertyId, propertyId))
  );
  const wlIds = wls.map(w => w.id);
  if (wlIds.length === 0) {
    return {
      totalWaitlists: 0,
      waitlistCount: 0,
      avgTimeToOfferDays: null,
      conversionRate: null,
      byBand: [],
      byUnitType: [],
    };
  }

  const allEntries = await db.select().from(waitlistEntries).where(
    inArray(waitlistEntries.waitlistId, wlIds)
  );

  const allOffers = await db.select().from(waitlistOffers).where(
    inArray(waitlistOffers.waitlistId, wlIds)
  );

  const waitingCount = allEntries.filter(e => e.status === 'waiting').length;
  const totalEntries = allEntries.length;

  const offersWithResponse = allOffers.filter(o => o.respondedAt);
  const acceptedOffers = allOffers.filter(o => o.status === 'accepted');
  const conversionRate = allOffers.length > 0
    ? acceptedOffers.length / allOffers.length
    : null;

  const timeToOfferDays: number[] = [];
  for (const entry of allEntries) {
    if (entry.offeredAt && entry.joinedAt) {
      const diff = (new Date(entry.offeredAt).getTime() - new Date(entry.joinedAt).getTime()) / (1000 * 60 * 60 * 24);
      timeToOfferDays.push(diff);
    }
  }
  const avgTimeToOfferDays = timeToOfferDays.length > 0
    ? timeToOfferDays.reduce((s, v) => s + v, 0) / timeToOfferDays.length
    : null;

  const byBandMap = new Map<string, { bandKey: string; waitlistCount: number; waitingCount: number }>();
  const byTypeMap = new Map<string, { unitType: string; waitlistCount: number; waitingCount: number }>();

  for (const wl of wls) {
    const bk = wl.bandKey ?? 'all';
    const entries = allEntries.filter(e => e.waitlistId === wl.id);
    const waiting = entries.filter(e => e.status === 'waiting').length;

    if (!byBandMap.has(bk)) byBandMap.set(bk, { bandKey: bk, waitlistCount: 0, waitingCount: 0 });
    const bandEntry = byBandMap.get(bk)!;
    bandEntry.waitlistCount += entries.length;
    bandEntry.waitingCount += waiting;

    if (!byTypeMap.has(wl.unitType)) byTypeMap.set(wl.unitType, { unitType: wl.unitType, waitlistCount: 0, waitingCount: 0 });
    const typeEntry = byTypeMap.get(wl.unitType)!;
    typeEntry.waitlistCount += entries.length;
    typeEntry.waitingCount += waiting;
  }

  return {
    totalWaitlists: wls.length,
    waitlistCount: waitingCount,
    totalEntries,
    avgTimeToOfferDays: avgTimeToOfferDays ? Math.round(avgTimeToOfferDays * 10) / 10 : null,
    conversionRate: conversionRate ? Math.round(conversionRate * 1000) / 10 : null,
    totalOffers: allOffers.length,
    acceptedOffers: acceptedOffers.length,
    byBand: Array.from(byBandMap.values()),
    byUnitType: Array.from(byTypeMap.values()),
  };
}
