import type { OcrProvider, OcrResult, OcrExtractedPage } from './types';
import { documentParser } from '../../document-parser';
import * as XLSX from 'xlsx';
import fs from 'fs/promises';

export class LocalOcrProvider implements OcrProvider {
  name = 'local';

  async extractDocument(filePath: string, mimeType: string): Promise<OcrResult> {
    const pages: OcrExtractedPage[] = [];
    let overallConfidence = 0.5;
    let vendorHint: string | undefined;

    try {
      const fileBuffer = await fs.readFile(filePath);

      if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') {
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

        for (let sheetIndex = 0; sheetIndex < workbook.SheetNames.length; sheetIndex++) {
          const sheetName = workbook.SheetNames[sheetIndex];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

          const lines: string[] = [];
          for (const row of jsonData) {
            const cells = row.map((cell: any) => String(cell ?? '').trim());
            lines.push(cells.join('\t'));
          }

          pages.push({
            pageNumber: sheetIndex + 1,
            content: lines.join('\n'),
            tables: [{
              rows: jsonData.map((row, rowIndex) => ({
                cells: row.map((cell: any, colIndex: number) => ({
                  text: String(cell ?? ''),
                  colIndex,
                  rowIndex,
                  confidence: 1.0,
                })),
              })),
            }],
            confidence: 0.95,
            meta: { sheetName },
          });

          if (sheetName.toLowerCase().includes('quickbook')) {
            vendorHint = 'quickbooks';
          }
        }

        overallConfidence = 0.85;
      } else if (mimeType === 'application/pdf') {
        const parsedPages = await documentParser.parseDocument({
          mimeType,
          storagePath: filePath,
        } as any);

        for (const page of parsedPages) {
          pages.push({
            pageNumber: page.pageNumber,
            content: page.content,
            confidence: 0.7,
          });
        }

        overallConfidence = pages.length > 0 ? 0.65 : 0.3;
      }
    } catch (error) {
      console.error('LocalOcrProvider error:', error);
      throw error;
    }

    return {
      pages,
      vendorHint,
      overallConfidence,
      documentType: 'pnl',
    };
  }
}
