/**
 * Database Migration Runner
 * Runs SQL migrations in order, tracks what's been applied
 */

import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

const sql = neon(process.env.DATABASE_URL!);

interface Migration {
  filename: string;
  sql: string;
  number: number;
}

/**
 * Get all migration files in order
 */
function getMigrations(): Migration[] {
  const migrationsDir = __dirname;
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  return files.map(filename => {
    const filePath = path.join(migrationsDir, filename);
    const sqlContent = fs.readFileSync(filePath, 'utf-8');
    const number = parseInt(filename.split('_')[0]);
    
    return {
      filename,
      sql: sqlContent,
      number
    };
  });
}

/**
 * Create migrations tracking table if it doesn't exist
 */
async function ensureMigrationsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      migration_number INTEGER NOT NULL UNIQUE,
      migration_name TEXT NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations(): Promise<number[]> {
  const rows = await sql`
    SELECT migration_number FROM schema_migrations ORDER BY migration_number
  `;
  return rows.map((r: any) => r.migration_number);
}

/**
 * Run a single migration
 */
async function runMigration(migration: Migration) {
  console.log(`Running migration: ${migration.filename}`);
  
  try {
    // Execute the migration SQL
    await sql.unsafe(migration.sql);
    
    // Record that it was applied
    await sql`
      INSERT INTO schema_migrations (migration_number, migration_name)
      VALUES (${migration.number}, ${migration.filename})
    `;
    
    console.log(`✓ Migration ${migration.filename} completed successfully`);
    return { success: true };
  } catch (error: any) {
    console.error(`✗ Migration ${migration.filename} failed:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Rollback a migration (if rollback script exists)
 */
async function rollbackMigration(migration: Migration) {
  console.log(`Rolling back migration: ${migration.filename}`);
  
  // Look for rollback script in comments
  const rollbackMatch = migration.sql.match(/\/\*\s*ROLLBACK:?\s*([\s\S]*?)\*\//i);
  
  if (!rollbackMatch) {
    console.error(`No rollback script found in ${migration.filename}`);
    return { success: false, error: 'No rollback script' };
  }
  
  const rollbackSql = rollbackMatch[1].trim();
  
  try {
    await sql.unsafe(rollbackSql);
    
    // Remove from tracking table
    await sql`
      DELETE FROM schema_migrations 
      WHERE migration_number = ${migration.number}
    `;
    
    console.log(`✓ Rollback of ${migration.filename} completed successfully`);
    return { success: true };
  } catch (error: any) {
    console.error(`✗ Rollback failed:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main migration function
 */
async function runMigrations(options: { rollback?: boolean } = {}) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  MarinaMatch Database Migrations');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  try {
    // Ensure tracking table exists
    await ensureMigrationsTable();
    
    // Get migrations
    const allMigrations = getMigrations();
    const appliedNumbers = await getAppliedMigrations();
    
    if (options.rollback) {
      // Rollback mode - rollback the last migration
      if (appliedNumbers.length === 0) {
        console.log('No migrations to rollback');
        return;
      }
      
      const lastApplied = Math.max(...appliedNumbers);
      const migration = allMigrations.find(m => m.number === lastApplied);
      
      if (!migration) {
        console.error('Migration file not found for rollback');
        return;
      }
      
      const result = await rollbackMigration(migration);
      
      if (result.success) {
        console.log('');
        console.log('✓ Rollback completed successfully');
      } else {
        console.log('');
        console.log('✗ Rollback failed');
        process.exit(1);
      }
      
      return;
    }
    
    // Normal mode - run pending migrations
    const pendingMigrations = allMigrations.filter(
      m => !appliedNumbers.includes(m.number)
    );
    
    if (pendingMigrations.length === 0) {
      console.log('✓ All migrations already applied');
      console.log('');
      console.log(`Applied migrations: ${appliedNumbers.length}`);
      return;
    }
    
    console.log(`Found ${pendingMigrations.length} pending migration(s):`);
    pendingMigrations.forEach(m => console.log(`  - ${m.filename}`));
    console.log('');
    
    // Run each pending migration
    for (const migration of pendingMigrations) {
      const result = await runMigration(migration);
      
      if (!result.success) {
        console.log('');
        console.log('✗ Migration failed - stopping here');
        console.log('');
        console.log('To rollback this migration:');
        console.log('  node run-migrations.ts --rollback');
        process.exit(1);
      }
    }
    
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✓ All migrations completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    
  } catch (error: any) {
    console.error('');
    console.error('✗ Migration error:', error.message);
    console.error('');
    process.exit(1);
  }
}

// Run migrations if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const rollback = args.includes('--rollback');
  
  runMigrations({ rollback }).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runMigrations, rollbackMigration };
