import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Award, Building2, FileText, MapPin } from "lucide-react";

/**
 * Normalised shape the badge renders from — works for both broker_profiles
 * (post-approval) and broker_registrations (pre-approval fallback).
 */
interface BrokerCredentialData {
  displayName: string;
  companyName?: string | null;
  licenseNumber?: string | null;
  licenseState?: string | null;
  /** "approved" | "pending" | "suspended" | "rejected" — or "verified" for profiles */
  status: string;
}

interface Props {
  /** PRIMARY: id from broker_profiles table (approved broker) */
  brokerProfileId?: string;
  /** SECONDARY: platform userId — resolves profile then falls back to registration */
  userId?: string;
  /** FALLBACK: CRM contact email — for external contacts without platform accounts */
  contactEmail?: string;
}

const STATUS_DISPLAY: Record<string, { label: string; className: string }> = {
  verified: { label: "Verified", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
  approved: { label: "Verified", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
  pending: { label: "Pending Verification", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  suspended: { label: "Suspended", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  rejected: { label: "Not Verified", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
};

function normaliseProfile(p: any): BrokerCredentialData {
  const name =
    p.legalFirstName && p.legalLastName
      ? `${p.legalFirstName} ${p.legalLastName}`
      : p.displayName || p.legalName || "Broker";
  return {
    displayName: name,
    companyName: p.companyName ?? null,
    licenseNumber: p.licenseNumber ?? null,
    licenseState: p.licenseState ?? null,
    status: "verified",
  };
}

function normaliseRegistration(r: any): BrokerCredentialData {
  const name =
    r.legalFirstName && r.legalLastName
      ? `${r.legalFirstName} ${r.legalLastName}`
      : r.legalName || "Broker";
  return {
    displayName: name,
    companyName: r.companyName ?? null,
    licenseNumber: r.licenseNumber ?? null,
    licenseState: r.licenseState ?? null,
    status: r.status ?? "pending",
  };
}

export function BrokerCredentialBadge({ brokerProfileId, userId, contactEmail }: Props) {
  const enabled = !!(brokerProfileId || userId || contactEmail);

  const queryKey = brokerProfileId
    ? ["/api/broker-registration/profile", brokerProfileId]
    : userId
    ? ["/api/broker-registration/profile/by-user", userId]
    : ["/api/broker-registration/by-email", contactEmail];

  const { data, isLoading } = useQuery<BrokerCredentialData | null>({
    queryKey,
    queryFn: async () => {
      if (brokerProfileId) {
        const res = await fetch(
          `/api/broker-registration/profile/${encodeURIComponent(brokerProfileId)}`,
          { credentials: "include" },
        );
        if (!res.ok) return null;
        const json = await res.json();
        return json.profile ? normaliseProfile(json.profile) : null;
      }

      if (userId) {
        // Try profile first (approved broker); fall back to registration status.
        const profRes = await fetch(
          `/api/broker-registration/profile/by-user/${encodeURIComponent(userId)}`,
          { credentials: "include" },
        );
        if (profRes.ok) {
          const json = await profRes.json();
          if (json.profile) return normaliseProfile(json.profile);
        }
        const regRes = await fetch(
          `/api/broker-registration/by-user/${encodeURIComponent(userId)}`,
          { credentials: "include" },
        );
        if (!regRes.ok) return null;
        const regJson = await regRes.json();
        return regJson.registration ? normaliseRegistration(regJson.registration) : null;
      }

      if (contactEmail) {
        const res = await fetch(
          `/api/broker-registration/by-email?email=${encodeURIComponent(contactEmail)}`,
          { credentials: "include" },
        );
        if (!res.ok) return null;
        const json = await res.json();
        return json.registration ? normaliseRegistration(json.registration) : null;
      }

      return null;
    },
    enabled,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Looking up credentials…
      </div>
    );
  }

  if (!data) return null;

  const statusInfo = STATUS_DISPLAY[data.status] || STATUS_DISPLAY.pending;

  return (
    <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              Broker Credentials
            </span>
          </div>
          <Badge className={`text-xs ${statusInfo.className}`}>
            {statusInfo.label}
          </Badge>
        </div>

        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="font-medium text-foreground">{data.displayName}</span>
          </div>
          {data.companyName && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Building2 className="h-3 w-3 shrink-0" />
              <span>{data.companyName}</span>
            </div>
          )}
          {data.licenseNumber && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <FileText className="h-3 w-3 shrink-0" />
              <span>License #{data.licenseNumber}</span>
              {data.licenseState && (
                <span className="flex items-center gap-0.5">
                  <MapPin className="h-2.5 w-2.5" />
                  {data.licenseState}
                </span>
              )}
            </div>
          )}
          {!data.licenseNumber && (
            <p className="text-muted-foreground italic">No license number on file</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
