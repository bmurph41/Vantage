import { storage } from "../storage";
import { DataMapper, type ColumnMapping } from "./mappers";
import { ImportValidator } from "./validators";
import { 
  type ImportJob, type InsertImportJob, type InsertImportError,
  type Customer, type InsertCustomer,
  type Boat, type InsertBoat,
  type Slip, type InsertSlip,
  type Lease, type InsertLease
} from "@shared/schema";

export interface ProcessingOptions {
  batchSize?: number;
  duplicateStrategy?: 'skip' | 'update' | 'error';
  validateOnly?: boolean;
  dryRun?: boolean;
}

export interface ProcessingResult {
  success: boolean;
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  errors: Array<{
    rowIndex: number;
    entity: string;
    code: string;
    message: string;
    rawData: Record<string, any>;
  }>;
  summary: {
    customersCreated?: number;
    customersUpdated?: number;
    boatsCreated?: number;
    boatsUpdated?: number;
    slipsCreated?: number;
    slipsUpdated?: number;
    leasesCreated?: number;
    leasesUpdated?: number;
  };
}

export class ImportProcessor {
  private jobId: string;
  private options: ProcessingOptions;

  constructor(jobId: string, options: ProcessingOptions = {}) {
    this.jobId = jobId;
    this.options = {
      batchSize: 100,
      duplicateStrategy: 'skip',
      validateOnly: false,
      dryRun: false,
      ...options
    };
  }

  async processData(
    rows: Record<string, any>[],
    mappings: Record<string, ColumnMapping[]>
  ): Promise<ProcessingResult> {
    const result: ProcessingResult = {
      success: true,
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0,
      errors: [],
      summary: {}
    };

    try {
      // Update job status to running
      await storage.updateImportJob(this.jobId, {
        status: 'running',
        totalRows: rows.length
      });

      // Clear previous errors
      await storage.clearImportErrors(this.jobId);

      // Process in batches
      const batches = this.createBatches(rows, this.options.batchSize!);
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchResult = await this.processBatch(batch, mappings, batchIndex * this.options.batchSize!);
        
        // Merge results
        result.totalProcessed += batchResult.totalProcessed;
        result.successCount += batchResult.successCount;
        result.errorCount += batchResult.errorCount;
        result.errors.push(...batchResult.errors);
        
        // Merge summary
        Object.keys(batchResult.summary).forEach(key => {
          const summaryKey = key as keyof typeof result.summary;
          result.summary[summaryKey] = (result.summary[summaryKey] || 0) + (batchResult.summary[summaryKey] || 0);
        });

        // Update progress
        await storage.updateImportJob(this.jobId, {
          processedRows: result.totalProcessed,
          successCount: result.successCount,
          errorCount: result.errorCount
        });

        // Small delay to prevent overwhelming the database
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Update final job status
      const finalStatus = result.errorCount > 0 && result.successCount === 0 ? 'failed' : 'completed';
      await storage.updateImportJob(this.jobId, {
        status: finalStatus,
        summary: result.summary,
        processedRows: result.totalProcessed,
        successCount: result.successCount,
        errorCount: result.errorCount
      });

      result.success = finalStatus === 'completed';

    } catch (error) {
      result.success = false;
      await storage.updateImportJob(this.jobId, {
        status: 'failed'
      });
      throw error;
    }

    return result;
  }

  private async processBatch(
    batch: Record<string, any>[],
    mappings: Record<string, ColumnMapping[]>,
    startIndex: number
  ): Promise<ProcessingResult> {
    const result: ProcessingResult = {
      success: true,
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0,
      errors: [],
      summary: {}
    };

    for (let i = 0; i < batch.length; i++) {
      const row = batch[i];
      const rowIndex = startIndex + i;
      
      try {
        // Process entities in order: customer -> boat -> slip -> lease
        let customer: Customer | undefined;
        let boat: Boat | undefined;
        let slip: Slip | undefined;

        // Process customer
        if (mappings.customer && mappings.customer.length > 0) {
          customer = await this.processCustomer(row, mappings.customer, rowIndex, result);
        }

        // Process boat (requires customer)
        if (mappings.boat && mappings.boat.length > 0 && customer) {
          boat = await this.processBoat(row, mappings.boat, customer.id, rowIndex, result);
        }

        // Process slip
        if (mappings.slip && mappings.slip.length > 0) {
          slip = await this.processSlip(row, mappings.slip, rowIndex, result);
        }

        // Process lease (requires customer, boat, and slip)
        if (mappings.lease && mappings.lease.length > 0 && customer && boat && slip) {
          await this.processLease(row, mappings.lease, customer.id, boat.id, slip.id, rowIndex, result);
        }

        result.successCount++;
        
      } catch (error) {
        result.errorCount++;
        const errorData = {
          rowIndex,
          entity: 'general',
          code: 'PROCESSING_ERROR',
          message: error.message || 'Unknown processing error',
          rawData: row
        };
        
        result.errors.push(errorData);
        
        // Store error in database
        await storage.createImportError({
          jobId: this.jobId,
          ...errorData
        });
      }
      
      result.totalProcessed++;
    }

    return result;
  }

  private async processCustomer(
    row: Record<string, any>,
    mappings: ColumnMapping[],
    rowIndex: number,
    result: ProcessingResult
  ): Promise<Customer | undefined> {
    try {
      const customerData = DataMapper.mapRowToEntity(row, mappings, 'customer') as Partial<InsertCustomer>;
      
      // Validate data
      const validation = ImportValidator.validateCustomer(customerData);
      if (!validation.success) {
        throw new Error(`Customer validation failed: ${validation.errors.join(', ')}`);
      }

      // Check for existing customer by email
      if (customerData.email) {
        const customers = await storage.getCustomers();
        const existing = customers.find(c => c.email.toLowerCase() === customerData.email!.toLowerCase());
        
        if (existing) {
          if (this.options.duplicateStrategy === 'error') {
            throw new Error(`Customer with email ${customerData.email} already exists`);
          } else if (this.options.duplicateStrategy === 'update') {
            const updated = await storage.updateCustomer(existing.id, customerData);
            if (updated) {
              result.summary.customersUpdated = (result.summary.customersUpdated || 0) + 1;
              return updated;
            }
          } else {
            // Skip duplicate
            return existing;
          }
        }
      }

      // Create new customer
      if (!this.options.dryRun) {
        const customer = await storage.createCustomer(customerData as InsertCustomer);
        result.summary.customersCreated = (result.summary.customersCreated || 0) + 1;
        return customer;
      }

      return undefined;
    } catch (error) {
      const errorData = {
        rowIndex,
        entity: 'customer',
        code: 'CUSTOMER_ERROR',
        message: error.message,
        rawData: row
      };
      
      result.errors.push(errorData);
      await storage.createImportError({
        jobId: this.jobId,
        ...errorData
      });
      
      return undefined;
    }
  }

  private async processBoat(
    row: Record<string, any>,
    mappings: ColumnMapping[],
    customerId: string,
    rowIndex: number,
    result: ProcessingResult
  ): Promise<Boat | undefined> {
    try {
      const boatData = {
        ...DataMapper.mapRowToEntity(row, mappings, 'boat') as Partial<InsertBoat>,
        customerId
      };
      
      // Validate data
      const validation = ImportValidator.validateBoat(boatData);
      if (!validation.success) {
        throw new Error(`Boat validation failed: ${validation.errors.join(', ')}`);
      }

      // Check for existing boat by hull ID or name
      const boats = await storage.getBoats();
      let existing: Boat | undefined;
      
      if (boatData.hullId) {
        existing = boats.find(b => b.hullId === boatData.hullId);
      } else if (boatData.name) {
        existing = boats.find(b => b.customerId === customerId && b.name === boatData.name);
      }
      
      if (existing) {
        if (this.options.duplicateStrategy === 'error') {
          throw new Error(`Boat already exists`);
        } else if (this.options.duplicateStrategy === 'update') {
          const updated = await storage.updateBoat(existing.id, boatData);
          if (updated) {
            result.summary.boatsUpdated = (result.summary.boatsUpdated || 0) + 1;
            return updated;
          }
        } else {
          return existing;
        }
      }

      // Create new boat
      if (!this.options.dryRun) {
        const boat = await storage.createBoat(boatData as InsertBoat);
        result.summary.boatsCreated = (result.summary.boatsCreated || 0) + 1;
        return boat;
      }

      return undefined;
    } catch (error) {
      const errorData = {
        rowIndex,
        entity: 'boat',
        code: 'BOAT_ERROR',
        message: error.message,
        rawData: row
      };
      
      result.errors.push(errorData);
      await storage.createImportError({
        jobId: this.jobId,
        ...errorData
      });
      
      return undefined;
    }
  }

  private async processSlip(
    row: Record<string, any>,
    mappings: ColumnMapping[],
    rowIndex: number,
    result: ProcessingResult
  ): Promise<Slip | undefined> {
    try {
      const slipData = DataMapper.mapRowToEntity(row, mappings, 'slip') as Partial<InsertSlip>;
      
      // Validate data
      const validation = ImportValidator.validateSlip(slipData);
      if (!validation.success) {
        throw new Error(`Slip validation failed: ${validation.errors.join(', ')}`);
      }

      // Check for existing slip by number
      if (slipData.number) {
        const slips = await storage.getSlips();
        const existing = slips.find(s => s.number === slipData.number);
        
        if (existing) {
          if (this.options.duplicateStrategy === 'error') {
            throw new Error(`Slip ${slipData.number} already exists`);
          } else if (this.options.duplicateStrategy === 'update') {
            const updated = await storage.updateSlip(existing.id, slipData);
            if (updated) {
              result.summary.slipsUpdated = (result.summary.slipsUpdated || 0) + 1;
              return updated;
            }
          } else {
            return existing;
          }
        }
      }

      // Create new slip
      if (!this.options.dryRun) {
        const slip = await storage.createSlip(slipData as InsertSlip);
        result.summary.slipsCreated = (result.summary.slipsCreated || 0) + 1;
        return slip;
      }

      return undefined;
    } catch (error) {
      const errorData = {
        rowIndex,
        entity: 'slip',
        code: 'SLIP_ERROR',
        message: error.message,
        rawData: row
      };
      
      result.errors.push(errorData);
      await storage.createImportError({
        jobId: this.jobId,
        ...errorData
      });
      
      return undefined;
    }
  }

  private async processLease(
    row: Record<string, any>,
    mappings: ColumnMapping[],
    customerId: string,
    boatId: string,
    slipId: string,
    rowIndex: number,
    result: ProcessingResult
  ): Promise<Lease | undefined> {
    try {
      const leaseData = {
        ...DataMapper.mapRowToEntity(row, mappings, 'lease') as Partial<InsertLease>,
        customerId,
        boatId,
        slipId
      };
      
      // Validate data
      const validation = ImportValidator.validateLease(leaseData);
      if (!validation.success) {
        throw new Error(`Lease validation failed: ${validation.errors.join(', ')}`);
      }

      // Check for existing lease
      const leases = await storage.getLeases();
      const existing = leases.find(l => 
        l.customerId === customerId && 
        l.boatId === boatId && 
        l.slipId === slipId &&
        l.status === 'active'
      );
      
      if (existing) {
        if (this.options.duplicateStrategy === 'error') {
          throw new Error(`Active lease already exists for this combination`);
        } else if (this.options.duplicateStrategy === 'update') {
          const updated = await storage.updateLease(existing.id, leaseData);
          if (updated) {
            result.summary.leasesUpdated = (result.summary.leasesUpdated || 0) + 1;
            return updated;
          }
        } else {
          return existing;
        }
      }

      // Create new lease
      if (!this.options.dryRun) {
        const lease = await storage.createLease(leaseData as InsertLease);
        result.summary.leasesCreated = (result.summary.leasesCreated || 0) + 1;
        return lease;
      }

      return undefined;
    } catch (error) {
      const errorData = {
        rowIndex,
        entity: 'lease',
        code: 'LEASE_ERROR',
        message: error.message,
        rawData: row
      };
      
      result.errors.push(errorData);
      await storage.createImportError({
        jobId: this.jobId,
        ...errorData
      });
      
      return undefined;
    }
  }

  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }
}