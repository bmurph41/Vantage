import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  ExternalLink
} from "lucide-react";

export type DocumentRequirementStatus = 
  | "requested" 
  | "received" 
  | "verified" 
  | "rejected" 
  | "outdated" 
  | "external_unavailable";

interface DocumentStatusChipProps {
  status: DocumentRequirementStatus;
  className?: string;
  showIcon?: boolean;
}

const statusConfig = {
  requested: {
    label: "Requested",
    icon: Clock,
    variant: "secondary" as const,
    className: "bg-gray-100 text-gray-700 border-gray-200",
  },
  received: {
    label: "Received",
    icon: FileText,
    variant: "secondary" as const,
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  verified: {
    label: "Verified",
    icon: CheckCircle,
    variant: "secondary" as const,
    className: "bg-green-100 text-green-700 border-green-200",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    variant: "destructive" as const,
    className: "bg-red-100 text-red-700 border-red-200",
  },
  outdated: {
    label: "Outdated",
    icon: AlertTriangle,
    variant: "secondary" as const,
    className: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
  external_unavailable: {
    label: "External Unavailable",
    icon: ExternalLink,
    variant: "secondary" as const,
    className: "bg-orange-100 text-orange-700 border-orange-200",
  },
} as const;

export function DocumentStatusChip({ 
  status, 
  className, 
  showIcon = true 
}: DocumentStatusChipProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium border",
        config.className,
        className
      )}
      data-testid={`document-status-${status}`}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  );
}

// Helper function to get status priority for sorting
export function getDocumentStatusPriority(status: DocumentRequirementStatus): number {
  const priorities = {
    rejected: 1,
    external_unavailable: 2,
    outdated: 3,
    requested: 4,
    received: 5,
    verified: 6,
  };
  return priorities[status] || 0;
}

// Helper function to check if status indicates completion
export function isDocumentStatusComplete(status: DocumentRequirementStatus): boolean {
  return status === "verified";
}

// Helper function to check if status indicates a blocking issue
export function isDocumentStatusBlocking(status: DocumentRequirementStatus): boolean {
  return ["rejected", "external_unavailable", "outdated"].includes(status);
}