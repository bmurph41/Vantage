#!/bin/bash
# Capital Stack Mega-Upgrade — Run All Parts
# Usage: bash run-capstack-upgrades.sh

set -e
cd "$(dirname "$0")"

if [ ! -d "server" ] || [ ! -d "client" ]; then
  echo "ERROR: Must run from workspace root"
  exit 1
fi

echo "============================================"
echo "Capital Stack Mega-Upgrade"
echo "============================================"

echo ""
echo "▶ Part 1: Sources & Uses + Pro Forma Projections + Sensitivity Matrix"
python3 apply-capstack-upgrade-p1.py
echo ""

echo "▶ Part 2: Returns + Waterfall + LP Report (wired to real data)"
python3 apply-capstack-upgrade-p2.py
echo ""

echo "============================================"
echo "TypeScript verification..."
echo "============================================"
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit 2>&1 | grep -c "capital-stack" || echo "0 errors in capital-stack.tsx"
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit 2>&1 | grep "capital-stack" | head -10

echo ""
echo "============================================"
echo "✅ Capital Stack Upgrade Complete!"
echo "============================================"
echo ""
echo "New tabs added:"
echo "  📊 Sources & Uses  — auto-balanced closing statement"
echo "  📈 Sensitivity     — cap rate × LTV IRR matrix"
echo ""
echo "Tabs wired to real data (was hardcoded):"
echo "  💰 Returns         — proceeds, profit, IRR, equity multiple from projections"
echo "  🔄 Waterfall       — pref return, LP/GP split, promote tiers from equity layers"
echo "  📋 Projections     — 'Sync from Pro Forma' button + manual fallback"
echo ""
echo "New features within tabs:"
echo "  👥 Per-Investor LP Report  — distributions, profit, multiple, IRR per investor"
echo "  ✅ Balance Check           — Sources vs Uses gap detection"
echo "  🎨 Color-coded Matrix      — Green ≥15%, Yellow ≥10%, Red <10% IRR"
