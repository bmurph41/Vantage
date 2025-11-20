import { Switch, Route } from "wouter";
import Dashboard from "./pages/dashboard";
import EntityProfile from "./pages/entity-profile";
import MarketIntelligence from "./pages/market-intelligence";
import Deals from "./pages/deals";
import SavedArticles from "./pages/saved";
import Admin from "./pages/admin";
import NotFound from "./pages/not-found";

export default function DockTalkRouter() {
  return (
    <Switch>
      <Route path="/docktalk" component={Dashboard} />
      <Route path="/docktalk/market-intelligence" component={MarketIntelligence} />
      <Route path="/docktalk/m&a-spotlight" component={Deals} />
      <Route path="/docktalk/saved" component={SavedArticles} />
      <Route path="/docktalk/admin" component={Admin} />
      <Route path="/docktalk/entities/:id" component={EntityProfile} />
      <Route component={NotFound} />
    </Switch>
  );
}
