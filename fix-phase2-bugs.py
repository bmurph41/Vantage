#!/usr/bin/env python3
"""
Phase 2 Session 3 — Bug Fixes
Run from project root: python3 fix-phase2-bugs.py
Fixes:
  Bug 1: Pro-forma engine checks 'direct' instead of 'direct_input'
  Bug 2: Pro-forma engine missing 'auto' mode fallback to direct input
  Bug 3: Deal pricing doesn't propagate source field to API responses
  Bug 4: Hybrid mode overwrites actuals instead of merging
"""

import sys

# =============================================
# Bug 1 + 2 + 4: Pro-forma engine
# =============================================
with open('server/services/pro-forma-engine-service.ts', 'r') as f:
    content = f.read()

old_block = """    // ========================================
    // 4c. DIRECT INPUT FALLBACK
    // If no uploaded actuals, check for direct-input assumptions
    // ========================================
    const inputMode = (project as any).modelInputMode || 'auto';
    const inputAssumptions = (project.customMetrics as any)?.inputAssumptions;
    const hasUploadedActuals = Object.keys(revenueBySubcat).length > 0 || Object.keys(expensesBySubcat).length > 0;

    if (inputMode === 'direct' && !hasUploadedActuals && inputAssumptions && Object.keys(inputAssumptions).length > 0) {
      const assetClass = (project as any).assetClass || 'marina';
      const directResult = computeDirectInputFinancials(assetClass, inputAssumptions);
      if (directResult) {
        for (const line of directResult.revenueLines) {
          revenueBySubcat[line.label] = {
            amount: line.amount,
            category: 'Revenue',
            subcategory: line.label,
            department: 'Revenue',
            year: latestHistoricalYear,
          };
        }
        for (const line of directResult.expenseLines) {
          expensesBySubcat[line.label] = {
            amount: line.amount,
            category: 'Expense',
            subcategory: line.label,
            department: 'Operating Expenses',
            year: latestHistoricalYear,
          };
        }
      }
    } else if (inputMode === 'hybrid' && inputAssumptions && Object.keys(inputAssumptions).length > 0) {
      const assetClass = (project as any).assetClass || 'marina';
      const directResult = computeDirectInputFinancials(assetClass, inputAssumptions);
      if (directResult) {
        for (const line of directResult.revenueLines) {
          revenueBySubcat[line.label] = {
            amount: line.amount, category: 'Revenue',
            subcategory: line.label, department: 'Revenue',
            year: latestHistoricalYear,
          };
        }
        for (const line of directResult.expenseLines) {
          expensesBySubcat[line.label] = {
            amount: line.amount, category: 'Expense',
            subcategory: line.label, department: 'Operating Expenses',
            year: latestHistoricalYear,
          };
        }
      }
    }"""

new_block = """    // ========================================
    // 4c. DIRECT INPUT FALLBACK
    // If no uploaded actuals, check for direct-input assumptions
    // Modes: direct_input = use only computed, auto = fallback if no actuals,
    //        hybrid = merge computed lines that don't exist from actuals
    // ========================================
    const inputMode = (project as any).modelInputMode || 'auto';
    const inputAssumptions = (project.customMetrics as any)?.inputAssumptions;
    const hasUploadedActuals = Object.keys(revenueBySubcat).length > 0 || Object.keys(expensesBySubcat).length > 0;
    const hasInputAssumptions = inputAssumptions && Object.keys(inputAssumptions).length > 0;

    const shouldUseDirectInput =
      (inputMode === 'direct_input' && hasInputAssumptions) ||
      (inputMode === 'auto' && !hasUploadedActuals && hasInputAssumptions);

    if (shouldUseDirectInput) {
      const assetClass = (project as any).assetClass || 'marina';
      const directResult = computeDirectInputFinancials(assetClass, inputAssumptions);
      if (directResult) {
        for (const line of directResult.revenueLines) {
          revenueBySubcat[line.label] = {
            amount: line.amount,
            category: 'Revenue',
            subcategory: line.label,
            department: 'Revenue',
            year: latestHistoricalYear,
          };
        }
        for (const line of directResult.expenseLines) {
          expensesBySubcat[line.label] = {
            amount: line.amount,
            category: 'Expense',
            subcategory: line.label,
            department: 'Operating Expenses',
            year: latestHistoricalYear,
          };
        }
      }
    } else if (inputMode === 'hybrid' && hasInputAssumptions) {
      // Hybrid: only add direct-input lines that DON'T already exist from actuals
      const assetClass = (project as any).assetClass || 'marina';
      const directResult = computeDirectInputFinancials(assetClass, inputAssumptions);
      if (directResult) {
        for (const line of directResult.revenueLines) {
          if (!revenueBySubcat[line.label]) {
            revenueBySubcat[line.label] = {
              amount: line.amount,
              category: 'Revenue',
              subcategory: line.label,
              department: 'Revenue',
              year: latestHistoricalYear,
            };
          }
        }
        for (const line of directResult.expenseLines) {
          if (!expensesBySubcat[line.label]) {
            expensesBySubcat[line.label] = {
              amount: line.amount,
              category: 'Expense',
              subcategory: line.label,
              department: 'Operating Expenses',
              year: latestHistoricalYear,
            };
          }
        }
      }
    }"""

if old_block not in content:
    print("FATAL: Could not find 4c block in pro-forma-engine-service.ts")
    sys.exit(1)

content = content.replace(old_block, new_block)
with open('server/services/pro-forma-engine-service.ts', 'w') as f:
    f.write(content)
print("✅ Bug 1: Fixed 'direct' → 'direct_input' mode string")
print("✅ Bug 2: Added 'auto' mode fallback to direct input")
print("✅ Bug 4: Hybrid mode now merges instead of overwriting")

# =============================================
# Bug 3: Deal pricing source propagation
# =============================================
with open('server/services/deal-pricing-service.ts', 'r') as f:
    content = f.read()

old1 = """      projectFinancials: {
        year1NOI: financials.year1NOI,
        baseRevenue: financials.baseRevenue,
        baseExpenses: financials.baseExpenses,
        storedPurchasePrice: baseFinancials.purchasePrice,
      },
      noiProjections,
      proFormaIntegrated: useProForma,
      stabilizedCapRate,"""

new1 = """      projectFinancials: {
        year1NOI: financials.year1NOI,
        baseRevenue: financials.baseRevenue,
        baseExpenses: financials.baseExpenses,
        storedPurchasePrice: baseFinancials.purchasePrice,
        source: baseFinancials.source,
      },
      noiProjections,
      proFormaIntegrated: useProForma,
      stabilizedCapRate,"""

if old1 not in content:
    print("FATAL: Could not find calculateUnified block in deal-pricing-service.ts")
    sys.exit(1)
content = content.replace(old1, new1)

old2 = """      projectFinancials: {
        year1NOI: financials.year1NOI, baseRevenue: financials.baseRevenue,
        baseExpenses: financials.baseExpenses, storedPurchasePrice: baseFinancials.purchasePrice,
        selectedPeriod: inputs.periodLabel,
      },"""

new2 = """      projectFinancials: {
        year1NOI: financials.year1NOI, baseRevenue: financials.baseRevenue,
        baseExpenses: financials.baseExpenses, storedPurchasePrice: baseFinancials.purchasePrice,
        selectedPeriod: inputs.periodLabel,
        source: baseFinancials.source,
      },"""

if old2 not in content:
    print("FATAL: Could not find calculateAllPricingModes block in deal-pricing-service.ts")
    sys.exit(1)
content = content.replace(old2, new2)

with open('server/services/deal-pricing-service.ts', 'w') as f:
    f.write(content)
print("✅ Bug 3: Source field propagated in both pricing endpoints")

# =============================================
# Verification
# =============================================
print("\n=== Verification ===")
with open('server/services/pro-forma-engine-service.ts') as f:
    pf = f.read()
with open('server/services/deal-pricing-service.ts') as f:
    dp = f.read()

ok = True
for label, check in [
    ("direct_input mode string", "inputMode === 'direct_input'" in pf),
    ("auto fallback logic", "inputMode === 'auto' && !hasUploadedActuals" in pf),
    ("hybrid merge guard", "!revenueBySubcat[line.label]" in pf),
    ("source propagation (x2)", dp.count("source: baseFinancials.source") >= 2),
]:
    status = "PASS" if check else "FAIL"
    if not check: ok = False
    print(f"  {label}: {status}")

print(f"\n{'All fixes applied successfully!' if ok else 'Some fixes failed — check above.'}")
