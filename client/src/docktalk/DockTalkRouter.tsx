import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { dockTalkQueryClient } from "./lib/queryClient";
import Dashboard from "./pages/dashboard";
import AdminPage from "./pages/admin";
import MarketIntelligence from "./pages/market-intelligence";
import SavedArticles from "./pages/saved";
import DealsPage from "./pages/deals";
import EntityProfile from "./pages/entity-profile";
import NotFound from "./pages/not-found";
import Sidebar from "./components/sidebar";

export default function DockTalkRouter() {
  return (
    <QueryClientProvider client={dockTalkQueryClient}>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Switch>
            <Route path="/docktalk" component={Dashboard} />
            <Route path="/docktalk/admin" component={AdminPage} />
            <Route path="/docktalk/market-intelligence" component={MarketIntelligence} />
            <Route path="/docktalk/deals" component={DealsPage} />
            <Route path="/docktalk/entities/:id" component={EntityProfile} />
            <Route path="/docktalk/saved" component={SavedArticles} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </QueryClientProvider>
  );
}
