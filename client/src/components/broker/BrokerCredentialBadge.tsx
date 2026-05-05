import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Award, Building2, FileText, MapPin } from "lucide-react";

interface BrokerRegistration {
  id: string;
  legalFirstName?: string | null;
  legalLastName?: string | null;
  legalName: string;
  companyName: string;
  licenseNumber?: string | null;
  licenseState?: string | null;
  status: string;
  submittedAt?: string;
}

interface Props {
  contactEmail: string;
}

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  suspended: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  rejected: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export function BrokerCredentialBadge({ contactEmail }: Props) {
  const encodedEmail = encodeURIComponent(contactEmail);
  const { data, isLoading, isError } = useQuery<{ registration: BrokerRegistration | null }>({
    queryKey: ["/api/broker-registration/by-email", contactEmail],
    queryFn: async () => {
      const res = await fetch(`/api/broker-registration/by-email?email=${encodedEmail}`, {
        credentials: "include",
      });
      if (!res.ok) return { registration: null };
      return res.json();
    },
    enabled: !!contactEmail,
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

  if (isError || !data?.registration) return null;

  const reg = data.registration;
  const displayName =
    reg.legalFirstName && reg.legalLastName
      ? `${reg.legalFirstName} ${reg.legalLastName}`
      : reg.legalName;

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
          <Badge className={`text-xs ${STATUS_COLORS[reg.status] || STATUS_COLORS.pending}`}>
            {reg.status.charAt(0).toUpperCase() + reg.status.slice(1)}
          </Badge>
        </div>

        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="font-medium text-foreground">{displayName}</span>
          </div>
          {reg.companyName && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Building2 className="h-3 w-3 shrink-0" />
              <span>{reg.companyName}</span>
            </div>
          )}
          {reg.licenseNumber && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <FileText className="h-3 w-3 shrink-0" />
              <span>License #{reg.licenseNumber}</span>
              {reg.licenseState && (
                <span className="flex items-center gap-0.5">
                  <MapPin className="h-2.5 w-2.5" />
                  {reg.licenseState}
                </span>
              )}
            </div>
          )}
          {!reg.licenseNumber && (
            <p className="text-muted-foreground italic">No license number on file</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
