import { ReactNode } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ExternalLink, X } from "lucide-react";
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
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0 flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 bg-white sticky top-0 z-10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {Icon && (
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-blue-600" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-gray-900 truncate">{title}</h2>
                {description && (
                  <p className="text-sm text-gray-500 mt-0.5 truncate">{description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              {sourceLink && (
                <Link href={sourceLink}>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onOpenChange(false)}
                    data-testid="button-view-source"
                    className="text-sm"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {sourceLinkText}
                  </Button>
                </Link>
              )}
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-4">
          {children}
        </div>

        {actions && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-2 flex-wrap">
            {actions}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
