import { useQuery } from "@tanstack/react-query";
import type { DDTimelineData, DDExtensionInput } from "@/components/dd/DDTimelineAnimation";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`Request failed ${res.status}`);
  return res.json();
}

interface DealRow {
  id: string;
  stage?: string | null;
  stageId?: string | null;
  psaSignedDate?: string | null;
  ddExpirationDate?: string | null;
  closingDate?: string | null;
  ddPeriodDays?: number | null;
}

export interface UseDDTimelineResult {
  data: DDTimelineData | null;
  stageLabel: string | null;
  isLoading: boolean;
  /** True when the deal is at LOI+ or later (worth showing the card at all). */
  eligible: boolean;
}

const LOI_OR_LATER = new Set([
  "loi_submitted",
  "loi_negotiated",
  "loi_executed",
  "psa_drafting",
  "psa_executed",
  "due_diligence",
  "dd_extension",
  "deposits_hard",
  "financing",
  "clear_to_close",
  "closed",
]);

export function useDDTimeline(dealId: string | null | undefined): UseDDTimelineResult {
  const dealQ = useQuery<DealRow>({
    queryKey: ["/api/deals", dealId, "dd-timeline"],
    queryFn: () => fetchJson(`/api/deals/${dealId}`),
    enabled: !!dealId,
    staleTime: 60 * 1000,
  });

  const extsQ = useQuery<DDExtensionInput[]>({
    queryKey: ["/api/crm/deals", dealId, "extensions"],
    queryFn: () => fetchJson(`/api/crm/deals/${dealId}/extensions`),
    enabled: !!dealId,
    staleTime: 60 * 1000,
  });

  const deal = dealQ.data;
  const stage = deal?.stage ?? null;
  const eligible = !!deal && (stage == null || LOI_OR_LATER.has(stage) || !!deal.psaSignedDate);

  const data: DDTimelineData | null = deal
    ? {
        psaSignedDate: deal.psaSignedDate ?? null,
        ddPeriodDays:
          deal.ddPeriodDays ??
          computeDDPeriod(deal.psaSignedDate, deal.ddExpirationDate),
        ddExpirationDate: deal.ddExpirationDate ?? null,
        closingDate: deal.closingDate ?? null,
        extensions: extsQ.data ?? [],
      }
    : null;

  return {
    data,
    stageLabel: stage ? humanizeStage(stage) : null,
    isLoading: dealQ.isLoading || extsQ.isLoading,
    eligible,
  };
}

function computeDDPeriod(psa: string | null | undefined, exp: string | null | undefined): number | null {
  if (!psa || !exp) return null;
  const a = new Date(psa).getTime();
  const b = new Date(exp).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function humanizeStage(stage: string): string {
  return stage
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}
