import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import LaunchScheduling from "@/pages/launch-scheduling";
import CustomerManagement from "@/pages/customer-management";
import Inventory from "@/pages/inventory";
import FinancialReports from "@/pages/financial-reports";
import RentRoll from "@/pages/rent-roll";
import Integrations from "@/pages/integrations";
import Communications from "@/pages/communications";
import Imports from "@/pages/imports";
import SpeedyDockDemo from "@/pages/speedydock-demo";
import MarinaMap from "@/pages/marina-map";
import BookingPortal from "@/pages/booking-portal";
import CustomerPortal from "@/pages/customer-portal";
import PricingManagement from "@/pages/pricing-management";
import MessagingPage from "@/pages/messaging";
import UserManagement from "@/pages/user-management";
import PortfolioDashboard from "@/pages/portfolio-dashboard";
import Contracts from "@/pages/contracts";
import AuditTrail from "@/pages/audit-trail";
import ApiDocs from "@/pages/api-docs";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/book" component={BookingPortal} />
          <Route path="/my-account" component={CustomerPortal} />
          <Route component={Landing} />
        </>
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/book" component={BookingPortal} />
          <Route path="/my-account" component={CustomerPortal} />
          <Route path="/pricing" component={PricingManagement} />
          <Route path="/messages" component={MessagingPage} />
          <Route path="/marina-map" component={MarinaMap} />
          <Route path="/launch-scheduling" component={LaunchScheduling} />
          <Route path="/customers" component={CustomerManagement} />
          <Route path="/inventory" component={Inventory} />
          <Route path="/financial-reports" component={FinancialReports} />
          <Route path="/rent-roll" component={RentRoll} />
          <Route path="/integrations" component={Integrations} />
          <Route path="/communications" component={Communications} />
          <Route path="/imports" component={Imports} />
          <Route path="/speedydock-demo" component={SpeedyDockDemo} />
          <Route path="/users" component={UserManagement} />
          <Route path="/portfolio" component={PortfolioDashboard} />
          <Route path="/contracts" component={Contracts} />
          <Route path="/audit-trail" component={AuditTrail} />
          <Route path="/api-docs" component={ApiDocs} />
          <Route component={NotFound} />
        </>
      )}
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
