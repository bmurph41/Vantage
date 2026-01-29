import { cn } from "@/lib/utils"
import { Button } from "./button"
import { X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface BulkAction {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: "default" | "secondary" | "destructive" | "outline" | "ghost"
  disabled?: boolean
}

interface BulkActionBarProps {
  selectedCount: number
  actions: BulkAction[]
  onClearSelection: () => void
  className?: string
  position?: "bottom" | "top"
  itemLabel?: string
}

export function BulkActionBar({
  selectedCount,
  actions,
  onClearSelection,
  className,
  position = "bottom",
  itemLabel = "item"
}: BulkActionBarProps) {
  const isVisible = selectedCount > 0
  
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: position === "bottom" ? 20 : -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: position === "bottom" ? 20 : -20 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn(
            "fixed left-1/2 -translate-x-1/2 z-50",
            "flex items-center gap-4 px-6 py-3",
            "bg-foreground text-background rounded-full shadow-lg",
            "border border-border/20",
            position === "bottom" ? "bottom-6" : "top-20",
            className
          )}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={onClearSelection}
              className="p-1 hover:bg-background/20 rounded-full transition-colors"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium whitespace-nowrap">
              {selectedCount} {itemLabel}{selectedCount !== 1 ? "s" : ""} selected
            </span>
          </div>
          
          <div className="h-5 w-px bg-background/30" />
          
          <div className="flex items-center gap-2">
            {actions.map((action, index) => (
              <Button
                key={index}
                size="sm"
                variant={action.variant === "destructive" ? "destructive" : "secondary"}
                onClick={action.onClick}
                disabled={action.disabled}
                className={cn(
                  "h-8 gap-2",
                  action.variant !== "destructive" && "bg-background/20 hover:bg-background/30 text-background border-0"
                )}
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface InlineActionBarProps {
  selectedCount: number
  actions: BulkAction[]
  onClearSelection: () => void
  className?: string
  itemLabel?: string
}

export function InlineActionBar({
  selectedCount,
  actions,
  onClearSelection,
  className,
  itemLabel = "item"
}: InlineActionBarProps) {
  if (selectedCount === 0) return null
  
  return (
    <div className={cn(
      "flex items-center justify-between gap-4 px-4 py-2",
      "bg-muted/50 border-b",
      className
    )}>
      <div className="flex items-center gap-3">
        <button
          onClick={onClearSelection}
          className="p-1 hover:bg-muted rounded transition-colors"
          aria-label="Clear selection"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
        <span className="text-sm text-muted-foreground">
          {selectedCount} {itemLabel}{selectedCount !== 1 ? "s" : ""} selected
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        {actions.map((action, index) => (
          <Button
            key={index}
            size="sm"
            variant={action.variant || "outline"}
            onClick={action.onClick}
            disabled={action.disabled}
            className="h-7 gap-1.5 text-xs"
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
