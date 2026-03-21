import { Suspense, lazy, ComponentType } from "react";
import { useLocation, useSearch } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TabDefinition {
  id: string;
  label: string;
  icon?: LucideIcon;
  component: ComponentType<any>;
  requiresPack?: string;
  disabled?: boolean;
  badge?: string | number;
  description?: string;
}

interface TabbedModuleLayoutProps {
  moduleName: string;
  moduleDescription?: string;
  moduleIcon?: LucideIcon;
  tabs: TabDefinition[];
  defaultTab?: string;
  basePath: string;
  activePacks?: string[];
  className?: string;
  headerActions?: React.ReactNode;
}

function TabSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export function TabbedModuleLayout({
  moduleName,
  moduleDescription,
  moduleIcon: ModuleIcon,
  tabs,
  defaultTab,
  basePath,
  activePacks = [],
  className,
  headerActions,
}: TabbedModuleLayoutProps) {
  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  
  const params = new URLSearchParams(searchString);
  const currentTab = params.get("tab") || defaultTab || tabs[0]?.id;

  const visibleTabs = tabs.filter(tab => {
    if (tab.requiresPack && !activePacks.includes(tab.requiresPack)) {
      return false;
    }
    return true;
  });

  const handleTabChange = (tabId: string) => {
    const newParams = new URLSearchParams(searchString);
    newParams.set("tab", tabId);
    setLocation(`${basePath}?${newParams.toString()}`);
  };

  const activeTab = visibleTabs.find(t => t.id === currentTab) || visibleTabs[0];

  return (
    <div className={cn("min-h-screen bg-background", className)}>
      <Tabs value={activeTab?.id} onValueChange={handleTabChange} className="w-full">
        <div className="sticky top-0 z-10 bg-background border-b">
          <div className="px-3 md:px-6 pt-3 md:pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 md:mb-4 gap-2">
              <div className="flex items-center gap-3 min-w-0">
                {ModuleIcon && (
                  <div className="p-1.5 md:p-2 rounded-lg bg-primary/10 flex-shrink-0">
                    <ModuleIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="text-xl md:text-2xl font-bold text-foreground truncate" data-testid="module-title">
                    {moduleName}
                  </h1>
                  {moduleDescription && (
                    <p className="text-xs md:text-sm text-muted-foreground truncate" data-testid="module-description">
                      {moduleDescription}
                    </p>
                  )}
                </div>
              </div>
              {headerActions && (
                <div className="flex items-center gap-2 flex-shrink-0 overflow-x-auto">
                  {headerActions}
                </div>
              )}
            </div>
          </div>

          <TabsList className="w-full justify-start rounded-none border-b-0 bg-transparent px-3 md:px-6 pb-0 h-auto overflow-x-auto scrollbar-hide flex-nowrap md:flex-wrap">
            {visibleTabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  disabled={tab.disabled}
                  className={cn(
                    "relative rounded-none border-b-2 border-transparent",
                    "data-[state=active]:border-primary data-[state=active]:bg-transparent",
                    "data-[state=active]:shadow-none",
                    "px-4 py-3 text-sm font-medium",
                    "hover:text-primary transition-colors",
                    tab.disabled && "opacity-50 cursor-not-allowed"
                  )}
                  data-testid={`tab-${tab.id}`}
                >
                  <div className="flex items-center gap-2">
                    {TabIcon && <TabIcon className="h-4 w-4" />}
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                        {tab.badge}
                      </span>
                    )}
                  </div>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {visibleTabs.map((tab) => {
          const TabComponent = tab.component;
          return (
            <TabsContent
              key={tab.id}
              value={tab.id}
              className="mt-0 focus-visible:outline-none focus-visible:ring-0"
            >
              <Suspense fallback={<TabSkeleton />}>
                <TabComponent />
              </Suspense>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

export function PlaceholderTab({ 
  title, 
  description,
  icon: Icon,
  features = [],
  integrationReady = false,
}: { 
  title: string; 
  description: string;
  icon?: LucideIcon;
  features?: string[];
  integrationReady?: boolean;
}) {
  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto text-center py-12">
        {Icon && (
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
            <Icon className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <h2 className="text-2xl font-semibold text-foreground mb-2" data-testid="placeholder-title">
          {title}
        </h2>
        <p className="text-muted-foreground mb-6" data-testid="placeholder-description">
          {description}
        </p>
        
        {features.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-6 text-left mb-6">
            <h3 className="font-medium text-foreground mb-3">Planned Features:</h3>
            <ul className="space-y-2">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-primary mt-0.5">•</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        )}

        {integrationReady && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-700 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Ready for third-party integrations
          </div>
        )}
      </div>
    </div>
  );
}
