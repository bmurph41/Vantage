#!/bin/bash
# =============================================================
#  MarinaMatch Platform Diagnostic
#  Reads current state across all major areas to surface
#  what's complete, what's broken, and what's high-value next
# =============================================================

echo "╔══════════════════════════════════════════════════════════╗"
echo "║         MARINAMATCH PLATFORM DIAGNOSTIC                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── 1. CRM RECORD PAGES ──────────────────────────────────────
echo "━━━ CRM RECORD PAGES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

for page in contact-record company-record property-record deal-detail; do
  file="client/src/pages/${page}.tsx"
  if [ -f "$file" ]; then
    lines=$(wc -l < "$file")
    tabs=$(grep -c "value:.*label:" "$file" 2>/dev/null || echo 0)
    echo "  $page: $lines lines, ~$tabs tabs"
    # Check which rich tabs are present
    for check in SalesComps RateComps Intel Activities Models Portfolio PropertyFMPanel; do
      grep -q "$check" "$file" && echo "    ✓ $check" || true
    done
  else
    echo "  $page: NOT FOUND"
  fi
done

echo ""
echo "━━━ TAB COMPONENT FILES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for f in ContactRecordTabs CompanyRecordTabs PropertyRecordTabs PropertyFMPanel PropertyCompsPanel RelationshipScoreBadge; do
  path="client/src/components/crm/${f}.tsx"
  [ -f "$path" ] && echo "  ✓ $f ($(wc -l < $path) lines)" || echo "  ✗ $f MISSING"
done

echo ""
echo "━━━ CRM SCHEMA — NEW COLUMNS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  crm_contacts:"
for col in crm_role source_type linked_in_url relationship_score last_contacted_at nda_on_file; do
  grep -q "$col" shared/schema.ts && echo "    ✓ $col" || echo "    ✗ $col MISSING"
done
echo "  crm_companies:"
for col in company_type aum_range aum_approx investment_mandate nda_on_file; do
  grep -q "$col" shared/schema.ts && echo "    ✓ $col" || echo "    ✗ $col MISSING"
done
echo "  crm_properties:"
for col in listing_status asking_price latitude longitude total_slips; do
  grep -q "$col" shared/schema.ts && echo "    ✓ $col" || echo "    ✗ $col MISSING"
done

echo ""
echo "━━━ KEY SERVER ROUTES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for route in "crm-relationship-score.ts" "crm-activities-routes.ts" "crm-summary-routes.ts"; do
  f="server/routes/$route"
  [ -f "$f" ] && echo "  ✓ $route ($(wc -l < $f) lines)" || echo "  ✗ $route MISSING"
done
# Check last_contacted_at in activities route
grep -q "lastContactedAt" server/routes/crm-activities-routes.ts 2>/dev/null && echo "  ✓ last_contacted_at auto-update wired" || echo "  ✗ last_contacted_at NOT wired"

echo ""
echo "━━━ FINANCIAL MODEL (DCF REFACTOR) ━━━━━━━━━━━━━━━━━━━━━━"
grep -rn "Layers 1-4\|DCF.*Refactored\|dcf.*refactor" server/routes.ts 2>/dev/null | head -3 | sed 's/^/  /'
# Check test count
if [ -f "vitest.config.ts" ] || [ -f "vitest.config.js" ]; then
  echo "  Test config: found"
fi
ls server/routes/dcf* 2>/dev/null | sed 's/^/  /' || echo "  No DCF-specific route files found"

echo ""
echo "━━━ DD / DUE DILIGENCE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ls client/src/pages/dd* 2>/dev/null | head -5 | sed 's/^/  /' || echo "  No DD pages found at root"
ls client/src/pages/due-diligence* 2>/dev/null | head -5 | sed 's/^/  /' || true
ls client/src/pages/analysis* 2>/dev/null | head -3 | sed 's/^/  /' || true
# Check if DD record page exists
[ -f "client/src/pages/dd-project-detail.tsx" ] && echo "  ✓ DD project detail page exists" || echo "  DD project detail: checking..."
find client/src/pages -name "dd*" -o -name "*due*diligence*" 2>/dev/null | head -5 | sed 's/^/  /'

echo ""
echo "━━━ NAVIGATION — ARE RECORD PAGES WIRED? ━━━━━━━━━━━━━━━━"
grep -n "crm/contacts/:id\|crm/companies/:id\|crm/properties/:id\|crm/deals/:dealId" client/src/App.tsx 2>/dev/null | sed 's/^/  /'

echo ""
echo "━━━ DATA IN THE DB (approximate) ━━━━━━━━━━━━━━━━━━━━━━━━━"
# Can't query DB directly from here, but check if test data scripts exist
ls scripts/ 2>/dev/null | head -10 | sed 's/^/  /' || echo "  No scripts/ directory"
ls db/ 2>/dev/null | head -5 | sed 's/^/  /' || echo "  No db/ directory found at root"

echo ""
echo "━━━ BILLING / FEATURE GATING ━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
grep -rn "subscription\|billing\|stripe\|feature.*gate\|entitlement\|pack.*check" client/src/ 2>/dev/null | grep -v "node_modules\|\.bak" | wc -l | xargs -I{} echo "  {} references to billing/entitlements in client/"
grep -rn "stripe\|subscription\|billing" server/ 2>/dev/null | grep -v "node_modules\|\.bak" | wc -l | xargs -I{} echo "  {} references in server/"

echo ""
echo "━━━ ONBOARDING / EMPTY STATES ━━━━━━━━━━━━━━━━━━━━━━━━━━━"
grep -rn "EmptyState\|empty.*state\|no.*contacts\|no.*companies\|no.*properties" client/src/pages/ 2>/dev/null | grep -v "\.bak" | wc -l | xargs -I{} echo "  {} empty state references in pages"
# Check if there's a demo/seed data mechanism  
grep -rn "seed\|demo.*data\|sample.*data" server/ 2>/dev/null | grep -v "node_modules\|\.bak\|CoASeed\|Marina.*seed" | head -5 | sed 's/^/  /'

echo ""
echo "━━━ OPEN HIGH-VALUE GAPS (checking for known missing items) ━━━"
# CommandPalette
grep -q "CommandPalette\|cmdk\|⌘K\|cmd.*k" client/src/components/crm/crm-sidebar.tsx 2>/dev/null && echo "  ✓ CommandPalette wired in sidebar" || echo "  ? CommandPalette wiring: unknown"
grep -q "crm/search\|crmSearch" server/routes/crm-summary-routes.ts 2>/dev/null && echo "  ✓ /api/crm/search endpoint exists" || echo "  ✗ /api/crm/search MISSING"

# Bulk CSV import
find client/src -name "*import*" -o -name "*csv*import*" 2>/dev/null | grep -v node_modules | head -3 | sed 's/^/  /'
grep -n "csv.*import\|import.*csv\|bulk.*import" client/src/pages/contacts.tsx 2>/dev/null | head -3 | sed 's/^/  /'

# Deal pipeline board
[ -f "client/src/pages/deal-workspace.tsx" ] && echo "  ✓ Deal workspace page exists ($(wc -l < client/src/pages/deal-workspace.tsx) lines)" || echo "  ✗ deal-workspace.tsx missing"

# Analytics / reporting
find client/src/pages -name "*analytic*" -o -name "*report*" -o -name "*dashboard*" 2>/dev/null | head -5 | sed 's/^/  /'

echo ""
echo "━━━ VITE BUILD — any obvious import errors? ━━━━━━━━━━━━━━"
# Quick check for obvious broken imports in new files
for f in client/src/components/crm/ContactRecordTabs.tsx client/src/components/crm/CompanyRecordTabs.tsx client/src/components/crm/PropertyRecordTabs.tsx; do
  [ -f "$f" ] || continue
  # Check all @/components imports resolve
  broken=0
  while IFS= read -r imp; do
    path=$(echo "$imp" | sed "s|@/|client/src/|g" | sed "s|'||g")
    [ -f "${path}.tsx" ] || [ -f "${path}.ts" ] || [ -f "${path}/index.tsx" ] || broken=$((broken+1))
  done < <(grep "from '@/components\|from '@/lib\|from '@/hooks" "$f" | grep -o "'@/[^']*'" | sort -u)
  echo "  $f: ~$broken unresolved imports (approx)"
done

echo ""
echo "━━━ WHAT THE APP LOOKS LIKE FROM THE OUTSIDE ━━━━━━━━━━━━━"
# Routes summary
echo "  App routes (crm section):"
grep -n "path=\"/crm" client/src/App.tsx 2>/dev/null | sed 's/^/    /'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Diagnostic complete."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
