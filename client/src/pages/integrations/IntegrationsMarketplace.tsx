import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plug, Search, Grid, List, Anchor, Calendar, Wrench, MessageSquare, Calculator, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchIntegrations,
  connectIntegration,
  disconnectIntegration,
  type IntegrationItem,
} from "@/lib/api/integrations";

const CATEGORY_ORDER = [
  "Marina PMS",
  "Reservations & Booking",
  "Service & Maintenance",
  "Communications",
  "Accounting",
];

const CATEGORY_ICONS: Record<string, any> = {
  "Marina PMS": Anchor,
  "Reservations & Booking": Calendar,
  "Service & Maintenance": Wrench,
  "Communications": MessageSquare,
  "Accounting": Calculator,
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "Marina PMS": "Property management systems for slip inventory, tenants, and billing",
  "Reservations & Booking": "Online booking platforms and slip marketplaces",
  "Service & Maintenance": "Work orders, boat handling, and yard management",
  "Communications": "Tenant messaging, access control, and notifications",
  "Accounting": "Financial systems, invoicing, and payment processing",
};

export default function IntegrationsMarketplace() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationItem | null>(null);
  const [apiKeyValue, setApiKeyValue] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: fetchIntegrations,
  });

  const connectMut = useMutation({
    mutationFn: ({ key, payload }: { key: string; payload?: { apiKey?: string } }) =>
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
    if (item.authType === "apiKey") {
      setSelectedIntegration(item);
      setApiKeyDialogOpen(true);
      return;
    }
    connectMut.mutate({ key: item.key });
  }

  function handleApiKeySubmit() {
    if (!selectedIntegration || !apiKeyValue.trim()) return;
    connectMut.mutate({ key: selectedIntegration.key, payload: { apiKey: apiKeyValue } });
  }

  const items = data?.items ?? [];
  
  const allCategories = CATEGORY_ORDER.filter(cat => 
    items.some(i => i.category === cat)
  );

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const connectedItems = filteredItems.filter((i) => i.status === "connected");
  const availableItems = filteredItems.filter((i) => i.status !== "connected");

  const groupedByCategory = CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = filteredItems.filter(i => i.category === cat);
    return acc;
  }, {} as Record<string, IntegrationItem[]>);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1E4FAB] to-[#152d6b] flex items-center justify-center">
            <Plug className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Integrations Marketplace</h1>
            <p className="text-muted-foreground">
              Connect your marina software to consolidate operations in MarinaMatch
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search integrations..."
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

      <div className="flex flex-wrap gap-2 mb-6">
        <Button
          variant={categoryFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setCategoryFilter("all")}
          className={categoryFilter === "all" ? "bg-[#1E4FAB] hover:bg-[#1a4294]" : ""}
        >
          All ({items.length})
        </Button>
        {allCategories.map((cat) => {
          const Icon = CATEGORY_ICONS[cat] || Plug;
          const count = items.filter(i => i.category === cat).length;
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
            <TabsContent value="all">
              {categoryFilter === "all" ? (
                <div className="space-y-8">
                  {CATEGORY_ORDER.map((cat) => {
                    const catItems = groupedByCategory[cat] || [];
                    if (catItems.length === 0) return null;
                    const Icon = CATEGORY_ICONS[cat] || Plug;
                    return (
                      <div key={cat}>
                        <div className="flex items-center gap-2 mb-3">
                          <Icon className="w-5 h-5 text-[#1E4FAB]" />
                          <h2 className="text-lg font-semibold">{cat}</h2>
                          <span className="text-sm text-muted-foreground">
                            ({catItems.length})
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          {CATEGORY_DESCRIPTIONS[cat]}
                        </p>
                        <IntegrationGrid
                          items={catItems}
                          viewMode={viewMode}
                          onConnect={handleConnect}
                          onDisconnect={(item) => disconnectMut.mutate(item.key)}
                          isConnecting={connectMut.isPending}
                          isDisconnecting={disconnectMut.isPending}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <IntegrationGrid
                  items={filteredItems}
                  viewMode={viewMode}
                  onConnect={handleConnect}
                  onDisconnect={(item) => disconnectMut.mutate(item.key)}
                  isConnecting={connectMut.isPending}
                  isDisconnecting={disconnectMut.isPending}
                />
              )}
            </TabsContent>
            <TabsContent value="connected">
              <IntegrationGrid
                items={connectedItems}
                viewMode={viewMode}
                onConnect={handleConnect}
                onDisconnect={(item) => disconnectMut.mutate(item.key)}
                isConnecting={connectMut.isPending}
                isDisconnecting={disconnectMut.isPending}
              />
            </TabsContent>
            <TabsContent value="available">
              <IntegrationGrid
                items={availableItems}
                viewMode={viewMode}
                onConnect={handleConnect}
                onDisconnect={(item) => disconnectMut.mutate(item.key)}
                isConnecting={connectMut.isPending}
                isDisconnecting={disconnectMut.isPending}
              />
            </TabsContent>
          </>
        )}
      </Tabs>

      <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect {selectedIntegration?.name}</DialogTitle>
            <DialogDescription>
              Enter your API key to connect this integration. Your key will be stored securely with encryption.
            </DialogDescription>
          </DialogHeader>
          
          {selectedIntegration?.connectionGuide && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-sm">Quick Setup Guide</h4>
              <ol className="space-y-2">
                {selectedIntegration.connectionGuide.steps.slice(0, 3).map((step, idx) => (
                  <li key={idx} className="flex gap-2 text-sm">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#1E4FAB] text-white text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-muted-foreground">{step.description}</span>
                  </li>
                ))}
              </ol>
              <Link href={`/settings/integrations/${selectedIntegration.key}`}>
                <a className="text-sm text-[#1E4FAB] hover:underline flex items-center gap-1">
                  View full setup guide <ChevronRight className="w-3 h-3" />
                </a>
              </Link>
            </div>
          )}
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Enter your API key"
                value={apiKeyValue}
                onChange={(e) => setApiKeyValue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApiKeyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApiKeySubmit}
              disabled={!apiKeyValue.trim() || connectMut.isPending}
              className="bg-[#1E4FAB] hover:bg-[#1a4294]"
            >
              {connectMut.isPending ? "Connecting..." : "Connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IntegrationGrid({
  items,
  viewMode,
  onConnect,
  onDisconnect,
  isConnecting,
  isDisconnecting,
}: {
  items: IntegrationItem[];
  viewMode: "grid" | "list";
  onConnect: (item: IntegrationItem) => void;
  onDisconnect: (item: IntegrationItem) => void;
  isConnecting?: boolean;
  isDisconnecting?: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Plug className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No integrations found matching your criteria.</p>
      </div>
    );
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
        <IntegrationCard
          key={item.key}
          integration={item}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          isConnecting={isConnecting}
          isDisconnecting={isDisconnecting}
        />
      ))}
    </div>
  );
}
