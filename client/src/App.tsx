import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import ProjectPage from "@/pages/project";
import NotificationSettingsPage from "@/pages/notification-settings";
import NotFound from "@/pages/not-found";

// Wrapper component to handle router props for notification settings
function NotificationSettingsWrapper(props: any) {
  return <NotificationSettingsPage />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/projects/:id" component={ProjectPage} />
      <Route path="/projects/:id/notifications" component={NotificationSettingsWrapper} />
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
