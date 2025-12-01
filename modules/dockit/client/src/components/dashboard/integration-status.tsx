import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Ship, Anchor, Calendar, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Integration } from "@shared/schema";

export default function IntegrationStatus() {
  const { data: integrations = [], isLoading } = useQuery<Integration[]>({
    queryKey: ['/api/integrations'],
  });

  const getIcon = (platform: string) => {
    switch (platform) {
      case 'speedydock':
        return Ship;
      case 'dockwa':
        return Anchor;
      case 'snag_a_slip':
        return Calendar;
      default:
        return Ship;
    }
  };

  const getPlatformName = (platform: string) => {
    switch (platform) {
      case 'speedydock':
        return 'SpeedyDock';
      case 'dockwa':
        return 'Dockwa';
      case 'snag_a_slip':
        return 'Snag-a-Slip';
      default:
        return platform;
    }
  };

  const getDescription = (platform: string) => {
    switch (platform) {
      case 'speedydock':
        return 'Launch scheduling';
      case 'dockwa':
        return 'Reservations';
      case 'snag_a_slip':
        return 'Booking widget';
      default:
        return 'Integration';
    }
  };

  const getStatusColor = (syncStatus: string) => {
    switch (syncStatus) {
      case 'connected':
        return 'bg-accent';
      case 'disconnected':
        return 'bg-muted';
      case 'error':
        return 'bg-destructive';
      case 'pending':
        return 'bg-chart-4';
      default:
        return 'bg-muted';
    }
  };

  const getStatusText = (syncStatus: string) => {
    switch (syncStatus) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Error';
      case 'pending':
        return 'Pending';
      default:
        return syncStatus;
    }
  };

  const getStatusTextColor = (syncStatus: string) => {
    switch (syncStatus) {
      case 'connected':
        return 'text-accent';
      case 'disconnected':
        return 'text-muted-foreground';
      case 'error':
        return 'text-destructive';
      case 'pending':
        return 'text-chart-4';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Card data-testid="integration-status">
      <CardHeader>
        <h3 className="text-lg font-semibold">Platform Integrations</h3>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between animate-pulse">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-muted rounded-lg" />
                <div className="space-y-1">
                  <div className="h-4 bg-muted rounded w-20" />
                  <div className="h-3 bg-muted rounded w-16" />
                </div>
              </div>
            </div>
          ))
        ) : (
          integrations.map((integration) => {
            const Icon = getIcon(integration.platform);
            return (
              <div
                key={integration.id}
                className="flex items-center justify-between"
                data-testid={`integration-${integration.platform}`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-chart-1 rounded-lg flex items-center justify-center">
                    <Icon className="text-white" size={16} />
                  </div>
                  <div>
                    <p className="font-medium">{getPlatformName(integration.platform)}</p>
                    <p className="text-xs text-muted-foreground">
                      {getDescription(integration.platform)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 ${getStatusColor(integration.syncStatus || 'disconnected')} rounded-full`} />
                  <span className={`text-xs font-medium ${getStatusTextColor(integration.syncStatus || 'disconnected')}`}>
                    {getStatusText(integration.syncStatus || 'disconnected')}
                  </span>
                </div>
              </div>
            );
          })
        )}

        <div className="mt-6 pt-4 border-t border-border">
          <Button variant="secondary" className="w-full" data-testid="button-add-integration">
            <Plus size={16} className="mr-2" />
            Add Integration
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
