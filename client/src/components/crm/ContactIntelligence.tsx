/**
 * MarinaMatch CRM - Contact Intelligence Components
 * 
 * Add to client/src/components/crm/ContactIntelligence.tsx
 */

import React, { useState } from 'react';
import { 
  Star, TrendingUp, Flame, Zap, DollarSign, Target, Heart, Award,
  ChevronDown, Search, Filter
} from 'lucide-react';
import { useContactMetrics, useLeaderboard, useUpdateContactRelationship } from '@/hooks/useContactIntelligence';
import type {
  RelationshipStatus,
  VisibilityScope,
  MetricsTimeframe,
  LeaderboardSortField,
  Badge,
  LeaderboardEntry,
  ContactRelationshipUpdate,
} from '@/types/contact-intelligence';
import {
  RELATIONSHIP_STATUS_CONFIG,
  BADGE_CONFIG,
  CONTACT_ROLE_OPTIONS,
  TIMEFRAME_OPTIONS,
  QUICK_FILTERS,
} from '@/types/contact-intelligence';

// ============================================================================
// STATUS PILL COMPONENT
// ============================================================================

interface StatusPillProps {
  status: RelationshipStatus;
  size?: 'sm' | 'md';
}

export const RelationshipStatusPill: React.FC<StatusPillProps> = ({ status, size = 'md' }) => {
  const config = RELATIONSHIP_STATUS_CONFIG[status];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';
  
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${config.bgColor} ${config.color} ${sizeClasses}`}>
      {config.label}
    </span>
  );
};

// ============================================================================
// BADGE COMPONENT
// ============================================================================

const BADGE_ICONS: Record<string, React.ReactNode> = {
  preferred_partner: <Star className="w-3 h-3" />,
  top_volume: <TrendingUp className="w-3 h-3" />,
  deal_machine: <Flame className="w-3 h-3" />,
  fast_mover: <Zap className="w-3 h-3" />,
  fee_saver: <DollarSign className="w-3 h-3" />,
  high_close_rate: <Target className="w-3 h-3" />,
  team_favorite: <Heart className="w-3 h-3" />,
  rising_star: <Award className="w-3 h-3" />,
};

interface BadgeProps {
  badge: Badge;
  size?: 'sm' | 'md';
}

export const ContactBadge: React.FC<BadgeProps> = ({ badge, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm';
  
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full text-white font-medium ${badge.color} ${sizeClasses}`}
      title={badge.reason}
    >
      {BADGE_ICONS[badge.key] || badge.icon}
      <span>{badge.label}</span>
    </span>
  );
};

interface BadgeRowProps {
  badges: Badge[];
  maxVisible?: number;
  size?: 'sm' | 'md';
}

export const BadgeRow: React.FC<BadgeRowProps> = ({ badges, maxVisible = 4, size = 'sm' }) => {
  const visible = badges.slice(0, maxVisible);
  const hidden = badges.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((badge) => (
        <ContactBadge key={badge.key} badge={badge} size={size} />
      ))}
      {hidden > 0 && (
        <span className="text-xs text-gray-500 self-center">+{hidden} more</span>
      )}
    </div>
  );
};

// ============================================================================
// SCORE GAUGE COMPONENT
// ============================================================================

interface ScoreGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score, size = 'md', showLabel = true }) => {
  const getColor = (s: number) => {
    if (s >= 80) return 'text-green-600 bg-green-100';
    if (s >= 60) return 'text-blue-600 bg-blue-100';
    if (s >= 40) return 'text-yellow-600 bg-yellow-100';
    if (s >= 20) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const sizeClasses = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-14 h-14 text-lg',
    lg: 'w-18 h-18 text-xl',
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`rounded-full ${getColor(score)} ${sizeClasses[size]} flex items-center justify-center font-bold`}>
        {score}
      </div>
      {showLabel && <span className="text-xs text-gray-500">Score</span>}
    </div>
  );
};

// ============================================================================
// METRIC CARD COMPONENT
// ============================================================================

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({ label, value, subValue, className = '' }) => {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {subValue && <p className="text-sm text-gray-500 mt-1">{subValue}</p>}
    </div>
  );
};

// ============================================================================
// CONTACT METRICS DISPLAY
// ============================================================================

interface ContactMetricsDisplayProps {
  contactId: string;
}

export const ContactMetricsDisplay: React.FC<ContactMetricsDisplayProps> = ({ contactId }) => {
  const [timeframe, setTimeframe] = useState<MetricsTimeframe>('all');
  const { data: metrics, isLoading, error } = useContactMetrics(contactId, timeframe);

  const formatCurrency = (amount: number) => {
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}k`;
    return `$${amount.toFixed(0)}`;
  };

  if (isLoading) {
    return <div className="animate-pulse h-48 bg-gray-100 rounded-lg" />;
  }

  if (error || !metrics) {
    return <div className="text-gray-500 py-8 text-center">Unable to load metrics</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with timeframe selector */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Performance Metrics</h3>
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value as MetricsTimeframe)}
          className="rounded-md border-gray-300 text-sm"
        >
          {TIMEFRAME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Score and badges row */}
      <div className="flex items-start gap-6">
        <ScoreGauge score={metrics.relationshipScore} size="lg" />
        <div className="flex-1">
          <p className="text-sm text-gray-500 mb-2">Earned Badges</p>
          {metrics.badges.length > 0 ? (
            <BadgeRow badges={metrics.badges} maxVisible={6} />
          ) : (
            <p className="text-sm text-gray-400">No badges yet</p>
          )}
        </div>
      </div>

      {/* Metric cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Deals Closed"
          value={metrics.dealsClosedWon}
          subValue={`${metrics.dealsActive} active`}
        />
        <MetricCard
          label="Total Volume"
          value={formatCurrency(metrics.totalVolume)}
          subValue={`${formatCurrency(metrics.avgDealSize)} avg`}
        />
        <MetricCard
          label="Close Rate"
          value={`${(metrics.closeRate * 100).toFixed(0)}%`}
          subValue={`${metrics.dealsClosedWon + metrics.dealsClosedLost} decisions`}
        />
        <MetricCard
          label="Fees Waived"
          value={formatCurrency(metrics.feesWaived)}
          subValue={`${formatCurrency(metrics.feesPaid)} paid`}
        />
      </div>
    </div>
  );
};

// ============================================================================
// RELATIONSHIP EDIT SECTION (for modals/forms)
// ============================================================================

interface RelationshipEditSectionProps {
  contact: {
    id: string;
    primaryRole?: string | null;
    relationshipStatus?: RelationshipStatus;
    includeInMetrics?: boolean;
    isPublicShowcase?: boolean;
    publicProfileSlug?: string | null;
    headline?: string | null;
    specialties?: string[] | null;
    serviceRegions?: string[] | null;
    visibilityScope?: VisibilityScope;
    badgeOverrides?: Record<string, boolean> | null;
  };
  onUpdate: (data: ContactRelationshipUpdate) => void;
  isSaving?: boolean;
}

export const RelationshipEditSection: React.FC<RelationshipEditSectionProps> = ({
  contact,
  onUpdate,
  isSaving = false,
}) => {
  const [formData, setFormData] = useState({
    primaryRole: contact.primaryRole || '',
    relationshipStatus: contact.relationshipStatus || 'neutral',
    includeInMetrics: contact.includeInMetrics ?? true,
    isPublicShowcase: contact.isPublicShowcase ?? false,
    headline: contact.headline || '',
    specialties: contact.specialties?.join(', ') || '',
    serviceRegions: contact.serviceRegions?.join(', ') || '',
    visibilityScope: contact.visibilityScope || 'private',
    teamFavorite: contact.badgeOverrides?.team_favorite ?? false,
  });

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      
      // Business logic
      if (field === 'includeInMetrics' && value === false) {
        updated.relationshipStatus = 'do_not_track';
        updated.isPublicShowcase = false;
      }
      if (field === 'relationshipStatus' && ['do_not_track', 'hidden'].includes(value)) {
        updated.includeInMetrics = false;
        updated.isPublicShowcase = false;
      }
      
      return updated;
    });
  };

  const handleSave = () => {
    onUpdate({
      primaryRole: formData.primaryRole || null,
      relationshipStatus: formData.relationshipStatus as RelationshipStatus,
      includeInMetrics: formData.includeInMetrics,
      isPublicShowcase: formData.isPublicShowcase,
      headline: formData.headline || null,
      specialties: formData.specialties ? formData.specialties.split(',').map(s => s.trim()).filter(Boolean) : null,
      serviceRegions: formData.serviceRegions ? formData.serviceRegions.split(',').map(s => s.trim()).filter(Boolean) : null,
      visibilityScope: formData.visibilityScope as VisibilityScope,
      badgeOverrides: { team_favorite: formData.teamFavorite },
    });
  };

  const canShowPublic = ['preferred', 'approved'].includes(formData.relationshipStatus);

  return (
    <div className="space-y-6 border-t border-gray-200 pt-6">
      <h3 className="text-lg font-medium text-gray-900">Relationship & Performance</h3>

      {/* Primary Role */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Primary Role</label>
        <select
          value={formData.primaryRole}
          onChange={(e) => handleChange('primaryRole', e.target.value)}
          className="w-full rounded-md border-gray-300"
        >
          <option value="">Select a role...</option>
          {CONTACT_ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Relationship Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Relationship Status</label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(RELATIONSHIP_STATUS_CONFIG) as RelationshipStatus[]).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => handleChange('relationshipStatus', status)}
              className={`px-3 py-2 rounded-lg border-2 transition-colors ${
                formData.relationshipStatus === status
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <RelationshipStatusPill status={status} size="sm" />
            </button>
          ))}
        </div>
        {formData.relationshipStatus === 'do_not_track' && (
          <p className="text-sm text-amber-600 mt-2">
            ⚠️ This contact will be excluded from metrics and leaderboards.
          </p>
        )}
      </div>

      {/* Include in Metrics toggle */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-gray-700">Include in Metrics</span>
          <p className="text-xs text-gray-500">Track performance in leaderboards</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={formData.includeInMetrics}
            onChange={(e) => handleChange('includeInMetrics', e.target.checked)}
            disabled={['do_not_track', 'hidden'].includes(formData.relationshipStatus)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
        </label>
      </div>

      {/* Public Showcase section */}
      {canShowPublic && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700">Add to Preferred Network</span>
              <p className="text-xs text-gray-500">Feature on public network page</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isPublicShowcase}
                onChange={(e) => handleChange('isPublicShowcase', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
          </div>

          {formData.isPublicShowcase && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Headline</label>
                <input
                  type="text"
                  value={formData.headline}
                  onChange={(e) => handleChange('headline', e.target.value)}
                  placeholder="Senior Partner at..."
                  className="w-full rounded-md border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Specialties (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.specialties}
                  onChange={(e) => handleChange('specialties', e.target.value)}
                  placeholder="Marina acquisitions, SBA loans..."
                  className="w-full rounded-md border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Regions (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.serviceRegions}
                  onChange={(e) => handleChange('serviceRegions', e.target.value)}
                  placeholder="Florida, Southeast..."
                  className="w-full rounded-md border-gray-300"
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Team Favorite toggle */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-gray-700">Team Favorite Badge</span>
          <p className="text-xs text-gray-500">Manually assign Team Favorite badge</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={formData.teamFavorite}
            onChange={(e) => handleChange('teamFavorite', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
        </label>
      </div>

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {isSaving ? 'Saving...' : 'Save Relationship Settings'}
      </button>
    </div>
  );
};

// ============================================================================
// LEADERBOARD CARD
// ============================================================================

interface LeaderboardCardProps {
  entry: LeaderboardEntry;
  rank: number;
  onClick?: () => void;
}

export const LeaderboardCard: React.FC<LeaderboardCardProps> = ({ entry, rank, onClick }) => {
  const formatCurrency = (amount: number) => {
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}k`;
    return `$${amount.toFixed(0)}`;
  };

  return (
    <div 
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            rank <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {rank}
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">{entry.name}</h4>
            {entry.company && <p className="text-sm text-gray-500">{entry.company}</p>}
          </div>
        </div>
        <ScoreGauge score={entry.score} size="sm" showLabel={false} />
      </div>

      {/* Status and role */}
      <div className="flex items-center gap-2 mb-3">
        <RelationshipStatusPill status={entry.relationshipStatus} size="sm" />
        {entry.primaryRole && (
          <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
            {CONTACT_ROLE_OPTIONS.find(r => r.value === entry.primaryRole)?.label || entry.primaryRole}
          </span>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-3">
        <div><span className="text-gray-500">Deals:</span> <span className="font-medium">{entry.metricsSummary.dealsClosedWon}</span></div>
        <div><span className="text-gray-500">Volume:</span> <span className="font-medium">{formatCurrency(entry.metricsSummary.totalVolume)}</span></div>
        <div><span className="text-gray-500">Waived:</span> <span className="font-medium">{formatCurrency(entry.metricsSummary.feesWaived)}</span></div>
        <div><span className="text-gray-500">Close:</span> <span className="font-medium">{(entry.metricsSummary.closeRate * 100).toFixed(0)}%</span></div>
      </div>

      {/* Badges */}
      {entry.badges.length > 0 && (
        <BadgeRow badges={entry.badges} maxVisible={3} size="sm" />
      )}
    </div>
  );
};

export default {
  RelationshipStatusPill,
  ContactBadge,
  BadgeRow,
  ScoreGauge,
  MetricCard,
  ContactMetricsDisplay,
  RelationshipEditSection,
  LeaderboardCard,
};
