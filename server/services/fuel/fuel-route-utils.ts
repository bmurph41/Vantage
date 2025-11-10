import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../audit-service';

export type FuelEntityType = 
  | 'fuel_transaction'
  | 'fuel_type'
  | 'fuel_inventory'
  | 'fuel_delivery'
  | 'fuel_projection'
  | 'fuel_integration'
  | 'fuel_import_log';

export type AuditOperation = 'create' | 'update' | 'delete' | 'import' | 'export';

interface AuditConfig {
  entityType: FuelEntityType;
  operation: AuditOperation;
  getId?: (req: Request, result: any) => string;
  getBefore?: (req: Request) => Promise<any>;
  getAfter?: (result: any) => any;
  metadata?: (req: Request, result: any) => Record<string, any>;
}

export function withFuelAudit(config: AuditConfig) {
  return function(handler: (req: Request, res: Response) => Promise<any>) {
    return async (req: Request, res: Response, next: NextFunction) => {
      let beforeData: any = null;
      let result: any = null;

      try {
        // Capture before state for updates/deletes
        if (config.getBefore) {
          beforeData = await config.getBefore(req);
        }

        // Execute the actual route handler
        result = await handler(req, res);

        // Only audit if response was successful (not already sent with error)
        if (!res.headersSent && result) {
          const entityId = config.getId ? config.getId(req, result) : req.params.id;
          const afterData = config.getAfter ? config.getAfter(result) : result;
          const additionalMetadata = config.metadata ? config.metadata(req, result) : {};

          // Log based on entity type
          if (config.entityType === 'fuel_transaction') {
            await AuditService.logFuelTransaction(
              req,
              config.operation as any,
              entityId,
              beforeData,
              afterData,
              additionalMetadata
            );
          } else if (config.entityType === 'fuel_integration') {
            await AuditService.logFuelIntegration(
              req,
              config.operation as any,
              entityId,
              beforeData,
              afterData,
              additionalMetadata
            );
          } else {
            // Generic audit logging for other entity types
            const context = AuditService.extractContext(req);
            await AuditService.log(context, {
              eventType: config.operation,
              entityType: config.entityType,
              entityId,
              action: `${config.operation.charAt(0).toUpperCase() + config.operation.slice(1)} ${config.entityType.replace('_', ' ')}`,
              beforeData,
              afterData,
              metadata: additionalMetadata,
              isSuccess: true,
            });
          }
        }

        return result;
      } catch (error) {
        throw error;
      }
    };
  };
}

// Helper to create a getBefore function for any entity using a finder
export function createBeforeGetter<T>(
  finder: (id: string, orgId: string) => Promise<T | null>
) {
  return async (req: Request): Promise<T | null> => {
    const id = req.params.id;
    const orgId = (req as any).user?.orgId;
    if (!id || !orgId) return null;
    return await finder(id, orgId);
  };
}

// Permission mappings for fuel routes
export const FUEL_ROUTE_PERMISSIONS = {
  // Read operations
  readSales: ['fuel:read'],
  readStats: ['fuel:read', 'analytics:read'],
  readInventory: ['fuel:read'],
  readTypes: ['fuel:read'],
  readDeliveries: ['fuel:read'],
  readProjections: ['fuel:read'],
  readIntegrations: ['fuel:read'],
  readImportLogs: ['fuel:read'],
  
  // Create operations
  createSale: ['fuel:create'],
  createInventory: ['fuel:create'],
  createType: ['fuel:create'],
  createDelivery: ['fuel:create'],
  createProjection: ['fuel:create'],
  createIntegration: ['fuel:integration:manage'],
  
  // Update operations
  updateSale: ['fuel:update'],
  updateInventory: ['fuel:update'],
  updateType: ['fuel:update'],
  updateDelivery: ['fuel:update'],
  updateProjection: ['fuel:update'],
  updateIntegration: ['fuel:integration:manage'],
  
  // Delete operations
  deleteSale: ['fuel:delete'],
  deleteInventory: ['fuel:delete'],
  deleteType: ['fuel:delete'],
  deleteDelivery: ['fuel:delete'],
  deleteProjection: ['fuel:delete'],
  deleteIntegration: ['fuel:integration:manage'],
  
  // Sensitive operations (require both permission and approval workflow)
  importCSV: ['fuel:import', 'fuel:approval:request'],
  exportQuickBooks: ['fuel:export', 'fuel:approval:request'],
  exportCSV: ['fuel:export'],
  bulkDelete: ['fuel:delete', 'fuel:approval:request'],
  
  // Integration operations
  testIntegration: ['fuel:integration:manage'],
  syncIntegration: ['fuel:integration:manage'],
  
  // Period locking
  lockPeriod: ['fuel:period:lock'],
  unlockPeriod: ['fuel:period:unlock'],
} as const;

// Approval workflow middleware for sensitive operations
export function requireApprovalCheck(operationType: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // TODO: Check if this operation requires approval
    // For now, we'll log the request and allow it through
    // In Phase 1 completion, this will check for pending/approved requests
    
    const context = AuditService.extractContext(req);
    await AuditService.log(context, {
      eventType: 'approve',
      entityType: 'approval_workflow',
      action: `Sensitive operation requested: ${operationType}`,
      metadata: {
        operationType,
        status: 'auto_approved', // Will be 'pending' when approval UI is built
        requestData: req.body,
      },
      severity: 'warning',
      isSuccess: true,
    });
    
    next();
  };
}
