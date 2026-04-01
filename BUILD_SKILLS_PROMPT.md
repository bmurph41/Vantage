# CLAUDE CODE BUILD PROMPT
# Skills & Context Docs: Financial Wizard / Analytical Guru / CRM Expert
# Run this in your Replit shell: claude --dangerously-skip-permissions < BUILD_SKILLS_PROMPT.md
# Or paste directly into a Claude Code session.

---

## YOUR MISSION

Build out a complete set of skills and context docs that make you a financial wizard,
analytical guru, and CRM expert across MarinaMatch (Vantage) and StayMate.

You are building TWO types of files:

1. **Claude.ai Skills** — SKILL.md files that live in `~/workspace/skills/`
   These teach Claude how to reason about financial modeling, analytics, and CRM
   when working in this chat interface.

2. **Claude Code Context Docs** — .md files that live in `~/workspace/docs/context/`
   (MarinaMatch) and in the StayMate workspace. These orient you (Claude Code)
   during autonomous build sessions.

Read `~/workspace/MARINAMATCH_JOURNAL.md` first, then execute all steps below.

---

## STEP 1 — Create directory structure

```bash
mkdir -p ~/workspace/skills/financial-wizard
mkdir -p ~/workspace/skills/analytical-guru
mkdir -p ~/workspace/skills/crm-building
mkdir -p ~/workspace/skills/cre-benchmarks
mkdir -p ~/workspace/skills/str-analytics
mkdir -p ~/workspace/docs/context
```

---

## STEP 2 — Build Claude.ai Skill: CRE Financial Modeling

Create `~/workspace/skills/financial-wizard/SKILL.md` with the following content:

---
name: cre-financial-modeling
description: >
  Use this skill for any commercial real estate financial modeling task.
  Triggers: cap rate analysis, NOI calculation, DCF modeling, IRR/equity multiple
  analysis, waterfall distributions, debt structuring, DSCR analysis, pro forma
  construction, exit strategy modeling, hold period optimization, sensitivity analysis,
  or any underwriting work across marina, multifamily, self-storage, or other CRE assets.
---

# CRE Financial Modeling — Expert Reference

## Cap Rate Benchmarks by Asset Class (2024-2025)

| Asset Class | Value-Add | Stabilized | Institutional |
|---|---|---|---|
| Marina / Waterfront | 6.5–8.5% | 5.5–7.0% | 4.5–6.0% |
| Multifamily (Class A) | 5.5–6.5% | 4.5–5.5% | 3.5–4.5% |
| Multifamily (Class B/C) | 6.5–8.0% | 5.5–7.0% | 5.0–6.0% |
| Self-Storage | 6.0–7.5% | 5.0–6.5% | 4.5–5.5% |
| Industrial | 5.5–7.0% | 4.5–5.5% | 3.5–4.5% |
| Retail Strip | 7.0–9.0% | 6.0–7.5% | 5.5–6.5% |
| Office (suburban) | 7.5–10.0% | 6.5–8.5% | N/A (distressed) |
| Hospitality | 8.0–11.0% | 7.0–9.0% | 6.0–8.0% |

Always flag if modeled cap rate is outside ±150bps of the asset class range.

## NOI Construction

```
Gross Potential Revenue (GPR)
− Vacancy & Credit Loss         (5–10% typical; marina: 3–8%)
= Effective Gross Revenue (EGR)
+ Other Income                  (ancillary, parking, storage)
= Total Revenue
− Operating Expenses            (30–55% of EGR typical)
= Net Operating Income (NOI)
```

### Marina-Specific Revenue Lines
- Slip rental (seasonal vs. annual mix matters — annual more stable)
- Dry storage fees
- Fuel sales (high revenue, low margin — ~15–25% gross margin)
- Service/repair labor + parts
- Ship's store / retail
- Launch fees
- Live-aboard surcharges
- Pump-out fees

### Marina Expense Ratio Benchmarks
- Well-run marina: 35–50% expense ratio
- Red flag: >60% (operational issues) or <30% (likely under-reporting)
- CapEx reserve: $500–$1,500/slip/year depending on infrastructure age

## DSCR Standards by Lender Type

| Lender Type | Min DSCR | Typical LTV | Notes |
|---|---|---|---|
| Agency (Freddie/Fannie) | 1.25x | 70–80% | MF only |
| CMBS | 1.20–1.25x | 65–75% | Stricter post-2023 |
| Life Insurance Co. | 1.30–1.40x | 55–65% | Best rates, slowest |
| Regional Bank | 1.20–1.30x | 65–75% | Relationship-driven |
| SBA 7(a) | 1.15–1.25x | up to 90% | For owner-operators |
| Bridge/Debt Fund | 1.05–1.15x | 70–80% | Value-add, short-term |
| Marina-Specific Lenders | 1.25–1.35x | 60–70% | Specialty asset premium |

Always test DSCR at stressed rate (+150–200bps above contract rate).

## IRR & Return Targets by Strategy

| Strategy | Unlevered IRR | Levered IRR | Equity Multiple |
|---|---|---|---|
| Core | 5–7% | 7–10% | 1.5–1.8x |
| Core-Plus | 7–9% | 9–13% | 1.7–2.2x |
| Value-Add | 9–13% | 13–18% | 2.0–2.8x |
| Opportunistic | 13–18% | 18–25%+ | 2.5–4.0x+ |

Marina acquisitions typically underwrite as value-add (operational upside)
or opportunistic (distressed infrastructure, deferred maintenance).

## Waterfall Distribution Mechanics

### Standard 2-Tier Waterfall
```
Tier 1: Return of capital to all investors (pari passu)
Tier 2: Preferred return to LP (typically 6–8% IRR hurdle)
Above hurdle: Promote split (e.g., 70/30 LP/GP or 80/20)
```

### 3-Tier Waterfall (Institutional)
```
Tier 1: Return of capital
Tier 2: 8% preferred return (LP gets 100%)
Tier 3: 8–12% IRR band (LP 80% / GP 20%)
Tier 4: Above 12% IRR (LP 70% / GP 30%)
```

### Key Waterfall Formulas
```
LP Preferred Return = Invested Capital × Pref Rate × Hold Period
GP Promote = (Total Distributions − LP Preferred − Capital Return) × GP %
Equity Multiple = Total Distributions / Total Equity Invested
```

## DCF Methodology

### Discount Rate Selection
- Core assets: 6–8% (WACC-based or market-derived)
- Value-add: 9–12%
- Opportunistic / marina: 12–15%
- Rule: discount rate ≥ levered IRR target

### Terminal Value Methods
1. **Exit Cap Rate** (preferred for CRE): `NOI(Year N+1) / Exit Cap Rate`
2. **Gordon Growth**: `NOI(Year N) × (1 + g) / (r - g)` — use for stable assets only
3. **Sales Comparable**: best for assets with thin cap rate history

### Exit Cap Rate Conventions
- Typically 25–50bps above entry cap rate (risk of cap rate expansion)
- Marina: add 50–75bps for illiquidity premium
- Never underwrite exit cap below entry cap without strong market evidence

## Sensitivity Analysis Framework

Always test these variables (tornado chart order by impact):
1. Exit cap rate (±50bps)
2. Revenue growth rate (±1%)
3. Vacancy rate (±2%)
4. Interest rate (±100bps)
5. Hold period (±2 years)
6. CapEx timing (±1 year)

## Common Underwriting Errors to Flag

- Vacancy below 5% without justification
- Expense ratio below 30% (likely missing reserves or management fee)
- NOI growth >5%/year without market evidence
- Exit cap same as entry cap (no risk premium)
- Debt service calculated on I/O but not tested on full amortization
- Missing CapEx reserves entirely
- Seasonality not modeled for seasonal assets (marina, hospitality, STR)

---

## STEP 3 — Build Claude.ai Skill: DCF & Valuation

Create `~/workspace/skills/financial-wizard/DCF_VALUATION.md`:

---
name: dcf-and-valuation
description: >
  Use for any discounted cash flow, valuation, XIRR, NPV, or investment returns
  analysis. Triggers: NPV calculation, IRR computation, XIRR for irregular cash flows,
  equity multiple, hold period optimization, sensitivity tables, scenario analysis,
  terminal value methodology, or any "what is this deal worth" question.
---

# DCF & Valuation — Expert Reference

## XIRR vs IRR

| | IRR | XIRR |
|---|---|---|
| Cash flow timing | Assumes periodic (annual) | Uses actual dates |
| When to use | Clean annual pro formas | Irregular closings, mid-year sales |
| MarinaMatch | Used in DCF engine | Canonical — one implementation |

```javascript
// XIRR Newton-Raphson implementation (canonical — do not duplicate)
// Located at: server/utils/financial/xirr.ts
// Input: [{ date: Date, amount: number }]
// Output: decimal rate (e.g. 0.142 = 14.2% IRR)
```

## NPV Formula
```
NPV = Σ [CF_t / (1 + r)^t] − Initial Investment
```
- Positive NPV = value-creating at given discount rate
- NPV = 0 when discount rate = IRR

## Hold Period Optimization

Test IRR at each hold year. Peak IRR year = optimal hold.
Typical pattern for value-add: IRR peaks at Year 5–7 as value-add
work completes and before major CapEx cycle returns.

## Scenario Framework

Always run three scenarios:
| Scenario | Revenue | Expenses | Exit Cap | Weight |
|---|---|---|---|---|
| Bull | +10% vs base | −5% vs base | −25bps | 25% |
| Base | As modeled | As modeled | As modeled | 50% |
| Bear | −10% vs base | +10% vs base | +50bps | 25% |

Weighted IRR = (Bull IRR × 0.25) + (Base IRR × 0.50) + (Bear IRR × 0.25)

---

## STEP 4 — Build Claude.ai Skill: Analytical Guru

Create `~/workspace/skills/analytical-guru/SKILL.md`:

---
name: data-analysis-patterns
description: >
  Use for any analytics, metrics, SQL query building, dashboard design,
  or data interpretation task. Triggers: cohort analysis, funnel metrics,
  conversion rates, time-series analysis, KPI definition, pipeline velocity,
  deal analytics, guest analytics, operational metrics, or any "show me the
  numbers" request for MarinaMatch or StayMate.
---

# Data Analysis Patterns — Expert Reference

## CRE Deal Analytics (MarinaMatch)

### Pipeline Velocity Metrics
```sql
-- Average days per stage
SELECT
  stage_name,
  AVG(days_in_stage) as avg_days,
  COUNT(*) as deal_count,
  SUM(CASE WHEN exited_reason = 'won' THEN 1 ELSE 0 END) as won,
  SUM(CASE WHEN exited_reason = 'lost' THEN 1 ELSE 0 END) as lost
FROM deal_stage_history
WHERE org_id = $1
GROUP BY stage_name
ORDER BY stage_position;
```

### Conversion Rate by Stage
```sql
-- Stage-to-stage conversion funnel
SELECT
  from_stage,
  to_stage,
  COUNT(*) as transitions,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY from_stage) as conversion_pct
FROM deal_transitions
WHERE org_id = $1
GROUP BY from_stage, to_stage;
```

### Deal Velocity (Days to Close)
```sql
SELECT
  DATE_TRUNC('month', created_at) as cohort_month,
  AVG(EXTRACT(EPOCH FROM (closed_at - created_at))/86400) as avg_days_to_close,
  COUNT(*) as deals_closed,
  SUM(deal_value) as total_value
FROM crm_deals
WHERE status = 'won' AND org_id = $1
GROUP BY 1 ORDER BY 1;
```

### Activity Coverage (deals with no recent activity)
```sql
SELECT
  d.id, d.name, d.deal_value,
  MAX(a.created_at) as last_activity,
  EXTRACT(EPOCH FROM (NOW() - MAX(a.created_at)))/86400 as days_since_activity
FROM crm_deals d
LEFT JOIN crm_activities a ON a.entity_id = d.id AND a.entity_type = 'deal'
WHERE d.org_id = $1 AND d.status = 'active'
GROUP BY d.id, d.name, d.deal_value
HAVING days_since_activity > 14 OR MAX(a.created_at) IS NULL
ORDER BY days_since_activity DESC NULLS FIRST;
```

## STR Analytics (StayMate)

### Core Metrics
```
RevPAR = ADR × Occupancy Rate
     OR = Total Revenue / Available Room Nights

ADR = Total Room Revenue / Rooms Sold (occupied nights)

Occupancy Rate = Nights Booked / Total Available Nights

Booking Lead Time = AVG(check_in_date - booking_created_at)

Length of Stay = AVG(check_out_date - check_in_date)
```

### RevPAR Query (StayMate SQLite)
```sql
SELECT
  strftime('%Y-%m', check_in) as month,
  COUNT(*) as bookings,
  SUM(julianday(check_out) - julianday(check_in)) as nights_booked,
  -- Total available nights = days_in_month × active_properties
  ROUND(SUM(julianday(check_out) - julianday(check_in)) * 100.0 /
    (strftime('%d', date(check_in,'start of month','+1 month','-1 day')) *
     (SELECT COUNT(*) FROM properties WHERE host_id = gt.host_id)), 1) as occupancy_pct
FROM guest_tokens gt
WHERE host_id = ? AND is_demo = 0
GROUP BY month ORDER BY month;
```

### Guest Satisfaction Signals
```sql
-- Rating distribution by property
SELECT
  p.name as property_name,
  AVG(gr.rating) as avg_rating,
  COUNT(*) as total_ratings,
  SUM(CASE WHEN gr.rating >= 4 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as pct_positive
FROM guest_ratings gr
JOIN properties p ON p.id = gr.property_id
WHERE gr.host_id = ?
GROUP BY p.name;
```

## Dashboard Design Principles

### KPI Hierarchy (top of every dashboard)
1. Primary metric (the one number that matters most)
2. 3–5 supporting metrics with trend vs prior period
3. Actionable alert list (things requiring attention today)

### Chart Type Selection
| Data type | Best chart |
|---|---|
| Trend over time | Line chart |
| Category comparison | Bar chart (horizontal if many categories) |
| Part-to-whole | Donut (max 5 segments) |
| Correlation | Scatter plot |
| Pipeline stages | Funnel chart |
| Distribution | Histogram or box plot |
| Single KPI | Stat card with sparkline |

### Recharts Implementation Pattern (MarinaMatch / StayMate)
```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid,
         Tooltip, ResponsiveContainer } from 'recharts'

// Always wrap in ResponsiveContainer — never hardcode width
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
    <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
    <Tooltip formatter={(v) => formatCurrency(v)} />
    <Line type="monotone" dataKey="noi" stroke="#4ECDC4" strokeWidth={2} dot={false} />
  </LineChart>
</ResponsiveContainer>
```

---

## STEP 5 — Build Claude.ai Skill: CRM Building

Create `~/workspace/skills/crm-building/SKILL.md`:

---
name: crm-data-modeling
description: >
  Use for any CRM design, pipeline architecture, entity modeling, activity logging,
  relationship mapping, deal scoring, or sales process questions. Triggers: pipeline
  stage design, CRM entity relationships, deal scoring models, lead qualification,
  activity tracking, relationship intelligence, contact/company/deal modeling, or
  any "how should we structure the CRM" question.
---

# CRM Building — Expert Reference

## Entity Model (MarinaMatch CRM)

```
Organization (tenant root)
    │
    ├── Contacts (people)
    │       └── linked to Companies (many-to-many)
    │       └── linked to Deals (many-to-many, with role)
    │
    ├── Companies (organizations)
    │       └── linked to Contacts
    │       └── linked to Deals
    │
    ├── Deals (opportunities)
    │       └── belongs to Pipeline → Stage
    │       └── linked to Contacts, Companies
    │       └── has Activities, Tasks, Documents
    │       └── optionally linked to ModelingProject (Deal Room)
    │
    └── Tasks (to-dos)
            └── linked to any entity type
```

## Pipeline Stage Design Principles

### CRE Acquisition Pipeline (recommended stages)
```
Lead → Qualifying → LOI Submitted → Due Diligence → Under Contract → Closed Won
                                                                    → Closed Lost
```

| Stage | Exit Criteria | Avg Duration |
|---|---|---|
| Lead | Identified, not yet contacted | 1–14 days |
| Qualifying | Initial call done, meets buy-box | 7–30 days |
| LOI Submitted | LOI sent, awaiting response | 3–14 days |
| Due Diligence | LOI accepted, DD underway | 30–90 days |
| Under Contract | PSA executed, closing prep | 30–60 days |
| Closed Won | Deal closed | — |

### Stage Gate Rules
- Each stage should have clear, binary exit criteria
- No deal should skip stages (log if it does — data integrity signal)
- Stale detection: flag deals with no activity after N days per stage

## Activity Logging Schema

```sql
-- Every significant event logged here
crm_activities (
  id, org_id,
  entity_type,    -- 'deal' | 'contact' | 'company' | 'task'
  entity_id,
  activity_type,  -- see types below
  description,
  created_by,
  metadata        -- JSONB: call duration, email subject, etc.
)

-- Activity types
'note' | 'call' | 'email' | 'meeting' | 'site_visit'
| 'task_completed' | 'stage_change' | 'deal_created'
| 'document_added' | 'field_updated' | 'loi_submitted'
| 'dd_started' | 'offer_received'
```

## Deal Scoring Model

### Weighted Criteria Scoring (0–100)
```typescript
interface ScoringCriteria {
  capRate: { weight: 0.20, min: 0.05, target: 0.065, max: 0.10 }
  dscr: { weight: 0.20, min: 1.10, target: 1.30, max: 2.00 }
  location: { weight: 0.15 }    // subjective 0–10 scale
  occupancy: { weight: 0.15, min: 0.60, target: 0.85, max: 1.00 }
  pricePerSlip: { weight: 0.15 } // vs market comps
  waterDepth: { weight: 0.10 }   // marina-specific
  infrastructureAge: { weight: 0.05 }
}

// Score = Σ (criterionScore × weight) × 100
// A+ = 90–100, A = 75–89, B+ = 60–74, B = 45–59, C = 0–44
```

## Relationship Intelligence Patterns

### Preferred Network Scoring
```typescript
// Weighted score for each relationship
const score = (
  (dealHistory * 0.35) +      // # of deals transacted together
  (reliability * 0.30) +       // % of commitments kept
  (responsiveness * 0.20) +    // avg response time to outreach
  (networkReach * 0.15)        // # of relevant introductions made
) / 4 * 100
```

### Contact Freshness (staleness detection)
```sql
SELECT
  c.name, c.email,
  MAX(a.created_at) as last_touch,
  EXTRACT(EPOCH FROM (NOW() - MAX(a.created_at)))/86400 as days_since_touch
FROM crm_contacts c
LEFT JOIN crm_activities a ON a.entity_id = c.id AND a.entity_type = 'contact'
WHERE c.org_id = $1
GROUP BY c.id
HAVING days_since_touch > 90 OR MAX(a.created_at) IS NULL
ORDER BY days_since_touch DESC NULLS FIRST;
```

## CRM UI Principles

### Record Page Layout (3-column rule)
```
Left (~280px)  | Center (flex-1)      | Right (~320px)
Key details    | Tabbed content       | Related entities
Quick actions  | (Overview, Activity, | Recent activity
Linked objects | Documents, etc.)     | Upcoming tasks
```

### KPI Chips (top of every record)
Show 3–5 numbers at a glance. For a Deal:
- Deal Value, Stage, Days in Stage, Close Probability, Expected Close Date

### Activity Feed Design
- Reverse chronological (newest first)
- Group by date (Today, Yesterday, This Week, Earlier)
- Icon per activity type
- Inline edit for notes
- Filter by type

---

## STEP 6 — Build MarinaMatch Context Doc: benchmarks.md

Create `~/workspace/docs/context/benchmarks.md`:

This doc provides CRE market benchmarks that the financial model engine uses
as validation rails. When any modeled output falls outside these ranges,
surface a warning in the UI.

Include:
- Cap rate ranges by asset class and quality tier (same as SKILL.md above)
- DSCR thresholds by lender type
- Expense ratio norms by asset class
- IRR targets by strategy
- LTV limits by lender type
- Marina-specific benchmarks: $/slip pricing, fuel margin, expense ratios
- Validation rules (when to warn, when to error)
- How to wire warnings into the Pro Forma and DCF components

Format it as actionable code + data, not prose. Include the actual TypeScript
validation function signature that the financial model should call.

---

## STEP 7 — Build MarinaMatch Context Doc: analytics-queries.md

Create `~/workspace/docs/context/analytics-queries.md`:

A library of pre-built SQL queries for every metric in MarinaMatch's analytics.
Organise by section:

1. Pipeline analytics (velocity, conversion, deal value by stage)
2. CRM activity analytics (coverage, stale deals, activity frequency)
3. Financial model analytics (NOI distribution, cap rate distribution across portfolio)
4. Workflow analytics (rule execution rates, most-triggered rules)
5. Marketplace analytics (source performance, conversion from sourced → pipeline)
6. User/org analytics (feature usage, most active users)

For each query include:
- The SQL (PostgreSQL with $1 parameterized org_id)
- The React hook that calls it
- The Recharts component that renders it
- The route it maps to in the API

---

## STEP 8 — Build MarinaMatch Context Doc: deal-scoring.md

Create `~/workspace/docs/context/deal-scoring.md`:

Document the complete deal scoring system end-to-end:

1. The scoring criteria and weights (from Investment Criteria buy-box system)
2. The TypeScript scoring function (pure function — no side effects)
3. The DB schema for storing criteria and scores
4. The API route that computes a score on demand
5. The UI components: score badge, criterion breakdown cards, radar chart
6. How scores map to investment grades (A+ through C) on the Marina Map
7. How scores appear on Kanban cards and in list views

---

## STEP 9 — Build StayMate Context Doc: str-metrics.md

Create the StayMate equivalent. Save to the StayMate workspace.

If StayMate is a sibling directory, save to `~/workspace-staymate/docs/context/str-metrics.md`.
If it's in the same repo, save to `~/workspace/staymate/docs/context/str-metrics.md`.
Check the actual directory structure first: `ls ~/`

Include:
1. STR metric definitions (RevPAR, ADR, Occupancy, Lead Time, LOS)
2. Palm Harbor market benchmarks (research or use reasonable STR benchmarks for FL coastal)
3. SQL queries against the StayMate SQLite schema for each metric
4. How these metrics map to the Analytics V2 dashboard sections
5. The Recharts components to render each metric
6. Seasonal patterns for Palm Harbor (when to expect peaks/troughs)
7. Channel mix analysis (Airbnb vs Booking.com performance comparison)

---

## STEP 10 — Build StayMate Context Doc: guest-journey.md

Create `[staymate-workspace]/docs/context/guest-journey.md`:

Map the complete guest lifecycle and what StayMate does (or should do) at each stage:

```
Stage 1: Pre-Booking (lead capture via direct booking page)
Stage 2: Booking Confirmed (guest token created, welcome email sent)
Stage 3: Pre-Arrival (T-48h automation, check-in instructions)
Stage 4: Arrival Day (check-in automation, door code delivery)
Stage 5: Mid-Stay (concierge engagement, upsell opportunities)
Stage 6: Pre-Departure (T-24h checkout reminder)
Stage 7: Post-Stay (review request, return booking offer)
```

For each stage document:
- What automations fire (V1 and V2 rules)
- What data is available in the guest portal
- What actions the guest can take
- What the host sees in the dashboard
- What the ideal communication looks like
- What's currently built vs. what's missing

---

## STEP 11 — Update CLAUDE.md files

After creating all files, update the context doc tables in both CLAUDE.md files:

MarinaMatch `.claude/CLAUDE.md`: add these to the context doc table:
- `benchmarks.md` — CRE market benchmarks, validation ranges, warning thresholds
- `analytics-queries.md` — Pre-built SQL for every analytics metric
- `deal-scoring.md` — Investment criteria scoring system end-to-end

StayMate `.claude/CLAUDE.md`: add:
- `str-metrics.md` — RevPAR, ADR, occupancy, Palm Harbor benchmarks
- `guest-journey.md` — Full guest lifecycle, automations, portal stages

---

## STEP 12 — Validate

Run the following checks after creating all files:

```bash
# Confirm all files exist
echo "=== MarinaMatch Skills ===" && ls ~/workspace/skills/*/
echo "=== MarinaMatch Context Docs ===" && ls ~/workspace/docs/context/
echo "=== StayMate Context Docs ===" && ls [staymate-path]/docs/context/

# Confirm no TypeScript errors in MarinaMatch
cd ~/workspace && npx tsc --noEmit

# Confirm StayMate tests still pass
cd [staymate-path] && npm test

# Print summary of all files created
echo "BUILD COMPLETE" && find ~/workspace/skills -name "*.md" | wc -l && echo "skill files created"
```

---

## STEP 13 — Update MARINAMATCH_JOURNAL.md

Add a session entry documenting:
- All files created with their paths
- The skill system structure
- Next session: begin using benchmarks.md to add validation warnings
  to the Pro Forma and DCF components when outputs fall outside range
