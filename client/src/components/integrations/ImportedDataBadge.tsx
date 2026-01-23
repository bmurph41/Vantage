import { RefreshCw, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ImportedDataBadgeProps {
  integrationSource?: string | null;
  externalId?: string | null;
  lastSyncedAt?: Date | string | null;
  showExternalId?: boolean;
  className?: string;
}

const INTEGRATION_LABELS: Record<string, string> = {
  dockmaster: "DockMaster",
  dockwa: "Dockwa",
  storable_marine: "Storable Marine",
  marina_office: "Marina Office",
  elitemarinas: "EliteMarinas",
  boatcloud: "BoatCloud",
  fareharbor: "FareHarbor",
  snagaslip: "Snag-A-Slip",
  marinascom: "Marinas.com",
  quickbooks: "QuickBooks",
  molo: "Molo",
  piervantage: "PierVantage",
  speedydock: "SpeedyDock",
  the_marina_program: "The Marina Program",
  fuelcloud: "FuelCloud",
};

const INTEGRATION_COLORS: Record<string, string> = {
  dockmaster: "bg-blue-100 text-blue-700 border-blue-200",
  dockwa: "bg-cyan-100 text-cyan-700 border-cyan-200",
  storable_marine: "bg-indigo-100 text-indigo-700 border-indigo-200",
  quickbooks: "bg-green-100 text-green-700 border-green-200",
  molo: "bg-purple-100 text-purple-700 border-purple-200",
};

export function ImportedDataBadge({
  integrationSource,
  externalId,
  lastSyncedAt,
  showExternalId = false,
  className = "",
}: ImportedDataBadgeProps) {
  if (!integrationSource) {
    return null;
  }

  const label = INTEGRATION_LABELS[integrationSource] || integrationSource;
  const colorClass = INTEGRATION_COLORS[integrationSource] || "bg-gray-100 text-gray-700 border-gray-200";
  
  const formattedSyncTime = lastSyncedAt 
    ? new Date(lastSyncedAt).toLocaleString() 
    : null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`text-[10px] h-5 gap-1 ${colorClass} ${className}`}
          >
            <RefreshCw className="w-2.5 h-2.5" />
            {label}
            {showExternalId && externalId && (
              <span className="opacity-60">#{externalId.slice(0, 8)}</span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="space-y-1">
            <p className="font-medium">Synced from {label}</p>
            {externalId && (
              <p className="text-muted-foreground">
                External ID: {externalId}
              </p>
            )}
            {formattedSyncTime && (
              <p className="text-muted-foreground">
                Last synced: {formattedSyncTime}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default ImportedDataBadge;
