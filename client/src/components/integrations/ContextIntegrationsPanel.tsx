import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Plug, ExternalLink, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import {
  fetchIntegrationsForContext,
  connectIntegration,
  disconnectIntegration,
  type IntegrationItem,
} from "@/lib/api/integrations";

interface ContextIntegrationsPanelProps {
  contextKey: string;
  title?: string;
  description?: string;
}

export function ContextIntegrationsPanel({
  contextKey,
  title = "Integrations",
  description = "Connect tools that enhance this section.",
}: ContextIntegrationsPanelProps) {
  const qc = useQueryClient();
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationItem | null>(null);
  const [apiKeyValue, setApiKeyValue] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["integrationsContext", contextKey],
    queryFn: () => fetchIntegrationsForContext(contextKey),
  });

  const connectMut = useMutation({
    mutationFn: ({ key, payload }: { key: string; payload?: { apiKey?: string } }) =>
      connectIntegration(key, payload),
    onSuccess: async (resp, vars) => {
      if (resp?.authorizeUrl) {
        window.location.href = resp.authorizeUrl;
        return;
      }
      await qc.invalidateQueries({ queryKey: ["integrationsContext", contextKey] });
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
      await qc.invalidateQueries({ queryKey: ["integrationsContext", contextKey] });
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Plug className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <Skeleton className="h-4 w-48 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const items = data?.items ?? [];
  const connected = items.filter((i) => i.status === "connected");
  const available = items.filter((i) => i.status !== "connected");

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Plug className="w-4 h-4 text-[#1E4FAB]" />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <CardDescription className="text-sm">{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {connected.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Connected
              </div>
              <div className="space-y-2">
                {connected.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-start justify-between gap-3 border rounded-lg p-3 bg-green-50/50 dark:bg-green-950/20"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{item.name}</span>
                        <StatusBadge status="connected" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => disconnectMut.mutate(item.key)}
                      disabled={disconnectMut.isPending}
                      className="text-xs"
                    >
                      Disconnect
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {available.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Available
              </div>
              <div className="space-y-2">
                {available.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-start justify-between gap-3 border rounded-lg p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{item.name}</span>
                        {item.websiteUrl && (
                          <a
                            href={item.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleConnect(item)}
                      disabled={connectMut.isPending}
                      className="text-xs bg-[#1E4FAB] hover:bg-[#1a4294]"
                    >
                      {item.authType === "oauth"
                        ? "Connect"
                        : item.authType === "apiKey"
                        ? "Add Key"
                        : "Enable"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {items.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">
              No integrations available for this section.
            </div>
          )}

          <div className="pt-2 border-t">
            <Link href="/settings/integrations">
              <a className="text-sm text-[#1E4FAB] hover:underline flex items-center gap-1">
                View all integrations
                <ChevronRight className="w-4 h-4" />
              </a>
            </Link>
          </div>
        </CardContent>
      </Card>

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
    </>
  );
}
