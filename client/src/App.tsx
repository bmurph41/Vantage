import { lazy, Suspense } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";
import { CommandPalette } from "@/components/CommandPalette";
import { Breadcrumb } from "@/components/Breadcrumb";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

// Eagerly load critical pages for instant navigation (no white screen)
import Dashboard from "@/pages/dashboard";
import CRMDashboard from "@/pages/crm-dashboard";
import AllProjectsSummaryPage from "@/pages/all-projects-summary";

// Lazy load layout components
const UnifiedSidebar = lazy(() => import("@/components/unified-sidebar"));
const PendingNotificationsBanner = lazy(() => import("@/components/pending-notifications-banner"));
const DockTalkRouter = lazy(() => import("@/docktalk/DockTalkRouter"));

// Loading fallback component - simple spinner (no fake content)
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

// Auth guard component - redirects to login if not authenticated
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  
  return <>{children}</>;
}

// Landing page or dashboard redirect based on auth status
function LandingOrDashboard() {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (isAuthenticated) {
    return <Redirect to="/dashboard" />;
  }
  
  return (
    <Suspense fallback={<PageLoader />}>
      <DesignPreview />
    </Suspense>
  );
}

// Code-split less frequently used pages
const ProjectPage = lazy(() => import("@/pages/project"));
const NotificationSettingsPage = lazy(() => import("@/pages/notification-settings"));
const DDProgressReportPage = lazy(() => import("@/pages/dd-progress-report"));
const UserSettingsPage = lazy(() => import("@/pages/user-settings"));
const SecuritySettingsPage = lazy(() => import("@/pages/security-settings"));
const AuditLogsPage = lazy(() => import("@/pages/audit-logs"));
const Pipeline = lazy(() => import("@/pages/pipeline"));
const Leads = lazy(() => import("@/pages/leads"));
const Contacts = lazy(() => import("@/pages/contacts"));
const Companies = lazy(() => import("@/pages/companies"));
const Deals = lazy(() => import("@/pages/deals"));
const DealWorkspace = lazy(() => import("@/pages/deal-workspace"));
const DealDetail = lazy(() => import("@/pages/deal-detail"));
const Properties = lazy(() => import("@/pages/properties"));
const PendingProperties = lazy(() => import("@/pages/pending-properties"));
const PendingContacts = lazy(() => import("@/pages/pending-contacts"));
const PendingCompanies = lazy(() => import("@/pages/pending-companies"));
const Prospecting = lazy(() => import("@/pages/prospecting"));
const Analytics = lazy(() => import("@/pages/analytics"));
const Forecast = lazy(() => import("@/pages/forecast"));
const Forms = lazy(() => import("@/pages/forms"));
const Labels = lazy(() => import("@/pages/labels"));
const Products = lazy(() => import("@/pages/products"));
const Workflows = lazy(() => import("@/pages/workflows"));
const Webhooks = lazy(() => import("@/pages/webhooks"));
const Dedupe = lazy(() => import("@/pages/dedupe"));
const ArchivePage = lazy(() => import("@/pages/crm/ArchivePage"));
const Scoring = lazy(() => import("@/pages/scoring"));
const ImportContacts = lazy(() => import("@/pages/import-contacts"));
const ImportHistory = lazy(() => import("@/pages/import-history"));
const SortableListDemo = lazy(() => import("@/pages/demo/SortableListDemo"));
const MilestoneDemo = lazy(() => import("@/pages/milestone-demo"));
const NotFound = lazy(() => import("@/pages/not-found"));
const LoginPage = lazy(() => import("@/pages/auth/login"));
const SignupPage = lazy(() => import("@/pages/auth/signup"));
const ForgotPasswordPage = lazy(() => import("@/pages/auth/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/auth/reset-password"));
const DesignPreview = lazy(() => import("@/pages/design-preview"));
const PacksSettings = lazy(() => import("@/pages/packs-settings"));
const AccountMappingPage = lazy(() => import("@/pages/admin/AccountMappingPage"));
const FeatureGate = lazy(() => import("@/components/FeatureGate").then(m => ({ default: m.FeatureGate })));
const CrmTasks = lazy(() => import("@/pages/crm-tasks"));
const MarketingAutomation = lazy(() => import("@/pages/marketing-automation"));
const CalendarSettings = lazy(() => import("@/pages/calendar-settings"));
const CustomerAnalytics = lazy(() => import("@/pages/operations/CustomerAnalytics"));
const OwnedMarinas = lazy(() => import("@/pages/operations/OwnedMarinas"));
const Portfolio = lazy(() => import("@/pages/Portfolio"));
const MarinalyticsPage = lazy(() => import("@/pages/marinalytics"));
const MarinaDetail = lazy(() => import("@/pages/portfolio/MarinaDetail"));
// Rent Roll V2 - Layouts (lazy with preloading)
const RentRollV2ProjectLayout = lazy(() => import("@/modules/rent-roll-v2/layouts/ProjectLayout"));
const RentRollV2PortfolioLayout = lazy(() => import("@/modules/rent-roll-v2/layouts/PortfolioLayout"));

// Preload rent roll layouts on app start for faster navigation
const preloadRentRollLayouts = () => {
  import("@/modules/rent-roll-v2/layouts/ProjectLayout");
  import("@/modules/rent-roll-v2/layouts/PortfolioLayout");
  import("@/modules/rent-roll-v2/pages/executive-dashboard");
  import("@/modules/rent-roll-v2/pages/project-hub");
  import("@/modules/rent-roll-v2/pages/portfolio");
};
if (typeof window !== 'undefined') {
  setTimeout(preloadRentRollLayouts, 100);
}

// Rent Roll V2 - Marina-centric module (lazy load pages)
const RentRollV2Executive = lazy(() => import("@/modules/rent-roll-v2/pages/executive-dashboard"));
const RentRollV2Projects = lazy(() => import("@/modules/rent-roll-v2/pages/project-hub"));
const RentRollV2Portfolio = lazy(() => import("@/modules/rent-roll-v2/pages/portfolio"));
const RentRollV2Dashboard = lazy(() => import("@/modules/rent-roll-v2/pages/rent-roll-dashboard"));
const RentRollV2Cohorts = lazy(() => import("@/modules/rent-roll-v2/pages/cohort-analysis"));
const RentRollV2Reports = lazy(() => import("@/modules/rent-roll-v2/pages/reports"));
const RentRollV2Scenarios = lazy(() => import("@/modules/rent-roll-v2/pages/scenarios"));
const RentRollV2AdminTypes = lazy(() => import("@/modules/rent-roll-v2/pages/AdminTypeManagement"));
const RentRollV2GLReconciliation = lazy(() => import("@/modules/rent-roll-v2/pages/gl-reconciliation"));
const RentRollV2Integrations = lazy(() => import("@/modules/rent-roll-v2/pages/integrations"));
const RentRollV2Reconciliation = lazy(() => import("@/modules/rent-roll-v2/pages/reconciliation"));
const RentRollV2ReportPackages = lazy(() => import("@/modules/rent-roll-v2/pages/report-packages"));
const RentRollV2Snapshots = lazy(() => import("@/modules/rent-roll-v2/pages/snapshots"));
// Rent Roll V2 - Data Quality pages
const RentRollV2DataQuality = lazy(() => import("@/modules/rent-roll-v2/pages/data-quality"));
const RentRollV2PortfolioDataQuality = lazy(() => import("@/modules/rent-roll-v2/pages/portfolio-data-quality"));

// Operations - Tabbed Module Pages
const FuelSalesTabbed = lazy(() => import("@/pages/operations/FuelSalesTabbed"));
const ShipStoreTabbed = lazy(() => import("@/pages/operations/ShipStoreTabbed"));
const DockitTabbed = lazy(() => import("@/pages/operations/DockitTabbed"));
const WorkspacesList = lazy(() => import("@/pages/workspaces/index"));
const WorkspaceDetail = lazy(() => import("@/pages/workspaces/[workspaceId]"));
const MarketingTabbed = lazy(() => import("@/pages/operations/MarketingTabbed"));
const ServiceTabbed = lazy(() => import("@/pages/operations/ServiceTabbed"));
const BoatRentalsTabbed = lazy(() => import("@/pages/operations/BoatRentalsTabbed"));
const BoatClubTabbed = lazy(() => import("@/pages/operations/BoatClubTabbed"));
const BoatSalesTabbed = lazy(() => import("@/pages/operations/BoatSalesTabbed"));
const SalesCompsIndex = lazy(() => import("@/pages/analysis/sales-comps/Index"));
const SalesCompsAnalytics = lazy(() => import("@/pages/analysis/sales-comps/Analytics"));
const SalesCompsProjects = lazy(() => import("@/pages/analysis/sales-comps/Projects"));
const SalesCompsMapView = lazy(() => import("@/pages/analysis/sales-comps/MapView"));
const SalesCompsDetail = lazy(() => import("@/pages/analysis/sales-comps/Detail"));
const SalesCompsUpload = lazy(() => import("@/pages/analysis/sales-comps/Upload"));
const SalesCompsCompare = lazy(() => import("@/pages/analysis/sales-comps/Compare"));
const SalesCompsBulkEdit = lazy(() => import("@/pages/analysis/sales-comps/BulkEdit"));
const SalesCompsColumnManager = lazy(() => import("@/pages/analysis/sales-comps/ColumnManager"));
const SalesCompsPendingProfiles = lazy(() => import("@/pages/analysis/sales-comps/PendingProfiles"));
const ScProjectsIndex = lazy(() => import("@/pages/analysis/projects/Index"));
const ScProjectsReport = lazy(() => import("@/pages/analysis/projects/Report"));
const RateCompsIndex = lazy(() => import("@/pages/analysis/rate-comps/Index"));
const RateCompsAnalytics = lazy(() => import("@/pages/analysis/rate-comps/Analytics"));
const RateCompsDetail = lazy(() => import("@/pages/analysis/rate-comps/Detail"));
const RateCompsUpload = lazy(() => import("@/pages/analysis/rate-comps/Upload"));
const RateCompsMapView = lazy(() => import("@/pages/analysis/rate-comps/MapView"));
const RateCompsCompare = lazy(() => import("@/pages/analysis/rate-comps/Compare"));
const RateCompsBulkEdit = lazy(() => import("@/pages/analysis/rate-comps/BulkEdit"));
const RateCompsColumnManager = lazy(() => import("@/pages/analysis/rate-comps/ColumnManager"));
const MarinaDatabase = lazy(() => import("@/pages/marina-database"));
const DemographicsIndex = lazy(() => import("@/pages/analysis/demographics/Index"));
const BenchmarksIndex = lazy(() => import("@/pages/analysis/benchmarks/Index"));
const CapitalMarketsIndex = lazy(() => import("@/pages/analysis/capital-markets"));
const DebtScenariosIndex = lazy(() => import("@/pages/modeling/debt-scenarios/Index"));
const ExitStrategiesIndex = lazy(() => import("@/pages/modeling/exit-strategies"));
const ModelingProjectsIndex = lazy(() => import("@/pages/modeling/projects"));
const ModelingPortfolio = lazy(() => import("@/pages/modeling/portfolio"));
const ModelingFunds = lazy(() => import("@/pages/modeling/funds"));
const FundDetail = lazy(() => import("@/pages/modeling/funds/[fundId]"));
const LPPortal = lazy(() => import("@/pages/modeling/lp-portal"));
const ModelingSettings = lazy(() => import("@/pages/modeling/settings"));
const TransactionClosingPage = lazy(() => import("@/pages/modeling/projects/transaction-closing"));
const VDRDashboard = lazy(() => import("@/pages/vdr/Dashboard"));
const ProjectVDR = lazy(() => import("@/pages/vdr/ProjectVDR"));
const DataRequest = lazy(() => import("@/pages/vdr/DataRequest"));

// Prospecting & Outreach pages (Dashboard consolidated into Board)
const ProspectingBoard = lazy(() => import("@/pages/prospecting/Board"));
const ProspectingOverview = lazy(() => import("@/pages/prospecting/Overview"));
const ProspectingWorkroom = lazy(() => import("@/pages/prospecting/Workroom"));
const MarketTargets = lazy(() => import("@/pages/prospecting/Markets"));
const ProspectingCampaigns = lazy(() => import("@/pages/prospecting/Campaigns"));
const ProspectingAnalytics = lazy(() => import("@/pages/prospecting/Analytics"));
const MarinaMatchIndex = lazy(() => import("@/pages/marinamatch/Index"));
const BrokerPortal = lazy(() => import("@/pages/BrokerPortal"));
const ActivityLog = lazy(() => import("@/pages/activity"));

// Exit Strategy Suite pages
const ExitStrategyDashboard = lazy(() => import("@/pages/modeling/exit/Dashboard"));
const ExitScenarios = lazy(() => import("@/pages/modeling/exit/Scenarios"));
const ExitScenarioDetail = lazy(() => import("@/pages/modeling/exit/ScenarioDetail"));
const ExitTaxCalculator = lazy(() => import("@/pages/modeling/exit/TaxCalculator"));
const ExitNetProceeds = lazy(() => import("@/pages/modeling/exit/NetProceeds"));
const Exit1031Exchange = lazy(() => import("@/pages/modeling/exit/Exchange1031"));
const ExitDSTAnalysis = lazy(() => import("@/pages/modeling/exit/DSTAnalysis"));
const ExitSellerFinancing = lazy(() => import("@/pages/modeling/exit/SellerFinancing"));
const ExitEarnout = lazy(() => import("@/pages/modeling/exit/Earnout"));
const ExitWaterfall = lazy(() => import("@/pages/modeling/exit/Waterfall"));
const ExitIRRCalculator = lazy(() => import("@/pages/modeling/exit/IRRCalculator"));
const ExitSensitivity = lazy(() => import("@/pages/modeling/exit/Sensitivity"));
const ExitAIInsights = lazy(() => import("@/pages/modeling/exit/AIInsights"));

// Document Intelligence
const DocumentIntelligence = lazy(() => import("@/pages/modeling/doc-intel/DocumentIntelligence"));

// P&L Pipeline
const PnlUpload = lazy(() => import("@/pages/modeling/pnl/PnlUpload"));
const PnlReview = lazy(() => import("@/pages/modeling/pnl/PnlReview"));
const PnlKeywordBank = lazy(() => import("@/pages/modeling/pnl/PnlKeywordBank"));
const PnlUploadReview = lazy(() => import("@/pages/modeling/pnl/PnlUploadReview"));

// Project Workspace
const ProjectWorkspace = lazy(() => import("@/pages/modeling/projects/workspace"));

// OM Builder
const ProjectOms = lazy(() => import("@/modules/om-builder/pages/project-oms"));
const OMBuilder = lazy(() => import("@/modules/om-builder/pages/om-builder"));
const OMExport = lazy(() => import("@/modules/om-builder/pages/om-export"));
const OMTemplates = lazy(() => import("@/modules/om-builder/pages/om-templates"));
const OMBrandKits = lazy(() => import("@/modules/om-builder/pages/om-brand-kits"));
const OMCanvasEditor = lazy(() => import("@/pages/om-builder-editor"));

// Lightweight sidebar loader for initial render
function SidebarLoader() {
  return (
    <div className="w-64 h-screen bg-gray-100 dark:bg-gray-900 animate-pulse" />
  );
}

// Unified Layout wrapper with sidebar for both DD Tracker and CRM
// Includes auth guard to redirect unauthenticated users to login
function UnifiedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  
  return (
    <div className="flex h-screen bg-gray-50">
      <Suspense fallback={<SidebarLoader />}>
        <UnifiedSidebar />
      </Suspense>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Suspense fallback={<div className="h-10" />}>
          <PendingNotificationsBanner />
        </Suspense>
        <Breadcrumb />
        <main className="flex-1 overflow-auto">
          <Suspense fallback={<PageLoader />}>
            {children}
          </Suspense>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}

// Wrapper component to handle router props for notification settings
function NotificationSettingsWrapper(props: any) {
  return <NotificationSettingsPage />;
}

function Router() {
  const [, setLocation] = useLocation();

  return (
    <Switch>
      {/* Auth pages - no sidebar, no auth required */}
      <Route path="/login">
        {() => (
          <Suspense fallback={<PageLoader />}>
            <LoginPage />
          </Suspense>
        )}
      </Route>
      <Route path="/signup">
        {() => (
          <Suspense fallback={<PageLoader />}>
            <SignupPage />
          </Suspense>
        )}
      </Route>
      <Route path="/forgot-password">
        {() => (
          <Suspense fallback={<PageLoader />}>
            <ForgotPasswordPage />
          </Suspense>
        )}
      </Route>
      <Route path="/reset-password">
        {() => (
          <Suspense fallback={<PageLoader />}>
            <ResetPasswordPage />
          </Suspense>
        )}
      </Route>
      {/* Public landing page - redirects to dashboard if logged in */}
      <Route path="/">
        {() => <LandingOrDashboard />}
      </Route>
      {/* Keep design-preview as alias */}
      <Route path="/design-preview">
        {() => (
          <Suspense fallback={<PageLoader />}>
            <DesignPreview />
          </Suspense>
        )}
      </Route>
      {/* Protected routes - authentication handled by UnifiedLayout */}
      <Route path="/projects">
        {() => (
          <UnifiedLayout>
            <AllProjectsSummaryPage />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/projects/summary">
        {() => (
          <UnifiedLayout>
            <AllProjectsSummaryPage />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/dd/projects">
        {() => (
          <UnifiedLayout>
            <AllProjectsSummaryPage />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/dashboard">
        {() => (
          <UnifiedLayout>
            <Dashboard />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/progress-report">
        {() => (
          <UnifiedLayout>
            <DDProgressReportPage />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/audit-logs">
        {() => (
          <UnifiedLayout>
            <AuditLogsPage />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/user/settings">
        {() => (
          <UnifiedLayout>
            <UserSettingsPage />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/security">
        {() => (
          <UnifiedLayout>
            <SecuritySettingsPage />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/settings/packs">
        {() => (
          <UnifiedLayout>
            <PacksSettings />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/admin/account-mapping">
        {() => (
          <UnifiedLayout>
            <FeatureGate flag="FINANCIAL_KERNEL_UI_ENABLED">
              <AccountMappingPage />
            </FeatureGate>
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/projects/:id">
        {(params) => (
          <UnifiedLayout>
            <ProjectPage {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/dd/projects/:id">
        {(params) => (
          <UnifiedLayout>
            <ProjectPage {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/notifications/:id" component={NotificationSettingsWrapper} />
      <Route path="/projects/:id/notifications" component={NotificationSettingsWrapper} />
      <Route path="/dd/projects/:id/notifications" component={NotificationSettingsWrapper} />
      <Route path="/projects/:id/settings" component={NotificationSettingsWrapper} />
      <Route path="/dd/projects/:id/settings" component={NotificationSettingsWrapper} />
      <Route path="/projects/:id/progress-report">
        {(params) => (
          <UnifiedLayout>
            <DDProgressReportPage {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/projects/:id/dd-progress-report">
        {(params) => (
          <UnifiedLayout>
            <DDProgressReportPage {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/dd/projects/:id/progress-report">
        {(params) => (
          <UnifiedLayout>
            <DDProgressReportPage {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/dd/projects/:id/dd-progress-report">
        {(params) => (
          <UnifiedLayout>
            <DDProgressReportPage {...params} />
          </UnifiedLayout>
        )}
      </Route>
      
      {/* VDR Routes with Unified Layout */}
      <Route path="/vdr">
        {() => (
          <UnifiedLayout>
            <VDRDashboard />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/vdr/projects/:id">
        {() => (
          <UnifiedLayout>
            <ProjectVDR />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/vdr/:projectId/data-request">
        {() => (
          <UnifiedLayout>
            <DataRequest />
          </UnifiedLayout>
        )}
      </Route>
      
      {/* Rent Roll V2 Routes - Marina-centric module */}
      <Route path="/rent-roll">
        {() => (
          <AuthGuard>
            <UnifiedLayout>
              <Suspense fallback={<PageLoader />}>
                <RentRollV2Executive />
              </Suspense>
            </UnifiedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/executive">
        {() => (
          <AuthGuard>
            <UnifiedLayout>
              <Suspense fallback={<PageLoader />}>
                <RentRollV2Executive />
              </Suspense>
            </UnifiedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/projects">
        {() => (
          <AuthGuard>
            <UnifiedLayout>
              <Suspense fallback={<PageLoader />}>
                <RentRollV2Projects />
              </Suspense>
            </UnifiedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/projects/:id">
        {() => (
          <AuthGuard>
            <UnifiedLayout>
              <Suspense fallback={<PageLoader />}>
                <RentRollV2ProjectLayout>
                  <RentRollV2Dashboard />
                </RentRollV2ProjectLayout>
              </Suspense>
            </UnifiedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/projects/:id/reports">
        {() => (
          <AuthGuard>
            <UnifiedLayout>
              <Suspense fallback={<PageLoader />}>
                <RentRollV2ProjectLayout>
                  <RentRollV2Reports />
                </RentRollV2ProjectLayout>
              </Suspense>
            </UnifiedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/projects/:id/scenarios">
        {() => (
          <AuthGuard>
            <UnifiedLayout>
              <Suspense fallback={<PageLoader />}>
                <RentRollV2ProjectLayout>
                  <RentRollV2Scenarios />
                </RentRollV2ProjectLayout>
              </Suspense>
            </UnifiedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/projects/:id/cohorts">
        {() => (
          <AuthGuard>
            <UnifiedLayout>
              <Suspense fallback={<PageLoader />}>
                <RentRollV2ProjectLayout>
                  <RentRollV2Cohorts />
                </RentRollV2ProjectLayout>
              </Suspense>
            </UnifiedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/projects/:id/data-quality">
        {() => (
          <AuthGuard>
            <UnifiedLayout>
              <Suspense fallback={<PageLoader />}>
                <RentRollV2ProjectLayout>
                  <RentRollV2DataQuality />
                </RentRollV2ProjectLayout>
              </Suspense>
            </UnifiedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/portfolio">
        {() => (
          <AuthGuard>
            <UnifiedLayout>
              <Suspense fallback={<PageLoader />}>
                <RentRollV2PortfolioLayout>
                  <RentRollV2Portfolio />
                </RentRollV2PortfolioLayout>
              </Suspense>
            </UnifiedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/portfolio/reports">
        {() => (
          <AuthGuard>
            <UnifiedLayout>
              <Suspense fallback={<PageLoader />}>
                <RentRollV2PortfolioLayout>
                  <RentRollV2Reports />
                </RentRollV2PortfolioLayout>
              </Suspense>
            </UnifiedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/portfolio/cohorts">
        {() => (
          <AuthGuard>
            <UnifiedLayout>
              <Suspense fallback={<PageLoader />}>
                <RentRollV2PortfolioLayout>
                  <RentRollV2Cohorts />
                </RentRollV2PortfolioLayout>
              </Suspense>
            </UnifiedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/portfolio/data-quality">
        {() => (
          <AuthGuard>
            <UnifiedLayout>
              <Suspense fallback={<PageLoader />}>
                <RentRollV2PortfolioLayout>
                  <RentRollV2PortfolioDataQuality />
                </RentRollV2PortfolioLayout>
              </Suspense>
            </UnifiedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/cohorts">
        {() => (
          <AuthGuard>
            <UnifiedLayout>
              <Suspense fallback={<PageLoader />}>
                <RentRollV2Cohorts />
              </Suspense>
            </UnifiedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/reports">
        {() => (
          <AuthGuard>
            <UnifiedLayout>
              <Suspense fallback={<PageLoader />}>
                <RentRollV2Reports />
              </Suspense>
            </UnifiedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/scenarios">
        {() => (
          <AuthGuard>
            <UnifiedLayout>
              <Suspense fallback={<PageLoader />}>
                <RentRollV2Scenarios />
              </Suspense>
            </UnifiedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/admin-types">
        {() => (
          <AuthGuard>
            <UnifiedLayout>
              <Suspense fallback={<PageLoader />}>
                <RentRollV2AdminTypes />
              </Suspense>
            </UnifiedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/gl-reconciliation">
        {() => (
          <AuthGuard>
            <UnifiedLayout>
              <Suspense fallback={<PageLoader />}>
                <RentRollV2GLReconciliation />
              </Suspense>
            </UnifiedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/integrations">
        {() => (
          <AuthGuard>
            <UnifiedLayout>
              <Suspense fallback={<PageLoader />}>
                <RentRollV2Integrations />
              </Suspense>
            </UnifiedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/reconciliation">
        {() => (
          <AuthGuard>
            <UnifiedLayout>
              <Suspense fallback={<PageLoader />}>
                <RentRollV2Reconciliation />
              </Suspense>
            </UnifiedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/report-packages">
        {() => (
          <AuthGuard>
            <UnifiedLayout>
              <Suspense fallback={<PageLoader />}>
                <RentRollV2ReportPackages />
              </Suspense>
            </UnifiedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/snapshots">
        {() => (
          <AuthGuard>
            <UnifiedLayout>
              <Suspense fallback={<PageLoader />}>
                <RentRollV2Snapshots />
              </Suspense>
            </UnifiedLayout>
          </AuthGuard>
        )}
      </Route>

      {/* Portfolio Routes */}
      <Route path="/portfolio">
        {() => (
          <UnifiedLayout>
            <Portfolio />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/portfolio/:id">
        {() => (
          <UnifiedLayout>
            <MarinaDetail />
          </UnifiedLayout>
        )}
      </Route>

      {/* Legacy redirect for old owned-marinas route */}
      <Route path="/operations/owned-marinas">
        {() => <Redirect to="/portfolio" />}
      </Route>

      {/* Operations Routes - Tabbed Module Pages */}
      <Route path="/operations/dockit">
        {() => (
          <UnifiedLayout>
            <DockitTabbed />
          </UnifiedLayout>
        )}
      </Route>
      {/* Redirect old rent-roll route to new V2 module */}
      <Route path="/operations/rent-roll">
        {() => <Redirect to="/rent-roll/executive" />}
      </Route>
      <Route path="/operations/fuel">
        {() => (
          <UnifiedLayout>
            <FuelSalesTabbed />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/ship-store">
        {() => (
          <UnifiedLayout>
            <ShipStoreTabbed />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/service">
        {() => (
          <UnifiedLayout>
            <ServiceTabbed />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/boat-rentals">
        {() => (
          <UnifiedLayout>
            <BoatRentalsTabbed />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/boat-club">
        {() => (
          <UnifiedLayout>
            <BoatClubTabbed />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/operations/boat-sales">
        {() => (
          <UnifiedLayout>
            <BoatSalesTabbed />
          </UnifiedLayout>
        )}
      </Route>
      {/* Marketing - Standalone Route */}
      <Route path="/marketing">
        {() => (
          <UnifiedLayout>
            <MarketingTabbed />
          </UnifiedLayout>
        )}
      </Route>
      
      {/* Legacy redirect from /operations/marketing to /marketing */}
      <Route path="/operations/marketing">
        {() => {
          window.location.replace('/marketing');
          return null;
        }}
      </Route>
      
      {/* Legacy Operations Routes - Redirect to new V2 and tab-based URLs */}
      <Route path="/operations/customer-analytics">
        {() => {
          window.location.replace('/rent-roll/cohorts');
          return null;
        }}
      </Route>
      <Route path="/operations/dockit/launches">
        {() => {
          window.location.replace('/operations/dockit?tab=launches');
          return null;
        }}
      </Route>
      <Route path="/operations/dockit/slips">
        {() => {
          window.location.replace('/operations/dockit?tab=slips');
          return null;
        }}
      </Route>
      <Route path="/operations/rent-roll/portfolio">
        {() => <Redirect to="/rent-roll/portfolio" />}
      </Route>
      <Route path="/operations/rent-roll/projects">
        {() => <Redirect to="/rent-roll/projects" />}
      </Route>
      <Route path="/operations/rent-roll/leases">
        {() => <Redirect to="/rent-roll/executive" />}
      </Route>
      <Route path="/operations/rent-roll/projects/:id">
        {() => <Redirect to="/rent-roll/projects" />}
      </Route>
      <Route path="/operations/fuel/dashboard">
        {() => {
          window.location.replace('/operations/fuel?tab=dashboard');
          return null;
        }}
      </Route>
      <Route path="/operations/fuel/transactions">
        {() => {
          window.location.replace('/operations/fuel?tab=transactions');
          return null;
        }}
      </Route>
      <Route path="/operations/fuel/inventory">
        {() => {
          window.location.replace('/operations/fuel?tab=inventory');
          return null;
        }}
      </Route>
      <Route path="/operations/fuel/analytics">
        {() => {
          window.location.replace('/operations/fuel?tab=analytics');
          return null;
        }}
      </Route>
      <Route path="/operations/fuel/reports">
        {() => {
          window.location.replace('/operations/fuel?tab=reports');
          return null;
        }}
      </Route>
      <Route path="/operations/fuel/financial-model">
        {() => {
          window.location.replace('/operations/fuel?tab=financial-model');
          return null;
        }}
      </Route>
      <Route path="/operations/fuel/integration-settings">
        {() => {
          window.location.replace('/operations/fuel?tab=settings');
          return null;
        }}
      </Route>
      <Route path="/operations/fuel/import-history">
        {() => {
          window.location.replace('/operations/fuel?tab=import-history');
          return null;
        }}
      </Route>
      <Route path="/operations/fuel/audit-trail">
        {() => {
          window.location.replace('/operations/fuel?tab=audit-trail');
          return null;
        }}
      </Route>
      <Route path="/operations/ship-store/dashboard">
        {() => {
          window.location.replace('/operations/ship-store?tab=dashboard');
          return null;
        }}
      </Route>
      <Route path="/operations/ship-store/pos">
        {() => {
          window.location.replace('/operations/ship-store?tab=pos');
          return null;
        }}
      </Route>
      <Route path="/operations/ship-store/inventory">
        {() => {
          window.location.replace('/operations/ship-store?tab=inventory');
          return null;
        }}
      </Route>
      <Route path="/operations/ship-store/transactions">
        {() => {
          window.location.replace('/operations/ship-store?tab=transactions');
          return null;
        }}
      </Route>
      <Route path="/operations/ship-store/checkout">
        {() => {
          window.location.replace('/operations/ship-store?tab=pos');
          return null;
        }}
      </Route>
      <Route path="/operations/ship-store/reports">
        {() => {
          window.location.replace('/operations/ship-store?tab=reports');
          return null;
        }}
      </Route>
      <Route path="/operations/ship-store/analytics">
        {() => {
          window.location.replace('/operations/ship-store?tab=analytics');
          return null;
        }}
      </Route>
      <Route path="/operations/service/dashboard">
        {() => {
          window.location.replace('/operations/service?tab=dashboard');
          return null;
        }}
      </Route>
      <Route path="/operations/boat-rentals/dashboard">
        {() => {
          window.location.replace('/operations/boat-rentals?tab=dashboard');
          return null;
        }}
      </Route>
      <Route path="/operations/boat-club/dashboard">
        {() => {
          window.location.replace('/operations/boat-club?tab=dashboard');
          return null;
        }}
      </Route>
      <Route path="/operations/boat-sales/dashboard">
        {() => {
          window.location.replace('/operations/boat-sales?tab=dashboard');
          return null;
        }}
      </Route>
      <Route path="/operations/marketing/dashboard">
        {() => {
          window.location.replace('/marketing?tab=dashboard');
          return null;
        }}
      </Route>
      <Route path="/operations/marketing/campaigns">
        {() => {
          window.location.replace('/marketing?tab=campaigns');
          return null;
        }}
      </Route>
      <Route path="/operations/marketing/expenses">
        {() => {
          window.location.replace('/marketing?tab=expenses');
          return null;
        }}
      </Route>
      <Route path="/operations/marketing/attribution">
        {() => {
          window.location.replace('/marketing?tab=attribution');
          return null;
        }}
      </Route>
      <Route path="/operations/marketing/email-campaigns">
        {() => {
          window.location.replace('/marketing?tab=email-campaigns');
          return null;
        }}
      </Route>
      <Route path="/operations/marketing/settings">
        {() => {
          window.location.replace('/marketing?tab=settings');
          return null;
        }}
      </Route>

      {/* CRM Routes with Unified Layout */}
      <Route path="/crm">
        {() => (
          <UnifiedLayout>
            <CRMDashboard />
          </UnifiedLayout>
        )}
      </Route>
      
      {/* Unified Deal Workspace - consolidates Pipeline, Deals, and Leads */}
      {/* Unified Deal Workspaces - Hub for Modeling, DD, and VDR */}
      <Route path="/workspaces">
        {() => (
          <UnifiedLayout>
            <WorkspacesList />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/workspaces/:workspaceId">
        {() => (
          <UnifiedLayout>
            <WorkspaceDetail />
          </UnifiedLayout>
        )}
      </Route>

      <Route path="/deal-workspace">
        {() => (
          <UnifiedLayout>
            <DealWorkspace />
          </UnifiedLayout>
        )}
      </Route>
      
      {/* Legacy route redirects to Deal Workspace */}
      <Route path="/crm/pipeline">
        {() => {
          window.location.replace('/deal-workspace?view=pipeline');
          return null;
        }}
      </Route>
      <Route path="/crm/leads">
        {() => {
          window.location.replace('/deal-workspace?view=leads');
          return null;
        }}
      </Route>
      <Route path="/crm/contacts">
        {() => (
          <UnifiedLayout>
            <Contacts />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/companies">
        {() => (
          <UnifiedLayout>
            <Companies />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/properties">
        {() => (
          <UnifiedLayout>
            <Properties />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/pending-properties">
        {() => (
          <UnifiedLayout>
            <PendingProperties />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/pending-contacts">
        {() => (
          <UnifiedLayout>
            <PendingContacts />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/pending-companies">
        {() => (
          <UnifiedLayout>
            <PendingCompanies />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/deals">
        {() => {
          window.location.replace('/deal-workspace?view=list');
          return null;
        }}
      </Route>
      <Route path="/crm/deals/:dealId">
        {() => (
          <UnifiedLayout>
            <DealDetail />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/tasks">
        {() => (
          <UnifiedLayout>
            <CrmTasks />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/prospecting">
        {() => (
          <UnifiedLayout>
            <Prospecting />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/marketing-automation">
        {() => {
          window.location.replace('/marketing?tab=automation');
          return null;
        }}
      </Route>
      <Route path="/calendar-settings">
        {() => (
          <UnifiedLayout>
            <CalendarSettings />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/analytics">
        {() => (
          <UnifiedLayout>
            <Analytics />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/forecast">
        {() => (
          <UnifiedLayout>
            <Forecast />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/forms">
        {() => (
          <UnifiedLayout>
            <Forms />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/labels">
        {() => (
          <UnifiedLayout>
            <Labels />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/products">
        {() => (
          <UnifiedLayout>
            <Products />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/workflows">
        {() => (
          <UnifiedLayout>
            <Workflows />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/webhooks">
        {() => (
          <UnifiedLayout>
            <Webhooks />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/archive">
        {() => (
          <UnifiedLayout>
            <ArchivePage />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/dedupe">
        {() => (
          <UnifiedLayout>
            <Dedupe />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/scoring">
        {() => (
          <UnifiedLayout>
            <Scoring />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/import-contacts">
        {() => (
          <UnifiedLayout>
            <ImportContacts />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/import-history">
        {() => (
          <UnifiedLayout>
            <ImportHistory />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/crm/activity">
        {() => (
          <UnifiedLayout>
            <ActivityLog />
          </UnifiedLayout>
        )}
      </Route>

      {/* Prospecting & Outreach Routes (Premium/Broker Add-On) */}
      {/* Redirect old routes to new structure */}
      <Route path="/prospecting/dashboard">
        {() => {
          window.location.replace('/prospecting');
          return null;
        }}
      </Route>
      <Route path="/prospecting/board">
        {() => {
          window.location.replace('/prospecting/workroom');
          return null;
        }}
      </Route>
      <Route path="/prospecting/analytics">
        {() => {
          window.location.replace('/prospecting');
          return null;
        }}
      </Route>
      {/* New structure: Overview (merged Dashboard + Analytics) and Workroom (weekly cards) */}
      <Route path="/prospecting">
        {() => (
          <UnifiedLayout>
            <ProspectingOverview />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/prospecting/workroom">
        {() => (
          <UnifiedLayout>
            <ProspectingWorkroom />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/prospecting/markets">
        {() => (
          <UnifiedLayout>
            <MarketTargets />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/prospecting/campaigns">
        {() => (
          <UnifiedLayout>
            <ProspectingCampaigns />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/marinamatch">
        {() => (
          <UnifiedLayout>
            <MarinaMatchIndex />
          </UnifiedLayout>
        )}
      </Route>

      {/* DockTalk Full Application - Uses Unified Layout */}
      <Route path="/docktalk">
        {() => (
          <UnifiedLayout>
            <Suspense fallback={<PageLoader />}>
              <DockTalkRouter />
            </Suspense>
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/docktalk/:rest*">
        {() => (
          <UnifiedLayout>
            <Suspense fallback={<PageLoader />}>
              <DockTalkRouter />
            </Suspense>
          </UnifiedLayout>
        )}
      </Route>

      {/* Analysis / Sales Comps Routes */}
      <Route path="/analysis/sales-comps/map">
        {() => (
          <UnifiedLayout>
            <SalesCompsMapView />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/sales-comps">
        {() => (
          <UnifiedLayout>
            <SalesCompsIndex />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/sales-comps/analytics">
        {() => (
          <UnifiedLayout>
            <SalesCompsAnalytics />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/sales-comps/projects">
        {() => (
          <UnifiedLayout>
            <SalesCompsProjects />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/sales-comps/upload">
        {() => (
          <UnifiedLayout>
            <SalesCompsUpload />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/sales-comps/columns">
        {() => (
          <UnifiedLayout>
            <SalesCompsColumnManager />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/sales-comps/bulk-edit">
        {() => (
          <UnifiedLayout>
            <SalesCompsBulkEdit />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/sales-comps/compare">
        {() => (
          <UnifiedLayout>
            <SalesCompsCompare />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/sales-comps/pending-profiles">
        {() => (
          <UnifiedLayout>
            <SalesCompsPendingProfiles />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/sales-comps/:id">
        {(params) => (
          <UnifiedLayout>
            <SalesCompsDetail {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/projects">
        {() => (
          <UnifiedLayout>
            <ScProjectsIndex />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/projects/:id">
        {(params) => (
          <UnifiedLayout>
            <ScProjectsReport {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/rate-comps/map">
        {() => (
          <UnifiedLayout>
            <RateCompsMapView />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/rate-comps">
        {() => (
          <UnifiedLayout>
            <RateCompsIndex />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/rate-comps/analytics">
        {() => (
          <UnifiedLayout>
            <RateCompsAnalytics />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/rate-comps/upload">
        {() => (
          <UnifiedLayout>
            <RateCompsUpload />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/rate-comps/columns">
        {() => (
          <UnifiedLayout>
            <RateCompsColumnManager />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/rate-comps/bulk-edit">
        {() => (
          <UnifiedLayout>
            <RateCompsBulkEdit />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/rate-comps/compare">
        {() => (
          <UnifiedLayout>
            <RateCompsCompare />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/rate-comps/:id">
        {(params) => (
          <UnifiedLayout>
            <RateCompsDetail {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/marina-database">
        {() => (
          <UnifiedLayout>
            <MarinaDatabase />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/demographics">
        {() => (
          <UnifiedLayout>
            <DemographicsIndex />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/benchmarks">
        {() => (
          <UnifiedLayout>
            <BenchmarksIndex />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/capital-markets">
        {() => (
          <UnifiedLayout>
            <CapitalMarketsIndex />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/marinalytics">
        {() => (
          <UnifiedLayout>
            <MarinalyticsPage />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects">
        {() => (
          <UnifiedLayout>
            <ModelingProjectsIndex />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/settings">
        {() => (
          <UnifiedLayout>
            <ModelingSettings />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/portfolio">
        {() => (
          <UnifiedLayout>
            <ModelingPortfolio />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/funds">
        {() => (
          <UnifiedLayout>
            <ModelingFunds />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/funds/:fundId">
        {() => (
          <UnifiedLayout>
            <FundDetail />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/lp-portal">
        {() => (
          <UnifiedLayout>
            <LPPortal />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/transaction-closing">
        {(params) => (
          <UnifiedLayout>
            <TransactionClosingPage {...params} />
          </UnifiedLayout>
        )}
      </Route>
      
      {/* Project Workspace Route */}
      <Route path="/modeling/projects/:projectId">
        {(params) => (
          <UnifiedLayout>
            <ProjectWorkspace {...params} />
          </UnifiedLayout>
        )}
      </Route>
      
      {/* Document Intelligence Route */}
      <Route path="/modeling/projects/:projectId/doc-intel">
        {(params) => (
          <UnifiedLayout>
            <DocumentIntelligence {...params} />
          </UnifiedLayout>
        )}
      </Route>
      
      {/* Exit Strategy Suite Routes */}
      <Route path="/modeling/projects/:projectId/exit">
        {(params) => (
          <UnifiedLayout>
            <ExitStrategyDashboard {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/scenarios">
        {(params) => (
          <UnifiedLayout>
            <ExitScenarios {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/scenarios/:scenarioId">
        {(params) => (
          <UnifiedLayout>
            <ExitScenarioDetail {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/tax">
        {(params) => (
          <UnifiedLayout>
            <ExitTaxCalculator {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/net-proceeds">
        {(params) => (
          <UnifiedLayout>
            <ExitNetProceeds {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/1031">
        {(params) => (
          <UnifiedLayout>
            <Exit1031Exchange {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/dst">
        {(params) => (
          <UnifiedLayout>
            <ExitDSTAnalysis {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/seller-financing">
        {(params) => (
          <UnifiedLayout>
            <ExitSellerFinancing {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/earnout">
        {(params) => (
          <UnifiedLayout>
            <ExitEarnout {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/waterfall">
        {(params) => (
          <UnifiedLayout>
            <ExitWaterfall {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/irr">
        {(params) => (
          <UnifiedLayout>
            <ExitIRRCalculator {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/sensitivity">
        {(params) => (
          <UnifiedLayout>
            <ExitSensitivity {...params} />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/ai-insights">
        {(params) => (
          <UnifiedLayout>
            <ExitAIInsights {...params} />
          </UnifiedLayout>
        )}
      </Route>
      
      <Route path="/modeling/debt-scenarios">
        {() => (
          <UnifiedLayout>
            <DebtScenariosIndex />
          </UnifiedLayout>
        )}
      </Route>
      
      <Route path="/modeling/pnl/upload">
        {() => (
          <UnifiedLayout>
            <PnlUpload />
          </UnifiedLayout>
        )}
      </Route>
      
      <Route path="/modeling/pnl/review">
        {() => (
          <UnifiedLayout>
            <PnlReview />
          </UnifiedLayout>
        )}
      </Route>
      
      <Route path="/modeling/pnl/keyword-bank">
        {() => (
          <UnifiedLayout>
            <PnlKeywordBank />
          </UnifiedLayout>
        )}
      </Route>
      
      <Route path="/modeling/pnl-parser">
        {() => (
          <UnifiedLayout>
            <PnlUploadReview />
          </UnifiedLayout>
        )}
      </Route>
      
      <Route path="/modeling/exit-strategies">
        {() => (
          <UnifiedLayout>
            <ExitStrategiesIndex />
          </UnifiedLayout>
        )}
      </Route>
      
      {/* OM Builder Routes */}
      <Route path="/om">
        {() => (
          <UnifiedLayout>
            <ProjectOms />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/om/projects/:projectId">
        {() => (
          <UnifiedLayout>
            <ProjectOms />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/om/builder/:omId">
        {() => (
          <UnifiedLayout>
            <OMBuilder />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/om/export/:omId">
        {() => (
          <UnifiedLayout>
            <OMExport />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/om/templates">
        {() => (
          <UnifiedLayout>
            <OMTemplates />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/om/brand-kits">
        {() => (
          <UnifiedLayout>
            <OMBrandKits />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/om/canvas/:id">
        {() => (
          <OMCanvasEditor />
        )}
      </Route>
      
      {/* Demo Routes */}
      <Route path="/demo/sortable" component={SortableListDemo} />
      <Route path="/demo/milestone" component={MilestoneDemo} />
      
      {/* Public Broker Portal (no auth required) */}
      <Route path="/broker-portal/:token">
        {() => (
          <Suspense fallback={<PageLoader />}>
            <BrokerPortal />
          </Suspense>
        )}
      </Route>
      
      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Suspense fallback={<PageLoader />}>
              <Router />
            </Suspense>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
