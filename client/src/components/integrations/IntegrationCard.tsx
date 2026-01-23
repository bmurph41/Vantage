import { Link } from "wouter";
import { ExternalLink, Settings, Clock, ArrowRight, Database, RefreshCw, ArrowRightLeft, ArrowDownToLine, ArrowUpFromLine, Truck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./StatusBadge";
import type { IntegrationItem, DataMapping } from "@/lib/api/integrations";

interface IntegrationCardProps {
  integration: IntegrationItem;
  onConnect: (integration: IntegrationItem) => void;
  onDisconnect: (integration: IntegrationItem) => void;
  onSettings?: (integration: IntegrationItem) => void;
  isConnecting?: boolean;
  isDisconnecting?: boolean;
  showDataSync?: boolean;
}

const DATA_CATEGORY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  "rentRoll": { label: "Rent Roll", icon: "slips", color: "bg-blue-100 text-blue-700" },
  "crm": { label: "CRM", icon: "contacts", color: "bg-purple-100 text-purple-700" },
  "financials": { label: "Financials", icon: "money", color: "bg-green-100 text-green-700" },
  "boatRentals": { label: "Boat Rentals", icon: "boat", color: "bg-cyan-100 text-cyan-700" },
  "fuelSales": { label: "Fuel Sales", icon: "fuel", color: "bg-orange-100 text-orange-700" },
  "analytics": { label: "Analytics", icon: "chart", color: "bg-indigo-100 text-indigo-700" },
  "marketing": { label: "Marketing", icon: "marketing", color: "bg-pink-100 text-pink-700" },
  "service": { label: "Service", icon: "wrench", color: "bg-amber-100 text-amber-700" },
  "bookkeeping": { label: "Bookkeeping", icon: "book", color: "bg-emerald-100 text-emerald-700" },
  "documents": { label: "Documents", icon: "doc", color: "bg-slate-100 text-slate-700" },
};

const ENTITY_LABELS: Record<string, string> = {
  "leases": "Leases",
  "tenants": "Tenants",
  "slips": "Slips/Berths", 
  "locations": "Storage Locations",
  "contacts": "Contacts",
  "customers": "Customers",
  "members": "Members",
  "leads": "Leads",
  "reservations": "Reservations",
  "transients": "Transient Bookings",
  "availability": "Availability",
  "billing": "Billing Records",
  "receivables": "Receivables",
  "invoices": "Invoices",
  "payments": "Payments",
  "pnl": "P&L Statements",
  "coa": "Chart of Accounts",
  "schedule": "Scheduling",
  "launches": "Launches",
  "checkIns": "Check-ins",
  "occupancy": "Occupancy Data",
  "sensorData": "IoT Sensor Data",
  "metrics": "Metrics",
  "serviceOrders": "Service Orders",
  "accessLogs": "Access Logs",
  "accessPermissions": "Access Permissions",
  "communications": "Communications",
  "lists": "Marketing Lists",
  "messages": "Messages",
  "guests": "Guests",
  "boaters": "Boaters",
  "boatOwners": "Boat Owners",
  "waitlist": "Waitlist",
};

function formatSyncDirection(direction: string): { label: string; icon: typeof ArrowDownToLine } {
  switch (direction) {
    case "read":
      return { label: "Import", icon: ArrowDownToLine };
    case "write":
      return { label: "Export", icon: ArrowUpFromLine };
    case "bidirectional":
      return { label: "Two-way Sync", icon: ArrowRightLeft };
    default:
      return { label: "Sync", icon: RefreshCw };
  }
}

function formatFrequency(frequency: string): string {
  switch (frequency) {
    case "realtime": return "Real-time";
    case "hourly": return "Hourly";
    case "daily": return "Daily";
    case "weekly": return "Weekly";
    case "manual": return "Manual";
    default: return frequency;
  }
}

function getSyncDataSummary(dataMappings?: DataMapping[]): { 
  categories: string[]; 
  entities: string[];
  directions: Set<string>;
  frequencies: Set<string>;
} {
  if (!dataMappings || dataMappings.length === 0) {
    return { categories: [], entities: [], directions: new Set(), frequencies: new Set() };
  }
  
  const categories = new Set<string>();
  const entities = new Set<string>();
  const directions = new Set<string>();
  const frequencies = new Set<string>();
  
  dataMappings.forEach(mapping => {
    categories.add(mapping.targetModule);
    entities.add(`${mapping.targetModule}.${mapping.targetEntity}`);
    directions.add(mapping.syncDirection);
    frequencies.add(mapping.frequency);
  });
  
  return {
    categories: Array.from(categories),
    entities: Array.from(entities),
    directions,
    frequencies,
  };
}

export function IntegrationCard({
  integration,
  onConnect,
  onDisconnect,
  onSettings,
  isConnecting,
  isDisconnecting,
  showDataSync = true,
}: IntegrationCardProps) {
  const isConnected = integration.status === "connected";
  const logoStyle = integration.logoColor 
    ? { background: integration.logoColor }
    : undefined;
  
  const syncSummary = getSyncDataSummary(integration.dataMappings);
  const hasDataMappings = syncSummary.entities.length > 0;

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
              <Link href={`/settings/integrations/${integration.key}`} className="hover:underline">
                <CardTitle className="text-base">{integration.name}</CardTitle>
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

        {showDataSync && hasDataMappings && (
          <div className="border-t pt-3 mt-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Database className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Data You Can Sync</span>
            </div>
            
            <div className="space-y-2">
              {syncSummary.categories.map((category) => {
                const categoryInfo = DATA_CATEGORY_LABELS[category] || { label: category, color: "bg-gray-100 text-gray-700" };
                const categoryMappings = integration.dataMappings?.filter(m => m.targetModule === category) || [];
                
                return (
                  <div key={category} className="text-xs">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${categoryInfo.color}`}>
                      {categoryInfo.label}
                    </span>
                    <div className="mt-1 ml-2 flex flex-wrap gap-1">
                      {categoryMappings.map((mapping, idx) => {
                        const entityLabel = ENTITY_LABELS[mapping.targetEntity] || mapping.targetEntity;
                        const { label: dirLabel, icon: DirIcon } = formatSyncDirection(mapping.syncDirection);
                        
                        return (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-muted/50 rounded text-[10px] text-muted-foreground"
                            title={`${dirLabel} - ${formatFrequency(mapping.frequency)}`}
                          >
                            <DirIcon className="w-2.5 h-2.5" />
                            {entityLabel}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {integration.migrationSupport && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-dashed">
                {integration.migrationSupport.supportsHistoricalImport && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-green-600">
                    <CheckCircle2 className="w-3 h-3" />
                    Historical Import
                  </span>
                )}
                {integration.migrationSupport.canExportAll && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-blue-600">
                    <Truck className="w-3 h-3" />
                    Full Migration
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          {isConnected ? (
            <>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white cursor-default"
                disabled
              >
                Connected
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDisconnect(integration)}
                disabled={isDisconnecting}
              >
                {isDisconnecting ? "..." : "Disconnect"}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => onConnect(integration)}
              disabled={isConnecting}
              className="bg-[#1E4FAB] hover:bg-[#1a4294]"
            >
              {isConnecting ? "Connecting..." : "Connect"}
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
