/**
 * Seat Enforcement Service
 *
 * Prevents subscription sharing by enforcing:
 * 1. Seat limits per subscription tier (can't invite more users than seats purchased)
 * 2. Concurrent session limits per user (prevents credential sharing)
 * 3. Per-seat pricing for enterprise/team plans
 * 4. Seat usage tracking and reporting
 */

import { db } from '../db';
import {
  users,
  billingSubscriptions,
  billingUsageMetrics,
  userSessions,
} from '@shared/schema';
import { eq, and, count, gt, sql, asc } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { SUBSCRIPTION_TIERS } from './billing-service';

// Max concurrent sessions per user, by tier
// Lower limits on cheaper tiers to prevent credential sharing
const CONCURRENT_SESSION_LIMITS: Record<string, number> = {
  starter: 2,       // 2 devices max (e.g., desktop + mobile)
  growth: 3,        // 3 devices
  institutional: 5, // 5 devices
  enterprise: 5,    // 5 devices (still limited to prevent abuse)
};

// Per-seat pricing for tiers that support seat purchases
export const PER_SEAT_PRICING: Record<string, { monthly: number; annual: number }> = {
  starter: { monthly: 99, annual: 79 },
  growth: { monthly: 79, annual: 65 },
  institutional: { monthly: 149, annual: 119 },
  enterprise: { monthly: 199, annual: 159 },
};

export interface SeatStatus {
  used: number;
  limit: number | null;  // null = unlimited
  available: number | null;
  percentUsed: number;
  tier: string;
  canAddSeat: boolean;
  perSeatPrice: { monthly: number; annual: number } | null;
}

export interface SessionEnforcementResult {
  allowed: boolean;
  evictedSessions: number;
  activeSessions: number;
  maxSessions: number;
  reason?: string;
}

class SeatEnforcementService {

  /**
   * Check if the org can add a new user (seat available)
   */
  async canAddUser(orgId: string): Promise<{ allowed: boolean; reason?: string; seatStatus: SeatStatus }> {
    const seatStatus = await this.getSeatStatus(orgId);

    if (seatStatus.limit === null) {
      return { allowed: true, seatStatus };
    }

    if (seatStatus.used >= seatStatus.limit) {
      return {
        allowed: false,
        reason: `Seat limit reached (${seatStatus.used}/${seatStatus.limit}). Upgrade your plan or purchase additional seats.`,
        seatStatus,
      };
    }

    return { allowed: true, seatStatus };
  }

  /**
   * Get current seat usage for an org
   */
  async getSeatStatus(orgId: string): Promise<SeatStatus> {
    const [sub] = await db
      .select()
      .from(billingSubscriptions)
      .where(eq(billingSubscriptions.orgId, orgId))
      .limit(1);

    const [result] = await db
      .select({ cnt: count() })
      .from(users)
      .where(and(
        eq(users.orgId, orgId),
        eq(users.isActive, true),
      ));

    const used = result?.cnt || 0;
    const tier = sub?.tier || 'starter';
    const limit = sub?.seatLimit ?? SUBSCRIPTION_TIERS[tier]?.limits?.seats ?? 3;
    const effectiveLimit = (limit === -1 || limit === null) ? null : limit;

    return {
      used,
      limit: effectiveLimit,
      available: effectiveLimit !== null ? Math.max(0, effectiveLimit - used) : null,
      percentUsed: effectiveLimit !== null && effectiveLimit > 0
        ? Math.round((used / effectiveLimit) * 100)
        : 0,
      tier,
      canAddSeat: effectiveLimit === null || used < effectiveLimit,
      perSeatPrice: PER_SEAT_PRICING[tier] || null,
    };
  }

  /**
   * Enforce concurrent session limits on login.
   * Evicts oldest sessions if user exceeds their tier's session limit.
   * Returns whether the new session is allowed.
   */
  async enforceSessionLimitsOnLogin(
    userId: string,
    orgId: string,
  ): Promise<SessionEnforcementResult> {
    // Get the org's tier to determine session limit
    const [sub] = await db
      .select({ tier: billingSubscriptions.tier })
      .from(billingSubscriptions)
      .where(eq(billingSubscriptions.orgId, orgId))
      .limit(1);

    const tier = sub?.tier || 'starter';
    const maxSessions = CONCURRENT_SESSION_LIMITS[tier] || 2;

    // Count current active sessions
    const [result] = await db
      .select({ cnt: count() })
      .from(userSessions)
      .where(and(
        eq(userSessions.userId, userId),
        eq(userSessions.status, 'active'),
        gt(userSessions.expiresAt, new Date()),
      ));

    const activeSessions = result?.cnt || 0;
    let evictedSessions = 0;

    // If at or over the limit, evict oldest sessions to make room for one new one
    if (activeSessions >= maxSessions) {
      const toEvict = activeSessions - maxSessions + 1;

      // Find the oldest active sessions to evict
      const oldestSessions = await db
        .select({ id: userSessions.id })
        .from(userSessions)
        .where(and(
          eq(userSessions.userId, userId),
          eq(userSessions.status, 'active'),
          gt(userSessions.expiresAt, new Date()),
        ))
        .orderBy(asc(userSessions.lastActivityAt))
        .limit(toEvict);

      for (const s of oldestSessions) {
        await db
          .update(userSessions)
          .set({
            status: 'revoked',
            revokedAt: new Date(),
          } as any)
          .where(eq(userSessions.id, s.id));
        evictedSessions++;
      }

      logger.info({
        userId,
        orgId,
        evictedSessions,
        maxSessions,
        tier,
      }, 'Session limit enforced — evicted oldest sessions');
    }

    return {
      allowed: true,
      evictedSessions,
      activeSessions: activeSessions - evictedSessions,
      maxSessions,
    };
  }

  /**
   * Purchase additional seats for an org.
   * Updates the seatLimit in billingSubscriptions and records usage.
   */
  async purchaseSeats(
    orgId: string,
    additionalSeats: number,
  ): Promise<{ newSeatLimit: number; totalPrice: { monthly: number; annual: number } }> {
    if (additionalSeats < 1 || additionalSeats > 100) {
      throw new Error('Additional seats must be between 1 and 100');
    }

    const [sub] = await db
      .select()
      .from(billingSubscriptions)
      .where(eq(billingSubscriptions.orgId, orgId))
      .limit(1);

    if (!sub) throw new Error('No subscription found');

    const tier = sub.tier;
    const pricing = PER_SEAT_PRICING[tier];
    if (!pricing) throw new Error(`No per-seat pricing for tier: ${tier}`);

    const currentLimit = sub.seatLimit || SUBSCRIPTION_TIERS[tier]?.limits?.seats || 3;
    if (currentLimit === -1) {
      throw new Error('This plan already includes unlimited seats');
    }

    const newSeatLimit = currentLimit + additionalSeats;

    // Update DB
    await db
      .update(billingSubscriptions)
      .set({
        seatLimit: newSeatLimit,
        seatCount: newSeatLimit,
        updatedAt: new Date(),
      } as any)
      .where(eq(billingSubscriptions.orgId, orgId));

    // Track usage metric
    await db.insert(billingUsageMetrics).values({
      orgId,
      metricType: 'seat_purchase',
      value: additionalSeats,
      period: new Date().toISOString().slice(0, 7),
    } as any);

    logger.info({
      orgId,
      tier,
      additionalSeats,
      newSeatLimit,
    }, 'Additional seats purchased');

    return {
      newSeatLimit,
      totalPrice: {
        monthly: additionalSeats * pricing.monthly,
        annual: additionalSeats * pricing.annual,
      },
    };
  }

  /**
   * Remove seats from an org (only if unused).
   */
  async removeSeats(
    orgId: string,
    seatsToRemove: number,
  ): Promise<{ newSeatLimit: number }> {
    const seatStatus = await this.getSeatStatus(orgId);

    if (seatStatus.limit === null) {
      throw new Error('Cannot remove seats from an unlimited plan');
    }

    const tierMin = SUBSCRIPTION_TIERS[seatStatus.tier]?.limits?.seats || 1;
    const newLimit = seatStatus.limit - seatsToRemove;

    if (newLimit < tierMin) {
      throw new Error(`Cannot reduce below plan minimum of ${tierMin} seats`);
    }

    if (newLimit < seatStatus.used) {
      throw new Error(
        `Cannot remove ${seatsToRemove} seats — ${seatStatus.used} are currently in use. ` +
        `Deactivate ${seatStatus.used - newLimit} user(s) first.`
      );
    }

    await db
      .update(billingSubscriptions)
      .set({
        seatLimit: newLimit,
        seatCount: newLimit,
        updatedAt: new Date(),
      } as any)
      .where(eq(billingSubscriptions.orgId, orgId));

    return { newSeatLimit: newLimit };
  }

  /**
   * Get detailed seat usage: which users are consuming seats, last active, session count.
   */
  async getSeatDetails(orgId: string): Promise<Array<{
    userId: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    lastLoginAt: Date | null;
    activeSessions: number;
  }>> {
    const orgUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(eq(users.orgId, orgId));

    // Get active session counts per user
    const sessionCounts = await db
      .select({
        userId: userSessions.userId,
        cnt: count(),
      })
      .from(userSessions)
      .where(and(
        eq(userSessions.orgId, orgId),
        eq(userSessions.status, 'active'),
        gt(userSessions.expiresAt, new Date()),
      ))
      .groupBy(userSessions.userId);

    const sessionMap = new Map(sessionCounts.map(s => [s.userId, s.cnt]));

    return orgUsers.map(u => ({
      userId: u.id,
      name: u.name || '',
      email: u.email,
      role: u.role,
      isActive: u.isActive ?? true,
      lastLoginAt: u.lastLoginAt,
      activeSessions: sessionMap.get(u.id) || 0,
    }));
  }

  /**
   * Deactivate a user and free their seat.
   */
  async deactivateUser(orgId: string, targetUserId: string, actorUserId: string): Promise<void> {
    // Verify user belongs to org
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, targetUserId), eq(users.orgId, orgId)));

    if (!user) throw new Error('User not found in this organization');
    if (user.id === actorUserId) throw new Error('Cannot deactivate yourself');
    if (user.role === 'owner') throw new Error('Cannot deactivate the organization owner');

    // Deactivate user
    await db
      .update(users)
      .set({ isActive: false } as any)
      .where(eq(users.id, targetUserId));

    // Revoke all their active sessions
    await db
      .update(userSessions)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
      } as any)
      .where(and(
        eq(userSessions.userId, targetUserId),
        eq(userSessions.status, 'active'),
      ));

    logger.info({
      orgId,
      targetUserId,
      actorUserId,
    }, 'User deactivated and sessions revoked');
  }

  /**
   * Reactivate a user (only if seat is available).
   */
  async reactivateUser(orgId: string, targetUserId: string): Promise<void> {
    const { allowed, reason } = await this.canAddUser(orgId);
    if (!allowed) {
      throw new Error(reason || 'No seats available');
    }

    await db
      .update(users)
      .set({ isActive: true } as any)
      .where(and(eq(users.id, targetUserId), eq(users.orgId, orgId)));
  }
}

export const seatEnforcementService = new SeatEnforcementService();
