import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  FileText,
  Search,
  Plus,
  Eye,
  Star,
  Layers,
  BookOpen,
  BarChart3,
  Building2,
  Anchor,
  Hotel,
  Warehouse,
  Home,
  Briefcase,
  FileSpreadsheet,
  Presentation,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DocumentType =
  | 'offering_memorandum'
  | 'executive_summary'
  | 'pitch_deck'
  | 'ic_memo'
  | 'teaser'
  | 'lender_package'
  | 'due_diligence_summary'
  | 'custom';

type AssetClassFilter =
  | 'all'
  | 'marina'
  | 'multifamily'
  | 'self_storage'
  | 'hotel'
  | 'str'
  | 'rv_park'
  | 'commercial'
  | 'residential'
  | 'business';

type AudienceFilter =
  | 'all'
  | 'institutional_investor'
  | 'private_equity'
  | 'family_office'
  | 'lender'
  | 'broker';

type SortOption = 'popular' | 'newest' | 'name_az';

interface TemplateData {
  id: string;
  name: string;
  type: DocumentType;
  assetClasses: AssetClassFilter[];
  audience: AudienceFilter[];
  sections: { key: string; name: string; description: string }[];
  description: string;
  estimatedPages: number;
  popularity: number;
  featured?: boolean;
  exportFormats: string[];
  dataRequirements: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOC_TYPE_OPTIONS: { value: DocumentType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'offering_memorandum', label: 'Offering Memorandum' },
  { value: 'executive_summary', label: 'Executive Summary' },
  { value: 'pitch_deck', label: 'Pitch Deck' },
  { value: 'ic_memo', label: 'IC Memo' },
  { value: 'teaser', label: 'Teaser' },
  { value: 'lender_package', label: 'Lender Package' },
  { value: 'due_diligence_summary', label: 'DD Summary' },
];

const ASSET_CLASS_OPTIONS: { value: AssetClassFilter; label: string }[] = [
  { value: 'all', label: 'All Assets' },
  { value: 'marina', label: 'Marina' },
  { value: 'multifamily', label: 'Multifamily' },
  { value: 'self_storage', label: 'Self-Storage' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'str', label: 'STR' },
  { value: 'rv_park', label: 'RV Park' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'residential', label: 'Residential' },
  { value: 'business', label: 'Business' },
];

const AUDIENCE_OPTIONS: { value: AudienceFilter; label: string }[] = [
  { value: 'all', label: 'All Audiences' },
  { value: 'institutional_investor', label: 'Institutional Investor' },
  { value: 'private_equity', label: 'Private Equity' },
  { value: 'family_office', label: 'Family Office' },
  { value: 'lender', label: 'Lender' },
  { value: 'broker', label: 'Broker' },
];

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  offering_memorandum: 'Offering Memorandum',
  executive_summary: 'Executive Summary',
  pitch_deck: 'Pitch Deck',
  ic_memo: 'IC Memo',
  teaser: 'Teaser',
  lender_package: 'Lender Package',
  due_diligence_summary: 'DD Summary',
  custom: 'Custom',
};

const DOC_TYPE_COLORS: Record<DocumentType, string> = {
  offering_memorandum: 'bg-blue-100 text-blue-800',
  executive_summary: 'bg-emerald-100 text-emerald-800',
  pitch_deck: 'bg-purple-100 text-purple-800',
  ic_memo: 'bg-amber-100 text-amber-800',
  teaser: 'bg-pink-100 text-pink-800',
  lender_package: 'bg-indigo-100 text-indigo-800',
  due_diligence_summary: 'bg-orange-100 text-orange-800',
  custom: 'bg-gray-100 text-gray-800',
};

const DOC_TYPE_GRADIENTS: Record<DocumentType, string> = {
  offering_memorandum: 'from-blue-500 to-blue-700',
  executive_summary: 'from-emerald-500 to-emerald-700',
  pitch_deck: 'from-purple-500 to-purple-700',
  ic_memo: 'from-amber-500 to-amber-700',
  teaser: 'from-pink-500 to-pink-700',
  lender_package: 'from-indigo-500 to-indigo-700',
  due_diligence_summary: 'from-orange-500 to-orange-700',
  custom: 'from-gray-500 to-gray-700',
};

const DOC_TYPE_ICONS: Record<DocumentType, typeof FileText> = {
  offering_memorandum: BookOpen,
  executive_summary: FileText,
  pitch_deck: Presentation,
  ic_memo: FileSpreadsheet,
  teaser: Sparkles,
  lender_package: Building2,
  due_diligence_summary: CheckCircle2,
  custom: FileText,
};

const ASSET_ICONS: Record<string, typeof FileText> = {
  marina: Anchor,
  hotel: Hotel,
  self_storage: Warehouse,
  multifamily: Building2,
  commercial: Building2,
  residential: Home,
  str: Home,
  rv_park: Home,
  business: Briefcase,
};

// ---------------------------------------------------------------------------
// Default template data
// ---------------------------------------------------------------------------

const DEFAULT_TEMPLATES: TemplateData[] = [
  // Marina templates
  {
    id: 'marina-acquisition-om',
    name: 'Marina Acquisition OM',
    type: 'offering_memorandum',
    assetClasses: ['marina'],
    audience: ['institutional_investor', 'private_equity', 'family_office'],
    description: 'Comprehensive offering memorandum for marina acquisitions with slip inventory analysis, waterfront valuation, and environmental considerations.',
    estimatedPages: 34,
    popularity: 98,
    featured: true,
    exportFormats: ['pdf', 'docx'],
    dataRequirements: ['Property details', 'Financial statements', 'Slip inventory', 'Rate schedule', 'Environmental reports'],
    sections: [
      { key: 'cover', name: 'Cover Page', description: 'Professional branded cover with property photo' },
      { key: 'toc', name: 'Table of Contents', description: 'Auto-generated section listing' },
      { key: 'exec_summary', name: 'Executive Summary', description: 'Investment highlights and key metrics' },
      { key: 'property_overview', name: 'Property Overview', description: 'Facility details, slip count, amenities' },
      { key: 'slip_inventory', name: 'Slip Inventory Analysis', description: 'Detailed slip mix, occupancy, and rate analysis' },
      { key: 'location', name: 'Location & Market', description: 'Waterway access, demographics, competition' },
      { key: 'financials', name: 'Financial Analysis', description: 'Revenue breakdown, expenses, NOI projections' },
      { key: 'proforma', name: 'Pro Forma Projections', description: '5-year financial projections' },
      { key: 'operations', name: 'Operations Overview', description: 'Staff, maintenance, seasonal patterns' },
      { key: 'environmental', name: 'Environmental Summary', description: 'Compliance, permits, wetland considerations' },
      { key: 'comps', name: 'Comparable Sales', description: 'Recent marina transactions' },
      { key: 'photos', name: 'Property Photos', description: 'Aerial and ground-level photography' },
      { key: 'appendix', name: 'Appendices', description: 'Supporting documents and disclosures' },
    ],
  },
  {
    id: 'marina-teaser',
    name: 'Marina Investment Teaser',
    type: 'teaser',
    assetClasses: ['marina'],
    audience: ['institutional_investor', 'private_equity', 'broker'],
    description: 'Concise 2-page marketing flyer highlighting marina investment opportunity with key metrics and photos.',
    estimatedPages: 2,
    popularity: 85,
    exportFormats: ['pdf'],
    dataRequirements: ['Property details', 'Key financial metrics', 'Property photos'],
    sections: [
      { key: 'hero', name: 'Hero Section', description: 'Property photo with headline metrics' },
      { key: 'highlights', name: 'Investment Highlights', description: 'Bullet-point key selling points' },
      { key: 'metrics', name: 'Financial Snapshot', description: 'NOI, cap rate, price per slip' },
      { key: 'contact', name: 'Contact Information', description: 'Broker contact details' },
    ],
  },
  {
    id: 'marina-lender-package',
    name: 'Marina Lender Package',
    type: 'lender_package',
    assetClasses: ['marina'],
    audience: ['lender'],
    description: 'Debt financing package tailored for marina properties with DSCR analysis and collateral detail.',
    estimatedPages: 22,
    popularity: 72,
    exportFormats: ['pdf', 'docx'],
    dataRequirements: ['Financial statements', 'Appraisal data', 'Environmental reports', 'Insurance docs'],
    sections: [
      { key: 'cover', name: 'Cover Page', description: 'Loan request summary' },
      { key: 'loan_request', name: 'Loan Request Summary', description: 'Amount, terms, use of proceeds' },
      { key: 'borrower_profile', name: 'Borrower Profile', description: 'Sponsor experience and net worth' },
      { key: 'property_overview', name: 'Property Overview', description: 'Marina facility details' },
      { key: 'financials', name: 'Financial Analysis', description: 'Historical and projected cash flows' },
      { key: 'dscr', name: 'DSCR Analysis', description: 'Debt service coverage scenarios' },
      { key: 'collateral', name: 'Collateral Summary', description: 'Appraisal and environmental' },
      { key: 'appendix', name: 'Appendices', description: 'Tax returns, rent roll, insurance' },
    ],
  },
  // Multifamily templates
  {
    id: 'multifamily-om',
    name: 'Multifamily Offering Memorandum',
    type: 'offering_memorandum',
    assetClasses: ['multifamily'],
    audience: ['institutional_investor', 'private_equity', 'family_office'],
    description: 'Full offering memorandum for apartment and multifamily acquisitions with rent roll analysis and value-add projections.',
    estimatedPages: 30,
    popularity: 95,
    featured: true,
    exportFormats: ['pdf', 'docx'],
    dataRequirements: ['Property details', 'Rent roll', 'Financial statements', 'Unit mix', 'Market comps'],
    sections: [
      { key: 'cover', name: 'Cover Page', description: 'Branded cover with hero image' },
      { key: 'exec_summary', name: 'Executive Summary', description: 'Investment thesis and key metrics' },
      { key: 'property_overview', name: 'Property Overview', description: 'Unit mix, amenities, condition' },
      { key: 'unit_mix', name: 'Unit Mix Analysis', description: 'Detailed unit types and rents' },
      { key: 'rent_roll', name: 'Rent Roll', description: 'Current tenancy and lease terms' },
      { key: 'location', name: 'Location Analysis', description: 'Submarket, demographics, transit' },
      { key: 'financials', name: 'Financial Summary', description: 'T-12, NOI, expense analysis' },
      { key: 'value_add', name: 'Value-Add Strategy', description: 'Renovation plan and rent premium projections' },
      { key: 'proforma', name: 'Pro Forma', description: '5-year hold period projections' },
      { key: 'comps', name: 'Comparable Sales & Rentals', description: 'Market transaction and rent comps' },
      { key: 'photos', name: 'Photo Gallery', description: 'Interior and exterior photography' },
    ],
  },
  {
    id: 'multifamily-exec-summary',
    name: 'Multifamily Executive Summary',
    type: 'executive_summary',
    assetClasses: ['multifamily'],
    audience: ['institutional_investor', 'private_equity'],
    description: 'Concise executive summary for multifamily investment opportunities with key financials and highlights.',
    estimatedPages: 6,
    popularity: 82,
    exportFormats: ['pdf'],
    dataRequirements: ['Property details', 'Key financial metrics', 'Unit mix summary'],
    sections: [
      { key: 'overview', name: 'Investment Overview', description: 'Deal summary and thesis' },
      { key: 'metrics', name: 'Key Metrics', description: 'NOI, cap rate, price per unit' },
      { key: 'strategy', name: 'Investment Strategy', description: 'Hold plan and exit strategy' },
      { key: 'financials', name: 'Financial Highlights', description: 'Summarized financial performance' },
    ],
  },
  {
    id: 'apartment-ic-memo',
    name: 'Apartment Investment Memo',
    type: 'ic_memo',
    assetClasses: ['multifamily'],
    audience: ['institutional_investor', 'private_equity'],
    description: 'Investment committee memo for apartment acquisitions with risk analysis and recommendation.',
    estimatedPages: 12,
    popularity: 75,
    exportFormats: ['pdf', 'docx'],
    dataRequirements: ['Property details', 'Financial model', 'Market data', 'Risk assessment'],
    sections: [
      { key: 'recommendation', name: 'Recommendation', description: 'IC vote recommendation' },
      { key: 'deal_summary', name: 'Deal Summary', description: 'Transaction terms and structure' },
      { key: 'market', name: 'Market Analysis', description: 'Submarket fundamentals' },
      { key: 'financials', name: 'Financial Analysis', description: 'Underwriting and returns' },
      { key: 'risks', name: 'Risk Factors', description: 'Key risks and mitigants' },
      { key: 'sensitivity', name: 'Sensitivity Analysis', description: 'Scenario modeling results' },
    ],
  },
  // Self-Storage templates
  {
    id: 'self-storage-om',
    name: 'Self-Storage Acquisition OM',
    type: 'offering_memorandum',
    assetClasses: ['self_storage'],
    audience: ['institutional_investor', 'private_equity', 'family_office'],
    description: 'Complete offering memorandum for self-storage facilities with unit mix analysis and revenue management detail.',
    estimatedPages: 26,
    popularity: 88,
    featured: true,
    exportFormats: ['pdf', 'docx'],
    dataRequirements: ['Property details', 'Unit inventory', 'Rate schedule', 'Financial statements', 'Market data'],
    sections: [
      { key: 'cover', name: 'Cover Page', description: 'Branded cover' },
      { key: 'exec_summary', name: 'Executive Summary', description: 'Investment highlights' },
      { key: 'property_overview', name: 'Property Overview', description: 'Facility layout and features' },
      { key: 'unit_mix', name: 'Unit Mix & Rates', description: 'Size tiers, climate control, rates' },
      { key: 'occupancy', name: 'Occupancy Analysis', description: 'Historical and current occupancy' },
      { key: 'location', name: 'Location & Demographics', description: 'Trade area analysis' },
      { key: 'financials', name: 'Financial Performance', description: 'Revenue, expenses, NOI' },
      { key: 'proforma', name: 'Pro Forma', description: 'Growth projections' },
      { key: 'comps', name: 'Market Comparables', description: 'Competing facilities and rates' },
      { key: 'photos', name: 'Property Photos', description: 'Facility imagery' },
    ],
  },
  {
    id: 'self-storage-summary',
    name: 'Self-Storage Investment Summary',
    type: 'executive_summary',
    assetClasses: ['self_storage'],
    audience: ['institutional_investor', 'family_office'],
    description: 'Quick investment summary for self-storage opportunities with key operating metrics.',
    estimatedPages: 4,
    popularity: 68,
    exportFormats: ['pdf'],
    dataRequirements: ['Property details', 'Key metrics'],
    sections: [
      { key: 'overview', name: 'Property Overview', description: 'Facility snapshot' },
      { key: 'metrics', name: 'Key Metrics', description: 'Occupancy, rate, NOI' },
      { key: 'highlights', name: 'Investment Highlights', description: 'Why invest' },
    ],
  },
  // Hotel templates
  {
    id: 'hotel-investment-memo',
    name: 'Hotel Investment Memorandum',
    type: 'offering_memorandum',
    assetClasses: ['hotel'],
    audience: ['institutional_investor', 'private_equity'],
    description: 'Full investment memorandum for hotel and hospitality acquisitions with RevPAR analysis and brand considerations.',
    estimatedPages: 28,
    popularity: 80,
    exportFormats: ['pdf', 'docx'],
    dataRequirements: ['Property details', 'STR data', 'Financial statements', 'Franchise agreement', 'PIP details'],
    sections: [
      { key: 'cover', name: 'Cover Page', description: 'Hotel hero image cover' },
      { key: 'exec_summary', name: 'Executive Summary', description: 'Investment overview' },
      { key: 'property_overview', name: 'Property Overview', description: 'Room count, brand, amenities' },
      { key: 'performance', name: 'Operating Performance', description: 'RevPAR, ADR, occupancy trends' },
      { key: 'location', name: 'Market & Location', description: 'Demand generators, competition' },
      { key: 'financials', name: 'Financial Analysis', description: 'Revenue, GOP, NOI breakdown' },
      { key: 'brand', name: 'Brand & Franchise', description: 'Agreement terms and PIP requirements' },
      { key: 'proforma', name: 'Pro Forma', description: 'Projected performance' },
      { key: 'comps', name: 'Comparable Hotels', description: 'Comp set analysis' },
    ],
  },
  {
    id: 'hotel-valuation-report',
    name: 'Hotel Valuation Report',
    type: 'executive_summary',
    assetClasses: ['hotel'],
    audience: ['institutional_investor', 'lender'],
    description: 'Valuation-focused report for hotel assets including income approach, sales comparison, and cost approach.',
    estimatedPages: 18,
    popularity: 65,
    exportFormats: ['pdf', 'docx'],
    dataRequirements: ['Financial statements', 'Market data', 'Comparable sales'],
    sections: [
      { key: 'summary', name: 'Valuation Summary', description: 'Concluded value and methodology' },
      { key: 'income_approach', name: 'Income Approach', description: 'DCF and direct cap analysis' },
      { key: 'sales_comparison', name: 'Sales Comparison', description: 'Recent transaction comps' },
      { key: 'market', name: 'Market Conditions', description: 'Hospitality market overview' },
      { key: 'assumptions', name: 'Key Assumptions', description: 'Growth rates and discount rates' },
    ],
  },
  // STR templates
  {
    id: 'str-portfolio-summary',
    name: 'Vacation Rental Portfolio Summary',
    type: 'executive_summary',
    assetClasses: ['str'],
    audience: ['family_office', 'private_equity'],
    description: 'Portfolio-level summary for short-term rental properties with seasonal revenue analysis and market positioning.',
    estimatedPages: 8,
    popularity: 70,
    exportFormats: ['pdf'],
    dataRequirements: ['Property details', 'Booking data', 'Revenue history', 'Market rates'],
    sections: [
      { key: 'portfolio_overview', name: 'Portfolio Overview', description: 'Property count and locations' },
      { key: 'revenue', name: 'Revenue Performance', description: 'ADR, occupancy, RevPAR by property' },
      { key: 'seasonality', name: 'Seasonal Analysis', description: 'Peak vs off-peak performance' },
      { key: 'market', name: 'Market Positioning', description: 'Competitive set and ratings' },
      { key: 'projections', name: 'Growth Projections', description: 'Expansion and revenue forecasts' },
    ],
  },
  {
    id: 'str-investment-analysis',
    name: 'STR Investment Analysis',
    type: 'ic_memo',
    assetClasses: ['str'],
    audience: ['private_equity', 'family_office'],
    description: 'Detailed investment analysis for short-term rental acquisitions with regulatory risk assessment.',
    estimatedPages: 10,
    popularity: 62,
    exportFormats: ['pdf', 'docx'],
    dataRequirements: ['Property details', 'Revenue projections', 'Regulatory landscape', 'Comp analysis'],
    sections: [
      { key: 'thesis', name: 'Investment Thesis', description: 'Why this STR opportunity' },
      { key: 'property', name: 'Property Analysis', description: 'Location, condition, appeal' },
      { key: 'revenue_model', name: 'Revenue Model', description: 'Projected ADR and occupancy' },
      { key: 'regulatory', name: 'Regulatory Risk', description: 'Local STR regulations and compliance' },
      { key: 'returns', name: 'Return Analysis', description: 'Cash-on-cash, IRR, equity multiple' },
    ],
  },
  // Commercial templates
  {
    id: 'commercial-om',
    name: 'Commercial Property OM',
    type: 'offering_memorandum',
    assetClasses: ['commercial'],
    audience: ['institutional_investor', 'private_equity', 'family_office'],
    description: 'General commercial real estate offering memorandum suitable for retail, office, and mixed-use properties.',
    estimatedPages: 24,
    popularity: 86,
    featured: true,
    exportFormats: ['pdf', 'docx'],
    dataRequirements: ['Property details', 'Rent roll', 'Financial statements', 'Tenant profiles', 'Market data'],
    sections: [
      { key: 'cover', name: 'Cover Page', description: 'Property showcase cover' },
      { key: 'exec_summary', name: 'Executive Summary', description: 'Investment opportunity overview' },
      { key: 'property_overview', name: 'Property Overview', description: 'Building specs and tenant roster' },
      { key: 'tenant_profiles', name: 'Tenant Profiles', description: 'Credit quality and lease terms' },
      { key: 'rent_roll', name: 'Rent Roll', description: 'Detailed lease schedule' },
      { key: 'location', name: 'Location & Demographics', description: 'Trade area and traffic counts' },
      { key: 'financials', name: 'Financial Summary', description: 'NOI, expense ratios, cap rate' },
      { key: 'proforma', name: 'Pro Forma', description: 'Lease-up and growth projections' },
      { key: 'comps', name: 'Market Comparables', description: 'Sale and lease comps' },
    ],
  },
  {
    id: 'net-lease-summary',
    name: 'Net Lease Investment Summary',
    type: 'executive_summary',
    assetClasses: ['commercial'],
    audience: ['family_office', 'private_equity'],
    description: 'Focused investment summary for single-tenant net lease properties with credit analysis.',
    estimatedPages: 5,
    popularity: 73,
    exportFormats: ['pdf'],
    dataRequirements: ['Property details', 'Lease terms', 'Tenant credit profile'],
    sections: [
      { key: 'overview', name: 'Investment Overview', description: 'Property and tenant snapshot' },
      { key: 'lease', name: 'Lease Summary', description: 'Term, escalations, options' },
      { key: 'credit', name: 'Tenant Credit', description: 'Financial strength analysis' },
      { key: 'returns', name: 'Return Profile', description: 'Yield and appreciation potential' },
    ],
  },
  {
    id: 'industrial-acquisition-memo',
    name: 'Industrial Acquisition Memo',
    type: 'ic_memo',
    assetClasses: ['commercial'],
    audience: ['institutional_investor', 'private_equity'],
    description: 'Acquisition memo for industrial and logistics properties with tenant analysis and last-mile considerations.',
    estimatedPages: 14,
    popularity: 71,
    exportFormats: ['pdf', 'docx'],
    dataRequirements: ['Property details', 'Financial model', 'Tenant data', 'Market analysis'],
    sections: [
      { key: 'recommendation', name: 'Recommendation', description: 'Acquisition recommendation' },
      { key: 'property', name: 'Property Description', description: 'Specs, clear heights, loading' },
      { key: 'tenant', name: 'Tenant Analysis', description: 'Occupancy and credit quality' },
      { key: 'market', name: 'Industrial Market', description: 'Supply, demand, vacancy trends' },
      { key: 'financials', name: 'Underwriting', description: 'Cash flow and returns analysis' },
      { key: 'risks', name: 'Risk Assessment', description: 'Key risks and mitigants' },
    ],
  },
  // Universal templates
  {
    id: 'quick-financial-summary',
    name: 'Quick Financial Summary',
    type: 'executive_summary',
    assetClasses: ['marina', 'multifamily', 'self_storage', 'hotel', 'str', 'rv_park', 'commercial', 'residential', 'business'],
    audience: ['institutional_investor', 'private_equity', 'family_office', 'lender', 'broker'],
    description: 'One-page financial snapshot suitable for any asset class. Perfect for initial deal screening.',
    estimatedPages: 1,
    popularity: 92,
    exportFormats: ['pdf'],
    dataRequirements: ['Key financial metrics'],
    sections: [
      { key: 'header', name: 'Property Header', description: 'Name, location, asset class' },
      { key: 'kpis', name: 'Key Metrics', description: 'NOI, cap rate, price, per-unit metrics' },
      { key: 'snapshot', name: 'Financial Snapshot', description: 'Revenue and expense summary' },
    ],
  },
  {
    id: 'investor-update-report',
    name: 'Investor Update Report',
    type: 'custom',
    assetClasses: ['marina', 'multifamily', 'self_storage', 'hotel', 'str', 'rv_park', 'commercial', 'residential', 'business'],
    audience: ['institutional_investor', 'private_equity', 'family_office'],
    description: 'Quarterly or monthly investor update with portfolio performance, distributions, and market commentary.',
    estimatedPages: 8,
    popularity: 78,
    exportFormats: ['pdf', 'docx'],
    dataRequirements: ['Portfolio performance data', 'Distribution history', 'Market updates'],
    sections: [
      { key: 'letter', name: 'Manager Letter', description: 'Performance commentary' },
      { key: 'performance', name: 'Portfolio Performance', description: 'KPIs and returns summary' },
      { key: 'distributions', name: 'Distribution Summary', description: 'Current and cumulative distributions' },
      { key: 'property_updates', name: 'Property Updates', description: 'Asset-level status reports' },
      { key: 'market', name: 'Market Commentary', description: 'Macro and sector trends' },
    ],
  },
  {
    id: 'dd-checklist-report',
    name: 'Due Diligence Checklist Report',
    type: 'due_diligence_summary',
    assetClasses: ['marina', 'multifamily', 'self_storage', 'hotel', 'str', 'rv_park', 'commercial', 'residential', 'business'],
    audience: ['institutional_investor', 'private_equity', 'lender'],
    description: 'Comprehensive due diligence status report tracking all workstreams with findings and open items.',
    estimatedPages: 15,
    popularity: 83,
    exportFormats: ['pdf', 'docx'],
    dataRequirements: ['DD checklist data', 'Finding summaries', 'Document inventory'],
    sections: [
      { key: 'summary', name: 'DD Summary', description: 'Overall status and key findings' },
      { key: 'financial_dd', name: 'Financial DD', description: 'Accounting and tax review status' },
      { key: 'legal_dd', name: 'Legal DD', description: 'Title, zoning, litigation review' },
      { key: 'physical_dd', name: 'Physical DD', description: 'Inspection and environmental status' },
      { key: 'operational_dd', name: 'Operational DD', description: 'Management and staffing review' },
      { key: 'open_items', name: 'Open Items', description: 'Outstanding items and deadlines' },
    ],
  },
  {
    id: 'pitch-deck',
    name: 'Pitch Deck',
    type: 'pitch_deck',
    assetClasses: ['marina', 'multifamily', 'self_storage', 'hotel', 'str', 'rv_park', 'commercial', 'residential', 'business'],
    audience: ['institutional_investor', 'private_equity', 'family_office'],
    description: '10-slide investment pitch deck with compelling visuals, key metrics, and clear call to action.',
    estimatedPages: 10,
    popularity: 90,
    exportFormats: ['pdf', 'pptx'],
    dataRequirements: ['Property details', 'Key financial metrics', 'Property photos', 'Market data'],
    sections: [
      { key: 'title_slide', name: 'Title Slide', description: 'Property name and hero image' },
      { key: 'opportunity', name: 'The Opportunity', description: 'Investment thesis in one slide' },
      { key: 'property', name: 'Property Overview', description: 'Key property facts' },
      { key: 'market', name: 'Market Opportunity', description: 'Market size and trends' },
      { key: 'financials', name: 'Financial Highlights', description: 'Revenue, NOI, returns' },
      { key: 'strategy', name: 'Value Creation Strategy', description: 'Business plan overview' },
      { key: 'team', name: 'Team & Track Record', description: 'Sponsor experience' },
      { key: 'terms', name: 'Deal Terms', description: 'Structure and economics' },
      { key: 'timeline', name: 'Timeline & Milestones', description: 'Execution plan' },
      { key: 'cta', name: 'Call to Action', description: 'Next steps and contact' },
    ],
  },
  {
    id: 'board-presentation',
    name: 'Board Presentation Deck',
    type: 'pitch_deck',
    assetClasses: ['marina', 'multifamily', 'self_storage', 'hotel', 'str', 'rv_park', 'commercial', 'residential', 'business'],
    audience: ['institutional_investor'],
    description: 'Board-level presentation for portfolio updates, new acquisitions, or strategic initiatives.',
    estimatedPages: 15,
    popularity: 67,
    exportFormats: ['pdf', 'pptx'],
    dataRequirements: ['Portfolio data', 'Financial summaries', 'Strategic plan'],
    sections: [
      { key: 'agenda', name: 'Agenda', description: 'Meeting agenda and objectives' },
      { key: 'portfolio_summary', name: 'Portfolio Summary', description: 'AUM, returns, composition' },
      { key: 'performance', name: 'Performance Review', description: 'Period performance vs targets' },
      { key: 'acquisitions', name: 'Acquisition Pipeline', description: 'Active and prospective deals' },
      { key: 'dispositions', name: 'Disposition Plan', description: 'Planned exits and timing' },
      { key: 'market_outlook', name: 'Market Outlook', description: 'Macro and sector views' },
      { key: 'strategy', name: 'Strategic Priorities', description: 'Forward-looking initiatives' },
      { key: 'action_items', name: 'Action Items', description: 'Decisions and next steps' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TemplateGallery() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [docTypeFilter, setDocTypeFilter] = useState<DocumentType | 'all'>('all');
  const [assetFilter, setAssetFilter] = useState<AssetClassFilter>('all');
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [search, setSearch] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState<TemplateData | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const filtered = useMemo(() => {
    let result = DEFAULT_TEMPLATES.filter((t) => {
      if (docTypeFilter !== 'all' && t.type !== docTypeFilter) return false;
      if (assetFilter !== 'all' && !t.assetClasses.includes(assetFilter)) return false;
      if (audienceFilter !== 'all' && !t.audience.includes(audienceFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
        );
      }
      return true;
    });

    if (sortBy === 'popular') result.sort((a, b) => b.popularity - a.popularity);
    else if (sortBy === 'newest') result.sort((a, b) => b.id.localeCompare(a.id));
    else result.sort((a, b) => a.name.localeCompare(b.name));

    return result;
  }, [docTypeFilter, assetFilter, audienceFilter, sortBy, search]);

  const featured = useMemo(
    () => DEFAULT_TEMPLATES.filter((t) => t.featured),
    [],
  );

  const DocIcon = (type: DocumentType) => {
    const Icon = DOC_TYPE_ICONS[type] ?? FileText;
    return Icon;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-white px-6 py-8">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Template Gallery</h1>
            <p className="mt-1 text-muted-foreground">
              Professional templates for every document type and asset class
            </p>
          </div>
          <Button onClick={() => navigate('/document-studio/new?type=custom')}>
            <Plus className="mr-2 h-4 w-4" />
            Create Custom Template
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur px-6 py-3">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center gap-3">
          <Select value={docTypeFilter} onValueChange={(v) => setDocTypeFilter(v as any)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Document Type" />
            </SelectTrigger>
            <SelectContent>
              {DOC_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={assetFilter} onValueChange={(v) => setAssetFilter(v as any)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Asset Class" />
            </SelectTrigger>
            <SelectContent>
              {ASSET_CLASS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={audienceFilter} onValueChange={(v) => setAudienceFilter(v as any)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Audience" />
            </SelectTrigger>
            <SelectContent>
              {AUDIENCE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">Popular</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="name_az">Name A-Z</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-[240px] pl-9"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8 space-y-10">
        {/* Featured Templates */}
        {!search && docTypeFilter === 'all' && assetFilter === 'all' && audienceFilter === 'all' && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Star className="h-5 w-5 text-amber-500" />
              <h2 className="text-xl font-semibold">Featured Templates</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {featured.map((t) => {
                const Icon = DocIcon(t.type);
                return (
                  <Card key={t.id} className="overflow-hidden border-2 border-amber-200/60 hover:border-amber-300 transition-colors">
                    <div className={`h-36 bg-gradient-to-br ${DOC_TYPE_GRADIENTS[t.type]} flex items-center justify-center`}>
                      <Icon className="h-16 w-16 text-white/80" />
                    </div>
                    <CardHeader className="pb-2">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <Badge variant="secondary" className={DOC_TYPE_COLORS[t.type]}>
                          {DOC_TYPE_LABELS[t.type]}
                        </Badge>
                        {t.assetClasses.slice(0, 2).map((ac) => (
                          <Badge key={ac} variant="outline" className="text-xs">{ac.replace('_', ' ')}</Badge>
                        ))}
                      </div>
                      <h3 className="font-semibold leading-tight">{t.name}</h3>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {t.estimatedPages} pages
                      </p>
                    </CardContent>
                    <CardFooter className="pt-0">
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={isCreating}
                        onClick={async () => {
                          try {
                            setIsCreating(true);
                            const res = await fetch('/api/document-builder/documents', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                title: t.name,
                                documentType: t.type,
                                templateId: String(t.id),
                                assetClass: t.assetClasses?.[0] || null,
                              }),
                            });
                            if (!res.ok) throw new Error('Failed to create document');
                            const doc = await res.json();
                            navigate(`/document-studio/editor/${doc.id}`);
                          } catch {
                            toast({ title: 'Failed to create document', variant: 'destructive' });
                          } finally {
                            setIsCreating(false);
                          }
                        }}
                      >
                        Use Template
                        <ArrowRight className="ml-2 h-3.5 w-3.5" />
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Template Grid */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              {search || docTypeFilter !== 'all' || assetFilter !== 'all' || audienceFilter !== 'all'
                ? `${filtered.length} template${filtered.length !== 1 ? 's' : ''} found`
                : 'All Templates'}
            </h2>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 font-medium">No templates match your filters</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Try adjusting your filters or search terms.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filtered.map((t) => {
                const Icon = DocIcon(t.type);
                return (
                  <Card
                    key={t.id}
                    className="group relative overflow-hidden hover:shadow-md transition-all"
                  >
                    {/* Preview thumbnail */}
                    <div className={`relative h-28 bg-gradient-to-br ${DOC_TYPE_GRADIENTS[t.type]} flex items-center justify-center`}>
                      <Icon className="h-12 w-12 text-white/70" />
                      {/* Hover overlay with section list */}
                      <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center px-3 py-2 overflow-hidden">
                        <p className="text-white/90 text-xs font-medium mb-1">Sections:</p>
                        <ul className="space-y-0.5">
                          {t.sections.slice(0, 6).map((s) => (
                            <li key={s.key} className="text-white/70 text-xs truncate">
                              {s.name}
                            </li>
                          ))}
                          {t.sections.length > 6 && (
                            <li className="text-white/50 text-xs">
                              +{t.sections.length - 6} more
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>

                    <CardHeader className="pb-1.5 pt-3">
                      <h3 className="font-semibold text-sm leading-tight">{t.name}</h3>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${DOC_TYPE_COLORS[t.type]}`}>
                          {DOC_TYPE_LABELS[t.type]}
                        </Badge>
                        {t.assetClasses.slice(0, 2).map((ac) => (
                          <Badge key={ac} variant="outline" className="text-[10px] px-1.5 py-0">
                            {ac.replace('_', ' ')}
                          </Badge>
                        ))}
                        {t.assetClasses.length > 2 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            +{t.assetClasses.length - 2}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="pb-1.5">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Layers className="h-3 w-3" />
                          {t.sections.length} sections
                        </span>
                        <span>{t.estimatedPages} pg</span>
                      </div>
                    </CardContent>

                    <CardFooter className="pt-0 pb-3 gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        className="flex-1 h-8 text-xs"
                        disabled={isCreating}
                        onClick={async () => {
                          try {
                            setIsCreating(true);
                            const res = await fetch('/api/document-builder/documents', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                title: t.name,
                                documentType: t.type,
                                templateId: String(t.id),
                                assetClass: t.assetClasses?.[0] || null,
                              }),
                            });
                            if (!res.ok) throw new Error('Failed');
                            const doc = await res.json();
                            navigate(`/document-studio/editor/${doc.id}`);
                          } catch {
                            toast({ title: 'Failed to create document', variant: 'destructive' });
                          } finally {
                            setIsCreating(false);
                          }
                        }}
                      >
                        Use Template
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => setPreviewTemplate(t)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
        {previewTemplate && (
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">{previewTemplate.name}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{previewTemplate.description}</p>
            </DialogHeader>

            <div className="space-y-5 py-2">
              {/* Type & Asset badges */}
              <div className="flex flex-wrap gap-2">
                <Badge className={DOC_TYPE_COLORS[previewTemplate.type]}>
                  {DOC_TYPE_LABELS[previewTemplate.type]}
                </Badge>
                {previewTemplate.assetClasses.map((ac) => (
                  <Badge key={ac} variant="outline">{ac.replace('_', ' ')}</Badge>
                ))}
              </div>

              {/* Meta row */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="rounded-md border p-3 text-center">
                  <p className="text-2xl font-bold">{previewTemplate.estimatedPages}</p>
                  <p className="text-muted-foreground text-xs">Est. Pages</p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-2xl font-bold">{previewTemplate.sections.length}</p>
                  <p className="text-muted-foreground text-xs">Sections</p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-2xl font-bold">{previewTemplate.exportFormats.length}</p>
                  <p className="text-muted-foreground text-xs">Export Formats</p>
                </div>
              </div>

              {/* Sections */}
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Included Sections
                </h4>
                <div className="space-y-1.5">
                  {previewTemplate.sections.map((s, i) => (
                    <div
                      key={s.key}
                      className="flex items-start gap-3 rounded-md border px-3 py-2"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data requirements */}
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Data Requirements
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {previewTemplate.dataRequirements.map((d) => (
                    <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>
                  ))}
                </div>
              </div>

              {/* Export formats */}
              <div>
                <h4 className="font-medium mb-2">Export Formats</h4>
                <div className="flex gap-2">
                  {previewTemplate.exportFormats.map((f) => (
                    <Badge key={f} variant="outline" className="uppercase text-xs">{f}</Badge>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                disabled={isCreating}
                onClick={async () => {
                  if (!previewTemplate) return;
                  try {
                    setIsCreating(true);
                    const res = await fetch('/api/document-builder/documents', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title: previewTemplate.name,
                        documentType: previewTemplate.type,
                        templateId: String(previewTemplate.id),
                        assetClass: previewTemplate.assetClasses?.[0] || null,
                      }),
                    });
                    if (!res.ok) throw new Error('Failed');
                    const doc = await res.json();
                    setPreviewTemplate(null);
                    navigate(`/document-studio/editor/${doc.id}?customize=true`);
                  } catch {
                    toast({ title: 'Failed to create document', variant: 'destructive' });
                  } finally {
                    setIsCreating(false);
                  }
                }}
              >
                Customize First
              </Button>
              <Button
                disabled={isCreating}
                onClick={async () => {
                  if (!previewTemplate) return;
                  try {
                    setIsCreating(true);
                    const res = await fetch('/api/document-builder/documents', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title: previewTemplate.name,
                        documentType: previewTemplate.type,
                        templateId: String(previewTemplate.id),
                        assetClass: previewTemplate.assetClasses?.[0] || null,
                      }),
                    });
                    if (!res.ok) throw new Error('Failed');
                    const doc = await res.json();
                    setPreviewTemplate(null);
                    navigate(`/document-studio/editor/${doc.id}`);
                  } catch {
                    toast({ title: 'Failed to create document', variant: 'destructive' });
                  } finally {
                    setIsCreating(false);
                  }
                }}
              >
                Use This Template
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
