import { useQuery } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";

interface ModuleSyncIndicatorProps {
  module: string; // fuel, ship_store, service, boat_rentals, etc.
  marinaId?: string;
}

interface SyncStatusResponse {
  module: string;
  lastSyncAt: string | null;
  status: "synced" | "syncing" | "error" | "never";
  recordCount: number;
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  synced: { color: "bg-green-500", label: "Synced" },
  syncing: { color: "bg-yellow-500 animate-pulse", label: "Syncing..." },
  error: { color: "bg-red-500", label: "Sync Error" },
  never: { color: "bg-gray-400", label: "Never Synced" },
};

export function ModuleSyncIndicator({ module, marinaId }: ModuleSyncIndicatorProps) {
  const params = new URLSearchParams({ module });
  if (marinaId) params.set("marinaId", marinaId);

  const { data } = useQuery<SyncStatusResponse>({
    queryKey: ["/api/operations-context/sync-status", module, marinaId],
    queryFn: async () => {
      const res = await fetch(`/api/operations-context/sync-status?${params.toString()}`);
      if (res.status === 404) {
        return { module, lastSyncAt: null, status: "never" as const, recordCount: 0 };
      }
      if (!res.ok) {
        return { module, lastSyncAt: null, status: "never" as const, recordCount: 0 };
      }
      return res.json();
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const status = data?.status || "never";
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.never;

  const tooltipContent = data?.lastSyncAt
    ? `${config.label} - ${formatDistanceToNow(new Date(data.lastSyncAt), { addSuffix: true })}${data.recordCount > 0 ? ` (${data.recordCount} records)` : ""}`
    : config.label;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${config.color}`}
            aria-label={tooltipContent}
          />
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
