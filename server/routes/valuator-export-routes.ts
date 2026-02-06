import { Router } from 'express';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const VALUATOR_FILES: Record<string, string> = {
  'GUIDE.md': 'GUIDE.md',
  'shared/pnl-pipeline-schema.ts': 'shared/pnl-pipeline-schema.ts',
  'server/services/pro-forma-engine-service.ts': 'server/services/pro-forma-engine-service.ts',
  'server/services/pnl/promote-to-actuals.ts': 'server/services/pnl/promote-to-actuals.ts',
  'server/services/pnl/routes.ts': 'server/services/pnl/routes.ts',
  'server/services/pnl/ingest.ts': 'server/services/pnl/ingest.ts',
  'server/services/pnl/mapping.ts': 'server/services/pnl/mapping.ts',
  'server/services/pnl/parseOrchestrator.ts': 'server/services/pnl/parseOrchestrator.ts',
  'server/services/pnl/aggregationService.ts': 'server/services/pnl/aggregationService.ts',
  'server/services/pnl/timeAlign.ts': 'server/services/pnl/timeAlign.ts',
  'server/services/pnl/department-verification-service.ts': 'server/services/pnl/department-verification-service.ts',
  'server/utils/department-mapping.ts': 'server/utils/department-mapping.ts',
  'server/utils/financial-calculations.ts': 'server/utils/financial-calculations.ts',
  'server/utils/modeling-periods.ts': 'server/utils/modeling-periods.ts',
  'server/utils/normalizeLineItemLabel.ts': 'server/utils/normalizeLineItemLabel.ts',
  'server/utils/normalize-line-item.ts': 'server/utils/normalize-line-item.ts',
  'server/scripts/seedMarinaCoa.ts': 'server/scripts/seedMarinaCoa.ts',
  'server/services/operations-data-sync-service.ts': 'server/services/operations-data-sync-service.ts',
  'server/services/operations-data-sync.ts': 'server/services/operations-data-sync.ts',
  'server/services/marina-profit-center-service.ts': 'server/services/marina-profit-center-service.ts',
  'server/services/fuel/fuel-sync-service.ts': 'server/services/fuel/fuel-sync-service.ts',
  'server/services/fuel/fuel-route-utils.ts': 'server/services/fuel/fuel-route-utils.ts',
  'server/services/fuel/fuel-provider-interface.ts': 'server/services/fuel/fuel-provider-interface.ts',
  'server/services/doc-intel-service.ts': 'server/services/doc-intel-service.ts',
  'server/services/document-intelligence-service.ts': 'server/services/document-intelligence-service.ts',
  'server/services/modeling-export.ts': 'server/services/modeling-export.ts',
  'server/services/deal-pricing-service.ts': 'server/services/deal-pricing-service.ts',
  'server/services/capital-stack-service.ts': 'server/services/capital-stack-service.ts',
  'server/services/dcf-calculator-service.ts': 'server/services/dcf-calculator-service.ts',
  'server/services/monte-carlo-service.ts': 'server/services/monte-carlo-service.ts',
  'server/services/sensitivity-matrix-service.ts': 'server/services/sensitivity-matrix-service.ts',
  'server/services/scenario-versioning-service.ts': 'server/services/scenario-versioning-service.ts',
  'server/services/debt-schedule-service.ts': 'server/services/debt-schedule-service.ts',
  'server/services/lease-cashflow-engine.ts': 'server/services/lease-cashflow-engine.ts',
  'server/services/valuation-sync-service.ts': 'server/services/valuation-sync-service.ts',
  'server/services/portfolio-rollup-service.ts': 'server/services/portfolio-rollup-service.ts',
  'server/services/waterfall-service.ts': 'server/services/waterfall-service.ts',
  'server/services/benchmark-comparison-service.ts': 'server/services/benchmark-comparison-service.ts',
  'server/services/analytics/marina-kpi-calculator.ts': 'server/services/analytics/marina-kpi-calculator.ts',
  'server/services/rent-roll-v2/rentRollService.ts': 'server/services/rent-roll-v2/rentRollService.ts',
  'server/services/rent-roll-v2/db.ts': 'server/services/rent-roll-v2/db.ts',
  'server/services/rent-roll-v2/leaseEconomics/leaseEconomics.engine.ts': 'server/services/rent-roll-v2/leaseEconomics/leaseEconomics.engine.ts',
  'server/services/rent-roll-v2/leaseEconomics/leaseEconomics.types.ts': 'server/services/rent-roll-v2/leaseEconomics/leaseEconomics.types.ts',
  'server/services/rent-roll-v2/scenarioService.ts': 'server/services/rent-roll-v2/scenarioService.ts',
  'server/services/rent-roll-v2/reportsService.ts': 'server/services/rent-roll-v2/reportsService.ts',
  'server/services/rent-roll-service.ts': 'server/services/rent-roll-service.ts',
  'server/routes/operations-sync-routes.ts': 'server/routes/operations-sync-routes.ts',
  'server/routes/operations-context-routes.ts': 'server/routes/operations-context-routes.ts',
  'server/routes/commercial-tenants-routes.ts': 'server/routes/commercial-tenants-routes.ts',
  'server/routes/modeling-rent-roll-routes.ts': 'server/routes/modeling-rent-roll-routes.ts',
  'server/routes/modeling-validation-routes.ts': 'server/routes/modeling-validation-routes.ts',
  'server/routes/marina-integrations-routes.ts': 'server/routes/marina-integrations-routes.ts',
  'server/routes/analytics-routes.ts': 'server/routes/analytics-routes.ts',
  'server/routes/valuation-timeline-routes.ts': 'server/routes/valuation-timeline-routes.ts',
  'server/routes/scenario-template-routes.ts': 'server/routes/scenario-template-routes.ts',
  'server/services/marina-integration-adapter.ts': 'server/services/marina-integration-adapter.ts',
  'server/services/integration-data-pipeline.ts': 'server/services/integration-data-pipeline.ts',
  'server/services/integration-data-transformer.ts': 'server/services/integration-data-transformer.ts',
  'server/services/pnl-alias-matcher.ts': 'server/services/pnl-alias-matcher.ts',
};

function addClientFiles(archive: archiver.Archiver) {
  const clientDirs = [
    'client/src/pages/modeling',
    'client/src/pages/operations',
    'client/src/components/doc-intel',
    'client/src/components/fuel',
  ];

  for (const dir of clientDirs) {
    const fullDir = path.join(ROOT, dir);
    if (fs.existsSync(fullDir)) {
      archive.directory(fullDir, `valuator-export/${dir}`);
    }
  }

  const clientFiles = [
    'client/src/hooks/useModelingAddbacks.ts',
    'client/src/hooks/useModelingCases.ts',
    'client/src/hooks/useDealWorkspaces.ts',
    'client/src/lib/queryKeys.ts',
  ];

  for (const file of clientFiles) {
    const fullPath = path.join(ROOT, file);
    if (fs.existsSync(fullPath)) {
      archive.file(fullPath, { name: `valuator-export/${file}` });
    }
  }
}

router.get('/download', async (_req: any, res) => {
  try {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="valuator-operations-export.zip"');

    const archive = archiver('zip', { zlib: { level: 6 } });

    archive.on('error', (err: Error) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create ZIP archive' });
      }
    });

    archive.pipe(res);

    for (const [zipPath, sourcePath] of Object.entries(VALUATOR_FILES)) {
      const fullPath = path.join(ROOT, sourcePath);
      if (fs.existsSync(fullPath)) {
        archive.file(fullPath, { name: `valuator-export/${zipPath}` });
      }
    }

    addClientFiles(archive);

    await archive.finalize();
  } catch (error: any) {
    console.error('Export error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate export' });
    }
  }
});

router.get('/manifest', async (_req: any, res) => {
  try {
    const manifest: { path: string; exists: boolean; size: number }[] = [];

    for (const [zipPath, sourcePath] of Object.entries(VALUATOR_FILES)) {
      const fullPath = path.join(ROOT, sourcePath);
      const exists = fs.existsSync(fullPath);
      const size = exists ? fs.statSync(fullPath).size : 0;
      manifest.push({ path: zipPath, exists, size });
    }

    const clientDirs = [
      'client/src/pages/modeling',
      'client/src/pages/operations',
      'client/src/components/doc-intel',
      'client/src/components/fuel',
    ];

    let clientFileCount = 0;
    for (const dir of clientDirs) {
      const fullDir = path.join(ROOT, dir);
      if (fs.existsSync(fullDir)) {
        const files = getAllFiles(fullDir);
        clientFileCount += files.length;
      }
    }

    res.json({
      serverFiles: manifest.filter(f => f.exists).length,
      clientFiles: clientFileCount,
      totalServerSize: manifest.reduce((sum, f) => sum + f.size, 0),
      missingFiles: manifest.filter(f => !f.exists).map(f => f.path),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function getAllFiles(dirPath: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

export default router;
