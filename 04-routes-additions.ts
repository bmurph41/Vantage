// =============================================================================
// PATCH FILE: server/routes.ts — TWO NEW ENDPOINTS
//
// Find this block in routes.ts (~line 496):
//   app.use("/api/pnl", authenticateUser, enforceTenant, pnlRouter);
//
// INSERT the two endpoints below IMMEDIATELY AFTER that line.
// =============================================================================

  // ─── PNL Pipeline Import (DocIntel upload → PNL pipeline → modelingActuals) ──
  app.post(
    '/api/modeling/projects/:projectId/pnl-pipeline-import',
    authenticateUser,
    async (req: any, res) => {
      try {
        const orgId: string =
          req.user?.organizationId ?? req.user?.orgId ?? req.user?.organization_id;
        const { projectId } = req.params;
        const { uploadId } = req.body;

        if (!orgId) return res.status(401).json({ error: 'Not authenticated' });
        if (!uploadId) return res.status(400).json({ error: 'uploadId is required' });

        const { importDocIntelToPnlPipeline } = await import(
          './services/pnl/project-bridge'
        );

        const result = await importDocIntelToPnlPipeline({
          orgId,
          modelingProjectId: projectId,
          docIntelUploadId: uploadId,
        });

        res.json(result);
      } catch (error: any) {
        console.error('[PNL Pipeline Import] Error:', error.message);
        res.status(500).json({ error: error.message });
      }
    }
  );

  // ─── PNL Manual Promote (re-push pnlFacts → modelingActuals) ─────────────────
  app.post(
    '/api/modeling/projects/:projectId/pnl-promote',
    authenticateUser,
    async (req: any, res) => {
      try {
        const orgId: string =
          req.user?.organizationId ?? req.user?.orgId ?? req.user?.organization_id;
        const { projectId } = req.params;
        const { documentId } = req.body ?? {};

        if (!orgId) return res.status(401).json({ error: 'Not authenticated' });

        const { manuallyPromotePnlFacts } = await import(
          './services/pnl/project-bridge'
        );

        const result = await manuallyPromotePnlFacts({
          orgId,
          modelingProjectId: projectId,
          documentId,
        });

        res.json({ success: true, ...result });
      } catch (error: any) {
        console.error('[PNL Promote] Error:', error.message);
        res.status(500).json({ error: error.message });
      }
    }
  );

  // ─── PNL Facts Summary (for project badge in uploads UI) ─────────────────────
  app.get(
    '/api/modeling/projects/:projectId/pnl-facts-summary',
    authenticateUser,
    async (req: any, res) => {
      try {
        const orgId: string =
          req.user?.organizationId ?? req.user?.orgId ?? req.user?.organization_id;
        const { projectId } = req.params;

        if (!orgId) return res.status(401).json({ error: 'Not authenticated' });

        const { getPnlFactsSummaryForProject } = await import(
          './services/pnl/project-bridge'
        );

        const summary = await getPnlFactsSummaryForProject(orgId, projectId);
        res.json(summary);
      } catch (error: any) {
        console.error('[PNL Facts Summary] Error:', error.message);
        res.status(500).json({ error: error.message });
      }
    }
  );
