import type { OcrProvider, OcrResult, OcrExtractedPage } from './types';
import { documentParser } from '../../document-parser';
import { analyzeTextQuality, isTextGarbled, sanitizeExtractedText } from '../text-quality';
import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';
import { createWorker } from 'tesseract.js';

const QUALITY_THRESHOLD = 0.45;
const MIN_GARBLED_TEXT_LENGTH = 30;

export class LocalOcrProvider implements OcrProvider {
  name = 'local';

  async extractDocument(filePath: string, mimeType: string): Promise<OcrResult> {
    const pages: OcrExtractedPage[] = [];
    let overallConfidence = 0.5;
    let vendorHint: string | undefined;
    let usedOcrFallback = false;

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
        let pdfTextPages = await this.extractPdfText(filePath);
        
        const combinedText = pdfTextPages.map(p => p.content).join(' ');
        const qualityResult = analyzeTextQuality(combinedText);
        
        console.log(`[LocalOcrProvider] PDF text quality check:`, {
          file: path.basename(filePath),
          confidence: qualityResult.confidence.toFixed(2),
          isGarbled: qualityResult.isGarbled,
          printableRatio: qualityResult.printableRatio.toFixed(2),
          issues: qualityResult.issues,
        });

        if (combinedText.length > MIN_GARBLED_TEXT_LENGTH && 
            (qualityResult.isGarbled || qualityResult.confidence < QUALITY_THRESHOLD)) {
          console.log(`[LocalOcrProvider] Text extraction failed quality check, falling back to OCR...`);
          
          try {
            pdfTextPages = await this.extractPdfWithOcr(filePath);
            usedOcrFallback = true;
            
            const ocrCombinedText = pdfTextPages.map(p => p.content).join(' ');
            const ocrQuality = analyzeTextQuality(ocrCombinedText);
            console.log(`[LocalOcrProvider] OCR extraction quality:`, {
              confidence: ocrQuality.confidence.toFixed(2),
              isGarbled: ocrQuality.isGarbled,
            });
            
            overallConfidence = ocrQuality.confidence * 0.8;
          } catch (ocrError) {
            console.error('[LocalOcrProvider] OCR fallback failed:', ocrError);
            overallConfidence = qualityResult.confidence * 0.5;
          }
        } else {
          overallConfidence = qualityResult.confidence;
        }

        for (const page of pdfTextPages) {
          const sanitizedContent = sanitizeExtractedText(page.content);
          pages.push({
            pageNumber: page.pageNumber,
            content: sanitizedContent,
            confidence: page.confidence || (usedOcrFallback ? 0.7 : 0.65),
            meta: { 
              usedOcr: usedOcrFallback,
              originalQuality: qualityResult.confidence,
            },
          });
        }
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
      meta: { usedOcrFallback },
    };
  }

  private async extractPdfText(filePath: string): Promise<Array<{ pageNumber: number; content: string; confidence?: number }>> {
    const parsedPages = await documentParser.parseDocument({
      mimeType: 'application/pdf',
      storagePath: filePath,
    } as any);

    return parsedPages.map(page => ({
      pageNumber: page.pageNumber,
      content: page.content,
      confidence: 0.7,
    }));
  }

  private async extractPdfWithOcr(filePath: string): Promise<Array<{ pageNumber: number; content: string; confidence?: number }>> {
    console.log(`[LocalOcrProvider] Starting OCR extraction for: ${path.basename(filePath)}`);
    
    const pages: Array<{ pageNumber: number; content: string; confidence?: number }> = [];
    
    try {
      const { PDFDocument } = await import('pdf-lib');
      const pdfBuffer = await fs.readFile(filePath);
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pageCount = pdfDoc.getPageCount();
      
      console.log(`[LocalOcrProvider] PDF has ${pageCount} pages, using Tesseract OCR...`);
      
      const worker = await createWorker('eng');
      
      try {
        for (let i = 0; i < Math.min(pageCount, 20); i++) {
          console.log(`[LocalOcrProvider] Processing page ${i + 1}/${pageCount} with OCR...`);
          
          const singlePageDoc = await PDFDocument.create();
          const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
          singlePageDoc.addPage(copiedPage);
          const singlePageBuffer = await singlePageDoc.save();
          
          const tempPdfPath = `/tmp/ocr_page_${Date.now()}_${i}.pdf`;
          await fs.writeFile(tempPdfPath, singlePageBuffer);
          
          try {
            const result = await worker.recognize(tempPdfPath);
            const text = result.data.text;
            const confidence = result.data.confidence / 100;
            
            pages.push({
              pageNumber: i + 1,
              content: text,
              confidence,
            });
            
            console.log(`[LocalOcrProvider] Page ${i + 1} OCR complete, confidence: ${(confidence * 100).toFixed(1)}%`);
          } finally {
            try {
              await fs.unlink(tempPdfPath);
            } catch {}
          }
        }
      } finally {
        await worker.terminate();
      }
      
    } catch (error) {
      console.error('[LocalOcrProvider] OCR extraction error:', error);
      
      const originalPages = await this.extractPdfText(filePath);
      return originalPages.map(p => ({
        ...p,
        content: sanitizeExtractedText(p.content),
        confidence: 0.3,
      }));
    }
    
    return pages;
  }
}
