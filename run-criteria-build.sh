#!/bin/bash
# Investment Criteria — Full Feature Build
# 1. Backend API routes (CRUD)
# 2. Enhanced dealSignal with criteria-aware scoring
# 3. Wire deal-pricing.tsx to fetch + use criteria
# 4. Criteria match breakdown in signal card
# 5. Investment Criteria management page
#
# Usage: bash run-criteria-build.sh

set -e
cd "$(dirname "$0")"

if [ ! -d "server" ] || [ ! -d "client" ]; then
  echo "ERROR: Must run from workspace root"
  exit 1
fi

echo "============================================"
echo "Investment Criteria — Full Build"
echo "============================================"

echo ""
echo "▶ Step 1: Backend API Routes"
python3 apply-criteria-routes.py
echo ""

echo "▶ Step 2: Enhanced Deal Signal"
python3 apply-criteria-signal.py
echo ""

echo "▶ Step 3: Wire Deal Pricing → Criteria"
python3 apply-criteria-pricing-wire.py
echo ""

echo "▶ Step 4: Criteria Match UI + Management Page"
python3 apply-criteria-ui.py
echo ""

echo "▶ Step 5: Copy management page into place"
if [ ! -f "client/src/pages/modeling/investment-criteria.tsx" ]; then
  cp /mnt/user-data/outputs/investment-criteria.tsx client/src/pages/modeling/investment-criteria.tsx 2>/dev/null || \
  cp investment-criteria.tsx client/src/pages/modeling/investment-criteria.tsx 2>/dev/null || \
  echo "  ⚠ Could not copy. Manually copy investment-criteria.tsx to client/src/pages/modeling/"
fi

echo ""
echo "============================================"
echo "TypeScript verification..."
echo "============================================"
echo "-- dealSignal.ts --"
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit 2>&1 | grep "dealSignal" | head -3
echo "-- deal-pricing.tsx --"
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit 2>&1 | grep "deal-pricing" | head -3
echo "-- investment-criteria.tsx --"
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit 2>&1 | grep "investment-criteria" | head -3

echo ""
echo "============================================"
echo "Done! What was built:"
echo "============================================"
echo ""
echo "  BACKEND (server/routes.ts)"
echo "  ├─ GET    /api/investment-criteria         — list profiles"
echo "  ├─ GET    /api/investment-criteria/default  — active default + sub-tables"
echo "  ├─ GET    /api/investment-criteria/:id      — single profile"
echo "  ├─ POST   /api/investment-criteria          — create new profile"
echo "  ├─ PUT    /api/investment-criteria/:id      — update profile + sub-tables"
echo "  └─ DELETE /api/investment-criteria/:id      — cascade delete"
echo ""
echo "  DEAL SIGNAL (client/src/lib/dealSignal.ts)"
echo "  ├─ computeCriteriaSignal() — criteria-aware scoring"
echo "  ├─ InvestmentCriteria interface"
echo "  ├─ CriteriaMatch — per-criterion result (met/missed)"
echo "  └─ Falls back to computeDealSignal if no criteria set"
echo ""
echo "  DEAL PRICING (deal-pricing.tsx)"
echo "  ├─ Fetches /api/investment-criteria/default"
echo "  ├─ Passes userCriteria to computeCriteriaSignal"
echo "  ├─ Criteria match grid in signal card"
echo "  └─ Link to management page if no criteria"
echo ""
echo "  MANAGEMENT PAGE (investment-criteria.tsx)"
echo "  ├─ 6 tabs: Financial, Returns, Location, Operational, Size, Involvement"
echo "  ├─ Scoring weights configuration"
echo "  ├─ State selector for target locations"
echo "  ├─ Involvement level cards"
echo "  └─ Auto-loads existing criteria, saves via PUT/POST"
echo ""
echo "  ⚠ MANUAL STEP: Add route to App.tsx:"
echo '  <Route path="/modeling/investment-criteria" component={lazy(() => import("./pages/modeling/investment-criteria"))} />'
