import { cn } from "@/lib/utils";

interface CrmTopBarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
  className?: string;
}

export function CrmTopBar({ title, subtitle, actions, filters, className }: CrmTopBarProps) {
  return (
    <div className={cn("flex-shrink-0 bg-white border-b border-gray-200", className)}>
      <div className="px-3 md:px-6 py-3 md:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-semibold text-gray-900 truncate">{title}</h1>
            {subtitle && <p className="text-xs md:text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 flex-shrink-0 overflow-x-auto">{actions}</div>}
        </div>
        {filters && <div className="mt-3 md:mt-4 flex items-center gap-2 md:gap-3 overflow-x-auto pb-1">{filters}</div>}
      </div>
    </div>
  );
}
