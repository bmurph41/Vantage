import { cn } from "@/lib/utils"
import { Button } from "./button"
import { LucideIcon } from "lucide-react"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    variant?: "default" | "secondary" | "outline" | "ghost"
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  className?: string
  size?: "sm" | "md" | "lg"
  children?: React.ReactNode
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  size = "md",
  children
}: EmptyStateProps) {
  const sizeClasses = {
    sm: {
      container: "py-8 px-4",
      icon: "h-10 w-10",
      iconContainer: "h-16 w-16",
      title: "text-base",
      description: "text-sm"
    },
    md: {
      container: "py-12 px-6",
      icon: "h-12 w-12",
      iconContainer: "h-20 w-20",
      title: "text-lg",
      description: "text-sm"
    },
    lg: {
      container: "py-16 px-8",
      icon: "h-16 w-16",
      iconContainer: "h-24 w-24",
      title: "text-xl",
      description: "text-base"
    }
  }

  const sizes = sizeClasses[size]

  return (
    <div 
      className={cn(
        "flex flex-col items-center justify-center text-center",
        sizes.container,
        className
      )}
    >
      {Icon && (
        <div className={cn(
          "rounded-full bg-muted flex items-center justify-center mb-4",
          sizes.iconContainer
        )}>
          <Icon className={cn("text-muted-foreground", sizes.icon)} />
        </div>
      )}
      <h3 className={cn("font-semibold text-foreground mb-2", sizes.title)}>
        {title}
      </h3>
      {description && (
        <p className={cn(
          "text-muted-foreground max-w-sm mb-6",
          sizes.description
        )}>
          {description}
        </p>
      )}
      {children}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 mt-4">
          {action && (
            <Button 
              onClick={action.onClick}
              variant={action.variant || "default"}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button 
              onClick={secondaryAction.onClick}
              variant="ghost"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

interface TableEmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  colSpan?: number
}

export function TableEmptyState({
  icon: Icon,
  title,
  description,
  action,
  colSpan = 1
}: TableEmptyStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="h-64">
        <EmptyState
          icon={Icon}
          title={title}
          description={description}
          action={action}
          size="sm"
        />
      </td>
    </tr>
  )
}
