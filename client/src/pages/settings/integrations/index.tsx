import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plug, Search, CheckCircle, XCircle, RefreshCw, Clock, Zap, Map as MapIcon,
  Eye, EyeOff, Loader2, TestTube, ExternalLink, AlertTriangle, Shield,
  ArrowRight, BookOpen, HelpCircle, Building2, Info,
} from "lucide-react";
import { SiGooglemaps, SiQuickbooks } from "react-icons/si";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(date: string | Date | null): string {
  if (!date) return "Never";
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── QuickBooks OAuth Card ─────────────────────────────────────────────────────

type QboStatus = {
  isConnected: boolean;
  isConfigured: boolean;
  companyName?: string;
  realmId?: string;
  lastSyncAt: string | null;
  tokenPersistenceEnabled: boolean;
  warnings: string[];
};

function QuickBooksCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [location] = useLocation();
  const [showConfirm, setShowConfirm] = useState(false);

  // Handle OAuth callback params in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("qb_connected");
    const error = params.get("qb_error");
    if (connected === "true") {
      toast({ title: "QuickBooks connected!", description: "Your account has been linked and is ready to sync." });
      qc.invalidateQueries({ queryKey: ["/api/quickbooks/status"] });
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    } else if (error) {
      const msgs: Record<string, string> = {
        authorization_denied: "You cancelled the QuickBooks authorization.",
        missing_params: "The OAuth callback was missing required parameters.",
        connection_failed: "Something went wrong connecting to QuickBooks. Please try again.",
      };
      toast({ title: "QuickBooks connection failed", description: msgs[error] || error, variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: status, isLoading } = useQuery<QboStatus>({
    queryKey: ["/api/quickbooks/status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/quickbooks/status");
      return res.json();
    },
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/quickbooks/auth-url");
      const { authUrl } = await res.json();
      return authUrl as string;
    },
    onSuccess: (authUrl) => {
      window.location.href = authUrl;
    },
    onError: () => {
      toast({ title: "Failed to start QuickBooks login", description: "Please try again or check your configuration.", variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/quickbooks/sync/general");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/quickbooks/status"] });
      toast({ title: "Sync complete", description: "QuickBooks data has been refreshed." });
    },
    onError: () => {
      toast({ title: "Sync failed", description: "Could not sync from QuickBooks. Check your connection.", variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/quickbooks/disconnect");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/quickbooks/status"] });
      setShowConfirm(false);
      toast({ title: "Disconnected from QuickBooks" });
    },
    onError: () => {
      toast({ title: "Disconnect failed", variant: "destructive" });
    },
  });

  const isConnected = status?.isConnected;
  const isConfigured = status?.isConfigured ?? true;

  return (
    <>
      <Card className={`relative overflow-hidden ${isConnected ? "border-green-200 dark:border-green-800" : ""}`}>
        {/* Color accent bar */}
        <div className={`absolute top-0 left-0 right-0 h-1 ${isConnected ? "bg-green-500" : "bg-[#2CA01C]"}`} />

        <CardHeader className="pb-3 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#2CA01C] flex items-center justify-center shrink-0">
                <SiQuickbooks className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-base">QuickBooks Online</CardTitle>
                <CardDescription className="text-xs">Accounting · Intuit</CardDescription>
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-5 w-24" />
            ) : isConnected ? (
              <Badge className="bg-green-600 text-white shrink-0">
                <CheckCircle className="h-3 w-3 mr-1" />Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="shrink-0">Not connected</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : isConnected ? (
            /* ── Connected state ── */
            <div className="space-y-3">
              {status?.companyName && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">{status.companyName}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Last sync: {timeAgo(status?.lastSyncAt ?? null)}
                </div>
                {status?.realmId && (
                  <div className="flex items-center gap-1 truncate">
                    <Shield className="h-3 w-3" />
                    <span className="truncate">Realm: {status.realmId}</span>
                  </div>
                )}
              </div>

              {status?.warnings && status.warnings.length > 0 && (
                <Alert className="py-2">
                  <AlertTriangle className="h-3 w-3" />
                  <AlertDescription className="text-xs">{status.warnings[0]}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                >
                  {syncMutation.isPending
                    ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    : <RefreshCw className="h-3 w-3 mr-1" />}
                  Sync Now
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setShowConfirm(true)}
                >
                  <XCircle className="h-3 w-3 mr-1" />Disconnect
                </Button>
              </div>
            </div>
          ) : (
            /* ── Not connected state ── */
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Sync your QuickBooks Online chart of accounts, P&L data, and actuals directly into Vantage financial models.
              </p>

              {!isConfigured && (
                <Alert className="py-2 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                  <AlertTriangle className="h-3 w-3 text-amber-600" />
                  <AlertDescription className="text-xs text-amber-700 dark:text-amber-400">
                    QuickBooks is not configured. Contact your administrator to enable this integration.
                  </AlertDescription>
                </Alert>
              )}

              {/* What you'll get */}
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">What connects</p>
                <ul className="space-y-1.5">
                  {["Chart of Accounts → Vantage COA mapping", "P&L reports → Financial model actuals", "Auto-sync on a schedule"].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Security note */}
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Shield className="h-3 w-3 mt-0.5 shrink-0 text-blue-500" />
                <span>Credentials are stored using AES-256 encryption. Vantage never shares your data.</span>
              </div>

              <Button
                className="w-full bg-[#2CA01C] hover:bg-[#248016] text-white"
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending || !isConfigured}
              >
                {connectMutation.isPending
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Redirecting…</>
                  : <><SiQuickbooks className="h-4 w-4 mr-2" />Connect with QuickBooks</>
                }
              </Button>

              <div className="flex items-center justify-center gap-4 text-xs">
                <a
                  href="https://quickbooks.intuit.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />Visit QuickBooks
                </a>
                <a
                  href="https://developer.intuit.com/app/developer/qbo/docs/develop"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <BookOpen className="h-3 w-3" />API Docs
                </a>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disconnect confirmation dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Disconnect QuickBooks?</DialogTitle>
            <DialogDescription>
              This will remove your QuickBooks connection. Existing synced data will remain in Vantage, but automatic syncing will stop until you reconnect.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
            >
              {disconnectMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Google Maps Card ──────────────────────────────────────────────────────────

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

  const isConnected = gmSettings?.configured;

  return (
    <Card className={`relative overflow-hidden ${isConnected ? "border-green-200 dark:border-green-800" : ""}`}>
      <div className={`absolute top-0 left-0 right-0 h-1 ${isConnected ? "bg-green-500" : "bg-blue-500"}`} />

      <CardHeader className="pb-3 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white border flex items-center justify-center shrink-0">
              <SiGooglemaps className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <CardTitle className="text-base">Google Maps & Places</CardTitle>
              <CardDescription className="text-xs">Mapping · Google</CardDescription>
            </div>
          </div>
          {gmLoading ? (
            <Skeleton className="h-5 w-24" />
          ) : isConnected ? (
            <Badge className="bg-green-600 text-white shrink-0">
              <CheckCircle className="h-3 w-3 mr-1" />Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0">Not configured</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {isConnected ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Address autocomplete and place search are active across the platform.
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground text-xs">API Key:</span>
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
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Enables address autocomplete and property place search. Requires a Google Cloud API key.
            </p>
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
            </div>
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

// ── Generic integration catalog card ─────────────────────────────────────────

function CatalogCard({
  integration,
  onConnect,
  onSync,
  onTest,
  onDisconnect,
  syncPending,
}: {
  integration: any;
  onConnect: (i: any) => void;
  onSync: (id: string) => void;
  onTest: (id: string) => void;
  onDisconnect: (id: string) => void;
  syncPending: boolean;
}) {
  const isConnected = integration.isConnected;
  return (
    <Card className={`relative overflow-hidden ${isConnected ? "border-green-200 dark:border-green-800" : ""}`}>
      <div className={`absolute top-0 left-0 right-0 h-1 ${isConnected ? "bg-green-500" : "bg-border"}`} />
      <CardHeader className="pb-2 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm leading-tight">{integration.name}</CardTitle>
            <CardDescription className="text-xs mt-0.5">{integration.category}</CardDescription>
          </div>
          {isConnected ? (
            <Badge className="bg-green-600 text-white shrink-0 text-[10px]">
              <CheckCircle className="h-2.5 w-2.5 mr-1" />Active
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 text-[10px]">Available</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground line-clamp-2">{integration.description || "Connect and sync data with Vantage."}</p>
        {isConnected ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0" />
              <span>Synced {timeAgo(integration.lastSyncAt)}</span>
              {integration.lastSyncStatus && (
                <Badge
                  variant={integration.lastSyncStatus === "completed" ? "secondary" : "destructive"}
                  className="text-[10px] ml-auto"
                >
                  {integration.lastSyncStatus}
                </Badge>
              )}
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => onSync(integration.connectionId)} disabled={syncPending}>
                <RefreshCw className={`h-3 w-3 mr-1 ${syncPending ? "animate-spin" : ""}`} />Sync
              </Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => onTest(integration.connectionId)}>
                <TestTube className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive text-xs" onClick={() => onDisconnect(integration.connectionId)}>
                <XCircle className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" className="w-full text-xs" onClick={() => onConnect(integration)}>
            <Zap className="h-3 w-3 mr-1" />Connect
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── Connect dialog ─────────────────────────────────────────────────────────────

function ConnectDialog({
  integration,
  onClose,
  onConnect,
  isPending,
}: {
  integration: any;
  onClose: () => void;
  onConnect: (data: any) => void;
  isPending: boolean;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [autoSync, setAutoSync] = useState(false);

  const credFields = integration.authType === "apiKey"
    ? [{ key: "apiKey", label: "API Key", placeholder: "Enter your API key", secret: true }]
    : integration.authType === "oauth"
      ? [{ key: "accessToken", label: "Access Token", placeholder: "Enter your access token", secret: true }]
      : [];

  const hasRequired = credFields.every(f => !!credentials[f.key]);

  function handleSubmit() {
    onConnect({
      integrationKey: integration.key,
      displayName: integration.name,
      credentials,
      autoSyncEnabled: autoSync,
    });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Plug className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Connect {integration.name}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{integration.category}</p>
            </div>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-2">
            <div className={`h-1.5 flex-1 rounded-full transition-colors ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
            <div className={`h-1.5 flex-1 rounded-full transition-colors ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
            <span className="text-xs text-muted-foreground whitespace-nowrap">Step {step} of 2</span>
          </div>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">{integration.description || "Enter your credentials to connect."}</p>

            {credFields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label className="text-sm">{field.label}</Label>
                <Input
                  type={field.secret ? "password" : "text"}
                  placeholder={field.placeholder}
                  value={credentials[field.key] || ""}
                  onChange={(e) => setCredentials(prev => ({ ...prev, [field.key]: e.target.value }))}
                  className="font-mono text-sm"
                />
              </div>
            ))}

            <div className="space-y-1.5">
              <Label className="text-sm">Account / Site ID <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                placeholder="e.g., your-site-id"
                value={credentials.siteId || ""}
                onChange={(e) => setCredentials(prev => ({ ...prev, siteId: e.target.value }))}
              />
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-start gap-2">
                <HelpCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Need help finding your credentials?</p>
                  {integration.helpUrl && (
                    <a href={integration.helpUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                      <ExternalLink className="h-3 w-3" />View {integration.name} documentation
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 p-3">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium text-sm mb-2">
                <CheckCircle className="h-4 w-4" />Ready to connect
              </div>
              {credFields.map((field) => (
                <div key={field.key} className="flex items-center justify-between text-sm py-1">
                  <span className="text-muted-foreground">{field.label}:</span>
                  <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                    {"•".repeat(Math.max(0, (credentials[field.key]?.length || 8) - 4)) + (credentials[field.key]?.slice(-4) || "••••")}
                  </code>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable auto-sync</p>
                <p className="text-xs text-muted-foreground">Keep data fresh automatically</p>
              </div>
              <Switch checked={autoSync} onCheckedChange={setAutoSync} />
            </div>

            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Info className="h-4 w-4 text-blue-500" />What happens next?
              </div>
              <ul className="space-y-1">
                {["Your credentials will be securely encrypted", `We'll verify the connection to ${integration.name}`, "Data sync will begin automatically"].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-primary" />{item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Shield className="h-3 w-3 mt-0.5 shrink-0 text-blue-500" />
              Your credentials are stored securely using industry-standard encryption. Vantage never shares your data with third parties.
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => setStep(2)} disabled={credFields.length > 0 && !hasRequired}>
                Review <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={handleSubmit} disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Connect
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function IntegrationsMarketplacePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [connectDialog, setConnectDialog] = useState<any>(null);

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
      toast({ title: "Integration connected", description: "Your integration is live and syncing." });
    },
    onError: () => {
      toast({ title: "Connection failed", description: "Check your credentials and try again.", variant: "destructive" });
    },
  });

  const testConnection = useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await apiRequest("POST", `/api/integrations-marketplace/test/${connectionId}`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.connected ? "Connection verified" : "Connection failed",
        description: data.message,
        variant: data.connected ? "default" : "destructive",
      });
    },
  });

  const triggerSync = useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await apiRequest("POST", `/api/integrations-marketplace/sync/${connectionId}`);
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/integrations-marketplace"] });
      toast({
        title: data.success ? "Sync complete" : "Sync failed",
        description: data.success ? `${data.totalRecords ?? 0} records synced` : data.error,
        variant: data.success ? "default" : "destructive",
      });
    },
  });

  const disconnect = useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await apiRequest("DELETE", `/api/integrations-marketplace/connections/${connectionId}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/integrations-marketplace"] });
      toast({ title: "Integration disconnected" });
    },
  });

  // Filter out QBO from generic catalog — it has its own dedicated card
  const allIntegrations: any[] = (catalog?.integrations || []).filter(
    (i: any) => !i.key?.toLowerCase().includes("quickbooks") && !search
      ? true
      : !i.key?.toLowerCase().includes("quickbooks") && i.name.toLowerCase().includes(search.toLowerCase()),
  );

  const filteredIntegrations = allIntegrations.filter((i: any) =>
    !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.key?.toLowerCase().includes(search.toLowerCase()),
  );

  const categories: string[] = catalog?.categories || [];
  const connected = filteredIntegrations.filter((i: any) => i.isConnected);
  const totalConnected = (catalog?.connected || 0);

  return (
    <div className="space-y-8 p-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Plug className="h-6 w-6" />Integrations
        </h1>
        <p className="text-muted-foreground mt-1">
          Connect your tools to keep financial data in sync — {totalConnected} active connection{totalConnected !== 1 ? "s" : ""}.
        </p>
      </div>

      {/* ── First-party / OAuth integrations ── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Accounting & Finance
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickBooksCard />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Platform Keys
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <GoogleMapsCard />
        </div>
      </div>

      <Separator />

      {/* ── Third-party catalog ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              All Integrations
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {catalog?.total || 0} available · {connected.length} connected
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search integrations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All categories</SelectItem>
              {categories.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({filteredIntegrations.length})</TabsTrigger>
            <TabsTrigger value="connected">Connected ({connected.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40" />)}
              </div>
            ) : filteredIntegrations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Plug className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{search ? `No integrations match "${search}"` : "No integrations available"}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredIntegrations.map((integration: any) => (
                  <CatalogCard
                    key={integration.key}
                    integration={integration}
                    onConnect={setConnectDialog}
                    onSync={(id) => triggerSync.mutate(id)}
                    onTest={(id) => testConnection.mutate(id)}
                    onDisconnect={(id) => disconnect.mutate(id)}
                    syncPending={triggerSync.isPending}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="connected" className="mt-4">
            {connected.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No catalog integrations connected yet.</p>
                <p className="text-xs mt-1">Check the Accounting & Finance section above for QuickBooks.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {connected.map((integration: any) => (
                  <CatalogCard
                    key={integration.key}
                    integration={integration}
                    onConnect={setConnectDialog}
                    onSync={(id) => triggerSync.mutate(id)}
                    onTest={(id) => testConnection.mutate(id)}
                    onDisconnect={(id) => disconnect.mutate(id)}
                    syncPending={triggerSync.isPending}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Connect dialog */}
      {connectDialog && (
        <ConnectDialog
          integration={connectDialog}
          onClose={() => setConnectDialog(null)}
          onConnect={(data) => connect.mutate(data)}
          isPending={connect.isPending}
        />
      )}
    </div>
  );
}
