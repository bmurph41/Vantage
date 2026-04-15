/**
 * Dynamic asset class hooks.
 *
 * useAssetClasses()        — DB-driven list from /api/asset-classes (with fallback)
 * useAssetClassOptions()   — Grouped options based on user's portfolio/pipeline/models
 */

import { useQuery } from "@tanstack/react-query";

// ─── Types ────────────────────────────────────────────────────────────

export interface AssetClassOption {
  value: string;
  label: string;
}

export interface AssetClassGroup {
  label: string;
  options: AssetClassOption[];
}

export interface AssetClassRecord {
  id: string;
  key: string;
  label: string;
  shortLabel: string | null;
  category: string;
  description: string | null;
  icon: string | null;
  enabled: boolean;
  sortOrder: number;
  config: Record<string, any>;
  enabledModules: string[];
  defaultDataSources: string[];
  coaTaxonomyPackKey: string | null;
  ddTemplateKey: string | null;
  sizeLabel: string | null;
  occLabel: string | null;
  priceUnit: string | null;
  revenueStreams: string[];
  demandKey: string | null;
  group: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AssetClassContextResponse {
  portfolio: string[];
  pipeline: string[];
  models: string[];
  all: string[];
  platform: { key: string; label: string; category: string }[];
  labels: Record<string, string>;
}

// ─── Default config for unknown keys ──────────────────────────────────

export function makeDefaultAssetClass(key: string): AssetClassRecord {
  return {
    id: "",
    key,
    label: formatKey(key),
    shortLabel: null,
    category: "specialty",
    description: null,
    icon: null,
    enabled: true,
    sortOrder: 999,
    config: {},
    enabledModules: [],
    defaultDataSources: [],
    coaTaxonomyPackKey: null,
    ddTemplateKey: null,
    sizeLabel: null,
    occLabel: null,
    priceUnit: null,
    revenueStreams: [],
    demandKey: null,
    group: null,
    color: null,
    createdAt: "",
    updatedAt: "",
  };
}

// ─── Fallback data (shown while loading / if API unavailable) ─────────

const FALLBACK_ASSET_CLASSES: AssetClassRecord[] = [
  { id: "fallback-marina", key: "marina", label: "Marina", shortLabel: "Marina", category: "specialty",
    description: null, icon: "Anchor", enabled: true, sortOrder: 1, config: {}, enabledModules: [], defaultDataSources: [],
    coaTaxonomyPackKey: null, ddTemplateKey: null, sizeLabel: "Slips", occLabel: "Slip Occ %", priceUnit: "Slip",
    revenueStreams: ["Fuel Revenue", "Storage Revenue", "Service Revenue"], demandKey: "Boat Ownership %",
    group: "Waterfront", color: "#00d4ff", createdAt: "", updatedAt: "" },
  { id: "fallback-multifamily", key: "multifamily", label: "Multifamily", shortLabel: "Multifamily", category: "residential",
    description: null, icon: "Building2", enabled: true, sortOrder: 12, config: {}, enabledModules: [], defaultDataSources: [],
    coaTaxonomyPackKey: null, ddTemplateKey: null, sizeLabel: "Units", occLabel: "Occ %", priceUnit: "Unit",
    revenueStreams: ["Rental Revenue", "Parking Revenue", "Ancillary"], demandKey: "Renter Demand Index",
    group: "Residential", color: "#4ade80", createdAt: "", updatedAt: "" },
  { id: "fallback-retail", key: "retail", label: "Retail", shortLabel: "Retail", category: "commercial",
    description: null, icon: "Store", enabled: true, sortOrder: 29, config: {}, enabledModules: [], defaultDataSources: [],
    coaTaxonomyPackKey: null, ddTemplateKey: null, sizeLabel: "Sq Ft", occLabel: "Leased %", priceUnit: "Sq Ft",
    revenueStreams: ["Base Rent", "CAM Recoveries", "Percentage Rent"], demandKey: "Retail Sales Index",
    group: "Retail", color: "#f43f5e", createdAt: "", updatedAt: "" },
  { id: "fallback-office", key: "office", label: "Office", shortLabel: "Office", category: "commercial",
    description: null, icon: "Building2", enabled: true, sortOrder: 25, config: {}, enabledModules: [], defaultDataSources: [],
    coaTaxonomyPackKey: null, ddTemplateKey: null, sizeLabel: "Sq Ft", occLabel: "Leased %", priceUnit: "Sq Ft",
    revenueStreams: ["Base Rent", "Operating Expense Recoveries", "Parking Revenue"], demandKey: "Office Absorption Rate",
    group: "Office", color: "#60a5fa", createdAt: "", updatedAt: "" },
  { id: "fallback-industrial", key: "industrial", label: "Industrial", shortLabel: "Industrial", category: "commercial",
    description: null, icon: "Factory", enabled: true, sortOrder: 19, config: {}, enabledModules: [], defaultDataSources: [],
    coaTaxonomyPackKey: null, ddTemplateKey: null, sizeLabel: "Sq Ft", occLabel: "Leased %", priceUnit: "Sq Ft",
    revenueStreams: ["Base Rent", "NNN Recoveries", "Ancillary"], demandKey: "Industrial Absorption Rate",
    group: "Industrial", color: "#fb923c", createdAt: "", updatedAt: "" },
];

// ─── Primary Hook: DB-driven asset class list ─────────────────────────

export function useAssetClasses() {
  const { data, isLoading, isError } = useQuery<{ assetClasses: AssetClassRecord[] }>({
    queryKey: ["/api/asset-classes"],
    staleTime: 5 * 60 * 1000,
  });

  const assetClasses = data?.assetClasses?.length ? data.assetClasses : FALLBACK_ASSET_CLASSES;

  // options: only enabled classes (for use in dropdowns/selects)
  // assetClasses: all classes (for config/label resolution of any stored key)
  const options: AssetClassOption[] = assetClasses
    .filter((ac) => ac.enabled)
    .map((ac) => ({ value: ac.key, label: ac.label }));

  function getConfig(key: string | null | undefined): AssetClassRecord {
    if (!key) return makeDefaultAssetClass("unknown");
    return (
      assetClasses.find((ac) => ac.key === key) ??
      FALLBACK_ASSET_CLASSES.find((ac) => ac.key === key) ??
      makeDefaultAssetClass(key)
    );
  }

  function getLabel(key: string | null | undefined): string {
    if (!key) return "";
    return getConfig(key).label;
  }

  return { assetClasses, options, isLoading, isError, getConfig, getLabel };
}

// ─── Secondary Hook: grouped options from portfolio/pipeline context ──

export function useAssetClassOptions(opts?: { includeAll?: boolean }) {
  const includeAll = opts?.includeAll ?? true;

  const { data, isLoading } = useQuery<AssetClassContextResponse>({
    queryKey: ["/api/asset-classes/context"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const label = (key: string) => data?.labels?.[key] || formatKey(key);
  const toOptions = (keys: string[]): AssetClassOption[] =>
    keys.map((k) => ({ value: k, label: label(k) }));

  const portfolio = toOptions(data?.portfolio ?? []);
  const pipeline = toOptions(data?.pipeline ?? []);
  const models = toOptions(data?.models ?? []);
  const all = toOptions(data?.all ?? []);

  const grouped: AssetClassGroup[] = [];
  const usedKeys = new Set<string>();

  if (portfolio.length > 0) {
    grouped.push({ label: "Your Portfolio", options: portfolio });
    portfolio.forEach((o) => usedKeys.add(o.value));
  }
  if (pipeline.length > 0) {
    const unique = pipeline.filter((o) => !usedKeys.has(o.value));
    if (unique.length > 0) {
      grouped.push({ label: "Pipeline Deals", options: unique });
      unique.forEach((o) => usedKeys.add(o.value));
    }
  }
  if (models.length > 0) {
    const unique = models.filter((o) => !usedKeys.has(o.value));
    if (unique.length > 0) {
      grouped.push({ label: "Financial Models (not owned)", options: unique });
      unique.forEach((o) => usedKeys.add(o.value));
    }
  }
  if (includeAll && data?.platform) {
    const remaining = data.platform
      .filter((p) => !usedKeys.has(p.key))
      .map((p) => ({ value: p.key, label: p.label || formatKey(p.key) }));
    if (remaining.length > 0) {
      grouped.push({ label: "Other", options: remaining });
    }
  }

  const flat: AssetClassOption[] =
    all.length > 0
      ? all
      : (data?.platform ?? []).map((p) => ({
          value: p.key,
          label: p.label || formatKey(p.key),
        }));

  return { portfolio, pipeline, models, all, flat, grouped, isLoading };
}

// ─── Utility ──────────────────────────────────────────────────────────

function formatKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
