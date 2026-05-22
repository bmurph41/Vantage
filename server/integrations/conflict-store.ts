import crypto from 'crypto';

export interface PmsConflict {
  id: string;
  orgId: string;
  integrationKey: string;
  pmsSource: string;
  entityType: string;
  entityId: string;
  fieldName: string;
  pmsValue: string;
  manualValue: string;
  detectedAt: string;
  status: 'open' | 'resolved' | 'dismissed';
  resolution?: string;
  resolvedValue?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export const pmsConflictStore: Map<string, PmsConflict[]> = new Map();

export function getConflictKey(orgId: string) { return `conflicts_${orgId}`; }

export function recordConflict(
  conflict: Omit<PmsConflict, 'id' | 'detectedAt' | 'status'>
): void {
  const key = getConflictKey(conflict.orgId);
  const existing = pmsConflictStore.get(key) || [];

  const isDuplicate = existing.some(c =>
    c.integrationKey === conflict.integrationKey &&
    c.entityType === conflict.entityType &&
    c.entityId === conflict.entityId &&
    c.fieldName === conflict.fieldName &&
    c.status === 'open'
  );

  if (!isDuplicate) {
    existing.push({
      id: crypto.randomBytes(8).toString('hex'),
      detectedAt: new Date().toISOString(),
      status: 'open',
      ...conflict,
    });
    pmsConflictStore.set(key, existing);
  }
}
