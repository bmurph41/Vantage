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
import InvestorDashboard from "@/pages/investor-dashboard";
import OwnerDashboard from "@/pages/owner-dashboard";
import AuditLogsPage from "@/pages/audit-logs";
import CRMDashboard from "@/pages/crm-dashboard";
import CRMSidebar from "@/components/crm/crm-sidebar";
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
import SortableListDemo from "@/pages/demo/SortableListDemo";
import MilestoneDemo from "@/pages/milestone-demo";
import NotFound from "@/pages/not-found";

// CRM Layout wrapper with sidebar
function CRMLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <CRMSidebar />
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
      {/* Due Diligence Tracker Routes */}
      <Route path="/" component={Dashboard} />
      <Route path="/projects" component={Dashboard} />
      <Route path="/projects/summary" component={AllProjectsSummaryPage} />
      <Route path="/investor" component={InvestorDashboard} />
      <Route path="/owner" component={OwnerDashboard} />
      <Route path="/audit-logs" component={AuditLogsPage} />
      <Route path="/user/settings" component={UserSettingsPage} />
      <Route path="/projects/:id" component={ProjectPage} />
      <Route path="/dd/projects/:id" component={ProjectPage} />
      <Route path="/notifications/:id" component={NotificationSettingsWrapper} />
      <Route path="/projects/:id/notifications" component={NotificationSettingsWrapper} />
      <Route path="/dd/projects/:id/notifications" component={NotificationSettingsWrapper} />
      <Route path="/projects/:id/settings" component={NotificationSettingsWrapper} />
      <Route path="/dd/projects/:id/settings" component={NotificationSettingsWrapper} />
      <Route path="/projects/:id/progress-report" component={DDProgressReportPage} />
      <Route path="/projects/:id/dd-progress-report" component={DDProgressReportPage} />
      <Route path="/dd/projects/:id/progress-report" component={DDProgressReportPage} />
      <Route path="/dd/projects/:id/dd-progress-report" component={DDProgressReportPage} />
      
      {/* CRM Routes with CRM Layout */}
      <Route path="/crm">
        {() => (
          <CRMLayout>
            <CRMDashboard />
          </CRMLayout>
        )}
      </Route>
      <Route path="/crm/pipeline">
        {() => (
          <CRMLayout>
            <Pipeline />
          </CRMLayout>
        )}
      </Route>
      <Route path="/crm/leads">
        {() => (
          <CRMLayout>
            <Leads />
          </CRMLayout>
        )}
      </Route>
      <Route path="/crm/contacts">
        {() => (
          <CRMLayout>
            <Contacts />
          </CRMLayout>
        )}
      </Route>
      <Route path="/crm/companies">
        {() => (
          <CRMLayout>
            <Companies />
          </CRMLayout>
        )}
      </Route>
      <Route path="/crm/properties">
        {() => (
          <CRMLayout>
            <Properties />
          </CRMLayout>
        )}
      </Route>
      <Route path="/crm/deals">
        {() => (
          <CRMLayout>
            <Deals />
          </CRMLayout>
        )}
      </Route>
      <Route path="/crm/deals/:dealId">
        {() => (
          <CRMLayout>
            <DealDetail />
          </CRMLayout>
        )}
      </Route>
      <Route path="/crm/activities">
        {() => (
          <CRMLayout>
            <Activities />
          </CRMLayout>
        )}
      </Route>
      <Route path="/crm/prospecting">
        {() => (
          <CRMLayout>
            <Prospecting />
          </CRMLayout>
        )}
      </Route>
      <Route path="/crm/analytics">
        {() => (
          <CRMLayout>
            <Analytics />
          </CRMLayout>
        )}
      </Route>
      <Route path="/crm/forecast">
        {() => (
          <CRMLayout>
            <Forecast />
          </CRMLayout>
        )}
      </Route>
      <Route path="/crm/forms">
        {() => (
          <CRMLayout>
            <Forms />
          </CRMLayout>
        )}
      </Route>
      <Route path="/crm/labels">
        {() => (
          <CRMLayout>
            <Labels />
          </CRMLayout>
        )}
      </Route>
      <Route path="/crm/products">
        {() => (
          <CRMLayout>
            <Products />
          </CRMLayout>
        )}
      </Route>
      <Route path="/crm/workflows">
        {() => (
          <CRMLayout>
            <Workflows />
          </CRMLayout>
        )}
      </Route>
      <Route path="/crm/webhooks">
        {() => (
          <CRMLayout>
            <Webhooks />
          </CRMLayout>
        )}
      </Route>
      <Route path="/crm/dedupe">
        {() => (
          <CRMLayout>
            <Dedupe />
          </CRMLayout>
        )}
      </Route>
      <Route path="/crm/scoring">
        {() => (
          <CRMLayout>
            <Scoring />
          </CRMLayout>
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
