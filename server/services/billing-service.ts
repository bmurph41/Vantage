import { db } from '../db';
import {
  billingSubscriptions,
  billingInvoices,
  billingUsageMetrics,
  billingFeatureFlags,
  crmDeals,
  users,
  orgMarketplaceEntitlements,
  brokerProfiles,
} from '@shared/schema';
import { eq, and, sql, count, desc } from 'drizzle-orm';
import Stripe from 'stripe';
import {
  MARKETPLACE_PLUS_TIERS,
  setUserBrokerEntitlement,
  type MarketplacePlusTier,
} from './broker-entitlements';
import {
  BROKER_TIERS,
  resolveBrokerTierFromPriceId,
  resolveMarketplacePlusTierFromPriceId,
  type BrokerTier,
} from './broker-tiers';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export interface TierDefinition {
  name: string;
  priceMonthly: number | null;
  priceAnnual: number | null;
  features: string[];
  limits: {
    deals: number;
    seats: number;
    storageGb: number;
    aiQueries: number;
    lpInvestors?: number;
  };
}

const STARTER_FEATURES = [
  'deal_workspace',
  'crm_basic',
  'financial_model',
  'document_vault',
  'dd_checklist',
  'basic_reporting',
];

const GROWTH_FEATURES = [
  ...STARTER_FEATURES,
  'lp_portal',
  'capital_calls',
  'distributions',
  'workflow_automation',
  'gantt_view',
  'ai_narratives',
  'lease_abstractor',
  'email_integration',
  'sms_alerts',
  'vendor_management',
  'work_orders',
];

const INSTITUTIONAL_FEATURES = [
  ...GROWTH_FEATURES,
  'portfolio_dashboard',
  'benchmark_engine',
  'stress_testing',
  'fund_accounting',
  'kyc_aml',
  'capital_account_ledger',
  'construction_module',
  'custom_report_builder',
  'performance_attribution',
  'ai_underwriting',
  'document_intelligence',
  'sso',
  'audit_trail',
  'white_label',
  'api_access',
  'custom_deal_stages',
  'waterfall_engine',
];

export const SUBSCRIPTION_TIERS: Record<string, TierDefinition> = {
  starter: {
    name: 'Starter',
    priceMonthly: 299,
    priceAnnual: 249,
    features: STARTER_FEATURES,
    limits: { deals: 10, seats: 3, storageGb: 10, aiQueries: 100 },
  },
  growth: {
    name: 'Growth',
    priceMonthly: 799,
    priceAnnual: 649,
    features: GROWTH_FEATURES,
    limits: { deals: 50, seats: 10, storageGb: 100, aiQueries: 1000, lpInvestors: 50 },
  },
  institutional: {
    name: 'Institutional',
    priceMonthly: 1999,
    priceAnnual: 1649,
    features: INSTITUTIONAL_FEATURES,
    limits: { deals: -1, seats: -1, storageGb: 1000, aiQueries: -1, lpInvestors: -1 },
  },
  enterprise: {
    name: 'Enterprise',
    priceMonthly: null,
    priceAnnual: null,
    features: ['everything'],
    limits: { deals: -1, seats: -1, storageGb: -1, aiQueries: -1, lpInvestors: -1 },
  },
};

export class BillingService {
  /**
   * Fetch the billing subscription for an organization.
   */
  async getSubscription(orgId: string) {
    const [sub] = await db
      .select()
      .from(billingSubscriptions)
      .where(eq(billingSubscriptions.orgId, orgId))
      .limit(1);
    return sub || null;
  }

  /**
   * Create a new subscription for an organization.
   * If Stripe is configured, creates a Stripe customer + subscription with 14-day trial.
   * Otherwise operates in offline/DB-only mode.
   */
  async createSubscription(
    orgId: string,
    email: string,
    tier: string,
    billingCycle: 'monthly' | 'annual',
    paymentMethodId?: string,
  ) {
    const tierDef = SUBSCRIPTION_TIERS[tier];
    if (!tierDef) throw new Error(`Invalid tier: ${tier}`);

    let stripeCustomerId: string | null = null;
    let stripeSubscriptionId: string | null = null;
    let stripePriceId: string | null = null;
    let currentPeriodStart: Date | null = null;
    let currentPeriodEnd: Date | null = null;
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    if (stripe && tierDef.priceMonthly !== null) {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        email,
        metadata: { orgId },
      });
      stripeCustomerId = customer.id;

      // Attach payment method if provided
      if (paymentMethodId) {
        await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
        await stripe.customers.update(customer.id, {
          invoice_settings: { default_payment_method: paymentMethodId },
        });
      }

      // Determine price — lookup by tier/cycle or use a placeholder lookup
      const price = billingCycle === 'annual' ? tierDef.priceAnnual : tierDef.priceMonthly;
      const priceInCents = (price || 0) * 100;

      // Create Stripe subscription with trial
      const stripeSub = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price_data: {
          currency: 'usd',
          product_data: { name: `Vantage ${tierDef.name}` },
          unit_amount: priceInCents,
          recurring: { interval: billingCycle === 'annual' ? 'year' : 'month' },
        }}],
        trial_period_days: 14,
        metadata: { orgId, tier },
      });

      stripeSubscriptionId = stripeSub.id;
      stripePriceId = stripeSub.items.data[0]?.price?.id || null;
      currentPeriodStart = new Date(stripeSub.current_period_start * 1000);
      currentPeriodEnd = new Date(stripeSub.current_period_end * 1000);
    } else {
      // Offline mode
      currentPeriodStart = now;
      currentPeriodEnd = billingCycle === 'annual'
        ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    const [subscription] = await db
      .insert(billingSubscriptions)
      .values({
        orgId,
        stripeCustomerId,
        stripeSubscriptionId,
        stripePriceId,
        tier,
        status: 'trialing',
        billingCycle,
        currentPeriodStart,
        currentPeriodEnd,
        trialStart: now,
        trialEnd,
        seatLimit: tierDef.limits.seats === -1 ? null : tierDef.limits.seats,
        dealLimit: tierDef.limits.deals === -1 ? null : tierDef.limits.deals,
        aiQueryLimit: tierDef.limits.aiQueries === -1 ? null : tierDef.limits.aiQueries,
        storageGbLimit: tierDef.limits.storageGb === -1 ? null : tierDef.limits.storageGb,
      } as any)
      .returning();

    // Provision feature flags for this tier
    await this.provisionFeatureFlags(orgId, tier);

    return subscription;
  }

  /**
   * Check if an org can access a given feature based on billing feature flags.
   */
  async canAccess(orgId: string, feature: string): Promise<boolean> {
    const [flag] = await db
      .select()
      .from(billingFeatureFlags)
      .where(
        and(
          eq(billingFeatureFlags.orgId, orgId),
          eq(billingFeatureFlags.feature, feature),
        ),
      )
      .limit(1);

    if (!flag) return false;
    if (!flag.isEnabled) return false;

    // Check override expiry
    if (flag.isOverride && flag.overrideExpiresAt) {
      if (new Date(flag.overrideExpiresAt) < new Date()) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check usage against tier limits.
   * Returns { allowed, current, limit, pct }.
   */
  async checkLimit(orgId: string, limitType: string) {
    const sub = await this.getSubscription(orgId);
    if (!sub) {
      return { allowed: false, current: 0, limit: 0, pct: 0 };
    }

    const tierDef = SUBSCRIPTION_TIERS[sub.tier];
    if (!tierDef) {
      return { allowed: false, current: 0, limit: 0, pct: 0 };
    }

    const limits = tierDef.limits as Record<string, number>;
    const limit = limits[limitType];
    if (limit === undefined) {
      return { allowed: false, current: 0, limit: 0, pct: 0 };
    }

    // Unlimited
    if (limit === -1) {
      return { allowed: true, current: 0, limit: -1, pct: 0 };
    }

    let current = 0;
    const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM

    if (limitType === 'deals') {
      const [result] = await db
        .select({ cnt: count() })
        .from(crmDeals)
        .where(eq(crmDeals.orgId, orgId));
      current = result?.cnt || 0;
    } else if (limitType === 'seats') {
      const [result] = await db
        .select({ cnt: count() })
        .from(users)
        .where(eq(users.orgId, orgId));
      current = result?.cnt || 0;
    } else if (limitType === 'aiQueries' || limitType === 'ai_queries') {
      const metricType = 'ai_query';
      const [result] = await db
        .select({ total: sql<number>`COALESCE(SUM(${billingUsageMetrics.value}), 0)` })
        .from(billingUsageMetrics)
        .where(
          and(
            eq(billingUsageMetrics.orgId, orgId),
            eq(billingUsageMetrics.metricType, metricType),
            eq(billingUsageMetrics.period, currentPeriod),
          ),
        );
      current = Number(result?.total) || 0;
    } else {
      // Generic usage metric lookup
      const [result] = await db
        .select({ total: sql<number>`COALESCE(SUM(${billingUsageMetrics.value}), 0)` })
        .from(billingUsageMetrics)
        .where(
          and(
            eq(billingUsageMetrics.orgId, orgId),
            eq(billingUsageMetrics.metricType, limitType),
            eq(billingUsageMetrics.period, currentPeriod),
          ),
        );
      current = Number(result?.total) || 0;
    }

    const pct = limit > 0 ? Math.round((current / limit) * 100) : 0;

    return {
      allowed: current < limit,
      current,
      limit,
      pct,
    };
  }

  /**
   * Change the subscription plan/tier.
   */
  async changePlan(orgId: string, newTier: string) {
    const tierDef = SUBSCRIPTION_TIERS[newTier];
    if (!tierDef) throw new Error(`Invalid tier: ${newTier}`);

    const sub = await this.getSubscription(orgId);
    if (!sub) throw new Error('No subscription found for this organization');

    // Update Stripe if configured
    if (stripe && sub.stripeSubscriptionId && tierDef.priceMonthly !== null) {
      const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
      const price = sub.billingCycle === 'annual' ? tierDef.priceAnnual : tierDef.priceMonthly;
      const priceInCents = (price || 0) * 100;

      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        items: [{
          id: stripeSub.items.data[0].id,
          price_data: {
            currency: 'usd',
            product_data: { name: `Vantage ${tierDef.name}` },
            unit_amount: priceInCents,
            recurring: { interval: sub.billingCycle === 'annual' ? 'year' : 'month' },
          },
        }],
        proration_behavior: 'create_prorations',
        metadata: { orgId, tier: newTier },
      });
    }

    // Update DB
    const [updated] = await db
      .update(billingSubscriptions)
      .set({
        tier: newTier,
        seatLimit: tierDef.limits.seats === -1 ? null : tierDef.limits.seats,
        dealLimit: tierDef.limits.deals === -1 ? null : tierDef.limits.deals,
        aiQueryLimit: tierDef.limits.aiQueries === -1 ? null : tierDef.limits.aiQueries,
        storageGbLimit: tierDef.limits.storageGb === -1 ? null : tierDef.limits.storageGb,
        updatedAt: new Date(),
      } as any)
      .where(eq(billingSubscriptions.orgId, orgId))
      .returning();

    // Re-provision feature flags for the new tier
    await this.provisionFeatureFlags(orgId, newTier);

    return updated;
  }

  /**
   * Cancel subscription at period end.
   */
  async cancelSubscription(orgId: string, reason?: string) {
    const sub = await this.getSubscription(orgId);
    if (!sub) throw new Error('No subscription found for this organization');

    // Cancel at period end via Stripe
    if (stripe && sub.stripeSubscriptionId) {
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    }

    const [updated] = await db
      .update(billingSubscriptions)
      .set({
        status: 'canceled',
        canceledAt: new Date(),
        cancelAt: sub.currentPeriodEnd,
        cancelReason: reason || null,
        updatedAt: new Date(),
      } as any)
      .where(eq(billingSubscriptions.orgId, orgId))
      .returning();

    return updated;
  }

  /**
   * Reactivate a canceled subscription.
   */
  async reactivateSubscription(orgId: string) {
    const sub = await this.getSubscription(orgId);
    if (!sub) throw new Error('No subscription found for this organization');

    if (stripe && sub.stripeSubscriptionId) {
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });
    }

    const [updated] = await db
      .update(billingSubscriptions)
      .set({
        status: 'active',
        cancelAt: null,
        canceledAt: null,
        cancelReason: null,
        updatedAt: new Date(),
      } as any)
      .where(eq(billingSubscriptions.orgId, orgId))
      .returning();

    return updated;
  }

  /**
   * Handle Stripe webhook events.
   */
  async handleWebhook(event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.handleCheckoutSessionCompleted(session);
        break;
      }

      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string'
          ? invoice.customer
          : invoice.customer?.id;

        if (customerId) {
          // Update subscription status
          await db
            .update(billingSubscriptions)
            .set({ status: 'active', updatedAt: new Date() } as any)
            .where(eq(billingSubscriptions.stripeCustomerId, customerId));

          // Save invoice record
          const [sub] = await db
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.stripeCustomerId, customerId))
            .limit(1);

          if (sub) {
            await db.insert(billingInvoices).values({
              orgId: sub.orgId,
              stripeInvoiceId: invoice.id,
              amount: invoice.amount_paid,
              currency: invoice.currency || 'usd',
              status: 'paid',
              invoiceUrl: invoice.hosted_invoice_url || null,
              pdfUrl: invoice.invoice_pdf || null,
              periodStart: invoice.period_start
                ? new Date(invoice.period_start * 1000)
                : null,
              periodEnd: invoice.period_end
                ? new Date(invoice.period_end * 1000)
                : null,
              paidAt: new Date(),
            } as any);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string'
          ? invoice.customer
          : invoice.customer?.id;

        if (customerId) {
          await db
            .update(billingSubscriptions)
            .set({ status: 'past_due', updatedAt: new Date() } as any)
            .where(eq(billingSubscriptions.stripeCustomerId, customerId));
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id;

        if (customerId) {
          await db
            .update(billingSubscriptions)
            .set({
              status: 'canceled',
              canceledAt: new Date(),
              updatedAt: new Date(),
            } as any)
            .where(eq(billingSubscriptions.stripeCustomerId, customerId));
        }

        await this.handleSubscriptionCanceled(subscription);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id;

        if (customerId) {
          await db
            .update(billingSubscriptions)
            .set({
              status: subscription.status,
              currentPeriodStart: new Date(subscription.current_period_start * 1000),
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              updatedAt: new Date(),
            } as any)
            .where(eq(billingSubscriptions.stripeCustomerId, customerId));
        }

        // If the subscription transitioned to canceled (e.g. immediate cancel),
        // also downgrade broker / Marketplace+ entitlements.
        if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
          await this.handleSubscriptionCanceled(subscription);
        }
        break;
      }

      case 'customer.subscription.trial_will_end': {
        // Could send notification email here
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id;

        if (customerId) {
          // Log trial ending — notification hook point
          console.log(`Trial ending soon for Stripe customer: ${customerId}`);
        }
        break;
      }
    }
  }

  /**
   * Handle `checkout.session.completed` for Marketplace+ and Broker SKUs.
   * Core platform subscription checkouts are handled elsewhere (they are
   * created via `createSubscription` and come back through invoice events).
   */
  async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    const metadata = (session.metadata || {}) as Record<string, string | undefined>;
    const sku = metadata.sku;

    // Resolve price ID if metadata didn't specify tier cleanly
    let priceId: string | null = null;
    try {
      if (stripe && session.id) {
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
        priceId = lineItems.data[0]?.price?.id || null;
      }
    } catch (err) {
      console.error('[billing webhook] could not list line items:', err);
    }

    const stripeSubscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id || null;

    // ── Marketplace+ (user-facing buyer plan) ──
    if (sku === 'marketplace_plus') {
      const userId = metadata.userId;
      const orgId = metadata.orgId;
      let tier = metadata.tier as MarketplacePlusTier | undefined;

      if (!tier && priceId) {
        const resolved = resolveMarketplacePlusTierFromPriceId(priceId);
        if (resolved) tier = resolved.tier;
      }

      if (!userId || !orgId || !tier || !(tier in MARKETPLACE_PLUS_TIERS)) {
        console.error('[billing webhook] marketplace_plus checkout missing metadata', {
          sessionId: session.id,
          userId,
          orgId,
          tier,
        });
        return;
      }

      await setUserBrokerEntitlement({
        userId,
        orgId,
        tier,
        source: 'subscription',
      });

      const def = MARKETPLACE_PLUS_TIERS[tier];
      const now = new Date();
      await db
        .insert(orgMarketplaceEntitlements)
        .values({
          orgId,
          marketplacePlusTier: tier,
          brokerFollowLimit: def.brokerFollowLimit,
          brokerAdvisoryLimit: def.brokerAdvisoryLimit,
          savedSearchLimit: def.savedSearchLimit,
          listingExportLimitMonthly: def.listingExportLimitMonthly,
          earlyAccessHours: def.earlyAccessHours,
          allowBrokerMessaging: def.allowBrokerMessaging,
          allowOffMarketAlerts: def.allowOffMarketAlerts,
          source: 'subscription',
          stripeSubscriptionId,
          effectiveAt: now,
        } as any)
        .onConflictDoUpdate({
          target: orgMarketplaceEntitlements.orgId,
          set: {
            marketplacePlusTier: tier,
            brokerFollowLimit: def.brokerFollowLimit,
            brokerAdvisoryLimit: def.brokerAdvisoryLimit,
            savedSearchLimit: def.savedSearchLimit,
            listingExportLimitMonthly: def.listingExportLimitMonthly,
            earlyAccessHours: def.earlyAccessHours,
            allowBrokerMessaging: def.allowBrokerMessaging,
            allowOffMarketAlerts: def.allowOffMarketAlerts,
            source: 'subscription',
            stripeSubscriptionId,
            effectiveAt: now,
            updatedAt: now,
          },
        });

      console.log(`[billing webhook] granted marketplace_plus/${tier} to user=${userId} org=${orgId}`);
      return;
    }

    // ── Core platform subscription (Starter / Growth / Institutional) ──
    // Fired when /api/billing/checkout session completes for Vantage SaaS plans.
    if (!sku) {
      const orgId = metadata.orgId;
      const tier = metadata.tier;
      const billingCycle = (metadata.billingCycle || 'monthly') as 'monthly' | 'annual';

      if (orgId && tier && SUBSCRIPTION_TIERS[tier as keyof typeof SUBSCRIPTION_TIERS]) {
        const tierDef = SUBSCRIPTION_TIERS[tier as keyof typeof SUBSCRIPTION_TIERS];
        const stripeCustomerId =
          typeof session.customer === 'string'
            ? session.customer
            : (session.customer as any)?.id || null;
        const now = new Date();
        const periodEnd =
          billingCycle === 'annual'
            ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
            : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        await db
          .insert(billingSubscriptions)
          .values({
            orgId,
            stripeCustomerId,
            stripeSubscriptionId,
            tier,
            status: 'active',
            billingCycle,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            seatLimit: tierDef.limits.seats === -1 ? null : tierDef.limits.seats,
            dealLimit: tierDef.limits.deals === -1 ? null : tierDef.limits.deals,
            aiQueryLimit: tierDef.limits.aiQueries === -1 ? null : tierDef.limits.aiQueries,
            storageGbLimit: tierDef.limits.storageGb === -1 ? null : tierDef.limits.storageGb,
          } as any)
          .onConflictDoUpdate({
            target: billingSubscriptions.orgId,
            set: {
              tier,
              status: 'active',
              stripeCustomerId,
              stripeSubscriptionId,
              currentPeriodStart: now,
              currentPeriodEnd: periodEnd,
              updatedAt: new Date(),
            } as any,
          });

        await this.provisionFeatureFlags(orgId, tier);
        console.log(`[billing webhook] provisioned core platform subscription ${tier} for org=${orgId}`);
        return;
      }
    }

    // ── Broker plan (broker-facing SaaS subscription) ──
    if (sku === 'broker_plan') {
      const brokerUserId = metadata.brokerUserId;
      let tier = metadata.tier as BrokerTier | undefined;

      if (!tier && priceId) {
        const resolved = resolveBrokerTierFromPriceId(priceId);
        if (resolved) tier = resolved.tier;
      }

      if (!brokerUserId || !tier || !(tier in BROKER_TIERS)) {
        console.error('[billing webhook] broker_plan checkout missing metadata', {
          sessionId: session.id,
          brokerUserId,
          tier,
        });
        return;
      }

      const [existingProfile] = await db
        .select()
        .from(brokerProfiles)
        .where(eq(brokerProfiles.userId, brokerUserId))
        .limit(1);

      if (existingProfile) {
        await db
          .update(brokerProfiles)
          .set({
            brokerTier: tier,
            isPublishable: true,
            updatedAt: new Date(),
          } as any)
          .where(eq(brokerProfiles.id, existingProfile.id));
        console.log(
          `[billing webhook] upgraded broker profile ${existingProfile.id} to ${tier} (user=${brokerUserId})`,
        );
      } else {
        console.warn(
          `[billing webhook] broker_plan purchased but no broker_profile yet for user=${brokerUserId}. Profile will inherit tier=${tier} on approval.`,
        );
      }
      return;
    }
  }

  /**
   * Downgrade Marketplace+ / Broker entitlements when a Stripe subscription
   * is canceled or deleted. Identifies the SKU via subscription metadata.
   */
  async handleSubscriptionCanceled(subscription: Stripe.Subscription) {
    const metadata = (subscription.metadata || {}) as Record<string, string | undefined>;
    const sku = metadata.sku;

    if (sku === 'marketplace_plus') {
      const userId = metadata.userId;
      const orgId = metadata.orgId;
      if (!userId || !orgId) {
        console.warn('[billing webhook] marketplace_plus cancel missing metadata', {
          subscriptionId: subscription.id,
        });
        return;
      }
      await setUserBrokerEntitlement({
        userId,
        orgId,
        tier: 'free',
        source: 'default',
      });
      const freeDef = MARKETPLACE_PLUS_TIERS.free;
      await db
        .update(orgMarketplaceEntitlements)
        .set({
          marketplacePlusTier: 'free',
          brokerFollowLimit: freeDef.brokerFollowLimit,
          brokerAdvisoryLimit: freeDef.brokerAdvisoryLimit,
          savedSearchLimit: freeDef.savedSearchLimit,
          listingExportLimitMonthly: freeDef.listingExportLimitMonthly,
          earlyAccessHours: freeDef.earlyAccessHours,
          allowBrokerMessaging: freeDef.allowBrokerMessaging,
          allowOffMarketAlerts: freeDef.allowOffMarketAlerts,
          source: 'default',
          stripeSubscriptionId: null,
          updatedAt: new Date(),
        } as any)
        .where(eq(orgMarketplaceEntitlements.orgId, orgId));
      console.log(`[billing webhook] downgraded marketplace_plus to free user=${userId} org=${orgId}`);
      return;
    }

    if (sku === 'broker_plan') {
      const brokerUserId = metadata.brokerUserId;
      if (!brokerUserId) {
        console.warn('[billing webhook] broker_plan cancel missing metadata', {
          subscriptionId: subscription.id,
        });
        return;
      }
      await db
        .update(brokerProfiles)
        .set({
          isPublishable: false,
          brokerTier: 'starter',
          updatedAt: new Date(),
        } as any)
        .where(eq(brokerProfiles.userId, brokerUserId));
      console.log(`[billing webhook] deactivated broker profile for user=${brokerUserId}`);
      return;
    }
  }

  /**
   * Provision feature flags for an org based on their subscription tier.
   * Deletes existing flags and inserts new ones based on the tier definition.
   */
  async provisionFeatureFlags(orgId: string, tier: string) {
    const tierDef = SUBSCRIPTION_TIERS[tier];
    if (!tierDef) throw new Error(`Invalid tier: ${tier}`);

    // Delete existing non-override flags for this org
    await db
      .delete(billingFeatureFlags)
      .where(
        and(
          eq(billingFeatureFlags.orgId, orgId),
          eq(billingFeatureFlags.isOverride, false),
        ),
      );

    // Insert new feature flags based on tier
    const features = tierDef.features;
    if (features.length > 0) {
      const now = new Date();
      const flagValues = features.map((feature) => ({
        orgId,
        feature,
        isEnabled: true,
        enabledAt: now,
        isOverride: false,
      }));

      await db
        .insert(billingFeatureFlags)
        .values(flagValues as any)
        .onConflictDoUpdate({
          target: [billingFeatureFlags.orgId, billingFeatureFlags.feature],
          set: {
            isEnabled: sql`EXCLUDED.is_enabled`,
            enabledAt: sql`EXCLUDED.enabled_at`,
            isOverride: sql`EXCLUDED.is_override`,
          },
        });
    }
  }

  /**
   * Get current usage metrics for all metric types for an org.
   */
  async getUsageMetrics(orgId: string) {
    const currentPeriod = new Date().toISOString().slice(0, 7);
    const metrics = await db
      .select()
      .from(billingUsageMetrics)
      .where(
        and(
          eq(billingUsageMetrics.orgId, orgId),
          eq(billingUsageMetrics.period, currentPeriod),
        ),
      );
    return metrics;
  }

  /**
   * Record a usage metric value for the current period.
   */
  async recordUsage(orgId: string, metricType: string, value: number) {
    const currentPeriod = new Date().toISOString().slice(0, 7);

    // Try to find existing metric for this period
    const [existing] = await db
      .select()
      .from(billingUsageMetrics)
      .where(
        and(
          eq(billingUsageMetrics.orgId, orgId),
          eq(billingUsageMetrics.metricType, metricType),
          eq(billingUsageMetrics.period, currentPeriod),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(billingUsageMetrics)
        .set({
          value: sql`${billingUsageMetrics.value} + ${value}`,
          recordedAt: new Date(),
        } as any)
        .where(eq(billingUsageMetrics.id, existing.id))
        .returning();
      return updated;
    }

    const [inserted] = await db
      .insert(billingUsageMetrics)
      .values({
        orgId,
        metricType,
        value,
        period: currentPeriod,
      } as any)
      .returning();
    return inserted;
  }

  /**
   * List invoices for an org, ordered by date descending.
   */
  async getInvoices(orgId: string) {
    return db
      .select()
      .from(billingInvoices)
      .where(eq(billingInvoices.orgId, orgId))
      .orderBy(desc(billingInvoices.createdAt));
  }

  /**
   * Create a Stripe billing portal session for managing payment methods, invoices, etc.
   * Returns { url } on success, or throws an Error with a user-friendly message.
   */
  async createPortalSession(orgId: string, returnUrl: string): Promise<{ url: string }> {
    if (!stripe) {
      const err = new Error('Billing not configured — contact support to enable payments');
      (err as any).statusCode = 503;
      throw err;
    }

    const sub = await this.getSubscription(orgId);
    if (!sub?.stripeCustomerId) {
      const err = new Error('No billing account found. Subscribe to a plan first.');
      (err as any).statusCode = 400;
      throw err;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  }

  /**
   * Preview the prorated cost of changing plans.
   */
  async previewProration(orgId: string, newTier: string) {
    const tierDef = SUBSCRIPTION_TIERS[newTier];
    if (!tierDef) throw new Error(`Invalid tier: ${newTier}`);

    const sub = await this.getSubscription(orgId);
    if (!sub) throw new Error('No subscription found for this organization');

    const currentTierDef = SUBSCRIPTION_TIERS[sub.tier];
    const currentPrice = sub.billingCycle === 'annual'
      ? (currentTierDef?.priceAnnual || 0)
      : (currentTierDef?.priceMonthly || 0);
    const newPrice = sub.billingCycle === 'annual'
      ? (tierDef.priceAnnual || 0)
      : (tierDef.priceMonthly || 0);

    if (stripe && sub.stripeSubscriptionId) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
        const proration_date = Math.floor(Date.now() / 1000);
        const priceInCents = newPrice * 100;

        const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
          customer: sub.stripeCustomerId!,
          subscription: sub.stripeSubscriptionId,
          subscription_items: [{
            id: stripeSub.items.data[0].id,
            price_data: {
              currency: 'usd',
              product_data: { name: `Vantage ${tierDef.name}` },
              unit_amount: priceInCents,
              recurring: { interval: sub.billingCycle === 'annual' ? 'year' : 'month' },
            },
          }],
          subscription_proration_date: proration_date,
        });

        return {
          currentTier: sub.tier,
          newTier,
          currentPrice,
          newPrice,
          proratedAmount: upcomingInvoice.amount_due / 100,
          billingCycle: sub.billingCycle,
          effectiveDate: new Date(proration_date * 1000).toISOString(),
        };
      } catch {
        // Fall through to offline calculation
      }
    }

    // Offline proration estimate
    const diff = newPrice - currentPrice;
    const now = new Date();
    const periodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : now;
    const periodStart = sub.currentPeriodStart ? new Date(sub.currentPeriodStart) : now;
    const totalPeriodMs = periodEnd.getTime() - periodStart.getTime();
    const remainingMs = Math.max(0, periodEnd.getTime() - now.getTime());
    const remainingRatio = totalPeriodMs > 0 ? remainingMs / totalPeriodMs : 0;
    const proratedAmount = Math.round(diff * remainingRatio * 100) / 100;

    return {
      currentTier: sub.tier,
      newTier,
      currentPrice,
      newPrice,
      proratedAmount,
      billingCycle: sub.billingCycle,
      effectiveDate: now.toISOString(),
    };
  }

  /**
   * Check whether a broker user currently has an active broker_plan Stripe
   * subscription. Used by publish gates and entitlement enforcement.
   *
   * Strategy:
   *   1. In production (Stripe configured): resolve the user's org → customer
   *      id via billing_subscriptions, list active Stripe subscriptions for
   *      that customer, and require one tagged with sku=broker_plan and
   *      brokerUserId matching this user.
   *   2. In dev (no STRIPE_SECRET_KEY): fall back to trusting the denormalized
   *      brokerProfiles.brokerTier + isPublishable state that the webhook
   *      would otherwise maintain.
   */
  async hasActiveBrokerPlan(
    userId: string,
  ): Promise<{ active: boolean; tier?: BrokerTier }> {
    if (!stripe) {
      const [profile] = await db
        .select()
        .from(brokerProfiles)
        .where(eq(brokerProfiles.userId, userId))
        .limit(1);
      if (profile?.brokerTier && profile.brokerTier in BROKER_TIERS) {
        return { active: true, tier: profile.brokerTier as BrokerTier };
      }
      return { active: false };
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user?.orgId) return { active: false };

    const [sub] = await db
      .select()
      .from(billingSubscriptions)
      .where(eq(billingSubscriptions.orgId, user.orgId))
      .limit(1);
    if (!sub?.stripeCustomerId) return { active: false };

    const stripeSubs = await stripe.subscriptions.list({
      customer: sub.stripeCustomerId,
      status: 'active',
      limit: 100,
    });

    for (const s of stripeSubs.data) {
      const md = (s.metadata || {}) as Record<string, string | undefined>;
      if (
        md.sku === 'broker_plan' &&
        md.brokerUserId === userId &&
        md.tier &&
        md.tier in BROKER_TIERS
      ) {
        return { active: true, tier: md.tier as BrokerTier };
      }
    }
    return { active: false };
  }
}

const billingService = new BillingService();
export default billingService;
