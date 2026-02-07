import OpenAI from "openai";
import { db } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";
import { 
  crmDeals, 
  modelingProjects, 
  projects,
  crmProperties,
  salesComps,
  aiAssistantFeedback
} from "@shared/schema";

// Use Replit AI Integrations if available (billed to Replit credits), otherwise fall back to user's OpenAI key
const openai = new OpenAI({ 
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
});

export interface AssistantContext {
  currentPage: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  userId?: string;
  orgId?: string;
  advisoryMode?: AdvisoryMode;
  entityData?: Record<string, any>;
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

const MARINA_INDUSTRY_KNOWLEDGE = `
## Marina Industry Benchmarks & Market Intelligence

### Cap Rate Benchmarks (2024-2025)
- **Premium Coastal Marinas** (FL, CA, Northeast): 5.5% - 7.0%
- **Secondary Markets**: 7.0% - 8.5%
- **Tertiary/Inland Markets**: 8.5% - 10.0%
- **Distressed Assets**: 10.0%+ (higher risk premium)
- **Trophy/Irreplaceable Assets**: 4.5% - 5.5% (institutional demand)

Cap rate factors:
- Barrier-to-entry markets command 50-150bps compression
- Fuel operations add 25-50bps to cap rates (operational risk)
- Dry storage-heavy marinas trade 50-100bps wider than wet slip marinas
- Long-term ground leases add 100-200bps vs fee simple

### NOI Multiples
- **Typical Range**: 10x - 18x trailing NOI
- **Premium Assets**: 14x - 20x NOI
- **Value-Add Opportunities**: 8x - 12x NOI (with upside)

### Occupancy Benchmarks
- **Strong Performance**: 90%+ annual occupancy
- **Healthy Range**: 80-90% occupancy
- **Concerning**: Below 75% occupancy (investigate causes)
- **Seasonal Adjustment**: Winter occupancy typically 60-70% of peak

### Revenue Per Slip Benchmarks
- **Premium Markets** (Miami, San Diego, NYC): $15,000 - $35,000+ per slip/year
- **Strong Secondary Markets**: $8,000 - $15,000 per slip/year
- **Average Markets**: $4,000 - $8,000 per slip/year
- **Tertiary/Rural**: $2,000 - $4,000 per slip/year

### Revenue Mix Best Practices
- **Slip Rentals**: 50-70% of revenue (stable, recurring)
- **Fuel Sales**: 15-25% of revenue (volume-sensitive, ~5-8% margin)
- **Service/Repair**: 10-20% of revenue (higher margin, 30-50%)
- **Ship Store/Retail**: 5-10% of revenue (25-35% margin)
- **Boat Sales (if applicable)**: Variable (2-5% margin)

### Operating Expense Ratios
- **Well-Run Marina**: 45-55% expense ratio
- **Average Marina**: 55-65% expense ratio
- **Inefficient/Distressed**: 65%+ expense ratio

Key expense categories as % of revenue:
- Payroll: 20-30%
- Insurance: 5-10%
- Utilities: 5-8%
- Repairs/Maintenance: 5-10%
- Property Taxes: 3-8%
- Management Fee: 3-5%

### Slip Rate Benchmarks (Monthly)
- **Per Linear Foot Pricing**:
  - Premium Coastal: $30 - $75/LF/month
  - Secondary Markets: $15 - $30/LF/month
  - Tertiary Markets: $8 - $15/LF/month
- **Annual Rate Increases**: 3-5% typical, 5-8% in high-demand markets

### Due Diligence Red Flags
1. **Environmental**: Underground fuel tanks, historical spills, superfund proximity
2. **Structural**: Seawall age (30+ years needs inspection), dock condition, dredging needs
3. **Regulatory**: Submerged land lease terms, DEP permits, zoning restrictions
4. **Operational**: High tenant turnover (>25%), fuel compliance issues, deferred maintenance
5. **Financial**: Declining revenue trends, below-market rents (artificial occupancy), owner adjustments >15% of NOI
6. **Legal**: Pending litigation, title issues, easement encumbrances
7. **Market**: New competition, changing demographics, access challenges

### Value-Add Opportunities
1. **Rate Optimization**: Mark-to-market slip rates (typical 10-20% upside)
2. **Occupancy Improvement**: Marketing, waitlist management, seasonal programs
3. **Service Expansion**: Add repair services, retail, boat club programs
4. **Fuel Margin Enhancement**: Volume discounts, pricing optimization
5. **Operational Efficiency**: Reduce expense ratio by 5-10 points
6. **Capital Improvements**: Dock upgrades, amenity additions, dry storage
7. **Ancillary Revenue**: Parking, events, storage lockers, ice/bait sales

### Exit Strategy Considerations
- **Hold Period Benchmarks**: 5-7 years typical for value-add, 7-10 years for stabilized
- **Target IRR Ranges**:
  - Core/Stabilized: 8-12% levered IRR
  - Value-Add: 15-20% levered IRR
  - Opportunistic: 20%+ levered IRR
- **Equity Multiple Targets**:
  - Core: 1.5x - 1.8x
  - Value-Add: 1.8x - 2.5x
  - Opportunistic: 2.5x+

### Financing Benchmarks
- **LTV Ranges**: 50-65% for stabilized, 60-70% for value-add with recourse
- **Interest Rates** (2024-2025): SOFR + 250-400bps for stabilized
- **Debt Service Coverage**: Minimum 1.25x, prefer 1.40x+
- **Amortization**: 25-30 years typical

### Seasonal Considerations
- **Peak Season**: May - September (Northeast), Year-round (Florida)
- **Off-Season Discounts**: 20-40% winter rate reductions common
- **Storage Revenue**: Critical for northern marinas, dry stack = 12-18 turns/year

## Capital Markets & Debt Metrics (2024-2025)

### Current Lending Environment
- **Bank Debt**: SOFR + 225-350bps, 55-65% LTV, 1.25-1.40x DSCR required
- **CMBS/Conduit**: SOFR + 200-300bps, 60-70% LTV, 1.30x+ DSCR, 10-year term
- **Credit Union/Regional**: SOFR + 275-375bps, 55-60% LTV, relationship-based
- **Bridge/Mezz**: SOFR + 400-600bps, 70-80% LTC, 2-3 year term, interest-only
- **SBA 504**: Prime + 0-100bps, 75-85% LTV, 25-year amort, <$5M projects
- **Life Companies**: 4.50-5.50% fixed, 50-55% LTV, prefer stabilized assets

### Forward-Looking Rate Expectations (2025-2026)
- **Fed Funds**: Expected 25-50bps cuts if inflation moderates
- **SOFR Trend**: Currently elevated, gradual decline expected
- **Spread Compression**: Likely 25-50bps as competition returns
- **Refinance Risk**: Assets purchased at 4.5% cap now face 7%+ debt costs

### Key Debt Metrics & Thresholds
- **DSCR** (Debt Service Coverage Ratio):
  - Minimum acceptable: 1.20x (distressed/bridge)
  - Comfortable: 1.30-1.40x
  - Conservative: 1.50x+
  - Breakeven warning: <1.10x requires cash infusion
- **LTV** (Loan-to-Value):
  - Conservative: 50-55%
  - Typical: 60-65%
  - Aggressive: 70-75%
  - High-risk: >75%
- **Debt Yield** (NOI/Loan Amount):
  - Minimum acceptable: 8%
  - Healthy: 9-11%
  - Conservative: 12%+
- **Interest Coverage**: NOI/Interest expense, prefer 2.0x+

### Loan Sizing Methodology
Lenders use the most restrictive of:
1. LTV constraint (e.g., 65% of appraised value)
2. DSCR constraint (e.g., NOI / 1.25 = max debt service)
3. Debt yield constraint (e.g., NOI / 9% = max loan)

### Refinance Risk Assessment
- **Red Flag**: Debt matures when rates >acquisition cap rate
- **Concern**: <18 months to maturity with no extension
- **Stress Test**: Always model +200bps rate shock

## Sales Comps Analysis Framework

### Comp Selection Criteria (In Order of Importance)
1. **Location proximity**: Same MSA preferred, regional acceptable
2. **Asset type match**: Wet slip vs dry storage, marina type
3. **Size similarity**: Within 50% of subject slip count
4. **Transaction recency**: <3 years preferred, <5 years acceptable
5. **Arm's-length transaction**: Exclude related-party deals

### Comp Adjustment Factors
- **Size premium/discount**: Larger assets trade tighter (3-5% per size tier)
- **Location adjustment**: Premium markets +10-30%, tertiary -10-20%
- **Condition adjustment**: Deferred maintenance -5-15%
- **Lease-up adjustment**: Unstabilized assets -10-20%
- **Age of sale**: +50bps cap rate per year if rates rising

### When Comps May Be Weak
- Limited transaction volume (<3 comps in 3 years)
- Significant size/quality mismatch
- Changing market conditions since comp date
- Mixed-use vs pure-play marina comparisons

### Better Comp Identification Triggers
- Subject cap rate >150bps from comp average → investigate
- Price/slip deviates >25% from comps → verify adjustments
- No comps in same state → consider regional benchmarks

## Rate Comps & Rental Benchmarking

### Rate Analysis Framework
- **Per Linear Foot Analysis**: Most common for wet slips
- **Per Square Foot**: Used for dry storage
- **Per Slip (blended)**: Useful for quick comparisons

### Market Rate Indicators
- **Aggressive** (above market): >10% above comp average
- **Market**: Within +/-10% of comp average  
- **Conservative** (below market): >10% below comp average

### Rate Growth Assumptions
- **Conservative**: 2-3% annually (inflation-linked)
- **Moderate**: 3-5% annually (typical markets)
- **Aggressive**: 5-8% annually (high-demand markets only)
- **Red Flag**: >8% year-over-year without justification

### Rate Comparison Sources
- Nearby marina rate cards (public/mystery shop)
- Industry surveys (Marina Industries Association)
- Historical trend analysis (3-5 year CAGR)

## Demographics & Location Analysis

### Positive Location Indicators
- **Household income**: >$100K median in 10-mile radius
- **Boat registrations**: High per-capita boat ownership
- **Population growth**: >1.5% annual growth
- **Tourism traffic**: Seasonal population surge
- **Water access**: Limited competitive waterfront
- **Barrier to entry**: Permitting restrictions, protected waterways

### Location Risk Factors
- **Environmental exposure**: Hurricane zone, flood plain, erosion
- **Regulatory burden**: Restrictive zoning, environmental oversight
- **Access challenges**: Bridge height limits, channel depth issues
- **Industrial proximity**: Port traffic, commercial shipping
- **Competition**: New marina development, public ramps
- **Demographic decline**: Population loss, aging demographics

### Market Positioning Analysis
- **Primary draw radius**: 30-60 minute drive time
- **Secondary draw**: Regional destination (2-4 hour drive)
- **Competitive set**: All marinas within 30-mile radius
- **Market share estimate**: Subject slips / total market slips

## Lease-Up & Stabilization Assessment

### Lease-Up Speed Categories
- **Aggressive**: 15-20+ slips/month absorption
  - Requires: Strong market, competitive rates, marketing budget
  - Risk: High if market softens
- **Moderate**: 8-15 slips/month absorption
  - Typical for secondary markets
  - Reasonable for most projections
- **Conservative**: 3-8 slips/month absorption
  - Appropriate for tertiary markets or repositioning
  - Safer for underwriting

### Stabilization Timeline Benchmarks
- **Strong market**: 12-18 months to 90%+ occupancy
- **Average market**: 18-30 months to 90%+ occupancy
- **Weak/repositioning**: 24-36+ months to stabilization

### Lease-Up Risk Factors
- Starting occupancy <60% = extended timeline
- Competitive new supply = slower absorption
- Seasonal market = limited lease-up windows
- Major renovation = temporary occupancy disruption

## Pro Forma Validation

### Revenue Growth Red Flags
- Rate growth >5% without market support
- Occupancy assumptions >95% (unrealistic)
- New revenue streams without operational plan
- Fuel margin assumptions >$0.50/gallon

### Expense Red Flags  
- Expense ratio <45% (likely understated)
- No capex reserve (<2% of revenue)
- Insurance estimate too low (verify quotes)
- Property tax not reflecting purchase price

### Model Sensitivity Requirements
- Always stress test: -10% revenue, +10% expenses
- Interest rate sensitivity: +100bps and +200bps
- Exit cap rate expansion: +50bps from entry

### Conservative vs Aggressive Indicators
| Metric | Conservative | Aggressive |
|--------|--------------|------------|
| Rate growth | 2-3% | 5-8% |
| Expense inflation | 3-4% | 2% |
| Exit cap | Entry +50bps | Entry flat |
| Lease-up | 3-8 slips/mo | 15-20+ slips/mo |
| Hold period | 7-10 years | 3-5 years |
`;

const ADVISORY_SYSTEM_PROMPTS: Record<AdvisoryMode, string> = {
  general: `
You are MarinaMatch AI Advisor, an expert marina acquisition consultant. Beyond platform guidance, you serve as a strategic sounding board for investment decisions.

Your advisory capabilities:
- Analyze deals and identify potential issues
- Compare opportunities against market benchmarks
- Suggest risk mitigation strategies
- Help structure thinking on complex decisions
- Provide institutional-quality investment perspectives

When advising:
- Ask clarifying questions to understand the full picture
- Surface both opportunities and risks
- Reference industry benchmarks and best practices
- Be direct about concerns while remaining constructive
- Think like a seasoned marina investor
`,

  critique: `
You are in CRITIQUE MODE. Your job is to stress-test the user's assumptions and identify potential weaknesses.

Structure your critique as:
1. **What Could Go Wrong**: Identify 3-5 specific risks or weaknesses
2. **Hidden Assumptions**: Point out assumptions that may not hold
3. **Market Concerns**: Compare against industry norms and flag deviations
4. **Operational Risks**: Identify execution challenges
5. **Recommendations**: Suggest specific actions to address each concern

Be direct but constructive. The goal is to help them avoid costly mistakes, not discourage them.
`,

  risk_analysis: `
You are in RISK ANALYSIS MODE. Provide a comprehensive risk assessment.

Structure your analysis as:
1. **Risk Register**: List all identified risks with severity (High/Medium/Low)
2. **Probability Assessment**: Likelihood of each risk materializing
3. **Impact Analysis**: Financial and operational impact if risk occurs
4. **Mitigation Strategies**: Specific actions to reduce each risk
5. **Residual Risk**: What remains after mitigation

Categories to consider:
- Market/Economic risks
- Operational/Execution risks
- Environmental/Regulatory risks
- Financial/Capital structure risks
- Legal/Title risks
- Competition risks
`,

  benchmark_comparison: `
You are in BENCHMARK COMPARISON MODE. Compare the deal/asset against industry standards.

Structure your comparison as:
1. **Valuation Metrics**: Cap rate, price per slip, NOI multiple vs market
2. **Operating Performance**: Occupancy, expense ratio, revenue per slip vs peers
3. **Revenue Mix**: Compare to optimal marina revenue distribution
4. **Rate Analysis**: Slip rates vs market, room for increases
5. **Competitive Position**: How does this asset rank in its market?

Flag significant deviations (>10-15% from benchmarks) and explain implications.
`,

  options_analysis: `
You are in OPTIONS ANALYSIS MODE. Help the user think through alternatives.

Structure your analysis as:
1. **Options Identified**: List distinct strategic options (proceed, pass, renegotiate, etc.)
2. **Pros & Cons**: For each option, list key advantages and disadvantages
3. **Financial Impact**: Estimated impact on returns for each option
4. **Risk Comparison**: How risk profile changes with each option
5. **Recommendation**: Your suggested path with reasoning

Be comprehensive but decisive. Provide a clear recommendation.
`,

  decision_memo: `
You are in DECISION MEMO MODE. Generate a structured investment memo.

Structure the memo as:
1. **Executive Summary**: 2-3 sentence investment thesis
2. **Deal Overview**: Key terms and structure
3. **Investment Highlights**: Top 3-5 reasons to proceed
4. **Key Risks & Mitigants**: Major concerns and how they're addressed
5. **Financial Summary**: Key metrics, returns, sensitivity ranges
6. **Recommendation**: Clear GO/NO-GO with confidence level
7. **Next Steps**: Required actions if proceeding

Write in a professional, institutional tone suitable for an investment committee.
`,

  stress_test: `
You are in STRESS TEST MODE. Analyze how the investment performs under adverse scenarios.

Test the following scenarios:
1. **Recession Scenario**: 20% revenue decline, 30% occupancy drop
2. **Rising Rates**: +200bps on debt, refinance risk
3. **Competition**: New marina opens nearby, 15% rate pressure
4. **Environmental**: Major repair need ($500K+), hurricane impact
5. **Operational**: Key staff departure, fuel compliance issue

For each scenario:
- Estimate impact on NOI and cash flow
- Assess whether investment still works
- Identify breaking points
- Suggest protective measures
`,

  next_actions: `
You are in NEXT ACTIONS MODE. Provide clear, prioritized action items.

Structure your recommendations as:
1. **Immediate Actions** (This Week): Urgent items that can't wait
2. **Short-Term Actions** (This Month): Important next steps
3. **Due Diligence Items**: Specific questions to answer, documents to request
4. **Stakeholder Actions**: Who to talk to, approvals needed
5. **Decision Points**: Key go/no-go moments and their criteria

Be specific and actionable. Include who should do what and by when.
`
};

const PLATFORM_KNOWLEDGE = `
## MarinaMatch Platform Overview

MarinaMatch is an institutional-grade marina acquisition and management platform covering the full investment lifecycle:

### Modules
- **CRM**: Deals, leads, contacts, companies, properties - pipeline management
- **Due Diligence**: DD projects with tasks, timelines, document tracking
- **Modeling**: Financial modeling with exit strategies, scenarios, capital stack
- **Rent Roll**: Tenant management, lease tracking, occupancy analytics
- **Sales Comps**: Transaction comparables for valuation analysis
- **DockTalk**: Industry news and intelligence aggregation
- **VDR**: Secure document management with permissions

### Key Workflows
1. **Deal Sourcing** (CRM): Track leads → qualify → create deal → move through pipeline
2. **Due Diligence**: Create DD project from deal → assign tasks → track completion
3. **Valuation** (Modeling): Build model → run scenarios → calculate exit strategies
4. **Operations Analysis** (Rent Roll): Analyze tenant mix → occupancy → cash flows
5. **Market Analysis** (Sales Comps): Compare to recent transactions → benchmark pricing
`;

const PAGE_CONTEXT_PROMPTS: Record<string, string> = {
  '/': 'User is on the Dashboard viewing key metrics and quick access items.',
  '/crm': 'User is in the CRM module managing deals, contacts, companies, and properties.',
  '/crm/deals': 'User is viewing Deals - potential or active marina acquisitions.',
  '/crm/contacts': 'User is viewing Contacts associated with deals and properties.',
  '/crm/companies': 'User is viewing Companies involved in transactions.',
  '/crm/properties': 'User is viewing Properties representing marina assets.',
  '/crm/pipeline': 'User is viewing the Pipeline board with deals by stage.',
  '/dd': 'User is in Due Diligence managing DD projects.',
  '/dd/projects': 'User is viewing Due Diligence projects list.',
  '/modeling': 'User is in Modeling for financial analysis and valuation.',
  '/rent-roll': 'User is in Rent Roll managing tenants and leases.',
  '/sales-comps': 'User is in Sales Comps for transaction comparables.',
  '/docktalk': 'User is in DockTalk for industry news and intelligence.',
  '/vdr': 'User is in the Virtual Data Room for document management.',
  '/analytics': 'User is viewing Analytics for cross-module insights.',
};

async function getTenantContext(orgId: string, context: AssistantContext): Promise<string> {
  if (!orgId) return '';
  
  try {
    let tenantData = '';
    
    const [deals, models, ddProjects, properties, comps] = await Promise.all([
      db.select({
        id: crmDeals.id,
        name: crmDeals.name,
        stage: crmDeals.stage,
        value: crmDeals.value,
        status: crmDeals.status
      })
      .from(crmDeals)
      .where(eq(crmDeals.ownerId, orgId))
      .orderBy(desc(crmDeals.updatedAt))
      .limit(10),
      
      db.select({
        id: modelingProjects.id,
        name: modelingProjects.name,
        status: modelingProjects.status,
        acquisitionPrice: modelingProjects.acquisitionPrice,
        capRate: modelingProjects.capRate
      })
      .from(modelingProjects)
      .where(eq(modelingProjects.orgId, orgId))
      .orderBy(desc(modelingProjects.updatedAt))
      .limit(10),
      
      db.select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
        completedTasks: projects.completedTasks,
        totalTasks: projects.totalTasks
      })
      .from(projects)
      .where(eq(projects.orgId, orgId))
      .orderBy(desc(projects.updatedAt))
      .limit(10),
      
      db.select({
        id: crmProperties.id,
        name: crmProperties.name,
        city: crmProperties.city,
        state: crmProperties.state,
        status: crmProperties.status
      })
      .from(crmProperties)
      .where(eq(crmProperties.orgId, orgId))
      .orderBy(desc(crmProperties.updatedAt))
      .limit(10),
      
      db.select({
        id: salesComps.id,
        marinaName: salesComps.marinaName,
        salePrice: salesComps.salePrice,
        capRate: salesComps.capRate,
        totalSlips: salesComps.totalSlips
      })
      .from(salesComps)
      .where(eq(salesComps.orgId, orgId))
      .orderBy(desc(salesComps.updatedAt))
      .limit(10)
    ]);

    if (deals.length > 0) {
      const activeDeals = deals.filter(d => d.status === 'active');
      const totalValue = deals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
      tenantData += `\n\n**Your Active Deals**: ${activeDeals.length} deals, $${(totalValue / 1000000).toFixed(1)}M total pipeline value`;
      tenantData += `\nRecent deals: ${deals.slice(0, 3).map(d => `${d.name} (${d.stage})`).join(', ')}`;
    }

    if (models.length > 0) {
      tenantData += `\n\n**Your Modeling Projects**: ${models.length} models`;
      tenantData += `\nRecent models: ${models.slice(0, 3).map(m => `${m.name} ($${((Number(m.acquisitionPrice) || 0) / 1000000).toFixed(1)}M, ${m.capRate || 'N/A'}% cap)`).join(', ')}`;
    }

    if (ddProjects.length > 0) {
      const inProgress = ddProjects.filter(p => p.status === 'in-progress');
      tenantData += `\n\n**Your Due Diligence**: ${ddProjects.length} total, ${inProgress.length} in progress`;
    }

    if (properties.length > 0) {
      tenantData += `\n\n**Your Properties**: ${properties.length} properties tracked`;
      tenantData += `\nLocations: ${[...new Set(properties.map(p => p.state).filter(Boolean))].join(', ')}`;
    }

    if (comps.length > 0) {
      const avgCap = comps.filter(c => c.capRate).reduce((sum, c, _, arr) => sum + (Number(c.capRate) || 0) / arr.length, 0);
      tenantData += `\n\n**Your Sales Comps**: ${comps.length} comparables, avg ${avgCap.toFixed(1)}% cap rate`;
    }

    return tenantData ? `\n\n## Your Organization's Data Context${tenantData}` : '';
  } catch (error) {
    console.error('[AI Assistant] Error fetching tenant context:', error);
    return '';
  }
}

function buildSystemPrompt(context: AssistantContext, tenantContext: string): string {
  const mode = context.advisoryMode || 'general';
  const advisoryPrompt = ADVISORY_SYSTEM_PROMPTS[mode];
  
  let systemPrompt = advisoryPrompt + '\n\n' + PLATFORM_KNOWLEDGE + '\n\n' + MARINA_INDUSTRY_KNOWLEDGE;
  
  const pageContext = Object.entries(PAGE_CONTEXT_PROMPTS).find(([path]) => 
    context.currentPage.startsWith(path) && path !== '/'
  );
  
  if (pageContext) {
    systemPrompt += `\n\n**Current Context**: ${pageContext[1]}`;
  } else if (context.currentPage === '/') {
    systemPrompt += `\n\n**Current Context**: ${PAGE_CONTEXT_PROMPTS['/']}`;
  }
  
  if (context.entityType && context.entityName) {
    systemPrompt += `\n**Viewing**: ${context.entityType} - "${context.entityName}"`;
  }
  
  if (context.entityData) {
    systemPrompt += `\n\n**Entity Details**:\n${JSON.stringify(context.entityData, null, 2)}`;
  }
  
  if (tenantContext) {
    systemPrompt += tenantContext;
  }
  
  return systemPrompt;
}

export async function chat(
  userMessage: string,
  context: AssistantContext,
  conversationHistory: ConversationMessage[] = []
): Promise<string> {
  const tenantContext = await getTenantContext(context.orgId || '', context);
  const systemPrompt = buildSystemPrompt(context, tenantContext);
  
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10).map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    })),
    { role: 'user', content: userMessage }
  ];
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5',
      messages,
      max_completion_tokens: 2048,
    });
    
    return response.choices[0].message.content || "I'm sorry, I couldn't generate a response. Please try again.";
  } catch (error: any) {
    console.error('[AI Assistant] Error:', error);
    throw new Error('Failed to get AI response: ' + error.message);
  }
}

export async function* chatStream(
  userMessage: string,
  context: AssistantContext,
  conversationHistory: ConversationMessage[] = []
): AsyncGenerator<string> {
  const tenantContext = await getTenantContext(context.orgId || '', context);
  const systemPrompt = buildSystemPrompt(context, tenantContext);
  
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10).map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    })),
    { role: 'user', content: userMessage }
  ];
  
  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-5',
      messages,
      max_completion_tokens: 2048,
      stream: true,
    });
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  } catch (error: any) {
    console.error('[AI Assistant] Stream error:', error);
    throw new Error('Failed to stream AI response: ' + error.message);
  }
}

export function getSuggestedQuestions(currentPage: string, advisoryMode?: AdvisoryMode): string[] {
  const advisoryQuestions = [
    "What are the biggest risks with this deal?",
    "How does this compare to market benchmarks?",
    "What should I be asking that I'm not?",
  ];

  const pageQuestions: Record<string, string[]> = {
    '/': [
      "Review my pipeline - any concerns?",
      "Which deals should I prioritize?",
      "What metrics indicate a good marina investment?",
      "How is my portfolio performing vs benchmarks?",
    ],
    '/crm': [
      "What makes a marina deal worth pursuing?",
      "Help me qualify this lead",
      "What should I look for in initial screening?",
    ],
    '/crm/deals': [
      "Critique this deal for me",
      "What are typical deal breakers?",
      "Is this pricing in line with the market?",
      "What questions should I ask the seller?",
    ],
    '/crm/pipeline': [
      "Which deals have the highest risk?",
      "Are any deals stalled that need attention?",
      "Help me prioritize my pipeline",
    ],
    '/modeling': [
      "Are my assumptions reasonable?",
      "Stress test this model for me",
      "What cap rate should I use?",
      "Is my exit strategy realistic?",
      "What's driving the returns?",
      "Compare my model to market benchmarks",
    ],
    '/dd': [
      "What should my DD checklist include?",
      "What are common DD red flags?",
      "Am I missing any critical DD items?",
      "What's a reasonable DD timeline?",
    ],
    '/rent-roll': [
      "Is this occupancy healthy?",
      "Are the rates at market?",
      "What's the tenant concentration risk?",
      "How does seasonality affect this asset?",
    ],
    '/sales-comps': [
      "How does this compare to recent transactions?",
      "What's the market cap rate trend?",
      "Is the seller's pricing justified?",
      "What adjustments should I make to comps?",
    ],
  };
  
  const matchedPath = Object.keys(pageQuestions).find(path => 
    currentPage.startsWith(path) && path !== '/'
  ) || (currentPage === '/' ? '/' : null);
  
  if (matchedPath && pageQuestions[matchedPath]) {
    return [...pageQuestions[matchedPath], ...advisoryQuestions].slice(0, 6);
  }
  
  return advisoryQuestions;
}

export function getAdvisoryModes(): { id: AdvisoryMode; name: string; description: string; icon: string }[] {
  return [
    { id: 'general', name: 'General', description: 'General questions and guidance', icon: 'MessageCircle' },
    { id: 'critique', name: 'Critique', description: 'Challenge my assumptions', icon: 'AlertTriangle' },
    { id: 'risk_analysis', name: 'Risk Analysis', description: 'Comprehensive risk assessment', icon: 'Shield' },
    { id: 'benchmark_comparison', name: 'Benchmark', description: 'Compare to market standards', icon: 'BarChart' },
    { id: 'options_analysis', name: 'Options', description: 'Analyze alternatives', icon: 'GitBranch' },
    { id: 'decision_memo', name: 'Decision Memo', description: 'Generate investment memo', icon: 'FileText' },
    { id: 'stress_test', name: 'Stress Test', description: 'Test adverse scenarios', icon: 'TrendingDown' },
    { id: 'next_actions', name: 'Next Actions', description: 'Prioritized action items', icon: 'CheckSquare' },
  ];
}

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

export async function recordFeedback(feedback: Omit<AssistantFeedback, 'id' | 'timestamp'>): Promise<AssistantFeedback> {
  try {
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
    
    console.log(`[AI Assistant] Feedback recorded: ${result.rating} for mode=${result.advisoryMode} page=${result.page}`);
    return {
      id: result.id,
      userId: result.userId,
      orgId: result.orgId,
      messageId: result.messageId,
      rating: result.rating as 'positive' | 'negative',
      advisoryMode: result.advisoryMode as AdvisoryMode,
      page: result.page,
      timestamp: result.createdAt,
      messageContent: result.messageContent || undefined,
      userQuery: result.userQuery || undefined,
    };
  } catch (error) {
    console.error('[AI Assistant] Error recording feedback:', error);
    throw error;
  }
}

export async function getFeedbackStats(orgId: string): Promise<{ positive: number; negative: number; byMode: Record<string, { positive: number; negative: number }> }> {
  try {
    const orgFeedback = await db.select()
      .from(aiAssistantFeedback)
      .where(eq(aiAssistantFeedback.orgId, orgId));
    
    const stats = {
      positive: orgFeedback.filter(f => f.rating === 'positive').length,
      negative: orgFeedback.filter(f => f.rating === 'negative').length,
      byMode: {} as Record<string, { positive: number; negative: number }>
    };
    
    for (const f of orgFeedback) {
      if (!stats.byMode[f.advisoryMode]) {
        stats.byMode[f.advisoryMode] = { positive: 0, negative: 0 };
      }
      const rating = f.rating as 'positive' | 'negative';
      stats.byMode[f.advisoryMode][rating]++;
    }
    
    return stats;
  } catch (error) {
    console.error('[AI Assistant] Error getting feedback stats:', error);
    return { positive: 0, negative: 0, byMode: {} };
  }
}
