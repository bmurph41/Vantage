import archiver from 'archiver';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');

const VALUATOR_FILES = {
  'GUIDE.md': 'GUIDE.md',

  // ============================================
  // SHARED SCHEMA (extracted tables)
  // ============================================
  'shared/pnl-pipeline-schema.ts': 'shared/pnl-pipeline-schema.ts',

  // ============================================
  // SERVER — Core Engine Services
  // ============================================
  'server/services/pro-forma-engine-service.ts': 'server/services/pro-forma-engine-service.ts',
  'server/services/pnl/promote-to-actuals.ts': 'server/services/pnl/promote-to-actuals.ts',
  'server/services/pnl/routes.ts': 'server/services/pnl/routes.ts',
  'server/services/pnl/ingest.ts': 'server/services/pnl/ingest.ts',
  'server/services/pnl/mapping.ts': 'server/services/pnl/mapping.ts',
  'server/services/pnl/parseOrchestrator.ts': 'server/services/pnl/parseOrchestrator.ts',
  'server/services/pnl/aggregationService.ts': 'server/services/pnl/aggregationService.ts',
  'server/services/pnl/timeAlign.ts': 'server/services/pnl/timeAlign.ts',
  'server/services/pnl/department-verification-service.ts': 'server/services/pnl/department-verification-service.ts',

  // ============================================
  // SERVER — Utilities
  // ============================================
  'server/utils/department-mapping.ts': 'server/utils/department-mapping.ts',
  'server/utils/financial-calculations.ts': 'server/utils/financial-calculations.ts',
  'server/utils/modeling-periods.ts': 'server/utils/modeling-periods.ts',
  'server/utils/normalizeLineItemLabel.ts': 'server/utils/normalizeLineItemLabel.ts',
  'server/utils/normalize-line-item.ts': 'server/utils/normalize-line-item.ts',

  // ============================================
  // SERVER — Seed Data
  // ============================================
  'server/scripts/seedMarinaCoa.ts': 'server/scripts/seedMarinaCoa.ts',

  // ============================================
  // SERVER — Operations Services
  // ============================================
  'server/services/operations-data-sync-service.ts': 'server/services/operations-data-sync-service.ts',
  'server/services/operations-data-sync.ts': 'server/services/operations-data-sync.ts',
  'server/services/marina-profit-center-service.ts': 'server/services/marina-profit-center-service.ts',
  'server/services/fuel/fuel-sync-service.ts': 'server/services/fuel/fuel-sync-service.ts',
  'server/services/fuel/fuel-route-utils.ts': 'server/services/fuel/fuel-route-utils.ts',
  'server/services/fuel/fuel-provider-interface.ts': 'server/services/fuel/fuel-provider-interface.ts',

  // ============================================
  // SERVER — Modeling & Analysis Services
  // ============================================
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

  // ============================================
  // SERVER — Rent Roll V2
  // ============================================
  'server/services/rent-roll-v2/rentRollService.ts': 'server/services/rent-roll-v2/rentRollService.ts',
  'server/services/rent-roll-v2/db.ts': 'server/services/rent-roll-v2/db.ts',
  'server/services/rent-roll-v2/leaseEconomics/leaseEconomics.engine.ts': 'server/services/rent-roll-v2/leaseEconomics/leaseEconomics.engine.ts',
  'server/services/rent-roll-v2/leaseEconomics/leaseEconomics.types.ts': 'server/services/rent-roll-v2/leaseEconomics/leaseEconomics.types.ts',
  'server/services/rent-roll-v2/scenarioService.ts': 'server/services/rent-roll-v2/scenarioService.ts',
  'server/services/rent-roll-v2/reportsService.ts': 'server/services/rent-roll-v2/reportsService.ts',
  'server/services/rent-roll-service.ts': 'server/services/rent-roll-service.ts',

  // ============================================
  // SERVER — Routes (Operations)
  // ============================================
  'server/routes/operations-sync-routes.ts': 'server/routes/operations-sync-routes.ts',
  'server/routes/operations-context-routes.ts': 'server/routes/operations-context-routes.ts',
  'server/routes/commercial-tenants-routes.ts': 'server/routes/commercial-tenants-routes.ts',
  'server/routes/modeling-rent-roll-routes.ts': 'server/routes/modeling-rent-roll-routes.ts',
  'server/routes/modeling-validation-routes.ts': 'server/routes/modeling-validation-routes.ts',
  'server/routes/marina-integrations-routes.ts': 'server/routes/marina-integrations-routes.ts',
  'server/routes/analytics-routes.ts': 'server/routes/analytics-routes.ts',
  'server/routes/valuation-timeline-routes.ts': 'server/routes/valuation-timeline-routes.ts',
  'server/routes/scenario-template-routes.ts': 'server/routes/scenario-template-routes.ts',

  // ============================================
  // SERVER — Integration Adapters
  // ============================================
  'server/services/marina-integration-adapter.ts': 'server/services/marina-integration-adapter.ts',
  'server/services/integration-data-pipeline.ts': 'server/services/integration-data-pipeline.ts',
  'server/services/integration-data-transformer.ts': 'server/services/integration-data-transformer.ts',

  // ============================================
  // CLIENT — Modeling / Valuator Workspace
  // ============================================
  'client/src/pages/modeling/projects/workspace.tsx': 'client/src/pages/modeling/projects/workspace.tsx',
  'client/src/pages/modeling/projects/workspace/overview.tsx': 'client/src/pages/modeling/projects/workspace/overview.tsx',
  'client/src/pages/modeling/projects/workspace/historical-pl.tsx': 'client/src/pages/modeling/projects/workspace/historical-pl.tsx',
  'client/src/pages/modeling/projects/workspace/assumptions.tsx': 'client/src/pages/modeling/projects/workspace/assumptions.tsx',
  'client/src/pages/modeling/projects/workspace/pro-forma.tsx': 'client/src/pages/modeling/projects/workspace/pro-forma.tsx',
  'client/src/pages/modeling/projects/workspace/pro-forma-charts.tsx': 'client/src/pages/modeling/projects/workspace/pro-forma-charts.tsx',
  'client/src/pages/modeling/projects/workspace/profit-centers.tsx': 'client/src/pages/modeling/projects/workspace/profit-centers.tsx',
  'client/src/pages/modeling/projects/workspace/valuator-profit-centers.tsx': 'client/src/pages/modeling/projects/workspace/valuator-profit-centers.tsx',
  'client/src/pages/modeling/projects/workspace/valuator-fuel-sales.tsx': 'client/src/pages/modeling/projects/workspace/valuator-fuel-sales.tsx',
  'client/src/pages/modeling/projects/workspace/valuator-ship-store.tsx': 'client/src/pages/modeling/projects/workspace/valuator-ship-store.tsx',
  'client/src/pages/modeling/projects/workspace/valuator-service-dept.tsx': 'client/src/pages/modeling/projects/workspace/valuator-service-dept.tsx',
  'client/src/pages/modeling/projects/workspace/valuator-boat-rentals.tsx': 'client/src/pages/modeling/projects/workspace/valuator-boat-rentals.tsx',
  'client/src/pages/modeling/projects/workspace/valuator-bookkeeping.tsx': 'client/src/pages/modeling/projects/workspace/valuator-bookkeeping.tsx',
  'client/src/pages/modeling/projects/workspace/valuator-commercial-tenants.tsx': 'client/src/pages/modeling/projects/workspace/valuator-commercial-tenants.tsx',
  'client/src/pages/modeling/projects/workspace/valuator-operations-summary.tsx': 'client/src/pages/modeling/projects/workspace/valuator-operations-summary.tsx',
  'client/src/pages/modeling/projects/workspace/deal-pricing.tsx': 'client/src/pages/modeling/projects/workspace/deal-pricing.tsx',
  'client/src/pages/modeling/projects/workspace/capital-stack.tsx': 'client/src/pages/modeling/projects/workspace/capital-stack.tsx',
  'client/src/pages/modeling/projects/workspace/exit-strategy.tsx': 'client/src/pages/modeling/projects/workspace/exit-strategy.tsx',
  'client/src/pages/modeling/projects/workspace/case-configuration.tsx': 'client/src/pages/modeling/projects/workspace/case-configuration.tsx',
  'client/src/pages/modeling/projects/workspace/scenario-comparison.tsx': 'client/src/pages/modeling/projects/workspace/scenario-comparison.tsx',
  'client/src/pages/modeling/projects/workspace/scenario-comparison-charts.tsx': 'client/src/pages/modeling/projects/workspace/scenario-comparison-charts.tsx',
  'client/src/pages/modeling/projects/workspace/sensitivity-tornado.tsx': 'client/src/pages/modeling/projects/workspace/sensitivity-tornado.tsx',
  'client/src/pages/modeling/projects/workspace/monte-carlo.tsx': 'client/src/pages/modeling/projects/workspace/monte-carlo.tsx',
  'client/src/pages/modeling/projects/workspace/dcf-calculator.tsx': 'client/src/pages/modeling/projects/workspace/dcf-calculator.tsx',
  'client/src/pages/modeling/projects/workspace/lease-cashflow.tsx': 'client/src/pages/modeling/projects/workspace/lease-cashflow.tsx',
  'client/src/pages/modeling/projects/workspace/leases-combined.tsx': 'client/src/pages/modeling/projects/workspace/leases-combined.tsx',
  'client/src/pages/modeling/projects/workspace/debt-scenarios.tsx': 'client/src/pages/modeling/projects/workspace/debt-scenarios.tsx',
  'client/src/pages/modeling/projects/workspace/rent-roll-data.tsx': 'client/src/pages/modeling/projects/workspace/rent-roll-data.tsx',
  'client/src/pages/modeling/projects/workspace/executive-summary.tsx': 'client/src/pages/modeling/projects/workspace/executive-summary.tsx',
  'client/src/pages/modeling/projects/workspace/export-model.tsx': 'client/src/pages/modeling/projects/workspace/export-model.tsx',
  'client/src/pages/modeling/projects/workspace/ic-memo-export.tsx': 'client/src/pages/modeling/projects/workspace/ic-memo-export.tsx',
  'client/src/pages/modeling/projects/workspace/inputs.tsx': 'client/src/pages/modeling/projects/workspace/inputs.tsx',
  'client/src/pages/modeling/projects/workspace/uploads.tsx': 'client/src/pages/modeling/projects/workspace/uploads.tsx',
  'client/src/pages/modeling/projects/workspace/audit-trail.tsx': 'client/src/pages/modeling/projects/workspace/audit-trail.tsx',
  'client/src/pages/modeling/projects/workspace/validation-warnings.tsx': 'client/src/pages/modeling/projects/workspace/validation-warnings.tsx',
  'client/src/pages/modeling/projects/workspace/analytics-normalization.tsx': 'client/src/pages/modeling/projects/workspace/analytics-normalization.tsx',
  'client/src/pages/modeling/projects/index.tsx': 'client/src/pages/modeling/projects/index.tsx',
  'client/src/pages/modeling/projects/form-dialog.tsx': 'client/src/pages/modeling/projects/form-dialog.tsx',
  'client/src/pages/modeling/projects/setup-wizard.tsx': 'client/src/pages/modeling/projects/setup-wizard.tsx',
  'client/src/pages/modeling/projects/analytics.tsx': 'client/src/pages/modeling/projects/analytics.tsx',
  'client/src/pages/modeling/projects/analytics-pdf.tsx': 'client/src/pages/modeling/projects/analytics-pdf.tsx',
  'client/src/pages/modeling/projects/transaction-closing.tsx': 'client/src/pages/modeling/projects/transaction-closing.tsx',

  // ============================================
  // CLIENT — Document Intelligence
  // ============================================
  'client/src/pages/modeling/doc-intel/index.tsx': 'client/src/pages/modeling/doc-intel/index.tsx',
  'client/src/pages/modeling/doc-intel/DocumentIntelligence.tsx': 'client/src/pages/modeling/doc-intel/DocumentIntelligence.tsx',
  'client/src/pages/modeling/doc-intel/ReviewWizard.tsx': 'client/src/pages/modeling/doc-intel/ReviewWizard.tsx',
  'client/src/pages/modeling/doc-intel/HoldingStation.tsx': 'client/src/pages/modeling/doc-intel/HoldingStation.tsx',
  'client/src/pages/modeling/doc-intel/MultiDocumentReview.tsx': 'client/src/pages/modeling/doc-intel/MultiDocumentReview.tsx',
  'client/src/pages/modeling/doc-intel/UploadDropzone.tsx': 'client/src/pages/modeling/doc-intel/UploadDropzone.tsx',
  'client/src/pages/modeling/doc-intel/CategoryManager.tsx': 'client/src/pages/modeling/doc-intel/CategoryManager.tsx',

  // ============================================
  // CLIENT — PnL Pipeline
  // ============================================
  'client/src/pages/modeling/pnl/index.tsx': 'client/src/pages/modeling/pnl/index.tsx',
  'client/src/pages/modeling/pnl/PnlUpload.tsx': 'client/src/pages/modeling/pnl/PnlUpload.tsx',
  'client/src/pages/modeling/pnl/PnlUploadReview.tsx': 'client/src/pages/modeling/pnl/PnlUploadReview.tsx',
  'client/src/pages/modeling/pnl/PnlReview.tsx': 'client/src/pages/modeling/pnl/PnlReview.tsx',
  'client/src/pages/modeling/pnl/PnlKeywordBank.tsx': 'client/src/pages/modeling/pnl/PnlKeywordBank.tsx',

  // ============================================
  // CLIENT — Exit Strategy Suite
  // ============================================
  'client/src/pages/modeling/exit-strategies.tsx': 'client/src/pages/modeling/exit-strategies.tsx',
  'client/src/pages/modeling/exit/Dashboard.tsx': 'client/src/pages/modeling/exit/Dashboard.tsx',
  'client/src/pages/modeling/exit/Scenarios.tsx': 'client/src/pages/modeling/exit/Scenarios.tsx',
  'client/src/pages/modeling/exit/ScenarioDetail.tsx': 'client/src/pages/modeling/exit/ScenarioDetail.tsx',
  'client/src/pages/modeling/exit/ScenarioComparison.tsx': 'client/src/pages/modeling/exit/ScenarioComparison.tsx',
  'client/src/pages/modeling/exit/Exchange1031.tsx': 'client/src/pages/modeling/exit/Exchange1031.tsx',
  'client/src/pages/modeling/exit/SellerFinancing.tsx': 'client/src/pages/modeling/exit/SellerFinancing.tsx',
  'client/src/pages/modeling/exit/IRRCalculator.tsx': 'client/src/pages/modeling/exit/IRRCalculator.tsx',
  'client/src/pages/modeling/exit/TaxCalculator.tsx': 'client/src/pages/modeling/exit/TaxCalculator.tsx',
  'client/src/pages/modeling/exit/Sensitivity.tsx': 'client/src/pages/modeling/exit/Sensitivity.tsx',
  'client/src/pages/modeling/exit/DSTAnalysis.tsx': 'client/src/pages/modeling/exit/DSTAnalysis.tsx',
  'client/src/pages/modeling/exit/NetProceeds.tsx': 'client/src/pages/modeling/exit/NetProceeds.tsx',
  'client/src/pages/modeling/exit/Waterfall.tsx': 'client/src/pages/modeling/exit/Waterfall.tsx',
  'client/src/pages/modeling/exit/Earnout.tsx': 'client/src/pages/modeling/exit/Earnout.tsx',
  'client/src/pages/modeling/exit/AIInsights.tsx': 'client/src/pages/modeling/exit/AIInsights.tsx',

  // ============================================
  // CLIENT — Portfolio / Funds / LP
  // ============================================
  'client/src/pages/modeling/portfolio/index.tsx': 'client/src/pages/modeling/portfolio/index.tsx',
  'client/src/pages/modeling/funds/index.tsx': 'client/src/pages/modeling/funds/index.tsx',
  'client/src/pages/modeling/funds/[fundId].tsx': 'client/src/pages/modeling/funds/[fundId].tsx',
  'client/src/pages/modeling/lp-portal/index.tsx': 'client/src/pages/modeling/lp-portal/index.tsx',
  'client/src/pages/modeling/debt-scenarios/Index.tsx': 'client/src/pages/modeling/debt-scenarios/Index.tsx',
  'client/src/pages/modeling/settings/index.tsx': 'client/src/pages/modeling/settings/index.tsx',

  // ============================================
  // CLIENT — Operations Pages
  // ============================================
  'client/src/pages/operations/FuelSalesTabbed.tsx': 'client/src/pages/operations/FuelSalesTabbed.tsx',
  'client/src/pages/operations/FuelSales.tsx': 'client/src/pages/operations/FuelSales.tsx',
  'client/src/pages/operations/fuel/Dashboard.tsx': 'client/src/pages/operations/fuel/Dashboard.tsx',
  'client/src/pages/operations/fuel/Transactions.tsx': 'client/src/pages/operations/fuel/Transactions.tsx',
  'client/src/pages/operations/fuel/Inventory.tsx': 'client/src/pages/operations/fuel/Inventory.tsx',
  'client/src/pages/operations/fuel/Analytics.tsx': 'client/src/pages/operations/fuel/Analytics.tsx',
  'client/src/pages/operations/fuel/Reports.tsx': 'client/src/pages/operations/fuel/Reports.tsx',
  'client/src/pages/operations/fuel/FinancialModel.tsx': 'client/src/pages/operations/fuel/FinancialModel.tsx',
  'client/src/pages/operations/fuel/ImportHistory.tsx': 'client/src/pages/operations/fuel/ImportHistory.tsx',
  'client/src/pages/operations/fuel/IntegrationSettings.tsx': 'client/src/pages/operations/fuel/IntegrationSettings.tsx',
  'client/src/pages/operations/fuel/AuditTrail.tsx': 'client/src/pages/operations/fuel/AuditTrail.tsx',
  'client/src/pages/operations/fuel/Settings.tsx': 'client/src/pages/operations/fuel/Settings.tsx',
  'client/src/pages/operations/ShipStoreTabbed.tsx': 'client/src/pages/operations/ShipStoreTabbed.tsx',
  'client/src/pages/operations/ship-store/Dashboard.tsx': 'client/src/pages/operations/ship-store/Dashboard.tsx',
  'client/src/pages/operations/ship-store/Inventory.tsx': 'client/src/pages/operations/ship-store/Inventory.tsx',
  'client/src/pages/operations/ship-store/Transactions.tsx': 'client/src/pages/operations/ship-store/Transactions.tsx',
  'client/src/pages/operations/ship-store/Analytics.tsx': 'client/src/pages/operations/ship-store/Analytics.tsx',
  'client/src/pages/operations/ship-store/Checkout.tsx': 'client/src/pages/operations/ship-store/Checkout.tsx',
  'client/src/pages/operations/ship-store/POS.tsx': 'client/src/pages/operations/ship-store/POS.tsx',
  'client/src/pages/operations/ship-store/Reports.tsx': 'client/src/pages/operations/ship-store/Reports.tsx',
  'client/src/pages/operations/ServiceTabbed.tsx': 'client/src/pages/operations/ServiceTabbed.tsx',
  'client/src/pages/operations/service/Dashboard.tsx': 'client/src/pages/operations/service/Dashboard.tsx',
  'client/src/pages/operations/BoatRentalsTabbed.tsx': 'client/src/pages/operations/BoatRentalsTabbed.tsx',
  'client/src/pages/operations/boat-rentals/Dashboard.tsx': 'client/src/pages/operations/boat-rentals/Dashboard.tsx',
  'client/src/pages/operations/BoatSalesTabbed.tsx': 'client/src/pages/operations/BoatSalesTabbed.tsx',
  'client/src/pages/operations/boat-sales/Dashboard.tsx': 'client/src/pages/operations/boat-sales/Dashboard.tsx',
  'client/src/pages/operations/BoatClubTabbed.tsx': 'client/src/pages/operations/BoatClubTabbed.tsx',
  'client/src/pages/operations/boat-club/Dashboard.tsx': 'client/src/pages/operations/boat-club/Dashboard.tsx',
  'client/src/pages/operations/BookkeepingTabbed.tsx': 'client/src/pages/operations/BookkeepingTabbed.tsx',
  'client/src/pages/operations/bookkeeping/Dashboard.tsx': 'client/src/pages/operations/bookkeeping/Dashboard.tsx',
  'client/src/pages/operations/bookkeeping/ChartOfAccounts.tsx': 'client/src/pages/operations/bookkeeping/ChartOfAccounts.tsx',
  'client/src/pages/operations/bookkeeping/Statements.tsx': 'client/src/pages/operations/bookkeeping/Statements.tsx',
  'client/src/pages/operations/bookkeeping/SyncHistory.tsx': 'client/src/pages/operations/bookkeeping/SyncHistory.tsx',
  'client/src/pages/operations/RentRollTabbed.tsx': 'client/src/pages/operations/RentRollTabbed.tsx',
  'client/src/pages/operations/RentRoll.tsx': 'client/src/pages/operations/RentRoll.tsx',
  'client/src/pages/operations/rent-roll/Dashboard.tsx': 'client/src/pages/operations/rent-roll/Dashboard.tsx',
  'client/src/pages/operations/rent-roll/Leases.tsx': 'client/src/pages/operations/rent-roll/Leases.tsx',
  'client/src/pages/operations/rent-roll/Projects.tsx': 'client/src/pages/operations/rent-roll/Projects.tsx',
  'client/src/pages/operations/rent-roll/ProjectDetails.tsx': 'client/src/pages/operations/rent-roll/ProjectDetails.tsx',
  'client/src/pages/operations/rent-roll/Comparison.tsx': 'client/src/pages/operations/rent-roll/Comparison.tsx',
  'client/src/pages/operations/rent-roll/Portfolio.tsx': 'client/src/pages/operations/rent-roll/Portfolio.tsx',
  'client/src/pages/operations/DockitTabbed.tsx': 'client/src/pages/operations/DockitTabbed.tsx',
  'client/src/pages/operations/dockit/Dashboard.tsx': 'client/src/pages/operations/dockit/Dashboard.tsx',
  'client/src/pages/operations/dockit/Slips.tsx': 'client/src/pages/operations/dockit/Slips.tsx',
  'client/src/pages/operations/dockit/Launches.tsx': 'client/src/pages/operations/dockit/Launches.tsx',
  'client/src/pages/operations/MarketingTabbed.tsx': 'client/src/pages/operations/MarketingTabbed.tsx',
  'client/src/pages/operations/marketing/Dashboard.tsx': 'client/src/pages/operations/marketing/Dashboard.tsx',
  'client/src/pages/operations/marketing/Campaigns.tsx': 'client/src/pages/operations/marketing/Campaigns.tsx',
  'client/src/pages/operations/marketing/EmailCampaigns.tsx': 'client/src/pages/operations/marketing/EmailCampaigns.tsx',
  'client/src/pages/operations/marketing/Expenses.tsx': 'client/src/pages/operations/marketing/Expenses.tsx',
  'client/src/pages/operations/marketing/Attribution.tsx': 'client/src/pages/operations/marketing/Attribution.tsx',
  'client/src/pages/operations/marketing/Settings.tsx': 'client/src/pages/operations/marketing/Settings.tsx',
  'client/src/pages/operations/commercial-tenants/index.tsx': 'client/src/pages/operations/commercial-tenants/index.tsx',
  'client/src/pages/operations/commercial-tenants/CommercialTenants.tsx': 'client/src/pages/operations/commercial-tenants/CommercialTenants.tsx',
  'client/src/pages/operations/commercial-tenants/TenantFormDialog.tsx': 'client/src/pages/operations/commercial-tenants/TenantFormDialog.tsx',
  'client/src/pages/operations/commercial-tenants/TenantDetailSheet.tsx': 'client/src/pages/operations/commercial-tenants/TenantDetailSheet.tsx',
  'client/src/pages/operations/commercial-tenants/LeaseImportWizard.tsx': 'client/src/pages/operations/commercial-tenants/LeaseImportWizard.tsx',
  'client/src/pages/operations/OwnedMarinas.tsx': 'client/src/pages/operations/OwnedMarinas.tsx',
  'client/src/pages/operations/CustomerAnalytics.tsx': 'client/src/pages/operations/CustomerAnalytics.tsx',
  'client/src/pages/operations/integrations.tsx': 'client/src/pages/operations/integrations.tsx',

  // ============================================
  // CLIENT — Shared Components
  // ============================================
  'client/src/components/doc-intel/PLReviewGrid.tsx': 'client/src/components/doc-intel/PLReviewGrid.tsx',
  'client/src/components/doc-intel/PLTableView.tsx': 'client/src/components/doc-intel/PLTableView.tsx',
  'client/src/components/fuel/add-delivery-modal.tsx': 'client/src/components/fuel/add-delivery-modal.tsx',
  'client/src/components/fuel/csv-import-modal.tsx': 'client/src/components/fuel/csv-import-modal.tsx',
  'client/src/components/fuel/fuel-type-chart.tsx': 'client/src/components/fuel/fuel-type-chart.tsx',

  // ============================================
  // CLIENT — Hooks
  // ============================================
  'client/src/hooks/useModelingAddbacks.ts': 'client/src/hooks/useModelingAddbacks.ts',
  'client/src/hooks/useModelingCases.ts': 'client/src/hooks/useModelingCases.ts',
  'client/src/hooks/useDealWorkspaces.ts': 'client/src/hooks/useDealWorkspaces.ts',

  // ============================================
  // CLIENT — Lib
  // ============================================
  'client/src/lib/queryKeys.ts': 'client/src/lib/queryKeys.ts',
};

export async function buildValuatorZip(outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(outputPath));
    archive.on('error', (err: Error) => reject(err));
    archive.pipe(output);

    for (const [zipPath, sourcePath] of Object.entries(VALUATOR_FILES)) {
      const fullPath = path.join(ROOT, sourcePath);
      if (fs.existsSync(fullPath)) {
        archive.file(fullPath, { name: `valuator-export/${zipPath}` });
      }
    }

    archive.finalize();
  });
}
