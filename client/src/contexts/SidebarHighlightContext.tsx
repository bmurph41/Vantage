import { createContext, useContext, useState, useRef, useCallback, ReactNode } from "react";

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
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setHighlight = useCallback((ids: string[]) => {
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
    }
    setState({ highlightedIds: ids, active: true });
    clearTimerRef.current = setTimeout(() => {
      setState({ highlightedIds: [], active: false });
    }, 4000);
  }, []);

  const clearHighlight = useCallback(() => {
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
    }
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
