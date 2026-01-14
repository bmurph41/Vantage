import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";

interface CrmDetailsPanelProps {
  title: string;
  subtitle?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function CrmDetailsPanel({
  title,
  subtitle,
  onEdit,
  onDelete,
  actions,
  children,
  className,
}: CrmDetailsPanelProps) {
  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-gray-900 truncate">{title}</h2>
            {subtitle && (
              <p className="text-sm text-gray-500 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-1 ml-3">
            {onEdit && (
              <Button variant="ghost" size="sm" onClick={onEdit} className="h-8 w-8 p-0">
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            {actions}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-4 py-4">
        {children}
      </div>
    </div>
  );
}

interface CrmDetailSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function CrmDetailSection({ title, children, className }: CrmDetailSectionProps) {
  return (
    <div className={cn("mb-6", className)}>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

interface CrmDetailFieldProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

export function CrmDetailField({ label, value, className }: CrmDetailFieldProps) {
  return (
    <div className={cn("flex items-start py-2", className)}>
      <span className="text-sm text-gray-500 w-28 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-900 flex-1">{value || "—"}</span>
    </div>
  );
}
