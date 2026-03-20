import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Search, TrendingUp, Building2, DollarSign, Clock,
  ArrowRight, ArrowUpDown, ChevronRight, LayoutGrid,
} from "lucide-react";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/utils";
import { calculateDaysInStage } from "@shared/crm-constants";
import type { Deal, Contact, Company } from "@shared/schema";

type DealWithRelations = Deal & {
  contact?: Contact | null;
  company?: Company | null;
};

interface SimpleDealTrackerProps {
  onSwitchToKanban: () => void;
  onAddDeal: () => void;
  onDealClick: (deal: DealWithRelations) => void;
}

const STAGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  prospecting: { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-200" },
  lead: { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-200" },
  qualification: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
  proposal: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
  loi: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" },
  negotiation: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" },
  diligence: { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-200" },
  due_diligence: { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-200" },
  financing: { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200" },
  closing: { bg: "bg-green-100", text: "text-green-700", border: "border-green-200" },
  closed_won: { bg: "bg-green-100", text: "text-green-700", border: "border-green-200" },
  won: { bg: "bg-green-100", text: "text-green-700", border: "border-green-200" },
  closed_lost: { bg: "bg-red-100", text: "text-red-700", border: "border-red-200" },
  lost: { bg: "bg-red-100", text: "text-red-700", border: "border-red-200" },
};

function getStageStyle(stage: string) {
  const key = stage.toLowerCase().replace(/[\s-]/g, "_");
  for (const [k, v] of Object.entries(STAGE_COLORS)) {
    if (key.includes(k)) return v;
  }
  return { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-200" };
}

type SortOption = "recent" | "value" | "closing";

export default function SimpleDealTracker({ onSwitchToKanban, onAddDeal, onDealClick }: SimpleDealTrackerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recent");

  const { data: deals = [], isLoading } = useQuery<DealWithRelations[]>({
    queryKey: ["/api/deals"],
  });

  const filteredDeals = useMemo(() => {
    let result = deals.filter((deal) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        deal.title.toLowerCase().includes(term) ||
        deal.contact?.firstName?.toLowerCase().includes(term) ||
        deal.contact?.lastName?.toLowerCase().includes(term) ||
        deal.company?.name?.toLowerCase().includes(term)
      );
    });

    // Sort
    switch (sortBy) {
      case "value":
        result.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
        break;
      case "closing":
        result.sort((a, b) => {
          const dateA = a.expectedCloseDate ? new Date(a.expectedCloseDate).getTime() : Infinity;
          const dateB = b.expectedCloseDate ? new Date(b.expectedCloseDate).getTime() : Infinity;
          return dateA - dateB;
        });
        break;
      case "recent":
      default:
        result.sort((a, b) => {
          const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : new Date(a.createdAt).getTime();
          const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : new Date(b.createdAt).getTime();
          return dateB - dateA;
        });
        break;
    }

    return result;
  }, [deals, searchTerm, sortBy]);

  // Summary stats
  const stats = useMemo(() => {
    const openDeals = deals.filter((d) => {
      const stage = (d.stage || "").toLowerCase();
      return !stage.includes("won") && !stage.includes("lost") && !stage.includes("closed");
    });
    const totalValue = openDeals.reduce((sum, d) => sum + Number(d.amount || 0), 0);
    return { total: deals.length, open: openDeals.length, totalValue };
  }, [deals]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Deal Tracker
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {stats.open} active deal{stats.open !== 1 ? "s" : ""} &middot; {formatCurrency(stats.totalValue)} total pipeline
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs text-gray-500" onClick={onSwitchToKanban}>
              <LayoutGrid className="h-4 w-4 mr-1" />
              Switch to Kanban
            </Button>
            <Button size="sm" className="gap-2" onClick={onAddDeal}>
              <Plus className="h-4 w-4" />
              Add Deal
            </Button>
          </div>
        </div>

        {/* Search and Sort */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search deals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-48 h-9">
              <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-gray-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="value">Highest Value</SelectItem>
              <SelectItem value="closing">Closest to Closing</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Deal List */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {filteredDeals.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">
                {searchTerm ? "No deals match your search" : "No deals yet"}
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                {searchTerm
                  ? "Try a different search term."
                  : "Create your first deal to start tracking your pipeline."}
              </p>
              {!searchTerm && (
                <Button onClick={onAddDeal} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Your First Deal
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredDeals.map((deal) => {
            const stageStyle = getStageStyle(deal.stage || "");
            const daysInStage = calculateDaysInStage(deal.currentStageEnteredAt);
            const propertyName = deal.company?.name;

            return (
              <Card
                key={deal.id}
                className="hover:shadow-md hover:border-blue-200 transition-all cursor-pointer"
                onClick={() => onDealClick(deal)}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-center gap-4">
                    {/* Deal Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {deal.title}
                        </h3>
                        <Badge className={`${stageStyle.bg} ${stageStyle.text} border ${stageStyle.border} text-xs`}>
                          {deal.stage || "Unknown"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {propertyName && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {propertyName}
                          </span>
                        )}
                        {deal.contact && (
                          <span className="truncate">
                            {deal.contact.firstName} {deal.contact.lastName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Value */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-green-700">
                        {deal.amount ? formatCurrency(Number(deal.amount)) : "--"}
                      </p>
                    </div>

                    {/* Days in Stage */}
                    <div className="text-center flex-shrink-0 w-16">
                      <p className={`text-sm font-semibold ${daysInStage > 30 ? "text-red-600" : "text-gray-600"}`}>
                        {daysInStage}d
                      </p>
                      <p className="text-[10px] text-gray-400">in stage</p>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
