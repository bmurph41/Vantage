/**
 * Auto-Confirmed Badge Component
 * Displays a badge indicating that a line item was auto-confirmed by the learning rules system.
 */

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ConfidenceTier = 'high' | 'medium' | 'low';

interface LearningRuleFields {
  autoConfirmed?: boolean;
  confidence?: ConfidenceTier;
  ruleId?: string;
  learningRuleApplied?: boolean;
}

interface AutoConfirmedBadgeProps {
  item: LearningRuleFields;
  variant?: 'full' | 'compact';
  showTooltip?: boolean;
  className?: string;
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function LightBulbIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

interface BadgeConfig {
  label: string;
  shortLabel: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  tooltip: string;
  Icon: React.FC<{ className?: string }>;
}

function getConfig(confidence?: ConfidenceTier, autoConfirmed?: boolean): BadgeConfig {
  if (autoConfirmed && confidence === 'high') {
    return {
      label: 'Auto-Confirmed',
      shortLabel: 'Auto',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
      borderColor: 'border-green-200',
      tooltip: 'Automatically confirmed based on your previous selections',
      Icon: CheckCircleIcon,
    };
  }

  if (confidence === 'medium') {
    return {
      label: 'Suggested',
      shortLabel: 'Suggested',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-700',
      borderColor: 'border-amber-200',
      tooltip: 'Category suggested based on similar items you\'ve categorized',
      Icon: LightBulbIcon,
    };
  }

  return {
    label: 'Learned',
    shortLabel: 'Learned',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    tooltip: 'Category pre-filled from your previous selections',
    Icon: SparklesIcon,
  };
}

export function AutoConfirmedBadge({
  item,
  variant = 'full',
  showTooltip = true,
  className = '',
}: AutoConfirmedBadgeProps) {
  if (!item.autoConfirmed && !item.learningRuleApplied) {
    return null;
  }

  const config = getConfig(item.confidence, item.autoConfirmed);
  const label = variant === 'compact' ? config.shortLabel : config.label;

  const badge = (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
        ${config.bgColor} ${config.textColor} ${config.borderColor} border
        ${className}
      `}
    >
      <config.Icon className="w-3 h-3" />
      {label}
    </span>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function InlineAutoConfirmIndicator({
  item,
  className = '',
}: { item: LearningRuleFields; className?: string }) {
  if (!item.autoConfirmed) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-block w-2 h-2 rounded-full bg-green-500 ${className}`}
          />
        </TooltipTrigger>
        <TooltipContent>
          <p>Auto-confirmed from previous selections</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default AutoConfirmedBadge;
