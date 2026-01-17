import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { parseOcrPdf } from './ocr-pdf-parser';
import OpenAI from 'openai';

// Use Replit AI Integrations - provides OpenAI-compatible API access
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

// Check if AI integrations are properly configured
const AI_ENABLED = !!(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY);

export interface ParsedColumn {
  name: string;
  index: number;
  sampleValues: string[];
  dataType: 'text' | 'number' | 'date' | 'currency' | 'mixed';
  isEmpty: boolean;
}

export interface ParsedRow {
  [key: string]: string;
}

export interface DocumentParseResult {
  success: boolean;
  fileType: 'csv' | 'excel' | 'pdf';
  headers: string[];
  rows: ParsedRow[];
  columns: ParsedColumn[];
  sheets?: { name: string; rowCount: number }[];
  selectedSheet?: string;
  confidence: 'high' | 'medium' | 'low';
  extractionMethod: 'direct' | 'ocr' | 'ai' | 'heuristic';
  warnings: string[];
  errors: string[];
  metadata: {
    totalRows: number;
    pageCount?: number;
    ocrConfidence?: number;
    aiPowered: boolean;
  };
}

export interface ColumnMappingSuggestion {
  sourceColumn: string;
  targetField: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

const MARINA_FIELD_PATTERNS: Record<string, RegExp[]> = {
  name: [/tenant|lessee|name|customer|owner|renter/i],
  unitLocation: [/slip|unit|space|dock|location|berth|spot|stall/i],
  leaseAmount: [/rent|rate|amount|fee|charge|monthly|price|cost/i],
  storageType: [/type|storage|category|class/i],
  leaseCommencement: [/start|begin|commence|from|effective/i],
  leaseExpiration: [/end|expire|expir|through|to\s*date|term\s*end/i],
  boatLength: [/length|loa|boat\s*size/i],
  boatWidth: [/width|beam/i],
  boatMake: [/make|manufacturer|brand/i],
  boatYear: [/year|model\s*year/i],
  contractTerm: [/term|contract|period|season/i],
  status: [/status|occupancy|occupied|vacant/i],
};

const QUICKBOOKS_PATTERNS = {
  transactionHeader: /\bType\b.*\bDate\b.*\b(Name|Num)\b/i,
  invoiceRow: /^(Invoice|Payment|Credit|Debit|Journal|Deposit|Check|Bill|Expense)\s+/i,
  accountingColumns: ['Type', 'Date', 'Num', 'Name', 'Memo', 'Clr', 'Split', 'Debit', 'Credit', 'Balance'],
};

const RENT_ROLL_PATTERNS = {
  headerIndicators: [
    /\b(Tenant|Lessee|Name)\b/i,
    /\b(Slip|Unit|Space|Dock)\b/i,
    /\b(Rent|Rate|Amount|Fee)\b/i,
  ],
  dataRowIndicators: [
    /\$[\d,]+\.?\d*/,
    /\d{1,2}\/\d{1,2}\/\d{2,4}/,
  ],
};

export class RentRollDocumentParser {
  async parseDocument(
    buffer: Buffer,
    fileName: string,
    options: {
      sheetName?: string;
      useAI?: boolean;
      skipAIOnError?: boolean;
    } = {}
  ): Promise<DocumentParseResult> {
    const ext = fileName.toLowerCase().split('.').pop() || '';
    
    try {
      switch (ext) {
        case 'csv':
          return this.parseCSV(buffer, fileName);
        case 'xlsx':
        case 'xls':
          return this.parseExcel(buffer, fileName, options.sheetName);
        case 'pdf':
          return this.parsePDF(buffer, fileName, options.useAI !== false, options.skipAIOnError !== false);
        default:
          return {
            success: false,
            fileType: 'csv',
            headers: [],
            rows: [],
            columns: [],
            confidence: 'low',
            extractionMethod: 'direct',
            warnings: [],
            errors: [`Unsupported file type: ${ext}`],
            metadata: { totalRows: 0, aiPowered: false },
          };
      }
    } catch (error: any) {
      console.error(`[RentRollDocumentParser] Error parsing ${fileName}:`, error);
      return {
        success: false,
        fileType: ext as any,
        headers: [],
        rows: [],
        columns: [],
        confidence: 'low',
        extractionMethod: 'direct',
        warnings: [],
        errors: [error.message || 'Unknown parsing error'],
        metadata: { totalRows: 0, aiPowered: false },
      };
    }
  }

  private parseCSV(buffer: Buffer, fileName: string): DocumentParseResult {
    const content = buffer.toString('utf-8');
    const warnings: string[] = [];
    
    const parseResult = Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
    });
    
    if (parseResult.errors.length > 0) {
      parseResult.errors.forEach(err => {
        warnings.push(`Row ${err.row}: ${err.message}`);
      });
    }
    
    const headers = parseResult.meta.fields || [];
    const rows = (parseResult.data as ParsedRow[]).filter(row => 
      Object.values(row).some(v => v && String(v).trim())
    );
    
    const columns = this.analyzeColumns(headers, rows);
    
    return {
      success: true,
      fileType: 'csv',
      headers,
      rows,
      columns,
      confidence: 'high',
      extractionMethod: 'direct',
      warnings,
      errors: [],
      metadata: {
        totalRows: rows.length,
        aiPowered: false,
      },
    };
  }

  private parseExcel(buffer: Buffer, fileName: string, sheetName?: string): DocumentParseResult {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const warnings: string[] = [];
    
    const sheets = workbook.SheetNames.map(name => {
      const sheet = workbook.Sheets[name];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      return {
        name,
        rowCount: data.filter(row => row.some(cell => cell !== undefined && cell !== '')).length,
      };
    });
    
    const targetSheet = sheetName || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[targetSheet];
    
    if (!worksheet) {
      return {
        success: false,
        fileType: 'excel',
        headers: [],
        rows: [],
        columns: [],
        sheets,
        confidence: 'low',
        extractionMethod: 'direct',
        warnings: [],
        errors: [`Sheet "${targetSheet}" not found`],
        metadata: { totalRows: 0, aiPowered: false },
      };
    }
    
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false }) as any[][];
    
    const headerRowIndex = this.findHeaderRow(rawData);
    if (headerRowIndex < 0 || !rawData[headerRowIndex]) {
      warnings.push('Could not detect header row, using first non-empty row');
    }
    
    const headerRow = rawData[headerRowIndex] || rawData[0] || [];
    const headers = headerRow.map((h: any, i: number) => 
      h ? String(h).trim() : `Column ${i + 1}`
    ).filter((h: string) => h);
    
    const rows: ParsedRow[] = [];
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || !row.some((cell: any) => cell !== undefined && cell !== '')) continue;
      
      const rowObj: ParsedRow = {};
      headers.forEach((header, idx) => {
        const value = row[idx];
        rowObj[header] = value !== undefined && value !== null ? String(value).trim() : '';
      });
      
      if (!this.isTotalRow(rowObj)) {
        rows.push(rowObj);
      }
    }
    
    const columns = this.analyzeColumns(headers, rows);
    
    return {
      success: true,
      fileType: 'excel',
      headers,
      rows,
      columns,
      sheets,
      selectedSheet: targetSheet,
      confidence: 'high',
      extractionMethod: 'direct',
      warnings,
      errors: [],
      metadata: {
        totalRows: rows.length,
        aiPowered: false,
      },
    };
  }

  private async parsePDF(
    buffer: Buffer,
    fileName: string,
    useAI: boolean = true,
    skipAIOnError: boolean = true
  ): Promise<DocumentParseResult> {
    const warnings: string[] = [];
    let extractionMethod: 'direct' | 'ocr' | 'ai' | 'heuristic' = 'direct';
    let aiPowered = false;
    
    console.log('[PDF Parser] Starting PDF extraction...');
    
    let ocrResult;
    try {
      ocrResult = await parseOcrPdf(buffer);
      extractionMethod = ocrResult.method as any;
      console.log(`[PDF Parser] OCR complete. Method: ${ocrResult.method}, Confidence: ${ocrResult.confidence}%, Text: ${ocrResult.text.length} chars`);
    } catch (error: any) {
      console.error('[PDF Parser] OCR extraction failed:', error);
      return this.createFallbackResult('pdf', ['PDF extraction failed. Please try CSV or Excel format.']);
    }
    
    const documentText = ocrResult.text;
    if (!documentText || documentText.trim().length < 20) {
      return this.createFallbackResult('pdf', ['No readable text found in PDF. Try a clearer scan or use CSV/Excel format.']);
    }
    
    if (ocrResult.method === 'ocr') {
      warnings.push('Document was scanned using OCR - please verify extracted text.');
    }
    
    if (useAI) {
      try {
        console.log('[PDF Parser] Attempting AI extraction...');
        const aiResult = await this.extractWithAI(documentText);
        if (aiResult && aiResult.rows.length > 0) {
          console.log(`[PDF Parser] AI extraction successful: ${aiResult.rows.length} rows`);
          aiPowered = true;
          extractionMethod = 'ai';
          
          return {
            success: true,
            fileType: 'pdf',
            headers: aiResult.headers,
            rows: aiResult.rows,
            columns: this.analyzeColumns(aiResult.headers, aiResult.rows),
            confidence: 'high',
            extractionMethod: 'ai',
            warnings: [...warnings, ...aiResult.warnings],
            errors: [],
            metadata: {
              totalRows: aiResult.rows.length,
              pageCount: ocrResult.pageCount,
              ocrConfidence: ocrResult.confidence,
              aiPowered: true,
            },
          };
        }
      } catch (aiError: any) {
        console.warn('[PDF Parser] AI extraction failed:', aiError.message);
        if (!skipAIOnError) {
          throw aiError;
        }
        warnings.push('AI extraction unavailable. Using heuristic parsing.');
      }
    }
    
    console.log('[PDF Parser] Using heuristic parsing strategies...');
    const heuristicResult = this.parseWithHeuristics(documentText, ocrResult.pageCount);
    extractionMethod = 'heuristic';
    
    return {
      success: heuristicResult.success,
      fileType: 'pdf',
      headers: heuristicResult.headers,
      rows: heuristicResult.rows,
      columns: this.analyzeColumns(heuristicResult.headers, heuristicResult.rows),
      confidence: heuristicResult.confidence,
      extractionMethod,
      warnings: [...warnings, ...heuristicResult.warnings],
      errors: heuristicResult.errors,
      metadata: {
        totalRows: heuristicResult.rows.length,
        pageCount: ocrResult.pageCount,
        ocrConfidence: ocrResult.confidence,
        aiPowered,
      },
    };
  }

  private async extractWithAI(documentText: string): Promise<{
    headers: string[];
    rows: ParsedRow[];
    warnings: string[];
  } | null> {
    if (!openai || !AI_ENABLED) {
      console.log('[PDF Parser] AI not available - skipping AI extraction');
      return null;
    }
    
    const prompt = `Extract structured rent roll or lease data from this document text.

Return a JSON object with:
- "headers": array of column names found (e.g., ["Tenant Name", "Slip", "Monthly Rent", "Start Date", "End Date", "Status"])
- "rows": array of objects, each with keys matching the headers
- "warnings": array of any data quality issues found

Focus on extracting:
- Tenant/customer names
- Unit/slip/space identifiers
- Rent amounts (monthly, annual, seasonal)
- Lease dates (start, end)
- Storage types (wet slip, dry storage, etc.)
- Boat information if present
- Status (occupied, vacant, etc.)

If this is a QuickBooks or accounting report, extract transaction-level data including dates, invoice numbers, names, and amounts.

Document text:
${documentText.substring(0, 15000)}

Return ONLY valid JSON, no explanations.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    try {
      const result = JSON.parse(content);
      if (!result.headers || !result.rows || !Array.isArray(result.rows)) {
        return null;
      }
      return {
        headers: result.headers,
        rows: result.rows,
        warnings: result.warnings || [],
      };
    } catch {
      return null;
    }
  }

  private parseWithHeuristics(documentText: string, pageCount: number): {
    success: boolean;
    headers: string[];
    rows: ParsedRow[];
    confidence: 'high' | 'medium' | 'low';
    warnings: string[];
    errors: string[];
  } {
    const lines = documentText.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
    
    if (lines.length === 0) {
      return {
        success: false,
        headers: [],
        rows: [],
        confidence: 'low',
        warnings: [],
        errors: ['No text content found in document'],
      };
    }
    
    const qbResult = this.tryQuickBooksFormat(lines);
    if (qbResult) {
      console.log(`[PDF Parser] QuickBooks format detected: ${qbResult.rows.length} rows`);
      return qbResult;
    }
    
    const rentRollResult = this.tryRentRollFormat(lines);
    if (rentRollResult) {
      console.log(`[PDF Parser] Rent roll format detected: ${rentRollResult.rows.length} rows`);
      return rentRollResult;
    }
    
    const tabularResult = this.tryTabularFormat(lines);
    if (tabularResult) {
      console.log(`[PDF Parser] Tabular format detected: ${tabularResult.rows.length} rows`);
      return tabularResult;
    }
    
    const genericResult = this.tryGenericParsing(lines);
    console.log(`[PDF Parser] Generic parsing: ${genericResult.rows.length} rows`);
    return genericResult;
  }

  private tryQuickBooksFormat(lines: string[]): {
    success: boolean;
    headers: string[];
    rows: ParsedRow[];
    confidence: 'high' | 'medium' | 'low';
    warnings: string[];
    errors: string[];
  } | null {
    let headerLineIndex = -1;
    for (let i = 0; i < Math.min(lines.length, 25); i++) {
      if (QUICKBOOKS_PATTERNS.transactionHeader.test(lines[i])) {
        headerLineIndex = i;
        break;
      }
    }
    
    if (headerLineIndex < 0) return null;
    
    const headerLine = lines[headerLineIndex];
    const headers = this.splitByWhitespace(headerLine);
    
    if (headers.length < 3) return null;
    
    const rows: ParsedRow[] = [];
    for (let i = headerLineIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      
      if (/^(Total|TOTAL|Page\s+\d)/i.test(line)) continue;
      if (line.length < 10) continue;
      
      const transactionMatch = line.match(QUICKBOOKS_PATTERNS.invoiceRow);
      if (transactionMatch) {
        const parts = this.splitTransactionLine(line, headers.length);
        if (parts.length >= 2) {
          const row: ParsedRow = {};
          headers.forEach((header, idx) => {
            row[header] = parts[idx] || '';
          });
          for (let j = headers.length; j < parts.length; j++) {
            row[`Column ${j + 1}`] = parts[j];
          }
          rows.push(row);
        }
        continue;
      }
      
      const parts = this.splitByWhitespace(line);
      if (parts.length >= 2) {
        const row: ParsedRow = {};
        headers.forEach((header, idx) => {
          row[header] = parts[idx] || '';
        });
        rows.push(row);
      }
    }
    
    if (rows.length === 0 && headers.length >= 3) {
      const emptyRow: ParsedRow = {};
      headers.forEach(h => { emptyRow[h] = ''; });
      rows.push(emptyRow);
      
      return {
        success: true,
        headers,
        rows,
        confidence: 'low',
        warnings: ['Found column headers but could not parse data rows. Use the column dropdown to map fields manually.'],
        errors: [],
      };
    }
    
    return rows.length > 0 ? {
      success: true,
      headers,
      rows,
      confidence: rows.length > 3 ? 'medium' : 'low',
      warnings: ['Extracted from QuickBooks/accounting format. Please verify column mappings.'],
      errors: [],
    } : null;
  }

  private tryRentRollFormat(lines: string[]): {
    success: boolean;
    headers: string[];
    rows: ParsedRow[];
    confidence: 'high' | 'medium' | 'low';
    warnings: string[];
    errors: string[];
  } | null {
    let headerLineIndex = -1;
    for (let i = 0; i < Math.min(lines.length, 15); i++) {
      const line = lines[i];
      const matchCount = RENT_ROLL_PATTERNS.headerIndicators.filter(p => p.test(line)).length;
      if (matchCount >= 2) {
        headerLineIndex = i;
        break;
      }
    }
    
    if (headerLineIndex < 0) return null;
    
    const headers = this.splitByWhitespace(lines[headerLineIndex]);
    if (headers.length < 2) return null;
    
    const rows: ParsedRow[] = [];
    for (let i = headerLineIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (/^(Total|TOTAL|Subtotal)/i.test(line)) continue;
      if (line.length < 5) continue;
      
      const parts = this.splitByWhitespace(line);
      if (parts.length >= 2) {
        const row: ParsedRow = {};
        headers.forEach((header, idx) => {
          row[header] = parts[idx] || '';
        });
        rows.push(row);
      }
    }
    
    if (rows.length === 0 && headers.length >= 2) {
      const emptyRow: ParsedRow = {};
      headers.forEach(h => { emptyRow[h] = ''; });
      rows.push(emptyRow);
      
      return {
        success: true,
        headers,
        rows,
        confidence: 'low',
        warnings: ['Found rent roll headers but could not parse data rows. Map columns manually.'],
        errors: [],
      };
    }
    
    return rows.length > 0 ? {
      success: true,
      headers,
      rows,
      confidence: 'medium',
      warnings: ['Extracted rent roll data. Please verify column mappings.'],
      errors: [],
    } : null;
  }

  private tryTabularFormat(lines: string[]): {
    success: boolean;
    headers: string[];
    rows: ParsedRow[];
    confidence: 'high' | 'medium' | 'low';
    warnings: string[];
    errors: string[];
  } | null {
    const multiColumnLines = lines.filter(line => {
      const parts = this.splitByWhitespace(line);
      return parts.length >= 2 && parts.length <= 20;
    });
    
    if (multiColumnLines.length < 2) return null;
    
    const headerLine = multiColumnLines[0];
    const headers = this.splitByWhitespace(headerLine);
    
    const rows: ParsedRow[] = [];
    for (let i = 1; i < multiColumnLines.length; i++) {
      const parts = this.splitByWhitespace(multiColumnLines[i]);
      const row: ParsedRow = {};
      headers.forEach((header, idx) => {
        row[header] = parts[idx] || '';
      });
      if (!this.isTotalRow(row)) {
        rows.push(row);
      }
    }
    
    return rows.length > 0 ? {
      success: true,
      headers,
      rows,
      confidence: 'low',
      warnings: ['Basic tabular extraction. Please map columns carefully.'],
      errors: [],
    } : null;
  }

  private tryGenericParsing(lines: string[]): {
    success: boolean;
    headers: string[];
    rows: ParsedRow[];
    confidence: 'high' | 'medium' | 'low';
    warnings: string[];
    errors: string[];
  } {
    const defaultHeaders = ['Tenant Name', 'Unit/Slip', 'Monthly Rent', 'Start Date', 'End Date', 'Notes'];
    const emptyRow: ParsedRow = {};
    defaultHeaders.forEach(h => { emptyRow[h] = ''; });
    
    return {
      success: true,
      headers: defaultHeaders,
      rows: [emptyRow],
      confidence: 'low',
      warnings: [
        'Could not automatically parse document structure.',
        'Use "Create custom column" option to define your own columns and enter data manually.',
        'Consider uploading a CSV or Excel file for more reliable parsing.',
      ],
      errors: [],
    };
  }

  private splitByWhitespace(line: string): string[] {
    return line.split(/\s{2,}|\t/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  private splitTransactionLine(line: string, expectedColumns: number): string[] {
    const parts: string[] = [];
    
    const transactionMatch = line.match(/^(Invoice|Payment|Credit|Debit|Journal|Deposit|Check|Bill|Expense)/i);
    if (transactionMatch) {
      parts.push(transactionMatch[1]);
      const rest = line.substring(transactionMatch[0].length).trim();
      
      const dateMatch = rest.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})/);
      if (dateMatch) {
        parts.push(dateMatch[1]);
        const afterDate = rest.substring(dateMatch[0].length).trim();
        
        const remainingParts = this.splitByWhitespace(afterDate);
        parts.push(...remainingParts);
      } else {
        parts.push(...this.splitByWhitespace(rest));
      }
    } else {
      parts.push(...this.splitByWhitespace(line));
    }
    
    return parts;
  }

  private findHeaderRow(data: any[][]): number {
    for (let i = 0; i < Math.min(data.length, 10); i++) {
      const row = data[i];
      if (!row || row.length < 2) continue;
      
      const nonEmptyCells = row.filter(cell => cell !== undefined && cell !== '' && cell !== null);
      if (nonEmptyCells.length < 2) continue;
      
      const hasTextCells = nonEmptyCells.every(cell => 
        typeof cell === 'string' || (typeof cell === 'number' && isNaN(cell))
      );
      
      if (hasTextCells && nonEmptyCells.length >= 2) {
        return i;
      }
    }
    return 0;
  }

  private isTotalRow(row: ParsedRow): boolean {
    const summaryPattern = /^(total|totals|grand\s*total|subtotal|sub\s*total|sum|sums)s?:?\s*$/i;
    
    for (const value of Object.values(row)) {
      const strValue = String(value || '').trim();
      if (strValue.length > 0 && strValue.length < 30 && summaryPattern.test(strValue)) {
        return true;
      }
    }
    return false;
  }

  private analyzeColumns(headers: string[], rows: ParsedRow[]): ParsedColumn[] {
    return headers.map((name, index) => {
      const sampleValues = rows.slice(0, 5).map(row => row[name] || '').filter(v => v);
      const dataType = this.inferDataType(sampleValues);
      const isEmpty = sampleValues.length === 0;
      
      return {
        name,
        index,
        sampleValues,
        dataType,
        isEmpty,
      };
    });
  }

  private inferDataType(values: string[]): 'text' | 'number' | 'date' | 'currency' | 'mixed' {
    if (values.length === 0) return 'text';
    
    const types = values.map(v => {
      if (/^\$?[\d,]+\.?\d*$/.test(v.replace(/[$,]/g, ''))) {
        return v.includes('$') || parseFloat(v.replace(/[$,]/g, '')) > 100 ? 'currency' : 'number';
      }
      if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(v) || /^\d{4}-\d{2}-\d{2}$/.test(v)) {
        return 'date';
      }
      return 'text';
    });
    
    const uniqueTypes = [...new Set(types)];
    if (uniqueTypes.length === 1) return uniqueTypes[0] as any;
    if (uniqueTypes.includes('currency')) return 'currency';
    if (uniqueTypes.length === 2 && uniqueTypes.includes('text')) return uniqueTypes.find(t => t !== 'text') as any;
    return 'mixed';
  }

  private createFallbackResult(fileType: 'csv' | 'excel' | 'pdf', errors: string[]): DocumentParseResult {
    const defaultHeaders = ['Tenant Name', 'Unit/Slip', 'Monthly Rent', 'Start Date', 'End Date', 'Notes'];
    const emptyRow: ParsedRow = {};
    defaultHeaders.forEach(h => { emptyRow[h] = ''; });
    
    return {
      success: true,
      fileType,
      headers: defaultHeaders,
      rows: [emptyRow],
      columns: defaultHeaders.map((name, index) => ({
        name,
        index,
        sampleValues: [],
        dataType: 'text' as const,
        isEmpty: true,
      })),
      confidence: 'low',
      extractionMethod: 'heuristic',
      warnings: [
        ...errors,
        'You can still proceed by using "Create custom column" to define your data structure.',
      ],
      errors: [],
      metadata: {
        totalRows: 0,
        aiPowered: false,
      },
    };
  }

  suggestColumnMappings(headers: string[], rows: ParsedRow[]): ColumnMappingSuggestion[] {
    const suggestions: ColumnMappingSuggestion[] = [];
    
    for (const header of headers) {
      const normalizedHeader = header.toLowerCase();
      
      for (const [field, patterns] of Object.entries(MARINA_FIELD_PATTERNS)) {
        for (const pattern of patterns) {
          if (pattern.test(normalizedHeader)) {
            const sampleValues = rows.slice(0, 3).map(r => r[header]).filter(v => v);
            const confidence = this.assessMappingConfidence(field, sampleValues);
            
            suggestions.push({
              sourceColumn: header,
              targetField: field,
              confidence,
              reason: `Column name matches pattern for ${field}`,
            });
            break;
          }
        }
      }
    }
    
    return suggestions;
  }

  private assessMappingConfidence(
    targetField: string,
    sampleValues: string[]
  ): 'high' | 'medium' | 'low' {
    if (sampleValues.length === 0) return 'low';
    
    if (['leaseAmount', 'baseRent2', 'baseRent3'].includes(targetField)) {
      const allCurrency = sampleValues.every(v => /^\$?[\d,]+\.?\d*$/.test(v.replace(/[$,]/g, '')));
      return allCurrency ? 'high' : 'low';
    }
    
    if (['leaseCommencement', 'leaseExpiration'].includes(targetField)) {
      const allDates = sampleValues.every(v => 
        /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(v) || /\d{4}-\d{2}-\d{2}/.test(v)
      );
      return allDates ? 'high' : 'low';
    }
    
    if (['boatLength', 'boatWidth', 'slipLength', 'slipWidth'].includes(targetField)) {
      const allNumbers = sampleValues.every(v => /^\d+\.?\d*$/.test(v.replace(/['"]/g, '')));
      return allNumbers ? 'high' : 'medium';
    }
    
    return 'medium';
  }
}

export const rentRollDocumentParser = new RentRollDocumentParser();
