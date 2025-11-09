import type { InsertFuelSale } from "@shared/schema";

/**
 * FuelCloud API Integration Service
 * 
 * This service handles communication with the FuelCloud API for fuel transaction sync.
 * FuelCloud is the industry-standard fuel management system used by most marinas.
 * 
 * API Documentation: https://api.fuelcloud.com/v2/docs
 */

interface FuelCloudConfig {
  apiUrl: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
}

interface FuelCloudTransaction {
  id: string;
  timestamp: string;
  fuel_type: 'diesel' | 'regular_gas' | 'premium_gas' | 'ethanol_free';
  quantity_gallons: number;
  price_per_gallon: number;
  total_amount: number;
  customer_name?: string;
  boat_name?: string;
  slip_number?: string;
  pump_number?: string;
  payment_method?: 'cash' | 'credit_card' | 'debit_card' | 'account_charge' | 'check';
  status?: 'completed' | 'pending' | 'cancelled' | 'refunded';
  notes?: string;
  processed_by?: string;
}

interface FuelCloudSyncResponse {
  transactions: FuelCloudTransaction[];
  nextCursor?: string;
  hasMore: boolean;
  totalCount: number;
}

export class FuelCloudService {
  private config: FuelCloudConfig;

  constructor(config: FuelCloudConfig) {
    this.config = config;
  }

  /**
   * Test the connection to FuelCloud API
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const response = await fetch(`${this.config.apiUrl}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return {
          success: false,
          message: `Connection failed: ${response.statusText}`,
          details: { status: response.status }
        };
      }

      const data = await response.json();
      
      return {
        success: true,
        message: 'Connection successful',
        details: data
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: { error }
      };
    }
  }

  /**
   * Fetch transactions from FuelCloud API
   * 
   * @param startDate - Start date for transaction range (ISO string)
   * @param endDate - End date for transaction range (ISO string)
   * @param cursor - Pagination cursor for large datasets
   */
  async fetchTransactions(
    startDate?: string,
    endDate?: string,
    cursor?: string
  ): Promise<FuelCloudSyncResponse> {
    try {
      const params = new URLSearchParams();
      
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (cursor) params.append('cursor', cursor);
      params.append('limit', '100'); // Fetch 100 transactions per request

      const url = `${this.config.apiUrl}/transactions?${params.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`FuelCloud API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        transactions: data.transactions || [],
        nextCursor: data.next_cursor,
        hasMore: data.has_more || false,
        totalCount: data.total_count || data.transactions?.length || 0
      };
    } catch (error) {
      console.error('Error fetching FuelCloud transactions:', error);
      throw error;
    }
  }

  /**
   * Refresh the access token using the refresh token
   */
  async refreshAccessToken(): Promise<{ accessToken: string; expiresAt: Date }> {
    try {
      if (!this.config.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${this.config.apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          refresh_token: this.config.refreshToken
        })
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (data.expires_in || 3600));

      this.config.accessToken = data.access_token;
      this.config.tokenExpiresAt = expiresAt;

      return {
        accessToken: data.access_token,
        expiresAt
      };
    } catch (error) {
      console.error('Error refreshing FuelCloud token:', error);
      throw error;
    }
  }

  /**
   * Convert FuelCloud transaction to internal schema format
   */
  mapTransactionToInternal(
    transaction: FuelCloudTransaction,
    orgId: string,
    fieldMapping?: Record<string, string>
  ): Omit<InsertFuelSale, 'id' | 'createdAt' | 'updatedAt'> {
    // Apply field mapping if provided
    const mapped: any = { ...transaction };
    
    if (fieldMapping) {
      Object.entries(fieldMapping).forEach(([internalField, externalField]) => {
        if (externalField && transaction[externalField as keyof FuelCloudTransaction]) {
          mapped[internalField] = transaction[externalField as keyof FuelCloudTransaction];
        }
      });
    }

    return {
      orgId,
      transactionDate: new Date(transaction.timestamp),
      fuelType: transaction.fuel_type,
      quantityGallons: transaction.quantity_gallons,
      pricePerGallon: transaction.price_per_gallon,
      totalAmount: transaction.total_amount,
      customerName: transaction.customer_name || null,
      boatName: transaction.boat_name || null,
      slipNumber: transaction.slip_number || null,
      pumpNumber: transaction.pump_number || null,
      paymentMethod: transaction.payment_method || null,
      status: transaction.status || 'completed',
      notes: transaction.notes || null,
      processedBy: transaction.processed_by || null
    };
  }

  /**
   * Sync all new transactions since last sync
   * 
   * @param orgId - Organization ID
   * @param lastSyncDate - Last successful sync timestamp
   * @param fieldMapping - Custom field mapping configuration
   */
  async syncTransactions(
    orgId: string,
    lastSyncDate?: Date,
    fieldMapping?: Record<string, string>
  ): Promise<Omit<InsertFuelSale, 'id' | 'createdAt' | 'updatedAt'>[]> {
    const allTransactions: Omit<InsertFuelSale, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    const startDate = lastSyncDate 
      ? lastSyncDate.toISOString() 
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // Default: last 30 days

    while (hasMore) {
      const response = await this.fetchTransactions(startDate, undefined, cursor);
      
      const mappedTransactions = response.transactions.map(transaction =>
        this.mapTransactionToInternal(transaction, orgId, fieldMapping)
      );
      
      allTransactions.push(...mappedTransactions);
      
      cursor = response.nextCursor;
      hasMore = response.hasMore;
    }

    return allTransactions;
  }
}

/**
 * Create a FuelCloud service instance from integration settings
 */
export function createFuelCloudService(integration: {
  apiUrl: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
}): FuelCloudService | null {
  if (!integration.apiUrl || !integration.accessToken) {
    return null;
  }

  return new FuelCloudService({
    apiUrl: integration.apiUrl,
    accessToken: integration.accessToken,
    refreshToken: integration.refreshToken || undefined,
    tokenExpiresAt: integration.tokenExpiresAt || undefined
  });
}
