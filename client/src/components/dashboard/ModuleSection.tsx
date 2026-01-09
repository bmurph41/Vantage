import { cn, formatPercent } from "@/lib/utils";

interface ModuleSectionProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ModuleSection({
  title,
  description,
  actions,
  children,
  className,
}: ModuleSectionProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {(title || description || actions) && (
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            {title && (
              <h3 className="text-sm font-semibold text-gray-900 tracking-tight">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-gray-500 mt-0.5">{description}</p>
            )}
          </div>
          {actions && <div className="ml-4 flex-shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

interface MetricGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export function MetricGrid({ children, columns = 2, className }: MetricGridProps) {
  return (
    <div className={cn(
      "grid gap-3",
      columns === 1 && "grid-cols-1",
      columns === 2 && "grid-cols-1 sm:grid-cols-2",
      columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
      columns === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
      className
    )}>
      {children}
    </div>
  );
}

interface DataListProps {
  items: Array<{
    label: string;
    value: string | number;
    icon?: React.ReactNode;
    badge?: string;
    onClick?: () => void;
  }>;
  maxItems?: number;
  emptyMessage?: string;
}

export function DataList({ items, maxItems = 5, emptyMessage = "No data available" }: DataListProps) {
  const displayItems = items.slice(0, maxItems);

  if (displayItems.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {displayItems.map((item, idx) => (
        <div
          key={idx}
          onClick={item.onClick}
          className={cn(
            "flex items-center justify-between py-2 px-3 rounded-md -mx-3 hover:bg-gray-50 transition-colors text-xs",
            item.onClick && "cursor-pointer"
          )}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {item.icon && <div className="flex-shrink-0">{item.icon}</div>}
            <span className="text-gray-700 truncate">{item.label}</span>
            {item.badge && (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                {item.badge}
              </span>
            )}
          </div>
          <span className="font-semibold text-gray-900 ml-3 flex-shrink-0">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

interface StatBarProps {
  label: string;
  value: number;
  total: number;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'gray';
  showPercentage?: boolean;
}

export function StatBar({ label, value, total, color = 'blue', showPercentage = true }: StatBarProps) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    gray: 'bg-gray-500',
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className="text-gray-900 font-semibold">
          {value}
          {showPercentage && (
            <span className="text-gray-400 ml-1">({formatPercent(percentage)})</span>
          )}
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all duration-500", colorClasses[color])}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
