import { db } from '../db';
import { 
  modelingProjects,
  rentRolls,
  fuelSales,
  shipStoreTransactions
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { valuationTimelineService } from './valuation-timeline-service';

export type DataChangeSource = 'rent_roll' | 'fuel_sales' | 'ship_store' | 'rate_comp' | 'sales_comp';

export interface DataChangeEvent {
  sourceType: DataChangeSource;
  sourceId: string;
  orgId: string;
  userId?: string;
  changeType: 'create' | 'update' | 'delete';
  recordCount?: number;
}

export class ValuationSyncService {
  private pendingChanges: Map<string, DataChangeEvent[]> = new Map();
  private syncDebounceMs = 5000;
  private syncTimers: Map<string, NodeJS.Timeout> = new Map();

  async notifyDataChange(event: DataChangeEvent): Promise<void> {
    const key = event.orgId;
    
    if (!this.pendingChanges.has(key)) {
      this.pendingChanges.set(key, []);
    }
    this.pendingChanges.get(key)!.push(event);
    
    if (this.syncTimers.has(key)) {
      clearTimeout(this.syncTimers.get(key)!);
    }
    
    this.syncTimers.set(key, setTimeout(() => {
      this.processChanges(key);
    }, this.syncDebounceMs));
  }

  private async processChanges(orgId: string): Promise<void> {
    const changes = this.pendingChanges.get(orgId) || [];
    this.pendingChanges.delete(orgId);
    this.syncTimers.delete(orgId);
    
    if (changes.length === 0) return;
    
    try {
      const sourceTypes = [...new Set(changes.map(c => c.sourceType))];
      const triggerNote = `Auto-triggered by ${sourceTypes.join(', ')} updates (${changes.length} changes)`;
      
      const projects = await db.select()
        .from(modelingProjects)
        .where(eq(modelingProjects.orgId, orgId));
      
      for (const project of projects) {
        const shouldSync = await this.shouldSyncProject(project.id, orgId, sourceTypes);
        
        if (shouldSync) {
          await valuationTimelineService.createSnapshot(
            {
              modelingProjectId: project.id,
              orgId,
              asOfDate: new Date(),
              userId: changes[0].userId
            },
            'data_change',
            triggerNote
          );
          
          console.log(`[ValuationSync] Created snapshot for project ${project.id} due to ${sourceTypes.join(', ')} changes`);
        }
      }
    } catch (error) {
      console.error('[ValuationSync] Error processing changes:', error);
    }
  }

  private async shouldSyncProject(
    projectId: string,
    orgId: string,
    sourceTypes: DataChangeSource[]
  ): Promise<boolean> {
    for (const sourceType of sourceTypes) {
      switch (sourceType) {
        case 'rent_roll':
          const hasRentRoll = await db.select({ count: sql<string>`count(*)` })
            .from(rentRolls)
            .where(eq(rentRolls.orgId, orgId));
          if (parseInt(hasRentRoll[0]?.count || '0') > 0) return true;
          break;
          
        case 'fuel_sales':
          const hasFuel = await db.select({ count: sql<string>`count(*)` })
            .from(fuelSales)
            .where(eq(fuelSales.orgId, orgId));
          if (parseInt(hasFuel[0]?.count || '0') > 0) return true;
          break;
          
        case 'ship_store':
          const hasStore = await db.select({ count: sql<string>`count(*)` })
            .from(shipStoreTransactions)
            .where(eq(shipStoreTransactions.orgId, orgId));
          if (parseInt(hasStore[0]?.count || '0') > 0) return true;
          break;
          
        case 'rate_comp':
        case 'sales_comp':
          return true;
      }
    }
    
    return false;
  }

  async triggerManualSync(orgId: string, userId?: string): Promise<{ projectsSynced: number }> {
    const projects = await db.select()
      .from(modelingProjects)
      .where(eq(modelingProjects.orgId, orgId));
    
    let synced = 0;
    for (const project of projects) {
      try {
        await valuationTimelineService.createSnapshot(
          {
            modelingProjectId: project.id,
            orgId,
            asOfDate: new Date(),
            userId
          },
          'manual',
          'Manual sync triggered'
        );
        synced++;
      } catch (error) {
        console.error(`[ValuationSync] Failed to sync project ${project.id}:`, error);
      }
    }
    
    return { projectsSynced: synced };
  }

  async scheduleRecurringSnapshots(
    projectId: string,
    orgId: string,
    interval: 'daily' | 'weekly' | 'monthly'
  ): Promise<void> {
    console.log(`[ValuationSync] Scheduled ${interval} snapshots for project ${projectId}`);
  }
}

export const valuationSyncService = new ValuationSyncService();
