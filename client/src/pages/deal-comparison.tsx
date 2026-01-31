import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Search,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Anchor,
  MapPin,
  Calendar,
  Building2,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { Deal } from "@shared/schema";

type DealWithDetails = Deal & {
  contact?: { firstName: string; lastName: string } | null;
  company?: { name: string } | null;
};

const formatNumber = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return num.toLocaleString();
};

const formatPercent = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return `${num}%`;
};

const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "-";
  }
};

interface ComparisonMetric {
  label: string;
  key: string;
  getValue: (deal: DealWithDetails) => string | number | null;
  format?: "currency" | "number" | "percent" | "date" | "text";
  highlight?: "higher-better" | "lower-better" | "none";
  category: "financial" | "operational" | "timeline" | "details";
}

const comparisonMetrics: ComparisonMetric[] = [
  { label: "Deal Value", key: "value", getValue: (d) => d.value, format: "currency", highlight: "higher-better", category: "financial" },
  { label: "Amount", key: "amount", getValue: (d) => d.amount, format: "currency", highlight: "higher-better", category: "financial" },
  { label: "Commission Rate", key: "commissionRate", getValue: (d) => d.commissionRate, format: "percent", highlight: "none", category: "financial" },
  { label: "Commission Amount", key: "commissionAmount", getValue: (d) => d.commissionAmount, format: "currency", highlight: "higher-better", category: "financial" },
  { label: "First Deposit", key: "firstDepositAmount", getValue: (d) => d.firstDepositAmount, format: "currency", highlight: "none", category: "financial" },
  { label: "Second Deposit", key: "secondDepositAmount", getValue: (d) => d.secondDepositAmount, format: "currency", highlight: "none", category: "financial" },
  { label: "Probability", key: "probability", getValue: (d) => d.probability, format: "percent", highlight: "higher-better", category: "financial" },
  
  { label: "Marina Name", key: "marinaName", getValue: (d) => d.marinaName, format: "text", highlight: "none", category: "operational" },
  { label: "Property Type", key: "propertyType", getValue: (d) => d.propertyType, format: "text", highlight: "none", category: "operational" },
  { label: "Slip Number", key: "slipNumber", getValue: (d) => d.slipNumber, format: "text", highlight: "none", category: "operational" },
  { label: "Dock Location", key: "dockLocation", getValue: (d) => d.dockLocation, format: "text", highlight: "none", category: "operational" },
  { label: "Boat Length (ft)", key: "boatLength", getValue: (d) => d.boatLength, format: "number", highlight: "none", category: "operational" },
  { label: "Lease Term (months)", key: "leaseTermMonths", getValue: (d) => d.leaseTermMonths, format: "number", highlight: "none", category: "operational" },
  { label: "City", key: "city", getValue: (d) => d.city, format: "text", highlight: "none", category: "details" },
  { label: "State", key: "state", getValue: (d) => d.state, format: "text", highlight: "none", category: "details" },
  
  { label: "Expected Close", key: "expectedCloseDate", getValue: (d) => d.expectedCloseDate, format: "date", highlight: "none", category: "timeline" },
  { label: "PSA Signed", key: "psaSignedDate", getValue: (d) => d.psaSignedDate, format: "date", highlight: "none", category: "timeline" },
  { label: "DD Expiration", key: "ddExpirationDate", getValue: (d) => d.ddExpirationDate, format: "date", highlight: "none", category: "timeline" },
  { label: "Closing Date", key: "closingDate", getValue: (d) => d.closingDate, format: "date", highlight: "none", category: "timeline" },
  { label: "Days in Stage", key: "daysInCurrentStage", getValue: (d) => d.daysInCurrentStage, format: "number", highlight: "lower-better", category: "timeline" },
  
  { label: "Stage", key: "stage", getValue: (d) => d.stage, format: "text", highlight: "none", category: "details" },
  { label: "Priority", key: "priority", getValue: (d) => d.priority, format: "text", highlight: "none", category: "details" },
  { label: "Lead Source", key: "leadSource", getValue: (d) => d.leadSource, format: "text", highlight: "none", category: "details" },
  { label: "Deal Source", key: "dealSource", getValue: (d) => d.dealSource, format: "text", highlight: "none", category: "details" },
];

function getHighlightClass(
  value: string | number | null,
  allValues: (string | number | null)[],
  highlight: ComparisonMetric["highlight"],
  format?: ComparisonMetric["format"]
): string {
  if (highlight === "none" || value === null || value === undefined) return "";
  
  const numericValues = allValues
    .map((v) => (typeof v === "string" ? parseFloat(v) : v))
    .filter((v): v is number => v !== null && !isNaN(v));
  
  if (numericValues.length < 2) return "";
  
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  if (typeof numValue !== "number" || isNaN(numValue)) return "";
  
  const max = Math.max(...numericValues);
  const min = Math.min(...numericValues);
  
  if (highlight === "higher-better") {
    if (numValue === max) return "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400";
    if (numValue === min && numericValues.length > 1) return "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400";
  } else if (highlight === "lower-better") {
    if (numValue === min) return "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400";
    if (numValue === max && numericValues.length > 1) return "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400";
  }
  
  return "";
}

export default function DealComparisonPage() {
  const [, setLocation] = useLocation();
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const { data: deals = [], isLoading } = useQuery<DealWithDetails[]>({
    queryKey: ["/api/deals"],
  });

  const filteredDeals = useMemo(() => {
    if (!searchQuery) return deals;
    const query = searchQuery.toLowerCase();
    return deals.filter(
      (deal) =>
        deal.title?.toLowerCase().includes(query) ||
        deal.marinaName?.toLowerCase().includes(query) ||
        deal.city?.toLowerCase().includes(query) ||
        deal.state?.toLowerCase().includes(query)
    );
  }, [deals, searchQuery]);

  const selectedDeals = useMemo(() => {
    return deals.filter((deal) => selectedDealIds.has(deal.id));
  }, [deals, selectedDealIds]);

  const toggleDealSelection = (dealId: string) => {
    setSelectedDealIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(dealId)) {
        newSet.delete(dealId);
      } else if (newSet.size < 5) {
        newSet.add(dealId);
      }
      return newSet;
    });
  };

  const removeDeal = (dealId: string) => {
    setSelectedDealIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(dealId);
      return newSet;
    });
  };

  const formatValue = (
    value: string | number | null | undefined,
    format?: ComparisonMetric["format"]
  ): string => {
    if (value === null || value === undefined) return "-";
    switch (format) {
      case "currency":
        const num = typeof value === "string" ? parseFloat(value) : value;
        if (isNaN(num)) return "-";
        return formatCurrency(num);
      case "number":
        return formatNumber(value);
      case "percent":
        return formatPercent(value);
      case "date":
        return formatDate(value as string | Date);
      default:
        return String(value) || "-";
    }
  };

  const categoryLabels = {
    financial: { label: "Financial Metrics", icon: DollarSign },
    operational: { label: "Operational Data", icon: Anchor },
    timeline: { label: "Timeline & Dates", icon: Calendar },
    details: { label: "Deal Details", icon: Building2 },
  };

  const groupedMetrics = useMemo(() => {
    const groups: Record<string, ComparisonMetric[]> = {
      financial: [],
      operational: [],
      timeline: [],
      details: [],
    };
    comparisonMetrics.forEach((metric) => {
      groups[metric.category].push(metric);
    });
    return groups;
  }, []);

  return (
    <div className="flex-1 flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b shadow-sm">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/crm/deals")}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Deals
              </Button>
              <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Deal Comparison
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Compare up to 5 deals side-by-side
                </p>
              </div>
            </div>
            {selectedDeals.length > 0 && (
              <Badge variant="secondary" className="text-sm">
                {selectedDeals.length} deal{selectedDeals.length > 1 ? "s" : ""} selected
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r bg-white dark:bg-gray-800 flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-semibold mb-3">Select Deals to Compare</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search deals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {isLoading ? (
                <div className="p-4 text-center text-gray-500">Loading deals...</div>
              ) : filteredDeals.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No deals found</div>
              ) : (
                filteredDeals.map((deal) => (
                  <div
                    key={deal.id}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedDealIds.has(deal.id)
                        ? "border-primary bg-primary/5"
                        : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-700"
                    )}
                    onClick={() => toggleDealSelection(deal.id)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedDealIds.has(deal.id)}
                        disabled={!selectedDealIds.has(deal.id) && selectedDealIds.size >= 5}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{deal.title}</p>
                        {deal.marinaName && (
                          <p className="text-xs text-gray-500 truncate">{deal.marinaName}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {deal.stage?.replace("_", " ") || "Unknown"}
                          </Badge>
                          {deal.value && (
                            <span className="text-xs text-green-600 font-medium">
                              {formatCurrency(parseFloat(deal.value as string))}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {selectedDeals.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Select deals to compare
                </h3>
                <p className="text-gray-500 max-w-md">
                  Choose up to 5 deals from the list on the left to see a side-by-side comparison
                  of their financial metrics and operational data.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-4 flex-wrap">
                {selectedDeals.map((deal) => (
                  <div
                    key={deal.id}
                    className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 border shadow-sm"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Anchor className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium truncate max-w-[150px]">{deal.title}</p>
                      {deal.city && deal.state && (
                        <p className="text-xs text-gray-500">
                          {deal.city}, {deal.state}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 ml-2"
                      onClick={() => removeDeal(deal.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {Object.entries(groupedMetrics).map(([category, metrics]) => {
                const { label, icon: Icon } = categoryLabels[category as keyof typeof categoryLabels];
                return (
                  <Card key={category}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        {label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-3 text-sm font-medium text-gray-500 w-48">
                                Metric
                              </th>
                              {selectedDeals.map((deal) => (
                                <th
                                  key={deal.id}
                                  className="text-left py-2 px-3 text-sm font-medium min-w-[150px]"
                                >
                                  <span className="truncate block max-w-[150px]">{deal.title}</span>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {metrics.map((metric) => {
                              const values = selectedDeals.map((d) => metric.getValue(d));
                              return (
                                <tr key={metric.key} className="border-b last:border-0">
                                  <td className="py-2 px-3 text-sm text-gray-600 dark:text-gray-400">
                                    {metric.label}
                                  </td>
                                  {selectedDeals.map((deal, idx) => {
                                    const value = values[idx];
                                    const highlightClass = getHighlightClass(
                                      value,
                                      values,
                                      metric.highlight,
                                      metric.format
                                    );
                                    return (
                                      <td
                                        key={deal.id}
                                        className={cn(
                                          "py-2 px-3 text-sm font-medium",
                                          highlightClass
                                        )}
                                      >
                                        {formatValue(value, metric.format)}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
