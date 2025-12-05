import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface MappingSuggestion {
  targetField: string;
  confidence: number;
  reasons: string[];
  alternatives: Array<{ field: string; confidence: number }>;
}

export interface FileAnalysis {
  headers: string[];
  sampleRows: Record<string, any>[];
  estimatedRows: number;
  suggestedMapping: Record<string, string>;
  mappingSuggestions: Record<string, MappingSuggestion>;
  columnTypes: Record<string, string>;
  dataQuality: Record<string, {
    completeness: number; // 0-1 (% of non-null values)
    consistency: number; // 0-1 (how consistent the format is)
    examples: string[];
    warnings: string[];
  }>;
}

export interface NormalizationOptions {
  currency: boolean;
  months: boolean;
  states: boolean;
  undisclosed: boolean;
}

export class ParserService {
  private readonly monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];

  private readonly standardFields = new Map([
    ['marina', {
      patterns: ['marina', 'marina_name', 'name', 'property', 'property_name', 'facility', 'venue'],
      keywords: ['marina', 'harbor', 'yacht', 'boat', 'dock', 'port'],
      type: 'text',
      required: true,
      description: 'Marina or facility name'
    }],
    ['salePrice', {
      patterns: ['sale_price', 'price', 'sale_amount', 'amount', 'cost', 'value', 'purchase_price'],
      keywords: ['sale', 'sold', 'price', 'cost', 'value', 'purchase'],
      type: 'currency',
      required: false,
      description: 'Final sale price'
    }],
    ['capRate', {
      patterns: ['cap_rate', 'cap', 'rate', 'return', 'yield', 'cap_rt'],
      keywords: ['cap', 'rate', 'return', 'yield', 'percent'],
      type: 'percent',
      required: false,
      description: 'Capitalization rate'
    }],
    ['noi', {
      patterns: ['noi', 'net_operating_income', 'income', 'operating_income', 'net_income'],
      keywords: ['noi', 'income', 'operating', 'net', 'revenue'],
      type: 'currency',
      required: false,
      description: 'Net Operating Income'
    }],
    ['saleMonth', {
      patterns: ['sale_month', 'month', 'close_month', 'closing_month', 'sold_month'],
      keywords: ['month', 'close', 'closing', 'sold', 'sale'],
      type: 'month',
      required: false,
      description: 'Month of sale'
    }],
    ['saleYear', {
      patterns: ['sale_year', 'year', 'close_year', 'closing_year', 'sold_year'],
      keywords: ['year', 'close', 'closing', 'sold', 'sale'],
      type: 'number',
      required: false,
      description: 'Year of sale'
    }],
    ['city', {
      patterns: ['city', 'market', 'location', 'area', 'metro', 'msa'],
      keywords: ['city', 'market', 'location', 'area', 'metro'],
      type: 'text',
      required: false,
      description: 'Market or city location'
    }],
    ['state', {
      patterns: ['state', 'st', 'province', 'region', 'territory'],
      keywords: ['state', 'province', 'territory'],
      type: 'state',
      required: false,
      description: 'State or province'
    }],
    ['wetSlips', {
      patterns: ['wet_slips', 'slips', 'wet_docks', 'docks', 'boat_slips', 'wet_berths'],
      keywords: ['wet', 'slip', 'dock', 'berth', 'mooring'],
      type: 'number',
      required: false,
      description: 'Number of wet slips'
    }],
    ['dryRacks', {
      patterns: ['dry_racks', 'racks', 'dry_storage', 'storage', 'dry_stack', 'boat_storage'],
      keywords: ['dry', 'rack', 'storage', 'stack'],
      type: 'number',
      required: false,
      description: 'Number of dry storage racks'
    }],
    ['ioBoth', {
      patterns: ['inside_outside_both', 'storage_type', 'type', 'io_both', 'location_type'],
      keywords: ['inside', 'outside', 'storage', 'location', 'type'],
      type: 'text',
      required: false,
      description: 'Storage location type (inside/outside/both)'
    }],
    ['bodyOfWater', {
      patterns: ['body_of_water', 'water', 'waterway', 'lake', 'river', 'ocean', 'bay'],
      keywords: ['water', 'lake', 'river', 'ocean', 'bay', 'sea', 'sound'],
      type: 'text',
      required: false,
      description: 'Body of water location'
    }],
    ['waterfront', {
      patterns: ['waterfront', 'water_access', 'frontage', 'shoreline'],
      keywords: ['waterfront', 'frontage', 'shoreline', 'access'],
      type: 'text',
      required: false,
      description: 'Waterfront access type'
    }],
    ['region', {
      patterns: ['region', 'district', 'zone', 'area_code', 'territory'],
      keywords: ['region', 'district', 'zone', 'territory'],
      type: 'text',
      required: false,
      description: 'Geographic region'
    }],
    ['saleCondition', {
      patterns: ['sale_condition', 'condition', 'terms', 'sale_terms'],
      keywords: ['condition', 'terms', 'as-is', 'renovated'],
      type: 'text',
      required: false,
      description: 'Sale conditions or terms'
    }],
    ['daysOnMarket', {
      patterns: ['days_on_market', 'dom', 'marketing_time', 'time_on_market', 'marketing_period'],
      keywords: ['days', 'market', 'marketing', 'time', 'period'],
      type: 'number',
      required: false,
      description: 'Days on market'
    }],
    ['broker', {
      patterns: ['broker', 'agent', 'listing_agent', 'realtor', 'representative'],
      keywords: ['broker', 'agent', 'realtor', 'representative'],
      type: 'text',
      required: false,
      description: 'Listing broker or agent (legacy field)'
    }],
    ['brokerage', {
      patterns: ['brokerage', 'brokerage_company', 'broker_company', 'brokerage_firm', 'real_estate_firm'],
      keywords: ['brokerage', 'company', 'firm', 'broker'],
      type: 'text',
      required: false,
      description: 'Brokerage company name'
    }],
    ['agentFirstName', {
      patterns: ['agent_first_name', 'agent_first', 'broker_first_name', 'broker_first', 'agent_fname'],
      keywords: ['agent', 'first', 'name', 'broker', 'fname'],
      type: 'text',
      required: false,
      description: 'Agent first name'
    }],
    ['agentLastName', {
      patterns: ['agent_last_name', 'agent_last', 'broker_last_name', 'broker_last', 'agent_lname'],
      keywords: ['agent', 'last', 'name', 'broker', 'lname'],
      type: 'text',
      required: false,
      description: 'Agent last name'
    }],
    ['address', {
      patterns: ['address', 'location', 'street', 'street_address', 'physical_address'],
      keywords: ['address', 'street', 'location', 'physical'],
      type: 'text',
      required: false,
      description: 'Property address'
    }],
    ['zip', {
      patterns: ['zip', 'zipcode', 'postal_code', 'zip_code', 'postcode'],
      keywords: ['zip', 'postal', 'code'],
      type: 'text',
      required: false,
      description: 'Postal/ZIP code'
    }],
    ['seller', {
      patterns: ['seller', 'vendor', 'owner', 'previous_owner'],
      keywords: ['seller', 'vendor', 'owner', 'previous'],
      type: 'text',
      required: false,
      description: 'Seller name'
    }],
    ['company', {
      patterns: ['company', 'firm', 'corporation', 'llc', 'inc', 'business'],
      keywords: ['company', 'firm', 'corp', 'llc', 'inc', 'business'],
      type: 'text',
      required: false,
      description: 'Company or business entity'
    }],
    ['owner', {
      patterns: ['owner', 'proprietor', 'current_owner', 'new_owner'],
      keywords: ['owner', 'proprietor', 'current', 'new'],
      type: 'text',
      required: false,
      description: 'Property owner'
    }],
    ['listPrice', {
      patterns: ['list_price', 'asking_price', 'listed_price', 'original_price', 'listing_price'],
      keywords: ['list', 'asking', 'listed', 'original', 'initial'],
      type: 'currency',
      required: false,
      description: 'Original listing price'
    }],
    ['acres', {
      patterns: ['acres', 'acreage', 'size', 'land_size', 'property_size'],
      keywords: ['acres', 'acreage', 'size', 'land'],
      type: 'number',
      required: false,
      description: 'Property size in acres'
    }],
    ['occupancy', {
      patterns: ['occupancy', 'occupancy_rate', 'utilization', 'capacity', 'fill_rate'],
      keywords: ['occupancy', 'utilization', 'capacity', 'fill', 'rate'],
      type: 'percent',
      required: false,
      description: 'Occupancy rate'
    }],
    ['yearBuilt', {
      patterns: ['year_built', 'built', 'construction_year', 'built_year', 'constructed'],
      keywords: ['built', 'construction', 'year', 'constructed'],
      type: 'number',
      required: false,
      description: 'Year built or constructed'
    }],
    ['notes', {
      patterns: ['notes', 'comments', 'remarks', 'description', 'details'],
      keywords: ['notes', 'comments', 'remarks', 'description'],
      type: 'text',
      required: false,
      description: 'Additional notes or comments'
    }],
    ['articleUrls', {
      patterns: ['article', 'article.1', 'url', 'link', 'source', 'reference'],
      keywords: ['article', 'url', 'link', 'source', 'reference'],
      type: 'text',
      required: false,
      description: 'Article URLs or references'
    }],
  ]);

  async analyzeFile(file: Express.Multer.File): Promise<FileAnalysis> {
    const isExcel = file.mimetype.includes('sheet') || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls');
    
    let data: any[];
    let headers: string[];

    if (isExcel) {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      headers = jsonData[0] as string[];
      data = (jsonData.slice(1, 201) as any[][]).map((row: any[]) => {
        const obj: Record<string, any> = {};
        headers.forEach((header, idx) => {
          obj[header] = row[idx];
        });
        return obj;
      });
    } else {
      // CSV parsing
      const csvText = file.buffer.toString('utf-8');
      const parseResult = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        preview: 200,
      });
      
      data = parseResult.data as Record<string, any>[];
      headers = parseResult.meta.fields || Object.keys(data[0] || {});
    }

    // Filter out unnamed columns
    const cleanHeaders = headers.filter(h => h && !h.toLowerCase().startsWith('unnamed'));
    
    // Estimate total rows
    const estimatedRows = this.estimateRowCount(file);
    
    // Generate suggested mapping with confidence scoring
    const mappingResult = this.generateEnhancedMapping(cleanHeaders, data);
    
    // Infer column types
    const columnTypes = this.inferColumnTypes(data, cleanHeaders);
    
    // Analyze data quality
    const dataQuality = this.analyzeDataQuality(data, cleanHeaders);
    
    // Get sample rows (first 5)
    const sampleRows = data.slice(0, 5);

    return {
      headers: cleanHeaders,
      sampleRows,
      estimatedRows,
      suggestedMapping: mappingResult.simpleMapping,
      mappingSuggestions: mappingResult.suggestions,
      columnTypes,
      dataQuality,
    };
  }

  async parseFullFile(file: Express.Multer.File): Promise<Record<string, any>[]> {
    const isExcel = file.mimetype.includes('sheet') || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls');
    
    let data: any[];

    if (isExcel) {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      const headers = jsonData[0] as string[];
      data = (jsonData.slice(1) as any[][]).map((row: any[]) => {
        const obj: Record<string, any> = {};
        headers.forEach((header, idx) => {
          obj[header] = row[idx];
        });
        return obj;
      });
    } else {
      // CSV parsing
      const csvText = file.buffer.toString('utf-8');
      const parseResult = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: 'greedy', // Only skip lines that are completely empty (no delimiters)
      });
      
      data = parseResult.data as Record<string, any>[];
    }


    // More lenient filtering - only remove rows that are completely empty or have no meaningful data
    const filteredData = data.filter(row => {
      const values = Object.values(row);
      const nonEmptyValues = values.filter(value => 
        value !== null && 
        value !== undefined && 
        value !== '' &&
        String(value).trim() !== ''
      );
      
      // Keep row if it has at least one meaningful value
      return nonEmptyValues.length > 0;
    });


    return filteredData;
  }

  private estimateRowCount(file: Express.Multer.File): number {
    const isExcel = file.mimetype.includes('sheet') || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls');
    
    if (isExcel) {
      // For Excel files, we need to actually parse the file to get accurate row count
      // since Excel files are binary and can't be counted by newlines
      try {
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Get the range of the sheet to determine row count
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
        const totalRows = range.e.r; // End row (0-indexed), excludes header
        
        return Math.max(0, totalRows);
      } catch (e) {
        // Fallback if parsing fails
        return 0;
      }
    } else {
      // For CSV files, count newlines (faster than full parsing)
      const text = file.buffer.toString('utf-8');
      const lines = text.split('\n').filter(line => line.trim().length > 0).length;
      return Math.max(0, lines - 1); // Subtract header row
    }
  }

  private generateMapping(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};
    
    headers.forEach(header => {
      const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      for (const [standardField, fieldConfig] of Array.from(this.standardFields.entries())) {
        if (fieldConfig.patterns.some((variation: string) => normalizedHeader.includes(variation))) {
          mapping[header] = standardField;
          break;
        }
      }
    });

    return mapping;
  }

  private generateEnhancedMapping(headers: string[], data: Record<string, any>[]): {
    simpleMapping: Record<string, string>;
    suggestions: Record<string, MappingSuggestion>;
  } {
    const simpleMapping: Record<string, string> = {};
    const suggestions: Record<string, MappingSuggestion> = {};

    headers.forEach(header => {
      const result = this.findBestMatch(header, data);
      
      if (result.bestMatch && result.confidence > 0.3) {
        simpleMapping[header] = result.bestMatch;
      }
      
      suggestions[header] = {
        targetField: result.bestMatch || '',
        confidence: result.confidence,
        reasons: result.reasons,
        alternatives: result.alternatives
      };
    });

    return { simpleMapping, suggestions };
  }

  private findBestMatch(header: string, data: Record<string, any>[]): {
    bestMatch: string | null;
    confidence: number;
    reasons: string[];
    alternatives: Array<{ field: string; confidence: number }>;
  } {
    const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const headerWords = header.toLowerCase().split(/[^a-z0-9]+/);
    const alternatives: Array<{ field: string; confidence: number }> = [];
    
    // Sample data from this column to analyze content
    const sampleValues = data.slice(0, 10)
      .map(row => row[header])
      .filter(val => val !== null && val !== undefined && val !== '');

    let bestMatch: string | null = null;
    let bestScore = 0;
    let reasons: string[] = [];

    for (const [fieldKey, fieldConfig] of Array.from(this.standardFields.entries())) {
      let score = 0;
      let fieldReasons: string[] = [];

      // Exact pattern match (highest weight)
      const exactMatch = fieldConfig.patterns.find(pattern => 
        normalizedHeader === pattern || normalizedHeader.includes(pattern)
      );
      if (exactMatch) {
        score += 0.8;
        fieldReasons.push(`Exact pattern match: "${exactMatch}"`);
      }

      // Fuzzy pattern matching
      const fuzzyPatternScore = Math.max(...fieldConfig.patterns.map(pattern =>
        this.fuzzyMatch(normalizedHeader, pattern)
      ));
      if (fuzzyPatternScore > 0.6) {
        score += fuzzyPatternScore * 0.6;
        fieldReasons.push(`Pattern similarity: ${Math.round(fuzzyPatternScore * 100)}%`);
      }

      // Keyword matching in header
      const keywordMatches = fieldConfig.keywords.filter(keyword =>
        headerWords.some(word => this.fuzzyMatch(word, keyword) > 0.8)
      );
      if (keywordMatches.length > 0) {
        score += keywordMatches.length * 0.3;
        fieldReasons.push(`Keyword matches: ${keywordMatches.join(', ')}`);
      }

      // Content-based validation
      if (sampleValues.length > 0) {
        const contentScore = this.validateFieldContent(sampleValues, fieldConfig.type);
        if (contentScore > 0.5) {
          score += contentScore * 0.4;
          fieldReasons.push(`Content matches ${fieldConfig.type} format: ${Math.round(contentScore * 100)}%`);
        }
      }

      // Store alternative if decent match
      if (score > 0.1) {
        alternatives.push({ field: fieldKey, confidence: Math.round(score * 100) / 100 });
      }

      // Update best match
      if (score > bestScore) {
        bestScore = score;
        bestMatch = fieldKey;
        reasons = fieldReasons;
      }
    }

    // Sort alternatives by confidence
    alternatives.sort((a, b) => b.confidence - a.confidence);

    return {
      bestMatch,
      confidence: Math.round(bestScore * 100) / 100,
      reasons,
      alternatives: alternatives.slice(0, 3) // Top 3 alternatives
    };
  }

  private fuzzyMatch(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private validateFieldContent(values: any[], expectedType: string): number {
    if (values.length === 0) return 0;
    
    let matches = 0;
    
    values.forEach(value => {
      const strValue = value?.toString().trim();
      if (!strValue) return;
      
      switch (expectedType) {
        case 'currency':
          if (/^\$?[\d,]+\.?\d*$/.test(strValue) || !isNaN(Number(strValue.replace(/[$,]/g, '')))) {
            matches++;
          }
          break;
        case 'percent':
          if (strValue.includes('%') || (!isNaN(Number(strValue)) && Number(strValue) <= 100)) {
            matches++;
          }
          break;
        case 'number':
          if (!isNaN(Number(strValue))) {
            matches++;
          }
          break;
        case 'month':
          const monthNum = parseInt(strValue);
          if ((monthNum >= 1 && monthNum <= 12) || 
              this.monthNames.some(month => month.toLowerCase().includes(strValue.toLowerCase()))) {
            matches++;
          }
          break;
        case 'state':
          if (strValue.length === 2 || this.isValidStateName(strValue)) {
            matches++;
          }
          break;
        case 'text':
          if (strValue.length > 0) {
            matches++;
          }
          break;
      }
    });
    
    return matches / values.length;
  }

  private isValidStateName(state: string): boolean {
    const stateNames = ['alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming'];
    
    // Common international countries/territories for marina business
    const countries = ['canada', 'costa rica', 'monaco', 'bahamas', 'bermuda', 'mexico', 'france', 'italy', 'spain', 'greece', 'turkey', 'croatia', 'australia', 'new zealand', 'thailand', 'singapore', 'united kingdom', 'uk', 'netherlands', 'germany', 'switzerland', 'austria', 'norway', 'sweden', 'denmark', 'finland', 'portugal', 'malta', 'cyprus', 'caribbean', 'cayman islands', 'british virgin islands', 'virgin islands', 'antigua', 'barbados', 'st. lucia', 'st. maarten', 'martinique', 'guadeloupe', 'panama', 'belize', 'honduras', 'colombia', 'venezuela', 'brazil', 'argentina', 'chile', 'uruguay', 'puerto rico', 'dominican republic', 'jamaica', 'aruba', 'curacao', 'bonaire', 'st. thomas', 'st. john', 'tortola', 'anguilla'];
    
    const normalized = state.toLowerCase().trim();
    return stateNames.includes(normalized) || countries.includes(normalized);
  }

  private analyzeDataQuality(data: Record<string, any>[], headers: string[]): Record<string, {
    completeness: number;
    consistency: number;
    examples: string[];
    warnings: string[];
  }> {
    const quality: Record<string, any> = {};

    headers.forEach(header => {
      const values = data.map(row => row[header]).filter(val => val !== null && val !== undefined && val !== '');
      const allValues = data.map(row => row[header]);
      
      // Completeness: percentage of non-null values
      const completeness = values.length / data.length;
      
      // Consistency: how similar the formats are
      const formats = values.map(val => this.getValueFormat(val?.toString()));
      const uniqueFormats = Array.from(new Set(formats));
      const consistency = uniqueFormats.length <= 2 ? 1 : Math.max(0, 1 - (uniqueFormats.length - 2) * 0.2);
      
      // Examples: up to 3 unique non-null values
      const examples = Array.from(new Set(values.slice(0, 5).map(val => val?.toString()))).slice(0, 3);
      
      // Warnings
      const warnings: string[] = [];
      if (completeness < 0.5) warnings.push('Many missing values');
      if (consistency < 0.7) warnings.push('Inconsistent formatting');
      if (values.length === 0) warnings.push('No data found');
      
      quality[header] = {
        completeness: Math.round(completeness * 100) / 100,
        consistency: Math.round(consistency * 100) / 100,
        examples,
        warnings
      };
    });

    return quality;
  }

  private getValueFormat(value: string): string {
    if (!value) return 'empty';
    if (/^\$?[\d,]+\.?\d*$/.test(value)) return 'currency';
    if (value.includes('%')) return 'percent';
    if (!isNaN(Number(value))) return 'number';
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) return 'date';
    if (value.length <= 5 && /^[A-Z]{2}$/.test(value)) return 'state_code';
    return 'text';
  }

  private inferColumnTypes(data: Record<string, any>[], headers: string[]): Record<string, string> {
    const types: Record<string, string> = {};
    
    headers.forEach(header => {
      const samples = data.slice(0, 10).map(row => row[header]).filter(val => val !== null && val !== undefined && val !== '');
      
      if (samples.length === 0) {
        types[header] = 'text';
        return;
      }

      // Check for currency
      if (samples.some(val => typeof val === 'string' && /^\$?[\d,]+\.?\d*$/.test(val.toString()))) {
        types[header] = 'currency';
        return;
      }

      // Check for percentage
      if (samples.some(val => typeof val === 'string' && val.toString().includes('%'))) {
        types[header] = 'percent';
        return;
      }

      // Check for numbers
      if (samples.every(val => !isNaN(Number(val)))) {
        types[header] = 'number';
        return;
      }

      // Check for months
      if (samples.some(val => this.monthNames.includes(val.toString().toLowerCase()))) {
        types[header] = 'month';
        return;
      }

      types[header] = 'text';
    });

    return types;
  }

  normalizeValue(value: any, type: string, options: NormalizationOptions): any {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const strValue = value.toString().trim();

    // Handle undisclosed values
    if (options.undisclosed && ['undisclosed', 'n/a', 'na', 'not available'].includes(strValue.toLowerCase())) {
      return null;
    }

    switch (type) {
      case 'currency':
        if (!options.currency) return strValue;
        const cleaned = strValue.replace(/[$,]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;

      case 'percent':
        const percentValue = strValue.replace('%', '');
        const percent = parseFloat(percentValue);
        return isNaN(percent) ? null : percent;

      case 'number':
        const numValue = parseFloat(strValue);
        return isNaN(numValue) ? null : numValue;

      case 'month':
        if (!options.months) return strValue;
        const monthIndex = this.monthNames.findIndex(month => 
          month.toLowerCase() === strValue.toLowerCase()
        );
        return monthIndex >= 0 ? monthIndex + 1 : strValue;

      case 'state':
        if (!options.states) return strValue;
        return this.normalizeState(strValue);

      default:
        return strValue;
    }
  }

  private normalizeState(state: string): string {
    const stateMap: Record<string, string> = {
      'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
      'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
      'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
      'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
      'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
      'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
      'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
      'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
      'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
      'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
      'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
      'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
      'wisconsin': 'WI', 'wyoming': 'WY'
    };

    // Common country name normalizations (preserve full names for countries)
    const countryMap: Record<string, string> = {
      'uk': 'United Kingdom',
      'british virgin islands': 'British Virgin Islands',
      'virgin islands': 'Virgin Islands',
      'st. lucia': 'St. Lucia',
      'st. maarten': 'St. Maarten',
      'st. thomas': 'St. Thomas',
      'st. john': 'St. John',
      'costa rica': 'Costa Rica',
      'new zealand': 'New Zealand',
      'united kingdom': 'United Kingdom',
      'cayman islands': 'Cayman Islands',
      'puerto rico': 'Puerto Rico',
      'dominican republic': 'Dominican Republic'
    };

    const normalized = state.toLowerCase().trim();
    
    // First check if it's a US state (convert to 2-letter code)
    if (stateMap[normalized]) {
      return stateMap[normalized];
    }
    
    // Then check if it's a known country (preserve proper case)
    if (countryMap[normalized]) {
      return countryMap[normalized];
    }
    
    // For other countries/territories, return title case
    return state.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }

  async parseStreamingFile(
    file: Express.Multer.File,
    mapping: Record<string, string>,
    normalization: NormalizationOptions,
    onProgress?: (processed: number, total: number) => void
  ): Promise<Record<string, any>[]> {
    const isExcel = file.mimetype.includes('sheet') || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls');
    const results: Record<string, any>[] = [];
    
    if (isExcel) {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      const headers = jsonData[0] as string[];
      const dataRows = jsonData.slice(1) as any[][];
      
      dataRows.forEach((row, index) => {
        // Skip completely empty rows (all cells are null/undefined/empty)
        const hasAnyData = row.some((cell: any) => 
          cell !== null && cell !== undefined && String(cell).trim() !== ''
        );
        
        if (!hasAnyData) {
          return; // Skip this row
        }

        const obj: Record<string, any> = {};
        headers.forEach((header, idx) => {
          const mappedField = mapping[header];
          if (mappedField) {
            const value = row[idx];
            const type = this.inferTypeFromField(mappedField);
            obj[mappedField] = this.normalizeValue(value, type, normalization);
          }
        });
        
        // Include row even if all mapped fields are empty (as long as the row had some data)
        results.push(obj);

        if (onProgress && index % 100 === 0) {
          onProgress(index, dataRows.length);
        }
      });
    } else {
      // Stream CSV parsing
      const csvText = file.buffer.toString('utf-8');
      const parseResult = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transform: (value, header) => {
          const mappedField = mapping[header];
          if (mappedField) {
            const type = this.inferTypeFromField(mappedField);
            return this.normalizeValue(value, type, normalization);
          }
          return value;
        }
      });

      parseResult.data.forEach((row: any, index) => {
        // Skip completely empty rows (all cells are null/undefined/empty)
        // Papa Parse already skips empty lines, but we double-check for rows with all blank values
        const hasAnyData = Object.values(row).some((val: any) => 
          val !== null && val !== undefined && String(val).trim() !== ''
        );
        
        if (!hasAnyData) {
          return; // Skip this row
        }

        const mappedRow: Record<string, any> = {};
        Object.keys(mapping).forEach(sourceHeader => {
          const targetField = mapping[sourceHeader];
          if (targetField && row[sourceHeader] !== undefined) {
            mappedRow[targetField] = row[sourceHeader];
          }
        });

        // Include row even if all mapped fields are empty (as long as the row had some data)
        results.push(mappedRow);

        if (onProgress && index % 100 === 0) {
          onProgress(index, parseResult.data.length);
        }
      });
    }

    return results;
  }

  private inferTypeFromField(fieldName: string): string {
    const currencyFields = ['salePrice', 'listPrice', 'noi'];
    const percentFields = ['capRate', 'occupancy'];
    const numberFields = ['wetSlips', 'dryRacks', 'saleYear', 'yearBuilt', 'daysOnMarket', 'acres'];
    const monthFields = ['saleMonth'];
    const textFields = [
      'marina', 'address', 'city', 'zip', 'notes', 'broker', 'brokerage',
      'agentFirstName', 'agentLastName', 'bodyOfWater', 'waterBodyName',
      'waterfront', 'waterType', 'region', 'saleCondition', 'ioBoth',
      'sellerCompany', 'sellerPrincipal', 'buyerCompany', 'buyerPrincipal',
      'seller', 'company', 'owner', 'articleUrls', 'parentPortfolioId'
    ];

    if (currencyFields.includes(fieldName)) return 'currency';
    if (percentFields.includes(fieldName)) return 'percent';
    if (numberFields.includes(fieldName)) return 'number';
    if (monthFields.includes(fieldName)) return 'month';
    if (fieldName === 'state') return 'state';
    if (textFields.includes(fieldName)) return 'text';
    
    // Default to text for unknown fields (e.g., custom columns)
    return 'text';
  }
}
