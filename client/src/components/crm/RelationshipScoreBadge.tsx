/**
 * RelationshipScoreBadge
 *
 * Displays a contact's computed relationship strength score as a
 * compact A/B/C/D tier badge with color coding.
 *
 * Usage:
 *   <RelationshipScoreBadge contactId={contact.id} score={contact.relationshipScore} />
 */
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Flame, Thermometer, Wind } from 'lucide-react';

interface RelationshipScoreBadgeProps {
  contactId: string;
  /** Pre-fetched score (0–100). If not provided, fetches from API. */
  score?: number | null;
  /** Show the tier only (A/B/C/D) vs full label */
  compact?: boolean;
  className?: string;
}

type Tier = 'A' | 'B' | 'C' | 'D';

const tierConfig: Record<Tier, {
  label: string;
  icon: typeof Flame;
  cls: string;
}> = {
  A: { label: 'Hot',       icon: Flame,       cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  B: { label: 'Warm',      icon: Thermometer, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  C: { label: 'Lukewarm',  icon: Thermometer, cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  D: { label: 'Cold',      icon: Wind,        cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

function scoreToTier(score: number): Tier {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

export function RelationshipScoreBadge({
  contactId,
  score: externalScore,
  compact = false,
  className,
}: RelationshipScoreBadgeProps) {
  // Only fetch if score not provided
  const { data, isLoading } = useQuery({
    queryKey: ['rel-score', contactId],
    queryFn: () =>
      apiRequest('GET', `/api/crm/contacts/${contactId}/relationship-score`)
        .then(r => r.json()),
    enabled: externalScore == null && !!contactId,
    staleTime: 300_000, // 5 min
  });

  const score = externalScore ?? data?.score ?? null;

  if (isLoading && externalScore == null) {
    return <Skeleton className={cn('h-5 w-10 rounded', className)} />;
  }

  if (score == null) return null;

  const tier = scoreToTier(score);
  const config = tierConfig[tier];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold',
        config.cls,
        className,
      )}
      title={`Relationship score: ${score}/100 (${config.label})`}
    >
      <Icon className="h-3 w-3 flex-shrink-0" />
      {compact ? tier : config.label}
    </span>
  );
}

export default RelationshipScoreBadge;
