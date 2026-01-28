# MarinaMatch Security Architecture & Threat Model

## Executive Summary

MarinaMatch is a marina real estate investment platform handling sensitive financial documents (P&Ls, rent rolls), customer/tenant data, and third-party integrations (QuickBooks). This document outlines the security architecture designed for SOC2-ready compliance.

---

## 1. Assets Inventory

### Critical Assets
| Asset | Classification | Location | Owner |
|-------|---------------|----------|-------|
| Financial Documents (P&Ls, Rent Rolls) | Confidential | Object Storage / Local FS | Tenant |
| Customer/Tenant PII | Sensitive | PostgreSQL | Tenant |
| QuickBooks OAuth Tokens | Secret | PostgreSQL (encrypted) | System |
| User Credentials/Sessions | Secret | PostgreSQL / Redis | System |
| Valuation Models | Proprietary | PostgreSQL | Tenant |
| Audit Logs | Compliance | PostgreSQL (append-only) | System |

### Secondary Assets
- API Keys and secrets
- Application source code
- Infrastructure configurations
- Backup files

---

## 2. Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INTERNET (Untrusted)                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BOUNDARY 1: CDN/Edge (Cloudflare/Replit Proxy)                             │
│  - DDoS protection, WAF rules, TLS termination                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BOUNDARY 2: Application Layer                                               │
│  ┌────────────────────┐    ┌────────────────────┐                           │
│  │   React Frontend   │───▶│   Express Backend  │                           │
│  │   (Browser/Mobile) │    │   (API Server)     │                           │
│  └────────────────────┘    └────────────────────┘                           │
│                                       │                                      │
│  Security Controls:                   │                                      │
│  - CSP, XSS protection               - Rate limiting                        │
│  - CSRF tokens                       - Input validation (Zod)               │
│  - Secure cookie handling            - AuthN/AuthZ middleware               │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BOUNDARY 3: Data Layer                                                      │
│  ┌────────────────────┐    ┌────────────────────┐                           │
│  │   PostgreSQL/Neon  │    │   Object Storage   │                           │
│  │   (RLS Enabled)    │    │   (Private Bucket) │                           │
│  └────────────────────┘    └────────────────────┘                           │
│                                                                              │
│  Security Controls:                                                          │
│  - Row Level Security (tenant isolation)                                    │
│  - Encrypted columns (tokens, secrets)                                      │
│  - Presigned URLs with short TTL                                            │
│  - No public file access                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BOUNDARY 4: External Integrations                                           │
│  ┌────────────────────┐    ┌────────────────────┐                           │
│  │   QuickBooks API   │    │   Future: Marina   │                           │
│  │   (OAuth 2.0)      │    │   Management SW    │                           │
│  └────────────────────┘    └────────────────────┘                           │
│                                                                              │
│  Security Controls:                                                          │
│  - PKCE for OAuth                                                           │
│  - Encrypted token storage                                                  │
│  - Webhook signature verification                                           │
│  - Scope minimization                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Top Attack Vectors & Mitigations

### 3.1 Broken Access Control (OWASP #1)

**Threat:** User A accesses User B's tenant data by manipulating IDs or API calls.

**Attack Scenarios:**
- IDOR: `GET /api/documents/123` where 123 belongs to another tenant
- Parameter tampering: Changing `org_id` in request body
- Privilege escalation: Modifying role claims

**Mitigations:**
1. **Row Level Security (RLS)** - Database-enforced tenant isolation
2. **Tenant Context Middleware** - Validates and injects `org_id` from session
3. **RBAC/ABAC Layer** - Permission checks on every route
4. **No client-controlled tenant IDs** - Server derives from session

### 3.2 Injection Attacks (OWASP #3)

**Threat:** SQL injection, NoSQL injection, command injection via user input.

**Mitigations:**
1. **Drizzle ORM** - Parameterized queries by default
2. **Zod Validation** - Strict input schemas on all endpoints
3. **No dynamic query construction** - Reject unknown fields
4. **Content-Type enforcement** - Reject unexpected formats

### 3.3 Broken Authentication (OWASP #7)

**Threat:** Session hijacking, credential stuffing, token theft.

**Attack Scenarios:**
- XSS stealing session cookies
- CSRF forcing authenticated actions
- Token replay attacks

**Mitigations:**
1. **HttpOnly, Secure, SameSite cookies** - Prevent XSS token theft
2. **CSRF tokens** - Double-submit pattern
3. **Session rotation** - New session ID on privilege change
4. **Rate limiting** - Prevent brute force on auth routes

### 3.4 Security Misconfiguration (OWASP #5)

**Threat:** Default credentials, verbose errors, missing security headers.

**Mitigations:**
1. **Helmet.js** - Security headers (CSP, HSTS, X-Frame-Options)
2. **Structured error handling** - No stack traces in production
3. **Environment validation** - Required secrets checked at startup
4. **CORS strictness** - Explicit origin allowlist

### 3.5 Sensitive Data Exposure

**Threat:** PII/financial data leaked via logs, APIs, or storage.

**Attack Scenarios:**
- API returning full SSN in response
- Logs containing credit card numbers
- Database dumps exposed

**Mitigations:**
1. **Field masking** - Automatic PII masking in logs/responses
2. **Column encryption** - AES-256-GCM for tokens/secrets
3. **Audit logging** - Track all data access
4. **Data minimization** - Don't store what you don't need

### 3.6 Insecure File Upload

**Threat:** Malware upload, path traversal, storage exhaustion.

**Attack Scenarios:**
- Upload PHP/JS file disguised as PDF
- `../../../etc/passwd` in filename
- 10GB file upload DoS

**Mitigations:**
1. **MIME type validation** - Magic bytes, not just extension
2. **Size limits** - Per-file and per-tenant quotas
3. **Filename sanitization** - UUID-based storage names
4. **Quarantine workflow** - Manual review for scanning gaps
5. **Private storage** - No direct public URLs

### 3.7 Third-Party Integration Risks

**Threat:** OAuth token theft, malicious webhooks, over-permissioned scopes.

**Mitigations:**
1. **PKCE** - Prevent authorization code interception
2. **State parameter** - Prevent CSRF in OAuth flow
3. **Token encryption** - At-rest encryption for refresh tokens
4. **Webhook signatures** - Verify origin authenticity
5. **Scope minimization** - Request only needed permissions

---

## 4. Security Architecture Diagram (Text)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           REQUEST FLOW (Happy Path)                              │
└─────────────────────────────────────────────────────────────────────────────────┘

[User Browser]
      │
      ▼
┌───────────────┐
│  React App    │ ◄─── CSP, XSS protection, CSRF token in forms
│  (Frontend)   │      No API keys in client code
└───────────────┘
      │ HTTPS + Cookies + CSRF Token
      ▼
┌───────────────┐
│  Rate Limiter │ ◄─── express-rate-limit (100/15min general, 5/min auth)
└───────────────┘
      │
      ▼
┌───────────────┐
│  Helmet       │ ◄─── Security headers (CSP, HSTS, X-Frame-Options)
└───────────────┘
      │
      ▼
┌───────────────┐
│  CORS         │ ◄─── Strict origin allowlist
└───────────────┘
      │
      ▼
┌───────────────┐
│  Session/Auth │ ◄─── Validate session cookie, extract user_id, org_id
│  Middleware   │      Set res.locals.tenantContext
└───────────────┘
      │
      ▼
┌───────────────┐
│  CSRF Check   │ ◄─── Validate CSRF token for state-changing requests
└───────────────┘
      │
      ▼
┌───────────────┐
│  Zod          │ ◄─── Strict request validation, reject unknowns
│  Validation   │
└───────────────┘
      │
      ▼
┌───────────────┐
│  RBAC/ABAC    │ ◄─── Check permissions: user.can('documents:upload')
│  Authorization│      Resource-level: canAccessDocument(docId)
└───────────────┘
      │
      ▼
┌───────────────┐
│  Route        │ ◄─── Business logic
│  Handler      │
└───────────────┘
      │
      ▼
┌───────────────────────────────────────────────────────────────────┐
│                    DATA ACCESS LAYER                               │
│  ┌─────────────────┐    ┌──────────────────┐                      │
│  │  Drizzle ORM    │    │  File Service    │                      │
│  │  + Tenant Scope │    │  + Presigned URL │                      │
│  └─────────────────┘    └──────────────────┘                      │
│           │                      │                                 │
│           ▼                      ▼                                 │
│  ┌─────────────────┐    ┌──────────────────┐                      │
│  │  PostgreSQL     │    │  Object Storage  │                      │
│  │  (RLS Enabled)  │    │  (S3/Local)      │                      │
│  └─────────────────┘    └──────────────────┘                      │
└───────────────────────────────────────────────────────────────────┘
      │
      ▼
┌───────────────┐
│  Audit Logger │ ◄─── Append-only, hash-chained entries
└───────────────┘


┌─────────────────────────────────────────────────────────────────────────────────┐
│                          OAUTH INTEGRATION FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

[User] ──▶ [Click "Connect QuickBooks"]
              │
              ▼
         [Generate state + PKCE verifier]
         [Store in session]
              │
              ▼
         [Redirect to QuickBooks /authorize]
         [With: client_id, redirect_uri, state, code_challenge]
              │
              ▼
         [User authenticates with QuickBooks]
              │
              ▼
         [QuickBooks redirects to /oauth/callback]
         [With: code, state, realmId]
              │
              ▼
         [Validate state matches session]
         [Exchange code for tokens with code_verifier]
              │
              ▼
         [Encrypt refresh_token]
         [Store encrypted token + realmId in DB]
         [Audit log: integration_connected]
              │
              ▼
         [Redirect to success page]
```

---

## 5. Implementation Priority Matrix

| Component | Risk Level | Effort | Priority |
|-----------|------------|--------|----------|
| Tenant Isolation (RLS) | Critical | Medium | P0 |
| AuthN/AuthZ Middleware | Critical | Medium | P0 |
| Input Validation (Zod) | High | Low | P0 |
| Secure File Upload | High | Medium | P1 |
| Token Encryption | High | Low | P1 |
| Audit Logging | Medium | Medium | P1 |
| Rate Limiting | Medium | Low | P1 |
| Security Headers | Medium | Low | P2 |
| CSRF Protection | Medium | Low | P2 |
| OAuth Security (PKCE) | Medium | Medium | P2 |

---

## 6. Compliance Mapping (SOC2)

| SOC2 Criteria | Implementation |
|---------------|----------------|
| CC6.1 - Logical Access | RBAC, tenant isolation, RLS |
| CC6.2 - Authentication | Session security, MFA-ready |
| CC6.3 - Access Removal | Session invalidation, token revocation |
| CC6.6 - System Boundaries | Trust boundaries, network segmentation |
| CC6.7 - Data Transmission | TLS everywhere, encrypted tokens |
| CC7.1 - Configuration | Helmet, env validation, no defaults |
| CC7.2 - Change Management | Audit logging, version tracking |

---

## 7. Residual Risks & Accepted Limitations

1. **Virus Scanning**: Without ClamAV integration, we implement quarantine + manual review
2. **MFA**: Scaffolding only; full implementation deferred
3. **Backup Encryption**: Relies on Neon's at-rest encryption
4. **DDoS**: Relies on Replit/Cloudflare edge protection

---

## 8. Next Steps

1. Review and approve threat model
2. Apply database migrations (RLS policies)
3. Integrate security middleware
4. Update all routes to use validators
5. Deploy and run security tests
6. Schedule penetration testing
