import { lazy, Suspense, useState, useEffect } from "react";
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
import { PackGate, type PackType } from "@/contexts/PackContext";
import { AIAssistant } from "@/components/ai-assistant";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { ThemeProvider } from '@/contexts/ThemeProvider';
import { ProspectingActivityProvider } from "@/contexts/ProspectingActivityContext";
import { GoogleMapsProvider } from "@/lib/google-maps-provider";


// Lazy load all pages for optimal bundle splitting
const Dashboard = lazy(() => import("@/pages/dashboard"));
const CRMDashboard = lazy(() => import("@/pages/crm-dashboard"));
const AllProjectsSummaryPage = lazy(() => import("@/pages/all-projects-summary"));

// Lazy load layout components
const UnifiedSidebar = lazy(() => import("@/components/unified-sidebar"));
const PendingNotificationsBanner = lazy(() => import("@/components/pending-notifications-banner"));
const DocketRouter = lazy(() => import("@/docket/DocketRouter"));
const PreferredNetworkPage = lazy(() => import("./pages/PreferredNetworkPage"));

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
const CompanyRecordPage = lazy(() => import("@/pages/company-record"));
const ContactRecordPage = lazy(() => import("@/pages/contact-record"));
const PropertyRecordPage = lazy(() => import("@/pages/property-record"));
const Deals = lazy(() => import("@/pages/deals"));
const DealWorkspace = lazy(() => import("@/pages/deal-workspace"));
const DealDetail = lazy(() => import("@/pages/deal-detail"));
const DealComparison = lazy(() => import("@/pages/deal-comparison"));
const Properties = lazy(() => import("@/pages/properties"));
const PendingProperties = lazy(() => import("@/pages/pending-properties"));
const PendingContacts = lazy(() => import("@/pages/pending-contacts"));
const PendingCompanies = lazy(() => import("@/pages/pending-companies"));
const Prospecting = lazy(() => import("@/pages/prospecting"));
const Analytics = lazy(() => import("@/pages/analytics"));
const UnifiedAnalytics = lazy(() => import("@/pages/analytics/UnifiedAnalytics"));
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
const MagicLinkPage = lazy(() => import("@/pages/auth/magic-link"));
const MagicLinkVerifyPage = lazy(() => import("@/pages/auth/magic-link-verify"));
const VerifyEmailPage = lazy(() => import("@/pages/auth/verify-email"));
const DesignPreview = lazy(() => import("@/pages/design-preview"));
const LegalPage = lazy(() => import("@/pages/LegalPage"));
const MMUIDemo = lazy(() => import("@/pages/mm-ui-demo"));
const PacksSettings = lazy(() => import("@/pages/packs-settings"));
const IntegrationsMarketplace = lazy(() => import("@/pages/integrations/IntegrationsMarketplace"));
const IntegrationDetail = lazy(() => import("@/pages/integrations/IntegrationDetail"));
const MigrationDashboard = lazy(() => import("@/pages/integrations/MigrationDashboard"));
const SyncMonitor = lazy(() => import("@/pages/integrations/SyncMonitor"));
const VDRActivity = lazy(() => import("@/pages/vdr/ActivityDashboard"));
const AccountMappingPage = lazy(() => import("@/pages/admin/AccountMappingPage"));
const CuratedDataDashboard = lazy(() => import("@/pages/admin/CuratedDataDashboard"));
const AdminCustomersPage = lazy(() => import("@/pages/admin/AdminCustomersPage"));
const AdminOrganizationsPage = lazy(() => import("@/pages/admin/AdminOrganizationsPage"));
const AdminAuditTrailPage = lazy(() => import("@/pages/admin/AdminAuditTrailPage"));
const DataSourcesAdmin = lazy(() => import("@/pages/admin/DataSourcesAdmin"));
const AssetClassManager = lazy(() => import("@/pages/admin/AssetClassManager"));
const OpsInboxPage = lazy(() => import("@/pages/ops/InboxPage"));
const OpsAutomationsPage = lazy(() => import("@/pages/ops/AutomationsPage"));
const OpsTasksPage = lazy(() => import("@/pages/ops/TasksPage"));
const OpsStatementsPage = lazy(() => import("@/pages/ops/StatementsPage"));
const OpsIntegrationsPage = lazy(() => import("@/pages/ops/IntegrationsPage"));
const FeatureGate = lazy(() => import("@/components/FeatureGate").then(m => ({ default: m.FeatureGate })));
const CrmTasks = lazy(() => import("@/pages/crm-tasks"));
const MarketingAutomation = lazy(() => import("@/pages/marketing-automation"));
const CrmActivitiesPage = lazy(() => import("@/pages/crm-activities"));
const CalendarSettings = lazy(() => import("@/pages/calendar-settings"));
const CustomerAnalytics = lazy(() => import("@/pages/operations/CustomerAnalytics"));
const OwnedMarinas = lazy(() => import("@/pages/operations/OwnedMarinas"));
const CommercialTenants = lazy(() => import("@/pages/operations/commercial-tenants"));
const Portfolio = lazy(() => import("@/pages/Portfolio"));
const MarinalyticsPage = lazy(() => import("@/pages/marinalytics"));
const MarinaMapPage = lazy(() => import("@/pages/marina-map"));
const FinancialAnalysis = lazy(() => import("@/pages/analysis/financial-analysis"));
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
const RentRollV2InteractiveAnalytics = lazy(() => import("@/modules/rent-roll-v2/pages/interactive-analytics"));

// Operations - Tabbed Module Pages
const FuelSalesTabbed = lazy(() => import("@/pages/operations/FuelSalesTabbed"));
const ShipStoreTabbed = lazy(() => import("@/pages/operations/ShipStoreTabbed"));
const OperationsIntegrations = lazy(() => import("@/pages/operations/integrations"));
const DockitTabbed = lazy(() => import("@/pages/operations/DockitTabbed"));
const WorkspacesList = lazy(() => import("@/pages/workspaces/index"));
const WorkspaceDetail = lazy(() => import("@/pages/workspaces/[workspaceId]"));
const MarketingTabbed = lazy(() => import("@/pages/operations/MarketingTabbed"));
const ServiceTabbed = lazy(() => import("@/pages/operations/ServiceTabbed"));
const BoatRentalsTabbed = lazy(() => import("@/pages/operations/BoatRentalsTabbed"));
const BoatClubTabbed = lazy(() => import("@/pages/operations/BoatClubTabbed"));
const BoatSalesTabbed = lazy(() => import("@/pages/operations/BoatSalesTabbed"));
const BudgetingTabbed = lazy(() => import("@/pages/operations/BudgetingTabbed"));
const BookkeepingTabbed = lazy(() => import("@/pages/operations/BookkeepingTabbed"));
const PayrollTabbed = lazy(() => import("@/pages/operations/PayrollTabbed"));
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
const SalesCompsPendingComps = lazy(() => import("@/pages/analysis/sales-comps/PendingComps"));
const ScProjectsIndex = lazy(() => import("@/pages/analysis/projects/Index"));
const ScProjectsReport = lazy(() => import("@/pages/analysis/projects/Report"));
const RateCompsIndex = lazy(() => import("@/pages/analysis/rate-comps/Index"));
const IndustryStandards = lazy(() => import("@/pages/analysis/IndustryStandards"));
const RateCompsAnalytics = lazy(() => import("@/pages/analysis/rate-comps/Analytics"));
const RateCompsDetail = lazy(() => import("@/pages/analysis/rate-comps/Detail"));
const RateCompsUpload = lazy(() => import("@/pages/analysis/rate-comps/Upload"));
const RateCompsMapView = lazy(() => import("@/pages/analysis/rate-comps/MapView"));
const RateCompsCompare = lazy(() => import("@/pages/analysis/rate-comps/Compare"));
const RateCompsBulkEdit = lazy(() => import("@/pages/analysis/rate-comps/BulkEdit"));
const RateCompsColumnManager = lazy(() => import("@/pages/analysis/rate-comps/ColumnManager"));
const MarinaDatabase = lazy(() => import("@/pages/marina-database"));
const MarinaCompsIndex = lazy(() => import("@/pages/analysis/marina-comps/Index"));
const ValuationTimelineIndex = lazy(() => import("@/pages/analysis/valuation-timeline/Index"));
const DemographicsIndex = lazy(() => import("@/pages/analysis/demographics/Index"));
const BenchmarksIndex = lazy(() => import("@/pages/analysis/benchmarks/Index"));
const CapitalMarketsIndex = lazy(() => import("@/pages/analysis/capital-markets"));
const AnalysisHub = lazy(() => import("@/pages/analysis/AnalysisHub"));
const DebtScenariosIndex = lazy(() => import("@/pages/modeling/debt-scenarios/Index"));
const ExitStrategiesIndex = lazy(() => import("@/pages/modeling/exit-strategies"));
const ScenariosIndex = lazy(() => import("@/pages/modeling/scenarios"));
const ReturnsValuation = lazy(() => import("@/pages/modeling/returns-valuation"));
const SetupWizard = lazy(() => import("@/pages/modeling/projects/setup-wizard"));
const ModelingProjectsIndex = lazy(() => import("@/pages/modeling/projects"));
const ModelingPortfolio = lazy(() => import("@/pages/modeling/portfolio"));
const PortfolioReturns = lazy(() => import("@/pages/modeling/portfolio/portfolio-returns"));
const ModelingFunds = lazy(() => import("@/pages/modeling/funds"));
const FundDetail = lazy(() => import("@/pages/modeling/funds/[fundId]"));
const LPPortal = lazy(() => import("@/pages/modeling/lp-portal"));
const ModelingSettings = lazy(() => import("@/pages/modeling/settings"));
const ChartOfAccounts = lazy(() => import("@/pages/modeling/settings/chart-of-accounts"));
const CategoryMapping = lazy(() => import("@/pages/modeling/settings/category-mapping"));
const NormalizationStatus = lazy(() => import("@/pages/modeling/settings/normalization-status"));
const InvestmentCriteria = lazy(() => import("@/pages/modeling/investment-criteria"));
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
const DealAnalyticsPage = lazy(() => import("@/pages/crm/DealAnalyticsPage"));
const PipelineInsights = lazy(() => import("@/pages/crm/PipelineInsights"));
const PipelineVelocity = lazy(() => import("@/pages/crm/PipelineVelocity"));
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
const ExitReconciliation = lazy(() => import("@/pages/dev/exit-reconciliation"));
const ExitIRRCalculator = lazy(() => import("@/pages/modeling/exit/IRRCalculator"));
const ExitSensitivity = lazy(() => import("@/pages/modeling/exit/Sensitivity"));
const ExitAIInsights = lazy(() => import("@/pages/modeling/exit/AIInsights"));
const ExitScenarioComparison = lazy(() => import("@/pages/modeling/exit/ScenarioComparison"));

// Document Intelligence
const DocumentIntelligence = lazy(() => import("@/pages/modeling/doc-intel/DocumentIntelligence"));
const CoaMappingReview = lazy(() => import("@/pages/modeling/doc-intel/CoaMappingReview"));
const DepartmentalPL = lazy(() => import("@/pages/modeling/doc-intel/DepartmentalPL"));

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
const DealOMBuilder = lazy(() => import("@/pages/om-builder/OMBuilder"));
const OMExport = lazy(() => import("@/modules/om-builder/pages/om-export"));
const OMTemplates = lazy(() => import("@/modules/om-builder/pages/om-templates"));
const OMBrandKits = lazy(() => import("@/modules/om-builder/pages/om-brand-kits"));
const OMCanvasEditor = lazy(() => import("@/pages/om-builder-editor"));
const DocumentBuilderPage = lazy(() => import("@/pages/document-builder/DocumentBuilderPage"));

// Onboarding Wizard (lazy loaded)
const OnboardingWizard = lazy(() => import("@/components/onboarding/OnboardingWizard").then(m => ({ default: m.OnboardingWizard })));

// Lightweight sidebar loader for initial render
function SidebarLoader() {
  return (
    <div className="w-64 h-screen bg-gray-100 dark:bg-gray-900 animate-pulse" />
  );
}

// Hook to check if user should see onboarding
function useOnboardingCheck() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('marinamatch_onboarding_complete');
    if (!hasSeenOnboarding) {
      const timer = setTimeout(() => setShowOnboarding(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem('marinamatch_onboarding_complete', 'true');
    setShowOnboarding(false);
  };

  return { showOnboarding, setShowOnboarding, completeOnboarding };
}

// Unified Layout wrapper with sidebar for both DD Tracker and CRM
// Includes auth guard to redirect unauthenticated users to login
function UnifiedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { showOnboarding, setShowOnboarding, completeOnboarding } = useOnboardingCheck();
  
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
    <div className="flex h-screen bg-background">
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
      <AIAssistant />
      <Suspense fallback={null}>
        <OnboardingWizard 
          open={showOnboarding} 
          onOpenChange={(open) => {
            if (!open) completeOnboarding();
            setShowOnboarding(open);
          }}
          userName={user?.name?.split(' ')[0] || user?.email?.split('@')[0]}
        />
      </Suspense>
    </div>
  );
}

// Layout wrapper that enforces pack access — shows upgrade prompt if pack is not active
function GatedLayout({ pack, children }: { pack: PackType | PackType[]; children: React.ReactNode }) {
  return (
    <UnifiedLayout>
      <PackGate pack={pack}>
        {children}
      </PackGate>
    </UnifiedLayout>
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
      <Route path="/magic-link">
        {() => (
          <Suspense fallback={<PageLoader />}>
            <MagicLinkPage />
          </Suspense>
        )}
      </Route>
      <Route path="/auth/magic-link/:token">
        {() => (
          <Suspense fallback={<PageLoader />}>
            <MagicLinkVerifyPage />
          </Suspense>
        )}
      </Route>
      <Route path="/auth/verify-email/:token">
        {() => (
          <Suspense fallback={<PageLoader />}>
            <VerifyEmailPage />
          </Suspense>
        )}
      </Route>
      {/* Legal pages - public, no auth required */}
      <Route path="/terms">
        {() => (
          <Suspense fallback={<PageLoader />}>
            <LegalPage docType="terms" />
          </Suspense>
        )}
      </Route>
      <Route path="/privacy">
        {() => (
          <Suspense fallback={<PageLoader />}>
            <LegalPage docType="privacy" />
          </Suspense>
        )}
      </Route>
      <Route path="/benchmarking">
        {() => (
          <Suspense fallback={<PageLoader />}>
            <LegalPage docType="benchmarking" />
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
      {/* MM-UI Design System Demo */}
      <Route path="/mm-ui-demo">
        {() => (
          <Suspense fallback={<PageLoader />}>
            <MMUIDemo />
          </Suspense>
        )}
      </Route>
      {/* Protected routes - authentication handled by UnifiedLayout */}
      {/* Legacy redirects - Projects now lives under DD Projects */}
      <Route path="/projects">
        {() => <Redirect to="/dd/projects" />}
      </Route>
      <Route path="/projects/summary">
        {() => <Redirect to="/dd/projects" />}
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
      <Route path="/settings/integrations">
        {() => (
          <UnifiedLayout>
            <IntegrationsMarketplace />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/settings/integrations/migration">
        {() => (
          <UnifiedLayout>
            <MigrationDashboard />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/settings/integrations/:key">
        {() => (
          <UnifiedLayout>
            <IntegrationDetail />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/admin/customers">
        {() => (
          <UnifiedLayout>
            <AdminCustomersPage />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/admin/organizations">
        {() => (
          <UnifiedLayout>
            <AdminOrganizationsPage />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/admin/audit-trail">
        {() => (
          <UnifiedLayout>
            <AdminAuditTrailPage />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/admin/curated-data">
        {() => (
          <UnifiedLayout>
            <CuratedDataDashboard />
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
      <Route path="/admin/data-sources">
        <Suspense fallback={<PageLoader />}>
          <DataSourcesAdmin />
        </Suspense>
      </Route>
      <Route path="/admin/asset-classes">
        <Suspense fallback={<PageLoader />}>
          <AssetClassManager />
        </Suspense>
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
      <Route path="/network">
        {() => (
          <UnifiedLayout>
            <Suspense fallback={<PageLoader />}>
              <PreferredNetworkPage />
            </Suspense>
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
      <Route path="/vdr/activity">
        {() => (
          <UnifiedLayout>
            <VDRActivity />
          </UnifiedLayout>
        )}
      </Route>
      
      {/* Sync Monitor Route */}
      <Route path="/settings/integrations/sync">
        {() => (
          <UnifiedLayout>
            <SyncMonitor />
          </UnifiedLayout>
        )}
      </Route>
      
      {/* Rent Roll V2 Routes - Marina-centric module */}
      <Route path="/rent-roll">
        {() => (
          <AuthGuard>
            <GatedLayout pack="operations">
              <Suspense fallback={<PageLoader />}>
                <RentRollV2Executive />
              </Suspense>
            </GatedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/executive">
        {() => (
          <AuthGuard>
            <GatedLayout pack="operations">
              <Suspense fallback={<PageLoader />}>
                <RentRollV2Executive />
              </Suspense>
            </GatedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/projects">
        {() => (
          <AuthGuard>
            <GatedLayout pack="operations">
              <Suspense fallback={<PageLoader />}>
                <RentRollV2Projects />
              </Suspense>
            </GatedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/projects/:id">
        {() => (
          <AuthGuard>
            <GatedLayout pack="operations">
              <Suspense fallback={<PageLoader />}>
                <RentRollV2ProjectLayout>
                  <RentRollV2Dashboard />
                </RentRollV2ProjectLayout>
              </Suspense>
            </GatedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/projects/:id/reports">
        {() => (
          <AuthGuard>
            <GatedLayout pack="operations">
              <Suspense fallback={<PageLoader />}>
                <RentRollV2ProjectLayout>
                  <RentRollV2Reports />
                </RentRollV2ProjectLayout>
              </Suspense>
            </GatedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/projects/:id/scenarios">
        {() => (
          <AuthGuard>
            <GatedLayout pack="operations">
              <Suspense fallback={<PageLoader />}>
                <RentRollV2ProjectLayout>
                  <RentRollV2Scenarios />
                </RentRollV2ProjectLayout>
              </Suspense>
            </GatedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/projects/:id/cohorts">
        {() => (
          <AuthGuard>
            <GatedLayout pack="operations">
              <Suspense fallback={<PageLoader />}>
                <RentRollV2ProjectLayout>
                  <RentRollV2Cohorts />
                </RentRollV2ProjectLayout>
              </Suspense>
            </GatedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/projects/:id/data-quality">
        {() => (
          <AuthGuard>
            <GatedLayout pack="operations">
              <Suspense fallback={<PageLoader />}>
                <RentRollV2ProjectLayout>
                  <RentRollV2DataQuality />
                </RentRollV2ProjectLayout>
              </Suspense>
            </GatedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/portfolio">
        {() => (
          <AuthGuard>
            <GatedLayout pack="operations">
              <Suspense fallback={<PageLoader />}>
                <RentRollV2PortfolioLayout>
                  <RentRollV2Portfolio />
                </RentRollV2PortfolioLayout>
              </Suspense>
            </GatedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/portfolio/reports">
        {() => (
          <AuthGuard>
            <GatedLayout pack="operations">
              <Suspense fallback={<PageLoader />}>
                <RentRollV2PortfolioLayout>
                  <RentRollV2Reports />
                </RentRollV2PortfolioLayout>
              </Suspense>
            </GatedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/portfolio/cohorts">
        {() => (
          <AuthGuard>
            <GatedLayout pack="operations">
              <Suspense fallback={<PageLoader />}>
                <RentRollV2PortfolioLayout>
                  <RentRollV2Cohorts />
                </RentRollV2PortfolioLayout>
              </Suspense>
            </GatedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/portfolio/data-quality">
        {() => (
          <AuthGuard>
            <GatedLayout pack="operations">
              <Suspense fallback={<PageLoader />}>
                <RentRollV2PortfolioLayout>
                  <RentRollV2PortfolioDataQuality />
                </RentRollV2PortfolioLayout>
              </Suspense>
            </GatedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/cohorts">
        {() => (
          <AuthGuard>
            <GatedLayout pack="operations">
              <Suspense fallback={<PageLoader />}>
                <RentRollV2Cohorts />
              </Suspense>
            </GatedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/reports">
        {() => (
          <AuthGuard>
            <GatedLayout pack="operations">
              <Suspense fallback={<PageLoader />}>
                <RentRollV2Reports />
              </Suspense>
            </GatedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/scenarios">
        {() => (
          <AuthGuard>
            <GatedLayout pack="operations">
              <Suspense fallback={<PageLoader />}>
                <RentRollV2Scenarios />
              </Suspense>
            </GatedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/admin-types">
        {() => (
          <AuthGuard>
            <GatedLayout pack="operations">
              <Suspense fallback={<PageLoader />}>
                <RentRollV2AdminTypes />
              </Suspense>
            </GatedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/gl-reconciliation">
        {() => (
          <AuthGuard>
            <GatedLayout pack="operations">
              <Suspense fallback={<PageLoader />}>
                <RentRollV2GLReconciliation />
              </Suspense>
            </GatedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/integrations">
        {() => (
          <AuthGuard>
            <GatedLayout pack="operations">
              <Suspense fallback={<PageLoader />}>
                <RentRollV2Integrations />
              </Suspense>
            </GatedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/reconciliation">
        {() => (
          <AuthGuard>
            <GatedLayout pack="operations">
              <Suspense fallback={<PageLoader />}>
                <RentRollV2Reconciliation />
              </Suspense>
            </GatedLayout>
          </AuthGuard>
        )}
      </Route>
      {/* OpsOS Routes */}
      <Route path="/ops/inbox">
        {() => (
          <AuthGuard>
            <UnifiedLayout>
              <Suspense fallback={<PageLoader />}>
                <OpsInboxPage />
              </Suspense>
            </UnifiedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/ops/automations">
        {() => (
          <AuthGuard>
            <UnifiedLayout>
              <Suspense fallback={<PageLoader />}>
                <OpsAutomationsPage />
              </Suspense>
            </UnifiedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/ops/tasks">
        {() => (
          <AuthGuard>
            <UnifiedLayout>
              <Suspense fallback={<PageLoader />}>
                <OpsTasksPage />
              </Suspense>
            </UnifiedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/ops/statements">
        {() => (
          <AuthGuard>
            <UnifiedLayout>
              <Suspense fallback={<PageLoader />}>
                <OpsStatementsPage />
              </Suspense>
            </UnifiedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/ops/integrations">
        {() => (
          <AuthGuard>
            <UnifiedLayout>
              <Suspense fallback={<PageLoader />}>
                <OpsIntegrationsPage />
              </Suspense>
            </UnifiedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/report-packages">
        {() => (
          <AuthGuard>
            <GatedLayout pack="operations">
              <Suspense fallback={<PageLoader />}>
                <RentRollV2ReportPackages />
              </Suspense>
            </GatedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/snapshots">
        {() => (
          <AuthGuard>
            <GatedLayout pack="operations">
              <Suspense fallback={<PageLoader />}>
                <RentRollV2Snapshots />
              </Suspense>
            </GatedLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/rent-roll/interactive-analytics">
        {() => (
          <AuthGuard>
            <GatedLayout pack="operations">
              <Suspense fallback={<PageLoader />}>
                <RentRollV2InteractiveAnalytics />
              </Suspense>
            </GatedLayout>
          </AuthGuard>
        )}
      </Route>

      {/* Portfolio Routes */}
      <Route path="/portfolio">
        {() => (
          <GatedLayout pack="operations">
            <Portfolio />
          </GatedLayout>
        )}
      </Route>
      <Route path="/portfolio/:id">
        {() => (
          <GatedLayout pack="operations">
            <MarinaDetail />
          </GatedLayout>
        )}
      </Route>

      {/* Legacy redirect for old owned-marinas route */}
      <Route path="/operations/owned-marinas">
        {() => <Redirect to="/portfolio" />}
      </Route>

      {/* Operations Routes - Tabbed Module Pages */}
      <Route path="/operations/dockit">
        {() => (
          <GatedLayout pack="operations">
            <DockitTabbed />
          </GatedLayout>
        )}
      </Route>
      {/* Redirect old rent-roll route to new V2 module */}
      <Route path="/operations/rent-roll">
        {() => <Redirect to="/rent-roll/executive" />}
      </Route>
      <Route path="/operations/commercial-tenants">
        {() => (
          <GatedLayout pack="operations">
            <CommercialTenants />
          </GatedLayout>
        )}
      </Route>
      <Route path="/operations/fuel">
        {() => (
          <GatedLayout pack="operations">
            <FuelSalesTabbed />
          </GatedLayout>
        )}
      </Route>
      <Route path="/operations/integrations">
        <Suspense fallback={<PageLoader />}>
          <OperationsIntegrations />
        </Suspense>
      </Route>
      <Route path="/operations/ship-store">
        {() => (
          <GatedLayout pack="operations">
            <ShipStoreTabbed />
          </GatedLayout>
        )}
      </Route>
      <Route path="/operations/service">
        {() => (
          <GatedLayout pack="operations">
            <ServiceTabbed />
          </GatedLayout>
        )}
      </Route>
      <Route path="/operations/payroll">
        {() => (
          <GatedLayout pack="operations">
            <PayrollTabbed />
          </GatedLayout>
        )}
      </Route>
      <Route path="/operations/boat-rentals">
        {() => (
          <GatedLayout pack="operations">
            <BoatRentalsTabbed />
          </GatedLayout>
        )}
      </Route>
      <Route path="/operations/boat-club">
        {() => (
          <GatedLayout pack="operations">
            <BoatClubTabbed />
          </GatedLayout>
        )}
      </Route>
      <Route path="/operations/boat-sales">
        {() => (
          <GatedLayout pack="operations">
            <BoatSalesTabbed />
          </GatedLayout>
        )}
      </Route>
      <Route path="/operations/bookkeeping">
        {() => (
          <GatedLayout pack="operations">
            <BookkeepingTabbed />
          </GatedLayout>
        )}
      </Route>
      <Route path="/operations/budgeting">
        {() => {
          window.location.href = '/operations/bookkeeping?tab=budgeting';
          return null;
        }}
      </Route>
      {/* Marketing - Standalone Route */}
      <Route path="/marketing">
        {() => (
          <GatedLayout pack="operations">
            <MarketingTabbed />
          </GatedLayout>
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
      <Route path="/operations/service-parts">
        {() => {
          window.location.replace('/operations/service');
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
          window.location.replace('/marketing?tab=campaigns');
          return null;
        }}
      </Route>
      <Route path="/operations/marketing/settings">
        {() => {
          window.location.replace('/marketing?tab=settings');
          return null;
        }}
      </Route>

      {/* Cross-Module Analytics Dashboard */}
      <Route path="/analytics/unified">
        {() => (
          <UnifiedLayout>
            <UnifiedAnalytics />
          </UnifiedLayout>
        )}
      </Route>

      {/* CRM Routes with Unified Layout */}
      <Route path="/crm">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <CRMDashboard />
          </GatedLayout>
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
          <GatedLayout pack="crm_pipeline">
            <DealWorkspace />
          </GatedLayout>
        )}
      </Route>
      
      {/* Pipeline sub-pages */}
      <Route path="/pipeline/deal-board">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <Pipeline />
          </GatedLayout>
        )}
      </Route>
      <Route path="/pipeline/follow-ups">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <CrmTasks />
          </GatedLayout>
        )}
      </Route>
      <Route path="/pipeline/activity-log">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <ActivityLog />
          </GatedLayout>
        )}
      </Route>
      <Route path="/pipeline/forecast">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <Forecast />
          </GatedLayout>
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
      {/* CRM Record Pages - must be before list routes */}
      <Route path="/crm/contacts/:id">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <ContactRecordPage />
          </GatedLayout>
        )}
      </Route>
      <Route path="/crm/companies/:id">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <CompanyRecordPage />
          </GatedLayout>
        )}
      </Route>
      <Route path="/crm/properties/:id">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <PropertyRecordPage />
          </GatedLayout>
        )}
      </Route>

      {/* CRM List Pages */}
      <Route path="/crm/contacts">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <Contacts />
          </GatedLayout>
        )}
      </Route>
      <Route path="/crm/companies">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <Companies />
          </GatedLayout>
        )}
      </Route>
      <Route path="/crm/properties">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <Properties />
          </GatedLayout>
        )}
      </Route>
      <Route path="/crm/pending-properties">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <PendingProperties />
          </GatedLayout>
        )}
      </Route>
      <Route path="/crm/pending-contacts">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <PendingContacts />
          </GatedLayout>
        )}
      </Route>
      <Route path="/crm/pending-companies">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <PendingCompanies />
          </GatedLayout>
        )}
      </Route>
      <Route path="/crm/deals">
        {() => {
          window.location.replace('/deal-workspace?view=list');
          return null;
        }}
      </Route>
      <Route path="/crm/deals/compare">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <DealComparison />
          </GatedLayout>
        )}
      </Route>
      <Route path="/crm/deals/:dealId">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <DealDetail />
          </GatedLayout>
        )}
      </Route>
      <Route path="/crm/deals/:dealId/om">
        {(params: { dealId: string }) => (
          <GatedLayout pack="crm_pipeline">
            <DealOMBuilder dealId={params.dealId} />
          </GatedLayout>
        )}
      </Route>
      <Route path="/crm/tasks">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <CrmTasks />
          </GatedLayout>
        )}
      </Route>
      <Route path="/crm/prospecting">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <Prospecting />
          </GatedLayout>
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
      <Route path="/crm/deal-analytics">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <DealAnalyticsPage />
          </GatedLayout>
        )}
      </Route>
      <Route path="/crm/pipeline-insights">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <PipelineInsights />
          </GatedLayout>
        )}
      </Route>
      <Route path="/crm/pipeline-velocity">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <Suspense fallback={<PageLoader />}>
              <PipelineVelocity />
            </Suspense>
          </GatedLayout>
        )}
      </Route>
      <Route path="/crm/analytics">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <Analytics />
          </GatedLayout>
        )}
      </Route>
      <Route path="/crm/forecast">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <Forecast />
          </GatedLayout>
        )}
      </Route>
      <Route path="/crm/forms">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <Forms />
          </GatedLayout>
        )}
      </Route>
      <Route path="/crm/labels">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <Labels />
          </GatedLayout>
        )}
      </Route>
      <Route path="/crm/products">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <Products />
          </GatedLayout>
        )}
      </Route>
      <Route path="/crm/workflows">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <Workflows />
          </GatedLayout>
        )}
      </Route>
      <Route path="/crm/webhooks">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <Webhooks />
          </GatedLayout>
        )}
      </Route>
      <Route path="/crm/archive">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <ArchivePage />
          </GatedLayout>
        )}
      </Route>
      <Route path="/crm/dedupe">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <Dedupe />
          </GatedLayout>
        )}
      </Route>
      <Route path="/crm/scoring">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <Scoring />
          </GatedLayout>
        )}
      </Route>
      <Route path="/import-contacts">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <ImportContacts />
          </GatedLayout>
        )}
      </Route>
      <Route path="/import-history">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <ImportHistory />
          </GatedLayout>
        )}
      </Route>
      <Route path="/crm/activities">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <CrmActivitiesPage />
          </GatedLayout>
        )}
      </Route>
      <Route path="/crm/activity">
        {() => (
          <GatedLayout pack="crm_pipeline">
            <ActivityLog />
          </GatedLayout>
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
          <GatedLayout pack="prospecting">
            <ProspectingOverview />
          </GatedLayout>
        )}
      </Route>
      <Route path="/prospecting/workroom">
        {() => (
          <GatedLayout pack="prospecting">
            <ProspectingWorkroom />
          </GatedLayout>
        )}
      </Route>
      <Route path="/prospecting/markets">
        {() => (
          <GatedLayout pack="prospecting">
            <MarketTargets />
          </GatedLayout>
        )}
      </Route>
      <Route path="/prospecting/campaigns">
        {() => (
          <GatedLayout pack="prospecting">
            <ProspectingCampaigns />
          </GatedLayout>
        )}
      </Route>
      <Route path="/marinamatch">
        {() => (
          <UnifiedLayout>
            <MarinaMatchIndex />
          </UnifiedLayout>
        )}
      </Route>

      {/* Docket Full Application - Uses Unified Layout */}
      <Route path="/docket">
        {() => (
          <UnifiedLayout>
            <Suspense fallback={<PageLoader />}>
              <DocketRouter />
            </Suspense>
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/docket/:rest*">
        {() => (
          <UnifiedLayout>
            <Suspense fallback={<PageLoader />}>
              <DocketRouter />
            </Suspense>
          </UnifiedLayout>
        )}
      </Route>

      {/* Analysis / Sales Comps Routes */}
      <Route path="/analysis/sales-comps/map">
        {() => (
          <GatedLayout pack="analysis">
            <SalesCompsMapView />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/sales-comps">
        {() => (
          <GatedLayout pack="analysis">
            <SalesCompsIndex />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/sales-comps/analytics">
        {() => (
          <GatedLayout pack="analysis">
            <SalesCompsAnalytics />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/sales-comps/projects">
        {() => (
          <GatedLayout pack="analysis">
            <SalesCompsProjects />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/sales-comps/upload">
        {() => (
          <GatedLayout pack="analysis">
            <SalesCompsUpload />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/sales-comps/columns">
        {() => (
          <GatedLayout pack="analysis">
            <SalesCompsColumnManager />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/sales-comps/bulk-edit">
        {() => (
          <GatedLayout pack="analysis">
            <SalesCompsBulkEdit />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/sales-comps/compare">
        {() => (
          <GatedLayout pack="analysis">
            <SalesCompsCompare />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/sales-comps/pending-profiles">
        {() => (
          <GatedLayout pack="analysis">
            <SalesCompsPendingProfiles />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/sales-comps/pending-comps">
        {() => (
          <GatedLayout pack="analysis">
            <SalesCompsPendingComps />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/sales-comps/:id">
        {(params) => (
          <GatedLayout pack="analysis">
            <SalesCompsDetail {...params} />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/projects">
        {() => (
          <GatedLayout pack="analysis">
            <ScProjectsIndex />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/projects/:id">
        {(params) => (
          <GatedLayout pack="analysis">
            <ScProjectsReport {...params} />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/rate-comps/map">
        {() => (
          <GatedLayout pack="analysis">
            <RateCompsMapView />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/rate-comps">
        {() => (
          <GatedLayout pack="analysis">
            <RateCompsIndex />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/industry-standards">
        {() => (
          <GatedLayout pack="analysis">
          <IndustryStandards />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/valuation-timeline">
        {() => (
          <GatedLayout pack="analysis">
            <ValuationTimelineIndex />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/marina-comps">
        {() => (
          <GatedLayout pack="analysis">
            <MarinaCompsIndex />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/rate-comps/analytics">
        {() => (
          <GatedLayout pack="analysis">
            <RateCompsAnalytics />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/rate-comps/upload">
        {() => (
          <GatedLayout pack="analysis">
            <RateCompsUpload />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/rate-comps/columns">
        {() => (
          <GatedLayout pack="analysis">
            <RateCompsColumnManager />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/rate-comps/bulk-edit">
        {() => (
          <GatedLayout pack="analysis">
            <RateCompsBulkEdit />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/rate-comps/compare">
        {() => (
          <GatedLayout pack="analysis">
            <RateCompsCompare />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/rate-comps/:id">
        {(params) => (
          <GatedLayout pack="analysis">
            <RateCompsDetail {...params} />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/marina-database">
        {() => (
          <GatedLayout pack="analysis">
            <MarinaDatabase />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/demographics">
        {() => (
          <GatedLayout pack="analysis">
            <DemographicsIndex />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/benchmarks">
        {() => (
          <GatedLayout pack="analysis">
            <BenchmarksIndex />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/capital-markets">
        {() => (
          <GatedLayout pack="analysis">
            <CapitalMarketsIndex />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/hub">
        {() => (
          <GatedLayout pack="analysis">
            <AnalysisHub />
          </GatedLayout>
        )}
      </Route>
      <Route path="/analysis/marinalytics">
        {() => (
          <GatedLayout pack="analysis">
            <MarinalyticsPage />
          </GatedLayout>
        )}
      </Route>
      <Route path="/marinalytics/marina-map">
        {() => (
          <UnifiedLayout>
            <MarinaMapPage />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/analysis/financial-analysis">
        {() => (
          <GatedLayout pack="analysis">
            <FinancialAnalysis />
          </GatedLayout>
        )}
      </Route>
      <Route path="/marinalytics/financial-analysis">
        {() => (
          <UnifiedLayout>
            <FinancialAnalysis />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/new">
        {() => (
          <GatedLayout pack="modeling_tools">
            <SetupWizard />
          </GatedLayout>
        )}
      </Route>
      <Route path="/modeling/projects">
        {() => (
          <GatedLayout pack="modeling_tools">
            <ModelingProjectsIndex />
          </GatedLayout>
        )}
      </Route>
      <Route path="/modeling/settings/chart-of-accounts">
        {() => (
          <GatedLayout pack="modeling_tools">
            <ChartOfAccounts />
          </GatedLayout>
        )}
      </Route>
      <Route path="/modeling/settings/category-mapping">
        {() => (
          <GatedLayout pack="modeling_tools">
            <CategoryMapping />
          </GatedLayout>
        )}
      </Route>
      <Route path="/modeling/settings/normalization-status">
        {() => (
          <GatedLayout pack="modeling_tools">
            <NormalizationStatus />
          </GatedLayout>
        )}
      </Route>
      <Route path="/modeling/investment-criteria">
        <Suspense fallback={<PageLoader />}>
          <InvestmentCriteria />
        </Suspense>
      </Route>
      <Route path="/modeling/settings">
        {() => (
          <GatedLayout pack="modeling_tools">
            <ModelingSettings />
          </GatedLayout>
        )}
      </Route>
      <Route path="/modeling/portfolio/returns">
        {() => (
          <GatedLayout pack="modeling_tools">
            <PortfolioReturns />
          </GatedLayout>
        )}
      </Route>
      <Route path="/modeling/portfolio">
        {() => (
          <GatedLayout pack="modeling_tools">
            <ModelingPortfolio />
          </GatedLayout>
        )}
      </Route>
      <Route path="/modeling/funds">
        {() => (
          <GatedLayout pack="modeling_tools">
            <ModelingFunds />
          </GatedLayout>
        )}
      </Route>
      <Route path="/modeling/funds/:fundId">
        {() => (
          <GatedLayout pack="modeling_tools">
            <FundDetail />
          </GatedLayout>
        )}
      </Route>
      <Route path="/modeling/lp-portal">
        {() => (
          <GatedLayout pack="modeling_tools">
            <LPPortal />
          </GatedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/transaction-closing">
        {(params) => (
          <GatedLayout pack="modeling_tools">
            <TransactionClosingPage {...params} />
          </GatedLayout>
        )}
      </Route>
      
      {/* Project Workspace Route */}
      <Route path="/modeling/projects/:projectId">
        {(params) => (
          <GatedLayout pack="modeling_tools">
            <ProjectWorkspace {...params} />
          </GatedLayout>
        )}
      </Route>
      
      {/* Document Intelligence Route */}
      <Route path="/modeling/projects/:projectId/doc-intel">
        {(params) => (
          <GatedLayout pack="modeling_tools">
            <DocumentIntelligence {...params} />
          </GatedLayout>
        )}
      </Route>

      {/* COA Mapping Review Route */}
      <Route path="/modeling/doc-intel/:uploadId/coa-review">
        {(params) => (
          <GatedLayout pack="modeling_tools">
            <CoaMappingReview {...params} />
          </GatedLayout>
        )}
      </Route>

      {/* Departmental P&L Route */}
      <Route path="/modeling/doc-intel/:uploadId/departmental-pl">
        {(params) => (
          <GatedLayout pack="modeling_tools">
            <DepartmentalPL {...params} />
          </GatedLayout>
        )}
      </Route>
      
      {/* Exit Strategy Suite Routes */}
      <Route path="/modeling/projects/:projectId/exit">
        {(params) => (
          <GatedLayout pack="modeling_tools">
            <ExitStrategyDashboard {...params} />
          </GatedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/scenarios">
        {(params) => (
          <GatedLayout pack="modeling_tools">
            <ExitScenarios {...params} />
          </GatedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/scenarios/:scenarioId">
        {(params) => (
          <GatedLayout pack="modeling_tools">
            <ExitScenarioDetail {...params} />
          </GatedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/tax">
        {(params) => (
          <GatedLayout pack="modeling_tools">
            <ExitTaxCalculator {...params} />
          </GatedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/net-proceeds">
        {(params) => (
          <GatedLayout pack="modeling_tools">
            <ExitNetProceeds {...params} />
          </GatedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/1031">
        {(params) => (
          <GatedLayout pack="modeling_tools">
            <Exit1031Exchange {...params} />
          </GatedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/dst">
        {(params) => (
          <GatedLayout pack="modeling_tools">
            <ExitDSTAnalysis {...params} />
          </GatedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/seller-financing">
        {(params) => (
          <GatedLayout pack="modeling_tools">
            <ExitSellerFinancing {...params} />
          </GatedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/earnout">
        {(params) => (
          <GatedLayout pack="modeling_tools">
            <ExitEarnout {...params} />
          </GatedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/waterfall">
        {(params) => (
          <GatedLayout pack="modeling_tools">
            <ExitWaterfall {...params} />
          </GatedLayout>
        )}
      </Route>
      <Route path="/dev/exit-reconciliation">
        {() => (
          <UnifiedLayout>
            <ExitReconciliation />
          </UnifiedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/irr">
        {(params) => (
          <GatedLayout pack="modeling_tools">
            <ExitIRRCalculator {...params} />
          </GatedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/sensitivity">
        {(params) => (
          <GatedLayout pack="modeling_tools">
            <ExitSensitivity {...params} />
          </GatedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/ai-insights">
        {(params) => (
          <GatedLayout pack="modeling_tools">
            <ExitAIInsights {...params} />
          </GatedLayout>
        )}
      </Route>
      <Route path="/modeling/projects/:projectId/exit/compare">
        {(params) => (
          <GatedLayout pack="modeling_tools">
            <ExitScenarioComparison {...params} />
          </GatedLayout>
        )}
      </Route>
      
      <Route path="/modeling/returns-valuation">
        {() => (
          <GatedLayout pack="modeling_tools">
            <ReturnsValuation />
          </GatedLayout>
        )}
      </Route>

      <Route path="/modeling/scenarios/:rest*">
        {() => (
          <GatedLayout pack="modeling_tools">
            <ScenariosIndex />
          </GatedLayout>
        )}
      </Route>
      <Route path="/modeling/scenarios">
        {() => (
          <GatedLayout pack="modeling_tools">
            <ScenariosIndex />
          </GatedLayout>
        )}
      </Route>
      <Route path="/modeling/debt-scenarios">
        {() => (
          <GatedLayout pack="modeling_tools">
            <ScenariosIndex />
          </GatedLayout>
        )}
      </Route>
      
      <Route path="/modeling/pnl/upload">
        {() => (
          <GatedLayout pack="modeling_tools">
            <PnlUpload />
          </GatedLayout>
        )}
      </Route>
      
      <Route path="/modeling/pnl/review">
        {() => (
          <GatedLayout pack="modeling_tools">
            <PnlReview />
          </GatedLayout>
        )}
      </Route>
      
      <Route path="/modeling/pnl/keyword-bank">
        {() => (
          <GatedLayout pack="modeling_tools">
            <PnlKeywordBank />
          </GatedLayout>
        )}
      </Route>
      
      <Route path="/modeling/pnl-parser">
        {() => (
          <GatedLayout pack="modeling_tools">
            <PnlUploadReview />
          </GatedLayout>
        )}
      </Route>
      
      <Route path="/modeling/exit-strategies">
        {() => (
          <GatedLayout pack="modeling_tools">
            <ExitStrategiesIndex />
          </GatedLayout>
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
      <Route path="/document-builder/:documentId?">
        {(params: { documentId?: string }) => (
          <UnifiedLayout>
            <DocumentBuilderPage documentId={params.documentId} />
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
      <ThemeProvider defaultTheme="system">
        <QueryClientProvider client={queryClient}>
          <GoogleMapsProvider>
            <SettingsProvider>
              <AuthProvider>
                <ProspectingActivityProvider>
                  <TooltipProvider>
                    <Toaster />
                    <Suspense fallback={<PageLoader />}>
                      <Router />
                    </Suspense>
                  </TooltipProvider>
                </ProspectingActivityProvider>
              </AuthProvider>
            </SettingsProvider>
          </GoogleMapsProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
