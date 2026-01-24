import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle, AlertCircle, AlertTriangle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConfidenceTier = 'high' | 'medium' | 'low';
export type VerificationStatus = 'verified' | 'unverified' | 'potential_duplicate';

interface ConfidenceBadgeProps {
  confidence: number;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function getConfidenceTier(confidence: number): ConfidenceTier {
  if (confidence >= 90) return 'high';
  if (confidence >= 70) return 'medium';
  return 'low';
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 90) return 'bg-green-500 text-white hover:bg-green-600';
  if (confidence >= 70) return 'bg-yellow-500 text-black hover:bg-yellow-600';
  return 'bg-red-500 text-white hover:bg-red-600';
}

export function getConfidenceBorderColor(confidence: number): string {
  if (confidence >= 90) return 'border-green-500';
  if (confidence >= 70) return 'border-yellow-500';
  return 'border-red-500';
}

export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 90) return 'High Match';
  if (confidence >= 70) return 'Medium Match';
  return 'Low Match';
}

export function ConfidenceBadge({ 
  confidence, 
  showPercentage = true, 
  size = 'md',
  className 
}: ConfidenceBadgeProps) {
  const tier = getConfidenceTier(confidence);
  const colorClass = getConfidenceColor(confidence);
  const label = getConfidenceLabel(confidence);
  
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-0.5',
    lg: 'text-base px-3 py-1',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            className={cn(
              colorClass,
              sizeClasses[size],
              'font-semibold cursor-help',
              className
            )}
          >
            {showPercentage ? `${confidence}%` : label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{label} ({confidence}%)</p>
          <p className="text-xs text-muted-foreground">
            {tier === 'high' && 'Very likely the same property'}
            {tier === 'medium' && 'Possible match, review recommended'}
            {tier === 'low' && 'Unlikely to be the same property'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface VerificationBadgeProps {
  status: VerificationStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function getVerificationConfig(status: VerificationStatus) {
  switch (status) {
    case 'verified':
      return {
        label: 'Verified',
        color: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200',
        icon: CheckCircle,
        description: 'This listing has been verified as unique',
      };
    case 'unverified':
      return {
        label: 'Unverified',
        color: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-200',
        icon: HelpCircle,
        description: 'This listing needs verification review',
      };
    case 'potential_duplicate':
      return {
        label: 'Potential Duplicate',
        color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-200',
        icon: AlertTriangle,
        description: 'High similarity with another listing detected',
      };
  }
}

export function VerificationBadge({ 
  status, 
  size = 'md', 
  showIcon = true,
  className 
}: VerificationBadgeProps) {
  const config = getVerificationConfig(status);
  const Icon = config.icon;
  
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-0.5',
    lg: 'text-base px-3 py-1',
  };
  
  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline"
            className={cn(
              config.color,
              sizeClasses[size],
              'font-medium cursor-help',
              className
            )}
          >
            {showIcon && <Icon className={cn(iconSizes[size], 'mr-1')} />}
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface MatchScoresProps {
  scores: {
    name: number;
    address: number;
    coordinates: number;
    slips: number;
    price: number;
  };
  className?: string;
}

export function MatchScores({ scores, className }: MatchScoresProps) {
  const scoreItems = [
    { label: 'Name', value: scores.name },
    { label: 'Address', value: scores.address },
    { label: 'Location', value: scores.coordinates },
    { label: 'Slips', value: scores.slips },
    { label: 'Price', value: scores.price },
  ];

  return (
    <div className={cn('grid grid-cols-5 gap-2', className)}>
      {scoreItems.map(({ label, value }) => (
        <div key={label} className="text-center">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={cn(
            'text-sm font-semibold',
            value >= 80 ? 'text-green-600 dark:text-green-400' : 
            value >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 
            'text-gray-400'
          )}>
            {value > 0 ? `${value}%` : '-'}
          </div>
        </div>
      ))}
    </div>
  );
}

interface IdentityResolutionSummaryProps {
  potentialDuplicates: number;
  highestConfidence?: number;
  verificationStatus: VerificationStatus;
  className?: string;
}

export function IdentityResolutionSummary({
  potentialDuplicates,
  highestConfidence,
  verificationStatus,
  className,
}: IdentityResolutionSummaryProps) {
  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      <VerificationBadge status={verificationStatus} size="sm" />
      {potentialDuplicates > 0 && highestConfidence && (
        <>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground">
            {potentialDuplicates} potential {potentialDuplicates === 1 ? 'match' : 'matches'}
          </span>
          <ConfidenceBadge confidence={highestConfidence} size="sm" />
        </>
      )}
    </div>
  );
}
