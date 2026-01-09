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

// Water types
export const WATER_TYPES = ['Coastal', 'Lake', 'River'] as const;
export type WaterType = typeof WATER_TYPES[number];

// Legacy coastal types (deprecated - keeping for backward compatibility)
export const COASTAL_TYPES = WATER_TYPES;
export type CoastalType = WaterType;

// Storage types for marinas
export const STORAGE_TYPES = [
  'Wet Slips',
  'Lift Slips',
  'Moorings',
  'Dinghies/Small Boats',
  'Jet Skis',
  'Dry Racks - Indoor',
  'Dry Racks - Outdoor',
  'Land Storage',
  'Trailered Boats',
  'Trailers',
  'Carports',
  'Houseboats',
  'RV Sites',
  'Cabins',
  'Sales',
  'Service',
  'Commercial',
  'Rental Boats',
  'Boat Club'
] as const;
export type StorageType = typeof STORAGE_TYPES[number];

// US States
export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' }
] as const;

// International Countries/Territories
export const COUNTRIES = [
  'Australia',
  'Bahamas',
  'Bermuda',
  'British Virgin Islands',
  'Canada',
  'Cayman Islands',
  'Costa Rica',
  'Croatia',
  'France',
  'Greece',
  'Italy',
  'Mexico',
  'Monaco',
  'Netherlands',
  'Puerto Rico',
  'Spain',
  'United Kingdom',
  'Virgin Islands'
] as const;

// Combined states and countries for filter display
export const STATES_AND_COUNTRIES = [
  ...US_STATES.map(s => s.code),
  ...COUNTRIES
] as const;

// US Regions for geographic classification
export const US_REGIONS = [
  'Northeast',
  'Mid-Atlantic',
  'Southeast',
  'South',
  'Mid-West',
  'Southwest',
  'West',
  'Pacific Northwest',
] as const;
export type USRegion = typeof US_REGIONS[number];

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
export function generateSegmentKey(waterType?: WaterType, totalCapacity?: number): string {
  const waterPart = waterType || 'any';
  const capacityBucket = totalCapacity ? getCapacityBucket(totalCapacity) : 'any';
  return `${waterPart}|cap:${capacityBucket}`;
}
