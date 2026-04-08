import { cn } from "@/lib/utils";
import { sidebarConfig } from "@/config/sidebarConfig";
import { getUnlockedSectionIds } from "@/lib/tierSectionMap";

interface MiniSidebarProps {
  tierSlug: string;
  animate: boolean;
  className?: string;
}

const TOP_LEVEL_ONLY = [
  'dashboard', 'crm', 'prospecting', 'marketing', 'pipeline',
  'deal-room', 'underwriting', 'marinalytics', 'operations', 'integrations',
];

export function MiniSidebar({ tierSlug, animate, className }: MiniSidebarProps) {
  const unlockedIds = getUnlockedSectionIds(tierSlug);
  const unlockedSet = new Set(unlockedIds);

  const groups = sidebarConfig.filter((g) => TOP_LEVEL_ONLY.includes(g.id));

  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/30 p-2 space-y-0.5 overflow-hidden",
        className
      )}
    >
      {groups.map((group, idx) => {
        const isUnlocked = unlockedSet.has(group.id);
        const Icon = group.icon;
        const delay = animate ? `${idx * 80}ms` : '0ms';

        return (
          <div
            key={group.id}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-all duration-300",
              isUnlocked
                ? "text-foreground"
                : "text-muted-foreground/40",
              animate && "opacity-0 translate-y-1"
            )}
            style={
              animate
                ? {
                    animation: `miniSidebarFadeIn 0.25s ease forwards`,
                    animationDelay: delay,
                  }
                : undefined
            }
          >
            <Icon
              className={cn(
                "h-3 w-3 flex-shrink-0",
                isUnlocked ? "text-primary" : "text-muted-foreground/30"
              )}
            />
            <span className="truncate font-medium">{group.label}</span>
            {!isUnlocked && (
              <span className="ml-auto text-[9px] opacity-40">🔒</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
