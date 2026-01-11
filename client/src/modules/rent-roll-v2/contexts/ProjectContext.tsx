import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";

interface ProjectDetails {
  id: string;
  name: string;
  projectType: "OWNED" | "DEAL";
  description?: string;
  capacity?: number;
  status?: string;
}

interface ProjectContextValue {
  projectId: string | null;
  project: ProjectDetails | null;
  isLoading: boolean;
  isPortfolioScope: boolean;
}

const ProjectContext = createContext<ProjectContextValue>({
  projectId: null,
  project: null,
  isLoading: false,
  isPortfolioScope: false,
});

export function useProjectContext() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProjectContext must be used within a ProjectProvider");
  }
  return context;
}

interface ProjectProviderProps {
  children: React.ReactNode;
  projectId?: string;
}

export function ProjectProvider({ children, projectId }: ProjectProviderProps) {
  const { data: project, isLoading } = useQuery<ProjectDetails>({
    queryKey: ["/api/rent-roll/locations", projectId],
    enabled: !!projectId,
  });

  const value = useMemo(() => ({
    projectId: projectId || null,
    project: project || null,
    isLoading,
    isPortfolioScope: false,
  }), [projectId, project, isLoading]);

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

interface PortfolioProviderProps {
  children: React.ReactNode;
}

export function PortfolioProvider({ children }: PortfolioProviderProps) {
  const value = useMemo(() => ({
    projectId: null,
    project: null,
    isLoading: false,
    isPortfolioScope: true,
  }), []);

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}
