/**
 * Cross-Module Event System - Phase 3A
 * 
 * Implements a lightweight pub/sub event system for broadcasting
 * entity changes across modules. This enables:
 * - Deal stage transitions triggering DD project creation
 * - Property updates refreshing related deal values
 * - DockTalk articles being linked when entities are mentioned
 * - Activity logging across all entity changes
 * 
 * The event system uses an in-memory EventEmitter pattern that can
 * be extended to use Redis pub/sub for horizontal scaling.
 */

import { EventEmitter } from "events";
import { createChildLogger } from "../lib/logger";

const logger = createChildLogger({ module: 'cross-module-events' });

// ============================================================================
// Event Types
// ============================================================================

export type EntityType = 
  | 'contact'
  | 'company' 
  | 'property'
  | 'deal'
  | 'dd_project'
  | 'modeling_project'
  | 'docktalk_article';

export type EventAction = 
  | 'created'
  | 'updated'
  | 'deleted'
  | 'linked'
  | 'unlinked'
  | 'stage_changed'
  | 'status_changed'
  | 'assigned'
  | 'completed';

export interface CrossModuleEvent {
  type: EntityType;
  action: EventAction;
  entityId: string;
  orgId: string;
  userId?: string;
  timestamp: Date;
  data: Record<string, unknown>;
  metadata?: {
    previousValue?: unknown;
    newValue?: unknown;
    relatedEntities?: Array<{ type: EntityType; id: string }>;
    source?: string;
  };
}

export interface DealStageChangedEvent extends CrossModuleEvent {
  type: 'deal';
  action: 'stage_changed';
  data: {
    dealId: string;
    dealTitle: string;
    fromStage: string;
    toStage: string;
    probability?: number;
  };
}

export interface EntityLinkedEvent extends CrossModuleEvent {
  action: 'linked' | 'unlinked';
  data: {
    sourceType: EntityType;
    sourceId: string;
    targetType: EntityType;
    targetId: string;
    linkType?: string;
    role?: string;
  };
}

export interface DDProjectStatusEvent extends CrossModuleEvent {
  type: 'dd_project';
  action: 'status_changed' | 'completed';
  data: {
    projectId: string;
    projectName: string;
    fromStatus?: string;
    toStatus: string;
    dealId?: string;
    modelingProjectId?: string;
  };
}

// Event handler type
export type EventHandler = (event: CrossModuleEvent) => void | Promise<void>;

// ============================================================================
// Cross-Module Event Bus
// ============================================================================

class CrossModuleEventBus {
  private emitter: EventEmitter;
  private handlers: Map<string, EventHandler[]>;
  private eventLog: CrossModuleEvent[];
  private maxLogSize: number;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50); // Allow many subscribers
    this.handlers = new Map();
    this.eventLog = [];
    this.maxLogSize = 1000; // Keep last 1000 events in memory
  }

  /**
   * Emit an event to all subscribers
   */
  emit(event: CrossModuleEvent): void {
    // Ensure timestamp
    event.timestamp = event.timestamp || new Date();
    
    // Log the event
    this.eventLog.push(event);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift(); // Remove oldest event
    }

    // Emit to type-specific listeners
    const eventKey = `${event.type}:${event.action}`;
    this.emitter.emit(eventKey, event);
    
    // Emit to type listeners (all actions)
    this.emitter.emit(event.type, event);
    
    // Emit to global listeners
    this.emitter.emit('*', event);

    logger.debug({
      eventKey,
      entityId: event.entityId,
      orgId: event.orgId,
      data: event.data,
    }, `Cross-module event: ${eventKey}`);
  }

  /**
   * Subscribe to specific event type and action
   * @param type Entity type or '*' for all
   * @param action Event action or '*' for all
   * @param handler Event handler function
   */
  on(type: EntityType | '*', action: EventAction | '*', handler: EventHandler): void {
    const eventKey = action === '*' ? type : `${type}:${action}`;
    this.emitter.on(eventKey, handler);
  }

  /**
   * Subscribe to event once
   */
  once(type: EntityType | '*', action: EventAction | '*', handler: EventHandler): void {
    const eventKey = action === '*' ? type : `${type}:${action}`;
    this.emitter.once(eventKey, handler);
  }

  /**
   * Unsubscribe from event
   */
  off(type: EntityType | '*', action: EventAction | '*', handler: EventHandler): void {
    const eventKey = action === '*' ? type : `${type}:${action}`;
    this.emitter.off(eventKey, handler);
  }

  /**
   * Get recent events (for debugging/monitoring)
   */
  getRecentEvents(limit: number = 50, filter?: { type?: EntityType; action?: EventAction }): CrossModuleEvent[] {
    let events = [...this.eventLog];
    
    if (filter?.type) {
      events = events.filter(e => e.type === filter.type);
    }
    if (filter?.action) {
      events = events.filter(e => e.action === filter.action);
    }
    
    return events.slice(-limit);
  }

  /**
   * Get events for a specific entity
   */
  getEntityEvents(type: EntityType, entityId: string, limit: number = 50): CrossModuleEvent[] {
    return this.eventLog
      .filter(e => e.type === type && e.entityId === entityId)
      .slice(-limit);
  }

  /**
   * Clear event log (for testing)
   */
  clearLog(): void {
    this.eventLog = [];
  }
}

// Singleton instance
export const eventBus = new CrossModuleEventBus();

// ============================================================================
// Event Helper Functions
// ============================================================================

/**
 * Emit a deal stage change event
 */
export function emitDealStageChanged(params: {
  dealId: string;
  dealTitle: string;
  fromStage: string;
  toStage: string;
  probability?: number;
  orgId: string;
  userId?: string;
}): void {
  eventBus.emit({
    type: 'deal',
    action: 'stage_changed',
    entityId: params.dealId,
    orgId: params.orgId,
    userId: params.userId,
    timestamp: new Date(),
    data: {
      dealId: params.dealId,
      dealTitle: params.dealTitle,
      fromStage: params.fromStage,
      toStage: params.toStage,
      probability: params.probability,
    },
    metadata: {
      previousValue: params.fromStage,
      newValue: params.toStage,
    },
  });
}

/**
 * Emit an entity created event
 */
export function emitEntityCreated(params: {
  type: EntityType;
  entityId: string;
  orgId: string;
  userId?: string;
  data: Record<string, unknown>;
  relatedEntities?: Array<{ type: EntityType; id: string }>;
}): void {
  eventBus.emit({
    type: params.type,
    action: 'created',
    entityId: params.entityId,
    orgId: params.orgId,
    userId: params.userId,
    timestamp: new Date(),
    data: params.data,
    metadata: {
      relatedEntities: params.relatedEntities,
    },
  });
}

/**
 * Emit an entity updated event
 */
export function emitEntityUpdated(params: {
  type: EntityType;
  entityId: string;
  orgId: string;
  userId?: string;
  data: Record<string, unknown>;
  previousData?: Record<string, unknown>;
}): void {
  eventBus.emit({
    type: params.type,
    action: 'updated',
    entityId: params.entityId,
    orgId: params.orgId,
    userId: params.userId,
    timestamp: new Date(),
    data: params.data,
    metadata: {
      previousValue: params.previousData,
      newValue: params.data,
    },
  });
}

/**
 * Emit an entity linked event
 */
export function emitEntityLinked(params: {
  sourceType: EntityType;
  sourceId: string;
  targetType: EntityType;
  targetId: string;
  linkType?: string;
  role?: string;
  orgId: string;
  userId?: string;
}): void {
  eventBus.emit({
    type: params.sourceType,
    action: 'linked',
    entityId: params.sourceId,
    orgId: params.orgId,
    userId: params.userId,
    timestamp: new Date(),
    data: {
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      targetType: params.targetType,
      targetId: params.targetId,
      linkType: params.linkType,
      role: params.role,
    },
    metadata: {
      relatedEntities: [{ type: params.targetType, id: params.targetId }],
    },
  });
}

/**
 * Emit an entity unlinked event
 */
export function emitEntityUnlinked(params: {
  sourceType: EntityType;
  sourceId: string;
  targetType: EntityType;
  targetId: string;
  orgId: string;
  userId?: string;
}): void {
  eventBus.emit({
    type: params.sourceType,
    action: 'unlinked',
    entityId: params.sourceId,
    orgId: params.orgId,
    userId: params.userId,
    timestamp: new Date(),
    data: {
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      targetType: params.targetType,
      targetId: params.targetId,
    },
  });
}

/**
 * Emit a DD project status change event
 */
export function emitDDProjectStatusChanged(params: {
  projectId: string;
  projectName: string;
  fromStatus?: string;
  toStatus: string;
  dealId?: string;
  modelingProjectId?: string;
  orgId: string;
  userId?: string;
}): void {
  eventBus.emit({
    type: 'dd_project',
    action: params.toStatus === 'completed' ? 'completed' : 'status_changed',
    entityId: params.projectId,
    orgId: params.orgId,
    userId: params.userId,
    timestamp: new Date(),
    data: {
      projectId: params.projectId,
      projectName: params.projectName,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      dealId: params.dealId,
      modelingProjectId: params.modelingProjectId,
    },
    metadata: {
      previousValue: params.fromStatus,
      newValue: params.toStatus,
      relatedEntities: [
        ...(params.dealId ? [{ type: 'deal' as EntityType, id: params.dealId }] : []),
        ...(params.modelingProjectId ? [{ type: 'modeling_project' as EntityType, id: params.modelingProjectId }] : []),
      ],
    },
  });
}

// ============================================================================
// Default Event Handlers (Auto-registered)
// ============================================================================

// Handler: When a deal moves to certain stages, log and potentially trigger actions
eventBus.on('deal', 'stage_changed', async (event) => {
  const { dealId, fromStage, toStage } = event.data as {
    dealId: string;
    fromStage: string;
    toStage: string;
  };
  
  logger.info({ dealId, fromStage, toStage }, `Deal stage changed: ${fromStage} -> ${toStage}`);
  
  // Could trigger automatic DD project creation, notifications, etc.
  // These would be implemented based on business rules
});

// Handler: Log all entity links for audit purposes
eventBus.on('*', '*', (event) => {
  if (event.action === 'linked' || event.action === 'unlinked') {
    logger.debug({ action: event.action, data: event.data }, `Entity link ${event.action}`);
  }
});

logger.info('Event bus initialized with default handlers');
