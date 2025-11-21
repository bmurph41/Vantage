import { Switch, Route } from "wouter";
import Dashboard from "./pages/dashboard";
import EntityProfile from "./pages/entity-profile";
import Admin from "./pages/admin";
import NotFound from "./pages/not-found";

export default function DockTalkRouter() {
  return (
    <Switch>
      <Route path="/docktalk" component={Dashboard} />
      <Route path="/docktalk/market-intelligence" component={Dashboard} />
      <Route path="/docktalk/m&a-spotlight" component={Dashboard} />
      <Route path="/docktalk/saved" component={Dashboard} />
      <Route path="/docktalk/portfolio" component={Dashboard} />
      <Route path="/docktalk/admin" component={Admin} />
      <Route path="/docktalk/entities/:id" component={EntityProfile} />
      <Route component={NotFound} />
    </Switch>
  );
}
