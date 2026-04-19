/**
 * FMEmptyState — reusable empty-state card for Financial Model surfaces.
 *
 * Shown when a tab has no underlying data to render, to prevent white-screen
 * or skeleton-stuck states during the beta program. Each instance links to
 * the action that unblocks the user (usually uploads or inputs).
 *
 * Usage:
 *   <FMEmptyState
 *     icon={Upload}
 *     title="No P&L data yet"
 *     description="Upload a P&L PDF to populate your pro forma."
 *     actionLabel="Upload P&L"
 *     actionHref={`/modeling/projects/${projectId}/workspace/uploads`}
 *   />
 */

import { Link } from 'wouter';
import { LucideIcon, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface FMEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  secondaryHref?: string;
  onSecondary?: () => void;
  className?: string;
}

export function FMEmptyState({
  icon: Icon = FileText,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  secondaryLabel,
  secondaryHref,
  onSecondary,
  className = '',
}: FMEmptyStateProps) {
  return (
    <Card className={`border-dashed ${className}`}>
      <CardContent className="flex flex-col items-center justify-center text-center py-12 px-6 space-y-4">
        <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center">
          <Icon className="h-7 w-7 text-teal-600" />
        </div>
        <div className="max-w-md space-y-2">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
        </div>
        {(actionLabel || secondaryLabel) && (
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            {actionLabel && actionHref && (
              <Link href={actionHref}>
                <Button size="sm" data-testid="fm-empty-primary-action">{actionLabel}</Button>
              </Link>
            )}
            {actionLabel && !actionHref && onAction && (
              <Button size="sm" onClick={onAction} data-testid="fm-empty-primary-action">{actionLabel}</Button>
            )}
            {secondaryLabel && secondaryHref && (
              <Link href={secondaryHref}>
                <Button size="sm" variant="outline" data-testid="fm-empty-secondary-action">{secondaryLabel}</Button>
              </Link>
            )}
            {secondaryLabel && !secondaryHref && onSecondary && (
              <Button size="sm" variant="outline" onClick={onSecondary} data-testid="fm-empty-secondary-action">
                {secondaryLabel}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
