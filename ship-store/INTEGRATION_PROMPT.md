# Ship Store Integration Prompt for MarinaMatch Parent App

## Overview
This document contains the Replit Agent prompt and integration instructions for adding Ship Store (POS/Inventory Management) as an integrated component into the MarinaMatch parent application.

---

## REPLIT AGENT PROMPT

Copy and paste this prompt into your MarinaMatch Replit project:

```
I have a Ship Store POS/Inventory management system that needs to be integrated into this MarinaMatch application. I will upload the Ship Store codebase as a zip file.

INTEGRATION REQUIREMENTS:

1. UPLOAD SHIP STORE CODE:
   - Extract the Ship Store zip file into a subdirectory called `ship-store/` within this project
   - Keep Ship Store's dependencies separate in its own package.json
   - Preserve all Ship Store files including: server/, client/, shared/, and configuration files

2. ENVIRONMENT CONFIGURATION:
   Ship Store requires these environment variables (add to Replit Secrets):
   - JWT_SECRET: Shared secret for JWT token validation (same as parent app uses)
   - DATABASE_URL: PostgreSQL connection string (can share parent app's database or use separate one)
   - SESSION_SECRET: Express session secret
   - ALLOWED_ORIGINS: CORS allowed origins (e.g., "https://marinamatch.app,http://localhost:3000")
   - NODE_ENV: Set to "production" for production deployment

3. JWT TOKEN GENERATION:
   The parent app (MarinaMatch) must generate JWT tokens for authenticated users with this payload structure:
   ```
   {
     id: "user-stable-id",        // CRITICAL: Use stable user ID, NOT session ID
     email: "user@example.com",   // User email
     role: "manager" or "cashier" // Role determines permissions
   }
   ```
   
   Example token generation code:
   ```typescript
   import jwt from 'jsonwebtoken';
   
   function generateShipStoreToken(user: { id: string, email: string, role: string }) {
     return jwt.sign(
       {
         id: user.id,
         email: user.email,
         role: user.role
       },
       process.env.JWT_SECRET,
       { expiresIn: '24h' }
     );
   }
   ```

4. SHIP STORE API INTEGRATION:
   Ship Store exposes REST APIs at these base paths (run on separate port or reverse proxy):
   
   AUTHENTICATED ENDPOINTS (requires JWT token in Authorization header):
   - GET /api/products - List all products
   - POST /api/products - Create product (manager only)
   - PUT /api/products/:id - Update product (manager only)
   - DELETE /api/products/:id - Delete product (manager only)
   - GET /api/transactions - List transactions
   - POST /api/transactions - Create transaction
   - GET /api/audit-logs - View audit logs (manager only)
   - GET /api/export/* - Excel exports (manager only)
   
   PUBLIC ENDPOINTS (no auth):
   - GET /api/health - Health check
   - GET /api/health/ready - Readiness probe
   - GET /api/health/live - Liveness probe

5. PAYMENT INTEGRATION:
   Ship Store creates transactions with "pending" status. The parent app (MarinaMatch) handles:
   - Stripe/Square payment processing
   - Payment confirmation via webhook to Ship Store
   - QuickBooks sync
   
   After successful payment, parent app should call:
   POST /api/transactions/:id/payment-status
   Body: { status: "completed", paymentMethod: "stripe", paymentId: "pi_xxx" }

6. RUN BOTH APPS:
   Configure workflows to run both MarinaMatch and Ship Store:
   - MarinaMatch: Port 3000 (or your existing port)
   - Ship Store: Port 5000 (configured in ship-store/server/index.ts)
   
   Set up reverse proxy or API gateway to route requests:
   - /ship-store/* → Ship Store (port 5000)
   - /* → MarinaMatch (port 3000)

7. DATABASE SETUP:
   Ship Store uses these database tables (will auto-create if using shared database):
   - products, categories, transactions, audit_logs, pro_forma_scenarios, etc.
   
   Run Ship Store's database migrations:
   ```
   cd ship-store
   npm run db:push
   ```

8. FRONTEND INTEGRATION OPTIONS:
   
   Option A - Iframe Embed (Quick):
   ```tsx
   <iframe 
     src="http://localhost:5000" 
     width="100%" 
     height="800px"
     style={{ border: 'none' }}
   />
   ```
   
   Option B - API Integration (Recommended):
   Build custom UI in parent app that calls Ship Store REST APIs with JWT tokens.
   
   Option C - Copy Components:
   Copy Ship Store's React components into parent app and call APIs directly.

9. TESTING:
   After integration:
   - Verify JWT tokens work: curl -H "Authorization: Bearer <TOKEN>" http://localhost:5000/api/products
   - Check health endpoint: curl http://localhost:5000/api/health
   - Test RBAC: Manager can create products, cashier cannot
   - Verify audit trail captures user attribution from JWT tokens

10. SECURITY CHECKLIST:
    - [ ] JWT_SECRET is strong and shared between apps
    - [ ] CORS configured to allow parent app domain
    - [ ] Rate limiting enabled for API routes
    - [ ] Database credentials secured in Replit Secrets
    - [ ] User IDs in JWT tokens are stable (not session IDs)
    - [ ] HTTPS enabled for production deployment

Please:
1. Create a `ship-store/` directory
2. Help me extract the uploaded Ship Store zip file into that directory
3. Set up the required environment variables in Replit Secrets
4. Configure workflows to run both apps
5. Set up JWT token generation in the parent app using the format above
6. Configure reverse proxy routing (if needed)
7. Test the integration with the provided curl commands

Refer to ship-store/PRODUCTION_READINESS.md for complete API documentation and integration details.
```

---

## STEP-BY-STEP INTEGRATION GUIDE

### Step 1: Export Ship Store Code
In your current Ship Store Replit project:
1. Click the three dots menu (⋮) in the file explorer
2. Select "Download as zip"
3. Save the file (e.g., `ship-store.zip`)

### Step 2: Upload to Parent App
In your MarinaMatch Replit project:
1. Open the Shell tool
2. Run these commands:
   ```bash
   # Create ship-store directory
   mkdir -p ship-store
   
   # Upload the zip file using Replit's upload feature
   # (Click the three dots in file explorer → Upload file)
   # Upload to the root directory
   
   # Extract to ship-store directory
   unzip ship-store.zip -d ship-store/
   
   # Or if zip uploaded as different name:
   unzip <filename>.zip -d ship-store/
   
   # Clean up
   rm ship-store.zip
   ```

### Step 3: Share Environment Variables
In MarinaMatch Replit Secrets, add:
```
JWT_SECRET=<same-secret-used-by-parent-app>
```

Ship Store will automatically use the parent app's DATABASE_URL if available.

### Step 4: Configure Workflows
The parent app should run both applications:
```yaml
# MarinaMatch workflow
name: Start MarinaMatch
command: npm run dev

# Ship Store workflow  
name: Start Ship Store
command: cd ship-store && npm run dev
```

### Step 5: Test Integration
Use the test commands from the Replit Agent prompt above to verify JWT authentication and API access.

---

## ALTERNATIVE: MONOREPO APPROACH

If you prefer a monorepo structure instead of zip upload:

```
I want to integrate Ship Store POS system into this MarinaMatch application as a monorepo.

REQUIREMENTS:
1. Create a monorepo structure:
   - apps/marinamatch/ (parent app)
   - apps/ship-store/ (POS system)
   - packages/shared/ (shared types/utilities)

2. Move existing MarinaMatch code into apps/marinamatch/
3. I will provide Ship Store codebase to be placed in apps/ship-store/
4. Set up workspace dependencies using npm workspaces or yarn workspaces
5. Configure both apps to run concurrently
6. Share JWT_SECRET environment variable between apps
7. Set up API proxy to route /api/ship-store/* to Ship Store service

Please help set up this monorepo structure and prepare for Ship Store integration.
```

---

## QUICK REFERENCE

**Ship Store Runs On:** Port 5000  
**Required Secrets:** JWT_SECRET, DATABASE_URL, SESSION_SECRET  
**JWT Payload:** `{ id, email, role }`  
**Manager Role:** Full access (CRUD + exports + audit logs)  
**Cashier Role:** Read + transact only (no modifications)  
**Health Check:** GET /api/health  
**Documentation:** ship-store/PRODUCTION_READINESS.md  

---

## SUPPORT

For detailed API documentation, RBAC matrix, and troubleshooting:
- Read `ship-store/PRODUCTION_READINESS.md`
- Check `ship-store/server/routes.ts` for all available endpoints
- Review `ship-store/server/middleware/auth.ts` for JWT validation logic
- Test tokens: Run `npx tsx ship-store/server/scripts/generate-test-tokens.ts`
