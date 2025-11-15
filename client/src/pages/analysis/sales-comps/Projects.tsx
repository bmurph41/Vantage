import { useState } from "react";
import ProjectList from "@/components/salescomps/projects/ProjectList";
import ProjectDetails from "@/components/salescomps/projects/ProjectDetails";
import type { Project } from "@shared/schema";

export default function SalesCompsProjects() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
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
  );
}
