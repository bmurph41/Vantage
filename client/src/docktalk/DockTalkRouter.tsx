import { lazy, Suspense } from "react";
import { Switch, Route, Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

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

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { hasPermission, isLoading } = useAuth();
  
  if (isLoading) {
    return <DockTalkLoader />;
  }
  
  if (!hasPermission('manage:docktalk')) {
    return <Redirect to="/docktalk" />;
  }
  
  return <Component />;
}

export default function DockTalkRouter() {
  return (
    <Suspense fallback={<DockTalkLoader />}>
      <Switch>
        <Route path="/docktalk" component={Dashboard} />
        <Route path="/docktalk/market-intelligence" component={Dashboard} />
        <Route path="/docktalk/m&a-spotlight" component={Dashboard} />
        <Route path="/docktalk/saved" component={Dashboard} />
        <Route path="/docktalk/watchlist" component={Dashboard} />
        <Route path="/docktalk/email-alerts" component={Dashboard} />
        <Route path="/docktalk/notifications" component={Dashboard} />
        <Route path="/docktalk/sources" component={Dashboard} />
        <Route path="/docktalk/article-management">
          {() => <AdminRoute component={ArticleManagement} />}
        </Route>
        <Route path="/docktalk/admin">
          {() => <AdminRoute component={Admin} />}
        </Route>
        <Route path="/docktalk/entities/:id" component={EntityProfile} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}
