#!/usr/bin/env node
/**
 * MarinaMatch Security Setup Script
 * 
 * Run this after uploading to Replit:
 *   node setup.js
 * 
 * It will:
 * 1. Detect your Replit APP_URL
 * 2. Check required environment variables
 * 3. Run database migrations
 * 4. Seed roles and permissions
 * 5. Run security tests
 */

const { execSync } = require('child_process');
const crypto = require('crypto');

// ============================================================================
// REPLIT URL DETECTION
// ============================================================================

function getReplitUrl() {
  // Replit provides these environment variables automatically
  const replSlug = process.env.REPL_SLUG;
  const replOwner = process.env.REPL_OWNER;
  
  if (replSlug && replOwner) {
    return `https://${replSlug}.${replOwner}.repl.co`;
  }
  
  // Alternative: REPLIT_DEV_DOMAIN (newer Replit deployments)
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  if (devDomain) {
    return `https://${devDomain}`;
  }
  
  // Fallback for deployed apps
  const replitDomain = process.env.REPLIT_DOMAINS;
  if (replitDomain) {
    return `https://${replitDomain.split(',')[0]}`;
  }
  
  return null;
}

// ============================================================================
// HELPERS
// ============================================================================

function log(emoji, message) {
  console.log(`${emoji}  ${message}`);
}

function run(command, description) {
  log('⏳', description);
  try {
    execSync(command, { stdio: 'inherit' });
    log('✅', `${description} - Done!`);
    return true;
  } catch (error) {
    log('❌', `${description} - Failed!`);
    return false;
  }
}

function checkEnvVar(name, required = true) {
  const value = process.env[name];
  if (value) {
    // Mask sensitive values
    const masked = name.includes('KEY') || name.includes('SECRET') || name.includes('URL')
      ? `${value.slice(0, 10)}...${value.slice(-4)}`
      : value;
    log('✅', `${name} = ${masked}`);
    return true;
  } else if (required) {
    log('❌', `${name} - MISSING (required)`);
    return false;
  } else {
    log('⚠️', `${name} - Not set (optional)`);
    return true;
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('   MarinaMatch Security Setup');
  console.log('═'.repeat(60) + '\n');

  // Step 1: Detect Replit URL
  log('🔍', 'Detecting Replit URL...');
  const appUrl = getReplitUrl();
  
  if (appUrl) {
    log('✅', `Detected APP_URL: ${appUrl}`);
    console.log('\n   Add this to Replit Secrets if not already set:');
    console.log(`   APP_URL = ${appUrl}\n`);
  } else {
    log('⚠️', 'Could not auto-detect Replit URL');
    console.log('   You may need to set APP_URL manually in Replit Secrets\n');
  }

  // Step 2: Check Environment Variables
  console.log('\n' + '─'.repeat(60));
  log('🔐', 'Checking Environment Variables...\n');
  
  let allEnvOk = true;
  allEnvOk = checkEnvVar('DATABASE_URL') && allEnvOk;
  allEnvOk = checkEnvVar('ENCRYPTION_KEY') && allEnvOk;
  checkEnvVar('APP_URL', false);
  checkEnvVar('QUICKBOOKS_CLIENT_ID', false);
  checkEnvVar('QUICKBOOKS_CLIENT_SECRET', false);

  if (!process.env.ENCRYPTION_KEY) {
    console.log('\n   Generate an encryption key with:');
    console.log('   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    console.log('\n   Here\'s one you can use:');
    console.log(`   ${crypto.randomBytes(32).toString('hex')}\n`);
  }

  if (!allEnvOk) {
    console.log('\n' + '─'.repeat(60));
    log('⛔', 'Missing required environment variables!');
    console.log('   Please add them to Replit Secrets and run this script again.\n');
    process.exit(1);
  }

  // Step 3: Install Dependencies
  console.log('\n' + '─'.repeat(60));
  if (!run('npm install', 'Installing dependencies')) {
    process.exit(1);
  }

  // Step 4: Database Setup
  console.log('\n' + '─'.repeat(60));
  log('🗄️', 'Database Setup\n');

  // Push schema
  if (!run('npx drizzle-kit push', 'Pushing database schema')) {
    console.log('   If this fails, make sure DATABASE_URL is correct.\n');
  }

  // Note about RLS - can't run psql from Node easily
  console.log('\n   ⚠️  RLS Policies: Run this manually in Neon SQL Editor:');
  console.log('   Copy contents of: server/db/migrations/0001_rls_policies.sql\n');

  // Seed roles
  run('npx tsx server/db/seeds/roles-permissions.ts', 'Seeding roles and permissions');

  // Step 5: Run Tests
  console.log('\n' + '─'.repeat(60));
  run('npm test', 'Running security tests');

  // Step 6: Summary
  console.log('\n' + '═'.repeat(60));
  console.log('   Setup Complete!');
  console.log('═'.repeat(60));
  console.log(`
  Next steps:
  
  1. Apply RLS policies manually in Neon SQL Editor:
     - Go to https://console.neon.tech
     - Open SQL Editor
     - Paste contents of server/db/migrations/0001_rls_policies.sql
     - Click "Run"
  
  2. Start the server:
     npm run dev
  
  3. Test the health endpoint:
     curl http://localhost:3000/health
  
  ${appUrl ? `4. Your app will be available at:
     ${appUrl}` : ''}
  `);
}

main().catch(console.error);
