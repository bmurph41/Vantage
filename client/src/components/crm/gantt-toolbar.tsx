import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ZoomIn, ZoomOut, CalendarDays, Download, Printer, Users, Layers,
} from "lucide-react";

export type ZoomLevel = "day" | "week" | "month";
export type GroupBy = "deal" | "stage" | "owner";

interface GanttToolbarProps {
  zoomLevel: ZoomLevel;
  onZoomChange: (level: ZoomLevel) => void;
  groupBy?: GroupBy;
  onGroupByChange?: (groupBy: GroupBy) => void;
  showGroupBy?: boolean;
  onTodayClick: () => void;
  onExportPng?: () => void;
  onPrint?: () => void;
  className?: string;
}

const ZOOM_ORDER: ZoomLevel[] = ["day", "week", "month"];

export default function GanttToolbar({
  zoomLevel,
  onZoomChange,
  groupBy = "deal",
  onGroupByChange,
  showGroupBy = false,
  onTodayClick,
  onExportPng,
  onPrint,
  className = "",
}: GanttToolbarProps) {
  const zoomIdx = ZOOM_ORDER.indexOf(zoomLevel);

  return (
    <div className={`flex items-center justify-between px-4 py-2 border-b bg-white ${className}`}>
      <div className="flex items-center gap-3">
        {/* Group By */}
        {showGroupBy && onGroupByChange && (
          <Select value={groupBy} onValueChange={(v) => onGroupByChange(v as GroupBy)}>
            <SelectTrigger className="w-32 h-8 text-sm">
              <Layers className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deal">By Deal</SelectItem>
              <SelectItem value="stage">By Stage</SelectItem>
              <SelectItem value="owner">By Owner</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Zoom */}
        <div className="flex items-center gap-1 border rounded-lg px-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost" size="sm" className="h-7 w-7 p-0"
                  disabled={zoomIdx <= 0}
                  onClick={() => onZoomChange(ZOOM_ORDER[zoomIdx - 1])}
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom in</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="text-xs font-medium text-gray-500 w-12 text-center capitalize">{zoomLevel}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost" size="sm" className="h-7 w-7 p-0"
                  disabled={zoomIdx >= ZOOM_ORDER.length - 1}
                  onClick={() => onZoomChange(ZOOM_ORDER[zoomIdx + 1])}
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom out</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Today */}
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={onTodayClick}>
          <CalendarDays className="h-3.5 w-3.5" />
          Today
        </Button>
      </div>

      {/* Export */}
      <div className="flex items-center gap-1">
        {onExportPng && (
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={onExportPng}>
            <Download className="h-3.5 w-3.5" />
            PNG
          </Button>
        )}
        {onPrint && (
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={onPrint}>
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
        )}
      </div>
    </div>
  );
}
