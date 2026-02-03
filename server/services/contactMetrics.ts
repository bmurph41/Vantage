/**
 * MarinaMatch CRM - Contact Metrics Service
 * 
 * Computes performance metrics, relationship scores, and badges for contacts.
 * All queries are tenant-scoped by orgId.
 */

import { eq, and, sql, gte, lte, or, inArray, desc, ilike } from 'drizzle-orm';
import { db } from '../db';
import {
  contacts,
  companies,
  deals,
  contactDealRoles,
  dealFinancialEvents,
  contactMetricsSnapshot,
} from '@shared/schema';

// ============================================================================
// TYPES
// ============================================================================

export type MetricsTimeframe = 'all' | '12m' | 'ytd' | `year_${number}`;

export type BadgeKey =
  | 'preferred_partner'
  | 'top_volume'
  | 'deal_machine'
  | 'fast_mover'
  | 'fee_saver'
  | 'high_close_rate'
  | 'rising_star'
  | 'team_favorite';

export interface Badge {
  key: BadgeKey;
  label: string;
  reason: string;
  icon: string;
  color: string;
}

export interface ContactMetrics {
  contactId: string;
  timeframe: MetricsTimeframe;
  dealsTotal: number;
  dealsActive: number;
  dealsClosedWon: number;
  dealsClosedLost: number;
  closeRate: number;
  totalVolume: number;
  volume12m: number;
  avgDealSize: number;
  feesPaid: number;
  feesWaived: number;
  feesNet: number;
  avgFeePerDeal: number;
  lastDealDate: string | null;
  lastActivityDate: string | null;
  daysSinceLastDeal: number | null;
  daysSinceLastActivity: number | null;
  relationshipScore: number;
  badges: Badge[];
}

export interface LeaderboardFilters {
  role?: string;
  relationshipStatus?: string[];
  timeframe?: MetricsTimeframe;
  minDeals?: number;
  minVolume?: number;
  minFeesWaived?: number;
  regions?: string[];
  search?: string;
}

export type LeaderboardSortField = 'score' | 'volume' | 'deals' | 'feesWaived' | 'closeRate' | 'recent';

export interface LeaderboardEntry {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  primaryRole: string | null;
  relationshipStatus: string;
  regions: string[];
  headline: string | null;
  metricsSummary: {
    dealsTotal: number;
    dealsClosedWon: number;
    totalVolume: number;
    feesWaived: number;
    closeRate: number;
    lastDealDate: string | null;
  };
  score: number;
  badges: Badge[];
}

// ============================================================================
// CONFIGURATION
// ============================================================================

interface ScoreWeights {
  dealsClosedWon: { weight: number; cap: number };
  totalVolume: { weight: number; cap: number };
  feesWaived: { weight: number; cap: number };
  recency: { weight: number; cap: number };
  closeRate: { weight: number; cap: number };
}

const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  dealsClosedWon: { weight: 30, cap: 10 },
  totalVolume: { weight: 25, cap: 50_000_000 },
  feesWaived: { weight: 15, cap: 50_000 },
  recency: { weight: 15, cap: 365 },
  closeRate: { weight: 15, cap: 1.0 },
};

const BADGE_DEFINITIONS: Record<BadgeKey, { label: string; icon: string; color: string }> = {
  preferred_partner: { label: 'Preferred Partner', icon: '⭐', color: 'bg-amber-500' },
  top_volume: { label: 'Top Volume', icon: '📈', color: 'bg-green-500' },
  deal_machine: { label: 'Deal Machine', icon: '🔥', color: 'bg-orange-500' },
  fast_mover: { label: 'Fast Mover', icon: '⚡', color: 'bg-yellow-500' },
  fee_saver: { label: 'Fee Saver', icon: '💰', color: 'bg-emerald-500' },
  high_close_rate: { label: 'High Close Rate', icon: '🎯', color: 'bg-purple-500' },
  rising_star: { label: 'Rising Star', icon: '🌟', color: 'bg-pink-500' },
  team_favorite: { label: 'Team Favorite', icon: '❤️', color: 'bg-red-500' },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function normalize(value: number, cap: number): number {
  if (cap <= 0) return 0;
  return Math.min(value / cap, 1);
}

function getTimeframeRange(timeframe: MetricsTimeframe): { start: Date | null; end: Date } {
  const now = new Date();
  const end = now;
  
  switch (timeframe) {
    case 'all':
      return { start: null, end };
    case '12m':
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      return { start: twelveMonthsAgo, end: new Date() };
    case 'ytd':
      return { start: new Date(now.getFullYear(), 0, 1), end: new Date() };
    default:
      if (timeframe.startsWith('year_')) {
        const year = parseInt(timeframe.replace('year_', ''), 10);
        return {
          start: new Date(year, 0, 1),
          end: new Date(year, 11, 31, 23, 59, 59),
        };
      }
      return { start: null, end };
  }
}

function daysSince(date: Date | string | null): number | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffTime = now.getTime() - d.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// ============================================================================
// METRICS COMPUTATION
// ============================================================================

export async function getContactMetrics(
  orgId: string,
  contactId: string,
  timeframe: MetricsTimeframe = 'all',
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS
): Promise<ContactMetrics> {
  // Get contact info
  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.orgId, orgId)));

  if (!contact) {
    throw new Error('Contact not found');
  }

  // Get all deals linked to this contact
  const linkedDeals = await db
    .select({
      dealId: contactDealRoles.dealId,
      roleOnDeal: contactDealRoles.roleOnDeal,
      isPrimary: contactDealRoles.isPrimaryForDeal,
      volumeMode: contactDealRoles.volumeAttributionMode,
      deal: {
        id: deals.id,
        status: deals.status,
        purchasePrice: deals.purchasePrice,
        closingDate: deals.closingDate,
        updatedAt: deals.updatedAt,
      },
    })
    .from(contactDealRoles)
    .innerJoin(deals, eq(contactDealRoles.dealId, deals.id))
    .where(
      and(
        eq(contactDealRoles.contactId, contactId),
        eq(contactDealRoles.orgId, orgId)
      )
    );

  // Apply timeframe filter
  const { start } = getTimeframeRange(timeframe);
  const filteredDeals = start 
    ? linkedDeals.filter(d => d.deal.closingDate && new Date(d.deal.closingDate) >= start)
    : linkedDeals;

  // Calculate deal metrics
  const dealsTotal = filteredDeals.length;
  const dealsActive = filteredDeals.filter(d => 
    !['won', 'lost', 'passed'].includes(d.deal.status || '')
  ).length;
  const dealsClosedWon = filteredDeals.filter(d => d.deal.status === 'won').length;
  const dealsClosedLost = filteredDeals.filter(d => d.deal.status === 'lost').length;
  
  const totalClosed = dealsClosedWon + dealsClosedLost;
  const closeRate = totalClosed > 0 ? dealsClosedWon / totalClosed : 0;

  // Calculate volume
  let totalVolume = 0;
  for (const d of filteredDeals) {
    if (d.deal.status === 'won') {
      const amount = parseFloat(d.deal.purchasePrice || '0');
      if (d.volumeMode === 'primary_only' && !d.isPrimary) continue;
      totalVolume += amount;
    }
  }

  // Get 12m volume
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const volume12m = linkedDeals
    .filter(d => {
      if (d.deal.status !== 'won') return false;
      if (!d.deal.closingDate) return false;
      if (d.volumeMode === 'primary_only' && !d.isPrimary) return false;
      return new Date(d.deal.closingDate) >= twelveMonthsAgo;
    })
    .reduce((sum, d) => sum + parseFloat(d.deal.purchasePrice || '0'), 0);

  const avgDealSize = dealsClosedWon > 0 ? totalVolume / dealsClosedWon : 0;

  // Get financial events
  const financialEvents = await db
    .select()
    .from(dealFinancialEvents)
    .where(
      and(
        eq(dealFinancialEvents.appliesToContactId, contactId),
        eq(dealFinancialEvents.orgId, orgId)
      )
    );

  const feesPaid = financialEvents
    .filter(e => e.direction === 'paid')
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);

  const feesWaived = financialEvents
    .filter(e => ['waived', 'burned_off'].includes(e.direction))
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);

  const feesNet = feesPaid - feesWaived;
  const avgFeePerDeal = dealsClosedWon > 0 ? feesPaid / dealsClosedWon : 0;

  // Get dates
  const closedDeals = filteredDeals.filter(d => d.deal.closingDate);
  const lastDealDate = closedDeals.length > 0
    ? closedDeals.reduce((latest, d) => {
        const date = new Date(d.deal.closingDate!);
        return date > new Date(latest) ? d.deal.closingDate! : latest;
      }, closedDeals[0].deal.closingDate!)
    : null;

  const lastActivityDate = contact.createdAt?.toISOString() || null;
  const daysSinceLastDeal = daysSince(lastDealDate);

  // Calculate relationship score
  const recencyScore = daysSinceLastDeal !== null
    ? 1 - normalize(daysSinceLastDeal, weights.recency.cap)
    : 0;

  const relationshipScore = Math.round(
    weights.dealsClosedWon.weight * normalize(dealsClosedWon, weights.dealsClosedWon.cap) +
    weights.totalVolume.weight * normalize(totalVolume, weights.totalVolume.cap) +
    weights.feesWaived.weight * normalize(feesWaived, weights.feesWaived.cap) +
    weights.recency.weight * recencyScore +
    weights.closeRate.weight * normalize(closeRate, weights.closeRate.cap)
  );

  // Compute badges
  const badges = computeBadges(
    {
      dealsClosedWon,
      dealsClosedLost,
      feesWaived,
      closeRate,
      daysSinceLastDeal,
    },
    {
      relationshipStatus: contact.relationshipStatus || 'neutral',
      badgeOverrides: contact.badgeOverrides as Record<string, boolean> | undefined,
    }
  );

  return {
    contactId,
    timeframe,
    dealsTotal,
    dealsActive,
    dealsClosedWon,
    dealsClosedLost,
    closeRate,
    totalVolume,
    volume12m,
    avgDealSize,
    feesPaid,
    feesWaived,
    feesNet,
    avgFeePerDeal,
    lastDealDate,
    lastActivityDate,
    daysSinceLastDeal,
    daysSinceLastActivity: daysSince(lastActivityDate),
    relationshipScore,
    badges,
  };
}

// ============================================================================
// BADGE COMPUTATION
// ============================================================================

function computeBadges(
  metrics: {
    dealsClosedWon: number;
    dealsClosedLost: number;
    feesWaived: number;
    closeRate: number;
    daysSinceLastDeal: number | null;
  },
  context: {
    relationshipStatus: string;
    badgeOverrides?: Record<string, boolean>;
    volumePercentile?: number;
    feesPercentile?: number;
  }
): Badge[] {
  const badges: Badge[] = [];

  // Skip for do_not_track and hidden
  if (['do_not_track', 'hidden'].includes(context.relationshipStatus)) {
    return badges;
  }

  // Preferred Partner
  if (context.relationshipStatus === 'preferred') {
    badges.push({
      key: 'preferred_partner',
      ...BADGE_DEFINITIONS.preferred_partner,
      reason: 'Designated as a preferred partner',
    });
  }

  // Top Volume (90th percentile)
  if (context.volumePercentile && context.volumePercentile >= 90) {
    badges.push({
      key: 'top_volume',
      ...BADGE_DEFINITIONS.top_volume,
      reason: 'Top 10% by transaction volume',
    });
  }

  // Deal Machine (10+ deals)
  if (metrics.dealsClosedWon >= 10) {
    badges.push({
      key: 'deal_machine',
      ...BADGE_DEFINITIONS.deal_machine,
      reason: `${metrics.dealsClosedWon} deals closed`,
    });
  }

  // Fast Mover (deal within 60 days)
  if (metrics.daysSinceLastDeal !== null && metrics.daysSinceLastDeal <= 60) {
    badges.push({
      key: 'fast_mover',
      ...BADGE_DEFINITIONS.fast_mover,
      reason: `Recent deal (${metrics.daysSinceLastDeal} days ago)`,
    });
  }

  // Fee Saver ($10k+ or top 10%)
  if (metrics.feesWaived >= 10000 || (context.feesPercentile && context.feesPercentile >= 90)) {
    badges.push({
      key: 'fee_saver',
      ...BADGE_DEFINITIONS.fee_saver,
      reason: `$${(metrics.feesWaived / 1000).toFixed(0)}k in fees waived`,
    });
  }

  // High Close Rate (70%+ with 5+ decisions)
  const totalDecisions = metrics.dealsClosedWon + metrics.dealsClosedLost;
  if (metrics.closeRate >= 0.70 && totalDecisions >= 5) {
    badges.push({
      key: 'high_close_rate',
      ...BADGE_DEFINITIONS.high_close_rate,
      reason: `${(metrics.closeRate * 100).toFixed(0)}% close rate`,
    });
  }

  // Team Favorite (manual)
  if (context.badgeOverrides?.team_favorite) {
    badges.push({
      key: 'team_favorite',
      ...BADGE_DEFINITIONS.team_favorite,
      reason: 'Selected by the team',
    });
  }

  return badges;
}

// ============================================================================
// LEADERBOARD
// ============================================================================

export async function getLeaderboard(
  orgId: string,
  filters: LeaderboardFilters = {},
  sortField: LeaderboardSortField = 'score',
  sortDirection: 'asc' | 'desc' = 'desc',
  page: number = 1,
  pageSize: number = 20
): Promise<{ entries: LeaderboardEntry[]; total: number }> {
  const {
    role,
    relationshipStatus = ['preferred', 'approved', 'neutral'],
    timeframe = 'all',
    minDeals,
    minVolume,
    minFeesWaived,
    regions,
    search,
  } = filters;

  // Build conditions
  const conditions = [
    eq(contacts.orgId, orgId),
    eq(contacts.includeInMetrics, true),
    inArray(contacts.relationshipStatus, relationshipStatus as any),
  ];

  if (role) {
    conditions.push(eq(contacts.primaryRole, role as any));
  }

  if (search) {
    conditions.push(
      or(
        ilike(contacts.name, `%${search}%`),
        ilike(contacts.email, `%${search}%`)
      )!
    );
  }

  // Get eligible contacts
  const eligibleContacts = await db
    .select()
    .from(contacts)
    .where(and(...conditions));

  // Filter by regions if specified
  let filteredContacts = eligibleContacts;
  if (regions && regions.length > 0) {
    filteredContacts = eligibleContacts.filter(c => 
      c.serviceRegions?.some(r => regions.includes(r))
    );
  }

  // Compute metrics for each contact
  const entriesWithMetrics: LeaderboardEntry[] = [];
  
  for (const contact of filteredContacts) {
    try {
      const metrics = await getContactMetrics(orgId, contact.id, timeframe);
      
      // Apply additional filters
      if (minDeals && metrics.dealsClosedWon < minDeals) continue;
      if (minVolume && metrics.totalVolume < minVolume) continue;
      if (minFeesWaived && metrics.feesWaived < minFeesWaived) continue;

      entriesWithMetrics.push({
        id: contact.id,
        name: contact.name,
        email: contact.email,
        company: contact.company,
        primaryRole: contact.primaryRole,
        relationshipStatus: contact.relationshipStatus || 'neutral',
        regions: contact.serviceRegions || [],
        headline: contact.headline,
        metricsSummary: {
          dealsTotal: metrics.dealsTotal,
          dealsClosedWon: metrics.dealsClosedWon,
          totalVolume: metrics.totalVolume,
          feesWaived: metrics.feesWaived,
          closeRate: metrics.closeRate,
          lastDealDate: metrics.lastDealDate,
        },
        score: metrics.relationshipScore,
        badges: metrics.badges,
      });
    } catch (error) {
      console.error(`Error computing metrics for contact ${contact.id}:`, error);
    }
  }

  // Sort entries
  entriesWithMetrics.sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'score':
        comparison = a.score - b.score;
        break;
      case 'volume':
        comparison = a.metricsSummary.totalVolume - b.metricsSummary.totalVolume;
        break;
      case 'deals':
        comparison = a.metricsSummary.dealsClosedWon - b.metricsSummary.dealsClosedWon;
        break;
      case 'feesWaived':
        comparison = a.metricsSummary.feesWaived - b.metricsSummary.feesWaived;
        break;
      case 'closeRate':
        comparison = a.metricsSummary.closeRate - b.metricsSummary.closeRate;
        break;
      case 'recent':
        const aDate = a.metricsSummary.lastDealDate ? new Date(a.metricsSummary.lastDealDate).getTime() : 0;
        const bDate = b.metricsSummary.lastDealDate ? new Date(b.metricsSummary.lastDealDate).getTime() : 0;
        comparison = aDate - bDate;
        break;
    }
    return sortDirection === 'desc' ? -comparison : comparison;
  });

  // Paginate
  const total = entriesWithMetrics.length;
  const startIndex = (page - 1) * pageSize;
  const paginatedEntries = entriesWithMetrics.slice(startIndex, startIndex + pageSize);

  return { entries: paginatedEntries, total };
}

// ============================================================================
// UPDATE CONTACT RELATIONSHIP FIELDS
// ============================================================================

export async function updateContactRelationship(
  orgId: string,
  contactId: string,
  data: {
    primaryRole?: string;
    roleTags?: string[];
    relationshipStatus?: string;
    includeInMetrics?: boolean;
    isPublicShowcase?: boolean;
    publicProfileSlug?: string;
    headline?: string;
    specialties?: string[];
    serviceRegions?: string[];
    visibilityScope?: string;
    badgeOverrides?: Record<string, boolean>;
  }
) {
  // Business logic: if includeInMetrics is false, enforce do_not_track
  if (data.includeInMetrics === false) {
    data.relationshipStatus = 'do_not_track';
  }

  // If status is do_not_track or hidden, disable metrics and showcase
  if (data.relationshipStatus && ['do_not_track', 'hidden'].includes(data.relationshipStatus)) {
    data.includeInMetrics = false;
    data.isPublicShowcase = false;
  }

  // If enabling public showcase, validate requirements
  if (data.isPublicShowcase === true) {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.orgId, orgId)));

    const finalStatus = data.relationshipStatus || contact?.relationshipStatus;
    if (!['preferred', 'approved'].includes(finalStatus || '')) {
      throw new Error('Public showcase requires preferred or approved status');
    }

    const finalVisibility = data.visibilityScope || contact?.visibilityScope;
    if (finalVisibility !== 'public') {
      throw new Error('Public showcase requires public visibility scope');
    }
  }

  const [updated] = await db
    .update(contacts)
    .set(data as any)
    .where(and(eq(contacts.id, contactId), eq(contacts.orgId, orgId)))
    .returning();

  return updated;
}

// ============================================================================
// FINANCIAL EVENTS
// ============================================================================

export async function createFinancialEvent(
  orgId: string,
  data: {
    dealId: string;
    eventType: string;
    amount: number;
    direction: string;
    appliesToContactId?: string;
    appliesToCompanyId?: string;
    notes?: string;
    eventDate: string;
  }
) {
  const [event] = await db
    .insert(dealFinancialEvents)
    .values({
      orgId,
      dealId: data.dealId,
      eventType: data.eventType as any,
      amount: data.amount.toString(),
      direction: data.direction as any,
      appliesToContactId: data.appliesToContactId,
      appliesToCompanyId: data.appliesToCompanyId,
      notes: data.notes,
      eventDate: data.eventDate,
    })
    .returning();

  return event;
}

export async function getFinancialEventsForDeal(orgId: string, dealId: string) {
  return db
    .select()
    .from(dealFinancialEvents)
    .where(and(eq(dealFinancialEvents.dealId, dealId), eq(dealFinancialEvents.orgId, orgId)));
}

export async function getFinancialEventsForContact(orgId: string, contactId: string) {
  return db
    .select()
    .from(dealFinancialEvents)
    .where(and(eq(dealFinancialEvents.appliesToContactId, contactId), eq(dealFinancialEvents.orgId, orgId)));
}

// ============================================================================
// CONTACT DEAL ROLES
// ============================================================================

export async function linkContactToDeal(
  orgId: string,
  data: {
    contactId: string;
    dealId: string;
    roleOnDeal?: string;
    dealSide?: string;
    isPrimaryForDeal?: boolean;
    volumeAttributionMode?: string;
    feeCreditingMode?: string;
    splitPctContact?: number;
  }
) {
  const [link] = await db
    .insert(contactDealRoles)
    .values({
      orgId,
      contactId: data.contactId,
      dealId: data.dealId,
      roleOnDeal: data.roleOnDeal as any,
      dealSide: data.dealSide as any,
      isPrimaryForDeal: data.isPrimaryForDeal || false,
      volumeAttributionMode: (data.volumeAttributionMode || 'all_linked') as any,
      feeCreditingMode: (data.feeCreditingMode || 'contact') as any,
      splitPctContact: data.splitPctContact?.toString(),
    })
    .returning();

  return link;
}

export async function getContactsForDeal(orgId: string, dealId: string) {
  return db
    .select({
      link: contactDealRoles,
      contact: contacts,
    })
    .from(contactDealRoles)
    .innerJoin(contacts, eq(contactDealRoles.contactId, contacts.id))
    .where(and(eq(contactDealRoles.dealId, dealId), eq(contactDealRoles.orgId, orgId)));
}

export async function removeContactFromDeal(orgId: string, dealId: string, contactId: string) {
  return db
    .delete(contactDealRoles)
    .where(
      and(
        eq(contactDealRoles.dealId, dealId),
        eq(contactDealRoles.contactId, contactId),
        eq(contactDealRoles.orgId, orgId)
      )
    );
}
