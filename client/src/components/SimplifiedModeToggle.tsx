import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useDisplayMode } from "@/stores/display-mode-store";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SimplifiedModeToggleProps {
  collapsed?: boolean;
}

export function SimplifiedModeToggle({ collapsed = false }: SimplifiedModeToggleProps) {
  const { simplifiedMode, toggleSimplifiedMode } = useDisplayMode();

  if (collapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleSimplifiedMode}
              className="flex items-center justify-center py-2 px-2 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-md transition-colors"
              aria-label="Toggle simplified mode"
            >
              <div className={`w-3 h-3 rounded-full border-2 transition-colors ${simplifiedMode ? "bg-blue-500 border-blue-500" : "border-sidebar-foreground/30"}`} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            <p>Simple Mode: {simplifiedMode ? "On" : "Off"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-2">
      <Label
        htmlFor="simplified-mode"
        className="text-xs text-sidebar-foreground/70 cursor-pointer select-none"
      >
        Simple Mode
      </Label>
      <Switch
        id="simplified-mode"
        checked={simplifiedMode}
        onCheckedChange={toggleSimplifiedMode}
        className="scale-75"
      />
    </div>
  );
}
