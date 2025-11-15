import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { salesCompsApi } from "@/lib/salescomps/api";
import { queryKeys } from "@/lib/salescomps/queryKeys";
import SalesCompsHeader from "@/components/salescomps/sales-comps/SalesCompsHeader";
import ProjectList from "@/components/salescomps/projects/ProjectList";
import ProjectDetails from "@/components/salescomps/projects/ProjectDetails";
import type { Project } from "@shared/schema";

export default function SalesCompsProjects() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  
  // Fetch total count
  const { data: compsData } = useQuery({
    queryKey: queryKeys.comps.list({ page: 1, pageSize: 1 }),
    queryFn: () => salesCompsApi.getComps({ page: 1, pageSize: 1 }),
  });

  const total = compsData?.total || 0;
  
  return (
    <div className="flex flex-1 bg-background min-h-screen">
      <div className="flex-1 flex flex-col overflow-hidden">
        <SalesCompsHeader 
          total={total}
          canManageColumns={false}
          canCreate={false}
          hasData={total > 0}
        />
        <div className="flex-1 overflow-auto">
          {selectedProject ? (
            <ProjectDetails
              projectId={selectedProject.id}
              onClose={() => setSelectedProject(null)}
            />
          ) : (
            <ProjectList
              onSelectProject={(project) => setSelectedProject(project)}
              selectedProjectId={selectedProject?.id}
            />
          )}
        </div>
      </div>
    </div>
  );
}
