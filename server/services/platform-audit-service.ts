import { Request } from 'express';
import { AuditService, AuditContext, AuditEventData } from './audit-service';

export class PlatformAuditService {
  static logRentRollOperation(
    req: Request,
    action: 'create' | 'update' | 'delete' | 'bulk_delete' | 'import' | 'export',
    entityType: 'lease' | 'tenant' | 'location' | 'cash_flow',
    entityId?: string,
    beforeData?: any,
    afterData?: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    const context = AuditService.extractContext(req);
    
    return AuditService.log(context, {
      eventType: action,
      entityType: `rent_roll_${entityType}`,
      entityId,
      action: `${action.charAt(0).toUpperCase() + action.slice(1)} ${entityType}`,
      beforeData,
      afterData,
      metadata: {
        ...metadata,
        module: 'rent_roll',
      },
      severity: action === 'bulk_delete' ? 'warning' : 'info',
      isSuccess: true,
    });
  }

  static logModelingOperation(
    req: Request,
    action: 'create' | 'update' | 'delete' | 'clone' | 'export' | 'sync',
    entityType: 'project' | 'scenario' | 'exit_strategy' | 'pro_forma',
    entityId?: string,
    beforeData?: any,
    afterData?: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    const context = AuditService.extractContext(req);
    
    return AuditService.log(context, {
      eventType: action,
      entityType: `modeling_${entityType}`,
      entityId,
      action: `${action.charAt(0).toUpperCase() + action.slice(1)} ${entityType}`,
      beforeData,
      afterData,
      metadata: {
        ...metadata,
        module: 'modeling',
      },
      severity: ['delete', 'sync'].includes(action) ? 'warning' : 'info',
      isSuccess: true,
    });
  }

  static logCRMOperation(
    req: Request,
    action: 'create' | 'update' | 'delete' | 'convert' | 'assign' | 'import',
    entityType: 'deal' | 'lead' | 'contact' | 'company' | 'property' | 'activity',
    entityId?: string,
    beforeData?: any,
    afterData?: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    const context = AuditService.extractContext(req);
    
    return AuditService.log(context, {
      eventType: action,
      entityType: `crm_${entityType}`,
      entityId,
      action: `${action.charAt(0).toUpperCase() + action.slice(1)} ${entityType}`,
      beforeData,
      afterData,
      metadata: {
        ...metadata,
        module: 'crm',
      },
      severity: action === 'delete' ? 'warning' : 'info',
      isSuccess: true,
    });
  }

  static logDueDiligenceOperation(
    req: Request,
    action: 'create' | 'update' | 'delete' | 'complete' | 'assign',
    entityType: 'project' | 'task' | 'document' | 'risk',
    entityId?: string,
    beforeData?: any,
    afterData?: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    const context = AuditService.extractContext(req);
    
    return AuditService.log(context, {
      eventType: action,
      entityType: `dd_${entityType}`,
      entityId,
      action: `${action.charAt(0).toUpperCase() + action.slice(1)} ${entityType}`,
      beforeData,
      afterData,
      metadata: {
        ...metadata,
        module: 'due_diligence',
      },
      severity: action === 'delete' ? 'warning' : 'info',
      isSuccess: true,
    });
  }

  static logSecurityEvent(
    req: Request,
    eventType: 'login' | 'logout' | 'password_change' | 'permission_change' | 'api_key_access' | 'suspicious_activity',
    details: Record<string, any>
  ): Promise<void> {
    const context = AuditService.extractContext(req);
    
    return AuditService.log(context, {
      eventType,
      entityType: 'security',
      action: eventType.replace(/_/g, ' '),
      metadata: {
        ...details,
        module: 'security',
      },
      severity: eventType === 'suspicious_activity' ? 'critical' : 'warning',
      isSuccess: true,
    });
  }

  static logDataExport(
    req: Request,
    exportType: 'pdf' | 'excel' | 'csv' | 'json',
    module: string,
    recordCount: number,
    details?: Record<string, any>
  ): Promise<void> {
    const context = AuditService.extractContext(req);
    
    return AuditService.log(context, {
      eventType: 'export',
      entityType: 'data_export',
      action: `Exported ${recordCount} records from ${module} as ${exportType.toUpperCase()}`,
      metadata: {
        exportType,
        module,
        recordCount,
        ...details,
      },
      severity: 'info',
      isSuccess: true,
    });
  }

  static logBulkOperation(
    req: Request,
    operation: 'delete' | 'update' | 'import',
    entityType: string,
    affectedCount: number,
    details?: Record<string, any>
  ): Promise<void> {
    const context = AuditService.extractContext(req);
    
    return AuditService.log(context, {
      eventType: operation,
      entityType: `bulk_${entityType}`,
      action: `Bulk ${operation} of ${affectedCount} ${entityType}(s)`,
      metadata: {
        affectedCount,
        ...details,
      },
      severity: operation === 'delete' ? 'critical' : 'warning',
      isSuccess: true,
    });
  }

  static logError(
    req: Request,
    operation: string,
    entityType: string,
    error: Error,
    details?: Record<string, any>
  ): Promise<void> {
    const context = AuditService.extractContext(req);
    
    return AuditService.log(context, {
      eventType: operation,
      entityType,
      action: `Failed: ${operation}`,
      metadata: {
        ...details,
        errorStack: error.stack,
      },
      severity: 'critical',
      isSuccess: false,
      errorMessage: error.message,
    });
  }
}

export default PlatformAuditService;
