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
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
            {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
        {filters && <div className="mt-4 flex items-center gap-3">{filters}</div>}
      </div>
    </div>
  );
}
