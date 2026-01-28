# MarinaMatch Security Implementation Guide

## Replit-Ready Deployment Runbook

This guide provides step-by-step instructions for deploying the security architecture on Replit.

---

## Table of Contents

1. [Environment Variables](#1-environment-variables)
2. [Database Setup](#2-database-setup)
3. [Security Initialization](#3-security-initialization)
4. [Verification Checklist](#4-verification-checklist)
5. [Troubleshooting](#5-troubleshooting)

---

## 1. Environment Variables

### Required Secrets (Add to Replit Secrets)

| Variable | Description | How to Generate |
|----------|-------------|-----------------|
| `DATABASE_URL` | Neon PostgreSQL connection string | Neon dashboard |
| `ENCRYPTION_KEY` | 32-byte hex key for AES-256 | See below |
| `APP_URL` | Your app's public URL | e.g., `https://marinamatch.replit.app` |

### Optional Secrets

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |
| `CORS_ALLOWED_ORIGINS` | Additional CORS origins | None |
| `UPLOAD_PATH` | File storage directory | `/data/uploads` |
| `QUICKBOOKS_CLIENT_ID` | QuickBooks OAuth client ID | None |
| `QUICKBOOKS_CLIENT_SECRET` | QuickBooks OAuth secret | None |
| `QUICKBOOKS_WEBHOOK_SECRET` | QuickBooks webhook verification | None |
| `SENTRY_DSN` | Sentry error tracking DSN | None |

### Generating Encryption Key

Run this in Replit Shell:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and add it as `ENCRYPTION_KEY` in Replit Secrets.

**⚠️ CRITICAL: Never commit this key to version control!**

---

## 2. Database Setup

### Step 2.1: Create Neon Database

1. Go to [Neon Console](https://console.neon.tech)
2. Create a new project: `marinamatch`
3. Copy the connection string (with SSL)
4. Add as `DATABASE_URL` in Replit Secrets

### Step 2.2: Apply Schema Migration

```bash
# Install Drizzle CLI if not present
npm install -D drizzle-kit

# Generate migration from schema
npx drizzle-kit generate

# Apply migration
npx drizzle-kit push
```

### Step 2.3: Apply RLS Policies

```bash
# Connect to Neon via psql or use Neon SQL Editor
# Run the contents of: server/db/migrations/0001_rls_policies.sql

# Or via command line (requires psql):
psql $DATABASE_URL -f server/db/migrations/0001_rls_policies.sql
```

### Step 2.4: Seed Roles and Permissions

```bash
npx tsx server/db/seeds/roles-permissions.ts
```

Expected output:
```
🌱 Seeding roles and permissions...

📝 Inserting permissions...
   ✓ 24 permissions configured

👥 Inserting system roles...
   ✓ Created role: Admin
   ✓ Created role: Owner
   ✓ Created role: Analyst
   ✓ Created role: Investor
   ✓ Created role: Broker
   ✓ Created role: Accountant
   ✓ Created role: Attorney
   ✓ Created role: Viewer

✅ Seed completed successfully!
```

---

## 3. Security Initialization

### Step 3.1: Verify Encryption

Add to your startup to validate encryption works:

```typescript
import { initializeEncryption } from './server/utils/encryption';

// This will throw if ENCRYPTION_KEY is invalid
initializeEncryption();
```

### Step 3.2: Create Upload Directory

```bash
mkdir -p /data/uploads
chmod 700 /data/uploads
```

### Step 3.3: Start the Server

```bash
npm run dev
# or
npx tsx server/app.ts
```

### Step 3.4: Verify Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "healthy",
      "latency": 15
    },
    "memory": {
      "status": "healthy",
      "latency": 42
    }
  }
}
```

---

## 4. Verification Checklist

### Security Headers

Test with curl:
```bash
curl -I http://localhost:3000/api/health
```

Verify these headers are present:
- [ ] `Strict-Transport-Security: max-age=31536000`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY`
- [ ] `X-XSS-Protection: 1; mode=block`
- [ ] `Content-Security-Policy: ...`

### CORS

```bash
# Should fail (wrong origin)
curl -H "Origin: http://evil.com" http://localhost:3000/api/health

# Should succeed (allowed origin)
curl -H "Origin: http://localhost:5173" http://localhost:3000/api/health
```

### Rate Limiting

```bash
# Hit auth endpoint 6+ times quickly
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/auth/callback
done
# Should see 429 after 5 requests
```

### Session Security

1. Login and check cookies in browser DevTools:
   - [ ] `HttpOnly` flag is set
   - [ ] `Secure` flag is set (in production)
   - [ ] `SameSite=Lax` or `Strict`

### Tenant Isolation

```bash
# With a valid session for Org A, try to access Org B's data
# Should return 403 or empty results
```

### File Upload

1. Try uploading a `.exe` file renamed to `.pdf`
   - [ ] Should be rejected (magic byte validation)

2. Try uploading with filename `../../../etc/passwd`
   - [ ] Should be sanitized to safe name

3. Try uploading file > 100MB
   - [ ] Should be rejected (size limit)

### RLS Verification

Connect to Neon SQL Editor and run:

```sql
-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- All tenant-scoped tables should show rowsecurity = true
```

### Audit Log Chain

```sql
-- Verify hash chain integrity
SELECT id, log_hash, previous_log_hash
FROM audit_logs
ORDER BY created_at
LIMIT 10;
```

---

## 5. Troubleshooting

### "ENCRYPTION_KEY environment variable is required"

1. Generate key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Add to Replit Secrets as `ENCRYPTION_KEY`
3. Restart the repl

### "DATABASE_URL environment variable is required"

1. Get connection string from Neon dashboard
2. Add to Replit Secrets as `DATABASE_URL`
3. Make sure it includes `?sslmode=require`

### "CORS: Not allowed"

1. Check `APP_URL` is set correctly
2. Add additional origins to `CORS_ALLOWED_ORIGINS` (comma-separated)

### "Rate limit exceeded"

- Auth routes: 5 requests/minute
- Upload routes: 10 requests/hour
- General API: 100 requests/15 minutes

Wait or adjust limits in `server/config/security.ts`.

### "Session not valid"

1. Check cookies are being set/sent
2. Verify session hasn't expired (24h default)
3. Check database for session record

### "Permission denied"

1. Verify user has the required role
2. Check role has the required permission
3. Verify RBAC middleware is applied correctly

### RLS "permission denied for table"

1. Ensure `app.current_org_id` is set before queries
2. Check user is not trying to access another tenant's data
3. Verify RLS policies are applied correctly

---

## Security Configuration Files Reference

```
server/
├── app.ts                      # Main Express app
├── config/
│   └── security.ts             # Helmet, CORS, Rate limiters
├── db/
│   ├── client.ts               # Database connection
│   ├── security-schema.ts      # Drizzle schema
│   ├── migrations/
│   │   └── 0001_rls_policies.sql
│   └── seeds/
│       └── roles-permissions.ts
├── middleware/
│   ├── auth.ts                 # Authentication
│   └── authorization.ts        # RBAC/ABAC
├── routes/
│   ├── documents.ts            # File upload/download
│   └── oauth.ts                # QuickBooks OAuth
├── services/
│   ├── audit-logger.ts         # Audit logging
│   └── file-upload.ts          # Upload processing
├── tasks/
│   └── scheduler.ts            # Background jobs
├── types/
│   └── security.ts             # TypeScript types
├── utils/
│   └── encryption.ts           # AES-256-GCM
└── validators/
    └── index.ts                # Zod schemas
```

---

## Production Checklist

Before going to production:

- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS (Replit handles this)
- [ ] Set secure, unique `ENCRYPTION_KEY`
- [ ] Configure `APP_URL` to production URL
- [ ] Set up Neon production branch
- [ ] Enable Neon automatic backups
- [ ] Configure Sentry for error tracking
- [ ] Review and tighten rate limits
- [ ] Enable all CSP directives
- [ ] Remove `'unsafe-eval'` from CSP if possible
- [ ] Set up monitoring/alerting
- [ ] Schedule regular security audits
- [ ] Document incident response plan

---

## Support

For security issues, contact the development team immediately.

Do NOT commit:
- Environment variables
- Encryption keys
- API secrets
- Database credentials
