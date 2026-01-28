/**
 * CompletionIndicator Component
 * Visual indicator showing completion status for sections and documents
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Loader2,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export type CompletionStatusType = 'complete' | 'partial' | 'incomplete' | 'warning' | 'error' | 'loading';

export interface CompletionIndicatorProps {
  /** Completion percentage (0-100) */
  percentage?: number;
  /** Status type for icon/color */
  status?: CompletionStatusType;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show percentage text */
  showPercentage?: boolean;
  /** Show status label */
  showLabel?: boolean;
  /** Custom label override */
  label?: string;
  /** Additional CSS classes */
  className?: string;
  /** Show as a ring/circle progress */
  variant?: 'icon' | 'ring' | 'bar' | 'badge';
  /** Enable animation */
  animated?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getStatusFromPercentage(percentage: number): CompletionStatusType {
  if (percentage >= 100) return 'complete';
  if (percentage >= 50) return 'partial';
  return 'incomplete';
}

function getStatusIcon(status: CompletionStatusType, size: 'sm' | 'md' | 'lg') {
  const sizeMap = { sm: 14, md: 18, lg: 24 };
  const iconSize = sizeMap[size];

  switch (status) {
    case 'complete':
      return <CheckCircle2 size={iconSize} className="text-green-600" />;
    case 'partial':
      return <Clock size={iconSize} className="text-yellow-500" />;
    case 'incomplete':
      return <Circle size={iconSize} className="text-gray-400" />;
    case 'warning':
      return <AlertTriangle size={iconSize} className="text-yellow-500" />;
    case 'error':
      return <XCircle size={iconSize} className="text-red-500" />;
    case 'loading':
      return <Loader2 size={iconSize} className="text-blue-500 animate-spin" />;
    default:
      return <Circle size={iconSize} className="text-gray-400" />;
  }
}

function getStatusColor(status: CompletionStatusType) {
  switch (status) {
    case 'complete':
      return { bg: 'bg-green-100', fg: 'text-green-700', border: 'border-green-200', fill: 'bg-green-500' };
    case 'partial':
      return { bg: 'bg-yellow-50', fg: 'text-yellow-700', border: 'border-yellow-200', fill: 'bg-yellow-500' };
    case 'incomplete':
      return { bg: 'bg-gray-100', fg: 'text-gray-600', border: 'border-gray-200', fill: 'bg-gray-400' };
    case 'warning':
      return { bg: 'bg-yellow-50', fg: 'text-yellow-700', border: 'border-yellow-200', fill: 'bg-yellow-500' };
    case 'error':
      return { bg: 'bg-red-50', fg: 'text-red-700', border: 'border-red-200', fill: 'bg-red-500' };
    case 'loading':
      return { bg: 'bg-blue-50', fg: 'text-blue-700', border: 'border-blue-200', fill: 'bg-blue-500' };
    default:
      return { bg: 'bg-gray-100', fg: 'text-gray-600', border: 'border-gray-200', fill: 'bg-gray-400' };
  }
}

function getStatusLabel(status: CompletionStatusType) {
  switch (status) {
    case 'complete':
      return 'Complete';
    case 'partial':
      return 'In Progress';
    case 'incomplete':
      return 'Not Started';
    case 'warning':
      return 'Warning';
    case 'error':
      return 'Error';
    case 'loading':
      return 'Loading';
    default:
      return 'Unknown';
  }
}

// =============================================================================
// Components
// =============================================================================

/**
 * Icon variant - simple icon with optional percentage
 */
function IconVariant({
  percentage,
  status,
  size,
  showPercentage,
  showLabel,
  label,
  animated,
}: CompletionIndicatorProps) {
  const effectiveStatus = status ?? (percentage !== undefined ? getStatusFromPercentage(percentage) : 'incomplete');
  const effectiveLabel = label ?? getStatusLabel(effectiveStatus);

  return (
    <div className="flex items-center gap-1.5">
      <span className={cn(animated && effectiveStatus === 'loading' && 'animate-pulse')}>
        {getStatusIcon(effectiveStatus, size ?? 'md')}
      </span>
      {showPercentage && percentage !== undefined && (
        <span className={cn('text-sm font-medium', getStatusColor(effectiveStatus).fg)}>
          {Math.round(percentage)}%
        </span>
      )}
      {showLabel && (
        <span className={cn('text-sm', getStatusColor(effectiveStatus).fg)}>
          {effectiveLabel}
        </span>
      )}
    </div>
  );
}

/**
 * Ring variant - circular progress indicator
 */
function RingVariant({
  percentage = 0,
  status,
  size,
  showPercentage,
  animated,
}: CompletionIndicatorProps) {
  const effectiveStatus = status ?? getStatusFromPercentage(percentage);
  const colors = getStatusColor(effectiveStatus);
  
  const sizeMap = { sm: 32, md: 48, lg: 64 };
  const strokeMap = { sm: 3, md: 4, lg: 5 };
  const ringSize = sizeMap[size ?? 'md'];
  const strokeWidth = strokeMap[size ?? 'md'];
  
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative" style={{ width: ringSize, height: ringSize }}>
      <svg width={ringSize} height={ringSize} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200"
        />
        {/* Progress ring */}
        <circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(
            colors.fg.replace('text-', 'text-'),
            animated && 'transition-all duration-500'
          )}
        />
      </svg>
      {showPercentage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-semibold', colors.fg, size === 'sm' ? 'text-xs' : 'text-sm')}>
            {Math.round(percentage)}%
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Bar variant - horizontal progress bar
 */
function BarVariant({
  percentage = 0,
  status,
  size,
  showPercentage,
  showLabel,
  label,
  animated,
}: CompletionIndicatorProps) {
  const effectiveStatus = status ?? getStatusFromPercentage(percentage);
  const colors = getStatusColor(effectiveStatus);
  const effectiveLabel = label ?? getStatusLabel(effectiveStatus);

  const heightMap = { sm: 'h-1', md: 'h-2', lg: 'h-3' };
  const height = heightMap[size ?? 'md'];

  return (
    <div className="w-full space-y-1">
      {(showLabel || showPercentage) && (
        <div className="flex items-center justify-between text-sm">
          {showLabel && <span className={colors.fg}>{effectiveLabel}</span>}
          {showPercentage && (
            <span className={cn('font-medium', colors.fg)}>{Math.round(percentage)}%</span>
          )}
        </div>
      )}
      <div className={cn('w-full rounded-full bg-gray-200 overflow-hidden', height)}>
        <div
          className={cn(
            'h-full rounded-full',
            colors.fill,
            animated && 'transition-all duration-500'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Badge variant - compact badge with icon
 */
function BadgeVariant({
  percentage,
  status,
  size,
  showPercentage,
  label,
}: CompletionIndicatorProps) {
  const effectiveStatus = status ?? (percentage !== undefined ? getStatusFromPercentage(percentage) : 'incomplete');
  const colors = getStatusColor(effectiveStatus);
  const effectiveLabel = label ?? getStatusLabel(effectiveStatus);

  const paddingMap = { sm: 'px-1.5 py-0.5', md: 'px-2 py-1', lg: 'px-3 py-1.5' };
  const textMap = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        colors.bg,
        colors.fg,
        colors.border,
        paddingMap[size ?? 'md'],
        textMap[size ?? 'md']
      )}
    >
      {getStatusIcon(effectiveStatus, 'sm')}
      {showPercentage && percentage !== undefined ? `${Math.round(percentage)}%` : effectiveLabel}
    </span>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function CompletionIndicator({
  variant = 'icon',
  ...props
}: CompletionIndicatorProps) {
  switch (variant) {
    case 'ring':
      return <RingVariant {...props} />;
    case 'bar':
      return <BarVariant {...props} />;
    case 'badge':
      return <BadgeVariant {...props} />;
    default:
      return <IconVariant {...props} />;
  }
}

// =============================================================================
// Compound Components
// =============================================================================

/**
 * Section completion with detailed breakdown
 */
export interface SectionCompletionProps {
  sectionName: string;
  percentage: number;
  bindingsComplete: number;
  bindingsTotal: number;
  mediaComplete: number;
  mediaTotal: number;
  aiGenerated: boolean;
  className?: string;
}

export function SectionCompletion({
  sectionName,
  percentage,
  bindingsComplete,
  bindingsTotal,
  mediaComplete,
  mediaTotal,
  aiGenerated,
  className,
}: SectionCompletionProps) {
  const status = percentage >= 100 ? 'complete' : percentage > 0 ? 'partial' : 'incomplete';

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon(status, 'sm')}
          <span className="text-sm font-medium">{sectionName}</span>
        </div>
        <span className="text-sm text-muted-foreground">{Math.round(percentage)}%</span>
      </div>
      
      <CompletionIndicator variant="bar" percentage={percentage} size="sm" animated />
      
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>
          Data: {bindingsComplete}/{bindingsTotal}
        </span>
        <span>
          Media: {mediaComplete}/{mediaTotal}
        </span>
        {aiGenerated && (
          <span className="text-purple-600">AI Generated</span>
        )}
      </div>
    </div>
  );
}

/**
 * Document completion overview
 */
export interface DocumentCompletionOverviewProps {
  title: string;
  sectionsComplete: number;
  sectionsTotal: number;
  bindingsComplete: number;
  bindingsTotal: number;
  mediaComplete: number;
  mediaTotal: number;
  aiSectionsCount: number;
  readyForExport: boolean;
  className?: string;
}

export function DocumentCompletionOverview({
  title,
  sectionsComplete,
  sectionsTotal,
  bindingsComplete,
  bindingsTotal,
  mediaComplete,
  mediaTotal,
  aiSectionsCount,
  readyForExport,
  className,
}: DocumentCompletionOverviewProps) {
  const sectionPercentage = sectionsTotal > 0 ? (sectionsComplete / sectionsTotal) * 100 : 0;
  const bindingPercentage = bindingsTotal > 0 ? (bindingsComplete / bindingsTotal) * 100 : 100;
  const mediaPercentage = mediaTotal > 0 ? (mediaComplete / mediaTotal) * 100 : 100;
  const overallPercentage = (sectionPercentage + bindingPercentage + mediaPercentage) / 3;

  return (
    <div className={cn('rounded-lg border bg-card p-4 space-y-4', className)}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">
            {readyForExport ? 'Ready to export' : 'Requires additional data'}
          </p>
        </div>
        <CompletionIndicator
          variant="ring"
          percentage={overallPercentage}
          showPercentage
          size="md"
          animated
        />
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Sections</span>
            <span>{sectionsComplete}/{sectionsTotal}</span>
          </div>
          <CompletionIndicator variant="bar" percentage={sectionPercentage} size="sm" />
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Data Bindings</span>
            <span>{bindingsComplete}/{bindingsTotal}</span>
          </div>
          <CompletionIndicator variant="bar" percentage={bindingPercentage} size="sm" />
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Media Assets</span>
            <span>{mediaComplete}/{mediaTotal}</span>
          </div>
          <CompletionIndicator variant="bar" percentage={mediaPercentage} size="sm" />
        </div>
      </div>

      {aiSectionsCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-purple-600 pt-2 border-t">
          <Loader2 size={14} className="opacity-50" />
          <span>{aiSectionsCount} section{aiSectionsCount > 1 ? 's' : ''} with AI-generated content</span>
        </div>
      )}

      <CompletionIndicator
        variant="badge"
        status={readyForExport ? 'complete' : 'partial'}
        label={readyForExport ? 'Ready for Export' : 'In Progress'}
        size="sm"
      />
    </div>
  );
}

export default CompletionIndicator;
