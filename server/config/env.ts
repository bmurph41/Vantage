import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters').optional(),
  SESSION_MAX_AGE_HOURS: z.string().default('24'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
  JWT_PRIVATE_KEY: z.string().optional(),
  JWT_PUBLIC_KEY: z.string().optional(),
  JWT_ACTIVE_KID: z.string().optional(),
  JWT_EXPIRY_HOURS: z.string().default('24'),

  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),

  PII_ENCRYPTION_KEY: z.string().min(32, 'PII_ENCRYPTION_KEY must be at least 32 characters').optional(),
  EMAIL_MARKETING_ENCRYPTION_KEY: z.string().min(32).optional(),
  MARINA_INTEGRATION_ENCRYPTION_KEY: z.string().min(32).optional(),

  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  WEBHOOK_SECRET: z.string().min(32).optional(),

  OPENAI_API_KEY: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  FRED_API_KEY: z.string().optional(),
  CENSUS_API_KEY: z.string().optional(),

  QB_ENCRYPTION_KEY: z.string().optional(),

  ALLOWED_ORIGINS: z.string().optional(),

  REPLIT_DOMAINS: z.string().optional(),
  REPLIT_DEV_DOMAIN: z.string().optional(),
  REPL_ID: z.string().optional(),

  RATE_LIMIT_WINDOW_MS: z.string().default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),

  MAX_UPLOAD_SIZE_MB: z.string().default('10'),

  ENABLE_HEALTH_CHECK: z.enum(['true', 'false']).default('true'),
  ENABLE_METRICS: z.enum(['true', 'false']).default('true'),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV !== 'production') return;

  const requiredInProd: Array<{ field: string; description: string }> = [
    { field: 'SESSION_SECRET', description: 'Session cookie signing key' },
    { field: 'JWT_SECRET', description: 'JWT signing key + encryption fallback for integrations' },
    { field: 'STRIPE_SECRET_KEY', description: 'Stripe API secret key' },
    { field: 'STRIPE_WEBHOOK_SECRET', description: 'Stripe webhook signature verification' },
    { field: 'STRIPE_PUBLISHABLE_KEY', description: 'Stripe client-side publishable key' },
  ];

  for (const { field, description } of requiredInProd) {
    if (!(data as any)[field]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: `${field} is required in production (${description})`,
      });
    }
  }
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues;
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      console.error('\n[ENV] PRODUCTION VALIDATION FAILED:');
      for (const issue of issues) {
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
      }
      console.error('');
      throw new Error(
        `Production environment is missing ${issues.length} required variable(s). ` +
        `See errors above. Server cannot start.`
      );
    }

    console.warn('\n[ENV] Validation warnings (non-fatal in dev):');
    for (const issue of issues) {
      console.warn(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    console.warn('');

    return process.env as unknown as Env;
  }

  return result.data;
}

export const env = validateEnv();

export function isProduction(): boolean {
  return env.NODE_ENV === 'production';
}

export function isDevelopment(): boolean {
  return env.NODE_ENV === 'development';
}

export function getAllowedOrigins(): string[] {
  const origins: string[] = [];

  if (env.ALLOWED_ORIGINS) {
    origins.push(...env.ALLOWED_ORIGINS.split(',').map(o => o.trim()));
  }

  if (env.REPLIT_DEV_DOMAIN) {
    origins.push(`https://${env.REPLIT_DEV_DOMAIN}`);
  }

  if (env.REPLIT_DOMAINS) {
    const domains = env.REPLIT_DOMAINS.split(',');
    domains.forEach(domain => {
      origins.push(`https://${domain.trim()}`);
    });
  }

  if (isDevelopment()) {
    origins.push('http://localhost:5000', 'http://localhost:5173', 'http://127.0.0.1:5000');
  }

  return [...new Set(origins)];
}
