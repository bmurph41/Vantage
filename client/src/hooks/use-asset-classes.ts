/**
 * Dynamic asset class hook and select component.
 *
 * Fetches asset classes grouped by source (portfolio, pipeline, models)
 * so dropdowns only show what's relevant to the user's data.
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

interface AssetClassContextResponse {
  portfolio: string[];
  pipeline: string[];
  models: string[];
  all: string[];
  platform: { key: string; label: string; category: string }[];
  labels: Record<string, string>;
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useAssetClassOptions(opts?: {
  /** Include the full platform list as a fallback group (default: true) */
  includeAll?: boolean;
}) {
  const includeAll = opts?.includeAll ?? true;

  const { data, isLoading } = useQuery<AssetClassContextResponse>({
    queryKey: ["/api/asset-classes/context"],
    queryFn: async () => {
      const res = await fetch("/api/asset-classes/context");
      if (!res.ok) throw new Error("Failed to fetch asset class context");
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const label = (key: string) => data?.labels?.[key] || formatKey(key);

  const toOptions = (keys: string[]): AssetClassOption[] =>
    keys.map((k) => ({ value: k, label: label(k) }));

  const portfolio = toOptions(data?.portfolio ?? []);
  const pipeline = toOptions(data?.pipeline ?? []);
  const models = toOptions(data?.models ?? []);
  const all = toOptions(data?.all ?? []);

  // Build grouped options for select rendering
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

  // Flat fallback: if user has no data at all, show platform list
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
