/**
 * useSavedViews Hook
 * 
 * Manages saved view configurations for CRM data tables.
 * Each view stores: filters, sort, visible columns, grouping.
 * 
 * Backend: /api/crm/saved-views (already mounted in server/routes.ts line 422)
 */

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────

export interface SavedViewFilter {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "in" | "between";
  value: any;
}

export interface SavedViewSort {
  field: string;
  direction: "asc" | "desc";
}

export interface SavedViewConfig {
  filters: SavedViewFilter[];
  sort: SavedViewSort[];
  columns: string[];
  groupBy?: string;
  assetClassFilter?: string[];
}

export interface SavedView {
  id: string;
  name: string;
  description?: string;
  entityType: "deal" | "contact" | "company" | "property";
  config: SavedViewConfig;
  isDefault: boolean;
  isShared: boolean;
  icon?: string;
  color?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedViewInput {
  name: string;
  description?: string;
  entityType: "deal" | "contact" | "company" | "property";
  config: SavedViewConfig;
  isDefault?: boolean;
  isShared?: boolean;
  icon?: string;
  color?: string;
}

// ─── Built-in Presets (no backend needed) ─────────────────────────

export const DEAL_VIEW_PRESETS: Omit<SavedView, "id" | "createdBy" | "createdAt" | "updatedAt">[] = [
  {
    name: "All Active Deals",
    description: "All open deals across asset classes",
    entityType: "deal",
    isDefault: false,
    isShared: false,
    icon: "list",
    color: "blue",
    config: {
      filters: [{ field: "status", operator: "eq", value: "open" }],
      sort: [{ field: "updatedAt", direction: "desc" }],
      columns: ["name", "amount", "pipelineStage", "assetClass", "closeDate", "priority"],
    },
  },
  {
    name: "High-Value Pipeline",
    description: "Deals over $5M currently active",
    entityType: "deal",
    isDefault: false,
    isShared: false,
    icon: "dollar-sign",
    color: "green",
    config: {
      filters: [
        { field: "status", operator: "eq", value: "open" },
        { field: "amount", operator: "gte", value: 5000000 },
      ],
      sort: [{ field: "amount", direction: "desc" }],
      columns: ["name", "amount", "pipelineStage", "assetClass", "capRate", "closeDate"],
    },
  },
  {
    name: "Closing This Quarter",
    description: "Deals expected to close within 90 days",
    entityType: "deal",
    isDefault: false,
    isShared: false,
    icon: "calendar",
    color: "amber",
    config: {
      filters: [
        { field: "status", operator: "eq", value: "open" },
        { field: "closeDate", operator: "lte", value: "RELATIVE:+90d" },
      ],
      sort: [{ field: "closeDate", direction: "asc" }],
      columns: ["name", "amount", "pipelineStage", "closeDate", "priority", "contactName"],
    },
  },
  {
    name: "Stale Deals",
    description: "No activity in 30+ days",
    entityType: "deal",
    isDefault: false,
    isShared: false,
    icon: "alert-triangle",
    color: "red",
    config: {
      filters: [
        { field: "status", operator: "eq", value: "open" },
        { field: "updatedAt", operator: "lte", value: "RELATIVE:-30d" },
      ],
      sort: [{ field: "updatedAt", direction: "asc" }],
      columns: ["name", "amount", "pipelineStage", "updatedAt", "assetClass"],
    },
  },
  {
    name: "Marina Deals",
    description: "All marina asset class deals",
    entityType: "deal",
    isDefault: false,
    isShared: false,
    icon: "anchor",
    color: "cyan",
    config: {
      filters: [{ field: "assetClass", operator: "eq", value: "marina" }],
      sort: [{ field: "amount", direction: "desc" }],
      columns: ["name", "amount", "pipelineStage", "wetSlips", "occupancyRate", "closeDate"],
      assetClassFilter: ["marina"],
    },
  },
  {
    name: "Multifamily Deals",
    description: "All multifamily asset class deals",
    entityType: "deal",
    isDefault: false,
    isShared: false,
    icon: "home",
    color: "purple",
    config: {
      filters: [{ field: "assetClass", operator: "eq", value: "multifamily" }],
      sort: [{ field: "amount", direction: "desc" }],
      columns: ["name", "amount", "pipelineStage", "totalUnits", "avgRent", "closeDate"],
      assetClassFilter: ["multifamily"],
    },
  },
];

// ─── Hook ─────────────────────────────────────────────────────────

export function useSavedViews(entityType: "deal" | "contact" | "company" | "property") {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ["/api/crm/saved-views", { entityType }];

  // Fetch saved views
  const {
    data: savedViews = [],
    isLoading,
    error,
  } = useQuery<SavedView[]>({
    queryKey,
    queryFn: async () => {
      try {
        const response = await fetch(`/api/crm/saved-views?entityType=${entityType}`);
        if (!response.ok) return [];
        return response.json();
      } catch {
        return [];
      }
    },
  });

  // Merge with presets
  const allViews = useMemo(() => {
    const presets = DEAL_VIEW_PRESETS.filter((p) => p.entityType === entityType).map(
      (p, i) => ({
        ...p,
        id: `preset-${i}`,
        createdBy: "system",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _isPreset: true,
      })
    );
    // User views first, then presets
    return [...savedViews, ...presets] as (SavedView & { _isPreset?: boolean })[];
  }, [savedViews, entityType]);

  const defaultView = useMemo(
    () => savedViews.find((v) => v.isDefault) || null,
    [savedViews]
  );

  // Create
  const createView = useMutation({
    mutationFn: async (input: CreateSavedViewInput) => {
      const response = await apiRequest("POST", "/api/crm/saved-views", input);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "View Saved", description: `"${data.name}" has been saved.` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update
  const updateView = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateSavedViewInput> }) => {
      const response = await apiRequest("PATCH", `/api/crm/saved-views/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "View Updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete
  const deleteView = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/crm/saved-views/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "View Deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Set as default
  const setDefault = useMutation({
    mutationFn: async (id: string) => {
      // Unset current default first
      if (defaultView) {
        await apiRequest("PATCH", `/api/crm/saved-views/${defaultView.id}`, {
          isDefault: false,
        });
      }
      const response = await apiRequest("PATCH", `/api/crm/saved-views/${id}`, {
        isDefault: true,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Default View Set" });
    },
  });

  // Duplicate a preset into a saved view
  const duplicatePreset = useMutation({
    mutationFn: async (preset: SavedView & { _isPreset?: boolean }) => {
      const input: CreateSavedViewInput = {
        name: `${preset.name} (copy)`,
        description: preset.description,
        entityType: preset.entityType,
        config: preset.config,
        isDefault: false,
        isShared: false,
        icon: preset.icon,
        color: preset.color,
      };
      const response = await apiRequest("POST", "/api/crm/saved-views", input);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Preset copied to your saved views" });
    },
  });

  return {
    views: allViews,
    savedViews,
    defaultView,
    isLoading,
    error,
    createView,
    updateView,
    deleteView,
    setDefault,
    duplicatePreset,
  };
}

export default useSavedViews;
