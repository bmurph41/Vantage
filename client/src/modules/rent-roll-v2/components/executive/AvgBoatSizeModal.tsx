import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AvgBoatSizeModalProps {
  open: boolean;
  onClose: () => void;
  initialMode?: "overall" | "annual" | "seasonal" | "winter";
  projectType?: "ALL" | "OWNED" | "DEAL";
  selectedProjectIds?: string[];
}

interface AvgBoatSizeMetrics {
  overall: { avgLength: number; boatCount: number; label: string };
  annual: { avgLength: number; boatCount: number; label: string } | null;
  seasonal: { avgLength: number; boatCount: number; label: string } | null;
  winter: { avgLength: number; boatCount: number; label: string } | null;
  byProject: Array<{
    projectId: string;
    projectName: string;
    avgLength: number;
    boatCount: number;
    contractTermBreakdown: {
      annual: { avgLength: number; boatCount: number };
      seasonal: { avgLength: number; boatCount: number };
      winter: { avgLength: number; boatCount: number };
    };
  }>;
}

export function AvgBoatSizeModal({ 
  open, 
  onClose, 
  initialMode = "overall",
  projectType = "ALL",
  selectedProjectIds = []
}: AvgBoatSizeModalProps) {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"overall" | "annual" | "seasonal" | "winter">(initialMode);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
    }
  }, [open, initialMode]);

  const { data: avgBoatSize, isLoading } = useQuery<AvgBoatSizeMetrics>({
    queryKey: ["/api/executive-dashboard/avg-boat-size", projectType, selectedProjectIds],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (projectType !== "ALL") {
        params.append("projectType", projectType);
      }
      if (selectedProjectIds.length > 0) {
        params.append("projectIds", selectedProjectIds.join(","));
      }
      const response = await fetch(`/api/executive-dashboard/avg-boat-size?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch avg boat size");
      return response.json();
    },
    enabled: open,
  });

  const currentMetric = useMemo(() => {
    if (!avgBoatSize) return null;
    if (mode === "overall") return avgBoatSize.overall;
    return avgBoatSize[mode];
  }, [avgBoatSize, mode]);

  const sortedProjects = useMemo(() => {
    if (!avgBoatSize?.byProject) return [];
    return [...avgBoatSize.byProject].sort((a, b) => {
      if (mode === "overall") {
        return b.boatCount - a.boatCount;
      }
      const aCount = a.contractTermBreakdown[mode]?.boatCount || 0;
      const bCount = b.contractTermBreakdown[mode]?.boatCount || 0;
      return bCount - aCount;
    });
  }, [avgBoatSize, mode]);

  const getModeLabel = (m: typeof mode) => {
    switch(m) {
      case "overall": return "Overall";
      case "annual": return "Annual";
      case "seasonal": return "Summer";
      case "winter": return "Winter";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0" data-testid="modal-avg-boat-size">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle>Average Boat Size Breakdown</DialogTitle>
              <DialogDescription>
                {currentMetric 
                  ? `${getModeLabel(mode)} average: ${currentMetric.avgLength} ft across ${currentMetric.boatCount} boats`
                  : "No boat size data available"
                }
              </DialogDescription>
            </div>
            <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <SelectTrigger className="w-[120px]" data-testid="select-modal-boat-size-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overall">Overall</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
                <SelectItem value="seasonal">Summer</SelectItem>
                <SelectItem value="winter">Winter</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden px-6 py-4">
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">Boats</TableHead>
                    <TableHead className="text-right">Avg Size (ft)</TableHead>
                    <TableHead className="text-right">Annual</TableHead>
                    <TableHead className="text-right">Summer</TableHead>
                    <TableHead className="text-right">Winter</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedProjects.length > 0 ? (
                    sortedProjects.map((project) => {
                      const currentAvg = mode === "overall" 
                        ? project.avgLength 
                        : (project.contractTermBreakdown[mode]?.avgLength || 0);
                      const currentCount = mode === "overall"
                        ? project.boatCount
                        : (project.contractTermBreakdown[mode]?.boatCount || 0);
                        
                      if (mode !== "overall" && currentCount === 0) {
                        return null;
                      }

                      return (
                        <TableRow 
                          key={project.projectId} 
                          data-testid={`row-project-${project.projectId}`}
                          className="cursor-pointer hover-elevate"
                          onClick={() => {
                            setLocation(`/rent-roll/${project.projectId}`);
                            onClose();
                          }}
                        >
                          <TableCell className="font-medium">{project.projectName}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {mode === "overall" ? project.boatCount : currentCount}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {currentAvg > 0 ? `${currentAvg} ft` : "-"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {project.contractTermBreakdown.annual.boatCount > 0 ? (
                              <span>
                                {project.contractTermBreakdown.annual.avgLength} ft
                                <span className="text-xs ml-1">({project.contractTermBreakdown.annual.boatCount})</span>
                              </span>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {project.contractTermBreakdown.seasonal.boatCount > 0 ? (
                              <span>
                                {project.contractTermBreakdown.seasonal.avgLength} ft
                                <span className="text-xs ml-1">({project.contractTermBreakdown.seasonal.boatCount})</span>
                              </span>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {project.contractTermBreakdown.winter.boatCount > 0 ? (
                              <span>
                                {project.contractTermBreakdown.winter.avgLength} ft
                                <span className="text-xs ml-1">({project.contractTermBreakdown.winter.boatCount})</span>
                              </span>
                            ) : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No boat size data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </div>

        <div className="px-6 py-4 border-t bg-muted/30">
          <div className="flex flex-wrap gap-4 text-sm">
            {avgBoatSize?.annual && (
              <div>
                <span className="text-muted-foreground">Annual:</span>{" "}
                <span className="font-medium">{avgBoatSize.annual.avgLength} ft</span>
                <span className="text-muted-foreground ml-1">({avgBoatSize.annual.boatCount} boats)</span>
              </div>
            )}
            {avgBoatSize?.seasonal && (
              <div>
                <span className="text-muted-foreground">Summer:</span>{" "}
                <span className="font-medium">{avgBoatSize.seasonal.avgLength} ft</span>
                <span className="text-muted-foreground ml-1">({avgBoatSize.seasonal.boatCount} boats)</span>
              </div>
            )}
            {avgBoatSize?.winter && (
              <div>
                <span className="text-muted-foreground">Winter:</span>{" "}
                <span className="font-medium">{avgBoatSize.winter.avgLength} ft</span>
                <span className="text-muted-foreground ml-1">({avgBoatSize.winter.boatCount} boats)</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
