import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { Loader2 } from "lucide-react";

const Dashboard = lazy(() => import("./pages/dashboard"));
const EntityProfile = lazy(() => import("./pages/entity-profile"));
const Admin = lazy(() => import("./pages/admin"));
const ArticleManagement = lazy(() => import("./pages/article-management"));
const NotFound = lazy(() => import("./pages/not-found"));

function DockTalkLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

export default function DockTalkRouter() {
  return (
    <Suspense fallback={<DockTalkLoader />}>
      <Switch>
        <Route path="/docktalk" component={Dashboard} />
        <Route path="/docktalk/market-intelligence" component={Dashboard} />
        <Route path="/docktalk/m&a-spotlight" component={Dashboard} />
        <Route path="/docktalk/saved" component={Dashboard} />
        <Route path="/docktalk/portfolio" component={Dashboard} />
        <Route path="/docktalk/saved-searches" component={Dashboard} />
        <Route path="/docktalk/watchlists" component={Dashboard} />
        <Route path="/docktalk/notifications" component={Dashboard} />
        <Route path="/docktalk/sources" component={Dashboard} />
        <Route path="/docktalk/article-management" component={ArticleManagement} />
        <Route path="/docktalk/admin" component={Admin} />
        <Route path="/docktalk/entities/:id" component={EntityProfile} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}
