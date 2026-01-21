import { Check, Loader2, AlertCircle, Cloud, CloudOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { AutoSaveStatus } from "@/hooks/use-form-autosave";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AutosaveIndicatorProps {
  status: AutoSaveStatus;
  lastSavedAt?: Date | null;
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: {
    icon: 'h-3 w-3',
    text: 'text-xs',
    container: 'gap-1 px-1.5 py-0.5'
  },
  md: {
    icon: 'h-4 w-4',
    text: 'text-sm',
    container: 'gap-1.5 px-2 py-1'
  },
  lg: {
    icon: 'h-5 w-5',
    text: 'text-base',
    container: 'gap-2 px-3 py-1.5'
  }
};

export function AutosaveIndicator({ 
  status, 
  lastSavedAt, 
  className,
  showText = true,
  size = 'sm'
}: AutosaveIndicatorProps) {
  const sizes = sizeClasses[size];
  
  const getContent = () => {
    switch (status) {
      case 'saving':
        return {
          icon: <Loader2 className={cn(sizes.icon, "animate-spin text-blue-500")} />,
          text: 'Saving...',
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20'
        };
      case 'saved':
        return {
          icon: <Check className={cn(sizes.icon, "text-green-500")} />,
          text: lastSavedAt 
            ? `Saved ${formatDistanceToNow(lastSavedAt, { addSuffix: true })}` 
            : 'Saved',
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-900/20'
        };
      case 'error':
        return {
          icon: <AlertCircle className={cn(sizes.icon, "text-red-500")} />,
          text: 'Save failed',
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-50 dark:bg-red-900/20'
        };
      default:
        if (lastSavedAt) {
          return {
            icon: <Cloud className={cn(sizes.icon, "text-slate-400")} />,
            text: `Last saved ${formatDistanceToNow(lastSavedAt, { addSuffix: true })}`,
            color: 'text-slate-500 dark:text-slate-400',
            bgColor: 'bg-slate-50 dark:bg-slate-800/50'
          };
        }
        return {
          icon: <Cloud className={cn(sizes.icon, "text-slate-400")} />,
          text: 'Auto-save enabled',
          color: 'text-slate-500 dark:text-slate-400',
          bgColor: 'bg-slate-50 dark:bg-slate-800/50'
        };
    }
  };

  const content = getContent();

  if (!showText) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              "inline-flex items-center justify-center rounded-full",
              sizes.container,
              content.bgColor,
              className
            )}>
              {content.icon}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{content.text}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn(
      "inline-flex items-center rounded-full",
      sizes.container,
      content.bgColor,
      content.color,
      className
    )}>
      {content.icon}
      <span className={sizes.text}>{content.text}</span>
    </div>
  );
}

interface AutosaveBadgeProps {
  enabled?: boolean;
  status?: AutoSaveStatus;
  className?: string;
}

export function AutosaveBadge({ enabled = true, status, className }: AutosaveBadgeProps) {
  if (!enabled) {
    return (
      <div className={cn(
        "inline-flex items-center gap-1 text-xs text-slate-400 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800",
        className
      )}>
        <CloudOff className="h-3 w-3" />
        <span>Auto-save off</span>
      </div>
    );
  }

  return (
    <AutosaveIndicator 
      status={status || 'idle'} 
      className={className}
      showText
      size="sm"
    />
  );
}
