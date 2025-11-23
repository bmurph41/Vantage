import { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { Link } from "wouter";

export interface DetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  sourceLink?: string;
  sourceLinkText?: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function DetailPanel({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  sourceLink,
  sourceLinkText = "View Full Page",
  children,
  actions,
}: DetailPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {Icon && <Icon className="h-5 w-5 text-blue-600" />}
              <SheetTitle>{title}</SheetTitle>
            </div>
            {sourceLink && (
              <Link href={sourceLink}>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  data-testid="button-view-source"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {sourceLinkText}
                </Button>
              </Link>
            )}
          </div>
          {description && (
            <SheetDescription>{description}</SheetDescription>
          )}
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {children}
        </div>

        {actions && (
          <div className="mt-6 pt-4 border-t flex gap-2 flex-wrap">
            {actions}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
