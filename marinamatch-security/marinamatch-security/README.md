# MarinaMatch Security Architecture

A production-ready, SOC2-compliant security implementation for the MarinaMatch marina real estate investment platform.

## 🔐 Security Features

### Authentication & Sessions
- Cookie-based sessions with `HttpOnly`, `Secure`, `SameSite` flags
- CSRF protection via double-submit token pattern
- Session rotation on privilege changes
- Automatic session cleanup

### Authorization (RBAC/ABAC)
- 8 pre-defined roles: Admin, Owner, Analyst, Investor, Broker, Accountant, Attorney, Viewer
- 24 granular permissions across documents, models, users, integrations, CRM, reports
- Resource-level access control
- Super admin "break-glass" access with full audit

### Multi-Tenant Isolation
- PostgreSQL Row Level Security (RLS) on all tenant-scoped tables
- Application-level tenant context enforcement
- Defense-in-depth: both database and middleware guards

### Secure File Uploads
- MIME type validation via magic bytes (not just extension)
- Filename sanitization (prevents path traversal)
- Size limits and per-org storage quotas
- SHA-256 checksum verification
- Quarantine workflow for manual review
- Duplicate detection

### Data Protection
- AES-256-GCM encryption for OAuth tokens
- Sensitive field masking in logs
- PII redaction in audit records

### Third-Party Integrations (QuickBooks)
- PKCE for OAuth flows
- State parameter validation
- Encrypted token storage
- Automatic token refresh
- Webhook signature verification

### API Security
- Helmet.js security headers (CSP, HSTS, X-Frame-Options)
- Strict CORS with origin allowlist
- Rate limiting (auth: 5/min, upload: 10/hr, general: 100/15min)
- Zod schema validation on all inputs
- Structured error handling (no stack traces in prod)

### Audit Logging
- Hash-chained entries for tamper evidence
- Comprehensive event capture
- Append-only design (no updates/deletes allowed)
- Retention policy support

## 📁 Project Structure

```
marinamatch-security/
├── docs/
│   ├── THREAT_MODEL.md         # Security threat analysis
│   └── DEPLOYMENT_RUNBOOK.md   # Replit deployment guide
├── server/
│   ├── app.ts                  # Express application
│   ├── config/
│   │   └── security.ts         # Helmet, CORS, rate limiters
│   ├── db/
│   │   ├── client.ts           # Database connection
│   │   ├── security-schema.ts  # Drizzle ORM schema
│   │   ├── migrations/
│   │   │   └── 0001_rls_policies.sql
│   │   └── seeds/
│   │       └── roles-permissions.ts
│   ├── middleware/
│   │   ├── auth.ts             # Authentication
│   │   └── authorization.ts    # RBAC/ABAC
│   ├── routes/
│   │   ├── documents.ts        # File upload/download
│   │   └── oauth.ts            # QuickBooks integration
│   ├── services/
│   │   ├── audit-logger.ts     # Audit logging
│   │   └── file-upload.ts      # Upload processing
│   ├── tasks/
│   │   └── scheduler.ts        # Background jobs
│   ├── tests/
│   │   └── security.test.ts    # Security tests
│   ├── types/
│   │   └── security.ts         # TypeScript definitions
│   ├── utils/
│   │   └── encryption.ts       # AES-256-GCM
│   └── validators/
│       └── index.ts            # Zod schemas
├── drizzle.config.ts           # Drizzle Kit config
└── package.json
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Add these to Replit Secrets:

```env
DATABASE_URL=postgresql://...?sslmode=require
ENCRYPTION_KEY=<64-char-hex-string>
APP_URL=https://your-app.replit.app
```

Generate encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Setup Database

```bash
# Generate and apply schema
npm run db:push

# Apply RLS policies
psql $DATABASE_URL -f server/db/migrations/0001_rls_policies.sql

# Seed roles and permissions
npm run db:seed
```

### 4. Run Server

```bash
npm run dev
```

### 5. Verify

```bash
curl http://localhost:3000/health
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## 📊 Security Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         REQUEST                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  EDGE (Replit/Cloudflare)                                   │
│  - TLS termination                                          │
│  - DDoS protection                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  SECURITY MIDDLEWARE STACK                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │   Helmet    │ │    CORS     │ │   Rate Limiter      │   │
│  │  (Headers)  │ │  (Origins)  │ │ (100/15min general) │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │   Session   │ │    CSRF     │ │   Zod Validation    │   │
│  │   Cookie    │ │   Token     │ │   (Strict Schemas)  │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               RBAC Authorization                      │   │
│  │  user.can('documents:upload') → allow/deny           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  BUSINESS LOGIC (Route Handlers)                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  DATA LAYER                                                  │
│  ┌─────────────────────┐    ┌─────────────────────────┐    │
│  │    PostgreSQL       │    │    Object Storage       │    │
│  │  (RLS Enforced)     │    │  (Presigned URLs)       │    │
│  │                     │    │                         │    │
│  │  SET app.org_id=X   │    │  /org_id/year/month/    │    │
│  │  → Only see org X   │    │  uuid.ext               │    │
│  └─────────────────────┘    └─────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  AUDIT LOG (Append-Only, Hash-Chained)                       │
│  { action, user, resource, timestamp, hash(prev) }          │
└─────────────────────────────────────────────────────────────┘
```

## 🔒 Roles & Permissions

| Role | Documents | Models | Users | Integrations | Org | Audit | CRM | Reports |
|------|-----------|--------|-------|--------------|-----|-------|-----|---------|
| Admin | Full | Full | Full | Full | Full | Read | Full | Full |
| Owner | Full | Full | Full | Full | Full | Read | Full | Full |
| Analyst | R/U/D | Full | - | Read | - | - | Read | R/C |
| Investor | R/D | Read | - | - | - | - | - | Read |
| Broker | R/U/D | Read | - | - | - | - | R/W | Read |
| Accountant | R/U/D | Read | - | R/Sync | - | - | - | R/C |
| Attorney | R/D | - | - | - | - | - | - | Read |
| Viewer | Read | Read | - | - | - | - | - | Read |

## 📚 Documentation

- [Threat Model](docs/THREAT_MODEL.md) - Security analysis and mitigations
- [Deployment Runbook](docs/DEPLOYMENT_RUNBOOK.md) - Step-by-step deployment guide

## 🛡️ SOC2 Mapping

| SOC2 Criteria | Implementation |
|---------------|----------------|
| CC6.1 Logical Access | RBAC, tenant isolation, RLS |
| CC6.2 Authentication | Session security, MFA-ready |
| CC6.3 Access Removal | Session invalidation, token revocation |
| CC6.6 System Boundaries | Trust boundaries, network segmentation |
| CC6.7 Data Transmission | TLS everywhere, encrypted tokens |
| CC7.1 Configuration | Helmet, env validation, no defaults |
| CC7.2 Change Management | Audit logging, version tracking |

## ⚠️ Security Notes

1. **Never commit secrets** - Use Replit Secrets or environment variables
2. **Rotate keys periodically** - Especially after team member departures
3. **Monitor audit logs** - Set up alerts for suspicious activity
4. **Keep dependencies updated** - Run `npm audit` regularly
5. **Test tenant isolation** - Verify users can't access other orgs' data

## 📄 License

Proprietary - MarinaMatch Internal Use Only
