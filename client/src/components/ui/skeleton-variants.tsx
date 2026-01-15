import { cn } from "@/lib/utils"
import { Skeleton } from "./skeleton"

interface SkeletonTableRowsProps {
  rows?: number
  columns?: number
  className?: string
}

export function SkeletonTableRows({ 
  rows = 5, 
  columns = 5, 
  className 
}: SkeletonTableRowsProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center space-x-4 p-3 border rounded-lg">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton 
              key={colIndex} 
              className={cn(
                "h-4",
                colIndex === 0 ? "w-8" : "flex-1"
              )} 
            />
          ))}
        </div>
      ))}
    </div>
  )
}

interface SkeletonCardProps {
  className?: string
  showHeader?: boolean
  showFooter?: boolean
  lines?: number
}

export function SkeletonCard({ 
  className, 
  showHeader = true, 
  showFooter = false,
  lines = 3 
}: SkeletonCardProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-6 space-y-4", className)}>
      {showHeader && (
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      )}
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton 
            key={i} 
            className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")} 
          />
        ))}
      </div>
      {showFooter && (
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      )}
    </div>
  )
}

interface SkeletonKPICardProps {
  className?: string
}

export function SkeletonKPICard({ className }: SkeletonKPICardProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-6 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-5 rounded" />
      </div>
      <Skeleton className="h-8 w-28" />
      <div className="flex items-center space-x-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

interface SkeletonKPIGridProps {
  count?: number
  className?: string
}

export function SkeletonKPIGrid({ count = 4, className }: SkeletonKPIGridProps) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonKPICard key={i} />
      ))}
    </div>
  )
}

interface SkeletonTextBlockProps {
  lines?: number
  className?: string
}

export function SkeletonTextBlock({ lines = 4, className }: SkeletonTextBlockProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={cn(
            "h-4",
            i === 0 ? "w-3/4" : i === lines - 1 ? "w-1/2" : "w-full"
          )} 
        />
      ))}
    </div>
  )
}

interface SkeletonListProps {
  items?: number
  showAvatar?: boolean
  className?: string
}

export function SkeletonList({ 
  items = 5, 
  showAvatar = true, 
  className 
}: SkeletonListProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4">
          {showAvatar && <Skeleton className="h-10 w-10 rounded-full" />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

interface SkeletonChartProps {
  className?: string
  type?: "bar" | "line" | "area"
}

export function SkeletonChart({ className, type = "bar" }: SkeletonChartProps) {
  const bars = type === "bar" ? 8 : 12
  
  return (
    <div className={cn("rounded-lg border bg-card p-6", className)}>
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-5 w-32" />
        <div className="flex space-x-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>
      <div className="h-64 flex items-end justify-between space-x-2">
        {Array.from({ length: bars }).map((_, i) => (
          <Skeleton 
            key={i} 
            className="flex-1 rounded-t"
            style={{ 
              height: `${Math.random() * 60 + 30}%`,
              animationDelay: `${i * 100}ms`
            }} 
          />
        ))}
      </div>
      <div className="flex justify-between mt-4">
        {Array.from({ length: bars }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-8" />
        ))}
      </div>
    </div>
  )
}

interface SkeletonFormProps {
  fields?: number
  className?: string
}

export function SkeletonForm({ fields = 4, className }: SkeletonFormProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ))}
      <div className="flex justify-end space-x-3 pt-4">
        <Skeleton className="h-10 w-24 rounded-md" />
        <Skeleton className="h-10 w-24 rounded-md" />
      </div>
    </div>
  )
}
