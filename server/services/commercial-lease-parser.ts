import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { parseOcrPdf } from './ocr-pdf-parser';
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

const AI_ENABLED = !!(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY);

export interface LeaseAbstractField {
  fieldName: string;
  value: string | number | boolean | null;
  confidence: 'high' | 'medium' | 'low';
  sourceLocation?: string;
  rawText?: string;
}

export interface ParsedLeaseAbstract {
  tenantName: string | null;
  tradeName: string | null;
  suiteNumber: string | null;
  squareFootage: number | null;
  proRataShare: number | null;
  permittedUse: string | null;
  
  leaseExecutionDate: string | null;
  leaseCommencementDate: string | null;
  rentStartDate: string | null;
  leaseExpirationDate: string | null;
  
  leaseType: 'nnn' | 'modified_gross' | 'full_service' | 'absolute_net' | 'double_net' | null;
  rentStructure: 'base_only' | 'base_plus_percentage' | 'percentage_only' | null;
  
  currentBaseRent: number | null;
  baseRentPerSF: number | null;
  rentFreePeriodMonths: number | null;
  
  escalationType: 'fixed_dollar' | 'fixed_percent' | 'cpi' | 'fair_market_value' | 'none' | null;
  escalationRate: number | null;
  escalationAmount: number | null;
  escalationFrequency: number | null;
  cpiIndex: string | null;
  cpiFloor: number | null;
  cpiCeiling: number | null;
  
  securityDeposit: number | null;
  letterOfCreditAmount: number | null;
  guarantorName: string | null;
  guarantorType: string | null;
  
  percentageRentRate: number | null;
  naturalBreakpoint: number | null;
  artificialBreakpoint: number | null;
  salesReportingFrequency: string | null;
  
  estimatedCamPerSF: number | null;
  estimatedTaxPerSF: number | null;
  estimatedInsurancePerSF: number | null;
  totalEstimatedNNN: number | null;
  camCapPercent: number | null;
  baseYearExpenses: number | null;
  baseYear: number | null;
  
  renewalOptions: number | null;
  renewalTermYears: number | null;
  renewalNoticeMonths: number | null;
  renewalRentTerms: string | null;
  
  hasTerminationOption: boolean;
  terminationOptionDate: string | null;
  terminationFee: number | null;
  terminationNoticeMonths: number | null;
  
  hasExpansionOption: boolean;
  rofrSquareFootage: number | null;
  
  hasOpeningCoTenancy: boolean;
  openingCoTenancyRequirements: string | null;
  hasOperatingCoTenancy: boolean;
  operatingCoTenancyRequirements: string | null;
  coTenancyRemedies: string | null;
  
  requiredOperatingHours: string | null;
  canGoDark: boolean;
  exclusiveUseClause: string | null;
  signageRights: string | null;
  parkingSpaces: number | null;
  
  tiAllowance: number | null;
  tiAllowancePerSF: number | null;
  tiDeliveryCondition: string | null;
  
  requiredLiabilityLimit: number | null;
  requiredPropertyLimit: number | null;
}

export interface LeaseParseResult {
  success: boolean;
  fileType: 'csv' | 'excel' | 'pdf';
  extractionMethod: 'direct' | 'ocr' | 'ai';
  confidence: 'high' | 'medium' | 'low';
  leases: ParsedLeaseAbstract[];
  fields: LeaseAbstractField[];
  warnings: string[];
  errors: string[];
  metadata: {
    totalLeases: number;
    pageCount?: number;
    ocrConfidence?: number;
    aiPowered: boolean;
    processingTimeMs: number;
  };
  rawText?: string;
}

const LEASE_FIELD_PATTERNS: Record<string, RegExp[]> = {
  tenantName: [/tenant\s*(?:name)?/i, /lessee/i, /occupant/i],
  tradeName: [/trade\s*name/i, /dba/i, /doing\s*business/i],
  squareFootage: [/square\s*(?:feet|footage|ft)/i, /sf\b/i, /rentable\s*area/i, /premises\s*area/i],
  proRataShare: [/pro\s*rata/i, /proportionate\s*share/i, /tenant(?:'s)?\s*share/i],
  
  leaseCommencementDate: [/commencement\s*date/i, /lease\s*start/i, /term\s*commence/i],
  leaseExpirationDate: [/expir(?:ation|y)\s*date/i, /lease\s*end/i, /term\s*end/i],
  
  baseRent: [/base\s*rent/i, /minimum\s*rent/i, /fixed\s*rent/i],
  rentPerSF: [/rent\s*per\s*(?:sf|square)/i, /\$[\d.]+\/sf/i],
  
  escalation: [/escalation/i, /annual\s*increase/i, /rent\s*increase/i, /step\s*up/i],
  cpi: [/cpi/i, /consumer\s*price\s*index/i, /cost\s*of\s*living/i],
  
  securityDeposit: [/security\s*deposit/i, /deposit\s*amount/i],
  letterOfCredit: [/letter\s*of\s*credit/i, /loc\b/i, /l\/c/i],
  
  percentageRent: [/percentage\s*rent/i, /overage\s*rent/i, /%\s*rent/i],
  breakpoint: [/breakpoint/i, /sales\s*threshold/i, /natural\s*breakpoint/i],
  
  cam: [/cam\b/i, /common\s*area\s*maint/i, /operating\s*expenses/i],
  nnn: [/nnn\b/i, /triple\s*net/i, /net\s*net\s*net/i],
  taxes: [/(?:real\s*)?(?:property\s*)?tax(?:es)?/i],
  insurance: [/insurance/i],
  
  renewal: [/renewal\s*option/i, /option\s*to\s*renew/i, /extension\s*option/i],
  termination: [/termination\s*(?:option|right)/i, /early\s*termination/i, /kick\s*out/i],
  expansion: [/expansion\s*(?:option|right)/i, /rofr/i, /right\s*of\s*first\s*refusal/i],
  
  coTenancy: [/co-?tenancy/i, /anchor\s*tenant/i],
  exclusiveUse: [/exclusive\s*(?:use)?/i, /use\s*restriction/i],
  
  tiAllowance: [/ti\s*allowance/i, /tenant\s*improvement/i, /build\s*out/i],
};

export class CommercialLeaseParser {
  async parseDocument(
    buffer: Buffer,
    fileName: string,
    options: {
      useAI?: boolean;
      skipAIOnError?: boolean;
    } = {}
  ): Promise<LeaseParseResult> {
    const startTime = Date.now();
    const ext = fileName.toLowerCase().split('.').pop() || '';
    
    try {
      let result: LeaseParseResult;
      
      switch (ext) {
        case 'csv':
          result = await this.parseCSV(buffer, fileName);
          break;
        case 'xlsx':
        case 'xls':
          result = await this.parseExcel(buffer, fileName);
          break;
        case 'pdf':
          result = await this.parsePDF(buffer, fileName, options.useAI !== false);
          break;
        default:
          result = {
            success: false,
            fileType: 'csv',
            extractionMethod: 'direct',
            confidence: 'low',
            leases: [],
            fields: [],
            warnings: [],
            errors: [`Unsupported file type: ${ext}`],
            metadata: { totalLeases: 0, aiPowered: false, processingTimeMs: 0 },
          };
      }
      
      result.metadata.processingTimeMs = Date.now() - startTime;
      return result;
    } catch (error: any) {
      console.error(`[CommercialLeaseParser] Error parsing ${fileName}:`, error);
      return {
        success: false,
        fileType: ext as any,
        extractionMethod: 'direct',
        confidence: 'low',
        leases: [],
        fields: [],
        warnings: [],
        errors: [error.message || 'Unknown parsing error'],
        metadata: { totalLeases: 0, aiPowered: false, processingTimeMs: Date.now() - startTime },
      };
    }
  }

  private async parseCSV(buffer: Buffer, fileName: string): Promise<LeaseParseResult> {
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
    
    const rows = parseResult.data as Record<string, string>[];
    const leases = this.mapRowsToLeases(rows, parseResult.meta.fields || []);
    
    return {
      success: true,
      fileType: 'csv',
      extractionMethod: 'direct',
      confidence: leases.length > 0 ? 'high' : 'low',
      leases,
      fields: this.extractFieldsFromRows(rows),
      warnings,
      errors: [],
      metadata: { totalLeases: leases.length, aiPowered: false, processingTimeMs: 0 },
    };
  }

  private async parseExcel(buffer: Buffer, fileName: string): Promise<LeaseParseResult> {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    const data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { header: 1 });
    
    if (data.length < 2) {
      return {
        success: false,
        fileType: 'excel',
        extractionMethod: 'direct',
        confidence: 'low',
        leases: [],
        fields: [],
        warnings: [],
        errors: ['No data found in spreadsheet'],
        metadata: { totalLeases: 0, aiPowered: false, processingTimeMs: 0 },
      };
    }
    
    const headers = (data[0] as any[]).map(h => String(h || '').trim());
    const rows = data.slice(1).map(row => {
      const obj: Record<string, string> = {};
      headers.forEach((header, idx) => {
        obj[header] = String((row as any[])[idx] ?? '');
      });
      return obj;
    });
    
    const leases = this.mapRowsToLeases(rows, headers);
    
    return {
      success: true,
      fileType: 'excel',
      extractionMethod: 'direct',
      confidence: leases.length > 0 ? 'high' : 'medium',
      leases,
      fields: this.extractFieldsFromRows(rows),
      warnings: [],
      errors: [],
      metadata: { totalLeases: leases.length, aiPowered: false, processingTimeMs: 0 },
    };
  }

  private async parsePDF(buffer: Buffer, fileName: string, useAI: boolean): Promise<LeaseParseResult> {
    const ocrResult = await parseOcrPdf(buffer, fileName);
    
    if (!ocrResult.success || !ocrResult.text) {
      return {
        success: false,
        fileType: 'pdf',
        extractionMethod: 'ocr',
        confidence: 'low',
        leases: [],
        fields: [],
        warnings: ocrResult.warnings || [],
        errors: ocrResult.errors || ['Failed to extract text from PDF'],
        metadata: { 
          totalLeases: 0, 
          aiPowered: false, 
          processingTimeMs: 0,
          pageCount: ocrResult.pageCount,
          ocrConfidence: ocrResult.confidence,
        },
        rawText: ocrResult.text,
      };
    }

    if (useAI && AI_ENABLED) {
      try {
        const aiResult = await this.extractWithAI(ocrResult.text);
        return {
          success: true,
          fileType: 'pdf',
          extractionMethod: 'ai',
          confidence: 'high',
          leases: [aiResult],
          fields: this.leaseToFields(aiResult),
          warnings: [],
          errors: [],
          metadata: { 
            totalLeases: 1, 
            aiPowered: true, 
            processingTimeMs: 0,
            pageCount: ocrResult.pageCount,
            ocrConfidence: ocrResult.confidence,
          },
          rawText: ocrResult.text,
        };
      } catch (error: any) {
        console.error('[CommercialLeaseParser] AI extraction failed:', error);
        return {
          success: true,
          fileType: 'pdf',
          extractionMethod: 'ocr',
          confidence: 'low',
          leases: [],
          fields: this.extractFieldsFromText(ocrResult.text),
          warnings: ['AI extraction failed, showing raw extracted fields'],
          errors: [],
          metadata: { 
            totalLeases: 0, 
            aiPowered: false, 
            processingTimeMs: 0,
            pageCount: ocrResult.pageCount,
          },
          rawText: ocrResult.text,
        };
      }
    }
    
    const heuristicResult = this.extractWithHeuristics(ocrResult.text);
    return {
      success: true,
      fileType: 'pdf',
      extractionMethod: 'ocr',
      confidence: 'medium',
      leases: heuristicResult ? [heuristicResult] : [],
      fields: this.extractFieldsFromText(ocrResult.text),
      warnings: useAI && !AI_ENABLED ? ['AI extraction unavailable - using heuristic extraction'] : [],
      errors: [],
      metadata: { 
        totalLeases: heuristicResult ? 1 : 0, 
        aiPowered: false, 
        processingTimeMs: 0,
        pageCount: ocrResult.pageCount,
        ocrConfidence: ocrResult.confidence,
      },
      rawText: ocrResult.text,
    };
  }

  private async extractWithAI(text: string): Promise<ParsedLeaseAbstract> {
    const systemPrompt = `You are an expert commercial real estate lease abstractor. Extract key lease terms from the provided document text into a structured JSON format.

Focus on extracting:
1. Tenant information (name, trade name, suite)
2. Space details (square footage, pro-rata share)
3. Lease dates (commencement, expiration, rent start)
4. Financial terms (base rent, escalations, percentage rent)
5. Operating expenses (CAM, taxes, insurance, NNN)
6. Options (renewal, termination, expansion)
7. Special provisions (co-tenancy, exclusive use, TI allowance)

For monetary values, extract as numbers without currency symbols.
For percentages, convert to decimal (e.g., 3% becomes 0.03).
For dates, use YYYY-MM-DD format.
Return null for fields not found in the document.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Extract lease abstract data from this document:\n\n${text.substring(0, 15000)}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content);
    return this.normalizeAIResponse(parsed);
  }

  private normalizeAIResponse(parsed: any): ParsedLeaseAbstract {
    const getNumber = (val: any): number | null => {
      if (val === null || val === undefined) return null;
      const num = typeof val === 'string' ? parseFloat(val.replace(/[$,]/g, '')) : Number(val);
      return isNaN(num) ? null : num;
    };

    const getString = (val: any): string | null => {
      if (val === null || val === undefined || val === '') return null;
      return String(val);
    };

    const getDate = (val: any): string | null => {
      if (!val) return null;
      try {
        const date = new Date(val);
        return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
      } catch {
        return null;
      }
    };

    return {
      tenantName: getString(parsed.tenantName || parsed.tenant_name || parsed.tenant),
      tradeName: getString(parsed.tradeName || parsed.trade_name || parsed.dba),
      suiteNumber: getString(parsed.suiteNumber || parsed.suite_number || parsed.suite || parsed.unit),
      squareFootage: getNumber(parsed.squareFootage || parsed.square_footage || parsed.sf || parsed.sqft),
      proRataShare: getNumber(parsed.proRataShare || parsed.pro_rata_share),
      permittedUse: getString(parsed.permittedUse || parsed.permitted_use || parsed.use),
      
      leaseExecutionDate: getDate(parsed.leaseExecutionDate || parsed.lease_execution_date || parsed.execution_date),
      leaseCommencementDate: getDate(parsed.leaseCommencementDate || parsed.lease_commencement_date || parsed.commencement_date || parsed.start_date),
      rentStartDate: getDate(parsed.rentStartDate || parsed.rent_start_date),
      leaseExpirationDate: getDate(parsed.leaseExpirationDate || parsed.lease_expiration_date || parsed.expiration_date || parsed.end_date),
      
      leaseType: this.normalizeLeaseType(parsed.leaseType || parsed.lease_type),
      rentStructure: this.normalizeRentStructure(parsed.rentStructure || parsed.rent_structure),
      
      currentBaseRent: getNumber(parsed.currentBaseRent || parsed.current_base_rent || parsed.base_rent || parsed.annual_rent),
      baseRentPerSF: getNumber(parsed.baseRentPerSF || parsed.base_rent_per_sf || parsed.rent_per_sf),
      rentFreePeriodMonths: getNumber(parsed.rentFreePeriodMonths || parsed.rent_free_period_months || parsed.free_rent_months),
      
      escalationType: this.normalizeEscalationType(parsed.escalationType || parsed.escalation_type),
      escalationRate: getNumber(parsed.escalationRate || parsed.escalation_rate || parsed.annual_increase_rate),
      escalationAmount: getNumber(parsed.escalationAmount || parsed.escalation_amount),
      escalationFrequency: getNumber(parsed.escalationFrequency || parsed.escalation_frequency) || 12,
      cpiIndex: getString(parsed.cpiIndex || parsed.cpi_index),
      cpiFloor: getNumber(parsed.cpiFloor || parsed.cpi_floor),
      cpiCeiling: getNumber(parsed.cpiCeiling || parsed.cpi_ceiling || parsed.cpi_cap),
      
      securityDeposit: getNumber(parsed.securityDeposit || parsed.security_deposit),
      letterOfCreditAmount: getNumber(parsed.letterOfCreditAmount || parsed.letter_of_credit_amount || parsed.loc_amount),
      guarantorName: getString(parsed.guarantorName || parsed.guarantor_name || parsed.guarantor),
      guarantorType: getString(parsed.guarantorType || parsed.guarantor_type),
      
      percentageRentRate: getNumber(parsed.percentageRentRate || parsed.percentage_rent_rate || parsed.overage_rate),
      naturalBreakpoint: getNumber(parsed.naturalBreakpoint || parsed.natural_breakpoint),
      artificialBreakpoint: getNumber(parsed.artificialBreakpoint || parsed.artificial_breakpoint || parsed.breakpoint),
      salesReportingFrequency: getString(parsed.salesReportingFrequency || parsed.sales_reporting_frequency),
      
      estimatedCamPerSF: getNumber(parsed.estimatedCamPerSF || parsed.estimated_cam_per_sf || parsed.cam_per_sf),
      estimatedTaxPerSF: getNumber(parsed.estimatedTaxPerSF || parsed.estimated_tax_per_sf || parsed.tax_per_sf),
      estimatedInsurancePerSF: getNumber(parsed.estimatedInsurancePerSF || parsed.estimated_insurance_per_sf || parsed.insurance_per_sf),
      totalEstimatedNNN: getNumber(parsed.totalEstimatedNNN || parsed.total_estimated_nnn || parsed.total_nnn),
      camCapPercent: getNumber(parsed.camCapPercent || parsed.cam_cap_percent || parsed.cam_cap),
      baseYearExpenses: getNumber(parsed.baseYearExpenses || parsed.base_year_expenses),
      baseYear: getNumber(parsed.baseYear || parsed.base_year),
      
      renewalOptions: getNumber(parsed.renewalOptions || parsed.renewal_options || parsed.number_of_renewals),
      renewalTermYears: getNumber(parsed.renewalTermYears || parsed.renewal_term_years),
      renewalNoticeMonths: getNumber(parsed.renewalNoticeMonths || parsed.renewal_notice_months),
      renewalRentTerms: getString(parsed.renewalRentTerms || parsed.renewal_rent_terms),
      
      hasTerminationOption: Boolean(parsed.hasTerminationOption || parsed.has_termination_option || parsed.termination_option),
      terminationOptionDate: getDate(parsed.terminationOptionDate || parsed.termination_option_date),
      terminationFee: getNumber(parsed.terminationFee || parsed.termination_fee),
      terminationNoticeMonths: getNumber(parsed.terminationNoticeMonths || parsed.termination_notice_months),
      
      hasExpansionOption: Boolean(parsed.hasExpansionOption || parsed.has_expansion_option || parsed.expansion_option),
      rofrSquareFootage: getNumber(parsed.rofrSquareFootage || parsed.rofr_square_footage),
      
      hasOpeningCoTenancy: Boolean(parsed.hasOpeningCoTenancy || parsed.has_opening_co_tenancy),
      openingCoTenancyRequirements: getString(parsed.openingCoTenancyRequirements || parsed.opening_co_tenancy_requirements),
      hasOperatingCoTenancy: Boolean(parsed.hasOperatingCoTenancy || parsed.has_operating_co_tenancy),
      operatingCoTenancyRequirements: getString(parsed.operatingCoTenancyRequirements || parsed.operating_co_tenancy_requirements),
      coTenancyRemedies: getString(parsed.coTenancyRemedies || parsed.co_tenancy_remedies),
      
      requiredOperatingHours: getString(parsed.requiredOperatingHours || parsed.required_operating_hours || parsed.operating_hours),
      canGoDark: Boolean(parsed.canGoDark || parsed.can_go_dark),
      exclusiveUseClause: getString(parsed.exclusiveUseClause || parsed.exclusive_use_clause || parsed.exclusive_use),
      signageRights: getString(parsed.signageRights || parsed.signage_rights || parsed.signage),
      parkingSpaces: getNumber(parsed.parkingSpaces || parsed.parking_spaces || parsed.parking),
      
      tiAllowance: getNumber(parsed.tiAllowance || parsed.ti_allowance || parsed.tenant_improvement_allowance),
      tiAllowancePerSF: getNumber(parsed.tiAllowancePerSF || parsed.ti_allowance_per_sf),
      tiDeliveryCondition: getString(parsed.tiDeliveryCondition || parsed.ti_delivery_condition || parsed.delivery_condition),
      
      requiredLiabilityLimit: getNumber(parsed.requiredLiabilityLimit || parsed.required_liability_limit || parsed.liability_insurance),
      requiredPropertyLimit: getNumber(parsed.requiredPropertyLimit || parsed.required_property_limit || parsed.property_insurance),
    };
  }

  private normalizeLeaseType(val: any): ParsedLeaseAbstract['leaseType'] {
    if (!val) return null;
    const v = String(val).toLowerCase();
    if (v.includes('triple') || v === 'nnn') return 'nnn';
    if (v.includes('modified')) return 'modified_gross';
    if (v.includes('full') || v.includes('gross')) return 'full_service';
    if (v.includes('absolute')) return 'absolute_net';
    if (v.includes('double') || v === 'nn') return 'double_net';
    return null;
  }

  private normalizeRentStructure(val: any): ParsedLeaseAbstract['rentStructure'] {
    if (!val) return null;
    const v = String(val).toLowerCase();
    if (v.includes('percentage') && v.includes('base')) return 'base_plus_percentage';
    if (v.includes('percentage')) return 'percentage_only';
    return 'base_only';
  }

  private normalizeEscalationType(val: any): ParsedLeaseAbstract['escalationType'] {
    if (!val) return null;
    const v = String(val).toLowerCase();
    if (v.includes('cpi') || v.includes('index')) return 'cpi';
    if (v.includes('percent')) return 'fixed_percent';
    if (v.includes('dollar') || v.includes('fixed')) return 'fixed_dollar';
    if (v.includes('market') || v.includes('fmv')) return 'fair_market_value';
    if (v.includes('none') || v.includes('flat')) return 'none';
    return null;
  }

  private extractWithHeuristics(text: string): ParsedLeaseAbstract | null {
    const findPattern = (patterns: RegExp[], searchText: string): string | null => {
      for (const pattern of patterns) {
        const match = searchText.match(pattern);
        if (match) return match[0];
      }
      return null;
    };

    const findNumberAfter = (patterns: RegExp[], searchText: string): number | null => {
      for (const pattern of patterns) {
        const idx = searchText.search(pattern);
        if (idx >= 0) {
          const afterText = searchText.substring(idx, idx + 200);
          const numMatch = afterText.match(/\$?([\d,]+(?:\.\d{2})?)/);
          if (numMatch) {
            return parseFloat(numMatch[1].replace(/,/g, ''));
          }
        }
      }
      return null;
    };

    return {
      tenantName: null,
      tradeName: null,
      suiteNumber: null,
      squareFootage: findNumberAfter(LEASE_FIELD_PATTERNS.squareFootage, text),
      proRataShare: null,
      permittedUse: null,
      
      leaseExecutionDate: null,
      leaseCommencementDate: null,
      rentStartDate: null,
      leaseExpirationDate: null,
      
      leaseType: null,
      rentStructure: null,
      
      currentBaseRent: findNumberAfter(LEASE_FIELD_PATTERNS.baseRent, text),
      baseRentPerSF: null,
      rentFreePeriodMonths: null,
      
      escalationType: null,
      escalationRate: null,
      escalationAmount: null,
      escalationFrequency: null,
      cpiIndex: null,
      cpiFloor: null,
      cpiCeiling: null,
      
      securityDeposit: findNumberAfter(LEASE_FIELD_PATTERNS.securityDeposit, text),
      letterOfCreditAmount: null,
      guarantorName: null,
      guarantorType: null,
      
      percentageRentRate: null,
      naturalBreakpoint: null,
      artificialBreakpoint: null,
      salesReportingFrequency: null,
      
      estimatedCamPerSF: null,
      estimatedTaxPerSF: null,
      estimatedInsurancePerSF: null,
      totalEstimatedNNN: findNumberAfter(LEASE_FIELD_PATTERNS.nnn, text),
      camCapPercent: null,
      baseYearExpenses: null,
      baseYear: null,
      
      renewalOptions: null,
      renewalTermYears: null,
      renewalNoticeMonths: null,
      renewalRentTerms: null,
      
      hasTerminationOption: LEASE_FIELD_PATTERNS.termination.some(p => p.test(text)),
      terminationOptionDate: null,
      terminationFee: null,
      terminationNoticeMonths: null,
      
      hasExpansionOption: LEASE_FIELD_PATTERNS.expansion.some(p => p.test(text)),
      rofrSquareFootage: null,
      
      hasOpeningCoTenancy: false,
      openingCoTenancyRequirements: null,
      hasOperatingCoTenancy: LEASE_FIELD_PATTERNS.coTenancy.some(p => p.test(text)),
      operatingCoTenancyRequirements: null,
      coTenancyRemedies: null,
      
      requiredOperatingHours: null,
      canGoDark: false,
      exclusiveUseClause: LEASE_FIELD_PATTERNS.exclusiveUse.some(p => p.test(text)) ? 'See document' : null,
      signageRights: null,
      parkingSpaces: null,
      
      tiAllowance: findNumberAfter(LEASE_FIELD_PATTERNS.tiAllowance, text),
      tiAllowancePerSF: null,
      tiDeliveryCondition: null,
      
      requiredLiabilityLimit: null,
      requiredPropertyLimit: null,
    };
  }

  private mapRowsToLeases(rows: Record<string, string>[], headers: string[]): ParsedLeaseAbstract[] {
    const columnMap = this.detectColumnMapping(headers);
    
    return rows.filter(row => Object.values(row).some(v => v && v.trim())).map(row => {
      const getValue = (field: string): string | null => {
        const col = columnMap[field];
        return col ? row[col] || null : null;
      };

      const getNumber = (field: string): number | null => {
        const val = getValue(field);
        if (!val) return null;
        const num = parseFloat(val.replace(/[$,]/g, ''));
        return isNaN(num) ? null : num;
      };

      return {
        tenantName: getValue('tenantName'),
        tradeName: getValue('tradeName'),
        suiteNumber: getValue('suiteNumber'),
        squareFootage: getNumber('squareFootage'),
        proRataShare: getNumber('proRataShare'),
        permittedUse: getValue('permittedUse'),
        
        leaseExecutionDate: getValue('leaseExecutionDate'),
        leaseCommencementDate: getValue('leaseCommencementDate'),
        rentStartDate: getValue('rentStartDate'),
        leaseExpirationDate: getValue('leaseExpirationDate'),
        
        leaseType: null,
        rentStructure: null,
        
        currentBaseRent: getNumber('currentBaseRent'),
        baseRentPerSF: getNumber('baseRentPerSF'),
        rentFreePeriodMonths: null,
        
        escalationType: null,
        escalationRate: getNumber('escalationRate'),
        escalationAmount: null,
        escalationFrequency: null,
        cpiIndex: null,
        cpiFloor: null,
        cpiCeiling: null,
        
        securityDeposit: getNumber('securityDeposit'),
        letterOfCreditAmount: null,
        guarantorName: null,
        guarantorType: null,
        
        percentageRentRate: getNumber('percentageRentRate'),
        naturalBreakpoint: null,
        artificialBreakpoint: null,
        salesReportingFrequency: null,
        
        estimatedCamPerSF: getNumber('estimatedCamPerSF'),
        estimatedTaxPerSF: getNumber('estimatedTaxPerSF'),
        estimatedInsurancePerSF: getNumber('estimatedInsurancePerSF'),
        totalEstimatedNNN: getNumber('totalEstimatedNNN'),
        camCapPercent: null,
        baseYearExpenses: null,
        baseYear: null,
        
        renewalOptions: null,
        renewalTermYears: null,
        renewalNoticeMonths: null,
        renewalRentTerms: null,
        
        hasTerminationOption: false,
        terminationOptionDate: null,
        terminationFee: null,
        terminationNoticeMonths: null,
        
        hasExpansionOption: false,
        rofrSquareFootage: null,
        
        hasOpeningCoTenancy: false,
        openingCoTenancyRequirements: null,
        hasOperatingCoTenancy: false,
        operatingCoTenancyRequirements: null,
        coTenancyRemedies: null,
        
        requiredOperatingHours: null,
        canGoDark: false,
        exclusiveUseClause: null,
        signageRights: null,
        parkingSpaces: null,
        
        tiAllowance: getNumber('tiAllowance'),
        tiAllowancePerSF: null,
        tiDeliveryCondition: null,
        
        requiredLiabilityLimit: null,
        requiredPropertyLimit: null,
      };
    });
  }

  private detectColumnMapping(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};
    
    for (const header of headers) {
      const lowerHeader = header.toLowerCase();
      
      for (const [fieldName, patterns] of Object.entries(LEASE_FIELD_PATTERNS)) {
        if (patterns.some(p => p.test(lowerHeader))) {
          mapping[fieldName] = header;
          break;
        }
      }
    }
    
    return mapping;
  }

  private extractFieldsFromRows(rows: Record<string, string>[]): LeaseAbstractField[] {
    if (rows.length === 0) return [];
    
    const headers = Object.keys(rows[0]);
    return headers.map(header => ({
      fieldName: header,
      value: rows[0][header],
      confidence: 'high' as const,
      rawText: rows.slice(0, 3).map(r => r[header]).join(', '),
    }));
  }

  private extractFieldsFromText(text: string): LeaseAbstractField[] {
    const fields: LeaseAbstractField[] = [];
    
    for (const [fieldName, patterns] of Object.entries(LEASE_FIELD_PATTERNS)) {
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          const idx = match.index || 0;
          const context = text.substring(idx, Math.min(idx + 200, text.length));
          fields.push({
            fieldName,
            value: null,
            confidence: 'medium',
            sourceLocation: `Character ${idx}`,
            rawText: context,
          });
          break;
        }
      }
    }
    
    return fields;
  }

  private leaseToFields(lease: ParsedLeaseAbstract): LeaseAbstractField[] {
    const fields: LeaseAbstractField[] = [];
    
    for (const [key, value] of Object.entries(lease)) {
      if (value !== null && value !== undefined) {
        fields.push({
          fieldName: key,
          value,
          confidence: 'high',
        });
      }
    }
    
    return fields;
  }
}

export const commercialLeaseParser = new CommercialLeaseParser();
