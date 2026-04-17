import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const BASE = "/api/broker-dashboard";

export const brokerDashboardKeys = {
  all: ["broker-dashboard"] as const,
  myProfile: () => [...brokerDashboardKeys.all, "my-profile"] as const,
  packages: () => [...brokerDashboardKeys.all, "packages"] as const,
  content: () => [...brokerDashboardKeys.all, "content"] as const,
  subscribers: (filters: { status?: string; tier?: string; page?: number }) =>
    [...brokerDashboardKeys.all, "subscribers", filters] as const,
  analyticsOverview: () => [...brokerDashboardKeys.all, "analytics", "overview"] as const,
  analyticsFollowers: (days: number) =>
    [...brokerDashboardKeys.all, "analytics", "followers", days] as const,
  claims: (profileId: string | undefined) =>
    ["broker-claims", "me", profileId] as const,
  unclaimed: (profileId: string | undefined) =>
    ["broker-claims", "unclaimed", profileId] as const,
};

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface BrokerProfile {
  id: string;
  userId: string;
  orgId: string;
  registrationId: string;
  slug: string;
  displayName: string;
  companyName: string;
  headshotUrl: string | null;
  coverImageUrl: string | null;
  bio: string | null;
  specialties: unknown;
  languages: unknown;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  linkedinUrl: string | null;
  isPublishable: boolean;
  publishedAt: string | null;
  brokerTier: string | null;
  followerCount: number;
  advisorySubscriberCount: number;
}

export interface BrokerMyProfileResponse {
  profile: BrokerProfile;
  stats: {
    packageCount: number;
    contentCount: number;
    listingsCount: number;
    followerCount: number;
    advisorySubscriberCount: number;
    verifiedClosedDealsCount?: number;
    verifiedClosedDealsVolume?: number;
    medianResponseHours?: number | null;
    responseRate30d?: number | null;
    responseSamples30d?: number;
  };
  tierDefinition: {
    tier: string;
    label: string;
    maxAdvisoryPackages: number;
    maxPublishedListings: number;
  } | null;
  licenseStatus?: {
    level: "ok" | "warning" | "critical" | "expired" | "missing";
    expiresAt: string | null;
    daysUntilExpiry: number | null;
    state: string | null;
  } | null;
  recentVerifiedDeals?: Array<{
    id: string;
    title: string;
    assetClass: string | null;
    closedAt: string;
    volume: number | null;
    city: string | null;
    state: string | null;
  }>;
  featureFlags?: Record<string, { flag: string; enabled: boolean; source: string }>;
}

export interface AdvisoryPackage {
  id: string;
  brokerProfileId: string;
  name: string;
  tagline: string | null;
  description: string | null;
  deliverables: unknown;
  priceMonthlyCents: number | null;
  priceAnnualCents: number | null;
  currency: string | null;
  cadence: string | null;
  externalPaymentUrl: string | null;
  maxSubscribers: number | null;
  sortOrder: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface AdvisoryContentItem {
  id: string;
  brokerProfileId: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  contentType: string;
  visibility: string;
  teaserExcerpt: string | null;
  publishedAt: string | null;
  isPinned: boolean | null;
  viewCount: number;
  likeCount: number;
  createdAt: string;
}

export interface BrokerSubscriber {
  id: string;
  userId: string;
  brokerProfileId: string;
  tier: string;
  status: string;
  advisoryPackageId: string | null;
  grantedBy: string | null;
  externalPaymentReference: string | null;
  subscribedAt: string;
  advisoryStartedAt: string | null;
  canceledAt: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Profile
// ────────────────────────────────────────────────────────────────────────────

export function useMyBrokerProfile() {
  return useQuery<BrokerMyProfileResponse>({
    queryKey: brokerDashboardKeys.myProfile(),
    queryFn: async () => {
      const res = await fetch(`${BASE}/my-profile`, { credentials: "include" });
      if (res.status === 404) throw new Error("NO_BROKER_PROFILE");
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    retry: (count, err: any) => {
      if (err?.message === "NO_BROKER_PROFILE") return false;
      return count < 2;
    },
  });
}

export function useUpdateMyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<BrokerProfile>) => {
      const res = await apiRequest("PATCH", `${BASE}/my-profile`, updates);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brokerDashboardKeys.myProfile() });
    },
  });
}

export function usePublishMyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `${BASE}/my-profile/publish`, {});
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brokerDashboardKeys.myProfile() });
      qc.invalidateQueries({ queryKey: ["broker-claims"] });
    },
  });
}

export function useUnpublishMyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `${BASE}/my-profile/unpublish`, {});
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brokerDashboardKeys.myProfile() });
      qc.invalidateQueries({ queryKey: ["broker-claims"] });
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Advisory Packages
// ────────────────────────────────────────────────────────────────────────────

export function useAdvisoryPackages() {
  return useQuery<{
    packages: AdvisoryPackage[];
    limits: { maxAdvisoryPackages: number; tier: string | null; current: number };
  }>({
    queryKey: brokerDashboardKeys.packages(),
    queryFn: async () => {
      const res = await fetch(`${BASE}/advisory-packages`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
}

export function useCreateAdvisoryPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<AdvisoryPackage>) => {
      const res = await apiRequest("POST", `${BASE}/advisory-packages`, data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brokerDashboardKeys.packages() });
    },
  });
}

export function useUpdateAdvisoryPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; data: Partial<AdvisoryPackage> }) => {
      const res = await apiRequest("PATCH", `${BASE}/advisory-packages/${vars.id}`, vars.data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brokerDashboardKeys.packages() });
    },
  });
}

export function useDeleteAdvisoryPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `${BASE}/advisory-packages/${id}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brokerDashboardKeys.packages() });
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Content
// ────────────────────────────────────────────────────────────────────────────

export function useBrokerContent() {
  return useQuery<{ items: AdvisoryContentItem[] }>({
    queryKey: brokerDashboardKeys.content(),
    queryFn: async () => {
      const res = await fetch(`${BASE}/content`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
}

export function useCreateContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<AdvisoryContentItem>) => {
      const res = await apiRequest("POST", `${BASE}/content`, data);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: brokerDashboardKeys.content() }),
  });
}

export function useUpdateContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; data: Partial<AdvisoryContentItem> }) => {
      const res = await apiRequest("PATCH", `${BASE}/content/${vars.id}`, vars.data);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: brokerDashboardKeys.content() }),
  });
}

export function usePublishContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `${BASE}/content/${id}/publish`, {});
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: brokerDashboardKeys.content() }),
  });
}

export function useUnpublishContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `${BASE}/content/${id}/unpublish`, {});
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: brokerDashboardKeys.content() }),
  });
}

export function useDeleteContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `${BASE}/content/${id}`);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: brokerDashboardKeys.content() }),
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Subscribers
// ────────────────────────────────────────────────────────────────────────────

export function useBrokerSubscribers(filters: { status?: string; tier?: string; page?: number }) {
  return useQuery<{
    items: BrokerSubscriber[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>({
    queryKey: brokerDashboardKeys.subscribers(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.tier) params.set("tier", filters.tier);
      if (filters.page) params.set("page", String(filters.page));
      const res = await fetch(`${BASE}/subscribers?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
}

export function useGrantAdvisoryAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { subscriptionId: string; paymentReference?: string }) => {
      const res = await apiRequest(
        "POST",
        `${BASE}/subscribers/${vars.subscriptionId}/grant-advisory`,
        { paymentReference: vars.paymentReference },
      );
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brokerDashboardKeys.all });
    },
  });
}

export function useRevokeSubscriber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      const res = await apiRequest("POST", `${BASE}/subscribers/${subscriptionId}/revoke`, {});
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brokerDashboardKeys.all });
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Analytics
// ────────────────────────────────────────────────────────────────────────────

export interface AnalyticsOverview {
  totalFollowers: number;
  totalAdvisorySubscribers: number;
  pendingAdvisoryRequests: number;
  listingsPublished: number;
  contentPublished: number;
  newFollowersLast30Days: number;
  recentActivity: BrokerSubscriber[];
}

export function useAnalyticsOverview() {
  return useQuery<AnalyticsOverview>({
    queryKey: brokerDashboardKeys.analyticsOverview(),
    queryFn: async () => {
      const res = await fetch(`${BASE}/analytics/overview`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
}

export function useFollowersOverTime(days = 30) {
  return useQuery<{ series: Array<{ date: string; count: number }>; days: number }>({
    queryKey: brokerDashboardKeys.analyticsFollowers(days),
    queryFn: async () => {
      const res = await fetch(`${BASE}/analytics/followers-over-time?days=${days}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Listings / Claims (uses existing /api/broker-claims routes)
// ────────────────────────────────────────────────────────────────────────────

export function useMyClaims(brokerProfileId: string | undefined) {
  return useQuery<{ items: unknown[] }>({
    queryKey: brokerDashboardKeys.claims(brokerProfileId),
    enabled: !!brokerProfileId,
    queryFn: async () => {
      const res = await fetch(
        `/api/broker-claims/me/claims?brokerProfileId=${brokerProfileId}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
}

export function useUnclaimedSuggestions(brokerProfileId: string | undefined) {
  return useQuery<{ items: Array<{ id: string; title?: string; brokerEmail?: string; brokerPhone?: string }> }>({
    queryKey: brokerDashboardKeys.unclaimed(brokerProfileId),
    enabled: !!brokerProfileId,
    queryFn: async () => {
      const res = await fetch(
        `/api/broker-claims/unclaimed?brokerProfileId=${brokerProfileId}&matchHint=true`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
}

export function useClaimListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { listingId: string; brokerProfileId: string }) => {
      const res = await apiRequest("POST", `/api/broker-claims/claim`, vars);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broker-claims"] });
    },
  });
}
