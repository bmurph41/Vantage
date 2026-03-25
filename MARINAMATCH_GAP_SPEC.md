# MarinaMatch — Gap Feature Specification
## Missing Features: Full Build Guide (Volume 2)
### Version 1.0 | Generated for Claude Code / Replit Shell

---

> **HOW TO USE THIS DOCUMENT**
> This is Volume 2 of the MarinaMatch Master Product Specification.
> It covers features NOT in Volume 1. Same format: Data Models → API Endpoints → Business Logic → Frontend Components → Testing.
> Feed to Claude Code section by section, always reading MARINAMATCH_JOURNAL.md first.

---

## TABLE OF CONTENTS

**PART A — FOUNDATIONAL INFRASTRUCTURE**
- A.1 Billing & Subscription Engine
- A.2 Granular RBAC (Role-Based Access Control)
- A.3 Audit Trail & Compliance Log
- A.4 Single Sign-On (SSO)
- A.5 Two-Factor Authentication (2FA)

**PART B — FUND-LEVEL ACCOUNTING & FORMATION**
- B.1 Fund-Level Financial Model
- B.2 Fund Formation Document Automation
- B.3 Investor Accreditation & KYC/AML Workflow
- B.4 Capital Account Ledger
- B.5 Management Fee & Promote Calculator

**PART C — TENANT & PROPERTY MANAGEMENT**
- C.1 Tenant Portal
- C.2 Online Rent Collection
- C.3 Lease Renewal Workflow
- C.4 Rent Roll Intelligence
- C.5 Vacancy & Leasing Pipeline

**PART D — DEVELOPMENT & CONSTRUCTION**
- D.1 Development / Construction Module
- D.2 Renovation Unit Tracker
- D.3 Pro Forma → Actuals Bridge

**PART E — ADVANCED ANALYTICS & REPORTING**
- E.1 Custom Report Builder
- E.2 Performance Attribution Engine
- E.3 Portfolio Stress Testing
- E.4 Benchmark Peer Comparison
- E.5 Cash Flow Forecasting Engine

**PART F — INTEGRATIONS & DATA**
- F.1 QuickBooks / Xero Accounting Integration
- F.2 Property Management System Sync
- F.3 CoStar / LoopNet Integration
- F.4 DocuSign Deep Integration
- F.5 Google Maps / Satellite View Integration
- F.6 Public Records / Title Data

**PART G — DEEPER AI FEATURES**
- G.1 AI Underwriting Assistant
- G.2 Document Intelligence (Full)
- G.3 AI Deal Sourcing
- G.4 Predictive Analytics
- G.5 AI Meeting Transcription + CRM Sync

**PART H — SCALE & ENTERPRISE**
- H.1 Multi-Entity / Multi-Fund Architecture
- H.2 White-Label API
- H.3 Multi-Currency & International
- H.4 Virtual Data Room
- H.5 Bulk Import / Data Migration Tools

**PART I — COMPLIANCE & RISK**
- I.1 Climate Risk Module
- I.2 Environmental Tracking
- I.3 Insurance Management
- I.4 Regulatory Calendar

**PART J — MOBILE & UX**
- J.1 Native Mobile App (iOS + Android)
- J.2 Onboarding & In-App Training
- J.3 Dark Mode

---

# PART A — FOUNDATIONAL INFRASTRUCTURE

---

## A.1 Billing & Subscription Engine

### Overview
Full Stripe-backed billing system with subscription tiers, per-seat pricing, feature flags, usage metering, trial management, invoicing, and a self-service billing portal. This is the revenue engine of the platform — nothing ships to paying customers without it.

### Subscription Tiers

```typescript
// Tier definitions
const SUBSCRIPTION_TIERS = {
  starter: {
    name: 'Starter',
    price_monthly: 299,
    price_annual: 249, // per month billed annually
    seats: 3,
    deals: 10,
    features: [
      'deal_workspace',
      'crm_basic',
      'financial_model',
      'document_vault',
      'dd_checklist',
      'basic_reporting',
    ],
    limits: {
      deals: 10,
      seats: 3,
      document_storage_gb: 10,
      ai_queries_per_month: 100,
    },
  },
  growth: {
    name: 'Growth',
    price_monthly: 799,
    price_annual: 649,
    seats: 10,
    features: [
      ...starter.features,
      'lp_portal',
      'capital_calls',
      'distributions',
      'workflow_automation',
      'gantt_view',
      'ai_narratives',
      'lease_abstractor',
      'email_integration',
      'sms_alerts',
      'vendor_management',
      'work_orders',
    ],
    limits: {
      deals: 50,
      seats: 10,
      document_storage_gb: 100,
      ai_queries_per_month: 1000,
      lp_investors: 50,
    },
  },
  institutional: {
    name: 'Institutional',
    price_monthly: 1999,
    price_annual: 1649,
    seats: -1, // unlimited
    features: [
      ...growth.features,
      'portfolio_dashboard',
      'benchmark_engine',
      'stress_testing',
      'fund_accounting',
      'kyc_aml',
      'capital_account_ledger',
      'construction_module',
      'custom_report_builder',
      'performance_attribution',
      'ai_underwriting',
      'document_intelligence',
      'sso',
      'audit_trail',
      'white_label',
      'api_access',
      'custom_deal_stages',
      'waterfall_engine',
    ],
    limits: {
      deals: -1,
      seats: -1,
      document_storage_gb: 1000,
      ai_queries_per_month: -1, // unlimited
      lp_investors: -1,
    },
  },
  enterprise: {
    name: 'Enterprise',
    price_monthly: null, // custom pricing
    price_annual: null,
    features: ['everything'],
    limits: {}, // custom per contract
    addOns: [
      'dedicated_success_manager',
      'custom_integrations',
      'on_premise_option',
      'sla_guarantee',
      'custom_data_retention',
    ],
  },
};
```

### Data Models

```typescript
// schema/billing.ts

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).unique(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }).unique(),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }).unique(),
  stripePriceId: varchar('stripe_price_id', { length: 255 }),
  tier: varchar('tier', { length: 50 }),
  // starter | growth | institutional | enterprise
  status: varchar('status', { length: 50 }),
  // trialing | active | past_due | canceled | paused | incomplete
  billingCycle: varchar('billing_cycle', { length: 20 }),
  // monthly | annual
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  trialStart: timestamp('trial_start'),
  trialEnd: timestamp('trial_end'),
  cancelAt: timestamp('cancel_at'),
  canceledAt: timestamp('canceled_at'),
  seatCount: integer('seat_count').default(1),
  seatLimit: integer('seat_limit'),
  dealLimit: integer('deal_limit'),
  aiQueryLimit: integer('ai_query_limit'),
  storageGbLimit: integer('storage_gb_limit'),
  // Add-ons
  addonIds: jsonb('addon_ids'), // active add-on stripe price IDs
  // Metadata
  cancelReason: text('cancel_reason'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  stripeInvoiceId: varchar('stripe_invoice_id', { length: 255 }).unique(),
  amount: integer('amount'), // cents
  currency: varchar('currency', { length: 3 }).default('usd'),
  status: varchar('status', { length: 30 }),
  // draft | open | paid | uncollectible | void
  invoiceUrl: varchar('invoice_url', { length: 500 }),
  pdfUrl: varchar('pdf_url', { length: 500 }),
  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),
  paidAt: timestamp('paid_at'),
  dueDate: timestamp('due_date'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usageMetrics = pgTable('usage_metrics', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  metricType: varchar('metric_type', { length: 100 }),
  // ai_query | document_storage_mb | deal_count | seat_count | lp_count
  value: integer('value'),
  period: varchar('period', { length: 20 }), // '2025-03' (YYYY-MM)
  recordedAt: timestamp('recorded_at').defaultNow(),
});

export const featureFlags = pgTable('feature_flags', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  feature: varchar('feature', { length: 100 }),
  isEnabled: boolean('is_enabled').default(false),
  enabledAt: timestamp('enabled_at'),
  // Override: can enable features outside of tier (for trials, enterprise deals)
  isOverride: boolean('is_override').default(false),
  overrideExpiresAt: timestamp('override_expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### Billing Service

```typescript
// lib/billing/billingService.ts
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export class BillingService {
  
  // Create customer + subscription on org signup
  async createSubscription(
    orgId: number,
    email: string,
    tier: SubscriptionTier,
    billingCycle: 'monthly' | 'annual',
    paymentMethodId: string
  ): Promise<Subscription> {
    // 1. Create Stripe customer
    const customer = await stripe.customers.create({
      email,
      payment_method: paymentMethodId,
      invoice_settings: { default_payment_method: paymentMethodId },
      metadata: { orgId: orgId.toString() },
    });
    
    // 2. Create subscription with 14-day trial
    const priceId = STRIPE_PRICE_IDS[tier][billingCycle];
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      trial_period_days: 14,
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });
    
    // 3. Save to DB
    const sub = await db.insert(subscriptions).values({
      orgId,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      tier,
      billingCycle,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      trialEnd: new Date(subscription.trial_end * 1000),
      seatLimit: SUBSCRIPTION_TIERS[tier].limits.seats,
      dealLimit: SUBSCRIPTION_TIERS[tier].limits.deals,
    }).returning();
    
    // 4. Provision feature flags
    await this.provisionFeatureFlags(orgId, tier);
    
    return sub[0];
  }
  
  // Check if org can access a feature
  async canAccess(orgId: number, feature: string): Promise<boolean> {
    const flag = await db
      .select()
      .from(featureFlags)
      .where(
        and(
          eq(featureFlags.orgId, orgId),
          eq(featureFlags.feature, feature),
          eq(featureFlags.isEnabled, true)
        )
      )
      .limit(1);
    return flag.length > 0;
  }
  
  // Check usage limits
  async checkLimit(
    orgId: number,
    limitType: 'deals' | 'seats' | 'ai_queries' | 'storage'
  ): Promise<{ allowed: boolean; current: number; limit: number; pct: number }> {
    const sub = await getSubscription(orgId);
    const current = await getCurrentUsage(orgId, limitType);
    const limit = getLimit(sub.tier, limitType);
    return {
      allowed: limit === -1 || current < limit,
      current,
      limit,
      pct: limit === -1 ? 0 : (current / limit) * 100,
    };
  }
  
  // Upgrade/downgrade subscription
  async changePlan(orgId: number, newTier: SubscriptionTier): Promise<void> {
    const sub = await getSubscription(orgId);
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      items: [{ id: sub.stripeItemId, price: STRIPE_PRICE_IDS[newTier][sub.billingCycle] }],
      proration_behavior: 'create_prorations',
    });
    await this.provisionFeatureFlags(orgId, newTier);
  }
  
  // Handle Stripe webhooks
  async handleWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'invoice.payment_succeeded':
        await this.handlePaymentSuccess(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.trial_will_end':
        await this.handleTrialEnding(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
    }
  }
  
  private async provisionFeatureFlags(orgId: number, tier: SubscriptionTier): Promise<void> {
    const features = SUBSCRIPTION_TIERS[tier].features;
    // Delete existing flags
    await db.delete(featureFlags).where(eq(featureFlags.orgId, orgId));
    // Insert new flags
    await db.insert(featureFlags).values(
      features.map(f => ({ orgId, feature: f, isEnabled: true, enabledAt: new Date() }))
    );
  }
}
```

### Feature Gate Middleware

```typescript
// middleware/featureGate.ts
export function requireFeature(feature: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { orgId } = req.user;
    const billingService = new BillingService();
    const canAccess = await billingService.canAccess(orgId, feature);
    
    if (!canAccess) {
      return res.status(403).json({
        error: 'feature_not_available',
        message: `This feature requires a higher subscription tier.`,
        feature,
        upgradeUrl: `/settings/billing?upgrade=true&feature=${feature}`,
      });
    }
    next();
  };
}

// Usage in routes:
router.get('/api/lp/dashboard', authenticate, requireFeature('lp_portal'), handler);
router.post('/api/ai-chat/sessions', authenticate, requireFeature('ask_your_deal'), handler);

// Usage limit middleware:
export function checkUsageLimit(limitType: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const check = await billingService.checkLimit(req.user.orgId, limitType);
    if (!check.allowed) {
      return res.status(429).json({
        error: 'usage_limit_reached',
        message: `You've reached your ${limitType} limit.`,
        current: check.current,
        limit: check.limit,
        upgradeUrl: '/settings/billing',
      });
    }
    // Warn at 80% usage
    if (check.pct >= 80) {
      res.setHeader('X-Usage-Warning', `${limitType}:${check.pct.toFixed(0)}%`);
    }
    next();
  };
}
```

### API Endpoints

```typescript
// POST /api/billing/create-subscription
// POST /api/billing/create-setup-intent — get client secret for payment method collection
// GET /api/billing/subscription — current org subscription + usage
// POST /api/billing/change-plan — upgrade/downgrade
// POST /api/billing/cancel — cancel subscription (with reason capture)
// POST /api/billing/reactivate — reactivate canceled subscription
// GET /api/billing/invoices — invoice history
// GET /api/billing/usage — current period usage metrics
// POST /api/billing/portal — generate Stripe customer portal URL
// POST /api/billing/webhooks — Stripe webhook receiver (no auth)
// GET /api/billing/plans — public plan comparison data
// POST /api/billing/prorate-preview — show proration before plan change
```

### Frontend Components

```typescript
// pages/settings/Billing.tsx

// Layout:
// Current Plan card:
//   - Tier name + badge | Status (active/trial/past_due)
//   - Next billing date + amount
//   - "Manage Billing" → opens Stripe portal
//   - "Upgrade Plan" button

// Usage meters:
//   - Deals: [progress bar] 7/10 used
//   - Seats: [progress bar] 3/3 used  ← shows "Add Seat" button when near limit
//   - AI Queries: [progress bar] 450/1000 this month
//   - Storage: [progress bar] 12.4 GB / 100 GB
//   Warning banner at 80%: "You're at 80% of your deal limit. Upgrade to Growth."

// Plan comparison table (shown when upgrade=true in query):
// Features matrix: Starter | Growth | Institutional | Enterprise
// Billing toggle: Monthly / Annual (shows savings)
// Each plan: price, feature list, "Select Plan" button
// Current plan highlighted

// Invoice history table:
// Date | Amount | Status | Download PDF

// Feature unlock modals:
// When user hits a gated feature, shows upgrade prompt with:
//   - Feature description
//   - Which plan includes it
//   - "Upgrade Now" CTA + price
//   - "Learn More" link
//   - Can dismiss and continue with current plan

// Trial banner (shown during trial):
// "You're on a 14-day free trial of Institutional. X days remaining."
// Progress bar showing trial duration
// "Add Payment Method" button (doesn't charge until trial ends)
// "Downgrade to Free" option

// Dunning / past-due banner:
// Red banner at top of app: "Payment failed. Please update your payment method."
// "Update Payment Method" button
// Grace period: 7 days before feature lockout
```

---

## A.2 Granular RBAC (Role-Based Access Control)

### Overview
A flexible, field-level permission system that goes beyond simple roles. Supports custom role creation, per-module permissions, field-level visibility, and deal-scoped access (user only sees deals assigned to them).

### Permission Architecture

```typescript
// Three layers of access control:
// Layer 1: Role-based (what modules can you access?)
// Layer 2: Record-level (which deals/contacts can you see?)
// Layer 3: Field-level (which fields can you edit vs. view vs. never see?)

// Built-in system roles:
const SYSTEM_ROLES = {
  owner: {
    label: 'Owner',
    description: 'Full access to everything including billing and user management',
    isSystem: true,
  },
  admin: {
    label: 'Admin',
    description: 'Full access except billing and org deletion',
    isSystem: true,
  },
  gp_principal: {
    label: 'GP Principal',
    description: 'Full deal access, can approve IC memos and distributions',
    isSystem: true,
  },
  analyst: {
    label: 'Analyst',
    description: 'Read/write on financial models, read-only on capital stack and LP data',
    isSystem: true,
  },
  asset_manager: {
    label: 'Asset Manager',
    description: 'Operations, work orders, vendor management; view-only on underwriting',
    isSystem: true,
  },
  property_manager: {
    label: 'Property Manager',
    description: 'Work orders, tenants, inspections; no access to financial models or LP data',
    isSystem: true,
  },
  lp_investor: {
    label: 'LP Investor',
    description: 'Portal-only: view own investments, distributions, documents',
    isSystem: true,
  },
  read_only: {
    label: 'Read Only',
    description: 'View-only access across all permitted modules',
    isSystem: true,
  },
};
```

### Data Models

```typescript
// schema/rbac.ts

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  // null = system role (shared across all orgs)
  name: varchar('name', { length: 100 }),
  label: varchar('label', { length: 100 }),
  description: text('description'),
  isSystem: boolean('is_system').default(false),
  // System roles cannot be deleted; custom roles can be
  permissions: jsonb('permissions'), // see PermissionSet below
  createdAt: timestamp('created_at').defaultNow(),
});

export const userRoles = pgTable('user_roles', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  userId: integer('user_id').references(() => users.id),
  roleId: integer('role_id').references(() => roles.id),
  // Deal-scoped access: only see specific deals
  dealScope: varchar('deal_scope', { length: 20 }).default('all'),
  // 'all' | 'assigned' | 'specific'
  specificDealIds: jsonb('specific_deal_ids'), // used when dealScope = 'specific'
  assignedAt: timestamp('assigned_at').defaultNow(),
  assignedBy: integer('assigned_by').references(() => users.id),
});

// Field-level permissions
export const fieldPermissions = pgTable('field_permissions', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  roleId: integer('role_id').references(() => roles.id),
  module: varchar('module', { length: 100 }),
  // 'financial_model' | 'capital_stack' | 'lp_data' | 'deal_pricing' | etc.
  fieldPath: varchar('field_path', { length: 255 }),
  // e.g., 'financialModel.irr' or 'capStack.lpEquity'
  permission: varchar('permission', { length: 20 }),
  // 'hidden' | 'read' | 'write'
});
```

### Permission Set Structure

```typescript
interface PermissionSet {
  // Module-level permissions
  modules: {
    [module: string]: {
      view: boolean;
      create: boolean;
      edit: boolean;
      delete: boolean;
      export: boolean;
      approve?: boolean; // for modules with approval flows
    };
  };
  
  // Specific capability gates
  capabilities: {
    can_view_financials: boolean;
    can_edit_financials: boolean;
    can_view_lp_data: boolean;
    can_manage_lps: boolean;
    can_approve_distributions: boolean;
    can_approve_capital_calls: boolean;
    can_approve_ic_memos: boolean;
    can_manage_users: boolean;
    can_manage_billing: boolean;
    can_manage_integrations: boolean;
    can_export_data: boolean;
    can_delete_deals: boolean;
    can_view_salary_data: boolean;
    can_view_tax_id: boolean;    // LP tax IDs
    can_view_bank_info: boolean; // LP bank/wire info
    can_send_capital_calls: boolean;
    can_send_distributions: boolean;
  };
}

// Example: Analyst role permissions
const ANALYST_PERMISSIONS: PermissionSet = {
  modules: {
    deals: { view: true, create: true, edit: true, delete: false, export: true },
    financial_model: { view: true, create: true, edit: true, delete: false, export: true },
    crm: { view: true, create: true, edit: true, delete: false, export: false },
    documents: { view: true, create: true, edit: false, delete: false, export: true },
    lp_portal: { view: false, create: false, edit: false, delete: false, export: false },
    capital_calls: { view: false, create: false, edit: false, delete: false, export: false },
    distributions: { view: false, create: false, edit: false, delete: false, export: false },
    work_orders: { view: true, create: false, edit: false, delete: false, export: false },
    settings: { view: false, create: false, edit: false, delete: false, export: false },
  },
  capabilities: {
    can_view_financials: true,
    can_edit_financials: true,
    can_view_lp_data: false,
    can_manage_lps: false,
    can_approve_distributions: false,
    can_approve_capital_calls: false,
    can_approve_ic_memos: false,
    can_manage_users: false,
    can_manage_billing: false,
    can_manage_integrations: false,
    can_export_data: true,
    can_delete_deals: false,
    can_view_salary_data: false,
    can_view_tax_id: false,
    can_view_bank_info: false,
    can_send_capital_calls: false,
    can_send_distributions: false,
  },
};
```

### Permission Enforcement

```typescript
// middleware/rbac.ts

export function requirePermission(module: string, action: keyof ModulePermission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userPermissions = await getUserPermissions(req.user.id, req.user.orgId);
    const modulePerms = userPermissions.modules[module];
    
    if (!modulePerms?.[action]) {
      return res.status(403).json({
        error: 'permission_denied',
        message: `You don't have permission to ${action} ${module}.`,
        requiredPermission: `${module}.${action}`,
      });
    }
    next();
  };
}

export function requireCapability(capability: keyof Capabilities) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userPermissions = await getUserPermissions(req.user.id, req.user.orgId);
    if (!userPermissions.capabilities[capability]) {
      return res.status(403).json({ error: 'permission_denied', capability });
    }
    next();
  };
}

// Deal-scope filter: automatically filters queries to accessible deals
export async function getScopedDealIds(userId: number, orgId: number): Promise<number[] | 'all'> {
  const userRole = await getUserRole(userId, orgId);
  if (userRole.dealScope === 'all') return 'all';
  if (userRole.dealScope === 'assigned') {
    return getAssignedDealIds(userId, orgId);
  }
  return userRole.specificDealIds || [];
}

// Field redaction: removes hidden fields from response objects
export function redactFields(
  data: Record<string, any>,
  module: string,
  permissions: PermissionSet
): Record<string, any> {
  const fieldPerms = permissions.fieldPermissions?.[module] || {};
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => {
      const perm = fieldPerms[key];
      return !perm || perm !== 'hidden';
    })
  );
}
```

### RBAC Management UI

```typescript
// pages/settings/RolesPermissions.tsx

// Layout:
// Left sidebar: list of roles (system + custom)
//   - System roles: can edit permissions, cannot delete
//   - Custom roles: full edit + delete
//   - "Create Custom Role" button

// Right panel (when role selected):
// Role name + description (editable for custom)
// Users with this role (avatars + names + "Remove" button)

// Permissions matrix:
// Table with modules as rows, actions (View/Create/Edit/Delete/Export/Approve) as columns
// Toggle switches for each cell
// Color-coded: green = enabled, grey = disabled
// Locked cells for system constraints (e.g., LP Investor can never edit financials)

// Capabilities section:
// Toggle list for each capability
// Grouped by category: Financial | LP Management | Users & Settings | Data

// Field-level permissions accordion:
// Per module, list sensitive fields with hidden/read/write selector
// e.g., "LP Tax ID" → Hidden for Analyst, Read for GP Principal, Write for Admin

// Deal scope selector:
// All Deals / Assigned Deals Only / Specific Deals (multi-select)

// User assignment:
// "Assign Users" button → modal to add users to this role
// Shows current users with role

// "Test As User" button:
// Impersonate a user's permissions (admin only) to verify RBAC is working
// Shows permission badges on each element: green lock = allowed, red lock = denied
```

---

## A.3 Audit Trail & Compliance Log

### Overview
Immutable, tamper-proof log of every mutation in the system. Required for SEC/RIA compliance, institutional LP due diligence, and general accountability. Every create/update/delete action is captured with full context.

### Data Models

```typescript
// schema/auditLog.ts

export const auditLog = pgTable('audit_log', {
  id: bigserial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  userId: integer('user_id').references(() => users.id).default(null),
  // null for system/automated actions
  userEmail: varchar('user_email', { length: 255 }),
  // Denormalized — preserved even if user deleted
  userIp: varchar('user_ip', { length: 45 }), // IPv4 or IPv6
  userAgent: varchar('user_agent', { length: 500 }),
  sessionId: varchar('session_id', { length: 255 }),
  
  // What happened
  action: varchar('action', { length: 100 }),
  // CREATE | UPDATE | DELETE | VIEW | EXPORT | LOGIN | LOGOUT
  // APPROVE | REJECT | SEND | DOWNLOAD | IMPERSONATE
  module: varchar('module', { length: 100 }),
  // deals | contacts | documents | financial_model | lp_data | users | settings | etc.
  entityType: varchar('entity_type', { length: 100 }),
  entityId: varchar('entity_id', { length: 100 }),
  entityLabel: varchar('entity_label', { length: 255 }),
  // Human-readable entity name for display
  
  // Change detail
  previousValues: jsonb('previous_values'),
  // Snapshot of changed fields BEFORE the change
  newValues: jsonb('new_values'),
  // Snapshot of changed fields AFTER the change
  changedFields: jsonb('changed_fields'),
  // Array of field names that changed: ['stage', 'askPrice']
  
  // Context
  requestPath: varchar('request_path', { length: 500 }),
  requestMethod: varchar('request_method', { length: 10 }),
  statusCode: integer('status_code'),
  
  // Integrity
  checksum: varchar('checksum', { length: 64 }),
  // SHA-256 of (id + orgId + userId + action + entityId + timestamp)
  // Used to detect tampering
  
  createdAt: timestamp('created_at').defaultNow(),
  // CRITICAL: No updated_at — audit log rows are IMMUTABLE
});

// Index for common queries:
// idx_audit_log_org_date: (orgId, createdAt)
// idx_audit_log_entity: (entityType, entityId)
// idx_audit_log_user: (userId, createdAt)
// idx_audit_log_action: (action, module, orgId)
```

### Audit Logger Middleware

```typescript
// middleware/auditLogger.ts

export function auditLog(options: AuditOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const originalJson = res.json.bind(res);
    let responseBody: any;
    
    // Intercept response to capture what was returned
    res.json = (body) => {
      responseBody = body;
      return originalJson(body);
    };
    
    res.on('finish', async () => {
      if (!shouldAudit(req, res.statusCode)) return;
      
      const action = inferAction(req.method, req.path);
      const { entityType, entityId } = extractEntityInfo(req);
      
      // Compute diff if this is an UPDATE
      let previousValues: any = null;
      let changedFields: string[] = [];
      if (req.method === 'PUT' || req.method === 'PATCH') {
        previousValues = req._auditPreviousValues; // set by route handler
        changedFields = computeChangedFields(previousValues, req.body);
      }
      
      const entry = {
        orgId: req.user?.orgId,
        userId: req.user?.id,
        userEmail: req.user?.email,
        userIp: req.ip,
        userAgent: req.headers['user-agent'],
        sessionId: req.headers['x-session-id'],
        action,
        module: options.module || inferModule(req.path),
        entityType,
        entityId: entityId?.toString(),
        entityLabel: responseBody?.name || responseBody?.title || entityId?.toString(),
        previousValues,
        newValues: req.method !== 'GET' ? sanitize(req.body) : null,
        changedFields,
        requestPath: req.path,
        requestMethod: req.method,
        statusCode: res.statusCode,
      };
      
      // Compute integrity checksum
      entry.checksum = computeChecksum(entry);
      
      // Write async (don't block response)
      auditLogService.write(entry).catch(console.error);
    });
    
    next();
  };
}

// Sensitive field sanitizer — never log these values:
const SENSITIVE_FIELDS = [
  'password', 'passwordHash', 'taxId', 'ssn', 'bankAccount',
  'wireInstructions', 'stripeToken', 'apiKey', 'secret',
];
function sanitize(obj: any): any {
  if (!obj) return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      SENSITIVE_FIELDS.some(f => k.toLowerCase().includes(f)) ? '[REDACTED]' : v
    ])
  );
}
```

### Audit Log UI

```typescript
// pages/settings/AuditLog.tsx

// Filters:
//   Date range picker | User selector | Module dropdown | Action type
//   Entity type | Search (free text across entityLabel, userEmail)

// Table columns:
//   Timestamp | User | Action | Module | Entity | IP Address | Changes

// Row expansion:
//   Click any row → expand to show full diff
//   Before/after comparison for UPDATE actions (side-by-side JSON diff)
//   Color: red = removed, green = added, yellow = changed

// Export:
//   Export filtered log as CSV (for legal/compliance requests)
//   Date-bounded export (e.g., "Export Jan 2025 – Mar 2025")

// Integrity verification:
//   "Verify Integrity" button: re-computes checksums and flags any tampered rows
//   Shows green "✓ Integrity Verified" or red "⚠ X rows modified"

// Retention:
//   Configurable retention period (default: 7 years for SEC compliance)
//   Warning when approaching retention limit
```

---

## A.4 Single Sign-On (SSO)

### Overview
SAML 2.0 and OIDC-based SSO integration for enterprise customers. Supports Okta, Microsoft Azure AD, Google Workspace, and any SAML 2.0 compatible IdP.

### Implementation

```typescript
// lib/auth/sso.ts
// Using: passport-saml for SAML 2.0, openid-client for OIDC

export const ssoConfigs = pgTable('sso_configs', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).unique(),
  provider: varchar('provider', { length: 50 }),
  // okta | azure_ad | google_workspace | custom_saml | custom_oidc
  protocol: varchar('protocol', { length: 10 }), // saml | oidc
  
  // SAML-specific
  entryPoint: varchar('entry_point', { length: 500 }),
  // IdP SSO URL
  issuer: varchar('issuer', { length: 500 }),
  cert: text('cert'), // IdP public certificate
  signatureAlgorithm: varchar('signature_algorithm', { length: 50 }),
  
  // OIDC-specific
  discoveryUrl: varchar('discovery_url', { length: 500 }),
  clientId: varchar('client_id', { length: 255 }),
  clientSecret: varchar('client_secret', { length: 255 }), // encrypted
  scope: varchar('scope', { length: 255 }),
  
  // Attribute mapping
  emailAttribute: varchar('email_attribute', { length: 100 }),
  // e.g., 'email' or 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
  nameAttribute: varchar('name_attribute', { length: 100 }),
  roleAttribute: varchar('role_attribute', { length: 100 }),
  // Map IdP group/role to MarinaMatch role
  
  // Behavior
  enforceSSO: boolean('enforce_sso').default(false),
  // true = only SSO login allowed (no email/password)
  jitProvisioning: boolean('jit_provisioning').default(true),
  // Auto-create user on first SSO login
  defaultRole: varchar('default_role', { length: 50 }).default('analyst'),
  
  isActive: boolean('is_active').default(false),
  testedAt: timestamp('tested_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// SSO Routes:
// GET /api/auth/sso/:orgSlug — initiate SSO (redirect to IdP)
// POST /api/auth/sso/callback — SAML assertion handler
// GET /api/auth/sso/oidc/callback — OIDC callback
// GET /api/auth/sso/metadata — serve SP metadata XML (for IdP setup)

// Setup wizard:
// Step 1: Select IdP (Okta / Azure AD / Google / Custom)
// Step 2: Enter IdP config (entry point URL, certificate, etc.)
// Step 3: Download SP metadata XML to paste into IdP
// Step 4: Test SSO connection (test login flow without enforcing)
// Step 5: Enable + optionally enforce

// SSO Settings page:
// Current SSO status: Active / Inactive
// Provider details (read-only after setup)
// "Test SSO" button (opens new tab with SSO login flow)
// "Enforce SSO" toggle (disables email/password login)
// Attribute mapping table
// User provisioning: JIT on/off, default role
// "Download Metadata XML" button
```

---

## A.5 Two-Factor Authentication (2FA)

### Overview
TOTP (authenticator app) and SMS-based 2FA for all user accounts. Required for LP portal access and configurable as mandatory for specific roles.

### Implementation

```typescript
// lib/auth/twoFactor.ts
// Using: speakeasy for TOTP, Twilio for SMS

export const userTwoFactor = pgTable('user_two_factor', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).unique(),
  method: varchar('method', { length: 20 }), // 'totp' | 'sms'
  totpSecret: varchar('totp_secret', { length: 255 }), // encrypted
  phoneNumber: varchar('phone_number', { length: 50 }), // for SMS method
  isEnabled: boolean('is_enabled').default(false),
  enabledAt: timestamp('enabled_at'),
  backupCodes: jsonb('backup_codes'), // array of hashed backup codes
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2FA Setup Flow:
// 1. User goes to Security settings
// 2. Clicks "Enable Two-Factor Authentication"
// 3. Selects method: Authenticator App or SMS
// For TOTP:
//   a. Generate secret with speakeasy.generateSecret()
//   b. Show QR code for scanning with Google Authenticator / Authy
//   c. User enters 6-digit code to verify
//   d. Show 10 backup codes (one-time use), prompt user to save
//   e. Enable 2FA
// For SMS:
//   a. Enter phone number
//   b. Send verification code via Twilio
//   c. User enters code to verify
//   d. Enable 2FA

// Login Flow with 2FA:
// Step 1: Email + password → success → check if 2FA enabled
// Step 2a (TOTP): Show 6-digit code input or "Use backup code" link
// Step 2b (SMS): Trigger SMS send → show 6-digit input
// On success: issue JWT with 2fa_verified: true claim
// JWT without 2fa_verified can only access /api/auth/* routes

// Org-level enforcement:
// Setting: "Require 2FA for: All Users | Specific Roles | LP Investors Only"
// When enforced: users who haven't set up 2FA are redirected to setup on login
// LP Investor role: always requires 2FA (hardcoded)

// Routes:
// POST /api/auth/2fa/setup/totp — generate secret + QR code
// POST /api/auth/2fa/verify-totp — verify code + enable
// POST /api/auth/2fa/setup/sms — send SMS verification
// POST /api/auth/2fa/verify-sms — verify SMS code + enable
// POST /api/auth/2fa/disable — disable 2FA (requires current 2FA code)
// POST /api/auth/2fa/backup-codes — regenerate backup codes
// POST /api/auth/2fa/challenge — verify during login flow
// GET /api/auth/2fa/status — current 2FA status for user
```

---

# PART B — FUND-LEVEL ACCOUNTING & FORMATION

---

## B.1 Fund-Level Financial Model

### Overview
Extends MarinaMatch from deal-by-deal underwriting to full fund-level financial modeling. Supports closed-end PE-style funds, evergreen funds, and SMAs (Separately Managed Accounts).

### Data Models

```typescript
// schema/funds.ts

export const funds = pgTable('funds', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  name: varchar('name', { length: 255 }), // "Harborside Capital Fund I, LP"
  shortName: varchar('short_name', { length: 100 }), // "Fund I"
  fundType: varchar('fund_type', { length: 50 }),
  // closed_end | evergreen | sma | co_investment | separate_account
  vintage: integer('vintage'), // year fund was formed
  legalEntity: varchar('legal_entity', { length: 255 }),
  taxId: varchar('tax_id', { length: 50 }), // encrypted, fund EIN
  jurisdiction: varchar('jurisdiction', { length: 100 }),
  // Delaware LP | Cayman Islands | etc.
  
  // Capital targets
  targetSize: numeric('target_size', { precision: 15, scale: 2 }),
  hardCap: numeric('hard_cap', { precision: 15, scale: 2 }),
  minimumLP: numeric('minimum_lp', { precision: 12, scale: 2 }),
  // Minimum LP commitment
  
  // Actual capital
  totalCommitted: numeric('total_committed', { precision: 15, scale: 2 }).default('0'),
  totalCalled: numeric('total_called', { precision: 15, scale: 2 }).default('0'),
  totalDistributed: numeric('total_distributed', { precision: 15, scale: 2 }).default('0'),
  totalReturned: numeric('total_returned', { precision: 15, scale: 2 }).default('0'),
  nav: numeric('nav', { precision: 15, scale: 2 }).default('0'),
  // Net Asset Value
  
  // Key dates
  closingDate: date('closing_date'), // first close
  finalClosingDate: date('final_closing_date'),
  investmentPeriodEnd: date('investment_period_end'),
  // Typically 3-5 years after final close
  fundTermEnd: date('fund_term_end'),
  // Typically 7-10 years after final close
  extensionOptions: jsonb('extension_options'),
  // [{ months: 12, conditions: 'GP discretion' }, { months: 12, conditions: 'LP majority approval' }]
  
  // Economics
  managementFeeRate: numeric('management_fee_rate', { precision: 5, scale: 3 }),
  // % of committed (or invested) capital
  managementFeeBasis: varchar('management_fee_basis', { length: 50 }),
  // 'committed_capital' | 'invested_capital' | 'net_asset_value'
  managementFeeStepDown: jsonb('management_fee_step_down'),
  // [{ afterInvestmentPeriod: true, rate: 0.015 }]
  preferredReturn: numeric('preferred_return', { precision: 5, scale: 3 }),
  // % (e.g., 0.08 = 8%)
  gpCatchUp: boolean('gp_catch_up').default(false),
  gpCatchUpRate: numeric('gp_catch_up_rate', { precision: 5, scale: 3 }),
  carriedInterest: numeric('carried_interest', { precision: 5, scale: 3 }),
  // % (e.g., 0.20 = 20%)
  waterfallType: varchar('waterfall_type', { length: 50 }),
  // 'european' | 'american' | 'tiered'
  
  // Expenses
  organizationalExpenseCap: numeric('org_expense_cap', { precision: 10, scale: 2 }),
  annualExpenseRatioCap: numeric('annual_expense_ratio_cap', { precision: 5, scale: 3 }),
  
  // Status
  status: varchar('status', { length: 30 }),
  // fundraising | investing | harvesting | wound_down
  
  deals: integer('deals').default(0), // count of deals in fund
  createdAt: timestamp('created_at').defaultNow(),
});

export const fundDeals = pgTable('fund_deals', {
  id: serial('id').primaryKey(),
  fundId: integer('fund_id').references(() => funds.id),
  dealId: integer('deal_id').references(() => deals.id),
  allocationPct: numeric('allocation_pct', { precision: 8, scale: 4 }),
  // What % of fund capital is in this deal
  allocatedEquity: numeric('allocated_equity', { precision: 15, scale: 2 }),
  investedEquity: numeric('invested_equity', { precision: 15, scale: 2 }),
  currentValue: numeric('current_value', { precision: 15, scale: 2 }),
  realizedProceeds: numeric('realized_proceeds', { precision: 15, scale: 2 }).default('0'),
  isRealizedDeal: boolean('is_realized_deal').default(false),
  realization_date: date('realization_date'),
  addedAt: timestamp('added_at').defaultNow(),
});

export const managementFeeInvoices = pgTable('management_fee_invoices', {
  id: serial('id').primaryKey(),
  fundId: integer('fund_id').references(() => funds.id),
  orgId: integer('org_id').references(() => organizations.id),
  period: varchar('period', { length: 20 }), // 'Q1-2025'
  periodStart: date('period_start'),
  periodEnd: date('period_end'),
  basis: numeric('basis', { precision: 15, scale: 2 }),
  // The capital base the fee is calculated on
  feeRate: numeric('fee_rate', { precision: 5, scale: 4 }),
  grossFee: numeric('gross_fee', { precision: 12, scale: 2 }),
  expenseOffset: numeric('expense_offset', { precision: 12, scale: 2 }).default('0'),
  netFee: numeric('net_fee', { precision: 12, scale: 2 }),
  status: varchar('status', { length: 20 }), // draft | invoiced | paid
  invoicedAt: timestamp('invoiced_at'),
  paidAt: timestamp('paid_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const carriedInterestAccrual = pgTable('carried_interest_accrual', {
  id: serial('id').primaryKey(),
  fundId: integer('fund_id').references(() => funds.id),
  asOf: date('as_of'),
  totalDistributed: numeric('total_distributed', { precision: 15, scale: 2 }),
  returnOfCapital: numeric('return_of_capital', { precision: 15, scale: 2 }),
  preferredReturnPaid: numeric('preferred_return_paid', { precision: 15, scale: 2 }),
  gpCatchUpPaid: numeric('gp_catch_up_paid', { precision: 15, scale: 2 }),
  carriedInterestEarned: numeric('carried_interest_earned', { precision: 12, scale: 2 }),
  carriedInterestPaid: numeric('carried_interest_paid', { precision: 12, scale: 2 }),
  carriedInterestAccrued: numeric('carried_interest_accrued', { precision: 12, scale: 2 }),
  // Accrued but not yet distributed to GP
  lpIRRToDate: numeric('lp_irr_to_date', { precision: 6, scale: 4 }),
  fundIRRToDate: numeric('fund_irr_to_date', { precision: 6, scale: 4 }),
  tvpi: numeric('tvpi', { precision: 6, scale: 4 }),
  // Total Value to Paid-In Capital
  dpi: numeric('dpi', { precision: 6, scale: 4 }),
  // Distributions to Paid-In Capital
  rvpi: numeric('rvpi', { precision: 6, scale: 4 }),
  // Residual Value to Paid-In Capital
  calculatedAt: timestamp('calculated_at').defaultNow(),
});
```

### Fund-Level Financial Calculations

```typescript
// lib/funds/fundCalculator.ts

export class FundCalculator {
  
  // Calculate fund-level IRR (XIRR across all LP cash flows)
  async calculateFundIRR(fundId: number): Promise<number> {
    const cashFlows = await getAllFundCashFlows(fundId);
    // Negative: capital calls (cash out from LP perspective)
    // Positive: distributions (cash in from LP perspective)
    // Final: current NAV (as terminal value)
    const nav = await getFundNAV(fundId);
    const allFlows = [
      ...cashFlows.map(cf => ({
        amount: cf.type === 'call' ? -cf.amount : cf.amount,
        date: cf.date,
      })),
      { amount: nav, date: new Date() }, // terminal value
    ];
    return calculateXIRR(allFlows);
  }
  
  // Calculate management fee for a period
  calculateManagementFee(
    fund: Fund,
    periodStart: Date,
    periodEnd: Date
  ): ManagementFeeCalc {
    const daysInPeriod = getDaysBetween(periodStart, periodEnd);
    const daysInYear = 365;
    
    let basis: number;
    switch (fund.managementFeeBasis) {
      case 'committed_capital':
        basis = fund.totalCommitted;
        break;
      case 'invested_capital':
        basis = fund.totalCalled - fund.totalDistributedROC;
        break;
      case 'net_asset_value':
        basis = fund.nav;
        break;
    }
    
    // Check if in investment period or post-investment period
    const inInvestmentPeriod = new Date() <= new Date(fund.investmentPeriodEnd);
    const rate = inInvestmentPeriod
      ? fund.managementFeeRate
      : (fund.managementFeeStepDown?.postPeriodRate || fund.managementFeeRate * 0.75);
    
    const grossFee = basis * rate * (daysInPeriod / daysInYear);
    
    return { basis, rate, grossFee, daysInPeriod };
  }
  
  // Calculate TVPI, DPI, RVPI (industry-standard PE return metrics)
  async calculateFundMetrics(fundId: number): Promise<FundMetrics> {
    const fund = await getFundById(fundId);
    const paidInCapital = fund.totalCalled;
    const totalDistributions = fund.totalDistributed;
    const nav = fund.nav;
    
    return {
      tvpi: (totalDistributions + nav) / paidInCapital,
      dpi: totalDistributions / paidInCapital,
      rvpi: nav / paidInCapital,
      moic: (totalDistributions + nav) / paidInCapital, // same as TVPI
      fundIRR: await this.calculateFundIRR(fundId),
      lpIRR: await this.calculateLPIRR(fundId), // net of fees
      carriedInterestEarned: await this.calculateCarriedInterest(fund),
    };
  }
}
```

### Fund Dashboard UI

```typescript
// pages/funds/FundDashboard.tsx

// Top section: Fund selector dropdown (if multiple funds)
// Fund header: name | vintage | status badge | target size vs. committed progress bar

// KPI row (8 cards):
// Total Committed | Called % | DPI | RVPI | TVPI | Net IRR | Carried Earned | NAV

// Three column layout:
// Col 1: Capital Summary
//   - Committed: $XXM
//   - Called: $XXM (XX%)
//   - Uncalled: $XXM (XX%)
//   - Distributed: $XXM
//   - NAV: $XXM
//   - Management Fee YTD: $XXM
//   - Accrued Carry: $XXM

// Col 2: Deal Portfolio
//   - List of deals with allocation %, invested equity, current value, IRR
//   - Add Deal button
//   - Remaining capacity for new deals

// Col 3: LP Summary
//   - Total LPs | Total Committed
//   - Top 5 LPs by commitment (anonymized for privacy unless admin)
//   - Capital call status (X of Y fully funded)

// Charts row:
// - Capital deployment timeline (monthly invested capital bar chart)
// - Distributions timeline (actual vs. projected)
// - Vintage J-curve (IRR over fund life, projected vs. actual)

// Management Fees tab:
// - Fee calculator for current period (auto-calculates)
// - Fee history table
// - "Generate Invoice" button
// - Fee schedule (how fee changes over fund life)

// Carried Interest tab:
// - Current carry position (earned, paid, accrued)
// - Waterfall progress visualization
// - Carry schedule by LP
```

---

## B.2 Fund Formation Document Automation

### Overview
Automates the creation and tracking of key fund formation documents. Provides templates and a key terms tracker for PPM, LPA, subscription agreements, and side letters.

### Data Models

```typescript
export const fundDocuments = pgTable('fund_documents', {
  id: serial('id').primaryKey(),
  fundId: integer('fund_id').references(() => funds.id),
  orgId: integer('org_id').references(() => organizations.id),
  documentType: varchar('document_type', { length: 100 }),
  // ppm | lpa | subscription_agreement | side_letter | advisory_committee_agreement
  // management_agreement | placement_agent_agreement | operating_agreement
  version: varchar('version', { length: 20 }), // 'v1.0' | 'Final' | 'Execution Copy'
  status: varchar('status', { length: 30 }),
  // draft | legal_review | lp_review | final | executed
  documentUrl: varchar('document_url', { length: 500 }),
  keyTerms: jsonb('key_terms'),
  // Extracted key terms for quick reference (populated by AI extraction)
  counselFirm: varchar('counsel_firm', { length: 255 }),
  counselAttorney: varchar('counsel_attorney', { length: 255 }),
  lastReviewedAt: timestamp('last_reviewed_at'),
  executedAt: timestamp('executed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const lpaKeyTerms = pgTable('lpa_key_terms', {
  id: serial('id').primaryKey(),
  fundId: integer('fund_id').references(() => funds.id),
  // Economics
  managementFee: text('management_fee'),
  // e.g., "2% of committed capital during investment period, 1.5% thereafter"
  preferredReturn: varchar('preferred_return', { length: 100 }),
  catchUp: varchar('catch_up', { length: 100 }),
  carriedInterest: varchar('carried_interest', { length: 100 }),
  waterfallDescription: text('waterfall_description'),
  // Governance
  keyPersonProvision: text('key_person_provision'),
  removalRights: text('removal_rights'),
  lpacComposition: text('lpac_composition'),
  // LP Advisory Committee
  fundTermination: text('fund_termination'),
  investmentPeriod: varchar('investment_period', { length: 100 }),
  fundTerm: varchar('fund_term', { length: 100 }),
  extensionRights: text('extension_rights'),
  // Investment restrictions
  concentrationLimits: text('concentration_limits'),
  geographicRestrictions: text('geographic_restrictions'),
  assetClassRestrictions: text('asset_class_restrictions'),
  leverage: text('leverage'),
  coInvestmentRights: text('co_investment_rights'),
  // LP rights
  transferRestrictions: text('transfer_restrictions'),
  defaultProvisions: text('default_provisions'),
  excusedInvestments: text('excused_investments'),
  reportingObligations: text('reporting_obligations'),
  auditorName: varchar('auditor_name', { length: 255 }),
  taxReportingDeadline: varchar('tax_reporting_deadline', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Side letters — track deviations from standard LPA terms per LP
export const sideLetters = pgTable('side_letters', {
  id: serial('id').primaryKey(),
  fundId: integer('fund_id').references(() => funds.id),
  investorId: integer('investor_id').references(() => investors.id),
  documentUrl: varchar('document_url', { length: 500 }),
  provisions: jsonb('provisions'),
  // [{ type: 'mfn', description: 'MFN clause - entitled to same terms as any future LP', field: 'management_fee' }]
  // [{ type: 'fee_discount', description: '1.5% instead of 2.0% management fee', field: 'management_fee', value: 0.015 }]
  // [{ type: 'excuse_right', description: 'May excuse itself from investments in X sector' }]
  // [{ type: 'reporting', description: 'Monthly instead of quarterly reports' }]
  executedAt: timestamp('executed_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### AI Key Terms Extractor

```typescript
// POST /api/funds/:fundId/documents/extract-terms
// Accepts PDF of LPA/PPM → AI extracts all key terms → populates lpaKeyTerms table
// Uses same document intelligence pipeline as lease abstractor

// Side letter conflict detector:
// After adding side letter, checks if any provision conflicts with:
//   - LPA terms
//   - Other LP side letters
//   - MFN obligations (if other LP has MFN, new favorable terms trigger notification)
```

### Fund Documents UI

```typescript
// pages/funds/FundDocuments.tsx

// Document library with type tabs:
// PPM | LPA | Subscription Agreements | Side Letters | Other

// Key Terms Summary panel:
// Visual summary of LPA key terms in structured format
// AI-extracted from uploaded LPA
// Edit in-line with change tracking
// "Compare to Market Standard" AI analysis button

// Side Letters matrix:
// Table showing all LPs with side letter vs. no side letter
// For each LP, which provisions they have
// MFN compliance tracker: when new favorable terms are granted,
//   shows which other LPs have MFN rights that may be triggered

// Subscription Agreement status:
// Per-LP table: sent | signed | returned | complete
// "Send via DocuSign" bulk action
// Missing subscriptions highlighted
```

---

## B.3 Investor Accreditation & KYC/AML Workflow

### Overview
Complete LP onboarding compliance flow: accreditation verification, KYC document collection, AML screening, and investor qualification tracking. Integrates with Persona (or similar) for automated verification.

### Data Models

```typescript
export const investorVerification = pgTable('investor_verification', {
  id: serial('id').primaryKey(),
  investorId: integer('investor_id').references(() => investors.id),
  orgId: integer('org_id').references(() => organizations.id),
  
  // Accreditation
  accreditationMethod: varchar('accreditation_method', { length: 100 }),
  // income_verification | net_worth | professional_certification
  // entity_assets | qualified_purchaser | registered_investment_adviser
  accreditationStatus: varchar('accreditation_status', { length: 30 }),
  // pending | approved | rejected | expired
  accreditationExpiresAt: timestamp('accreditation_expires_at'),
  // 90 days from verification per Reg D
  accreditationDocIds: jsonb('accreditation_doc_ids'),
  // CPA letter, broker statement, etc.
  accreditationVerifiedBy: varchar('accreditation_verified_by', { length: 100 }),
  // 'persona' | 'manual' | 'third_party_letter'
  
  // KYC
  kycStatus: varchar('kyc_status', { length: 30 }),
  // pending | in_progress | approved | failed | requires_review
  kycProvider: varchar('kyc_provider', { length: 50 }), // 'persona' | 'jumio' | 'manual'
  kycExternalId: varchar('kyc_external_id', { length: 255 }),
  // Reference ID in KYC provider's system
  kycDocuments: jsonb('kyc_documents'),
  // [{ type: 'passport', status: 'verified', uploadedAt }]
  kycCompletedAt: timestamp('kyc_completed_at'),
  
  // AML / OFAC screening
  amlStatus: varchar('aml_status', { length: 30 }),
  // pending | cleared | flagged | blocked
  amlScreenedAt: timestamp('aml_screened_at'),
  amlProvider: varchar('aml_provider', { length: 50 }),
  amlReferenceId: varchar('aml_reference_id', { length: 255 }),
  amlHitDetails: jsonb('aml_hit_details'), // if flagged, what was found
  
  // PEP / Sanctions screening
  pepStatus: varchar('pep_status', { length: 30 }), // cleared | flagged | unknown
  // PEP = Politically Exposed Person
  sanctionsStatus: varchar('sanctions_status', { length: 30 }),
  
  // Overall status
  overallStatus: varchar('overall_status', { length: 30 }),
  // pending | complete | failed | requires_review
  reviewedBy: integer('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  reviewNotes: text('review_notes'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const kycDocumentUploads = pgTable('kyc_document_uploads', {
  id: serial('id').primaryKey(),
  investorId: integer('investor_id').references(() => investors.id),
  documentType: varchar('document_type', { length: 50 }),
  // government_id | passport | utility_bill | bank_statement | articles_of_incorporation
  // trust_agreement | operating_agreement | tax_return | brokerage_statement
  documentUrl: varchar('document_url', { length: 500 }), // encrypted storage
  uploadedAt: timestamp('uploaded_at').defaultNow(),
  verifiedAt: timestamp('verified_at'),
  verificationStatus: varchar('verification_status', { length: 30 }),
  expiresAt: timestamp('expires_at'),
});
```

### Persona Integration

```typescript
// lib/kyc/personaIntegration.ts
// Persona: https://withpersona.com — industry standard KYC/AML provider

export class PersonaKYC {
  
  // Create inquiry for individual investor
  async createIndividualInquiry(investor: Investor): Promise<string> {
    const response = await fetch('https://withpersona.com/api/v1/inquiries', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERSONA_API_KEY}`,
        'Persona-Version': '2023-01-05',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          type: 'inquiry',
          attributes: {
            'inquiry-template-id': process.env.PERSONA_TEMPLATE_ID,
            fields: {
              'name-first': investor.firstName,
              'name-last': investor.lastName,
              'email-address': investor.email,
            },
            'meta': { orgId: investor.orgId, investorId: investor.id },
          },
        },
      }),
    });
    const data = await response.json();
    return data.data.id; // Persona inquiry ID
  }
  
  // Create inquiry for entity (LLC, Trust, Corp)
  async createEntityInquiry(investor: Investor): Promise<string> {
    // Business verification flow — different template
    const response = await fetch('https://withpersona.com/api/v1/inquiries', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.PERSONA_API_KEY}` },
      body: JSON.stringify({
        data: {
          attributes: {
            'inquiry-template-id': process.env.PERSONA_ENTITY_TEMPLATE_ID,
            fields: {
              'business-name': investor.legalName,
              'business-ein': investor.taxId,
            },
          },
        },
      }),
    });
    const data = await response.json();
    return data.data.id;
  }
  
  // Handle Persona webhook on inquiry completion
  async handleWebhook(event: PersonaEvent): Promise<void> {
    if (event.name === 'inquiry.approved') {
      await updateInvestorKYC(event.data.id, 'approved');
    } else if (event.name === 'inquiry.failed') {
      await updateInvestorKYC(event.data.id, 'failed');
      await notifyComplianceTeam(event.data.id);
    }
  }
}
```

### LP Onboarding Flow UI

```typescript
// Investor onboarding wizard (LP-facing):
// Step 1: Create account + basic profile
// Step 2: Investor type (individual / entity / trust / retirement account)
// Step 3: Accreditation qualification questionnaire
//   - Income-based: "Did you earn > $200k individually in each of the last 2 years?"
//   - Net worth: "Do you have > $1M net worth excluding primary residence?"
//   - Professional: "Are you a registered investment professional?"
//   → Based on answers, determine qualification method
// Step 4: KYC document upload
//   - Individual: Government ID + selfie (via Persona SDK embedded in app)
//   - Entity: Articles of incorporation, EIN letter, beneficial ownership list
// Step 5: Accreditation document upload
//   - CPA/attorney letter, or
//   - Brokerage statement (AI extracts balance), or
//   - Tax return (last 2 years)
// Step 6: Beneficial ownership (for entities)
//   - List all owners > 25% stake
//   - Each must complete individual KYC
// Step 7: Bank/wire instructions for distributions
// Step 8: Sign investor certification + representations
// Step 9: Pending review state (compliance team reviews)

// GP-side compliance dashboard:
// Table of all investors: Status | KYC | AML | Accreditation | Last Updated
// Filter: Pending | Complete | Failed | Expiring Soon
// "Review" button → shows all docs, AI-extracted data, Persona results
// Approve/Request Info/Reject actions
// 90-day accreditation expiry alerts
// Bulk re-verification workflow for annual renewal
```

---

## B.4 Capital Account Ledger

### Overview
Double-entry accounting ledger for LP capital accounts. Every financial event — capital contributions, distributions, management fee allocations, expense allocations, unrealized gains — creates ledger entries that tie out to audited financials.

### Data Models

```typescript
// schema/capitalAccountLedger.ts

// Each LP has a capital account per fund
export const capitalAccounts = pgTable('capital_accounts', {
  id: serial('id').primaryKey(),
  fundId: integer('fund_id').references(() => funds.id),
  investorId: integer('investor_id').references(() => investors.id),
  investmentId: integer('investment_id').references(() => investments.id),
  
  // Current balances (maintained as running totals for performance)
  openingBalance: numeric('opening_balance', { precision: 15, scale: 2 }).default('0'),
  // Balance at start of current fiscal year
  
  // YTD activity
  contributionsYTD: numeric('contributions_ytd', { precision: 15, scale: 2 }).default('0'),
  distributionsYTD: numeric('distributions_ytd', { precision: 15, scale: 2 }).default('0'),
  managementFeesYTD: numeric('management_fees_ytd', { precision: 15, scale: 2 }).default('0'),
  expensesYTD: numeric('expenses_ytd', { precision: 15, scale: 2 }).default('0'),
  netIncomeAllocationYTD: numeric('net_income_allocation_ytd', { precision: 15, scale: 2 }).default('0'),
  unrealizedGainLossYTD: numeric('unrealized_gain_loss_ytd', { precision: 15, scale: 2 }).default('0'),
  
  // All-time totals
  totalContributions: numeric('total_contributions', { precision: 15, scale: 2 }).default('0'),
  totalDistributions: numeric('total_distributions', { precision: 15, scale: 2 }).default('0'),
  totalManagementFees: numeric('total_management_fees', { precision: 15, scale: 2 }).default('0'),
  
  // Current ending balance
  endingBalance: numeric('ending_balance', { precision: 15, scale: 2 }).default('0'),
  // = openingBalance + contributions - distributions - fees - expenses + income + unrealized
  
  ownershipPct: numeric('ownership_pct', { precision: 8, scale: 6 }),
  // Fund ownership % at current period
  
  fiscalYearEnd: date('fiscal_year_end'),
  lastUpdatedAt: timestamp('last_updated_at').defaultNow(),
});

export const capitalAccountEntries = pgTable('capital_account_entries', {
  id: bigserial('id').primaryKey(),
  capitalAccountId: integer('capital_account_id').references(() => capitalAccounts.id),
  fundId: integer('fund_id').references(() => funds.id),
  investorId: integer('investor_id').references(() => investors.id),
  
  entryDate: date('entry_date'),
  period: varchar('period', { length: 20 }), // 'Q1-2025'
  
  entryType: varchar('entry_type', { length: 50 }),
  // contribution | distribution_roc | distribution_income | distribution_gain
  // management_fee | fund_expense | income_allocation | unrealized_gain
  // unrealized_loss | realization_gain | realization_loss
  
  description: varchar('description', { length: 500 }),
  debitAmount: numeric('debit_amount', { precision: 15, scale: 2 }).default('0'),
  creditAmount: numeric('credit_amount', { precision: 15, scale: 2 }).default('0'),
  // Double-entry: debit increases asset accounts, credit decreases
  netAmount: numeric('net_amount', { precision: 15, scale: 2 }),
  // Signed: positive = increases capital account, negative = decreases
  
  referenceId: integer('reference_id'),
  referenceType: varchar('reference_type', { length: 50 }),
  // 'capital_call' | 'distribution' | 'management_fee_invoice' | 'valuation'
  
  approvedBy: integer('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  
  createdAt: timestamp('created_at').defaultNow(),
  // IMMUTABLE — no updated_at
});

// Periodic valuations (for unrealized gain/loss calculations)
export const fundValuations = pgTable('fund_valuations', {
  id: serial('id').primaryKey(),
  fundId: integer('fund_id').references(() => funds.id),
  valuationDate: date('valuation_date'),
  period: varchar('period', { length: 20 }),
  totalFMV: numeric('total_fmv', { precision: 15, scale: 2 }),
  // Fair Market Value of all fund assets
  totalCost: numeric('total_cost', { precision: 15, scale: 2 }),
  // Invested cost basis
  unrealizedGainLoss: numeric('unrealized_gain_loss', { precision: 15, scale: 2 }),
  valuationMethod: varchar('valuation_method', { length: 50 }),
  // dcf | comparable_sales | nav | book_value | appraisal
  valuationFirm: varchar('valuation_firm', { length: 255 }),
  // null if internal; name if third-party appraiser
  isAudited: boolean('is_audited').default(false),
  auditFirm: varchar('audit_firm', { length: 255 }),
  dealValuations: jsonb('deal_valuations'),
  // [{ dealId, fmv, cost, unrealizedGL }]
  createdAt: timestamp('created_at').defaultNow(),
});
```

### Capital Account Statement Generator

```typescript
// Generates period-end capital account statement per LP
// Standard sections:
// 1. Opening balance
// 2. Capital contributions in period
// 3. Distributions in period (by type: ROC, income, gain)
// 4. Management fee allocation
// 5. Fund expense allocation
// 6. Net income/loss allocation
// 7. Unrealized gain/loss
// 8. Ending balance
// 9. IRR and multiple to date

// POST /api/capital-accounts/:fundId/generate-statements
// Generates statements for all LPs for a given period
// Returns PDF per LP (or bulk ZIP)
// Auto-stores in LP document vault
```

---

## B.5 Management Fee & Promote Calculator

### Overview
Automates the GP's economics tracking: management fee calculations, invoicing, carried interest accrual, catch-up tracking, and promote realization modeling.

### Management Fee Calculator

```typescript
// lib/funds/feeCalculator.ts

export class FeeCalculator {
  
  // Auto-calculate quarterly management fee for all funds
  async calculateAllFees(orgId: number, period: string): Promise<ManagementFeeInvoice[]> {
    const funds = await getActiveFunds(orgId);
    const invoices: ManagementFeeInvoice[] = [];
    
    for (const fund of funds) {
      const invoice = await this.calculateFundFee(fund, period);
      invoices.push(invoice);
    }
    
    return invoices;
  }
  
  async calculateFundFee(fund: Fund, period: string): Promise<ManagementFeeInvoice> {
    const { start, end } = getPeriodDates(period);
    const daysInPeriod = getDaysBetween(start, end);
    
    // Determine basis
    let basis: number;
    if (fund.managementFeeBasis === 'committed_capital') {
      basis = await getFundCommittedCapital(fund.id, end);
    } else if (fund.managementFeeBasis === 'invested_capital') {
      basis = await getFundInvestedCapital(fund.id, end);
    } else {
      basis = await getFundNAV(fund.id, end);
    }
    
    // Determine rate (may step down after investment period)
    const inInvestmentPeriod = end <= new Date(fund.investmentPeriodEnd);
    const rate = inInvestmentPeriod
      ? fund.managementFeeRate
      : getStepDownRate(fund, end);
    
    const grossFee = basis * rate * (daysInPeriod / 365);
    
    // Apply offsets (deal fees credited against management fee)
    const dealFeeOffset = await getDealFeeOffset(fund.id, period);
    const netFee = Math.max(0, grossFee - dealFeeOffset);
    
    return {
      fundId: fund.id,
      period,
      periodStart: start,
      periodEnd: end,
      basis,
      feeRate: rate,
      grossFee,
      expenseOffset: dealFeeOffset,
      netFee,
      status: 'draft',
    };
  }
  
  // Allocate fee to each LP proportionally
  async allocateFeeToLPs(invoiceId: number): Promise<LPFeeAllocation[]> {
    const invoice = await getFeeInvoice(invoiceId);
    const lpOwnershipPcts = await getLPOwnershipPcts(invoice.fundId, invoice.periodEnd);
    
    return lpOwnershipPcts.map(lp => ({
      investorId: lp.investorId,
      capitalAccountId: lp.capitalAccountId,
      allocationPct: lp.ownershipPct,
      feeAmount: invoice.netFee * (lp.ownershipPct / 100),
    }));
  }
  
  // Calculate carried interest position
  async calculateCarryPosition(fundId: number): Promise<CarryPosition> {
    const fund = await getFundById(fundId);
    const totalDistributed = fund.totalDistributed;
    const totalCalled = fund.totalCalled;
    let remaining = totalDistributed;
    const tiers: CarryTier[] = [];
    
    // Tier 1: Return of capital
    const rocAmount = Math.min(remaining, totalCalled);
    tiers.push({ name: 'Return of Capital', lpAmount: rocAmount, gpAmount: 0 });
    remaining -= rocAmount;
    
    // Tier 2: Preferred return
    const prefAmount = calculateAccruedPref(fund, totalCalled);
    const prefPaid = Math.min(remaining, prefAmount);
    tiers.push({ name: `${fund.preferredReturn * 100}% Preferred Return`, lpAmount: prefPaid, gpAmount: 0 });
    remaining -= prefPaid;
    
    // Tier 3: GP catch-up (if applicable)
    if (fund.gpCatchUp && remaining > 0) {
      const catchUpAmount = calculateCatchUp(fund, prefPaid, remaining);
      tiers.push({ name: 'GP Catch-Up', lpAmount: 0, gpAmount: catchUpAmount });
      remaining -= catchUpAmount;
    }
    
    // Tier 4: Carried interest split
    if (remaining > 0) {
      const gpCarry = remaining * fund.carriedInterest;
      const lpShare = remaining * (1 - fund.carriedInterest);
      tiers.push({ name: `${fund.carriedInterest * 100}% Carried Interest`, lpAmount: lpShare, gpAmount: gpCarry });
    }
    
    return {
      totalDistributed,
      tiers,
      totalGPReceived: tiers.reduce((s, t) => s + t.gpAmount, 0),
      totalLPReceived: tiers.reduce((s, t) => s + t.lpAmount, 0),
      carryEarned: tiers.find(t => t.name.includes('Carried'))?.gpAmount || 0,
    };
  }
}
```

---

# PART C — TENANT & PROPERTY MANAGEMENT

---

## C.1 Tenant Portal

### Overview
Tenant-facing web interface for online rent payment, maintenance request submission, lease document access, and communication with management. Accessible at a custom subdomain.

### Data Models

```typescript
export const tenantUsers = pgTable('tenant_users', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  dealId: integer('deal_id').references(() => deals.id),
  leaseId: integer('lease_id').references(() => leases.id),
  email: varchar('email', { length: 255 }).unique(),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  phone: varchar('phone', { length: 50 }),
  passwordHash: varchar('password_hash', { length: 255 }),
  isActive: boolean('is_active').default(true),
  portalAccessEnabled: boolean('portal_access_enabled').default(true),
  lastLoginAt: timestamp('last_login_at'),
  inviteSentAt: timestamp('invite_sent_at'),
  inviteAcceptedAt: timestamp('invite_accepted_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const tenantMessages = pgTable('tenant_messages', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  dealId: integer('deal_id').references(() => deals.id),
  leaseId: integer('lease_id').references(() => leases.id),
  tenantUserId: integer('tenant_user_id').references(() => tenantUsers.id),
  direction: varchar('direction', { length: 10 }), // 'inbound' | 'outbound'
  subject: varchar('subject', { length: 255 }),
  body: text('body'),
  isRead: boolean('is_read').default(false),
  readAt: timestamp('read_at'),
  respondedBy: integer('responded_by').references(() => users.id),
  respondedAt: timestamp('responded_at'),
  attachments: jsonb('attachments'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### Tenant Portal Pages

```typescript
// Portal URL: tenant.marinamatch.com or tenant.[org-domain].com

// Page 1: Dashboard
//   - Property address + unit number
//   - Current balance / next due date
//   - "Pay Rent" CTA button
//   - Open maintenance requests with status
//   - Recent messages (last 3)
//   - Lease expiration countdown

// Page 2: Payments
//   - Current balance breakdown: rent + fees + late fees
//   - Payment history table (date, amount, method, status)
//   - "Make Payment" button → Stripe payment form
//   - ACH bank account management
//   - Auto-pay enrollment (pay on 1st of month automatically)
//   - Download receipt for any payment
//   - "My Ledger" — full transaction history

// Page 3: Maintenance Requests
//   - Submit new request form:
//     • Category (Plumbing / HVAC / Electrical / Appliance / Other)
//     • Description
//     • Urgency (Emergency / Urgent / Routine)
//     • Photo upload (up to 5 photos)
//     • Preferred access times
//   - Open requests table with status (Received / Scheduled / In Progress / Resolved)
//   - Resolved requests history
//   - Contact PM button for each open request

// Page 4: Lease & Documents
//   - Active lease summary card (term, monthly rent, key dates)
//   - Download current lease
//   - Download lease amendments
//   - Move-in inspection report
//   - Renter's insurance requirement (if applicable)

// Page 5: Messages
//   - Inbox/outbox with property management
//   - New message compose form
//   - Notification preferences (email + SMS)

// Onboarding flow:
// GP sends invite email to tenant
// Tenant clicks link → sets password → portal access granted
// Welcome screen with getting started guide
```

---

## C.2 Online Rent Collection

### Overview
ACH and card-based rent payment processing via Stripe. Handles the full payment lifecycle: collection, allocation, reconciliation, late fees, NSF handling, and ledger posting.

### Implementation

```typescript
// lib/rentCollection/stripeConnect.ts
// Using Stripe Connect (platform model) so each landlord receives payments directly

export class RentCollectionService {
  
  // Create payment intent for rent
  async createPaymentIntent(
    leaseId: number,
    amount: number,
    method: 'ach' | 'card'
  ): Promise<PaymentIntentResult> {
    const lease = await getLeaseById(leaseId);
    const deal = await getDealById(lease.dealId);
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // cents
      currency: 'usd',
      payment_method_types: method === 'ach' ? ['us_bank_account'] : ['card'],
      application_fee_amount: Math.round(amount * 0.015 * 100),
      // 1.5% platform fee (optional — can be zero)
      transfer_data: {
        destination: deal.stripeConnectAccountId,
        // Funds go directly to landlord's Stripe account
      },
      metadata: {
        leaseId: leaseId.toString(),
        dealId: lease.dealId.toString(),
        tenantId: lease.tenantUserId.toString(),
        paymentType: 'rent',
        period: getCurrentRentPeriod(),
      },
    });
    
    return { clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id };
  }
  
  // Auto-calculate late fee
  async calculateLateFee(leaseId: number, paymentDate: Date): Promise<number> {
    const lease = await getLeaseById(leaseId);
    const gracePeriodEnd = addDays(getDueDateForPeriod(lease), lease.gracePeriodDays || 5);
    
    if (paymentDate <= gracePeriodEnd) return 0;
    
    const daysLate = getDaysBetween(gracePeriodEnd, paymentDate);
    
    if (lease.lateFeeType === 'flat') {
      return lease.lateFeeAmount;
    } else if (lease.lateFeeType === 'daily') {
      return lease.lateFeeAmount * daysLate;
    } else if (lease.lateFeeType === 'percentage') {
      return lease.monthlyRent * (lease.lateFeeRate / 100);
    }
    return 0;
  }
  
  // Handle NSF / failed payment
  async handleFailedPayment(paymentIntentId: string): Promise<void> {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    const { leaseId } = pi.metadata;
    const lease = await getLeaseById(parseInt(leaseId));
    
    // Apply NSF fee if configured
    const nsfFee = lease.nsfFeeAmount || 35;
    await addChargeToLedger(leaseId, nsfFee, 'nsf_fee');
    
    // Notify tenant + property manager
    await sendFailedPaymentNotification(lease.tenantUserId, nsfFee);
    await sendGPNotification(lease.dealId, `NSF on lease ${leaseId} — ${lease.tenantName}`);
    
    // Update lease status
    await updateLeasePaymentStatus(leaseId, 'payment_failed');
  }
}

// Data model for payments
export const rentPayments = pgTable('rent_payments', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  dealId: integer('deal_id').references(() => deals.id),
  leaseId: integer('lease_id').references(() => leases.id),
  tenantUserId: integer('tenant_user_id').references(() => tenantUsers.id),
  amount: numeric('amount', { precision: 10, scale: 2 }),
  lateFeeAmount: numeric('late_fee_amount', { precision: 10, scale: 2 }).default('0'),
  nsfFeeAmount: numeric('nsf_fee_amount', { precision: 10, scale: 2 }).default('0'),
  totalAmount: numeric('total_amount', { precision: 10, scale: 2 }),
  method: varchar('method', { length: 20 }), // ach | card | check | wire | cash
  status: varchar('status', { length: 20 }),
  // pending | processing | succeeded | failed | refunded | nsf
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
  stripeChargeId: varchar('stripe_charge_id', { length: 255 }),
  periodStart: date('period_start'), // what rent period this covers
  periodEnd: date('period_end'),
  processedAt: timestamp('processed_at'),
  failedAt: timestamp('failed_at'),
  failureReason: varchar('failure_reason', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// Reconciliation job (runs nightly):
// Matches Stripe payouts to expected rent amounts
// Flags any discrepancies
// Posts to financial model actuals
// Generates monthly rent receipt email to tenant
```

---

## C.3 Lease Renewal Workflow

### Overview
End-to-end lease renewal management: expiry monitoring, renewal offer generation, negotiation tracking, counter-offer logging, amendment execution, and rent roll update.

### Data Models

```typescript
export const leaseRenewalOpportunities = pgTable('lease_renewal_opportunities', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  dealId: integer('deal_id').references(() => deals.id),
  leaseId: integer('lease_id').references(() => leases.id),
  
  status: varchar('status', { length: 50 }),
  // monitoring | outreach_sent | in_negotiation | renewal_offered
  // renewal_accepted | renewal_declined | vacating | renewed | extended
  
  leaseExpiryDate: date('lease_expiry_date'),
  daysUntilExpiry: integer('days_until_expiry'), // computed
  
  // Current lease terms
  currentRent: numeric('current_rent', { precision: 10, scale: 2 }),
  currentTermEnd: date('current_term_end'),
  
  // Renewal offer
  offerRent: numeric('offer_rent', { precision: 10, scale: 2 }),
  offerTermMonths: integer('offer_term_months'),
  offerSentAt: timestamp('offer_sent_at'),
  offerExpiresAt: timestamp('offer_expires_at'),
  
  // Counter offer
  counterRent: numeric('counter_rent', { precision: 10, scale: 2 }),
  counterTermMonths: integer('counter_term_months'),
  counterReceivedAt: timestamp('counter_received_at'),
  
  // Final agreed terms (after negotiation)
  agreedRent: numeric('agreed_rent', { precision: 10, scale: 2 }),
  agreedTermMonths: integer('agreed_term_months'),
  rentIncreasePct: numeric('rent_increase_pct', { precision: 5, scale: 2 }),
  
  // Execution
  amendmentDocId: integer('amendment_doc_id'),
  signatureRequestId: integer('signature_request_id'),
  signedAt: timestamp('signed_at'),
  
  // Market context
  marketRentEstimate: numeric('market_rent_estimate', { precision: 10, scale: 2 }),
  premiumDiscountVsMarket: numeric('premium_discount_vs_market', { precision: 5, scale: 2 }),
  
  notes: text('notes'),
  assignedTo: integer('assigned_to').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### Renewal Workflow Engine

```typescript
// Automated monitoring (daily job):
// Checks all active leases for expiry within:
//   180 days → create opportunity record, status: 'monitoring'
//   120 days → create task: "Begin renewal outreach for [tenant]"
//    90 days → send in-app alert + email to property manager
//    60 days → escalate to critical priority
//    30 days → critical alert to GP + default to 'vacating' assumption

// Renewal offer letter generator:
// POST /api/lease-renewals/:id/generate-offer
// AI generates formal renewal offer letter with:
//   - Current vs. proposed rent comparison
//   - New term proposal
//   - Response deadline
//   - Acceptance instructions
// Sends via email (and optionally DocuSign)

// Workflow stages UI:
// Kanban with columns: Monitoring | Outreach | In Negotiation | Offer Out | Accepted | Declined
// Drag deal renewal card between columns to advance workflow
// Each card shows: tenant name, unit, expiry date, current rent, offer rent, days remaining
// Color coding: green (>90 days) → yellow (60-90) → orange (30-60) → red (<30)
```

---

## C.4 Rent Roll Intelligence

### Overview
Advanced analytics on the rent roll across a property, including WALT, WALE, lease concentration risk, below/above-market analysis, and multi-year rollover exposure.

### Calculations

```typescript
// lib/leaseAnalytics/rentRollIntelligence.ts

export interface RentRollAnalysis {
  asOf: Date;
  dealId: number;
  
  // Occupancy
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  occupancyRate: number;
  physicalOccupancy: number; // % of units occupied
  economicOccupancy: number; // % of gross potential rent collected
  
  // Lease term analytics
  walt: number;      // Weighted Average Lease Term (years remaining)
  wale: number;      // Weighted Average Lease Expiry (date, as decimal year)
  avgRemainingTerm: number;
  
  // Rent analytics
  totalContractualRent: number;  // Sum of all leases as contracted
  totalGrossPotentialRent: number; // If 100% occupied at current rents
  averageRentPerUnit: number;
  averageRentPSF: number;
  
  // Market comparison
  avgMarketRentEstimate: number;
  avgRentToMarketRatio: number; // >1 = above market, <1 = below market
  markToMarketOpportunity: number; // $ of additional rent if all leases at market
  belowMarketLeases: LeaseSummary[]; // leases below market
  aboveMarketLeases: LeaseSummary[]; // leases above market (rollover risk)
  
  // Rollover analysis (next 5 years)
  rolloverSchedule: RolloverYear[];
  rolloverConcentrationRisk: string; // 'low' | 'medium' | 'high'
  highRiskRolloverYears: number[]; // years where >30% of rent expires
  
  // Tenant concentration
  topTenants: TenantConcentration[];
  singleTenantConcentration: number; // % of rent from largest tenant
  top3TenantConcentration: number;   // % of rent from top 3 tenants
  concentrationRisk: string; // 'low' | 'medium' | 'high'
}

interface RolloverYear {
  year: number;
  expiringLeases: number;
  expiringRentAmount: number;
  expiringRentPct: number; // % of total rent rolling
  cumulativeExpiringPct: number;
}

function calculateWALT(leases: Lease[], asOf: Date): number {
  const totalRent = leases.reduce((s, l) => s + l.monthlyRent, 0);
  const weightedTerms = leases.map(l => {
    const remainingMonths = getMonthsBetween(asOf, new Date(l.leaseEndDate));
    const remainingYears = Math.max(0, remainingMonths / 12);
    const weight = l.monthlyRent / totalRent;
    return remainingYears * weight;
  });
  return weightedTerms.reduce((s, v) => s + v, 0);
}
```

### Rent Roll Dashboard UI

```typescript
// Deal workspace → Rent Roll tab → "Intelligence" sub-tab

// Top section: 5 KPI cards
// Occupancy % | WALT | Avg Rent/Unit | Mark-to-Market Opportunity | Concentration Risk

// Rollover chart:
// Stacked bar chart (next 5 years)
// Each bar shows expiring rent by year
// Danger threshold line at 30%
// Hover: list of specific leases expiring that year

// Market rent comparison chart:
// Scatter plot: each lease = one dot
// X-axis: lease expiry date
// Y-axis: rent vs. market (1.0 = at market, 0.8 = 20% below)
// Color: green = below market (easy renewal), red = above market (rollover risk)

// Tenant concentration donut chart:
// Slice per tenant (top 5 + "Other")
// Risk tier indicator

// Below/Above Market Leases table:
// Tenant | Unit | Current Rent | Market Rent | Variance | Lease Expiry | Action
// Actions: "Begin Renewal" | "Mark to Market on Renewal" | "Note"
```

---

## C.5 Vacancy & Leasing Pipeline

### Overview
CRM-style pipeline for managing vacant units, tracking prospect inquiries, showing schedules, and converting leads to executed leases.

### Data Models

```typescript
export const vacancyListings = pgTable('vacancy_listings', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  dealId: integer('deal_id').references(() => deals.id),
  unitId: varchar('unit_id', { length: 100 }), // Unit 2B, Slip 14, Suite 300
  unit_type: varchar('unit_type', { length: 100 }),
  status: varchar('status', { length: 30 }),
  // vacant | notice_given | leasing | application_pending | leased | off_market
  vacantSince: date('vacant_since'),
  availableDate: date('available_date'),
  askingRent: numeric('asking_rent', { precision: 10, scale: 2 }),
  squareFootage: integer('square_footage'),
  daysOnMarket: integer('days_on_market'), // computed
  listingDescription: text('listing_description'),
  photos: jsonb('photos'),
  amenities: jsonb('amenities'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const leasingProspects = pgTable('leasing_prospects', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  dealId: integer('deal_id').references(() => deals.id),
  vacancyListingId: integer('vacancy_listing_id').references(() => vacancyListings.id),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  source: varchar('source', { length: 50 }),
  // zillow | website | referral | sign | cold_call | walkIn | coStar
  desiredMoveIn: date('desired_move_in'),
  desiredTerm: integer('desired_term'), // months
  maxBudget: numeric('max_budget', { precision: 10, scale: 2 }),
  stage: varchar('stage', { length: 50 }),
  // inquiry | showing_scheduled | showing_completed | application_sent
  // application_received | approved | denied | lease_offered | lease_signed | lost
  creditScore: integer('credit_score'),
  applicationDocId: integer('application_doc_id'),
  notes: text('notes'),
  assignedTo: integer('assigned_to').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const showings = pgTable('showings', {
  id: serial('id').primaryKey(),
  prospectId: integer('prospect_id').references(() => leasingProspects.id),
  vacancyListingId: integer('vacancy_listing_id').references(() => vacancyListings.id),
  scheduledAt: timestamp('scheduled_at'),
  conductedAt: timestamp('conducted_at'),
  status: varchar('status', { length: 30 }), // scheduled | completed | no_show | cancelled
  agentId: integer('agent_id').references(() => users.id),
  feedback: text('feedback'),
  interested: boolean('interested'),
  followUpDate: date('follow_up_date'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### Leasing Pipeline UI

```typescript
// Deal workspace → Vacancies tab

// Vacancy summary banner:
// X units vacant | Y units on notice | Avg days on market: Z | Est. monthly rent lost: $X,XXX

// Kanban pipeline:
// Columns: Vacant | Inquiry | Showing Scheduled | Application | Approved | Leased

// Vacancy cards show:
// Unit # | Asking rent | Days vacant | # prospects in pipeline

// Prospect cards show:
// Prospect name | Move-in date | Stage | Days in pipeline

// Conversion funnel chart:
// Inquiries → Showings → Applications → Approvals → Leases
// Conversion rates at each stage

// Days-on-Market tracker:
// Alert at 30+ days: "Unit 2B has been vacant 35 days — consider price adjustment"
// Suggested rent adjustment (shows pricing comparison)
```

---

# PART D — DEVELOPMENT & CONSTRUCTION

---

## D.1 Development / Construction Module

### Overview
Full construction project management: budget tracking (hard/soft costs), draw schedule management, lender draw request generation, GC management, and milestone tracking.

### Data Models

```typescript
// schema/construction.ts

export const constructionProjects = pgTable('construction_projects', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  dealId: integer('deal_id').references(() => deals.id),
  projectType: varchar('project_type', { length: 50 }),
  // ground_up | gut_renovation | value_add | tenant_improvement | addition
  projectName: varchar('project_name', { length: 255 }),
  status: varchar('status', { length: 30 }),
  // pre_construction | under_construction | substantial_completion | certificate_of_occupancy | complete
  
  // Budget
  totalHardCostBudget: numeric('total_hard_cost_budget', { precision: 15, scale: 2 }),
  totalSoftCostBudget: numeric('total_soft_cost_budget', { precision: 15, scale: 2 }),
  contingencyBudget: numeric('contingency_budget', { precision: 15, scale: 2 }),
  contingencyPct: numeric('contingency_pct', { precision: 5, scale: 2 }),
  totalBudget: numeric('total_budget', { precision: 15, scale: 2 }),
  // = hard + soft + contingency
  
  // Actual costs
  totalHardCostActual: numeric('total_hard_cost_actual', { precision: 15, scale: 2 }).default('0'),
  totalSoftCostActual: numeric('total_soft_cost_actual', { precision: 15, scale: 2 }).default('0'),
  contingencyUsed: numeric('contingency_used', { precision: 15, scale: 2 }).default('0'),
  totalActual: numeric('total_actual', { precision: 15, scale: 2 }).default('0'),
  
  // Cost to complete
  estimatedCostToComplete: numeric('estimated_cost_to_complete', { precision: 15, scale: 2 }),
  projectedTotalCost: numeric('projected_total_cost', { precision: 15, scale: 2 }),
  budgetVariance: numeric('budget_variance', { precision: 15, scale: 2 }),
  // Positive = over budget, negative = under budget
  
  // Schedule
  constructionStartDate: date('construction_start_date'),
  substantialCompletionDate: date('substantial_completion_date'),
  // Contracted
  projectedSubstantialCompletion: date('projected_substantial_completion'),
  // Current projection
  actualSubstantialCompletion: date('actual_substantial_completion'),
  
  // Schedule variance
  scheduleDaysVariance: integer('schedule_days_variance'),
  // Positive = behind schedule
  
  // Construction loan
  constructionLoanId: integer('construction_loan_id').references(() => dealDebt.id),
  constructionLoanAmount: numeric('construction_loan_amount', { precision: 15, scale: 2 }),
  totalDrawsToDate: numeric('total_draws_to_date', { precision: 15, scale: 2 }).default('0'),
  remainingDrawAvailability: numeric('remaining_draw_availability', { precision: 15, scale: 2 }),
  
  // GC
  generalContractorId: integer('general_contractor_id').references(() => vendors.id),
  gcContractAmount: numeric('gc_contract_amount', { precision: 15, scale: 2 }),
  gcContractType: varchar('gc_contract_type', { length: 50 }),
  // fixed_price | cost_plus | gmax (guaranteed maximum price)
  
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Detailed budget line items (CSI divisions)
export const constructionBudgetLines = pgTable('construction_budget_lines', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => constructionProjects.id),
  costType: varchar('cost_type', { length: 20 }), // 'hard' | 'soft' | 'contingency'
  division: varchar('division', { length: 50 }),
  // CSI Division codes: 01 General Requirements, 03 Concrete, 05 Metals, etc.
  description: varchar('description', { length: 500 }),
  budgetAmount: numeric('budget_amount', { precision: 12, scale: 2 }),
  contractedAmount: numeric('contracted_amount', { precision: 12, scale: 2 }).default('0'),
  actualToDate: numeric('actual_to_date', { precision: 12, scale: 2 }).default('0'),
  estimatedCostToComplete: numeric('estimated_cost_to_complete', { precision: 12, scale: 2 }),
  projectedTotal: numeric('projected_total', { precision: 12, scale: 2 }),
  variance: numeric('variance', { precision: 12, scale: 2 }),
  percentComplete: numeric('percent_complete', { precision: 5, scale: 2 }).default('0'),
  vendorId: integer('vendor_id').references(() => vendors.id),
  notes: text('notes'),
});

// Construction draws
export const constructionDraws = pgTable('construction_draws', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => constructionProjects.id),
  orgId: integer('org_id').references(() => organizations.id),
  drawNumber: integer('draw_number'),
  drawDate: date('draw_date'),
  requestedAmount: numeric('requested_amount', { precision: 12, scale: 2 }),
  approvedAmount: numeric('approved_amount', { precision: 12, scale: 2 }),
  fundedAmount: numeric('funded_amount', { precision: 12, scale: 2 }),
  status: varchar('status', { length: 30 }),
  // draft | submitted | under_review | approved | funded | rejected
  submittedAt: timestamp('submitted_at'),
  approvedAt: timestamp('approved_at'),
  fundedAt: timestamp('funded_at'),
  lenderComments: text('lender_comments'),
  // Line items in this draw
  lineItems: jsonb('line_items'),
  // [{ budgetLineId, description, percentComplete, drawAmount }]
  inspectionReportId: integer('inspection_report_id'),
  // Lender's inspector must approve
  lienWaiversIds: jsonb('lien_waiver_ids'),
  // Lien waivers from subs required with each draw
  documentIds: jsonb('document_ids'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Construction schedule milestones
export const constructionMilestones = pgTable('construction_milestones', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => constructionProjects.id),
  milestoneName: varchar('milestone_name', { length: 255 }),
  // Foundation complete | Framing complete | Dry-in | MEP rough-in | Drywall complete
  // Substantial completion | CO received | Tenant occupancy
  targetDate: date('target_date'),
  projectedDate: date('projected_date'),
  actualDate: date('actual_date'),
  status: varchar('status', { length: 20 }),
  // upcoming | in_progress | complete | delayed | at_risk
  percentComplete: numeric('percent_complete', { precision: 5, scale: 2 }),
  daysVariance: integer('days_variance'),
  notes: text('notes'),
  blockers: text('blockers'),
  photoIds: jsonb('photo_ids'),
  order: integer('order'), // display order
});
```

### Draw Request Generator

```typescript
// POST /api/construction/draws/:drawId/generate-request
// Generates a formatted AIA G702/G703 draw request document:
// AIA G702: Application for Payment (cover sheet)
// AIA G703: Continuation Sheet (line-by-line breakdown)
// Populates from constructionBudgetLines + draw line items
// Outputs PDF ready to submit to lender

// Lien waiver tracking:
// Before draw is approved, system tracks:
// - Unconditional lien waivers from GC (for prior draws)
// - Conditional lien waivers from GC (for current draw)
// - Sub-contractor lien waivers (configurable list)
// Flags any missing waivers before submission
```

### Construction Dashboard UI

```typescript
// Deal workspace → Construction tab (visible when deal has active construction project)

// Header: Project status badge | Overall % complete | Budget status

// S-Curve chart:
// X-axis: project timeline (months)
// Y-axis: cumulative spend ($)
// Lines: Planned spend (blue) vs. Actual spend (orange) vs. Projected (dashed)

// Budget summary table:
// Division | Budget | Contracted | Actual to Date | ETC | Projected Total | Variance | % Complete
// Totals row at bottom
// Export to Excel

// Schedule tracker:
// Gantt-style milestone timeline
// Green = on schedule, red = delayed, yellow = at risk
// Critical path highlighting

// Draw history:
// Table of all draws: # | Date | Requested | Approved | Funded | Status
// "New Draw Request" button → opens draw builder
// Draw builder: select line items, enter % complete, auto-calculates draw amount
// Attach required documents (lien waivers, inspection report)
// Preview G702/G703 PDF before submitting

// Photo log:
// Upload construction progress photos by date and milestone
// Timeline view of photos
```

---

## D.2 Renovation Unit Tracker

### Overview
Tracks value-add renovations unit-by-unit for multifamily deals: renovation cost per unit, pre/post-reno rent, actual vs. underwritten rent premium, payback period, and renovation pipeline management.

### Data Models

```typescript
export const unitRenovations = pgTable('unit_renovations', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  dealId: integer('deal_id').references(() => deals.id),
  unitId: varchar('unit_id', { length: 100 }),
  unitType: varchar('unit_type', { length: 50 }),
  
  // Pre-renovation
  preRenoRent: numeric('pre_reno_rent', { precision: 10, scale: 2 }),
  preRenoCondition: varchar('pre_reno_condition', { length: 30 }),
  // excellent | good | fair | poor | gut
  
  // Renovation plan
  renovationScope: jsonb('renovation_scope'),
  // [{ item: 'kitchen_cabinets', budget: 4500 }, { item: 'flooring', budget: 3200 }, ...]
  budgetedCost: numeric('budgeted_cost', { precision: 10, scale: 2 }),
  underwrittenRentPremium: numeric('underwritten_rent_premium', { precision: 10, scale: 2 }),
  underwrittenPostRentRent: numeric('underwritten_post_reno_rent', { precision: 10, scale: 2 }),
  
  // Status
  status: varchar('status', { length: 30 }),
  // queued | in_progress | complete | occupied_post_reno | deferred
  queuedAt: date('queued_at'),
  renovationStartDate: date('renovation_start_date'),
  renovationEndDate: date('renovation_end_date'),
  actualCompletionDate: date('actual_completion_date'),
  vacantDuringReno: integer('vacant_during_reno'), // days vacant for renovation
  
  // Actual results
  actualCost: numeric('actual_cost', { precision: 10, scale: 2 }),
  actualPostRenoRent: numeric('actual_post_reno_rent', { precision: 10, scale: 2 }),
  actualRentPremium: numeric('actual_rent_premium', { precision: 10, scale: 2 }),
  
  // Performance vs. underwriting
  costVariance: numeric('cost_variance', { precision: 10, scale: 2 }),
  // actual - budgeted (positive = over budget)
  rentPremiumVariance: numeric('rent_premium_variance', { precision: 10, scale: 2 }),
  // actual premium - underwritten premium
  
  // ROI metrics
  paybackPeriodMonths: numeric('payback_period_months', { precision: 5, scale: 1 }),
  // actual_cost / actual_monthly_rent_premium
  renovationROI: numeric('renovation_roi', { precision: 8, scale: 4 }),
  // (annual rent premium) / actual_cost
  
  leasedPostRenoAt: timestamp('leased_post_reno_at'),
  newTenantId: integer('new_tenant_id'),
  daysToLease: integer('days_to_lease'), // days from completion to new lease signed
  
  photos: jsonb('photos'), // before and after photos
  vendorId: integer('vendor_id').references(() => vendors.id),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### Renovation Intelligence Dashboard

```typescript
// Deal workspace → Renovations tab

// Summary metrics:
// Units Complete | Units In Progress | Units Queued | Avg Cost/Unit | Avg Rent Premium
// Projected vs. Actual cost total | Projected vs. Actual rent premium
// Average payback period | Portfolio renovation ROI

// Unit status heatmap:
// Building floor plan (if uploaded) OR simple grid
// Each unit color coded: grey (not yet renovated) | yellow (queued) | blue (in progress) | green (complete + leased)

// Comparison table: underwritten vs. actual
// Unit | Budget | Actual Cost | Variance | UW Premium | Actual Premium | Variance | Days to Lease

// Renovation pipeline (Kanban):
// Columns: Queued | In Progress | Complete-Vacant | Leased
// Cards show: unit # | scope summary | cost | days in stage

// ROI trend line:
// As more units complete, rolling average ROI chart shows if renovation thesis is working
// Flag if actual ROI is trending below underwritten threshold
```

---

## D.3 Pro Forma → Actuals Bridge

### Overview
A structured comparison engine that, for active deals, tracks how actual performance is tracking vs. the original underwriting assumptions. The "scorecard" for your thesis.

### Data Models

```typescript
export const proFormaActualsBridge = pgTable('pro_forma_actuals_bridge', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  dealId: integer('deal_id').references(() => deals.id),
  period: varchar('period', { length: 20 }),
  
  // Rent
  ufRentRevenue: numeric('uf_rent_revenue', { precision: 12, scale: 2 }),
  // UF = underwritten/forecast
  actualRentRevenue: numeric('actual_rent_revenue', { precision: 12, scale: 2 }),
  rentVariance: numeric('rent_variance', { precision: 12, scale: 2 }),
  rentVariancePct: numeric('rent_variance_pct', { precision: 5, scale: 2 }),
  
  // Occupancy
  ufOccupancy: numeric('uf_occupancy', { precision: 5, scale: 2 }),
  actualOccupancy: numeric('actual_occupancy', { precision: 5, scale: 2 }),
  occupancyVariance: numeric('occupancy_variance', { precision: 5, scale: 2 }),
  
  // OpEx
  ufOpex: numeric('uf_opex', { precision: 12, scale: 2 }),
  actualOpex: numeric('actual_opex', { precision: 12, scale: 2 }),
  opexVariance: numeric('opex_variance', { precision: 12, scale: 2 }),
  opexVariancePct: numeric('opex_variance_pct', { precision: 5, scale: 2 }),
  
  // NOI
  ufNoi: numeric('uf_noi', { precision: 12, scale: 2 }),
  actualNoi: numeric('actual_noi', { precision: 12, scale: 2 }),
  noiVariance: numeric('noi_variance', { precision: 12, scale: 2 }),
  noiVariancePct: numeric('noi_variance_pct', { precision: 5, scale: 2 }),
  
  // CapEx
  ufCapex: numeric('uf_capex', { precision: 12, scale: 2 }),
  actualCapex: numeric('actual_capex', { precision: 12, scale: 2 }),
  capexVariance: numeric('capex_variance', { precision: 12, scale: 2 }),
  
  // Construction (if applicable)
  ufConstructionCost: numeric('uf_construction_cost', { precision: 12, scale: 2 }),
  actualConstructionCost: numeric('actual_construction_cost', { precision: 12, scale: 2 }),
  constructionVariance: numeric('construction_variance', { precision: 12, scale: 2 }),
  
  // Projected IRR with actuals
  originalUnderwrittenIRR: numeric('original_underwritten_irr', { precision: 6, scale: 4 }),
  currentProjectedIRR: numeric('current_projected_irr', { precision: 6, scale: 4 }),
  irrVariance: numeric('irr_variance', { precision: 6, scale: 4 }),
  
  calculatedAt: timestamp('calculated_at').defaultNow(),
});
```

### Bridge Report UI

```typescript
// Deal workspace → Performance Bridge tab

// "Underwriting vs. Reality" scorecard table:
// Metric | Underwritten | Actual YTD | Variance $ | Variance % | Status
// Rows: Rent Revenue | Occupancy | OpEx | NOI | CapEx | IRR projection
// Status icon: ✅ (within 5%) | ⚠️ (5-15% off) | ❌ (>15% off)

// Variance waterfall chart:
// Shows how each assumption deviation impacts projected IRR
// "Occupancy miss costs 0.8% IRR" | "OpEx overrun costs 0.5% IRR"
// Visual story of why you're above/below underwriting

// Commentary section:
// For each metric in variance, AI generates 1-sentence explanation
// "Occupancy is 3.2% below underwriting due to delayed lease-up in Unit 2B renovation"
// "OpEx variance driven by $8,400 HVAC emergency repair in January"

// Rolling 12-month actual vs. UW chart:
// Line chart showing actual NOI vs. year-1 pro forma
// Divergence highlighted
```

---

# PART E — ADVANCED ANALYTICS & REPORTING

---

## E.1 Custom Report Builder

### Overview
Drag-and-drop report builder allowing users to create custom reports from any data in the system. Reports can be scheduled, shared, and exported to PDF or Excel.

### Data Models

```typescript
export const customReports = pgTable('custom_reports', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  createdBy: integer('created_by').references(() => users.id),
  name: varchar('name', { length: 255 }),
  description: text('description'),
  reportType: varchar('report_type', { length: 30 }),
  // 'tabular' | 'chart' | 'dashboard' | 'summary'
  
  // Report definition
  dataSources: jsonb('data_sources'),
  // Which tables/views this report pulls from
  fields: jsonb('fields'),
  // Column definitions: [{ id, label, source, fieldPath, format, aggregate }]
  filters: jsonb('filters'),
  // Filter conditions
  groupBy: jsonb('group_by'),
  // Group by fields
  sortBy: jsonb('sort_by'),
  // Sort specification
  charts: jsonb('charts'),
  // Chart definitions for visual components
  
  // Sharing
  isShared: boolean('is_shared').default(false),
  sharedWith: jsonb('shared_with'), // [userId, ...]
  isPublic: boolean('is_public').default(false),
  // Visible to all org members
  
  // Scheduling
  scheduleEnabled: boolean('schedule_enabled').default(false),
  scheduleFrequency: varchar('schedule_frequency', { length: 20 }),
  // 'daily' | 'weekly' | 'monthly' | 'quarterly'
  scheduleDay: integer('schedule_day'),
  scheduleTime: varchar('schedule_time', { length: 5 }),
  scheduleRecipients: jsonb('schedule_recipients'),
  // [{ email, userId }]
  lastRunAt: timestamp('last_run_at'),
  nextRunAt: timestamp('next_run_at'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const reportExecutions = pgTable('report_executions', {
  id: serial('id').primaryKey(),
  reportId: integer('report_id').references(() => customReports.id),
  triggeredBy: varchar('triggered_by', { length: 20 }), // 'manual' | 'schedule'
  status: varchar('status', { length: 20 }), // 'running' | 'complete' | 'failed'
  rowCount: integer('row_count'),
  outputUrl: varchar('output_url', { length: 500 }), // PDF/Excel download link
  executedAt: timestamp('executed_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  errorMessage: text('error_message'),
});
```

### Available Data Sources

```typescript
// Data sources available in report builder:
const REPORT_DATA_SOURCES = {
  deals: {
    label: 'Deals',
    fields: ['name', 'assetClass', 'market', 'stage', 'askPrice', 'targetCloseDate', /* ... */],
  },
  financial_model: {
    label: 'Financial Model',
    fields: ['noi', 'capRate', 'irr', 'equityMultiple', 'dscr', 'ltv', /* ... */],
    joinOn: 'dealId',
  },
  investments: {
    label: 'LP Investments',
    fields: ['investorName', 'committed', 'funded', 'ownershipPct', 'irr', /* ... */],
  },
  distributions: {
    label: 'Distributions',
    fields: ['distributionDate', 'amount', 'type', 'dealName', /* ... */],
  },
  work_orders: {
    label: 'Work Orders',
    fields: ['title', 'category', 'priority', 'status', 'cost', 'vendor', /* ... */],
  },
  leases: {
    label: 'Leases',
    fields: ['tenant', 'unit', 'monthlyRent', 'startDate', 'endDate', 'remainingTerm', /* ... */],
  },
  contacts: {
    label: 'CRM Contacts',
    fields: ['name', 'company', 'role', 'dealsSourced', 'lastContact', /* ... */],
  },
  portfolio_performance: {
    label: 'Portfolio Performance',
    fields: ['dealName', 'noiActual', 'noiBudget', 'variance', 'occupancy', /* ... */],
  },
};
```

### Report Builder UI

```typescript
// pages/reports/ReportBuilder.tsx

// Three-panel layout:
// Left panel (200px): Data source picker + field browser
//   - Expandable source categories
//   - Drag fields to main canvas

// Center canvas:
// For tabular reports:
//   - Column headers (draggable to reorder)
//   - Live preview with sample data
//   - "Add Column" placeholder
//   - Column config: label, format (currency/%, number, date), aggregate (sum/avg/count)

// For chart reports:
//   - Chart type picker (bar / line / pie / area / scatter)
//   - X-axis / Y-axis field assignment
//   - Group by selector

// Right panel (250px):
//   - Filters configuration
//   - Sort configuration
//   - Group by configuration
//   - Report settings (name, description, sharing)

// Header:
//   - Report name (editable)
//   - "Preview" button (runs with real data, sample of 50 rows)
//   - "Save" button
//   - "Schedule" button → schedule config modal
//   - "Export PDF" | "Export Excel" buttons

// Template library:
//   - Pre-built templates: Portfolio Summary | Deal Pipeline | LP Returns | Work Order Summary
//   - Community templates (org-shared)
//   - "Start from template" on new report
```

---

## E.2 Performance Attribution Engine

### Overview
For any realized deal or current portfolio, breaks down the IRR into its components: market appreciation, NOI growth vs. budget, multiple expansion/compression, leverage impact, and operational improvements.

### Attribution Framework

```typescript
// IRR Attribution: waterfall decomposition of return drivers

interface PerformanceAttribution {
  dealId: number;
  holdPeriodYears: number;
  totalLeveredIRR: number;
  totalEquityMultiple: number;
  
  attribution: {
    // What drove the return?
    incomeCashFlow: AttributionComponent;
    // NOI distributions received during hold
    // = annual cash-on-cash from operations
    
    noiBudgetVariance: AttributionComponent;
    // Did NOI beat or miss underwriting?
    // Impact on IRR of NOI being X% above/below year-1 pro forma
    
    capRateCompression: AttributionComponent;
    // Did cap rates compress (favorable) or expand (unfavorable) at exit?
    // = (entry cap rate - exit cap rate) × exit NOI / entry equity
    
    rentGrowth: AttributionComponent;
    // NOI growth from year 1 to exit year
    // Isolates rent growth contribution to exit value
    
    leverageEffect: AttributionComponent;
    // How much did debt amplify (or hurt) returns?
    // = levered IRR - unlevered IRR
    
    operationalImprovement: AttributionComponent;
    // Value created through active management
    // = value-add renovations + lease-up premium + OpEx reduction
    
    residualValue: AttributionComponent;
    // Terminal value at exit (what you sold it for vs. what you paid)
  };
  
  // Narrative summary
  narrativeSummary: string; // AI-generated
}

interface AttributionComponent {
  contributionToIRR: number; // percentage points of IRR
  contributionToEM: number;  // contribution to equity multiple
  description: string;
  isPositive: boolean;
}
```

### Attribution Calculation

```typescript
// lib/analytics/performanceAttribution.ts

export async function calculateAttribution(dealId: number): Promise<PerformanceAttribution> {
  const deal = await getDealById(dealId);
  const fm = await getFinancialModel(dealId);
  const actuals = await getActualsHistory(dealId);
  
  // Unlevered IRR (ignore debt)
  const unleveredIRR = calculateUnleveredIRR(deal, fm, actuals);
  const leveredIRR = calculateLeveredIRR(deal, fm, actuals);
  const leverageEffect = leveredIRR - unleveredIRR;
  
  // Cap rate attribution
  const entryCapRate = deal.acquisitionCapRate;
  const exitCapRate = deal.saleCapRate || fm.exitCapRate;
  const capRateCompression = -(exitCapRate - entryCapRate) * fm.exitNOI / deal.equityInvested;
  
  // NOI growth attribution
  const year1NOI = fm.year1NOI;
  const exitNOI = fm.exitNOI || actuals[actuals.length - 1].noi;
  const noiGrowth = (exitNOI - year1NOI) / year1NOI;
  
  // NOI vs. budget variance
  const budgetedNOI = fm.proFormaNOI;
  const actualNOI = actuals.reduce((s, a) => s + a.actualNOI, 0) / actuals.length;
  const noiBudgetVariancePct = (actualNOI - budgetedNOI) / budgetedNOI;
  
  // Income cash flow
  const totalDistributions = actuals.reduce((s, a) => s + a.distributions, 0);
  const incomeCoCReturn = totalDistributions / deal.equityInvested;
  
  return {
    dealId,
    holdPeriodYears: getHoldPeriodYears(deal),
    totalLeveredIRR: leveredIRR,
    totalEquityMultiple: fm.equityMultiple,
    attribution: {
      incomeCashFlow: {
        contributionToIRR: incomeCoCReturn * 100,
        description: 'Operating cash distributions during hold period',
        isPositive: totalDistributions > 0,
      },
      noiBudgetVariance: {
        contributionToIRR: noiBudgetVariancePct * 2, // simplified
        description: `NOI ${noiBudgetVariancePct > 0 ? 'exceeded' : 'missed'} underwriting by ${Math.abs(noiBudgetVariancePct * 100).toFixed(1)}%`,
        isPositive: noiBudgetVariancePct > 0,
      },
      capRateCompression: {
        contributionToIRR: capRateCompression,
        description: `Cap rate ${exitCapRate < entryCapRate ? 'compressed' : 'expanded'} from ${entryCapRate}% to ${exitCapRate}%`,
        isPositive: exitCapRate < entryCapRate,
      },
      leverageEffect: {
        contributionToIRR: leverageEffect,
        description: `${fm.ltv}% LTV amplified returns by ${leverageEffect.toFixed(1)}pp IRR`,
        isPositive: leverageEffect > 0,
      },
    },
    narrativeSummary: await generateAttributionNarrative(deal, attribution),
  };
}
```

---

## E.3 Portfolio Stress Testing

### Overview
Models portfolio-wide scenarios — cap rate expansion, interest rate shocks, occupancy declines — and shows impact on each asset's DSCR, covenant compliance, LP returns, and portfolio IRR.

### Scenario Framework

```typescript
interface StressScenario {
  id: string;
  name: string;
  description: string;
  assumptions: ScenarioAssumptions;
}

interface ScenarioAssumptions {
  capRateExpansion: number;      // e.g., 0.01 = +100bps
  interestRateChange: number;    // e.g., 0.02 = +200bps at refi
  occupancyDecline: number;      // e.g., -0.10 = -10%
  rentGrowthAdjustment: number;  // e.g., -0.05 = -5% vs. base case
  exitMultipleAdjustment: number; // e.g., -0.005 = exit cap 50bps wider
  marketValueDecline: number;    // e.g., -0.15 = -15% value
}

// Pre-built scenarios:
const STRESS_SCENARIOS: StressScenario[] = [
  {
    id: 'mild_recession',
    name: 'Mild Recession',
    description: 'Moderate economic downturn, 2008-lite',
    assumptions: {
      capRateExpansion: 0.0075, // +75bps
      interestRateChange: 0.005, // +50bps
      occupancyDecline: -0.05,  // -5%
      rentGrowthAdjustment: -0.03, // -3%
      exitMultipleAdjustment: -0.0075,
      marketValueDecline: -0.08,
    },
  },
  {
    id: 'gfc_2008',
    name: 'GFC-Style Shock',
    description: '2008-2009 financial crisis scenario',
    assumptions: {
      capRateExpansion: 0.02,
      interestRateChange: 0.03,
      occupancyDecline: -0.15,
      rentGrowthAdjustment: -0.08,
      exitMultipleAdjustment: -0.02,
      marketValueDecline: -0.25,
    },
  },
  {
    id: 'rate_shock',
    name: 'Rate Shock (Refi Risk)',
    description: '+200bps at refinance, values flat',
    assumptions: {
      capRateExpansion: 0.01,
      interestRateChange: 0.02,
      occupancyDecline: 0,
      rentGrowthAdjustment: 0,
      exitMultipleAdjustment: -0.01,
      marketValueDecline: -0.10,
    },
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'User-defined stress scenario',
    assumptions: {}, // filled by user
  },
];

interface StressTestResult {
  scenario: StressScenario;
  portfolioSummary: {
    portfolioIRRBase: number;
    portfolioIRRStressed: number;
    portfolioIRRDelta: number;
    avgDSCRBase: number;
    avgDSCRStressed: number;
    dealsAtCovenantRisk: number; // DSCR below covenant
    dealsAtDefaultRisk: number;  // DSCR < 1.0
    totalValueDecline: number;
    lpReturnImpact: number;
  };
  dealResults: DealStressResult[];
}

interface DealStressResult {
  dealId: number;
  dealName: string;
  // Before stress
  baseNOI: number;
  baseCapRate: number;
  baseValue: number;
  baseDSCR: number;
  baseIRR: number;
  // After stress
  stressedNOI: number;
  stressedCapRate: number;
  stressedValue: number;
  stressedDSCR: number;
  stressedIRR: number;
  // Risk flags
  dscrCovenantBreach: boolean;
  covenantThreshold: number;
  ltv_at_maturity: number; // stressed LTV at debt maturity
  refinanceRisk: 'low' | 'medium' | 'high' | 'critical';
  suggestedActions: string[];
}
```

### Stress Test UI

```typescript
// pages/portfolio/StressTesting.tsx

// Scenario selector: pre-built scenarios as cards + custom scenario builder
// Custom builder: sliders for each assumption variable
// Real-time calculation as sliders move

// Results layout:
// Portfolio summary table (before/after side by side)
// Traffic light matrix:
//   Rows = deals | Columns = risk metrics (DSCR, Value, IRR, Refi Risk)
//   Cell color: green/yellow/red based on stressed values
// "Deals at Risk" highlighted section (red cells)
// Suggested actions per at-risk deal
// "Save Scenario" to come back to later
// "Share Results" → generates PDF report for LP/board presentation
```

---

## E.4 Benchmark Peer Comparison

### Overview
Compares your fund's performance against public REIT benchmarks, NCREIF indices, and ODCE fund data by asset class and vintage year.

### Benchmark Data

```typescript
export const publicBenchmarks = pgTable('public_benchmarks', {
  id: serial('id').primaryKey(),
  benchmarkName: varchar('benchmark_name', { length: 255 }),
  // 'NCREIF NFI-ODCE' | 'MSCI PREA USPI' | 'NAREIT All Equity REIT'
  // 'NCREIF Multifamily' | 'NCREIF Industrial' | etc.
  assetClass: varchar('asset_class', { length: 100 }),
  period: varchar('period', { length: 20 }),
  vintage: integer('vintage'),
  
  // Reported metrics
  totalReturn: numeric('total_return', { precision: 6, scale: 4 }),
  incomeReturn: numeric('income_return', { precision: 6, scale: 4 }),
  appreciationReturn: numeric('appreciation_return', { precision: 6, scale: 4 }),
  irr: numeric('irr', { precision: 6, scale: 4 }),
  tvpi: numeric('tvpi', { precision: 5, scale: 3 }),
  dpi: numeric('dpi', { precision: 5, scale: 3 }),
  avgCapRate: numeric('avg_cap_rate', { precision: 5, scale: 3 }),
  
  source: varchar('source', { length: 100 }),
  sourceUrl: varchar('source_url', { length: 500 }),
  dataDate: date('data_date'),
  createdAt: timestamp('created_at').defaultNow(),
});

// UI: "How do we compare?"
// Select fund + benchmark index + time period
// Side-by-side comparison table
// Charts: your IRR vs. benchmark IRR by vintage year
// Alpha calculation: how much did you beat (or miss) the benchmark?
// Quartile ranking: "Your fund is in the top 25% of vintage 2021 CRE funds"
```

---

## E.5 Cash Flow Forecasting Engine

### Overview
Rolling 12/24-month cash flow forecast across the portfolio: projected income, debt service, capex, distributions, and capital calls. The GP's treasury management tool.

### Data Models

```typescript
export const cashFlowForecasts = pgTable('cash_flow_forecasts', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  period: varchar('period', { length: 20 }),
  asOf: date('as_of'),
  
  // Inflows
  projectedNOI: numeric('projected_noi', { precision: 15, scale: 2 }),
  projectedRefinanceProceeds: numeric('projected_refinance_proceeds', { precision: 15, scale: 2 }).default('0'),
  projectedSaleProceeds: numeric('projected_sale_proceeds', { precision: 15, scale: 2 }).default('0'),
  projectedCapitalCallsIn: numeric('projected_capital_calls_in', { precision: 15, scale: 2 }).default('0'),
  
  // Outflows
  projectedDebtService: numeric('projected_debt_service', { precision: 15, scale: 2 }),
  projectedCapex: numeric('projected_capex', { precision: 15, scale: 2 }),
  projectedDistributions: numeric('projected_distributions', { precision: 15, scale: 2 }),
  projectedManagementFees: numeric('projected_management_fees', { precision: 15, scale: 2 }),
  projectedOperatingExpenses: numeric('projected_operating_expenses', { precision: 15, scale: 2 }),
  
  // Net
  netCashFlow: numeric('net_cash_flow', { precision: 15, scale: 2 }),
  cumulativeCashFlow: numeric('cumulative_cash_flow', { precision: 15, scale: 2 }),
  
  // By deal breakdown stored as jsonb
  dealBreakdown: jsonb('deal_breakdown'),
  
  // Confidence
  confidenceLevel: varchar('confidence_level', { length: 20 }),
  // 'high' (next 3mo) | 'medium' (3-12mo) | 'low' (12-24mo)
  
  generatedAt: timestamp('generated_at').defaultNow(),
});
```

### Forecast Chart UI

```typescript
// Stacked bar chart: monthly bars for next 24 months
// Inflow bars (green shading): NOI | Refi proceeds | Sale proceeds | Capital calls
// Outflow bars (red shading): Debt service | CapEx | Distributions | Fees
// Net cash flow line (blue) overlaid
// "Tight months" highlighted: months where net cash flow is negative

// Liquidity risk indicator:
// Banner when cumulative cash flow goes negative in forecast
// "Projected cash shortfall in March 2026 — $420,000"
// Suggested actions: accelerate capital call, defer distribution, draw reserve

// Per-deal contribution table:
// Expand to see which deal is driving each forecast component
```

---

# PART F — INTEGRATIONS & DATA

---

## F.1 QuickBooks / Xero Accounting Integration

### Overview
Bidirectional sync with QuickBooks Online and Xero. Pulls actual income/expense data into MarinaMatch for budget variance analysis; pushes invoices and distribution records to accounting system.

### Integration Architecture

```typescript
// lib/integrations/quickbooks.ts
// Using: node-quickbooks SDK or direct QuickBooks API

export const accountingIntegrations = pgTable('accounting_integrations', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  provider: varchar('provider', { length: 20 }), // 'quickbooks' | 'xero'
  accessToken: varchar('access_token', { length: 500 }), // encrypted
  refreshToken: varchar('refresh_token', { length: 500 }), // encrypted
  realmId: varchar('realm_id', { length: 100 }), // QuickBooks company ID
  tokenExpiresAt: timestamp('token_expires_at'),
  isActive: boolean('is_active').default(true),
  lastSyncAt: timestamp('last_sync_at'),
  syncFrequency: varchar('sync_frequency', { length: 20 }),
  // 'realtime' | 'hourly' | 'daily'
  createdAt: timestamp('created_at').defaultNow(),
});

export const accountingMappings = pgTable('accounting_mappings', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  integrationId: integer('integration_id').references(() => accountingIntegrations.id),
  dealId: integer('deal_id').references(() => deals.id),
  // Map QBO class/location to MarinaMatch deal
  qboClassId: varchar('qbo_class_id', { length: 100 }),
  qboLocationId: varchar('qbo_location_id', { length: 100 }),
  // Map QBO accounts to MarinaMatch P&L categories
  accountMappings: jsonb('account_mappings'),
  // [{ qboAccountId, qboAccountName, marinaCategoryCode }]
  createdAt: timestamp('created_at').defaultNow(),
});

// Sync service:
export class QuickBooksSync {
  
  async syncActuals(orgId: number, dealId: number, period: string): Promise<void> {
    const integration = await getIntegration(orgId);
    const mapping = await getMapping(orgId, dealId);
    
    // Pull P&L from QBO for the deal's class/location
    const pnl = await this.qboClient.getProfitAndLoss({
      start_date: getPeriodStart(period),
      end_date: getPeriodEnd(period),
      class_id: mapping.qboClassId,
    });
    
    // Map QBO account amounts to MarinaMatch categories
    const mappedActuals = mapQBOtoMarina(pnl, mapping.accountMappings);
    
    // Upsert into actual_financials table
    await upsertActuals(dealId, period, mappedActuals);
    
    // Trigger budget variance calculation
    await calculateBudgetVariance(dealId, period);
  }
  
  // Push management fee invoice to QBO
  async pushFeeInvoice(invoice: ManagementFeeInvoice): Promise<void> {
    const qboInvoice = await this.qboClient.createInvoice({
      CustomerRef: { value: invoice.fundLPAccountId },
      Line: [{
        Amount: invoice.netFee,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          ItemRef: { value: 'ManagementFee' },
          Qty: 1,
          UnitPrice: invoice.netFee,
        },
      }],
    });
    await updateInvoiceExternalId(invoice.id, qboInvoice.Id);
  }
}

// Setup wizard:
// Step 1: Connect to QuickBooks (OAuth flow)
// Step 2: Map QBO classes/locations to MarinaMatch deals
// Step 3: Map QBO chart of accounts to MarinaMatch P&L categories
// Step 4: Select sync frequency
// Step 5: Initial sync (pulls last 12 months of actuals)
// Step 6: Review sync results and fix any mapping errors
```

---

## F.2 Property Management System Sync

### Overview
API integration with major PMS platforms (AppFolio, Buildium, Yardi, RealPage) to pull rent roll, lease data, financials, and maintenance requests automatically.

### Supported PMS Platforms

```typescript
type PMSProvider = 'appfolio' | 'buildium' | 'yardi' | 'realpage' | 'propertyware' | 'rentmanager';

// Each provider has different API capabilities:
const PMS_CAPABILITIES: Record<PMSProvider, PMSCapabilities> = {
  appfolio: {
    rentRoll: true,
    leases: true,
    financials: true,
    maintenanceRequests: true,
    tenants: true,
    documents: false,
  },
  buildium: {
    rentRoll: true,
    leases: true,
    financials: true,
    maintenanceRequests: true,
    tenants: true,
    documents: true,
  },
  yardi: {
    rentRoll: true,
    leases: true,
    financials: true,
    maintenanceRequests: true,
    tenants: true,
    documents: true,
  },
};

// Sync maps:
// PMS rent roll → MarinaMatch leases table
// PMS maintenance requests → MarinaMatch work orders
// PMS financial reports → MarinaMatch actual_financials
// PMS tenant ledger → MarinaMatch rent payments

// Conflict resolution:
// MarinaMatch as "read" from PMS (PMS is source of truth for operational data)
// Bi-directional for: notes, categorization, tags
// Conflict flag if same record edited in both systems between syncs
```

---

## F.3 CoStar / LoopNet Integration

### Overview
Pull market data, comp transactions, and property details from CoStar's API directly into deal workspaces and the comps database.

### Integration Points

```typescript
// CoStar API integration points:
// 1. Property lookup: enter address → auto-fill property details from CoStar
//    (year built, SF, unit count, zoning, photos, last sale)
// 2. Sales comps: pull recent transactions in subject market + asset class
//    Auto-populates comps database
// 3. Market data: current vacancy rates, asking rents, cap rates by submarket
//    Updates market_benchmarks and cap_rate_feed tables
// 4. Tenant roster: for retail/office deals, pull known tenants at property

// LoopNet integration:
// Pull listing data when deal is sourced from LoopNet
// Monitor saved searches for new listings matching buy box
// Alert when deal matching criteria appears

// Implementation note:
// CoStar API requires enterprise license (~$50k+/year)
// Alternative for smaller orgs: manual CSV import from CoStar UI
// Build import pipeline accepting CoStar CSV export format
// Also build Crexi.com scraper as lower-cost alternative

// Data models: extends existing rent_comps and market_benchmarks tables
// New: property_records table (CoStar property data cache)
```

---

## F.4 DocuSign Deep Integration

### Overview
Beyond basic send/sign — full DocuSign workflow integration with envelope templates, embedded signing, bulk send, and completion webhooks.

### Implementation

```typescript
// lib/integrations/docusign.ts

export class DocuSignService {
  
  // Create envelope from template (for standardized docs)
  async sendFromTemplate(
    templateId: string,
    signers: DocuSignSigner[],
    prefillFields: Record<string, string>
  ): Promise<string> {
    const envelope = await this.client.envelopes.createEnvelope({
      templateId,
      templateRoles: signers.map(s => ({
        email: s.email,
        name: s.name,
        roleName: s.roleName,
        tabs: {
          textTabs: Object.entries(prefillFields).map(([label, value]) => ({
            tabLabel: label, value
          })),
        },
      })),
      status: 'sent',
    });
    return envelope.envelopeId;
  }
  
  // Embedded signing (sign without leaving MarinaMatch)
  async getSigningUrl(envelopeId: string, signerEmail: string): Promise<string> {
    const result = await this.client.envelopes.createRecipientView(envelopeId, {
      returnUrl: `${process.env.APP_URL}/signing-complete`,
      authenticationMethod: 'none',
      email: signerEmail,
      userName: 'Signer',
    });
    return result.url;
  }
  
  // Handle completion webhook
  async handleWebhook(event: DocuSignEvent): Promise<void> {
    if (event.event === 'envelope-completed') {
      const envelopeId = event.data.envelopeId;
      
      // Download executed document
      const pdf = await this.client.envelopes.getDocument(envelopeId, 'combined');
      
      // Store in document vault
      const docUrl = await uploadToStorage(pdf, `signed/${envelopeId}.pdf`);
      
      // Update signature request record
      await updateSignatureRequest(envelopeId, {
        status: 'completed',
        completedAt: new Date(),
        executedDocUrl: docUrl,
      });
      
      // Log in deal + contact activity
      await logActivityForEnvelope(envelopeId, docUrl);
      
      // Trigger any downstream automation (DocuSign completion → workflow trigger)
      await triggerAutomations('document.signed', envelopeId);
    }
  }
}

// DocuSign Template Library:
// Pre-built envelope templates configured in DocuSign account:
// - LOI Template: 4 signature tabs (buyer, seller, buyer counsel, seller counsel)
// - Subscription Agreement: signature + initial tabs per LP
// - Operating Agreement: multiple signature blocks
// - Lease Amendment: landlord + tenant signature blocks
// - Capital Call Notice: GP signature tab
// - NDA: 2-party signature

// Bulk send feature:
// For subscription agreements: send to all pending LPs at once
// Shows delivery status per recipient in bulk send tracker
// "Follow up" button for any signer who hasn't opened after X days
```

---

## F.5 Google Maps / Satellite View Integration

### Overview
Property map integration with satellite imagery, drive-time analysis, competitor proximity, demographic heatmaps, and trade area visualization embedded in every deal workspace.

### Implementation

```typescript
// lib/maps/propertyMap.ts
// Using: Google Maps JavaScript API + Places API + Distance Matrix API

// components/maps/PropertyMapView.tsx
// Embedded in deal workspace → Overview tab

// Map features:
// Base map with satellite/hybrid toggle
// Property marker at deal address (custom pin with asset class icon)
// Layers (toggleable):
//   - Comp markers: show sales comps from deal's comp database
//   - Rent comp markers: rent comparable properties
//   - Demographics heatmap: median income or population density
//   - Flood zone overlay (FEMA data)
//   - Trade area circle: 1/3/5 mile radius around property

// Drive-time isochrone:
// "5-minute drive" | "10-minute drive" | "15-minute drive" from property
// Polygon overlay showing actual drive-time area (not just radius)
// Shows population within each isochrone

// Nearby POIs (Points of Interest):
// Competitors (same asset class nearby — pulls from Google Places)
// Grocery stores / retail (demand indicator for residential)
// Transit stops (commuter access)
// Major employers (employee housing demand)
// Each POI category has toggle on/off

// Street view integration:
// "Street View" button → opens Google Street View at property address
// Useful for quick visual property assessment without site visit

// Deal marker details panel:
// Click deal marker → shows deal name, address, asset class, stage, ask price

// Comp marker details panel:
// Click comp marker → shows address, sale price, date, cap rate, price/unit
```

---

## F.6 Public Records / Title Data

### Overview
Auto-populate deal records with public property data when an address is entered: ownership history, tax records, existing liens, deed details, and last sale information.

### Integration

```typescript
// Provider: ATTOM Data Solutions or First American Data & Analytics
// Both offer property data APIs with coverage across US

export class PublicRecordsService {
  
  // Pull property snapshot on deal creation
  async enrichDealFromAddress(address: string): Promise<PropertySnapshot> {
    const attomId = await this.lookupAttomId(address);
    
    const [propertyDetails, saleHistory, taxHistory, liens] = await Promise.all([
      this.attom.getPropertyDetail(attomId),
      this.attom.getSaleHistory(attomId),
      this.attom.getTaxHistory(attomId),
      this.attom.getLienData(attomId),
    ]);
    
    return {
      // Property facts
      yearBuilt: propertyDetails.building.yearBuilt,
      buildingSF: propertyDetails.building.grossSqFt,
      lotSF: propertyDetails.lot.lotSize1,
      units: propertyDetails.building.units.totalUnits,
      stories: propertyDetails.building.stories,
      construction: propertyDetails.building.construction,
      
      // Ownership
      currentOwner: propertyDetails.owner.corporateName || 
                    `${propertyDetails.owner.owner1LastName}, ${propertyDetails.owner.owner1FirstName}`,
      ownerMailingAddress: propertyDetails.owner.mailingAddress,
      
      // Tax info
      assessedValue: taxHistory[0].assessed.assdTtlValue,
      taxYear: taxHistory[0].taxYear,
      annualTaxes: taxHistory[0].taxAmt,
      
      // Sale history (last 3 sales)
      lastSaleDate: saleHistory[0].saleTransDate,
      lastSalePrice: saleHistory[0].saleAmt,
      priorSaleDate: saleHistory[1]?.saleTransDate,
      priorSalePrice: saleHistory[1]?.saleAmt,
      
      // Liens
      existingLiens: liens.map(l => ({
        amount: l.lienAmt,
        type: l.lienType,
        lender: l.lenderName,
        recordDate: l.recordDate,
      })),
    };
  }
}

// UI: When deal address is entered:
// "Auto-fill from public records" button
// Shows preview of data to be imported
// User selects which fields to import
// Existing deal fields NOT overwritten unless user confirms

// Data freshness indicator: "Public records as of MM/YYYY"
// "Refresh Data" button to re-pull (e.g., before underwriting)
```

---

# PART G — DEEPER AI FEATURES

---

## G.1 AI Underwriting Assistant

### Overview
When a new deal is created and an address entered, AI automatically researches the market, pulls comps, suggests assumptions, and populates a first-draft pro forma — turning a blank deal into a working underwrite in under 60 seconds.

### Flow

```typescript
// Trigger: deal created + address entered + asset class selected

export async function runAIUnderwriting(dealId: number): Promise<AIUnderwritingResult> {
  const deal = await getDealById(dealId);
  const { address, assetClass, askPrice, unitCount } = deal;
  
  // Step 1: Research the market (web search)
  const marketResearch = await researchMarket(address, assetClass);
  // Uses Anthropic API with web search tool
  // Searches: "[assetClass] market [city] cap rates 2024"
  // "[assetClass] asking rents [city] [year]"
  // "[city] [assetClass] vacancy rate"
  
  // Step 2: Find comparable sales (from internal DB + web)
  const comps = await findComparableDeals(dealId, assetClass);
  
  // Step 3: Pull public records (ATTOM)
  const publicRecords = await publicRecordsService.enrichDealFromAddress(address);
  
  // Step 4: AI synthesizes all data → suggests pro forma assumptions
  const assumptions = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `You are a CRE underwriting analyst. Based on the following research, 
      suggest specific pro forma assumptions for this deal.
      
      DEAL: ${assetClass} | ${address} | ${unitCount} units | Ask: $${askPrice?.toLocaleString()}
      
      MARKET RESEARCH:
      ${marketResearch}
      
      COMPARABLE SALES:
      ${formatComps(comps)}
      
      PUBLIC RECORDS:
      Year Built: ${publicRecords.yearBuilt}
      Last Sale: ${publicRecords.lastSaleDate} at $${publicRecords.lastSalePrice?.toLocaleString()}
      
      Provide specific assumptions in this exact JSON format:
      {
        "going_in_occupancy": 0.92,
        "stabilized_occupancy": 0.95,
        "average_rent_per_unit": 1850,
        "annual_rent_growth": 0.03,
        "expense_ratio": 0.42,
        "going_in_cap_rate": 0.063,
        "exit_cap_rate": 0.068,
        "hold_period_years": 5,
        "debt_assumption": { "ltv": 0.70, "rate": 0.065, "amortization": 30, "term": 5 },
        "market_commentary": "2-3 sentences on market conditions",
        "risk_flags": ["list of 3-5 risk flags to investigate"],
        "confidence": "high | medium | low"
      }`,
    }],
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
  });
  
  const suggested = JSON.parse(extractJSON(assumptions.content));
  
  // Step 5: Apply to financial model (creates draft, doesn't overwrite)
  await createDraftProForma(dealId, suggested);
  
  return {
    dealId,
    marketResearch,
    suggestedAssumptions: suggested,
    compsFound: comps.length,
    publicRecordsEnriched: !!publicRecords.yearBuilt,
    confidence: suggested.confidence,
    riskFlags: suggested.risk_flags,
  };
}
```

### AI Underwriting UI

```typescript
// New deal creation flow:
// After address + asset class entered:
// Banner appears: "🤖 AI Underwriting Assistant is analyzing this deal..."
// Progress steps: "Researching market..." → "Finding comps..." → "Building assumptions..."
// ~20-30 seconds

// Result panel:
// "AI-Suggested Assumptions" card with all suggested values
// Confidence badge: High / Medium / Low
// Source badges on each value: "From 6 comps" | "Market research" | "Historical average"
// Risk Flags: orange warning cards for each flag
// Market Commentary: 2-3 paragraph AI narrative

// "Apply to Pro Forma" button:
// Pre-fills all financial model assumption fields
// Each AI-filled field shows small "AI" badge
// User can override any value
// Original AI suggestions preserved in sidebar for reference

// "Regenerate" button: runs again with updated parameters
// "I'll fill manually" button: dismisses the assistant
```

---

## G.2 Document Intelligence (Full)

### Overview
AI reads ANY document in the deal vault — Phase I/II environmental reports, appraisals, surveys, title commitments, engineering reports, loan documents — extracts key findings, flags issues, and links findings to DD checklist items.

### Supported Document Types

```typescript
const DOCUMENT_INTELLIGENCE_TYPES = {
  phase_1_environmental: {
    extractFields: [
      'recognized_environmental_conditions',
      'historical_uses',
      'underground_storage_tanks',
      'asbestos',
      'lead_paint',
      'dry_cleaners_nearby',
      'gas_stations_nearby',
      'recommendations',
      'consultant_name',
      'report_date',
      'scope_limitations',
    ],
    riskFlags: [
      'rec_identified', // Recognized Environmental Condition found
      'vapor_intrusion_concern',
      'further_investigation_recommended', // → Phase II
      'historical_industrial_use',
    ],
  },
  appraisal: {
    extractFields: [
      'appraised_value',
      'appraisal_date',
      'effective_date',
      'approach_to_value', // sales comp, income, cost
      'cap_rate_used',
      'market_rent_estimate',
      'comp_sales', // array of comps used
      'limiting_conditions',
      'extraordinary_assumptions',
    ],
    riskFlags: [
      'value_significantly_below_ask',
      'extraordinary_assumptions_present',
      'dated_appraisal', // > 6 months old
      'income_approach_only', // no sales comp approach
    ],
  },
  title_commitment: {
    extractFields: [
      'legal_description',
      'vesting',
      'schedule_b_1_requirements', // items to clear before close
      'schedule_b_2_exceptions', // exceptions in policy
      'existing_liens',
      'easements',
      'encumbrances',
      'survey_exceptions',
    ],
    riskFlags: [
      'outstanding_liens_to_clear',
      'access_easement_issues',
      'survey_exception', // requires survey
      'mechanic_liens',
      'lis_pendens', // lawsuit pending
    ],
  },
  loan_document: {
    extractFields: [
      'loan_amount',
      'rate',
      'maturity_date',
      'prepayment_terms',
      'financial_covenants',
      'dscr_covenant',
      'ltv_covenant',
      'carve_outs',
      'springing_recourse_triggers',
      'lockbox_requirements',
      'reserve_requirements',
    ],
    riskFlags: [
      'tight_dscr_covenant',
      'springing_recourse_triggers',
      'lockbox_activation',
      'cash_management_triggers',
    ],
  },
  engineering_report: {
    extractFields: [
      'immediate_repairs_needed',
      'deferred_maintenance',
      'capital_reserve_recommendation',
      'useful_life_estimates',
      'major_systems_condition',
      'estimated_repair_costs',
    ],
    riskFlags: [
      'immediate_life_safety_issues',
      'capital_requirement_exceeds_reserves',
      'structural_concerns',
      'system_end_of_life',
    ],
  },
};
```

### Document Intelligence Pipeline

```typescript
// POST /api/document-intelligence/analyze
// Triggered: when document uploaded to deal vault AND type is supported

export async function analyzeDocument(documentId: number): Promise<DocumentAnalysis> {
  const doc = await getDocumentById(documentId);
  const pdfBuffer = await downloadDocument(doc.storageUrl);
  const base64Pdf = pdfBuffer.toString('base64');
  
  const docTypeConfig = DOCUMENT_INTELLIGENCE_TYPES[doc.documentType];
  if (!docTypeConfig) return null; // Not a supported type
  
  const extractionPrompt = buildExtractionPrompt(doc.documentType, docTypeConfig);
  
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Pdf } },
        { type: 'text', text: extractionPrompt },
      ],
    }],
  });
  
  const extracted = JSON.parse(extractJSON(response.content[0].text));
  const riskFlags = detectDocumentRisks(extracted, doc.documentType, docTypeConfig);
  
  // Link risk flags to DD checklist items automatically
  await linkFlagsToDD(doc.dealId, riskFlags);
  
  // Store analysis
  const analysis = await db.insert(documentAnalyses).values({
    documentId, dealId: doc.dealId,
    extractedData: extracted,
    riskFlags,
    analyzedAt: new Date(),
  }).returning();
  
  // Activity log
  await logActivity(doc.dealId, 'document_intelligence', 
    `AI analyzed ${doc.documentType}: ${riskFlags.length} flags found`
  );
  
  return analysis[0];
}

// Auto-DD linking:
// Phase I with RECs found → links to DD item: "Phase II Environmental Study"
// Appraisal below ask → links to DD item: "Negotiate purchase price"
// Title exception → links to DD item: "Clear title exception with seller"
// Loan covenant triggers → links to DD item: "Review DSCR covenant compliance"
```

---

## G.3 AI Deal Sourcing

### Overview
Analyzes your historical deal activity to identify your "ideal deal" profile, then scores inbound deals against your buy box and monitors market listings for new opportunities matching your criteria.

### Ideal Deal Profile Builder

```typescript
// lib/aiSourcing/idealDealProfile.ts

export async function buildIdealDealProfile(orgId: number): Promise<IdealDealProfile> {
  // Pull all closed deals (deals where stage = 'closed')
  const closedDeals = await getClosedDeals(orgId);
  
  if (closedDeals.length < 3) {
    return buildDefaultProfile(orgId); // Not enough data
  }
  
  // Find common characteristics of best performers
  const topPerformers = closedDeals
    .sort((a, b) => b.actualIRR - a.actualIRR)
    .slice(0, Math.ceil(closedDeals.length * 0.4)); // Top 40%
  
  const prompt = `Analyze these top-performing CRE investments and identify their common characteristics 
  to define the ideal acquisition profile.
  
  TOP PERFORMING DEALS:
  ${topPerformers.map(d => `
    Asset Class: ${d.assetClass} | Market: ${d.market}
    Acquisition Cap Rate: ${d.acquisitionCapRate}% | Purchase Price: $${d.acquisitionPrice?.toLocaleString()}
    Units/SF: ${d.unitCount} | Year Built: ${d.yearBuilt}
    IRR Achieved: ${d.actualIRR}% | Equity Multiple: ${d.actualEM}x
    Value Add: ${d.valueAddStrategy || 'None'}
  `).join('\n')}
  
  Provide a JSON ideal deal profile with specific ranges for each parameter.`;
  
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });
  
  return JSON.parse(extractJSON(response.content[0].text));
}

interface IdealDealProfile {
  preferredAssetClasses: string[];
  preferredMarkets: string[];
  priceRange: { min: number; max: number };
  capRateRange: { min: number; max: number };
  unitsRange: { min: number; max: number };
  yearBuiltRange: { min: number; max: number };
  preferredValueAddStrategies: string[];
  avoidCharacteristics: string[];
  confidence: number; // 0-1 based on data quality
}
```

### Deal Scoring Against Buy Box

```typescript
// When a new deal is created, auto-score it:
export async function scoreDealAgainstBuyBox(
  dealId: number,
  orgId: number
): Promise<BuyBoxScore> {
  const deal = await getDealById(dealId);
  const profile = await getIdealDealProfile(orgId);
  
  let score = 100;
  const matches: string[] = [];
  const misses: string[] = [];
  
  // Score each dimension
  if (profile.preferredAssetClasses.includes(deal.assetClass)) {
    matches.push(`✅ Asset class (${deal.assetClass}) in target set`);
  } else {
    score -= 25;
    misses.push(`❌ Asset class (${deal.assetClass}) outside target set`);
  }
  
  if (deal.askPrice >= profile.priceRange.min && deal.askPrice <= profile.priceRange.max) {
    matches.push('✅ Price in target range');
  } else {
    score -= 20;
    misses.push(`❌ Price $${deal.askPrice?.toLocaleString()} outside $${profile.priceRange.min?.toLocaleString()}-$${profile.priceRange.max?.toLocaleString()} range`);
  }
  
  // ... similar scoring for cap rate, units, market, year built
  
  const tier = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';
  
  return { dealId, score, tier, matches, misses };
}
```

---

## G.4 Predictive Analytics

### Overview
Machine learning models trained on your portfolio history to predict deal closure probability, asset underperformance risk, and optimal hold period.

### Prediction Models

```typescript
// Model 1: Deal Closure Probability
// Inputs: stage, days in stage, days since last activity, team engagement score,
//         deal size vs. org capacity, asset class match, price vs. comp
// Output: % probability of closing within 90 days
// Use case: focus team effort on highest-probability deals

// Model 2: Asset Underperformance Early Warning
// Inputs: occupancy trend (last 3 months), NOI variance, maintenance spend trajectory,
//         lease rollover exposure, market conditions, DSCR trend
// Output: 0-100 risk score for underperformance in next 6 months
// Use case: proactive asset management before problems become crises

// Model 3: Optimal Hold Period
// Inputs: current cap rate, market cap rate trend, remaining lease term, DSCR,
//         projected rent growth, exit cap assumptions, debt maturity
// Output: recommended exit window (year range) + IRR projection per year
// Use case: portfolio harvest timing

// Implementation approach:
// Phase 1: Rule-based scoring (can be built immediately)
// Phase 2: Train ML models once sufficient historical data exists (18+ months)
// Phase 3: Refine models with outcome data (closed deals, realized exits)

// For Phase 1 (rule-based deal closure predictor):
function predictClosureProbability(deal: Deal): number {
  let score = 50; // base
  
  // Stage adjustments
  const stageBase: Record<string, number> = {
    'prospect': 5, 'loi_submitted': 35, 'loi_accepted': 60,
    'psa_executed': 75, 'due_diligence': 80, 'financing': 85, 'clear_to_close': 95,
  };
  score = stageBase[deal.stage] || 50;
  
  // Activity signal: recent activity increases probability
  const daysSinceActivity = getDaysSince(deal.lastActivityAt);
  if (daysSinceActivity < 3) score += 10;
  else if (daysSinceActivity > 14) score -= 15;
  else if (daysSinceActivity > 30) score -= 30;
  
  // Deal size: very large deals take longer
  if (deal.askPrice > 50_000_000) score -= 10;
  
  // DD completion: more complete = higher confidence
  const ddCompletionPct = deal.ddCompletionPct || 0;
  score += (ddCompletionPct - 50) * 0.2;
  
  return Math.max(0, Math.min(100, score));
}
```

---

## G.5 AI Meeting Transcription + CRM Sync

### Overview
Integrates with Zoom/Teams/Google Meet to auto-transcribe calls, extract action items, identify deal mentions, and sync everything to CRM.

### Implementation

```typescript
// lib/meetings/meetingIntelligence.ts
// Integration options:
// 1. Zoom: Zoom API + webhook on recording.completed
// 2. Teams: Microsoft Graph API
// 3. Google Meet: Google Workspace Events API
// 4. Fallback: Upload audio/transcript file manually

export const meetingRecordings = pgTable('meeting_recordings', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  userId: integer('user_id').references(() => users.id),
  externalMeetingId: varchar('external_meeting_id', { length: 255 }),
  platform: varchar('platform', { length: 20 }), // 'zoom' | 'teams' | 'google_meet' | 'upload'
  title: varchar('title', { length: 255 }),
  startTime: timestamp('start_time'),
  duration: integer('duration'), // seconds
  participants: jsonb('participants'),
  // [{ name, email, joinTime, leaveTime }]
  
  // Transcription
  transcriptText: text('transcript_text'),
  transcriptUrl: varchar('transcript_url', { length: 500 }),
  
  // AI Analysis
  summary: text('summary'),
  keyDecisions: jsonb('key_decisions'),
  actionItems: jsonb('action_items'),
  // [{ task, assignee, dueDate, dealMention }]
  dealsMentioned: jsonb('deals_mentioned'), // dealIds
  contactsMentioned: jsonb('contacts_mentioned'), // contactIds
  nextSteps: text('next_steps'),
  
  // CRM sync
  syncedToContactIds: jsonb('synced_to_contact_ids'),
  syncedToDealIds: jsonb('synced_to_deal_ids'),
  activityLoggedAt: timestamp('activity_logged_at'),
  tasksCreatedAt: timestamp('tasks_created_at'),
  
  // Status
  transcriptionStatus: varchar('transcription_status', { length: 20 }),
  // 'pending' | 'processing' | 'complete' | 'failed'
  analysisStatus: varchar('analysis_status', { length: 20 }),
  
  createdAt: timestamp('created_at').defaultNow(),
});

// Post-meeting AI analysis prompt:
const MEETING_ANALYSIS_PROMPT = `
Analyze this meeting transcript and provide:
1. A 3-5 sentence summary of what was discussed
2. Key decisions made (if any)
3. Action items with: task description, who is responsible (name from transcript), 
   due date mentioned (or "TBD"), and which deal it relates to (if mentioned)
4. Any deals or properties mentioned by name or address
5. Any contacts mentioned by name or company
6. Next steps and follow-up items

Return in JSON format:
{
  "summary": "...",
  "key_decisions": [...],
  "action_items": [{ "task": "...", "assignee": "...", "due_date": "...", "deal_mention": "..." }],
  "deals_mentioned": [...],
  "contacts_mentioned": [...],
  "next_steps": "..."
}
`;

// Auto-create tasks: action items from meeting → tasks in MarinaMatch
// Auto-log activity: meeting summary → logged on each mentioned deal/contact
// Auto-link: if contact email in participants → log meeting on their CRM record
```

---

# PART H — SCALE & ENTERPRISE

---

## H.1 Multi-Entity / Multi-Fund Architecture

### Overview
Support GPs who operate multiple entities — Fund I, Fund II, SMAs, co-investment vehicles — each with its own P&L, LP roster, and reporting, while maintaining cross-entity visibility at the GP level.

### Data Models

```typescript
// Organizations can have multiple "entities" (legal entities)
export const legalEntities = pgTable('legal_entities', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  name: varchar('name', { length: 255 }),
  // "Harborside Capital Fund I, LP"
  entityType: varchar('entity_type', { length: 50 }),
  // 'fund' | 'sma' | 'co_investment' | 'operating_company' | 'holding_company' | 'gp_entity'
  taxId: varchar('tax_id', { length: 50 }), // encrypted
  jurisdiction: varchar('jurisdiction', { length: 100 }),
  // Delaware LP, Cayman Islands, Florida LLC
  incorporationDate: date('incorporation_date'),
  parentEntityId: integer('parent_entity_id').references(() => legalEntities.id),
  // For fund → GP entity relationship
  status: varchar('status', { length: 30 }),
  // 'active' | 'winding_down' | 'dissolved'
  logoUrl: varchar('logo_url', { length: 500 }),
  // Each entity can have its own branding for LP portal
  taxClassification: varchar('tax_classification', { length: 50 }),
  // 'partnership' | 's_corp' | 'c_corp' | 'llc_disregarded' | 'llc_partnership'
  fiscalYearEnd: varchar('fiscal_year_end', { length: 5 }),
  // 'MM-DD' e.g., '12-31'
  createdAt: timestamp('created_at').defaultNow(),
});

// All existing tables get entity_id column:
// deals.entity_id → which entity owns this deal
// investors.entity_id → which entity they invested in
// distributions.entity_id → from which entity
// capital_calls.entity_id → from which entity

// Entity-level analytics:
// Each entity has its own P&L, LP roster, portfolio metrics
// GP-level view: roll-up across all entities
// Entity selector in navigation: switch context between entities
// Cross-entity deals: some deals may have co-investment from multiple entities

// Entity sharing:
// Contacts shared across entities (one CRM, multiple entities)
// Vendors shared across entities
// Documents can be shared or entity-specific
```

### Multi-Entity UI

```typescript
// Header: Entity selector dropdown (shows all entities)
// Current entity: "Harborside Fund I" with fund type badge
// Switching entity: reloads relevant data for selected entity
// "All Entities" view: cross-entity GP dashboard (portfolio rollup)

// Entity Management page (Settings):
// Entity org chart visualization
// Add entity wizard
// Entity detail: name, type, dates, tax info, linked deals/funds
// Cap table summary per entity
```

---

## H.2 White-Label API

### Overview
REST API for enterprise clients to pull data from MarinaMatch into their own BI tools, push data from external systems, or build custom integrations.

### API Design

```typescript
// REST API: api.marinamatch.com/v1/
// Authentication: API key (Bearer token) or OAuth 2.0
// Rate limiting: 1000 requests/hour (standard), 10000/hour (enterprise)
// Format: JSON
// Versioning: URL versioning (/v1/, /v2/)

// API Key management:
export const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  name: varchar('name', { length: 255 }), // "Tableau Integration"
  keyHash: varchar('key_hash', { length: 255 }), // bcrypt hash of actual key
  keyPrefix: varchar('key_prefix', { length: 8 }), // "mm_sk_xx" for display
  scopes: jsonb('scopes'),
  // ['deals:read', 'financials:read', 'lp:read', 'contacts:write']
  ipAllowlist: jsonb('ip_allowlist'),
  // Optional: restrict to specific IPs
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  revokedAt: timestamp('revoked_at'),
});

// API Endpoints (public API surface):
// GET /v1/deals — list deals (filterable, paginated)
// GET /v1/deals/:id — deal detail
// GET /v1/deals/:id/financials — financial model summary
// GET /v1/portfolio/summary — portfolio KPIs
// GET /v1/portfolio/assets — all assets with metrics
// GET /v1/lp/investors — investor list
// GET /v1/lp/investments — investment positions
// GET /v1/lp/distributions — distribution history
// GET /v1/contacts — contact list
// POST /v1/contacts — create contact
// GET /v1/work-orders — work order list
// POST /v1/work-orders — create work order
// GET /v1/webhooks — list webhooks
// POST /v1/webhooks — register webhook
// DELETE /v1/webhooks/:id — remove webhook

// Documentation: Swagger/OpenAPI spec auto-generated
// Interactive docs: /api/docs (Swagger UI)
// Client SDKs: JavaScript/TypeScript + Python (auto-generated from OpenAPI spec)
```

---

## H.3 Multi-Currency & International

### Overview
Support for non-USD deals with currency conversion in financial models, FX risk tracking, and international address formats.

### Data Models

```typescript
export const exchangeRates = pgTable('exchange_rates', {
  id: serial('id').primaryKey(),
  baseCurrency: varchar('base_currency', { length: 3 }).default('USD'),
  targetCurrency: varchar('target_currency', { length: 3 }),
  rate: numeric('rate', { precision: 15, scale: 8 }),
  // USD to EUR: 0.92; means 1 USD = 0.92 EUR
  source: varchar('source', { length: 50 }), // 'openexchangerates' | 'ecb' | 'manual'
  rateDate: date('rate_date'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Add to deals table:
// currency: varchar('currency', { length: 3 }).default('USD')

// Financial model: all inputs/outputs stored in deal currency
// Display: can toggle between deal currency and USD equivalent
// Portfolio rollup: convert all non-USD values to USD at current rates
// FX risk note: show % exposure to non-USD currencies in portfolio

// Daily job: fetch exchange rates from Open Exchange Rates API (free tier: 1000 calls/month)
// Currency selector on deal creation
// Historical rate lookup: for deals denominated in foreign currency,
//   show USD equivalent at acquisition date vs. today
```

---

## H.4 Virtual Data Room

### Overview
Secure, branded data room for marketing deals to buyers or lenders. Granular access controls, NDA tracking, document view analytics, and expiring access links.

### Data Models

```typescript
export const dataRooms = pgTable('data_rooms', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  dealId: integer('deal_id').references(() => deals.id),
  name: varchar('name', { length: 255 }),
  // e.g., "Harborside Marina — Investor Materials"
  purpose: varchar('purpose', { length: 30 }),
  // 'buyer_marketing' | 'lender_marketing' | 'lp_diligence' | 'internal'
  status: varchar('status', { length: 20 }),
  // 'draft' | 'active' | 'closed'
  accessLinkSlug: varchar('access_link_slug', { length: 100 }).unique(),
  // app.marinamatch.com/dataroom/abc123
  requireNDA: boolean('require_nda').default(true),
  ndaDocId: integer('nda_doc_id'),
  requireEmail: boolean('require_email').default(true),
  password: varchar('password', { length: 255 }),
  // Optional password protection
  expiresAt: timestamp('expires_at'),
  brandingConfig: jsonb('branding_config'),
  // Logo, colors for the data room landing page
  createdAt: timestamp('created_at').defaultNow(),
});

export const dataRoomAccess = pgTable('data_room_access', {
  id: serial('id').primaryKey(),
  dataRoomId: integer('data_room_id').references(() => dataRooms.id),
  accessType: varchar('access_type', { length: 20 }),
  // 'individual' | 'group' | 'open' (anyone with link)
  email: varchar('email', { length: 255 }),
  // For individual access
  name: varchar('name', { length: 255 }),
  company: varchar('company', { length: 255 }),
  permissionLevel: varchar('permission_level', { length: 20 }),
  // 'view' | 'download' | 'download_watermarked' | 'no_download'
  ndaSignedAt: timestamp('nda_signed_at'),
  accessGrantedAt: timestamp('access_granted_at'),
  expiresAt: timestamp('expires_at'),
  revoked: boolean('revoked').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const dataRoomViews = pgTable('data_room_views', {
  id: bigserial('id').primaryKey(),
  dataRoomId: integer('data_room_id').references(() => dataRooms.id),
  accessId: integer('access_id').references(() => dataRoomAccess.id),
  documentId: integer('document_id').references(() => documents.id),
  viewedAt: timestamp('viewed_at').defaultNow(),
  duration: integer('duration'), // seconds spent viewing
  pagesViewed: jsonb('pages_viewed'), // [1, 2, 3, ...]
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: varchar('user_agent', { length: 500 }),
  downloaded: boolean('downloaded').default(false),
});
```

### Data Room Features

```typescript
// Folder structure:
// GP creates folder hierarchy in data room
// Drag documents from deal vault into data room
// Set per-folder access levels (some buyers can see more than others)
// Watermarking: on download, embed viewer's name/email in PDF pages

// Analytics dashboard (GP-facing):
// Who has accessed the data room (name, company, last access)
// What they viewed (document, pages, time spent)
// Heat map: most-viewed documents
// Activity timeline: all views in chronological order
// "Engagement score" per viewer: more engaged = warmer lead

// NDA flow:
// Viewer clicks link → lands on branded page
// "Sign NDA to access" button → DocuSign embedded signing
// Upon completion → access granted to data room
// NDA signature timestamped and stored

// Alerts to GP:
// "New visitor: John Smith at Blackstone viewed the OM for 8 minutes"
// "Sarah Chen at Starwood downloaded the rent roll"
// Real-time email + in-app notifications
```

---

## H.5 Bulk Import / Data Migration Tools

### Overview
Migration wizard to onboard existing deal data, contacts, and financial history from Excel, CSV, or other platforms.

### Import Sources Supported

```typescript
const IMPORT_SOURCES = {
  excel_deals: {
    label: 'Excel Deal Tracker',
    description: 'Import deals from any Excel or CSV deal pipeline spreadsheet',
    fieldMapping: 'manual', // user maps columns
    template: 'deals_import_template.xlsx',
  },
  excel_contacts: {
    label: 'Excel Contact List',
    template: 'contacts_import_template.xlsx',
  },
  excel_rent_roll: {
    label: 'Rent Roll (Excel)',
    description: 'Import existing rent roll with tenant and lease data',
    template: 'rent_roll_import_template.xlsx',
  },
  juniper_square: {
    label: 'Juniper Square Export',
    description: 'Import investor and LP data from Juniper Square',
    format: 'csv',
  },
  dealpath: {
    label: 'Dealpath Export',
    description: 'Import deal pipeline from Dealpath CSV export',
    format: 'csv',
  },
  salesforce: {
    label: 'Salesforce Export',
    description: 'Import contacts and activities from Salesforce',
    format: 'csv',
  },
  hubspot: {
    label: 'HubSpot Export',
    description: 'Import contacts and deals from HubSpot',
    format: 'csv',
  },
  appfolio: {
    label: 'AppFolio Export',
    description: 'Import properties, tenants, and financials from AppFolio',
    format: 'csv',
  },
};
```

### Import Wizard UI

```typescript
// Step 1: Select source type
// Step 2: Upload file (CSV or Excel)
// Step 3: Column mapping
//   - AI-assisted: auto-detects columns and suggests mappings
//   - e.g., user has "Deal Name" column → maps to deal.name
//   - User can override any mapping
//   - Shows first 5 rows as preview
// Step 4: Data validation
//   - Shows errors per row (invalid dates, missing required fields, duplicates)
//   - User can fix in-place, skip error rows, or fix in original file and re-upload
// Step 5: Import preview
//   - Shows count: X deals to create, Y to update, Z to skip
//   - Download validation report (shows exactly what will happen)
// Step 6: Execute import
//   - Progress bar
//   - Shows successes and failures in real time
//   - "Undo Import" button (available for 24 hours after import)

// Deduplication logic:
// For contacts: match on email address
// For deals: match on property address + asset class
// If match found: show user "Update existing" vs "Create new" vs "Skip"
```

---

# PART I — COMPLIANCE & RISK

---

## I.1 Climate Risk Module

### Overview
For each asset: FEMA flood zone, hurricane/wildfire/earthquake risk scores, sea level rise projections, and climate-adjusted insurance cost estimates.

### Data Models

```typescript
export const climateRiskAssessments = pgTable('climate_risk_assessments', {
  id: serial('id').primaryKey(),
  dealId: integer('deal_id').references(() => deals.id),
  orgId: integer('org_id').references(() => organizations.id),
  assessedAt: timestamp('assessed_at').defaultNow(),
  
  // FEMA Flood Zone
  femaFloodZone: varchar('fema_flood_zone', { length: 10 }),
  // 'AE' | 'VE' | 'X' | 'X500' | 'AO' | 'AH' etc.
  femaFloodZoneDescription: varchar('fema_flood_zone_description', { length: 255 }),
  annualFloodRisk: numeric('annual_flood_risk', { precision: 5, scale: 4 }),
  // % chance of flooding in any given year
  floodInsuranceRequired: boolean('flood_insurance_required').default(false),
  basalFloodElevation: numeric('basal_flood_elevation', { precision: 6, scale: 2 }),
  // feet above sea level
  
  // Sea Level Rise
  seaLevelRise2050: numeric('sea_level_rise_2050', { precision: 5, scale: 2 }),
  // inches projected rise by 2050 (NOAA data)
  seaLevelRise2100: numeric('sea_level_rise_2100', { precision: 5, scale: 2 }),
  coastalFloodRisk2050: varchar('coastal_flood_risk_2050', { length: 20 }),
  // 'negligible' | 'low' | 'moderate' | 'high' | 'extreme'
  
  // Physical Hazards (0-100 risk scores)
  hurricaneRisk: integer('hurricane_risk'),
  wildfireRisk: integer('wildfire_risk'),
  earthquakeRisk: integer('earthquake_risk'),
  tornadoRisk: integer('tornado_risk'),
  heatRisk: integer('heat_risk'), // heat stress risk (relevant for HVAC costs)
  droughtRisk: integer('drought_risk'),
  winterStormRisk: integer('winter_storm_risk'),
  
  // Composite scores
  overallPhysicalRisk: integer('overall_physical_risk'), // 0-100
  transitionRisk: integer('transition_risk'),
  // Risk from policy/regulatory changes (carbon pricing, building codes)
  
  // Financial impact
  estimatedInsurancePremiumIncrease5yr: numeric('estimated_insurance_premium_increase_5yr', { precision: 5, scale: 2 }),
  // % increase in insurance premiums over 5 years
  climateAdjustedCapRate: numeric('climate_adjusted_cap_rate', { precision: 5, scale: 2 }),
  // Cap rate adjusted for climate risk premium
  
  // Green certifications
  leedCertification: varchar('leed_certification', { length: 50 }),
  energyStarScore: integer('energy_star_score'),
  
  // Data sources
  dataProvider: varchar('data_provider', { length: 100 }),
  // 'firststreet' | 'jupiter' | 'risq' | 'manual'
  dataProviderUrl: varchar('data_provider_url', { length: 500 }),
  
  notes: text('notes'),
});
```

### Climate Risk Data Providers
- First Street Foundation (free API for flood risk)
- Jupiter Intelligence (enterprise climate data)
- FEMA Flood Map Service Center (free)
- NOAA Sea Level Rise Viewer (free)
- USGS Earthquake Hazards Program (free)

### Climate Risk Display

```typescript
// Deal workspace → Climate Risk tab
// Overall risk gauge (0-100) with tier: Low/Moderate/High/Critical
// Individual hazard score cards (flood, hurricane, wildfire, earthquake, heat)
// Interactive FEMA flood map (embedded iframe from FEMA)
// Sea level rise projections chart (current vs. 2050 vs. 2100)
// Insurance impact estimate
// "This information may affect your underwriting" callout:
//   "Properties in AE flood zone require flood insurance (~$X,000/yr estimated)"
//   "3.2' sea level rise projected by 2100 — monitor long-term hold periods"
// Institutional LP disclosure section:
//   AI-generated climate risk disclosure paragraph for investor materials
```

---

## I.2 Environmental Tracking

### Overview
Track Phase I/II environmental study status, known contamination, remediation projects, and regulatory compliance for each property.

### Data Models

```typescript
export const environmentalStudies = pgTable('environmental_studies', {
  id: serial('id').primaryKey(),
  dealId: integer('deal_id').references(() => deals.id),
  orgId: integer('org_id').references(() => organizations.id),
  studyType: varchar('study_type', { length: 20 }), // 'phase1' | 'phase2' | 'phase3'
  status: varchar('status', { length: 30 }),
  // 'ordered' | 'in_progress' | 'complete' | 'rec_identified' | 'clean'
  consultantFirm: varchar('consultant_firm', { length: 255 }),
  consultantContact: varchar('consultant_contact', { length: 255 }),
  orderedDate: date('ordered_date'),
  completedDate: date('completed_date'),
  reportDocId: integer('report_doc_id'),
  
  // Findings
  recsFound: boolean('recs_found').default(false),
  // Recognized Environmental Conditions
  recDescriptions: jsonb('rec_descriptions'),
  hrecFound: boolean('hrec_found').default(false),
  // Historical RECs (no longer active but documented)
  
  // Phase II specific
  samplesTaken: integer('samples_taken'),
  contaminantsFound: jsonb('contaminants_found'),
  // [{ contaminant, concentration, regulatoryLimit, exceedance }]
  remediationRequired: boolean('remediation_required').default(false),
  
  // Cost
  studyCost: numeric('study_cost', { precision: 10, scale: 2 }),
  estimatedRemediationCost: numeric('estimated_remediation_cost', { precision: 12, scale: 2 }),
  
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const remediationProjects = pgTable('remediation_projects', {
  id: serial('id').primaryKey(),
  dealId: integer('deal_id').references(() => deals.id),
  studyId: integer('study_id').references(() => environmentalStudies.id),
  status: varchar('status', { length: 30 }),
  // 'planning' | 'regulatory_approval' | 'active' | 'monitoring' | 'complete' | 'nfa'
  // nfa = No Further Action letter received
  contaminant: varchar('contaminant', { length: 255 }),
  remediationApproach: text('remediation_approach'),
  regulatoryAgency: varchar('regulatory_agency', { length: 255 }),
  caseNumber: varchar('case_number', { length: 100 }),
  startDate: date('start_date'),
  expectedCompletionDate: date('expected_completion_date'),
  actualCompletionDate: date('actual_completion_date'),
  nfaLetterDate: date('nfa_letter_date'),
  nfaLetterDocId: integer('nfa_letter_doc_id'),
  budgetedCost: numeric('budgeted_cost', { precision: 12, scale: 2 }),
  actualCostToDate: numeric('actual_cost_to_date', { precision: 12, scale: 2 }),
  riskRetentionEscrow: numeric('risk_retention_escrow', { precision: 12, scale: 2 }),
  // Escrow held by lender until NFA received
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

---

## I.3 Insurance Management

### Overview
Track all property and liability insurance policies across the portfolio: coverage, premiums, renewals, carriers, claims, and ensure no lapsed coverage.

### Data Models

```typescript
export const insurancePolicies = pgTable('insurance_policies', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  dealId: integer('deal_id').references(() => deals.id).default(null),
  // null for entity-level policies (D&O, E&O, umbrella)
  policyType: varchar('policy_type', { length: 100 }),
  // property_casualty | general_liability | flood | umbrella | workers_comp
  // professional_liability | directors_officers | cyber | environmental | earthquake
  insurerName: varchar('insurer_name', { length: 255 }),
  brokerName: varchar('broker_name', { length: 255 }),
  brokerEmail: varchar('broker_email', { length: 255 }),
  policyNumber: varchar('policy_number', { length: 100 }),
  
  // Coverage
  coverageType: varchar('coverage_type', { length: 50 }),
  // replacement_cost | actual_cash_value | agreed_value
  coverageAmount: numeric('coverage_amount', { precision: 15, scale: 2 }),
  deductible: numeric('deductible', { precision: 10, scale: 2 }),
  liabilityLimit: numeric('liability_limit', { precision: 15, scale: 2 }),
  
  // Premium
  annualPremium: numeric('annual_premium', { precision: 10, scale: 2 }),
  paymentFrequency: varchar('payment_frequency', { length: 20 }),
  // 'annual' | 'semi_annual' | 'quarterly' | 'monthly'
  
  // Dates
  effectiveDate: date('effective_date'),
  expirationDate: date('expiration_date'),
  renewalDate: date('renewal_date'),
  
  // Required by lender?
  requiredByLender: boolean('required_by_lender').default(false),
  lenderRequirementDoc: varchar('lender_requirement_doc', { length: 500 }),
  
  // Status
  status: varchar('status', { length: 20 }),
  // 'active' | 'expired' | 'cancelled' | 'renewed' | 'pending_renewal'
  
  // Documents
  certificateDocId: integer('certificate_doc_id'),
  policyDocId: integer('policy_doc_id'),
  
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const insuranceClaims = pgTable('insurance_claims', {
  id: serial('id').primaryKey(),
  policyId: integer('policy_id').references(() => insurancePolicies.id),
  dealId: integer('deal_id').references(() => deals.id),
  claimNumber: varchar('claim_number', { length: 100 }),
  lossDate: date('loss_date'),
  reportedDate: date('reported_date'),
  lossType: varchar('loss_type', { length: 100 }),
  // fire | water | wind | liability | theft | vandalism | flood
  description: text('description'),
  claimAmount: numeric('claim_amount', { precision: 12, scale: 2 }),
  deductibleApplied: numeric('deductible_applied', { precision: 10, scale: 2 }),
  approvedAmount: numeric('approved_amount', { precision: 12, scale: 2 }),
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }),
  status: varchar('status', { length: 30 }),
  // reported | in_review | approved | denied | closed | supplemental
  adjusterName: varchar('adjuster_name', { length: 255 }),
  adjusterEmail: varchar('adjuster_email', { length: 255 }),
  resolutionDate: date('resolution_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### Insurance Dashboard

```typescript
// Portfolio insurance overview:
// Table: Deal | Policy Type | Insurer | Coverage | Premium | Expiration | Status
// Expiring Soon section: policies expiring within 60 days (sorted by urgency)
// "Renew" button on each expiring policy → opens renewal workflow
// Coverage gap detector: deals with no active property policy flagged in red
// Total portfolio insurance cost: sum of all premiums YTD
// Claims history: open claims, total paid, total reserves

// Policy detail page:
// Coverage summary
// Premium payment history
// Claims history
// Documents (cert, policy)
// Renewal history (previous policy terms comparison)
// "Request Certificate" button → emails broker for current cert
```

---

## I.4 Regulatory Calendar

### Overview
Track recurring regulatory compliance obligations by asset class and jurisdiction: fire inspections, elevator certifications, health department inspections, ADA reviews, licensing renewals.

### Data Models

```typescript
export const regulatoryObligations = pgTable('regulatory_obligations', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  dealId: integer('deal_id').references(() => deals.id),
  obligationType: varchar('obligation_type', { length: 100 }),
  // fire_inspection | elevator_certification | boiler_inspection | pool_inspection
  // health_department | food_service_permit | business_license | marina_license
  // ada_compliance_review | building_permit_renewal | environmental_permit
  // lift_station_inspection | fuel_system_inspection | electrical_panel_inspection
  description: varchar('description', { length: 500 }),
  regulatoryBody: varchar('regulatory_body', { length: 255 }),
  // Name of agency: "Tampa Fire Department" | "FDEP" | "DBPR"
  frequency: varchar('frequency', { length: 30 }),
  // 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'biennial' | 'as_needed'
  lastCompletedDate: date('last_completed_date'),
  nextDueDate: date('next_due_date'),
  noticePeriodDays: integer('notice_period_days').default(30),
  // Alert this many days before due
  status: varchar('status', { length: 20 }),
  // 'current' | 'due_soon' | 'overdue' | 'in_progress' | 'exempt'
  complianceDocId: integer('compliance_doc_id'),
  // Latest inspection certificate / license
  cost: numeric('cost', { precision: 8, scale: 2 }),
  // Typical cost per occurrence
  vendor: varchar('vendor', { length: 255 }), // inspector or agency
  notes: text('notes'),
  isAutoRenewing: boolean('is_auto_renewing').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### Pre-Seeded Obligation Templates by Asset Class

```typescript
// Marina obligations:
const MARINA_OBLIGATIONS = [
  { type: 'fire_inspection', frequency: 'annual', noticePeriod: 60 },
  { type: 'fuel_system_inspection', frequency: 'annual', noticePeriod: 60 },
  { type: 'marina_license', frequency: 'annual', noticePeriod: 90 },
  { type: 'environmental_permit', frequency: 'annual', noticePeriod: 90 },
  { type: 'health_department', frequency: 'annual', noticePeriod: 60 },
  // if marina has restaurant/snack bar
  { type: 'lift_station_inspection', frequency: 'annual', noticePeriod: 30 },
  { type: 'boiler_inspection', frequency: 'annual', noticePeriod: 30 },
  { type: 'electrical_panel_inspection', frequency: 'annual', noticePeriod: 30 },
];

// Multifamily obligations:
const MULTIFAMILY_OBLIGATIONS = [
  { type: 'fire_inspection', frequency: 'annual', noticePeriod: 60 },
  { type: 'elevator_certification', frequency: 'annual', noticePeriod: 60 },
  { type: 'boiler_inspection', frequency: 'annual', noticePeriod: 30 },
  { type: 'pool_inspection', frequency: 'semi_annual', noticePeriod: 30 },
  { type: 'business_license', frequency: 'annual', noticePeriod: 60 },
];
```

### Regulatory Calendar UI

```typescript
// Calendar view: monthly calendar showing upcoming inspections
// Color coded: green (>60 days) | yellow (30-60 days) | orange (14-30 days) | red (<14 days) | red+overdue
// Filter by asset, obligation type, status
// List view: upcoming obligations table (sortable by due date)
// Bulk "Mark Complete" with document upload
// Automated reminders: email + SMS at notice_period_days before due
// Compliance scorecard per property: X of Y obligations current
// Portfolio compliance dashboard: % of properties fully current
```

---

# PART J — MOBILE & UX

---

## J.1 Native Mobile App (iOS + Android)

### Overview
Native iOS and Android app built with React Native. Core functionality optimized for field use with push notifications, offline mode, camera integration, and GPS features.

### Architecture

```typescript
// Tech stack:
// Framework: React Native (Expo managed workflow)
// Navigation: React Navigation v6
// State: Zustand + React Query (same as web)
// Offline: WatermelonDB for local SQLite database
// Push: Expo Notifications (FCM + APNs)
// Storage: Expo SecureStore (encrypted) for auth tokens
// Camera: Expo Camera
// Location: Expo Location

// Screens:
const APP_SCREENS = {
  auth: ['Login', 'ForgotPassword', '2FAChallenge', 'SetupBiometrics'],
  deals: ['DealsList', 'DealDetail', 'DealFinancials', 'DealDocuments', 'DealActivity', 'DealTasks'],
  contacts: ['ContactsList', 'ContactDetail', 'AddContact', 'LogCall', 'QuickNote'],
  operations: ['WorkOrdersList', 'WorkOrderDetail', 'NewWorkOrder', 'InspectionCapture'],
  portfolio: ['PortfolioSummary', 'AssetList', 'AssetDetail'],
  notifications: ['NotificationCenter', 'NotificationSettings'],
  settings: ['Profile', 'Security', 'Preferences'],
};
```

### Key Mobile-Specific Features

```typescript
// 1. Biometric Authentication
// Face ID / Touch ID login after initial email/password + 2FA setup
// Auto-lock after 15 minutes of inactivity

// 2. Push Notifications
// All 14 alert trigger types from main spec (Section 9.1)
// Rich notifications: show deal name + quick action buttons
// "Accept LOI?" notification with Approve/Decline buttons

// 3. Offline Mode
// Last 50 deals cached locally with full financial model data
// Work orders can be created offline → sync when connected
// Inspection forms completable offline → upload photos when on WiFi
// "Offline Mode" banner when not connected
// Sync status indicator showing pending uploads

// 4. Camera Integration
// Work Order Photos: camera launches in WO detail → auto-uploads to work order
// Document Scanner: scan physical documents → PDF created → stored in deal vault
// Property Photos: geotagged photos stored in deal's photo library
// Inspection: photo capture per inspection item

// 5. GPS Deal Finder
// Map view showing all active deals near current location
// "Properties Near Me" based on GPS coordinates
// Sort by distance
// Useful during broker tours, site visits

// 6. Voice Notes
// Record voice memo in any activity log → auto-transcribed via Whisper API → saved as note
// Useful when driving between properties

// 7. Quick Actions (iOS Widget / Android Widget)
// Home screen widget: Today's tasks | Portfolio KPI strip | Recent activity

// 8. Deep Linking
// Notification → opens specific deal or work order
// Email link → opens deal workspace in app
// Data room link → opens in in-app browser

// App Store deployment:
// iOS: App Store (Apple Developer Program - $99/yr)
// Android: Google Play (one-time $25 fee)
// Over-the-air updates: Expo Updates (JS-only code updates without app store review)
```

---

## J.2 Onboarding & In-App Training

### Overview
Guided product tours for new users, contextual tooltips, searchable in-app help center, video walkthroughs, and gamified getting-started checklist.

### Onboarding Flow

```typescript
export const userOnboarding = pgTable('user_onboarding', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  orgId: integer('org_id').references(() => organizations.id),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  
  // Checklist items (completed = true)
  profileCompleted: boolean('profile_completed').default(false),
  firstDealCreated: boolean('first_deal_created').default(false),
  firstContactAdded: boolean('first_contact_added').default(false),
  financialModelRun: boolean('financial_model_run').default(false),
  firstDocumentUploaded: boolean('first_document_uploaded').default(false),
  teamMemberInvited: boolean('team_member_invited').default(false),
  notificationsConfigured: boolean('notifications_configured').default(false),
  billingSetup: boolean('billing_setup').default(false),
  integrationConnected: boolean('integration_connected').default(false),
  
  // Tour progress
  toursCompleted: jsonb('tours_completed'),
  // ['deal_workspace', 'financial_model', 'crm', ...]
  tooltipsDismissed: jsonb('tooltips_dismissed'),
  helpArticlesViewed: jsonb('help_articles_viewed'),
  
  completionPct: integer('completion_pct').default(0),
});

// Product tour library (using Shepherd.js or Intro.js):
const TOURS = {
  welcome: {
    steps: [
      { element: '#nav-deals', title: 'Your Deals', content: 'This is where all your acquisition opportunities live.' },
      { element: '#nav-crm', title: 'CRM', content: 'Track contacts, brokers, lenders, and LPs here.' },
      { element: '#nav-portfolio', title: 'Portfolio', content: 'View all your assets under management from one dashboard.' },
      // ... 8-10 steps
    ],
  },
  deal_workspace: {
    // Tour specific to deal workspace: financial model, DD, documents, activity
    steps: [ /* ... */ ],
  },
  financial_model: {
    // Walk-through of financial model: enter actuals, build pro forma, review DCF
    steps: [ /* ... */ ],
  },
};
```

### In-App Help System

```typescript
// Help Center (slide-over panel from help icon):
// Powered by: Mintlify, Intercom, or custom-built
// Articles organized by module
// Full-text search across all articles
// "Contact Support" button
// Video walkthroughs (Loom embeds) for complex features

// Contextual tooltips (? icons on every non-obvious element):
// Hover ? → shows 1-3 sentence explanation
// Link to full help article
// "Don't show again" option

// Getting Started Checklist widget:
// Floating card (bottom-right or top-right of dashboard)
// Shows: 4/9 steps complete [progress bar]
// Lists remaining steps with checkmarks
// Click step → takes user to relevant page
// Dismissable once 80%+ complete
// Completion celebration: confetti + "You're all set!" message

// Feature Announcement banners:
// When new features ship, show contextual banner
// "New: AI Underwriting Assistant is now available in your deal workspace"
// "Dismiss" or "Try It" buttons
// Tracked per user (only shown once)

// Empty state guidance:
// Every empty state (no deals, no contacts, no work orders) has:
//   - Illustration
//   - "What is this?" description
//   - "Get started" action button
//   - Link to relevant help article
```

---

## J.3 Dark Mode

### Overview
Full dark mode support with OS-level detection and manual toggle. Every component, chart, map, and modal supports dark theme.

### Implementation

```typescript
// Using: next-themes or system CSS variables approach
// Theme tokens defined in CSS variables:

:root {
  /* Light mode defaults */
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-tertiary: #f1f5f9;
  --bg-card: #ffffff;
  --bg-input: #ffffff;
  
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  
  --border-primary: #e2e8f0;
  --border-secondary: #cbd5e1;
  
  --accent-primary: #2563eb;    /* Blue */
  --accent-secondary: #7c3aed; /* Purple */
  
  /* Status colors */
  --status-green: #16a34a;
  --status-yellow: #ca8a04;
  --status-red: #dc2626;
  --status-orange: #ea580c;
  
  /* Chart colors */
  --chart-1: #2563eb;
  --chart-2: #7c3aed;
  --chart-3: #059669;
  --chart-4: #d97706;
  --chart-5: #dc2626;
}

[data-theme='dark'] {
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --bg-tertiary: #334155;
  --bg-card: #1e293b;
  --bg-input: #1e293b;
  
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  
  --border-primary: #334155;
  --border-secondary: #475569;
  
  /* Keep accent/status colors mostly same with slight adjustments */
  --accent-primary: #3b82f6;
  --status-green: #22c55e;
}

// ThemeContext:
export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useLocalStorage('theme', 'system');
  
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);
  
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Settings page: theme selector
// Options: System (follows OS) | Light | Dark
// Instant toggle (no page reload)
// Persisted in localStorage + user preferences DB

// Chart theming:
// Recharts: use CSS variable values for colors
// D3 charts: listen for theme changes, re-apply color schemes
// Maps: switch between Google Maps light/dark basemap styles

// Email previews and generated PDFs:
// Always render in light mode (PDF/print context)
// Never inherit dark mode for exported documents
```

---

# APPENDIX: GAP SPEC IMPLEMENTATION PRIORITIES

## Priority Ranking (Revenue Impact × Build Feasibility)

### 🔴 CRITICAL — Build Before Monetization
| # | Feature | Why Critical |
|---|---------|-------------|
| 1 | **A.1 Billing Engine** | Can't charge without it |
| 2 | **A.2 RBAC** | Enterprise sales blocker |
| 3 | **B.3 KYC/AML** | LP portal legally incomplete |
| 4 | **A.3 Audit Trail** | Compliance requirement for institutional |
| 5 | **A.5 2FA** | Security requirement for LP data |

### 🟠 HIGH IMPACT — Phase 2 Focus
| # | Feature | Why Important |
|---|---------|--------------|
| 6 | **B.1 Fund-Level FM** | Doubles TAM (fund managers vs. deal sponsors) |
| 7 | **C.2 Online Rent Collection** | Recurring revenue for operators |
| 8 | **G.1 AI Underwriting** | Demo wow factor, acquisition driver |
| 9 | **F.1 QuickBooks Sync** | #1 request from operators |
| 10 | **C.1 Tenant Portal** | Transforms platform from acquisition to management |

### 🟡 SIGNIFICANT VALUE — Phase 3
| # | Feature | Why Valuable |
|---|---------|-------------|
| 11 | **E.1 Custom Report Builder** | Enterprise retention driver |
| 12 | **D.1 Construction Module** | Opens value-add and development deals |
| 13 | **H.4 Virtual Data Room** | Monetizable standalone feature |
| 14 | **E.3 Portfolio Stress Testing** | Institutional LP requirement |
| 15 | **G.2 Document Intelligence** | Extends AI moat |
| 16 | **B.4 Capital Account Ledger** | Required for fund-level reporting |
| 17 | **F.6 Public Records/Title** | Speeds up underwriting |
| 18 | **J.1 Native Mobile App** | Field GP requirement |
| 19 | **C.3 Lease Renewal Workflow** | Post-acquisition PM value |
| 20 | **I.3 Insurance Management** | Portfolio hygiene, compliance |

### 🟢 NICE TO HAVE — Phase 4+
| # | Feature | Notes |
|---|---------|-------|
| 21 | A.4 SSO | Enterprise only |
| 22 | B.2 Fund Formation Docs | Legal + enterprise |
| 23 | C.4 Rent Roll Intelligence | Extends existing leases module |
| 24 | D.2 Renovation Unit Tracker | Multifamily specific |
| 25 | E.2 Performance Attribution | Sophisticated institutional need |
| 26 | F.2 PMS Sync | Integration project |
| 27 | F.3 CoStar Integration | Expensive API |
| 28 | G.3 AI Deal Sourcing | ML data requirements |
| 29 | G.5 Meeting Transcription | Nice AI feature |
| 30 | H.1 Multi-Entity | Enterprise-only use case |
| 31 | H.2 White-Label API | API productization |
| 32 | H.3 Multi-Currency | International GPs |
| 33 | H.5 Bulk Import | Onboarding optimization |
| 34 | I.1 Climate Risk | ESG requirement emerging |
| 35 | I.2 Environmental | Already partially in DD |
| 36 | I.4 Regulatory Calendar | Operations-heavy assets |
| 37 | J.2 Onboarding | Product-led growth |
| 38 | J.3 Dark Mode | QOL feature |

---

## COMBINED MASTER ROADMAP (Volume 1 + Volume 2)

### Phase 1 (Now — Months 1-3)
From Vol 1: Key Dates on Kanban, Custom Stage Labels, Activity Log Polish, Email Send, Workflow Automation, Gantt View
From Vol 2: **Billing Engine**, **2FA**, Audit Trail

### Phase 2 (Months 3-6)
From Vol 1: Ask Your Deal AI, AI Narrative Generator, Deal Risk Scoring
From Vol 2: **RBAC**, **KYC/AML**, Online Rent Collection, QuickBooks Sync, AI Underwriting

### Phase 3 (Months 6-12)
From Vol 1: LP Dashboard, Capital Calls, Waterfall, Lender Matching, Term Sheet Comparator
From Vol 2: Fund-Level FM, Tenant Portal, Custom Report Builder, Virtual Data Room, Construction Module

### Phase 4 (Year 2)
From Vol 1: Portfolio Dashboard, Work Orders, Vendor Mgmt, CapEx Tracker, Benchmark Engine
From Vol 2: Capital Account Ledger, Mobile App, Performance Attribution, Portfolio Stress Testing, Insurance Management

---

*End of MarinaMatch Gap Feature Specification (Volume 2)*
*Generated: 2026-03-24*
*Version: 1.0*
*Features Specified: 38 major features | 300+ sub-features*
*Combined with Volume 1: 85 major features | 500+ sub-features*
