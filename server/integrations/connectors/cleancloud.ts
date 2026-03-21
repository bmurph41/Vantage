import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';

// CleanCloud API (laundromat / dry cleaning PMS)
// Base: https://api.cleancloud.com/api/v2
// Auth: API key in X-API-Key header
// Entities: /orders, /customers, /machines, /revenue, /inventory
// Rate limit: 60 requests/minute

interface CleanCloudOrder {
  order_id: string;
  store_id: string;
  customer_id: string;
  order_number: string;
  order_type: 'wash_dry_fold' | 'dry_cleaning' | 'self_service' | 'pickup_delivery' | 'alterations' | 'commercial';
  items: Array<{
    item_type: string;
    quantity: number;
    weight_lbs?: number;
    unit_price: number;
    total_price: number;
    special_instructions?: string;
  }>;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  payment_status: 'unpaid' | 'partial' | 'paid' | 'refunded';
  payment_method?: 'cash' | 'credit_card' | 'debit_card' | 'app_payment' | 'account';
  status: 'received' | 'processing' | 'ready' | 'picked_up' | 'delivered' | 'cancelled';
  drop_off_date: string;
  ready_date?: string;
  pickup_date?: string;
  delivery_address?: string;
  rush_order: boolean;
  created_at: string;
}

interface CleanCloudCustomer {
  customer_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  account_balance: number;
  loyalty_points: number;
  membership_type?: 'basic' | 'premium' | 'commercial';
  total_orders: number;
  total_spent: number;
  preferences: {
    detergent?: string;
    starch?: 'none' | 'light' | 'medium' | 'heavy';
    hangers_or_folded?: 'hangers' | 'folded';
    fabric_softener?: boolean;
  };
  is_commercial: boolean;
  created_at: string;
}

interface CleanCloudMachine {
  machine_id: string;
  store_id: string;
  machine_number: string;
  machine_type: 'washer' | 'dryer' | 'pressing' | 'folding' | 'ironing';
  brand: string;
  model: string;
  capacity_lbs: number;
  status: 'available' | 'in_use' | 'out_of_order' | 'maintenance';
  cycle_price: number;
  current_cycle_end?: string;
  total_cycles: number;
  last_maintenance_date?: string;
  next_maintenance_date?: string;
  coin_operated: boolean;
  card_enabled: boolean;
  app_enabled: boolean;
}

interface CleanCloudRevenue {
  record_id: string;
  store_id: string;
  date: string;
  revenue_type: 'self_service' | 'drop_off' | 'delivery' | 'commercial' | 'vending' | 'other';
  gross_revenue: number;
  discounts: number;
  refunds: number;
  net_revenue: number;
  tax_collected: number;
  payment_breakdown: {
    cash: number;
    credit_card: number;
    debit_card: number;
    app_payment: number;
    account: number;
  };
  orders_count: number;
  avg_order_value: number;
}

interface CleanCloudInventory {
  item_id: string;
  store_id: string;
  item_name: string;
  category: 'detergent' | 'softener' | 'bleach' | 'starch' | 'hangers' | 'bags' | 'supplies' | 'vending';
  current_quantity: number;
  unit: string;
  reorder_point: number;
  reorder_quantity: number;
  unit_cost: number;
  supplier: string;
  last_ordered?: string;
  last_received?: string;
}

export class CleanCloudConnector extends BaseConnector {
  private baseUrl = 'https://api.cleancloud.com/api/v2';
  private storeId: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.storeId = this.getCredential('siteId');
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ store: { name: string; id: string; machine_count: number } }>(
        `/stores/${this.storeId}`
      );
      return {
        connected: true,
        message: `Connected to CleanCloud - ${response.store?.name || 'Unknown Store'}`,
        details: { storeName: response.store?.name, machineCount: response.store?.machine_count },
      };
    } catch (error) {
      return { connected: false, message: error instanceof Error ? error.message : 'Connection failed' };
    }
  }

  getSupportedEntities(): EntitySyncConfig[] {
    return [
      { sourceEntity: 'orders', targetEntity: 'orders', targetModule: 'operations', syncDirection: 'bidirectional', batchSize: 100 },
      { sourceEntity: 'customers', targetEntity: 'contacts', targetModule: 'crm', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'machines', targetEntity: 'equipment', targetModule: 'operations', syncDirection: 'read', batchSize: 50 },
      { sourceEntity: 'revenue', targetEntity: 'transactions', targetModule: 'accounting', syncDirection: 'read', batchSize: 200 },
      { sourceEntity: 'inventory', targetEntity: 'inventory', targetModule: 'operations', syncDirection: 'read', batchSize: 100 },
    ];
  }

  async fetchEntities(
    entityType: string,
    options?: { since?: Date; limit?: number; offset?: number; filters?: Record<string, any> }
  ): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;
    const sinceParam = options?.since ? `&since=${options.since.toISOString()}` : '';

    const endpointMap: Record<string, string> = {
      orders: `/stores/${this.storeId}/orders`,
      customers: `/stores/${this.storeId}/customers`,
      machines: `/stores/${this.storeId}/machines`,
      revenue: `/stores/${this.storeId}/revenue`,
      inventory: `/stores/${this.storeId}/inventory`,
    };

    const endpoint = endpointMap[entityType];
    if (!endpoint) throw new Error(`Unsupported entity type: ${entityType}`);

    const response = await this.makeAuthenticatedRequest<{ data: any[]; pagination: { total: number; has_more: boolean } }>(
      `${endpoint}?limit=${limit}&offset=${offset}${sinceParam}`
    );

    const records = response.data || [];
    const total = response.pagination?.total || records.length;
    const transformed = records.map(record => this.transformRecord(entityType, record));

    return { data: transformed, hasMore: response.pagination?.has_more || false, total };
  }

  private transformRecord(entityType: string, record: any): any {
    switch (entityType) {
      case 'orders': {
        const o = record as CleanCloudOrder;
        return {
          externalId: o.order_id, orderNumber: o.order_number,
          customerExternalId: o.customer_id, orderType: o.order_type,
          items: o.items, subtotal: o.subtotal, tax: o.tax,
          discount: o.discount, total: o.total,
          paymentStatus: o.payment_status, paymentMethod: o.payment_method,
          status: o.status, dropOffDate: o.drop_off_date,
          readyDate: o.ready_date, pickupDate: o.pickup_date,
          deliveryAddress: o.delivery_address, rushOrder: o.rush_order,
          integrationSource: 'cleancloud',
        };
      }
      case 'customers': {
        const c = record as CleanCloudCustomer;
        return {
          externalId: c.customer_id, firstName: c.first_name, lastName: c.last_name,
          email: c.email, phone: c.phone, address: c.address,
          accountBalance: c.account_balance, loyaltyPoints: c.loyalty_points,
          membershipType: c.membership_type, totalOrders: c.total_orders,
          totalSpent: c.total_spent, preferences: c.preferences,
          isCommercial: c.is_commercial, integrationSource: 'cleancloud',
        };
      }
      case 'machines': {
        const m = record as CleanCloudMachine;
        return {
          externalId: m.machine_id, machineNumber: m.machine_number,
          machineType: m.machine_type, brand: m.brand, model: m.model,
          capacityLbs: m.capacity_lbs, status: m.status, cyclePrice: m.cycle_price,
          totalCycles: m.total_cycles, lastMaintenanceDate: m.last_maintenance_date,
          nextMaintenanceDate: m.next_maintenance_date,
          coinOperated: m.coin_operated, cardEnabled: m.card_enabled,
          appEnabled: m.app_enabled, integrationSource: 'cleancloud',
        };
      }
      case 'revenue': {
        const r = record as CleanCloudRevenue;
        return {
          externalId: r.record_id, date: r.date, revenueType: r.revenue_type,
          grossRevenue: r.gross_revenue, discounts: r.discounts, refunds: r.refunds,
          netRevenue: r.net_revenue, taxCollected: r.tax_collected,
          paymentBreakdown: r.payment_breakdown, ordersCount: r.orders_count,
          avgOrderValue: r.avg_order_value, integrationSource: 'cleancloud',
        };
      }
      case 'inventory': {
        const i = record as CleanCloudInventory;
        return {
          externalId: i.item_id, itemName: i.item_name, category: i.category,
          currentQuantity: i.current_quantity, unit: i.unit,
          reorderPoint: i.reorder_point, reorderQuantity: i.reorder_quantity,
          unitCost: i.unit_cost, supplier: i.supplier,
          lastOrdered: i.last_ordered, lastReceived: i.last_received,
          integrationSource: 'cleancloud',
        };
      }
      default:
        return record;
    }
  }

  protected async saveEntity(
    entityType: string,
    data: any
  ): Promise<{ created: boolean; updated: boolean; id?: string }> {
    if (entityType === 'orders') {
      const endpoint = data.externalId
        ? `/stores/${this.storeId}/orders/${data.externalId}`
        : `/stores/${this.storeId}/orders`;
      const method = data.externalId ? 'PUT' : 'POST';

      const response = await this.makeAuthenticatedRequest<{ order_id: string }>(
        endpoint, { method, body: data }
      );
      return { created: !data.externalId, updated: !!data.externalId, id: response.order_id };
    }
    return { created: false, updated: false };
  }

  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    options?: { method?: string; body?: any }
  ): Promise<T> {
    const apiKey = this.getCredential('apiKey');
    return this.makeRequest<T>(`${this.baseUrl}${endpoint}`, {
      method: options?.method || 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json',
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
  }
}
