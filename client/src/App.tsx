import { Switch, Route } from "wouter";
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
import Pipeline from "@/pages/pipeline";
import Leads from "@/pages/leads";
import Contacts from "@/pages/contacts";
import Companies from "@/pages/companies";
import Deals from "@/pages/deals";
import DealDetail from "@/pages/deal-detail";
import Activities from "@/pages/activities";
import Properties from "@/pages/properties";
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
// Analysis / Sales Comps pages
import SalesCompsIndex from "@/pages/analysis/sales-comps/Index";
import SalesCompsDetail from "@/pages/analysis/sales-comps/Detail";
import SalesCompsUpload from "@/pages/analysis/sales-comps/Upload";
import SalesCompsCompare from "@/pages/analysis/sales-comps/Compare";
import SalesCompsBulkEdit from "@/pages/analysis/sales-comps/BulkEdit";
import SalesCompsColumnManager from "@/pages/analysis/sales-comps/ColumnManager";
import ScProjectsIndex from "@/pages/analysis/projects/Index";
import ScProjectsReport from "@/pages/analysis/projects/Report";
import RateCompsIndex from "@/pages/analysis/rate-comps/Index";

// Unified Layout wrapper with sidebar for both DD Tracker and CRM
function UnifiedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <UnifiedSidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
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
      <Route path="/crm/activities">
        {() => (
          <UnifiedLayout>
            <Activities />
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

      {/* Analysis / Sales Comps Routes */}
      <Route path="/analysis/sales-comps">
        {() => (
          <UnifiedLayout>
            <SalesCompsIndex />
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
