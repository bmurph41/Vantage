import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { deadlineMonitor } from "./deadline-monitor";
import { reconciliationService } from "./reconciliation-service";
import { vdrFileService } from "./vdr-file-service";
import { registerDocketRoutes } from "./docket/routes";
import { startDocketCronJobs } from "./docket/cron-jobs";
import { DatabaseStorage as DocketStorage } from "./docket/storage";
import { initializeWebSocket } from "./docket/websocket";
import { startVantageIntelCronJobs } from "./marinamatch/services/intel-cron";
import { startScheduler as startListingScheduler } from "./marinamatch/services/listing-scheduler";
import { autoSeedGlobalBrokerSources } from "./marinamatch/services/global-broker-sources";
import { seedIntegrations } from "./integrations";
import { seedMarinaTaxonomyPack } from "./services/coa-taxonomy-seed";
import { seedCanonicalAssetClasses } from "./routes/admin/asset-classes-routes";
import { runStartupMigrations } from "./db-startup-migrations";
import { docIntelService } from "./services/doc-intel-service";

import { configureSecurityMiddleware } from "./middleware/security";
import { requestIdMiddleware, requestLoggingMiddleware } from "./middleware/logging";
import { centralizedErrorHandler, notFoundHandler } from "./middleware/error-handler";
import { globalRateLimit, loginRateLimit, failedLoginTracker } from "./middleware/rate-limiting";
import { tenantContextMiddleware } from "./middleware/tenant-context";
import { logger } from "./lib/logger";
import settingsRoutes from './routes/settings-routes';
import leasesRouter from './routes/leases';
import wizardDraftsRouter from './routes/wizard-drafts';
import { workspaceRouter } from './routes/workspace-routes';
import { ddChecklistRouter } from "./routes/dd-checklist-routes";
import healthRoutes from './routes/health';
import { deprecationWarning } from './routes/api-versioning';
import legalBenchmarkingRoutes from './routes/legal-benchmarking-routes';
import { authenticateUser } from './middleware/authenticate';
import { configureEnhancedSecurityHeaders } from './middleware/enhanced-security-headers';

import { EventEmitter } from 'events';
EventEmitter.defaultMaxListeners = 50;

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown — release the port so the next start doesn't hit EADDRINUSE
function gracefulShutdown(signal: string) {
  console.log(`[Server] ${signal} received — shutting down gracefully`);
  if ((global as any).__httpServer) {
    (global as any).__httpServer.close(() => {
      console.log('[Server] HTTP server closed');
      process.exit(0);
    });
    // Force-exit after 5 s if connections are still open
    setTimeout(() => process.exit(0), 5000).unref();
  } else {
    process.exit(0);
  }
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Validate required environment variables before starting
function validateRequiredEnvVars() {
  const required = ['DATABASE_URL'];
  const recommended = ['JWT_SECRET', 'SENDGRID_API_KEY', 'STRIPE_SECRET_KEY'];

  const missing = required.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  const missingRecommended = recommended.filter(v => !process.env[v]);
  if (missingRecommended.length > 0) {
    console.warn(`WARNING: Missing recommended environment variables: ${missingRecommended.join(', ')}`);
  }
}

validateRequiredEnvVars();

const app = express();

app.use((req, res, next) => { res.setMaxListeners(50); next(); });
app.use(requestIdMiddleware);

configureSecurityMiddleware(app);

// Enhanced security headers (CSP hardening, Permissions-Policy, etc.)
configureEnhancedSecurityHeaders(app);

// Stripe webhook route — must be registered BEFORE express.json() so raw body is preserved
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req: any, res) => {
    try {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) {
        return res.status(200).json({ received: true });
      }

      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(stripeKey);

      const sig = req.headers['stripe-signature'] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      const isProduction = process.env.NODE_ENV === 'production';

      let event: any;
      if (webhookSecret) {
        if (!sig) {
          console.error('[Stripe Webhook] Missing Stripe-Signature header');
          return res.status(400).json({ error: 'Missing Stripe-Signature header' });
        }
        try {
          event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } catch (err: any) {
          console.error('[Stripe Webhook] Signature verification failed:', err.message);
          return res.status(400).json({ error: 'Invalid signature' });
        }
      } else if (isProduction) {
        // In production, reject webhook if STRIPE_WEBHOOK_SECRET is not configured
        console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not set in production — rejecting webhook');
        return res.status(503).json({ error: 'Webhook secret not configured' });
      } else {
        // Development mode only: parse without signature verification (explicit dev bypass)
        console.warn('[Stripe Webhook] DEV MODE: No STRIPE_WEBHOOK_SECRET — processing without signature verification');
        try {
          event = typeof req.body === 'string' ? JSON.parse(req.body) : JSON.parse(req.body.toString());
        } catch {
          return res.status(400).json({ error: 'Invalid JSON body' });
        }
      }

      const data = event.data.object;
      const orgId = data.metadata?.orgId || data.subscription_details?.metadata?.orgId;

      const { db } = await import('./db');
      const { organizationPacks, billingSubscriptions } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');

      // Map Stripe subscription statuses to organizationPacks enum values:
      // packStatusEnum = "active" | "trial" | "expired" | "cancelled"
      function toPackStatus(stripeStatus: string, cancelAtPeriodEnd?: boolean): 'active' | 'trial' | 'expired' | 'cancelled' {
        if (cancelAtPeriodEnd) return 'cancelled';
        switch (stripeStatus) {
          case 'active': return 'active';
          case 'trialing': return 'trial';
          case 'canceled': case 'cancelled': case 'unpaid': return 'cancelled';
          case 'past_due': case 'incomplete': case 'incomplete_expired': case 'paused': return 'expired';
          default: return 'active';
        }
      }

      // Map Stripe statuses to billing_subscriptions varchar status column
      // Valid values: trialing | active | past_due | canceled | paused | incomplete
      function toBillingStatus(stripeStatus: string, cancelAtPeriodEnd?: boolean): string {
        if (cancelAtPeriodEnd) return 'canceled';
        const allowed = ['trialing', 'active', 'past_due', 'canceled', 'paused', 'incomplete'];
        return allowed.includes(stripeStatus) ? stripeStatus : 'active';
      }

      switch (event.type) {
        case 'checkout.session.completed': {
          const packType = data.metadata?.packType;
          const billingCycle = (data.metadata?.billingCycle as string) || 'monthly';
          if (orgId && packType) {
            // Update organizationPacks (pack-level entitlements)
            await db.insert(organizationPacks).values({
              orgId,
              packType,
              status: 'active',
              purchasedAt: new Date(),
              stripeSubscriptionId: data.subscription,
              stripeCustomerId: data.customer,
              billingCycle,
              purchasedBy: data.metadata?.userId,
            }).onConflictDoUpdate({
              target: [organizationPacks.orgId, organizationPacks.packType],
              set: {
                status: 'active',
                stripeSubscriptionId: data.subscription,
                stripeCustomerId: data.customer,
                purchasedAt: new Date(),
              },
            });

            // Upsert billing_subscriptions tier/status — guarantees activation even for net-new orgs
            await db.insert(billingSubscriptions).values({
              orgId,
              tier: packType,
              status: 'active',
              stripeSubscriptionId: data.subscription,
              stripeCustomerId: data.customer,
              billingCycle,
            }).onConflictDoUpdate({
              target: [billingSubscriptions.orgId],
              set: {
                status: 'active',
                tier: packType,
                stripeSubscriptionId: data.subscription,
                stripeCustomerId: data.customer,
                billingCycle,
                updatedAt: new Date(),
              },
            });

            // Also persist providerCustomerId to subscriptions table so billing portal can resolve customer
            const { subscriptions } = await import('@shared/schema');
            await db.update(subscriptions)
              .set({ providerCustomerId: data.customer, providerSubscriptionId: data.subscription, status: 'active', updatedAt: new Date() })
              .where(eq(subscriptions.orgId, orgId));

            console.log(`[Stripe Webhook] checkout.session.completed: activated pack '${packType}' for org '${orgId}'`);
          }
          break;
        }
        case 'customer.subscription.updated': {
          const packStatus = toPackStatus(data.status, data.cancel_at_period_end);
          const billingStatus = toBillingStatus(data.status, data.cancel_at_period_end);
          const periodStart = data.current_period_start ? new Date(data.current_period_start * 1000) : undefined;
          const periodEnd = data.current_period_end ? new Date(data.current_period_end * 1000) : undefined;
          const cancelAt = data.cancel_at ? new Date(data.cancel_at * 1000) : null;

          // Resolve orgId: prefer subscription metadata; fall back to customer ID lookup
          let resolvedOrgId = orgId;
          if (!resolvedOrgId && data.customer) {
            const { subscriptions } = await import('@shared/schema');
            const [sub] = await db.select({ orgId: subscriptions.orgId })
              .from(subscriptions)
              .where(eq(subscriptions.providerCustomerId, data.customer as string))
              .limit(1);
            resolvedOrgId = sub?.orgId;
          }

          if (resolvedOrgId) {
            // Derive the new tier/packType from the subscription's price ID — handles upgrades/downgrades
            type PackTypeEnumValue = typeof organizationPacks.packType.enumValues[number];
            const { packCatalog } = await import('@shared/schema');
            const { or } = await import('drizzle-orm');
            let newPackType: PackTypeEnumValue | undefined;
            let newBillingCycle: string | undefined;
            let newPriceId: string | undefined;
            const priceId = data.items?.data?.[0]?.price?.id as string | undefined;
            if (priceId) {
              newPriceId = priceId;
              const [matchedPack] = await db.select().from(packCatalog)
                .where(or(
                  eq(packCatalog.stripePriceIdMonthly, priceId),
                  eq(packCatalog.stripePriceIdYearly, priceId),
                )).limit(1);
              if (matchedPack) {
                newPackType = matchedPack.packType as PackTypeEnumValue;
                newBillingCycle = matchedPack.stripePriceIdYearly === priceId ? 'yearly' : 'monthly';
              }
            }

            // Update organizationPacks (enum-safe status) — match by subscription ID
            await db.update(organizationPacks)
              .set({
                status: packStatus,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: data.cancel_at_period_end ?? false,
                ...(newPackType ? { packType: newPackType } : {}),
                ...(newBillingCycle ? { billingCycle: newBillingCycle } : {}),
                updatedAt: new Date(),
              })
              .where(and(eq(organizationPacks.orgId, resolvedOrgId), eq(organizationPacks.stripeSubscriptionId, data.id)));

            // Update billing_subscriptions (varchar status) — include tier change if detected
            await db.update(billingSubscriptions)
              .set({
                status: billingStatus,
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
                cancelAt,
                ...(newPackType ? { tier: newPackType } : {}),
                ...(newBillingCycle ? { billingCycle: newBillingCycle } : {}),
                ...(newPriceId ? { stripePriceId: newPriceId } : {}),
                updatedAt: new Date(),
              })
              .where(eq(billingSubscriptions.orgId, resolvedOrgId));

            console.log(`[Stripe Webhook] customer.subscription.updated: org='${resolvedOrgId}' tier='${newPackType ?? 'unchanged'}' status='${billingStatus}'`);
          } else {
            console.warn(`[Stripe Webhook] customer.subscription.updated: could not resolve orgId for subscription '${data.id}'`);
          }
          break;
        }
        case 'customer.subscription.deleted': {
          if (data.id) {
            // Cancel organizationPacks associated with this subscription
            await db.update(organizationPacks)
              .set({ status: 'cancelled', updatedAt: new Date() })
              .where(eq(organizationPacks.stripeSubscriptionId, data.id));
            // Downgrade billing_subscriptions to free tier and mark canceled
            // orgId is available from subscription metadata
            if (orgId) {
              await db.update(billingSubscriptions)
                .set({
                  status: 'canceled',
                  tier: 'starter', // Downgrade to free/starter tier on cancellation
                  canceledAt: new Date(),
                  stripeSubscriptionId: null,
                  updatedAt: new Date(),
                })
                .where(eq(billingSubscriptions.orgId, orgId));
            } else {
              // Fall back to matching by subscription ID if orgId not in metadata
              await db.update(billingSubscriptions)
                .set({ status: 'canceled', canceledAt: new Date(), updatedAt: new Date() })
                .where(eq(billingSubscriptions.stripeSubscriptionId, data.id));
            }
            console.log(`[Stripe Webhook] customer.subscription.deleted: subscription '${data.id}' cancelled, org='${orgId ?? 'unknown'}' downgraded to starter`);
          }
          break;
        }
        case 'invoice.payment_succeeded': {
          if (orgId) {
            await db.update(organizationPacks)
              .set({ status: 'active', updatedAt: new Date() })
              .where(and(eq(organizationPacks.orgId, orgId), eq(organizationPacks.stripeSubscriptionId, data.subscription)));
            await db.update(billingSubscriptions)
              .set({ status: 'active', updatedAt: new Date() })
              .where(eq(billingSubscriptions.orgId, orgId));
            console.log(`[Stripe Webhook] invoice.payment_succeeded: org '${orgId}' subscription activated`);
          }
          break;
        }
        case 'invoice.payment_failed': {
          if (orgId) {
            // past_due is not in packStatusEnum; mark as expired to block entitlement access
            await db.update(organizationPacks)
              .set({ status: 'expired', updatedAt: new Date() })
              .where(and(eq(organizationPacks.orgId, orgId), eq(organizationPacks.stripeSubscriptionId, data.subscription)));
            await db.update(billingSubscriptions)
              .set({ status: 'past_due', updatedAt: new Date() })
              .where(eq(billingSubscriptions.orgId, orgId));
            console.log(`[Stripe Webhook] invoice.payment_failed: org '${orgId}' subscription past_due/expired`);
          }
          break;
        }
        default:
          console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      // Return 500 so Stripe retries the webhook delivery; log full error server-side
      console.error('[Stripe Webhook] Processing error:', error.message, error.stack);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

// Default body size limit — keep it small to prevent abuse.
// File-upload routes should use their own higher-limit parser.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Higher limit for file upload routes
app.use('/api/uploads', express.json({ limit: '10mb' }));
app.use('/api/documents/upload', express.json({ limit: '10mb' }));

app.use(requestLoggingMiddleware);

// Global rate limit — 100 req/min per user (Redis-backed)
// NOTE: security.ts already applies /api/ rate limit (300/15min) and /api/auth/login limit (10/15min).
// This global limiter adds a per-minute cap on top.
app.use(globalRateLimit);

// NOTE: Removed duplicate loginRateLimit here — security.ts already applies one at line 86.
// Having two separate rate limiters on the same path caused double-counting.

// Track failed logins per IP — block after 10 consecutive failures for 15 minutes.
// (Reduced from 5 failures / 30 min which was too aggressive)
app.use('/api/auth/login', failedLoginTracker);

// Enhanced health check routes (mounted BEFORE auth middleware)
// Provides /health, /health/live, /health/ready endpoints
app.use(healthRoutes);

// API deprecation warning for legacy /api/* routes (sunset 2027-06-01)
// Clients should migrate to /api/v1/*
app.use('/api', deprecationWarning('2027-06-01'));

(async () => {
  try {
    const server = await registerRoutes(app);
    (global as any).__httpServer = server; // used by gracefulShutdown

    // Auth middleware for routes mounted outside registerRoutes()
    app.use(authenticateUser);

    // Then add after auth routes:
    app.use('/api/settings', settingsRoutes);
    app.use('/api', legalBenchmarkingRoutes);
    app.use('/api/valuator/:projectId/leases', leasesRouter);
    app.use('/api/wizard-drafts', wizardDraftsRouter);
app.use(ddChecklistRouter);
    app.use(workspaceRouter);
    // exitStudioRouter mounted in routes.ts with auth middleware

    // Initialize Docket storage and register routes
    const docketStorage = new DocketStorage();
    registerDocketRoutes(app, docketStorage);

    app.use(centralizedErrorHandler);

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    // Start document export job processor
import('./services/document-builder/export-job-processor').then(({ exportJobProcessor }) => {
  exportJobProcessor.startProcessing(5000); // poll every 5s
  console.log('[DocumentBuilder] Export job processor started');
}).catch(err => console.warn('[DocumentBuilder] Export processor failed to start:', err.message));

server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);
    
      // Initialize background services in parallel without blocking
      // This allows the HTTP server to respond immediately
      
      // Synchronous services - start immediately
      try {
        deadlineMonitor.start();
        log('Deadline monitoring service started');
      } catch (error) {
        log(`Failed to start deadline monitoring service: ${error}`);
      }

      docIntelService.recoverStuckUploads().then(count => {
        if (count > 0) log(`[DocIntel] Recovered ${count} stuck document(s)`);
      }).catch(err => {
        log(`[DocIntel] Recovery check failed: ${err.message}`);
      });

      // DISABLED: Docket, Vantage Intel, and Listing Scraper cron jobs turned off to reduce RAM usage.
      // Re-enable by uncommenting the blocks below.
      /*
      try {
        startDocketCronJobs(docketStorage);
        log('Docket background jobs started');
      } catch (error) {
        log(`Failed to start Docket background jobs: ${error}`);
      }

      try {
        startVantageIntelCronJobs();
        log('Vantage Intel background jobs started');
      } catch (error) {
        log(`Failed to start Vantage Intel background jobs: ${error}`);
      }

      try {
        startListingScheduler();
        log('Vantage listing scrape scheduler started');

        // Auto-seed global broker sources in background
        autoSeedGlobalBrokerSources().then(result => {
          if (result.created > 0 || result.updated > 0) {
            log(`[Global Brokers] Auto-seeded: ${result.created} created, ${result.updated} updated`);
          }
        }).catch(err => {
          log(`[Global Brokers] Auto-seed failed: ${err.message}`);
        });
      } catch (error) {
        log(`Failed to start Vantage listing scheduler: ${error}`);
      }
      */

      // Skip Docket WebSocket in development to avoid conflict with Vite HMR WebSocket
      if (process.env.NODE_ENV !== 'development') {
        try {
          initializeWebSocket(server);
          log('Docket WebSocket initialized');
        } catch (error) {
          log(`Failed to initialize Docket WebSocket: ${error}`);
        }
      } else {
        log('Docket WebSocket disabled in development mode (use production for real-time updates)');
      }

      // Async services - run in background without awaiting
      seedIntegrations()
        .then(() => log('Integration catalog seeded'))
        .catch((error) => log(`Failed to seed integrations: ${error}`));

      reconciliationService.start()
        .then(() => log('Document reconciliation service started'))
        .catch((error) => log(`Failed to start document reconciliation service: ${error}`));

      vdrFileService.initialize()
        .then(() => log('VDR file service initialized'))
        .catch((error) => log(`Failed to initialize VDR file service: ${error}`));

      seedMarinaTaxonomyPack()
        .then((packId) => log(`[COA] Marina taxonomy pack ready: ${packId}`))
        .catch((error) => log(`[COA] Failed to seed taxonomy: ${error}`));

      // Run DB migrations first (enum→text, add columns), then seed canonical rows
      runStartupMigrations()
        .then(() => seedCanonicalAssetClasses())
        .then(() => console.log('[AssetClass] Canonical asset classes ready'))
        .catch((error) => console.error(`[AssetClass] Startup failed:`, error));

    });
  } catch (error) {
    console.error('Fatal error during server initialization:', error);
    process.exit(1);
  }
})();
