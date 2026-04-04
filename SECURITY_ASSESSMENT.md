# Security Assessment — MarinaMatch (Institutional-Grade)

> Generated: April 4, 2026  
> Scanners: Dependency Audit (npm), SAST, HoundDog dataflow  
> Manual review: auth chain, middleware order, cookie flags, CORS, CSP, XSS vectors, multi-tenancy

---

## Executive Summary

The application has a strong security foundation: parameterized queries throughout, tiered rate limiting, double-submit CSRF, httpOnly session cookies, Helmet headers, Zod input validation, magic-number file upload validation, and 719+ audit log call sites. However, several gaps prevent it from being fully institutional-grade. The top three actionable items are: **(1) DOMPurify on all `dangerouslySetInnerHTML` calls**, **(2) 51 npm dependency vulnerabilities needing `npm audit fix`**, and **(3) a cookie `secure` flag inconsistency on the OAuth callback route**.

---

## What Is Already Institutional-Grade ✅

| Area | Implementation |
|------|---------------|
| **Session cookies** | `httpOnly: true`, `secure: NODE_ENV === 'production' \|\| REPLIT_DEV_DOMAIN`, `sameSite: 'lax'` |
| **CSRF** | Double-submit cookie pattern with `crypto.timingSafeEqual` — resistant to timing attacks |
| **Rate limiting** | Global: 300 req/15 min · Login: 20/15 min · Register: 5/60 min · Brute-force: IP block after 10 failures |
| **CORS** | Origin allowlist + automatic `.replit.dev`, `.replit.app`, `.repl.co` passthrough |
| **Security headers** | Helmet: HSTS (1 year, includeSubDomains), `strict-origin-when-cross-origin` referrer, CSP, `noSniff`, `frameguard` |
| **Input validation** | Zod `validateBody` / `validateQuery` / `validateParams` middleware on all routes |
| **SQL injection** | Drizzle ORM parameterized queries throughout; raw `pool.query` calls use bound parameters |
| **Multi-tenancy** | PostgreSQL `set_config('app.current_tenant', orgId)` per request; `validateEntityOwnership` for resource-level checks; `enforceTenant` auto-injects orgId on writes |
| **File uploads** | Magic-number (binary header) validation; extension allowlist + blocklist; double-extension detection; filename sanitization; 50 MB cap; SHA-256 audit hash |
| **Audit logging** | 719+ call sites across all write operations, auth events, and admin actions |
| **No hardcoded secrets** | Zero secrets in source; all via environment variables / Replit Secrets |
| **Token encryption** | OAuth access tokens encrypted at rest (AES-256-CBC with per-record IV) |
| **RBAC** | `requireRole()` middleware; entity-level `owner_admin` / `internal_member` / `viewer` tiers |
| **Password security** | bcrypt hashing; reset tokens via `crypto.randomBytes(32)` |

---

## Gaps & Enhancements Required

### 🔴 HIGH — Fix Before Production

#### H1: `dangerouslySetInnerHTML` Without Sanitization (XSS Risk)
10 usages of `dangerouslySetInnerHTML` render untrusted HTML directly in the browser with no sanitization library. If any of this content originates from user input or database fields, it is a stored XSS vector.

**Affected files:**
- `client/src/components/crm/workflow-email-template-manager.tsx:207` — email preview HTML
- `client/src/components/crm/workflow-email-template-editor.tsx:290` — email template preview
- `client/src/components/crm/workflow-email-log.tsx:147` — body preview from DB
- `client/src/components/om-builder/OmCanvas.tsx:333` — OM content block
- `client/src/components/om-builder/SectionEditor.tsx:140,224` — section content
- `client/src/components/document-builder/ContentBlocks.tsx:513` — document block HTML
- `client/src/pages/workspaces/[workspaceId].tsx:839` — CA agreement body HTML from DB
- `client/src/pages/LegalPage.tsx:145` — markdown rendered as HTML

**Fix:** Install `dompurify` + `@types/dompurify` and wrap every `dangerouslySetInnerHTML`:
```typescript
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(rawHtml) }} />
```

---

#### H2: 51 Dependency Vulnerabilities (2 Critical, 49 High)
The dependency tree contains 2 critical and 49 high-severity CVEs, primarily:
- **CVE-2025-27789** (Babel) — ReDoS via named capturing group polyfill (all `@babel/*` packages < 7.26.10)
- Multiple transitive express/lodash/path-to-regexp high-severity entries

All flagged packages have non-major-version fixes available (`requiresMajorUpdate: false`).

**Fix:**
```bash
npm audit fix
```
Validate with `npm audit` afterward. If any remain, use `npm audit fix --force` for those packages only.

---

#### H3: Cookie `secure` Flag Inconsistency on OAuth Callback
Line 373 of `server/routes/auth-routes.ts` sets a cookie with `secure: process.env.NODE_ENV === 'production'` (missing the Replit dev domain check) while all other auth cookies correctly use `secure: process.env.NODE_ENV === 'production' || !!process.env.REPLIT_DEV_DOMAIN`. This means the OAuth callback cookie is NOT secure on the Replit preview domain.

**Fix** (`server/routes/auth-routes.ts:373`):
```typescript
// Before
secure: process.env.NODE_ENV === 'production',
// After
secure: process.env.NODE_ENV === 'production' || !!process.env.REPLIT_DEV_DOMAIN,
```

---

### 🟡 MEDIUM — Fix Before Institutional Client Onboarding

#### M1: PII Sent to Third-Party AI (GDPR / Data Processing Risk)
`server/routes/crm-relationship-intelligence-routes.ts:583` sends `EMAIL`, `FIRST-NAME`, `LAST-NAME`, `PHONE-NUMBER` fields directly to the Anthropic API without documented data minimization.

**Fix:**
1. Add a server-side scrubbing layer that replaces identifying fields with pseudonymous tokens before sending to AI APIs.
2. Ensure Anthropic DPA (Data Processing Agreement) is signed and listed in your privacy policy.
3. Add a user-visible disclosure: "Contact intelligence features use AI. Data is processed per our Privacy Policy."

---

#### M2: IP Addresses in Production Logs (GDPR Concern)
HoundDog flagged IP address logging in 14 middleware files (CSRF, rate-limiting, file-upload-security, tenant-isolation, webhook-security). Under GDPR, IP addresses are personal data.

**Fix:** Hash IPs before logging in production:
```typescript
function maskIp(ip: string): string {
  if (process.env.NODE_ENV !== 'production') return ip;
  const crypto = require('crypto');
  return 'ip:' + crypto.createHash('sha256').update(ip + process.env.IP_SALT || '').digest('hex').substring(0, 16);
}
```
Apply to all `logger.*({ ip: req.ip })` calls via a middleware transform.

---

#### M3: Financial Data Printed to stdout
`server/services/doc-intel-service.ts` lines 2293, 2296, 2354, 2358, 3358 print expense and payroll data to standard output. In production, stdout is captured by log aggregators where financial data should not appear unredacted.

**Fix:** Replace `console.log` with structured logger calls with a `[SENSITIVE]` flag, and configure your log aggregator to mask or drop those lines.

---

#### M4: `ddChecklistRouter` Mounted Outside Auth Guard
In `server/index.ts:145`, `app.use(ddChecklistRouter)` is called **outside** the async `registerRoutes()` block, meaning it is mounted **before** the global `authenticateUser` middleware at line 138.

**Fix:** Move `ddChecklistRouter` inside the async block, after `app.use(authenticateUser)`:
```typescript
// server/index.ts — inside the async block, after authenticateUser
app.use(authenticateUser);
app.use('/api/settings', settingsRoutes);
app.use(ddChecklistRouter);  // ← move here
```

---

### 🔵 LOW — Institutional-Grade Polish

#### L1: No `Permissions-Policy` Header
Modern browsers support fine-grained feature policy. Add to Helmet configuration:
```typescript
helmet({
  permissionsPolicy: {
    features: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: ['self'],
    },
  },
})
```

#### L2: `sameSite` Inconsistency
Most auth cookies use `sameSite: 'lax'`. One uses `'strict'`. Standardize to `'strict'` unless you need cross-site cookie delivery (e.g., embedded iframes), which you do not.

#### L3: Content-Security-Policy in Dev Uses `'unsafe-inline'`
Production CSP is strict; dev is permissive. Add a staging environment that runs with production-equivalent CSP so violations are caught before deploy.

#### L4: Password Reset Tokens in URL Query Strings
Tokens in URLs appear in server logs, browser history, and Referer headers. Consider replacing with short-lived PKCE-style codes that are single-use and stored server-side, returning only a session after validation.

#### L5: No `Subresource Integrity (SRI)` on External Scripts
If any `<script src="...">` or `<link>` tags reference external CDNs, add `integrity` and `crossorigin` attributes.

---

## Dependency Vulnerability Summary

| Severity | Count | Action |
|----------|-------|--------|
| Critical | 2 | `npm audit fix` |
| High | 49 | `npm audit fix` |
| Moderate | 34 | `npm audit fix` (best effort) |
| Low | 13 | Monitor |

Primary CVE: **CVE-2025-27789** — Babel ReDoS in named capturing group polyfill. Fixed in `@babel/*` ≥ 7.26.10.

---

## HoundDog Privacy Findings Summary

| Severity | Count | Category |
|----------|-------|----------|
| Medium | 21 | IP addresses in logs (14), PII to AI (1), financial data in stdout (6) |
| Low | 11 | Minor data exposure patterns |

---

---

# Replication Prompt

> Copy and paste the block below into any new Replit app to enforce the same security posture from day one.

---

```
You are building a production-grade, multi-tenant SaaS application. Apply all of the following
security requirements throughout every layer of the stack. Do not skip or defer any item.

══════════════════════════════════════════════════════════
AUTHENTICATION & SESSION MANAGEMENT
══════════════════════════════════════════════════════════

1. Session tokens must be stored in cookies with:
   - httpOnly: true
   - secure: process.env.NODE_ENV === 'production' || !!process.env.REPLIT_DEV_DOMAIN
   - sameSite: 'strict'
   Apply this CONSISTENTLY on every single Set-Cookie call — no exceptions.

2. Implement CSRF protection using the double-submit cookie pattern:
   - Set a non-httpOnly CSRF cookie (JS must be able to read it to send the header)
   - Require the client to send an X-CSRF-Token header on every mutating request
   - Validate with crypto.timingSafeEqual — never use == or ===
   - Exempt: Stripe webhooks, health check, and any webhook route with its own HMAC signature

3. Implement brute-force protection on the login endpoint:
   - Block an IP after 10 consecutive failed attempts for 15 minutes
   - Send a "suspicious login" notification email to the user after 3 failed attempts
   - Rate-limit registration to 5 attempts per 60 minutes per IP

══════════════════════════════════════════════════════════
AUTHORIZATION & MULTI-TENANCY
══════════════════════════════════════════════════════════

4. All API routes must be protected by authenticateUser middleware BEFORE any route handler runs.
   Mount authenticateUser BEFORE calling registerRoutes() or at the very top of the route file.
   Never mount a route file before the auth middleware is in place.

5. Implement Role-Based Access Control (RBAC):
   - Define roles: owner_admin, admin, member, viewer, external_guest
   - Provide a requireRole(...allowedRoles) middleware
   - Apply it to every mutating route

6. Enforce multi-tenancy at every data access point:
   - Every authenticated user carries an orgId on req.user
   - Set PostgreSQL session variable: SET LOCAL app.current_tenant = '<orgId>' on every request
   - Every table with multi-tenant data has an org_id column
   - Use PostgreSQL Row-Level Security (RLS) policies: CREATE POLICY ... USING (org_id = current_setting('app.current_tenant'))
   - Provide a validateEntityOwnership(tableName, entityId, orgId) helper that does a database-level
     ownership check before returning any resource

══════════════════════════════════════════════════════════
RATE LIMITING
══════════════════════════════════════════════════════════

7. Apply tiered rate limits:
   - Global: 300 requests per 15 minutes per IP (express-rate-limit)
   - Auth (login): 20 requests per 15 minutes per IP
   - Auth (register): 5 requests per 60 minutes per IP
   - Sensitive mutations (password change, invite): 10 per hour per user
   Use Redis store for rate limit counters in production (in-memory is acceptable for dev).

══════════════════════════════════════════════════════════
INPUT VALIDATION
══════════════════════════════════════════════════════════

8. Use Zod for ALL request validation:
   - validateBody(schema) middleware on every POST/PUT/PATCH route
   - validateQuery(schema) middleware on every GET route with query params
   - validateParams(schema) middleware on routes with :id parameters
   - Never trust req.body, req.query, or req.params directly in a route handler

9. Never interpolate request data into SQL strings. Use only:
   - ORM query builders (Drizzle, Prisma, etc.) with parameterized queries
   - Raw SQL with bound parameters: db.execute(sql`SELECT * FROM t WHERE id = ${id}`)

══════════════════════════════════════════════════════════
SECURITY HEADERS
══════════════════════════════════════════════════════════

10. Use Helmet with the following explicit configuration:
    - hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
    - referrerPolicy: 'strict-origin-when-cross-origin'
    - contentSecurityPolicy: (see below)
    - frameguard: { action: 'deny' }
    - noSniff: true
    - xssFilter: true
    - permissionsPolicy: camera=(), microphone=(), geolocation=(), payment=(self)

11. CSP must:
    - default-src: 'self'
    - script-src: 'self' (no unsafe-inline in production, use nonces for inline scripts)
    - style-src: 'self' 'unsafe-inline' (only if CSS-in-JS requires it, otherwise nonce-based)
    - img-src: 'self' data: blob: https: (for user-uploaded images and remote assets)
    - connect-src: 'self' + explicit third-party API domains (no wildcards)
    - frame-src: 'none'
    - object-src: 'none'
    - base-uri: 'self'
    - upgrade-insecure-requests (in production)

══════════════════════════════════════════════════════════
XSS PREVENTION
══════════════════════════════════════════════════════════

12. Never use dangerouslySetInnerHTML without sanitization.
    Install dompurify (@types/dompurify for TypeScript).
    Every dangerouslySetInnerHTML call must be:
      <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(untrustedHtml) }} />
    This applies to: email previews, user-generated content, rich text editors,
    document builders, agreement bodies, and markdown rendered as HTML.

══════════════════════════════════════════════════════════
FILE UPLOADS
══════════════════════════════════════════════════════════

13. Validate every uploaded file:
    - Extension allowlist: .pdf .doc .docx .xls .xlsx .csv .jpg .jpeg .png .gif .webp .txt .ppt .pptx .zip
    - Extension blocklist: .exe .bat .cmd .sh .ps1 .msi .dll .js .ts .php .py .rb .com .scr .vbs
    - Magic number (binary header) validation — do not trust the Content-Type header alone
    - Double extension detection (e.g., "report.pdf.exe" is blocked)
    - Filename sanitization: strip path separators and control characters
    - Maximum size: 50 MB (configurable per route)
    - Generate SHA-256 hash of file content for audit trail

══════════════════════════════════════════════════════════
SECRETS & ENCRYPTION
══════════════════════════════════════════════════════════

14. No secrets in source code — ever. Use environment variables for:
    - Database connection strings
    - API keys (Stripe, OpenAI, SendGrid, Resend, etc.)
    - JWT / session secrets
    - Encryption keys

15. Encrypt sensitive fields at rest:
    - OAuth access tokens and refresh tokens: AES-256-CBC with a unique IV per record
    - Store as hex: iv:encryptedPayload
    - Encryption key must come from an environment variable, not be hardcoded

16. Passwords: bcrypt with minimum cost factor 12. Never store plaintext passwords.

17. Password reset tokens: crypto.randomBytes(32).toString('hex'), single-use, expire in 1 hour.

══════════════════════════════════════════════════════════
CORS
══════════════════════════════════════════════════════════

18. Maintain an explicit CORS allowlist. Never use origin: '*'.
    Log and reject unknown origins.
    For Replit-hosted apps, automatically permit .replit.dev, .replit.app, .repl.co origins.

══════════════════════════════════════════════════════════
AUDIT LOGGING
══════════════════════════════════════════════════════════

19. Log every security-relevant event with: userId, orgId, action, entityType, entityId, timestamp, ip (hashed in prod), result (success/failure).
    Events to log:
    - Login success / failure
    - Password reset request / completion
    - Role changes
    - Any CREATE / UPDATE / DELETE on sensitive entities (deals, documents, users, billing)
    - File uploads / downloads
    - Data exports
    - Admin actions

20. In production, hash or mask IP addresses before logging (GDPR compliance):
    const maskedIp = crypto.createHash('sha256').update(ip + process.env.IP_SALT).digest('hex').slice(0,16);

══════════════════════════════════════════════════════════
THIRD-PARTY AI / DATA PROCESSORS
══════════════════════════════════════════════════════════

21. Before sending any PII (name, email, phone, financial data) to a third-party AI API:
    - Confirm a Data Processing Agreement (DPA) is in place with the provider
    - Apply data minimization: replace identifying fields with pseudonymous tokens where possible
    - Disclose AI processing in your privacy policy

══════════════════════════════════════════════════════════
DEPENDENCIES
══════════════════════════════════════════════════════════

22. Run npm audit (or equivalent) as part of every CI/CD pipeline run.
    Block deployments that have critical or high severity vulnerabilities without a documented exception.
    Run npm audit fix regularly; never defer critical CVEs.

══════════════════════════════════════════════════════════
ERROR HANDLING
══════════════════════════════════════════════════════════

23. Never expose internal error details (stack traces, SQL errors, file paths) to API responses.
    Return generic messages to clients: { error: 'An error occurred. Please try again.' }
    Log the full error server-side with a correlation ID.
    Provide the correlation ID in the response so support can trace it: { error: '...', ref: 'err_abc123' }

══════════════════════════════════════════════════════════
WEBHOOK SECURITY
══════════════════════════════════════════════════════════

24. Validate every inbound webhook with the provider's HMAC signature:
    - Stripe: stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)
    - Other providers: equivalent HMAC-SHA256 comparison using crypto.timingSafeEqual
    - Always use raw request body (not parsed JSON) for HMAC computation
    - Exempt webhook routes from CSRF middleware

══════════════════════════════════════════════════════════
IMPLEMENTATION ORDER
══════════════════════════════════════════════════════════

Implement in this order:
1. Auth middleware (authenticate + RBAC)  ← foundation everything else depends on
2. Multi-tenancy isolation (orgId everywhere, RLS policies)
3. Rate limiting (global → auth → per-feature)
4. Input validation (Zod schemas on all routes)
5. Security headers (Helmet + CSP + Permissions-Policy)
6. CSRF protection
7. File upload validation
8. XSS prevention (DOMPurify on all dangerouslySetInnerHTML)
9. Audit logging
10. Dependency audit + remediation
11. Encryption at rest for sensitive fields
12. IP masking in logs
13. Error handling standardization
14. Webhook signature validation
```
