import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export type BrokerRegistrationStatus = "pending" | "approved" | "rejected" | "suspended" | "all";

export interface BrokerRegistration {
  id: string;
  userId: string;
  orgId: string;
  legalName: string;
  companyName: string;
  email: string;
  phone: string | null;
  licenseNumber: string | null;
  licenseState: string | null;
  licenseExpiresAt: string | null;
  licenseDocumentUrl: string | null;
  yearsExperience: number | null;
  specialties: string[] | null;
  bio: string | null;
  website: string | null;
  linkedinUrl: string | null;
  status: string;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface BrokerProfile {
  id: string;
  registrationId: string;
  slug: string;
  displayName: string;
  companyName: string;
  brokerTier: string | null;
  isPublishable: boolean;
}

export interface PaginatedRegistrations {
  items: BrokerRegistration[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

const BASE = "/api/admin/broker";

export function brokerAdminKeys() {
  return {
    all: ["broker-admin"] as const,
    list: (status: BrokerRegistrationStatus, page: number, pageSize: number) =>
      ["broker-admin", "registrations", status, page, pageSize] as const,
    detail: (id: string) => ["broker-admin", "registration", id] as const,
  };
}

export function useBrokerRegistrations(params: {
  status: BrokerRegistrationStatus;
  page: number;
  pageSize: number;
}) {
  const { status, page, pageSize } = params;
  return useQuery<PaginatedRegistrations>({
    queryKey: brokerAdminKeys().list(status, page, pageSize),
    queryFn: async () => {
      const res = await fetch(
        `${BASE}/registrations?status=${encodeURIComponent(status)}&page=${page}&pageSize=${pageSize}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
}

export function useBrokerRegistrationDetail(id: string | null) {
  return useQuery<{ registration: BrokerRegistration; profile: BrokerProfile | null }>({
    queryKey: brokerAdminKeys().detail(id || ""),
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`${BASE}/registrations/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
}

export function useApproveRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; brokerTier?: string; notes?: string }) => {
      const res = await apiRequest("POST", `${BASE}/registrations/${vars.id}/approve`, {
        brokerTier: vars.brokerTier,
        notes: vars.notes,
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brokerAdminKeys().all });
    },
  });
}

export function useRejectRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; reason: string }) => {
      const res = await apiRequest("POST", `${BASE}/registrations/${vars.id}/reject`, {
        reason: vars.reason,
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brokerAdminKeys().all });
    },
  });
}

export function useSuspendRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; reason: string }) => {
      const res = await apiRequest("POST", `${BASE}/registrations/${vars.id}/suspend`, {
        reason: vars.reason,
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brokerAdminKeys().all });
    },
  });
}
