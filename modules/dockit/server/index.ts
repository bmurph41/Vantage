import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "./db";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from './stripeClient';
import { WebhookHandlers } from './webhookHandlers';

// Extend the Session interface to include our custom properties
declare module "express-session" {
  interface SessionData {
    userId?: string;
    user?: {
      id: string;
      email: string;
    };
  }
}

const app = express();

// CRITICAL: Register Stripe webhook route BEFORE express.json()
// This webhook needs raw Buffer access to verify signatures
app.post(
  '/api/stripe/webhook/:uuid',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer');
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      const { uuid } = req.params;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig, uuid);

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

// Now apply JSON middleware for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize Stripe schema and sync
async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn('DATABASE_URL not set - Stripe initialization skipped');
    return;
  }

  // Check if Stripe connector is available
  const replitDomains = process.env.REPLIT_DOMAINS;
  if (!replitDomains) {
    console.warn('REPLIT_DOMAINS not set - Stripe webhook registration skipped (Stripe API calls will still work)');
  }

  try {
    log('Initializing Stripe schema...');
    await runMigrations({ databaseUrl, schema: 'stripe' });
    log('Stripe schema ready');

    // Only proceed with webhook setup if we have valid domains
    if (replitDomains) {
      try {
        const stripeSync = await getStripeSync();

        log('Setting up managed webhook...');
        const webhookBaseUrl = `https://${replitDomains.split(',')[0]}`;
        const { webhook, uuid } = await stripeSync.findOrCreateManagedWebhook(
          `${webhookBaseUrl}/api/stripe/webhook`,
          {
            enabled_events: ['*'],
            description: 'Marina management Stripe sync',
          }
        );
        log(`Webhook configured: ${webhook.url} (UUID: ${uuid})`);

        // Sync in background so server can start immediately
        stripeSync.syncBackfill()
          .then(() => log('Stripe data synced'))
          .catch((err: any) => console.error('Error syncing Stripe data:', err));
      } catch (stripeError: any) {
        // Handle specific Stripe connector errors gracefully
        if (stripeError.message?.includes('connection not found')) {
          console.warn('Stripe connector not configured - skipping webhook setup');
        } else {
          console.error('Stripe webhook/sync error:', stripeError.message);
        }
      }
    }
  } catch (error: any) {
    // Don't crash on Stripe init failure - log and continue
    console.error('Failed to initialize Stripe schema:', error.message);
  }
}

// Initialize Stripe on startup (non-blocking)
initStripe().catch(err => console.error('Stripe init error:', err));

// Session store setup
const pgSession = ConnectPgSimple(session);
const sessionSecret = process.env.SESSION_SECRET || 'dev-secret-change-in-production';
const sessionParser = session({
  store: new pgSession({
    conObject: {
      connectionString: process.env.DATABASE_URL,
    },
    tableName: 'user_sessions',
    createTableIfMissing: true,
  }),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict', // CSRF protection
  },
});
app.use(sessionParser);

// Basic authentication middleware - for demo purposes
// In production, implement proper login/logout endpoints
app.use((req, res, next) => {
  const needsAuth = req.path.startsWith('/api/imports') || 
                   (req.path.startsWith('/api/launches') && (req.path.includes('/checkin') || req.path.includes('/queue'))) ||
                   /^\/api\/customers\/[^\/]+\/launches/.test(req.path);

  if (needsAuth) {
    // For protected endpoints, require authentication
    // In demo/development, we'll simulate authenticated users
    if (process.env.NODE_ENV === 'development') {
      // Simulate authenticated customer for customer endpoints
      if (req.path.includes('/checkin') || /^\/api\/customers\/[^\/]+\/launches/.test(req.path)) {
        req.session.userId = 'demo-customer-1';
        req.session.user = { id: 'demo-customer-1', email: 'customer@marina.com' };
      }
      // Simulate authenticated staff member for staff endpoints  
      else if (req.path.includes('/queue')) {
        req.session.userId = 'demo-staff-1';
        req.session.user = { id: 'demo-staff-1', email: 'staff@marina.com', isStaff: true };
      }
      // Default for import endpoints
      else {
        req.session.userId = 'demo-user';
        req.session.user = { id: 'demo-user', email: 'demo@marina.com' };
      }
    }
    
    if (!req.session.userId) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'UNAUTHORIZED' 
      });
    }
  }
  next();
});

// Rate limiting for import endpoints
const importRateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_UPLOADS = 10; // 10 uploads per 15 minutes

app.use('/api/imports', (req, res, next) => {
  if (req.method === 'POST' && req.path.includes('upload')) {
    const userId = req.session?.userId || req.ip || 'anonymous';
    const now = Date.now();
    
    if (!importRateLimit.has(userId)) {
      importRateLimit.set(userId, { count: 0, resetTime: now + RATE_LIMIT_WINDOW });
    }
    
    const userLimit = importRateLimit.get(userId)!;
    
    if (now > userLimit.resetTime) {
      userLimit.count = 0;
      userLimit.resetTime = now + RATE_LIMIT_WINDOW;
    }
    
    if (userLimit.count >= RATE_LIMIT_MAX_UPLOADS) {
      return res.status(429).json({
        message: 'Rate limit exceeded. Try again later.',
        resetTime: new Date(userLimit.resetTime).toISOString()
      });
    }
    
    userLimit.count++;
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      const logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app, sessionParser, sessionSecret);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

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
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
