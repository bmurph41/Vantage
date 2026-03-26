import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import Stripe from 'stripe';
import billingService, { SUBSCRIPTION_TIERS } from '../services/billing-service';
import { AuthenticatedRequest } from '../middleware/auth-resolver';

const router = Router();

// Capture raw body for Stripe webhook signature verification
// This must run before express.json() parses the body
router.use('/webhooks', express.raw({ type: 'application/json' }), (req: Request, _res: Response, next: NextFunction) => {
  if (Buffer.isBuffer(req.body)) {
    (req as any).rawBody = req.body;
    req.body = JSON.parse(req.body.toString('utf8'));
  }
  next();
});

function getOrgId(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  if (authReq.validatedOrgId) return authReq.validatedOrgId;
  return (req as any).tenantId || (req as any).user?.orgId || (req as any).session?.orgId || 'org-1';
}

function getUserEmail(req: Request): string {
  return (req as any).user?.email || (req as any).session?.email || '';
}

// GET /plans — public, no auth needed
router.get('/plans', (_req: Request, res: Response) => {
  res.json(SUBSCRIPTION_TIERS);
});

// GET /subscription — get current org subscription + usage metrics
router.get('/subscription', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const subscription = await billingService.getSubscription(orgId);
    const usage = await billingService.getUsageMetrics(orgId);
    res.json({ subscription, usage });
  } catch (err) {
    next(err);
  }
});

// POST /create-subscription — create a new subscription
router.post('/create-subscription', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const email = getUserEmail(req);
    const { tier, billingCycle, paymentMethodId } = req.body;

    if (!tier || !billingCycle) {
      return res.status(400).json({ error: 'tier and billingCycle are required' });
    }

    const subscription = await billingService.createSubscription(
      orgId,
      email,
      tier,
      billingCycle,
      paymentMethodId,
    );
    res.json(subscription);
  } catch (err) {
    next(err);
  }
});

// POST /create-setup-intent — create Stripe SetupIntent for collecting payment method
router.post('/create-setup-intent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stripe = process.env.STRIPE_SECRET_KEY
      ? new Stripe(process.env.STRIPE_SECRET_KEY)
      : null;

    if (!stripe) {
      return res.status(503).json({ error: 'Stripe is not configured' });
    }

    const orgId = getOrgId(req);
    const sub = await billingService.getSubscription(orgId);

    let customerId = sub?.stripeCustomerId;
    if (!customerId) {
      const email = getUserEmail(req);
      const customer = await stripe.customers.create({
        email,
        metadata: { orgId },
      });
      customerId = customer.id;
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });

    res.json({
      clientSecret: setupIntent.client_secret,
      customerId,
    });
  } catch (err) {
    next(err);
  }
});

// POST /change-plan — change subscription tier
router.post('/change-plan', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { newTier } = req.body;

    if (!newTier) {
      return res.status(400).json({ error: 'newTier is required' });
    }

    const updated = await billingService.changePlan(orgId, newTier);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /cancel — cancel subscription
router.post('/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { reason } = req.body;
    const updated = await billingService.cancelSubscription(orgId, reason);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /reactivate — reactivate canceled subscription
router.post('/reactivate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const updated = await billingService.reactivateSubscription(orgId);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// GET /invoices — invoice history
router.get('/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const invoices = await billingService.getInvoices(orgId);
    res.json(invoices);
  } catch (err) {
    next(err);
  }
});

// GET /usage — current usage metrics
router.get('/usage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const metrics = await billingService.getUsageMetrics(orgId);
    res.json(metrics);
  } catch (err) {
    next(err);
  }
});

// POST /portal — generate Stripe portal session URL
router.post('/portal', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const returnUrl = req.body.returnUrl || `${req.protocol}://${req.get('host')}/billing`;
    const session = await billingService.createPortalSession(orgId, returnUrl);
    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

// POST /prorate-preview — preview prorated cost for plan change
router.post('/prorate-preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { newTier } = req.body;

    if (!newTier) {
      return res.status(400).json({ error: 'newTier is required' });
    }

    const preview = await billingService.previewProration(orgId, newTier);
    res.json(preview);
  } catch (err) {
    next(err);
  }
});

// POST /webhooks — Stripe webhook handler (NO auth middleware)
// This should be mounted BEFORE auth middleware in the Express app
router.post('/webhooks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stripe = process.env.STRIPE_SECRET_KEY
      ? new Stripe(process.env.STRIPE_SECRET_KEY)
      : null;

    if (!stripe) {
      return res.status(503).json({ error: 'Stripe is not configured' });
    }

    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET environment variable is not set');
      return res.status(500).json({ error: 'Webhook processing unavailable' });
    }

    let event: Stripe.Event;
    try {
      // req.body should be the raw body buffer for signature verification
      const rawBody = (req as any).rawBody || req.body;
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

    await billingService.handleWebhook(event);

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});

export const billingRouter = router;
