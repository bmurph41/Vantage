export type BlockType = 
  | 'text' | 'heading' | 'callout'
  | 'chart' | 'line-chart' | 'pie-chart' | 'area-chart' | 'trend-chart' | 'combo-chart'
  | 'kpi' | 'gauge' | 'target-kpi' | 'currency-kpi' | 'percent-kpi' | 'number-kpi'
  | 'table' | 'matrix' | 'list'
  | 'image' | 'gallery' | 'map';

export type OmPageLayoutType = 'single-column' | 'two-column' | 'cover' | 'hero-with-body' | 'freeform';

export interface OmPageLayoutConfig {
  layoutType: OmPageLayoutType;
  showHeader?: boolean;
  showFooter?: boolean;
  showPageNumber?: boolean;
  showTocEntry?: boolean;
  heroImageUrl?: string;
  heroOverlay?: boolean;
  columns?: {
    leftWidthPercent?: number;
    rightWidthPercent?: number;
  };
}

export interface OmTheme {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
  };
  spacing: {
    blockGap: string;
    pagePadding: string;
  };
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

export interface OmBlockStyle extends React.CSSProperties {
  column?: OmBlockColumn;
  variant?: 'default' | 'card' | 'emphasis';
  gridLayout?: GridLayout;
}

export interface OmBlock {
  id: string;
  type: BlockType;
  content: any;
  dataBinding?: OmDataBinding;
  style?: OmBlockStyle;
}

export interface OmPage {
  id: string;
  title: string;
  layout?: OmPageLayoutConfig;
  blocks: OmBlock[];
}

export interface OmProject {
  id: string;
  name: string;
  version?: number;
  status?: 'Draft' | 'Review' | 'Published' | 'Archived';
  pages: OmPage[];
  theme?: OmTheme;
  settings?: {
      branding?: {
          logoUrl?: string;
          headerHeight?: number;
          footerHeight?: number;
      }
  }
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
