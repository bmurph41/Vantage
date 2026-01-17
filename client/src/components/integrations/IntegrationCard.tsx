import { ExternalLink, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "./StatusBadge";
import type { IntegrationItem } from "@/lib/api/integrations";

interface IntegrationCardProps {
  integration: IntegrationItem;
  onConnect: (integration: IntegrationItem) => void;
  onDisconnect: (integration: IntegrationItem) => void;
  onSettings?: (integration: IntegrationItem) => void;
  isConnecting?: boolean;
  isDisconnecting?: boolean;
}

export function IntegrationCard({
  integration,
  onConnect,
  onDisconnect,
  onSettings,
  isConnecting,
  isDisconnecting,
}: IntegrationCardProps) {
  const isConnected = integration.status === "connected";

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1E4FAB] to-[#152d6b] flex items-center justify-center text-white font-semibold text-sm">
              {integration.name.charAt(0)}
            </div>
            <div>
              <CardTitle className="text-base">{integration.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={integration.status} />
                {integration.websiteUrl && (
                  <a
                    href={integration.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Website
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <CardDescription className="text-sm">{integration.description}</CardDescription>

        {integration.categories && integration.categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {integration.categories.map((cat) => (
              <span
                key={cat}
                className="px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground"
              >
                {cat}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          {isConnected ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDisconnect(integration)}
                disabled={isDisconnecting}
              >
                {isDisconnecting ? "Disconnecting..." : "Disconnect"}
              </Button>
              {onSettings && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSettings(integration)}
                >
                  <Settings className="w-4 h-4 mr-1" />
                  Settings
                </Button>
              )}
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => onConnect(integration)}
              disabled={isConnecting}
              className="bg-[#1E4FAB] hover:bg-[#1a4294]"
            >
              {isConnecting
                ? "Connecting..."
                : integration.authType === "oauth"
                ? "Connect"
                : integration.authType === "apiKey"
                ? "Add API Key"
                : "Enable"}
            </Button>
          )}
        </div>

        {integration.errorMessage && (
          <p className="text-xs text-red-600 mt-2">{integration.errorMessage}</p>
        )}

        {integration.lastSyncAt && (
          <p className="text-xs text-muted-foreground">
            Last synced: {new Date(integration.lastSyncAt).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
