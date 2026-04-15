/**
 * Broker Billing Routes
 *
 * Creates Stripe Checkout Sessions for:
 *   - Marketplace+ Solo/Pro (user-facing, unlocks follow capacity + features)
 *   - Broker Starter/Pro/Enterprise (broker-facing, unlocks profile publishing)
 *
 * Actual entitlement granting happens in the Stripe webhook handler
 * (billing-service.ts → handleWebhook → checkout.session.completed), NOT here.
 */

import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { db } from "../db";
import { brokerRegistrations } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { BROKER_TIERS, BrokerTier } from "../services/broker-tiers";
import { MARKETPLACE_PLUS_TIERS } from "../services/broker-entitlements";

const router = Router();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

function getUserContext(req: Request): { userId: string; orgId: string; email: string } | null {
  const user = (req as any).user || (req as any).session?.user;
  const userId = user?.id;
  const orgId =
    (req as any).user?.orgId ||
    (req as any).session?.user?.orgId ||
    (req as any).tenantId ||
    (req as any).orgId;
  const email = user?.email || "";
  if (!userId || !orgId) return null;
  return { userId, orgId, email };
}

function getAppBaseUrl(req: Request): string {
  return (
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_BASE_URL ||
    `${req.protocol}://${req.get("host")}`
  );
}

/**
 * POST /checkout/marketplace-plus
 * body: { tier: 'solo' | 'pro', billingCycle: 'monthly' | 'annual' }
 */
router.post("/checkout/marketplace-plus", async (req: Request, res: Response) => {
  try {
    if (!stripe) {
      return res
        .status(503)
        .json({ error: "stripe_not_configured", message: "Billing is not configured." });
    }

    const ctx = getUserContext(req);
    if (!ctx) {
      return res.status(401).json({ error: "unauthenticated", message: "Login required." });
    }

    const { tier, billingCycle } = req.body as {
      tier?: "solo" | "pro";
      billingCycle?: "monthly" | "annual";
    };

    if (!tier || (tier !== "solo" && tier !== "pro")) {
      return res
        .status(400)
        .json({ error: "invalid_tier", message: "tier must be 'solo' or 'pro'." });
    }
    if (!billingCycle || (billingCycle !== "monthly" && billingCycle !== "annual")) {
      return res.status(400).json({
        error: "invalid_billing_cycle",
        message: "billingCycle must be 'monthly' or 'annual'.",
      });
    }

    const tierDef = MARKETPLACE_PLUS_TIERS[tier];
    if (!tierDef) {
      return res.status(400).json({ error: "invalid_tier", message: "Unknown tier." });
    }

    // Resolve the Stripe price ID from env, or fall back to inline price_data
    // using the constant definition.
    const envKey = `STRIPE_PRICE_MARKETPLACE_PLUS_${tier.toUpperCase()}_${billingCycle.toUpperCase()}`;
    const priceId = process.env[envKey];

    const amountCents =
      billingCycle === "annual" ? tierDef.priceAnnualCents : tierDef.priceMonthlyCents;

    const baseUrl = getAppBaseUrl(req);
    const successUrl = `${baseUrl}/settings/billing?checkout=success&sku=marketplace_plus&tier=${tier}`;
    const cancelUrl = `${baseUrl}/settings/billing?checkout=canceled`;

    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = priceId
      ? { price: priceId, quantity: 1 }
      : {
          price_data: {
            currency: "usd",
            product_data: { name: tierDef.label },
            unit_amount: amountCents,
            recurring: { interval: billingCycle === "annual" ? "year" : "month" },
          },
          quantity: 1,
        };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [lineItem],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: ctx.email || undefined,
      metadata: {
        sku: "marketplace_plus",
        tier,
        billingCycle,
        userId: ctx.userId,
        orgId: ctx.orgId,
      },
      subscription_data: {
        metadata: {
          sku: "marketplace_plus",
          tier,
          billingCycle,
          userId: ctx.userId,
          orgId: ctx.orgId,
        },
      },
    });

    return res.json({ url: session.url });
  } catch (err: any) {
    console.error("[broker-billing] marketplace-plus checkout error:", err);
    return res
      .status(500)
      .json({ error: "checkout_failed", message: err?.message || "Unable to create checkout session." });
  }
});

/**
 * POST /checkout/broker-plan
 * body: { tier: 'starter' | 'pro' | 'enterprise', billingCycle: 'monthly' | 'annual' }
 *
 * Caller must have an approved broker_registration row.
 */
router.post("/checkout/broker-plan", async (req: Request, res: Response) => {
  try {
    if (!stripe) {
      return res
        .status(503)
        .json({ error: "stripe_not_configured", message: "Billing is not configured." });
    }

    const ctx = getUserContext(req);
    if (!ctx) {
      return res.status(401).json({ error: "unauthenticated", message: "Login required." });
    }

    const { tier, billingCycle } = req.body as {
      tier?: BrokerTier;
      billingCycle?: "monthly" | "annual";
    };

    if (!tier || !(tier in BROKER_TIERS)) {
      return res.status(400).json({
        error: "invalid_tier",
        message: "tier must be 'starter', 'pro', or 'enterprise'.",
      });
    }
    if (!billingCycle || (billingCycle !== "monthly" && billingCycle !== "annual")) {
      return res.status(400).json({
        error: "invalid_billing_cycle",
        message: "billingCycle must be 'monthly' or 'annual'.",
      });
    }

    // Require an approved broker_registration for this user
    const [registration] = await db
      .select()
      .from(brokerRegistrations)
      .where(
        and(
          eq(brokerRegistrations.userId, ctx.userId),
          eq(brokerRegistrations.status, "approved"),
        ),
      )
      .limit(1);

    if (!registration) {
      return res.status(403).json({
        error: "broker_not_approved",
        message:
          "You must complete broker registration and be approved before subscribing to a broker plan.",
      });
    }

    const tierDef = BROKER_TIERS[tier];
    const envKey = `STRIPE_PRICE_BROKER_${tier.toUpperCase()}_${billingCycle.toUpperCase()}`;
    const priceId =
      process.env[envKey] ||
      (billingCycle === "annual" ? tierDef.stripePriceIdAnnual : tierDef.stripePriceIdMonthly);

    const amountCents =
      billingCycle === "annual" ? tierDef.priceAnnualCents : tierDef.priceMonthlyCents;

    const baseUrl = getAppBaseUrl(req);
    const successUrl = `${baseUrl}/broker/dashboard?checkout=success&sku=broker_plan&tier=${tier}`;
    const cancelUrl = `${baseUrl}/broker/dashboard?checkout=canceled`;

    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = priceId
      ? { price: priceId, quantity: 1 }
      : {
          price_data: {
            currency: "usd",
            product_data: { name: tierDef.label },
            unit_amount: amountCents,
            recurring: { interval: billingCycle === "annual" ? "year" : "month" },
          },
          quantity: 1,
        };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [lineItem],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: ctx.email || registration.email || undefined,
      metadata: {
        sku: "broker_plan",
        tier,
        billingCycle,
        brokerUserId: ctx.userId,
        brokerRegistrationId: registration.id,
        orgId: ctx.orgId,
      },
      subscription_data: {
        metadata: {
          sku: "broker_plan",
          tier,
          billingCycle,
          brokerUserId: ctx.userId,
          brokerRegistrationId: registration.id,
          orgId: ctx.orgId,
        },
      },
    });

    return res.json({ url: session.url });
  } catch (err: any) {
    console.error("[broker-billing] broker-plan checkout error:", err);
    return res
      .status(500)
      .json({ error: "checkout_failed", message: err?.message || "Unable to create checkout session." });
  }
});

export default router;
