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
import { ensureKnowledgeBaseSchema } from "./services/knowledge-base-service";
import { runSchemaDriftCheck } from "./schema-drift";
import { docIntelService } from "./services/doc-intel-service";

import { configureSecurityMiddleware } from "./middleware/security";
import { requestIdMiddleware, requestLoggingMiddleware } from "./middleware/logging";
import { centralizedErrorHandler, notFoundHandler } from "./middleware/error-handler";
import { initSentry, sentryContextMiddleware, sentryErrorHandler } from "./lib/sentry";

// Init Sentry as early as possible — before any other imports create spans.
initSentry();
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

            // NOTE: This handler fires for single-pack purchases (e.g.,
            // master_comps). Single-pack purchases should NOT write to
            // billing_subscriptions.tier — that column is reserved for the
            // 5 canonical tier slugs. Tier subscription checkouts (with
            // metadata.tier set) flow through billingService.handleWebhook
            // delegate, which calls provisionTier correctly.

            // Persist providerCustomerId to subscriptions table so billing portal can resolve customer
            const { subscriptions } = await import('@shared/schema');
            await db.update(subscriptions)
              .set({ providerCustomerId: data.customer, providerSubscriptionId: data.subscription, status: 'active', updatedAt: new Date() })
              .where(eq(subscriptions.orgId, orgId));

            console.log(`[Stripe Webhook] checkout.session.completed: activated single-pack purchase '${packType}' for org '${orgId}'`);
          }
          break;
        }
        case 'customer.subscription.updated': {
          const billingStatus = toBillingStatus(data.status, data.cancel_at_period_end);
          const periodStart = data.current_period_start ? new Date(data.current_period_start * 1000) : undefined;
          const periodEnd = data.current_period_end ? new Date(data.current_period_end * 1000) : undefined;
          const cancelAt = data.cancel_at ? new Date(data.cancel_at * 1000) : null;
          const canceledAt = data.canceled_at ? new Date(data.canceled_at * 1000) : null;
          const stripeCustomerId = typeof data.customer === 'string'
            ? data.customer
            : (data.customer as any)?.id;

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

          if (!resolvedOrgId) {
            console.warn(`[Stripe Webhook] customer.subscription.updated: could not resolve orgId for subscription '${data.id}'`);
            break;
          }

          // Derive the new tier/packType from the subscription's price ID.
          const { packCatalog } = await import('@shared/schema');
          const { or } = await import('drizzle-orm');
          const priceId = data.items?.data?.[0]?.price?.id as string | undefined;
          let resolvedPackType: string | undefined;
          let resolvedBillingCycleRaw: 'monthly' | 'yearly' | undefined;
          if (priceId) {
            const [matchedPack] = await db.select().from(packCatalog)
              .where(or(
                eq(packCatalog.stripePriceIdMonthly, priceId),
                eq(packCatalog.stripePriceIdYearly, priceId),
              )).limit(1);
            if (matchedPack) {
              resolvedPackType = matchedPack.packType as string;
              resolvedBillingCycleRaw = matchedPack.stripePriceIdYearly === priceId ? 'yearly' : 'monthly';
            }
          }

          // Guard: if priceId is missing or maps to a non-tier pack (e.g. master_comps,
          // crm_pipeline as standalone purchases), skip the helper. Calling
          // provisionTier with a non-tier slug would corrupt the tier column —
          // this was the pre-migration bug. Status-only updates for non-tier
          // single-pack subscriptions belong to a future dedicated handler.
          const { isTierSlug } = await import('@shared/tier-packs');
          if (!resolvedPackType || !isTierSlug(resolvedPackType)) {
            console.warn(
              `[Stripe Webhook] customer.subscription.updated: skipping — priceId='${priceId ?? 'missing'}' resolved to packType='${resolvedPackType ?? 'none'}' which is not a tier slug. org='${resolvedOrgId}' subscription='${data.id}'`,
            );
            break;
          }

          // Tier subscription update — atomic three-table re-provision.
          // Helper diffs organization_packs (new packs activated, old packs
          // cancelled — fixes the prior single-row-only bug) and re-provisions
          // billing_feature_flags for the new tier (override-preserving — fixes
          // the prior ghost-flag retention symptom that caused the lockout).
          const billingCycle = resolvedBillingCycleRaw === 'yearly' ? 'annual' : 'monthly';
          const { provisionTier } = await import('./services/provision-service');
          await provisionTier(resolvedOrgId, resolvedPackType, {
            mode: 'webhook',
            billingCycle,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            stripeSubscriptionId: data.id,
            stripeCustomerId,
            stripePriceId: priceId,
            status: billingStatus as 'trialing' | 'active' | 'canceled' | 'past_due' | 'paused' | 'incomplete',
            cancelAt,
            canceledAt,
          });

          console.log(
            `[Stripe Webhook] customer.subscription.updated: org='${resolvedOrgId}' tier='${resolvedPackType}' status='${billingStatus}'`,
          );
          break;
        }
        case 'customer.subscription.deleted': {
          if (data.id) {
            // Resolve orgId: prefer subscription metadata; fall back to a
            // billing_subscriptions lookup keyed on the Stripe subscription ID.
            let resolvedOrgId = orgId;
            if (!resolvedOrgId) {
              const [sub] = await db.select({ orgId: billingSubscriptions.orgId })
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.stripeSubscriptionId, data.id))
                .limit(1);
              resolvedOrgId = sub?.orgId;
            }

            if (resolvedOrgId) {
              // Atomic three-table cancellation. Helper sets billing_subscriptions
              // tier='starter' / status='canceled', cancels ALL active packs
              // (starter has no packs in TIER_PACKS), and re-provisions
              // billing_feature_flags to BASE_FEATURES only — fixing the prior
              // ghost-flag retention symptom.
              const { provisionTier } = await import('./services/provision-service');
              await provisionTier(resolvedOrgId, 'starter', {
                mode: 'webhook',
                status: 'canceled',
                canceledAt: new Date(),
              });
              // Follow-on: clear stripeSubscriptionId. The helper's COALESCE
              // conflict-update pattern preserves existing values when callers
              // pass null/undefined, so it can't null this column itself.
              await db.update(billingSubscriptions)
                .set({ stripeSubscriptionId: null, updatedAt: new Date() })
                .where(eq(billingSubscriptions.orgId, resolvedOrgId));
            } else {
              // Last-resort fallback: orgId could not be resolved at all.
              // Preserve the original minimally-destructive behavior — mark the
              // subscription canceled by stripeSubscriptionId without tier
              // downgrade or pack cancellation (which require knowing the org).
              await db.update(billingSubscriptions)
                .set({ status: 'canceled', canceledAt: new Date(), updatedAt: new Date() })
                .where(eq(billingSubscriptions.stripeSubscriptionId, data.id));
            }
            console.log(`[Stripe Webhook] customer.subscription.deleted: subscription '${data.id}' cancelled, org='${resolvedOrgId ?? 'unknown'}' downgraded to starter`);
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

      // Delegate to billing-service for SKU-specific flows (marketplace_plus,
      // broker_plan, core-platform tier subscriptions). The index.ts switch
      // above only handles packType-metadata checkouts; billingService covers
      // everything else. Failures here are logged but don't fail the webhook —
      // Stripe will retry if needed via the 500 path above.
      try {
        const { default: billingService } = await import('./services/billing-service');
        await billingService.handleWebhook(event);
      } catch (delegateErr: any) {
        console.error('[Stripe Webhook] billingService.handleWebhook error:', delegateErr.message);
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
    // Sentry per-request context tagging (no-op when SENTRY_DSN unset).
    app.use(sentryContextMiddleware);

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

    // Sentry must run BEFORE the centralized handler so errors are captured
    // even if the central handler transforms them. No-op when SENTRY_DSN unset.
    app.use(sentryErrorHandler);
    app.use(centralizedErrorHandler);

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
    const isProduction = process.env.NODE_ENV === 'production';

    // ── Bind the port immediately so the deployment health check passes ────────
    // Migrations are heavy (~13 k idempotent DDL statements) and can take up to
    // 60 s on a cold database.  Running them before listen() causes the Replit
    // deployment health-check timeout to fire before the port ever opens.
    // We start listening first, then run the migration/drift gate in the
    // background.  Because every migration is idempotent (CREATE … IF NOT
    // EXISTS, ADD COLUMN IF NOT EXISTS, etc.) it is always safe to serve
    // traffic while they run — no destructive changes are ever made.
    // Schema drift is already verified at build-time via `npm run check:schema`,
    // so by the time the binary starts, drift has already been validated.
server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);

      // ── Background migration + drift gate ─────────────────────────────────
      (async () => {
        try {
          await runStartupMigrations();
          await ensureKnowledgeBaseSchema();
          const driftCount = await runSchemaDriftCheck();
          if (driftCount > 0) {
            if (isProduction) {
              console.error(
                `\n[schema-drift] ══════════════════════════════════════════════════════\n` +
                `[schema-drift] FATAL: ${driftCount} schema drift issue(s) detected.\n` +
                `[schema-drift] Deployment blocked to protect the live database.\n` +
                `[schema-drift]\n` +
                `[schema-drift] To fix:\n` +
                `[schema-drift]   1. npx tsx scripts/generate-startup-migrations.ts\n` +
                `[schema-drift]   2. Paste output into server/db-startup-migrations.ts\n` +
                `[schema-drift]   3. Commit and redeploy.\n` +
                `[schema-drift] ══════════════════════════════════════════════════════\n`
              );
              // Delay exit so logs flush and health check has already passed
              setTimeout(() => process.exit(1), 2000);
            } else {
              console.warn(
                `[schema-drift] WARNING: ${driftCount} drift issue(s) found.\n` +
                `[schema-drift]   This would block startup in production.\n` +
                `[schema-drift]   Run: npx tsx scripts/generate-startup-migrations.ts`
              );
            }
          }
        } catch (driftErr: any) {
          if (isProduction) {
            console.error(
              `\n[schema-drift] FATAL: Migration/drift gate threw an unexpected error.\n` +
              `[schema-drift]   ${driftErr.message}\n` +
              `[schema-drift] Ensure DATABASE_URL is reachable and the migration scripts are valid.`
            );
            setTimeout(() => process.exit(1), 2000);
          } else {
            console.warn(`[schema-drift] Pre-listen check failed (continuing in dev): ${driftErr.message}`);
          }
        }
      })();

      // Start document export job processor
      import('./services/document-builder/export-job-processor').then(({ exportJobProcessor }) => {
        exportJobProcessor.startProcessing(5000); // poll every 5s
        console.log('[DocumentBuilder] Export job processor started');
      }).catch(err => console.warn('[DocumentBuilder] Export processor failed to start:', err.message));
    
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

      // Seed canonical asset classes (migrations + drift check already ran pre-listen)
      seedCanonicalAssetClasses()
        .then(() => console.log('[AssetClass] Canonical asset classes ready'))
        .catch((error) => console.error(`[AssetClass] Startup failed:`, error));

      // Start campaign execution scheduler
      import('./services/campaignExecutionService')
        .then(({ startCampaignExecutionScheduler }) => startCampaignExecutionScheduler())
        .catch((err) => console.error('[campaignExecution] Failed to start scheduler:', err));

    });
  } catch (error) {
    console.error('Fatal error during server initialization:', error);
    process.exit(1);
  }
})();
