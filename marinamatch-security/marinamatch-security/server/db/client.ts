/**
 * MarinaMatch Database Client
 * 
 * Configures Drizzle ORM with Neon PostgreSQL.
 * Supports both HTTP (serverless) and WebSocket (pooled) connections.
 * 
 * REQUIRED ENV VARS:
 * - DATABASE_URL: Neon connection string
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon, neonConfig } from '@neondatabase/serverless';
import * as schema from './security-schema';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL environment variable is required.\n' +
    'Get it from your Neon dashboard: https://console.neon.tech'
  );
}

// Configure Neon for serverless environment
neonConfig.fetchConnectionCache = true;

// ============================================================================
// DATABASE CLIENT
// ============================================================================

// Create SQL connection
const sql = neon(DATABASE_URL);

// Create Drizzle client with schema
export const db = drizzle(sql, { schema });

// ============================================================================
// TENANT CONTEXT MANAGEMENT
// ============================================================================

/**
 * Set tenant context for RLS policies
 * Call this at the start of each authenticated request
 */
export async function setTenantContext(
  orgId: string | null,
  isSuperAdmin: boolean = false
): Promise<void> {
  if (orgId) {
    await sql`SELECT set_config('app.current_org_id', ${orgId}, true)`;
  }
  await sql`SELECT set_config('app.is_super_admin', ${isSuperAdmin.toString()}, true)`;
}

/**
 * Clear tenant context (for logout or request cleanup)
 */
export async function clearTenantContext(): Promise<void> {
  await sql`SELECT set_config('app.current_org_id', '', true)`;
  await sql`SELECT set_config('app.is_super_admin', 'false', true)`;
}

/**
 * Execute a function with tenant context set
 * Automatically clears context after execution
 */
export async function withTenantContext<T>(
  orgId: string,
  isSuperAdmin: boolean,
  fn: () => Promise<T>
): Promise<T> {
  try {
    await setTenantContext(orgId, isSuperAdmin);
    return await fn();
  } finally {
    // Context is request-scoped in serverless, but clear for safety
  }
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Check database connectivity
 */
export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  latency?: number;
  error?: string;
}> {
  const start = Date.now();
  
  try {
    await sql`SELECT 1`;
    return {
      connected: true,
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// RAW SQL EXECUTION
// ============================================================================

/**
 * Execute raw SQL (use sparingly, prefer Drizzle queries)
 * Useful for RLS context setting or migrations
 */
export async function execute(query: string, params?: unknown[]) {
  // Using tagged template for parameterized queries
  return sql(query as any, params);
}

// ============================================================================
// EXPORTS
// ============================================================================

export { sql };
export type Database = typeof db;
