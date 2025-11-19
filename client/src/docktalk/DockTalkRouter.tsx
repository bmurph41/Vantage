import { Switch, Route } from "wouter";
import Dashboard from "./pages/dashboard";
import EntityProfile from "./pages/entity-profile";

export default function DockTalkRouter() {
  return (
    <Switch>
      <Route path="/docktalk" component={Dashboard} />
      <Route path="/docktalk/entities/:id" component={EntityProfile} />
      <Route path="/docktalk/market-intelligence" component={Dashboard} />
      <Route path="/docktalk/m&a-spotlight" component={Dashboard} />
      <Route path="/docktalk/saved" component={Dashboard} />
    </Switch>
  );
}
