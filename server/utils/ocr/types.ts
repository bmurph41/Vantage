export interface OcrConfig {
  provider: 'local' | 'veryfi' | 'affinda';
  apiKey?: string;
  endpoint?: string;
}

export interface OcrExtractedPage {
  pageNumber: number;
  content: string;
  tables?: OcrTable[];
  confidence?: number;
  meta?: Record<string, any>;
}

export interface OcrTable {
  rows: OcrTableRow[];
  boundingBox?: { x: number; y: number; width: number; height: number };
  confidence?: number;
}

export interface OcrTableRow {
  cells: OcrTableCell[];
}

export interface OcrTableCell {
  text: string;
  colIndex: number;
  rowIndex: number;
  confidence?: number;
}

export interface OcrResult {
  pages: OcrExtractedPage[];
  documentType?: string;
  vendorHint?: string;
  overallConfidence: number;
  meta?: Record<string, any>;
}

export interface OcrProvider {
  name: string;
  extractDocument(filePath: string, mimeType: string): Promise<OcrResult>;
}
