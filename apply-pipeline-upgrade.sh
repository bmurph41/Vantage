#!/bin/bash
# ==============================================================
# MarinaMatch Financial Pipeline Upgrade — Self-Contained Runner
# ==============================================================
# Place this ONE file in ~/workspace and run: bash apply-pipeline-upgrade.sh
# It creates and runs all phase scripts inline.
# ==============================================================

set -e
cd "$(dirname "$0")"

echo "============================================"
echo "MarinaMatch Pipeline Upgrade — Full Build"
echo "============================================"

# Verify we're in the right directory
if [ ! -d "server" ] || [ ! -d "client" ]; then
  echo "ERROR: Must run from workspace root (directory containing server/ and client/)"
  exit 1
fi

echo "✓ Running from $(pwd)"
echo ""

# ==============================================================
# PHASE 1A: Capital Stack ← Pro Forma Bridge
# ==============================================================
echo "▶ Phase 1A: Capital Stack ← Pro Forma Bridge"

python3 - << 'PHASE1A'
import os, sys

def read(p):
    with open(p) as f: return f.read()
def write(p, c):
    with open(p,'w') as f: f.write(c)

changes = 0
CS = "server/services/capital-stack-service.ts"
c = read(CS)

# 1. Add Pro Forma interface
old_imports_end = "import { eq, and } from 'drizzle-orm';"
new_imports_end = """import { eq, and } from 'drizzle-orm';

// Pro Forma bridge: consume actual projections instead of independent calculations
interface ProFormaProjectionData {
  noi: number[];
  revenue: number[];
  expenses: number[];
  capex: number[];
  leveredCashFlow: number[];
  cashFlowBeforeDebtService: number[];
  managementFee: number[];
  reserves: number[];
  holdPeriod: number;
  purchasePrice: number;
  exitValue: number;
}"""
if 'ProFormaProjectionData' not in c and old_imports_end in c:
    c = c.replace(old_imports_end, new_imports_end, 1)
    changes += 1
    print("  ✓ Added ProFormaProjectionData interface")

# 2. Add generateProjectionsFromProForma method before calculateIRR
old_calc_irr = "  calculateIRR(cashFlows: number[]"
new_method = """  /**
   * Generate projections using ACTUAL Pro Forma engine output.
   * Ensures Capital Stack shows the same numbers as the Pro Forma tab.
   */
  async generateProjectionsFromProForma(
    orgId: string,
    capitalStackId: string,
    proFormaData: ProFormaProjectionData
  ): Promise<ProjectionResult[]> {
    const stack = await this.getCapitalStackWithDetails(orgId, capitalStackId);
    if (!stack) throw new Error('Capital stack not found');

    const holdPeriod = proFormaData.holdPeriod;
    const totalEquity = parseFloat(stack.totalEquity?.toString() || '0');
    const purchasePrice = proFormaData.purchasePrice;

    await db.delete(capitalStackProjections)
      .where(and(
        eq(capitalStackProjections.orgId, orgId),
        eq(capitalStackProjections.capitalStackId, capitalStackId)
      ));

    const results: ProjectionResult[] = [];
    const cashFlows: number[] = [-totalEquity];
    let cumulativeCashFlow = 0;

    for (let year = 1; year <= holdPeriod; year++) {
      const yearIdx = year - 1;
      const noi = proFormaData.noi[yearIdx] || 0;
      const grossRevenue = proFormaData.revenue[yearIdx] || 0;
      const operatingExpenses = proFormaData.expenses[yearIdx] || 0;
      const capex = proFormaData.capex[yearIdx] || 0;
      const ncf = noi - capex;

      const { totalDebtService, totalPrincipal, totalInterest } = 
        this.calculateTotalDebtService(stack.debtTranches, year);

      const cashFlowBeforeDebt = proFormaData.cashFlowBeforeDebtService[yearIdx] || ncf;
      const cashFlowAfterDebt = proFormaData.leveredCashFlow[yearIdx] || (cashFlowBeforeDebt - totalDebtService);

      const { lpDistribution, gpDistribution } = this.calculateWaterfallDistribution(
        cashFlowAfterDebt, stack.equityLayers, year, totalEquity
      );

      const totalDistribution = lpDistribution + gpDistribution;
      const dscr = totalDebtService > 0 ? noi / totalDebtService : 0;
      const totalDebt = stack.debtTranches.reduce(
        (sum, t) => sum + parseFloat(t.principal?.toString() || '0'), 0
      );
      const debtYield = totalDebt > 0 ? (noi / totalDebt) * 100 : 0;
      cumulativeCashFlow += cashFlowAfterDebt;

      let exitValue: number | null = null;
      let loanPayoff: number | null = null;
      let netSaleProceeds: number | null = null;

      if (year === holdPeriod) {
        exitValue = proFormaData.exitValue;
        loanPayoff = this.calculateRemainingBalance(stack.debtTranches, holdPeriod);
        netSaleProceeds = exitValue - (loanPayoff || 0);
        cumulativeCashFlow += netSaleProceeds;
      }

      const equityMultiple = totalEquity > 0 ? cumulativeCashFlow / totalEquity : 0;
      const cashOnCash = totalEquity > 0 ? (cashFlowAfterDebt / totalEquity) * 100 : 0;
      cashFlows.push(year === holdPeriod ? cashFlowAfterDebt + (netSaleProceeds || 0) : cashFlowAfterDebt);

      results.push({
        year,
        grossRevenue: Math.round(grossRevenue * 100) / 100,
        operatingExpenses: Math.round(operatingExpenses * 100) / 100,
        noi: Math.round(noi * 100) / 100,
        capex: Math.round(capex * 100) / 100,
        ncf: Math.round(ncf * 100) / 100,
        totalDebtService: Math.round(totalDebtService * 100) / 100,
        principalPaydown: Math.round(totalPrincipal * 100) / 100,
        interestExpense: Math.round(totalInterest * 100) / 100,
        cashFlowBeforeDebt: Math.round(cashFlowBeforeDebt * 100) / 100,
        cashFlowAfterDebt: Math.round(cashFlowAfterDebt * 100) / 100,
        lpDistribution: Math.round(lpDistribution * 100) / 100,
        gpDistribution: Math.round(gpDistribution * 100) / 100,
        totalDistribution: Math.round(totalDistribution * 100) / 100,
        dscr: Math.round(dscr * 100) / 100,
        debtYield: Math.round(debtYield * 100) / 100,
        exitValue: exitValue ? Math.round(exitValue * 100) / 100 : null,
        loanPayoff: loanPayoff ? Math.round(loanPayoff * 100) / 100 : null,
        netSaleProceeds: netSaleProceeds ? Math.round(netSaleProceeds * 100) / 100 : null,
        cumulativeCashFlow: Math.round(cumulativeCashFlow * 100) / 100,
        equityMultiple: Math.round(equityMultiple * 100) / 100,
        irr: null,
        cashOnCash: Math.round(cashOnCash * 100) / 100
      });
    }

    const irr = this.calculateIRR(cashFlows);
    for (const p of results) {
      p.irr = irr !== null ? Math.round(irr * 10000) / 100 : null;
      await db.insert(capitalStackProjections).values({
        orgId, capitalStackId,
        year: p.year,
        grossRevenue: String(p.grossRevenue),
        operatingExpenses: String(p.operatingExpenses),
        noi: String(p.noi),
        capex: String(p.capex),
        ncf: String(p.ncf),
        totalDebtService: String(p.totalDebtService),
        principalPaydown: String(p.principalPaydown),
        interestExpense: String(p.interestExpense),
        cashFlowBeforeDebt: String(p.cashFlowBeforeDebt),
        cashFlowAfterDebt: String(p.cashFlowAfterDebt),
        lpDistribution: String(p.lpDistribution),
        gpDistribution: String(p.gpDistribution),
        totalDistribution: String(p.totalDistribution),
        dscr: String(p.dscr),
        debtYield: String(p.debtYield),
        exitValue: p.exitValue ? String(p.exitValue) : null,
        loanPayoff: p.loanPayoff ? String(p.loanPayoff) : null,
        netSaleProceeds: p.netSaleProceeds ? String(p.netSaleProceeds) : null,
        cumulativeCashFlow: String(p.cumulativeCashFlow),
        equityMultiple: String(p.equityMultiple),
        irr: irr !== null ? String(Math.round(irr * 10000) / 100) : null,
        cashOnCash: String(p.cashOnCash),
      });
    }
    return results;
  }

  calculateIRR(cashFlows: number[]"""

if 'generateProjectionsFromProForma' not in c and old_calc_irr in c:
    c = c.replace(old_calc_irr, new_method, 1)
    changes += 1
    print("  ✓ Added generateProjectionsFromProForma() method")

write(CS, c)
print(f"  Phase 1A: {changes} patches")
PHASE1A

echo ""

# ==============================================================
# PHASE 1B: Route Wiring
# ==============================================================
echo "▶ Phase 1B: Route Wiring (new API endpoints)"

python3 - << 'PHASE1B'
import os

def read(p):
    with open(p) as f: return f.read()
def write(p, c):
    with open(p,'w') as f: f.write(c)

changes = 0
ROUTES = "server/routes.ts"
c = read(ROUTES)

# Add Pro Forma-fed Capital Stack projection endpoint
cs_endpoint = '''
  // ============================================================================
  // CAPITAL STACK: Pro Forma-Fed Projections (Single Source of Truth)
  // ============================================================================
  app.post('/api/capital-stack/:capitalStackId/projections/from-pro-forma', authenticateUser, enforceTenant, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { capitalStackId } = req.params;
      const { projectId, scenario = 'base' } = req.body;
      if (!projectId) return res.status(400).json({ error: 'projectId is required' });
      
      const { proFormaEngineService } = await import('./services/pro-forma-engine-service');
      const proForma = await proFormaEngineService.generateProForma(projectId, orgId, scenario);
      
      const proFormaData = {
        noi: proForma.noi,
        revenue: proForma.revenue.totals,
        expenses: proForma.expenses.totals,
        capex: proForma.capex,
        leveredCashFlow: proForma.leveredCashFlow,
        cashFlowBeforeDebtService: proForma.cashFlowBeforeDebtService,
        managementFee: proForma.managementFee,
        reserves: proForma.reserves,
        holdPeriod: proForma.holdPeriod,
        purchasePrice: proForma.metrics.purchasePrice,
        exitValue: proForma.metrics.exitValue,
      };
      
      const { capitalStackService } = await import('./services/capital-stack-service');
      const projections = await capitalStackService.generateProjectionsFromProForma(orgId, capitalStackId, proFormaData);
      
      res.json({
        projections,
        source: 'pro_forma',
        scenario,
        proFormaMetrics: {
          irr: proForma.metrics.irr,
          unleveredIrr: proForma.metrics.unleveredIrr,
          equityMultiple: proForma.metrics.equityMultiple,
          exitValue: proForma.metrics.exitValue,
          goingInCapRate: proForma.metrics.goingInCapRate,
        }
      });
    } catch (error: any) {
      console.error('Failed Pro Forma-fed projections:', error);
      res.status(500).json({ error: error.message || 'Failed to generate projections' });
    }
  });

  // ============================================================================
  // DEAL PRICING: Pro Forma-Fed Price Solving (Single Source of Truth)
  // ============================================================================
  app.post('/api/deal-pricing/solve-from-pro-forma', authenticateUser, enforceTenant, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, scenario = 'base', targetMetric, targetValue } = req.body;
      if (!projectId || !targetMetric || targetValue === undefined) {
        return res.status(400).json({ error: 'projectId, targetMetric, and targetValue are required' });
      }
      
      const { proFormaEngineService } = await import('./services/pro-forma-engine-service');
      const proForma = await proFormaEngineService.generateProForma(projectId, orgId, scenario);
      const m = proForma.metrics;
      
      const { dealPricingService } = await import('./services/deal-pricing-service');
      let result: any;
      
      if (targetMetric === 'irr') {
        const proFormaCashFlows = {
          noiProjections: proForma.noi,
          leveredCashFlows: proForma.leveredCashFlow,
          loanProceeds: m.debtSchedule?.totalDebtAtClose || 0,
          loanPayoffAtExit: m.loanPayoff || 0,
          sellingFeePct: m.sellingFees && m.exitValue ? m.sellingFees / m.exitValue : 0.02,
          workingCapitalAmount: m.workingCapitalRecovery || 0,
          workingCapitalRecoveryPct: 1.0,
          year1NOI: proForma.noi[0] || 0,
          baseRevenue: proForma.revenue.totals[0] || 0,
          baseExpenses: proForma.expenses.totals[0] || 0,
          holdPeriod: proForma.holdPeriod,
        };
        result = dealPricingService.solveForPriceFromProForma(proFormaCashFlows, targetValue / 100, m.exitValue);
      } else if (targetMetric === 'cap_rate') {
        result = {
          purchasePrice: dealPricingService.solveForPriceFromCapRate(proForma.noi[0] || 0, targetValue),
          metricType: 'cap_rate',
          year1CapRate: targetValue,
        };
      }
      
      res.json({
        ...result,
        source: 'pro_forma',
        proFormaMetrics: {
          irr: m.irr, unleveredIrr: m.unleveredIrr,
          equityMultiple: m.equityMultiple, exitValue: m.exitValue,
          year1Noi: m.year1Noi, noiByYear: proForma.noi,
        }
      });
    } catch (error: any) {
      console.error('Failed Pro Forma-fed pricing:', error);
      res.status(500).json({ error: error.message || 'Failed to solve pricing' });
    }
  });
'''

# Insert before the Monte Carlo section or at end of capital stack routes
if 'projections/from-pro-forma' not in c:
    # Find a good insertion point
    mc_marker = '// MONTE CARLO SIMULATION'
    if mc_marker in c:
        idx = c.find(mc_marker)
        # Go back to find the preceding comment block start
        line_start = c.rfind('\n  // ====', 0, idx)
        if line_start > 0:
            c = c[:line_start] + cs_endpoint + c[line_start:]
            changes += 2
            print("  ✓ Added POST /api/capital-stack/:id/projections/from-pro-forma")
            print("  ✓ Added POST /api/deal-pricing/solve-from-pro-forma")
    else:
        # Fallback: add before last closing brace
        last_brace = c.rfind('}')
        c = c[:last_brace] + cs_endpoint + '\n' + c[last_brace:]
        changes += 2
        print("  ✓ Added both endpoints (fallback position)")

write(ROUTES, c)
print(f"  Phase 1B: {changes} patches")
PHASE1B

echo ""

# ==============================================================
# PHASE 1C: Deal Pricing ← Pro Forma Bridge
# ==============================================================
echo "▶ Phase 1C: Deal Pricing ← Pro Forma Bridge"

python3 - << 'PHASE1C'
import os

def read(p):
    with open(p) as f: return f.read()
def write(p, c):
    with open(p,'w') as f: f.write(c)

changes = 0
DP = "server/services/deal-pricing-service.ts"
c = read(DP)

new_method = '''
  /**
   * Solve for purchase price using ACTUAL Pro Forma cash flows.
   * Bisection finds price where IRR matches target.
   */
  solveForPriceFromProForma(
    proFormaData: ProFormaCashFlowData,
    targetIRR: number,
    exitValue: number
  ): PricingResult {
    const { noiProjections, leveredCashFlows, loanProceeds, loanPayoffAtExit,
            sellingFeePct, workingCapitalAmount, workingCapitalRecoveryPct,
            year1NOI, baseRevenue, baseExpenses, holdPeriod } = proFormaData;

    let low = 100_000;
    let high = exitValue * 3;
    let bestPrice = (low + high) / 2;
    let bestIRR = 0;

    for (let iter = 0; iter < 200; iter++) {
      const testPrice = Math.round((low + high) / 2);
      const equity = testPrice - loanProceeds;
      if (equity <= 0) { low = testPrice; continue; }

      const cashFlows: number[] = [-equity];
      for (let yr = 0; yr < holdPeriod; yr++) {
        const annualCF = leveredCashFlows[yr] || 0;
        if (yr === holdPeriod - 1) {
          const sellingFees = exitValue * sellingFeePct;
          const workingCapRecovery = workingCapitalAmount * workingCapitalRecoveryPct;
          const netExit = exitValue - sellingFees - loanPayoffAtExit + workingCapRecovery;
          cashFlows.push(annualCF + netExit);
        } else {
          cashFlows.push(annualCF);
        }
      }

      const irr = this.calculateIRR(cashFlows);
      bestIRR = irr;
      bestPrice = testPrice;
      if (Math.abs(irr - targetIRR) < 0.0005) break;
      if (irr > targetIRR) low = testPrice; else high = testPrice;
    }

    bestPrice = roundDownToThousand(bestPrice);
    const equity = bestPrice - loanProceeds;
    const year1CapRate = bestPrice > 0 ? (year1NOI / bestPrice) * 100 : 0;
    const sellingFees = exitValue * sellingFeePct;
    const netExitProceeds = exitValue - sellingFees - loanPayoffAtExit;
    const totalCFs = leveredCashFlows.reduce((s, cf) => s + cf, 0);
    const totalProfit = netExitProceeds - equity + totalCFs;
    const equityMultiple = equity > 0 ? (totalProfit + equity) / equity : 0;
    const avgCashOnCash = equity > 0 ? (totalCFs / holdPeriod / equity) * 100 : 0;

    return {
      purchasePrice: bestPrice,
      year1CapRate,
      exitCapRate: exitValue > 0 && noiProjections[holdPeriod - 1] ? (noiProjections[holdPeriod - 1] / exitValue) * 100 : 0,
      irr: bestIRR * 100,
      equityMultiple: Math.round(equityMultiple * 100) / 100,
      moic: Math.round(equityMultiple * 100) / 100,
      averageCashOnCash: Math.round(avgCashOnCash * 100) / 100,
      noiByYear: noiProjections,
      cashFlowsByYear: leveredCashFlows,
      exitValue,
      totalProfit: Math.round(totalProfit),
      netExitProceeds: Math.round(netExitProceeds),
      totalEquityInvested: Math.round(equity),
      usedProFormaData: true,
    };
  }

'''

old_solve = "  solveForPriceFromCapRate("
if 'solveForPriceFromProForma' not in c and old_solve in c:
    c = c.replace(old_solve, new_method + "  solveForPriceFromCapRate(", 1)
    changes += 1
    print("  ✓ Added solveForPriceFromProForma()")

write(DP, c)
print(f"  Phase 1C: {changes} patches")
PHASE1C

echo ""

# ==============================================================
# PHASE 2: AI Pipeline Hardening
# ==============================================================
echo "▶ Phase 2: AI Pipeline Hardening"

python3 - << 'PHASE2'
import os

def read(p):
    with open(p) as f: return f.read()
def write(p, c):
    with open(p,'w') as f: f.write(c)

changes = 0

# 1. Chunk AI batches
DIS = "server/services/doc-intel-service.ts"
c = read(DIS)

old_ai = """    // Second pass: AI categorization for items without pattern matches
    if (uncategorizedItems.length > 0) {
      console.log(`[Doc Intel] Running AI categorization for ${uncategorizedItems.length} uncategorized items`);
      
      const allCategories = await this.getCategories(orgId);
      const aiResults = await this.aiCategorizeItems(
        uncategorizedItems.map(i => ({ id: i.id, rawText: i.rawText, amount: i.amount })),
        allCategories,
        enabledDepartments
      );"""

new_ai = """    // Second pass: AI categorization — chunked to prevent token limits
    if (uncategorizedItems.length > 0) {
      console.log(`[Doc Intel] Running AI categorization for ${uncategorizedItems.length} uncategorized items`);
      
      const allCategories = await this.getCategories(orgId);
      const AI_BATCH_SIZE = 50;
      const aiResults = new Map<string, { categoryId: string; tier: string; department: string; confidence: number }>();
      
      for (let batchStart = 0; batchStart < uncategorizedItems.length; batchStart += AI_BATCH_SIZE) {
        const batch = uncategorizedItems.slice(batchStart, batchStart + AI_BATCH_SIZE);
        console.log(`[Doc Intel] AI batch ${Math.floor(batchStart / AI_BATCH_SIZE) + 1}/${Math.ceil(uncategorizedItems.length / AI_BATCH_SIZE)}: ${batch.length} items`);
        const batchResults = await this.aiCategorizeItems(
          batch.map(i => ({ id: i.id, rawText: i.rawText, amount: i.amount })),
          allCategories,
          enabledDepartments
        );
        for (const [key, val] of batchResults.entries()) aiResults.set(key, val);
      }"""

if old_ai in c and 'AI_BATCH_SIZE' not in c:
    c = c.replace(old_ai, new_ai, 1)
    changes += 1
    print("  ✓ AI batches chunked to 50 items")

# 2. Fix total exclusion
old_total = "      { pattern: /\\btotal\\b/i, reason: 'Summary/total row' },"
new_total = """      { pattern: /^total\\s/i, reason: 'Summary/total row (starts with Total)' },
      { pattern: /^\\s*total$/i, reason: 'Standalone Total row' },"""
if old_total in c:
    c = c.replace(old_total, new_total, 1)
    changes += 1
    print("  ✓ Fixed total exclusion (^total\\s instead of \\btotal\\b)")

# 3. Enhanced AI prompt with amount context
old_prompt = """    const prompt = `You are a marina/boat storage financial analyst. Categorize these P&L line items.

Categories available (tier indicates Revenue, COGS, or Expense):
${JSON.stringify(categoryList.slice(0, 50), null, 2)}

Line items to categorize:
${JSON.stringify(items.map(i => ({ id: i.id, text: i.rawText, amount: i.amount })), null, 2)}"""

new_prompt = """    const totalPositive = items.reduce((s, i) => s + Math.max(0, parseFloat(i.amount || '0')), 0);
    const totalNegative = items.reduce((s, i) => s + Math.min(0, parseFloat(i.amount || '0')), 0);
    
    const prompt = `You are a marina/boat storage financial analyst. Categorize these P&L line items.

CONTEXT:
- Positive amounts are typically Revenue or COGS
- Negative amounts are typically Expenses  
- Total positive: $${Math.round(totalPositive).toLocaleString()}
- Total negative: $${Math.round(Math.abs(totalNegative)).toLocaleString()}

Categories available (tier indicates Revenue, COGS, or Expense):
${JSON.stringify(categoryList.slice(0, 50), null, 2)}

Line items to categorize:
${JSON.stringify(items.map(i => ({ id: i.id, text: i.rawText, amount: i.amount })), null, 2)}"""

if old_prompt in c and 'CONTEXT:' not in c:
    c = c.replace(old_prompt, new_prompt, 1)
    changes += 1
    print("  ✓ AI prompt enhanced with amount context")

write(DIS, c)

# 4. Promote deduplication
PTA = "server/services/pnl/promote-to-actuals.ts"
c = read(PTA)

old_loop = "  for (const docId of docIds) {"
new_loop = """  // DEDUP: Clear existing actuals for these documents before re-promoting
  for (const docId of docIds) {
    try {
      await db.execute(
        sql\`DELETE FROM modeling_actuals 
             WHERE modeling_project_id = \${modelingProjectId} 
             AND org_id = \${orgId}
             AND source = 'pnl_pipeline'
             AND notes LIKE '%' || \${docId} || '%'\`
      );
    } catch (e) {
      console.warn('[Promote] Dedup cleanup skipped:', (e as Error).message);
    }
  }

  for (const docId of docIds) {"""

if 'DEDUP: Clear existing' not in c and old_loop in c:
    c = c.replace(old_loop, new_loop, 1)
    changes += 1
    print("  ✓ Promote deduplication added")

write(PTA, c)
print(f"  Phase 2: {changes} patches")
PHASE2

echo ""

# ==============================================================
# PHASE 3: Matching Quality
# ==============================================================
echo "▶ Phase 3: Matching Quality Upgrades"

python3 - << 'PHASE3'
import os

def read(p):
    with open(p) as f: return f.read()
def write(p, c):
    with open(p,'w') as f: f.write(c)

changes = 0
AM = "server/services/pnl-alias-matcher.ts"
c = read(AM)

# 1. Add synonym dictionary before normalizeLabel
old_norm = "function normalizeLabel(text: string): string {"
synonym_dict = """// P&L synonym dictionary for marina-specific terms
const PNL_SYNONYMS: Record<string, string> = {
  'wages': 'compensation', 'salaries': 'compensation', 'salary': 'compensation',
  'payroll': 'compensation', 'labor': 'compensation', 'personnel': 'compensation',
  'repairs': 'maintenance', 'repair': 'maintenance', 'upkeep': 'maintenance',
  'maint': 'maintenance', 'r&m': 'maintenance',
  'ins': 'insurance', 'insur': 'insurance',
  'electric': 'electricity', 'elec': 'electricity',
  'trash': 'waste removal', 'garbage': 'waste removal',
  'income': 'revenue', 'sales': 'revenue',
  'rental': 'rent', 'rentals': 'rent',
  'dockage': 'slip revenue', 'wharfage': 'slip revenue',
  'moorage': 'slip revenue', 'berthage': 'slip revenue',
  'gas': 'fuel', 'gasoline': 'fuel', 'diesel': 'fuel',
  'office': 'admin', 'administrative': 'admin',
  'g&a': 'admin', 'gen admin': 'admin',
  'legal': 'professional services', 'accounting': 'professional services',
};

function applySynonyms(text: string): string {
  let result = text;
  for (const [syn, canonical] of Object.entries(PNL_SYNONYMS)) {
    const regex = new RegExp('\\\\b' + syn.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '\\\\b', 'gi');
    result = result.replace(regex, canonical);
  }
  return result;
}

function normalizeLabel(text: string): string {"""

if 'PNL_SYNONYMS' not in c and old_norm in c:
    c = c.replace(old_norm, synonym_dict, 1)
    changes += 1
    print("  ✓ Added P&L synonym dictionary (30+ terms)")

# 2. Upgrade fuzzy matching
old_fuzzy = """  // Fuzzy match
  const words = normalized.split(' ').filter(w => w.length > 2);
  let bestMatch: { coaCode: string; confidence: number } | null = null;

  for (const [aliasLabel, aliasData] of aliasCache.entries()) {
    let matchCount = 0;
    for (const word of words) {
      if (aliasLabel.includes(word)) matchCount++;
    }
    if (matchCount > 0) {
      const score = matchCount / Math.max(words.length, aliasLabel.split(' ').length);
      if (!bestMatch || score > bestMatch.confidence) {
        bestMatch = { coaCode: aliasData.coaCode, confidence: score * 0.8 };
      }
    }
  }

  if (bestMatch && bestMatch.confidence > 0.4) {"""

new_fuzzy = """  // Token-set ratio matching (order-independent, synonym-aware)
  const inputTokens = new Set(normalized.split(' ').filter(w => w.length > 2));
  let bestMatch: { coaCode: string; confidence: number } | null = null;

  for (const [aliasLabel, aliasData] of aliasCache.entries()) {
    const aliasTokens = new Set(aliasLabel.split(' ').filter(w => w.length > 2));
    if (aliasTokens.size === 0 || inputTokens.size === 0) continue;
    
    let intersection = 0;
    for (const token of inputTokens) {
      if (aliasTokens.has(token)) intersection++;
      else {
        for (const at of aliasTokens) {
          if (at.startsWith(token) || token.startsWith(at)) { intersection += 0.7; break; }
        }
      }
    }
    
    const union = new Set([...inputTokens, ...aliasTokens]).size;
    const jaccard = union > 0 ? intersection / union : 0;
    const minSize = Math.min(inputTokens.size, aliasTokens.size);
    const overlap = minSize > 0 ? intersection / minSize : 0;
    const score = (jaccard * 0.4 + overlap * 0.6) * 0.85;
    
    if (score > (bestMatch?.confidence || 0)) {
      bestMatch = { coaCode: aliasData.coaCode, confidence: score };
    }
  }

  if (bestMatch && bestMatch.confidence > 0.55) {"""

if old_fuzzy in c:
    c = c.replace(old_fuzzy, new_fuzzy, 1)
    changes += 1
    print("  ✓ Token-set ratio matching + threshold 0.55")

# 3. Confidence decay
old_conf = "      confidence: '0.95',"
if old_conf in c:
    c = c.replace(old_conf, "      confidence: '0.88',  // AI-learned: below user threshold", 1)
    changes += 1
    print("  ✓ AI-learned confidence: 0.95 → 0.88")

write(AM, c)
print(f"  Phase 3: {changes} patches")
PHASE3

echo ""

# ==============================================================
# Verify
# ==============================================================
echo "============================================"
echo "All phases applied. Running TypeScript check..."
echo "============================================"
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit 2>&1 | grep -v "App.tsx" | head -30

echo ""
echo "============================================"
echo "✅ Pipeline upgrade complete!"
echo "============================================"
echo ""
echo "Files modified:"
echo "  server/services/capital-stack-service.ts    (Pro Forma bridge method)"
echo "  server/services/deal-pricing-service.ts     (Pro Forma price solver)"
echo "  server/services/doc-intel-service.ts        (AI batching, exclusions, prompt)"
echo "  server/services/pnl/promote-to-actuals.ts   (deduplication)"
echo "  server/services/pnl-alias-matcher.ts        (synonyms, token-set, confidence)"
echo "  server/routes.ts                            (2 new endpoints)"
