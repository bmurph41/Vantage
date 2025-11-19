import { Switch, Route, Router } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { dockTalkQueryClient } from "./lib/queryClient";
import { AuthProvider } from "./hooks/use-auth";
import Dashboard from "./pages/dashboard";
import AdminPage from "./pages/admin";
import MarketIntelligence from "./pages/market-intelligence";
import SavedArticles from "./pages/saved";
import DealsPage from "./pages/deals";
import EntityProfile from "./pages/entity-profile";
import NotFound from "./pages/not-found";

export default function DockTalkRouter() {
  return (
    <QueryClientProvider client={dockTalkQueryClient}>
      <AuthProvider>
        <Router base="/docktalk">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/admin" component={AdminPage} />
            <Route path="/market-intelligence" component={MarketIntelligence} />
            <Route path="/m&a-spotlight" component={DealsPage} />
            <Route path="/entities/:id" component={EntityProfile} />
            <Route path="/saved" component={SavedArticles} />
            <Route component={NotFound} />
          </Switch>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}
