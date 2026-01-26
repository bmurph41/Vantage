# Emergency Rollback Procedures

**Use this guide if something goes wrong during or after installation.**

---

## When to Rollback

Rollback if you encounter:
- **Critical bugs** preventing app use
- **Data corruption** or loss
- **Significant performance degradation**
- **Security vulnerabilities introduced**
- **Database migration failures**

**DO NOT** rollback for:
- Minor bugs (fix forward instead)
- Temporary performance issues
- Learning curve with new features

---

## Pre-Rollback Checklist

Before rolling back:

1. **Stop the application**
   ```bash
   # In Replit, click "Stop" button
   ```

2. **Document the issue**
   - What went wrong?
   - When did it happen?
   - Error messages?
   - Screenshots?

3. **Notify users** (if in production)
   - Set maintenance mode
   - Post status update

4. **Backup current state** (even if broken)
   ```bash
   mkdir -p ~/rollback-backups/$(date +%Y%m%d-%H%M)
   cp -r server ~/rollback-backups/$(date +%Y%m%d-%H%M)/
   cp -r client ~/rollback-backups/$(date +%Y%m%d-%H%M)/
   ```

---

## Rollback Steps

### Level 1: Code Rollback Only (No Database Changes)

If you only applied code changes (no migrations run):

```bash
# 1. Restore code from backup
cd /home/runner/YOUR-REPL-NAME
cp -r ~/backups/tier2-upgrade-YYYYMMDD-HHMM/server/* server/
cp -r ~/backups/tier2-upgrade-YYYYMMDD-HHMM/client/* client/
cp -r ~/backups/tier2-upgrade-YYYYMMDD-HHMM/shared/* shared/
cp ~/backups/tier2-upgrade-YYYYMMDD-HHMM/package.json ./

# 2. Reinstall original dependencies
npm install

# 3. Restart application
# Click "Run" in Replit
```

**Verification:**
- App starts without errors
- Can login
- Can access existing data
- No console errors

---

### Level 2: Database Rollback (Migrations Were Run)

If you ran database migrations:

#### Option A: Rollback Migrations (Preferred)

```bash
# 1. Rollback migrations one by one (in reverse order)
cd ~/upgrade/database/migrations

# Rollback migration 004
node run-migrations.ts --rollback
# Expected output: ✓ Rollback of 004_ai_spending_tables.sql completed

# Rollback migration 003
node run-migrations.ts --rollback

# Rollback migration 002
node run-migrations.ts --rollback

# Rollback migration 001
node run-migrations.ts --rollback

# 2. Verify rollback
psql $DATABASE_URL -c "SELECT * FROM schema_migrations"
# Should show no rows (or only pre-upgrade migrations)

# 3. Restore code (see Level 1 above)
```

#### Option B: Restore Database from Backup (Nuclear Option)

**WARNING: This loses ALL data since backup!**

```bash
# In Neon dashboard:
# 1. Go to your project
# 2. Click "Backups" tab
# 3. Find "Pre-Tier2-Upgrade-2026-01-26" backup
# 4. Click "Restore"
# 5. Confirm restoration

# Wait 5-10 minutes for restore to complete

# Then restore code (see Level 1 above)
```

---

### Level 3: Complete Rollback (Code + Database + Files)

If you also migrated files to S3:

```bash
# 1. Restore database (see Level 2)

# 2. Restore code (see Level 1)

# 3. Restore local files from backup
cd /home/runner/YOUR-REPL-NAME
rm -rf server/uploads
cp -r server/uploads-backup-TIMESTAMP server/uploads

# 4. Update document paths in database back to local
# (Only if you completed S3 migration)
psql $DATABASE_URL <<EOF
UPDATE cdd_documents 
SET path = REPLACE(path, s3_url, original_local_path)
WHERE s3_url IS NOT NULL;

UPDATE vdr_documents 
SET path = REPLACE(path, s3_url, original_local_path)
WHERE s3_url IS NOT NULL;
EOF
```

---

## Rollback Specific Components

### Rollback Rate Limiting Only

```bash
# Remove rate limiting middleware
cd /home/runner/YOUR-REPL-NAME/server

# Edit index.ts - remove these lines:
# import { globalRateLimit } from './middleware/rate-limiting';
# app.use(globalRateLimit);

# Edit routes/auth-routes.ts - remove:
# import { loginRateLimit } from '../middleware/rate-limiting';
# router.post('/login', loginRateLimit, ...)

# Restart app
```

### Rollback S3 Storage Only

```bash
# 1. Restore local uploads from backup
cp -r server/uploads-backup-TIMESTAMP server/uploads

# 2. Revert upload routes to use local storage
# Edit server/routes.ts
# Change uploadToS3() calls back to local Multer saves

# 3. Update database paths
psql $DATABASE_URL <<EOF
UPDATE cdd_documents SET path = REPLACE(path, 'orgId/', '');
UPDATE vdr_documents SET path = REPLACE(path, 'orgId/', '');
EOF
```

### Rollback AI Spending Guards Only

```bash
# 1. Remove AI spending checks from routes
# Edit files that call AI APIs
# Remove: await checkAISpendingLimit(...)
# Remove: await trackAIUsage(...)

# 2. Drop AI tables (optional - keeps historical data if you don't)
psql $DATABASE_URL <<EOF
DROP TABLE IF EXISTS ai_usage_tracking;
DROP TABLE IF EXISTS ai_spending_limits;
EOF
```

---

## Post-Rollback Verification

After rollback, verify:

### 1. Application Health
```bash
curl http://localhost:5000/health
# Expected: {"status":"ok"}
```

### 2. Authentication
- Login with existing user
- Create new session
- Verify session persists

### 3. Data Integrity
```bash
# Check record counts
psql $DATABASE_URL <<EOF
SELECT 'deals' as table, COUNT(*) FROM crm_deals
UNION ALL
SELECT 'projects', COUNT(*) FROM projects
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks;
EOF
```

### 4. File Access
- Upload a test document
- Download existing documents
- Verify files load correctly

### 5. Database Performance
```bash
# Check for slow queries
psql $DATABASE_URL -c "\
SELECT query, calls, mean_exec_time, max_exec_time \
FROM pg_stat_statements \
WHERE mean_exec_time > 1000 \
ORDER BY mean_exec_time DESC \
LIMIT 10;"
```

---

## Common Rollback Issues

### Issue: "Cannot connect to database after restore"

**Solution:**
```bash
# Wait 10 minutes for Neon restore to complete
# Check database URL hasn't changed
echo $DATABASE_URL
# Restart application
```

### Issue: "npm install fails after code rollback"

**Solution:**
```bash
# Clear npm cache
npm cache clean --force
rm -rf node_modules
rm package-lock.json
npm install
```

### Issue: "Files not found after S3 rollback"

**Solution:**
```bash
# Verify backup exists
ls -la server/uploads-backup-*
# Copy correct backup
cp -r server/uploads-backup-CORRECT-TIMESTAMP server/uploads
```

### Issue: "Database rollback fails with foreign key errors"

**Solution:**
```bash
# Disable foreign key checks temporarily
psql $DATABASE_URL <<EOF
SET session_replication_role = 'replica';
-- Run rollback SQL here
SET session_replication_role = 'origin';
EOF
```

---

## Prevention (Next Time)

To make rollback easier in future:

1. **Always use staging first**
   - Test upgrades on staging
   - Run for 1 week before production

2. **Blue-Green deployments**
   - Keep old version running
   - Switch traffic to new version
   - Easy rollback = switch back

3. **Feature flags**
   - Deploy code with features disabled
   - Enable incrementally
   - Rollback = flip flag

4. **Monitoring**
   - Set up alerts before deploying
   - Know immediately if something breaks

---

## Getting Help

If rollback fails:

1. **Stop and assess**
   - Don't make it worse
   - Document current state

2. **Ask for help** (include this info)
   - What rollback steps you tried
   - Current error messages
   - Database state (run: `psql $DATABASE_URL -c "\dt"`)
   - Last successful backup timestamp

3. **Last resort: Fresh start**
   - Restore from pre-upgrade backup
   - Manually re-enter any data created after backup
   - Skip upgrade for now

---

## Rollback Success Criteria

You've successfully rolled back when:

- ✅ Application starts without errors
- ✅ Users can login
- ✅ All data from before upgrade is accessible
- ✅ No console errors
- ✅ Database queries complete in <1 second
- ✅ Files can be uploaded and downloaded

---

## Re-Attempting Upgrade

After rolling back, before trying again:

1. **Identify root cause**
   - Why did it fail?
   - Was it environmental?
   - Was it a bug in upgrade package?

2. **Fix the issue**
   - Update upgrade package
   - Fix environment
   - Add missing dependencies

3. **Test on staging**
   - Never go straight to production again

4. **Document the fix**
   - Update TROUBLESHOOTING.md
   - Share with team

5. **Try upgrade again**
   - With fixes applied
   - During low-traffic period
   - With team on standby
