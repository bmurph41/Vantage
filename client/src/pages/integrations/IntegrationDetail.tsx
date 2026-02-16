import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { 
  ArrowLeft, ExternalLink, Check, AlertCircle, Plug, Clock, 
  BookOpen, ArrowRight, Database, RefreshCw, Download, Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/integrations/StatusBadge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchIntegration,
  connectIntegration,
  disconnectIntegration,
  updateIntegrationSettings,
  type IntegrationItem,
} from "@/lib/api/integrations";

export default function IntegrationDetail() {
  const [, params] = useRoute("/settings/integrations/:key");
  const [, setLocation] = useLocation();
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
      <div className="p-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!integration) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-center">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-xl font-semibold mb-2">Integration Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The integration you're looking for doesn't exist.
        </p>
        <Button variant="outline" onClick={() => setLocation("/settings/integrations")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Marketplace
        </Button>
      </div>
    );
  }

  const isConnected = integration.status === "connected";
  const settings = { ...integration.settings, ...localSettings };
  const settingsFields = integration.settingsSchema?.fields || [];
  const guide = integration.connectionGuide;
  const mappings = integration.dataMappings || [];
  const migration = integration.migrationSupport;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/settings/integrations" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to Marketplace
      </Link>

      <div className="flex items-start gap-4 mb-6">
        <div 
          className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#1E4FAB] to-[#152d6b] flex items-center justify-center text-white font-bold text-2xl"
          style={integration.logoColor ? { background: integration.logoColor } : undefined}
        >
          {integration.name.charAt(0)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{integration.name}</h1>
            <StatusBadge status={integration.status} />
          </div>
          <p className="text-muted-foreground mt-1">{integration.description}</p>
          <div className="flex items-center gap-4 mt-2">
            {integration.websiteUrl && (
              <a
                href={integration.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-[#1E4FAB] hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Visit Website
              </a>
            )}
            {guide?.supportUrl && (
              <a
                href={guide.supportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
              >
                <BookOpen className="w-3 h-3" />
                Support
              </a>
            )}
            {guide?.estimatedTime && (
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="w-3 h-3" />
                Setup: {guide.estimatedTime}
              </span>
            )}
          </div>
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
                ? "Connect with OAuth"
                : integration.authType === "apiKey"
                ? "Add API Key"
                : "Enable"}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue={isConnected ? "settings" : "guide"} className="space-y-6">
        <TabsList>
          <TabsTrigger value="guide">Setup Guide</TabsTrigger>
          <TabsTrigger value="settings" disabled={!isConnected}>Settings</TabsTrigger>
          <TabsTrigger value="data">Data Sync</TabsTrigger>
          <TabsTrigger value="migration">Migration</TabsTrigger>
        </TabsList>

        <TabsContent value="guide" className="space-y-6">
          {guide ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>How to Connect</CardTitle>
                  <CardDescription>{guide.overview}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {guide.prerequisites.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Prerequisites</h4>
                      <ul className="space-y-1">
                        {guide.prerequisites.map((prereq, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                            {prereq}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <h4 className="font-medium mb-3">Step-by-Step Instructions</h4>
                    <ol className="space-y-4">
                      {guide.steps.map((step, idx) => (
                        <li key={idx} className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#1E4FAB] text-white text-sm flex items-center justify-center font-medium">
                            {idx + 1}
                          </span>
                          <div>
                            <h5 className="font-medium">{step.title}</h5>
                            <p className="text-sm text-muted-foreground mt-0.5">{step.description}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {!isConnected && (
                    <div className="pt-4 border-t">
                      <Button
                        onClick={handleConnect}
                        disabled={connectMut.isPending}
                        className="bg-[#1E4FAB] hover:bg-[#1a4294]"
                      >
                        {connectMut.isPending ? "Connecting..." : "Connect Now"}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {guide.apiDocsUrl && (
                <Card>
                  <CardHeader>
                    <CardTitle>API Documentation</CardTitle>
                    <CardDescription>
                      For developers: detailed API reference and advanced configuration
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <a
                      href={guide.apiDocsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-[#1E4FAB] hover:underline"
                    >
                      <BookOpen className="w-4 h-4" />
                      View API Documentation
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Follow the integration provider's documentation to complete setup. Configuration details will appear here once connected.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          {isConnected && settingsFields.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Integration Settings</CardTitle>
                <CardDescription>
                  Configure how this integration syncs with your MarinaMatch account.
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
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Plug className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{isConnected ? "No additional settings available." : "Connect the integration to configure settings."}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Data Synchronization</CardTitle>
              <CardDescription>
                How data flows between {integration.name} and MarinaMatch
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mappings.length > 0 ? (
                <div className="space-y-4">
                  {mappings.map((mapping, idx) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{mapping.sourceEntity}</span>
                        </div>
                        {mapping.syncDirection === "read" ? (
                          <ArrowRight className="w-4 h-4 text-green-600" />
                        ) : mapping.syncDirection === "write" ? (
                          <ArrowLeft className="w-4 h-4 text-blue-600" />
                        ) : (
                          <RefreshCw className="w-4 h-4 text-purple-600" />
                        )}
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{mapping.targetModule} / {mapping.targetEntity}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          {mapping.syncDirection === "read" && <Download className="w-3 h-3" />}
                          {mapping.syncDirection === "write" && <Upload className="w-3 h-3" />}
                          {mapping.syncDirection === "bidirectional" && <RefreshCw className="w-3 h-3" />}
                          {mapping.syncDirection === "read" ? "Import from" : mapping.syncDirection === "write" ? "Export to" : "Sync with"} {integration.name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {mapping.frequency}
                        </span>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        Fields: {mapping.fields.map(f => f.target).join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Data mapping configuration will be available once the integration is connected and syncing.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Capabilities</CardTitle>
              <CardDescription>
                What this integration can do when connected.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {integration.capabilities.dataRead.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Download className="w-4 h-4 text-green-600" />
                      Data Import (Read)
                    </h4>
                    <ul className="space-y-1">
                      {integration.capabilities.dataRead.map((cap) => (
                        <li key={cap} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="w-3 h-3 text-green-600" />
                          {cap.replace(/\./g, " > ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {integration.capabilities.dataWrite.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Upload className="w-4 h-4 text-blue-600" />
                      Data Export (Write)
                    </h4>
                    <ul className="space-y-1">
                      {integration.capabilities.dataWrite.map((cap) => (
                        <li key={cap} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="w-3 h-3 text-blue-600" />
                          {cap.replace(/\./g, " > ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="migration" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Migration to MarinaMatch</CardTitle>
              <CardDescription>
                Transition your operations from {integration.name} to MarinaMatch as your central system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {migration ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-[#1E4FAB]">{migration.estimatedMigrationDays}</div>
                      <div className="text-sm text-muted-foreground">Days to migrate</div>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <div className={`text-2xl font-bold ${
                        migration.migrationComplexity === "low" ? "text-green-600" :
                        migration.migrationComplexity === "medium" ? "text-yellow-600" : "text-red-600"
                      }`}>
                        {migration.migrationComplexity.charAt(0).toUpperCase() + migration.migrationComplexity.slice(1)}
                      </div>
                      <div className="text-sm text-muted-foreground">Complexity</div>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <div className={`text-2xl font-bold ${migration.canExportAll ? "text-green-600" : "text-muted-foreground"}`}>
                        {migration.canExportAll ? "Yes" : "Partial"}
                      </div>
                      <div className="text-sm text-muted-foreground">Full Export</div>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <div className={`text-2xl font-bold ${migration.supportsHistoricalImport ? "text-green-600" : "text-muted-foreground"}`}>
                        {migration.supportsHistoricalImport ? "Yes" : "No"}
                      </div>
                      <div className="text-sm text-muted-foreground">History Import</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Migration Phases</h4>
                    <ol className="space-y-3">
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white text-sm flex items-center justify-center">1</span>
                        <div>
                          <h5 className="font-medium">Connect & Sync</h5>
                          <p className="text-sm text-muted-foreground">Import all data from {integration.name} into MarinaMatch. Validate data parity.</p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-600 text-white text-sm flex items-center justify-center">2</span>
                        <div>
                          <h5 className="font-medium">Dual-Write Period</h5>
                          <p className="text-sm text-muted-foreground">Run both systems in parallel. Use MarinaMatch as primary while keeping {integration.name} updated.</p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center">3</span>
                        <div>
                          <h5 className="font-medium">Cutover</h5>
                          <p className="text-sm text-muted-foreground">Switch to MarinaMatch as your system of record. Put {integration.name} in read-only mode.</p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#1E4FAB] text-white text-sm flex items-center justify-center">4</span>
                        <div>
                          <h5 className="font-medium">Archive & Decommission</h5>
                          <p className="text-sm text-muted-foreground">Export final records, archive for compliance, and cancel your {integration.name} subscription.</p>
                        </div>
                      </li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Migration planning tools will be available once data sources are configured.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {integration.category && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Category</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="px-3 py-1 bg-muted rounded-full text-sm">
              {integration.category}
            </span>
          </CardContent>
        </Card>
      )}

      {integration.lastSyncAt && (
        <Card className="mt-6">
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
        <Card className="mt-6 border-red-200 bg-red-50 dark:bg-red-950/20">
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

      <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect {integration.name}</DialogTitle>
            <DialogDescription>
              Enter your API key to connect this integration.
            </DialogDescription>
          </DialogHeader>
          
          {guide && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-sm">Where to find your API key:</h4>
              <ol className="space-y-2">
                {guide.steps.filter(s => 
                  s.title.toLowerCase().includes("api") || 
                  s.description.toLowerCase().includes("api")
                ).slice(0, 2).map((step, idx) => (
                  <li key={idx} className="flex gap-2 text-sm">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#1E4FAB] text-white text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-muted-foreground">{step.description}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          
          <div className="space-y-4 py-2">
            {settingsFields.filter(f => f.required && f.type !== "select").map(field => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  type={field.type === "secret" ? "password" : "text"}
                  placeholder={field.helpText || `Enter ${field.label}`}
                />
                {field.helpText && (
                  <p className="text-xs text-muted-foreground">{field.helpText}</p>
                )}
              </div>
            ))}
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
