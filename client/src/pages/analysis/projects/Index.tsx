import { useState } from "react";
import ProjectList from "@/components/salescomps/projects/ProjectList";
import ProjectDetails from "@/components/salescomps/projects/ProjectDetails";
import type { Project } from "@shared/schema";

export default function ProjectsIndex() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
  };

  const handleCloseProjectDetails = () => {
    setSelectedProject(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="pt-4">
        {selectedProject ? (
          <ProjectDetails 
            projectId={selectedProject.id} 
            onClose={handleCloseProjectDetails}
          />
        ) : (
          <ProjectList 
            onSelectProject={handleSelectProject}
            selectedProjectId={selectedProject?.id}
          />
        )}
      </div>
    </div>
  );
}
