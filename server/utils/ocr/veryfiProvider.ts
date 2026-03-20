import type { OcrProvider, OcrResult, OcrExtractedPage, OcrTable } from './types';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

interface VeryfiLineItem {
  description?: string;
  quantity?: number;
  unit_price?: number;
  total?: number;
  date?: string;
  category?: string;
  sku?: string;
}

interface VeryfiResponse {
  id: number;
  vendor?: { name?: string; address?: string };
  total?: number;
  subtotal?: number;
  tax?: number;
  date?: string;
  due_date?: string;
  invoice_number?: string;
  currency_code?: string;
  category?: string;
  document_type?: string;
  line_items?: VeryfiLineItem[];
  ocr_text?: string;
  img_file_name?: string;
  confidence?: number;
  // Additional fields Veryfi may return
  account_number?: string;
  cashback?: number;
  discount?: number;
  tip?: number;
  payment?: { type?: string; card_number?: string };
  ship_to?: { name?: string; address?: string };
  bill_to?: { name?: string; address?: string };
}

export class VeryfiOcrProvider implements OcrProvider {
  name = 'veryfi';
  private apiKey: string;
  private clientId: string;
  private username: string;
  private apiUrl = 'https://api.veryfi.com/api/v8/partner/documents/';

  constructor(config: { apiKey: string; clientId?: string; username?: string }) {
    this.apiKey = config.apiKey;
    this.clientId = config.clientId ?? '';
    this.username = config.username ?? '';
  }

  /**
   * Generate HMAC-SHA256 signature for Veryfi request authentication.
   */
  private generateSignature(timestamp: number, payload: string): string {
    const signatureData = `timestamp:${timestamp},payload:${payload}`;
    return crypto
      .createHmac('sha256', this.apiKey)
      .update(signatureData)
      .digest('base64');
  }

  async extractDocument(filePath: string, mimeType: string): Promise<OcrResult> {
    console.log(`[VeryfiOcrProvider] Extracting document: ${path.basename(filePath)}`);

    if (!this.apiKey) {
      console.warn('[VeryfiOcrProvider] API key not configured, returning empty result');
      return this.fallbackResult('API key not configured');
    }

    try {
      // Read file and encode as base64
      const fileBuffer = await fs.readFile(filePath);
      const base64Data = fileBuffer.toString('base64');
      const fileName = path.basename(filePath);

      const payload = JSON.stringify({
        file_name: fileName,
        file_data: base64Data,
        categories: ['Financial', 'Invoice', 'Receipt', 'Statement'],
        auto_delete: true,
      });

      const timestamp = Date.now();
      const signature = this.generateSignature(timestamp, payload);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'CLIENT-ID': this.clientId,
        'AUTHORIZATION': `apikey ${this.username}:${this.apiKey}`,
        'X-Veryfi-Request-Timestamp': String(timestamp),
        'X-Veryfi-Request-Signature': signature,
      };

      console.log(`[VeryfiOcrProvider] Sending request to Veryfi API...`);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
        body: payload,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'unknown');
        console.error(`[VeryfiOcrProvider] API error: ${response.status} ${response.statusText}`, errorBody);
        return this.fallbackResult(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as VeryfiResponse;
      console.log(`[VeryfiOcrProvider] Received response, document ID: ${data.id}`);

      return this.mapResponse(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[VeryfiOcrProvider] Extraction failed:`, message);
      return this.fallbackResult(message);
    }
  }

  /**
   * Map the Veryfi API response to the common OcrResult interface.
   */
  private mapResponse(data: VeryfiResponse): OcrResult {
    const pages: OcrExtractedPage[] = [];

    // Build text content from structured data
    const contentLines: string[] = [];

    if (data.vendor?.name) {
      contentLines.push(`Vendor: ${data.vendor.name}`);
    }
    if (data.vendor?.address) {
      contentLines.push(`Vendor Address: ${data.vendor.address}`);
    }
    if (data.invoice_number) {
      contentLines.push(`Invoice Number: ${data.invoice_number}`);
    }
    if (data.date) {
      contentLines.push(`Date: ${data.date}`);
    }
    if (data.due_date) {
      contentLines.push(`Due Date: ${data.due_date}`);
    }
    if (data.currency_code) {
      contentLines.push(`Currency: ${data.currency_code}`);
    }
    if (data.bill_to?.name) {
      contentLines.push(`Bill To: ${data.bill_to.name}`);
    }
    if (data.ship_to?.name) {
      contentLines.push(`Ship To: ${data.ship_to.name}`);
    }

    // Add line items as a table and text
    const tables: OcrTable[] = [];
    if (data.line_items && data.line_items.length > 0) {
      contentLines.push('');
      contentLines.push('--- Line Items ---');

      const tableRows = data.line_items.map((item, rowIndex) => {
        const description = item.description ?? '';
        const qty = item.quantity != null ? String(item.quantity) : '';
        const unitPrice = item.unit_price != null ? item.unit_price.toFixed(2) : '';
        const total = item.total != null ? item.total.toFixed(2) : '';

        contentLines.push(
          `  ${description}${qty ? ` | Qty: ${qty}` : ''}${unitPrice ? ` | Unit: ${unitPrice}` : ''}${total ? ` | Total: ${total}` : ''}`
        );

        return {
          cells: [
            { text: description, colIndex: 0, rowIndex, confidence: 0.95 },
            { text: qty, colIndex: 1, rowIndex, confidence: 0.95 },
            { text: unitPrice, colIndex: 2, rowIndex, confidence: 0.95 },
            { text: total, colIndex: 3, rowIndex, confidence: 0.95 },
          ],
        };
      });

      tables.push({ rows: tableRows, confidence: 0.9 });
    }

    // Add totals
    contentLines.push('');
    if (data.subtotal != null) {
      contentLines.push(`Subtotal: ${data.subtotal.toFixed(2)}`);
    }
    if (data.tax != null) {
      contentLines.push(`Tax: ${data.tax.toFixed(2)}`);
    }
    if (data.discount != null && data.discount !== 0) {
      contentLines.push(`Discount: ${data.discount.toFixed(2)}`);
    }
    if (data.tip != null && data.tip !== 0) {
      contentLines.push(`Tip: ${data.tip.toFixed(2)}`);
    }
    if (data.total != null) {
      contentLines.push(`Total: ${data.total.toFixed(2)}`);
    }

    // If Veryfi returned raw OCR text, append it
    if (data.ocr_text) {
      contentLines.push('');
      contentLines.push('--- Raw OCR Text ---');
      contentLines.push(data.ocr_text);
    }

    const confidence = data.confidence != null ? data.confidence / 100 : 0.85;

    pages.push({
      pageNumber: 1,
      content: contentLines.join('\n'),
      tables: tables.length > 0 ? tables : undefined,
      confidence,
      meta: {
        vendorName: data.vendor?.name,
        invoiceNumber: data.invoice_number,
        total: data.total,
        currency: data.currency_code,
        documentId: data.id,
      },
    });

    // Determine document type from Veryfi's classification
    const documentType = this.mapDocumentType(data.document_type, data.category);

    return {
      pages,
      overallConfidence: confidence,
      vendorHint: data.vendor?.name?.toLowerCase(),
      documentType,
      meta: {
        provider: 'veryfi',
        veryfiDocumentId: data.id,
        veryfiDocumentType: data.document_type,
        currency: data.currency_code,
        total: data.total,
        tax: data.tax,
        vendor: data.vendor?.name,
        date: data.date,
        invoiceNumber: data.invoice_number,
      },
    };
  }

  /**
   * Map Veryfi document/category types to app-internal document types.
   */
  private mapDocumentType(docType?: string, category?: string): string {
    const type = (docType ?? category ?? '').toLowerCase();
    if (type.includes('invoice')) return 'invoice';
    if (type.includes('receipt')) return 'receipt';
    if (type.includes('statement')) return 'statement';
    if (type.includes('credit') && type.includes('note')) return 'credit_note';
    if (type.includes('purchase') && type.includes('order')) return 'purchase_order';
    // Default to P&L for financial documents in this app's context
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
        provider: 'veryfi',
        error: true,
        reason,
      },
    };
  }
}
