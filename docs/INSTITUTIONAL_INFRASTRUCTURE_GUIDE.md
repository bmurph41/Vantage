# Institutional-Grade Infrastructure Guide

## Overview

This guide explains how to use the RBAC (Role-Based Access Control) and Audit Service infrastructure built for the MarinaMatch Fuel Sales module. These systems provide enterprise-grade security, compliance, and auditing capabilities.

## 🔐 RBAC System

### Roles and Permissions

The system supports 5 organizational roles with hierarchical permissions:

| Role | Description | Use Cases |
|------|-------------|-----------|
| **Owner** | Full system access, can manage users and sensitive operations | Marina owner, CEO |
| **Admin** | Can perform most operations, approve workflows, lock periods | CFO, Controller |
| **Editor** | Can create/edit fuel transactions, request approvals | Fuel dock manager, bookkeeper |
| **Viewer** | Read-only access to data and analytics | Investors, auditors (limited) |
| **Auditor** | Read access + full audit trail access | External auditors, compliance officers |

### Permission Matrix

```typescript
// Available permissions:
'fuel:read'               // View fuel transactions
'fuel:create'             // Create new transactions
'fuel:update'             // Edit transactions
'fuel:delete'             // Delete transactions
'fuel:export'             // Export data (CSV, QuickBooks)
'fuel:import'             // Import transactions
'fuel:integration:manage' // Manage API integrations
'fuel:approval:approve'   // Approve workflow requests
'fuel:approval:request'   // Request approvals
'fuel:period:lock'        // Lock accounting periods
'fuel:period:unlock'      // Unlock periods (Owner only)
'analytics:read'          // View analytics
'reports:create'          // Generate reports
'settings:manage'         // Manage fuel settings
'users:manage'            // Manage user roles (Owner only)
'audit:read'              // View audit logs
```

### How to Protect Routes

#### Method 1: Permission-Based Protection

```typescript
import { requirePermission } from './middleware/rbac';

// Single permission
app.post('/api/fuel/transactions',
  requirePermission('fuel:create'),
  async (req, res) => {
    // Your route logic
  }
);

// Multiple permissions (user must have ALL)
app.post('/api/fuel/export/quickbooks',
  requirePermission('fuel:export', 'fuel:approval:request'),
  async (req, res) => {
    // Your route logic
  }
);
```

#### Method 2: Role-Based Protection

```typescript
import { requireRole } from './middleware/rbac';

// Single role
app.post('/api/fuel/period/lock',
  requireRole('admin', 'owner'),
  async (req, res) => {
    // Your route logic
  }
);
```

#### Method 3: Programmatic Permission Checking

```typescript
import { checkPermission, getUserRole } from './middleware/rbac';

// In your route handler
const canExport = await checkPermission(userId, orgId, 'fuel:export');
if (!canExport) {
  return res.status(403).json({ message: 'Insufficient permissions' });
}

// Get user's role
const role = await getUserRole(userId, orgId);
```

### Accessing User Context

After RBAC middleware runs, the request object contains:

```typescript
req.user.id      // User ID
req.user.orgId   // Organization ID
req.userRole     // User's role (owner, admin, etc.)
req.permissions  // Array of all user's permissions
```

## 📋 Audit Service

### Key Features

- **Automatic Context Capture**: User, IP, session, timestamp
- **Change Tracking**: Before/after snapshots with automatic diff calculation
- **Severity Levels**: Info, Warning, Critical
- **GDPR/SOC 2 Compliance**: Immutable logs with full traceability
- **Integration Hooks**: Async event emission for reconciliation

### How to Log Audit Events

#### Fuel Transactions

```typescript
import { AuditService } from './services/audit-service';

// Create transaction
app.post('/api/fuel/transactions',
  requirePermission('fuel:create'),
  async (req, res) => {
    const newTransaction = await db.insert(fuelTransactions).values(data);
    
    await AuditService.logFuelTransaction(
      req,
      'create',
      newTransaction.id,
      null,  // no beforeData for creates
      newTransaction,
      { source: 'manual_entry', recordCount: 1 }
    );
    
    res.json(newTransaction);
  }
);

// Update transaction
app.patch('/api/fuel/transactions/:id',
  requirePermission('fuel:update'),
  async (req, res) => {
    const existing = await db.select().from(fuelTransactions).where(eq(fuelTransactions.id, id));
    const updated = await db.update(fuelTransactions).set(data).where(eq(fuelTransactions.id, id));
    
    await AuditService.logFuelTransaction(
      req,
      'update',
      id,
      existing[0],  // before
      updated,      // after
      { modifiedFields: Object.keys(data) }
    );
    
    res.json(updated);
  }
);

// Delete transaction
app.delete('/api/fuel/transactions/:id',
  requirePermission('fuel:delete'),
  async (req, res) => {
    const existing = await db.select().from(fuelTransactions).where(eq(fuelTransactions.id, id));
    await db.delete(fuelTransactions).where(eq(fuelTransactions.id, id));
    
    await AuditService.logFuelTransaction(
      req,
      'delete',
      id,
      existing[0],  // capture what was deleted
      null,
      { deletionReason: req.body.reason }
    );
    
    res.json({ success: true });
  }
);
```

#### Fuel Integrations

```typescript
// Integration changes are security-sensitive
app.post('/api/fuel/integrations',
  requirePermission('fuel:integration:manage'),
  async (req, res) => {
    const integration = await db.insert(fuelIntegrations).values(data);
    
    await AuditService.logFuelIntegration(
      req,
      'create',
      integration.id,
      null,
      integration,
      { provider: data.provider, securitySensitive: true }
    );
    
    res.json(integration);
  }
);

app.patch('/api/fuel/integrations/:id/disable',
  requirePermission('fuel:integration:manage'),
  async (req, res) => {
    const existing = await db.select().from(fuelIntegrations).where(eq(fuelIntegrations.id, id));
    await db.update(fuelIntegrations).set({ isActive: false }).where(eq(fuelIntegrations.id, id));
    
    await AuditService.logFuelIntegration(
      req,
      'disable',
      id,
      existing[0],
      { ...existing[0], isActive: false },
      { reason: req.body.reason }
    );
    
    res.json({ success: true });
  }
);
```

#### Approval Workflows

```typescript
// Request approval for sensitive operation
app.post('/api/fuel/export/quickbooks/request',
  requirePermission('fuel:approval:request'),
  async (req, res) => {
    const { startDate, endDate, glMappings } = req.body;
    
    await AuditService.logApprovalRequest(
      req,
      'fuel_export',
      `quickbooks-${Date.now()}`,
      'QuickBooks Export',
      { startDate, endDate, glMappings, recordCount: 150 }
    );
    
    res.json({ message: 'Approval requested', status: 'pending' });
  }
);

// Approve/reject workflow
app.post('/api/fuel/approvals/:id/decide',
  requirePermission('fuel:approval:approve'),
  async (req, res) => {
    const { decision, reason } = req.body;
    
    await AuditService.logApprovalDecision(
      req,
      req.params.id,
      decision,  // 'approve' or 'reject'
      reason
    );
    
    res.json({ success: true });
  }
);
```

#### Period Locking

```typescript
app.post('/api/fuel/period/lock',
  requirePermission('fuel:period:lock'),
  async (req, res) => {
    const { year, month } = req.body;
    
    await AuditService.logPeriodLock(
      req,
      { year, month },
      'lock'
    );
    
    // Prevent future edits to this period
    res.json({ success: true });
  }
);

app.post('/api/fuel/period/unlock',
  requirePermission('fuel:period:unlock'),  // Owner only
  async (req, res) => {
    const { year, month } = req.body;
    
    await AuditService.logPeriodLock(
      req,
      { year, month },
      'unlock'
    );
    
    res.json({ success: true });
  }
);
```

#### Data Exports

```typescript
app.post('/api/fuel/export/csv',
  requirePermission('fuel:export'),
  async (req, res) => {
    const { filters } = req.body;
    const records = await db.select().from(fuelTransactions).where(/* filters */);
    
    await AuditService.logExport(
      req,
      'csv',
      records.length,
      filters
    );
    
    res.json({ data: records });
  }
);
```

#### Generic Audit Logging

For custom events not covered by specific helpers:

```typescript
import { AuditService } from './services/audit-service';

const context = AuditService.extractContext(req);

await AuditService.log(context, {
  eventType: 'custom_action',
  entityType: 'fuel_inventory',
  entityId: inventoryId,
  action: 'Inventory adjustment',
  beforeData: oldInventory,
  afterData: newInventory,
  metadata: {
    adjustmentType: 'manual',
    variance: 50.5,
    reason: 'Discovered discrepancy during physical count'
  },
  severity: 'warning',
  isSuccess: true,
});
```

## 🗄️ Database Schema

### organization_user_roles

```sql
CREATE TABLE organization_user_roles (
  id SERIAL PRIMARY KEY,
  org_id VARCHAR NOT NULL REFERENCES organizations(id),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  role VARCHAR NOT NULL,  -- 'owner', 'admin', 'editor', 'viewer', 'auditor'
  is_active BOOLEAN DEFAULT true,
  assigned_at TIMESTAMP DEFAULT NOW(),
  assigned_by VARCHAR REFERENCES users(id),
  UNIQUE (org_id, user_id)
);
```

### Enhanced audit_logs

The existing `audit_logs` table now supports:

- **before/after**: JSONB columns for change tracking
- **metadata**: JSONB for flexible event data (severity, changes, etc.)
- **ipAddress/userAgent**: Compliance tracking
- **Indexes**: Fast querying by org, entity, user, date

## 🚀 Implementation Checklist

When adding institutional controls to a new fuel route:

- [ ] Add RBAC middleware (`requirePermission` or `requireRole`)
- [ ] Log the operation with `AuditService.logFuelTransaction` or appropriate method
- [ ] Capture before/after snapshots for updates and deletes
- [ ] Include relevant metadata (source, reason, count, etc.)
- [ ] Set appropriate severity level (info/warning/critical)
- [ ] Test permission denial responses
- [ ] Verify audit logs are created correctly

## 📊 Viewing Audit Trail

```typescript
import { AuditService } from './services/audit-service';

// Get audit trail for organization
const auditLogs = await AuditService.getAuditTrail(orgId, {
  entityType: 'fuel_transaction',
  entityId: transactionId,
  userId: userId,
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-12-31'),
  limit: 100,
});
```

## 🔮 Future Extensions

The infrastructure you've built enables these upcoming features with minimal effort:

### Period Locking
- Check RBAC permission before allowing edits
- Query audit logs to verify lock status
- Log all lock/unlock operations

### Reconciliation
- Consume audit events to track transaction lifecycle
- Compare before/after snapshots for variance detection
- Generate discrepancy reports from audit diffs

### Monitoring & Alerting
- Read audit event stream for anomalies
- Track error rates, sync failures, unusual patterns
- Alert admins based on severity levels

### Change History UI
- Display audit trail filtered by entity
- Show before/after diffs visually
- Export compliance reports

## 🛡️ Security Best Practices

1. **Always use RBAC**: Never skip permission checks on sensitive operations
2. **Log everything**: Compliance requires complete audit trails
3. **Include context**: IP, session, and metadata help investigations
4. **Handle failures gracefully**: Audit logging should never crash your app
5. **Protect audit logs**: Treat as immutable, only admins can view
6. **Regular reviews**: Monitor audit logs for suspicious activity

## 📖 Examples of Full Integration

See `/server/routes.ts` for examples of routes that integrate RBAC + Audit logging (coming soon).

---

**Built**: November 2025  
**Status**: Phase 1 Complete - Ready for route integration  
**Next**: Integrate into all fuel endpoints, build approval workflow UI
