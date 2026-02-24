// =============================================================================
// DIRECT INPUT COMPUTE ENDPOINT
// Add this to server/routes.ts inside registerRoutes()
//
// Insert AFTER the existing PATCH /api/modeling/projects/:id route (~line 19694)
// =============================================================================

  // Compute direct input financials (live preview — no DB write)
  app.post('/api/modeling/projects/:projectId/compute-direct-input', authenticateUser, async (req: any, res) => {
    try {
      const { computeDirectInputFinancials } = await import('./services/direct-input-engine');
      const { assetClass, inputAssumptions, unitMix } = req.body;

      if (!assetClass || !inputAssumptions) {
        return res.status(400).json({ error: 'assetClass and inputAssumptions are required' });
      }

      const result = computeDirectInputFinancials(assetClass, inputAssumptions, unitMix);

      if (!result) {
        return res.json({
          totalRevenue: 0,
          totalExpenses: 0,
          noi: 0,
          revenueLines: [],
          expenseLines: [],
          formulaBreakdowns: {},
        });
      }

      res.json(result);
    } catch (error: any) {
      console.error('Failed to compute direct input financials:', error);
      res.status(500).json({ error: 'Failed to compute financials' });
    }
  });
