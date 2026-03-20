import type { OcrProvider, OcrResult, OcrExtractedPage, OcrTable } from './types';
import fs from 'fs/promises';
import path from 'path';

interface AffindaField {
  value?: any;
  confidence?: number;
  rawText?: string;
  isVerified?: boolean;
}

interface AffindaTableCell {
  text?: string;
  confidence?: number;
  rowIndex?: number;
  columnIndex?: number;
}

interface AffindaTableRow {
  cells?: AffindaTableCell[];
}

interface AffindaTable {
  rows?: AffindaTableRow[];
}

interface AffindaPage {
  pageIndex?: number;
  text?: string;
  tables?: AffindaTable[];
}

interface AffindaDocumentData {
  // Invoice/receipt fields
  invoiceNumber?: AffindaField;
  invoiceDate?: AffindaField;
  invoicePurchaseOrderNumber?: AffindaField;
  supplierName?: AffindaField;
  supplierAddress?: AffindaField;
  customerName?: AffindaField;
  customerAddress?: AffindaField;
  totalAmount?: AffindaField;
  subTotal?: AffindaField;
  totalTax?: AffindaField;
  currency?: AffindaField;
  paymentAmountDue?: AffindaField;
  paymentAmountPaid?: AffindaField;
  dueDate?: AffindaField;
  // Table/line items
  tables?: AffindaTable[];
  lineItems?: Array<{
    description?: AffindaField;
    quantity?: AffindaField;
    unitPrice?: AffindaField;
    amount?: AffindaField;
    itemDate?: AffindaField;
  }>;
  // Raw text
  rawText?: string;
}

interface AffindaResponse {
  meta?: {
    identifier?: string;
    documentType?: string;
    confidence?: number;
    isVerified?: boolean;
    pages?: AffindaPage[];
  };
  data?: AffindaDocumentData;
  error?: {
    errorCode?: string;
    errorDetail?: string;
  };
}

export class AffindaOcrProvider implements OcrProvider {
  name = 'affinda';
  private apiKey: string;
  private endpoint: string;

  constructor(config: { apiKey: string; endpoint?: string }) {
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint ?? 'https://api.affinda.com/v3';
  }

  async extractDocument(filePath: string, mimeType: string): Promise<OcrResult> {
    console.log(`[AffindaOcrProvider] Extracting document: ${path.basename(filePath)}`);

    if (!this.apiKey) {
      console.warn('[AffindaOcrProvider] API key not configured, returning empty result');
      return this.fallbackResult('API key not configured');
    }

    try {
      const fileBuffer = await fs.readFile(filePath);
      const fileName = path.basename(filePath);

      // Build multipart form data
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: mimeType });
      formData.append('file', blob, fileName);

      // Set wait=true so Affinda processes synchronously
      formData.append('wait', 'true');

      const url = `${this.endpoint}/documents`;

      console.log(`[AffindaOcrProvider] Sending request to ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'unknown');
        console.error(`[AffindaOcrProvider] API error: ${response.status} ${response.statusText}`, errorBody);
        return this.fallbackResult(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as AffindaResponse;

      if (data.error) {
        console.error(`[AffindaOcrProvider] API returned error:`, data.error);
        return this.fallbackResult(data.error.errorDetail ?? data.error.errorCode ?? 'Unknown API error');
      }

      console.log(`[AffindaOcrProvider] Received response, document ID: ${data.meta?.identifier}`);

      return this.mapResponse(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[AffindaOcrProvider] Extraction failed:`, message);
      return this.fallbackResult(message);
    }
  }

  /**
   * Map the Affinda API response to the common OcrResult interface.
   */
  private mapResponse(data: AffindaResponse): OcrResult {
    const pages: OcrExtractedPage[] = [];
    const docData = data.data;
    const metaInfo = data.meta;

    // If Affinda returned per-page text, use that
    if (metaInfo?.pages && metaInfo.pages.length > 0) {
      for (const page of metaInfo.pages) {
        const pageIndex = (page.pageIndex ?? 0) + 1;
        const tables = this.mapTables(page.tables);

        pages.push({
          pageNumber: pageIndex,
          content: page.text ?? '',
          tables: tables.length > 0 ? tables : undefined,
          confidence: metaInfo.confidence != null ? metaInfo.confidence : 0.85,
        });
      }
    }

    // If no per-page text, build a single page from structured data
    if (pages.length === 0) {
      const contentLines: string[] = [];

      if (docData?.supplierName?.value) {
        contentLines.push(`Vendor: ${docData.supplierName.value}`);
      }
      if (docData?.supplierAddress?.value) {
        contentLines.push(`Vendor Address: ${docData.supplierAddress.value}`);
      }
      if (docData?.customerName?.value) {
        contentLines.push(`Customer: ${docData.customerName.value}`);
      }
      if (docData?.customerAddress?.value) {
        contentLines.push(`Customer Address: ${docData.customerAddress.value}`);
      }
      if (docData?.invoiceNumber?.value) {
        contentLines.push(`Invoice Number: ${docData.invoiceNumber.value}`);
      }
      if (docData?.invoiceDate?.value) {
        contentLines.push(`Date: ${docData.invoiceDate.value}`);
      }
      if (docData?.dueDate?.value) {
        contentLines.push(`Due Date: ${docData.dueDate.value}`);
      }
      if (docData?.currency?.value) {
        contentLines.push(`Currency: ${docData.currency.value}`);
      }

      // Line items
      if (docData?.lineItems && docData.lineItems.length > 0) {
        contentLines.push('');
        contentLines.push('--- Line Items ---');
        for (const item of docData.lineItems) {
          const desc = item.description?.value ?? '';
          const qty = item.quantity?.value != null ? String(item.quantity.value) : '';
          const unitPrice = item.unitPrice?.value != null ? String(item.unitPrice.value) : '';
          const amount = item.amount?.value != null ? String(item.amount.value) : '';
          contentLines.push(
            `  ${desc}${qty ? ` | Qty: ${qty}` : ''}${unitPrice ? ` | Unit: ${unitPrice}` : ''}${amount ? ` | Amount: ${amount}` : ''}`
          );
        }
      }

      // Totals
      contentLines.push('');
      if (docData?.subTotal?.value != null) {
        contentLines.push(`Subtotal: ${docData.subTotal.value}`);
      }
      if (docData?.totalTax?.value != null) {
        contentLines.push(`Tax: ${docData.totalTax.value}`);
      }
      if (docData?.totalAmount?.value != null) {
        contentLines.push(`Total: ${docData.totalAmount.value}`);
      }

      // Raw text fallback
      if (docData?.rawText) {
        contentLines.push('');
        contentLines.push('--- Raw Text ---');
        contentLines.push(docData.rawText);
      }

      // Build tables from line items
      const tables: OcrTable[] = [];
      if (docData?.lineItems && docData.lineItems.length > 0) {
        tables.push({
          rows: docData.lineItems.map((item, rowIndex) => ({
            cells: [
              { text: String(item.description?.value ?? ''), colIndex: 0, rowIndex, confidence: item.description?.confidence ?? 0.85 },
              { text: String(item.quantity?.value ?? ''), colIndex: 1, rowIndex, confidence: item.quantity?.confidence ?? 0.85 },
              { text: String(item.unitPrice?.value ?? ''), colIndex: 2, rowIndex, confidence: item.unitPrice?.confidence ?? 0.85 },
              { text: String(item.amount?.value ?? ''), colIndex: 3, rowIndex, confidence: item.amount?.confidence ?? 0.85 },
            ],
          })),
          confidence: 0.85,
        });
      }

      // Also add any document-level tables
      if (docData?.tables) {
        tables.push(...this.mapTables(docData.tables));
      }

      const confidence = metaInfo?.confidence ?? 0.85;
      pages.push({
        pageNumber: 1,
        content: contentLines.join('\n'),
        tables: tables.length > 0 ? tables : undefined,
        confidence,
        meta: {
          supplierName: docData?.supplierName?.value,
          invoiceNumber: docData?.invoiceNumber?.value,
          total: docData?.totalAmount?.value,
          currency: docData?.currency?.value,
        },
      });
    }

    const overallConfidence = metaInfo?.confidence ?? 0.85;
    const documentType = this.mapDocumentType(metaInfo?.documentType);

    return {
      pages,
      overallConfidence,
      vendorHint: docData?.supplierName?.value?.toLowerCase(),
      documentType,
      meta: {
        provider: 'affinda',
        affindaDocumentId: metaInfo?.identifier,
        affindaDocumentType: metaInfo?.documentType,
        currency: docData?.currency?.value,
        total: docData?.totalAmount?.value,
        tax: docData?.totalTax?.value,
        vendor: docData?.supplierName?.value,
        date: docData?.invoiceDate?.value,
        invoiceNumber: docData?.invoiceNumber?.value,
      },
    };
  }

  /**
   * Convert Affinda table structures to the common OcrTable format.
   */
  private mapTables(tables?: AffindaTable[]): OcrTable[] {
    if (!tables || tables.length === 0) return [];

    return tables.map(table => ({
      rows: (table.rows ?? []).map((row, rowIndex) => ({
        cells: (row.cells ?? []).map((cell, colIndex) => ({
          text: cell.text ?? '',
          colIndex: cell.columnIndex ?? colIndex,
          rowIndex: cell.rowIndex ?? rowIndex,
          confidence: cell.confidence ?? 0.8,
        })),
      })),
      confidence: 0.85,
    }));
  }

  /**
   * Map Affinda document types to app-internal document types.
   */
  private mapDocumentType(docType?: string): string {
    const type = (docType ?? '').toLowerCase();
    if (type.includes('invoice')) return 'invoice';
    if (type.includes('receipt')) return 'receipt';
    if (type.includes('statement')) return 'statement';
    if (type.includes('credit') && type.includes('note')) return 'credit_note';
    if (type.includes('purchase') && type.includes('order')) return 'purchase_order';
    if (type.includes('resume') || type.includes('cv')) return 'resume';
    return 'pnl';
  }

  /**
   * Return a low-confidence fallback result when the API call fails.
   */
  private fallbackResult(reason: string): OcrResult {
    return {
      pages: [{
        pageNumber: 1,
        content: '',
        confidence: 0,
      }],
      overallConfidence: 0,
      documentType: 'pnl',
      meta: {
        provider: 'affinda',
        error: true,
        reason,
      },
    };
  }
}
