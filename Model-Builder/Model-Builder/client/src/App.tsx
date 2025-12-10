import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import OMBuilder from "@/pages/om-builder";
import ProjectOms from "@/pages/project-oms";
import OmExportPage from "@/pages/om-export";
import { OmProvider } from "@/lib/om-context";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ProjectOms} />
      <Route path="/builder" component={OMBuilder} />
      <Route path="/export" component={OmExportPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <OmProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </OmProvider>
    </QueryClientProvider>
  );
}

export default App;
