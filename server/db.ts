import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Optimized connection pool configuration for better concurrent handling
// - max: Maximum number of clients in the pool (default was unlimited)
// - idleTimeoutMillis: How long a client can sit idle before being closed
// - connectionTimeoutMillis: How long to wait for a connection before erroring
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20, // Limit concurrent connections for stability
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Timeout connection attempts after 10s
});

export const db = drizzle({ client: pool, schema });