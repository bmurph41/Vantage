#!/bin/bash
# Capital Stack Final Features — Run All
# 1. Refi Scenario Modeling
# 2. Fund Template Inheritance
# 3. Deal Pricing Pro Forma Wiring
#
# Usage: bash run-final-features.sh

set -e
cd "$(dirname "$0")"

if [ ! -d "server" ] || [ ! -d "client" ]; then
  echo "ERROR: Must run from workspace root"
  exit 1
fi

echo "============================================"
echo "Capital Stack Final Features"
echo "============================================"

echo ""
echo "▶ Feature 1: Refi Scenario Modeling"
python3 apply-refi-scenario.py
echo ""

echo "▶ Feature 2: Fund Template Inheritance"
python3 apply-fund-template-inherit.py
echo ""

echo "▶ Feature 3: Deal Pricing Pro Forma Wiring"
python3 apply-proforma-wiring.py
echo ""

echo "============================================"
echo "TypeScript verification..."
echo "============================================"
echo "-- capital-stack.tsx errors --"
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit 2>&1 | grep "capital-stack" | head -5
echo "-- deal-pricing.tsx errors --"
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit 2>&1 | grep "deal-pricing" | head -5

echo ""
echo "============================================"
echo "Done! Features added:"
echo "============================================"
echo ""
echo "  1. REFI SCENARIO (capital-stack.tsx)"
echo "     - New 'Refi Scenario' tab"
echo "     - Current debt stack with bridge/mezz call indicators"  
echo "     - Refi year picker, new rate/term/amort/LTV/IO inputs"
echo "     - Before vs After comparison: debt, DSCR, annual D/S, IRR"
echo "     - Cash-out refi proceeds calculation"
echo "     - Year-by-year CF comparison table with delta column"
echo ""
echo "  2. FUND TEMPLATE INHERITANCE (capital-stack.tsx)"
echo "     - Template preview in fund link dialog"
echo "     - Auto-fills equity form (pref return, promote tiers) on apply"
echo "     - Shows template config: LTV, pref return, GP/LP split, catch-up"
echo ""
echo "  3. DEAL PRICING PRO FORMA (deal-pricing.tsx)"
echo "     - 'Solve from Pro Forma' button on Return Metrics card"
echo "     - Calls /api/deal-pricing/solve-from-pro-forma endpoint"
echo "     - Shows solved price, target IRR, equity multiple, going-in cap"
echo "     - 'Save as Purchase Price' button to commit result"
