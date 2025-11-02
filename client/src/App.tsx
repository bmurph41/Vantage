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
import SortableListDemo from "@/pages/demo/SortableListDemo";
import MilestoneDemo from "@/pages/milestone-demo";
import NotFound from "@/pages/not-found";

// Wrapper component to handle router props for notification settings
function NotificationSettingsWrapper(props: any) {
  return <NotificationSettingsPage />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/projects" component={Dashboard} />
      <Route path="/projects/summary" component={AllProjectsSummaryPage} />
      <Route path="/investor" component={InvestorDashboard} />
      <Route path="/owner" component={OwnerDashboard} />
      <Route path="/audit-logs" component={AuditLogsPage} />
      <Route path="/crm" component={CRMDashboard} />
      <Route path="/crm/dashboard" component={CRMDashboard} />
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
      <Route path="/demo/sortable" component={SortableListDemo} />
      <Route path="/demo/milestone" component={MilestoneDemo} />
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
