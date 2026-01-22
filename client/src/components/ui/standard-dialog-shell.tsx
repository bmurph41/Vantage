import { type ReactNode, type LucideIcon } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  showProgressBar?: boolean;
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
  showProgressBar = false,
}: StandardDialogShellProps) {
  const showFooter = footer || primaryAction || secondaryAction;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        sizeClasses[size], 
        "flex flex-col max-h-[90vh]",
        className
      )}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {Icon && (
              <div className="p-1.5 rounded-lg bg-[#1E4FAB]/10">
                <Icon className="h-5 w-5 text-[#1E4FAB]" />
              </div>
            )}
            {title}
          </DialogTitle>
          {showProgressBar && (
            <div className="w-24 h-1 bg-[#1E4FAB] rounded-full mt-2" />
          )}
          {description && (
            <DialogDescription className="pt-1">{description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 min-h-0">{children}</div>

        {showFooter && (
          <div className="flex-shrink-0 flex justify-between items-center gap-2 pt-4 border-t">
            {footer || (
              <>
                <div>
                  {secondaryAction && (
                    <Button
                      variant="ghost"
                      onClick={secondaryAction.onClick}
                      disabled={secondaryAction.disabled}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      {secondaryAction.label}
                    </Button>
                  )}
                </div>
                <div>
                  {primaryAction && (
                    <Button
                      onClick={primaryAction.onClick}
                      disabled={primaryAction.disabled || primaryAction.loading}
                      className={cn(
                        "gap-1",
                        primaryAction.variant !== "destructive" &&
                          "bg-[#1E4FAB] hover:bg-[#1a4294]"
                      )}
                      variant={primaryAction.variant}
                    >
                      {primaryAction.loading
                        ? (primaryAction.loadingLabel || `${primaryAction.label}...`)
                        : primaryAction.label}
                      {!primaryAction.loading && <ChevronRight className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
