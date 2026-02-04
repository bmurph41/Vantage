export const RELATIONSHIP_STATUS_CONFIG = {
  preferred: { label: 'Preferred', color: 'emerald', description: 'Go-to partner for transactions' },
  approved: { label: 'Approved', color: 'blue', description: 'Vetted and approved vendor' },
  neutral: { label: 'Neutral', color: 'gray', description: 'No strong opinion yet' },
  do_not_track: { label: 'Do Not Track', color: 'orange', description: 'Excluded from metrics' },
  hidden: { label: 'Hidden', color: 'red', description: 'Not shown in results' },
} as const;

export const CONTACT_ROLE_OPTIONS = [
  { value: 'seller', label: 'Seller' },
  { value: 'attorney', label: 'Attorney' },
  { value: 'lender', label: 'Lender' },
  { value: 'title_insurance', label: 'Title Insurance' },
  { value: 'inspector', label: 'Inspector' },
  { value: 'surveyor', label: 'Surveyor' },
  { value: 'environmental', label: 'Environmental' },
  { value: 'appraiser', label: 'Appraiser' },
  { value: 'broker', label: 'Broker' },
  { value: 'insurance_agent', label: 'Insurance Agent' },
  { value: 'other', label: 'Other' },
] as const;

export const TIMEFRAME_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'last_12', label: 'Last 12 Months' },
  { value: 'last_24', label: 'Last 24 Months' },
] as const;

export const QUICK_FILTERS = [
  { id: 'preferred', label: 'Preferred Partners', icon: 'Star' },
  { id: 'top_volume', label: 'Top Volume', icon: 'TrendingUp' },
  { id: 'recent', label: 'Recently Active', icon: 'Clock' },
  { id: 'high_rated', label: 'High Rated', icon: 'Award' },
] as const;

export type RelationshipStatus = keyof typeof RELATIONSHIP_STATUS_CONFIG;
export type ContactRole = typeof CONTACT_ROLE_OPTIONS[number]['value'];
export type MetricsTimeframe = typeof TIMEFRAME_OPTIONS[number]['value'];
export type LeaderboardSortField = 'score' | 'volume' | 'deals' | 'name';
