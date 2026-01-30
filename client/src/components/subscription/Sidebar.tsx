// Sidebar.tsx
// Place this file in: src/components/Sidebar.tsx
// Main sidebar component with module-based access control

import React from 'react';
import { Link } from 'wouter';
import { ChevronRight, PanelLeftClose, PanelLeft, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { useSidebarState } from '@/hooks/useSidebarState';
import { useEntitlements } from '@/contexts/EntitlementsContext';
import { SidebarGroup, SidebarItem } from '@/config/sidebarConfig';

// ═══════════════════════════════════════════════════════════════
// SIDEBAR COMPONENT
// ═══════════════════════════════════════════════════════════════

interface SidebarProps {
  pathname: string;
  className?: string;
  onUpgradeClick?: () => void;
}

export function Sidebar({ pathname, className, onUpgradeClick }: SidebarProps) {
  const {
    isCollapsed,
    activeGroup,
    activeItem,
    visibleGroups,
    isGroupExpanded,
    toggleGroup,
    toggleSidebar,
    expandSidebarAndGroup,
    getVisibleChildren,
    hasActiveChild,
  } = useSidebarState(pathname);

  const { subscription } = useEntitlements();

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          "flex flex-col h-full bg-background border-r transition-all duration-300 ease-in-out",
          isCollapsed ? "w-16" : "w-64",
          className
        )}
      >
        {/* ─────────────────────────────────────────────────────── */}
        {/* Header / Logo */}
        {/* ─────────────────────────────────────────────────────── */}
        <div className={cn(
          "flex items-center h-14 px-3 border-b shrink-0",
          isCollapsed ? "justify-center" : "justify-between"
        )}>
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg text-primary">MarinaMatch</span>
              {subscription.status === 'trial' && (
                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                  Trial
                </span>
              )}
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-md hover:bg-muted/50 transition-colors"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <PanelLeft className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* ─────────────────────────────────────────────────────── */}
        {/* Navigation */}
        {/* ─────────────────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin">
          {visibleGroups.map((group) => (
            <SidebarGroupComponent
              key={group.id}
              group={group}
              isCollapsed={isCollapsed}
              isExpanded={isGroupExpanded(group.id)}
              isActiveGroup={activeGroup === group.id}
              activeItem={activeItem}
              hasActiveChild={hasActiveChild(group)}
              visibleChildren={getVisibleChildren(group)}
              onToggle={() => toggleGroup(group.id)}
              onExpandSidebarAndGroup={() => expandSidebarAndGroup(group.id)}
            />
          ))}
        </nav>

        {/* ─────────────────────────────────────────────────────── */}
        {/* Footer - Upgrade prompt (if not on full plan) */}
        {/* ─────────────────────────────────────────────────────── */}
        {!isCollapsed && subscription.packageSlug !== 'full-platform' && (
          <div className="border-t p-3 shrink-0">
            <button
              onClick={onUpgradeClick}
              className="w-full text-left p-2 rounded-md bg-gradient-to-r from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10 transition-colors"
            >
              <div className="text-sm font-medium text-primary">Upgrade Plan</div>
              <div className="text-xs text-muted-foreground">
                Unlock more features
              </div>
            </button>
          </div>
        )}

        {/* Collapsed footer */}
        {isCollapsed && subscription.packageSlug !== 'full-platform' && (
          <div className="border-t p-2 shrink-0 flex justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onUpgradeClick}
                  className="p-2 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors"
                >
                  <Lock className="h-4 w-4 text-primary" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Upgrade Plan
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}

// ═══════════════════════════════════════════════════════════════
// SIDEBAR GROUP COMPONENT
// ═══════════════════════════════════════════════════════════════

interface SidebarGroupProps {
  group: SidebarGroup;
  isCollapsed: boolean;
  isExpanded: boolean;
  isActiveGroup: boolean;
  activeItem: string | null;
  hasActiveChild: boolean;
  visibleChildren: SidebarItem[];
  onToggle: () => void;
  onExpandSidebarAndGroup: () => void;
}

function SidebarGroupComponent({
  group,
  isCollapsed,
  isExpanded,
  isActiveGroup,
  activeItem,
  hasActiveChild,
  visibleChildren,
  onToggle,
  onExpandSidebarAndGroup,
}: SidebarGroupProps) {
  const Icon = group.icon;
  const hasChildren = visibleChildren.length > 0;
  const isSingleItem = group.href && !hasChildren;

  // ─────────────────────────────────────────────────────────────
  // COLLAPSED MODE
  // ─────────────────────────────────────────────────────────────
  if (isCollapsed) {
    return (
      <div className="px-2 py-1">
        <Tooltip>
          <TooltipTrigger asChild>
            {isSingleItem ? (
              <Link
                href={group.href!}
                className={cn(
                  "flex items-center justify-center w-12 h-12 rounded-md relative transition-colors mx-auto",
                  "hover:bg-muted/50",
                  isActiveGroup && "bg-primary/10",
                  isActiveGroup && "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-6 before:w-[3px] before:bg-primary before:rounded-r"
                )}
              >
                <Icon className={cn("h-5 w-5", isActiveGroup && "text-primary")} />
              </Link>
            ) : (
              <button
                onClick={onExpandSidebarAndGroup}
                className={cn(
                  "flex items-center justify-center w-12 h-12 rounded-md relative transition-colors mx-auto",
                  "hover:bg-muted/50",
                  (isActiveGroup || hasActiveChild) && "bg-primary/10",
                  (isActiveGroup || hasActiveChild) && "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-6 before:w-[3px] before:bg-primary before:rounded-r"
                )}
              >
                <Icon className={cn("h-5 w-5", (isActiveGroup || hasActiveChild) && "text-primary")} />
              </button>
            )}
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {group.label}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // EXPANDED MODE
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="px-2 py-1">
      {isSingleItem ? (
        // Single item group (e.g., Dashboard)
        <Link
          href={group.href!}
          className={cn(
            "flex items-center gap-3 px-3 py-2 h-11 rounded-md relative transition-colors",
            "hover:bg-muted/30",
            isActiveGroup && "bg-primary/10 font-medium",
            isActiveGroup && "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-6 before:w-[3px] before:bg-primary before:rounded-r"
          )}
        >
          <Icon className={cn("h-5 w-5 shrink-0", isActiveGroup && "text-primary")} />
          <span className="truncate">{group.label}</span>
        </Link>
      ) : (
        // Group with children
        <>
          <button
            onClick={onToggle}
            aria-expanded={isExpanded}
            className={cn(
              "flex items-center justify-between w-full px-3 py-2 h-11 rounded-md transition-colors",
              "hover:bg-muted/30",
              isExpanded && "bg-muted/50",
              hasActiveChild && !isExpanded && "bg-primary/5",
              hasActiveChild && "font-medium"
            )}
          >
            <div className="flex items-center gap-3">
              <Icon className={cn("h-5 w-5 shrink-0", hasActiveChild && "text-primary")} />
              <span className={cn("truncate", hasActiveChild && "text-primary")}>{group.label}</span>
            </div>
            <ChevronRight 
              className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-200",
                isExpanded && "rotate-90"
              )} 
            />
          </button>

          {/* Children list with animation */}
          <div
            className={cn(
              "overflow-hidden transition-all duration-200 ease-in-out",
              isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <div className="ml-6 pl-3 border-l border-border/50 mt-1 space-y-0.5">
              {visibleChildren.map((item) => (
                <SidebarItemComponent
                  key={item.id}
                  item={item}
                  isActive={activeItem === item.id}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SIDEBAR ITEM COMPONENT (Leaf)
// ═══════════════════════════════════════════════════════════════

interface SidebarItemProps {
  item: SidebarItem;
  isActive: boolean;
}

function SidebarItemComponent({ item, isActive }: SidebarItemProps) {
  const Icon = item.icon;

  if (item.disabled) {
    return (
      <div
        className="flex items-center gap-3 px-3 py-2 h-10 rounded-md text-muted-foreground/50 cursor-not-allowed"
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" />}
        <span className="truncate text-sm">{item.label}</span>
        {item.badge && (
          <span className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">
            {item.badge}
          </span>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 h-10 rounded-md relative transition-colors",
        "hover:bg-muted/30",
        isActive && "bg-primary/10 font-medium",
        isActive && "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:bg-primary before:rounded-r"
      )}
    >
      {Icon && <Icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />}
      <span className={cn("truncate text-sm", isActive && "text-primary")}>{item.label}</span>
      {item.badge && (
        <span className={cn(
          "ml-auto text-xs px-1.5 py-0.5 rounded",
          typeof item.badge === 'string' && item.badge.toLowerCase() === 'new' 
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            : "bg-muted text-muted-foreground"
        )}>
          {item.badge}
        </span>
      )}
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export default Sidebar;
