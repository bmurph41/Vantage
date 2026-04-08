import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface SidebarHighlightState {
  highlightedIds: string[];
  active: boolean;
}

interface SidebarHighlightContextValue extends SidebarHighlightState {
  setHighlight: (ids: string[]) => void;
  clearHighlight: () => void;
}

const SidebarHighlightContext = createContext<SidebarHighlightContextValue>({
  highlightedIds: [],
  active: false,
  setHighlight: () => {},
  clearHighlight: () => {},
});

export function SidebarHighlightProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SidebarHighlightState>({
    highlightedIds: [],
    active: false,
  });

  const setHighlight = useCallback((ids: string[]) => {
    setState({ highlightedIds: ids, active: true });
  }, []);

  const clearHighlight = useCallback(() => {
    setState({ highlightedIds: [], active: false });
  }, []);

  return (
    <SidebarHighlightContext.Provider value={{ ...state, setHighlight, clearHighlight }}>
      {children}
    </SidebarHighlightContext.Provider>
  );
}

export function useSidebarHighlight() {
  return useContext(SidebarHighlightContext);
}
