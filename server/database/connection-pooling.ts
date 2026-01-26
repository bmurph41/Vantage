/**
 * Database Connection Pooling Configuration
 * Prevents connection exhaustion under load
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure WebSocket for Neon (required in some environments)
neonConfig.webSocketConstructor = ws;

/**
 * Configure Neon connection pooling
 * Returns a configured pool instance
 */
export function configureConnectionPooling() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10, // Maximum 10 connections in pool
    idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
    connectionTimeoutMillis: 10000, // Timeout connection attempts after 10 seconds
  });

  // Log pool events
  pool.on('connect', () => {
    console.log('Database connection established');
  });

  pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
    // Don't exit process - pool will attempt to recover
  });

  pool.on('remove', () => {
    console.log('Database connection removed from pool');
  });

  return pool;
}

/**
 * Get current pool statistics
 */
export function getPoolStats(pool: Pool) {
  return {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingClients: pool.waitingCount,
  };
}

/**
 * Graceful shutdown - close all pool connections
 */
export async function closeConnectionPool(pool: Pool) {
  console.log('Closing database connection pool...');
  await pool.end();
  console.log('✓ Database connection pool closed');
}

/**
 * Health check - verify pool can acquire connection
 */
export async function testConnection(pool: Pool): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}
