// ============================================================================
// OM Builder - Canonical TypeScript Types
// Canva/VistaPrint-grade document editor types
// ============================================================================

// Document format options
export type OmDocumentFormat = 
  | "letter-portrait" 
  | "letter-landscape" 
  | "a4-portrait" 
  | "a4-landscape";

// Bleed and safety margin configuration (in points)
export interface OmMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// Document metadata
export interface OmDocumentMeta {
  title: string;
  projectId: number;
  format: OmDocumentFormat;
  bleed: OmMargins;
  safetyMargin: OmMargins;
  brandKitId?: number | null;
}

// Page definition
export interface OmPageDef {
  id: string;
  index: number;
  name?: string;
  backgroundColor?: string;
  backgroundImageAssetId?: number;
  blocks: string[]; // ordered block IDs (z-order, top-first)
}

// Bindings context
export interface OmBindingsContext {
  projectId: number;
  keysUsed: string[];
}

// Complete working snapshot (stored in workingSnapshotJson)
export interface OmWorkingSnapshot {
  schemaVersion: number; // for migration support
  meta: OmDocumentMeta;
  pages: OmPageDef[];
  blocks: Record<string, OmBlock>;
  bindings: OmBindingsContext;
}

// ============================================================================
// Block Types
// ============================================================================

// Block positioning
export interface BlockPosition {
  x: number; // px on design canvas at 1x scale
  y: number;
}

// Block size
export interface BlockSize {
  width: number;
  height: number;
}

// Shadow presets
export type ShadowPreset = "none" | "soft" | "strong";

// List style options
export type ListStyle = "bullet" | "numbered";

// Text alignment
export type TextAlign = "left" | "center" | "right" | "justify";

// Image fit modes
export type ImageFit = "cover" | "contain" | "fill";

// Chart types
export type ChartType = "bar" | "line" | "donut" | "area" | "pie";

// KPI value format
export type KpiFormat = "currency" | "percent" | "number" | "multi";

// Block style (shared properties)
export interface BlockStyle {
  // Shared
  opacity?: number;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  boxShadow?: ShadowPreset;
  padding?: number;

  // Text-specific
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | "normal" | "bold";
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: TextAlign;
  color?: string;
  textDecoration?: "none" | "underline" | "line-through";

  // List-specific
  listStyle?: ListStyle;
}

// Data binding for dynamic content
export interface BlockBinding {
  keys: string[]; // binding keys this block depends on
  resolvedAt?: string; // ISO timestamp of last resolution
}

// Block type union
export type BlockType =
  | "text"
  | "heading"
  | "image"
  | "shape"
  | "icon"
  | "table"
  | "chart"
  | "kpi"
  | "list"
  | "section"
  | "group"
  | "metricStrip"
  | "imageGrid"
  | "mapPage"
  | "sectionDivider"
  | "teamGrid"
  | "disclaimer"
  | "portfolioTable";

// Base block properties (shared by all block types)
export interface BaseBlock {
  id: string;
  type: BlockType;
  pageId: string;
  position: BlockPosition;
  size: BlockSize;
  rotation: number; // degrees
  zIndex: number;
  parentId?: string | null; // for grouping
  locked?: boolean;
  visible?: boolean;
  name?: string; // layer name
  styles: BlockStyle;
  dataBinding?: BlockBinding | null;
}

// Text block
export interface OmTextBlock extends BaseBlock {
  type: "text" | "heading";
  content: string; // plain text or simple markdown
  headingLevel?: 1 | 2 | 3 | 4; // for heading type
}

// Image block
export interface OmImageBlock extends BaseBlock {
  type: "image";
  assetId: number; // reference to omAssets
  assetUrl?: string; // cached URL for rendering
  fit: ImageFit;
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  alt?: string;
}

// Shape block
export interface OmShapeBlock extends BaseBlock {
  type: "shape";
  shapeType: "rect" | "circle" | "ellipse" | "line" | "triangle";
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

// Icon block
export interface OmIconBlock extends BaseBlock {
  type: "icon";
  iconName: string; // lucide-react icon name
  iconColor?: string;
  iconSize?: number;
}

// Table cell
export interface TableCell {
  content: string;
  colspan?: number;
  rowspan?: number;
  align?: TextAlign;
  bold?: boolean;
}

// Table block
export interface OmTableBlock extends BaseBlock {
  type: "table";
  rows: TableCell[][];
  headerRows?: number;
  columnWidths?: number[];
  showBorders?: boolean;
  alternateRowColors?: boolean;
}

// Chart configuration
export interface ChartConfig {
  bindingKeys?: string[]; // keys to resolve from bindings
  staticData?: { label: string; value: number }[]; // for static charts
  xField?: string;
  yField?: string;
  legend?: boolean;
  colors?: string[];
  showLabels?: boolean;
  showGrid?: boolean;
}

// Chart block
export interface OmChartBlock extends BaseBlock {
  type: "chart";
  chartType: ChartType;
  config: ChartConfig;
  title?: string;
}

// KPI configuration
export interface KpiConfig {
  labelKey?: string; // static label or binding key
  label?: string; // static label
  valueKey: string; // binding key for main value
  deltaKey?: string; // optional delta binding
  trendKey?: string; // optional for trend arrow
  format: KpiFormat;
  prefix?: string;
  suffix?: string;
}

// KPI block
export interface OmKpiBlock extends BaseBlock {
  type: "kpi";
  config: KpiConfig;
  staticValue?: string; // for preview/fallback
}

// List block
export interface OmListBlock extends BaseBlock {
  type: "list";
  items: string[];
  listStyle: ListStyle;
}

// Section/container block
export interface OmSectionBlock extends BaseBlock {
  type: "section";
  layout: "single" | "two-column" | "three-column" | "callout";
  childBlockIds: string[]; // blocks contained within
}

// Group block (for grouping elements)
export interface OmGroupBlock extends BaseBlock {
  type: "group";
  childBlockIds: string[];
}

// Union type for all blocks
export type OmBlock =
  | OmTextBlock
  | OmImageBlock
  | OmShapeBlock
  | OmIconBlock
  | OmTableBlock
  | OmChartBlock
  | OmKpiBlock
  | OmListBlock
  | OmSectionBlock
  | OmGroupBlock;

// ============================================================================
// Bindings Catalog Types
// ============================================================================

export type BindingValueType = "string" | "number" | "currency" | "percent" | "date" | "array";

export interface BindingDescriptor {
  key: string;
  label: string;
  type: BindingValueType;
  category: "Project" | "Financials" | "Comps" | "RentRoll" | "Demographics" | "Custom";
  description?: string;
}

// ============================================================================
// Brand Kit Types
// ============================================================================

export interface BrandKitFonts {
  heading: string;
  body: string;
  alt?: string;
}

export interface BrandKitData {
  primaryColors: string[];
  secondaryColors: string[];
  accentColors: string[];
  fontFamilies: BrandKitFonts;
  guidelines?: string;
}

// Brand scan result from auto-import
export interface BrandScanResult {
  colors: string[];
  logoUrl: string | null;
  secondaryImages: string[];
  fonts: string[];
  rawData?: Record<string, unknown>;
}

// ============================================================================
// Template Types
// ============================================================================

export type TemplateCategory = "om" | "ic_memo" | "teaser" | "one_pager";

export interface TemplateMetadata {
  name: string;
  category: TemplateCategory;
  description?: string;
  thumbnail?: string;
  tags?: string[];
}

// Page template (for adding individual pages)
export interface PageTemplate {
  id: string;
  name: string;
  category: string;
  thumbnail?: string;
  page: OmPageDef;
  blocks: Record<string, OmBlock>;
}

// ============================================================================
// Export Types
// ============================================================================

export interface PdfExportOptions {
  versionId?: number;
  includeBleed?: boolean;
  quality?: "draft" | "print";
  pageRange?: { start: number; end: number };
}

export interface ThumbnailOptions {
  versionId?: number;
  pageIndex?: number;
  width?: number;
  height?: number;
}

// ============================================================================
// Editor State Types (for frontend store)
// ============================================================================

export interface EditorHistory {
  past: OmWorkingSnapshot[];
  future: OmWorkingSnapshot[];
}

export interface SelectionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AlignmentGuide {
  type: "horizontal" | "vertical";
  position: number;
  source: "edge" | "center";
}

// ============================================================================
// Canvas Configuration
// ============================================================================

// Page dimensions at 96 DPI
export const PAGE_DIMENSIONS: Record<OmDocumentFormat, { width: number; height: number }> = {
  "letter-portrait": { width: 816, height: 1056 },   // 8.5" x 11"
  "letter-landscape": { width: 1056, height: 816 },
  "a4-portrait": { width: 794, height: 1123 },       // 210mm x 297mm
  "a4-landscape": { width: 1123, height: 794 },
};

// Default margins
export const DEFAULT_BLEED: OmMargins = { top: 9, right: 9, bottom: 9, left: 9 }; // ~0.125"
export const DEFAULT_SAFETY: OmMargins = { top: 36, right: 36, bottom: 36, left: 36 }; // 0.5"

// Grid snap size
export const GRID_SNAP_SIZE = 8;

// Alignment snap threshold
export const ALIGNMENT_SNAP_THRESHOLD = 4;

// ============================================================================
// Helper Functions
// ============================================================================

export function createEmptySnapshot(projectId: number, title: string): OmWorkingSnapshot {
  const firstPageId = crypto.randomUUID ? crypto.randomUUID() : `page-${Date.now()}`;
  
  return {
    schemaVersion: 1,
    meta: {
      title,
      projectId,
      format: "letter-portrait",
      bleed: DEFAULT_BLEED,
      safetyMargin: DEFAULT_SAFETY,
      brandKitId: null,
    },
    pages: [
      {
        id: firstPageId,
        index: 0,
        name: "Cover",
        blocks: [],
      },
    ],
    blocks: {},
    bindings: {
      projectId,
      keysUsed: [],
    },
  };
}

export function createBlock(
  type: BlockType,
  pageId: string,
  position: BlockPosition,
  size: BlockSize,
  additionalProps: Partial<OmBlock> = {}
): OmBlock {
  const baseBlock: BaseBlock = {
    id: crypto.randomUUID ? crypto.randomUUID() : `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    pageId,
    position,
    size,
    rotation: 0,
    zIndex: 0,
    locked: false,
    visible: true,
    styles: {},
    ...additionalProps,
  };

  return baseBlock as OmBlock;
}
