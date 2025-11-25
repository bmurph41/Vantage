import { lazy, Suspense } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import UnifiedSidebar from "@/components/unified-sidebar";
import PendingNotificationsBanner from "@/components/pending-notifications-banner";
import { Loader2 } from "lucide-react";
import DockTalkRouter from "@/docktalk/DockTalkRouter";

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

// Code-split all page imports for optimal bundle size
const Dashboard = lazy(() => import("@/pages/dashboard"));
const ProjectPage = lazy(() => import("@/pages/project"));
const NotificationSettingsPage = lazy(() => import("@/pages/notification-settings"));
const DDProgressReportPage = lazy(() => import("@/pages/dd-progress-report"));
const AllProjectsSummaryPage = lazy(() => import("@/pages/all-projects-summary"));
const UserSettingsPage = lazy(() => import("@/pages/user-settings"));
const AuditLogsPage = lazy(() => import("@/pages/audit-logs"));
const CRMDashboard = lazy(() => import("@/pages/crm-dashboard"));
const Pipeline = lazy(() => import("@/pages/pipeline"));
const Leads = lazy(() => import("@/pages/leads"));
const Contacts = lazy(() => import("@/pages/contacts"));
const Companies = lazy(() => import("@/pages/companies"));
const Deals = lazy(() => import("@/pages/deals"));
const DealDetail = lazy(() => import("@/pages/deal-detail"));
const Properties = lazy(() => import("@/pages/properties"));
const PendingProperties = lazy(() => import("@/pages/pending-properties"));
const PendingContacts = lazy(() => import("@/pages/pending-contacts"));
const PendingCompanies = lazy(() => import("@/pages/pending-companies"));
const Prospecting = lazy(() => import("@/pages/prospecting"));
const Analytics = lazy(() => import("@/pages/analytics"));
const Forecast = lazy(() => import("@/pages/forecast"));
const Forms = lazy(() => import("@/pages/forms"));
const Labels = lazy(() => import("@/pages/labels"));
const Products = lazy(() => import("@/pages/products"));
const Workflows = lazy(() => import("@/pages/workflows"));
const Webhooks = lazy(() => import("@/pages/webhooks"));
const Dedupe = lazy(() => import("@/pages/dedupe"));
const Scoring = lazy(() => import("@/pages/scoring"));
const ImportContacts = lazy(() => import("@/pages/import-contacts"));
const ImportHistory = lazy(() => import("@/pages/import-history"));
const SortableListDemo = lazy(() => import("@/pages/demo/SortableListDemo"));
const MilestoneDemo = lazy(() => import("@/pages/milestone-demo"));
const NotFound = lazy(() => import("@/pages/not-found"));
const CrmTasks = lazy(() => import("@/pages/crm-tasks"));
const MarketingAutomation = lazy(() => import("@/pages/marketing-automation"));
const CalendarSettings = lazy(() => import("@/pages/calendar-settings"));
const CustomerAnalytics = lazy(() => import("@/pages/operations/CustomerAnalytics"));
const RentRoll = lazy(() => import("@/pages/operations/RentRoll"));
const RentRollPortfolio = lazy(() => import("@/pages/operations/rent-roll/Portfolio"));
const RentRollProjects = lazy(() => import("@/pages/operations/rent-roll/Projects"));
const FuelSalesDashboard = lazy(() => import("@/pages/operations/fuel/Dashboard"));
const FuelSalesTransactions = lazy(() => import("@/pages/operations/fuel/Transactions"));
const FuelSalesInventory = lazy(() => import("@/pages/operations/fuel/Inventory"));
const FuelSalesAnalytics = lazy(() => import("@/pages/operations/fuel/Analytics"));
const FuelSalesReports = lazy(() => import("@/pages/operations/fuel/Reports"));
const FuelSalesFinancialModel = lazy(() => import("@/pages/operations/fuel/FinancialModel"));
const FuelSalesSettings = lazy(() => import("@/pages/operations/fuel/Settings"));
const FuelSalesImportHistory = lazy(() => import("@/pages/operations/fuel/ImportHistory"));
const FuelSalesAuditTrail = lazy(() => import("@/pages/operations/fuel/AuditTrail"));
const ShipStoreDashboard = lazy(() => import("@/pages/operations/ship-store/Dashboard"));
const ShipStorePOS = lazy(() => import("@/pages/operations/ship-store/POS"));
const ShipStoreInventory = lazy(() => import("@/pages/operations/ship-store/Inventory"));
const ShipStoreTransactions = lazy(() => import("@/pages/operations/ship-store/Transactions"));
const ShipStoreCheckout = lazy(() => import("@/pages/operations/ship-store/Checkout"));
const ShipStoreAnalytics = lazy(() => import("@/pages/operations/ship-store/Analytics"));
const ShipStoreReports = lazy(() => import("@/pages/operations/ship-store/Reports"));
const MarketingDashboard = lazy(() => import("@/pages/operations/marketing/Dashboard"));
const MarketingCampaigns = lazy(() => import("@/pages/operations/marketing/Campaigns"));
const MarketingExpenses = lazy(() => import("@/pages/operations/marketing/Expenses"));
const MarketingAttribution = lazy(() => import("@/pages/operations/marketing/Attribution"));
const MarketingEmailCampaigns = lazy(() => import("@/pages/operations/marketing/EmailCampaigns"));
const MarketingSettings = lazy(() => import("@/pages/operations/marketing/Settings"));
const SalesCompsIndex = lazy(() => import("@/pages/analysis/sales-comps/Index"));
const SalesCompsAnalytics = lazy(() => import("@/pages/analysis/sales-comps/Analytics"));
const SalesCompsProjects = lazy(() => import("@/pages/analysis/sales-comps/Projects"));
const SalesCompsDetail = lazy(() => import("@/pages/analysis/sales-comps/Detail"));
const SalesCompsUpload = lazy(() => import("@/pages/analysis/sales-comps/Upload"));
const SalesCompsCompare = lazy(() => import("@/pages/analysis/sales-comps/Compare"));
const SalesCompsBulkEdit = lazy(() => import("@/pages/analysis/sales-comps/BulkEdit"));
const SalesCompsColumnManager = lazy(() => import("@/pages/analysis/sales-comps/ColumnManager"));
const ScProjectsIndex = lazy(() => import("@/pages/analysis/projects/Index"));
const ScProjectsReport = lazy(() => import("@/pages/analysis/projects/Report"));
const RateCompsIndex = lazy(() => import("@/pages/analysis/rate-comps/Index"));
const RateCompsDetail = lazy(() => import("@/pages/analysis/rate-comps/Detail"));
const RateCompsUpload = lazy(() => import("@/pages/analysis/rate-comps/Upload"));
const RateCompsCompare = lazy(() => import("@/pages/analysis/rate-comps/Compare"));
const RateCompsBulkEdit = lazy(() => import("@/pages/analysis/rate-comps/BulkEdit"));
const RateCompsColumnManager = lazy(() => import("@/pages/analysis/rate-comps/ColumnManager"));
const DemographicsIndex = lazy(() => import("@/pages/analysis/demographics/Index"));
const BenchmarksIndex = lazy(() => import("@/pages/analysis/benchmarks/Index"));
const DebtScenariosIndex = lazy(() => import("@/pages/modeling/debt-scenarios/Index"));
const ModelingProjectsIndex = lazy(() => import("@/pages/modeling/projects"));
const ModelingSettings = lazy(() => import("@/pages/modeling/settings"));
const TransactionClosingPage = lazy(() => import("@/pages/modeling/projects/transaction-closing"));
const VDRDashboard = lazy(() => import("@/pages/vdr/Dashboard"));
const ProjectVDR = lazy(() => import("@/pages/vdr/ProjectVDR"));
const DataRequest = lazy(() => import("@/pages/vdr/DataRequest"));

// Exit Strategy Suite pages
const ExitStrategyDashboard = lazy(() => import("@/pages/modeling/exit/Dashboard"));
const ExitScenarios = lazy(() => import("@/pages/modeling/exit/Scenarios"));
const ExitScenarioDetail = lazy(() => import("@/pages/modeling/exit/ScenarioDetail"));
const ExitTaxCalculator = lazy(() => import("@/pages/modeling/exit/TaxCalculator"));
const ExitNetProceeds = lazy(() => import("@/pages/modeling/exit/NetProceeds"));
const Exit1031Exchange = lazy(() => import("@/pages/modeling/exit/Exchange1031"));
const ExitDSTAnalysis = lazy(() => import("@/pages/modeling/exit/DSTAnalysis"));
const ExitSellerFinancing = lazy(() => import("@/pages/modeling/exit/SellerFinancing"));
const ExitEarnout = lazy(() => import("@/pages/modeling/exit/Earnout"));
const ExitWaterfall = lazy(() => import("@/pages/modeling/exit/Waterfall"));
const ExitIRRCalculator = lazy(() => import("@/pages/modeling/exit/IRRCalculator"));
const ExitSensitivity = lazy(() => import("@/pages/modeling/exit/Sensitivity"));
const ExitAIInsights = lazy(() => import("@/pages/modeling/exit/AIInsights"));

// Document Intelligence
const DocumentIntelligence = lazy(() => import("@/pages/modeling/doc-intel/DocumentIntelligence"));

// Unified Layout wrapper with sidebar for both DD Tracker and CRM
function UnifiedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <UnifiedSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <PendingNotificationsBanner />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

// Wrapper component to handle router props for notification settings
function NotificationSettingsWrapper(props: any) {
  return <NotificationSettingsPage />;
}

function Router() {
  const [, setLocation] = useLocation();

  return (
    <Switch>
      {/* Root path redirects to Dashboard */}
      <Route path="/">
        {() => {
          setLocation('/dashboard');
          return null;
        }}
      </Route>
      <Route path="/projects">
        {() => (
          <UnifiedLayout>
            <AllProjectsSummaryPage />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/projects/summary">
        {() => (
          <UnifiedLayout>
            <AllProjectsSummaryPage />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/dd/projects">
        {() => (
          <UnifiedLayout>
            <AllProjectsSummaryPage />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/dashboard">
        {() => (
          <UnifiedLayout>
            <Dashboard />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/progress-report">
        {() => (
          <UnifiedLayout>
            <DDProgressReportPage />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/audit-logs">
        {() => (
          <UnifiedLayout>
            <AuditLogsPage />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/user/settings">
        {() => (
          <UnifiedLayout>
            <UserSettingsPage />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/projects/:id">
        {(params) => (
          <UnifiedLayout>
            <ProjectPage {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/dd/projects/:id">
        {(params) => (
          <UnifiedLayout>
            <ProjectPage {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/notifications/:id" component={NotificationSettingsWrapper} />
      <Route path="/projects/:id/notifications" component={NotificationSettingsWrapper} />
      <Route path="/dd/projects/:id/notifications" component={NotificationSettingsWrapper} />
      <Route path="/projects/:id/settings" component={NotificationSettingsWrapper} />
      <Route path="/dd/projects/:id/settings" component={NotificationSettingsWrapper} />
      <Route path="/projects/:id/progress-report">
        {(params) => (
          <UnifiedLayout>
            <DDProgressReportPage {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/projects/:id/dd-progress-report">
        {(params) => (
          <UnifiedLayout>
            <DDProgressReportPage {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/dd/projects/:id/progress-report">
        {(params) => (
          <UnifiedLayout>
            <DDProgressReportPage {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/dd/projects/:id/dd-progress-report">
        {(params) => (
          <UnifiedLayout>
            <DDProgressReportPage {...params} />
          </UnifiedLayout>
        )}
      </Route>
      
      {/* VDR Routes with Unified Layout */}
      <Route path="/vdr">
        {() => (
          <UnifiedLayout>
            <VDRDashboard />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/vdr/projects/:id">
        {() => (
          <UnifiedLayout>
            <ProjectVDR />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/vdr/:projectId/data-request">
        {() => (
          <UnifiedLayout>
            <DataRequest />
          </UnifiedLayout>
        )}
      </Route>
      
      {/* Operations Routes with Unified Layout */}
      <Route path="/operations/customer-analytics">
        {() => (
          <UnifiedLayout>
            <CustomerAnalytics />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/rent-roll">
        {() => (
          <UnifiedLayout>
            <RentRoll />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/rent-roll/portfolio">
        {() => (
          <UnifiedLayout>
            <RentRollPortfolio />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/rent-roll/projects">
        {() => (
          <UnifiedLayout>
            <RentRollProjects />
          </UnifiedLayout>
        )}
      </Route>
      
      {/* Operations Routes with Unified Layout - Fuel Sales */}
      <Route path="/operations/fuel/dashboard">
        {() => (
          <UnifiedLayout>
            <FuelSalesDashboard />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/fuel/transactions">
        {() => (
          <UnifiedLayout>
            <FuelSalesTransactions />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/fuel/inventory">
        {() => (
          <UnifiedLayout>
            <FuelSalesInventory />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/fuel/analytics">
        {() => (
          <UnifiedLayout>
            <FuelSalesAnalytics />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/fuel/reports">
        {() => (
          <UnifiedLayout>
            <FuelSalesReports />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/fuel/financial-model">
        {() => (
          <UnifiedLayout>
            <FuelSalesFinancialModel />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/fuel/integration-settings">
        {() => (
          <UnifiedLayout>
            <FuelSalesSettings />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/fuel/import-history">
        {() => (
          <UnifiedLayout>
            <FuelSalesImportHistory />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/fuel/audit-trail">
        {() => (
          <UnifiedLayout>
            <FuelSalesAuditTrail />
          </UnifiedLayout>
        )}
      </Route>

      {/* Operations Routes with Unified Layout - Ship Store */}
      <Route path="/operations/ship-store">
        {() => {
          const [, setLocation] = useLocation();
          setLocation("/operations/ship-store/dashboard");
          return null;
        }}
      </Route>
      <Route path="/operations/ship-store/dashboard">
        {() => (
          <UnifiedLayout>
            <ShipStoreDashboard />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/ship-store/pos">
        {() => (
          <UnifiedLayout>
            <ShipStorePOS />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/ship-store/inventory">
        {() => (
          <UnifiedLayout>
            <ShipStoreInventory />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/ship-store/transactions">
        {() => (
          <UnifiedLayout>
            <ShipStoreTransactions />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/ship-store/checkout">
        {() => (
          <UnifiedLayout>
            <ShipStoreCheckout />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/ship-store/reports">
        {() => (
          <UnifiedLayout>
            <ShipStoreReports />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/ship-store/analytics">
        {() => (
          <UnifiedLayout>
            <ShipStoreAnalytics />
          </UnifiedLayout>
        )}
      </Route>

      {/* Operations Routes with Unified Layout - Marketing */}
      <Route path="/operations/marketing/dashboard">
        {() => (
          <UnifiedLayout>
            <MarketingDashboard />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/marketing/campaigns">
        {() => (
          <UnifiedLayout>
            <MarketingCampaigns />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/marketing/expenses">
        {() => (
          <UnifiedLayout>
            <MarketingExpenses />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/marketing/attribution">
        {() => (
          <UnifiedLayout>
            <MarketingAttribution />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/marketing/email-campaigns">
        {() => (
          <UnifiedLayout>
            <MarketingEmailCampaigns />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/marketing/settings">
        {() => (
          <UnifiedLayout>
            <MarketingSettings />
          </UnifiedLayout>
        )}
      </Route>

      {/* CRM Routes with Unified Layout */}
      <Route path="/crm">
        {() => (
          <UnifiedLayout>
            <CRMDashboard />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/pipeline">
        {() => (
          <UnifiedLayout>
            <Pipeline />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/leads">
        {() => (
          <UnifiedLayout>
            <Leads />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/contacts">
        {() => (
          <UnifiedLayout>
            <Contacts />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/companies">
        {() => (
          <UnifiedLayout>
            <Companies />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/properties">
        {() => (
          <UnifiedLayout>
            <Properties />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/pending-properties">
        {() => (
          <UnifiedLayout>
            <PendingProperties />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/pending-contacts">
        {() => (
          <UnifiedLayout>
            <PendingContacts />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/pending-companies">
        {() => (
          <UnifiedLayout>
            <PendingCompanies />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/deals">
        {() => (
          <UnifiedLayout>
            <Deals />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/deals/:dealId">
        {() => (
          <UnifiedLayout>
            <DealDetail />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/tasks">
        {() => (
          <UnifiedLayout>
            <CrmTasks />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/prospecting">
        {() => (
          <UnifiedLayout>
            <Prospecting />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/marketing-automation">
        {() => (
          <UnifiedLayout>
            <MarketingAutomation />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/calendar-settings">
        {() => (
          <UnifiedLayout>
            <CalendarSettings />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/analytics">
        {() => (
          <UnifiedLayout>
            <Analytics />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/forecast">
        {() => (
          <UnifiedLayout>
            <Forecast />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/forms">
        {() => (
          <UnifiedLayout>
            <Forms />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/labels">
        {() => (
          <UnifiedLayout>
            <Labels />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/products">
        {() => (
          <UnifiedLayout>
            <Products />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/workflows">
        {() => (
          <UnifiedLayout>
            <Workflows />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/webhooks">
        {() => (
          <UnifiedLayout>
            <Webhooks />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/dedupe">
        {() => (
          <UnifiedLayout>
            <Dedupe />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/scoring">
        {() => (
          <UnifiedLayout>
            <Scoring />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/import-contacts">
        {() => (
          <UnifiedLayout>
            <ImportContacts />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/import-history">
        {() => (
          <UnifiedLayout>
            <ImportHistory />
          </UnifiedLayout>
        )}
      </Route>

      {/* DockTalk Full Application - Uses Unified Layout */}
      <Route path="/docktalk">
        {() => (
          <UnifiedLayout>
            <DockTalkRouter />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/docktalk/:rest*">
        {() => (
          <UnifiedLayout>
            <DockTalkRouter />
          </UnifiedLayout>
        )}
      </Route>

      {/* Analysis / Sales Comps Routes */}
      <Route path="/analysis/sales-comps">
        {() => (
          <UnifiedLayout>
            <SalesCompsIndex />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/sales-comps/analytics">
        {() => (
          <UnifiedLayout>
            <SalesCompsAnalytics />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/sales-comps/projects">
        {() => (
          <UnifiedLayout>
            <SalesCompsProjects />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/sales-comps/upload">
        {() => (
          <UnifiedLayout>
            <SalesCompsUpload />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/sales-comps/columns">
        {() => (
          <UnifiedLayout>
            <SalesCompsColumnManager />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/sales-comps/bulk-edit">
        {() => (
          <UnifiedLayout>
            <SalesCompsBulkEdit />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/sales-comps/compare">
        {() => (
          <UnifiedLayout>
            <SalesCompsCompare />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/sales-comps/:id">
        {(params) => (
          <UnifiedLayout>
            <SalesCompsDetail {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/projects">
        {() => (
          <UnifiedLayout>
            <ScProjectsIndex />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/projects/:id">
        {(params) => (
          <UnifiedLayout>
            <ScProjectsReport {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/rate-comps">
        {() => (
          <UnifiedLayout>
            <RateCompsIndex />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/rate-comps/upload">
        {() => (
          <UnifiedLayout>
            <RateCompsUpload />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/rate-comps/columns">
        {() => (
          <UnifiedLayout>
            <RateCompsColumnManager />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/rate-comps/bulk-edit">
        {() => (
          <UnifiedLayout>
            <RateCompsBulkEdit />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/rate-comps/compare">
        {() => (
          <UnifiedLayout>
            <RateCompsCompare />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/rate-comps/:id">
        {(params) => (
          <UnifiedLayout>
            <RateCompsDetail {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/demographics">
        {() => (
          <UnifiedLayout>
            <DemographicsIndex />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/benchmarks">
        {() => (
          <UnifiedLayout>
            <BenchmarksIndex />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects">
        {() => (
          <UnifiedLayout>
            <ModelingProjectsIndex />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/settings">
        {() => (
          <UnifiedLayout>
            <ModelingSettings />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/transaction-closing">
        {(params) => (
          <UnifiedLayout>
            <TransactionClosingPage {...params} />
          </UnifiedLayout>
        )}
      </Route>
      
      {/* Document Intelligence Route */}
      <Route path="/modeling/projects/:projectId/doc-intel">
        {(params) => (
          <UnifiedLayout>
            <DocumentIntelligence {...params} />
          </UnifiedLayout>
        )}
      </Route>
      
      {/* Exit Strategy Suite Routes */}
      <Route path="/modeling/projects/:projectId/exit">
        {(params) => (
          <UnifiedLayout>
            <ExitStrategyDashboard {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/scenarios">
        {(params) => (
          <UnifiedLayout>
            <ExitScenarios {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/scenarios/:scenarioId">
        {(params) => (
          <UnifiedLayout>
            <ExitScenarioDetail {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/tax">
        {(params) => (
          <UnifiedLayout>
            <ExitTaxCalculator {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/net-proceeds">
        {(params) => (
          <UnifiedLayout>
            <ExitNetProceeds {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/1031">
        {(params) => (
          <UnifiedLayout>
            <Exit1031Exchange {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/dst">
        {(params) => (
          <UnifiedLayout>
            <ExitDSTAnalysis {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/seller-financing">
        {(params) => (
          <UnifiedLayout>
            <ExitSellerFinancing {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/earnout">
        {(params) => (
          <UnifiedLayout>
            <ExitEarnout {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/waterfall">
        {(params) => (
          <UnifiedLayout>
            <ExitWaterfall {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/irr">
        {(params) => (
          <UnifiedLayout>
            <ExitIRRCalculator {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/sensitivity">
        {(params) => (
          <UnifiedLayout>
            <ExitSensitivity {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/ai-insights">
        {(params) => (
          <UnifiedLayout>
            <ExitAIInsights {...params} />
          </UnifiedLayout>
        )}
      </Route>
      
      <Route path="/modeling/debt-scenarios">
        {() => (
          <UnifiedLayout>
            <DebtScenariosIndex />
          </UnifiedLayout>
        )}
      </Route>
      
      {/* Demo Routes */}
      <Route path="/demo/sortable" component={SortableListDemo} />
      <Route path="/demo/milestone" component={MilestoneDemo} />
      
      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Suspense fallback={<PageLoader />}>
            <Router />
          </Suspense>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
