import { Badge } from "@/components/ui/badge";
import { Anchor, Building2, Briefcase, HelpCircle } from "lucide-react";
import type { ModelingProject } from "@shared/schema";

type ProjectContextType = "OWNED" | "ACQUISITION" | "BROKER_LISTING" | "UNKNOWN";

interface ProjectTypeBadgeProps {
  project: ModelingProject;
  size?: "sm" | "md";
}

function getProjectType(project: ModelingProject): ProjectContextType {
  if (project.dealId || project.ddProjectId) {
    return "ACQUISITION";
  }
  if (project.brokerId) {
    return "BROKER_LISTING";
  }
  return "OWNED";
}

const typeConfig: Record<ProjectContextType, {
  label: string;
  icon: typeof Anchor;
  variant: "default" | "secondary" | "outline" | "destructive";
  className: string;
}> = {
  OWNED: {
    label: "Owned",
    icon: Anchor,
    variant: "default",
    className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-200",
  },
  ACQUISITION: {
    label: "Deal",
    icon: Building2,
    variant: "secondary",
    className: "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-200",
  },
  BROKER_LISTING: {
    label: "Broker",
    icon: Briefcase,
    variant: "outline",
    className: "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-200",
  },
  UNKNOWN: {
    label: "Unknown",
    icon: HelpCircle,
    variant: "outline",
    className: "",
  },
};

export default function ProjectTypeBadge({ project, size = "md" }: ProjectTypeBadgeProps) {
  const projectType = getProjectType(project);
  const config = typeConfig[projectType];
  const Icon = config.icon;

  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1";
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <Badge
      variant={config.variant}
      className={`${config.className} ${sizeClasses} gap-1 font-medium`}
    >
      <Icon className={iconSize} />
      {config.label}
    </Badge>
  );
}

export { getProjectType, type ProjectContextType };
