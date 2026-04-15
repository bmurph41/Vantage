/**
 * AI Assistant Service — Enhanced
 *
 * Key enhancements over v1:
 *  - Deep entity enrichment: when viewing a deal/model, fetches full financial data
 *  - Investment criteria integration: evaluates deals against org's buy-box
 *  - Deal comparison: side-by-side analysis of 2+ deals
 *  - Global knowledge: learns from ALL platform users, not just per-org
 *  - Multi-asset: benchmarks expanded beyond marina to all 55+ asset classes
 *  - Token tracking: feeds spending guard for cost control
 *  - Advisor persona: adapts responses based on org's feedback patterns
 */

import OpenAI from 'openai';
import { db } from '../db';
import { eq, and, desc, inArray, sql as drizzleSql, ilike } from 'drizzle-orm';
import {
  crmDeals,
  modelingProjects,
  projects,
  crmProperties,
  salesComps,
  aiAssistantFeedback,
  dealWorkspaces,
  crmNotes,
  crmContacts,
} from '@shared/schema';
import { getRAGContext, learnFromFeedback } from './knowledge-base-service';
import { trackAIUsage } from './ai/spending-guard';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssistantContext {
  currentPage: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  userId?: string;
  orgId?: string;
  advisoryMode?: AdvisoryMode;
  entityData?: Record<string, any>;
  compareEntityIds?: string[];   // For deal comparison
  injectedContextBlock?: string; // Pre-resolved deal/project context block
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export type AdvisoryMode =
  | 'general'
  | 'critique'
  | 'risk_analysis'
  | 'benchmark_comparison'
  | 'options_analysis'
  | 'decision_memo'
  | 'stress_test'
  | 'next_actions';

// ─── Industry Benchmarks (multi-asset, not just marina) ───────────────────────

const INDUSTRY_KNOWLEDGE = `
## Marina Industry Benchmarks & Market Intelligence (2024-2025)

### Cap Rate Benchmarks
- **Premium Coastal Marinas** (FL, CA, Northeast): 5.5% – 7.0%
- **Secondary Markets**: 7.0% – 8.5%
- **Tertiary/Inland**: 8.5% – 10.0%
- **Distressed Assets**: 10.0%+ (higher risk premium)
- **Trophy Assets**: 4.5% – 5.5% (institutional demand)
- Barrier-to-entry markets command 50–150bps compression
- Dry storage-heavy: 50–100bps wider than pure wet slip
- Long-term ground leases: +100–200bps vs fee simple

### NOI Multiples & Pricing
- **Typical**: 10x–18x trailing NOI
- **Premium**: 14x–20x NOI
- **Value-Add**: 8x–12x NOI
- **Price per Slip**: $15K–$60K (trophy coastal) → $5K–$15K (secondary) → $2K–$8K (tertiary)

### Occupancy Benchmarks
- Strong: 90%+ annual; Healthy: 80–90%; Concerning: <75%
- Seasonal: winter typically 60–70% of peak

### Revenue Per Slip
- Premium (Miami, SD, NYC): $15K–$35K+/slip/yr
- Secondary: $8K–$15K; Average: $4K–$8K; Tertiary: $2K–$4K

### Revenue Mix Best Practices
- Slip Rentals: 50–70% (stable, recurring)
- Fuel: 15–25% (~5–8% margin); Service/Repair: 10–20% (30–50% margin)
- Ship Store: 5–10%; Boat Sales: variable

### Operating Expense Ratios
- Well-run: 45–55%; Average: 55–65%; Distressed: 65%+
- Key line items: Payroll 20–30%, Insurance 5–10%, Utilities 5–8%

### Financing Benchmarks (2024-2025)
- **Bank Debt**: SOFR + 225–350bps, 55–65% LTV, 1.25–1.40x DSCR
- **CMBS**: SOFR + 200–300bps, 60–70% LTV, 10-yr term
- **Bridge/Mezz**: SOFR + 400–600bps, 70–80% LTC, IO
- **SBA 504**: Prime + 0–100bps, 75–85% LTV, 25-yr amort
- **Life Co**: 4.50–5.50% fixed, 50–55% LTV

### DSCR / Debt Thresholds
- Min acceptable: 1.20x; Comfortable: 1.30–1.40x; Conservative: 1.50x+
- Breakeven warning: <1.10x
- Debt Yield (NOI/Loan): min 8%, healthy 9–11%

### Target Returns
- Core: 8–12% levered IRR, 1.5x–1.8x EM
- Value-Add: 15–20% IRR, 1.8x–2.5x EM
- Opportunistic: 20%+ IRR, 2.5x+ EM

### Due Diligence Red Flags
1. Environmental: underground tanks, spills, superfund proximity
2. Structural: seawall age 30+ yrs, dock condition, dredging needs
3. Regulatory: submerged land lease terms, DEP permits
4. Operational: tenant turnover >25%, fuel compliance, deferred maintenance
5. Financial: declining revenue trends, below-market rents, owner adj >15% of NOI
6. Legal: pending litigation, title issues, easements
7. Market: new competition, channel depth limits

### Value-Add Opportunities
1. Mark-to-market rents (10–20% upside)
2. Service expansion (repair, retail, boat club)
3. Fuel margin optimization ($0.30–$0.60/gal target)
4. Operational efficiency (5–10 point expense ratio improvement)
5. Capital improvements (dock upgrades, dry storage, amenities)
6. Ancillary revenue (parking, events, lockers)

### Conservative vs Aggressive Assumptions
| Metric          | Conservative | Aggressive  |
|-----------------|-------------|-------------|
| Rate growth     | 2–3%        | 5–8%        |
| Expense inflate | 3–4%        | 2%          |
| Exit cap        | Entry +75bp | Entry flat  |
| Lease-up        | 3–8/mo      | 15–20+/mo   |
| Hold period     | 7–10 yrs    | 3–5 yrs     |

## Multi-Asset CRE Benchmarks

### Multifamily (Apartment)
- Cap Rates: Core markets 4.5–5.5%; Secondary 5.5–7.0%; Value-Add 7.0–8.5%
- NOI margin: 50–65%; Strong OER: 35–45%
- Expense controllables: payroll 10–15%, maintenance 5–10%

### Self-Storage
- Cap Rates: 5.0–7.0% stabilized; 7–9% lease-up
- Occupancy: 85%+ stabilized (physical), 90%+ EGI
- Expense ratio: 30–40% (low labor)
- Revenue mix: 80–90% unit rent, 10–20% ancillary

### RV Parks / Campgrounds
- Cap Rates: 6–9% stabilized
- Revenue per site/night: $40–$150 (varies by market)
- Seasonal adjustment: 40–60% of revenue in peak 4 months

### Industrial / Flex
- Cap Rates: 4–6% core; 6–8% secondary
- NNN expenses passed through; low OER 15–30%

### Retail / Net Lease
- Cap Rates: 4.5–7.5% (credit tenant dependent)
- Lease terms: 10–25 yr NNN; rent bumps 10% per 5 yr or CPI

### Office (Distressed Environment 2024-2025)
- Cap Rates: 6–12% (wide spread due to uncertainty)
- Occupancy concerns: remote work, lease expirations
- Avoid CBD without significant conviction thesis

## Deal Analysis Framework

### Quick Qualifier (Pass/Fail)
1. Does cap rate meet minimum threshold for market?
2. Is DSCR ≥ 1.25x at current debt terms?
3. Is NOI growth thesis achievable (market support)?
4. Are there dealbreaker DD items (environmental, title)?
5. Does IRR meet return threshold?

### Value Creation Thesis Categories
A) **Cash flow play**: stabilized, buy-and-hold, income-oriented
B) **Value-add**: operational improvements, rate increases, lease-up
C) **Repositioning**: significant capex, use change, branding
D) **Distressed**: rescue capital, turnaround, below-replacement cost
E) **Development**: ground-up or major expansion

### Sensitivity Analysis Requirements (Always Run)
- Revenue: -10%, -20% stress; what's breakeven?
- Expenses: +10%, +20%; impact on DSCR?
- Interest rates: +100bps, +200bps refinance scenario
- Exit cap: +50bps, +100bps; impact on equity returns?
- Timing: +12 months, +24 months delay; carry cost impact?
`;

const PLATFORM_KNOWLEDGE = `
## Vantage Platform Guide

Vantage is an institutional-grade multi-asset investment and management platform covering:

### Modules
- **CRM**: Deals, contacts, companies, properties — full pipeline management
- **Due Diligence**: DD projects, tasks, timelines, document tracking
- **Modeling**: DCF financial modeling, exit strategies, capital stack, scenarios
- **Rent Roll**: Tenant management, lease tracking, occupancy analytics
- **Sales Comps**: Transaction comparables for valuation benchmarking
- **The Docket**: Industry news, market intelligence
- **VDR**: Secure document management

### Asset Classes Supported
Marinas, RV Parks, Campgrounds, Self-Storage, Multifamily, Mobile Home Parks,
Industrial, Retail (NNN), Office, Mixed-Use, Hotel/Hospitality, Senior Housing,
Student Housing, Car Wash, Gas Stations, Veterinary, Medical/Dental,
Restaurants, Auto Services, and 30+ more asset classes.

### Key Workflows
1. Deal Sourcing → Qualify → Create Deal → Pipeline stages
2. Due Diligence → DD project from deal → tasks → completion tracking
3. Valuation → Financial model → scenarios → exit strategy
4. Rent Roll → Tenant mix analysis → occupancy → cash flow
5. Market Analysis → Sales comps → benchmark pricing
`;

// ─── Advisory mode system prompts ─────────────────────────────────────────────

const ADVISORY_SYSTEM_PROMPTS: Record<AdvisoryMode, string> = {
  general: `
You are the Vantage AI Advisor — an expert commercial real estate and marina acquisition consultant.
You serve as a strategic sounding board with the precision of a 20-year institutional investor.

Core capabilities:
- Analyze deals: identify risks, opportunities, hidden value, red flags
- Compare investments against market benchmarks and the advisor's buy-box criteria
- Suggest risk mitigation strategies with specific, actionable recommendations
- Think through complex decisions like a seasoned principal, not a broker
- Provide accurate, specific numbers — never be vague when data is available

When advising:
- Always cite specific benchmarks (cap rates, DSCR thresholds, return targets)
- Ask targeted clarifying questions when data is missing
- Surface both opportunities AND risks with equal rigor
- Be direct about concerns while remaining constructive
- When entity data is provided, use it — don't answer generically if you have specifics
`,

  critique: `
You are in CRITIQUE MODE — your job is to stress-test assumptions and find weaknesses others miss.

Structure:
1. **What Could Go Wrong** — 3–5 specific, deal-killing or return-impairing risks
2. **Hidden Assumptions** — assumptions that may not hold; what's being taken for granted?
3. **Market Concerns** — deviations from benchmarks that need explaining
4. **Operational Risks** — execution challenges not reflected in the pro forma
5. **Recommendations** — specific corrective actions for each concern

Be direct, forensic, and specific. Reference actual numbers from the deal data provided.
Good critique saves money. Vague critique wastes time.
`,

  risk_analysis: `
You are in RISK ANALYSIS MODE — provide a comprehensive, institutionally rigorous risk assessment.

Structure:
1. **Risk Register** — all identified risks with Severity (High/Med/Low) and Category
2. **Probability × Impact Matrix** — likelihood and financial magnitude for each risk
3. **Mitigation Strategies** — concrete, actionable steps to reduce each risk
4. **Residual Risk** — what exposure remains after mitigation
5. **Risk-Adjusted Return** — how risks affect expected IRR/EM

Categories: Market/Economic, Operational, Environmental/Regulatory, Financial/Capital, Legal/Title, Competition.
Reference specific thresholds: DSCR <1.10x = red, LTV >75% = caution, expense ratio >65% = distressed.
`,

  benchmark_comparison: `
You are in BENCHMARK COMPARISON MODE — compare the deal/asset against industry standards with precision.

Structure:
1. **Valuation Metrics** — cap rate, price/slip or price/unit, NOI multiple vs. market range
2. **Operating Performance** — occupancy, expense ratio, revenue per unit vs. peer benchmarks
3. **Revenue Mix** — compare actual mix to optimal distribution
4. **Rate Analysis** — below/at/above market; quantify upside
5. **Competitive Position** — where does this asset rank in its market?
6. **Scorecard** — rate each category: Strong / In-Line / Below / Red Flag

Flag deviations >10–15% from benchmarks and explain implications clearly.
Use numbers. Avoid vague qualitative descriptions.
`,

  options_analysis: `
You are in OPTIONS ANALYSIS MODE — help evaluate alternative paths with institutional clarity.

Structure:
1. **Options Identified** — all viable paths (proceed, pass, renegotiate price, structure differently, etc.)
2. **Pros & Cons Matrix** — for each option, explicit advantages and disadvantages
3. **Financial Impact** — estimated impact on IRR/EM for each option
4. **Risk Comparison** — how the risk profile shifts with each option
5. **Recommendation** — your suggested path with clear, numbered reasoning

Be comprehensive but decisive. Provide a clear recommendation with conviction.
`,

  decision_memo: `
You are in DECISION MEMO MODE — generate an institutional-quality investment committee memo.

Structure:
1. **Executive Summary** — 3-sentence investment thesis (what, why, key risk)
2. **Deal Overview** — asset, market, terms, structure
3. **Investment Highlights** — top 3–5 reasons to proceed (specific, numbered)
4. **Key Risks & Mitigants** — top 3 risks with specific mitigants
5. **Financial Summary** — key metrics table: price, cap rate, NOI, DSCR, IRR, EM, equity multiple
6. **Sensitivity Analysis** — best/base/stress case returns
7. **Recommendation** — GO / NO-GO / CONDITIONAL with confidence level (1–10)
8. **Next Steps** — required actions if proceeding

Write in a professional, institutional tone. IC members make decisions based on precision, not optimism.
`,

  stress_test: `
You are in STRESS TEST MODE — model how the investment performs under realistic adverse scenarios.

Test the following scenarios with specific financial impact:
1. **Moderate Recession** — 15% revenue decline, 25% occupancy drop, cap rate expansion +75bps
2. **Severe Recession** — 25% revenue decline, 40% occupancy drop, +150bps cap rate
3. **Rate Shock** — +200bps refinance, model debt service impact
4. **Competition** — new competing asset opens, 10–15% rate pressure
5. **Environmental/Capex Event** — $250K–$1M unexpected capital need
6. **Operational Disruption** — key staff loss, fuel compliance issue, 6-month disruption

For each scenario:
- Quantify NOI impact in dollars
- Calculate stressed DSCR and equity cash-on-cash
- Identify break-even point
- Suggest protective covenants, reserves, or structure adjustments
`,

  next_actions: `
You are in NEXT ACTIONS MODE — provide clear, prioritized, immediately actionable next steps.

Structure:
1. **This Week** — urgent items (24–72 hour window)
2. **This Month** — important next steps before deal advances
3. **Due Diligence Deep-Dives** — specific documents to request, questions to answer, inspections to schedule
4. **Stakeholder Actions** — who to call, approvals needed, advisors to engage
5. **Go/No-Go Milestones** — specific criteria that determine whether to proceed at each stage

Be specific: name the action, who does it, and what success looks like.
Vague action items are not action items. Every item should be completable and verifiable.
`,
};

// ─── Entity data enrichment ───────────────────────────────────────────────────

async function enrichEntityData(context: AssistantContext): Promise<Record<string, any>> {
  if (!context.entityId || !context.orgId) return context.entityData ?? {};

  try {
    if (context.entityType === 'deal') {
      const [deal] = await db.select().from(crmDeals)
        .where(and(eq(crmDeals.id, context.entityId), eq(crmDeals.ownerId, context.orgId)))
        .limit(1);
      if (!deal) return context.entityData ?? {};

      const enriched: Record<string, any> = { deal };

      // Attach linked modeling project (IRR, cap rate, purchase price, EBITDA)
      if (deal.modelingProjectId) {
        const [model] = await db.select({
          id: modelingProjects.id,
          marinaName: modelingProjects.marinaName,
          purchasePrice: modelingProjects.purchasePrice,
          year1CapRate: modelingProjects.year1CapRate,
          totalStorageUnits: modelingProjects.totalStorageUnits,
          ebitda: modelingProjects.ebitda,
          uwStage: modelingProjects.uwStage,
          customMetrics: modelingProjects.customMetrics,
          notes: modelingProjects.notes,
        }).from(modelingProjects)
          .where(and(eq(modelingProjects.id, deal.modelingProjectId), eq(modelingProjects.orgId, context.orgId)))
          .limit(1);
        if (model) enriched.financialModel = model;
      }

      // Attach linked workspace (DD progress, doc count)
      const [workspace] = await db.select({
        id: dealWorkspaces.id,
        name: dealWorkspaces.name,
        status: dealWorkspaces.status,
        openDdTasks: dealWorkspaces.openDdTasks,
        totalDdTasks: dealWorkspaces.totalDdTasks,
        pendingDocuments: dealWorkspaces.pendingDocuments,
        targetPrice: dealWorkspaces.targetPrice,
        expectedCloseDate: dealWorkspaces.expectedCloseDate,
        priority: dealWorkspaces.priority,
      }).from(dealWorkspaces)
        .where(and(eq(dealWorkspaces.dealId, context.entityId), eq(dealWorkspaces.orgId, context.orgId)))
        .limit(1);
      if (workspace) {
        const completedTasks = (workspace.totalDdTasks ?? 0) - (workspace.openDdTasks ?? 0);
        const ddPct = workspace.totalDdTasks ? Math.round((completedTasks / workspace.totalDdTasks) * 100) : 0;
        enriched.workspace = { ...workspace, ddCompletionPct: ddPct };
      }

      // Attach recent notes (last 5)
      const notes = await db.select({
        content: crmNotes.content,
        createdAt: crmNotes.createdAt,
      }).from(crmNotes)
        .where(and(eq(crmNotes.entityId, context.entityId), eq(crmNotes.orgId, context.orgId)))
        .orderBy(desc(crmNotes.createdAt))
        .limit(5);
      if (notes.length) enriched.recentNotes = notes;

      return enriched;
    }

    if (context.entityType === 'modeling_project') {
      const [model] = await db.select().from(modelingProjects)
        .where(and(eq(modelingProjects.id, context.entityId), eq(modelingProjects.orgId, context.orgId)))
        .limit(1);
      if (!model) return context.entityData ?? {};

      const enriched: Record<string, any> = { financialModel: model };

      // Attach linked deal context if available
      if (model.dealId) {
        const [deal] = await db.select({
          id: crmDeals.id,
          name: crmDeals.name,
          stage: crmDeals.stage,
          askingPrice: crmDeals.askingPrice,
          city: crmDeals.city,
          state: crmDeals.state,
        }).from(crmDeals)
          .where(and(eq(crmDeals.id, model.dealId), eq(crmDeals.ownerId, context.orgId)))
          .limit(1);
        if (deal) enriched.deal = deal;
      }

      return enriched;
    }

    if (context.entityType === 'workspace') {
      const [workspace] = await db.select().from(dealWorkspaces)
        .where(and(eq(dealWorkspaces.id, context.entityId), eq(dealWorkspaces.orgId, context.orgId)))
        .limit(1);
      if (!workspace) return context.entityData ?? {};

      const enriched: Record<string, any> = { workspace };
      const completedTasks = (workspace.totalDdTasks ?? 0) - (workspace.openDdTasks ?? 0);
      enriched.workspace.ddCompletionPct = workspace.totalDdTasks
        ? Math.round((completedTasks / workspace.totalDdTasks) * 100) : 0;

      // Attach linked deal
      if (workspace.dealId) {
        const [deal] = await db.select({
          id: crmDeals.id,
          name: crmDeals.name,
          stage: crmDeals.stage,
          askingPrice: crmDeals.askingPrice,
          city: crmDeals.city,
          state: crmDeals.state,
        }).from(crmDeals)
          .where(and(eq(crmDeals.id, workspace.dealId), eq(crmDeals.ownerId, context.orgId)))
          .limit(1);
        if (deal) enriched.deal = deal;
      }

      // Attach linked financial model
      if (workspace.modelingProjectId) {
        const [model] = await db.select({
          id: modelingProjects.id,
          purchasePrice: modelingProjects.purchasePrice,
          year1CapRate: modelingProjects.year1CapRate,
          ebitda: modelingProjects.ebitda,
          uwStage: modelingProjects.uwStage,
          customMetrics: modelingProjects.customMetrics,
        }).from(modelingProjects)
          .where(and(eq(modelingProjects.id, workspace.modelingProjectId), eq(modelingProjects.orgId, context.orgId)))
          .limit(1);
        if (model) enriched.financialModel = model;
      }

      // Attach linked DD project
      if (workspace.ddProjectId) {
        const [ddProject] = await db.select({
          id: projects.id,
          name: projects.name,
          status: projects.status,
        }).from(projects)
          .where(and(eq(projects.id, workspace.ddProjectId), eq(projects.orgId, context.orgId)))
          .limit(1);
        if (ddProject) enriched.ddProject = ddProject;
      }

      return enriched;
    }

    if (context.entityType === 'property') {
      const [property] = await db.select().from(crmProperties)
        .where(and(eq(crmProperties.id, context.entityId), eq(crmProperties.orgId, context.orgId)))
        .limit(1);
      if (property) return { property };
    }

    if (context.entityType === 'dd_project') {
      const [project] = await db.select().from(projects)
        .where(and(eq(projects.id, context.entityId), eq(projects.orgId, context.orgId)))
        .limit(1);
      if (project) return { ddProject: project };
    }
  } catch (err) {
    console.error('[AI Assistant] Entity enrichment error:', err);
  }

  return context.entityData ?? {};
}

/** Fetch multiple entities for deal comparison */
async function fetchDealComparisonData(
  orgId: string,
  entityIds: string[]
): Promise<Array<Record<string, any>>> {
  try {
    const deals = await db.select().from(crmDeals)
      .where(and(eq(crmDeals.ownerId, orgId), inArray(crmDeals.id, entityIds)));

    if (deals.length > 0) return deals.map(d => ({ type: 'deal', ...d }));

    const models = await db.select().from(modelingProjects)
      .where(and(eq(modelingProjects.orgId, orgId), inArray(modelingProjects.id, entityIds)));

    return models.map(m => ({ type: 'modeling_project', ...m }));
  } catch (err) {
    console.error('[AI Assistant] Deal comparison fetch error:', err);
    return [];
  }
}

/** Fetch org's investment criteria / buy-box */
async function getInvestmentCriteria(orgId: string): Promise<string> {
  try {
    // Try to pull buy-box criteria from the platform
    const result = await db.execute(drizzleSql`
      SELECT criteria_data FROM investment_criteria WHERE org_id = ${orgId} LIMIT 1
    `).catch(() => ({ rows: [] }));

    if ((result.rows as any[]).length > 0) {
      const criteria = (result.rows[0] as any).criteria_data;
      return `\n\n## Your Investment Criteria (Buy-Box)\n${JSON.stringify(criteria, null, 2)}`;
    }
  } catch {}
  return '';
}

/** Fetch advisor persona — how this advisor prefers to respond based on past feedback */
async function getAdvisorPersona(orgId: string): Promise<string> {
  try {
    const feedbackRows = await db.execute(drizzleSql`
      SELECT advisory_mode, rating, COUNT(*) as cnt
      FROM ai_assistant_feedback
      WHERE org_id = ${orgId}
      GROUP BY advisory_mode, rating
      ORDER BY advisory_mode, rating
    `).catch(() => ({ rows: [] }));

    if (!(feedbackRows.rows as any[]).length) return '';

    const stats: Record<string, { pos: number; neg: number }> = {};
    for (const r of feedbackRows.rows as any[]) {
      if (!stats[r.advisory_mode]) stats[r.advisory_mode] = { pos: 0, neg: 0 };
      if (r.rating === 'positive') stats[r.advisory_mode].pos += parseInt(r.cnt);
      else stats[r.advisory_mode].neg += parseInt(r.cnt);
    }

    const preferred = Object.entries(stats)
      .filter(([, v]) => v.pos > 2)
      .sort((a, b) => b[1].pos - a[1].pos)
      .slice(0, 3)
      .map(([mode]) => mode);

    if (!preferred.length) return '';

    return `\n\n## Advisor Preferences (Learned from Your Usage)\nThis advisor responds best to: ${preferred.join(', ')} mode analysis. Prioritize these styles.`;
  } catch {
    return '';
  }
}

// ─── Org data context ─────────────────────────────────────────────────────────

async function getTenantContext(orgId: string): Promise<string> {
  if (!orgId) return '';

  try {
    const [deals, models, ddProjects, properties, comps] = await Promise.all([
      db.select({ id: crmDeals.id, name: crmDeals.name, stage: crmDeals.stage, value: crmDeals.value, status: crmDeals.status })
        .from(crmDeals).where(eq(crmDeals.ownerId, orgId)).orderBy(desc(crmDeals.updatedAt)).limit(15),

      db.select({ id: modelingProjects.id, name: modelingProjects.name, status: modelingProjects.status, acquisitionPrice: modelingProjects.acquisitionPrice, capRate: modelingProjects.capRate })
        .from(modelingProjects).where(eq(modelingProjects.orgId, orgId)).orderBy(desc(modelingProjects.updatedAt)).limit(10),

      db.select({ id: projects.id, name: projects.name, status: projects.status, completedTasks: projects.completedTasks, totalTasks: projects.totalTasks })
        .from(projects).where(eq(projects.orgId, orgId)).orderBy(desc(projects.updatedAt)).limit(10),

      db.select({ id: crmProperties.id, name: crmProperties.name, city: crmProperties.city, state: crmProperties.state, status: crmProperties.status })
        .from(crmProperties).where(eq(crmProperties.orgId, orgId)).orderBy(desc(crmProperties.updatedAt)).limit(10),

      db.select({ id: salesComps.id, marinaName: salesComps.marinaName, salePrice: salesComps.salePrice, capRate: salesComps.capRate, totalSlips: salesComps.totalSlips })
        .from(salesComps).where(eq(salesComps.orgId, orgId)).orderBy(desc(salesComps.updatedAt)).limit(10),
    ]);

    let ctx = '';

    if (deals.length > 0) {
      const active = deals.filter(d => d.status === 'active');
      const totalVal = deals.reduce((s, d) => s + (Number(d.value) || 0), 0);
      ctx += `\n\n**Pipeline**: ${active.length} active deals, $${(totalVal / 1_000_000).toFixed(1)}M total value`;
      ctx += `\nRecent: ${deals.slice(0, 5).map(d => `${d.name} (${d.stage})`).join('; ')}`;
    }

    if (models.length > 0) {
      ctx += `\n\n**Financial Models**: ${models.length} models`;
      ctx += `\nRecent: ${models.slice(0, 3).map(m => `${m.name} — $${((Number(m.acquisitionPrice) || 0) / 1_000_000).toFixed(1)}M @ ${m.capRate ?? 'N/A'}% cap`).join('; ')}`;
    }

    if (ddProjects.length > 0) {
      const inProg = ddProjects.filter(p => p.status === 'in-progress');
      ctx += `\n\n**Due Diligence**: ${ddProjects.length} total, ${inProg.length} in progress`;
    }

    if (properties.length > 0) {
      ctx += `\n\n**Properties**: ${properties.length} tracked`;
      ctx += `\nMarkets: ${[...new Set(properties.map(p => p.state).filter(Boolean))].join(', ')}`;
    }

    if (comps.length > 0) {
      const avgCap = comps.filter(c => c.capRate).reduce((s, c, _, arr) => s + (Number(c.capRate) || 0) / arr.length, 0);
      ctx += `\n\n**Sales Comps**: ${comps.length} comparables, avg cap ${avgCap.toFixed(1)}%`;
    }

    return ctx ? `\n\n## Your Organization's Live Data\n${ctx}` : '';
  } catch (err) {
    console.error('[AI Assistant] Tenant context error:', err);
    return '';
  }
}

// ─── Advisor tool definitions (OpenAI function calling) ─────────────────────

const ADVISOR_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'lookup_deal',
      description: 'Look up a deal by name or ID to get current stage, asking price, location, linked financial model KPIs, and DD progress.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Deal name (partial match) or exact deal ID' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_workspace_status',
      description: 'Get the due diligence status, open tasks, pending documents, and financial model KPIs for a deal workspace by workspace ID or deal name.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Workspace name, deal name, or workspace ID' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_deal_note',
      description: 'Create a note on a CRM deal. Use this when the user asks to "add a note", "log something", or "save this to the deal".',
      parameters: {
        type: 'object',
        properties: {
          dealId: { type: 'string', description: 'The deal ID to attach the note to' },
          content: { type: 'string', description: 'Note content to save' },
        },
        required: ['dealId', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_pipeline_deals',
      description: 'List active deals in the pipeline with their stage, asking price, and key metrics. Use when the user asks about the overall pipeline or deal count.',
      parameters: {
        type: 'object',
        properties: {
          stage: { type: 'string', description: 'Optional stage filter (e.g. "loi", "due_diligence", "active")' },
          limit: { type: 'number', description: 'Maximum number of deals to return (default 10)' },
        },
      },
    },
  },
];

async function executeAdvisorTool(
  toolName: string,
  args: Record<string, any>,
  orgId: string,
  userId?: string
): Promise<string> {
  try {
    if (toolName === 'lookup_deal') {
      const q = args.query as string;
      const deals = await db.select({
        id: crmDeals.id,
        name: crmDeals.name,
        stage: crmDeals.stage,
        askingPrice: crmDeals.askingPrice,
        city: crmDeals.city,
        state: crmDeals.state,
        modelingProjectId: crmDeals.modelingProjectId,
      }).from(crmDeals)
        .where(and(
          eq(crmDeals.ownerId, orgId),
          ilike(crmDeals.name, `%${q}%`)
        ))
        .limit(3);

      if (!deals.length) return JSON.stringify({ error: `No deal found matching "${q}"` });

      const deal = deals[0];
      const result: Record<string, any> = { deal };

      if (deal.modelingProjectId) {
        const [model] = await db.select({
          purchasePrice: modelingProjects.purchasePrice,
          year1CapRate: modelingProjects.year1CapRate,
          ebitda: modelingProjects.ebitda,
          uwStage: modelingProjects.uwStage,
        }).from(modelingProjects)
          .where(eq(modelingProjects.id, deal.modelingProjectId))
          .limit(1);
        if (model) result.financialModel = model;
      }

      const [workspace] = await db.select({
        id: dealWorkspaces.id,
        openDdTasks: dealWorkspaces.openDdTasks,
        totalDdTasks: dealWorkspaces.totalDdTasks,
        pendingDocuments: dealWorkspaces.pendingDocuments,
        status: dealWorkspaces.status,
      }).from(dealWorkspaces)
        .where(and(eq(dealWorkspaces.dealId, deal.id), eq(dealWorkspaces.orgId, orgId)))
        .limit(1);
      if (workspace) {
        const completed = (workspace.totalDdTasks ?? 0) - (workspace.openDdTasks ?? 0);
        const pct = workspace.totalDdTasks ? Math.round((completed / workspace.totalDdTasks) * 100) : 0;
        result.workspace = { ...workspace, ddCompletionPct: pct };
      }

      return JSON.stringify(result);
    }

    if (toolName === 'get_workspace_status') {
      const q = args.query as string;
      const workspaces = await db.select().from(dealWorkspaces)
        .where(and(
          eq(dealWorkspaces.orgId, orgId),
          ilike(dealWorkspaces.name, `%${q}%`)
        ))
        .limit(3);

      if (!workspaces.length) return JSON.stringify({ error: `No workspace found matching "${q}"` });

      const ws = workspaces[0];
      const completed = (ws.totalDdTasks ?? 0) - (ws.openDdTasks ?? 0);
      const ddPct = ws.totalDdTasks ? Math.round((completed / ws.totalDdTasks) * 100) : 0;
      const result: Record<string, any> = { workspace: { ...ws, ddCompletionPct: ddPct } };

      if (ws.modelingProjectId) {
        const [model] = await db.select({
          purchasePrice: modelingProjects.purchasePrice,
          year1CapRate: modelingProjects.year1CapRate,
          ebitda: modelingProjects.ebitda,
          uwStage: modelingProjects.uwStage,
        }).from(modelingProjects)
          .where(eq(modelingProjects.id, ws.modelingProjectId))
          .limit(1);
        if (model) result.financialModel = model;
      }

      return JSON.stringify(result);
    }

    if (toolName === 'create_deal_note') {
      if (!userId) return JSON.stringify({ error: 'User authentication required to create notes' });
      const { dealId, content } = args as { dealId: string; content: string };

      const [deal] = await db.select({ id: crmDeals.id })
        .from(crmDeals)
        .where(and(eq(crmDeals.id, dealId), eq(crmDeals.ownerId, orgId)))
        .limit(1);
      if (!deal) return JSON.stringify({ error: `Deal ${dealId} not found` });

      await db.insert(crmNotes).values({
        content,
        entityType: 'deal',
        entityId: dealId,
        orgId,
        createdById: userId,
        ownerId: userId,
      });

      return JSON.stringify({ success: true, message: 'Note added to deal successfully' });
    }

    if (toolName === 'list_pipeline_deals') {
      const limit = Math.min(args.limit ?? 10, 20);
      const deals = await db.select({
        id: crmDeals.id,
        name: crmDeals.name,
        stage: crmDeals.stage,
        askingPrice: crmDeals.askingPrice,
        city: crmDeals.city,
        state: crmDeals.state,
      }).from(crmDeals)
        .where(eq(crmDeals.ownerId, orgId))
        .orderBy(desc(crmDeals.createdAt))
        .limit(limit);

      return JSON.stringify({ deals, count: deals.length });
    }

    return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  } catch (err: any) {
    console.error(`[AI Advisor Tool] ${toolName} error:`, err);
    return JSON.stringify({ error: err.message ?? 'Tool execution failed' });
  }
}

// ─── Page context ─────────────────────────────────────────────────────────────

const PAGE_CONTEXT: Record<string, string> = {
  '/': 'User is on the Dashboard — shows portfolio KPIs, pipeline snapshot, and recent activity.',
  '/crm': 'User is in the CRM module.',
  '/crm/deals': 'User is viewing the Deals list — all active acquisition targets.',
  '/crm/pipeline': 'User is viewing the Pipeline Kanban board — deals organized by stage.',
  '/crm/contacts': 'User is viewing Contacts — brokers, sellers, lenders, and partners.',
  '/crm/companies': 'User is viewing Companies — property owners and partner firms.',
  '/crm/properties': 'User is viewing Properties — owned/tracked marina and CRE assets.',
  '/dd': 'User is in Due Diligence.',
  '/dd/projects': 'User is viewing DD Projects — active and completed diligence workstreams.',
  '/modeling': 'User is in the Financial Modeling module — DCF, waterfall, and scenario analysis.',
  '/rent-roll': 'User is in the Rent Roll module — lease management and occupancy analytics.',
  '/rent-roll/executive': 'User is viewing the Executive Rent Roll Dashboard — portfolio-wide revenue and occupancy trends.',
  '/sales-comps': 'User is in Sales Comps — comparable transaction database.',
  '/docket': 'User is in The Docket — real-time marina and CRE market intelligence, news, and deal flow signals.',
  '/vdr': 'User is in the Virtual Data Room — secure document repository for deals.',
  '/analytics': 'User is in Analytics — custom reports and portfolio performance metrics.',
  '/knowledge-base': 'User is managing the AI Knowledge Base — document and URL ingestion for RAG context.',
  '/workspaces': 'User is viewing Deal Workspaces — unified hub linking CRM, DD, VDR, and modeling for each deal.',
  '/workspaces/': 'User is inside a Deal Workspace — the central command center for a specific acquisition, containing DD checklist, financials, VDR docs, capital markets, and red flags.',
  '/demographics': 'User is viewing Demographics — population, income, and market data for target geographies.',
  '/capital-markets': 'User is in Capital Markets — lender matrix, financing terms, and debt market comps.',
  '/document-studio': 'User is in Document Studio — AI-generated IC memos, LOIs, and investment briefs.',
  '/operations': 'User is in Operations — marina operational metrics, maintenance logs, and P&L.',
  '/marina-map': 'User is viewing the Marina Map — geographic visualization of assets and deal targets.',
  '/prospecting': 'User is in Prospecting — off-market deal sourcing and outreach pipeline.',
  '/lp-portal': 'User is in the LP Portal — investor reporting, capital account summaries, and distributions.',
};

// ─── System prompt builder ────────────────────────────────────────────────────

async function buildSystemPrompt(
  context: AssistantContext,
  entityData: Record<string, any>,
  tenantContext: string,
  ragContext: string,
  investmentCriteria: string,
  advisorPersona: string,
  comparisonData?: Array<Record<string, any>>
): Promise<string> {
  const mode = context.advisoryMode ?? 'general';
  let prompt = ADVISORY_SYSTEM_PROMPTS[mode] + '\n\n' + PLATFORM_KNOWLEDGE + '\n\n' + INDUSTRY_KNOWLEDGE;

  if (ragContext) prompt += ragContext;
  if (investmentCriteria) prompt += investmentCriteria;
  if (advisorPersona) prompt += advisorPersona;

  const pageKey = Object.keys(PAGE_CONTEXT).find(k =>
    context.currentPage.startsWith(k) && (k === '/' ? context.currentPage === '/' : true)
  );
  if (pageKey) prompt += `\n\n**Current Page**: ${PAGE_CONTEXT[pageKey]}`;

  if (context.entityName) {
    prompt += `\n**Viewing Entity**: ${context.entityType ?? 'item'} — "${context.entityName}"`;
  }

  if (context.injectedContextBlock) {
    prompt += `\n\n${context.injectedContextBlock}`;
  }

  if (Object.keys(entityData).length > 0) {
    prompt += `\n\n## Live Entity Data (Use this for specific analysis)\n\`\`\`json\n${JSON.stringify(entityData, null, 2)}\n\`\`\``;
  }

  if (comparisonData && comparisonData.length > 1) {
    prompt += `\n\n## Deal Comparison Data (${comparisonData.length} assets to compare)\n\`\`\`json\n${JSON.stringify(comparisonData, null, 2)}\n\`\`\`\n\nPrepare a structured side-by-side comparison.`;
  }

  if (tenantContext) prompt += tenantContext;

  return prompt;
}

// ─── Main chat function ───────────────────────────────────────────────────────

export async function chat(
  userMessage: string,
  context: AssistantContext,
  conversationHistory: ConversationMessage[] = []
): Promise<{ response: string; ragChunkIds: string[] }> {

  const [tenantContext, ragResult, entityData, investmentCriteria, advisorPersona, comparisonData] = await Promise.all([
    getTenantContext(context.orgId ?? ''),
    context.orgId ? getRAGContext(context.orgId, userMessage) : Promise.resolve({ context: '', chunkIds: [] as string[] }),
    enrichEntityData(context),
    context.orgId ? getInvestmentCriteria(context.orgId) : Promise.resolve(''),
    context.orgId ? getAdvisorPersona(context.orgId) : Promise.resolve(''),
    context.compareEntityIds?.length && context.orgId
      ? fetchDealComparisonData(context.orgId, context.compareEntityIds)
      : Promise.resolve([] as Array<Record<string, any>>),
  ]);

  const systemPrompt = await buildSystemPrompt(
    context, entityData, tenantContext, ragResult.context,
    investmentCriteria, advisorPersona, comparisonData
  );

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-12).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: userMessage },
  ];

  try {
    const activeMessages = [...messages] as OpenAI.Chat.ChatCompletionMessageParam[];
    let finalContent = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const MAX_TOOL_ROUNDS = 5;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: activeMessages,
        max_completion_tokens: 2048,
        tools: ADVISOR_TOOLS,
        tool_choice: 'auto',
      });

      totalInputTokens += response.usage?.prompt_tokens ?? 0;
      totalOutputTokens += response.usage?.completion_tokens ?? 0;

      const choice = response.choices[0];
      activeMessages.push(choice.message as OpenAI.Chat.ChatCompletionMessageParam);

      if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
        const toolResults: OpenAI.Chat.ChatCompletionToolMessageParam[] = [];
        for (const tc of choice.message.tool_calls) {
          const args = JSON.parse(tc.function.arguments ?? '{}');
          const result = await executeAdvisorTool(tc.function.name, args, context.orgId ?? '', context.userId);
          toolResults.push({ role: 'tool', tool_call_id: tc.id, content: result });
        }
        activeMessages.push(...toolResults);
        continue;
      }

      finalContent = choice.message.content ?? "I'm sorry, I couldn't generate a response. Please try again.";
      break;
    }

    if (!finalContent) {
      finalContent = "I'm sorry, I couldn't generate a response after processing. Please try again.";
    }

    // Track token usage for spending guard
    if (context.orgId && context.userId && (totalInputTokens || totalOutputTokens)) {
      trackAIUsage({
        orgId: context.orgId,
        userId: context.userId,
        operationType: 'chat',
        provider: 'openai',
        model: 'gpt-4o',
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        metadata: { page: context.currentPage, advisoryMode: context.advisoryMode ?? 'general' },
      }).catch(() => {});
    }

    return { response: finalContent, ragChunkIds: ragResult.chunkIds };
  } catch (error: any) {
    console.error('[AI Assistant] Chat error:', error);
    throw new Error('Failed to get AI response: ' + error.message);
  }
}

// ─── Streaming chat ───────────────────────────────────────────────────────────

export async function* chatStream(
  userMessage: string,
  context: AssistantContext,
  conversationHistory: ConversationMessage[] = []
): AsyncGenerator<string> {

  const [tenantContext, ragResult, entityData, investmentCriteria, advisorPersona, comparisonData] = await Promise.all([
    getTenantContext(context.orgId ?? ''),
    context.orgId ? getRAGContext(context.orgId, userMessage) : Promise.resolve({ context: '', chunkIds: [] as string[] }),
    enrichEntityData(context),
    context.orgId ? getInvestmentCriteria(context.orgId) : Promise.resolve(''),
    context.orgId ? getAdvisorPersona(context.orgId) : Promise.resolve(''),
    context.compareEntityIds?.length && context.orgId
      ? fetchDealComparisonData(context.orgId, context.compareEntityIds)
      : Promise.resolve([] as Array<Record<string, any>>),
  ]);

  const systemPrompt = await buildSystemPrompt(
    context, entityData, tenantContext, ragResult.context,
    investmentCriteria, advisorPersona, comparisonData
  );

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-12).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: userMessage },
  ];

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      max_completion_tokens: 2048,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
  } catch (error: any) {
    console.error('[AI Assistant] Stream error:', error);
    throw new Error('Failed to stream AI response: ' + error.message);
  }
}

// ─── Suggested questions ──────────────────────────────────────────────────────

export function getSuggestedQuestions(currentPage: string, advisoryMode?: AdvisoryMode): string[] {
  const advisory = [
    "What are the biggest risks with this deal?",
    "How does this compare to market benchmarks?",
    "What should I be asking that I'm not?",
  ];

  const pageMap: Record<string, string[]> = {
    '/': [
      "Review my pipeline — any concerns?",
      "Which deals should I prioritize this week?",
      "What metrics indicate a strong marina investment?",
      "How is my portfolio tracking vs. benchmarks?",
    ],
    '/crm/deals': [
      "Critique this deal for me",
      "What are the deal breakers I should investigate?",
      "Is this pricing justified by the market?",
      "What questions should I ask the seller?",
      "Generate a due diligence checklist for this asset",
    ],
    '/crm/pipeline': [
      "Which deals have the highest risk right now?",
      "Are any deals stalled that need attention?",
      "Help me prioritize my pipeline",
      "Which deal has the best risk-adjusted return?",
    ],
    '/modeling': [
      "Are my pro forma assumptions reasonable?",
      "Stress test this model for me",
      "What cap rate should I use for exit?",
      "Is my IRR achievable given current debt costs?",
      "Where is this model most sensitive to assumptions?",
    ],
    '/dd': [
      "What should my DD checklist include?",
      "What are the most common DD red flags I should look for?",
      "Am I missing any critical due diligence items?",
      "What's a reasonable timeline for full DD on this asset?",
    ],
    '/rent-roll': [
      "Is this occupancy level healthy for this market?",
      "Are the rates at market or below?",
      "What's the tenant concentration risk here?",
      "How does seasonality affect this rent roll?",
    ],
    '/sales-comps': [
      "How does this compare to recent transactions?",
      "What's the market cap rate trend in this area?",
      "Is the seller's pricing justified by comps?",
      "What adjustments should I make to these comps?",
    ],
  };

  const key = Object.keys(pageMap).find(k =>
    currentPage.startsWith(k) && (k === '/' ? currentPage === '/' : true)
  );

  return [...(key ? pageMap[key] : []), ...advisory].slice(0, 6);
}

// ─── Advisory modes list ──────────────────────────────────────────────────────

export function getAdvisoryModes(): { id: AdvisoryMode; name: string; description: string; icon: string }[] {
  return [
    { id: 'general', name: 'General', description: 'General guidance & Q&A', icon: 'MessageCircle' },
    { id: 'critique', name: 'Critique', description: 'Challenge my assumptions', icon: 'AlertTriangle' },
    { id: 'risk_analysis', name: 'Risk Analysis', description: 'Comprehensive risk register', icon: 'Shield' },
    { id: 'benchmark_comparison', name: 'Benchmark', description: 'Compare to market standards', icon: 'BarChart' },
    { id: 'options_analysis', name: 'Options', description: 'Analyze alternatives', icon: 'GitBranch' },
    { id: 'decision_memo', name: 'Decision Memo', description: 'IC-ready investment memo', icon: 'FileText' },
    { id: 'stress_test', name: 'Stress Test', description: 'Test adverse scenarios', icon: 'TrendingDown' },
    { id: 'next_actions', name: 'Next Actions', description: 'Prioritized action items', icon: 'CheckSquare' },
  ];
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

export interface AssistantFeedback {
  id: string;
  userId: string;
  orgId: string;
  messageId: string;
  rating: 'positive' | 'negative';
  advisoryMode: AdvisoryMode;
  page: string;
  timestamp: Date;
  messageContent?: string;
  userQuery?: string;
}

export async function recordFeedback(
  feedback: Omit<AssistantFeedback, 'id' | 'timestamp'>
): Promise<AssistantFeedback> {
  const [result] = await db.insert(aiAssistantFeedback).values({
    userId: feedback.userId,
    orgId: feedback.orgId,
    messageId: feedback.messageId,
    rating: feedback.rating,
    advisoryMode: feedback.advisoryMode,
    page: feedback.page,
    messageContent: feedback.messageContent,
    userQuery: feedback.userQuery,
  }).returning();

  console.log(`[AI Assistant] Feedback: ${result.rating} mode=${result.advisoryMode}`);

  return {
    id: result.id,
    userId: result.userId,
    orgId: result.orgId,
    messageId: result.messageId,
    rating: result.rating as 'positive' | 'negative',
    advisoryMode: result.advisoryMode as AdvisoryMode,
    page: result.page,
    timestamp: result.createdAt,
    messageContent: result.messageContent ?? undefined,
    userQuery: result.userQuery ?? undefined,
  };
}

export async function getFeedbackStats(
  orgId: string
): Promise<{ positive: number; negative: number; byMode: Record<string, { positive: number; negative: number }> }> {
  try {
    const rows = await db.select().from(aiAssistantFeedback).where(eq(aiAssistantFeedback.orgId, orgId));
    const stats = { positive: 0, negative: 0, byMode: {} as Record<string, { positive: number; negative: number }> };
    for (const f of rows) {
      const r = f.rating as 'positive' | 'negative';
      stats[r]++;
      if (!stats.byMode[f.advisoryMode]) stats.byMode[f.advisoryMode] = { positive: 0, negative: 0 };
      stats.byMode[f.advisoryMode][r]++;
    }
    return stats;
  } catch {
    return { positive: 0, negative: 0, byMode: {} };
  }
}

export { learnFromFeedback };
