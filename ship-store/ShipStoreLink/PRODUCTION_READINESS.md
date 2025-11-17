# Ship Store - Production Readiness Documentation

## Overview
Ship Store is a production-ready component application designed to integrate into larger parent applications. This document outlines the production-ready features, integration points, and operational procedures.

## Architecture

### Integration Pattern
Ship Store functions as a **component service** that:
- Exposes REST APIs for parent app integration
- Can be embedded as a micro-frontend
- Maintains its own database schema with clear ownership boundaries
- Delegates authentication to parent app via JWT tokens

### Component Responsibilities
**Ship Store Owns:**
- POS operations and transaction management
- Inventory management and stock tracking
- Audit trail and compliance logging
- Dashboard metrics and reporting
- Transaction history

**Parent App Owns:**
- Payment processing (Stripe, Square, etc.)
- QuickBooks Online integration
- User authentication and session management
- Financial ledger and accounting
- User provisioning

---

## Security Features

### 1. Authentication Middleware
- **JWT Validation**: Validates tokens issued by parent application
- **Token Format**: Bearer tokens in Authorization header
- **Shared Secret**: Uses `JWT_SECRET` environment variable for token verification
- **Role-Based Access Control**: Supports cashier, manager, and admin roles

### 2. Security Headers (Helmet)
- Content Security Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security
- X-XSS-Protection

### 3. CORS Configuration
- Configurable allowed origins via `ALLOWED_ORIGINS` environment variable
- Credentials support for cookie-based sessions
- Pre-flight request handling

### 4. Rate Limiting
- **API Routes**: 100 requests per 15 minutes per IP
- **Auth/Audit Routes**: 20 requests per 15 minutes per IP
- **Trust Proxy**: Configured for deployment behind reverse proxies

### 5. Input Validation
- Zod schema validation on all API endpoints
- Request body size limits (10MB)
- SQL injection protection via Drizzle ORM
- XSS prevention via parameterized queries

---

## Monitoring & Observability

### 1. Structured Logging (Winston)
**Log Levels:**
- `error`: Critical errors requiring immediate attention
- `warn`: Warning conditions that should be investigated
- `info`: Informational messages about system state
- `debug`: Detailed debugging information (development only)

**Log Format:**
```json
{
  "timestamp": "2025-11-17T19:15:03.290Z",
  "level": "info",
  "message": "Ship Store started successfully",
  "service": "ship-store",
  "port": 5000,
  "environment": "development"
}
```

**Log Storage:**
- Development: Console output
- Production: `logs/error.log` and `logs/combined.log`
- Rotation: 5 files x 5MB each

### 2. Health Endpoints

#### `/api/health` - Comprehensive Health Check
Returns detailed system health status:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-17T19:15:00.000Z",
  "uptime": 123.45,
  "environment": "production",
  "version": "1.0.0",
  "checks": {
    "database": "healthy",
    "memory": "healthy"
  }
}
```

**Status Codes:**
- `200 OK`: System healthy
- `503 Service Unavailable`: Critical system down

#### `/api/health/ready` - Readiness Probe
Used by load balancers to determine if app is ready for traffic.

#### `/api/health/live` - Liveness Probe
Used by orchestrators to determine if app should be restarted.

### 3. Request Logging (Morgan)
HTTP request logging in development mode with timing information.

---

## Database Optimization

### Performance Indexes
All high-volume queries have optimized indexes:

**Transactions Table:**
- `idx_transactions_created_at`: Time-based queries
- `idx_transactions_status`: Status filtering
- `idx_transactions_payment_method`: Payment type grouping
- `idx_transactions_status_created`: Composite for common queries

**Audit Logs Table:**
- `idx_audit_logs_entity_type`: Entity filtering
- `idx_audit_logs_action`: Action filtering
- `idx_audit_logs_created_at`: Time-range queries
- `idx_audit_logs_entity_action`: Composite for compliance queries

**Products Table:**
- `idx_products_sku`: SKU lookups
- `idx_products_category_id`: Category filtering

### Database Safety
- Connection pooling via Drizzle ORM
- Parameterized queries prevent SQL injection
- Transaction support for data consistency
- Automatic reconnection on connection loss

---

## Environment Configuration

### Required Environment Variables

```bash
# Core Configuration
NODE_ENV=production                    # development | production | test
PORT=5000                             # Server port
DATABASE_URL=postgresql://...         # PostgreSQL connection string
SESSION_SECRET=<random-secret>        # Session encryption key

# JWT Authentication (CRITICAL - for parent app integration)
JWT_SECRET=<shared-secret>           # JWT token verification key
                                      # MUST match parent app JWT signing key
                                      # Application will FAIL TO START in production without this

# CORS Configuration
ALLOWED_ORIGINS=https://parent.app.com,https://api.parent.app.com

# Optional: Stripe (if handling payments directly)
STRIPE_SECRET_KEY=sk_...
VITE_STRIPE_PUBLIC_KEY=pk_...
```

### Environment Validation
The application validates all required environment variables on startup and fails fast with clear error messages if any are missing.

**CRITICAL SECURITY REQUIREMENTS:**

1. **JWT_SECRET (Production)**:
   - **MANDATORY in production** - application will FAIL TO START without it
   - Must be shared with parent application (identical secret for token verification)
   - No fallback or default values allowed in production
   - Validated on every startup with fail-fast behavior

2. **DEVELOPMENT_JWT_SECRET (Development Only)**:
   - Explicit override for local development and testing
   - **Cannot be used in production** - application will FAIL TO START if attempted
   - Only allowed when NODE_ENV is "development" or "test"
   - Clear warning logged when in use

3. **NODE_ENV Validation**:
   - Strict validation - only accepts "development", "production", or "test"
   - Application FAILS TO START with invalid NODE_ENV values
   - Prevents misconfiguration attacks (e.g., accidentally running production as "dev")

4. **Multi-Layer Security**:
   - Layer 1: Require explicit JWT secret (no hidden defaults)
   - Layer 2: Validate NODE_ENV is legitimate
   - Layer 3: Block DEVELOPMENT_JWT_SECRET in production
   - Layer 4: Log clear warnings about dev secrets
   
**This prevents:**
- Running production with weak/default secrets
- Misconfiguration bypassing security checks
- Accidental deployment with development credentials
- Token forgery attacks via predictable secrets

---

## Integration Points

### REST API Endpoints

#### Health & Monitoring
- `GET /api/health` - System health check
- `GET /api/health/ready` - Readiness probe
- `GET /api/health/live` - Liveness probe

#### Products & Inventory
- `GET /api/products` - List products
- `POST /api/products` - Create product (requires auth)
- `PUT /api/products/:id` - Update product (requires auth)
- `DELETE /api/products/:id` - Delete product (requires auth)
- `GET /api/categories` - List categories

#### Transactions
- `GET /api/transactions` - List transactions
- `POST /api/transactions` - Create transaction
- `GET /api/transactions/:id` - Get transaction details
- `GET /api/transactions/recent` - Recent transactions

#### Dashboard & Reports
- `GET /api/dashboard/metrics` - KPI metrics
- `GET /api/dashboard/sales-data/:days` - Sales chart data
- `GET /api/dashboard/top-categories` - Category breakdown
- `GET /api/export/transactions` - Excel export

#### Audit Trail
- `GET /api/audit-logs` - Query audit logs
  - Query params: `entityType`, `action`, `startDate`, `endDate`, `limit`

### Authentication Integration

**For Parent App Developers:**

1. **Generate JWT Token** (parent app):
```typescript
import jwt from 'jsonwebtoken';

const token = jwt.sign({
  id: user.id,            // REQUIRED: User ID for audit attribution
  email: user.email,      // REQUIRED: User email
  role: user.role,        // REQUIRED: 'cashier' or 'manager'
  permissions: user.permissions // OPTIONAL: Additional permissions
}, JWT_SECRET, {
  expiresIn: '24h'
});
```

**CRITICAL**: Token payload MUST include `id`, `email`, and `role`. Missing fields will cause authentication failures.

**Integration Requirements for Audit Trail Compliance:**

- **Stable User IDs**: The `id` field MUST be a stable, unique identifier that persists across user sessions. Using session IDs or temporary values will corrupt the audit trail.
- **IP Address Propagation**: If Ship Store is behind a reverse proxy, configure `trust proxy` settings so `req.ip` reflects the actual client IP, not the proxy IP.
- **User Agent Tracking**: Ensure user-agent headers are passed through from client to Ship Store for complete audit attribution.
- **Error Handling**: Parent app should handle 401 (re-authenticate) and 403 (permission denied) responses appropriately:
  - 401 → Refresh JWT token or re-authenticate user
  - 403 → Show permission denied UI or escalate to manager
  - Do NOT retry 403 errors automatically - they indicate permanent permission denial

2. **Include Token in Requests**:
```typescript
fetch('https://shipstore.app/api/products', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

3. **Handle Auth Errors**:
- `401 Unauthorized`: Token missing, expired, or invalid
- `403 Forbidden`: User lacks required role/permissions

### Role-Based Access Control (RBAC)

Ship Store enforces **two** primary roles: `manager` and `cashier`. There is no separate `admin` role.

**Manager Role** (`role: 'manager'`) - Full Access:
- ✅ All product operations: GET, POST, PUT, DELETE `/api/products/*`
- ✅ All category operations: GET, POST, PUT `/api/categories/*`
- ✅ All transaction operations: GET, POST `/api/transactions/*`
- ✅ Financial modeling: GET, POST, PUT, DELETE `/api/scenarios/*`, `/api/assumptions/*`, `/api/projections/*`
- ✅ Historical data: GET, POST `/api/historical-data/*`
- ✅ Audit logs: GET `/api/audit-logs`, GET `/api/audit-logs/:entityType/:entityId`
- ✅ Settings: GET, POST `/api/settings/*`
- ✅ Excel exports: GET `/api/export/projections/:scenarioId`, GET `/api/export/historical-data`, GET `/api/export/transactions`, POST `/api/export/scenario-comparison`
- ✅ Dashboard: GET `/api/dashboard/*`
- ✅ Pro forma calculations: POST `/api/calculate-proforma`

**Cashier Role** (`role: 'cashier'`) - Limited Access:
- ✅ Read products: GET `/api/products`, GET `/api/products/:id`, GET `/api/products/low-stock`
- ✅ Read categories: GET `/api/categories`, GET `/api/categories/:id`
- ✅ Create transactions: POST `/api/transactions`
- ✅ View transactions: GET `/api/transactions`, GET `/api/transactions/:id`, GET `/api/transactions/recent`
- ✅ Dashboard metrics: GET `/api/dashboard/*`
- ❌ Cannot modify products (POST/PUT/DELETE)
- ❌ Cannot modify categories (POST/PUT)
- ❌ Cannot access financial modeling, historical data, or pro forma calculations
- ❌ Cannot view audit logs (compliance/security restriction)
- ❌ Cannot export data (Excel exports)
- ❌ Cannot modify settings

**Manager-Only Endpoints** (403 Forbidden for cashiers):
```
POST   /api/products
PUT    /api/products/:id
DELETE /api/products/:id
POST   /api/categories
PUT    /api/categories/:id
GET    /api/scenarios/*
POST   /api/scenarios/*
PUT    /api/scenarios/*
DELETE /api/scenarios/*
GET    /api/assumptions/*
POST   /api/assumptions/*
PUT    /api/assumptions/*
GET    /api/projections/*
POST   /api/projections/*
DELETE /api/projections/*
GET    /api/historical-data/*
POST   /api/historical-data/*
GET    /api/audit-logs
GET    /api/audit-logs/:entityType/:entityId
GET    /api/settings/*
POST   /api/settings/*
POST   /api/calculate-proforma
GET    /api/export/*
POST   /api/export/*
```

**Authenticated Endpoints** (any valid role):
```
GET    /api/products
GET    /api/products/:id
GET    /api/products/low-stock
GET    /api/categories
GET    /api/categories/:id
GET    /api/transactions
POST   /api/transactions
GET    /api/transactions/:id
GET    /api/transactions/recent
GET    /api/dashboard/*
```

**Unprotected Endpoints** (public access for monitoring only):
```
GET    /api/health
GET    /api/health/ready
GET    /api/health/live
```

### Development Testing

**PREREQUISITE: Configure JWT Secret**

Before testing authentication, you MUST set a JWT secret in your environment:

```bash
# Option 1: Development secret (for local testing)
# Add to Replit Secrets or .env file:
DEVELOPMENT_JWT_SECRET=dev-secret-for-testing-only-change-in-production

# Option 2: Production secret (shared with parent app)
JWT_SECRET=your-production-secret-shared-with-parent-app
```

**Without a JWT secret configured, the application will fail to start with error:**
```
Error: Missing required environment variables: JWT_SECRET or DEVELOPMENT_JWT_SECRET
```

**Generate Test Tokens:**
```bash
# After configuring JWT secret, run token generator:
npx tsx server/scripts/generate-test-tokens.ts
```

This script generates:
- **Manager token** (full access including exports and audit logs) - valid for 24 hours
- **Cashier token** (read/transact only, no exports or modifications) - valid for 24 hours

**Comprehensive Test Suite:**

```bash
# 1. Test public endpoints (no auth required)
curl http://localhost:5000/api/health
# Expected: 200 OK with health status

# 2. Test unauthenticated access (should fail)
curl http://localhost:5000/api/products
# Expected: 401 Unauthorized - "Authentication required"

# 3. Test manager read access (should succeed)
curl -H "Authorization: Bearer <MANAGER_TOKEN>" \
  http://localhost:5000/api/products
# Expected: 200 OK with product list

# 4. Test cashier read access (should succeed)
curl -H "Authorization: Bearer <CASHIER_TOKEN>" \
  http://localhost:5000/api/products
# Expected: 200 OK with product list

# 5. Test manager write access (should succeed)
curl -X POST \
  -H "Authorization: Bearer <MANAGER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Product","sku":"TEST-001","price":10.00,"categoryId":"cat-1"}' \
  http://localhost:5000/api/products
# Expected: 200 OK with created product

# 6. Test cashier write access (should fail - 403 Forbidden)
curl -X POST \
  -H "Authorization: Bearer <CASHIER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Product","sku":"TEST-002","price":10.00,"categoryId":"cat-1"}' \
  http://localhost:5000/api/products
# Expected: 403 Forbidden - "Insufficient permissions"

# 7. Test cashier delete access (should fail - 403 Forbidden)
curl -X DELETE \
  -H "Authorization: Bearer <CASHIER_TOKEN>" \
  http://localhost:5000/api/products/1
# Expected: 403 Forbidden - "Insufficient permissions"

# 8. Test manager audit log access (should succeed)
curl -H "Authorization: Bearer <MANAGER_TOKEN>" \
  "http://localhost:5000/api/audit-logs?limit=10"
# Expected: 200 OK with audit logs

# 9. Test cashier audit log access (should fail - 403 Forbidden)
curl -H "Authorization: Bearer <CASHIER_TOKEN>" \
  "http://localhost:5000/api/audit-logs?limit=10"
# Expected: 403 Forbidden - "Insufficient permissions"

# 10. Test manager Excel export (should succeed)
curl -H "Authorization: Bearer <MANAGER_TOKEN>" \
  http://localhost:5000/api/export/transactions \
  -o transactions.xlsx
# Expected: 200 OK with Excel file downloaded

# 11. Test cashier Excel export (should fail - 403 Forbidden)
curl -H "Authorization: Bearer <CASHIER_TOKEN>" \
  http://localhost:5000/api/export/transactions \
  -o transactions.xlsx
# Expected: 403 Forbidden - "Insufficient permissions"

# 12. Test expired/invalid token (should fail)
curl -H "Authorization: Bearer invalid-token-here" \
  http://localhost:5000/api/products
# Expected: 401 Unauthorized - "Invalid token"
```

**Expected Error Responses:**

```json
// 401 Unauthorized (missing/invalid token)
{
  "message": "Authentication required"
}

// 403 Forbidden (valid token, insufficient role)
{
  "message": "Insufficient permissions",
  "required": ["manager"],
  "current": "cashier"
}
```

### Payment Status Integration

**Webhook Endpoint** (to be called by parent app):
```
POST /api/transactions/:id/payment-status
{
  "status": "completed" | "failed" | "refunded",
  "paymentIntentId": "pi_xxx",
  "amount": 100.00
}
```

---

## Operational Procedures

### Deployment Checklist

**Pre-Deployment:**
- [ ] Environment variables configured
- [ ] Database connection tested
- [ ] Health endpoints responding
- [ ] JWT secret shared with parent app
- [ ] CORS origins whitelisted
- [ ] Log aggregation configured

**Post-Deployment:**
- [ ] Health check returning 200 OK
- [ ] Database indexes verified
- [ ] Monitor error logs for 24 hours
- [ ] Validate parent app integration
- [ ] Test transaction flow end-to-end

### Graceful Shutdown
The application handles `SIGTERM` and `SIGINT` signals for graceful shutdown:
1. Stop accepting new connections
2. Complete in-flight requests
3. Close database connections
4. Exit cleanly

### Backup & Recovery

**Database Backups:**
- Automated daily backups (configured via Replit/hosting provider)
- Point-in-time recovery capability
- Test restoration quarterly

**Audit Log Retention:**
- Minimum 90 days for compliance
- Recommend 7 years for financial data
- Implement log archival strategy

### Monitoring Alerts

**Critical Alerts:**
- Database connection failure
- API error rate > 5%
- Memory usage > 90%
- Health check failures

**Warning Alerts:**
- Response time > 500ms (p95)
- Database query time > 200ms
- Rate limit threshold reached

---

## Performance Characteristics

### Response Time Targets
- Health endpoints: < 50ms
- Simple GET requests: < 200ms
- Complex queries (reports): < 1s
- Transaction creation: < 500ms

### Scalability
**Current Configuration:**
- Single instance
- Connection pooling: Default Drizzle settings
- Rate limiting: 100 req/15min per IP

**Horizontal Scaling:**
- Stateless design allows multiple instances
- Database connection pooling per instance
- Session data stored in PostgreSQL (shareable)

---

## Compliance Features

### Audit Trail

Ship Store maintains a comprehensive audit trail for all data modifications, meeting PE firm compliance and SOX requirements:

**Tracked Operations:**
- **Complete Change Tracking**: All create/update/delete operations logged
- **Before/After Snapshots**: Full data state capture with field-level change detection
- **User Attribution**: Authenticated user ID from JWT token (req.user.id)
- **Request Context**: IP address, user agent, and request metadata
- **Immutable Logs**: Audit logs cannot be modified or deleted
- **Queryable Interface**: Filter by entity, action, user, date range

**DELETE Operation Compliance:**
- All DELETE operations capture complete before-data snapshots
- Zero-record deletions are logged (e.g., deleting from empty collections)
- Bulk delete operations include count and affected entity metadata
- Critical for PE due diligence and SOX compliance audits

**User Attribution Integration:**
- JWT tokens MUST include `id` field for proper user attribution
- All authenticated operations automatically capture user ID in audit logs
- Audit logs track who made changes, what changed, and when
- Supports compliance investigations and security forensics

**Example Audit Log Entry:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "test-manager-001",
  "entityType": "products",
  "entityId": "prod-123",
  "action": "update",
  "beforeData": { "name": "Widget", "price": 10.00 },
  "afterData": { "name": "Premium Widget", "price": 15.00 },
  "changedFields": ["name", "price"],
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "createdAt": "2025-11-17T20:00:00.000Z"
}
```

### Data Retention
- Transaction data: 7 years (configurable)
- Audit logs: 7 years (compliance requirement)
- User data: Per privacy policy
- Session data: 24 hours

### Security Compliance
- ✅ HTTPS only (enforced at deployment level)
- ✅ Secrets management (environment variables)
- ✅ No plaintext passwords
- ✅ SQL injection prevention
- ✅ XSS prevention
- ✅ CSRF protection (for cookie-based auth)
- ✅ Rate limiting (DDoS protection)

---

## Troubleshooting

### Common Issues

**1. Database Connection Errors**
```
Error: ECONNREFUSED 127.0.0.1:5432
```
**Solution**: Verify DATABASE_URL is correct and database is accessible

**2. JWT Validation Failures**
```
401 Unauthorized: Invalid token
```
**Solution**: Ensure JWT_SECRET matches between parent app and Ship Store

**3. CORS Errors**
```
Access to fetch blocked by CORS policy
```
**Solution**: Add parent app origin to ALLOWED_ORIGINS environment variable

**4. Rate Limit Exceeded**
```
429 Too Many Requests
```
**Solution**: Implement request throttling in parent app or increase rate limits

### Debug Mode
Enable debug logging:
```bash
NODE_ENV=development
```

View structured logs:
```bash
tail -f logs/combined.log | jq '.'
```

---

## API Versioning Strategy

**Current Version**: v1 (implicit)

**Future Versioning:**
- Add `/api/v2/` prefix for breaking changes
- Maintain backward compatibility for 6 months
- Document deprecation timeline in API responses

---

## Testing Recommendations

### Integration Testing
Test parent app integration:
1. JWT token validation
2. Transaction creation flow
3. Payment status update callback
4. Audit log querying
5. Health endpoint monitoring

### Load Testing
Recommended scenarios:
- 100 concurrent users
- 1000 transactions per hour
- Dashboard refresh every 30 seconds
- Audit log queries under peak load

### Contract Testing
Validate API contracts don't break:
- Request/response schemas
- Error response formats
- Authentication requirements
- Rate limiting behavior

---

## Support & Escalation

**Application Logs:**
- Location: `/logs` directory
- Format: JSON structured logs
- Retention: 5 files x 5MB (rotated)

**Health Monitoring:**
- Primary: `/api/health` endpoint
- Frequency: Every 60 seconds
- Alert threshold: 3 consecutive failures

**Incident Response:**
1. Check health endpoints
2. Review error logs (last 1 hour)
3. Verify database connectivity
4. Validate environment configuration
5. Check parent app integration status

---

## Version History

- **v1.0.0** (2025-11-17): Initial production-ready release
  - JWT authentication
  - Health endpoints
  - Database optimization
  - Structured logging
  - Security middleware
  - Audit trail
  - Dashboard KPIs

---

## Contact & Documentation

- **Technical Documentation**: This file
- **API Documentation**: See API_REFERENCE.md (to be created)
- **Integration Guide**: See INTEGRATION_GUIDE.md (to be created)
- **Change Log**: See CHANGELOG.md (to be created)
