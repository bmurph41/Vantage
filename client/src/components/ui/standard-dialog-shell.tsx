import { type ReactNode, type LucideIcon } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StandardDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
  footer?: ReactNode;
  primaryAction?: {
    label: string;
    loadingLabel?: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    variant?: "default" | "destructive";
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "sm:max-w-[425px]",
  md: "sm:max-w-[550px]",
  lg: "sm:max-w-[700px]",
  xl: "sm:max-w-[900px]",
};

export function StandardDialogShell({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  children,
  footer,
  primaryAction,
  secondaryAction,
  size = "md",
  className,
}: StandardDialogShellProps) {
  const showFooter = footer || primaryAction || secondaryAction;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(sizeClasses[size], className)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {Icon && (
              <div className="p-1.5 rounded-lg bg-[#1E4FAB]/10">
                <Icon className="h-5 w-5 text-[#1E4FAB]" />
              </div>
            )}
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="py-4">{children}</div>

        {showFooter && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            {footer || (
              <>
                {secondaryAction && (
                  <Button
                    variant="outline"
                    onClick={secondaryAction.onClick}
                    disabled={secondaryAction.disabled}
                  >
                    {secondaryAction.label}
                  </Button>
                )}
                {primaryAction && (
                  <Button
                    onClick={primaryAction.onClick}
                    disabled={primaryAction.disabled || primaryAction.loading}
                    className={cn(
                      primaryAction.variant !== "destructive" &&
                        "bg-[#1E4FAB] hover:bg-[#1a4294]"
                    )}
                    variant={primaryAction.variant}
                  >
                    {primaryAction.loading
                      ? (primaryAction.loadingLabel || `${primaryAction.label}...`)
                      : primaryAction.label}
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
