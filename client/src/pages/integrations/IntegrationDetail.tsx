import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ArrowLeft, ExternalLink, Check, AlertCircle, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/integrations/StatusBadge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  fetchIntegration,
  connectIntegration,
  disconnectIntegration,
  updateIntegrationSettings,
  type IntegrationItem,
} from "@/lib/api/integrations";

export default function IntegrationDetail() {
  const [, params] = useRoute("/settings/integrations/:key");
  const key = params?.key || "";
  const qc = useQueryClient();
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [localSettings, setLocalSettings] = useState<Record<string, any>>({});

  const { data: integration, isLoading } = useQuery({
    queryKey: ["integration", key],
    queryFn: () => fetchIntegration(key),
    enabled: !!key,
  });

  const connectMut = useMutation({
    mutationFn: (payload?: { apiKey?: string }) => connectIntegration(key, payload),
    onSuccess: async (resp) => {
      if (resp?.authorizeUrl) {
        window.location.href = resp.authorizeUrl;
        return;
      }
      await qc.invalidateQueries({ queryKey: ["integration", key] });
      await qc.invalidateQueries({ queryKey: ["integrations"] });
      setApiKeyDialogOpen(false);
      setApiKeyValue("");
    },
  });

  const disconnectMut = useMutation({
    mutationFn: () => disconnectIntegration(key),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["integration", key] });
      await qc.invalidateQueries({ queryKey: ["integrations"] });
    },
  });

  const updateSettingsMut = useMutation({
    mutationFn: (settings: Record<string, any>) => updateIntegrationSettings(key, settings),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["integration", key] });
    },
  });

  function handleConnect() {
    if (integration?.authType === "apiKey") {
      setApiKeyDialogOpen(true);
      return;
    }
    connectMut.mutate();
  }

  function handleApiKeySubmit() {
    if (!apiKeyValue.trim()) return;
    connectMut.mutate({ apiKey: apiKeyValue });
  }

  function handleSettingChange(fieldKey: string, value: any) {
    const newSettings = { ...localSettings, [fieldKey]: value };
    setLocalSettings(newSettings);
    updateSettingsMut.mutate({ [fieldKey]: value });
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!integration) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-xl font-semibold mb-2">Integration Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The integration you're looking for doesn't exist.
        </p>
        <Link href="/settings/integrations">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Marketplace
          </Button>
        </Link>
      </div>
    );
  }

  const isConnected = integration.status === "connected";
  const settings = { ...integration.settings, ...localSettings };
  const settingsFields = integration.settingsSchema?.fields || [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/settings/integrations">
        <a className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Marketplace
        </a>
      </Link>

      <div className="flex items-start gap-4 mb-6">
        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#1E4FAB] to-[#152d6b] flex items-center justify-center text-white font-bold text-2xl">
          {integration.name.charAt(0)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{integration.name}</h1>
            <StatusBadge status={integration.status} />
          </div>
          <p className="text-muted-foreground mt-1">{integration.description}</p>
          {integration.websiteUrl && (
            <a
              href={integration.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-[#1E4FAB] hover:underline mt-2"
            >
              <ExternalLink className="w-3 h-3" />
              Visit Website
            </a>
          )}
        </div>
        <div>
          {isConnected ? (
            <Button
              variant="outline"
              onClick={() => disconnectMut.mutate()}
              disabled={disconnectMut.isPending}
            >
              {disconnectMut.isPending ? "Disconnecting..." : "Disconnect"}
            </Button>
          ) : (
            <Button
              onClick={handleConnect}
              disabled={connectMut.isPending}
              className="bg-[#1E4FAB] hover:bg-[#1a4294]"
            >
              {connectMut.isPending
                ? "Connecting..."
                : integration.authType === "oauth"
                ? "Connect"
                : integration.authType === "apiKey"
                ? "Add API Key"
                : "Enable"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {isConnected && settingsFields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
                <CardDescription>
                  Configure how this integration works with your account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {settingsFields
                  .filter((f) => f.type !== "secret")
                  .map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={field.key}>{field.label}</Label>
                      {field.type === "select" && field.options ? (
                        <Select
                          value={settings[field.key] || ""}
                          onValueChange={(v) => handleSettingChange(field.key, v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={`Select ${field.label}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : field.type === "boolean" ? (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={settings[field.key] || false}
                            onCheckedChange={(v) => handleSettingChange(field.key, v)}
                          />
                          <span className="text-sm text-muted-foreground">
                            {settings[field.key] ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                      ) : (
                        <Input
                          id={field.key}
                          type={field.type === "number" ? "number" : "text"}
                          value={settings[field.key] || ""}
                          onChange={(e) => handleSettingChange(field.key, e.target.value)}
                          placeholder={field.helpText}
                        />
                      )}
                      {field.helpText && (
                        <p className="text-xs text-muted-foreground">{field.helpText}</p>
                      )}
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Capabilities</CardTitle>
              <CardDescription>
                What this integration can do when connected.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {integration.capabilities.dataRead.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Data Access (Read)</h4>
                    <ul className="space-y-1">
                      {integration.capabilities.dataRead.map((cap) => (
                        <li key={cap} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="w-4 h-4 text-green-600" />
                          {cap.replace(/\./g, " > ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {integration.capabilities.dataWrite.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Data Access (Write)</h4>
                    <ul className="space-y-1">
                      {integration.capabilities.dataWrite.map((cap) => (
                        <li key={cap} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="w-4 h-4 text-blue-600" />
                          {cap.replace(/\./g, " > ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {integration.capabilities.actions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Actions</h4>
                    <ul className="space-y-1">
                      {integration.capabilities.actions.map((cap) => (
                        <li key={cap} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Plug className="w-4 h-4 text-[#1E4FAB]" />
                          {cap.replace(/\./g, " > ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {integration.categories.map((cat) => (
                  <span
                    key={cat}
                    className="px-3 py-1 bg-muted rounded-full text-sm"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {integration.lastSyncAt && (
            <Card>
              <CardHeader>
                <CardTitle>Sync Status</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Last synced: {new Date(integration.lastSyncAt).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          )}

          {integration.errorMessage && (
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
              <CardHeader>
                <CardTitle className="text-red-700 dark:text-red-400">Error</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-red-600 dark:text-red-400">
                  {integration.errorMessage}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {integration.name}</DialogTitle>
            <DialogDescription>
              Enter your API key to connect this integration.
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
