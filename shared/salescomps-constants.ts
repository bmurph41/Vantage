// Profit Centers (Revenue Streams) constants for SalesComps
export const PROFIT_CENTERS = [
  'Storage',
  'Fuel', 
  'Events',
  'Ship Store',
  'Service',
  'Parts',
  'Third-Party Leases',
  'Boat Club',
  'Boat Rentals',
  'Boat Sales',
  'Boat Brokerage',
  'F&B',
  'RV Park',
  'Hospitality/Accommodations'
] as const;

export type ProfitCenter = typeof PROFIT_CENTERS[number];

// Coastal types
export const COASTAL_TYPES = ['coastal', 'lake'] as const;
export type CoastalType = typeof COASTAL_TYPES[number];

// Storage types for marinas
export const STORAGE_TYPES = [
  'Wet Slips',
  'Indoor Dry Racks', 
  'Outdoor Dry Racks',
  'Moorings',
  'Jet Skis',
  'Land Storage'
] as const;
export type StorageType = typeof STORAGE_TYPES[number];

// Default recommendation weights
export const DEFAULT_RECOMMENDATION_WEIGHTS = {
  capacity: 0.40,
  financial: 0.35,
  profitCenters: 0.15,
  regional: 0.07,
  geo: 0.03,
} as const;

// Recommendation actions for feedback
export const RECOMMENDATION_ACTIONS = [
  'selected',
  'rejected', 
  'liked',
  'viewed'
] as const;

export type RecommendationAction = typeof RECOMMENDATION_ACTIONS[number];

// Capacity size buckets for preference segmentation
export const CAPACITY_BUCKETS = {
  small: { min: 0, max: 199, label: 'Small (< 200 slips)' },
  medium: { min: 200, max: 499, label: 'Medium (200-499 slips)' },
  large: { min: 500, max: Infinity, label: 'Large (500+ slips)' },
} as const;

export function getCapacityBucket(totalCapacity: number): keyof typeof CAPACITY_BUCKETS {
  if (totalCapacity < 200) return 'small';
  if (totalCapacity < 500) return 'medium';
  return 'large';
}

// Helper function to generate segment key for org preferences
export function generateSegmentKey(coastalType?: CoastalType, totalCapacity?: number): string {
  const coastalPart = coastalType || 'any';
  const capacityBucket = totalCapacity ? getCapacityBucket(totalCapacity) : 'any';
  return `${coastalPart}|cap:${capacityBucket}`;
}
