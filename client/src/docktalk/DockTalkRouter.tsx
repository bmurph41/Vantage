import { Switch, Route } from "wouter";
import Dashboard from "./pages/dashboard";
import EntityProfile from "./pages/entity-profile";
import NotFound from "./pages/not-found";

export default function DockTalkRouter() {
  return (
    <Switch>
      <Route path="/docktalk" component={Dashboard} />
      <Route path="/docktalk/entities/:id" component={EntityProfile} />
      <Route path="/docktalk/:rest*" component={NotFound} />
    </Switch>
  );
}
