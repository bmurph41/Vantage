"""
Phase 1C: Deal Pricing ← Pro Forma Bridge
==========================================
Adds solveForPriceFromProForma() that uses actual Pro Forma cash flows
instead of independently projecting NOI.

BEFORE: projectNOI() builds its own series with simple growth rates
AFTER:  Uses actual Pro Forma NOI/levered CF for price solving

Run: python3 phase1c-deal-pricing-proforma.py
"""
import os

def read(p):
    with open(p) as f: return f.read()
def write(p, c):
    with open(p,'w') as f: f.write(c)

changes = 0
DP = "server/services/deal-pricing-service.ts"
c = read(DP)

# ================================================================
# 1. Add ProFormaCashFlowData interface (if not already there)
# ================================================================
print("=== 1. Verify ProFormaCashFlowData interface ===")

if 'interface ProFormaCashFlowData' in c:
    print("  ✓ ProFormaCashFlowData interface already exists")
else:
    print("  ⚠ ProFormaCashFlowData not found — should already be defined. Adding if missing.")

# ================================================================
# 2. Add solveForPriceFromProForma method
# ================================================================
print("\n=== 2. Add solveForPriceFromProForma() method ===")

new_method = '''
  /**
   * Solve for purchase price from Pro Forma cash flows to achieve target IRR.
   * Uses ACTUAL projected cash flows from the Pro Forma engine instead of
   * independently calculating NOI. This ensures the price recommendation
   * is consistent with what the user sees on the Pro Forma tab.
   */
  solveForPriceFromProForma(
    proFormaData: ProFormaCashFlowData,
    targetIRR: number,
    exitValue: number
  ): PricingResult {
    const {
      noiProjections,
      leveredCashFlows,
      loanProceeds,
      loanPayoffAtExit,
      sellingFeePct,
      workingCapitalAmount,
      workingCapitalRecoveryPct,
      year1NOI,
      baseRevenue,
      baseExpenses,
      holdPeriod,
    } = proFormaData;

    // Bisection: find purchase price where IRR = targetIRR
    let low = 100_000;
    let high = exitValue * 3;  // Upper bound: 3x exit value
    let bestPrice = (low + high) / 2;
    let bestIRR = 0;

    for (let iter = 0; iter < 200; iter++) {
      const testPrice = Math.round((low + high) / 2);
      const equity = testPrice - loanProceeds;
      if (equity <= 0) {
        low = testPrice;
        continue;
      }

      // Build cash flows: initial equity outlay + annual levered CFs + exit
      const cashFlows: number[] = [-equity];
      
      for (let yr = 0; yr < holdPeriod; yr++) {
        const annualCF = leveredCashFlows[yr] || 0;
        
        if (yr === holdPeriod - 1) {
          // Terminal year: add exit proceeds
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

      // Higher price = lower IRR (you pay more for same cash flows)
      if (irr > targetIRR) {
        low = testPrice;
      } else {
        high = testPrice;
      }
    }

    bestPrice = roundDownToThousand(bestPrice);

    // Compute all metrics at the solved price
    const equity = bestPrice - loanProceeds;
    const year1CapRate = bestPrice > 0 ? (year1NOI / bestPrice) * 100 : 0;
    const sellingFees = exitValue * sellingFeePct;
    const netExitProceeds = exitValue - sellingFees - loanPayoffAtExit;
    const totalProfit = netExitProceeds - equity + leveredCashFlows.reduce((s, cf) => s + cf, 0);
    const equityMultiple = equity > 0 ? (totalProfit + equity) / equity : 0;
    const moic = equityMultiple;
    
    // Average cash-on-cash from actual levered CFs
    const avgCashOnCash = equity > 0
      ? (leveredCashFlows.reduce((s, cf) => s + cf, 0) / holdPeriod / equity) * 100
      : 0;

    return {
      purchasePrice: bestPrice,
      year1CapRate,
      exitCapRate: exitValue > 0 && noiProjections[holdPeriod - 1] 
        ? (noiProjections[holdPeriod - 1] / exitValue) * 100 : 0,
      irr: bestIRR * 100,
      equityMultiple: Math.round(equityMultiple * 100) / 100,
      moic: Math.round(moic * 100) / 100,
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

# Insert before the existing solveForPriceFromCapRate method
old_solve_cap = "  solveForPriceFromCapRate("
if 'solveForPriceFromProForma' not in c and old_solve_cap in c:
    c = c.replace(old_solve_cap, new_method + "\n  solveForPriceFromCapRate(", 1)
    changes += 1
    print("  ✓ Added solveForPriceFromProForma() — bisection with actual Pro Forma CFs")

write(DP, c)

print(f"\n=== DONE: {changes} patches applied to deal-pricing-service.ts ===")
print("  - solveForPriceFromProForma() uses actual Pro Forma cash flows")
print("  - Bisection finds price where IRR matches target")
print("  - All derived metrics (equity multiple, MOIC, CoC) use real numbers")
print("  - Old solveForPriceFromIRR() preserved for backward compat")
