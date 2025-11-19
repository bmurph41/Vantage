import { Switch, Route, Router } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { dockTalkQueryClient } from "./lib/queryClient";
import { AuthProvider } from "./hooks/use-auth";
import Dashboard from "./pages/dashboard";
import EntityProfile from "./pages/entity-profile";
import NotFound from "./pages/not-found";

export default function DockTalkRouter() {
  return (
    <QueryClientProvider client={dockTalkQueryClient}>
      <AuthProvider>
        <Router base="/docktalk">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/entities/:id" component={EntityProfile} />
            <Route component={NotFound} />
          </Switch>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}
