/**
 * Installation Verification Script
 * Verifies that Tier 2 upgrade was installed correctly
 */

import { testS3Connection, BUCKET_NAME } from '../storage/s3-client';
import { rateLimitRedis } from '../security/rate-limiting';
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

interface VerificationResult {
  component: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string;
}

const results: VerificationResult[] = [];

function pass(component: string, message: string, details?: string) {
  results.push({ component, status: 'pass', message, details });
  console.log(`✓ ${component}: ${message}`);
}

function fail(component: string, message: string, details?: string) {
  results.push({ component, status: 'fail', message, details });
  console.error(`✗ ${component}: ${message}`);
  if (details) console.error(`  ${details}`);
}

function warn(component: string, message: string, details?: string) {
  results.push({ component, status: 'warning', message, details });
  console.warn(`⚠ ${component}: ${message}`);
  if (details) console.warn(`  ${details}`);
}

/**
 * Verify environment variables
 */
async function verifyEnvironment(): Promise<void> {
  console.log('\n━━━ Environment Variables ━━━');
  
  const required = [
    'DATABASE_URL',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'S3_BUCKET_NAME',
    'REDIS_URL'
  ];
  
  for (const varName of required) {
    if (process.env[varName]) {
      pass('Environment', `${varName} is set`);
    } else {
      fail('Environment', `${varName} is missing`);
    }
  }
}

/**
 * Verify S3 connection
 */
async function verifyS3(): Promise<void> {
  console.log('\n━━━ S3 Storage ━━━');
  
  try {
    const result = await testS3Connection();
    
    if (result.success) {
      pass('S3', `Connected to bucket: ${BUCKET_NAME}`);
    } else {
      fail('S3', 'Connection failed', result.error);
    }
  } catch (error: any) {
    fail('S3', 'Connection error', error.message);
  }
}

/**
 * Verify Redis connection
 */
async function verifyRedis(): Promise<void> {
  console.log('\n━━━ Redis (Rate Limiting) ━━━');
  
  try {
    await rateLimitRedis.ping();
    pass('Redis', 'Connection successful');
  } catch (error: any) {
    fail('Redis', 'Connection failed', error.message);
  }
}

/**
 * Verify database connection and migrations
 */
async function verifyDatabase(): Promise<void> {
  console.log('\n━━━ Database ━━━');
  
  const sql = neon(process.env.DATABASE_URL!);
  
  try {
    // Test connection
    await sql`SELECT 1`;
    pass('Database', 'Connection successful');
    
    // Check if migrations table exists
    const migrationTable = await sql`
      SELECT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'schema_migrations'
      );
    `;
    
    if (migrationTable[0].exists) {
      pass('Database', 'Migrations table exists');
      
      // Check which migrations are applied
      const migrations = await sql`
        SELECT migration_number, migration_name 
        FROM schema_migrations 
        ORDER BY migration_number
      `;
      
      const expectedMigrations = [1, 2, 3, 4];
      const appliedMigrations = migrations.map((m: any) => m.migration_number);
      
      for (const num of expectedMigrations) {
        if (appliedMigrations.includes(num)) {
          pass('Database', `Migration ${num} applied`);
        } else {
          warn('Database', `Migration ${num} not applied`);
        }
      }
    } else {
      warn('Database', 'Migrations table not found', 'Run migrations: node run-migrations.ts');
    }
    
    // Check if new tables exist
    const aiUsageTable = await sql`
      SELECT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'ai_usage_tracking'
      );
    `;
    
    if (aiUsageTable[0].exists) {
      pass('Database', 'AI usage tracking table exists');
    } else {
      warn('Database', 'AI usage tracking table missing', 'Run migration 004');
    }
    
    // Check if audit_logs has orgId
    const auditLogsColumns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs'
    `;
    
    const hasOrgId = auditLogsColumns.some((col: any) => col.column_name === 'orgId');
    
    if (hasOrgId) {
      pass('Database', 'Audit logs has orgId column');
    } else {
      fail('Database', 'Audit logs missing orgId', 'Run migration 001');
    }
    
    // Check indexes
    const indexes = await sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND indexname LIKE 'idx_%_org%'
    `;
    
    if (indexes.length > 0) {
      pass('Database', `${indexes.length} performance indexes created`);
    } else {
      warn('Database', 'Performance indexes not found', 'Run migration 003');
    }
    
  } catch (error: any) {
    fail('Database', 'Connection or query failed', error.message);
  }
}

/**
 * Verify installed files
 */
async function verifyFiles(): Promise<void> {
  console.log('\n━━━ Installed Files ━━━');
  
  const requiredFiles = [
    'server/middleware/rate-limiting.ts',
    'server/middleware/error-handler.ts',
    'server/middleware/input-validation.ts',
    'server/middleware/session-management.ts',
    'server/security/file-upload-security.ts',
    'server/storage/s3-client.ts',
    'server/services/ai/spending-guard.ts',
    'server/database/connection-pooling.ts'
  ];
  
  for (const file of requiredFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      pass('Files', `${file} exists`);
    } else {
      fail('Files', `${file} missing`, 'Copy from upgrade package');
    }
  }
}

/**
 * Verify npm dependencies
 */
async function verifyDependencies(): Promise<void> {
  console.log('\n━━━ NPM Dependencies ━━━');
  
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')
  );
  
  const required = {
    '@aws-sdk/client-s3': 'S3 storage',
    '@aws-sdk/s3-request-presigner': 'S3 signed URLs',
    'file-type': 'MIME validation',
    'ioredis': 'Redis connection',
    'express-rate-limit': 'Rate limiting',
    'rate-limit-redis': 'Redis rate limit store'
  };
  
  for (const [pkg, purpose] of Object.entries(required)) {
    if (packageJson.dependencies?.[pkg] || packageJson.devDependencies?.[pkg]) {
      pass('Dependencies', `${pkg} installed (${purpose})`);
    } else {
      fail('Dependencies', `${pkg} missing (${purpose})`, 'Run: npm install');
    }
  }
}

/**
 * Generate summary report
 */
function generateReport(): void {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('         INSTALLATION VERIFICATION REPORT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  const total = results.length;
  
  console.log('');
  console.log(`  Total Checks:  ${total}`);
  console.log(`  Passed:        ${passed} ✓`);
  console.log(`  Failed:        ${failed} ${failed > 0 ? '✗' : ''}`);
  console.log(`  Warnings:      ${warnings} ${warnings > 0 ? '⚠' : ''}`);
  console.log('');
  
  if (failed === 0 && warnings === 0) {
    console.log('  🎉 INSTALLATION COMPLETE - All checks passed!');
    console.log('');
    console.log('  Next steps:');
    console.log('    1. Run isolation tests: cd testing && ./run-tests.sh');
    console.log('    2. Test the application manually');
    console.log('    3. Monitor logs for any errors');
  } else if (failed > 0) {
    console.log('  ❌ INSTALLATION INCOMPLETE - Fix errors above');
    console.log('');
    console.log('  Failed checks:');
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`    - ${r.component}: ${r.message}`);
      if (r.details) console.log(`      ${r.details}`);
    });
  } else {
    console.log('  ⚠️  INSTALLATION MOSTLY COMPLETE - Review warnings');
    console.log('');
    console.log('  Warnings:');
    results.filter(r => r.status === 'warning').forEach(r => {
      console.log(`    - ${r.component}: ${r.message}`);
    });
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
}

/**
 * Main verification function
 */
async function verify() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  MarinaMatch Tier 2 Upgrade - Installation Verification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  await verifyEnvironment();
  await verifyDependencies();
  await verifyFiles();
  await verifyS3();
  await verifyRedis();
  await verifyDatabase();
  
  generateReport();
  
  const failed = results.filter(r => r.status === 'fail').length;
  process.exit(failed > 0 ? 1 : 0);
}

// Run verification if called directly
if (require.main === module) {
  verify().catch((error) => {
    console.error('Verification error:', error);
    process.exit(1);
  });
}

export { verify, results };
