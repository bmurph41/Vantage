import logger from "./logger";

/**
 * Environment configuration with validation
 * This ensures all required environment variables are set
 */
export interface EnvironmentConfig {
  NODE_ENV: "development" | "production" | "test";
  PORT: number;
  DATABASE_URL: string;
  SESSION_SECRET: string;
  JWT_SECRET: string;
  IS_USING_DEV_JWT_SECRET: boolean;
  ALLOWED_ORIGINS?: string;
  // Optional Stripe keys (handled by parent app in production)
  STRIPE_SECRET_KEY?: string;
  VITE_STRIPE_PUBLIC_KEY?: string;
}

function validateEnv(): EnvironmentConfig {
  // Strict NODE_ENV validation - prevent misconfiguration
  const nodeEnv = process.env.NODE_ENV;
  const validEnvironments = ["development", "production", "test"];
  
  if (nodeEnv && !validEnvironments.includes(nodeEnv)) {
    const error = `Invalid NODE_ENV: "${nodeEnv}". Must be one of: ${validEnvironments.join(", ")}`;
    logger.error(error);
    throw new Error(error);
  }
  
  const isProduction = nodeEnv === "production";
  
  const requiredEnvVars = {
    NODE_ENV: nodeEnv || "development",
    PORT: parseInt(process.env.PORT || "5000", 10),
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    JWT_SECRET: process.env.JWT_SECRET,
    DEVELOPMENT_JWT_SECRET: process.env.DEVELOPMENT_JWT_SECRET,
  };

  // Check required variables
  const missing: string[] = [];
  
  if (!requiredEnvVars.DATABASE_URL) {
    missing.push("DATABASE_URL");
  }
  
  if (!requiredEnvVars.SESSION_SECRET) {
    missing.push("SESSION_SECRET");
  }

  // JWT_SECRET validation - ALWAYS require explicit configuration
  // NO hard-coded fallbacks to prevent production security vulnerabilities
  let jwtSecret: string | undefined;
  let isUsingDevSecret = false;
  
  if (requiredEnvVars.JWT_SECRET) {
    // Production-ready JWT secret provided
    jwtSecret = requiredEnvVars.JWT_SECRET;
    logger.info("Using JWT_SECRET for parent app authentication");
  } else if (requiredEnvVars.DEVELOPMENT_JWT_SECRET) {
    // Explicit development secret (only allowed in non-production)
    if (isProduction) {
      missing.push("JWT_SECRET (DEVELOPMENT_JWT_SECRET cannot be used in production)");
    } else {
      jwtSecret = requiredEnvVars.DEVELOPMENT_JWT_SECRET;
      isUsingDevSecret = true;
      logger.warn("⚠️  Using DEVELOPMENT_JWT_SECRET - for development/testing only! ⚠️");
    }
  } else {
    // No JWT secret provided - FAIL FAST with helpful error
    const errorMsg = isProduction
      ? "JWT_SECRET (REQUIRED in production - must be shared with parent application)"
      : "JWT_SECRET or DEVELOPMENT_JWT_SECRET (required for authentication)\n\n" +
        "  → For development: Set DEVELOPMENT_JWT_SECRET in Replit Secrets\n" +
        "  → For production: Set JWT_SECRET (shared with parent app)\n" +
        "  → See DEVELOPMENT_SETUP.md for detailed instructions\n";
    missing.push(errorMsg);
  }

  if (missing.length > 0) {
    const error = `Missing required environment variables: ${missing.join(", ")}`;
    logger.error(error);
    throw new Error(error);
  }

  // Log configuration (without sensitive values)
  logger.info("Environment configuration loaded", {
    NODE_ENV: requiredEnvVars.NODE_ENV,
    PORT: requiredEnvVars.PORT,
    DATABASE_CONNECTED: !!requiredEnvVars.DATABASE_URL,
    HAS_SESSION_SECRET: !!requiredEnvVars.SESSION_SECRET,
    HAS_JWT_SECRET: !!requiredEnvVars.JWT_SECRET,
    USING_DEV_JWT_SECRET: isUsingDevSecret,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "default (localhost)",
  });

  // Production safety check - explicitly fail if using dev secret in production
  if (isProduction && isUsingDevSecret) {
    const error = "CRITICAL: Cannot use DEVELOPMENT_JWT_SECRET in production! Set JWT_SECRET instead.";
    logger.error(error);
    throw new Error(error);
  }

  return {
    NODE_ENV: requiredEnvVars.NODE_ENV as "development" | "production" | "test",
    PORT: requiredEnvVars.PORT,
    DATABASE_URL: requiredEnvVars.DATABASE_URL!,
    SESSION_SECRET: requiredEnvVars.SESSION_SECRET!,
    JWT_SECRET: jwtSecret!,
    IS_USING_DEV_JWT_SECRET: isUsingDevSecret,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    VITE_STRIPE_PUBLIC_KEY: process.env.VITE_STRIPE_PUBLIC_KEY,
  };
}

export const env = validateEnv();
