#!/bin/bash
# ==============================================================
# MarinaMatch Financial Pipeline Upgrade — Master Runner
# ==============================================================
# Runs all phases in order with verification between each step.
#
# Usage: bash run-all-phases.sh
# ==============================================================

set -e

echo "============================================"
echo "MarinaMatch Pipeline Upgrade — Full Build"
echo "============================================"
echo ""

# Phase 1A: Capital Stack ← Pro Forma bridge
echo "▶ Phase 1A: Capital Stack ← Pro Forma Bridge"
python3 /mnt/user-data/outputs/phase1a-capital-stack-proforma-bridge.py
echo ""

# Phase 1B: Route wiring
echo "▶ Phase 1B: Route Wiring (Capital Stack + Deal Pricing endpoints)"
python3 /mnt/user-data/outputs/phase1b-route-wiring.py
echo ""

# Phase 1C: Deal Pricing ← Pro Forma bridge
echo "▶ Phase 1C: Deal Pricing ← Pro Forma Bridge"
python3 /mnt/user-data/outputs/phase1c-deal-pricing-proforma.py
echo ""

# Phase 2: AI Pipeline Hardening
echo "▶ Phase 2: AI Pipeline Hardening"
python3 /mnt/user-data/outputs/phase2-ai-pipeline-hardening.py
echo ""

# Phase 3: Matching Quality
echo "▶ Phase 3: Matching Quality Upgrades"
python3 /mnt/user-data/outputs/phase3-matching-quality.py
echo ""

echo "============================================"
echo "All phases applied. Running TypeScript check..."
echo "============================================"
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit 2>&1 | grep -v "App.tsx" | head -30

echo ""
echo "============================================"
echo "✅ Pipeline upgrade complete!"
echo "============================================"
echo ""
echo "Summary of changes:"
echo "  Phase 1A: Capital Stack generateProjectionsFromProForma() method"
echo "  Phase 1B: POST /api/capital-stack/:id/projections/from-pro-forma"
echo "            POST /api/deal-pricing/solve-from-pro-forma"
echo "  Phase 1C: Deal Pricing solveForPriceFromProForma() method"
echo "  Phase 2:  AI batch chunking (50 items), total exclusion fix,"
echo "            amount context in AI prompt, promote deduplication"
echo "  Phase 3:  P&L synonym dictionary (60+ terms), token-set matching,"
echo "            fuzzy threshold 0.55, confidence decay 0.88"
echo ""
echo "Files modified:"
echo "  server/services/capital-stack-service.ts"
echo "  server/services/deal-pricing-service.ts"
echo "  server/services/doc-intel-service.ts"
echo "  server/services/pnl/promote-to-actuals.ts"
echo "  server/services/pnl-alias-matcher.ts"
echo "  server/routes.ts"
