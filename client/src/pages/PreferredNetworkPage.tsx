/**
 * MarinaMatch CRM - Preferred Network Page
 * 
 * Add to client/src/pages/PreferredNetworkPage.tsx
 * Then add route in your App.tsx
 */

import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLeaderboard } from '@/hooks/useContactIntelligence';
import { LeaderboardCard, RelationshipStatusPill } from '@/components/crm/ContactIntelligence';
import type {
  LeaderboardFilters,
  LeaderboardSortField,
  MetricsTimeframe,
  RelationshipStatus,
} from '@/types/contact-intelligence';
import {
  CONTACT_ROLE_OPTIONS,
  TIMEFRAME_OPTIONS,
  QUICK_FILTERS,
} from '@/types/contact-intelligence';

const PreferredNetworkPage: React.FC = () => {
  const [, navigate] = useLocation();
  
  // Filter state
  const [filters, setFilters] = useState<LeaderboardFilters>({
    relationshipStatus: ['preferred', 'approved', 'neutral'],
    timeframe: 'all',
  });
  const [sort, setSort] = useState<LeaderboardSortField>('score');
  const [sortDirection] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Fetch leaderboard
  const { data, isLoading, error } = useLeaderboard({
    filters: { ...filters, search: search || undefined },
    sort,
    sortDirection,
    page,
    pageSize,
  });

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  const handleQuickFilter = (sortField: LeaderboardSortField) => {
    setSort(sortField);
    setPage(1);
  };

  const handleFilterChange = (field: keyof LeaderboardFilters, value: any) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(1);
  };

  const handleViewContact = (contactId: string) => {
    // Navigate to contact detail or open modal
    navigate(`/contacts/${contactId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Preferred Network</h1>
          <p className="text-gray-500 mt-1">
            Your top-performing contacts ranked by relationship score and performance metrics
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Role filter */}
            <select
              value={filters.role || ''}
              onChange={(e) => handleFilterChange('role', e.target.value || undefined)}
              className="rounded-md border-gray-300 text-sm"
            >
              <option value="">All Roles</option>
              {CONTACT_ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* Status filter */}
            <select
              value={filters.relationshipStatus?.join(',') || 'preferred,approved,neutral'}
              onChange={(e) => {
                const statuses = e.target.value.split(',') as RelationshipStatus[];
                handleFilterChange('relationshipStatus', statuses);
              }}
              className="rounded-md border-gray-300 text-sm"
            >
              <option value="preferred,approved,neutral">All Active</option>
              <option value="preferred">Preferred Only</option>
              <option value="approved">Approved Only</option>
              <option value="preferred,approved">Preferred & Approved</option>
            </select>

            {/* Timeframe filter */}
            <select
              value={filters.timeframe || 'all'}
              onChange={(e) => handleFilterChange('timeframe', e.target.value as MetricsTimeframe)}
              className="rounded-md border-gray-300 text-sm"
            >
              {TIMEFRAME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as LeaderboardSortField)}
              className="rounded-md border-gray-300 text-sm"
            >
              <option value="score">Sort by Score</option>
              <option value="volume">Sort by Volume</option>
              <option value="deals">Sort by Deals</option>
              <option value="feesWaived">Sort by Fees Waived</option>
              <option value="closeRate">Sort by Close Rate</option>
              <option value="recent">Sort by Recent Activity</option>
            </select>

            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search contacts..."
                className="w-full pl-10 pr-4 py-2 rounded-md border-gray-300 text-sm"
              />
            </div>
          </div>

          {/* Quick filters */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <span className="text-sm text-gray-500 mr-2">Quick filters:</span>
            {QUICK_FILTERS.map((qf) => (
              <button
                key={qf.id}
                onClick={() => handleQuickFilter(qf.sort)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  sort === qf.sort
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                    : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                }`}
              >
                {qf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse h-48 bg-gray-200 rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500">Error loading network. Please try again.</p>
          </div>
        ) : data?.entries.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-5xl mb-4">🔍</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts found</h3>
            <p className="text-gray-500">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <>
            {/* Results count */}
            <p className="text-sm text-gray-500 mb-4">
              Showing {data?.entries.length} of {data?.total} contacts
            </p>

            {/* Cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data?.entries.map((entry, index) => (
                <LeaderboardCard
                  key={entry.id}
                  entry={entry}
                  rank={(page - 1) * pageSize + index + 1}
                  onClick={() => handleViewContact(entry.id)}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`px-3 py-1 rounded-md text-sm font-medium ${
                          page === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PreferredNetworkPage;
