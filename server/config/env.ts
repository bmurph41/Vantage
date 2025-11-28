import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters').optional(),
  SESSION_MAX_AGE_HOURS: z.string().default('24'),
  
  JWT_SECRET: z.string().min(32).optional(),
  JWT_PRIVATE_KEY: z.string().optional(),
  JWT_PUBLIC_KEY: z.string().optional(),
  JWT_ACTIVE_KID: z.string().optional(),
  JWT_EXPIRY_HOURS: z.string().default('24'),
  
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
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  try {
    const parsed = envSchema.parse(process.env);
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map(err => `  - ${err.path.join('.')}: ${err.message}`)
        .join('\n');
      console.error(`\n❌ Environment validation failed:\n${missingVars}\n`);
      
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Environment validation failed in production');
      }
    }
    throw error;
  }
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
