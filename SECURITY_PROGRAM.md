# MarinaMaatch — Top-Level Security Program
## Claude Code Implementation Prompt

Paste the contents of this file directly into Claude Code (claude.ai/code) or run it via the shell.

---

## CONTEXT

This is a full-stack TypeScript app: React (Vite) frontend + Express backend + PostgreSQL (Neon serverless).

- Auth: Passport.js with local, SAML 2.0, and OpenID Connect strategies
- Session: Redis or connect-pg-simple
- Multi-tenant: org-scoped data access via tenant isolation middleware
- Existing security files: `server/middleware/security.ts`, `server/middleware/rate-limiting.ts`, `server/middleware/csrf.ts`, `server/middleware/rbac.ts`, `server/middleware/tenant-isolation.ts`, `server/middleware/enhanced-security-headers.ts`, `server/middleware/api-key-auth.ts`, `server/middleware/input-validation.ts`

Do NOT break existing functionality. Audit, harden, and extend what exists. Do not rewrite from scratch.

---

## SECURITY PROGRAM — IMPLEMENTATION TASKS

### 1. AUTHENTICATION HARDENING

**Goal:** Ensure no route or page is accessible without a valid, authenticated session.

- Audit every Express route in `server/routes.ts` and all files under `server/routes/`. Flag any route that lacks an `isAuthenticated` or equivalent middleware check.
- Wrap all non-public API routes with the existing auth middleware. The only public routes allowed are: login, logout, SAML/OIDC callback endpoints, health check (`/health`), and any explicitly designated public pages.
- Ensure session cookies are set with: `httpOnly: true`, `secure: true` (in production), `sameSite: 'strict'`, and a `maxAge` no longer than 8 hours.
- Add a server-side session invalidation endpoint (`POST /api/auth/logout`) that destroys the session and clears the cookie.
- On the frontend (`client/src/`), add a global auth guard: if a request to any protected API returns 401, automatically redirect to the login page. Use the existing TanStack React Query error handling to do this.

### 2. RATE LIMITING — AUDIT AND EXTEND

**Goal:** Prevent brute-force, scraping, and abuse.

- Audit `server/middleware/rate-limiting.ts`. Ensure rate limiting is applied globally to all routes via `server/index.ts`, not just selectively.
- Apply a strict rate limit to all authentication endpoints (`/api/auth/*`, `/api/login`, SAML/OIDC routes): max 10 requests per 15-minute window per IP.
- Apply a moderate rate limit to all other API routes: max 100 requests per minute per authenticated user (keyed on session/user ID, not just IP).
- Add an exponential backoff response: after 5 failed login attempts from the same IP, block that IP for 30 minutes and return `429 Too Many Requests`.
- Log all rate-limit events (IP, endpoint, timestamp) to the existing logging middleware.

### 3. CONTENT SECURITY POLICY (CSP) AND SECURITY HEADERS

**Goal:** Prevent XSS, clickjacking, and data injection attacks.

- Audit `server/middleware/enhanced-security-headers.ts`. Ensure it is mounted early in `server/index.ts` before any route handlers.
- Enforce a strict CSP header. Allowed sources:
  - `default-src 'self'`
  - `script-src 'self'` (no `unsafe-inline`, no `unsafe-eval`)
  - `style-src 'self' 'unsafe-inline'` (required for Tailwind/shadcn)
  - `img-src 'self' data: blob: https:`
  - `connect-src 'self'` plus any external API domains actually used (Neon, SendGrid, Stripe, OpenAI endpoints)
  - `frame-ancestors 'none'` — prevents the app from being embedded in iframes
  - `form-action 'self'`
- Ensure these headers are set:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- Add `X-Robots-Tag: noindex, nofollow` to prevent search engine indexing of the app.

### 4. TENANT ISOLATION — AUDIT AND HARDEN

**Goal:** Ensure no user can access another organization's data.

- Audit `server/middleware/tenant-isolation.ts`. Every database query in `server/routes/` and `server/services/` that touches org-scoped tables must include the tenant's `orgId` as a filter. No query should return cross-tenant data.
- Add an automated test (`server/__tests__/tenant-isolation.test.ts`) that attempts to access another org's records using a valid session from a different org. The test must return 403 or empty results — never the other org's data.
- Ensure the tenant context is set at the start of every request and cleared at the end. Do not allow tenant context to leak between requests.

### 5. INPUT VALIDATION AND SANITIZATION

**Goal:** Prevent SQL injection, XSS via stored data, and malformed input attacks.

- Audit `server/middleware/input-validation.ts`. Ensure every POST, PUT, and PATCH route validates its request body using a Zod schema before passing data to the storage layer.
- All string inputs that are stored and later rendered in the frontend must be sanitized server-side. Use `DOMPurify` on the server (via `isomorphic-dompurify`) or ensure Zod schemas reject HTML/script tags in free-text fields.
- File upload routes (`server/middleware/file-upload-security.ts`, `server/security/file-upload-security.ts`) must enforce: allowed MIME types whitelist, max file size (10MB default), and scan filenames for path traversal characters (`../`, `..\\`).
- Reject any request body that exceeds 1MB in size for non-file-upload endpoints. Set `express.json({ limit: '1mb' })`.

### 6. API KEY AND SECRET PROTECTION

**Goal:** Ensure no secrets are exposed in the frontend bundle or logs.

- Scan all files under `client/src/` for any hardcoded API keys, secrets, or tokens. If found, move them to environment variables on the backend and expose only what is strictly necessary via a backend proxy endpoint.
- Audit `server/middleware/api-key-auth.ts`. Ensure all third-party API keys (OpenAI, SendGrid, Stripe, etc.) are loaded exclusively from `process.env` and never logged.
- Add a startup check in `server/index.ts` that verifies all required environment variables are present. If any are missing, log a clear error and exit. Do not start the server with missing secrets.
- Ensure the `dist/` build output does not contain any `.env` files or secret references. Add `.env*` to `.gitignore` if not already present.

### 7. CSRF PROTECTION

**Goal:** Prevent cross-site request forgery on state-changing endpoints.

- Audit `server/middleware/csrf.ts`. Ensure CSRF tokens are required on all state-changing routes (POST, PUT, PATCH, DELETE) for browser-based sessions.
- Exempt API key-authenticated routes (machine-to-machine) from CSRF if they use Bearer token auth instead of cookies.
- On the frontend, ensure the CSRF token is read from the cookie and sent as a header (`X-CSRF-Token`) on every mutation. This should be wired into the existing `apiRequest` utility in `client/src/lib/queryClient.ts`.

### 8. RBAC (ROLE-BASED ACCESS CONTROL) — AUDIT

**Goal:** Users can only perform actions their role permits.

- Audit `server/middleware/rbac.ts`. Ensure every sensitive route checks both authentication (is the user logged in?) and authorization (does the user's role allow this action?).
- Roles to enforce: `admin`, `manager`, `viewer` (or whatever roles are defined in the schema). Viewers must not be able to POST, PUT, PATCH, or DELETE anything.
- Add server-side role checks — do not rely solely on frontend UI hiding to enforce access control.

### 9. LOGGING AND AUDIT TRAIL

**Goal:** All sensitive actions are logged for forensic purposes.

- Audit `server/middleware/logging.ts`. Ensure it logs: timestamp, user ID, org ID, HTTP method, route, response status code, and duration for every request.
- Never log: passwords, session tokens, API keys, or full request bodies containing PII.
- Add an audit log for these specific events: login success, login failure, logout, password change, user invited/removed, data export, file upload/download, role change.
- Audit logs must be written to a separate table (`audit_logs`) in PostgreSQL, not just to console/file. Define the schema in `shared/schema.ts` if it does not exist.

### 10. DEPENDENCY AND BUILD SECURITY

**Goal:** No known vulnerable dependencies ship to production.

- Run `npm audit` and fix all critical and high severity vulnerabilities. If a fix is not available, document the risk in a `SECURITY_NOTES.md` file.
- Ensure `package-lock.json` is committed and up to date (do not use `--legacy-peer-deps` to mask problems).
- In `vite.config.ts`, ensure the production build does NOT include source maps (`sourcemap: false` for production). Source maps expose your full source code to anyone with DevTools.
- Ensure `NODE_ENV=production` is set in the production environment. Several security features (secure cookies, error detail suppression) depend on this.

### 11. ERROR HANDLING — NEVER LEAK INTERNALS

**Goal:** Errors shown to users do not expose stack traces, database details, or internal paths.

- Audit `server/middleware/error-handler.ts`. In production (`NODE_ENV === 'production'`), all 500 errors must return a generic message: `{ error: "Internal server error" }`. Stack traces and database error messages must only appear in server logs, never in API responses.
- Ensure 404 responses do not reveal whether a resource exists but is forbidden vs. simply not found. For sensitive resources, return 404 even when the real answer is 403.

### 12. WEBHOOK SECURITY

**Goal:** Inbound webhooks (Stripe, DocuSign, etc.) are verified before processing.

- Audit `server/middleware/webhook-security.ts` and `server/webhook-security.ts`. Every inbound webhook endpoint must verify the request signature using the vendor's provided secret before processing the payload.
- Stripe webhooks: verify using `stripe.webhooks.constructEvent()` with the `STRIPE_WEBHOOK_SECRET` env var.
- Any other vendor webhooks: verify HMAC signature using `crypto.timingSafeEqual()`.
- Reject any webhook with an invalid or missing signature with `400 Bad Request`. Log the rejection.

---

## ACCEPTANCE CRITERIA

Before marking this security program complete, verify:

- [ ] Running `npm audit` returns zero critical or high vulnerabilities
- [ ] All API routes return 401 when called without a valid session
- [ ] Attempting cross-tenant data access returns 403 or empty
- [ ] All auth endpoints are rate-limited (verify with a load test or manual test)
- [ ] CSP and security headers are present on every response (verify with curl or browser DevTools)
- [ ] No secrets or API keys appear in the Vite production bundle (inspect `dist/assets/`)
- [ ] Audit log table exists and records login/logout/role-change events
- [ ] Webhook signature verification rejects tampered payloads
- [ ] Production error responses contain no stack traces or internal details

---

## HOW TO RUN THIS WITH CLAUDE CODE

1. Open your terminal in the project root.
2. Start Claude Code: `claude`
3. Paste or reference this file: `Read SECURITY_PROGRAM.md and implement all tasks in order. Work through each numbered section completely before moving to the next. Run npm run check after each section to ensure no TypeScript errors.`
