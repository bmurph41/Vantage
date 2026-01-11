import { storage } from "./storage";
import { type InsertAuditLog, type AuditLog } from "@shared/schema";

type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "IMPORT" | "EXPORT" | "LOGIN" | "LOGOUT" | "ROLE_CHANGE" | "BULK_EDIT";
type AuditEntity = "lease" | "tenant" | "project" | "storage_location" | "line_item" | "move_event" | "user" | "organization" | "report" | "budget";

export interface AuditLogContext {
  userId: string;
  organizationId: string;
}

export async function logAuditEvent(
  context: AuditLogContext,
  action: AuditAction,
  entityType: AuditEntity,
  entityId: string,
  options?: {
    entityName?: string;
    previousValue?: Record<string, any> | null;
    newValue?: Record<string, any> | null;
    metadata?: Record<string, any> | null;
  }
): Promise<void> {
  try {
    const auditData: InsertAuditLog = {
      organizationId: context.organizationId,
      userId: context.userId,
      action,
      entityType,
      entityId,
      entityName: options?.entityName,
      previousValue: options?.previousValue || null,
      newValue: options?.newValue || null,
      metadata: options?.metadata || null,
    };

    await storage.createAuditLog(auditData);
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

export async function logLeaseCreate(
  context: AuditLogContext,
  leaseId: string,
  leaseData: Record<string, any>
): Promise<void> {
  await logAuditEvent(context, "CREATE", "lease", leaseId, {
    entityName: leaseData.tenantName || "Lease",
    newValue: leaseData,
  });
}

export async function logLeaseUpdate(
  context: AuditLogContext,
  leaseId: string,
  previousData: Record<string, any>,
  newData: Record<string, any>
): Promise<void> {
  await logAuditEvent(context, "UPDATE", "lease", leaseId, {
    entityName: newData.tenantName || previousData.tenantName || "Lease",
    previousValue: previousData,
    newValue: newData,
  });
}

export async function logLeaseDelete(
  context: AuditLogContext,
  leaseId: string,
  leaseData: Record<string, any>
): Promise<void> {
  await logAuditEvent(context, "DELETE", "lease", leaseId, {
    entityName: leaseData.tenantName || "Lease",
    previousValue: leaseData,
  });
}

export async function logBulkImport(
  context: AuditLogContext,
  projectId: string,
  importDetails: {
    projectName?: string;
    fileName: string;
    rowsImported: number;
    rowsFailed: number;
  }
): Promise<void> {
  await logAuditEvent(context, "IMPORT", "project", projectId, {
    entityName: importDetails.projectName,
    metadata: importDetails,
  });
}

export async function logExport(
  context: AuditLogContext,
  projectId: string,
  exportDetails: {
    projectName?: string;
    format: string;
    recordCount: number;
  }
): Promise<void> {
  await logAuditEvent(context, "EXPORT", "project", projectId, {
    entityName: exportDetails.projectName,
    metadata: exportDetails,
  });
}

export async function logUserLogin(
  context: AuditLogContext,
  userId: string,
  userName?: string
): Promise<void> {
  await logAuditEvent(context, "LOGIN", "user", userId, {
    entityName: userName,
  });
}

export async function logRoleChange(
  context: AuditLogContext,
  targetUserId: string,
  userName: string,
  previousRole: string,
  newRole: string
): Promise<void> {
  await logAuditEvent(context, "ROLE_CHANGE", "user", targetUserId, {
    entityName: userName,
    previousValue: { role: previousRole },
    newValue: { role: newRole },
  });
}

export async function logProjectCreate(
  context: AuditLogContext,
  projectId: string,
  projectData: Record<string, any>
): Promise<void> {
  await logAuditEvent(context, "CREATE", "project", projectId, {
    entityName: projectData.name,
    newValue: projectData,
  });
}

export async function logProjectUpdate(
  context: AuditLogContext,
  projectId: string,
  previousData: Record<string, any>,
  newData: Record<string, any>
): Promise<void> {
  await logAuditEvent(context, "UPDATE", "project", projectId, {
    entityName: newData.name || previousData.name,
    previousValue: previousData,
    newValue: newData,
  });
}

export async function logBulkEdit(
  context: AuditLogContext,
  entityType: AuditEntity,
  entityIds: string[],
  updates: Record<string, any>
): Promise<void> {
  await logAuditEvent(context, "BULK_EDIT", entityType, entityIds.join(","), {
    entityName: `${entityIds.length} ${entityType}s`,
    newValue: updates,
    metadata: { count: entityIds.length, entityIds },
  });
}
