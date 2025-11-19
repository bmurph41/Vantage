import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import ProjectPage from "@/pages/project";
import NotificationSettingsPage from "@/pages/notification-settings";
import DDProgressReportPage from "@/pages/dd-progress-report";
import AllProjectsSummaryPage from "@/pages/all-projects-summary";
import UserSettingsPage from "@/pages/user-settings";
import AuditLogsPage from "@/pages/audit-logs";
import CRMDashboard from "@/pages/crm-dashboard";
import UnifiedSidebar from "@/components/unified-sidebar";
import PendingNotificationsBanner from "@/components/pending-notifications-banner";
import Pipeline from "@/pages/pipeline";
import Leads from "@/pages/leads";
import Contacts from "@/pages/contacts";
import Companies from "@/pages/companies";
import Deals from "@/pages/deals";
import DealDetail from "@/pages/deal-detail";
import Properties from "@/pages/properties";
import PendingProperties from "@/pages/pending-properties";
import PendingContacts from "@/pages/pending-contacts";
import PendingCompanies from "@/pages/pending-companies";
import Prospecting from "@/pages/prospecting";
import Analytics from "@/pages/analytics";
import Forecast from "@/pages/forecast";
import Forms from "@/pages/forms";
import Labels from "@/pages/labels";
import Products from "@/pages/products";
import Workflows from "@/pages/workflows";
import Webhooks from "@/pages/webhooks";
import Dedupe from "@/pages/dedupe";
import Scoring from "@/pages/scoring";
import ImportContacts from "@/pages/import-contacts";
import ImportHistory from "@/pages/import-history";
import SortableListDemo from "@/pages/demo/SortableListDemo";
import MilestoneDemo from "@/pages/milestone-demo";
import NotFound from "@/pages/not-found";
import CrmTasks from "@/pages/crm-tasks";
import MarketingAutomation from "@/pages/marketing-automation";
import CalendarSettings from "@/pages/calendar-settings";
// Operations pages
import CustomerAnalytics from "@/pages/operations/CustomerAnalytics";
import RentRoll from "@/pages/operations/RentRoll";
import RentRollPortfolio from "@/pages/operations/rent-roll/Portfolio";
import RentRollProjects from "@/pages/operations/rent-roll/Projects";
// Operations pages - Fuel Sales
import FuelSalesDashboard from "@/pages/operations/fuel/Dashboard";
import FuelSalesTransactions from "@/pages/operations/fuel/Transactions";
import FuelSalesInventory from "@/pages/operations/fuel/Inventory";
import FuelSalesAnalytics from "@/pages/operations/fuel/Analytics";
import FuelSalesReports from "@/pages/operations/fuel/Reports";
import FuelSalesFinancialModel from "@/pages/operations/fuel/FinancialModel";
import FuelSalesSettings from "@/pages/operations/fuel/Settings";
import FuelSalesImportHistory from "@/pages/operations/fuel/ImportHistory";
import FuelSalesAuditTrail from "@/pages/operations/fuel/AuditTrail";
// Operations pages - Ship Store
import ShipStoreDashboard from "@/pages/operations/ship-store/Dashboard";
import ShipStorePOS from "@/pages/operations/ship-store/POS";
import ShipStoreInventory from "@/pages/operations/ship-store/Inventory";
import ShipStoreTransactions from "@/pages/operations/ship-store/Transactions";
import ShipStoreCheckout from "@/pages/operations/ship-store/Checkout";
import ShipStoreAnalytics from "@/pages/operations/ship-store/Analytics";
import ShipStoreReports from "@/pages/operations/ship-store/Reports";
// Operations pages - Marketing
import MarketingDashboard from "@/pages/operations/marketing/Dashboard";
import MarketingCampaigns from "@/pages/operations/marketing/Campaigns";
import MarketingExpenses from "@/pages/operations/marketing/Expenses";
import MarketingAttribution from "@/pages/operations/marketing/Attribution";
import MarketingEmailCampaigns from "@/pages/operations/marketing/EmailCampaigns";
import MarketingSettings from "@/pages/operations/marketing/Settings";
// Analysis / Sales Comps pages
import SalesCompsIndex from "@/pages/analysis/sales-comps/Index";
import SalesCompsAnalytics from "@/pages/analysis/sales-comps/Analytics";
import SalesCompsProjects from "@/pages/analysis/sales-comps/Projects";
import SalesCompsDetail from "@/pages/analysis/sales-comps/Detail";
import SalesCompsUpload from "@/pages/analysis/sales-comps/Upload";
import SalesCompsCompare from "@/pages/analysis/sales-comps/Compare";
import SalesCompsBulkEdit from "@/pages/analysis/sales-comps/BulkEdit";
import SalesCompsColumnManager from "@/pages/analysis/sales-comps/ColumnManager";
import ScProjectsIndex from "@/pages/analysis/projects/Index";
import ScProjectsReport from "@/pages/analysis/projects/Report";
// Analysis / DockTalk 2.0 Full Application
import DockTalkRouter from "@/docktalk/DockTalkRouter";
// Analysis / Rate Comps pages
import RateCompsIndex from "@/pages/analysis/rate-comps/Index";
import RateCompsDetail from "@/pages/analysis/rate-comps/Detail";
import RateCompsUpload from "@/pages/analysis/rate-comps/Upload";
import RateCompsCompare from "@/pages/analysis/rate-comps/Compare";
import RateCompsBulkEdit from "@/pages/analysis/rate-comps/BulkEdit";
import RateCompsColumnManager from "@/pages/analysis/rate-comps/ColumnManager";
import DemographicsIndex from "@/pages/analysis/demographics/Index";
import BenchmarksIndex from "@/pages/analysis/benchmarks/Index";
import DebtScenariosIndex from "@/pages/modeling/debt-scenarios/Index";
import ModelingProjectsIndex from "@/pages/modeling/projects";
// VDR pages
import VDRDashboard from "@/pages/vdr/Dashboard";
import ProjectVDR from "@/pages/vdr/ProjectVDR";
import DataRequest from "@/pages/vdr/DataRequest";

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
  return (
    <Switch>
      {/* Due Diligence Tracker Routes with Unified Layout */}
      <Route path="/">
        {() => (
          <UnifiedLayout>
            <AllProjectsSummaryPage />
          </UnifiedLayout>
        )}
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

      {/* DockTalk Full Application - Standalone Router */}
      <Route path="/docktalk">
        {() => <DockTalkRouter />}
      </Route>
      <Route path="/docktalk/:rest*">
        {() => <DockTalkRouter />}
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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
