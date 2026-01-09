export type BlockType = 
  | 'text' | 'heading' | 'callout'
  | 'chart' | 'line-chart' | 'pie-chart' | 'area-chart' | 'trend-chart' | 'combo-chart'
  | 'kpi' | 'gauge' | 'target-kpi' | 'currency-kpi' | 'percent-kpi' | 'number-kpi'
  | 'table' | 'matrix' | 'list'
  | 'image' | 'gallery' | 'map'
  | 'divider' | 'spacer'
  | 'shape' | 'icon' | 'group'
  | 'metricStrip' | 'imageGrid' | 'mapPage' | 'sectionDivider' | 'teamGrid' | 'disclaimer' | 'portfolioTable'
  | 'heroKpiGrid' | 'executiveSummary' | 'financialAnalysis' | 'operatingAnalysis' 
  | 'financingOverview' | 'cashFlowForecast' | 'marinaKpis' | 'financialBreakdown' | 'investmentReturns';

export type ShapeType = 'rect' | 'circle' | 'line' | 'triangle';

export type OmPageOrientation = 'portrait' | 'landscape';

export type OmPageLayoutType = 'single-column' | 'two-column' | 'cover' | 'hero-with-body' | 'freeform' | 'grid';

export type FontFamily = 'sans' | 'serif' | 'mono' | 'display';

export type CalloutVariant = 'info' | 'success' | 'warning' | 'error' | 'tip' | 'note';

export interface OmPageLayoutConfig {
  layoutType: OmPageLayoutType;
  orientation?: OmPageOrientation;
  showHeader?: boolean;
  showFooter?: boolean;
  showPageNumber?: boolean;
  showTocEntry?: boolean;
  heroImageUrl?: string;
  heroOverlay?: boolean;
  backgroundColor?: string;
  columns?: {
    leftWidthPercent?: number;
    rightWidthPercent?: number;
  };
  gridColumns?: number;
  gridGap?: string;
}

export interface OmTheme {
  id: string;
  name: string;
  description?: string;
  organizationId?: string;
  userId?: string;
  isDefault?: boolean;
  isSystemDefault?: boolean;
  baseThemeKey?: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface?: string;
    text: string;
    textMuted?: string;
    headerBackground?: string;
    footerBackground?: string;
    metricTileBackground?: string;
    chartSeries?: string[];
    mapOverlay?: string;
  };
  typography: {
    headingFont?: string;
    bodyFont?: string;
    fontFamilyDisplay?: string;
    fontFamilyHeading?: string;
    fontFamilyBody?: string;
    fontSizes?: {
      title?: string;
      section?: string;
      h1?: string;
      h2?: string;
      h3?: string;
      body?: string;
      disclaimer?: string;
      metricValue?: string;
      metricLabel?: string;
    };
    fontWeights?: {
      title?: number;
      heading?: number;
      body?: number;
      bold?: number;
    };
  };
  branding?: {
    logoUrl?: string;
    watermarkUrl?: string;
    footerTextTemplate?: string;
    coverOverlayStyle?: 'solid' | 'gradient' | 'none';
    headerStyle?: 'minimal' | 'branded' | 'none';
  };
  spacing: {
    blockGap?: string;
    pagePadding?: string;
    defaultSpacingScale?: number;
    defaultBorderRadius?: string;
    cardShadow?: 'none' | 'sm' | 'md' | 'lg';
    pageMargins?: { top: number; right: number; bottom: number; left: number };
  };
}

export type OmLayoutType = 'cover' | 'sectionDivider' | 'execSummary' | 'financials' | 'market' | 'photos' | 'portfolio' | 'team' | 'disclaimer' | 'custom';

export interface OmPageLayoutDefinition {
  id: string;
  name: string;
  description?: string;
  layoutType: OmLayoutType;
  themeId?: string;
  organizationId?: string;
  userId?: string;
  isSystemDefault?: boolean;
  thumbnail?: string;
  structure: {
    gridColumns: number;
    gridRows?: number;
    gridGap: string;
    backgroundColor?: string;
    backgroundImageUrl?: string;
    placeholders: Array<{
      id: string;
      blockType: string;
      x: number;
      y: number;
      width: number;
      height: number;
      label?: string;
      styleHints?: Record<string, any>;
    }>;
  };
}

export interface MetricStripContent {
  metrics: Array<{
    id: string;
    label: string;
    value: string | number;
    iconKey?: string;
    tooltip?: string;
    unit?: string;
  }>;
  layout?: {
    columns: number;
    variant: 'compact' | 'spacious';
  };
  styleOverrides?: {
    backgroundColor?: string;
    textColor?: string;
    borderRadius?: string;
  };
}

export interface ImageGridContent {
  layout: '2x2' | '3x1' | '3x2' | '1x3' | 'custom';
  images: Array<{
    id: string;
    url: string;
    caption?: string;
    alt?: string;
    positionIndex: number;
  }>;
  showCaptions?: boolean;
  gap?: string;
}

export interface MapPageContent {
  mapImageUrl: string;
  legendItems: Array<{
    id: string;
    label: string;
    description?: string;
    iconKey?: string;
    color?: string;
  }>;
  subjectLabel?: string;
  showSubjectMarker?: boolean;
  overlayOpacity?: number;
}

export interface SectionDividerContent {
  sectionNumber: string | number;
  title: string;
  subtitle?: string;
  variant: 'solid' | 'imageOverlay';
  backgroundImageUrl?: string;
}

export interface TeamGridContent {
  members: Array<{
    id: string;
    name: string;
    title: string;
    firm?: string;
    headshotUrl?: string;
    email?: string;
    phone?: string;
    bioShort?: string;
    bioFull?: string;
    linkedInUrl?: string;
  }>;
  columns?: number;
  showContactInfo?: boolean;
}

export interface DisclaimerContent {
  title: string;
  body: string;
  layout: 'fullWidth' | 'twoColumn';
}

export interface PortfolioTableContent {
  columns: Array<{
    id: string;
    label: string;
    field: string;
    alignment?: 'left' | 'center' | 'right';
    format?: 'text' | 'currency' | 'percent' | 'number';
  }>;
  rows: Array<Record<string, any>>;
  showSummaryRow?: boolean;
  variant: 'portfolio' | 'pipeline';
}

export type OmDataSourceType = 'underwriting' | 'sales_comps' | 'rent_comps' | 'market' | 'demographics' | 'manual' | 'dataset';

export interface OmDataBinding {
  sourceType: OmDataSourceType;
  sourceId?: string | null;
  sheetName?: string;
  bindingRole?: string;
  query?: any;
}

export type OmBlockColumn = 'auto' | 'left' | 'right' | 'full';

export interface GridLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
}

export interface ElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface ElementMeta {
  name?: string;
  locked?: boolean;
  hidden?: boolean;
  zIndex?: number;
}

export interface OmTypographyStyle {
  fontFamily?: FontFamily;
  fontSize?: string;
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  lineHeight?: string;
  letterSpacing?: string;
  color?: string;
}

export interface OmBorderStyle {
  width?: string;
  style?: 'solid' | 'dashed' | 'dotted' | 'none';
  color?: string;
  radius?: string;
}

export interface OmBlockStyle {
  column?: OmBlockColumn;
  variant?: 'default' | 'card' | 'emphasis' | 'outlined' | 'ghost';
  gridLayout?: GridLayout;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  typography?: OmTypographyStyle;
  backgroundColor?: string;
  border?: OmBorderStyle;
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  padding?: string;
  margin?: string;
  marginTop?: string;
  paddingTop?: string;
  height?: string;
  width?: string;
  objectFit?: string;
  calloutVariant?: CalloutVariant;
}

export interface OmBlock {
  id: string;
  type: BlockType;
  content: any;
  dataBinding?: OmDataBinding;
  style?: OmBlockStyle;
  position?: ElementPosition;
  meta?: ElementMeta;
}

export interface OmPage {
  id: string;
  title: string;
  layout?: OmPageLayoutConfig;
  blocks: OmBlock[];
}

export interface OmDocumentSettings {
  branding?: {
    logoUrl?: string;
    headerHeight?: number;
    footerHeight?: number;
    companyName?: string;
  };
  defaultOrientation?: OmPageOrientation;
  defaultFontFamily?: FontFamily;
  pageSize?: 'letter' | 'a4' | 'legal';
  margins?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
}

export interface OmProject {
  id: string;
  projectId: string;
  name: string;
  version?: number;
  status?: 'draft' | 'review' | 'published' | 'archived';
  modelingProjectId?: string | null;
  dealId?: string | null;
  pages: OmPage[];
  theme?: OmTheme;
  settings?: OmDocumentSettings;
}

export interface OmDataSeries {
  id: string;
  label: string;
  unit?: 'currency' | 'percent' | 'count' | 'index';
  data: { x: string | number; y: number }[];
}

export interface OmDataTable {
  id: string;
  label: string;
  description?: string;
  columns: { id: string; label: string; align?: 'left' | 'right' | 'center' }[];
  rows: Record<string, any>[];
}

export interface OmDataResponse {
  metrics: Record<string, number | string>;
  series: OmDataSeries[];
  tables: OmDataTable[];
}

export const CALLOUT_COLORS: Record<CalloutVariant, { bg: string; border: string; text: string; icon: string }> = {
  info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: 'text-blue-500' },
  success: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', icon: 'text-green-500' },
  warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', icon: 'text-yellow-500' },
  error: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon: 'text-red-500' },
  tip: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', icon: 'text-purple-500' },
  note: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800', icon: 'text-gray-500' },
};

export const FONT_FAMILIES: Record<FontFamily, string> = {
  sans: 'font-sans',
  serif: 'font-serif',
  mono: 'font-mono',
  display: 'font-serif tracking-tight',
};

export const FONT_SIZES = [
  { value: 'xs', label: 'Extra Small' },
  { value: 'sm', label: 'Small' },
  { value: 'base', label: 'Normal' },
  { value: 'lg', label: 'Large' },
  { value: 'xl', label: 'Extra Large' },
  { value: '2xl', label: '2X Large' },
  { value: '3xl', label: '3X Large' },
];

export const defaultThemes: OmTheme[] = [
  {
    id: 'professional',
    name: 'Professional',
    colors: {
      primary: '#1a365d',
      secondary: '#2c5282',
      accent: '#3182ce',
      background: '#ffffff',
      text: '#1a202c',
    },
    typography: {
      headingFont: 'font-serif',
      bodyFont: 'font-sans',
    },
    spacing: {
      blockGap: '1.5rem',
      pagePadding: '2rem',
    },
  },
  {
    id: 'modern',
    name: 'Modern',
    colors: {
      primary: '#0f172a',
      secondary: '#334155',
      accent: '#6366f1',
      background: '#f8fafc',
      text: '#1e293b',
    },
    typography: {
      headingFont: 'font-sans',
      bodyFont: 'font-sans',
    },
    spacing: {
      blockGap: '1.25rem',
      pagePadding: '2.5rem',
    },
  },
  {
    id: 'marina',
    name: 'Marina Blue',
    colors: {
      primary: '#0c4a6e',
      secondary: '#0369a1',
      accent: '#0ea5e9',
      background: '#ffffff',
      text: '#0f172a',
    },
    typography: {
      headingFont: 'font-serif',
      bodyFont: 'font-sans',
    },
    spacing: {
      blockGap: '1.5rem',
      pagePadding: '2rem',
    },
  },
];
