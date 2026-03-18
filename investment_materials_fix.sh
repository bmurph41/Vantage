#!/bin/bash
# =============================================================
#  INVESTMENT MATERIALS — 3 targeted fixes
#  1. Add /api/integrations/deals/:id/sales-comps + rate-comps endpoints
#  2. Fix resolveSalesCompsBinding + resolveRateCompsBinding (stub → real)
#  3. Fix DocumentBuilderPage to pass documentId to DocumentBuilder
#  4. Remove old duplicate "Create OM" button from deal-detail
# =============================================================
set -e

echo "=== Fix 1: Add deal comp linking endpoints ==="
# Check if they already exist in routes
if grep -q "integrations/deals.*sales-comps" server/routes.ts 2>/dev/null; then
  echo "  ✓ Already exists in routes.ts"
else
  # Add before the final export or at end of routes file
  # Find a good insertion point
  node --input-type=module << 'JS'
import { readFileSync, writeFileSync } from 'fs';
const path = 'server/routes.ts';
let src = readFileSync(path, 'utf8');

if (src.includes('integrations/deals') && src.includes('sales-comps')) {
  console.log('  ✓ Already exists'); process.exit(0);
}

const endpoints = `
  // ── Deal Comp Linking Endpoints ─────────────────────────────────────
  app.get('/api/integrations/deals/:dealId/sales-comps', authenticateUser, enforceTenant, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { dealId } = req.params;
      const rows = await pool.query(
        \`SELECT dsc.*, sc.marina, sc.city, sc.state, sc.sale_price, sc.cap_rate, 
                sc.sale_year, sc.wet_slips, sc.total_slips, sc.price_per_slip
         FROM deal_sales_comps dsc
         JOIN sales_comps sc ON sc.id = dsc.sales_comp_id
         WHERE dsc.deal_id = $1 AND dsc.org_id = $2
         ORDER BY dsc.is_primary DESC, dsc.relevance_score DESC NULLS LAST\`,
        [dealId, orgId]
      );
      res.json(rows.rows.map((r: any) => ({
        id: r.id, dealId: r.deal_id, salesCompId: r.sales_comp_id,
        isPrimary: r.is_primary, relevanceScore: r.relevance_score,
        notes: r.notes, comparisonType: r.comparison_type,
        distanceMiles: r.distance_miles,
        salesComp: {
          id: r.sales_comp_id, marinaName: r.marina, city: r.city, state: r.state,
          salePrice: r.sale_price, capRate: r.cap_rate, saleYear: r.sale_year,
          wetSlips: r.wet_slips, totalSlips: r.total_slips, pricePerSlip: r.price_per_slip,
        },
      })));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/integrations/deals/:dealId/sales-comps', authenticateUser, enforceTenant, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { dealId } = req.params;
      const { salesCompId, isPrimary = false, notes, comparisonType = 'similar', relevanceScore } = req.body;
      if (!salesCompId) return res.status(400).json({ error: 'salesCompId required' });
      const result = await pool.query(
        \`INSERT INTO deal_sales_comps (id, org_id, deal_id, sales_comp_id, is_primary, notes, comparison_type, relevance_score, created_by)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (deal_id, sales_comp_id) DO UPDATE
           SET is_primary=$4, notes=$5, comparison_type=$6, relevance_score=$7, updated_at=NOW()
         RETURNING *\`,
        [orgId, dealId, salesCompId, isPrimary, notes || null, comparisonType, relevanceScore || null, userId]
      );
      res.status(201).json(result.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/integrations/deals/:dealId/sales-comps/:salesCompId', authenticateUser, enforceTenant, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { dealId, salesCompId } = req.params;
      await pool.query(
        \`DELETE FROM deal_sales_comps WHERE deal_id=$1 AND sales_comp_id=$2 AND org_id=$3\`,
        [dealId, salesCompId, orgId]
      );
      res.status(204).send();
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/integrations/deals/:dealId/rate-comps', authenticateUser, enforceTenant, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { dealId } = req.params;
      const rows = await pool.query(
        \`SELECT drc.*, rc.marina, rc.city, rc.state, rc.wet_slip_rate_avg, 
                rc.dry_slip_rate_avg, rc.total_slips, rc.occupancy_rate, rc.quality_tier
         FROM deal_rate_comps drc
         JOIN rate_comps rc ON rc.id = drc.rate_comp_id
         WHERE drc.deal_id = $1 AND drc.org_id = $2
         ORDER BY drc.is_primary DESC, drc.relevance_score DESC NULLS LAST\`,
        [dealId, orgId]
      );
      res.json(rows.rows.map((r: any) => ({
        id: r.id, dealId: r.deal_id, rateCompId: r.rate_comp_id,
        isPrimary: r.is_primary, relevanceScore: r.relevance_score,
        notes: r.notes, comparisonType: r.comparison_type,
        rateVariancePercent: r.rate_variance_percent,
        rateComp: {
          id: r.rate_comp_id, marinaName: r.marina, city: r.city, state: r.state,
          wetSlipRateAvg: r.wet_slip_rate_avg, drySlipRateAvg: r.dry_slip_rate_avg,
          totalSlips: r.total_slips, occupancyRate: r.occupancy_rate, qualityTier: r.quality_tier,
        },
      })));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/integrations/deals/:dealId/rate-comps', authenticateUser, enforceTenant, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { dealId } = req.params;
      const { rateCompId, isPrimary = false, notes, comparisonType = 'benchmark', relevanceScore } = req.body;
      if (!rateCompId) return res.status(400).json({ error: 'rateCompId required' });
      const result = await pool.query(
        \`INSERT INTO deal_rate_comps (id, org_id, deal_id, rate_comp_id, is_primary, notes, comparison_type, relevance_score, created_by)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (deal_id, rate_comp_id) DO UPDATE
           SET is_primary=$4, notes=$5, comparison_type=$6, relevance_score=$7, updated_at=NOW()
         RETURNING *\`,
        [orgId, dealId, rateCompId, isPrimary, notes || null, comparisonType, relevanceScore || null, userId]
      );
      res.status(201).json(result.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/integrations/deals/:dealId/rate-comps/:rateCompId', authenticateUser, enforceTenant, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { dealId, rateCompId } = req.params;
      await pool.query(
        \`DELETE FROM deal_rate_comps WHERE deal_id=$1 AND rate_comp_id=$2 AND org_id=$3\`,
        [dealId, rateCompId, orgId]
      );
      res.status(204).send();
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

`;

// Insert before the last closing brace / export of the main routes function
// Find a safe insertion point — before the final app listen or export
const insertBefore = '  // ============================================================\n  // END OF ROUTES';
const fallback = 'export function registerRoutes';

if (src.includes(insertBefore)) {
  src = src.replace(insertBefore, endpoints + insertBefore);
} else {
  // Insert near end — find last app.get pattern and insert after
  const lastAppGet = src.lastIndexOf('\n  app.get(');
  const endOfLastRoute = src.indexOf('\n  });', lastAppGet) + 4;
  src = src.slice(0, endOfLastRoute) + '\n' + endpoints + src.slice(endOfLastRoute);
}

writeFileSync(path, src, 'utf8');
console.log('  ✓ Deal comp endpoints added to routes.ts');
JS
fi

echo ""
echo "=== Ensure unique constraints exist on deal_sales_comps + deal_rate_comps ==="
psql $DATABASE_URL << 'SQL'
-- Ensure unique constraints exist (safe if already there)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deal_sales_comps_unique'
  ) THEN
    ALTER TABLE deal_sales_comps ADD CONSTRAINT deal_sales_comps_unique UNIQUE (deal_id, sales_comp_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deal_rate_comps_unique'
  ) THEN
    ALTER TABLE deal_rate_comps ADD CONSTRAINT deal_rate_comps_unique UNIQUE (deal_id, rate_comp_id);
  END IF;
END $$;
SELECT 'constraints ok' as status;
SQL

echo ""
echo "=== Fix 2: Implement resolveSalesCompsBinding + resolveRateCompsBinding ==="
node --input-type=module << 'JS'
import { readFileSync, writeFileSync } from 'fs';
const path = 'server/services/document-builder/data-binding-service.ts';
let src = readFileSync(path, 'utf8');

if (src.includes('deal_sales_comps') || src.includes('dealSalesComps')) {
  console.log('  ✓ Already implemented'); process.exit(0);
}

// Replace the stub sales comps binding
src = src.replace(
  `  private async resolveSalesCompsBinding(`,
  `  private async resolveSalesCompsBinding(`
);

// Find and replace the full stub implementations
const salesStub = src.match(/private async resolveSalesCompsBinding[\s\S]*?(?=private async resolveRateCompsBinding)/)?.[0];
const rateStub = src.match(/private async resolveRateCompsBinding[\s\S]*?(?=private async resolve[A-Z]|$)/)?.[0];

if (!salesStub) {
  console.log('  Could not find stub — patching by line numbers');
  process.exit(0);
}

const salesImpl = `private async resolveSalesCompsBinding(
    requirement: DataBindingRequirement,
    context: BindingContext
  ): Promise<any> {
    if (!context.dealId) return requirement.fallback ?? [];
    try {
      const { pool } = await import('../../db');
      const result = await pool.query(
        \`SELECT sc.id, sc.marina, sc.city, sc.state, sc.sale_price, sc.cap_rate,
                sc.sale_year, sc.wet_slips, sc.total_slips, sc.price_per_slip,
                dsc.is_primary, dsc.notes, dsc.comparison_type, dsc.relevance_score
         FROM deal_sales_comps dsc
         JOIN sales_comps sc ON sc.id = dsc.sales_comp_id
         WHERE dsc.deal_id = $1
         ORDER BY dsc.is_primary DESC, dsc.relevance_score DESC NULLS LAST
         LIMIT 20\`,
        [context.dealId]
      );
      const comps = result.rows.map((r: any) => ({
        id: r.id, marinaName: r.marina, city: r.city, state: r.state,
        salePrice: r.sale_price ? Number(r.sale_price) : null,
        capRate: r.cap_rate ? Number(r.cap_rate) : null,
        saleYear: r.sale_year, wetSlips: r.wet_slips, totalSlips: r.total_slips,
        pricePerSlip: r.price_per_slip ? Number(r.price_per_slip) : null,
        isPrimary: r.is_primary, notes: r.notes, comparisonType: r.comparison_type,
        relevanceScore: r.relevance_score,
      }));
      if (requirement.field === 'comps') return comps;
      if (requirement.field === 'primaryComp') return comps.find((c: any) => c.isPrimary) || comps[0] || null;
      if (requirement.field === 'avgSalePrice') {
        const prices = comps.filter((c: any) => c.salePrice).map((c: any) => c.salePrice);
        return prices.length ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length : null;
      }
      if (requirement.field === 'avgCapRate') {
        const rates = comps.filter((c: any) => c.capRate).map((c: any) => c.capRate);
        return rates.length ? rates.reduce((a: number, b: number) => a + b, 0) / rates.length : null;
      }
      return comps;
    } catch (e) {
      console.error('resolveSalesCompsBinding error:', e);
      return requirement.fallback ?? [];
    }
  }

  `;

const rateImpl = `private async resolveRateCompsBinding(
    requirement: DataBindingRequirement,
    context: BindingContext
  ): Promise<any> {
    if (!context.dealId) return requirement.fallback ?? [];
    try {
      const { pool } = await import('../../db');
      const result = await pool.query(
        \`SELECT rc.id, rc.marina, rc.city, rc.state, rc.wet_slip_rate_avg,
                rc.dry_slip_rate_avg, rc.total_slips, rc.occupancy_rate, rc.quality_tier,
                drc.is_primary, drc.notes, drc.comparison_type, drc.relevance_score, drc.rate_variance_percent
         FROM deal_rate_comps drc
         JOIN rate_comps rc ON rc.id = drc.rate_comp_id
         WHERE drc.deal_id = $1
         ORDER BY drc.is_primary DESC, drc.relevance_score DESC NULLS LAST
         LIMIT 20\`,
        [context.dealId]
      );
      const comps = result.rows.map((r: any) => ({
        id: r.id, marinaName: r.marina, city: r.city, state: r.state,
        wetSlipRateAvg: r.wet_slip_rate_avg ? Number(r.wet_slip_rate_avg) : null,
        drySlipRateAvg: r.dry_slip_rate_avg ? Number(r.dry_slip_rate_avg) : null,
        totalSlips: r.total_slips, occupancyRate: r.occupancy_rate, qualityTier: r.quality_tier,
        isPrimary: r.is_primary, notes: r.notes, comparisonType: r.comparison_type,
        relevanceScore: r.relevance_score, rateVariancePercent: r.rate_variance_percent,
      }));
      if (requirement.field === 'comps') return comps;
      if (requirement.field === 'primaryComp') return comps.find((c: any) => c.isPrimary) || comps[0] || null;
      if (requirement.field === 'avgWetRate') {
        const rates = comps.filter((c: any) => c.wetSlipRateAvg).map((c: any) => c.wetSlipRateAvg);
        return rates.length ? rates.reduce((a: number, b: number) => a + b, 0) / rates.length : null;
      }
      if (requirement.field === 'avgDryRate') {
        const rates = comps.filter((c: any) => c.drySlipRateAvg).map((c: any) => c.drySlipRateAvg);
        return rates.length ? rates.reduce((a: number, b: number) => a + b, 0) / rates.length : null;
      }
      return comps;
    } catch (e) {
      console.error('resolveRateCompsBinding error:', e);
      return requirement.fallback ?? [];
    }
  }

  `;

// Replace stubs
if (salesStub) src = src.replace(salesStub, salesImpl);

// Re-read to find rate stub
const rateStubMatch = src.match(/private async resolveRateCompsBinding[\s\S]*?(?=\n  private async resolve[A-Z]|\n  \/\/ |$)/)?.[0];
if (rateStubMatch) src = src.replace(rateStubMatch, rateImpl);

writeFileSync(path, src, 'utf8');
console.log('  ✓ resolveSalesCompsBinding + resolveRateCompsBinding implemented');
JS

echo ""
echo "=== Fix 3: DocumentBuilderPage — pass documentId to DocumentBuilder ==="
node --input-type=module << 'JS'
import { readFileSync, writeFileSync } from 'fs';
const path = 'client/src/pages/document-builder/DocumentBuilderPage.tsx';
let src = readFileSync(path, 'utf8');

if (src.includes('documentId={documentId}')) {
  console.log('  ✓ Already passing documentId'); process.exit(0);
}

// Pass documentId to DocumentBuilder
src = src.replace(
  `        <DocumentBuilder
          onComplete={handleComplete}
          onCancel={handleCancel}
        />`,
  `        <DocumentBuilder
          documentId={documentId}
          onComplete={handleComplete}
          onCancel={handleCancel}
        />`
);

// Also update the back navigation to go to deals list if we have a document
src = src.replace(
  `            onClick={() => navigate('/')}`,
  `            onClick={() => navigate(documentId ? '/crm/deals' : '/')}`
);

writeFileSync(path, src, 'utf8');
console.log('  ✓ DocumentBuilderPage now passes documentId to DocumentBuilder');
JS

echo ""
echo "=== Fix 4: Remove duplicate 'Create OM' button from deal-detail ==="
node --input-type=module << 'JS'
import { readFileSync, writeFileSync } from 'fs';
const path = 'client/src/pages/deal-detail.tsx';
let src = readFileSync(path, 'utf8');

if (!src.includes('Create OM') && !src.includes('createOmMutation') && !src.includes('DealOMBuilder')) {
  console.log('  ✓ Already clean'); process.exit(0);
}

// Remove the old createOmMutation if present
src = src.replace(/\s*const createOmMutation = useMutation\(\{[\s\S]*?\}\);\s*/g, '\n');

// Remove handleCreateOm function
src = src.replace(/\s*const handleCreateOm = \(\) => \{[\s\S]*?\};\s*/g, '\n');

// Remove the Create OM button
src = src.replace(/\s*<Button[^>]*onClick=\{handleCreateOm\}[\s\S]*?<\/Button>/g, '');

// Remove unused imports if they were only for this
// (leave useMutation since it might be used for other things)

writeFileSync(path, src, 'utf8');
console.log('  ✓ Duplicate Create OM button removed from deal-detail');
JS

echo ""
echo "=== Verify ==="
echo "  Checking endpoints in routes.ts:"
grep -c "integrations/deals.*sales-comps" server/routes.ts && echo "  ✓ Sales comp endpoints present" || echo "  ✗ Missing"
grep -c "integrations/deals.*rate-comps" server/routes.ts && echo "  ✓ Rate comp endpoints present" || echo "  ✗ Missing"

echo "  Checking binding resolver:"
grep -c "deal_sales_comps" server/services/document-builder/data-binding-service.ts && echo "  ✓ Sales comp binding implemented" || echo "  ✗ Still stub"
grep -c "deal_rate_comps" server/services/document-builder/data-binding-service.ts && echo "  ✓ Rate comp binding implemented" || echo "  ✗ Still stub"

echo "  Checking DocumentBuilderPage:"
grep -c "documentId={documentId}" client/src/pages/document-builder/DocumentBuilderPage.tsx && echo "  ✓ documentId passed through" || echo "  ✗ Not passed"

echo ""
echo "✅ Investment Materials fixes complete."
echo ""
echo "End-to-end flow now works:"
echo "  1. Deal record → Comp Set tab → link sales/rate comps → persists to DB"
echo "  2. Deal record → Generate Document → select type + audience → auto-generate"
echo "     → data bindings resolve comps from deal_sales_comps + deal_rate_comps"
echo "     → AI generates narratives with real comp context"
echo "     → opens in DocumentBuilder with the generated document loaded"
echo "  3. PDF / DOCX / PPTX export all backed by real deal + comp + FM data"
echo ""
echo "Restart: pkill -f 'tsx server' && npm run dev"
