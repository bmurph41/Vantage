import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from "lucide-react"
import { Button } from "./button"

const inlineBannerVariants = cva(
  "relative flex items-start gap-3 rounded-lg border p-4",
  {
    variants: {
      variant: {
        info: "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/50 dark:border-blue-900 dark:text-blue-100",
        success: "bg-green-50 border-green-200 text-green-900 dark:bg-green-950/50 dark:border-green-900 dark:text-green-100",
        warning: "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/50 dark:border-amber-900 dark:text-amber-100",
        error: "bg-red-50 border-red-200 text-red-900 dark:bg-red-950/50 dark:border-red-900 dark:text-red-100",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
)

const iconVariants = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
}

const iconColorVariants = {
  info: "text-blue-600 dark:text-blue-400",
  success: "text-green-600 dark:text-green-400",
  warning: "text-amber-600 dark:text-amber-400",
  error: "text-red-600 dark:text-red-400",
}

interface InlineBannerProps extends VariantProps<typeof inlineBannerVariants> {
  title?: string
  description?: string
  children?: React.ReactNode
  action?: {
    label: string
    onClick: () => void
  }
  onDismiss?: () => void
  className?: string
  icon?: React.ReactNode
}

export function InlineBanner({
  title,
  description,
  children,
  action,
  onDismiss,
  className,
  variant = "info",
  icon,
}: InlineBannerProps) {
  const IconComponent = iconVariants[variant || "info"]
  
  return (
    <div className={cn(inlineBannerVariants({ variant }), className)}>
      <div className={cn("flex-shrink-0 mt-0.5", iconColorVariants[variant || "info"])}>
        {icon || <IconComponent className="h-5 w-5" />}
      </div>
      <div className="flex-1 min-w-0">
        {title && (
          <h4 className="font-medium text-sm leading-5">
            {title}
          </h4>
        )}
        {description && (
          <p className={cn(
            "text-sm opacity-90",
            title && "mt-1"
          )}>
            {description}
          </p>
        )}
        {children}
        {action && (
          <div className="mt-3">
            <Button 
              size="sm" 
              variant="outline"
              onClick={action.onClick}
              className="h-7 text-xs"
            >
              {action.label}
            </Button>
          </div>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className={cn(
            "flex-shrink-0 p-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/15 transition-all",
            "focus:outline-none focus:ring-2 focus:ring-offset-2",
            variant === "info" && "focus:ring-blue-500",
            variant === "success" && "focus:ring-green-500",
            variant === "warning" && "focus:ring-amber-500",
            variant === "error" && "focus:ring-red-500"
          )}
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Dismiss</span>
        </button>
      )}
    </div>
  )
}

interface InlineBannerStackProps {
  children: React.ReactNode
  className?: string
}

export function InlineBannerStack({ children, className }: InlineBannerStackProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {children}
    </div>
  )
}
