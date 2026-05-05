import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Award, Building2, FileText, MapPin } from "lucide-react";
import type { BrokerProfile, BrokerRegistration } from "@shared/schema";

/**
 * Normalised credential shape rendered by the badge — derived from either a
 * broker_profiles row (post-approval) or a broker_registrations row (pre-approval).
 */
interface BrokerCredentialData {
  displayName: string;
  companyName: string | null;
  licenseNumber: string | null;
  licenseState: string | null;
  /** "verified" for approved profiles; registration status for pending/suspended/rejected */
  status: "verified" | "pending" | "suspended" | "rejected" | "approved";
}

interface Props {
  /** PRIMARY: id from broker_profiles table — fetched via /profile/:profileId */
  brokerProfileId?: string;
  /** SECONDARY: platform userId — tries profile then falls back to registration */
  userId?: string;
  /** FALLBACK: CRM contact email — resolves profile by contactEmail field, then registration */
  contactEmail?: string;
}

const STATUS_DISPLAY: Record<string, { label: string; className: string }> = {
  verified: {
    label: "Verified",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  },
  approved: {
    label: "Verified",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  },
  pending: {
    label: "Pending Verification",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  },
  suspended: {
    label: "Suspended",
    className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
  rejected: {
    label: "Not Verified",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
};

function fromProfile(p: BrokerProfile): BrokerCredentialData {
  const displayName =
    p.legalFirstName && p.legalLastName
      ? `${p.legalFirstName} ${p.legalLastName}`
      : p.displayName;
  return {
    displayName,
    companyName: p.companyName,
    licenseNumber: p.licenseNumber ?? null,
    licenseState: p.licenseState ?? null,
    status: "verified",
  };
}

function fromRegistration(r: BrokerRegistration): BrokerCredentialData {
  const displayName =
    r.legalFirstName && r.legalLastName
      ? `${r.legalFirstName} ${r.legalLastName}`
      : r.legalName;
  return {
    displayName,
    companyName: r.companyName,
    licenseNumber: r.licenseNumber ?? null,
    licenseState: r.licenseState ?? null,
    status: (r.status as BrokerCredentialData["status"]) ?? "pending",
  };
}

async function fetchProfile(profileId: string): Promise<BrokerCredentialData | null> {
  const res = await fetch(
    `/api/broker-registration/profile/${encodeURIComponent(profileId)}`,
    { credentials: "include" },
  );
  if (!res.ok) return null;
  const json = await res.json() as { profile: BrokerProfile | null };
  return json.profile ? fromProfile(json.profile) : null;
}

async function fetchProfileByUser(userId: string): Promise<BrokerCredentialData | null> {
  const profRes = await fetch(
    `/api/broker-registration/profile/by-user/${encodeURIComponent(userId)}`,
    { credentials: "include" },
  );
  if (profRes.ok) {
    const json = await profRes.json() as { profile: BrokerProfile | null };
    if (json.profile) return fromProfile(json.profile);
  }
  const regRes = await fetch(
    `/api/broker-registration/by-user/${encodeURIComponent(userId)}`,
    { credentials: "include" },
  );
  if (!regRes.ok) return null;
  const regJson = await regRes.json() as { registration: BrokerRegistration | null };
  return regJson.registration ? fromRegistration(regJson.registration) : null;
}

async function fetchByEmail(email: string): Promise<BrokerCredentialData | null> {
  const profRes = await fetch(
    `/api/broker-registration/profile/by-email?email=${encodeURIComponent(email)}`,
    { credentials: "include" },
  );
  if (profRes.ok) {
    const json = await profRes.json() as { profile: BrokerProfile | null };
    if (json.profile) return fromProfile(json.profile);
  }
  const regRes = await fetch(
    `/api/broker-registration/by-email?email=${encodeURIComponent(email)}`,
    { credentials: "include" },
  );
  if (!regRes.ok) return null;
  const regJson = await regRes.json() as { registration: BrokerRegistration | null };
  return regJson.registration ? fromRegistration(regJson.registration) : null;
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
    queryFn: () => {
      if (brokerProfileId) return fetchProfile(brokerProfileId);
      if (userId) return fetchProfileByUser(userId);
      if (contactEmail) return fetchByEmail(contactEmail);
      return Promise.resolve(null);
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

  const statusInfo = STATUS_DISPLAY[data.status] ?? STATUS_DISPLAY.pending;

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
          {data.licenseNumber ? (
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
          ) : (
            <p className="text-muted-foreground italic">No license number on file</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
