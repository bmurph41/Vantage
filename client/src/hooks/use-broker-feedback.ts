import { useQuery } from "@tanstack/react-query";

export interface BrokerFeedbackItem {
  id: string;
  brokerProfileId: string;
  verdict: "pursue" | "watch" | "pass";
  score: number;
  matchedCriteria: Array<{ key: string; label: string; passed: boolean; detail: string }>;
  failedCriteria: Array<{ key: string; label: string; passed: boolean; detail: string }>;
  narrative: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface BrokerFeedbackResponse {
  tier: "free" | "solo" | "pro" | "institutional";
  canSeeNarrative: boolean;
  canSeeModelingFeedback: boolean;
  feedback: BrokerFeedbackItem[];
}

export const brokerFeedbackKeys = {
  all: ["broker-feedback"] as const,
  listing: (id: string) => [...brokerFeedbackKeys.all, "listing", id] as const,
  modeling: (id: string) => [...brokerFeedbackKeys.all, "modeling", id] as const,
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export function useListingBrokerFeedback(listingId: string | null | undefined) {
  return useQuery<BrokerFeedbackResponse>({
    queryKey: brokerFeedbackKeys.listing(listingId || ""),
    queryFn: () => fetchJson(`/api/broker-feedback/listing/${listingId}`),
    enabled: !!listingId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useModelingProjectBrokerFeedback(projectId: string | null | undefined) {
  return useQuery<BrokerFeedbackResponse>({
    queryKey: brokerFeedbackKeys.modeling(projectId || ""),
    queryFn: () => fetchJson(`/api/broker-feedback/modeling-project/${projectId}`),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
