import React, { createContext, useContext, useState, ReactNode } from "react";
import { OmProject, OmPage, OmBlock, OmTheme } from "@/lib/types";

interface OmContextType {
  project: OmProject | null;
  setProject: (project: OmProject) => void;
  updateProject: (updates: Partial<OmProject>) => void;
}

const OmContext = createContext<OmContextType | undefined>(undefined);

export function OmProvider({ children }: { children: ReactNode }) {
  const [project, setProjectState] = useState<OmProject | null>(null);

  const setProject = (newProject: OmProject) => {
    setProjectState(newProject);
  };

  const updateProject = (updates: Partial<OmProject>) => {
    setProjectState((prev) => (prev ? { ...prev, ...updates } : null));
  };

  return (
    <OmContext.Provider value={{ project, setProject, updateProject }}>
      {children}
    </OmContext.Provider>
  );
}

export function useOmContext() {
  const context = useContext(OmContext);
  if (!context) {
    throw new Error("useOmContext must be used within an OmProvider");
  }
  return context;
}
