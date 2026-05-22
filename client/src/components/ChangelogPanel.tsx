import { useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import entries from "@/data/changelog.json";

export type ChangelogEntry = {
  id: string;
  date: string;
  title: string;
  description: string;
};

export const CHANGELOG: ChangelogEntry[] = entries as ChangelogEntry[];

function getLastReadKey(userId?: string) {
  return userId ? `changelog_last_read_${userId}` : "changelog_last_read";
}

export function getUnreadCount(userId?: string): number {
  const raw = localStorage.getItem(getLastReadKey(userId));
  if (!raw) return CHANGELOG.length;
  return CHANGELOG.filter((e) => e.date > raw).length;
}

function markRead(userId?: string) {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(getLastReadKey(userId), today);
}

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
}

export function ChangelogPanel({ open, onOpenChange, userId }: Props) {
  useEffect(() => {
    if (open) markRead(userId);
  }, [open, userId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col"
        onKeyDown={(e) => { if (e.key === "Escape") onOpenChange(false); }}
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-600 text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <SheetTitle className="text-base font-semibold">What's New</SheetTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Recent updates and improvements to Vantage.
          </p>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-6">
            {CHANGELOG.map((entry, i) => (
              <div key={entry.id} className="relative">
                {i < CHANGELOG.length - 1 && (
                  <div className="absolute left-[7px] top-7 bottom-[-24px] w-px bg-border" />
                )}
                <div className="flex gap-3">
                  <div className="mt-1 w-3.5 h-3.5 rounded-full bg-blue-500 flex-shrink-0 ring-2 ring-background" />
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-medium text-foreground leading-snug">
                        {entry.title}
                      </p>
                      {i === 0 && (
                        <Badge variant="secondary" className="text-[10px] shrink-0 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-0">
                          New
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-1.5 leading-relaxed">
                      {entry.description}
                    </p>
                    <p className="text-[11px] text-muted-foreground/60">
                      {formatDate(entry.date)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
