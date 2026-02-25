/**
 * Document Builder Types
 * Comprehensive type definitions for the multi-document builder system
 */

// =============================================================================
// Document Types
// =============================================================================

export type DocumentType = 
  | 'offering_memorandum'
  | 'executive_summary'
  | 'pitch_deck'
  | 'ic_memo'
  | 'teaser'
  | 'lender_package'
  | 'due_diligence_summary'
  | 'custom';

export interface DocumentTypeConfig {
  key: DocumentType;
  label: string;
  description: string;
  defaultSections: string[];
  requiredSections: string[];
  optionalSections: string[];
  defaultExportFormat: 'pdf' | 'pptx' | 'docx';
  supportedExportFormats: ('pdf' | 'pptx' | 'docx')[];
  audiencePersonas: AudiencePersona[];
  estimatedPages: { min: number; max: number };
}

export type AudiencePersona = 
  | 'institutional_investor'
  | 'private_equity'
  | 'family_office'
  | 'lender'
  | 'investment_committee'
  | 'board_of_directors'
  | 'potential_buyer'
  | 'broker';

export type AssetClass = 
  | 'marina'
  | 'rv_park'
  | 'mobile_home_park'
  | 'self_storage'
  | 'multifamily'
  | 'mixed_use'
  | 'other';

// =============================================================================
// Section Library
// =============================================================================

export interface SectionDefinition {
  sectionKey: string;
  name: string;
  description: string;
  category: SectionCategory;
  supportedDocTypes: DocumentType[];
  requiredDataBindings: DataBindingRequirement[];
  optionalDataBindings: DataBindingRequirement[];
  requiredMedia: MediaRequirement[];
  optionalMedia: MediaRequirement[];
  schema: SectionSchema;
  defaultLayouts: LayoutVariant[];
  aiPromptTemplates: AIPromptTemplate[];
  completionRules: CompletionRule[];
  estimatedPages: number;
  marinaSpecific: boolean;
}

export type SectionCategory = 
  | 'cover'
  | 'summary'
  | 'property'
  | 'location'
  | 'market'
  | 'financial'
  | 'operations'
  | 'due_diligence'
  | 'appendix'
  | 'legal';

export interface DataBindingRequirement {
  bindingKey: string;
  label: string;
  source: DataSource;
  field: string;
  type: 'string' | 'number' | 'currency' | 'percent' | 'date' | 'array' | 'object';
  required: boolean;
  fallback?: any;
  transform?: string; // lodash-style transform path
}

export type DataSource = 
  | 'deal'
  | 'property'
  | 'valuator'
  | 'sales_comps'
  | 'rate_comps'
  | 'rent_roll'
  | 'demographics'
  | 'due_diligence'
  | 'modeling'
  | 'manual';

export interface MediaRequirement {
  mediaKey: string;
  label: string;
  type: 'image' | 'map' | 'chart' | 'video';
  required: boolean;
  suggestedDimensions?: { width: number; height: number };
  maxCount?: number;
  allowedMimeTypes?: string[];
}

export interface SectionSchema {
  type: 'object';
  properties: Record<string, SchemaProperty>;
  required?: string[];
}

export interface SchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  default?: any;
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
  format?: 'currency' | 'percent' | 'date' | 'richtext' | 'markdown';
}

export interface LayoutVariant {
  key: string;
  name: string;
  thumbnail?: string;
  pageCount: number;
  structure: LayoutStructure;
}

export interface LayoutStructure {
  gridColumns: number;
  gridRows?: number;
  gridGap: string;
  backgroundColor?: string;
  backgroundImageUrl?: string;
  placeholders: LayoutPlaceholder[];
}

export interface LayoutPlaceholder {
  id: string;
  blockType: BlockType;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  bindingKey?: string;
  styleHints?: Record<string, any>;
}

export type BlockType = 
  | 'text'
  | 'image'
  | 'kpi'
  | 'metric_tile'
  | 'chart'
  | 'table'
  | 'map'
  | 'image_grid'
  | 'shape'
  | 'divider'
  | 'spacer';

export interface AIPromptTemplate {
  key: string;
  name: string;
  systemPrompt: string;
  userPromptTemplate: string;
  requiredContext: string[];
  outputFormat: 'text' | 'markdown' | 'json' | 'bullets';
  maxTokens: number;
  temperature: number;
}

export interface CompletionRule {
  type: 'required_field' | 'required_media' | 'min_content_length' | 'custom';
  field?: string;
  mediaKey?: string;
  minLength?: number;
  customValidator?: string;
  errorMessage: string;
}

// =============================================================================
// Document Structure
// =============================================================================

export interface DocumentConfig {
  id: string;
  dealId: string;
  documentType: DocumentType;
  title: string;
  audience: AudiencePersona;
  assetClass: AssetClass;
  themeId?: string;
  templateId?: string;
  brandKitId?: string;
  sections: DocumentSection[];
  metadata: DocumentMetadata;
  status: DocumentStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type DocumentStatus = 
  | 'draft'
  | 'in_progress'
  | 'review'
  | 'approved'
  | 'generating'
  | 'completed'
  | 'failed';

export interface DocumentSection {
  id: string;
  sectionKey: string;
  order: number;
  enabled: boolean;
  customTitle?: string;
  dataBindings: ResolvedBinding[];
  media: ResolvedMedia[];
  content: SectionContent;
  aiGenerated: boolean;
  completionStatus: CompletionStatus;
  pageIds: string[];
}

export interface ResolvedBinding {
  bindingKey: string;
  source: DataSource;
  field: string;
  value: any;
  locked: boolean;
  overridden: boolean;
  originalValue?: any;
}

export interface ResolvedMedia {
  mediaKey: string;
  assetId: string;
  url: string;
  caption?: string;
  altText?: string;
  isCover?: boolean;
}

export interface SectionContent {
  narrative?: string;
  bullets?: string[];
  tables?: TableData[];
  charts?: ChartConfig[];
  customFields?: Record<string, any>;
}

export interface TableData {
  id: string;
  title?: string;
  columns: TableColumn[];
  rows: Record<string, any>[];
  footerRows?: Record<string, any>[];
  style?: TableStyle;
}

export interface TableColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'currency' | 'percent' | 'date';
  width?: string;
  align?: 'left' | 'center' | 'right';
  format?: string;
}

export interface TableStyle {
  headerBackground?: string;
  headerTextColor?: string;
  alternateRowColors?: boolean;
  borderStyle?: 'none' | 'minimal' | 'full';
  fontSize?: number;
}

export interface ChartConfig {
  id: string;
  type: 'bar' | 'line' | 'pie' | 'donut' | 'stacked_bar' | 'area';
  title?: string;
  data: ChartData;
  options?: ChartOptions;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string;
}

export interface ChartOptions {
  showLegend?: boolean;
  showLabels?: boolean;
  yAxisLabel?: string;
  xAxisLabel?: string;
  valueFormat?: 'number' | 'currency' | 'percent';
}

export interface CompletionStatus {
  isComplete: boolean;
  completedFields: string[];
  missingFields: string[];
  missingMedia: string[];
  warnings: string[];
  percentage: number;
}

export interface DocumentMetadata {
  propertyName?: string;
  propertyAddress?: string;
  preparedBy?: string;
  preparedFor?: string;
  confidentialityLevel?: 'public' | 'confidential' | 'highly_confidential';
  generatedAt?: Date;
  version?: number;
  exemplarIds?: string[];
}

// =============================================================================
// Exemplar System
// =============================================================================

export interface Exemplar {
  id: string;
  name: string;
  description?: string;
  documentType: DocumentType;
  assetClass: AssetClass;
  uploadedFileUrl: string;
  uploadedFileName: string;
  extractedStructure?: ExtractedStructure;
  extractedStyles?: ExtractedStyles;
  organizationId?: string;
  userId: string;
  isPublic: boolean;
  createdAt: Date;
}

export interface ExtractedStructure {
  sections: ExtractedSection[];
  pageCount: number;
  hasTableOfContents: boolean;
  hasAppendix: boolean;
}

export interface ExtractedSection {
  title: string;
  pageNumbers: number[];
  contentTypes: ('narrative' | 'table' | 'chart' | 'image' | 'bullets')[];
  estimatedWordCount: number;
}

export interface ExtractedStyles {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
  };
  typography: {
    headingFont?: string;
    bodyFont?: string;
    headingSizes: number[];
  };
  layout: {
    margins: { top: number; right: number; bottom: number; left: number };
    hasHeaderFooter: boolean;
    hasPageNumbers: boolean;
  };
}

// =============================================================================
// Export Types
// =============================================================================

export interface ExportJob {
  id: string;
  documentId: string;
  format: 'pdf' | 'pptx' | 'docx';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  outputUrl?: string;
  errorMessage?: string;
  options: ExportOptions;
  createdAt: Date;
  completedAt?: Date;
}

export interface ExportOptions {
  includeAppendix?: boolean;
  includeTableOfContents?: boolean;
  watermark?: string;
  confidentialFooter?: boolean;
  companyLogo?: string;
  pageSize?: 'letter' | 'a4';
  orientation?: 'portrait' | 'landscape';
  quality?: 'draft' | 'standard' | 'high';
}

// =============================================================================
// Builder Mode Types
// =============================================================================

export interface BuilderState {
  step: BuilderStep;
  documentConfig: Partial<DocumentConfig>;
  selectedSections: string[];
  completionSummary: BuilderCompletionSummary;
  validationErrors: ValidationError[];
}

export type BuilderStep = 
  | 'select_type'
  | 'configure_audience'
  | 'select_sections'
  | 'bind_data'
  | 'add_media'
  | 'generate_content'
  | 'review'
  | 'export';

export interface BuilderCompletionSummary {
  totalSections: number;
  completedSections: number;
  sectionsWithWarnings: number;
  overallPercentage: number;
  readyToExport: boolean;
}

export interface ValidationError {
  sectionKey?: string;
  field?: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

// =============================================================================
// Marina-Specific Types
// =============================================================================

export interface MarinaStorageMix {
  wetSlips: WetSlipCategory[];
  dryStorage: DryStorageCategory[];
  moorings: MooringCategory[];
  otherStorage: OtherStorageCategory[];
}

export interface WetSlipCategory {
  sizeRange: string; // e.g., "20-29", "30-39"
  count: number;
  occupancy: number;
  avgRate: number;
  rateUnit: 'per_foot' | 'per_slip' | 'monthly' | 'annual';
}

export interface DryStorageCategory {
  type: 'rack' | 'trailer' | 'covered' | 'open';
  count: number;
  occupancy: number;
  avgRate: number;
}

export interface MooringCategory {
  type: 'mooring_ball' | 'mooring_field';
  count: number;
  occupancy: number;
  avgRate: number;
}

export interface OtherStorageCategory {
  type: string;
  count: number;
  avgRate: number;
}

export interface MarinaAncillaryRevenue {
  fuel: FuelRevenue;
  shipStore: number;
  service: ServiceRevenue;
  rentals: RentalRevenue;
  boatClub: number;
  events: number;
  other: number;
}

export interface FuelRevenue {
  gasGallons: number;
  dieselGallons: number;
  gasMargin: number;
  dieselMargin: number;
  totalRevenue: number;
}

export interface ServiceRevenue {
  mechanical: number;
  fiberglass: number;
  electronics: number;
  detailing: number;
  other: number;
}

export interface RentalRevenue {
  kayaks: number;
  paddleboards: number;
  jetSkis: number;
  boats: number;
  other: number;
}

export interface WaterwayAccess {
  bodyOfWater: string;
  channelDepth: number;
  basinDepth: number;
  tidalRange?: number;
  dredgingRequired: boolean;
  lastDredged?: Date;
  accessToGulf: boolean;
  accessToOcean: boolean;
  bridgeClearance?: number;
  navigationalHazards?: string[];
}

export interface StormRiskSummary {
  floodZone: string;
  hurricaneRisk: 'low' | 'moderate' | 'high' | 'very_high';
  lastMajorStorm?: string;
  insuranceNotes?: string;
  mitigationMeasures?: string[];
}

// =============================================================================
// Document Type Configurations
// =============================================================================

export const DOCUMENT_TYPE_CONFIGS: Record<DocumentType, DocumentTypeConfig> = {
  offering_memorandum: {
    key: 'offering_memorandum',
    label: 'Offering Memorandum',
    description: 'Comprehensive investment package for marketing a property to potential buyers',
    defaultSections: [
      'cover_page', 'executive_summary', 'investment_highlights', 'property_overview',
      'location_access', 'market_overview', 'operations_revenue', 'historical_financials',
      'underwriting_returns', 'rent_roll', 'disclaimer'
    ],
    requiredSections: ['cover_page', 'executive_summary', 'property_overview', 'disclaimer'],
    optionalSections: [
      'photo_gallery', 'sales_comps', 'rate_comps', 'capex_business_plan',
      'risks_mitigants', 'due_diligence_checklist', 'appendix'
    ],
    defaultExportFormat: 'pdf',
    supportedExportFormats: ['pdf'],
    audiencePersonas: ['institutional_investor', 'private_equity', 'family_office', 'potential_buyer'],
    estimatedPages: { min: 20, max: 50 }
  },
  
  executive_summary: {
    key: 'executive_summary',
    label: 'Executive Summary',
    description: 'Concise 1-2 page overview of the investment opportunity',
    defaultSections: [
      'cover_page', 'executive_summary', 'key_metrics', 'investment_highlights'
    ],
    requiredSections: ['executive_summary', 'key_metrics'],
    optionalSections: ['cover_page', 'investment_highlights', 'contact_info'],
    defaultExportFormat: 'pdf',
    supportedExportFormats: ['pdf', 'docx'],
    audiencePersonas: ['institutional_investor', 'private_equity', 'family_office', 'broker'],
    estimatedPages: { min: 1, max: 3 }
  },
  
  pitch_deck: {
    key: 'pitch_deck',
    label: 'Pitch Deck',
    description: 'Visual presentation for meetings and initial discussions',
    defaultSections: [
      'cover_page', 'executive_summary', 'investment_highlights', 'property_overview',
      'market_overview', 'financial_summary', 'returns_summary', 'contact_info'
    ],
    requiredSections: ['cover_page', 'executive_summary', 'investment_highlights'],
    optionalSections: [
      'photo_gallery', 'competitive_set', 'operations_revenue', 'team_overview'
    ],
    defaultExportFormat: 'pptx',
    supportedExportFormats: ['pptx', 'pdf'],
    audiencePersonas: ['institutional_investor', 'private_equity', 'board_of_directors'],
    estimatedPages: { min: 10, max: 25 }
  },
  
  ic_memo: {
    key: 'ic_memo',
    label: 'IC Memo',
    description: 'Detailed investment committee memorandum for internal decision-making',
    defaultSections: [
      'cover_page', 'photo_gallery', 'executive_summary', 'ground_leases',
      'property_overview', 'competitive_set', 'rent_roll_analysis', 'storage_revenue',
      'ancillary_revenue', 'financial_overview', 'debt_financing', 'underwriting_assumptions',
      'pro_forma_summary', 'pro_forma_detail', 'sensitivity_analysis'
    ],
    requiredSections: [
      'executive_summary', 'property_overview', 'financial_overview',
      'underwriting_assumptions', 'pro_forma_summary', 'sensitivity_analysis'
    ],
    optionalSections: [
      'ground_leases', 'competitive_set', 'rent_roll_analysis', 'ancillary_revenue',
      'risks_mitigants', 'due_diligence_checklist', 'appendix'
    ],
    defaultExportFormat: 'pdf',
    supportedExportFormats: ['pdf', 'pptx'],
    audiencePersonas: ['investment_committee', 'board_of_directors'],
    estimatedPages: { min: 15, max: 30 }
  },
  
  teaser: {
    key: 'teaser',
    label: 'Teaser',
    description: 'Brief marketing document to generate initial interest',
    defaultSections: [
      'cover_page', 'property_highlights', 'key_metrics', 'location_overview', 'contact_info'
    ],
    requiredSections: ['property_highlights', 'key_metrics'],
    optionalSections: ['cover_page', 'photo_gallery', 'location_overview'],
    defaultExportFormat: 'pdf',
    supportedExportFormats: ['pdf'],
    audiencePersonas: ['potential_buyer', 'broker', 'institutional_investor'],
    estimatedPages: { min: 1, max: 4 }
  },
  
  lender_package: {
    key: 'lender_package',
    label: 'Lender Package',
    description: 'Documentation package for loan applications',
    defaultSections: [
      'cover_page', 'executive_summary', 'property_overview', 'historical_financials',
      'rent_roll', 'operating_statement', 'debt_service_coverage', 'sponsor_overview'
    ],
    requiredSections: [
      'executive_summary', 'property_overview', 'historical_financials',
      'rent_roll', 'debt_service_coverage'
    ],
    optionalSections: [
      'market_overview', 'appraisal_summary', 'environmental_summary', 'insurance_summary'
    ],
    defaultExportFormat: 'pdf',
    supportedExportFormats: ['pdf', 'docx'],
    audiencePersonas: ['lender'],
    estimatedPages: { min: 20, max: 40 }
  },
  
  due_diligence_summary: {
    key: 'due_diligence_summary',
    label: 'Due Diligence Summary',
    description: 'Summary of due diligence findings and status',
    defaultSections: [
      'cover_page', 'dd_overview', 'dd_checklist', 'key_findings', 'open_items',
      'risks_mitigants', 'recommendation'
    ],
    requiredSections: ['dd_overview', 'dd_checklist', 'key_findings'],
    optionalSections: [
      'environmental_summary', 'title_survey', 'legal_review', 'insurance_review',
      'operational_review', 'appendix'
    ],
    defaultExportFormat: 'docx',
    supportedExportFormats: ['docx', 'pdf'],
    audiencePersonas: ['investment_committee', 'board_of_directors'],
    estimatedPages: { min: 10, max: 25 }
  },
  
  custom: {
    key: 'custom',
    label: 'Custom Document',
    description: 'Build a custom document from available sections',
    defaultSections: [],
    requiredSections: [],
    optionalSections: [], // All sections available
    defaultExportFormat: 'pdf',
    supportedExportFormats: ['pdf', 'pptx', 'docx'],
    audiencePersonas: [
      'institutional_investor', 'private_equity', 'family_office', 'lender',
      'investment_committee', 'board_of_directors', 'potential_buyer', 'broker'
    ],
    estimatedPages: { min: 1, max: 100 }
  }
};
