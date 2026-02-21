import { lazy, Suspense } from "react";
import { Switch, Route, Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const Dashboard = lazy(() => import("./pages/dashboard"));
const EntityProfile = lazy(() => import("./pages/entity-profile"));
const Admin = lazy(() => import("./pages/admin"));
const ArticleManagement = lazy(() => import("./pages/article-management"));
const NotFound = lazy(() => import("./pages/not-found"));

function DocketLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { hasPermission, isLoading } = useAuth();
  
  if (isLoading) {
    return <DocketLoader />;
  }
  
  if (!hasPermission('manage:docket')) {
    return <Redirect to="/docket" />;
  }
  
  return <Component />;
}

export default function DocketRouter() {
  return (
    <Suspense fallback={<DocketLoader />}>
      <Switch>
        <Route path="/docket" component={Dashboard} />
        <Route path="/docket/market-intelligence" component={Dashboard} />
        <Route path="/docket/m&a-spotlight" component={Dashboard} />
        <Route path="/docket/saved" component={Dashboard} />
        <Route path="/docket/watchlist" component={Dashboard} />
        <Route path="/docket/email-alerts" component={Dashboard} />
        <Route path="/docket/notifications" component={Dashboard} />
        <Route path="/docket/sources" component={Dashboard} />
        <Route path="/docket/article-management">
          {() => <AdminRoute component={ArticleManagement} />}
        </Route>
        <Route path="/docket/admin">
          {() => <AdminRoute component={Admin} />}
        </Route>
        <Route path="/docket/entities/:id" component={EntityProfile} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}
