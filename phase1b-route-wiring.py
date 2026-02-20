"""
Phase 1B: Route Wiring — Capital Stack + Deal Pricing → Pro Forma
==================================================================
Updates the projection generation routes to automatically fetch Pro Forma
data and feed it into Capital Stack and Deal Pricing, ensuring a single
source of truth for all financial numbers.

Run: python3 phase1b-route-wiring.py
"""
import os, sys, subprocess

def read(p):
    with open(p) as f: return f.read()
def write(p, c):
    with open(p,'w') as f: f.write(c)

changes = 0

# ================================================================
# 1. Find where generateProjections is called in routes
# ================================================================
print("=== 1. Scanning route integration points ===")

result = subprocess.run(
    ['grep', '-rn', 'generateProjections\|capitalStackService\|capital-stack', 'server/routes.ts'],
    capture_output=True, text=True
)
for line in result.stdout.strip().split('\n')[:15]:
    print(f"  {line}")

# Also check for a dedicated capital stack routes file
result2 = subprocess.run(
    ['grep', '-rn', 'generateProjections', 'server/'],
    capture_output=True, text=True
)
proj_routes = []
for line in result2.stdout.strip().split('\n'):
    if 'node_modules' not in line and '.test.' not in line:
        proj_routes.append(line)
        
print(f"\n  Found {len(proj_routes)} call sites:")
for line in proj_routes[:15]:
    print(f"    {line}")

# ================================================================
# 2. Patch routes.ts — Add Pro Forma-fed projection endpoint
# ================================================================
print("\n=== 2. Add /api/capital-stack/:id/projections/pro-forma endpoint ===")

ROUTES = "server/routes.ts"
c = read(ROUTES)

# Find existing capital stack projection endpoint pattern
# We'll add a new endpoint that fetches pro forma and feeds it in
new_endpoint = '''
  // ============================================================================
  // CAPITAL STACK: Pro Forma-Fed Projections (Single Source of Truth)
  // ============================================================================
  app.post('/api/capital-stack/:capitalStackId/projections/from-pro-forma', authenticateUser, enforceTenant, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { capitalStackId } = req.params;
      const { projectId, scenario = 'base' } = req.body;
      
      if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
      }
      
      // Fetch actual Pro Forma projections
      const { proFormaEngineService } = await import('./services/pro-forma-engine-service');
      const proForma = await proFormaEngineService.generateProForma(projectId, orgId, scenario);
      
      // Build the bridge data object from Pro Forma output
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
      const projections = await capitalStackService.generateProjectionsFromProForma(
        orgId,
        capitalStackId,
        proFormaData
      );
      
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
      console.error('Failed to generate Pro Forma-fed projections:', error);
      res.status(500).json({ error: error.message || 'Failed to generate projections' });
    }
  });
'''

# Find a good insertion point — after existing capital stack routes
# Look for a capital stack route pattern
cs_marker = "capital-stack"
if cs_marker in c:
    # Find the last capital stack route
    last_cs_idx = c.rfind(cs_marker)
    # Find the end of that route handler (next app.get/app.post/app.put/app.delete or section comment)
    insert_after = c.find('\n  app.', last_cs_idx + 100)
    if insert_after == -1:
        insert_after = c.find('\n  // ====', last_cs_idx + 100)
    
    if insert_after > 0 and 'projections/from-pro-forma' not in c:
        c = c[:insert_after] + new_endpoint + c[insert_after:]
        changes += 1
        print("  ✓ Added POST /api/capital-stack/:id/projections/from-pro-forma")
else:
    print("  ⚠ Could not find capital-stack routes in routes.ts — adding at end of file")
    # Fallback: find a good spot near the end
    if 'projections/from-pro-forma' not in c:
        # Find the last route section
        last_app = c.rfind('\n  app.')
        if last_app > 0:
            insert_after = c.find('\n', last_app + 5)
            # Find end of that handler
            brace_count = 0
            i = insert_after
            while i < len(c):
                if c[i] == '{': brace_count += 1
                elif c[i] == '}': 
                    brace_count -= 1
                    if brace_count == 0:
                        insert_after = i + 1
                        break
                i += 1
            c = c[:insert_after] + new_endpoint + c[insert_after:]
            changes += 1
            print("  ✓ Added POST /api/capital-stack/:id/projections/from-pro-forma (end of routes)")

# ================================================================
# 3. Add Pro Forma-fed Deal Pricing endpoint
# ================================================================
print("\n=== 3. Add /api/deal-pricing/from-pro-forma endpoint ===")

pricing_endpoint = '''
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
      
      // Fetch actual Pro Forma projections
      const { proFormaEngineService } = await import('./services/pro-forma-engine-service');
      const proForma = await proFormaEngineService.generateProForma(projectId, orgId, scenario);
      const m = proForma.metrics;
      
      const { dealPricingService } = await import('./services/deal-pricing-service');
      
      let result: any;
      
      if (targetMetric === 'irr') {
        // Solve for purchase price that achieves target IRR using actual Pro Forma cash flows
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
        
        result = dealPricingService.solveForPriceFromProForma(
          proFormaCashFlows,
          targetValue / 100,  // Convert % to decimal
          m.exitValue
        );
      } else if (targetMetric === 'cap_rate') {
        result = {
          purchasePrice: dealPricingService.solveForPriceFromCapRate(proForma.noi[0] || 0, targetValue),
          metricType: 'cap_rate',
          year1CapRate: targetValue,
        };
      } else if (targetMetric === 'year_cap_rate') {
        const yearIdx = Math.min((req.body.targetYear || 3) - 1, proForma.noi.length - 1);
        result = {
          purchasePrice: dealPricingService.solveForPriceFromCapRate(proForma.noi[yearIdx] || 0, targetValue),
          metricType: 'year_cap_rate',
          targetYear: yearIdx + 1,
          targetYearNoi: proForma.noi[yearIdx],
        };
      }
      
      res.json({
        ...result,
        source: 'pro_forma',
        proFormaMetrics: {
          irr: m.irr,
          unleveredIrr: m.unleveredIrr,
          equityMultiple: m.equityMultiple,
          exitValue: m.exitValue,
          year1Noi: m.year1Noi,
          noiByYear: proForma.noi,
        }
      });
    } catch (error: any) {
      console.error('Failed Pro Forma-fed pricing:', error);
      res.status(500).json({ error: error.message || 'Failed to solve pricing' });
    }
  });
'''

if 'solve-from-pro-forma' not in c:
    # Add after the capital stack endpoint we just added
    marker = "projections/from-pro-forma"
    if marker in c:
        # Find end of that handler
        idx = c.find(marker)
        # Find the closing of the handler (});)
        close_idx = idx
        brace_count = 0
        found_first = False
        while close_idx < len(c):
            if c[close_idx] == '{': 
                brace_count += 1
                found_first = True
            elif c[close_idx] == '}':
                brace_count -= 1
                if found_first and brace_count == 0:
                    # Find the next });
                    next_close = c.find('});', close_idx)
                    if next_close > 0:
                        insert_at = next_close + 3
                        c = c[:insert_at] + pricing_endpoint + c[insert_at:]
                        changes += 1
                        print("  ✓ Added POST /api/deal-pricing/solve-from-pro-forma")
                    break
            close_idx += 1
    else:
        print("  ⚠ Inserting pricing endpoint at end of capital stack section")

write(ROUTES, c)

print(f"\n=== DONE: {changes} route patches ===")
print("  - POST /api/capital-stack/:id/projections/from-pro-forma")
print("    → Fetches Pro Forma, feeds NOI/revenue/expenses/capex into Capital Stack")
print("  - POST /api/deal-pricing/solve-from-pro-forma")  
print("    → Solves for price using actual Pro Forma cash flows")
print("\n  Next: Run phase1c for deal-pricing-service.ts method additions")
