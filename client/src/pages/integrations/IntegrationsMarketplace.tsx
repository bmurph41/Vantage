import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plug, Search, Filter, Grid, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  
  const allCategories = [...new Set(items.flatMap((i) => i.categories))].sort();

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || item.categories.includes(categoryFilter);
    return matchesSearch && matchesCategory;
  });

  const connectedItems = filteredItems.filter((i) => i.status === "connected");
  const availableItems = filteredItems.filter((i) => i.status !== "connected");

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Plug className="w-8 h-8 text-[#1E4FAB]" />
          <h1 className="text-2xl font-bold">Integrations Marketplace</h1>
        </div>
        <p className="text-muted-foreground">
          Connect third-party tools and services to enhance your marina management workflow.
        </p>
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
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {allCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
              <IntegrationGrid
                items={filteredItems}
                viewMode={viewMode}
                onConnect={handleConnect}
                onDisconnect={(item) => disconnectMut.mutate(item.key)}
                isConnecting={connectMut.isPending}
                isDisconnecting={disconnectMut.isPending}
              />
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {selectedIntegration?.name}</DialogTitle>
            <DialogDescription>
              Enter your API key to connect this integration. Your key will be stored securely with encryption.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
