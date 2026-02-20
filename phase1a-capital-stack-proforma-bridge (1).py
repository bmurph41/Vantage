"""
Phase 1A: Capital Stack ← Pro Forma Bridge
============================================
Makes capital-stack-service.generateProjections() consume ACTUAL Pro Forma data
instead of independently calculating NOI with hardcoded ratios.

BEFORE: NOI = baseNOI * (1 + rate)^year, revenue = NOI / 0.6 (hardcoded 60% margin)
AFTER:  NOI/revenue/expenses/capex come from Pro Forma engine output

Run: python3 phase1a-capital-stack-proforma-bridge.py
"""
import os, sys

def read(p):
    with open(p) as f: return f.read()
def write(p, c):
    with open(p,'w') as f: f.write(c)

changes = 0
CS = "server/services/capital-stack-service.ts"
c = read(CS)

# ================================================================
# 1. Add Pro Forma import at the top
# ================================================================
print("=== 1. Add Pro Forma engine import ===")

old_imports_end = "import { eq, and } from 'drizzle-orm';"
new_imports_end = """import { eq, and } from 'drizzle-orm';

// Pro Forma bridge: consume actual projections instead of independent calculations
interface ProFormaProjectionData {
  noi: number[];              // Annual NOI from pro forma
  revenue: number[];          // Annual revenue totals
  expenses: number[];         // Annual expense totals
  capex: number[];            // Annual capex from pro forma
  leveredCashFlow: number[];  // Annual levered cash flow
  cashFlowBeforeDebtService: number[];  // Annual CF before debt
  managementFee: number[];    // Annual management fee
  reserves: number[];         // Annual reserves
  holdPeriod: number;
  purchasePrice: number;
  exitValue: number;
}"""
if 'ProFormaProjectionData' not in c and old_imports_end in c:
    c = c.replace(old_imports_end, new_imports_end, 1)
    changes += 1
    print("  ✓ Added ProFormaProjectionData interface")

# ================================================================
# 2. Add generateProjectionsFromProForma() method
# ================================================================
print("\n=== 2. Add Pro Forma-based projection method ===")

# Find the end of generateProjections to add the new method after it
# We'll add it right before calculateIRR
old_calc_irr = "  calculateIRR(cashFlows: number[]"
new_method_plus_irr = """  /**
   * Generate projections using ACTUAL Pro Forma engine output.
   * This is the preferred method — ensures Capital Stack shows the same
   * numbers as the Pro Forma tab.
   */
  async generateProjectionsFromProForma(
    orgId: string,
    capitalStackId: string,
    proFormaData: ProFormaProjectionData
  ): Promise<ProjectionResult[]> {
    const stack = await this.getCapitalStackWithDetails(orgId, capitalStackId);
    if (!stack) {
      throw new Error('Capital stack not found');
    }

    const holdPeriod = proFormaData.holdPeriod;
    const totalEquity = parseFloat(stack.totalEquity?.toString() || '0');
    const purchasePrice = proFormaData.purchasePrice;
    const exitCapRate = parseFloat(stack.exitCapRate?.toString() || '0.07');

    // Clear old projections
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
      
      // Use ACTUAL Pro Forma values instead of independent calculations
      const noi = proFormaData.noi[yearIdx] || 0;
      const grossRevenue = proFormaData.revenue[yearIdx] || 0;
      const operatingExpenses = proFormaData.expenses[yearIdx] || 0;
      const capex = proFormaData.capex[yearIdx] || 0;
      const ncf = noi - capex;

      // Debt service from actual tranches
      const { totalDebtService, totalPrincipal, totalInterest } = 
        this.calculateTotalDebtService(stack.debtTranches, year);

      const cashFlowBeforeDebt = proFormaData.cashFlowBeforeDebtService[yearIdx] || (ncf);
      const cashFlowAfterDebt = proFormaData.leveredCashFlow[yearIdx] || (cashFlowBeforeDebt - totalDebtService);

      // Waterfall distribution
      const { lpDistribution, gpDistribution } = this.calculateWaterfallDistribution(
        cashFlowAfterDebt,
        stack.equityLayers,
        year,
        totalEquity
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

      const projection: ProjectionResult = {
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
      };

      results.push(projection);
    }

    // IRR from actual cash flows
    const irr = this.calculateIRR(cashFlows);

    for (const projection of results) {
      projection.irr = irr !== null ? Math.round(irr * 10000) / 100 : null;

      await db.insert(capitalStackProjections).values({
        orgId,
        capitalStackId,
        year: projection.year,
        grossRevenue: String(projection.grossRevenue),
        operatingExpenses: String(projection.operatingExpenses),
        noi: String(projection.noi),
        capex: String(projection.capex),
        ncf: String(projection.ncf),
        totalDebtService: String(projection.totalDebtService),
        principalPaydown: String(projection.principalPaydown),
        interestExpense: String(projection.interestExpense),
        cashFlowBeforeDebt: String(projection.cashFlowBeforeDebt),
        cashFlowAfterDebt: String(projection.cashFlowAfterDebt),
        lpDistribution: String(projection.lpDistribution),
        gpDistribution: String(projection.gpDistribution),
        totalDistribution: String(projection.totalDistribution),
        dscr: String(projection.dscr),
        debtYield: String(projection.debtYield),
        exitValue: projection.exitValue ? String(projection.exitValue) : null,
        loanPayoff: projection.loanPayoff ? String(projection.loanPayoff) : null,
        netSaleProceeds: projection.netSaleProceeds ? String(projection.netSaleProceeds) : null,
        cumulativeCashFlow: String(projection.cumulativeCashFlow),
        equityMultiple: String(projection.equityMultiple),
        irr: irr !== null ? String(Math.round(irr * 10000) / 100) : null,
        cashOnCash: String(projection.cashOnCash),
      });
    }

    return results;
  }

  calculateIRR(cashFlows: number[]"""

if old_calc_irr in c and 'generateProjectionsFromProForma' not in c:
    c = c.replace(old_calc_irr, new_method_plus_irr, 1)
    changes += 1
    print("  ✓ Added generateProjectionsFromProForma() method")

write(CS, c)

# ================================================================
# 3. Wire up the routes to prefer Pro Forma data
# ================================================================
print("\n=== 3. Route integration ===")

# Find capital stack projection route calls
# We need to add a route or modify existing one to pass pro forma data
# Let's check if there's a projection generation endpoint in routes
import subprocess
result = subprocess.run(
    ['grep', '-rn', 'generateProjections', 'server/routes.ts', 'server/routes/'],
    capture_output=True, text=True
)
print(f"  Routes calling generateProjections:\n{result.stdout[:500]}")

# Also check for capital stack route files
result2 = subprocess.run(
    ['grep', '-rn', 'generateProjections', 'server/'],
    capture_output=True, text=True
)
for line in result2.stdout.strip().split('\n')[:10]:
    if 'node_modules' not in line:
        print(f"    {line}")

print(f"\n=== DONE: {changes} patches applied to capital-stack-service.ts ===")
print("  - New generateProjectionsFromProForma() method added")
print("  - Accepts actual Pro Forma NOI/revenue/expenses/capex arrays")
print("  - Same waterfall/DSCR/IRR logic but with real numbers")
print("  - Old generateProjections() preserved for backward compatibility")
print("\n  Next: Run phase1b to wire up the route and phase1c for deal pricing")
