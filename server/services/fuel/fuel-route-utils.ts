import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../audit-service';
import { hasPermission, getUserRole } from '../../middleware/rbac';
import { workflowEnhancements } from '../workflow-enhancements';

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

// Approval workflow middleware for sensitive fuel operations.
// Users with fuel:approval:approve permission (managers/owners) pass through
// immediately. All other roles get a pending approval request created and
// receive a 202 Accepted response so the operation can be retried once approved.
export function requireApprovalCheck(operationType: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user?.id || !user?.orgId) {
      return res.status(401).json({ message: 'Authentication required', code: 'AUTH_REQUIRED' });
    }

    try {
      const userRole = await getUserRole(user.id, user.orgId, user.role);
      const canSelfApprove = userRole ? hasPermission(userRole, 'fuel:approval:approve') : false;

      if (canSelfApprove) {
        // Managers/owners can perform the operation directly — no pending request needed.
        return next();
      }

      // The user lacks approve permission — create a pending approval request
      // and return 202 so the client knows to wait for manager approval.
      const approvalId = await workflowEnhancements.requestApproval(user.orgId, {
        title: `Fuel operation approval: ${operationType}`,
        description: `User ${user.email ?? user.id} requested a sensitive fuel operation (${operationType}). Please review and approve or reject.`,
        requiredApprovers: [],   // Any manager can approve
        entityType: 'fuel_integration',
        entityId: (req.params?.id as string) ?? null,
      });

      const context = AuditService.extractContext(req);
      await AuditService.log(context, {
        eventType: 'approve',
        entityType: 'approval_workflow',
        action: `Fuel operation requires approval: ${operationType}`,
        metadata: { operationType, approvalId, requestedBy: user.id },
        severity: 'warning',
        isSuccess: true,
      });

      return res.status(202).json({
        message: 'This operation requires manager approval before it can be completed.',
        approvalId,
        operationType,
      });
    } catch (err: any) {
      return res.status(500).json({ message: 'Failed to process approval check', error: err.message });
    }
  };
}
