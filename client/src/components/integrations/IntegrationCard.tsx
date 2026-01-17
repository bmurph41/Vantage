import { Link } from "wouter";
import { ExternalLink, Settings, Clock, ArrowRight } from "lucide-react";
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
  const logoStyle = integration.logoColor 
    ? { background: integration.logoColor }
    : undefined;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1E4FAB] to-[#152d6b] flex items-center justify-center text-white font-semibold text-sm"
              style={logoStyle}
            >
              {integration.name.charAt(0)}
            </div>
            <div>
              <Link href={`/settings/integrations/${integration.key}`}>
                <a className="hover:underline">
                  <CardTitle className="text-base">{integration.name}</CardTitle>
                </a>
              </Link>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={integration.status} />
                {integration.connectionGuide?.estimatedTime && !isConnected && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {integration.connectionGuide.estimatedTime}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <CardDescription className="text-sm line-clamp-2">{integration.description}</CardDescription>

        {integration.category && (
          <div className="flex flex-wrap gap-1">
            <span className="px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground">
              {integration.category}
            </span>
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
