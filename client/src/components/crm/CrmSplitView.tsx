import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

interface CrmSplitViewProps {
  list: React.ReactNode;
  details: React.ReactNode;
  isDetailOpen: boolean;
  onCloseDetail: () => void;
  detailWidth?: string;
  className?: string;
}

export function CrmSplitView({ 
  list, 
  details, 
  isDetailOpen, 
  onCloseDetail,
  detailWidth = "w-[480px]",
  className 
}: CrmSplitViewProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isDetailOpen) {
        onCloseDetail();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isDetailOpen, onCloseDetail]);

  return (
    <div className={cn("flex flex-1 overflow-hidden", className)}>
      <div className={cn(
        "flex-1 overflow-auto transition-all duration-200",
        isDetailOpen && "mr-0"
      )}>
        {list}
      </div>
      
      {isDetailOpen && (
        <div className={cn(
          "flex-shrink-0 border-l border-gray-200 bg-white overflow-hidden flex flex-col",
          detailWidth
        )}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <span className="text-sm font-medium text-gray-700">Details</span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onCloseDetail}
              className="h-7 w-7 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-auto">
            {details}
          </div>
        </div>
      )}
    </div>
  );
}
