# MarinaMatch — Master Product Specification
## Full Feature Roadmap: 1,000x Detail Build Guide
### Version 1.0 | Generated for Claude Code / Replit Shell

---

> **HOW TO USE THIS DOCUMENT**
> This spec is designed to be fed directly into Claude Code in your Replit shell, section by section.
> Each section contains: Feature Overview → Data Models → API Endpoints → Frontend Components → Business Logic → Testing Requirements.
> Work through sections in order. Every spec is self-contained and integration-ready.

---

## TABLE OF CONTENTS

1. [AI-Native Deal Intelligence](#1-ai-native-deal-intelligence)
   - 1.1 Ask Your Deal — Conversational AI Interface
   - 1.2 AI Narrative Generator
   - 1.3 AI Lease Abstractor
   - 1.4 Deal Risk Scoring AI
   - 1.5 AI Comps Narrator

2. [LP / Investor Portal](#2-lp--investor-portal)
   - 2.1 LP Dashboard
   - 2.2 Capital Call Workflow
   - 2.3 Waterfall / Distribution Engine
   - 2.4 K-1 / Tax Document Vault
   - 2.5 Investor Reporting Automation

3. [Portfolio-Level Intelligence](#3-portfolio-level-intelligence)
   - 3.1 Cross-Portfolio Dashboard
   - 3.2 Benchmark Engine
   - 3.3 Asset Rebalancing Alerts
   - 3.4 Vintage Analysis
   - 3.5 Hold/Sell Optimizer

4. [Market Intelligence & Data Layer](#4-market-intelligence--data-layer)
   - 4.1 Live Cap Rate Feed
   - 4.2 Rent Comps API Integration
   - 4.3 Demographics Overlay
   - 4.4 Zoning + Entitlement Tracker
   - 4.5 DockTalk 2.0 — AI-Curated News

5. [Operations & Asset Management](#5-operations--asset-management)
   - 5.1 Work Order / Maintenance Module
   - 5.2 Vendor Management
   - 5.3 CapEx Tracker
   - 5.4 Inspection Workflow
   - 5.5 Utility & OpEx Benchmarking

6. [Capital Markets Tools](#6-capital-markets-tools)
   - 6.1 Lender Matching Engine
   - 6.2 Term Sheet Comparator
   - 6.3 Debt Maturity Dashboard
   - 6.4 Preferred Equity / Mezz Tracker

7. [CRM & Relationship Intelligence](#7-crm--relationship-intelligence)
   - 7.1 Relationship Graph
   - 7.2 Deal Sourcing Score
   - 7.3 Follow-Up AI
   - 7.4 Contact Intelligence Feed
   - 7.5 Meeting Prep Brief

8. [Reporting & Communications](#8-reporting--communications)
   - 8.1 Board Package Generator
   - 8.2 Automated Quarterly Report
   - 8.3 Deal Pipeline Report
   - 8.4 White-Label Client Portal

9. [Quick Win Features](#9-quick-win-features)
   - 9.1 SMS / Push Deal Alerts
   - 9.2 E-Signature Integration
   - 9.3 Zapier/Make Webhook Layer
   - 9.4 Mobile-Optimized Deal Cards
   - 9.5 Custom Deal Stage Labels Per Asset Class

10. [CRM / Pipeline / Workflow Enhancements](#10-crm--pipeline--workflow-enhancements)
    - 10.1 Workflow Automation Engine
    - 10.2 Deal Timeline / Gantt View
    - 10.3 Deal Comparison in Workspace
    - 10.4 Key Dates on Kanban Cards
    - 10.5 Global Activity Log Polish
    - 10.6 Email Send Integration

---

# 1. AI-NATIVE DEAL INTELLIGENCE

---

## 1.1 Ask Your Deal — Conversational AI Interface

### Overview
A persistent, context-aware chat interface embedded inside every deal workspace. Users can ask natural language questions about financial models, DD status, comps, risk flags, and scenario analysis. Backed by live deal data, not static context.

### User Stories
- As a GP, I want to ask "What happens to my DSCR if rates go up 100bps?" and get an instant modeled answer.
- As an analyst, I want to ask "Summarize all DD items still open" and get a prioritized list.
- As a portfolio manager, I want to ask "How does this deal compare to our last 3 acquisitions?" and see a table.

### Data Models

```typescript
// schema/aiChat.ts
export const dealChatSessions = pgTable('deal_chat_sessions', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  dealId: integer('deal_id').references(() => deals.id),
  userId: integer('user_id').references(() => users.id),
  sessionTitle: varchar('session_title', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const dealChatMessages = pgTable('deal_chat_messages', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').references(() => dealChatSessions.id),
  role: varchar('role', { length: 20 }), // 'user' | 'assistant' | 'system'
  content: text('content'),
  contextSnapshot: jsonb('context_snapshot'), // deal data at time of message
  toolCallsUsed: jsonb('tool_calls_used'), // which data sources were consulted
  tokensUsed: integer('tokens_used'),
  latencyMs: integer('latency_ms'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const dealChatFeedback = pgTable('deal_chat_feedback', {
  id: serial('id').primaryKey(),
  messageId: integer('message_id').references(() => dealChatMessages.id),
  rating: integer('rating'), // 1-5
  comment: text('comment'),
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### Context Builder — Core Logic

```typescript
// lib/aiChat/buildDealContext.ts
export async function buildDealContext(dealId: number, orgId: number): Promise<DealContext> {
  // Pull all relevant deal data for AI context
  const [deal, financials, ddItems, comps, leases, contacts, documents, capStack] =
    await Promise.all([
      getDealById(dealId, orgId),
      getFinancialModelSummary(dealId),
      getDDItemsByDeal(dealId),
      getSalesCompsByDeal(dealId),
      getLeasesByDeal(dealId),
      getContactsByDeal(dealId),
      getDocumentsByDeal(dealId),
      getCapStackByDeal(dealId),
    ]);

  return {
    dealMeta: {
      name: deal.name,
      assetClass: deal.assetClass,
      stage: deal.stage,
      address: deal.address,
      askPrice: deal.askPrice,
      targetCloseDate: deal.targetCloseDate,
    },
    financials: {
      noi: financials.noi,
      capRate: financials.capRate,
      irr: financials.irr,
      equityMultiple: financials.equityMultiple,
      dscr: financials.dscr,
      ltv: financials.ltv,
      purchasePrice: financials.purchasePrice,
      totalCapitalization: financials.totalCapitalization,
      assumptionsSummary: financials.assumptionsSummary,
    },
    dueDiligence: {
      totalItems: ddItems.length,
      openItems: ddItems.filter(i => i.status === 'open').length,
      criticalItems: ddItems.filter(i => i.priority === 'critical'),
      completionPct: calculateDDCompletion(ddItems),
    },
    comps: comps.slice(0, 5).map(c => ({
      address: c.address,
      salePrice: c.salePrice,
      capRate: c.capRate,
      pricePerUnit: c.pricePerUnit,
      dateSold: c.dateSold,
    })),
    leases: leases.map(l => ({
      tenant: l.tenantName,
      unit: l.unitId,
      monthlyRent: l.monthlyRent,
      expiry: l.leaseEndDate,
      status: l.status,
    })),
    capStack: capStack,
  };
}

export function buildSystemPrompt(context: DealContext): string {
  return `You are MarinaMatch Deal Intelligence, an institutional-grade commercial real estate AI assistant. 
You have complete access to the following deal workspace data:

DEAL: ${context.dealMeta.name} | ${context.dealMeta.assetClass} | Stage: ${context.dealMeta.stage}
ADDRESS: ${context.dealMeta.address}
ASK PRICE: $${context.dealMeta.askPrice?.toLocaleString()}

FINANCIAL SNAPSHOT:
- NOI: $${context.financials.noi?.toLocaleString()}
- Cap Rate: ${context.financials.capRate}%
- IRR (Levered): ${context.financials.irr}%
- Equity Multiple: ${context.financials.equityMultiple}x
- DSCR: ${context.financials.dscr}
- LTV: ${context.financials.ltv}%

DUE DILIGENCE: ${context.dueDiligence.completionPct}% complete | ${context.dueDiligence.openItems} open items
${context.dueDiligence.criticalItems.map(i => `- CRITICAL: ${i.title}`).join('\n')}

LEASES: ${context.leases.length} active leases

Answer questions concisely and with institutional precision. Format financial figures with proper notation ($, %, x multiples). When performing sensitivity analysis, show the specific inputs and outputs. Never fabricate data not present in the context. If data is missing, say so clearly.`;
}
```

### API Endpoints

```typescript
// routes/aiChat.ts

// POST /api/ai-chat/sessions — create new session
router.post('/api/ai-chat/sessions', authenticate, async (req, res) => {
  const { dealId } = req.body;
  const { orgId, userId } = req.user;
  const context = await buildDealContext(dealId, orgId);
  const session = await db.insert(dealChatSessions).values({
    orgId, dealId, userId,
    sessionTitle: `Chat — ${new Date().toLocaleDateString()}`,
  }).returning();
  res.json({ session: session[0], context });
});

// POST /api/ai-chat/sessions/:sessionId/messages — send message
router.post('/api/ai-chat/sessions/:sessionId/messages', authenticate, async (req, res) => {
  const { content } = req.body;
  const { sessionId } = req.params;
  
  // Fetch session + deal context
  const session = await getSessionById(sessionId);
  const context = await buildDealContext(session.dealId, session.orgId);
  const history = await getMessagesBySession(sessionId);
  
  // Build messages array
  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content }
  ];
  
  // Save user message
  await db.insert(dealChatMessages).values({
    sessionId, role: 'user', content, contextSnapshot: context
  });
  
  const startTime = Date.now();
  
  // Call Anthropic API with streaming
  res.setHeader('Content-Type', 'text/event-stream');
  const stream = await anthropic.messages.stream({
    model: 'claude-opus-4-5',
    max_tokens: 2000,
    system: buildSystemPrompt(context),
    messages,
  });
  
  let fullResponse = '';
  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta') {
      const text = chunk.delta.text;
      fullResponse += text;
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
  }
  
  // Save assistant response
  await db.insert(dealChatMessages).values({
    sessionId, role: 'assistant', content: fullResponse,
    latencyMs: Date.now() - startTime,
  });
  
  res.write('data: [DONE]\n\n');
  res.end();
});

// GET /api/ai-chat/sessions/:dealId — list sessions for deal
// DELETE /api/ai-chat/sessions/:sessionId — delete session
// POST /api/ai-chat/messages/:messageId/feedback — thumbs up/down
```

### Frontend Components

```typescript
// components/aiChat/DealChatPanel.tsx
// Renders as a slide-over drawer from the right side of any deal workspace tab

interface DealChatPanelProps {
  dealId: number;
  isOpen: boolean;
  onClose: () => void;
}

// Key UI elements:
// - FloatingActionButton in bottom-right of workspace: "Ask AI" with sparkle icon
// - Slide-over panel (400px wide, full height)
// - Chat bubble interface (user right-aligned, AI left-aligned)
// - Streaming text with blinking cursor during generation
// - Message timestamps
// - Copy button on each AI response
// - Thumbs up/down feedback per message
// - "Suggested questions" chips on empty state:
//   • "What's the levered IRR at 65% LTV?"
//   • "List all open DD items"
//   • "How does cap rate compare to comps?"
//   • "What's the debt service coverage ratio?"
//   • "Summarize the investment thesis"
// - Session history sidebar (collapsed by default)
// - Clear chat button
// - Export chat as PDF button

// Suggested question chips trigger auto-send on click
// Markdown rendering for AI responses (tables, bullet lists, bold)
// Code blocks for financial calculations shown step-by-step
```

### Sensitivity Analysis Tool (Special AI Feature)

```typescript
// When user asks "what if" questions, trigger structured sensitivity analysis:
// Example: "What if vacancy goes to 15%?"
// System detects sensitivity query pattern and calls financial model endpoint
// Returns before/after comparison table + narrative

interface SensitivityRequest {
  variable: 'vacancy' | 'capRate' | 'interestRate' | 'rentGrowth' | 'exitCapRate' | 'ltv';
  currentValue: number;
  newValue: number;
  dealId: number;
}
// Endpoint: POST /api/ai-chat/sensitivity
// Returns: { before: FinancialSnapshot, after: FinancialSnapshot, delta: Record<string, number> }
```

---

## 1.2 AI Narrative Generator

### Overview
Automatically drafts investment committee memo commentary, executive summaries, market summaries, and risk factor sections by pulling live deal data through a structured prompt pipeline. Eliminates blank-page syndrome for analysts.

### Narrative Types Supported
1. **IC Memo Executive Summary** — 3-paragraph investment thesis
2. **Market Overview** — submarket narrative from comps + demographic data
3. **Risk Factors Section** — enumerated risks with mitigants
4. **Asset Description** — property narrative from physical attributes
5. **Investment Highlights** — 5-7 bullet deal strengths
6. **Management Team Bio Block** — from CRM contact records
7. **Capital Stack Narrative** — debt/equity structure explanation
8. **Exit Strategy Rationale** — disposition thesis

### Data Model

```typescript
export const aiNarratives = pgTable('ai_narratives', {
  id: serial('id').primaryKey(),
  dealId: integer('deal_id').references(() => deals.id),
  orgId: integer('org_id').references(() => organizations.id),
  userId: integer('user_id').references(() => users.id),
  narrativeType: varchar('narrative_type', { length: 100 }),
  // ic_exec_summary | market_overview | risk_factors | asset_description
  // investment_highlights | management_bio | capital_stack | exit_strategy
  promptVersion: varchar('prompt_version', { length: 20 }),
  generatedContent: text('generated_content'),
  editedContent: text('edited_content'), // user edits tracked separately
  isApproved: boolean('is_approved').default(false),
  approvedBy: integer('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  contextSnapshot: jsonb('context_snapshot'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### Prompt Templates

```typescript
// lib/aiNarrative/prompts.ts

export const NARRATIVE_PROMPTS: Record<NarrativeType, (ctx: DealContext) => string> = {
  ic_exec_summary: (ctx) => `
You are a senior CRE investment banker drafting an IC memo for an institutional investment committee.
Write a 3-paragraph executive summary for the following acquisition opportunity.

DEAL DATA:
${formatDealContext(ctx)}

Requirements:
- Paragraph 1: Investment thesis and opportunity overview (2-3 sentences)
- Paragraph 2: Financial highlights with specific numbers (NOI, cap rate, IRR, equity multiple, DSCR)
- Paragraph 3: Strategic rationale and value-add potential
- Tone: Institutional, precise, no hyperbole
- Do NOT include any figures not present in the data provided
- Format dollar amounts as $X.XM or $XXM
- Format percentages to one decimal place
Output ONLY the 3 paragraphs, no headers or labels.
`,

  risk_factors: (ctx) => `
You are a senior CRE underwriter drafting the Risk Factors section of an investment memorandum.

DEAL DATA:
${formatDealContext(ctx)}
OPEN DD ITEMS: ${ctx.dueDiligence.openItems} items unresolved
CRITICAL DD FLAGS: ${ctx.dueDiligence.criticalItems.map(i => i.title).join(', ')}

Draft 5-7 risk factors. Each risk factor should:
1. Name the risk in bold (e.g., **Interest Rate Risk**)
2. Describe the risk in 1-2 sentences
3. Describe the mitigant in 1 sentence
Format as a structured list. Be specific to this deal's data, not generic.
`,

  investment_highlights: (ctx) => `
Draft 6 investment highlights for this deal as crisp, institutional bullet points.
Each bullet should lead with a specific number or fact from the deal data.
Format: "• [Specific metric or fact] — [brief context]"

DEAL DATA:
${formatDealContext(ctx)}
`,
};
```

### API Endpoints

```typescript
// POST /api/ai-narratives/generate
router.post('/api/ai-narratives/generate', authenticate, async (req, res) => {
  const { dealId, narrativeType } = req.body;
  const context = await buildDealContext(dealId, req.user.orgId);
  const prompt = NARRATIVE_PROMPTS[narrativeType](context);
  
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });
  
  const content = response.content[0].text;
  
  const narrative = await db.insert(aiNarratives).values({
    dealId, orgId: req.user.orgId, userId: req.user.id,
    narrativeType, generatedContent: content,
    contextSnapshot: context, promptVersion: 'v1.0',
  }).returning();
  
  res.json({ narrative: narrative[0] });
});

// PUT /api/ai-narratives/:id — save edits
// POST /api/ai-narratives/:id/approve — mark as approved
// GET /api/ai-narratives/:dealId — get all narratives for deal
// POST /api/ai-narratives/:id/regenerate — regenerate with same type
```

### Frontend Component

```typescript
// components/aiNarrative/NarrativeGenerator.tsx
// Lives inside IC Memo / Document Builder tab of deal workspace

// UI Layout:
// Left panel: Narrative type selector (icon cards for each type)
// Right panel: Generated content in a rich text editor (TipTap or Quill)

// Flow:
// 1. User selects narrative type
// 2. Clicks "Generate" — shows loading skeleton for ~3 seconds
// 3. Content streams into editor
// 4. User can edit inline
// 5. "Approve" locks the content (shows green checkmark + approver name)
// 6. "Regenerate" produces new version (previous saved in history)
// 7. "Insert into Document" pushes to IC Memo PDF builder

// Version history drawer:
// Shows past generated versions with timestamps
// Diff view to compare current vs. previous
// Restore any previous version

// Copy to clipboard button
// Word count indicator
// Reading grade level indicator (target: Grade 12 / professional)
```

---

## 1.3 AI Lease Abstractor

### Overview
Upload any lease PDF (commercial, retail, office, industrial, marina slip lease, ground lease). AI extracts 40+ key data points, flags risk clauses, highlights unusual terms, and auto-populates the MarinaMatch lease management module.

### Fields Extracted

```typescript
interface LeaseAbstractionResult {
  // Core Terms
  tenantLegalName: string;
  landlordLegalName: string;
  propertyAddress: string;
  leaseType: 'gross' | 'net' | 'nnn' | 'modified_gross' | 'ground' | 'percentage';
  commencementDate: string;
  expirationDate: string;
  leaseTerm: string; // "5 years, 3 months"
  squareFootage: number;
  
  // Financial Terms
  baseRent: number; // monthly
  annualRent: number;
  rentSchedule: RentScheduleRow[]; // year-by-year if escalations exist
  rentEscalation: string; // "3% annually" or "CPI"
  securityDeposit: number;
  percentageRent: string | null; // "5% of gross sales over $500k"
  
  // Options
  renewalOptions: RenewalOption[];
  purchaseOption: PurchaseOption | null;
  terminationOption: TerminationOption | null;
  expansionOption: ExpansionOption | null;
  
  // Tenant Responsibilities
  tenantPaysUtilities: boolean;
  tenantPaysInsurance: boolean;
  tenantPaysRealEstateTax: boolean;
  tenantPaysCam: boolean;
  camEstimate: number | null;
  camCap: number | null;
  
  // Use & Operations
  permittedUse: string;
  exclusiveUse: string | null;
  coTenancyRequirement: string | null;
  
  // Assignment & Subletting
  assignmentRights: string;
  sublettingRights: string;
  
  // Default & Remedies
  curePeriodsDefault: string;
  landlordDefaultRemedies: string;
  
  // Risk Flags (AI-identified)
  riskFlags: RiskFlag[];
  unusualClauses: UnusualClause[];
  missingStandardClauses: string[];
}

interface RiskFlag {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  pageReference: string;
  recommendation: string;
}
```

### Risk Detection Patterns

```typescript
// lib/leaseAbstractor/riskDetector.ts
// Common risk patterns to detect:

const RISK_PATTERNS = [
  {
    id: 'below_market_rent',
    check: (data) => data.baseRent < data.marketRentEstimate * 0.85,
    severity: 'high',
    description: 'Base rent appears below market — impacts cap rate and exit valuation',
  },
  {
    id: 'co_tenancy_clause',
    check: (data) => data.coTenancyRequirement !== null,
    severity: 'high',
    description: 'Co-tenancy clause present — tenant may have rent reduction or termination rights if anchor vacates',
  },
  {
    id: 'short_remaining_term',
    check: (data) => getRemainingTermMonths(data.expirationDate) < 24,
    severity: 'critical',
    description: 'Lease expires within 24 months — significant rollover risk at acquisition',
  },
  {
    id: 'no_personal_guarantee',
    check: (data) => !data.hasPersonalGuarantee,
    severity: 'medium',
    description: 'No personal guarantee — limited recourse against tenant principal',
  },
  {
    id: 'above_market_cam_cap',
    check: (data) => data.camCap && data.camCap > 0.05,
    severity: 'medium',
    description: 'CAM cap exceeds 5% — landlord bears cost overrun risk beyond cap',
  },
  {
    id: 'unlimited_assignment_rights',
    check: (data) => data.assignmentRights?.includes('without consent'),
    severity: 'high',
    description: 'Tenant can assign without landlord consent — credit quality risk',
  },
  {
    id: 'percentage_rent_only',
    check: (data) => data.percentageRent && !data.baseRent,
    severity: 'critical',
    description: 'Percentage rent only — income highly variable and sales-dependent',
  },
  {
    id: 'no_escalation',
    check: (data) => !data.rentEscalation,
    severity: 'medium',
    description: 'No rent escalation clause — flat rent loses value against inflation',
  },
];
```

### API Endpoints

```typescript
// POST /api/lease-abstractor/extract — upload and extract
router.post('/api/lease-abstractor/extract', authenticate, upload.single('lease'), async (req, res) => {
  const { dealId, leaseId } = req.body;
  const pdfBuffer = req.file.buffer;
  const base64Pdf = pdfBuffer.toString('base64');
  
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64Pdf }
        },
        {
          type: 'text',
          text: LEASE_EXTRACTION_PROMPT, // Full prompt requesting JSON output
        }
      ]
    }]
  });
  
  const extracted = JSON.parse(response.content[0].text);
  const riskFlags = detectRisks(extracted);
  const result = { ...extracted, riskFlags };
  
  // Save abstraction
  await db.insert(leaseAbstractions).values({
    leaseId, dealId, orgId: req.user.orgId,
    extractedData: result,
    extractedAt: new Date(),
  });
  
  res.json(result);
});

// POST /api/lease-abstractor/:abstractionId/populate-lease
// Populates the lease record in the main leases table from abstracted data

// GET /api/lease-abstractor/:dealId — get all abstractions for deal
// PATCH /api/lease-abstractor/:abstractionId/field — update a single field
```

### Frontend Component

```typescript
// components/leaseAbstractor/LeaseAbstractorPanel.tsx

// UI Layout:
// Top: PDF upload drop zone with "or click to browse"
// Processing state: animated progress bar with steps:
//   "Parsing document..." → "Extracting key terms..." → "Detecting risk flags..." → "Done!"
// Results layout: 3 columns
//   Column 1: Core terms (dates, rent, size)
//   Column 2: Options and rights
//   Column 3: Risk flags (color-coded by severity)
// Each extracted field:
//   - Shows extracted value
//   - "Source" link highlights the relevant lease page/section
//   - Edit icon to override
//   - Confidence indicator (high/medium/low)
// Risk Flags section:
//   - Red cards for critical, orange for high, yellow for medium
//   - Each card: flag name, description, page reference, recommendation
// Action bar:
//   - "Populate Lease Record" — writes all fields to lease management module
//   - "Export Abstraction PDF" — formatted summary document
//   - "Flag for Review" — sends to team member
```

---

## 1.4 Deal Risk Scoring AI

### Overview
A machine learning-enhanced risk scoring system that evaluates every deal across 8 risk dimensions, producing a composite score and a narrative risk summary. Goes beyond rule-based buy-box scoring by incorporating comparable deal outcomes and market data.

### Risk Dimensions & Scoring Framework

```typescript
interface DealRiskScore {
  dealId: number;
  compositeScore: number; // 0-100 (100 = lowest risk)
  riskTier: 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: {
    financialStructure: RiskDimension;   // LTV, DSCR, debt yield
    marketRisk: RiskDimension;           // submarket trends, vacancy, absorption
    tenantCredit: RiskDimension;         // tenant quality, lease term, concentration
    physicalCondition: RiskDimension;    // age, capex needed, deferred maintenance
    executionRisk: RiskDimension;        // business plan complexity, team experience
    liquidityRisk: RiskDimension;        // asset class liquidity, market depth
    regulatoryRisk: RiskDimension;       // zoning, entitlements, environmental
    macroRisk: RiskDimension;            // rate sensitivity, economic cycle exposure
  };
  narrativeSummary: string;
  topRisks: string[]; // top 3
  topStrengths: string[]; // top 3
  comparableDealsContext: string;
  generatedAt: timestamp;
}

interface RiskDimension {
  name: string;
  score: number; // 0-100
  weight: number; // sum to 1.0 across all dimensions
  keyInputs: Record<string, any>;
  flags: string[];
  commentary: string;
}
```

### Scoring Logic

```typescript
// lib/riskScoring/scoringEngine.ts

const DIMENSION_WEIGHTS = {
  financialStructure: 0.25,
  marketRisk: 0.20,
  tenantCredit: 0.20,
  physicalCondition: 0.10,
  executionRisk: 0.10,
  liquidityRisk: 0.05,
  regulatoryRisk: 0.05,
  macroRisk: 0.05,
};

function scoreFinancialStructure(deal: Deal, fm: FinancialModel): RiskDimension {
  let score = 100;
  const flags: string[] = [];
  
  // LTV scoring
  if (fm.ltv > 80) { score -= 30; flags.push('LTV > 80% — high leverage'); }
  else if (fm.ltv > 70) { score -= 15; flags.push('LTV > 70% — moderate leverage'); }
  else if (fm.ltv > 65) { score -= 5; }
  
  // DSCR scoring
  if (fm.dscr < 1.10) { score -= 30; flags.push('DSCR < 1.10x — minimal coverage'); }
  else if (fm.dscr < 1.20) { score -= 15; flags.push('DSCR < 1.20x — tight coverage'); }
  else if (fm.dscr < 1.25) { score -= 5; }
  
  // Debt Yield
  const debtYield = fm.noi / fm.loanAmount;
  if (debtYield < 0.07) { score -= 20; flags.push('Debt yield < 7%'); }
  
  // IRR spread over hurdle
  if (fm.irr < 12) { score -= 20; flags.push('IRR < 12% — below institutional threshold'); }
  
  return {
    name: 'Financial Structure',
    score: Math.max(0, score),
    weight: DIMENSION_WEIGHTS.financialStructure,
    keyInputs: { ltv: fm.ltv, dscr: fm.dscr, irr: fm.irr, debtYield },
    flags,
    commentary: generateDimensionCommentary('financialStructure', score, flags),
  };
}

// Similar functions for each dimension...

export async function generateDealRiskScore(dealId: number): Promise<DealRiskScore> {
  const [deal, fm, leases, ddItems, market] = await fetchAllDealData(dealId);
  
  const dimensions = {
    financialStructure: scoreFinancialStructure(deal, fm),
    marketRisk: scoreMarketRisk(deal, market),
    tenantCredit: scoreTenantCredit(leases),
    physicalCondition: scorePhysicalCondition(deal, ddItems),
    executionRisk: scoreExecutionRisk(deal),
    liquidityRisk: scoreLiquidityRisk(deal),
    regulatoryRisk: scoreRegulatoryRisk(deal, ddItems),
    macroRisk: scoreMacroRisk(deal, fm),
  };
  
  const compositeScore = Object.entries(dimensions).reduce((acc, [key, dim]) => {
    return acc + (dim.score * DIMENSION_WEIGHTS[key]);
  }, 0);
  
  const riskTier = compositeScore >= 80 ? 'A' : compositeScore >= 65 ? 'B' :
                   compositeScore >= 50 ? 'C' : compositeScore >= 35 ? 'D' : 'F';
  
  // AI narrative generation
  const narrativeSummary = await generateRiskNarrative(dimensions, compositeScore, deal);
  
  return { dealId, compositeScore, riskTier, dimensions, narrativeSummary, generatedAt: new Date() };
}
```

### Frontend Component

```typescript
// components/riskScoring/DealRiskScorecard.tsx

// UI Layout:
// Header: Composite score as large gauge chart (0-100) + letter grade badge
// Risk Tier badge: Green (A) / Blue (B) / Yellow (C) / Orange (D) / Red (F)

// Radar/Spider chart showing all 8 dimensions
// Below radar: dimension cards in 2x4 grid
//   Each card: dimension name, score bar, top flags

// Narrative Summary section (AI-generated paragraph)
// Top Risks (red pills): e.g., "High LTV (78%)" | "Sub-1.20x DSCR" | "Lease expiry <18mo"
// Top Strengths (green pills): e.g., "Strong rent growth market" | "Investment-grade tenant"

// Score breakdown table with weights shown
// "Regenerate Score" button
// "Share Risk Report" — generates PDF scorecard
// Historical score trend (if deal scored previously): sparkline

// Color scheme:
// A: #22c55e (green)  B: #3b82f6 (blue)  C: #eab308 (yellow)
// D: #f97316 (orange)  F: #ef4444 (red)
```

---

## 1.5 AI Comps Narrator

### Overview
Takes your raw sales comps table and generates a professional 2-3 paragraph market position narrative, suitable for IC memos and offering memoranda. Highlights the subject property's position relative to the comp set.

### Prompt Logic

```typescript
// lib/aiNarrative/compsNarrator.ts

export async function generateCompsNarrative(
  dealId: number,
  subjectProperty: Deal,
  comps: SalesComp[]
): Promise<string> {
  const compsSummary = comps.map(c => ({
    address: c.address,
    saleDate: c.saleDate,
    salePrice: c.salePrice,
    pricePerUnit: c.pricePerUnit,
    capRate: c.capRate,
    noi: c.noi,
    occupancy: c.occupancy,
    distance: c.distanceMiles,
  }));
  
  const avgCapRate = average(comps.map(c => c.capRate));
  const avgPPU = average(comps.map(c => c.pricePerUnit));
  const subjectCapRate = subjectProperty.financialModel?.capRate;
  const subjectPPU = subjectProperty.askPrice / subjectProperty.unitCount;
  
  const prompt = `
You are a CRE market analyst writing the Comparable Sales Analysis section of an investment memo.

SUBJECT PROPERTY:
- Asset: ${subjectProperty.name}
- Asset Class: ${subjectProperty.assetClass}
- Location: ${subjectProperty.address}
- Ask Price: $${subjectProperty.askPrice?.toLocaleString()}
- Price Per Unit: $${subjectPPU?.toLocaleString()}
- In-Place Cap Rate: ${subjectCapRate}%

COMPARABLE SALES (last 24 months):
${compsSummary.map((c, i) => `
Comp ${i+1}: ${c.address}
  Sale Date: ${c.saleDate} | Sale Price: $${c.salePrice?.toLocaleString()}
  Price/Unit: $${c.pricePerUnit?.toLocaleString()} | Cap Rate: ${c.capRate}%
  Occupancy at Sale: ${c.occupancy}% | Distance: ${c.distance} miles
`).join('')}

COMP SET AVERAGES:
- Avg Cap Rate: ${avgCapRate.toFixed(2)}%
- Avg Price/Unit: $${avgPPU?.toLocaleString()}

Write a 3-paragraph Comparable Sales Analysis:
- Paragraph 1: Overview of the comp set — market activity, date range, asset quality
- Paragraph 2: Where the subject property prices relative to comps (premium/discount and why)
- Paragraph 3: What the comp set implies for exit valuation and hold period returns

Use specific numbers. Institutional tone. No hyperbole.`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });
  
  return response.content[0].text;
}
```

---

# 2. LP / INVESTOR PORTAL

---

## 2.1 LP Dashboard

### Overview
A dedicated, role-gated investor portal where limited partners can view their investment positions, performance metrics, distributions, and documents. Accessible via a separate login or a permissioned view of the main platform.

### Data Models

```typescript
// Investor / LP entity
export const investors = pgTable('investors', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  investorType: varchar('investor_type', { length: 50 }),
  // individual | family_office | institutional | trust | entity
  legalName: varchar('legal_name', { length: 255 }),
  taxId: varchar('tax_id', { length: 50 }), // encrypted
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  accreditedStatus: varchar('accredited_status', { length: 50 }),
  accreditedVerifiedAt: timestamp('accredited_verified_at'),
  primaryContactId: integer('primary_contact_id').references(() => contacts.id),
  bankAccountInfo: jsonb('bank_account_info'), // encrypted
  wireInstructions: jsonb('wire_instructions'), // encrypted
  preferredDistributionMethod: varchar('preferred_distribution_method', { length: 50 }),
  // wire | ach | check
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Investment (LP's stake in a specific deal)
export const investments = pgTable('investments', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  investorId: integer('investor_id').references(() => investors.id),
  dealId: integer('deal_id').references(() => deals.id),
  investmentType: varchar('investment_type', { length: 50 }),
  // equity | preferred_equity | mezz | debt | co_gp
  commitmentAmount: numeric('commitment_amount', { precision: 15, scale: 2 }),
  fundedAmount: numeric('funded_amount', { precision: 15, scale: 2 }),
  ownershipPct: numeric('ownership_pct', { precision: 8, scale: 4 }),
  preferredReturn: numeric('preferred_return', { precision: 5, scale: 2 }), // %
  promoteThreshold: numeric('promote_threshold', { precision: 5, scale: 2 }), // %
  investmentDate: date('investment_date'),
  status: varchar('status', { length: 50 }),
  // committed | funded | active | realized | written_off
  subscriptionAgreementDocId: integer('subscription_agreement_doc_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Distribution records
export const distributions = pgTable('distributions', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  dealId: integer('deal_id').references(() => deals.id),
  distributionDate: date('distribution_date'),
  distributionType: varchar('distribution_type', { length: 50 }),
  // cash_flow | return_of_capital | refinance_proceeds | sale_proceeds | preferred_return
  totalAmount: numeric('total_amount', { precision: 15, scale: 2 }),
  notes: text('notes'),
  approvedBy: integer('approved_by').references(() => users.id),
  status: varchar('status', { length: 30 }), // draft | approved | sent | completed
  createdAt: timestamp('created_at').defaultNow(),
});

// Individual LP distribution line items
export const distributionAllocations = pgTable('distribution_allocations', {
  id: serial('id').primaryKey(),
  distributionId: integer('distribution_id').references(() => distributions.id),
  investmentId: integer('investment_id').references(() => investments.id),
  investorId: integer('investor_id').references(() => investors.id),
  amount: numeric('amount', { precision: 15, scale: 2 }),
  returnOfCapital: numeric('return_of_capital', { precision: 15, scale: 2 }),
  preferredReturnAmount: numeric('preferred_return_amount', { precision: 15, scale: 2 }),
  profitShare: numeric('profit_share', { precision: 15, scale: 2 }),
  status: varchar('status', { length: 30 }), // pending | sent | confirmed
  sentAt: timestamp('sent_at'),
  confirmedAt: timestamp('confirmed_at'),
});
```

### LP Dashboard Metrics

```typescript
// Per-investor portfolio metrics
interface LPPortfolioSummary {
  investorId: number;
  // Portfolio totals
  totalCommitted: number;
  totalFunded: number;
  totalDistributed: number;
  totalCurrentValue: number;
  totalUnrealizedGain: number;
  // Performance
  portfolioIRR: number;
  portfolioEquityMultiple: number;
  portfolioROI: number; // % return to date
  // Position breakdown
  activeInvestments: number;
  realizedInvestments: number;
  totalDeals: number;
  // Deal-level positions (table)
  positions: InvestmentPosition[];
  // Distribution history (chart data)
  distributionHistory: DistributionPeriod[];
}

interface InvestmentPosition {
  dealId: number;
  dealName: string;
  assetClass: string;
  investmentDate: string;
  funded: number;
  ownershipPct: number;
  currentValue: number;
  totalDistributed: number;
  unrealizedGain: number;
  irr: number;
  equityMultiple: number;
  status: string;
}
```

### API Endpoints

```typescript
// GET /api/lp/dashboard — LP's portfolio summary (LP-role authenticated)
// GET /api/lp/positions — LP's investment positions
// GET /api/lp/distributions — LP's distribution history
// GET /api/lp/documents — LP's documents (K-1s, reports, agreements)
// GET /api/lp/deals/:dealId — LP's view of a specific deal

// GP-side investor management:
// GET /api/investors — list all investors (GP role)
// POST /api/investors — create investor
// GET /api/investors/:id — investor detail
// PUT /api/investors/:id — update investor
// GET /api/investors/:id/portfolio — investor's full portfolio
// POST /api/investments — create investment record
// GET /api/investments/:dealId — all investments in a deal
// POST /api/distributions — create distribution
// POST /api/distributions/:id/calculate — auto-calculate allocations via waterfall
// POST /api/distributions/:id/approve — approve distribution
// POST /api/distributions/:id/send — mark as sent to investors
```

### Frontend Components

```typescript
// pages/lpPortal/LPDashboard.tsx — investor-facing view
// UI Layout:
// Header: "Welcome, [Investor Name]" + last login timestamp
// Summary cards row:
//   Total Invested | Current Portfolio Value | Total Distributions | Portfolio IRR
// Portfolio performance chart: Invested capital vs. Value over time (area chart)
// Positions table:
//   Deal | Asset Class | Invested | Ownership % | Current Value | Total Distributions | IRR | Status
// Recent distributions timeline
// Documents section: K-1s, quarterly reports, subscription agreements

// pages/investors/InvestorManagement.tsx — GP-facing investor CRM
// Investor table with search/filter
// Investor detail page: profile, all investments, distribution history, documents
// Capital call tracker (see 2.2)

// Dedicated LP login URL: /investor or /lp
// Separate JWT role: 'lp_investor'
// All LP routes check investorId ownership (can only see own data)
```

---

## 2.2 Capital Call Workflow

### Overview
Manages the full capital call lifecycle: issuance, notice delivery, tracking, and reconciliation. Supports multiple tranches per deal.

### Data Models

```typescript
export const capitalCalls = pgTable('capital_calls', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  dealId: integer('deal_id').references(() => deals.id),
  callNumber: integer('call_number'), // 1, 2, 3...
  callDate: date('call_date'),
  dueDate: date('due_date'),
  totalAmount: numeric('total_amount', { precision: 15, scale: 2 }),
  purpose: varchar('purpose', { length: 255 }),
  // acquisition | renovation | operating_shortfall | refinance_costs | reserves
  status: varchar('status', { length: 30 }),
  // draft | issued | partially_funded | fully_funded | overdue
  notes: text('notes'),
  noticeSentAt: timestamp('notice_sent_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const capitalCallLineItems = pgTable('capital_call_line_items', {
  id: serial('id').primaryKey(),
  capitalCallId: integer('capital_call_id').references(() => capitalCalls.id),
  investmentId: integer('investment_id').references(() => investments.id),
  investorId: integer('investor_id').references(() => investors.id),
  amountCalled: numeric('amount_called', { precision: 15, scale: 2 }),
  amountReceived: numeric('amount_received', { precision: 15, scale: 2 }).default('0'),
  dueDate: date('due_date'),
  status: varchar('status', { length: 30 }),
  // pending | received | overdue | waived
  receivedAt: timestamp('received_at'),
  paymentMethod: varchar('payment_method', { length: 50 }),
  referenceNumber: varchar('reference_number', { length: 100 }),
  notes: text('notes'),
});
```

### Capital Call Flow

```
Draft Call → Assign Amounts → Generate Notices → Send to LPs → Track Receipt → Mark Funded → Update Investment Records
```

### Notice Template

```typescript
// lib/capitalCalls/noticeGenerator.ts
export function generateCapitalCallNotice(
  call: CapitalCall,
  lineItem: CapitalCallLineItem,
  investor: Investor,
  deal: Deal
): string {
  return `
CAPITAL CALL NOTICE
${deal.orgName}

Date: ${formatDate(call.callDate)}
Due Date: ${formatDate(call.dueDate)}
Deal: ${deal.name}
Capital Call #${call.callNumber}

Dear ${investor.legalName},

Pursuant to the Operating Agreement for ${deal.name}, you are hereby called upon to fund the following capital contribution:

Amount Called: $${lineItem.amountCalled.toLocaleString()}
Your Ownership Interest: ${lineItem.ownershipPct}%

Purpose of Capital Call:
${call.purpose}

Wire Instructions:
[WIRE DETAILS FROM ORG SETTINGS]

Please confirm receipt of this notice and your wire transmission by responding to this email.

[GP Signature Block]
`;
}
```

### API Endpoints

```typescript
// POST /api/capital-calls — create capital call
// GET /api/capital-calls/:dealId — list calls for deal
// POST /api/capital-calls/:id/calculate — auto-calculate LP amounts by ownership %
// POST /api/capital-calls/:id/issue — generate notices, change status to issued
// POST /api/capital-calls/:id/line-items/:lineItemId/mark-received — log payment
// GET /api/capital-calls/:id/summary — funded vs. outstanding summary
// GET /api/capital-calls/org/overdue — all overdue calls across org
```

---

## 2.3 Waterfall / Distribution Engine

### Overview
Calculates distribution allocations based on configurable waterfall structures. Supports preferred return, return of capital, various promote hurdles, and multiple LP classes.

### Waterfall Structure Types Supported

```typescript
type WaterfallType =
  | 'simple_preferred'        // Pref return → then pro-rata
  | 'pari_passu'              // Pure pro-rata, no pref
  | 'european_waterfall'      // Full return of capital before any promote
  | 'american_waterfall'      // Deal-by-deal promote
  | 'tiered_promote'          // Multiple promote tiers at IRR hurdles
  | 'blended';                // Custom hybrid

interface WaterfallTier {
  tierId: number;
  name: string; // "8% Preferred Return" | "1.5x Return of Capital" | "12% IRR Hurdle" etc.
  triggerType: 'preferred_return' | 'roc' | 'irr_hurdle' | 'equity_multiple';
  triggerValue: number;
  gpPromotePct: number; // % of profits GP receives in this tier
  lpPct: number; // % LPs receive (usually 100 - gpPromotePct)
  description: string;
}
```

### Waterfall Calculation Engine

```typescript
// lib/waterfall/waterfallCalculator.ts

export function calculateWaterfall(
  structure: WaterfallStructure,
  proceeds: number, // total available for distribution
  investment: Investment,
  cashFlowHistory: CashFlow[]
): WaterfallResult {
  
  const invested = investment.fundedAmount;
  const lpOwnershipPct = investment.ownershipPct / 100;
  let remaining = proceeds;
  const tiers: TierResult[] = [];
  
  for (const tier of structure.tiers) {
    if (remaining <= 0) break;
    
    let tierAmount = 0;
    let gpShare = 0;
    let lpShare = 0;
    
    switch (tier.triggerType) {
      case 'preferred_return': {
        // Calculate accrued pref
        const accruedPref = calculateAccruedPreferredReturn(
          invested, tier.triggerValue, cashFlowHistory
        );
        const unpaidPref = Math.max(0, accruedPref - getPreviousPreferredPaid(cashFlowHistory));
        tierAmount = Math.min(remaining, unpaidPref);
        lpShare = tierAmount; // 100% to LP until pref satisfied
        gpShare = 0;
        break;
      }
      case 'roc': {
        // Return of capital to LP
        const totalROCPaid = getTotalROCPaid(cashFlowHistory);
        const rocOwed = Math.max(0, invested - totalROCPaid);
        tierAmount = Math.min(remaining, rocOwed);
        lpShare = tierAmount;
        gpShare = 0;
        break;
      }
      case 'irr_hurdle': {
        // GP promote kicks in once LP achieves target IRR
        const currentIRR = calculateXIRR(cashFlowHistory, new Date());
        if (currentIRR >= tier.triggerValue) {
          // GP gets promote on ALL remaining distributions above hurdle
          gpShare = remaining * (tier.gpPromotePct / 100);
          lpShare = remaining * (tier.lpPct / 100);
          tierAmount = remaining;
        }
        break;
      }
    }
    
    remaining -= tierAmount;
    tiers.push({ tier, tierAmount, gpShare, lpShare, remaining });
  }
  
  return {
    totalProceeds: proceeds,
    tiers,
    totalGP: tiers.reduce((s, t) => s + t.gpShare, 0),
    totalLP: tiers.reduce((s, t) => s + t.lpShare, 0),
    effectiveGPPromote: tiers.reduce((s, t) => s + t.gpShare, 0) / proceeds,
  };
}
```

---

## 2.4 K-1 / Tax Document Vault

### Overview
Secure document storage and distribution for tax documents (K-1s, 1099s), organized by tax year and investor. Supports bulk upload, individual investor assignment, and LP self-service download.

### Data Models

```typescript
export const taxDocuments = pgTable('tax_documents', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  investorId: integer('investor_id').references(() => investors.id),
  dealId: integer('deal_id').references(() => deals.id).default(null),
  // null if fund-level document
  documentType: varchar('document_type', { length: 50 }),
  // k1 | 1099 | schedule_k1 | annual_report | state_filing
  taxYear: integer('tax_year'),
  documentUrl: varchar('document_url', { length: 500 }),
  fileName: varchar('file_name', { length: 255 }),
  fileSize: integer('file_size'),
  uploadedBy: integer('uploaded_by').references(() => users.id),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
  sentAt: timestamp('sent_at'),
  sentBy: integer('sent_by').references(() => users.id),
  downloadedByInvestorAt: timestamp('downloaded_by_investor_at'),
  isAvailableToInvestor: boolean('is_available_to_investor').default(false),
  expiresAt: timestamp('expires_at'), // for generated download links
});
```

### Bulk Upload Flow

```typescript
// POST /api/tax-documents/bulk-upload
// Accepts zip file containing PDFs named by investor ID or legal name
// Auto-matches to investor records via fuzzy name matching
// Shows unmatched files for manual assignment
// Sets all as draft (not visible to LPs) until explicitly published

// POST /api/tax-documents/publish-batch — make batch visible to LPs
// POST /api/tax-documents/notify-investors — send email to all investors with new K-1s
```

---

## 2.5 Investor Reporting Automation

### Overview
Automatically generates quarterly and annual investor reports using live portfolio data, formatted as branded PDFs. Supports bulk generation and distribution to all LPs.

### Report Sections (Quarterly Report)
1. Cover page: Deal name, period, GP branding
2. Executive summary (AI-generated from period performance)
3. Financial performance: NOI, occupancy, revenue vs. budget
4. Capital account summary: invested, distributed, current value, IRR to date
5. Operational highlights (manually entered narrative section)
6. Market commentary (AI-generated from market data)
7. Forward-looking statements / outlook
8. Appendix: Monthly P&L, rent roll snapshot

### Generation Flow

```typescript
// POST /api/investor-reports/generate
// Body: { dealId, period: 'Q1-2025', reportType: 'quarterly' | 'annual' }
// 1. Fetch period financials vs. budget
// 2. Fetch all LP positions and capital accounts
// 3. AI-generate executive summary and market commentary
// 4. Build PDF via existing PDF generation infrastructure
// 5. Store report, associate with deal and period
// 6. Return report for preview before sending

// POST /api/investor-reports/:id/send
// Emails each LP their version with personalized capital account data
// Each PDF is uniquely generated per LP (includes their specific numbers)
```

---

# 3. PORTFOLIO-LEVEL INTELLIGENCE

---

## 3.1 Cross-Portfolio Dashboard

### Overview
A unified command center showing all assets under management across every deal. Aggregates financial performance, occupancy, capital deployment, and pipeline metrics in a single institutional-grade view.

### Data Model — Portfolio Snapshot

```typescript
interface PortfolioSnapshot {
  orgId: number;
  asOf: Date;
  
  // AUM Metrics
  totalAUM: number; // sum of current values
  totalEquityDeployed: number;
  totalDebtOutstanding: number;
  totalLPs: number;
  totalDeals: number;
  
  // Performance
  portfolioWeightedIRR: number;
  portfolioWeightedEquityMultiple: number;
  totalDistributedToDate: number;
  totalUnrealizedGain: number;
  
  // Operational
  portfolioOccupancy: number; // weighted avg
  portfolioNOI: number; // trailing 12 months
  portfolioNOIGrowth: number; // vs prior year
  portfolioCapRate: number; // weighted avg
  
  // By Asset Class breakdown
  byAssetClass: AssetClassBreakdown[];
  
  // By Stage breakdown
  byStage: { stage: string; count: number; value: number }[];
  
  // Geographic breakdown
  byMarket: { market: string; count: number; value: number }[];
  
  // Individual asset rows
  assets: AssetSummaryRow[];
}

interface AssetSummaryRow {
  dealId: number;
  name: string;
  assetClass: string;
  market: string;
  acquisitionDate: string;
  acquisitionPrice: number;
  currentValue: number;
  equityDeployed: number;
  unrealizedGain: number;
  noi: number;
  occupancy: number;
  capRate: number;
  irr: number;
  equityMultiple: number;
  dscr: number;
  debtMaturity: string;
  stage: string;
  performanceVsBudget: number; // % variance NOI actual vs budget
}
```

### API Endpoints

```typescript
// GET /api/portfolio/snapshot — full portfolio snapshot
// GET /api/portfolio/performance — time-series performance data
// GET /api/portfolio/assets — all assets with key metrics
// GET /api/portfolio/exposure — concentration analysis (geography, asset class, tenant)
// GET /api/portfolio/cash-flow-forecast — projected cash flows next 12 months
```

### Frontend — Portfolio Dashboard

```typescript
// pages/portfolio/PortfolioDashboard.tsx

// Layout:
// Top KPI strip (8 cards): AUM | Equity Deployed | Portfolio IRR | Weighted Equity Multiple
//                           Total NOI | Avg Occupancy | Total LP Count | Distributions YTD

// Row 2: 3 charts side by side
//   - Asset class pie chart (by value)
//   - Geographic heat map or bar chart
//   - Performance vs. budget waterfall chart

// Row 3: Full-width portfolio table
//   Columns: Asset | Class | Market | Acq Date | Acq Price | Current Value | NOI | Occ% | Cap Rate | IRR | EM | DSCR | Debt Maturity | Var vs Budget
//   Sortable all columns
//   Color-coded performance: green (above budget) / red (below)
//   Click row → go to deal workspace
//   Filter by: asset class | stage | market | performance tier

// Row 4: 2 charts
//   - Portfolio NOI trend (12-month bar chart, actual vs. budget)
//   - Cash flow forecast (stacked bar: NOI, debt service, distributions)

// Export button: generate Portfolio Report PDF / Excel export
```

---

## 3.2 Benchmark Engine

### Overview
Compares your portfolio asset performance against market benchmarks (cap rate, rent growth, occupancy) by asset class and submarket. Identifies outperformers and underperformers relative to market.

### Benchmark Data Sources
- Internal: historical performance of your own closed deals (builds over time)
- External: manually-entered market data, CoStar data import, CBRE/JLL market reports
- CoStar API (if integrated): live cap rates, rent comps, vacancy by submarket

### Data Models

```typescript
export const marketBenchmarks = pgTable('market_benchmarks', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  assetClass: varchar('asset_class', { length: 100 }),
  market: varchar('market', { length: 100 }),
  submarket: varchar('submarket', { length: 100 }),
  period: varchar('period', { length: 20 }), // 'Q1-2025'
  avgCapRate: numeric('avg_cap_rate', { precision: 5, scale: 2 }),
  avgRentGrowth: numeric('avg_rent_growth', { precision: 5, scale: 2 }),
  avgOccupancy: numeric('avg_occupancy', { precision: 5, scale: 2 }),
  avgPricePerUnit: numeric('avg_price_per_unit', { precision: 10, scale: 2 }),
  source: varchar('source', { length: 100 }), // 'costar' | 'cbre' | 'manual'
  sourceUrl: varchar('source_url', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### Benchmark Comparison UI

```typescript
// components/benchmark/BenchmarkComparisonTable.tsx
// For each asset in portfolio, shows:
// Asset | Market Cap Rate | Your Cap Rate | Delta | Market Occ% | Your Occ% | Delta | Rent Growth | Your RG | Delta
// Color coded: green = outperforming, red = underperforming
// Sort by delta (worst performers first)
// Filter by asset class
// "Upload Market Data" button to import CSV of benchmark data
```

---

## 3.3 Asset Rebalancing Alerts

### Overview
Proactive alert system that flags assets underperforming their plan by configurable thresholds. Generates actionable alerts with context and suggested actions.

### Alert Types

```typescript
type AlertType =
  | 'noi_below_budget'           // NOI trailing budget by X%
  | 'occupancy_below_threshold'  // Occupancy drops below target
  | 'dscr_covenant_risk'         // DSCR approaching loan covenant
  | 'debt_maturity_approaching'  // Loan matures within X months
  | 'capex_overrun'              // CapEx tracking over budget
  | 'rent_roll_concentration'    // Top tenant > X% of income
  | 'lease_expiry_concentration' // X% of leases expire in same period
  | 'irr_tracking_below_target'  // Deal IRR tracking below underwritten
  | 'market_cap_rate_expansion'  // Market cap rates rising (exit risk)
  | 'dd_item_overdue';           // Due diligence item past deadline

interface PortfolioAlert {
  id: number;
  dealId: number;
  dealName: string;
  alertType: AlertType;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  currentValue: number;
  thresholdValue: number;
  suggestedActions: string[];
  createdAt: Date;
  acknowledgedAt: Date | null;
  acknowledgedBy: number | null;
  resolvedAt: Date | null;
}
```

### Alert Configuration

```typescript
// Default thresholds (configurable per org):
const DEFAULT_THRESHOLDS = {
  noi_below_budget: -0.10,           // -10% NOI vs budget
  occupancy_below_threshold: 0.85,   // <85% occupancy
  dscr_covenant_risk: 0.05,          // DSCR within 0.05x of covenant
  debt_maturity_approaching: 12,     // months
  capex_overrun: 0.15,               // +15% over budget
  rent_roll_concentration: 0.40,     // >40% from single tenant
  lease_expiry_concentration: 0.30,  // >30% expiring same year
};
```

---

## 3.4 Vintage Analysis

### Overview
Groups deals by acquisition year (vintage) and compares their performance trajectories. Helps identify whether investment strategy, market timing, or underwriting quality trends over time.

### Data Model

```typescript
interface VintageAnalysis {
  vintage: number; // year
  dealCount: number;
  totalEquityDeployed: number;
  // At time of analysis:
  avgCurrentIRR: number;
  avgEquityMultiple: number;
  avgNOIGrowthActualVsUnderwritten: number; // %
  avgOccupancy: number;
  avgCapRateDeltaVsUnderwritten: number; // exit cap drift
  realizedDeals: number; // deals that have exited
  activeDeals: number;
  realizedAvgIRR: number; // only for exited deals
  topPerformer: { dealName: string; irr: number };
  worstPerformer: { dealName: string; irr: number };
}
```

### UI

```typescript
// Vintage comparison chart: grouped bar chart, one group per vintage year
// Metrics toggle: IRR | Equity Multiple | NOI Growth | Occupancy
// Deal detail drill-down per vintage
// Trend line showing how each vintage performed at same age (e.g., "Year 2 IRR")
```

---

## 3.5 Hold/Sell Optimizer

### Overview
AI-powered hold/sell analysis that, for each active asset, models the current disposition value vs. the NPV of continuing to hold, factoring in market cap rate trends, lease rollover risk, and capital requirements.

### Analysis Engine

```typescript
// lib/holdSell/optimizer.ts

interface HoldSellAnalysis {
  dealId: number;
  analysisDate: Date;
  
  // Sell today scenario
  sellToday: {
    estimatedSalePrice: number;
    basisInProperty: number;
    netProceeds: number;
    taxableGain: number;
    netIRR: number;
    netEquityMultiple: number;
  };
  
  // Hold scenarios
  holdScenarios: {
    holdYears: number; // 1, 2, 3, 5
    projectedSalePrice: number;
    projectedNOI: number;
    additionalCashFlow: number;
    additionalCapEx: number;
    netIRR: number;
    netEquityMultiple: number;
    keyAssumptions: string[];
  }[];
  
  recommendation: 'sell' | 'hold_1yr' | 'hold_2yr' | 'hold_3yr+';
  recommendationRationale: string;
  keyRisksToHolding: string[];
  keyRisksToSelling: string[];
}
```

---

# 4. MARKET INTELLIGENCE & DATA LAYER

---

## 4.1 Live Cap Rate Feed

### Overview
Maintains a database of current market cap rates by asset class and submarket. Data sourced from manual inputs, CSV imports (CoStar exports, broker reports), and optionally live API integration. Cap rates auto-populate underwriting assumptions.

### Data Models

```typescript
export const capRateFeed = pgTable('cap_rate_feed', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  assetClass: varchar('asset_class', { length: 100 }),
  market: varchar('market', { length: 100 }),
  submarket: varchar('submarket', { length: 100 }),
  asOfDate: date('as_of_date'),
  minCapRate: numeric('min_cap_rate', { precision: 5, scale: 2 }),
  maxCapRate: numeric('max_cap_rate', { precision: 5, scale: 2 }),
  avgCapRate: numeric('avg_cap_rate', { precision: 5, scale: 2 }),
  dataPoints: integer('data_points'), // number of transactions in range
  source: varchar('source', { length: 100 }),
  sourceDocument: varchar('source_document', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: integer('created_by').references(() => users.id),
});

// Auto-link: when underwriting a deal, system looks up most recent cap rate
// for matching asset class + market and suggests it as the going-in cap rate
```

### Cap Rate Widget in Financial Model

```typescript
// When user is on Pro Forma / DCF tab and sets "Going-In Cap Rate":
// - System queries cap_rate_feed for matching asset class + deal market
// - Shows tooltip: "Market range: 5.25% – 6.75% (avg 6.0%) as of Q4 2024 | CoStar"
// - Highlights if user's input is outside market range (orange warning)
// - "Use Market Average" quick-fill button
```

---

## 4.2 Rent Comps API Integration

### Overview
Store, manage, and analyze rent comparable data for any deal. Supports manual entry, CSV import, and (optionally) Rentcast/CoStar API integration for automated comps.

### Data Models

```typescript
export const rentComps = pgTable('rent_comps', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  dealId: integer('deal_id').references(() => deals.id).default(null),
  // null = orgwide comp pool
  assetClass: varchar('asset_class', { length: 100 }),
  propertyName: varchar('property_name', { length: 255 }),
  address: varchar('address', { length: 500 }),
  latitude: numeric('latitude', { precision: 9, scale: 6 }),
  longitude: numeric('longitude', { precision: 9, scale: 6 }),
  distanceMiles: numeric('distance_miles', { precision: 5, scale: 2 }),
  unitType: varchar('unit_type', { length: 100 }),
  // studio | 1br | 2br | 3br | retail_sqft | industrial_sqft | slip_size
  rentPerUnit: numeric('rent_per_unit', { precision: 10, scale: 2 }),
  rentPSF: numeric('rent_psf', { precision: 8, scale: 4 }),
  occupancy: numeric('occupancy', { precision: 5, scale: 2 }),
  yearBuilt: integer('year_built'),
  totalUnits: integer('total_units'),
  amenities: jsonb('amenities'),
  recentRenovated: boolean('recent_renovated'),
  source: varchar('source', { length: 100 }),
  dataDate: date('data_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### Rent Comp Analysis Features
- Map view showing subject property + all comps with radius overlay
- Rent range chart (min/max/avg by unit type)
- Premium/discount analysis vs. comp average
- Historical rent trend (if multiple data points)
- AI-generated rent narrative (uses 1.5 Comps Narrator)

---

## 4.3 Demographics Overlay

### Overview
Enriches deal workspace with population, income, employment, and migration data for the trade area. Displayed as a dashboard panel within the deal workspace, sourced from Census API + BLS data.

### Data Points Displayed

```typescript
interface DemographicsData {
  tradeArea: {
    radius: number; // miles (configurable: 1, 3, 5, 10)
    population: number;
    populationGrowth5yr: number; // %
    medianHouseholdIncome: number;
    incomeGrowth5yr: number; // %
    medianAge: number;
    totalHouseholds: number;
    householdGrowth5yr: number; // %
    employmentBase: number; // total jobs
    unemploymentRate: number;
    topEmployers: string[];
    collegeDegreeRate: number; // % with bachelor's or higher
    homeOwnershipRate: number;
    avgHomeSalePrice: number;
    crimeIndex: number; // relative score
  };
  
  // MSA-level data
  msa: {
    name: string;
    population: number;
    populationRank: number; // among all MSAs
    gdpGrowth: number;
    jobGrowth12mo: number;
    netMigration: number; // positive = inflow
  };
}
```

### Data Sources
- US Census Bureau API (free): population, income, households
- BLS API (free): employment, unemployment
- FBI UCR / local crime APIs: crime index
- FRED (Federal Reserve): economic indicators

### Integration

```typescript
// lib/demographics/fetchDemographics.ts
export async function fetchDemographicsForDeal(
  latitude: number,
  longitude: number,
  radiusMiles: number = 3
): Promise<DemographicsData> {
  // 1. Get Census tract FIPS codes for the radius
  // 2. Query Census API for population, income, households
  // 3. Query BLS for employment data
  // 4. Compute growth rates from prior period data
  // 5. Cache results (demographics don't change often — cache 30 days)
}
```

---

## 4.4 Zoning + Entitlement Tracker

### Overview
Tracks the zoning classification, current use, permitted uses, and entitlement status for each deal property. Manages approval milestones, authority contacts, and document storage for entitlement-heavy deals.

### Data Models

```typescript
export const propertyZoning = pgTable('property_zoning', {
  id: serial('id').primaryKey(),
  dealId: integer('deal_id').references(() => deals.id),
  currentZoningCode: varchar('current_zoning_code', { length: 100 }),
  currentZoningDescription: varchar('current_zoning_description', { length: 500 }),
  currentUse: varchar('current_use', { length: 255 }),
  permittedUses: jsonb('permitted_uses'), // array of strings
  conditionalUses: jsonb('conditional_uses'),
  maxFAR: numeric('max_far', { precision: 5, scale: 2 }),
  maxHeight: integer('max_height'), // feet
  minLotSize: integer('min_lot_size'), // sqft
  parkingRequirements: text('parking_requirements'),
  municipality: varchar('municipality', { length: 255 }),
  county: varchar('county', { length: 255 }),
  planningDepartmentContact: jsonb('planning_department_contact'),
  zoningMapUrl: varchar('zoning_map_url', { length: 500 }),
  lastVerifiedAt: date('last_verified_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const entitlements = pgTable('entitlements', {
  id: serial('id').primaryKey(),
  dealId: integer('deal_id').references(() => deals.id),
  entitlementType: varchar('entitlement_type', { length: 100 }),
  // rezoning | variance | special_use_permit | conditional_use | site_plan_approval
  // environmental_review | building_permit | certificate_of_occupancy
  description: text('description'),
  status: varchar('status', { length: 50 }),
  // not_started | in_process | approved | denied | appealing | expired
  applicationDate: date('application_date'),
  expectedDecisionDate: date('expected_decision_date'),
  actualDecisionDate: date('actual_decision_date'),
  approvedBy: varchar('approved_by', { length: 255 }),
  conditions: text('conditions'),
  documentIds: jsonb('document_ids'), // linked docs
  estimatedCost: numeric('estimated_cost', { precision: 12, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### Entitlement Timeline UI

```typescript
// Visual Gantt-style timeline showing all entitlements for a deal
// Color coded by status
// Critical path highlighting (which approvals are blocking others)
// Alert when expected decision date is within 2 weeks
// "Risk to Close" flag if entitlements are required before acquisition
```

---

## 4.5 DockTalk 2.0 — AI-Curated News Intelligence

### Overview
Upgrade your existing DockTalk news module with AI curation that maps news to specific portfolio assets and market watchlists. Delivers deal-relevant news (not just marina news) based on each deal's submarket, asset class, tenant names, and key counterparties.

### Enhanced Architecture

```typescript
// lib/dockTalk/newsIntelligence.ts

interface NewsArticle {
  id: string;
  headline: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: Date;
  // AI-assigned metadata:
  relevantDealIds: number[];     // which deals this is relevant to
  relevantContactIds: number[];  // which CRM contacts are mentioned
  tags: string[];                // asset_class, market, tenant, lender, etc.
  sentiment: 'positive' | 'neutral' | 'negative';
  impactScore: number;           // 0-10, AI-assessed relevance
  impactSummary: string;         // 1 sentence: "This may affect your cap rate in Tampa STR market"
  actionRequired: boolean;
  suggestedAction: string | null;
}

// News relevance mapping (runs on each new article via background job):
// 1. Extract entities from article: companies, people, locations, asset classes
// 2. Match entities to deal watchlist:
//    - Deal markets (city/submarket names in deal records)
//    - Asset classes (article about marina regulations → marina deals flagged)
//    - Tenant names (article about Home Depot → retail deals with HD flagged)
//    - Lender names (article about regional bank failures → any deals with that lender)
//    - Key CRM contacts' companies
// 3. Score relevance 0-10
// 4. Generate 1-sentence "Why this matters to you" impact note
// 5. Store mappings in deal_news_relevance table
```

### Feed Personalization

```typescript
// Each user sees a personalized feed based on:
// - Their assigned deals
// - Their market watchlist (configurable)
// - Asset classes in their portfolio
// - Their CRM contacts

// Feed UI:
// - Top section: "Action Required" items (high impact, flagged for attention)
// - "Your Portfolio" section: news mapped to specific deals (click → opens deal context)
// - "Market Watch" section: broader market/economic news
// - "Industry" section: CRE industry news
// 
// Each article card shows:
// - Headline + 2-sentence summary
// - "Relevant to: [Deal Name]" tag
// - Impact score (fire emoji scale: 🔥🔥🔥 = high)
// - "Why this matters" AI one-liner
// - Save, share, dismiss buttons
// - Mark as "Action Required" to push to deal workspace activity log
```

---

# 5. OPERATIONS & ASSET MANAGEMENT

---

## 5.1 Work Order / Maintenance Module

### Overview
Full-cycle work order management from tenant/staff request submission through vendor assignment, completion, and cost tracking. Tied to the deal workspace so costs roll up to the financial model.

### Data Models

```typescript
export const workOrders = pgTable('work_orders', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  dealId: integer('deal_id').references(() => deals.id),
  workOrderNumber: varchar('work_order_number', { length: 50 }),
  // Auto-generated: WO-2025-0001
  title: varchar('title', { length: 255 }),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  // plumbing | electrical | hvac | structural | landscaping | cleaning
  // pest_control | security | general_maintenance | capital_improvement
  priority: varchar('priority', { length: 20 }),
  // critical | high | medium | low | scheduled
  status: varchar('status', { length: 30 }),
  // submitted | assigned | in_progress | pending_parts | on_hold
  // completed | invoiced | closed | cancelled
  requestedBy: varchar('requested_by', { length: 255 }),
  // tenant name, staff name, or automated source
  requestSource: varchar('request_source', { length: 50 }),
  // tenant | staff | inspection | preventive | regulatory
  unitOrArea: varchar('unit_or_area', { length: 100 }),
  // Unit 2B, Parking Lot, Dock A, HVAC Room, etc.
  vendorId: integer('vendor_id').references(() => vendors.id),
  assignedTo: integer('assigned_to').references(() => users.id),
  estimatedCost: numeric('estimated_cost', { precision: 10, scale: 2 }),
  actualCost: numeric('actual_cost', { precision: 10, scale: 2 }),
  laborHours: numeric('labor_hours', { precision: 6, scale: 2 }),
  scheduledDate: date('scheduled_date'),
  completedDate: date('completed_date'),
  invoiceNumber: varchar('invoice_number', { length: 100 }),
  invoiceDocId: integer('invoice_doc_id'),
  warrantyExpiry: date('warranty_expiry'),
  isBillableToTenant: boolean('is_billable_to_tenant').default(false),
  tenantNotified: boolean('tenant_notified').default(false),
  photos: jsonb('photos'), // array of photo URLs
  notes: text('notes'),
  capExCategory: varchar('cap_ex_category', { length: 100 }),
  // null if OpEx; otherwise capex bucket
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const workOrderUpdates = pgTable('work_order_updates', {
  id: serial('id').primaryKey(),
  workOrderId: integer('work_order_id').references(() => workOrders.id),
  userId: integer('user_id').references(() => users.id),
  updateType: varchar('update_type', { length: 50 }),
  // status_change | note | cost_update | photo_upload | vendor_assigned
  previousStatus: varchar('previous_status', { length: 30 }),
  newStatus: varchar('new_status', { length: 30 }),
  note: text('note'),
  photoUrl: varchar('photo_url', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### API Endpoints

```typescript
// POST /api/work-orders — create WO
// GET /api/work-orders/:dealId — list WOs for asset (filterable by status, priority, date)
// GET /api/work-orders/org/open — all open WOs across portfolio
// PUT /api/work-orders/:id — update WO
// PUT /api/work-orders/:id/status — update status
// POST /api/work-orders/:id/updates — add update/note
// POST /api/work-orders/:id/photos — upload photos
// GET /api/work-orders/:dealId/cost-summary — cost rollup for budget reporting
// GET /api/work-orders/vendor/:vendorId — WO history for vendor
```

### Frontend Components

```typescript
// pages/operations/WorkOrders.tsx

// View Modes:
// 1. Kanban board: columns = Submitted | Assigned | In Progress | Completed
// 2. List view: sortable/filterable table
// 3. Calendar view: scheduled work orders on calendar

// Quick-create button: floating "+" with category presets
// Work Order Detail Drawer:
//   - Status stepper at top
//   - Description + photos (upload/view)
//   - Vendor assignment with vendor contact info
//   - Cost tracking: estimated vs. actual
//   - Update timeline (chat-like activity log)
//   - "Mark Complete" with required photo upload option

// Asset-level summary widgets (for each deal workspace):
//   - Open WOs count by priority (red/orange/yellow badges)
//   - Avg WO completion time (days)
//   - Cost YTD vs. maintenance budget line

// Portfolio-level dashboard (aggregated):
//   - All open WOs across all assets
//   - Cost by asset, category, month
//   - Overdue WOs (past scheduled date)
//   - Vendor utilization and cost breakdown
```

---

## 5.2 Vendor Management

### Overview
Maintain a vendor database with trade categories, contact info, insurance certificates, preferred status, bid history, and performance ratings.

### Data Models

```typescript
export const vendors = pgTable('vendors', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  companyName: varchar('company_name', { length: 255 }),
  contactName: varchar('contact_name', { length: 255 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  trades: jsonb('trades'),
  // ['plumbing', 'hvac', 'electrical', 'general_contractor', ...]
  serviceArea: jsonb('service_area'), // list of zip codes or markets
  licenseNumber: varchar('license_number', { length: 100 }),
  licenseExpiry: date('license_expiry'),
  insuranceCertUrl: varchar('insurance_cert_url', { length: 500 }),
  insuranceExpiry: date('insurance_expiry'),
  insuranceCoverageAmount: numeric('insurance_coverage_amount', { precision: 12, scale: 2 }),
  isPreferred: boolean('is_preferred').default(false),
  isApproved: boolean('is_approved').default(false),
  avgResponseTimeHours: numeric('avg_response_time_hours', { precision: 5, scale: 1 }),
  avgRating: numeric('avg_rating', { precision: 3, scale: 2 }), // 1-5
  totalWorkOrdersCompleted: integer('total_work_orders_completed').default(0),
  totalSpendYTD: numeric('total_spend_ytd', { precision: 12, scale: 2 }),
  totalSpendAllTime: numeric('total_spend_all_time', { precision: 12, scale: 2 }),
  notes: text('notes'),
  w9DocUrl: varchar('w9_doc_url', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const vendorRatings = pgTable('vendor_ratings', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').references(() => vendors.id),
  workOrderId: integer('work_order_id').references(() => workOrders.id),
  ratedBy: integer('rated_by').references(() => users.id),
  rating: integer('rating'), // 1-5
  qualityScore: integer('quality_score'), // 1-5
  responseTimeScore: integer('response_time_score'), // 1-5
  priceScore: integer('price_score'), // 1-5
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### Insurance Certificate Expiry Alerts

```typescript
// Background job: runs weekly
// Checks all vendors with insurance expiry within 30 days
// Sends email alert to org admin
// Flags vendor as "Insurance Expiring Soon" in UI
// Auto-blocks new WO assignment if insurance is expired
```

---

## 5.3 CapEx Tracker

### Overview
Tracks capital expenditure projects separately from operational maintenance. Links to the pro forma CapEx line item budget, tracks actual spend, and provides budget variance reporting.

### Data Models

```typescript
export const capexProjects = pgTable('capex_projects', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  dealId: integer('deal_id').references(() => deals.id),
  projectName: varchar('project_name', { length: 255 }),
  category: varchar('category', { length: 100 }),
  // roof | hvac | parking | electrical | plumbing | interior_renovation
  // exterior | amenities | technology | environmental | new_construction
  description: text('description'),
  status: varchar('status', { length: 50 }),
  // planning | bidding | approved | in_progress | completed | on_hold | cancelled
  budgetedAmount: numeric('budgeted_amount', { precision: 12, scale: 2 }),
  // Pulled from pro forma CapEx budget line
  contractedAmount: numeric('contracted_amount', { precision: 12, scale: 2 }),
  actualSpendToDate: numeric('actual_spend_to_date', { precision: 12, scale: 2 }),
  projectedTotalCost: numeric('projected_total_cost', { precision: 12, scale: 2 }),
  startDate: date('start_date'),
  projectedCompletionDate: date('projected_completion_date'),
  actualCompletionDate: date('actual_completion_date'),
  primaryVendorId: integer('primary_vendor_id').references(() => vendors.id),
  gcContractDocId: integer('gc_contract_doc_id'),
  permitRequired: boolean('permit_required').default(false),
  permitNumber: varchar('permit_number', { length: 100 }),
  permitApprovedDate: date('permit_approved_date'),
  valueAddImpact: text('value_add_impact'),
  // Narrative: "Expected to reduce vacancy by X%, increase rents by $Y"
  createdAt: timestamp('created_at').defaultNow(),
});

export const capexLineItems = pgTable('capex_line_items', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => capexProjects.id),
  description: varchar('description', { length: 255 }),
  quantity: numeric('quantity', { precision: 10, scale: 2 }),
  unit: varchar('unit', { length: 50 }),
  unitCost: numeric('unit_cost', { precision: 10, scale: 2 }),
  budgetedTotal: numeric('budgeted_total', { precision: 12, scale: 2 }),
  actualTotal: numeric('actual_total', { precision: 12, scale: 2 }),
  vendorId: integer('vendor_id').references(() => vendors.id),
  invoiceNumber: varchar('invoice_number', { length: 100 }),
  invoiceDate: date('invoice_date'),
  status: varchar('status', { length: 30 }),
});
```

### CapEx Dashboard

```typescript
// Per-deal CapEx dashboard shows:
// - Budget summary: total budgeted vs. contracted vs. actual vs. projected
// - Budget variance % (color coded)
// - Project status cards (one per project)
// - Spend by category (pie chart)
// - Cash flow schedule (monthly projected spend bar chart)
// - Completion timeline (Gantt-style)

// Portfolio CapEx rollup:
// - All active CapEx projects across all assets
// - Total CapEx budget vs. spend
// - Upcoming capital requirements (next 90 days)
// - Projects at risk (over budget or behind schedule)
```

---

## 5.4 Inspection Workflow

### Overview
Manages scheduled and ad-hoc property inspections with checklist templates, photo documentation, finding categorization, and punch list generation.

### Data Models

```typescript
export const inspectionTemplates = pgTable('inspection_templates', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  name: varchar('name', { length: 255 }),
  assetClass: varchar('asset_class', { length: 100 }),
  // Different templates for marina, multifamily, retail, industrial, etc.
  inspectionType: varchar('inspection_type', { length: 100 }),
  // acquisition | quarterly | annual | pre_listing | post_storm | lender
  sections: jsonb('sections'),
  // Array of: { sectionName, items: [{ id, description, type: 'pass_fail'|'rating'|'note'|'photo' }] }
  createdAt: timestamp('created_at').defaultNow(),
});

export const inspections = pgTable('inspections', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  dealId: integer('deal_id').references(() => deals.id),
  templateId: integer('template_id').references(() => inspectionTemplates.id),
  inspectionType: varchar('inspection_type', { length: 100 }),
  status: varchar('status', { length: 30 }),
  // scheduled | in_progress | completed | report_generated
  scheduledDate: date('scheduled_date'),
  conductedDate: date('conducted_date'),
  conductedBy: integer('conducted_by').references(() => users.id),
  externalInspectorName: varchar('external_inspector_name', { length: 255 }),
  findings: jsonb('findings'), // responses to template items
  overallRating: varchar('overall_rating', { length: 20 }),
  // excellent | good | fair | poor | critical
  summaryNotes: text('summary_notes'),
  punchListGenerated: boolean('punch_list_generated').default(false),
  reportDocId: integer('report_doc_id'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### Standard Inspection Templates to Pre-Seed

```typescript
// templates/inspectionTemplates.ts
// Pre-built templates for:
// 1. Multifamily Acquisition Inspection (150+ items)
// 2. Marina Acquisition Inspection (100+ items — docks, slips, fuel systems, amenities)
// 3. Retail/Commercial Acquisition Inspection (120+ items)
// 4. Industrial Acquisition Inspection (100+ items)
// 5. Quarterly Operations Walk (50 items — abbreviated for ongoing PM)
// 6. Post-Storm / Casualty Inspection (80 items)
// 7. Pre-Listing Inspection (100 items — deferred maintenance, curb appeal)

// Each inspection item has:
// - Category (Roof, HVAC, Electrical, Plumbing, Foundation, etc.)
// - Item description
// - Response type (Pass/Fail, 1-5 Rating, Free Text, Photo Required)
// - Severity weight (for calculating overall score)
// - Typical repair cost range
```

### Auto-Generate Work Orders from Findings

```typescript
// After inspection completion:
// 1. All "Fail" items → prompt to create work orders
// 2. "Critical" findings → auto-create high-priority work orders
// 3. Photo evidence linked to work order
// 4. Inspection report PDF generated automatically
// 5. Punch list PDF with all open items, priorities, estimated costs
```

---

## 5.5 Utility & OpEx Benchmarking

### Overview
Compares your asset's actual operating expenses against industry benchmarks by asset class. Identifies over/under spending and flags anomalies for investigation.

### OpEx Categories & Benchmarks

```typescript
interface OpExBenchmark {
  assetClass: string;
  market: string;
  period: string;
  perUnitBenchmarks: {
    totalOpEx: { low: number; avg: number; high: number };
    management: { low: number; avg: number; high: number }; // % of EGI
    maintenance: { low: number; avg: number; high: number };
    insurance: { low: number; avg: number; high: number };
    realEstateTax: { low: number; avg: number; high: number };
    utilities: { low: number; avg: number; high: number };
    capitalReserves: { low: number; avg: number; high: number };
    payroll: { low: number; avg: number; high: number };
  };
}

// Benchmark data seeded from:
// - BOMA Experience Exchange Report
// - NAA Survey of Operating Income & Expenses
// - NMHC operating expense data
// - Internal: your own portfolio historical data (builds over time)
```

### Benchmark Comparison UI

```typescript
// Per-deal OpEx Benchmarking panel:
// Table with columns: Category | Your $/Unit/Year | Market Avg | Market Low | Market High | Variance
// Visual bar for each row showing your position within market range
// Color: green (below avg = efficient) / yellow (above avg) / red (above high = investigate)
// "Drill down" to monthly trend for any category
// "Why high?" AI analysis button → AI looks at WO history, vendor costs, and suggests reasons
```

---

# 6. CAPITAL MARKETS TOOLS

---

## 6.1 Lender Matching Engine

### Overview
Given a deal's parameters (asset class, loan amount, LTV, DSCR, market, borrower profile), rank and match against a curated lender database to identify the best financing options.

### Data Models

```typescript
export const lenders = pgTable('lenders', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id).default(null),
  // null = platform-level lender database; orgId = org-specific lender
  lenderName: varchar('lender_name', { length: 255 }),
  lenderType: varchar('lender_type', { length: 100 }),
  // bank | credit_union | life_company | cmbs | bridge_lender | debt_fund
  // agency_fannie | agency_freddie | sba | private | hard_money
  contactName: varchar('contact_name', { length: 255 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  linkedInUrl: varchar('linkedin_url', { length: 500 }),
  
  // Lending appetite
  preferredAssetClasses: jsonb('preferred_asset_classes'),
  preferredMarkets: jsonb('preferred_markets'),
  minLoanAmount: numeric('min_loan_amount', { precision: 15, scale: 2 }),
  maxLoanAmount: numeric('max_loan_amount', { precision: 15, scale: 2 }),
  typicalLTVMin: numeric('typical_ltv_min', { precision: 5, scale: 2 }),
  typicalLTVMax: numeric('typical_ltv_max', { precision: 5, scale: 2 }),
  typicalDSCRMin: numeric('typical_dscr_min', { precision: 4, scale: 2 }),
  typicalTermsYears: jsonb('typical_terms_years'), // [3, 5, 7, 10]
  typicalAmortizationYears: jsonb('typical_amortization_years'),
  recourseRequirement: varchar('recourse_requirement', { length: 50 }),
  // full_recourse | partial | non_recourse | springing_recourse
  prepaymentPenalty: varchar('prepayment_penalty', { length: 100 }),
  
  // Current rates (manually updated or via API)
  currentRateIndex: varchar('current_rate_index', { length: 50 }),
  // sofr | treasury_5yr | prime | fixed
  currentSpreadMin: numeric('current_spread_min', { precision: 4, scale: 2 }),
  currentSpreadMax: numeric('current_spread_max', { precision: 4, scale: 2 }),
  ratesAsOf: date('rates_as_of'),
  
  notes: text('notes'),
  isActive: boolean('is_active').default(true),
  lastContactDate: date('last_contact_date'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const lenderDeals = pgTable('lender_deals', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  lenderId: integer('lender_id').references(() => lenders.id),
  dealId: integer('deal_id').references(() => deals.id),
  status: varchar('status', { length: 50 }),
  // prospect | contacted | loi_received | term_sheet | in_underwriting | approved | closed | declined
  contactDate: date('contact_date'),
  loiDate: date('loi_date'),
  termSheetDate: date('term_sheet_date'),
  closedDate: date('closed_date'),
  loanAmount: numeric('loan_amount', { precision: 15, scale: 2 }),
  rate: numeric('rate', { precision: 6, scale: 4 }),
  ltv: numeric('ltv', { precision: 5, scale: 2 }),
  term: integer('term'),
  notes: text('notes'),
});
```

### Matching Algorithm

```typescript
// lib/capitalMarkets/lenderMatcher.ts

export function matchLenders(
  dealParams: DealFinancingParams,
  lenders: Lender[]
): RankedLender[] {
  return lenders
    .filter(l => l.isActive)
    .map(lender => {
      let score = 0;
      const matchFactors: string[] = [];
      const mismatches: string[] = [];
      
      // Asset class match (30 points)
      if (lender.preferredAssetClasses?.includes(dealParams.assetClass)) {
        score += 30;
        matchFactors.push(`Lends on ${dealParams.assetClass}`);
      } else {
        mismatches.push('Asset class not in preferred set');
      }
      
      // Loan amount range (20 points)
      if (dealParams.loanAmount >= lender.minLoanAmount &&
          dealParams.loanAmount <= lender.maxLoanAmount) {
        score += 20;
        matchFactors.push('Loan size in range');
      }
      
      // LTV match (20 points)
      if (dealParams.ltv <= lender.typicalLTVMax) {
        score += 20;
        matchFactors.push(`LTV ${dealParams.ltv}% within ${lender.typicalLTVMax}% max`);
      }
      
      // DSCR match (20 points)
      if (dealParams.dscr >= lender.typicalDSCRMin) {
        score += 20;
        matchFactors.push(`DSCR ${dealParams.dscr}x above ${lender.typicalDSCRMin}x min`);
      }
      
      // Market match (10 points)
      if (lender.preferredMarkets?.some(m => dealParams.market.includes(m))) {
        score += 10;
        matchFactors.push('Active in target market');
      }
      
      const estimatedRate = lender.currentRateIndex === 'sofr'
        ? currentSOFR + ((lender.currentSpreadMin + lender.currentSpreadMax) / 2)
        : estimateRate(lender, dealParams);
      
      return {
        lender,
        matchScore: score,
        matchFactors,
        mismatches,
        estimatedRate,
        estimatedPayment: calculateMonthlyPayment(dealParams.loanAmount, estimatedRate, lender.typicalTermsYears[0]),
      };
    })
    .filter(r => r.matchScore > 30) // minimum viability threshold
    .sort((a, b) => b.matchScore - a.matchScore);
}
```

### Lender Matching UI

```typescript
// Deal workspace → Capital Stack tab → "Find Lenders" button
// 
// Input panel (auto-populated from deal financial model):
//   Loan Amount | LTV% | DSCR | Asset Class | Market | Desired Term
//   
// Results table (ranked by match score):
//   Lender | Type | Match Score | Est. Rate | LTV Max | DSCR Min | Contact | Status
// 
// Click lender → side panel:
//   Full lender profile
//   Lending history with your org (if any)
//   "Log Contact" button
//   "Create Lender Quote" button (populates Term Sheet Comparator)
//
// "Add to Deal" button → creates lenderDeal record and adds to deal's lending tracker
```

---

## 6.2 Term Sheet Comparator

### Overview
Side-by-side comparison of multiple lender term sheets with IRR impact analysis for each option. Eliminates the manual Excel work of comparing financing alternatives.

### Data Models

```typescript
export const termSheets = pgTable('term_sheets', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  dealId: integer('deal_id').references(() => deals.id),
  lenderId: integer('lender_id').references(() => lenders.id),
  lenderName: varchar('lender_name', { length: 255 }),
  // Stored separately in case not in lender DB
  dateReceived: date('date_received'),
  expirationDate: date('expiration_date'),
  status: varchar('status', { length: 30 }),
  // received | under_review | selected | rejected | expired
  
  // Loan Terms
  loanAmount: numeric('loan_amount', { precision: 15, scale: 2 }),
  ltv: numeric('ltv', { precision: 5, scale: 2 }),
  rateType: varchar('rate_type', { length: 20 }), // fixed | floating | hybrid
  rate: numeric('rate', { precision: 6, scale: 4 }),
  rateIndex: varchar('rate_index', { length: 50 }),
  spread: numeric('spread', { precision: 5, scale: 3 }),
  floorRate: numeric('floor_rate', { precision: 6, scale: 4 }),
  capRate: numeric('cap_rate', { precision: 6, scale: 4 }), // rate cap, not cap rate
  
  amortizationYears: integer('amortization_years'),
  ioMonths: integer('io_months'), // interest-only period
  termYears: integer('term_years'),
  
  originationFee: numeric('origination_fee', { precision: 5, scale: 3 }), // % of loan
  exitFee: numeric('exit_fee', { precision: 5, scale: 3 }),
  prepaymentPenalty: varchar('prepayment_penalty', { length: 255 }),
  prepaymentSchedule: jsonb('prepayment_schedule'),
  // [{ year: 1, penalty: 0.05 }, { year: 2, penalty: 0.04 }, ...]
  
  recourse: varchar('recourse', { length: 50 }),
  guaranteeRequirements: text('guarantee_requirements'),
  reserveRequirements: jsonb('reserve_requirements'),
  financialCovenants: jsonb('financial_covenants'),
  // [{ metric: 'dscr', threshold: 1.20, testFrequency: 'quarterly' }]
  
  notes: text('notes'),
  termSheetDocId: integer('term_sheet_doc_id'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### Comparison Engine

```typescript
// For each term sheet, calculate:
// - Monthly debt service
// - Annual debt service
// - Total interest paid over term
// - All-in effective rate (including fees amortized)
// - Levered IRR impact (vs. deal baseline)
// - Cash-on-cash return impact
// - Break-even occupancy
// - Refi proceeds at end of hold (based on projected NOI)

// Comparison table: one column per term sheet + "Best" column highlighting winners
// Color-coded: green = best on that metric, red = worst
// "Select" button marks one as chosen → updates deal's capital stack
```

---

## 6.3 Debt Maturity Dashboard

### Overview
Portfolio-wide view of all loan maturities, refi risk, and upcoming debt actions. Prevents maturity surprises across a large portfolio.

### Data Models

```typescript
export const dealDebt = pgTable('deal_debt', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  dealId: integer('deal_id').references(() => deals.id),
  lenderId: integer('lender_id').references(() => lenders.id),
  debtTranche: varchar('debt_tranche', { length: 50 }),
  // senior | mezz | preferred_equity | construction
  loanAmount: numeric('loan_amount', { precision: 15, scale: 2 }),
  currentBalance: numeric('current_balance', { precision: 15, scale: 2 }),
  rate: numeric('rate', { precision: 6, scale: 4 }),
  rateType: varchar('rate_type', { length: 20 }),
  originationDate: date('origination_date'),
  maturityDate: date('maturity_date'),
  extensionOptions: jsonb('extension_options'),
  // [{ months: 12, extensionFee: 0.005, conditions: 'DSCR > 1.20' }]
  annualDebtService: numeric('annual_debt_service', { precision: 12, scale: 2 }),
  dscr: numeric('dscr', { precision: 5, scale: 3 }),
  covenants: jsonb('covenants'),
  refinanceRisk: varchar('refinance_risk', { length: 20 }),
  // green | yellow | red (auto-calculated based on maturity proximity and market conditions)
});
```

### Debt Maturity Wall Chart

```typescript
// Visual "maturity wall" chart: X-axis = time (monthly), Y-axis = loan balance
// Stacked bars showing all loans maturing in each period
// Color coded by refi risk (green/yellow/red)
// Hover: loan details, lender, deal name
// Upcoming maturities table: loans maturing in next 24 months
// Alert badges: "5 loans maturing in next 12 months | $47M"
// Extension option tracker: shows extension eligibility per loan
```

---

## 6.4 Preferred Equity / Mezz Tracker

### Overview
Manages the full capital stack for all deals with dedicated tracking of preferred equity and mezzanine positions, including accrued returns, payoff calculations, and waterfall priority.

### Data Model
(Extends dealDebt table above with mezz-specific fields)

```typescript
export const mezzPositions = pgTable('mezz_positions', {
  id: serial('id').primaryKey(),
  dealDebtId: integer('deal_debt_id').references(() => dealDebt.id),
  mezzType: varchar('mezz_type', { length: 50 }),
  // preferred_equity | mezzanine_debt | b_note | subordinate_debt
  preferredReturnRate: numeric('preferred_return_rate', { precision: 5, scale: 2 }),
  accruedPreferredReturn: numeric('accrued_preferred_return', { precision: 12, scale: 2 }),
  paidPreferredReturnYTD: numeric('paid_preferred_return_ytd', { precision: 12, scale: 2 }),
  isCompounding: boolean('is_compounding').default(false),
  participationRights: text('participation_rights'),
  // Description of any upside participation
  controlRights: text('control_rights'),
  // Conditions triggering mezz lender control (defaults, cash flow sweeps)
  payoffAmount: numeric('payoff_amount', { precision: 12, scale: 2 }),
  // Current payoff (principal + accrued)
  payoffAsOf: date('payoff_as_of'),
  convertible: boolean('convertible').default(false),
  conversionTerms: text('conversion_terms'),
});
```

---

# 7. CRM & RELATIONSHIP INTELLIGENCE

---

## 7.1 Relationship Graph

### Overview
Visual network graph showing the web of relationships between your contacts: who referred who, who's connected to which deal, who knows who, broker → deal → lender relationships.

### Data Models

```typescript
export const contactRelationships = pgTable('contact_relationships', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  fromContactId: integer('from_contact_id').references(() => contacts.id),
  toContactId: integer('to_contact_id').references(() => contacts.id),
  relationshipType: varchar('relationship_type', { length: 100 }),
  // introduced_by | referred_deal | co_investor | lender_to_gp | broker_to_gp
  // attorney_for | property_manager_for | partner | competitor | former_colleague
  strength: varchar('strength', { length: 20 }),
  // strong | medium | weak
  dealId: integer('deal_id').references(() => deals.id).default(null),
  // if relationship was formed through a specific deal
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### Graph Visualization

```typescript
// Use D3.js force-directed graph or React Flow
// 
// Node types (different colors/shapes):
//   - GP team members (blue square)
//   - Brokers (orange circle)
//   - Lenders (green hexagon)
//   - Investors/LPs (purple diamond)
//   - Attorneys (grey circle)
//   - Sellers/Buyers (teal circle)
//   - Property Managers (brown circle)
//
// Edge types (different colors/weights):
//   - Thin grey: weak connection
//   - Medium blue: medium connection
//   - Thick gold: strong connection
//   - Dashed red: competitor
//
// Interactions:
//   - Click node → contact detail card pops up
//   - Hover edge → shows relationship type and any connected deals
//   - Filter by: relationship type | deal | contact type | strength
//   - "Add Connection" button
//   - Search contacts (highlights matching node + dims others)
//   - Center on contact (makes selected contact the hub)
//
// Deal view filter: "Show relationships for this deal" → filters graph to only show people connected to current deal
```

---

## 7.2 Deal Sourcing Score

### Overview
Analyzes your historical deal flow to score which brokers, contacts, and channels are sending your highest-quality deal opportunities. Uses closed deal performance to weight scores.

### Scoring Metrics

```typescript
interface ContactSourcingScore {
  contactId: number;
  contactName: string;
  // Volume metrics
  totalDealsSourced: number;
  dealsInLast12Months: number;
  dealsInPipeline: number;
  // Quality metrics
  closedDeals: number;
  closedRate: number; // closed / total sourced
  avgIRRClosed: number; // avg IRR of deals they sourced that closed
  avgEquityMultipleClosed: number;
  // Relationship health
  lastContactDate: Date;
  daysSinceContact: number;
  totalCommunications: number;
  // Composite score
  sourcingScore: number; // 0-100
  scoreTier: 'platinum' | 'gold' | 'silver' | 'bronze';
  // Recommendations
  contactFrequencyRecommendation: string; // "Contact weekly"
  nextActionSuggestion: string; // "Follow up on off-market pocket listing mentioned 3 weeks ago"
}
```

### Broker Scorecard

```typescript
// UI: Broker leaderboard table
// Sortable by: score | deals sourced | closed rate | avg IRR
// Time filter: last 12 months | last 24 months | all time
// "Call This Week" list: top 10 brokers you haven't spoken to recently
// Deal attribution: every deal in pipeline shows which contact sourced it
```

---

## 7.3 Follow-Up AI

### Overview
AI-assisted outreach drafting. Based on CRM contact history, current deal stage, and market events, drafts personalized follow-up messages for each contact.

### Follow-Up Types Supported
1. **Deal check-in** — asking about a specific deal in progress
2. **Market update** — sharing relevant market news with a contact
3. **New deal inquiry** — reaching out to broker about deal suitability
4. **Post-deal thank you** — close-of-transaction relationship maintenance
5. **Annual catch-up** — relationship maintenance for dormant contacts
6. **Capital call notice accompaniment** — GP to LP communication
7. **DD request follow-up** — prompting vendor/attorney on pending items
8. **Lender check-in** — updating lender on deal progress

### Prompt Logic

```typescript
// lib/followUpAI/draftFollowUp.ts
export async function draftFollowUp(
  contact: Contact,
  followUpType: FollowUpType,
  context: FollowUpContext
): Promise<string> {
  const lastActivity = await getLastActivityWithContact(contact.id);
  const sharedDeals = await getSharedDeals(contact.id);
  const recentNews = await getNewsForContact(contact.id);
  
  const prompt = `Draft a ${followUpType} message to ${contact.firstName} ${contact.lastName} 
  (${contact.title} at ${contact.company}).
  
  Last contact: ${lastActivity.date} — ${lastActivity.summary}
  Shared deals: ${sharedDeals.map(d => d.name).join(', ')}
  Recent relevant news: ${recentNews[0]?.headline || 'none'}
  Context: ${context.additionalContext}
  
  Tone: Professional but warm. Sound like a fellow industry professional, not a salesperson.
  Length: 3-5 sentences for email, 2-3 for text.
  Include a specific reference to our prior interaction or shared deal.
  End with a clear, low-friction ask.
  Output ONLY the message body, no subject line unless requested.`;
  
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });
  
  return response.content[0].text;
}
```

### UI Component

```typescript
// In CRM contact page: "Draft Follow-Up" button
// Step 1: Select follow-up type (icon chips)
// Step 2: Add any context (optional text field + deal selector)
// Step 3: AI generates draft → shown in editable text area
// Actions: Copy | Send via Email | Send via SMS | Save as Draft | Regenerate
// Track that follow-up was sent → logs to contact activity
```

---

## 7.4 Contact Intelligence Feed

### Overview
Automatically surfaces news mentions of your CRM contacts and their companies, delivered as a daily digest inside each contact record and as a portfolio-wide "Relationship News" feed.

### Implementation

```typescript
// lib/contactIntelligence/newsMonitor.ts

// Daily background job:
// 1. For each org contact, search news for:
//    - Contact's full name
//    - Contact's company name
//    - Deals associated with contact
// 2. Filter for relevance (not just name matches — must be CRE/business context)
// 3. Store in contact_news_mentions table
// 4. Rate: "High" (direct mention) | "Medium" (company mention) | "Low" (tangential)

export const contactNewsMentions = pgTable('contact_news_mentions', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  contactId: integer('contact_id').references(() => contacts.id),
  articleUrl: varchar('article_url', { length: 500 }),
  headline: varchar('headline', { length: 500 }),
  snippet: text('snippet'),
  source: varchar('source', { length: 100 }),
  publishedAt: timestamp('published_at'),
  relevanceScore: integer('relevance_score'), // 1-10
  mentionType: varchar('mention_type', { length: 30 }), // direct | company | deal
  actionableNote: varchar('actionable_note', { length: 255 }),
  // AI-generated: "Good reason to reach out — congrats on the promotion"
  createdAt: timestamp('created_at').defaultNow(),
});

// In contact detail page: "Intelligence" tab showing their news mentions
// "Send Congrats" quick action → opens Follow-Up AI pre-filled with the news hook
```

---

## 7.5 Meeting Prep Brief

### Overview
One-click AI-generated meeting prep document for any upcoming call or meeting. Aggregates contact history, shared deals, recent news mentions, and talking points.

### Brief Structure

```typescript
interface MeetingPrepBrief {
  contactId: number;
  contactName: string;
  meetingDate: Date;
  
  contactSummary: {
    title: string;
    company: string;
    tenure: string;
    expertise: string[];
    connectionHistory: string; // "Known for 2 years, met at RealCon 2023"
  };
  
  dealHistory: {
    sharedDeals: string[];
    dealsInDiscussion: string[];
    lastDealInteraction: string;
  };
  
  recentNews: {
    contactNews: NewsItem[];
    companyNews: NewsItem[];
    marketNews: NewsItem[]; // relevant market news for conversation
  };
  
  suggestedTalkingPoints: string[];
  potentialAskItems: string[]; // deals to mention, intros to request
  thingsToAvoid: string[]; // sensitive topics based on history
  
  previousMeetingNotes: string;
  openItems: string[]; // things they said they'd follow up on
}
```

### Generation Flow

```typescript
// From contact page or calendar event:
// 1. Click "Generate Meeting Brief"
// 2. Select meeting type: call | in-person | site tour | follow-up
// 3. Add agenda items (optional)
// 4. AI generates full brief (pulls from CRM, news, deal workspace)
// 5. Brief opens in printable/shareable format
// 6. "Open in Notes" button creates a meeting note template pre-filled with brief
// 7. After meeting: "Log Meeting Notes" button → saves summary + action items to contact record
```

---

# 8. REPORTING & COMMUNICATIONS

---

## 8.1 Board Package Generator

### Overview
Generates a complete GP/board reporting package pulling live deal data: cover page, portfolio summary, individual deal performance, market update, and financials — all in a single polished PDF or PPTX.

### Package Sections & Data Sources

```typescript
interface BoardPackageConfig {
  orgId: number;
  period: string; // 'Q1 2025'
  reportingDate: Date;
  includeSections: {
    executiveSummary: boolean;    // AI-generated from portfolio data
    portfolioSnapshot: boolean;   // KPI summary table
    dealPerformance: boolean;     // Per-deal P&L, occupancy, budget variance
    capitalActivity: boolean;     // Capital calls, distributions, investments
    marketUpdate: boolean;        // AI-generated market commentary
    debtSummary: boolean;         // All loans, maturities, covenants
    forwardOutlook: boolean;      // AI-generated based on pipeline + market
    appendix: boolean;            // Raw financial data tables
  };
  includeDeals: number[]; // dealIds to include
  branding: {
    logoUrl: string;
    primaryColor: string;
    firmName: string;
  };
}
```

### Generation Pipeline

```typescript
// POST /api/reports/board-package/generate
// 1. Fetch all deal financials for period
// 2. Calculate portfolio-level aggregates
// 3. AI-generate narrative sections (exec summary, market update, outlook)
// 4. Build PDF using existing PDF generation infrastructure
// 5. Apply org branding
// 6. Store as report document
// 7. Return download URL

// Typical generation time: 45-90 seconds
// Show progress indicator: "Fetching deal data... → Generating narratives... → Building PDF..."
```

---

## 8.2 Automated Quarterly Report

### Overview
Per-deal investor quarterly reports generated automatically from live data and AI narratives. Personalized per LP with their specific capital account data.

### Report Sections
1. Cover page (deal name, period, GP logo)
2. Executive summary (AI-generated from period actuals)
3. Financial performance (NOI, occupancy, revenue vs. budget with variance table)
4. Capital account statement (per LP: invested, distributions, ending balance, IRR)
5. Operational highlights (manually-entered narrative field)
6. Market commentary (AI-generated from market data)
7. Outlook (AI-generated forward-looking section)
8. Appendix (monthly P&L, rent roll snapshot)

### Personalization Engine

```typescript
// For each LP receiving the report:
// 1. Generate base report (sections 1-2, 5-8 are same for all LPs)
// 2. Generate LP-specific section 4 (their capital account)
// 3. Merge into single PDF
// 4. Email to LP with secure download link
// 5. Make available in LP portal

// Report versioning: keeps history of all generated reports
// "Regenerate" with updated data before sending
// Preview mode before bulk send
// Delivery tracking: sent | opened | downloaded
```

---

## 8.3 Deal Pipeline Report

### Overview
Snapshot report of your entire active deal pipeline: stages, deal values, expected close dates, probability-weighted pipeline value, and team activity summary.

### Pipeline Report Data

```typescript
interface PipelineReport {
  asOf: Date;
  period: string;
  
  // Summary metrics
  totalDealsInPipeline: number;
  totalPipelineValue: number; // sum of ask prices
  weightedPipelineValue: number; // probability-weighted
  avgDaysInPipeline: number;
  dealsExpectedToCloseThisQuarter: number;
  
  // By stage
  byStage: {
    stage: string;
    count: number;
    totalValue: number;
    avgDaysInStage: number;
    probability: number; // % chance of closing (configurable per stage)
  }[];
  
  // Individual deals
  deals: {
    name: string;
    assetClass: string;
    market: string;
    askPrice: number;
    stage: string;
    daysInStage: number;
    probability: number;
    weightedValue: number;
    expectedCloseDate: string;
    primaryContact: string;
    teamMember: string;
    nextAction: string;
    nextActionDue: string;
  }[];
  
  // Team activity
  teamActivity: {
    userId: number;
    name: string;
    dealsActive: number;
    activitiesLast7Days: number;
    tasksOverdue: number;
  }[];
}
```

---

## 8.4 White-Label Client Portal

### Overview
Enables operators managing third-party capital to offer a branded version of the platform. Clients log in at a custom subdomain, see only their assets, with the operator's branding throughout.

### Implementation

```typescript
// White-label configuration per org:
export const orgBranding = pgTable('org_branding', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  firmName: varchar('firm_name', { length: 255 }),
  logoUrl: varchar('logo_url', { length: 500 }),
  faviconUrl: varchar('favicon_url', { length: 500 }),
  primaryColor: varchar('primary_color', { length: 7 }), // hex
  secondaryColor: varchar('secondary_color', { length: 7 }),
  accentColor: varchar('accent_color', { length: 7 }),
  customDomain: varchar('custom_domain', { length: 255 }),
  // e.g., portal.smithcapital.com
  loginPageTagline: varchar('login_page_tagline', { length: 255 }),
  supportEmail: varchar('support_email', { length: 255 }),
  isWhiteLabeled: boolean('is_white_labeled').default(false),
  hideMarinaMatcher: boolean('hide_marinamatch_branding').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// White-label routing:
// app.marinamatch.com → standard login (shows MarinaMatch branding)
// portal.smithcapital.com → Smith Capital branding (powered by MarinaMatch hidden)
// All API calls include orgId context derived from subdomain
```

---

# 9. QUICK WIN FEATURES

---

## 9.1 SMS / Push Deal Alerts

### Overview
Real-time mobile notifications for critical deal events. Configurable per user with granular alert types.

### Alert Trigger Types

```typescript
type AlertTrigger =
  | 'deal_stage_changed'         // Stage changed on any deal
  | 'offer_deadline_approaching' // LOI/offer deadline within 48hrs
  | 'dd_deadline_approaching'    // DD deadline within X days
  | 'close_date_approaching'     // Target close within 7 days
  | 'new_document_uploaded'      // New document added to deal
  | 'new_dd_item_assigned'       // DD item assigned to user
  | 'capital_call_created'       // New capital call issued
  | 'distribution_approved'      // Distribution approved for your deal
  | 'work_order_critical'        // Critical priority WO submitted
  | 'lease_expiring'             // Lease expiring within 90 days
  | 'debt_maturity_alert'        // Loan maturing within 6 months
  | 'portfolio_alert_triggered'  // Rebalancing alert fired
  | 'new_deal_assigned'          // Deal assigned to user
  | 'task_overdue';              // Task past due date

// User preferences: toggle each alert type on/off
// Delivery: in-app notification | email | SMS (Twilio) | push (if mobile app)
```

### Implementation

```typescript
// lib/notifications/alertEngine.ts
// Background job triggers on database events (or after API mutations)
// Uses Twilio for SMS, SendGrid for email, WebSocket push for in-app

// POST /api/users/:id/notification-preferences — save preferences
// GET /api/notifications — get user's unread notifications
// PUT /api/notifications/:id/read — mark as read
// POST /api/notifications/mark-all-read

// WebSocket: ws://app/notifications — real-time in-app alerts
// Notification bell icon in header with badge count
```

---

## 9.2 E-Signature Integration

### Overview
Integrate DocuSign or HelloSign for in-platform document signing. Covers LOIs, subscription agreements, operating agreements, lease amendments, and more.

### Integration Architecture

```typescript
// Supported providers: DocuSign (primary) | HelloSign / Dropbox Sign (alternative)
// 
// Flow:
// 1. User selects document in MarinaMatch document module
// 2. Clicks "Send for Signature"
// 3. Select signers from CRM contacts (with email + signing order)
// 4. Preview document with signature blocks placed
// 5. Send → creates envelope in DocuSign
// 6. Signers receive email, sign on DocuSign
// 7. Webhook fires on completion → document marked as signed in MarinaMatch
// 8. Executed copy stored in document vault
// 9. Activity logged on deal + contact record

export const signatureRequests = pgTable('signature_requests', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  dealId: integer('deal_id').references(() => deals.id),
  documentId: integer('document_id').references(() => documents.id),
  provider: varchar('provider', { length: 30 }), // docusign | hellosign
  externalEnvelopeId: varchar('external_envelope_id', { length: 255 }),
  status: varchar('status', { length: 30 }),
  // created | sent | delivered | completed | declined | voided
  signers: jsonb('signers'),
  // [{ contactId, name, email, signingOrder, signedAt }]
  sentAt: timestamp('sent_at'),
  completedAt: timestamp('completed_at'),
  expiresAt: timestamp('expires_at'),
  executedDocUrl: varchar('executed_doc_url', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow(),
});
```

---

## 9.3 Zapier/Make Webhook Layer

### Overview
Expose a webhook system so users can connect MarinaMatch to 1,000s of external tools via Zapier, Make (Integromat), or direct webhooks.

### Webhook Events Exposed

```typescript
// Outbound webhooks (MarinaMatch → external):
const WEBHOOK_EVENTS = [
  'deal.created',
  'deal.stage_changed',
  'deal.closed',
  'contact.created',
  'document.uploaded',
  'capital_call.issued',
  'distribution.approved',
  'task.completed',
  'work_order.created',
  'work_order.completed',
  'alert.triggered',
  'report.generated',
];

// Webhook configuration:
export const webhooks = pgTable('webhooks', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  name: varchar('name', { length: 255 }),
  url: varchar('url', { length: 500 }),
  events: jsonb('events'), // array of event types to trigger on
  secret: varchar('secret', { length: 255 }), // HMAC signing secret
  isActive: boolean('is_active').default(true),
  lastTriggeredAt: timestamp('last_triggered_at'),
  failureCount: integer('failure_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// Webhook delivery with retry logic:
// Attempt 1: immediate
// Attempt 2: 1 minute later
// Attempt 3: 5 minutes
// Attempt 4: 30 minutes
// Attempt 5: 2 hours
// After 5 failures: deactivate webhook + notify user
```

### Inbound Webhooks (External → MarinaMatch)

```typescript
// POST /api/webhooks/inbound/:orgToken/[action]
// Allows external systems to create records:
// /create-contact — from website contact form
// /create-deal — from external deal submission form
// /log-activity — from external communication tools
// /upload-document — from document management tools
```

---

## 9.4 Mobile-Optimized Deal Cards

### Overview
Mobile-first deal card view for field use during property tours, broker meetings, and site visits. Shows the essential deal stats in a thumb-friendly interface.

### Mobile Deal Card Components

```typescript
// Mobile deal card (compact view for list):
// - Deal name + address (truncated)
// - Asset class badge
// - Stage badge (color-coded)
// - 3 key metrics: Ask Price | Cap Rate | IRR
// - Days since last activity dot
// - Priority indicator (hot / warm / cold)

// Mobile deal detail (expanded):
// Tab 1: Summary — key financial metrics in scannable card grid
// Tab 2: Activity — recent activity feed + quick-add note button
// Tab 3: Contacts — key contacts with tap-to-call
// Tab 4: Documents — recent documents with tap-to-open
// Tab 5: Tasks — outstanding tasks with checkoff

// Mobile-specific features:
// - Swipe right on deal card → add activity note
// - Swipe left → change stage
// - Voice note capture → transcribed and saved as activity note
// - GPS-based deal finder: "Show deals near me" using device location
// - Offline mode: recent deals cached for offline viewing during tours
```

---

## 9.5 Custom Deal Stage Labels Per Asset Class

### Overview
Different asset classes have different acquisition workflows. Marina acquisitions have different stages than multifamily, self-storage, or retail. Allow orgs to define custom stage pipelines per asset class.

### Data Models

```typescript
export const dealStageConfigs = pgTable('deal_stage_configs', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  assetClass: varchar('asset_class', { length: 100 }),
  // 'all' = default for all; specific class overrides default
  stages: jsonb('stages'),
  // [{ id, label, color, order, probability, requiredFields, defaultTasks }]
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Example: Marina Pipeline
const MARINA_STAGES = [
  { id: 'prospect', label: 'Prospect', color: '#94a3b8', order: 1, probability: 5 },
  { id: 'initial_outreach', label: 'Initial Outreach', color: '#64748b', order: 2, probability: 10 },
  { id: 'nda_signed', label: 'NDA Signed', color: '#3b82f6', order: 3, probability: 20 },
  { id: 'om_received', label: 'OM Received', color: '#6366f1', order: 4, probability: 30 },
  { id: 'site_tour', label: 'Site Tour', color: '#8b5cf6', order: 5, probability: 40 },
  { id: 'loi_submitted', label: 'LOI Submitted', color: '#f59e0b', order: 6, probability: 55 },
  { id: 'loi_accepted', label: 'LOI Accepted', color: '#f97316', order: 7, probability: 70 },
  { id: 'psa_executed', label: 'PSA Executed', color: '#ef4444', order: 8, probability: 80 },
  { id: 'due_diligence', label: 'Due Diligence', color: '#dc2626', order: 9, probability: 85 },
  { id: 'financing', label: 'Financing', color: '#b91c1c', order: 10, probability: 90 },
  { id: 'clear_to_close', label: 'Clear to Close', color: '#16a34a', order: 11, probability: 95 },
  { id: 'closed', label: 'Closed', color: '#15803d', order: 12, probability: 100 },
  { id: 'dead', label: 'Dead / Passed', color: '#374151', order: 99, probability: 0 },
];

// Required fields per stage can gate advancement:
// e.g., "Can't move to LOI Submitted without entering Ask Price and Cap Rate"
// Default tasks per stage: when deal enters stage, create standard tasks automatically
```

---

# 10. CRM / PIPELINE / WORKFLOW ENHANCEMENTS

---

## 10.1 Workflow Automation Engine

### Overview
A no-code rule-based automation engine. Users define triggers + conditions + actions to automate repetitive deal workflow tasks. Think HubSpot Workflows, but for CRE deal management.

### Data Models

```typescript
export const workflowAutomations = pgTable('workflow_automations', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  name: varchar('name', { length: 255 }),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  triggerType: varchar('trigger_type', { length: 100 }),
  triggerConfig: jsonb('trigger_config'),
  conditions: jsonb('conditions'), // AND/OR logic array
  actions: jsonb('actions'),       // ordered array of actions
  executionCount: integer('execution_count').default(0),
  lastExecutedAt: timestamp('last_executed_at'),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

export const workflowExecutionLog = pgTable('workflow_execution_log', {
  id: serial('id').primaryKey(),
  automationId: integer('automation_id').references(() => workflowAutomations.id),
  triggerEntityType: varchar('trigger_entity_type', { length: 50 }),
  triggerEntityId: integer('trigger_entity_id'),
  status: varchar('status', { length: 20 }), // success | failed | skipped
  actionsExecuted: jsonb('actions_executed'),
  errorMessage: text('error_message'),
  executedAt: timestamp('executed_at').defaultNow(),
});
```

### Trigger Types

```typescript
const TRIGGER_TYPES = {
  // Deal triggers
  'deal.stage_changed': { label: 'Deal stage changes', entity: 'deal' },
  'deal.created': { label: 'New deal created', entity: 'deal' },
  'deal.field_updated': { label: 'Deal field updated', entity: 'deal' },
  'deal.assigned': { label: 'Deal assigned to user', entity: 'deal' },
  
  // Date-based triggers
  'date.deal_close_approaching': { label: 'Days before deal close date', entity: 'deal' },
  'date.dd_deadline_approaching': { label: 'Days before DD deadline', entity: 'deal' },
  'date.lease_expiry_approaching': { label: 'Days before lease expiry', entity: 'lease' },
  'date.debt_maturity_approaching': { label: 'Days before debt maturity', entity: 'debt' },
  'date.task_due': { label: 'Task due date reached', entity: 'task' },
  
  // Document triggers
  'document.uploaded': { label: 'Document uploaded to deal', entity: 'document' },
  'document.signed': { label: 'Document signature completed', entity: 'document' },
  
  // Contact triggers
  'contact.created': { label: 'New contact created', entity: 'contact' },
  'contact.inactivity': { label: 'No activity with contact for X days', entity: 'contact' },
  
  // Financial triggers
  'financial.noi_variance': { label: 'NOI variance exceeds threshold', entity: 'deal' },
  'financial.dscr_below_threshold': { label: 'DSCR drops below threshold', entity: 'deal' },
  
  // Work order triggers
  'work_order.created': { label: 'Work order submitted', entity: 'work_order' },
  'work_order.overdue': { label: 'Work order past scheduled date', entity: 'work_order' },
};
```

### Condition Types

```typescript
// Conditions can check any field on the trigger entity:
// deal.assetClass == 'marina'
// deal.askPrice > 5000000
// deal.stage == 'due_diligence'
// contact.contactType == 'broker'
// work_order.priority == 'critical'
// user.role == 'analyst'

// Boolean logic: AND / OR with nesting
interface Condition {
  logic?: 'AND' | 'OR';
  rules: ConditionRule[];
}
interface ConditionRule {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' |
            'contains' | 'not_contains' | 'is_empty' | 'is_not_empty' |
            'in_list' | 'not_in_list';
  value: any;
}
```

### Action Types

```typescript
const ACTION_TYPES = {
  // Task actions
  'task.create': {
    label: 'Create task',
    params: { title, description, assignTo, dueDaysFromNow, priority }
  },
  'task.assign': {
    label: 'Assign existing task to user',
    params: { taskId, assignTo }
  },
  
  // Notification actions
  'notification.send_in_app': {
    label: 'Send in-app notification',
    params: { recipient, message, linkToDeal }
  },
  'notification.send_email': {
    label: 'Send email notification',
    params: { recipient, subject, template, variables }
  },
  'notification.send_sms': {
    label: 'Send SMS',
    params: { recipient, message }
  },
  
  // Deal actions
  'deal.update_stage': {
    label: 'Change deal stage',
    params: { newStage }
  },
  'deal.update_field': {
    label: 'Update deal field',
    params: { field, value }
  },
  'deal.assign_to': {
    label: 'Assign deal to user',
    params: { userId }
  },
  'deal.add_tag': {
    label: 'Add tag to deal',
    params: { tag }
  },
  
  // Document actions
  'document.request': {
    label: 'Create document request',
    params: { documentType, requestedFrom, dueDate, message }
  },
  
  // DD actions
  'dd.create_item': {
    label: 'Create DD checklist item',
    params: { title, category, priority, assignTo, dueDate }
  },
  'dd.create_from_template': {
    label: 'Apply DD template',
    params: { templateId }
  },
  
  // Activity log
  'activity.log': {
    label: 'Log activity note',
    params: { note, activityType }
  },
  
  // Wait action (for sequences)
  'wait': {
    label: 'Wait before next action',
    params: { days: number }
  },
};
```

### Pre-Built Automation Templates

```typescript
// Template 1: "New Deal Onboarding"
// Trigger: deal.created
// Actions:
//   1. Create task: "Schedule initial site tour" → assigned to deal owner, due in 5 days
//   2. Create task: "Run buy-box scoring" → due in 2 days
//   3. Create task: "Research submarket comps" → due in 3 days
//   4. Send in-app notification to team: "New deal added: {deal.name}"
//   5. Log activity: "Deal created and onboarding tasks generated"

// Template 2: "Due Diligence Stage Entry"
// Trigger: deal.stage_changed WHERE newStage == 'due_diligence'
// Actions:
//   1. Apply DD template for deal's asset class
//   2. Create task: "Confirm DD deadline with seller" due in 1 day
//   3. Create task: "Schedule physical inspection" due in 3 days
//   4. Send email notification to GP: "DD period started for {deal.name}"
//   5. Log activity: "Automated DD setup triggered"

// Template 3: "Lease Expiry Warning"
// Trigger: date.lease_expiry_approaching (90 days before)
// Conditions: lease.status == 'active'
// Actions:
//   1. Create task: "Contact tenant re: renewal" assigned to property manager
//   2. Log activity: "Lease expiry alert: {lease.tenantName} expires in 90 days"
//   3. Send in-app notification to deal owner

// Template 4: "Broker Inactivity Reactivation"
// Trigger: contact.inactivity (60 days)
// Conditions: contact.contactType == 'broker'
// Actions:
//   1. Create task: "Reach out to {contact.name} — 60-day inactivity" assigned to user
//   2. Draft AI follow-up (calls Follow-Up AI endpoint)

// Template 5: "Debt Maturity 6-Month Alert"
// Trigger: date.debt_maturity_approaching (180 days)
// Actions:
//   1. Create task: "Begin refi process for {deal.name}" assigned to deal owner, due in 7 days
//   2. Create task: "Contact lenders for new term sheet" due in 14 days
//   3. Send email to GP with debt details
//   4. Flag deal in portfolio with "Refi Required" tag

// Template 6: "Critical Work Order Escalation"
// Trigger: work_order.created
// Conditions: work_order.priority == 'critical'
// Actions:
//   1. Send SMS to property manager
//   2. Send email to deal owner
//   3. Create escalation task: "Review critical WO for {deal.name}" due today

// Template 7: "Deal Won Celebration + Close Tasks"
// Trigger: deal.stage_changed WHERE newStage == 'closed'
// Actions:
//   1. Send in-app notification to whole team: "🎉 {deal.name} has closed!"
//   2. Create task: "Set up asset management workspace" due in 3 days
//   3. Create task: "Update cap stack with final loan terms" due in 2 days
//   4. Create task: "Send investor close notifications" due in 1 day
//   5. Create task: "Schedule 30-day post-close inspection" due in 7 days
//   6. Log activity: "Deal closed. Automated close tasks created."
```

### Workflow Builder UI

```typescript
// pages/settings/WorkflowAutomations.tsx
// 
// List view: all automations with toggle on/off, last executed, execution count
// 
// Builder UI (visual, no-code):
// ┌─────────────────────────────────────────────┐
// │  TRIGGER                                     │
// │  [When...] dropdown                          │
// │  [When this trigger fires...] config panel   │
// ├─────────────────────────────────────────────┤
// │  CONDITIONS (optional)                       │
// │  [If...] rule builder (field/operator/value) │
// │  [+ Add condition] [AND | OR toggle]         │
// ├─────────────────────────────────────────────┤
// │  ACTIONS                                     │
// │  1. [Then do this...] dropdown + config      │
// │  2. [Then do this...] + [Add wait X days]    │
// │  [+ Add action]                              │
// └─────────────────────────────────────────────┘
// 
// Test button: "Test with this deal" → dry run against a specific deal
// History button: shows execution log
// Template picker: browse pre-built templates
```

### Execution Engine

```typescript
// lib/automation/executor.ts

export async function evaluateAutomations(
  triggerType: TriggerType,
  entityType: string,
  entityId: number,
  orgId: number,
  eventData: Record<string, any>
): Promise<void> {
  // Get all active automations for this org + trigger type
  const automations = await db
    .select()
    .from(workflowAutomations)
    .where(
      and(
        eq(workflowAutomations.orgId, orgId),
        eq(workflowAutomations.triggerType, triggerType),
        eq(workflowAutomations.isActive, true)
      )
    );
  
  for (const automation of automations) {
    // Evaluate conditions
    const entity = await fetchEntity(entityType, entityId);
    const conditionsMet = evaluateConditions(automation.conditions, entity, eventData);
    
    if (!conditionsMet) {
      await logExecution(automation.id, entityType, entityId, 'skipped');
      continue;
    }
    
    // Execute actions in sequence (respecting wait steps)
    try {
      for (const action of automation.actions) {
        if (action.type === 'wait') {
          // Schedule delayed execution via job queue (Bull/Redis)
          await scheduleDelayedAction(automation.id, action, entityId, action.params.days);
        } else {
          await executeAction(action, entity, eventData, orgId);
        }
      }
      
      await logExecution(automation.id, entityType, entityId, 'success');
      await incrementExecutionCount(automation.id);
    } catch (error) {
      await logExecution(automation.id, entityType, entityId, 'failed', error.message);
    }
  }
}

// Called from relevant route handlers after mutations:
// After deal stage change → evaluateAutomations('deal.stage_changed', 'deal', dealId, orgId, { prevStage, newStage })
// After deal create → evaluateAutomations('deal.created', 'deal', dealId, orgId, deal)
// etc.
```

---

## 10.2 Deal Timeline / Gantt View

### Overview
A Gantt-style timeline view of every deal in the pipeline, showing key milestones, due diligence periods, and task clusters on a horizontal time axis. Enables at-a-glance pipeline management.

### Data Requirements

```typescript
interface TimelineEvent {
  id: number;
  dealId: number;
  dealName: string;
  eventType: 'milestone' | 'period' | 'task' | 'deadline';
  title: string;
  startDate: Date;
  endDate: Date | null; // null for point-in-time events
  status: 'completed' | 'in_progress' | 'upcoming' | 'overdue';
  color: string; // based on event type and status
  assignedTo: number | null;
  linkedEntityType: string | null;
  linkedEntityId: number | null;
}

// Events to display:
// - LOI submitted (point)
// - LOI accepted (point)
// - PSA execution (point)
// - Due diligence period (bar: PSA execution → DD deadline)
// - Inspection scheduled (point)
// - Financing period (bar)
// - Close date (point)
// - Individual DD tasks (bars)
// - Key document deadlines (points)
// - Site tour (point)
// - Capital call due dates (points)
```

### Gantt Component

```typescript
// components/pipeline/DealGanttView.tsx
// 
// Built with: custom SVG rendering or frappe-gantt / react-gantt-modern library
// 
// Layout:
// Left panel (300px): Deal name + asset class + stage badge
// Right panel: Horizontal timeline
//   - X-axis: time (days/weeks/months — zoom control)
//   - One row per deal
//   - Events shown as colored bars or diamonds
//   - Today line: vertical red dashed line
//   - Hover on event: tooltip with details
//   - Click event: opens relevant entity (task, DD item, etc.)
//
// Zoom levels:
//   - Week view: shows individual days
//   - Month view: shows individual weeks
//   - Quarter view: shows individual months
//   - Year view: shows individual quarters
//
// Filters:
//   - By team member (show only their deals)
//   - By asset class
//   - By stage
//   - Date range
//
// Color coding:
//   - Completed: green
//   - In progress: blue
//   - Upcoming: grey
//   - Overdue: red
//   - DD period: yellow/gold
//   - Close date: green star
//
// "Today's Priorities" panel below Gantt:
//   Lists all events due today or overdue across all deals
```

---

## 10.3 Deal Comparison in Workspace

### Overview
Side-by-side comparison of 2-5 deals across financial metrics, DD status, market positioning, and risk scores. Accessible from the pipeline view or individual deal workspace.

### Comparison Framework

```typescript
// Comparison Categories:
// 1. Deal Overview: asset class, market, size, stage, days in pipeline
// 2. Price & Valuation: ask price, price/unit, price/sqft, cap rate, GRM
// 3. Financial Performance: NOI, occupancy, revenue, OpEx ratio
// 4. Underwriting: IRR, equity multiple, DSCR, LTV, cash-on-cash
// 5. Capital Structure: equity required, debt amount, total cap, LP equity
// 6. Risk Profile: risk score, key risks, DD status, open items
// 7. Deal Timeline: LOI date, DD deadline, target close, days to close

interface ComparisonColumn {
  dealId: number;
  dealName: string;
  isSelected: boolean;
  metrics: Record<string, {
    value: any;
    formatted: string;
    rank: number; // 1 = best among compared deals
    isBest: boolean;
    isWorst: boolean;
  }>;
}
```

### Comparison UI

```typescript
// components/comparison/DealComparison.tsx
// 
// Accessible via:
// 1. Pipeline view: select 2+ deals with checkboxes → "Compare" button
// 2. Deal workspace: "Compare to..." button → picker modal
// 
// Layout:
// Header row: deal names with remove buttons
// Metric rows: one row per metric
//   - Best value highlighted green
//   - Worst value highlighted red
//   - "N/A" for missing data
// Section dividers with expand/collapse
// Sticky left column with metric labels
// Horizontal scroll if many deals
// 
// Actions:
// - "Add Deal" button (up to 5 total)
// - Export as PDF report
// - "Set as Side-by-Side in Workspace" (pins comparison in deal workspace)
// - "Select Winner" → marks deal as preferred in pipeline
```

---

## 10.4 Key Dates on Kanban Cards

### Overview
Display the most critical upcoming date on each deal's Kanban pipeline card to surface urgency without opening individual deals.

### Date Priority Logic

```typescript
// Date types, ranked by display priority:
const DATE_PRIORITY = [
  { type: 'close_date', label: 'Close', urgencyThreshold: 14 }, // days
  { type: 'dd_deadline', label: 'DD Ends', urgencyThreshold: 7 },
  { type: 'offer_deadline', label: 'Offer Due', urgencyThreshold: 3 },
  { type: 'psa_signing', label: 'PSA', urgencyThreshold: 7 },
  { type: 'loi_expiry', label: 'LOI Exp', urgencyThreshold: 3 },
  { type: 'site_tour', label: 'Tour', urgencyThreshold: 2 },
  { type: 'financing_deadline', label: 'Fin. Due', urgencyThreshold: 14 },
  { type: 'inspection_date', label: 'Inspection', urgencyThreshold: 5 },
];

// On each Kanban card:
// Shows the NEXT upcoming date (closest in future)
// Format: "DD Ends · Mar 28" 
// Color coding:
//   > 14 days: grey text (not urgent)
//   7-14 days: yellow text (approaching)
//   < 7 days: orange text (urgent)
//   < 3 days: red text + pulsing dot (critical)
//   Overdue: red background + "OVERDUE" label

// "No date set" indicator for deals with no upcoming dates
// Click date → opens edit modal
// Multiple dates: shows primary + "2 more dates" chip that expands on hover
```

### Enhanced Kanban Card Layout

```typescript
// Updated Kanban card:
// ┌────────────────────────────────┐
// │ [Asset Class Badge] [Priority] │
// │ Deal Name                      │
// │ Address, Market                │
// │ ─────────────────────────────  │
// │ $X.XM · X.X% cap · X.X% IRR  │
// │ ─────────────────────────────  │
// │ 📅 DD Ends · Mar 28 ← KEY DATE│
// │ ─────────────────────────────  │
// │ [Avatar] [+2] · 3d ago        │
// └────────────────────────────────┘

// Existing card metrics stay: ask price, cap rate, IRR
// New: key date row (always visible, color-coded)
// New: assignee avatars
// New: "last activity" relative timestamp
```

---

## 10.5 Global Activity Log Polish

### Overview
Upgrade the existing global activity log into a true command center for deal activity: filtered views, rich context, bulk actions, and AI summarization.

### Activity Log Enhancements

```typescript
// Enhanced activity entry:
interface ActivityEntry {
  id: number;
  orgId: number;
  dealId: number | null;
  contactId: number | null;
  userId: number;
  activityType: ActivityType;
  title: string;
  body: text;
  // Rich body with @mentions and #deal-links
  linkedEntityType: string | null;
  linkedEntityId: number | null;
  linkedEntityTitle: string | null;
  // e.g., "DD Item: Environmental Review"
  isAutomated: boolean; // system-generated vs. user-created
  isPinned: boolean; // pinned activities always show at top
  reactions: jsonb; // emoji reactions from team
  attachments: jsonb; // file attachments
  parentActivityId: number | null; // for threaded replies
  visibilityScope: 'deal' | 'contact' | 'portfolio' | 'org';
  createdAt: timestamp;
}

type ActivityType =
  | 'note'               // General note
  | 'call'               // Phone call logged
  | 'email'              // Email sent/received
  | 'meeting'            // Meeting logged
  | 'site_tour'          // Site visit
  | 'stage_change'       // Automated: deal stage changed
  | 'document_upload'    // Document added
  | 'task_completed'     // Task marked done
  | 'dd_item_update'     // DD item status changed
  | 'offer_submitted'    // LOI/offer submitted
  | 'offer_response'     // Response to offer
  | 'automation'         // Triggered by workflow automation
  | 'system'             // System event (deal created, etc.)
  | 'financial_update'   // Financial model updated
  | 'work_order'         // WO created/updated
  | 'capital_event';     // Capital call or distribution

// New features:
// 1. Activity types with icons (phone/email/building/file icons per type)
// 2. Threaded replies (click "Reply" → reply inline, like Slack)
// 3. @mention team members (triggers notification)
// 4. #link deals inline (creates hyperlink to deal)
// 5. Emoji reactions (👍 ✅ 🔥 ⚠️)
// 6. Pin important activities
// 7. AI "Summarize Activity" button → AI summarizes last 30 days of activity in 3 bullets
// 8. Filter bar: type | user | date range | deal | automated/manual
// 9. Export activity log as PDF (for deal audit trail)
// 10. Full-text search across all activity content
```

### Activity Summary Widget

```typescript
// Per-deal workspace: "Activity Digest" card at top of Activity tab
// Shows AI-generated summary of last 30 days:
// "Since [date]: DD is 73% complete with 4 open items. Inspection completed 
// with minor findings. Lender engagement progressing — term sheet received 
// from First National. Next milestone: financing contingency due Mar 28."
// "Regenerate Summary" button
```

---

## 10.6 Email Send Integration

### Overview
Send emails directly from MarinaMatch to CRM contacts. All sent emails logged to the contact's activity timeline. Supports templates, merge fields, and tracking.

### Implementation Architecture

```typescript
// Provider: SendGrid (primary) | Postmark (alternative)
// 
// Two modes:
// 1. MarinaMatch-hosted email: send from noreply@marinamatch.com or reply@[org].marinamatch.com
// 2. Connected inbox: OAuth connect user's Gmail/Outlook → send from their own address

// Email composition UI:
// - To: (CRM contact picker with search)
// - CC/BCC: optional
// - Subject: with merge field support {{deal.name}}, {{contact.firstName}}
// - Body: rich text editor (Quill) with merge fields
// - Template selector: apply saved templates
// - Attachments: from document vault or upload
// - Send / Schedule Send / Save Draft

export const emailMessages = pgTable('email_messages', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  dealId: integer('deal_id').references(() => deals.id).default(null),
  fromUserId: integer('from_user_id').references(() => users.id),
  toContactId: integer('to_contact_id').references(() => contacts.id),
  toEmail: varchar('to_email', { length: 255 }),
  subject: varchar('subject', { length: 500 }),
  bodyHtml: text('body_html'),
  bodyText: text('body_text'),
  status: varchar('status', { length: 30 }),
  // draft | scheduled | sent | delivered | opened | clicked | bounced | failed
  scheduledAt: timestamp('scheduled_at'),
  sentAt: timestamp('sent_at'),
  deliveredAt: timestamp('delivered_at'),
  openedAt: timestamp('opened_at'),
  clickedAt: timestamp('clicked_at'),
  externalMessageId: varchar('external_message_id', { length: 255 }),
  // SendGrid message ID for tracking
  templateId: integer('template_id').references(() => emailTemplates.id),
  attachments: jsonb('attachments'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const emailTemplates = pgTable('email_templates', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id),
  name: varchar('name', { length: 255 }),
  category: varchar('category', { length: 100 }),
  // deal_intro | lender_inquiry | capital_call | distribution_notice
  // dd_request | follow_up | investor_update | closing_notice
  subject: varchar('subject', { length: 500 }),
  bodyHtml: text('body_html'),
  mergeFields: jsonb('merge_fields'), // list of available merge fields for this template
  isShared: boolean('is_shared').default(true),
  // shared = org-wide; false = personal template
  createdBy: integer('created_by').references(() => users.id),
  usageCount: integer('usage_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### Pre-Built Email Templates

```typescript
// 1. LOI Cover Email — "We are pleased to submit the attached Letter of Intent..."
// 2. Lender Introduction — deal overview for initial lender outreach
// 3. Broker Thank You — post-deal thank you
// 4. DD Document Request — itemized list of outstanding DD items
// 5. Capital Call Notice — formal capital call to LP (links to full notice)
// 6. Distribution Notice — "A distribution of $X,XXX has been processed for your account"
// 7. Quarterly Report Delivery — "Please find attached your Q[X] investor report"
// 8. New Deal Introduction — introduce a new deal opportunity to LP
// 9. Inspection Scheduling — request access for property inspection
// 10. Lease Renewal Inquiry — reach out to tenant regarding upcoming expiry
```

### Email Tracking

```typescript
// Open tracking: embed 1x1 tracking pixel (SendGrid handles this)
// Click tracking: wrap links in SendGrid click tracking
// Activity log: all email sends appear in contact + deal activity logs
// "Email sent to [Contact Name] — Subject: [Subject]"
// If opened: "Email opened by [Contact Name]" (logged automatically via webhook)
// Reply detection: if using connected inbox, replies captured and logged

// Send from CRM contact page: "Send Email" button
// Send from deal workspace: "Email Team" or "Email Contact" in activity bar
// Send from template library: "Use Template" → fills composer
```

---

# APPENDIX: IMPLEMENTATION PRIORITIES

## Phase 1 — Quick Wins (< 2 weeks each)
Priority order for maximum user value with minimal complexity:

1. **Key Dates on Kanban Cards** (10.4) — frontend only, uses existing data
2. **Custom Deal Stage Labels** (9.5) — config table + stage config UI
3. **Global Activity Log Polish** (10.5) — enhance existing module
4. **Workflow Automation Engine** (10.1) — highest leverage, unlocks everything else
5. **Deal Timeline / Gantt View** (10.2) — new visualization of existing data
6. **Email Send Integration** (10.6) — closes the communication loop

## Phase 2 — Core Intelligence (2-4 weeks each)
7. **Ask Your Deal — Conversational AI** (1.1) — flagship AI feature
8. **AI Narrative Generator** (1.2) — extends existing IC Memo PDF work
9. **Deal Comparison** (10.3) — uses existing deal data
10. **Deal Risk Scoring AI** (1.4) — new scoring engine

## Phase 3 — Capital Markets & LP (4-6 weeks each)
11. **LP Dashboard** (2.1) — new role + views
12. **Lender Matching Engine** (6.1) — new lender database + matching
13. **Term Sheet Comparator** (6.2) — builds on lender work
14. **Capital Call Workflow** (2.2) — LP portal extension
15. **Waterfall / Distribution Engine** (2.3) — financial calculation engine

## Phase 4 — Operations & Portfolio (4-8 weeks each)
16. **Work Order / Maintenance Module** (5.1) — new full module
17. **Vendor Management** (5.2) — extends WO module
18. **Cross-Portfolio Dashboard** (3.1) — aggregation layer
19. **CapEx Tracker** (5.3) — extends WO + pro forma integration
20. **Portfolio Alerts** (3.3) — background alert engine

## Phase 5 — Market Intelligence (4-6 weeks each)
21. **Demographics Overlay** (4.3) — Census API integration
22. **Rent Comps** (4.2) — new data module
23. **Live Cap Rate Feed** (4.1) — data entry + FM integration
24. **DockTalk 2.0** (4.5) — AI news curation upgrade
25. **Benchmark Engine** (3.2) — market vs. portfolio comparison

---

## TECHNICAL STACK REMINDERS

```
Frontend: React + TypeScript + TanStack Query + Wouter
Backend: Express + Node.js
Database: PostgreSQL + Drizzle ORM (RAW POOL for modelingProjectConfig/modelingScenarioVersions)
AI: Anthropic Claude API (claude-opus-4-5)
File Storage: S3-compatible (existing)
Email: SendGrid
SMS: Twilio
PDF Generation: Existing infrastructure (extend as needed)
Background Jobs: Add Bull + Redis for automation engine
Charts: Recharts (existing) + D3 for complex visualizations (Gantt, graph)
```

## DATABASE GOTCHAS (CRITICAL)
```
- ALWAYS use raw pool.query() for: modelingProjectConfig, modelingScenarioVersions
- Drizzle ORM breaks on these tables due to enableRLS column → malformed SQL
- Raw SQL returns snake_case → map to camelCase explicitly
- Server does NOT auto-restart on routes.ts changes → manual restart required
- Preferred patch pattern: heredoc scripts in Replit shell
  cat > /tmp/script.mjs << 'SCRIPT'
  [script content]
  SCRIPT
  node /tmp/script.mjs
```

---

*End of MarinaMatch Master Product Specification*
*Generated: 2026-03-24*
*Version: 1.0*
*Total Features Specified: 47 major features | 200+ sub-features*
