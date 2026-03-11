// =============================================================================
// PATCH FILE: server/services/pnl/routes.ts — APPEND THESE ROUTES
//
// Add these route handlers to the router in server/services/pnl/routes.ts.
// Paste BEFORE the final `export default router;` line.
//
// These add:
//   POST /api/pnl/seed-canonical          — seed canonical items for org
//   POST /api/pnl/projects/:id/promote    — promote pnlFacts → modelingActuals
//   GET  /api/pnl/projects/:id/summary    — fact count / year summary
// =============================================================================

// ─── IMPORT ADDITIONS (add to top of routes.ts) ──────────────────────────────
// import { seedPnlCanonicalItems, ensurePnlCanonicalItemsSeeded } from './canonical-seed';
// import { manuallyPromotePnlFacts, getPnlFactsSummaryForProject } from './project-bridge';
// ─────────────────────────────────────────────────────────────────────────────

// ─── Seed canonical line items for org ───────────────────────────────────────
router.post('/seed-canonical', async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);
    const { seedPnlCanonicalItems } = await import('./canonical-seed');
    const result = await seedPnlCanonicalItems(orgId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[PNL Seed] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Promote pnlFacts → modelingActuals for a project ────────────────────────
router.post('/projects/:modelingProjectId/promote', async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);
    const { modelingProjectId } = req.params;
    const { documentId } = req.body;

    const { manuallyPromotePnlFacts } = await import('./project-bridge');
    const result = await manuallyPromotePnlFacts({ orgId, modelingProjectId, documentId });
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[PNL Promote] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Get pnlFacts summary for a project ──────────────────────────────────────
router.get('/projects/:modelingProjectId/summary', async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);
    const { modelingProjectId } = req.params;

    const { getPnlFactsSummaryForProject } = await import('./project-bridge');
    const summary = await getPnlFactsSummaryForProject(orgId, modelingProjectId);
    res.json(summary);
  } catch (err: any) {
    console.error('[PNL Summary] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
