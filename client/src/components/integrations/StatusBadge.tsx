import { cn } from "@/lib/utils";
import { Check, AlertCircle, Clock, Plug } from "lucide-react";

interface StatusBadgeProps {
  status: "available" | "connected" | "pending" | "error";
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const configs = {
    available: {
      label: "Available",
      icon: Plug,
      className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    },
    connected: {
      label: "Connected",
      icon: Check,
      className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    },
    pending: {
      label: "Pending",
      icon: Clock,
      className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    },
    error: {
      label: "Error",
      icon: AlertCircle,
      className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    },
  };

  const config = configs[status] || configs.available;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        config.className,
        className
      )}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}
