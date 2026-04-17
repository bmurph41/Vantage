import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const BASE = "/api/broker-subscriptions";

// ---- Types ----

export interface BrokerProfile {
  id: string;
  slug: string;
  displayName: string;
  companyName: string;
  bio?: string | null;
  headshotUrl?: string | null;
  coverImageUrl?: string | null;
  brokerTier?: string | null;
  specialties?: any;
  licenseNumber?: string | null;
  licenseState?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  yearsExperience?: number | null;
  followerCount?: number | null;
  totalListingsPublished?: number | null;
  avgResponseHours?: number | null;
  averageResponseHours?: number | string | null;
  medianResponseHours?: number | string | null;
  responseRate30d?: number | string | null;
  responseSamples30d?: number | null;
  verifiedClosedDealsCount?: number | null;
  verifiedClosedDealsVolume?: number | string | null;
  verifiedClosedDealsAssetClasses?: string[] | null;
  verifiedClosedDealsLastAt?: string | null;
  isPublishable?: boolean;
}

export interface BrokerTrustSignals {
  verifiedClosedDealsCount: number;
  verifiedClosedDealsVolume: number;
  verifiedClosedDealsAssetClasses: string[];
  verifiedClosedDealsLastAt: string | null;
  averageResponseHours: number | null;
  medianResponseHours: number | null;
  responseRate30d: number | null;
  responseSamples30d: number;
  followerCount: number;
  advisorySubscriberCount: number;
  yearsExperience: number | null;
  licenseState: string | null;
  licenseStatus: {
    level: "ok" | "warning" | "critical" | "expired" | "missing";
    expiresAt: string | null;
    daysUntilExpiry: number | null;
  };
  isFeatured: boolean;
}

export interface BrokerVerifiedDeal {
  id: string;
  title: string;
  assetClass: string | null;
  closedAt: string;
  volume: number | null;
  city: string | null;
  state: string | null;
}

export interface BrokerFeatureFlagState {
  flag: string;
  enabled: boolean;
  source: "env_force_off" | "env_force_on" | "org_override" | "default_off";
}
export type BrokerFeatureFlagsMap = Record<string, BrokerFeatureFlagState>;

export interface DirectoryFilters {
  q?: string;
  specialty?: string;
  state?: string;
  tier?: string;
  page?: number;
  pageSize?: number;
}

export interface DirectoryResponse {
  items: BrokerProfile[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface BrokerAdvisoryPackage {
  id: string;
  profileId: string;
  name: string;
  tagline?: string | null;
  description?: string | null;
  monthlyPrice?: number | null;
  annualPrice?: number | null;
  deliverables?: any;
  externalPaymentUrl?: string | null;
  isActive?: boolean;
}

export interface MarinaListing {
  id: string;
  title: string;
  city?: string | null;
  state?: string | null;
  askingPrice?: number | null;
  capRate?: number | null;
  annualRevenue?: number | null;
  assetClass?: string | null;
  publishedAt?: string | null;
  brokerProfileId?: string | null;
  [key: string]: any;
}

export interface BrokerAdvisoryContent {
  id: string;
  profileId: string;
  title: string;
  excerpt?: string | null;
  body?: string | null;
  isLocked?: boolean;
  visibility?: string | null;
  publishedAt?: string | null;
  brokerProfileId?: string | null;
  [key: string]: any;
}

export interface BrokerSubscription {
  id: string;
  userId: string;
  profileId: string;
  tier: "follow" | "advisory";
  status: string;
  packageId?: string | null;
  subscribedAt: string;
  notifyNewListings?: boolean;
  notifyAdvisoryContent?: boolean;
  notifyMarketUpdates?: boolean;
  brokerProfile?: BrokerProfile;
}

export interface BrokerAdvisoryMessage {
  id: string;
  subscriptionId: string;
  senderId: string;
  senderRole: "broker" | "user";
  body: string;
  createdAt: string;
}

export interface EffectiveBrokerEntitlement {
  tier: string;
  label: string;
  brokerFollowLimit: number;
  brokerAdvisoryLimit: number;
  savedSearchLimit: number;
  listingExportLimitMonthly: number;
  earlyAccessHours: number;
  allowBrokerMessaging: boolean;
  allowOffMarketAlerts: boolean;
  source?: string;
}

export interface ProfileDetailResponse {
  profile: BrokerProfile;
  packages: BrokerAdvisoryPackage[];
  listings: MarinaListing[];
  content: BrokerAdvisoryContent[];
  trustSignals?: BrokerTrustSignals;
  verifiedDeals?: BrokerVerifiedDeal[];
  viewerContext: {
    isFollowing: boolean;
    isAdvisorySubscriber: boolean;
    subscription?: BrokerSubscription | null;
  };
}

// ---- Error parsing helper ----

export function parseApiError(err: unknown): { status?: number; body?: any; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  const match = message.match(/^(\d{3}):\s*(.*)$/s);
  if (match) {
    const status = parseInt(match[1], 10);
    try {
      const body = JSON.parse(match[2]);
      return { status, body, message };
    } catch {
      return { status, body: { error: match[2] }, message };
    }
  }
  return { message };
}

// ---- Key factory ----

export const brokerKeys = {
  all: ["broker-subscriptions"] as const,
  directory: (filters: DirectoryFilters) =>
    ["broker-subscriptions", "directory", filters] as const,
  profile: (id: string) => ["broker-subscriptions", "profile", id] as const,
  mySubscriptions: () => ["broker-subscriptions", "me", "subscriptions"] as const,
  myEntitlement: () => ["broker-subscriptions", "me", "entitlement"] as const,
  feedListings: () => ["broker-subscriptions", "me", "feed", "listings"] as const,
  feedContent: () => ["broker-subscriptions", "me", "feed", "content"] as const,
  messages: (subId: string) =>
    ["broker-subscriptions", "me", "subscription", subId, "messages"] as const,
  featureFlags: () => ["broker-subscriptions", "feature-flags"] as const,
};

export function useBrokerFeatureFlags() {
  return useQuery<{ flags: BrokerFeatureFlagsMap }>({
    queryKey: brokerKeys.featureFlags(),
    queryFn: () => getJson(`${BASE}/feature-flags`),
    staleTime: 60_000,
  });
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

// ---- Queries ----

export function useBrokerDirectory(filters: DirectoryFilters) {
  return useQuery<DirectoryResponse>({
    queryKey: brokerKeys.directory(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.specialty) params.set("specialty", filters.specialty);
      if (filters.state) params.set("state", filters.state);
      if (filters.tier) params.set("tier", filters.tier);
      if (filters.page) params.set("page", String(filters.page));
      if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
      const qs = params.toString();
      return getJson<DirectoryResponse>(`${BASE}/directory${qs ? `?${qs}` : ""}`);
    },
  });
}

export function useBrokerProfile(profileId: string | undefined | null) {
  return useQuery<ProfileDetailResponse>({
    queryKey: brokerKeys.profile(profileId || ""),
    enabled: !!profileId,
    queryFn: () => getJson<ProfileDetailResponse>(`${BASE}/profiles/${profileId}`),
  });
}

export function useMyBrokerSubscriptions() {
  return useQuery<{ subscriptions: BrokerSubscription[]; entitlement: EffectiveBrokerEntitlement }>({
    queryKey: brokerKeys.mySubscriptions(),
    queryFn: () => getJson(`${BASE}/me/subscriptions`),
  });
}

export function useMyBrokerEntitlement() {
  return useQuery<EffectiveBrokerEntitlement>({
    queryKey: brokerKeys.myEntitlement(),
    queryFn: () => getJson(`${BASE}/me/entitlement`),
  });
}

export function useBrokerFeed() {
  const listings = useQuery<{ items: MarinaListing[]; total: number }>({
    queryKey: brokerKeys.feedListings(),
    queryFn: () => getJson(`${BASE}/me/feed/listings?limit=50`),
  });
  const content = useQuery<{ items: BrokerAdvisoryContent[] }>({
    queryKey: brokerKeys.feedContent(),
    queryFn: () => getJson(`${BASE}/me/feed/content?limit=25`),
  });
  return {
    listings,
    content,
    isLoading: listings.isLoading || content.isLoading,
    isError: listings.isError || content.isError,
  };
}

export function useBrokerMessages(subId: string | null | undefined) {
  return useQuery<{ messages: BrokerAdvisoryMessage[] }>({
    queryKey: brokerKeys.messages(subId || ""),
    enabled: !!subId,
    queryFn: () => getJson(`${BASE}/me/subscriptions/${subId}/messages`),
  });
}

// ---- Mutations ----

function invalidateSubAndEntitlement(qc: ReturnType<typeof useQueryClient>, profileId?: string) {
  qc.invalidateQueries({ queryKey: brokerKeys.mySubscriptions() });
  qc.invalidateQueries({ queryKey: brokerKeys.myEntitlement() });
  if (profileId) {
    qc.invalidateQueries({ queryKey: brokerKeys.profile(profileId) });
  }
  qc.invalidateQueries({ queryKey: brokerKeys.all });
}

export function useFollowBroker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profileId: string) => {
      const res = await apiRequest("POST", `${BASE}/profiles/${profileId}/follow`);
      return res.json();
    },
    onSuccess: (_data, profileId) => invalidateSubAndEntitlement(qc, profileId),
  });
}

export function useUnfollowBroker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profileId: string) => {
      const res = await apiRequest("DELETE", `${BASE}/profiles/${profileId}/follow`);
      return res.json();
    },
    onSuccess: (_data, profileId) => invalidateSubAndEntitlement(qc, profileId),
  });
}

export function useRequestAdvisory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { profileId: string; packageId: string }) => {
      const res = await apiRequest(
        "POST",
        `${BASE}/profiles/${vars.profileId}/advisory/request`,
        { packageId: vars.packageId },
      );
      return res.json();
    },
    onSuccess: (_data, vars) => invalidateSubAndEntitlement(qc, vars.profileId),
  });
}

export function useUpdateSubscriptionNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      notifyNewListings?: boolean;
      notifyAdvisoryContent?: boolean;
      notifyMarketUpdates?: boolean;
    }) => {
      const { id, ...body } = vars;
      const res = await apiRequest("PATCH", `${BASE}/me/subscriptions/${id}/notifications`, body);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brokerKeys.mySubscriptions() });
    },
  });
}

export function useSendBrokerMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { subId: string; body: string }) => {
      const res = await apiRequest(
        "POST",
        `${BASE}/me/subscriptions/${vars.subId}/messages`,
        { body: vars.body },
      );
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: brokerKeys.messages(vars.subId) });
    },
  });
}
