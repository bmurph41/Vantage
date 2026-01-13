import { Router, Request, Response, NextFunction } from "express";
import { rraService } from "../services/rra-service";
import { requireRentRoll } from "../middleware/pack-guard";
import { z } from "zod";
import multer from "multer";
import { db } from "../db";
import { documentIntelligenceService } from "../services/document-intelligence-service";
import { parseOcrPdf } from "../services/ocr-pdf-parser";
import { rentRollDocumentParser } from "../services/rent-roll-document-parser";
import * as XLSX from "xlsx";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
import { ilike, eq, and, or, desc } from "drizzle-orm";
import {
  insertRraMarinaLocationSchema,
  insertRraStorageLocationSchema,
  insertRraTenantSchema,
  insertRraLeaseSchema,
  insertRraLeaseLineItemSchema,
  insertRraContractChargeSchema,
  insertRraLeaseCashFlowSchema,
  insertRraSnapshotVersionSchema,
  insertRraModelingProjectLinkSchema,
  crmDeals,
  crmProperties,
} from "@shared/schema";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(requireRentRoll());

function getOrgId(req: Request): string {
  return (req as any).user?.orgId || (req as any).session?.user?.orgId || (req as any).session?.orgId || 'default-org';
}

function getUserId(req: Request): string {
  return (req as any).session?.userId || (req as any).user?.id || 'system';
}

router.get("/dashboard", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const metrics = await rraService.getDashboardMetrics(orgId);
    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

router.get("/project-hub-metrics", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const metrics = await rraService.getProjectHubMetrics(orgId);
    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

// PDF parsing endpoint for rent roll import
router.post("/parse-pdf", upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const pdfResult = await parseOcrPdf(req.file.buffer);
    const text = pdfResult.text;
    
    // Split text into lines and parse table structure
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // Find lines that look like data rows (contain multiple values separated by spaces/tabs)
    const dataLines = lines.filter(line => {
      const parts = line.split(/\s{2,}|\t/).filter(p => p.trim());
      return parts.length >= 3; // At least 3 columns of data
    });
    
    if (dataLines.length < 2) {
      return res.status(400).json({ 
        error: "Could not extract table data from PDF. Please use Excel or CSV format." 
      });
    }
    
    // First qualifying line is likely headers
    const headerLine = dataLines[0];
    const headers = headerLine.split(/\s{2,}|\t/).map(h => h.trim()).filter(h => h);
    
    // Remaining lines are data rows
    const rows = dataLines.slice(1).map(line => {
      const cells = line.split(/\s{2,}|\t/).map(c => c.trim());
      // Pad or trim to match header length
      while (cells.length < headers.length) cells.push('');
      return cells.slice(0, headers.length);
    });
    
    res.json({ 
      headers, 
      rows,
      extractionMethod: pdfResult.method,
      ocrConfidence: pdfResult.confidence
    });
  } catch (error) {
    console.error('PDF parse error:', error);
    res.status(500).json({ error: "Failed to parse PDF file" });
  }
});

// Unified document parsing endpoint - handles CSV, Excel, and PDF with consistent response format
// This is the primary endpoint for the FileImportDrawer
router.post("/leases/import/parse-document", upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileBase64, fileName, sheetName, useAI } = req.body;
    
    let buffer: Buffer;
    let actualFileName: string;
    
    if (req.file) {
      buffer = req.file.buffer;
      actualFileName = req.file.originalname;
    } else if (fileBase64 && fileName) {
      buffer = Buffer.from(fileBase64, 'base64');
      actualFileName = fileName;
    } else {
      return res.status(400).json({
        success: false,
        error: "No file provided",
        headers: [],
        rows: [],
        columns: [],
        confidence: 'low',
        warnings: ['Please upload a file to continue.'],
        errors: ['No file was received'],
        metadata: { totalRows: 0, aiPowered: false },
      });
    }
    
    console.log(`[Document Parser] Processing file: ${actualFileName} (${buffer.length} bytes)`);
    
    const result = await rentRollDocumentParser.parseDocument(buffer, actualFileName, {
      sheetName,
      useAI: useAI !== false,
      skipAIOnError: true,
    });
    
    if (result.headers.length > 0) {
      const suggestions = rentRollDocumentParser.suggestColumnMappings(result.headers, result.rows);
      (result as any).columnSuggestions = suggestions;
    }
    
    console.log(`[Document Parser] Result: ${result.success ? 'success' : 'failed'}, ${result.rows.length} rows, ${result.headers.length} headers, confidence: ${result.confidence}`);
    
    return res.json(result);
  } catch (error: any) {
    console.error('[Document Parser] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to parse document",
      headers: ['Tenant Name', 'Unit/Slip', 'Monthly Rent', 'Start Date', 'End Date', 'Notes'],
      rows: [{ 'Tenant Name': '', 'Unit/Slip': '', 'Monthly Rent': '', 'Start Date': '', 'End Date': '', 'Notes': '' }],
      columns: [],
      confidence: 'low',
      warnings: [
        'Document parsing failed. You can still proceed by mapping columns manually.',
        'Use "Create custom column" option to define your data structure.',
      ],
      errors: [error.message],
      metadata: { totalRows: 0, aiPowered: false },
    });
  }
});

// PDF import endpoint with AI extraction (base64 input)
// Uses new unified parser for reliable extraction with proper fallback handling
router.post("/leases/import/pdf", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pdfBase64 } = req.body;
    
    if (!pdfBase64) {
      return res.status(400).json({ 
        success: false, 
        error: "No PDF data provided",
        headers: [],
        rows: [],
        confidence: 'low',
        warnings: ['No PDF data was received'],
        pageCount: 0
      });
    }

    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    
    // Parse PDF using OCR-enhanced extraction (handles scanned docs, photos, etc.)
    let documentText = '';
    let pageCount = 1;
    let extractionMethod = 'direct';
    let ocrConfidence = 95;
    
    try {
      console.log('[PDF Import] Starting OCR-enhanced PDF extraction...');
      const ocrResult = await parseOcrPdf(pdfBuffer);
      documentText = ocrResult.text;
      pageCount = ocrResult.pageCount;
      extractionMethod = ocrResult.method;
      ocrConfidence = ocrResult.confidence;
      console.log(`[PDF Import] Extraction complete. Method: ${extractionMethod}, Confidence: ${ocrConfidence}%, Text: ${documentText.length} chars`);
    } catch (parseError: any) {
      console.error('[PDF Import] OCR extraction failed:', parseError);
      return res.status(400).json({
        success: false,
        error: "Failed to parse PDF file",
        headers: [],
        rows: [],
        confidence: 'low',
        warnings: ['The PDF file could not be parsed. It may be corrupted or password-protected.'],
        pageCount: 0
      });
    }
    
    if (!documentText || documentText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "No text content found in PDF",
        headers: [],
        rows: [],
        confidence: 'low',
        warnings: ['The PDF appears to be empty or the OCR could not read any text. Try a higher quality scan.'],
        pageCount
      });
    }

    // Use DocumentIntelligenceService for AI-powered extraction
    const extractionResult = await documentIntelligenceService.extractRentRollFromText(documentText);
    
    // Check if AI extraction returned meaningful data
    // If not, fall through to basic text parsing for manual column mapping
    if (extractionResult.units.length > 0) {
      // Transform RentRollExtractionResult into headers/rows format for FileImportDrawer
      const headers = [
        'Unit ID',
        'Unit Type', 
        'Size',
        'Monthly Rent',
        'Annual Rent',
        'Tenant Name',
        'Lease Start',
        'Lease End',
        'Status'
      ];
      
      const rows = extractionResult.units.map(unit => ({
        'Unit ID': unit.unitIdentifier || '',
        'Unit Type': unit.unitType || '',
        'Size': unit.size || '',
        'Monthly Rent': unit.monthlyRent?.toString() || '',
        'Annual Rent': unit.annualRent?.toString() || '',
        'Tenant Name': unit.tenantName || '',
        'Lease Start': unit.leaseStart || '',
        'Lease End': unit.leaseEnd || '',
        'Status': unit.status || ''
      }));

      // Calculate confidence level
      let confidence: 'high' | 'medium' | 'low' = 'medium';
      const avgConfidence = extractionResult.units.reduce((sum, u) => sum + (u.confidence || 0), 0) / extractionResult.units.length;
      
      if (avgConfidence >= 0.8) confidence = 'high';
      else if (avgConfidence >= 0.5) confidence = 'medium';
      else confidence = 'low';

      // Build warnings
      const warnings: string[] = [];
      if (avgConfidence < 0.5) {
        warnings.push('Low confidence extraction - please verify all data carefully.');
      }
      if (extractionResult.summary.vacantUnits > 0) {
        warnings.push(`${extractionResult.summary.vacantUnits} vacant units detected.`);
      }
      if (extractionMethod === 'ocr') {
        warnings.push('Document was scanned using OCR - please verify extracted text.');
      }

      return res.json({
        success: true,
        headers,
        rows,
        confidence,
        warnings,
        pageCount,
        propertyName: extractionResult.metadata.propertyName || null,
        asOfDate: extractionResult.metadata.asOfDate || null,
        summary: extractionResult.summary,
        aiPowered: true,
        extractionMethod,
        ocrConfidence
      });
    }
    
    // AI returned no units - fall through to smart text parsing
    // This happens when AI is rate-limited or can't understand the document
    {
      console.log('[PDF Import] AI returned no units, falling back to smart parsing...');
      
      const lines = documentText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      console.log(`[PDF Import Fallback] Found ${lines.length} non-empty lines to parse`);
      
      // ============================================================
      // STRATEGY 1: Numbered list format (e.g., "1. Name - Location, Type, $Amount")
      // Common in rent roll reports with "Top Leases" sections
      // ============================================================
      const numberedListPattern = /^\d+\.\s+(.+?)\s*-\s*(.+?),\s*(.+?),\s*\$?([\d,]+(?:\.\d{2})?)/;
      const numberedListLines = lines.filter(line => numberedListPattern.test(line));
      
      if (numberedListLines.length >= 3) {
        console.log(`[PDF Import Fallback] Strategy 1: Found ${numberedListLines.length} numbered list entries`);
        const headers = ['Tenant Name', 'Property', 'Storage Type', 'Amount'];
        const rows = numberedListLines.map(line => {
          const match = line.match(numberedListPattern);
          if (match) {
            return {
              'Tenant Name': match[1].trim(),
              'Property': match[2].trim(),
              'Storage Type': match[3].trim(),
              'Amount': match[4].replace(/,/g, '')
            };
          }
          return { 'Tenant Name': line, 'Property': '', 'Storage Type': '', 'Amount': '' };
        });
        
        return res.json({
          success: true,
          headers,
          rows,
          confidence: 'medium',
          warnings: ['Extracted from numbered list format. Please verify the data.'],
          pageCount,
          aiPowered: false,
          extractionMethod,
          ocrConfidence,
          rawText: documentText.substring(0, 3000)
        });
      }
      
      // ============================================================
      // STRATEGY 2: QuickBooks/Transaction Report format
      // Looks for header row with common accounting terms, then extracts rows
      // ============================================================
      const accountingHeaderPatterns = [
        /\bType\b.*\bDate\b.*\bName\b/i,
        /\bInvoice\b.*\bDate\b.*\bAmount\b/i,
        /\bDescription\b.*\bDebit\b.*\bCredit\b/i,
        /\bAccount\b.*\bBalance\b/i
      ];
      
      let headerLineIndex = -1;
      for (let i = 0; i < Math.min(lines.length, 20); i++) {
        if (accountingHeaderPatterns.some(pattern => pattern.test(lines[i]))) {
          headerLineIndex = i;
          console.log(`[PDF Import Fallback] Strategy 2: Found accounting header at line ${i}: "${lines[i].substring(0, 60)}..."`);
          break;
        }
      }
      
      if (headerLineIndex >= 0) {
        const headerLine = lines[headerLineIndex];
        const headerParts = headerLine.split(/\s{2,}|\t/).map(h => h.trim()).filter(h => h);
        
        // Find data lines that follow the header and have similar column structure
        const dataRows: Record<string, string>[] = [];
        for (let i = headerLineIndex + 1; i < lines.length; i++) {
          const line = lines[i].trim(); // Trim leading/trailing whitespace
          // Skip lines that look like totals, headers, or other non-data
          if (/^Total|^TOTAL|^Page\s+\d|^\s*$/.test(line)) continue;
          // Skip lines with too few characters
          if (line.length < 10) continue;
          
          // Parse the line - first try normal split, then try more aggressive splitting
          let parts = line.split(/\s{2,}|\t/).map(p => p.trim()).filter(p => p);
          
          // If we got very few parts but line has content, try single space split for specific row types
          // This handles QuickBooks transaction lines like "Invoice 11/01/2025 88801 NAME..."
          if (parts.length < 3 && line.length > 20) {
            // Check if this looks like a transaction row (starts with type like Invoice, Payment, etc.)
            const transactionMatch = line.match(/^(Invoice|Payment|Credit|Debit|Journal|Deposit|Check|Bill|Expense)\s+(.+)/i);
            if (transactionMatch) {
              const restOfLine = transactionMatch[2];
              const restParts = restOfLine.split(/\s{2,}|\s+(?=\d{1,2}\/\d{1,2}\/\d{2,4})|\s+(?=\d{4,})|\s{1,}/).map(p => p.trim()).filter(p => p);
              parts = [transactionMatch[1], ...restParts];
            }
          }
          
          if (parts.length >= 2) {
            const row: Record<string, string> = {};
            headerParts.forEach((header, idx) => {
              row[header] = parts[idx] || '';
            });
            // Add any extra columns
            for (let j = headerParts.length; j < parts.length; j++) {
              row[`Column ${j + 1}`] = parts[j];
            }
            dataRows.push(row);
          }
        }
        
        // Even if we found 0 data rows, if we have headers, return them with empty rows
        // This allows users to at least see the column structure
        if (dataRows.length >= 1 || headerParts.length >= 3) {
          console.log(`[PDF Import Fallback] Strategy 2: Extracted ${dataRows.length} transaction rows with ${headerParts.length} headers`);
          return res.json({
            success: true,
            headers: headerParts,
            rows: dataRows.length > 0 ? dataRows : [Object.fromEntries(headerParts.map(h => [h, '']))],
            confidence: dataRows.length > 0 ? 'medium' : 'low',
            warnings: dataRows.length > 0 
              ? ['Extracted from transaction report format. Please verify column mappings.']
              : ['Found column headers but could not parse data rows. You may need to map manually.'],
            pageCount,
            aiPowered: false,
            extractionMethod,
            ocrConfidence,
            rawText: documentText.substring(0, 3000)
          });
        }
      }
      
      // ============================================================
      // STRATEGY 3: Detect header row by common rent roll column names
      // ============================================================
      const rentRollHeaderPatterns = [
        /\b(Tenant|Lessee|Name)\b/i,
        /\b(Slip|Unit|Space|Dock)\b/i,
        /\b(Rent|Rate|Amount|Fee)\b/i,
        /\b(Start|Begin|From)\b.*\b(Date)?\b/i,
        /\b(End|Expire|Through|To)\b.*\b(Date)?\b/i
      ];
      
      let rentRollHeaderIndex = -1;
      for (let i = 0; i < Math.min(lines.length, 15); i++) {
        const line = lines[i];
        const matchCount = rentRollHeaderPatterns.filter(p => p.test(line)).length;
        if (matchCount >= 2) {
          rentRollHeaderIndex = i;
          console.log(`[PDF Import Fallback] Strategy 3: Found rent roll header at line ${i} (${matchCount} matches)`);
          break;
        }
      }
      
      if (rentRollHeaderIndex >= 0) {
        const headerLine = lines[rentRollHeaderIndex];
        const headers = headerLine.split(/\s{2,}|\t/).map(h => h.trim()).filter(h => h);
        
        const dataRows: Record<string, string>[] = [];
        for (let i = rentRollHeaderIndex + 1; i < lines.length; i++) {
          const line = lines[i];
          if (/^Total|^TOTAL|^\s*$/.test(line)) continue;
          
          const parts = line.split(/\s{2,}|\t/).map(p => p.trim()).filter(p => p);
          if (parts.length >= 2) {
            const row: Record<string, string> = {};
            headers.forEach((header, idx) => {
              row[header] = parts[idx] || '';
            });
            dataRows.push(row);
          }
        }
        
        if (dataRows.length >= 1) {
          console.log(`[PDF Import Fallback] Strategy 3: Extracted ${dataRows.length} rent roll rows`);
          return res.json({
            success: true,
            headers,
            rows: dataRows,
            confidence: 'medium',
            warnings: ['Extracted rent roll data. Please verify column mappings.'],
            pageCount,
            aiPowered: false,
            extractionMethod,
            ocrConfidence,
            rawText: documentText.substring(0, 3000)
          });
        }
      }
      
      // ============================================================
      // STRATEGY 4: Generic multi-column tabular data
      // ============================================================
      const dataLines = lines.filter(line => {
        const parts = line.split(/\s{2,}|\t/).filter(p => p.trim());
        return parts.length >= 2;
      });
      
      if (dataLines.length >= 2) {
        console.log(`[PDF Import Fallback] Strategy 4: Found ${dataLines.length} multi-column lines`);
        const firstLine = dataLines[0];
        const isCommaSeparated = firstLine.split(',').length >= 2 && !firstLine.includes('\t');
        const delimiter = isCommaSeparated ? ',' : /\s{2,}|\t/;
        
        const headers = firstLine.split(delimiter).map((h: string) => h.trim()).filter((h: string) => h);
        const rows = dataLines.slice(1).map(line => {
          const cells = typeof delimiter === 'string' 
            ? line.split(delimiter).map((c: string) => c.trim())
            : line.split(delimiter).map((c: string) => c.trim());
          const row: Record<string, string> = {};
          headers.forEach((header, idx) => {
            row[header] = cells[idx] || '';
          });
          return row;
        });
        
        console.log(`[PDF Import Fallback] Strategy 4: Returning ${rows.length} tabular rows`);
        return res.json({
          success: true,
          headers,
          rows,
          confidence: 'low',
          warnings: ['Basic tabular extraction. Please map columns carefully.'],
          pageCount,
          aiPowered: false,
          extractionMethod,
          ocrConfidence,
          rawText: documentText.substring(0, 3000)
        });
      }
      
      // ============================================================
      // STRATEGY 5: Key-value pairs (lines with colons)
      // ============================================================
      const kvLines = lines.filter(line => line.includes(':'));
      if (kvLines.length >= 2) {
        console.log(`[PDF Import Fallback] Strategy 5: Found ${kvLines.length} key-value lines`);
        const headers = ['Field', 'Value'];
        const rows = kvLines.map(line => {
          const [key, ...vals] = line.split(':');
          return { 'Field': key.trim(), 'Value': vals.join(':').trim() };
        });
        
        return res.json({
          success: true,
          headers,
          rows,
          confidence: 'low',
          warnings: ['Extracted key-value pairs. Map columns in the next step.'],
          pageCount,
          aiPowered: false,
          extractionMethod,
          ocrConfidence,
          rawText: documentText.substring(0, 3000)
        });
      }
      
      // ============================================================
      // STRATEGY 6: Raw text lines (always succeeds if we have text)
      // ============================================================
      if (lines.length >= 1) {
        console.log(`[PDF Import Fallback] Strategy 6: Returning ${Math.min(lines.length, 100)} raw text lines`);
        const headers = ['Raw Text'];
        const rows = lines.slice(0, 100).map(line => ({ 'Raw Text': line }));
        
        return res.json({
          success: true,
          headers,
          rows,
          confidence: 'low',
          warnings: ['Raw text extracted. Each line is shown as a row.'],
          pageCount,
          aiPowered: false,
          extractionMethod,
          ocrConfidence,
          rawText: documentText.substring(0, 3000)
        });
      }
      
      // If truly no data (empty document)
      console.log(`[PDF Import Fallback] No lines found, returning error`);
      return res.status(200).json({
        success: false,
        error: "Could not extract any data",
        headers: [],
        rows: [],
        confidence: 'low',
        warnings: ['No readable text found. Try a clearer scan or use CSV/Excel format.'],
        pageCount,
        rawText: documentText.substring(0, 5000),
        aiPowered: false,
        extractionMethod,
        ocrConfidence
      });
    }
  } catch (error: any) {
    console.error('PDF import error:', error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to process PDF file",
      headers: [],
      rows: [],
      confidence: 'low',
      warnings: ['An unexpected error occurred while processing the PDF'],
      pageCount: 0
    });
  }
});

router.get("/locations", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const locations = await rraService.getLocations(orgId);
    res.json(locations);
  } catch (error) {
    next(error);
  }
});

router.get("/locations/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const location = await rraService.getLocationById(orgId, req.params.id);
    if (!location) {
      return res.status(404).json({ error: "Location not found" });
    }
    res.json(location);
  } catch (error) {
    next(error);
  }
});

router.post("/locations", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const validated = insertRraMarinaLocationSchema.parse({
      ...req.body,
      orgId,
    });
    const location = await rraService.createLocation(validated);
    res.status(201).json(location);
  } catch (error) {
    next(error);
  }
});

router.patch("/locations/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const location = await rraService.updateLocation(orgId, req.params.id, req.body);
    if (!location) {
      return res.status(404).json({ error: "Location not found" });
    }
    res.json(location);
  } catch (error) {
    next(error);
  }
});

router.delete("/locations/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    await rraService.deleteLocation(orgId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/locations/:projectId/storage", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storageLocations = await rraService.getStorageLocations(req.params.projectId);
    res.json(storageLocations);
  } catch (error) {
    next(error);
  }
});

router.post("/locations/:projectId/storage", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = insertRraStorageLocationSchema.parse({
      ...req.body,
      projectId: req.params.projectId,
    });
    const location = await rraService.createStorageLocation(validated);
    res.status(201).json(location);
  } catch (error) {
    next(error);
  }
});

router.patch("/storage/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const location = await rraService.updateStorageLocation(req.params.id, req.body);
    if (!location) {
      return res.status(404).json({ error: "Storage location not found" });
    }
    res.json(location);
  } catch (error) {
    next(error);
  }
});

router.delete("/storage/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await rraService.deleteStorageLocation(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Storage Locations API (alternative routes for frontend compatibility)
router.get("/storage-locations", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.query.projectId as string;
    if (!projectId) {
      return res.status(400).json({ error: "projectId query parameter is required" });
    }
    const storageLocations = await rraService.getStorageLocations(projectId);
    res.json(storageLocations);
  } catch (error) {
    next(error);
  }
});

router.get("/storage-locations/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const location = await rraService.getStorageLocationById(req.params.id);
    if (!location) {
      return res.status(404).json({ error: "Storage location not found" });
    }
    res.json(location);
  } catch (error) {
    next(error);
  }
});

router.post("/storage-locations", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = insertRraStorageLocationSchema.parse(req.body);
    const location = await rraService.createStorageLocation(validated);
    res.status(201).json(location);
  } catch (error) {
    next(error);
  }
});

router.put("/storage-locations/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const location = await rraService.updateStorageLocation(req.params.id, req.body);
    if (!location) {
      return res.status(404).json({ error: "Storage location not found" });
    }
    res.json(location);
  } catch (error) {
    next(error);
  }
});

router.delete("/storage-locations/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await rraService.deleteStorageLocation(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/tenants", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const search = req.query.search as string | undefined;
    const tenants = await rraService.getTenants(orgId, search);
    res.json(tenants);
  } catch (error) {
    next(error);
  }
});

router.get("/tenants/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const tenant = await rraService.getTenantById(orgId, req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    res.json(tenant);
  } catch (error) {
    next(error);
  }
});

router.post("/tenants", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const validated = insertRraTenantSchema.parse({
      ...req.body,
      orgId,
    });
    const tenant = await rraService.createTenant(validated);
    res.status(201).json(tenant);
  } catch (error) {
    next(error);
  }
});

router.patch("/tenants/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const tenant = await rraService.updateTenant(orgId, req.params.id, req.body);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    res.json(tenant);
  } catch (error) {
    next(error);
  }
});

router.delete("/tenants/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    await rraService.deleteTenant(orgId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/leases", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const filters = {
      locationId: req.query.locationId as string | undefined,
      tenantId: req.query.tenantId as string | undefined,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      storageType: req.query.storageType as string | undefined,
    };
    const leases = await rraService.getLeases(orgId, filters);
    res.json(leases);
  } catch (error) {
    next(error);
  }
});

router.get("/leases/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const lease = await rraService.getLeaseById(orgId, req.params.id);
    if (!lease) {
      return res.status(404).json({ error: "Lease not found" });
    }
    res.json(lease);
  } catch (error) {
    next(error);
  }
});

router.post("/leases", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const leaseKey = `${req.body.tenantId}|${req.body.locationId || 'none'}|${Date.now()}`;
    const validated = insertRraLeaseSchema.parse({
      ...req.body,
      orgId,
      leaseKey,
    });
    const lease = await rraService.createLease(validated);
    res.status(201).json(lease);
  } catch (error) {
    next(error);
  }
});

router.patch("/leases/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const lease = await rraService.updateLease(orgId, req.params.id, req.body);
    if (!lease) {
      return res.status(404).json({ error: "Lease not found" });
    }
    res.json(lease);
  } catch (error) {
    next(error);
  }
});

router.delete("/leases/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    await rraService.deleteLease(orgId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/leases/:leaseId/line-items", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = insertRraLeaseLineItemSchema.parse({
      ...req.body,
      leaseId: req.params.leaseId,
    });
    const item = await rraService.createLeaseLineItem(validated);
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

router.patch("/line-items/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await rraService.updateLeaseLineItem(req.params.id, req.body);
    if (!item) {
      return res.status(404).json({ error: "Line item not found" });
    }
    res.json(item);
  } catch (error) {
    next(error);
  }
});

router.delete("/line-items/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await rraService.deleteLeaseLineItem(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/leases/:leaseId/charges", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = insertRraContractChargeSchema.parse({
      ...req.body,
      leaseId: req.params.leaseId,
    });
    const charge = await rraService.createContractCharge(validated);
    res.status(201).json(charge);
  } catch (error) {
    next(error);
  }
});

router.patch("/charges/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const charge = await rraService.updateContractCharge(req.params.id, req.body);
    if (!charge) {
      return res.status(404).json({ error: "Contract charge not found" });
    }
    res.json(charge);
  } catch (error) {
    next(error);
  }
});

router.delete("/charges/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await rraService.deleteContractCharge(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/cash-flows", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const filters = {
      locationId: req.query.locationId as string | undefined,
      leaseId: req.query.leaseId as string | undefined,
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      month: req.query.month ? parseInt(req.query.month as string) : undefined,
      isProjected: req.query.isProjected === 'true' ? true : req.query.isProjected === 'false' ? false : undefined,
    };
    const cashFlows = await rraService.getCashFlows(orgId, filters);
    res.json(cashFlows);
  } catch (error) {
    next(error);
  }
});

router.post("/cash-flows", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const validated = insertRraLeaseCashFlowSchema.parse({
      ...req.body,
      orgId,
    });
    const cashFlow = await rraService.createCashFlow(validated);
    res.status(201).json(cashFlow);
  } catch (error) {
    next(error);
  }
});

router.get("/snapshots", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const locationId = req.query.locationId as string | undefined;
    const snapshots = await rraService.getSnapshotVersions(orgId, locationId);
    res.json(snapshots);
  } catch (error) {
    next(error);
  }
});

router.post("/snapshots", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const validated = insertRraSnapshotVersionSchema.parse({
      ...req.body,
      orgId,
      versionNumber: 0,
    });
    const snapshot = await rraService.createSnapshotVersion(validated);
    res.status(201).json(snapshot);
  } catch (error) {
    next(error);
  }
});

router.post("/snapshots/:id/publish", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const snapshot = await rraService.publishSnapshot(orgId, req.params.id, userId);
    if (!snapshot) {
      return res.status(404).json({ error: "Snapshot not found" });
    }
    res.json(snapshot);
  } catch (error) {
    next(error);
  }
});

router.post("/locations/:locationId/link-modeling-project", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { modelingProjectId, isPrimary } = req.body;
    await rraService.linkToModelingProject({
      orgId,
      rraLocationId: req.params.locationId,
      modelingProjectId,
      isPrimary: isPrimary || false,
      syncEnabled: true,
    });
    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.delete("/locations/:locationId/unlink-modeling-project/:modelingProjectId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await rraService.unlinkFromModelingProject(req.params.locationId, req.params.modelingProjectId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/locations/:locationId/linked-projects", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const links = await rraService.getLinkedModelingProjects(req.params.locationId);
    res.json(links);
  } catch (error) {
    next(error);
  }
});

router.get("/by-modeling-project/:modelingProjectId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const locations = await rraService.getLocationsByModelingProject(req.params.modelingProjectId);
    res.json(locations);
  } catch (error) {
    next(error);
  }
});

router.get("/projects", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const locations = await rraService.getLocations(orgId);
    res.json(locations);
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const location = await rraService.getLocationById(orgId, req.params.id);
    if (!location) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json(location);
  } catch (error) {
    next(error);
  }
});

router.post("/projects", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const validated = insertRraMarinaLocationSchema.parse({
      ...req.body,
      orgId,
    });
    const location = await rraService.createLocation(validated);
    res.status(201).json(location);
  } catch (error) {
    next(error);
  }
});

router.patch("/projects/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const location = await rraService.updateLocation(orgId, req.params.id, req.body);
    if (!location) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json(location);
  } catch (error) {
    next(error);
  }
});

router.delete("/projects/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    await rraService.deleteLocation(orgId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/cash-flows/:cashFlowId/map-budget", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { budgetLineItemId, syncType } = req.body;
    if (!budgetLineItemId) {
      return res.status(400).json({ error: "budgetLineItemId is required" });
    }
    await rraService.mapCashFlowToBudget(
      orgId,
      req.params.cashFlowId,
      budgetLineItemId,
      syncType || 'manual'
    );
    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.delete("/cash-flows/:cashFlowId/unmap-budget/:budgetLineItemId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await rraService.unmapCashFlowFromBudget(req.params.cashFlowId, req.params.budgetLineItemId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/cash-flows/:cashFlowId/budget-mappings", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mappings = await rraService.getCashFlowBudgetMappings(req.params.cashFlowId);
    res.json(mappings);
  } catch (error) {
    next(error);
  }
});

router.get("/budget-line-items/:lineItemId/cash-flows", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cashFlows = await rraService.getBudgetLineItemCashFlows(req.params.lineItemId);
    res.json(cashFlows);
  } catch (error) {
    next(error);
  }
});

router.post("/locations/:locationId/sync-budget", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { budgetId, fiscalYear } = req.body;
    if (!budgetId || !fiscalYear) {
      return res.status(400).json({ error: "budgetId and fiscalYear are required" });
    }
    const result = await rraService.syncCashFlowsToBudget(
      orgId,
      req.params.locationId,
      budgetId,
      fiscalYear
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/analytics/occupancy", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const locations = await rraService.getLocations(orgId);
    const occupancyData = locations.map((loc: any) => ({
      locationId: loc.id,
      locationName: loc.name,
      totalSlips: loc.capacity || loc.totalUnits || 0,
      occupiedSlips: loc.occupiedUnits || 0,
      occupancyRate: loc.capacity > 0 ? ((loc.occupiedUnits || 0) / loc.capacity) * 100 : 0,
      monthlyRevenue: loc.totalGrossRent || 0,
    }));
    res.json(occupancyData);
  } catch (error) {
    next(error);
  }
});

router.get("/analytics/revenue", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const revenueData = months.map((month, idx) => ({
      month,
      scheduled: Math.floor(Math.random() * 50000) + 100000,
      actual: Math.floor(Math.random() * 50000) + 95000,
      variance: 0,
    }));
    revenueData.forEach(d => d.variance = d.actual - d.scheduled);
    res.json(revenueData);
  } catch (error) {
    next(error);
  }
});

router.get("/analytics/storage-types", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const storageData = [
      { type: 'Wet Slip', count: 120, revenue: 240000 },
      { type: 'Dry Storage', count: 80, revenue: 96000 },
      { type: 'Mooring', count: 45, revenue: 45000 },
      { type: 'Trailer Parking', count: 30, revenue: 18000 },
    ];
    res.json(storageData);
  } catch (error) {
    next(error);
  }
});

router.get("/analytics/lease-terms", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const termData = [
      { term: 'Monthly', count: 45, avgRent: 850 },
      { term: 'Annual', count: 120, avgRent: 750 },
      { term: 'Seasonal', count: 65, avgRent: 1200 },
      { term: 'Multi-Year', count: 25, avgRent: 650 },
    ];
    res.json(termData);
  } catch (error) {
    next(error);
  }
});

router.get("/leases/expiring", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const days = parseInt(req.query.days as string) || 90;
    const leases = await rraService.getLeases(orgId);
    const now = new Date();
    const expiringLeases = leases
      .filter((l: any) => {
        if (!l.endDate) return false;
        const endDate = new Date(l.endDate);
        const daysUntilExpiry = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilExpiry > 0 && daysUntilExpiry <= days;
      })
      .map((l: any) => ({
        ...l,
        daysUntilExpiry: Math.floor((new Date(l.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      }))
      .sort((a: any, b: any) => a.daysUntilExpiry - b.daysUntilExpiry);
    res.json(expiringLeases);
  } catch (error) {
    next(error);
  }
});

router.get("/custom-types", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const defaultTypes = [
      { id: '1', category: 'storage_type', code: 'WET_SLIP', label: 'Wet Slip', description: 'In-water boat storage', isDefault: true, isActive: true, sortOrder: 1 },
      { id: '2', category: 'storage_type', code: 'DRY_STORAGE', label: 'Dry Storage', description: 'Indoor or outdoor dry storage', isDefault: false, isActive: true, sortOrder: 2 },
      { id: '3', category: 'storage_type', code: 'MOORING', label: 'Mooring', description: 'Mooring ball or buoy', isDefault: false, isActive: true, sortOrder: 3 },
      { id: '4', category: 'lease_type', code: 'ANNUAL', label: 'Annual', description: 'Year-long lease', isDefault: true, isActive: true, sortOrder: 1 },
      { id: '5', category: 'lease_type', code: 'SEASONAL', label: 'Seasonal', description: 'Summer or winter season only', isDefault: false, isActive: true, sortOrder: 2 },
      { id: '6', category: 'lease_type', code: 'MONTHLY', label: 'Monthly', description: 'Month-to-month lease', isDefault: false, isActive: true, sortOrder: 3 },
      { id: '7', category: 'charge_type', code: 'BASE_RENT', label: 'Base Rent', description: 'Primary slip rental charge', isDefault: true, isActive: true, sortOrder: 1 },
      { id: '8', category: 'charge_type', code: 'ELECTRIC', label: 'Electricity', description: 'Electric utility charge', isDefault: false, isActive: true, sortOrder: 2 },
      { id: '9', category: 'charge_type', code: 'WATER', label: 'Water', description: 'Water utility charge', isDefault: false, isActive: true, sortOrder: 3 },
      { id: '10', category: 'vessel_type', code: 'SAILBOAT', label: 'Sailboat', description: 'Sailing vessel', isDefault: false, isActive: true, sortOrder: 1 },
      { id: '11', category: 'vessel_type', code: 'POWERBOAT', label: 'Powerboat', description: 'Motorized vessel', isDefault: true, isActive: true, sortOrder: 2 },
      { id: '12', category: 'vessel_type', code: 'YACHT', label: 'Yacht', description: 'Large luxury vessel', isDefault: false, isActive: true, sortOrder: 3 },
      { id: '13', category: 'contract_term', code: '1_MONTH', label: '1 Month', description: 'One month term', isDefault: false, isActive: true, sortOrder: 1 },
      { id: '14', category: 'contract_term', code: '6_MONTHS', label: '6 Months', description: 'Six month term', isDefault: false, isActive: true, sortOrder: 2 },
      { id: '15', category: 'contract_term', code: '12_MONTHS', label: '12 Months', description: 'Annual term', isDefault: true, isActive: true, sortOrder: 3 },
    ];
    res.json(defaultTypes);
  } catch (error) {
    next(error);
  }
});

router.post("/custom-types", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const newType = {
      id: Date.now().toString(),
      ...req.body,
      isDefault: req.body.isDefault || false,
      isActive: req.body.isActive ?? true,
      sortOrder: req.body.sortOrder || 0,
    };
    res.status(201).json(newType);
  } catch (error) {
    next(error);
  }
});

router.patch("/custom-types/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updatedType = { id: req.params.id, ...req.body };
    res.json(updatedType);
  } catch (error) {
    next(error);
  }
});

router.delete("/custom-types/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// MODELING PROJECT LINKS - Bidirectional RRA ↔ Modeling Integration
// ============================================================================

router.get("/modeling-links", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { rraLocationId, modelingProjectId } = req.query;
    const links = await rraService.getModelingProjectLinks(
      orgId,
      rraLocationId as string | undefined,
      modelingProjectId as string | undefined
    );
    res.json(links);
  } catch (error) {
    next(error);
  }
});

router.get("/locations/:locationId/modeling-projects", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { locationId } = req.params;
    const links = await rraService.getLinkedModelingProjects(orgId, locationId);
    res.json(links);
  } catch (error) {
    next(error);
  }
});

router.get("/modeling-projects/:projectId/rra-locations", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    const locations = await rraService.getLinkedRraLocations(orgId, projectId);
    res.json(locations);
  } catch (error) {
    next(error);
  }
});

router.get("/locations/:locationId/metrics-for-modeling", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { locationId } = req.params;
    const metrics = await rraService.getRraMetricsForModeling(orgId, locationId);
    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

router.post("/modeling-links", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { rraLocationId, modelingProjectId, isPrimary, syncEnabled } = req.body;
    
    if (!rraLocationId || !modelingProjectId) {
      return res.status(400).json({ error: 'rraLocationId and modelingProjectId are required' });
    }
    
    const link = await rraService.createModelingProjectLink(
      orgId,
      rraLocationId,
      modelingProjectId,
      { isPrimary, syncEnabled }
    );
    res.status(201).json(link);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'This link already exists' });
    }
    next(error);
  }
});

router.patch("/modeling-links/:linkId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { linkId } = req.params;
    const { isPrimary, syncEnabled } = req.body;
    const updated = await rraService.updateModelingProjectLink(linkId, { isPrimary, syncEnabled });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete("/modeling-links/:linkId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { linkId } = req.params;
    await rraService.deleteModelingProjectLink(linkId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/modeling-links/:linkId/sync", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { linkId } = req.params;
    const result = await rraService.syncRraToModeling(orgId, linkId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// CRM Linking Search Endpoints
router.get("/crm/deals/search", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const search = (req.query.search as string) || '';
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    
    const conditions = [eq(crmDeals.orgId, orgId)];
    if (search) {
      conditions.push(or(
        ilike(crmDeals.title, `%${search}%`),
        ilike(crmDeals.marinaName, `%${search}%`),
        ilike(crmDeals.city, `%${search}%`)
      )!);
    }
    
    const deals = await db.select({
      id: crmDeals.id,
      title: crmDeals.title,
      marinaName: crmDeals.marinaName,
      city: crmDeals.city,
      state: crmDeals.state,
      status: crmDeals.status,
      createdAt: crmDeals.createdAt,
    }).from(crmDeals)
      .where(and(...conditions))
      .orderBy(desc(crmDeals.createdAt))
      .limit(limit);
    
    res.json(deals);
  } catch (error) {
    next(error);
  }
});

router.get("/crm/properties/search", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const search = (req.query.search as string) || '';
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    
    const conditions = [eq(crmProperties.orgId, orgId)];
    if (search) {
      conditions.push(or(
        ilike(crmProperties.title, `%${search}%`),
        ilike(crmProperties.city, `%${search}%`),
        ilike(crmProperties.address, `%${search}%`)
      )!);
    }
    
    const properties = await db.select({
      id: crmProperties.id,
      title: crmProperties.title,
      city: crmProperties.city,
      state: crmProperties.state,
      address: crmProperties.address,
      status: crmProperties.status,
      wetSlips: crmProperties.wetSlips,
      drySlips: crmProperties.drySlips,
      totalCapacity: crmProperties.totalCapacity,
      createdAt: crmProperties.createdAt,
    }).from(crmProperties)
      .where(and(...conditions))
      .orderBy(desc(crmProperties.createdAt))
      .limit(limit);
    
    res.json(properties);
  } catch (error) {
    next(error);
  }
});

export default router;
