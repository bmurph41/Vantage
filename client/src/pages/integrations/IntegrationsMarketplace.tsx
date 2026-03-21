import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Plug,
  Search,
  Grid,
  List,
  Anchor,
  Calendar,
  Wrench,
  MessageSquare,
  Calculator,
  ArrowRightLeft,
  Building,
  Warehouse,
  Hotel,
  Home,
  Truck,
  Building2,
  Briefcase,
  Users,
  CreditCard,
  FileSignature,
  Star,
  Filter,
  Sparkles,
  ArrowRight,
  BadgeCheck,
  Layers,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { IntegrationSetupWizard } from "@/components/integrations/IntegrationSetupWizard";
import { SyncStatusPanel } from "@/components/integrations/SyncStatusPanel";
import {
  fetchIntegrations,
  connectIntegration,
  disconnectIntegration,
  type IntegrationItem,
} from "@/lib/api/integrations";

// ---------------------------------------------------------------------------
// Asset Class definitions
// ---------------------------------------------------------------------------
interface AssetClassDef {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

const ASSET_CLASSES: AssetClassDef[] = [
  { key: "marina", label: "Marina", icon: Anchor, color: "text-blue-700", bgColor: "bg-blue-100" },
  { key: "multifamily", label: "Multifamily", icon: Building, color: "text-violet-700", bgColor: "bg-violet-100" },
  { key: "self-storage", label: "Self-Storage", icon: Warehouse, color: "text-amber-700", bgColor: "bg-amber-100" },
  { key: "hotel", label: "Hotel/Hospitality", icon: Hotel, color: "text-rose-700", bgColor: "bg-rose-100" },
  { key: "str", label: "Short-Term Rental", icon: Home, color: "text-teal-700", bgColor: "bg-teal-100" },
  { key: "rv-park", label: "RV Park", icon: Truck, color: "text-orange-700", bgColor: "bg-orange-100" },
  { key: "commercial", label: "Commercial (Retail/Office/Industrial)", icon: Building2, color: "text-slate-700", bgColor: "bg-slate-100" },
  { key: "residential", label: "Residential (SFR)", icon: Home, color: "text-emerald-700", bgColor: "bg-emerald-100" },
  { key: "business", label: "Business", icon: Briefcase, color: "text-indigo-700", bgColor: "bg-indigo-100" },
];

const ASSET_CLASS_MAP = new Map(ASSET_CLASSES.map((ac) => [ac.key, ac]));

// ---------------------------------------------------------------------------
// Category definitions
// ---------------------------------------------------------------------------
const CATEGORY_ORDER = [
  "Marina PMS",
  "Multifamily PMS",
  "Self-Storage Management",
  "Hotel PMS",
  "STR Management",
  "RV Park Management",
  "Commercial RE",
  "Residential PM",
  "Payroll & HR",
  "Accounting",
  "Reservations & Booking",
  "Service & Maintenance",
  "Communications",
  "Transaction Management",
  "Document & E-Signature",
  "Business Operations",
];

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "Marina PMS": Anchor,
  "Multifamily PMS": Building,
  "Self-Storage Management": Warehouse,
  "Hotel PMS": Hotel,
  "STR Management": Home,
  "RV Park Management": Truck,
  "Commercial RE": Building2,
  "Residential PM": Home,
  "Payroll & HR": Users,
  "Accounting": Calculator,
  "Reservations & Booking": Calendar,
  "Service & Maintenance": Wrench,
  "Communications": MessageSquare,
  "Transaction Management": CreditCard,
  "Document & E-Signature": FileSignature,
  "Business Operations": Briefcase,
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "Marina PMS": "Property management systems for slip inventory, tenants, and billing",
  "Multifamily PMS": "Apartment and multifamily property management platforms",
  "Self-Storage Management": "Unit management, access control, and billing for storage facilities",
  "Hotel PMS": "Front desk, housekeeping, and revenue management for hospitality",
  "STR Management": "Channel managers, pricing, and guest communications for vacation rentals",
  "RV Park Management": "Reservation, site management, and utility tracking for RV parks",
  "Commercial RE": "Lease management, CAM reconciliation, and tenant relations for CRE",
  "Residential PM": "Single-family rental management, maintenance, and owner portals",
  "Payroll & HR": "Payroll processing, time tracking, and HR management",
  "Accounting": "Financial systems, invoicing, and payment processing",
  "Reservations & Booking": "Online booking platforms and marketplace channels",
  "Service & Maintenance": "Work orders, preventive maintenance, and vendor coordination",
  "Communications": "Tenant messaging, access control, and notifications",
  "Transaction Management": "Payment gateways, escrow, and transaction processing",
  "Document & E-Signature": "Document management, e-signatures, and digital closings",
  "Business Operations": "General business tools, CRM, and operational utilities",
};

// Universal categories that span all asset classes
const UNIVERSAL_CATEGORIES = new Set([
  "Payroll & HR",
  "Accounting",
  "Transaction Management",
  "Document & E-Signature",
  "Business Operations",
  "Communications",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isUniversalIntegration(item: IntegrationItem): boolean {
  if (UNIVERSAL_CATEGORIES.has(item.category)) return true;
  const ac = item.assetClasses ?? [];
  return ac.length === 0 || ac.length >= 5;
}

function getAssetClassesForItem(item: IntegrationItem): string[] {
  return item.assetClasses ?? [];
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function IntegrationsMarketplace() {
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [assetClassFilter, setAssetClassFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationItem | null>(null);
  const [apiKeyValue, setApiKeyValue] = useState("");

  // Fetch integrations
  const { data, isLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: fetchIntegrations,
  });

  // Fetch org asset classes for recommendations
  const { data: orgAssetClasses } = useQuery<{ assetClasses: string[] }>({
    queryKey: ["organization-asset-classes"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/organization/asset-classes", { credentials: "include" });
        if (!res.ok) return { assetClasses: [] };
        return res.json();
      } catch {
        return { assetClasses: [] };
      }
    },
  });

  const connectMut = useMutation({
    mutationFn: ({ key, payload }: { key: string; payload?: { apiKey?: string; settings?: Record<string, any> } }) =>
      connectIntegration(key, payload),
    onSuccess: async (resp, vars) => {
      if (resp?.authorizeUrl) {
        window.location.href = resp.authorizeUrl;
        return;
      }
      await qc.invalidateQueries({ queryKey: ["integrations"] });
      await qc.invalidateQueries({ queryKey: ["integration", vars.key] });
      setApiKeyDialogOpen(false);
      setApiKeyValue("");
      setSelectedIntegration(null);
    },
  });

  const disconnectMut = useMutation({
    mutationFn: (key: string) => disconnectIntegration(key),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["integrations"] });
    },
  });

  function handleConnect(item: IntegrationItem) {
    if (item.authType === "apiKey" || item.settingsSchema?.fields?.length > 0) {
      setSelectedIntegration(item);
      setApiKeyDialogOpen(true);
      return;
    }
    connectMut.mutate({ key: item.key });
  }

  function handleWizardConnect(credentials: Record<string, string>) {
    if (!selectedIntegration) return;
    connectMut.mutate({
      key: selectedIntegration.key,
      payload: { apiKey: credentials.apiKey, settings: credentials },
    });
  }

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------
  const items = data?.items ?? [];
  const userAssetClasses = orgAssetClasses?.assetClasses ?? [];

  // Count integrations per asset class
  const assetClassCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    ASSET_CLASSES.forEach((ac) => {
      counts[ac.key] = items.filter(
        (i) => (i.assetClasses ?? []).includes(ac.key) || isUniversalIntegration(i)
      ).length;
    });
    return counts;
  }, [items]);

  // Filter pipeline: asset class -> category -> search
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Asset class filter
      if (assetClassFilter !== "all") {
        const itemAC = getAssetClassesForItem(item);
        const universal = isUniversalIntegration(item);
        if (!universal && !itemAC.includes(assetClassFilter)) return false;
      }
      // Category filter
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      // Search filter
      if (search) {
        const q = search.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = item.description?.toLowerCase().includes(q) ?? false;
        const matchesCat = item.category.toLowerCase().includes(q);
        const matchesAC = (item.assetClasses ?? []).some((ac) => {
          const def = ASSET_CLASS_MAP.get(ac);
          return ac.toLowerCase().includes(q) || (def?.label.toLowerCase().includes(q) ?? false);
        });
        if (!matchesName && !matchesDesc && !matchesCat && !matchesAC) return false;
      }
      return true;
    });
  }, [items, assetClassFilter, categoryFilter, search]);

  const connectedItems = filteredItems.filter((i) => i.status === "connected");
  const availableItems = filteredItems.filter((i) => i.status !== "connected");

  // Recommended integrations
  const recommendedItems = useMemo(() => {
    if (userAssetClasses.length === 0) return [];
    return items.filter((item) => {
      if (item.status === "connected") return false;
      const itemAC = getAssetClassesForItem(item);
      return itemAC.some((ac) => userAssetClasses.includes(ac));
    });
  }, [items, userAssetClasses]);

  // Universal integrations (for cross-asset section)
  const universalItems = useMemo(() => {
    return filteredItems.filter((item) => isUniversalIntegration(item));
  }, [filteredItems]);

  // Non-universal items for the filtered asset class
  const assetSpecificItems = useMemo(() => {
    if (assetClassFilter === "all") return filteredItems;
    return filteredItems.filter((item) => !isUniversalIntegration(item));
  }, [filteredItems, assetClassFilter]);

  // Group by category
  const groupedByCategory = useMemo(() => {
    const result: Record<string, IntegrationItem[]> = {};
    CATEGORY_ORDER.forEach((cat) => {
      const catItems = filteredItems.filter((i) => i.category === cat);
      if (catItems.length > 0) result[cat] = catItems;
    });
    // catch-all for uncategorized
    const categorized = new Set(CATEGORY_ORDER);
    const uncategorized = filteredItems.filter((i) => !categorized.has(i.category));
    if (uncategorized.length > 0) result["Other"] = uncategorized;
    return result;
  }, [filteredItems]);

  // Stats
  const totalCount = items.length;
  const connectedCount = items.filter((i) => i.status === "connected").length;
  const categoryCount = new Set(items.map((i) => i.category)).size;

  // Active categories for the filter pills
  const activeCategories = useMemo(() => {
    return CATEGORY_ORDER.filter((cat) => items.some((i) => i.category === cat));
  }, [items]);

  // Connected items grouped by asset class for the Connected panel
  const connectedByAssetClass = useMemo(() => {
    const result: Record<string, IntegrationItem[]> = {};
    const connected = items.filter((i) => i.status === "connected");
    ASSET_CLASSES.forEach((ac) => {
      const matching = connected.filter(
        (i) => (i.assetClasses ?? []).includes(ac.key) || isUniversalIntegration(i)
      );
      if (matching.length > 0) result[ac.key] = matching;
    });
    return result;
  }, [items]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1E4FAB] to-[#152d6b] flex items-center justify-center">
              <Plug className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Integrations Marketplace</h1>
              <p className="text-muted-foreground">
                Connect your property management, accounting, and operations software
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setLocation("/settings/integrations/migration")}>
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            Migration Dashboard
          </Button>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-6 px-4 py-3 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{totalCount}</span>
            <span className="text-sm text-muted-foreground">Total Integrations</span>
          </div>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-2">
            <BadgeCheck className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium">{connectedCount}</span>
            <span className="text-sm text-muted-foreground">Connected</span>
          </div>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-2">
            <Grid className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{categoryCount}</span>
            <span className="text-sm text-muted-foreground">Categories</span>
          </div>
        </div>
      </div>

      {/* Sync status for connected items */}
      {connectedCount > 0 && (
        <div className="mb-6">
          <SyncStatusPanel showModuleCoverage={false} />
        </div>
      )}

      {/* Asset Class Filter Bar */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Filter by asset class</span>
        </div>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 pb-2">
            <Button
              variant={assetClassFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setAssetClassFilter("all")}
              className={assetClassFilter === "all" ? "bg-[#1E4FAB] hover:bg-[#1a4294]" : ""}
            >
              <Layers className="w-4 h-4 mr-1" />
              All Asset Classes ({totalCount})
            </Button>
            {ASSET_CLASSES.map((ac) => {
              const Icon = ac.icon;
              const count = assetClassCounts[ac.key] || 0;
              const isActive = assetClassFilter === ac.key;
              return (
                <Button
                  key={ac.key}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAssetClassFilter(ac.key)}
                  className={isActive ? "bg-[#1E4FAB] hover:bg-[#1a4294]" : ""}
                >
                  <Icon className="w-4 h-4 mr-1" />
                  {ac.label} ({count})
                </Button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Search + View Mode + Category Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, description, category, or asset class..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("grid")}
          >
            <Grid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("list")}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button
          variant={categoryFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setCategoryFilter("all")}
          className={categoryFilter === "all" ? "bg-[#1E4FAB] hover:bg-[#1a4294]" : ""}
        >
          All Categories ({filteredItems.length})
        </Button>
        {activeCategories.map((cat) => {
          const Icon = CATEGORY_ICONS[cat] || Plug;
          const count = filteredItems.filter((i) => i.category === cat).length;
          if (count === 0) return null;
          return (
            <Button
              key={cat}
              variant={categoryFilter === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter(cat)}
              className={categoryFilter === cat ? "bg-[#1E4FAB] hover:bg-[#1a4294]" : ""}
            >
              <Icon className="w-4 h-4 mr-1" />
              {cat} ({count})
            </Button>
          );
        })}
      </div>

      {/* Main Content */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All ({filteredItems.length})</TabsTrigger>
          <TabsTrigger value="connected">Connected ({connectedItems.length})</TabsTrigger>
          <TabsTrigger value="available">Available ({availableItems.length})</TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                : "space-y-3"
            }
          >
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            {/* ============ ALL TAB ============ */}
            <TabsContent value="all">
              <div className="space-y-8">
                {/* Recommended For You */}
                {recommendedItems.length > 0 &&
                  categoryFilter === "all" &&
                  assetClassFilter === "all" &&
                  !search && (
                    <RecommendedSection
                      items={recommendedItems}
                      userAssetClasses={userAssetClasses}
                      viewMode={viewMode}
                      onConnect={handleConnect}
                      onDisconnect={(item) => disconnectMut.mutate(item.key)}
                      isConnecting={connectMut.isPending}
                      isDisconnecting={disconnectMut.isPending}
                    />
                  )}

                {/* Asset-class specific + universal when asset class is filtered */}
                {assetClassFilter !== "all" ? (
                  <>
                    {/* Asset-specific integrations */}
                    {assetSpecificItems.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          {(() => {
                            const ac = ASSET_CLASS_MAP.get(assetClassFilter);
                            if (!ac) return null;
                            const Icon = ac.icon;
                            return <Icon className={`w-5 h-5 ${ac.color}`} />;
                          })()}
                          <h2 className="text-lg font-semibold">
                            {ASSET_CLASS_MAP.get(assetClassFilter)?.label} Integrations
                          </h2>
                          <Badge variant="secondary">{assetSpecificItems.length}</Badge>
                        </div>
                        <IntegrationGrid
                          items={assetSpecificItems}
                          viewMode={viewMode}
                          onConnect={handleConnect}
                          onDisconnect={(item) => disconnectMut.mutate(item.key)}
                          isConnecting={connectMut.isPending}
                          isDisconnecting={disconnectMut.isPending}
                          recommendedKeys={new Set(recommendedItems.map((i) => i.key))}
                        />
                      </div>
                    )}

                    {/* Universal / Also available */}
                    {universalItems.length > 0 && (
                      <div>
                        <Separator className="mb-6" />
                        <div className="flex items-center gap-2 mb-4">
                          <Sparkles className="w-5 h-5 text-amber-500" />
                          <h2 className="text-lg font-semibold">Also Available &mdash; Works with All Properties</h2>
                          <Badge variant="secondary">{universalItems.length}</Badge>
                        </div>
                        <IntegrationGrid
                          items={universalItems}
                          viewMode={viewMode}
                          onConnect={handleConnect}
                          onDisconnect={(item) => disconnectMut.mutate(item.key)}
                          isConnecting={connectMut.isPending}
                          isDisconnecting={disconnectMut.isPending}
                          recommendedKeys={new Set(recommendedItems.map((i) => i.key))}
                        />
                      </div>
                    )}

                    {assetSpecificItems.length === 0 && universalItems.length === 0 && (
                      <EmptyState />
                    )}
                  </>
                ) : categoryFilter !== "all" ? (
                  // Filtered by category only
                  <IntegrationGrid
                    items={filteredItems}
                    viewMode={viewMode}
                    onConnect={handleConnect}
                    onDisconnect={(item) => disconnectMut.mutate(item.key)}
                    isConnecting={connectMut.isPending}
                    isDisconnecting={disconnectMut.isPending}
                    recommendedKeys={new Set(recommendedItems.map((i) => i.key))}
                  />
                ) : (
                  // No filters - show grouped by category
                  <>
                    {Object.entries(groupedByCategory).map(([cat, catItems]) => {
                      const Icon = CATEGORY_ICONS[cat] || Plug;
                      return (
                        <div key={cat}>
                          <div className="flex items-center gap-2 mb-3">
                            <Icon className="w-5 h-5 text-[#1E4FAB]" />
                            <h2 className="text-lg font-semibold">{cat}</h2>
                            <span className="text-sm text-muted-foreground">({catItems.length})</span>
                          </div>
                          {CATEGORY_DESCRIPTIONS[cat] && (
                            <p className="text-sm text-muted-foreground mb-4">
                              {CATEGORY_DESCRIPTIONS[cat]}
                            </p>
                          )}
                          <IntegrationGrid
                            items={catItems}
                            viewMode={viewMode}
                            onConnect={handleConnect}
                            onDisconnect={(item) => disconnectMut.mutate(item.key)}
                            isConnecting={connectMut.isPending}
                            isDisconnecting={disconnectMut.isPending}
                            recommendedKeys={new Set(recommendedItems.map((i) => i.key))}
                          />
                        </div>
                      );
                    })}
                    {Object.keys(groupedByCategory).length === 0 && <EmptyState />}
                  </>
                )}
              </div>
            </TabsContent>

            {/* ============ CONNECTED TAB ============ */}
            <TabsContent value="connected">
              {connectedItems.length === 0 ? (
                <EmptyState message="No connected integrations yet. Browse the marketplace to get started." />
              ) : (
                <div className="space-y-8">
                  {/* Connected grouped by asset class */}
                  {Object.keys(connectedByAssetClass).length > 1 ? (
                    Object.entries(connectedByAssetClass).map(([acKey, acItems]) => {
                      const ac = ASSET_CLASS_MAP.get(acKey);
                      if (!ac) return null;
                      const connectedAcItems = acItems.filter((i) =>
                        connectedItems.some((ci) => ci.key === i.key)
                      );
                      if (connectedAcItems.length === 0) return null;
                      const Icon = ac.icon;
                      return (
                        <div key={acKey}>
                          <div className="flex items-center gap-2 mb-3">
                            <Icon className={`w-5 h-5 ${ac.color}`} />
                            <h2 className="text-lg font-semibold">{ac.label}</h2>
                            <Badge variant="secondary">{connectedAcItems.length}</Badge>
                          </div>
                          <IntegrationGrid
                            items={connectedAcItems}
                            viewMode={viewMode}
                            onConnect={handleConnect}
                            onDisconnect={(item) => disconnectMut.mutate(item.key)}
                            isConnecting={connectMut.isPending}
                            isDisconnecting={disconnectMut.isPending}
                            showDataFlow
                          />
                        </div>
                      );
                    })
                  ) : (
                    <IntegrationGrid
                      items={connectedItems}
                      viewMode={viewMode}
                      onConnect={handleConnect}
                      onDisconnect={(item) => disconnectMut.mutate(item.key)}
                      isConnecting={connectMut.isPending}
                      isDisconnecting={disconnectMut.isPending}
                      showDataFlow
                    />
                  )}
                </div>
              )}
            </TabsContent>

            {/* ============ AVAILABLE TAB ============ */}
            <TabsContent value="available">
              {availableItems.length === 0 ? (
                <EmptyState message="All available integrations are already connected!" />
              ) : (
                <IntegrationGrid
                  items={availableItems}
                  viewMode={viewMode}
                  onConnect={handleConnect}
                  onDisconnect={(item) => disconnectMut.mutate(item.key)}
                  isConnecting={connectMut.isPending}
                  isDisconnecting={disconnectMut.isPending}
                  recommendedKeys={new Set(recommendedItems.map((i) => i.key))}
                />
              )}
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Setup Wizard Dialog */}
      <IntegrationSetupWizard
        integration={selectedIntegration}
        open={apiKeyDialogOpen}
        onOpenChange={(open) => {
          setApiKeyDialogOpen(open);
          if (!open) {
            setSelectedIntegration(null);
            setApiKeyValue("");
          }
        }}
        onConnect={handleWizardConnect}
        isConnecting={connectMut.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recommended Section
// ---------------------------------------------------------------------------
function RecommendedSection({
  items,
  userAssetClasses,
  viewMode,
  onConnect,
  onDisconnect,
  isConnecting,
  isDisconnecting,
}: {
  items: IntegrationItem[];
  userAssetClasses: string[];
  viewMode: "grid" | "list";
  onConnect: (item: IntegrationItem) => void;
  onDisconnect: (item: IntegrationItem) => void;
  isConnecting?: boolean;
  isDisconnecting?: boolean;
}) {
  if (items.length === 0) return null;

  const assetLabels = userAssetClasses
    .map((ac) => ASSET_CLASS_MAP.get(ac)?.label)
    .filter(Boolean)
    .join(", ");

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-5 h-5 text-amber-500" />
        <h2 className="text-lg font-semibold">Recommended for Your Portfolio</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Based on your asset classes: {assetLabels || "your portfolio mix"}
      </p>
      <IntegrationGrid
        items={items.slice(0, 6)}
        viewMode={viewMode}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
        isConnecting={isConnecting}
        isDisconnecting={isDisconnecting}
        recommendedKeys={new Set(items.map((i) => i.key))}
      />
      {items.length > 6 && (
        <div className="mt-3 text-center">
          <Button variant="ghost" size="sm" className="text-amber-700">
            View all {items.length} recommendations
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------
function EmptyState({ message }: { message?: string }) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <Plug className="w-12 h-12 mx-auto mb-4 opacity-50" />
      <p className="text-lg font-medium mb-1">No integrations found</p>
      <p className="text-sm">{message || "Try adjusting your filters or search terms."}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Asset Class Badge
// ---------------------------------------------------------------------------
function AssetClassBadge({ assetClass }: { assetClass: string }) {
  const ac = ASSET_CLASS_MAP.get(assetClass);
  if (!ac) return null;
  const Icon = ac.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${ac.bgColor} ${ac.color}`}
    >
      <Icon className="w-2.5 h-2.5" />
      {ac.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Data Flow Indicator
// ---------------------------------------------------------------------------
function DataFlowIndicator({ item }: { item: IntegrationItem }) {
  const modules = useMemo(() => {
    if (!item.dataMappings || item.dataMappings.length === 0) return [];
    const mods = new Set(item.dataMappings.map((m) => m.targetModule));
    return Array.from(mods);
  }, [item.dataMappings]);

  const MODULE_LABELS: Record<string, string> = {
    rentRoll: "Rent Roll",
    financials: "Financials",
    bookkeeping: "Bookkeeping",
    crm: "CRM",
    analytics: "Analytics",
    service: "Service",
    documents: "Documents",
  };

  if (modules.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1">
      <span className="text-[10px] text-muted-foreground">Feeding into:</span>
      {modules.map((mod) => (
        <span
          key={mod}
          className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-medium"
        >
          {MODULE_LABELS[mod] || mod}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Integration Grid
// ---------------------------------------------------------------------------
function IntegrationGrid({
  items,
  viewMode,
  onConnect,
  onDisconnect,
  isConnecting,
  isDisconnecting,
  recommendedKeys,
  showDataFlow,
}: {
  items: IntegrationItem[];
  viewMode: "grid" | "list";
  onConnect: (item: IntegrationItem) => void;
  onDisconnect: (item: IntegrationItem) => void;
  isConnecting?: boolean;
  isDisconnecting?: boolean;
  recommendedKeys?: Set<string>;
  showDataFlow?: boolean;
}) {
  if (items.length === 0) {
    return <EmptyState />;
  }

  return (
    <div
      className={
        viewMode === "grid"
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          : "space-y-3"
      }
    >
      {items.map((item) => (
        <div key={item.key} className="relative">
          {/* Recommended badge */}
          {recommendedKeys?.has(item.key) && (
            <div className="absolute -top-2 -right-2 z-10">
              <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[10px] px-1.5 py-0.5 shadow-sm">
                <Star className="w-3 h-3 mr-0.5" />
                Recommended
              </Badge>
            </div>
          )}
          <IntegrationCard
            integration={item}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            isConnecting={isConnecting}
            isDisconnecting={isDisconnecting}
          />
          {/* Asset class badges + data flow below card content */}
          <div className="px-4 pb-3 -mt-2 space-y-1.5">
            {/* Asset class pills */}
            {(item.assetClasses ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {(item.assetClasses ?? []).slice(0, 4).map((ac) => (
                  <AssetClassBadge key={ac} assetClass={ac} />
                ))}
                {(item.assetClasses ?? []).length > 4 && (
                  <span className="text-[10px] text-muted-foreground px-1 py-0.5">
                    +{(item.assetClasses ?? []).length - 4} more
                  </span>
                )}
              </div>
            )}
            {/* Works-with tags for universal integrations */}
            {isUniversalIntegration(item) && (item.assetClasses ?? []).length === 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                <Sparkles className="w-2.5 h-2.5" />
                Works with all properties
              </span>
            )}
            {/* Data flow indicator for connected panel */}
            {showDataFlow && item.status === "connected" && <DataFlowIndicator item={item} />}
          </div>
        </div>
      ))}
    </div>
  );
}
