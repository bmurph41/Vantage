import XLSX from 'xlsx';
import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';

export interface ParsedData {
  headers: string[];
  rows: Record<string, any>[];
  totalRows: number;
  fileName: string;
  fileType: 'xlsx' | 'csv';
}

export interface ParserOptions {
  skipEmptyLines?: boolean;
  trimWhitespace?: boolean;
  headerRow?: number;
  encoding?: string;
}

export class FileParser {
  static async parseFile(filePath: string, options: ParserOptions = {}, originalFilename?: string): Promise<ParsedData> {
    // Validate file size first
    await this.validateFileSize(filePath);
    
    // Use original filename if provided (for multer uploads), otherwise use file path
    const fileName = originalFilename || path.basename(filePath);
    const fileExtension = path.extname(fileName).toLowerCase();
    
    console.log('FileParser.parseFile called with:', {
      filePath: path.basename(filePath),
      originalFilename,
      derivedExtension: fileExtension
    });
    
    // Try extension-based detection first
    if (fileExtension === '.xlsx' || fileExtension === '.xls') {
      console.log('Parsing as Excel based on extension:', fileExtension);
      return this.parseExcel(filePath, options);
    } else if (fileExtension === '.csv') {
      console.log('Parsing as CSV based on extension:', fileExtension);
      return this.parseCSV(filePath, options);
    } else {
      // Content-based fallback detection for missing/unknown extensions
      console.log('Extension unknown or missing, using content-based detection');
      const detectedType = await this.detectFileTypeByContent(filePath);
      
      if (detectedType === 'excel') {
        console.log('Content detection: Excel file detected');
        return this.parseExcel(filePath, options);
      } else if (detectedType === 'csv') {
        console.log('Content detection: CSV file detected');
        return this.parseCSV(filePath, options);
      } else {
        throw new Error(`Unsupported file type: ${fileExtension}. Content detection failed - file may be corrupted or in an unsupported format.`);
      }
    }
  }

  private static async parseExcel(filePath: string, options: ParserOptions): Promise<ParsedData> {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0]; // Use first sheet
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON with header detection
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        blankrows: !options.skipEmptyLines,
        range: 50000 // Limit rows to prevent memory issues
      }) as any[][];

      if (jsonData.length === 0) {
        throw new Error('Excel file is empty');
      }

      // Extract headers from specified row (default: first row)
      const headerRowIndex = options.headerRow || 0;
      const headers = jsonData[headerRowIndex]?.map(h => String(h).trim()) || [];
      
      if (headers.length === 0) {
        throw new Error('No headers found in Excel file');
      }

      // Convert data rows to objects
      const dataRows = jsonData.slice(headerRowIndex + 1);
      const rows = dataRows
        .filter(row => {
          // Skip empty rows if option is set
          if (options.skipEmptyLines) {
            return row.some(cell => cell !== '' && cell !== null && cell !== undefined);
          }
          return true;
        })
        .map(row => {
          const obj: Record<string, any> = {};
          headers.forEach((header, index) => {
            let value = row[index];
            if (options.trimWhitespace && typeof value === 'string') {
              value = value.trim();
            }
            obj[header] = value;
          });
          return obj;
        });

      return {
        headers,
        rows,
        totalRows: rows.length,
        fileName: path.basename(filePath),
        fileType: 'xlsx'
      };
    } catch (error) {
      throw new Error(`Failed to parse Excel file: ${error.message}`);
    }
  }

  private static async parseCSV(filePath: string, options: ParserOptions): Promise<ParsedData> {
    return new Promise((resolve, reject) => {
      // Auto-detect encoding and delimiter for better CSV support
      const encoding = (options.encoding as BufferEncoding) || this.detectEncoding(filePath);
      const delimiter = this.detectDelimiter(filePath);
      const stream = fs.createReadStream(filePath, { encoding });
      const rows: Record<string, any>[] = [];
      let headers: string[] = [];
      const maxRows = 50000; // Limit to prevent memory issues
      let rowCount = 0;
      
      Papa.parse(stream, {
        header: true,
        delimiter: delimiter,
        skipEmptyLines: options.skipEmptyLines || true,
        trimHeaders: options.trimWhitespace || true,
        transform: options.trimWhitespace ? (value: string) => value.trim() : undefined,
        step: (result) => {
          // Store headers from first row
          if (headers.length === 0 && result.meta.fields) {
            headers = result.meta.fields;
          }
          
          // Limit number of rows to prevent memory issues
          if (rowCount < maxRows) {
            rows.push(result.data as Record<string, any>);
            rowCount++;
          }
        },
        complete: (results) => {
          if (results.errors.length > 0) {
            const criticalErrors = results.errors.filter(err => err.type === 'Delimiter');
            if (criticalErrors.length > 0) {
              reject(new Error(`CSV parsing failed: ${criticalErrors[0].message}`));
              return;
            }
          }

          if (rowCount >= maxRows) {
            console.warn(`CSV file truncated to ${maxRows} rows for processing`);
          }

          resolve({
            headers,
            rows,
            totalRows: rowCount,
            fileName: path.basename(filePath),
            fileType: 'csv'
          });
        },
        error: (error) => {
          reject(new Error(`Failed to parse CSV file: ${error.message}`));
        }
      });
    });
  }

  static detectDelimiter(filePath: string): string {
    const sample = fs.readFileSync(filePath, { encoding: 'utf8' }).slice(0, 1024);
    const delimiters = [',', ';', '\t', '|'];
    
    let bestDelimiter = ',';
    let maxColumns = 0;
    
    for (const delimiter of delimiters) {
      const result = Papa.parse(sample, { delimiter, preview: 5 });
      const avgColumns = result.data.reduce((sum, row) => sum + (row as any[]).length, 0) / result.data.length;
      
      if (avgColumns > maxColumns) {
        maxColumns = avgColumns;
        bestDelimiter = delimiter;
      }
    }
    
    return bestDelimiter;
  }

  private static detectEncoding(filePath: string): BufferEncoding {
    try {
      const buffer = fs.readFileSync(filePath);
      const sample = buffer.slice(0, Math.min(1024, buffer.length));
      
      // Check for BOM markers
      if (sample.length >= 2 && sample[0] === 0xFF && sample[1] === 0xFE) {
        return 'utf16le';
      }
      if (sample.length >= 2 && sample[0] === 0xFE && sample[1] === 0xFF) {
        return 'utf16be';
      }
      if (sample.length >= 3 && sample[0] === 0xEF && sample[1] === 0xBB && sample[2] === 0xBF) {
        return 'utf8';
      }
      
      // Default to UTF-8 for CSV files
      return 'utf8';
    } catch (error) {
      console.warn('Could not detect encoding, defaulting to UTF-8:', error.message);
      return 'utf8';
    }
  }

  private static async detectFileTypeByContent(filePath: string): Promise<'excel' | 'csv' | 'unknown'> {
    try {
      const buffer = fs.readFileSync(filePath);
      const firstBytes = buffer.slice(0, 4);
      
      // Check for Excel file signatures
      // XLSX files start with PK signature (ZIP format)
      if (firstBytes.length >= 2 && firstBytes[0] === 0x50 && firstBytes[1] === 0x4B) {
        return 'excel';
      }
      
      // XLS files have OLE signature
      if (firstBytes.length >= 4 && 
          firstBytes[0] === 0xD0 && firstBytes[1] === 0xCF && 
          firstBytes[2] === 0x11 && firstBytes[3] === 0xE0) {
        return 'excel';
      }
      
      // If not binary Excel format, try to detect if it's text-based (CSV)
      const sample = buffer.slice(0, Math.min(1024, buffer.length));
      let textCharCount = 0;
      let totalBytes = sample.length;
      
      for (let i = 0; i < sample.length; i++) {
        const byte = sample[i];
        // Count characters that are typical in text files
        if ((byte >= 32 && byte <= 126) ||  // Printable ASCII
            byte === 9 ||                    // Tab
            byte === 10 ||                   // LF
            byte === 13 ||                   // CR
            byte >= 128) {                   // UTF-8 high bytes
          textCharCount++;
        }
      }
      
      const textRatio = textCharCount / totalBytes;
      
      // If high percentage of text characters, assume CSV
      if (textRatio > 0.8) {
        return 'csv';
      }
      
      return 'unknown';
    } catch (error) {
      console.error('Content detection failed:', error);
      return 'unknown';
    }
  }

  static async validateFileSize(filePath: string, maxSizeMB: number = 20): Promise<void> {
    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    if (fileSizeMB > maxSizeMB) {
      throw new Error(`File size (${fileSizeMB.toFixed(2)}MB) exceeds maximum allowed size (${maxSizeMB}MB)`);
    }
  }
}