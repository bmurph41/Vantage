import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen,
  Bug,
  Keyboard,
  Sparkles,
  ExternalLink,
} from "lucide-react";

const SHORTCUTS = [
  { keys: ["⌘", "K"], label: "Search everything" },
  { keys: ["⌘", "N"], label: "Quick Add" },
  { keys: ["Esc"], label: "Close panel / modal" },
];

interface Props {
  children: React.ReactNode;
  onOpenChangelog: () => void;
}

export function HelpPanel({ children, onOpenChangelog }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-64 p-0"
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2.5 border-b">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Help & Support
          </p>
        </div>

        <div className="py-1">
          <a
            href="https://docs.vantage.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent rounded transition-colors mx-1"
          >
            <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
            <span>Documentation</span>
            <ExternalLink className="w-3 h-3 text-muted-foreground/60 ml-auto shrink-0" />
          </a>

          <a
            href="mailto:support@vantageapp.com?subject=Bug%20Report&body=Please%20describe%20the%20issue%20and%20steps%20to%20reproduce%20it%3A%0A%0A"
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent rounded transition-colors mx-1"
          >
            <Bug className="w-4 h-4 text-muted-foreground shrink-0" />
            <span>Report a bug</span>
          </a>

          <button
            onClick={onOpenChangelog}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent rounded transition-colors mx-1 w-full text-left"
          >
            <Sparkles className="w-4 h-4 text-muted-foreground shrink-0" />
            <span>What's New</span>
          </button>
        </div>

        <Separator />

        <div className="px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-2">
            <Keyboard className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Keyboard shortcuts
            </p>
          </div>
          <div className="space-y-1.5">
            {SHORTCUTS.map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <div className="flex items-center gap-0.5">
                  {s.keys.map((k) => (
                    <kbd
                      key={k}
                      className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded border border-border bg-muted text-[10px] font-mono font-medium text-muted-foreground"
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
