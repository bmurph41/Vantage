import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { getRentRollConfig, type RentRollAssetConfig } from "@shared/rent-roll-config";

interface ProjectDetails {
  id: string;
  name: string;
  projectType: "OWNED" | "DEAL";
  description?: string;
  capacity?: number;
  status?: string;
  assetClass?: string;
}

interface ProjectContextValue {
  projectId: string | null;
  project: ProjectDetails | null;
  isLoading: boolean;
  isPortfolioScope: boolean;
  rentRollConfig: RentRollAssetConfig;
}

const defaultConfig = getRentRollConfig('marina');

const ProjectContext = createContext<ProjectContextValue>({
  projectId: null,
  project: null,
  isLoading: false,
  isPortfolioScope: false,
  rentRollConfig: defaultConfig,
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

  const rentRollConfig = useMemo(
    () => getRentRollConfig(project?.assetClass),
    [project?.assetClass]
  );

  const value = useMemo(() => ({
    projectId: projectId || null,
    project: project || null,
    isLoading,
    isPortfolioScope: false,
    rentRollConfig,
  }), [projectId, project, isLoading, rentRollConfig]);

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
    rentRollConfig: defaultConfig,
  }), []);

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}
