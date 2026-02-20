# Pipeline Upgrade — Verification Test Plan

## Phase 1: Single Source of Truth

### Test 1A: Capital Stack ← Pro Forma Bridge
```bash
# 1. Open a project's Capital Stack tab
# 2. Note the NOI, Revenue, Expenses shown in year 1
# 3. Open Pro Forma tab for same project
# 4. Compare: numbers should now match EXACTLY
#
# BEFORE: Capital Stack showed NOI * (1+rate)^year, revenue = NOI/0.6
# AFTER:  Capital Stack shows actual Pro Forma projections
```

**API Test:**
```bash
curl -X POST http://localhost:5000/api/capital-stack/{capitalStackId}/projections/from-pro-forma \
  -H "Content-Type: application/json" \
  -d '{"projectId": "{projectId}", "scenario": "base"}' \
  --cookie "session=..."
```

Expected: `source: "pro_forma"` in response, NOI/revenue/expenses matching Pro Forma.

### Test 1B: Deal Pricing ← Pro Forma Bridge
```bash
# 1. Open Deal Pricing for a project
# 2. Set target IRR (e.g., 15%)
# 3. Solved price should now be based on actual Pro Forma cash flows
# 4. Compare: open Pro Forma, manually check if price yields ~15% IRR
```

**API Test:**
```bash
curl -X POST http://localhost:5000/api/deal-pricing/solve-from-pro-forma \
  -H "Content-Type: application/json" \
  -d '{"projectId": "{projectId}", "targetMetric": "irr", "targetValue": 15}' \
  --cookie "session=..."
```

Expected: `usedProFormaData: true` in response.

### Cross-Check: Numbers Consistency
| Metric | Pro Forma Tab | Capital Stack Tab | Returns Tab | Should Match? |
|--------|---------------|-------------------|-------------|---------------|
| Year 1 NOI | ✓ | ✓ (was wrong) | ✓ | YES |
| Year 1 Revenue | ✓ | ✓ (was NOI/0.6) | N/A | YES |
| Levered IRR | ✓ | ✓ (was separate calc) | ✓ | YES |
| Exit Value | ✓ | ✓ | ✓ | YES |
| Equity Multiple | ✓ | ✓ | ✓ | YES |
| Cash-on-Cash | ✓ | ✓ | ✓ (was NOI approx) | YES |

---

## Phase 2: AI Pipeline Hardening

### Test 2A: Chunked Batching
```bash
# 1. Upload a large P&L with 100+ line items
# 2. Check server logs for batch messages:
#    "[Doc Intel] AI batch 1/3: 50 items"
#    "[Doc Intel] AI batch 2/3: 50 items"
#    "[Doc Intel] AI batch 3/3: 10 items"
# 3. All items should be categorized (no silent truncation)
```

### Test 2B: Total Exclusion Fix
```bash
# 1. Upload a P&L with items like:
#    - "Total Boat Club Memberships" (revenue item)
#    - "Total Revenue" (summary — should be excluded)
#    - "Total Expenses" (summary — should be excluded)
# 2. "Total Boat Club Memberships" should NOT be excluded
# 3. "Total Revenue" and "Total Expenses" should be excluded
```

### Test 2C: Promote Deduplication
```bash
# 1. Import a document's items to actuals
# 2. Re-import the same document
# 3. Check Historical P&L — amounts should be 1x, not 2x
# 4. No duplicate rows in modelingActuals for that document
```

---

## Phase 3: Matching Quality

### Test 3A: Synonym Matching
```bash
# Upload a P&L with these line items:
#   "Dock Wages" → should match "compensation" category
#   "R&M Expenses" → should match "maintenance" category
#   "Moorage Revenue" → should match "slip revenue" category
#   "Gas Sales" → should match "fuel" category
#
# BEFORE: These would fall through to AI (no alias match)
# AFTER: Synonym dictionary catches them at alias stage
```

### Test 3B: Token-Set Matching
```bash
# Upload a P&L with:
#   "Fuel Sales Revenue" — alias bank has "Revenue from Fuel Sales"
#
# BEFORE: Word overlap = 2/3, score = 0.53 → below 0.4 threshold but poor quality
# AFTER: Token set intersection = {fuel, sales, revenue} = 3/3 = 1.0 → high quality match
```

### Test 3C: Confidence Levels
```bash
# After AI categorizes an item with high confidence:
# 1. Check pnl_line_item_aliases table
# 2. New alias should have confidence = 0.88 (not 0.95)
# 3. If user overrides the categorization:
#    - User's choice should take priority over the 0.88 alias
#    - New learning rule created at 1.0 confidence
```

---

## Regression Tests

### P&L Upload → Historical P&L Flow
1. Upload a PDF P&L document
2. Run extraction (should use geometry-based parser)
3. Items should be auto-categorized (alias → AI fallback)
4. Confirm items in review
5. Import to actuals
6. Check Historical P&L — numbers match PDF
7. Check Pro Forma — Year 1 baseline uses actuals

### Revenue Source Toggle
1. Set department to "Profit Center" mode
2. Check Pro Forma — should use PC data for that dept
3. Toggle back to "P&L Actuals" mode
4. Pro Forma should revert to uploaded P&L data

### Above/Below Line Toggle
1. Set Management Fee to "Above NOI"
2. Check Pro Forma table — Mgmt Fee appears before NOI row
3. NOI should be LOWER (mgmt fee deducted)
4. Cash Flow Before Debt should be unchanged (net effect)
5. Toggle back to "Below NOI" — numbers revert

### IRR Calculator
1. Open Returns tab
2. Pro Forma metrics card should show levered/unlevered IRR
3. KPI row should show MOIC, ROI, IRR (derived from Pro Forma)
4. No "Seed Demo Data" needed when Pro Forma has data
