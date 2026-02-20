import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export function CollapsibleSection({
  title,
  icon,
  defaultOpen = true,
  children,
  badge,
  className,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn("border rounded-lg bg-card", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-muted/50 rounded-t-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          {icon}
          <span className="text-sm font-semibold">{title}</span>
          {badge}
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-1">
          {children}
        </div>
      )}
    </div>
  );
}

interface FieldRowProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

export function FieldRow({ label, value, className }: FieldRowProps) {
  return (
    <div className={cn("flex items-start justify-between py-1.5 group", className)}>
      <span className="text-xs text-muted-foreground font-medium min-w-[120px] pt-0.5">{label}</span>
      <div className="text-sm text-right flex-1 ml-4">{value || <span className="text-muted-foreground">-</span>}</div>
    </div>
  );
}

interface EditableFieldRowProps {
  label: string;
  value: React.ReactNode;
  editComponent: React.ReactNode;
  isEditing: boolean;
  className?: string;
}

export function EditableFieldRow({ label, value, editComponent, isEditing, className }: EditableFieldRowProps) {
  if (isEditing) {
    return (
      <div className={cn("space-y-1 py-1.5", className)}>
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        {editComponent}
      </div>
    );
  }
  return <FieldRow label={label} value={value} className={className} />;
}
