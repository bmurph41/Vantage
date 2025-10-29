import fs from 'fs/promises';
import path from 'path';
import * as XLSX from 'xlsx';
import type { CddDocument, InsertDocPage } from '@shared/schema';

const pdfParse = require('pdf-parse');

export interface ParsedPage {
  pageNumber: number;
  content: string;
  metadata?: Record<string, any>;
}

export class DocumentParser {
  
  async parseDocument(document: CddDocument): Promise<ParsedPage[]> {
    const fileType = document.mimeType.toLowerCase();
    const filePath = document.storagePath;

    if (!filePath) {
      throw new Error('Document has no storage path');
    }

    if (fileType === 'application/pdf') {
      return this.parsePDF(filePath);
    } else if (
      fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      fileType === 'application/vnd.ms-excel' ||
      fileType === 'text/csv'
    ) {
      return this.parseExcel(filePath);
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }
  }

  private async parsePDF(filePath: string): Promise<ParsedPage[]> {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdfParse(dataBuffer);

      const pages: ParsedPage[] = [];
      
      // Split by form feed character which typically separates pages
      const pageTexts = pdfData.text.split('\f');
      
      for (let i = 0; i < pageTexts.length; i++) {
        const content = pageTexts[i].trim();
        if (content) {
          pages.push({
            pageNumber: i + 1,
            content,
            metadata: {
              totalPages: pdfData.numpages,
              pdfInfo: pdfData.info,
            },
          });
        }
      }

      // If no form feeds found, treat entire document as one page
      if (pages.length === 0 && pdfData.text.trim()) {
        pages.push({
          pageNumber: 1,
          content: pdfData.text.trim(),
          metadata: {
            totalPages: pdfData.numpages,
            pdfInfo: pdfData.info,
          },
        });
      }

      return pages;
    } catch (error) {
      console.error('Error parsing PDF:', error);
      throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async parseExcel(filePath: string): Promise<ParsedPage[]> {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const workbook = XLSX.read(dataBuffer, { type: 'buffer' });

      const pages: ParsedPage[] = [];

      workbook.SheetNames.forEach((sheetName, index) => {
        const sheet = workbook.Sheets[sheetName];
        
        // Convert sheet to CSV format for text extraction
        const csvContent = XLSX.utils.sheet_to_csv(sheet);
        
        // Also get JSON representation for structured data
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        pages.push({
          pageNumber: index + 1,
          content: csvContent,
          metadata: {
            sheetName,
            totalSheets: workbook.SheetNames.length,
            rowCount: jsonData.length,
            range: sheet['!ref'],
          },
        });
      });

      return pages;
    } catch (error) {
      console.error('Error parsing Excel:', error);
      throw new Error(`Failed to parse Excel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  createDocPageRecords(documentId: string, pages: ParsedPage[]): InsertDocPage[] {
    return pages.map(page => ({
      documentId,
      pageNo: page.pageNumber,
      text: page.content,
      tokens: null,
    }));
  }
}

export const documentParser = new DocumentParser();
