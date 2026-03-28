#!/bin/bash
# PATCH 07: Add activityCount + lastActivityDate to deals API response
# This powers the activity badges on Kanban cards (Patch 03)
# Run from workspace root: bash patch_07_deals_activity_join.sh

echo "▶ Patch 07: Activity count + last-activity-date join in /api/deals"

cat > /tmp/patch07.mjs << 'SCRIPT'
import { readFileSync, writeFileSync } from 'fs';

// This patch creates a new server route file that enriches the deals response
// with activity counts. Since we don't have the main routes.ts in the zip,
// we write an enrichment endpoint that the frontend can call separately,
// OR patch the existing crm-pipeline-enhancements-routes to add a
// GET /crm/deals/enriched endpoint.

const file = 'server/routes/crm-pipeline-enhancements-routes.ts';
let src = readFileSync(file, 'utf8');

// Add an enriched deals endpoint that joins activity counts
const ENRICHED_ENDPOINT = `
// GET /crm/deals/enriched — deals list with activity counts + last-activity-date
// Used by the Pipeline Kanban to show activity badges on deal cards
router.get('/crm/deals/enriched', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const { crmDeals, crmContacts, crmCompanies, crmActivities, crmPipelineStages } = await import('@shared/schema');
    const { eq, and, desc, sql, isNull, isNotNull, count, max, left } = await import('drizzle-orm');

    // Subquery: activity counts + last activity date per deal
    const activityStats = await db
      .select({
        dealId: crmActivities.dealId,
        activityCount: count(crmActivities.id).as('activityCount'),
        lastActivityDate: max(crmActivities.date).as('lastActivityDate'),
      })
      .from(crmActivities)
      .where(and(
        eq(crmActivities.orgId, orgId),
        isNotNull(crmActivities.dealId)
      ))
      .groupBy(crmActivities.dealId);

    // Build lookup map
    const statsMap = new Map(
      activityStats.map(s => [s.dealId, { activityCount: Number(s.activityCount), lastActivityDate: s.lastActivityDate }])
    );

    // Fetch deals with contact + company
    const deals = await db
      .select({
        deal: crmDeals,
        contact: crmContacts,
        company: crmCompanies,
      })
      .from(crmDeals)
      .leftJoin(crmContacts, eq(crmDeals.primaryContactId, crmContacts.id))
      .leftJoin(crmCompanies, eq(crmDeals.companyId, crmCompanies.id))
      .where(eq(crmDeals.orgId, orgId))
      .orderBy(desc(crmDeals.updatedAt));

    // Merge activity stats
    const enriched = deals.map(({ deal, contact, company }) => ({
      ...deal,
      contact: contact || null,
      company: company || null,
      activityCount: statsMap.get(deal.id)?.activityCount || 0,
      lastActivityDate: statsMap.get(deal.id)?.lastActivityDate || null,
    }));

    return res.json(enriched);
  } catch (error) {
    console.error('Error fetching enriched deals:', error);
    return res.status(500).json({ error: 'Failed to fetch enriched deals' });
  }
});

`;

// Find a good insertion point — before the first router.get
const firstRoute = src.indexOf('\nrouter.get(');
if (firstRoute === -1) {
  console.log('  ⚠️  Could not find first router.get — appending to end of file');
  src = src + ENRICHED_ENDPOINT;
} else if (!src.includes('/crm/deals/enriched')) {
  src = src.slice(0, firstRoute) + ENRICHED_ENDPOINT + src.slice(firstRoute);
  console.log('  ✅ Added GET /crm/deals/enriched endpoint with activity count join');
} else {
  console.log('  ℹ️  /crm/deals/enriched already exists');
}

writeFileSync(file, src);

// Now patch pipeline.tsx to use /crm/deals/enriched instead of /api/deals
const pipelineFile = 'client/src/pages/pipeline.tsx';
let pSrc = readFileSync(pipelineFile, 'utf8');

const OLD_DEALS_QUERY = `queryKey: ["/api/deals"],
  });`;
const NEW_DEALS_QUERY = `// Use enriched endpoint that includes activityCount + lastActivityDate
    queryKey: ["/api/crm/deals/enriched"],
  });`;

// Only replace the deals query in pipeline.tsx (be surgical — match the deals query context)
// The pipeline page queries deals for the kanban
const OLD_KANBAN_QUERY = `const { data: rawDeals, isLoading } = useQuery<DealWithRelations[]>({
    queryKey: ["/api/deals"],`;
const NEW_KANBAN_QUERY = `const { data: rawDeals, isLoading } = useQuery<DealWithRelations[]>({
    queryKey: ["/api/crm/deals/enriched"],`;

if (pSrc.includes(OLD_KANBAN_QUERY)) {
  pSrc = pSrc.replace(OLD_KANBAN_QUERY, NEW_KANBAN_QUERY);
  console.log('  ✅ Switched pipeline.tsx Kanban to use enriched deals endpoint');
} else {
  // Try alternate pattern
  const ALT_OLD = `  const { data: deals, isLoading } = useQuery<DealWithRelations[]>({
    queryKey: ["/api/deals"],`;
  const ALT_NEW = `  const { data: deals, isLoading } = useQuery<DealWithRelations[]>({
    queryKey: ["/api/crm/deals/enriched"],`;
  if (pSrc.includes(ALT_OLD)) {
    pSrc = pSrc.replace(ALT_OLD, ALT_NEW);
    console.log('  ✅ Switched pipeline.tsx (alt pattern) to enriched deals endpoint');
  } else {
    console.log('  ⚠️  Could not auto-patch pipeline.tsx query key. Manually change:');
    console.log('     queryKey: ["/api/deals"] → queryKey: ["/api/crm/deals/enriched"]');
    console.log('     in the main deals useQuery hook in pipeline.tsx');
  }
}

writeFileSync(pipelineFile, pSrc);

console.log('\n✅ Patch 07 complete.');
console.log('   Server: GET /api/crm/deals/enriched returns deals + activityCount + lastActivityDate');
console.log('   Make sure the crm-pipeline-enhancements router is mounted at /api in server/routes.ts');
SCRIPT

node /tmp/patch07.mjs
echo "✅ Patch 07 done"
