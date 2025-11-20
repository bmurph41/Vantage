import { Router, Switch, Route } from "wouter";
import Dashboard from "./pages/dashboard";
import EntityProfile from "./pages/entity-profile";

export default function DockTalkRouter() {
  return (
    <Router base="/docktalk">
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/entities/:id" component={EntityProfile} />
        <Route path="/market-intelligence" component={Dashboard} />
        <Route path="/m&a-spotlight" component={Dashboard} />
        <Route path="/saved" component={Dashboard} />
      </Switch>
    </Router>
  );
}
