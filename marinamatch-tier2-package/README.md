# MarinaMatch Security & Scale Package (Tier 1+2)

**Version:** 1.0  
**Target:** Replit Core Deployment  
**Installation Time:** 2 days (including testing)

---

## What This Package Does

### Tier 1: Critical Security Fixes (Prevents Disasters)
✅ Multi-tenant data isolation verification & fixes  
✅ File upload security (path traversal, MIME validation)  
✅ Audit logs orgId support  
✅ Ship store multi-tenant support  
✅ Rate limiting (login + global)  
✅ Session invalidation on password reset  

### Tier 2: Scalability & Reliability (Prevents Near-Term Issues)
✅ S3 storage migration (no more file loss)  
✅ Database connection pooling  
✅ AI spending caps ($100 limit)  
✅ Input validation (Zod schemas)  
✅ Error response sanitization  
✅ Composite database indexes  

---

## Prerequisites

Before you start, you need:

1. **AWS Account** with S3 access ✓ (you have this)
2. **Replit Core Plan** ✓ (you have this)
3. **Upstash Account** (free tier - for Redis)
4. **30 minutes** for initial setup
5. **Database backup** (we'll create one first)

---

## Installation Overview

```
Day 1 Morning:   Setup (1 hour)
Day 1 Afternoon: Database migrations (2 hours)
Day 1 Evening:   Code deployment (3 hours)
Day 2 Morning:   Testing (4 hours)
Day 2 Afternoon: File migration to S3 (2 hours)
```

**Total: ~12 active hours over 2 days**

---

## Quick Start

### Step 1: Upload Package to Replit

1. Download `marinamatch-tier2-package.zip`
2. In your Replit project, open Shell
3. Run:
```bash
cd /home/runner/YOUR-REPL-NAME
# Create a backup first!
mkdir -p ~/backups
cp -r server ~/backups/server-backup-$(date +%Y%m%d)
cp -r client ~/backups/client-backup-$(date +%Y%m%d)

# Now upload the package
# (Use Replit's upload feature to upload the zip file)
unzip marinamatch-tier2-package.zip -d ~/upgrade
```

### Step 2: Run Interactive Setup

```bash
cd ~/upgrade
chmod +x setup.sh
./setup.sh
```

The script will:
- Check your Replit environment
- Install dependencies
- Validate database connection
- Check for required secrets
- Create backup of existing code

### Step 3: Follow the Installation Guide

Open `INSTALL.md` and follow step-by-step instructions.

---

## What Gets Changed

### Files Modified
- `server/routes.ts` - Rate limiting, input validation
- `server/index.ts` - Error handling, connection pooling
- `server/routes/auth-routes.ts` - Session invalidation
- `server/db.ts` - Connection pooling config
- `shared/schema.ts` - Schema updates (via migrations)

### Files Added
- `server/middleware/rate-limit.ts` - Rate limiting logic
- `server/middleware/validation.ts` - Input validation
- `server/middleware/error-handler.ts` - Error sanitization
- `server/utils/s3-client.ts` - S3 storage
- `server/services/ai-spending-guard.ts` - AI cost tracking
- `server/services/file-security.ts` - Upload security
- `tests/isolation/` - Tenant isolation tests
- `db/migrations/tier2/` - Database migrations

### Database Changes
- `audit_logs` - Make projectId nullable, add orgId
- `ship_store_*` - Add orgId column
- `ai_usage_tracking` - New table
- `ai_spending_limits` - New table
- Multiple indexes added for performance

---

## Rollback Plan

If anything goes wrong:

```bash
# Restore code
cp -r ~/backups/server-backup-YYYYMMDD/* server/

# Restore database
npm run migrate:rollback

# Restart Replit
```

Full rollback instructions in `ROLLBACK.md`

---

## Support

If you encounter issues:
1. Check `TROUBLESHOOTING.md`
2. Review logs: `tail -f ~/.logs/upgrade.log`
3. Ask Claude for help (include error messages)

---

## Next Steps After Installation

Once installed and tested:
1. Monitor for 1 week with beta users
2. Add Stripe billing (Tier 3) when ready to charge
3. Add QuickBooks integration (Tier 3) when customers need it

---

## Files in This Package

```
marinamatch-tier2-package/
├── README.md (this file)
├── INSTALL.md (step-by-step guide)
├── ROLLBACK.md (emergency rollback)
├── TROUBLESHOOTING.md (common issues)
├── setup.sh (interactive setup script)
├── security/
│   ├── file-upload-security.ts
│   ├── rate-limiting.ts
│   ├── input-validation.ts
│   ├── session-management.ts
│   └── error-handler.ts
├── database/
│   ├── migrations/
│   │   ├── 001_audit_logs_orgid.sql
│   │   ├── 002_ship_store_orgid.sql
│   │   ├── 003_composite_indexes.sql
│   │   ├── 004_ai_spending_tables.sql
│   │   └── run-migrations.ts
│   └── connection-pooling.ts
├── storage/
│   ├── s3-client.ts
│   ├── migrate-existing-files.ts
│   └── upload-routes-patch.ts
├── ai/
│   ├── usage-tracking.ts
│   ├── spending-guard.ts
│   └── ai-service-wrapper.ts
├── testing/
│   ├── isolation-tests.ts
│   ├── test-setup.ts
│   └── run-tests.sh
└── integration/
    ├── apply-security-patches.ts
    ├── apply-storage-patches.ts
    ├── apply-ai-patches.ts
    └── verify-installation.ts
```

Let's begin! Open `INSTALL.md` for detailed instructions.
