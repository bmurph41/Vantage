import { BaseConnector, ConnectorConfig, EntitySyncConfig, SyncResult } from './base';

const QUALIA_BASE_URL = 'https://api.qualia.com/v1';
const QUALIA_SANDBOX_URL = 'https://api.sandbox.qualia.com/v1';

interface QualiaClosingOrder {
  id: string;
  orderNumber: string;
  status: string;
  propertyAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  closingDate?: string;
  buyerName?: string;
  sellerName?: string;
  transactionType?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface QualiaMilestone {
  id: string;
  orderId: string;
  name: string;
  status: string;
  dueDate?: string;
  completedDate?: string;
  assignedTo?: string;
}

interface QualiaDocument {
  id: string;
  orderId: string;
  name: string;
  type: string;
  status: string;
  uploadedAt?: string;
  uploadedBy?: string;
  fileSize?: number;
}

interface QualiaSettlementStatement {
  id: string;
  orderId: string;
  type: string;
  totalAmount?: number;
  buyerCredits?: number;
  sellerCredits?: number;
  status: string;
  lineItems?: Array<{
    description: string;
    amount: number;
    category: string;
  }>;
}

export class QualiaConnector extends BaseConnector {
  private baseUrl: string;

  constructor(config: ConnectorConfig) {
    super(config);
    const environment = this.getSetting('environment', 'production');
    this.baseUrl = environment === 'sandbox' ? QUALIA_SANDBOX_URL : QUALIA_BASE_URL;
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ id: string; name: string }>('/organizations/me');

      return {
        connected: true,
        message: `Connected to ${response.name || 'Qualia'}`,
        details: {
          organizationId: response.id,
          organizationName: response.name,
        },
      };
    } catch (error) {
      return {
        connected: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  getSupportedEntities(): EntitySyncConfig[] {
    return [
      {
        sourceEntity: 'closing_orders',
        targetEntity: 'closingOrders',
        targetModule: 'crm',
        syncDirection: 'read',
        batchSize: 100,
      },
      {
        sourceEntity: 'milestones',
        targetEntity: 'closingMilestones',
        targetModule: 'crm',
        syncDirection: 'read',
        batchSize: 100,
      },
      {
        sourceEntity: 'documents',
        targetEntity: 'closingDocs',
        targetModule: 'documents',
        syncDirection: 'read',
        batchSize: 100,
      },
      {
        sourceEntity: 'settlement_statements',
        targetEntity: 'closingCosts',
        targetModule: 'financials',
        syncDirection: 'read',
        batchSize: 50,
      },
    ];
  }

  async fetchEntities(
    entityType: string,
    options?: { since?: Date; limit?: number; offset?: number }
  ): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    switch (entityType) {
      case 'closing_orders':
        return this.fetchClosingOrders(options);
      case 'milestones':
        return this.fetchMilestones(options);
      case 'documents':
        return this.fetchDocuments(options);
      case 'settlement_statements':
        return this.fetchSettlementStatements(options);
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  private async fetchClosingOrders(options?: { since?: Date; limit?: number; offset?: number }): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const params: Record<string, string> = {
      limit: String(limit),
      offset: String(offset),
    };

    if (options?.since) {
      params.updated_after = options.since.toISOString();
    }

    const response = await this.makeAuthenticatedRequest<{ orders: QualiaClosingOrder[]; total: number }>(
      '/orders',
      params
    );

    const orders = response.orders || [];
    const total = response.total || orders.length;

    const transformed = orders.map(order => ({
      externalId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      propertyAddress: order.propertyAddress,
      closingDate: order.closingDate,
      buyerName: order.buyerName,
      sellerName: order.sellerName,
      transactionType: order.transactionType,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      integrationSource: 'qualia',
    }));

    return {
      data: transformed,
      hasMore: offset + orders.length < total,
      total,
    };
  }

  private async fetchMilestones(options?: { since?: Date; limit?: number; offset?: number }): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const params: Record<string, string> = {
      limit: String(limit),
      offset: String(offset),
    };

    const response = await this.makeAuthenticatedRequest<{ milestones: QualiaMilestone[]; total: number }>(
      '/milestones',
      params
    );

    const milestones = response.milestones || [];
    const total = response.total || milestones.length;

    const transformed = milestones.map(milestone => ({
      externalId: milestone.id,
      orderId: milestone.orderId,
      name: milestone.name,
      status: milestone.status,
      dueDate: milestone.dueDate,
      completedDate: milestone.completedDate,
      assignedTo: milestone.assignedTo,
      integrationSource: 'qualia',
    }));

    return {
      data: transformed,
      hasMore: offset + milestones.length < total,
      total,
    };
  }

  private async fetchDocuments(options?: { since?: Date; limit?: number; offset?: number }): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const params: Record<string, string> = {
      limit: String(limit),
      offset: String(offset),
    };

    const response = await this.makeAuthenticatedRequest<{ documents: QualiaDocument[]; total: number }>(
      '/documents',
      params
    );

    const documents = response.documents || [];
    const total = response.total || documents.length;

    const transformed = documents.map(doc => ({
      externalId: doc.id,
      orderId: doc.orderId,
      name: doc.name,
      type: doc.type,
      status: doc.status,
      uploadedAt: doc.uploadedAt,
      uploadedBy: doc.uploadedBy,
      fileSize: doc.fileSize,
      integrationSource: 'qualia',
    }));

    return {
      data: transformed,
      hasMore: offset + documents.length < total,
      total,
    };
  }

  private async fetchSettlementStatements(options?: { since?: Date; limit?: number; offset?: number }): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const params: Record<string, string> = {
      limit: String(limit),
      offset: String(offset),
    };

    const response = await this.makeAuthenticatedRequest<{ statements: QualiaSettlementStatement[]; total: number }>(
      '/settlement-statements',
      params
    );

    const statements = response.statements || [];
    const total = response.total || statements.length;

    const transformed = statements.map(stmt => ({
      externalId: stmt.id,
      orderId: stmt.orderId,
      type: stmt.type,
      totalAmount: stmt.totalAmount,
      buyerCredits: stmt.buyerCredits,
      sellerCredits: stmt.sellerCredits,
      status: stmt.status,
      lineItems: stmt.lineItems,
      integrationSource: 'qualia',
    }));

    return {
      data: transformed,
      hasMore: offset + statements.length < total,
      total,
    };
  }

  protected async saveEntity(
    entityType: string,
    data: any
  ): Promise<{ created: boolean; updated: boolean; id?: string }> {
    switch (entityType) {
      case 'closingOrders':
        return { created: true, updated: false, id: `order_${data.externalId}` };
      case 'closingMilestones':
        return { created: true, updated: false, id: `milestone_${data.externalId}` };
      case 'closingDocs':
        return { created: true, updated: false, id: `doc_${data.externalId}` };
      case 'closingCosts':
        return { created: true, updated: false, id: `settlement_${data.externalId}` };
      default:
        throw new Error(`Cannot save entity type: ${entityType}`);
    }
  }

  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<T> {
    const accessToken = this.getCredential('accessToken');
    const url = new URL(`${this.baseUrl}${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      throw new Error('Qualia access token expired. Please reconnect.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Qualia API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }
}
