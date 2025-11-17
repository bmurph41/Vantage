import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import type { Express } from "express";

export function setupSecurity(app: Express) {
  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // unsafe-eval needed for Vite in dev
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "https://js.stripe.com", "https://api.stripe.com"],
        frameSrc: ["'self'", "https://js.stripe.com"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // CORS configuration - allow parent app integration
  const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5000', 'http://localhost:3000'],
    credentials: true,
    optionsSuccessStatus: 200,
  };
  app.use(cors(corsOptions));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many requests from this IP, please try again later.",
  });

  // Apply rate limiting to API routes
  app.use("/api/", limiter);

  // Stricter rate limiting for authentication/sensitive endpoints
  const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: "Too many attempts, please try again later.",
  });

  app.use("/api/auth/", strictLimiter);
  app.use("/api/audit-logs", strictLimiter);
}
