/**
 * Beta billing guard middleware.
 *
 * Orgs flagged `is_beta=true` must never reach a Stripe charge flow. This
 * middleware short-circuits any request whose authenticated org is in beta,
 * returning 402 Payment Required with a user-friendly message.
 *
 * Apply to endpoints that create subscriptions, purchase packs/seats, open
 * the Stripe billing portal, or otherwise move money. Read-only billing
 * endpoints (/plans, /invoices, /usage, /subscription) do NOT need this —
 * they simply won't return live Stripe state for beta orgs, which is fine.
 */

import type { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { organizations } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';

export async function requireNotBeta(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId;
    if (!orgId) {
      // No org context — let downstream auth middleware produce the 401.
      return next();
    }

    const [org] = await db.select({ isBeta: organizations.isBeta })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (org?.isBeta) {
      return res.status(402).json({
        error: 'Beta accounts do not have paid billing enabled.',
        detail: 'Your organization is in the MarinaMatch beta program — all features are free until GA. Billing surfaces will be enabled when the beta ends.',
        code: 'BETA_BILLING_DISABLED',
      });
    }

    return next();
  } catch (error) {
    logger.error({ error }, 'requireNotBeta middleware error');
    // Fail closed: if we cannot determine beta status, reject the charge.
    return res.status(500).json({ error: 'Could not verify billing eligibility.' });
  }
}
