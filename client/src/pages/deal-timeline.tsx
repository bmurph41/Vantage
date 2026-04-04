import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, GitBranch } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import DealGanttView from "@/components/crm/deal-gantt-view";

export default function DealTimelinePage() {
  const [selectedPipeline, setSelectedPipeline] = useState<string>("all");

  // Fetch available pipelines
  const { data: pipelines } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/pipeline-stages"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/pipeline-stages");
      const stages = await res.json();
      // Extract unique pipelines
      const pipelineMap = new Map<string, string>();
      for (const s of stages) {
        if (s.pipelineId && !pipelineMap.has(s.pipelineId)) {
          pipelineMap.set(s.pipelineId, s.pipelineName || "Pipeline");
        }
      }
      return Array.from(pipelineMap, ([id, name]) => ({ id, name }));
    },
  });

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="bg-[#1B365D] text-white px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitBranch className="h-6 w-6" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Deal Timeline</h1>
              <p className="text-blue-200 text-sm mt-0.5">
                Gantt view of deal milestones, DD periods, and closing deadlines
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {pipelines && pipelines.length > 1 && (
              <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
                <SelectTrigger className="w-48 bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="All Pipelines" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pipelines</SelectItem>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>

      {/* Gantt View */}
      <div className="p-6">
        <Card>
          <CardContent className="p-0">
            <DealGanttView
              pipelineId={selectedPipeline === "all" ? undefined : selectedPipeline}
              className="min-h-[600px]"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
