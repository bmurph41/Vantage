# Troubleshooting Guide

Common issues during Tier 2 upgrade installation and fixes.

---

## Installation Issues

### setup.sh: "Missing required secrets"

**Symptom:**
```
✗ Missing: AWS_ACCESS_KEY_ID
✗ Missing: S3_BUCKET_NAME
```

**Cause:** Secrets not set in Replit

**Fix:**
1. Click the 🔒 Secrets icon in Replit sidebar
2. Add each missing secret
3. Run `./setup.sh` again

**Verify:**
```bash
echo $AWS_ACCESS_KEY_ID  # Should print key, not empty
```

---

### S3 Connection Failed

**Symptom:**
```
✗ S3 connection failed: InvalidAccessKeyId
```

**Causes & Fixes:**

**Wrong AWS credentials:**
```bash
# In Replit Secrets, verify:
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE  # Should start with AKIA
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI...   # Should be 40 characters
```

**Wrong region:**
```bash
# Add/update in Secrets:
AWS_REGION=us-east-1  # Must match your S3 bucket region
```

**Bucket doesn't exist:**
```bash
# In AWS Console → S3:
# 1. Verify bucket exists
# 2. Copy exact bucket name (case-sensitive!)
# 3. Update S3_BUCKET_NAME secret in Replit
```

**IAM permissions missing:**
```javascript
// In AWS Console → IAM → Users → your user → Permissions
// Attach policy: AmazonS3FullAccess
// Or custom policy with PutObject, GetObject, DeleteObject, ListBucket
```

---

### Redis Connection Failed

**Symptom:**
```
✗ Redis connection failed: ECONNREFUSED
```

**Causes & Fixes:**

**Wrong Upstash URL:**
```bash
# Correct format:
REDIS_URL=rediss://default:PASSWORD@HOSTNAME.upstash.io:6379

# Common mistakes:
REDIS_URL=redis://...   # Missing 's' - should be rediss:// (with TLS)
REDIS_URL=rediss://HOSTNAME.upstash.io  # Missing password
```

**Upstash instance paused:**
```
# Go to upstash.com → your database
# Click "Start" if it shows as paused
# Free tier pauses after inactivity
```

---

### Database Migration Fails

**Symptom:**
```
✗ Migration 001_audit_logs_orgid.sql failed: column "orgId" already exists
```

**Cause:** Migration was partially applied before

**Fix:**
```bash
# Check which migrations are applied
psql $DATABASE_URL -c "SELECT * FROM schema_migrations ORDER BY migration_number"

# If migration is listed, skip it
# If not listed but column exists, manually add to tracking:
psql $DATABASE_URL <<EOF
INSERT INTO schema_migrations (migration_number, migration_name)
VALUES (1, '001_audit_logs_orgid.sql');
EOF

# Then run migrations again
node run-migrations.ts
```

---

### npm Install Fails

**Symptom:**
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE could not resolve
```

**Fix:**
```bash
# Clear cache and try again
npm cache clean --force
rm -rf node_modules
rm package-lock.json
npm install --legacy-peer-deps
```

---

## Runtime Issues

### Application Won't Start

**Symptom:**
```
Error: Cannot find module './middleware/rate-limiting'
```

**Cause:** Files not copied to correct location

**Fix:**
```bash
# Verify file exists
ls -la server/middleware/rate-limiting.ts

# If missing, copy from upgrade package
cp ~/upgrade/security/rate-limiting.ts server/middleware/

# Also check other middleware files
cp ~/upgrade/security/error-handler.ts server/middleware/
cp ~/upgrade/security/input-validation.ts server/middleware/
```

---

### Rate Limiting Too Strict

**Symptom:** Legitimate users getting blocked

**Temporary Fix:**
```typescript
// Edit server/middleware/rate-limiting.ts
// Increase limits:
export const globalRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,  // Changed from 100 to 200
  // ...
});

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,  // Changed from 5 to 10
  // ...
});
```

**Permanent Fix:** Add IP whitelist for trusted users

---

### Files Not Uploading to S3

**Symptom:**
```
Error: Failed to upload file to S3
```

**Debug:**
```bash
# Test S3 connection manually
node -e "
const { testS3Connection } = require('./server/storage/s3-client');
testS3Connection().then(console.log);
"
```

**Common Causes:**

**Bucket policy too restrictive:**
```javascript
// In AWS S3 Console → Bucket → Permissions → Bucket Policy
// Ensure your IAM user has access
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT-ID:user/marinamatch-replit"
      },
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::BUCKET-NAME/*"
    }
  ]
}
```

**File too large:**
```typescript
// Check file size limit in upload route
// Default is 10MB, may need to increase
```

---

### AI Spending Limit Hit Immediately

**Symptom:**
```
AI spending limit reached ($100/month)
```

**Check current spend:**
```bash
psql $DATABASE_URL <<EOF
SELECT 
  "orgId",
  "currentMonthSpendCents" / 100.0 as dollars_spent,
  "monthlyLimitCents" / 100.0 as monthly_limit
FROM ai_spending_limits;
EOF
```

**Causes:**

**Historical usage counted:**
```bash
# Check if old AI calls were tracked retroactively
psql $DATABASE_URL -c "
  SELECT MIN(created_at), MAX(created_at), COUNT(*), SUM(estimated_cost_cents) / 100.0
  FROM ai_usage_tracking
  WHERE org_id = 1
"
```

**Fix:** Reset counter for current month
```bash
psql $DATABASE_URL <<EOF
UPDATE ai_spending_limits 
SET current_month_spend_cents = 0,
    last_reset_at = NOW(),
    hard_limit_reached_at = NULL
WHERE org_id = 1;
EOF
```

**Increase limit temporarily:**
```bash
# Set to $200
psql $DATABASE_URL <<EOF
UPDATE ai_spending_limits 
SET monthly_limit_cents = 20000
WHERE org_id = 1;
EOF
```

---

### Slow Database Queries

**Symptom:** Page loads take >5 seconds

**Check query performance:**
```bash
psql $DATABASE_URL -c "
SELECT 
  substring(query, 1, 100) as query,
  calls,
  round(mean_exec_time::numeric, 2) as avg_ms,
  round(max_exec_time::numeric, 2) as max_ms
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;
"
```

**Verify indexes were created:**
```bash
psql $DATABASE_URL -c "
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE indexname LIKE 'idx_%org%'
ORDER BY tablename, indexname;
"
```

**Missing indexes?**
```bash
# Re-run migration
cd ~/upgrade/database/migrations
psql $DATABASE_URL < 003_composite_indexes.sql
```

---

### Multi-Tenant Isolation Test Failures

**Symptom:**
```
❌ Route: GET /api/crm/deals/:id
   Problem: User from Org A accessed Org B deal
```

**Fix:**
```typescript
// Find the route in server/routes.ts
// Ensure enforceTenant middleware is applied:

app.get('/api/crm/deals/:id', 
  authenticateUser,
  enforceTenant,  // ← ADD THIS if missing
  async (req, res) => {
    // ...
  }
);
```

---

### Database Connection Pool Exhausted

**Symptom:**
```
Error: remaining connection slots are reserved
```

**Check pool stats:**
```bash
psql $DATABASE_URL -c "
SELECT 
  count(*) as active_connections,
  max_conn as max_connections
FROM pg_stat_activity
CROSS JOIN (SELECT setting::int AS max_conn FROM pg_settings WHERE name = 'max_connections') s
GROUP BY max_conn;
"
```

**Fix:**
```typescript
// Edit database/connection-pooling.ts
// Reduce pool size:
export function configureConnectionPooling() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,  // Changed from 10 to 5
    // ...
  });
}
```

---

## Testing Issues

### Isolation Tests Take Too Long

**Symptom:** Tests running for 30+ minutes

**Speed up:**
```bash
# Run tests for specific modules only
cd ~/upgrade/testing

# Test just CRM module (faster)
npm test -- --testPathPattern=crm

# Skip slow modules
npm test -- --testPathIgnore=operations
```

---

### Can't Access App After Restart

**Symptom:** White screen, no errors in console

**Check for build errors:**
```bash
# In Replit Console
# Look for:
ERROR in ./client/src/...
```

**Common fix:**
```bash
# Clear Vite cache
rm -rf client/node_modules/.vite
# Restart
```

---

## Performance Issues

### Dashboard Loading Slowly

**Check if indexes are used:**
```bash
psql $DATABASE_URL <<EOF
EXPLAIN ANALYZE
SELECT * FROM crm_deals 
WHERE "orgId" = 1 AND status = 'active' 
ORDER BY "createdAt" DESC 
LIMIT 50;
EOF

# Look for "Index Scan" (good) vs "Seq Scan" (bad)
```

**Force index usage:**
```sql
-- Add index hint if Postgres not using index
SELECT /*+ IndexScan(crm_deals idx_crm_deals_org_status_created) */
  * FROM crm_deals...
```

---

## Getting More Help

If issue persists:

1. **Collect diagnostics:**
```bash
# Run diagnostic script
cd ~/upgrade
./diagnostics.sh > diagnostic-report.txt
```

2. **Check logs:**
```bash
# Application logs
tail -100 ~/.logs/application.log

# Migration logs
tail -100 ~/.logs/migrations.log

# Error logs
tail -100 ~/.logs/error.log
```

3. **Ask for help with:**
   - Diagnostic report
   - Relevant log excerpts
   - What you were doing when error occurred
   - Steps you've already tried

---

## Prevention Tips

**Before making changes:**
- Always backup first
- Test on staging
- Read full error messages
- Document what you change

**During development:**
- Check logs frequently
- Monitor performance
- Test each feature
- Keep backups recent

**In production:**
- Set up monitoring
- Configure alerts
- Have rollback plan
- Schedule maintenance windows
