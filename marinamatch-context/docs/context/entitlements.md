# MarinaMatch — Entitlements & Feature Gating

## Overview

MarinaMatch uses a subscription-based entitlements system with **atomic feature modules**.
Every feature in the platform is gated behind an entitlement check. Never ship a feature
without wiring it into the entitlements system.

---

## Core Concepts

### Atomic Feature Modules
Each feature is an independent, self-contained module with:
- A unique feature key (`string`)
- A minimum subscription tier required
- Optional: per-usage limits (e.g. "10 AI queries/month")

### Persona-Based Onboarding
Users are bucketed into personas on sign-up. Personas determine:
- Which features are highlighted in onboarding
- Default dashboard layout
- Recommended workflow

```typescript
type UserPersona =
  | 'individual_investor'      // Solo investor, self-directed
  | 'boutique_firm'            // Small team, 2–10 users
  | 'institutional'            // Large org, full platform access
  | 'broker'                   // Deal sourcing / marketplace focus
  | 'operator';                // Asset management / operations focus
```

---

## Subscription Tiers

```typescript
type SubscriptionTier =
  | 'free'          // Limited features, no financial modeling
  | 'starter'       // Individual investor, basic modeling
  | 'professional'  // Full modeling, CRM, AI advisor
  | 'enterprise';   // Everything, multi-user, payroll, API access
```

---

## Feature Keys Registry

All feature keys in one place. Add new keys here when building new features.

```typescript
const FEATURES = {
  // Financial Modeling
  PRO_FORMA: 'pro_forma',
  DCF_MODEL: 'dcf_model',
  MONTE_CARLO: 'monte_carlo',
  MULTI_YEAR_PROJECTION: 'multi_year_projection',
  EXIT_STRATEGY: 'exit_strategy',
  DEBT_MODELING: 'debt_modeling',
  PAYROLL_MODULE: 'payroll_module',

  // CRM
  CRM_CONTACTS: 'crm_contacts',
  CRM_COMPANIES: 'crm_companies',
  CRM_DEALS: 'crm_deals',
  CRM_PIPELINE: 'crm_pipeline',
  CRM_ACTIVITIES: 'crm_activities',
  RELATIONSHIP_INTELLIGENCE: 'relationship_intelligence',

  // Document Studio
  DOCUMENT_STUDIO: 'document_studio',
  IC_MEMO_GENERATOR: 'ic_memo_generator',
  OM_GENERATOR: 'om_generator',

  // Workflow
  WORKFLOW_AUTOMATION: 'workflow_automation',

  // AI
  AI_ADVISOR: 'ai_advisor',
  AI_ADVISOR_UNLIMITED: 'ai_advisor_unlimited',

  // Marketplace
  MARKETPLACE: 'marketplace',
  MARKETPLACE_SAVE: 'marketplace_save',
  MARKETPLACE_ADD_TO_PIPELINE: 'marketplace_add_to_pipeline',

  // Map
  MARINA_MAP: 'marina_map',

  // Analytics / Reporting
  INVESTMENT_CRITERIA: 'investment_criteria',
  DEAL_COMPARISON: 'deal_comparison',

  // Platform
  MULTI_USER: 'multi_user',
  API_ACCESS: 'api_access',
  WHITE_LABEL: 'white_label',
} as const;

type FeatureKey = typeof FEATURES[keyof typeof FEATURES];
```

---

## Tier → Feature Mapping

```typescript
const TIER_FEATURES: Record<SubscriptionTier, FeatureKey[]> = {
  free: [
    FEATURES.MARKETPLACE,
    FEATURES.CRM_CONTACTS,
    FEATURES.CRM_DEALS,
  ],
  starter: [
    ...TIER_FEATURES.free,
    FEATURES.PRO_FORMA,
    FEATURES.DCF_MODEL,
    FEATURES.MULTI_YEAR_PROJECTION,
    FEATURES.EXIT_STRATEGY,
    FEATURES.CRM_PIPELINE,
    FEATURES.CRM_COMPANIES,
    FEATURES.CRM_ACTIVITIES,
    FEATURES.MARKETPLACE_SAVE,
    FEATURES.MARKETPLACE_ADD_TO_PIPELINE,
    FEATURES.MARINA_MAP,
    FEATURES.AI_ADVISOR,            // limited: 20 queries/month
  ],
  professional: [
    ...TIER_FEATURES.starter,
    FEATURES.MONTE_CARLO,
    FEATURES.DEBT_MODELING,
    FEATURES.DOCUMENT_STUDIO,
    FEATURES.IC_MEMO_GENERATOR,
    FEATURES.OM_GENERATOR,
    FEATURES.WORKFLOW_AUTOMATION,
    FEATURES.RELATIONSHIP_INTELLIGENCE,
    FEATURES.INVESTMENT_CRITERIA,
    FEATURES.DEAL_COMPARISON,
    FEATURES.AI_ADVISOR_UNLIMITED,
    FEATURES.MULTI_USER,
  ],
  enterprise: [
    ...TIER_FEATURES.professional,
    FEATURES.PAYROLL_MODULE,
    FEATURES.API_ACCESS,
    FEATURES.WHITE_LABEL,
  ],
};
```

---

## Entitlement Check Patterns

### Server-Side Check (in route handlers)
```typescript
import { hasFeature } from '../services/entitlements';

router.get('/dcf', requireAuth, async (req, res) => {
  const orgId = req.user!.orgId;

  // Always check entitlement before proceeding
  const allowed = await hasFeature(orgId, FEATURES.DCF_MODEL);
  if (!allowed) {
    return res.status(403).json({
      error: 'Feature not available',
      feature: FEATURES.DCF_MODEL,
      upgradeRequired: true
    });
  }

  // ... route logic
});
```

### hasFeature Implementation
```typescript
export async function hasFeature(
  orgId: string,
  feature: FeatureKey
): Promise<boolean> {
  const result = await pool.query(
    `SELECT subscription_tier, feature_overrides
     FROM organizations
     WHERE id = $1`,
    [orgId]
  );

  if (result.rows.length === 0) return false;

  const { subscription_tier, feature_overrides } = result.rows[0];

  // Check explicit overrides first (for enterprise custom deals)
  if (feature_overrides) {
    const overrides = feature_overrides as Record<FeatureKey, boolean>;
    if (overrides[feature] !== undefined) return overrides[feature];
  }

  // Check tier
  const tierFeatures = TIER_FEATURES[subscription_tier as SubscriptionTier] ?? [];
  return tierFeatures.includes(feature);
}
```

### Client-Side Check (in React components)
```typescript
import { useEntitlements } from '../hooks/useEntitlements';

function DCFModelTab() {
  const { hasFeature, isLoading } = useEntitlements();

  if (isLoading) return <LoadingSpinner />;

  if (!hasFeature(FEATURES.DCF_MODEL)) {
    return (
      <UpgradePrompt
        feature="DCF Model"
        requiredTier="starter"
        description="Unlock discounted cash flow analysis and IRR calculations."
      />
    );
  }

  return <DCFModel />;
}
```

### useEntitlements Hook
```typescript
export function useEntitlements() {
  const { data, isLoading } = useQuery({
    queryKey: ['entitlements'],
    queryFn: () => fetch('/api/entitlements').then(r => r.json()),
    staleTime: 5 * 60 * 1000  // cache 5 minutes
  });

  return {
    isLoading,
    tier: data?.tier as SubscriptionTier,
    hasFeature: (feature: FeatureKey) => data?.features?.includes(feature) ?? false,
    features: data?.features as FeatureKey[] ?? [],
  };
}
```

---

## UpgradePrompt Component

Standard component for locked features — always use this, never custom lock screens:

```typescript
interface UpgradePromptProps {
  feature: string;
  requiredTier: SubscriptionTier;
  description: string;
  compact?: boolean;  // for inline/card use vs full-page lock
}

// Renders:
// - Feature name + lock icon
// - Description of what they're missing
// - Required tier badge
// - "Upgrade to [Tier]" CTA button
// - (optional) feature screenshot/preview
```

---

## Entitlements API

```typescript
// Get current org's entitlements (called on app load)
GET /api/entitlements
Response: {
  tier: SubscriptionTier,
  features: FeatureKey[],
  limits: Record<string, { used: number; max: number | null }>,
  persona: UserPersona
}

// Admin: override a feature for an org
POST /api/admin/entitlements/override
Body: { orgId: string, feature: FeatureKey, enabled: boolean }
```

---

## Persona-Based Onboarding

On first login, users complete a 3-step onboarding wizard that sets their persona.
The persona determines their default sidebar layout and feature highlights.

```typescript
// Persona → default sidebar modules
const PERSONA_SIDEBAR: Record<UserPersona, string[]> = {
  individual_investor: ['deal-room', 'financial-model', 'marketplace'],
  boutique_firm:       ['crm', 'pipeline', 'deal-room', 'marketplace'],
  institutional:       ['crm', 'pipeline', 'deal-room', 'workflow', 'analytics'],
  broker:              ['marketplace', 'crm', 'contacts'],
  operator:            ['deal-room', 'financial-model', 'payroll'],
};
```

---

## Billing Integration (Future)

Feature gating is built and active. Billing engine is the next major milestone.
When billing is built:
- Connect Stripe subscription status → `organizations.subscription_tier`
- Webhook handler for subscription upgrades/downgrades
- Grace period handling for failed payments
- Usage tracking for metered features (AI queries, documents generated)

Do not add billing logic into entitlements service directly — keep them separate.
The entitlements service only reads `subscription_tier` from the org record.
