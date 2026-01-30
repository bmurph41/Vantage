// useSidebarState.ts
// Place this file in: src/hooks/useSidebarState.ts
// Sidebar state management with entitlements-aware filtering

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useEntitlements } from '@/contexts/EntitlementsContext';
import { getActiveNavState, SidebarGroup, SidebarItem } from '@/config/sidebarConfig';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const STORAGE_KEY = 'sidebar-expanded-groups';
const COLLAPSED_KEY = 'sidebar-collapsed';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface SidebarState {
  expandedGroups: Set<string>;
  isCollapsed: boolean;
  activeGroup: string | null;
  activeItem: string | null;
}

interface UseSidebarStateReturn extends SidebarState {
  // Filtered sidebar based on user's modules
  visibleGroups: SidebarGroup[];
  
  // Group management
  toggleGroup: (groupId: string) => void;
  expandGroup: (groupId: string) => void;
  collapseGroup: (groupId: string) => void;
  isGroupExpanded: (groupId: string) => boolean;
  
  // Sidebar collapse
  toggleSidebar: () => void;
  expandSidebar: () => void;
  collapseSidebar: () => void;
  expandSidebarAndGroup: (groupId: string) => void;
  
  // Utilities
  getVisibleChildren: (group: SidebarGroup) => SidebarItem[];
  hasActiveChild: (group: SidebarGroup) => boolean;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function loadExpandedGroups(visibleGroups: SidebarGroup[]): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as string[];
      // Only include groups that are actually visible
      const visibleIds = new Set(visibleGroups.map(g => g.id));
      return new Set(parsed.filter(id => visibleIds.has(id)));
    }
  } catch (e) {
    console.warn('Failed to load sidebar state:', e);
  }
  
  // Default: expand groups marked as defaultExpanded
  return new Set(
    visibleGroups
      .filter(g => g.defaultExpanded === true)
      .map(g => g.id)
  );
}

function loadCollapsedState(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════

export function useSidebarState(pathname: string): UseSidebarStateReturn {
  const { visibleSidebar, userModules } = useEntitlements();
  
  // State
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => 
    loadExpandedGroups(visibleSidebar)
  );
  const [isCollapsed, setIsCollapsed] = useState<boolean>(loadCollapsedState);

  // ─────────────────────────────────────────────────────────────
  // Computed: Active navigation state
  // ─────────────────────────────────────────────────────────────
  const { activeGroup, activeItem } = useMemo(() => {
    return getActiveNavState(pathname);
  }, [pathname]);

  // ─────────────────────────────────────────────────────────────
  // Auto-expand active group on route change
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeGroup && !expandedGroups.has(activeGroup)) {
      setExpandedGroups(prev => new Set([...prev, activeGroup]));
    }
  }, [activeGroup]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────
  // Update expanded groups when visible sidebar changes
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    setExpandedGroups(prev => {
      const visibleIds = new Set(visibleSidebar.map(g => g.id));
      const filtered = new Set([...prev].filter(id => visibleIds.has(id)));
      
      // Also expand the active group if it's now visible
      if (activeGroup && visibleIds.has(activeGroup)) {
        filtered.add(activeGroup);
      }
      
      return filtered;
    });
  }, [visibleSidebar, activeGroup]);

  // ─────────────────────────────────────────────────────────────
  // Persist state to localStorage
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...expandedGroups]));
    } catch (e) {
      console.warn('Failed to save sidebar state:', e);
    }
  }, [expandedGroups]);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, String(isCollapsed));
    } catch (e) {
      console.warn('Failed to save collapsed state:', e);
    }
  }, [isCollapsed]);

  // ─────────────────────────────────────────────────────────────
  // Group management
  // ─────────────────────────────────────────────────────────────
  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const expandGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      if (prev.has(groupId)) return prev;
      return new Set([...prev, groupId]);
    });
  }, []);

  const collapseGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      if (!prev.has(groupId)) return prev;
      const next = new Set(prev);
      next.delete(groupId);
      return next;
    });
  }, []);

  const isGroupExpanded = useCallback((groupId: string) => {
    return expandedGroups.has(groupId);
  }, [expandedGroups]);

  // ─────────────────────────────────────────────────────────────
  // Sidebar collapse
  // ─────────────────────────────────────────────────────────────
  const toggleSidebar = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  const expandSidebar = useCallback(() => {
    setIsCollapsed(false);
  }, []);

  const collapseSidebar = useCallback(() => {
    setIsCollapsed(true);
  }, []);

  const expandSidebarAndGroup = useCallback((groupId: string) => {
    setIsCollapsed(false);
    setExpandedGroups(prev => new Set([...prev, groupId]));
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────
  const getVisibleChildren = useCallback((group: SidebarGroup): SidebarItem[] => {
    if (!group.children) return [];
    return group.children.filter(item => {
      if (item.featureFlag === false) return false;
      if (!item.requiredModules) return true;
      return item.requiredModules.some(m => userModules.has(m));
    });
  }, [userModules]);

  const hasActiveChild = useCallback((group: SidebarGroup): boolean => {
    if (!group.children || !activeItem) return false;
    return group.children.some(item => item.id === activeItem);
  }, [activeItem]);

  // ─────────────────────────────────────────────────────────────
  // Return
  // ─────────────────────────────────────────────────────────────
  return {
    expandedGroups,
    isCollapsed,
    activeGroup,
    activeItem,
    visibleGroups: visibleSidebar,
    toggleGroup,
    expandGroup,
    collapseGroup,
    isGroupExpanded,
    toggleSidebar,
    expandSidebar,
    collapseSidebar,
    expandSidebarAndGroup,
    getVisibleChildren,
    hasActiveChild,
  };
}

// ═══════════════════════════════════════════════════════════════
// STANDALONE HOOK (without EntitlementsContext)
// ═══════════════════════════════════════════════════════════════
// Use this if you want to test the sidebar without the full
// entitlements system, or if you're loading modules differently.

export function useSidebarStateStandalone(
  pathname: string,
  visibleGroups: SidebarGroup[],
  userModules: Set<string>
): Omit<UseSidebarStateReturn, 'visibleGroups'> & { visibleGroups: SidebarGroup[] } {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => 
    loadExpandedGroups(visibleGroups)
  );
  const [isCollapsed, setIsCollapsed] = useState<boolean>(loadCollapsedState);

  const { activeGroup, activeItem } = useMemo(() => {
    return getActiveNavState(pathname);
  }, [pathname]);

  // Auto-expand active group
  useEffect(() => {
    if (activeGroup && !expandedGroups.has(activeGroup)) {
      setExpandedGroups(prev => new Set([...prev, activeGroup]));
    }
  }, [activeGroup]);

  // Persist state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...expandedGroups]));
  }, [expandedGroups]);

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(isCollapsed));
  }, [isCollapsed]);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });
  }, []);

  const expandGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => new Set([...prev, groupId]));
  }, []);

  const collapseGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.delete(groupId);
      return next;
    });
  }, []);

  const isGroupExpanded = useCallback((groupId: string) => {
    return expandedGroups.has(groupId);
  }, [expandedGroups]);

  const toggleSidebar = useCallback(() => setIsCollapsed(p => !p), []);
  const expandSidebar = useCallback(() => setIsCollapsed(false), []);
  const collapseSidebar = useCallback(() => setIsCollapsed(true), []);
  const expandSidebarAndGroup = useCallback((groupId: string) => {
    setIsCollapsed(false);
    setExpandedGroups(prev => new Set([...prev, groupId]));
  }, []);

  const getVisibleChildren = useCallback((group: SidebarGroup): SidebarItem[] => {
    if (!group.children) return [];
    return group.children.filter(item => {
      if (item.featureFlag === false) return false;
      if (!item.requiredModules) return true;
      return item.requiredModules.some(m => userModules.has(m));
    });
  }, [userModules]);

  const hasActiveChild = useCallback((group: SidebarGroup): boolean => {
    if (!group.children || !activeItem) return false;
    return group.children.some(item => item.id === activeItem);
  }, [activeItem]);

  return {
    expandedGroups,
    isCollapsed,
    activeGroup,
    activeItem,
    visibleGroups,
    toggleGroup,
    expandGroup,
    collapseGroup,
    isGroupExpanded,
    toggleSidebar,
    expandSidebar,
    collapseSidebar,
    expandSidebarAndGroup,
    getVisibleChildren,
    hasActiveChild,
  };
}
