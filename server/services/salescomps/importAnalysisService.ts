import type { IStorage } from '../../storage';

export type ImportMode = 'insert' | 'update' | 'upsert';

export interface RowMatchResult {
  rowIndex: number;
  rowData: Record<string, any>;
  matchedCompId?: string;
  matchedComp?: any;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'none';
  action: 'insert' | 'update' | 'skip';
  reason?: string;
  fieldChanges?: Array<{
    field: string;
    oldValue: any;
    newValue: any;
    willUpdate: boolean;
  }>;
}

export interface ImportPlan {
  mode: ImportMode;
  updateBlankValues: boolean;
  rows: RowMatchResult[];
  summary: {
    totalRows: number;
    toInsert: number;
    toUpdate: number;
    toSkip: number;
  };
}

export class ImportAnalysisService {
  constructor(private storage: IStorage) {}

  normalizeMatchKey(marina: string | null | undefined, city: string | null | undefined, state: string | null | undefined): string | null {
    if (!marina || !city || !state) return null;
    
    return [
      marina.toLowerCase().trim().replace(/[^a-z0-9]/g, ''),
      city.toLowerCase().trim().replace(/[^a-z0-9]/g, ''),
      state.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
    ].join('|');
  }

  async analyzeImport(
    orgId: string,
    rows: Record<string, any>[],
    mode: ImportMode,
    updateBlankValues: boolean = false
  ): Promise<ImportPlan> {
    const locationKeys = rows
      .map(row => this.normalizeMatchKey(row.marina, row.city, row.state))
      .filter((k): k is string => k !== null);

    const existingComps = await this.storage.bulkFindCompsByLocation(orgId, rows);

    const existingByKey = new Map<string, any>();
    for (const comp of existingComps) {
      const key = this.normalizeMatchKey(comp.marina, comp.city, comp.state);
      if (key) {
        existingByKey.set(key, comp);
      }
    }

    const results: RowMatchResult[] = [];
    let toInsert = 0;
    let toUpdate = 0;
    let toSkip = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const key = this.normalizeMatchKey(row.marina, row.city, row.state);
      
      if (!key) {
        results.push({
          rowIndex: i,
          rowData: row,
          confidence: 0,
          matchType: 'none',
          action: 'skip',
          reason: 'Missing required fields (marina, city, or state)'
        });
        toSkip++;
        continue;
      }

      const existingComp = existingByKey.get(key);
      
      if (!existingComp) {
        if (mode === 'update') {
          results.push({
            rowIndex: i,
            rowData: row,
            confidence: 0,
            matchType: 'none',
            action: 'skip',
            reason: 'No matching record found (update-only mode)'
          });
          toSkip++;
        } else {
          results.push({
            rowIndex: i,
            rowData: row,
            confidence: 1.0,
            matchType: 'none',
            action: 'insert',
            reason: 'New record'
          });
          toInsert++;
        }
      } else {
        if (mode === 'insert') {
          results.push({
            rowIndex: i,
            rowData: row,
            matchedCompId: existingComp.id,
            matchedComp: existingComp,
            confidence: 1.0,
            matchType: 'exact',
            action: 'skip',
            reason: 'Duplicate found (insert-only mode)'
          });
          toSkip++;
        } else {
          const fieldChanges = this.computeFieldChanges(existingComp, row, updateBlankValues);
          
          results.push({
            rowIndex: i,
            rowData: row,
            matchedCompId: existingComp.id,
            matchedComp: existingComp,
            confidence: 1.0,
            matchType: 'exact',
            action: 'update',
            reason: 'Exact match found',
            fieldChanges
          });
          toUpdate++;
        }
      }
    }

    return {
      mode,
      updateBlankValues,
      rows: results,
      summary: {
        totalRows: rows.length,
        toInsert,
        toUpdate,
        toSkip
      }
    };
  }

  private computeFieldChanges(
    existingComp: any,
    newRow: Record<string, any>,
    updateBlankValues: boolean
  ): Array<{ field: string; oldValue: any; newValue: any; willUpdate: boolean }> {
    const changes: Array<{ field: string; oldValue: any; newValue: any; willUpdate: boolean }> = [];
    
    const fieldsToCheck = [
      'marina', 'city', 'state', 'salePrice', 'saleDate', 'wetSlips', 'dryRacks',
      'boatyard', 'liftCapacity', 'io', 'waterType', 'region', 'disclosedPrice',
      'portfolioId', 'notes', 'capRate', 'leaseholdOrFee', 'disclosedCapRate',
      'acreage', 'occupancy', 'avgSlipLength', 'avgSlipWidth', 'avgSlipPrice',
      'ratePerSqFt', 'storageTypes', 'address', 'brokerName', 'sellerName', 'buyerName'
    ];

    for (const field of fieldsToCheck) {
      const oldValue = existingComp[field];
      const newValue = newRow[field];

      const isNewValueBlank = newValue === null || newValue === undefined || newValue === '';
      const isOldValueBlank = oldValue === null || oldValue === undefined || oldValue === '';

      if (isNewValueBlank && !updateBlankValues && !isOldValueBlank) {
        changes.push({
          field,
          oldValue,
          newValue,
          willUpdate: false
        });
      } else if (String(oldValue) !== String(newValue)) {
        changes.push({
          field,
          oldValue,
          newValue,
          willUpdate: true
        });
      }
    }

    return changes;
  }

  async detectDuplicates(
    orgId: string,
    rows: Record<string, any>[],
    threshold: number = 0.8
  ): Promise<Array<{
    rowIndex: number;
    row: Record<string, any>;
    match: any;
    confidence: number;
  }>> {
    const plan = await this.analyzeImport(orgId, rows, 'upsert', false);
    
    return plan.rows
      .filter(r => r.matchedComp && r.confidence >= threshold)
      .map(r => ({
        rowIndex: r.rowIndex,
        row: r.rowData,
        match: r.matchedComp,
        confidence: r.confidence
      }));
  }
}
