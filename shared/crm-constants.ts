/**
 * CRM Constants — Shared across frontend and backend
 * 
 * Provides:
 *   • Asset-class-aware field definitions & pipeline templates
 *   • Contact position/role taxonomy
 *   • Activity types with rich metadata
 *   • Deal scoring, stage gates, and rot thresholds
 *   • Phone/currency formatting utilities
 *
 * Modeled after Pipedrive (rotting, win-probability per stage),
 * Salesforce (phase gates, record types), HubSpot (lifecycle stages,
 * activity goals), NetSuite (transaction types), and RealNex (CRE fields).
 */

// ─── Asset Classes ───────────────────────────────────────────────────

export const ASSET_CLASSES = [
  { value: 'marina',       label: 'Marina',           icon: 'Anchor',    color: '#0ea5e9' },
  { value: 'multifamily',  label: 'Multifamily',      icon: 'Building2', color: '#8b5cf6' },
  { value: 'retail',       label: 'Retail',            icon: 'Store',     color: '#f59e0b' },
  { value: 'office',       label: 'Office',            icon: 'Briefcase', color: '#6366f1' },
  { value: 'industrial',   label: 'Industrial',        icon: 'Factory',   color: '#64748b' },
  { value: 'hotel',        label: 'Hospitality',       icon: 'Hotel',     color: '#ec4899' },
  { value: 'mixed_use',    label: 'Mixed-Use',         icon: 'Layers',    color: '#14b8a6' },
  { value: 'land',         label: 'Land / Dev Site',   icon: 'Mountain',  color: '#84cc16' },
  { value: 'self_storage', label: 'Self Storage',      icon: 'Warehouse', color: '#f97316' },
  { value: 'mobile_home',  label: 'Mobile Home Park',  icon: 'Home',      color: '#a855f7' },
  { value: 'other',        label: 'Other',             icon: 'Boxes',     color: '#94a3b8' },
] as const;

export type AssetClassValue = typeof ASSET_CLASSES[number]['value'];

export function getAssetClass(value: string | null | undefined) {
  return ASSET_CLASSES.find(ac => ac.value === value) ?? ASSET_CLASSES[ASSET_CLASSES.length - 1];
}

// ─── Default Pipeline Templates per Asset Class ──────────────────────

export interface PipelineStageTemplate {
  name: string;
  color: string;
  probability: number;       // Pipedrive-style win-prob at this stage
  rotDays: number;           // days before deal "rots" if stale (Pipedrive)
  requiredFields?: string[]; // gate fields that must be non-empty to advance (Salesforce)
}

/** Default stage templates — users can customise in Pipeline Settings */
const SHARED_STAGES: PipelineStageTemplate[] = [
  { name: 'Lead',          color: '#6366f1', probability: 10, rotDays: 14 },
  { name: 'Qualified',     color: '#8b5cf6', probability: 25, rotDays: 14 },
  { name: 'Proposal',      color: '#3b82f6', probability: 50, rotDays: 21 },
  { name: 'Negotiation',   color: '#f59e0b', probability: 70, rotDays: 30 },
  { name: 'Due Diligence', color: '#14b8a6', probability: 85, rotDays: 45, requiredFields: ['amount', 'expectedCloseDate'] },
  { name: 'Closed Won',    color: '#10b981', probability: 100, rotDays: 999 },
  { name: 'Closed Lost',   color: '#ef4444', probability: 0,   rotDays: 999 },
];

export const PIPELINE_STAGE_TEMPLATES: Record<AssetClassValue, PipelineStageTemplate[]> = {
  marina: [
    { name: 'Prospect',       color: '#6366f1', probability: 5,  rotDays: 14 },
    { name: 'Intro / NDA',    color: '#8b5cf6', probability: 15, rotDays: 14 },
    { name: 'Site Visit',     color: '#0ea5e9', probability: 30, rotDays: 21, requiredFields: ['contactId'] },
    { name: 'LOI Submitted',  color: '#3b82f6', probability: 50, rotDays: 21, requiredFields: ['amount'] },
    { name: 'LOI Accepted',   color: '#f59e0b', probability: 65, rotDays: 30 },
    { name: 'Due Diligence',  color: '#14b8a6', probability: 80, rotDays: 60, requiredFields: ['amount', 'expectedCloseDate'] },
    { name: 'Financing',      color: '#84cc16', probability: 90, rotDays: 45 },
    { name: 'Closing',        color: '#22c55e', probability: 95, rotDays: 30 },
    { name: 'Closed Won',     color: '#10b981', probability: 100, rotDays: 999 },
    { name: 'Closed Lost',    color: '#ef4444', probability: 0,  rotDays: 999 },
  ],
  multifamily:  SHARED_STAGES,
  retail:       SHARED_STAGES,
  office:       SHARED_STAGES,
  industrial:   SHARED_STAGES,
  hotel:        SHARED_STAGES,
  mixed_use:    SHARED_STAGES,
  land:         SHARED_STAGES,
  self_storage: SHARED_STAGES,
  mobile_home:  SHARED_STAGES,
  other:        SHARED_STAGES,
};

// ─── Asset-Class-Specific Property Fields ────────────────────────────

export interface DynamicFieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'currency' | 'percent' | 'select' | 'date' | 'boolean' | 'textarea';
  options?: { value: string; label: string }[];
  group: string;           // field grouping header
  placeholder?: string;
  tooltip?: string;
}

const MARINA_FIELDS: DynamicFieldDef[] = [
  { key: 'totalSlips',        label: 'Total Slips',        type: 'number',   group: 'Property Details', tooltip: 'Total wet slips' },
  { key: 'occupancyRate',     label: 'Occupancy Rate',     type: 'percent',  group: 'Property Details' },
  { key: 'avgSlipRate',       label: 'Avg Slip Rate',      type: 'currency', group: 'Revenue', tooltip: 'Monthly per-slip average' },
  { key: 'fuelRevenue',       label: 'Fuel Revenue',       type: 'currency', group: 'Revenue' },
  { key: 'dryStorage',        label: 'Dry Storage Spaces',  type: 'number',   group: 'Property Details' },
  { key: 'boatRamp',          label: 'Boat Ramp',          type: 'boolean',  group: 'Amenities' },
  { key: 'shipStore',         label: 'Ship Store',         type: 'boolean',  group: 'Amenities' },
  { key: 'restaurant',        label: 'Restaurant / Bar',   type: 'boolean',  group: 'Amenities' },
  { key: 'travelLift',        label: 'Travel Lift',        type: 'boolean',  group: 'Amenities' },
  { key: 'maxLOA',            label: 'Max LOA (ft)',       type: 'number',   group: 'Property Details', tooltip: 'Largest vessel accommodated' },
  { key: 'waterDepth',        label: 'Water Depth (ft)',   type: 'number',   group: 'Property Details' },
  { key: 'seawallCondition',  label: 'Seawall Condition',  type: 'select',   group: 'Physical', options: [
    { value: 'excellent', label: 'Excellent' }, { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' }, { value: 'poor', label: 'Poor' },
  ]},
  { key: 'environmentalRisk', label: 'Environmental Risk', type: 'select',   group: 'Risk', options: [
    { value: 'none', label: 'None' }, { value: 'low', label: 'Low' },
    { value: 'moderate', label: 'Moderate' }, { value: 'high', label: 'High' },
  ]},
];

const MULTIFAMILY_FIELDS: DynamicFieldDef[] = [
  { key: 'totalUnits',     label: 'Total Units',       type: 'number',   group: 'Property Details' },
  { key: 'avgRent',        label: 'Avg Rent / Unit',   type: 'currency', group: 'Revenue' },
  { key: 'occupancyRate',  label: 'Occupancy',         type: 'percent',  group: 'Revenue' },
  { key: 'yearBuilt',      label: 'Year Built',        type: 'number',   group: 'Property Details' },
  { key: 'buildingClass',  label: 'Building Class',    type: 'select',   group: 'Property Details', options: [
    { value: 'A', label: 'Class A' }, { value: 'B', label: 'Class B' },
    { value: 'C', label: 'Class C' }, { value: 'D', label: 'Class D' },
  ]},
  { key: 'parkingRatio',   label: 'Parking Ratio',     type: 'text',     group: 'Amenities', placeholder: 'e.g. 1.5:1' },
  { key: 'laundryInUnit',  label: 'In-Unit Laundry',   type: 'boolean',  group: 'Amenities' },
  { key: 'pool',           label: 'Pool',              type: 'boolean',  group: 'Amenities' },
  { key: 'fitness',        label: 'Fitness Center',    type: 'boolean',  group: 'Amenities' },
  { key: 'valueAddPotential', label: 'Value-Add Potential', type: 'select', group: 'Investment', options: [
    { value: 'none', label: 'Stabilized' }, { value: 'light', label: 'Light Value-Add' },
    { value: 'heavy', label: 'Heavy Value-Add' }, { value: 'redev', label: 'Redevelopment' },
  ]},
];

const RETAIL_FIELDS: DynamicFieldDef[] = [
  { key: 'totalSqFt',      label: 'Total SF',          type: 'number',   group: 'Property Details' },
  { key: 'occupancyRate',   label: 'Occupancy',         type: 'percent',  group: 'Revenue' },
  { key: 'avgRentPSF',     label: 'Avg Rent / SF',     type: 'currency', group: 'Revenue' },
  { key: 'numTenants',     label: '# Tenants',         type: 'number',   group: 'Property Details' },
  { key: 'anchorTenant',   label: 'Anchor Tenant',     type: 'text',     group: 'Tenancy' },
  { key: 'walt',           label: 'WALT (yrs)',        type: 'number',   group: 'Tenancy', tooltip: 'Weighted avg lease term' },
  { key: 'nnn',            label: 'NNN Leases',        type: 'boolean',  group: 'Tenancy' },
  { key: 'yearBuilt',      label: 'Year Built',        type: 'number',   group: 'Property Details' },
  { key: 'parkingSpaces',  label: 'Parking Spaces',    type: 'number',   group: 'Property Details' },
  { key: 'trafficCount',   label: 'Daily Traffic Count', type: 'number', group: 'Location' },
];

const OFFICE_FIELDS: DynamicFieldDef[] = [
  { key: 'totalSqFt',      label: 'Total SF',          type: 'number',   group: 'Property Details' },
  { key: 'occupancyRate',   label: 'Occupancy',         type: 'percent',  group: 'Revenue' },
  { key: 'avgRentPSF',     label: 'Avg Rent / SF',     type: 'currency', group: 'Revenue' },
  { key: 'buildingClass',  label: 'Building Class',    type: 'select',   group: 'Property Details', options: [
    { value: 'A', label: 'Class A' }, { value: 'B', label: 'Class B' },
    { value: 'C', label: 'Class C' },
  ]},
  { key: 'numFloors',      label: 'Floors',            type: 'number',   group: 'Property Details' },
  { key: 'yearBuilt',      label: 'Year Built',        type: 'number',   group: 'Property Details' },
  { key: 'walt',           label: 'WALT (yrs)',        type: 'number',   group: 'Tenancy' },
  { key: 'parkingRatio',   label: 'Parking Ratio',     type: 'text',     group: 'Property Details', placeholder: 'e.g. 4:1000' },
];

const GENERIC_CRE_FIELDS: DynamicFieldDef[] = [
  { key: 'totalSqFt',      label: 'Total SF',          type: 'number',   group: 'Property Details' },
  { key: 'occupancyRate',   label: 'Occupancy',         type: 'percent',  group: 'Revenue' },
  { key: 'yearBuilt',      label: 'Year Built',        type: 'number',   group: 'Property Details' },
  { key: 'lotSize',        label: 'Lot Size (acres)',  type: 'number',   group: 'Property Details' },
  { key: 'zoning',         label: 'Zoning',            type: 'text',     group: 'Property Details' },
];

export const ASSET_CLASS_FIELDS: Record<AssetClassValue, DynamicFieldDef[]> = {
  marina:       MARINA_FIELDS,
  multifamily:  MULTIFAMILY_FIELDS,
  retail:       RETAIL_FIELDS,
  office:       OFFICE_FIELDS,
  industrial:   GENERIC_CRE_FIELDS,
  hotel:        GENERIC_CRE_FIELDS,
  mixed_use:    GENERIC_CRE_FIELDS,
  land:         [
    { key: 'acreage', label: 'Acreage', type: 'number', group: 'Land Details' },
    { key: 'zoning',  label: 'Zoning',  type: 'text',   group: 'Land Details' },
    { key: 'entitlements', label: 'Entitlements', type: 'select', group: 'Land Details', options: [
      { value: 'none', label: 'None' }, { value: 'partial', label: 'Partial' }, { value: 'full', label: 'Fully Entitled' },
    ]},
    { key: 'topography', label: 'Topography', type: 'text', group: 'Land Details' },
  ],
  self_storage: GENERIC_CRE_FIELDS,
  mobile_home:  GENERIC_CRE_FIELDS,
  other:        GENERIC_CRE_FIELDS,
};

export function getFieldsForAssetClass(assetClass: string | null | undefined): DynamicFieldDef[] {
  const ac = (assetClass || 'other') as AssetClassValue;
  return ASSET_CLASS_FIELDS[ac] ?? ASSET_CLASS_FIELDS.other;
}

// ─── Deal Financial Fields (universal) ───────────────────────────────

export const DEAL_FINANCIAL_FIELDS: DynamicFieldDef[] = [
  { key: 'askingPrice',       label: 'Asking Price',       type: 'currency', group: 'Pricing' },
  { key: 'offerPrice',        label: 'Offer Price',        type: 'currency', group: 'Pricing' },
  { key: 'capRate',           label: 'Cap Rate',           type: 'percent',  group: 'Returns' },
  { key: 'cashOnCash',        label: 'Cash-on-Cash',       type: 'percent',  group: 'Returns' },
  { key: 'irr',               label: 'Projected IRR',      type: 'percent',  group: 'Returns' },
  { key: 'noi',               label: 'NOI',                type: 'currency', group: 'Income' },
  { key: 'grossRevenue',      label: 'Gross Revenue',      type: 'currency', group: 'Income' },
  { key: 'dscr',              label: 'DSCR',               type: 'number',   group: 'Financing', tooltip: 'Debt Service Coverage Ratio' },
  { key: 'ltv',               label: 'LTV',                type: 'percent',  group: 'Financing' },
  { key: 'loanAmount',        label: 'Loan Amount',        type: 'currency', group: 'Financing' },
  { key: 'equityRequired',    label: 'Equity Required',    type: 'currency', group: 'Financing' },
  { key: 'commissionPct',     label: 'Commission %',       type: 'percent',  group: 'Commission' },
  { key: 'commissionAmount',  label: 'Commission $',       type: 'currency', group: 'Commission' },
];

// ─── Contact Positions ───────────────────────────────────────────────

export const CONTACT_POSITION_OPTIONS = [
  { value: 'owner',            label: 'Owner' },
  { value: 'operator',         label: 'Operator' },
  { value: 'broker',           label: 'Broker' },
  { value: 'investor',         label: 'Investor' },
  { value: 'lender',           label: 'Lender' },
  { value: 'attorney',         label: 'Attorney' },
  { value: 'accountant',       label: 'Accountant' },
  { value: 'manager',          label: 'Manager' },
  { value: 'asset_manager',    label: 'Asset Manager' },
  { value: 'property_manager', label: 'Property Manager' },
  { value: 'analyst',          label: 'Analyst' },
  { value: 'developer',        label: 'Developer' },
  { value: 'insurance_broker', label: 'Insurance Broker' },
  { value: 'general_partner',  label: 'General Partner' },
  { value: 'limited_partner',  label: 'Limited Partner' },
  { value: 'ceo',              label: 'CEO' },
  { value: 'cfo',              label: 'CFO' },
  { value: 'coo',              label: 'COO' },
  { value: 'general_manager',  label: 'General Manager' },
  { value: 'marina_manager',   label: 'Marina Manager' },
  { value: 'dockmaster',       label: 'Dockmaster' },
  { value: 'operations',       label: 'Operations' },
  { value: 'sales',            label: 'Sales' },
  { value: 'marketing',        label: 'Marketing' },
  { value: 'consultant',       label: 'Consultant' },
  { value: 'appraiser',        label: 'Appraiser' },
  { value: 'title_company',    label: 'Title Company' },
  { value: 'environmental',    label: 'Environmental Consultant' },
  { value: 'surveyor',         label: 'Surveyor' },
  { value: 'architect',        label: 'Architect' },
  { value: 'contractor',       label: 'General Contractor' },
  { value: 'other',            label: 'Other' },
] as const;

export type ContactPositionValue = typeof CONTACT_POSITION_OPTIONS[number]['value'];

export function normalizePosition(position: string | null | undefined): string | undefined {
  if (!position) return undefined;
  const normalized = position.toLowerCase().trim().replace(/\s+/g, '_');
  const found = CONTACT_POSITION_OPTIONS.find(opt => opt.value === normalized);
  if (found) return found.value;
  return position.split(/[\s_]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function getPositionLabel(value: string | null | undefined): string {
  if (!value) return '';
  const found = CONTACT_POSITION_OPTIONS.find(opt => opt.value === value);
  if (found) return found.label;
  return value.split(/[\s_]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// ─── Activity Types (expanded) ───────────────────────────────────────

export const ACTIVITY_TYPES = [
  { value: 'email',        label: 'Email',             icon: 'Mail',        color: '#8b5cf6', category: 'communication' },
  { value: 'call',         label: 'Call',              icon: 'Phone',       color: '#3b82f6', category: 'communication' },
  { value: 'meeting',      label: 'Meeting',           icon: 'Calendar',    color: '#10b981', category: 'meeting' },
  { value: 'site_visit',   label: 'Site Visit',        icon: 'MapPin',      color: '#f59e0b', category: 'meeting' },
  { value: 'note',         label: 'Note',              icon: 'StickyNote',  color: '#64748b', category: 'documentation' },
  { value: 'task',         label: 'Task',              icon: 'CheckSquare', color: '#0ea5e9', category: 'task' },
  { value: 'follow_up',    label: 'Follow Up',         icon: 'ArrowRight',  color: '#f97316', category: 'task' },
  { value: 'reminder',     label: 'Reminder',          icon: 'Bell',        color: '#ec4899', category: 'task' },
  { value: 'loi_sent',     label: 'LOI Sent',          icon: 'FileText',    color: '#6366f1', category: 'milestone' },
  { value: 'loi_received', label: 'LOI Received',      icon: 'FileCheck',   color: '#14b8a6', category: 'milestone' },
  { value: 'offer',        label: 'Offer Made',        icon: 'DollarSign',  color: '#22c55e', category: 'milestone' },
  { value: 'contract',     label: 'Contract Executed',  icon: 'FileSignature', color: '#84cc16', category: 'milestone' },
  { value: 'closing',      label: 'Closing',           icon: 'Award',       color: '#10b981', category: 'milestone' },
  { value: 'linkedin',     label: 'LinkedIn',          icon: 'Linkedin',    color: '#0077b5', category: 'communication' },
  { value: 'text',         label: 'Text / SMS',        icon: 'MessageSquare', color: '#06b6d4', category: 'communication' },
] as const;

export type ActivityTypeValue = typeof ACTIVITY_TYPES[number]['value'];

export const ACTIVITY_CATEGORIES = [
  { value: 'communication', label: 'Communication' },
  { value: 'meeting',       label: 'Meetings' },
  { value: 'task',          label: 'Tasks' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'milestone',     label: 'Milestones' },
] as const;

// ─── Deal Priority ───────────────────────────────────────────────────

export const DEAL_PRIORITIES = [
  { value: 'critical', label: 'Critical', color: '#ef4444', bgColor: 'bg-red-500' },
  { value: 'high',     label: 'High',     color: '#f97316', bgColor: 'bg-orange-500' },
  { value: 'medium',   label: 'Medium',   color: '#f59e0b', bgColor: 'bg-yellow-500' },
  { value: 'low',      label: 'Low',      color: '#10b981', bgColor: 'bg-green-500' },
] as const;

// ─── Lead Sources ────────────────────────────────────────────────────

export const LEAD_SOURCES = [
  { value: 'cold_call',     label: 'Cold Call' },
  { value: 'referral',      label: 'Referral' },
  { value: 'website',       label: 'Website / Inbound' },
  { value: 'broker_listing', label: 'Broker Listing' },
  { value: 'direct_mail',   label: 'Direct Mail' },
  { value: 'conference',    label: 'Conference / Event' },
  { value: 'linkedin',      label: 'LinkedIn' },
  { value: 'costar',        label: 'CoStar / LoopNet' },
  { value: 'crexi',         label: 'Crexi' },
  { value: 'off_market',    label: 'Off-Market' },
  { value: 'mls',           label: 'MLS' },
  { value: 'auction',       label: 'Auction' },
  { value: 'driving',       label: 'Driving for Deals' },
  { value: 'other',         label: 'Other' },
] as const;

// ─── Deal Scoring (HubSpot-inspired) ────────────────────────────────

export interface DealScoreFactors {
  hasContact: boolean;
  hasCompany: boolean;
  hasAmount: boolean;
  hasCloseDate: boolean;
  activitiesLast30Days: number;
  daysInCurrentStage: number;
  stageProbability: number;
}

export function calculateDealScore(factors: DealScoreFactors): number {
  let score = 0;

  // Data completeness (max 30 pts)
  if (factors.hasContact)   score += 8;
  if (factors.hasCompany)   score += 7;
  if (factors.hasAmount)    score += 10;
  if (factors.hasCloseDate) score += 5;

  // Engagement recency (max 30 pts)
  const activityScore = Math.min(factors.activitiesLast30Days * 6, 30);
  score += activityScore;

  // Stage probability (max 25 pts)
  score += Math.round(factors.stageProbability * 0.25);

  // Freshness penalty (deduct up to 15 pts for stale deals)
  if (factors.daysInCurrentStage > 60) score -= 15;
  else if (factors.daysInCurrentStage > 30) score -= 10;
  else if (factors.daysInCurrentStage > 14) score -= 5;

  return Math.max(0, Math.min(100, score));
}

export function getDealScoreGrade(score: number): { grade: string; color: string; label: string } {
  if (score >= 80) return { grade: 'A', color: '#10b981', label: 'Hot' };
  if (score >= 60) return { grade: 'B', color: '#3b82f6', label: 'Warm' };
  if (score >= 40) return { grade: 'C', color: '#f59e0b', label: 'Tepid' };
  if (score >= 20) return { grade: 'D', color: '#f97316', label: 'Cool' };
  return { grade: 'F', color: '#ef4444', label: 'Cold' };
}

// ─── DD Project Relationship Types ───────────────────────────────────

export const DD_PROJECT_RELATIONSHIP_TYPES = [
  { value: 'team_member',           label: 'Team Member' },
  { value: 'deal_team',             label: 'Deal Team' },
  { value: 'consultant',            label: 'Consultant' },
  { value: 'stakeholder',           label: 'Stakeholder' },
  { value: 'subject_matter_expert', label: 'Subject Matter Expert' },
  { value: 'legal_counsel',         label: 'Legal Counsel' },
  { value: 'lender_contact',        label: 'Lender Contact' },
  { value: 'broker_contact',        label: 'Broker Contact' },
  { value: 'seller_contact',        label: 'Seller Contact' },
  { value: 'other',                 label: 'Other' },
] as const;

// ─── Saved View Presets ──────────────────────────────────────────────

export const SAVED_VIEW_PRESETS = [
  { id: 'all_deals',     label: 'All Deals',           icon: 'Layers',      filters: {} },
  { id: 'my_deals',      label: 'My Deals',            icon: 'User',        filters: { ownerIsMe: true } },
  { id: 'hot_deals',     label: 'Hot Deals',           icon: 'Flame',       filters: { priority: ['critical', 'high'] } },
  { id: 'closing_soon',  label: 'Closing This Month',  icon: 'Calendar',    filters: { closingThisMonth: true } },
  { id: 'stale_deals',   label: 'Stale / Rotting',     icon: 'AlertTriangle', filters: { isRotting: true } },
  { id: 'won_deals',     label: 'Closed Won',          icon: 'Trophy',      filters: { stage: 'closed_won' } },
  { id: 'lost_deals',    label: 'Closed Lost',         icon: 'XCircle',     filters: { stage: 'closed_lost' } },
] as const;

// ─── Phone & Currency Utilities ──────────────────────────────────────

export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
  }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

export function parsePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

export function isValidPhoneNumber(phone: string | null | undefined): boolean {
  if (!phone) return true;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 11;
}

// ─── Date / Stage Utilities ──────────────────────────────────────────

export function calculateDaysInStage(enteredAt: Date | string | null | undefined): number {
  if (!enteredAt) return 0;
  const enteredDate = new Date(enteredAt);
  const now = new Date();
  return Math.floor(Math.abs(now.getTime() - enteredDate.getTime()) / (1000 * 60 * 60 * 24));
}

export function isDealRotting(daysInStage: number, rotThreshold: number): boolean {
  return daysInStage >= rotThreshold;
}

export function getDealAge(createdAt: Date | string | null | undefined): number {
  if (!createdAt) return 0;
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Formatting Helpers ──────────────────────────────────────────────

export function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value == null) return '—';
  return `${value.toFixed(decimals)}%`;
}
