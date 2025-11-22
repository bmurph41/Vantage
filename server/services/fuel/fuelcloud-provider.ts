import type { InsertFuelSale } from "@shared/schema";
import type {
  FuelProvider,
  ProviderConfig,
  ConnectionTestResult,
  TokenRefreshResult,
  ProviderTransaction,
  SyncResult,
  FieldTransform
} from "./fuel-provider-interface";

/**
 * FuelCloud API Provider
 * 
 * Implementation of FuelProvider interface for FuelCloud API integration.
 * Handles OAuth, pagination, error recovery, and field mapping.
 */

interface FuelCloudTransaction extends ProviderTransaction {
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
  payment_method?: string;
  status?: string;
  notes?: string;
  processed_by?: string;
}

export class FuelCloudProvider implements FuelProvider {
  private config: ProviderConfig;
  private tokenRefreshPromise: Promise<TokenRefreshResult> | null = null;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  /**
   * Check if access token is expired or expiring soon (within 5 minutes)
   */
  private isTokenExpired(): boolean {
    if (!this.config.tokenExpiresAt) {
      return false;
    }
    const expiryBuffer = 5 * 60 * 1000; // 5 minutes
    return this.config.tokenExpiresAt.getTime() - Date.now() < expiryBuffer;
  }

  /**
   * Ensure we have a valid access token, refreshing if necessary
   * Concurrency-safe: multiple callers share the same refresh promise
   */
  private async ensureValidToken(): Promise<string> {
    if (!this.isTokenExpired()) {
      return this.config.accessToken;
    }

    // If refresh is already in progress, wait for it
    if (this.tokenRefreshPromise) {
      const result = await this.tokenRefreshPromise;
      return result.accessToken;
    }

    // Start a new refresh
    this.tokenRefreshPromise = this.refreshToken();
    
    try {
      const result = await this.tokenRefreshPromise;
      
      // Update config with new token
      this.config.accessToken = result.accessToken;
      if (result.refreshToken) {
        this.config.refreshToken = result.refreshToken;
      }
      this.config.tokenExpiresAt = result.expiresAt;
      
      return result.accessToken;
    } finally {
      this.tokenRefreshPromise = null;
    }
  }

  /**
   * Make an authenticated API request with automatic token refresh and retry
   */
  private async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const maxRetries = 3;
    const token = await this.ensureValidToken();

    const url = `${this.config.apiUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      // Handle 401 Unauthorized - token might have been invalidated
      if (response.status === 401 && retryCount < maxRetries) {
        // Force token refresh and retry
        this.config.tokenExpiresAt = new Date(0); // Mark as expired
        return this.apiRequest<T>(endpoint, options, retryCount + 1);
      }

      // Handle 429 Too Many Requests with exponential backoff
      if (response.status === 429 && retryCount < maxRetries) {
        const retryAfter = response.headers.get('Retry-After');
        const waitMs = retryAfter 
          ? parseInt(retryAfter) * 1000 
          : Math.pow(2, retryCount) * 1000;
        
        await new Promise(resolve => setTimeout(resolve, waitMs));
        return this.apiRequest<T>(endpoint, options, retryCount + 1);
      }

      // Handle 5xx errors with exponential backoff
      if (response.status >= 500 && retryCount < maxRetries) {
        const waitMs = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitMs));
        return this.apiRequest<T>(endpoint, options, retryCount + 1);
      }

      if (!response.ok) {
        throw new Error(`FuelCloud API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      // Network errors - retry with exponential backoff
      if (error instanceof TypeError && error.message.includes('fetch') && retryCount < maxRetries) {
        const waitMs = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitMs));
        return this.apiRequest<T>(endpoint, options, retryCount + 1);
      }
      throw error;
    }
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const data = await this.apiRequest<any>('/health');
      
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

  async refreshToken(): Promise<TokenRefreshResult> {
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
        throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (data.expires_in || 3600));

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt
      };
    } catch (error) {
      console.error('Error refreshing FuelCloud token:', error);
      throw error;
    }
  }

  async syncTransactions(
    startDate?: string,
    endDate?: string,
    cursor?: string,
    pageSize = 100
  ): Promise<SyncResult> {
    try {
      const params = new URLSearchParams();
      
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (cursor) params.append('cursor', cursor);
      params.append('limit', String(Math.min(pageSize, 500))); // Cap at 500

      const data = await this.apiRequest<{
        transactions: FuelCloudTransaction[];
        next_cursor?: string;
        has_more: boolean;
        total_count?: number;
      }>(`/transactions?${params.toString()}`);

      const transactions: Array<Omit<InsertFuelSale, 'id' | 'createdAt' | 'updatedAt'> & { externalId: string }> = [];
      const errors: Array<{ record: any; error: string }> = [];

      // Process each transaction with individual error handling
      for (const transaction of data.transactions || []) {
        try {
          const mapped = this.mapTransaction(transaction, this.config.orgId);
          transactions.push(mapped);
        } catch (error) {
          errors.push({
            record: transaction,
            error: error instanceof Error ? error.message : 'Mapping failed'
          });
        }
      }

      return {
        transactions,
        errors,
        cursor: data.next_cursor,
        hasMore: data.has_more || false,
        totalFetched: (data.transactions || []).length
      };
    } catch (error) {
      console.error('Error syncing FuelCloud transactions:', error);
      throw error;
    }
  }

  mapTransaction(
    transaction: FuelCloudTransaction,
    orgId: string
  ): Omit<InsertFuelSale, 'id' | 'createdAt' | 'updatedAt'> & { externalId: string } {
    const applyFieldTransform = (value: any, transform?: FieldTransform) => {
      if (!transform) return value;
      
      // Apply validation
      if (transform.validate && !transform.validate(value)) {
        return transform.fallback !== undefined ? transform.fallback : value;
      }
      
      // Apply transformation
      if (transform.transform) {
        try {
          return transform.transform(value);
        } catch (error) {
          console.error('Transform error:', error);
          return transform.fallback !== undefined ? transform.fallback : value;
        }
      }
      
      return value;
    };

    // Apply field mapping with transforms
    const mapping = this.config.fieldMapping || {};
    const getValue = (internalField: string, defaultField: keyof FuelCloudTransaction) => {
      const mappingConfig = mapping[internalField];
      
      if (!mappingConfig) {
        return transaction[defaultField];
      }
      
      if (typeof mappingConfig === 'string') {
        return (transaction as any)[mappingConfig];
      }
      
      // FieldTransform config
      const sourceValue = (transaction as any)[mappingConfig.source];
      return applyFieldTransform(sourceValue, mappingConfig);
    };

    return {
      orgId,
      externalId: transaction.id,
      transactionDate: new Date(transaction.timestamp),
      fuelType: getValue('fuelType', 'fuel_type') as any,
      quantityGallons: getValue('quantityGallons', 'quantity_gallons') as number,
      pricePerGallon: getValue('pricePerGallon', 'price_per_gallon') as number,
      totalAmount: getValue('totalAmount', 'total_amount') as number,
      customerName: getValue('customerName', 'customer_name') as string || null,
      boatName: getValue('boatName', 'boat_name') as string || null,
      slipNumber: getValue('slipNumber', 'slip_number') as string || null,
      pumpNumber: getValue('pumpNumber', 'pump_number') as string || null,
      paymentMethod: getValue('paymentMethod', 'payment_method') as any || null,
      status: (getValue('status', 'status') as any) || 'completed',
      notes: getValue('notes', 'notes') as string || null,
      processedBy: getValue('processedBy', 'processed_by') as string || null
    };
  }

  /**
   * Get updated token info after refresh (to persist to database)
   */
  getUpdatedTokenInfo(): {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  } {
    return {
      accessToken: this.config.accessToken,
      refreshToken: this.config.refreshToken,
      expiresAt: this.config.tokenExpiresAt
    };
  }
}
