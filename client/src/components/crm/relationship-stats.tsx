import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Clock, 
  DollarSign, 
  FileText, 
  StickyNote, 
  Users, 
  Briefcase, 
  CheckSquare,
  AlertTriangle,
  TrendingUp
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatCurrency } from "@/lib/utils";

interface RelationshipStatsProps {
  entityType: "contact" | "company" | "deal";
  entityId: string;
}

interface StatsData {
  lastActivity: string | null;
  lastActivityType: string | null;
  notesCount: number;
  filesCount: number;
  totalDeals?: number;
  openDeals?: number;
  wonDeals?: number;
  totalDealValue?: number;
  contactsCount?: number;
  totalTasks?: number;
  openTasks?: number;
  overdueTasks?: number;
  daysInCurrentStage?: number;
}

export function RelationshipStats({ entityType, entityId }: RelationshipStatsProps) {
  const { data: stats, isLoading, isError, error, refetch } = useQuery<StatsData>({
    queryKey: ['/api/crm/stats', entityType, entityId],
    enabled: !!entityId,
    retry: 1,
    staleTime: 30000, // Cache for 30 seconds
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="text-center py-4 mb-4 bg-muted/30 rounded-lg" data-testid="relationship-stats-empty">
        <p className="text-sm text-muted-foreground">No Stats Available</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Add activities, notes, or deals to see stats</p>
      </div>
    );
  }


  const statCards: Array<{
    label: string;
    value: string | number;
    icon: typeof Clock;
    colorClass?: string;
  }> = [];

  if (stats.lastActivity) {
    statCards.push({
      label: "Last Activity",
      value: formatDistanceToNow(new Date(stats.lastActivity), { addSuffix: true }),
      icon: Clock,
    });
  } else {
    statCards.push({
      label: "Last Activity",
      value: "No activity",
      icon: Clock,
      colorClass: "text-muted-foreground",
    });
  }

  if (entityType === "contact" || entityType === "company") {
    if (stats.openDeals !== undefined) {
      statCards.push({
        label: "Open Deals",
        value: stats.openDeals,
        icon: Briefcase,
        colorClass: stats.openDeals > 0 ? "text-blue-600" : undefined,
      });
    }

    if (stats.totalDealValue !== undefined && stats.totalDealValue > 0) {
      statCards.push({
        label: "Total Value",
        value: formatCurrency(stats.totalDealValue),
        icon: DollarSign,
        colorClass: "text-green-600",
      });
    }

    if (entityType === "company" && stats.contactsCount !== undefined) {
      statCards.push({
        label: "Contacts",
        value: stats.contactsCount,
        icon: Users,
      });
    }

    if (entityType === "contact" && stats.wonDeals !== undefined && stats.wonDeals > 0) {
      statCards.push({
        label: "Won Deals",
        value: stats.wonDeals,
        icon: TrendingUp,
        colorClass: "text-green-600",
      });
    }
  }

  if (entityType === "deal") {
    if (stats.openTasks !== undefined) {
      statCards.push({
        label: "Open Tasks",
        value: stats.openTasks,
        icon: CheckSquare,
        colorClass: stats.openTasks > 0 ? "text-blue-600" : undefined,
      });
    }

    if (stats.overdueTasks !== undefined && stats.overdueTasks > 0) {
      statCards.push({
        label: "Overdue",
        value: stats.overdueTasks,
        icon: AlertTriangle,
        colorClass: "text-red-600",
      });
    }

    if (stats.daysInCurrentStage !== undefined) {
      statCards.push({
        label: "Days in Stage",
        value: stats.daysInCurrentStage,
        icon: Clock,
        colorClass: stats.daysInCurrentStage > 14 ? "text-amber-600" : undefined,
      });
    }
  }

  statCards.push({
    label: "Notes",
    value: stats.notesCount,
    icon: StickyNote,
  });

  statCards.push({
    label: "Files",
    value: stats.filesCount,
    icon: FileText,
  });

  const displayCards = statCards.slice(0, 4);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4" data-testid="relationship-stats">
      {displayCards.map((stat, index) => (
        <Card key={index} className="bg-muted/30" data-testid={`stat-card-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <stat.icon className={`h-4 w-4 ${stat.colorClass || 'text-muted-foreground'}`} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <div className={`text-lg font-semibold mt-1 ${stat.colorClass || ''}`}>
              {stat.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
