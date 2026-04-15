import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Plug, Search, CheckCircle, XCircle, RefreshCw, Settings, Clock, Zap, Map as MapIcon, Eye, EyeOff, Loader2, TestTube } from "lucide-react";
import { SiGooglemaps } from "react-icons/si";

function GoogleMapsCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);

  const { data: gmSettings, isLoading: gmLoading } = useQuery<{ configured: boolean; maskedKey: string | null }>({
    queryKey: ["/api/google-places/settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/google-places/settings");
      return res.json();
    },
  });

  const saveKey = useMutation({
    mutationFn: async (apiKey: string) => {
      const res = await apiRequest("POST", "/api/google-places/settings", { apiKey });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/google-places/settings"] });
      setApiKeyInput("");
      toast({ title: "Google API key saved", description: "The key has been encrypted and stored." });
    },
    onError: (err: unknown) => {
      toast({ title: "Failed to save key", description: err instanceof Error ? err.message : "Unexpected error", variant: "destructive" });
    },
  });

  const deleteKey = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/google-places/settings");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/google-places/settings"] });
      toast({ title: "Google API key removed" });
    },
  });

  const testKey = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/google-places/autocomplete?input=marina&types=establishment");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.predictions !== undefined) {
        toast({ title: "Connection successful", description: "Google Places API is working correctly." });
      } else {
        toast({ title: "Connection failed", description: data.error || "Unexpected response", variant: "destructive" });
      }
    },
    onError: (err: unknown) => {
      toast({ title: "Connection test failed", description: err instanceof Error ? err.message : "Unexpected error", variant: "destructive" });
    },
  });

  return (
    <Card className={gmSettings?.configured ? "border-green-200" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SiGooglemaps className="h-5 w-5 text-red-500" />
            <CardTitle className="text-base">Google Maps & Places</CardTitle>
          </div>
          {gmLoading ? (
            <Skeleton className="h-5 w-20" />
          ) : gmSettings?.configured ? (
            <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Connected</Badge>
          ) : (
            <Badge variant="outline">Not configured</Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          Enables address autocomplete and place search across the platform. Your API key is stored encrypted — it is never exposed to the browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {gmSettings?.configured ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">API Key:</span>
              <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{gmSettings.maskedKey}</code>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => testKey.mutate()} disabled={testKey.isPending}>
                {testKey.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <TestTube className="h-3 w-3 mr-1" />}
                Test Connection
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteKey.mutate()} disabled={deleteKey.isPending}>
                <XCircle className="h-3 w-3 mr-1" />Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label className="text-xs">Google API Key</Label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                placeholder="AIza..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="pr-9 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Requires <strong>Places API</strong> and <strong>Geocoding API</strong> enabled in Google Cloud Console.
            </p>
            <Button
              size="sm"
              className="w-full"
              onClick={() => saveKey.mutate(apiKeyInput)}
              disabled={!apiKeyInput || saveKey.isPending}
            >
              {saveKey.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <MapIcon className="h-3 w-3 mr-1" />}
              Save API Key
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function IntegrationsMarketplacePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [connectDialog, setConnectDialog] = useState<any>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  const { data: catalog, isLoading } = useQuery<any>({
    queryKey: ["/api/integrations-marketplace/catalog", category],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      const res = await apiRequest("GET", `/api/integrations-marketplace/catalog?${params}`);
      return res.json();
    },
  });

  const connect = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/integrations-marketplace/connect", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/integrations-marketplace"] });
      setConnectDialog(null);
      setCredentials({});
      toast({ title: "Integration connected" });
    },
  });

  const testConnection = useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await apiRequest("POST", `/api/integrations-marketplace/test/${connectionId}`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: data.connected ? "Connection successful" : "Connection failed", description: data.message, variant: data.connected ? "default" : "destructive" });
    },
  });

  const triggerSync = useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await apiRequest("POST", `/api/integrations-marketplace/sync/${connectionId}`);
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/integrations-marketplace"] });
      toast({ title: data.success ? "Sync complete" : "Sync failed", description: data.success ? `${data.totalRecords} records synced` : data.error });
    },
  });

  const disconnect = useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await apiRequest("DELETE", `/api/integrations-marketplace/connections/${connectionId}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/integrations-marketplace"] });
      toast({ title: "Disconnected" });
    },
  });

  const integrations = (catalog?.integrations || []).filter((i: any) =>
    !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.key.toLowerCase().includes(search.toLowerCase()),
  );
  const categories = catalog?.categories || [];
  const connected = integrations.filter((i: any) => i.isConnected);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Plug className="h-6 w-6" />Integrations</h1>
        <p className="text-muted-foreground">{catalog?.total || 0} available, {catalog?.connected || 0} connected</p>
      </div>

      {/* First-party platform integrations */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Platform Keys</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <GoogleMapsCard />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search integrations..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            {categories.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({integrations.length})</TabsTrigger>
          <TabsTrigger value="connected">Connected ({connected.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrations.map((integration: any) => (
                <Card key={integration.key} className={integration.isConnected ? "border-green-200" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{integration.name}</CardTitle>
                      {integration.isConnected ? (
                        <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Connected</Badge>
                      ) : (
                        <Badge variant="outline">Available</Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs">{integration.category}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{integration.description || "Connect and sync data"}</p>
                    {integration.isConnected ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Last sync: {integration.lastSyncAt ? new Date(integration.lastSyncAt).toLocaleString() : "Never"}</span>
                          {integration.lastSyncStatus && <Badge variant={integration.lastSyncStatus === "completed" ? "secondary" : "destructive"} className="text-[10px]">{integration.lastSyncStatus}</Badge>}
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => triggerSync.mutate(integration.connectionId)} disabled={triggerSync.isPending}>
                            <RefreshCw className={`h-3 w-3 mr-1 ${triggerSync.isPending ? "animate-spin" : ""}`} />Sync
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => testConnection.mutate(integration.connectionId)}>Test</Button>
                          <Button size="sm" variant="ghost" onClick={() => disconnect.mutate(integration.connectionId)}><XCircle className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" className="w-full" onClick={() => setConnectDialog(integration)}>
                        <Zap className="h-3 w-3 mr-1" />Connect
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="connected">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connected.map((integration: any) => (
              <Card key={integration.key} className="border-green-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">{integration.name}<Badge variant="default" className="bg-green-600 text-[10px]">Active</Badge></CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    <p>Last sync: {integration.lastSyncAt ? new Date(integration.lastSyncAt).toLocaleString() : "Never"}</p>
                    <p>Auto-sync: {integration.autoSyncEnabled ? `Every ${integration.syncFrequencyMinutes} min` : "Manual"}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => triggerSync.mutate(integration.connectionId)}>
                      <RefreshCw className="h-3 w-3 mr-1" />Sync Now
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => disconnect.mutate(integration.connectionId)}><XCircle className="h-3 w-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {connected.length === 0 && <p className="text-muted-foreground col-span-3 text-center py-8">No integrations connected yet</p>}
          </div>
        </TabsContent>
      </Tabs>

      {/* Connect Dialog */}
      {connectDialog && (
        <Dialog open onOpenChange={() => { setConnectDialog(null); setCredentials({}); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect {connectDialog.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{connectDialog.description}</p>
              {connectDialog.authType === "apiKey" && (
                <div><Label>API Key</Label><Input type="password" value={credentials.apiKey || ""} onChange={(e) => setCredentials({ ...credentials, apiKey: e.target.value })} placeholder="Enter API key" /></div>
              )}
              {connectDialog.authType === "oauth" && (
                <div><Label>Access Token</Label><Input type="password" value={credentials.accessToken || ""} onChange={(e) => setCredentials({ ...credentials, accessToken: e.target.value })} placeholder="Enter access token" /></div>
              )}
              <div><Label>Site ID / Account ID (optional)</Label><Input value={credentials.siteId || ""} onChange={(e) => setCredentials({ ...credentials, siteId: e.target.value })} placeholder="e.g., your-site-id" /></div>
              <div className="flex items-center justify-between">
                <Label>Enable auto-sync</Label>
                <Switch checked={!!credentials._autoSync} onCheckedChange={(v) => setCredentials({ ...credentials, _autoSync: v ? "true" : "" })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConnectDialog(null)}>Cancel</Button>
              <Button onClick={() => {
                const { _autoSync, ...creds } = credentials;
                connect.mutate({
                  integrationKey: connectDialog.key,
                  displayName: connectDialog.name,
                  credentials: creds,
                  autoSyncEnabled: !!_autoSync,
                });
              }} disabled={connect.isPending}>
                Connect
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
