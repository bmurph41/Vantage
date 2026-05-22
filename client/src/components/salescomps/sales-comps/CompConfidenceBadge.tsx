import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ShieldCheck, ShieldAlert, Users, FileCheck } from "lucide-react";

interface CompConfidenceBadgeProps {
  verificationStatus?: string | null;
  dataQualityScore?: number | null;
  sourceConfidence?: number | null;
  dataSource?: string | null;
  size?: "sm" | "md";
}

export type ConfidenceTier = "document-verified" | "community-verified" | "unverified";

export function getConfidenceTier(
  verificationStatus?: string | null,
  dataQualityScore?: number | null,
  sourceConfidence?: number | null,
  dataSource?: string | null
): ConfidenceTier {
  if (verificationStatus === "verified") return "document-verified";
  if (
    verificationStatus === "pending" ||
    (dataQualityScore && dataQualityScore >= 60) ||
    (sourceConfidence && sourceConfidence >= 60) ||
    dataSource === "broker" ||
    dataSource === "direct_research"
  ) {
    return "community-verified";
  }
  return "unverified";
}

const TIER_CONFIG = {
  "document-verified": {
    label: "Document-Verified",
    icon: FileCheck,
    className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300",
    description: "This comp has been verified by platform administrators and backed by closing documents.",
  },
  "community-verified": {
    label: "Community-Verified",
    icon: Users,
    className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
    description: "This comp was contributed by a broker or industry professional with source attribution.",
  },
  unverified: {
    label: "Unverified",
    icon: ShieldAlert,
    className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
    description: "This comp has not been independently verified. Use with caution.",
  },
};

export default function CompConfidenceBadge({
  verificationStatus,
  dataQualityScore,
  sourceConfidence,
  dataSource,
  size = "md",
}: CompConfidenceBadgeProps) {
  const tier = getConfidenceTier(verificationStatus, dataQualityScore, sourceConfidence, dataSource);
  const config = TIER_CONFIG[tier];
  const Icon = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={`${config.className} cursor-default border font-medium ${size === "sm" ? "text-xs px-1.5 py-0" : "text-xs px-2 py-0.5"}`}
        >
          <Icon className={`${size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} mr-1`} />
          {config.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="text-xs">{config.description}</p>
        {dataQualityScore != null && (
          <p className="text-xs text-muted-foreground mt-1">Data quality score: {dataQualityScore}/100</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
