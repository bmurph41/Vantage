import { createRequire } from 'module';
import { createWorker } from 'tesseract.js';
import { createCanvas } from 'canvas';

const require = createRequire(import.meta.url);

export interface OcrPdfResult {
  text: string;
  pageCount: number;
  method: 'direct' | 'ocr' | 'hybrid';
  confidence: number;
}

async function extractTextDirect(buffer: Buffer): Promise<{ text: string; pageCount: number } | null> {
  try {
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    
    const text = result.text || '';
    const pageCount = result.total || 1;
    
    if (text.trim().length > 50) {
      return { text, pageCount };
    }
    return null;
  } catch (error) {
    console.log('[OCR PDF] Direct extraction failed, will try OCR:', (error as Error).message);
    return null;
  }
}

async function convertPdfToImages(buffer: Buffer): Promise<Buffer[]> {
  const images: Buffer[] = [];
  
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    
    const data = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    
    console.log(`[OCR PDF] PDF has ${pdf.numPages} pages, converting to images...`);
    
    for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 10); pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });
      
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');
      
      await page.render({
        canvasContext: context as any,
        viewport: viewport
      }).promise;
      
      const imageBuffer = canvas.toBuffer('image/png');
      images.push(imageBuffer);
      
      console.log(`[OCR PDF] Converted page ${pageNum}/${pdf.numPages} to image`);
    }
  } catch (error) {
    console.error('[OCR PDF] PDF to image conversion failed:', error);
  }
  
  return images;
}

async function extractWithOcr(buffer: Buffer): Promise<{ text: string; confidence: number }> {
  try {
    console.log('[OCR PDF] Starting Tesseract OCR extraction...');
    
    const images = await convertPdfToImages(buffer);
    
    if (images.length === 0) {
      console.log('[OCR PDF] No images extracted, trying direct OCR on buffer...');
      const worker = await createWorker('eng');
      const result = await worker.recognize(buffer);
      await worker.terminate();
      return { text: result.data.text || '', confidence: result.data.confidence || 0 };
    }
    
    const worker = await createWorker('eng');
    let allText = '';
    let totalConfidence = 0;
    
    for (let i = 0; i < images.length; i++) {
      console.log(`[OCR PDF] OCR processing page ${i + 1}/${images.length}...`);
      const result = await worker.recognize(images[i]);
      allText += result.data.text + '\n\n';
      totalConfidence += result.data.confidence || 0;
    }
    
    await worker.terminate();
    
    const avgConfidence = images.length > 0 ? totalConfidence / images.length : 0;
    console.log(`[OCR PDF] OCR complete. Avg confidence: ${avgConfidence.toFixed(1)}%, Text length: ${allText.length}`);
    
    return { text: allText.trim(), confidence: avgConfidence };
  } catch (error) {
    console.error('[OCR PDF] OCR extraction failed:', error);
    return { text: '', confidence: 0 };
  }
}

export async function parseOcrPdf(buffer: Buffer): Promise<OcrPdfResult> {
  console.log('[OCR PDF] Starting PDF parsing with OCR fallback...');
  
  const directResult = await extractTextDirect(buffer);
  
  if (directResult && directResult.text.trim().length > 100) {
    console.log('[OCR PDF] Direct text extraction successful');
    return {
      text: directResult.text,
      pageCount: directResult.pageCount,
      method: 'direct',
      confidence: 95
    };
  }
  
  console.log('[OCR PDF] Direct extraction insufficient, trying OCR...');
  const ocrResult = await extractWithOcr(buffer);
  
  if (ocrResult.text.trim().length > 50) {
    const directText = directResult?.text || '';
    
    if (directText.length > 0 && ocrResult.text.length > directText.length) {
      console.log('[OCR PDF] Using hybrid result (OCR + direct)');
      return {
        text: ocrResult.text,
        pageCount: directResult?.pageCount || 1,
        method: 'hybrid',
        confidence: ocrResult.confidence
      };
    }
    
    console.log('[OCR PDF] Using OCR result');
    return {
      text: ocrResult.text,
      pageCount: directResult?.pageCount || 1,
      method: 'ocr',
      confidence: ocrResult.confidence
    };
  }
  
  if (directResult && directResult.text.trim().length > 0) {
    console.log('[OCR PDF] Falling back to limited direct extraction');
    return {
      text: directResult.text,
      pageCount: directResult.pageCount,
      method: 'direct',
      confidence: 50
    };
  }
  
  console.log('[OCR PDF] No text could be extracted');
  return {
    text: '',
    pageCount: 1,
    method: 'direct',
    confidence: 0
  };
}

export const ocrPdfParser = {
  parse: parseOcrPdf
};
