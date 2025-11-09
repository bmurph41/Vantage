import type { InsertFuelSale } from "@shared/schema";

/**
 * Fuel Provider Interface
 * 
 * Generic interface for all fuel software providers (FuelCloud, MARINAGO, Dockwa, MarinaOffice).
 * This abstraction allows the system to support multiple providers with consistent behavior.
 */

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: any;
}

export interface TokenRefreshResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}

export interface ProviderTransaction {
  externalId: string;
  timestamp: string;
  [key: string]: any;
}

export interface SyncResult {
  transactions: Array<Omit<InsertFuelSale, 'id' | 'createdAt' | 'updatedAt'> & { externalId: string }>;
  errors: Array<{ record: any; error: string }>;
  cursor?: string;
  hasMore: boolean;
  totalFetched: number;
}

export interface FieldTransform {
  source: string;
  transform?: (value: any) => any;
  validate?: (value: any) => boolean;
  fallback?: any;
}

export interface FieldMappingConfig {
  [internalField: string]: string | FieldTransform;
}

/**
 * Base interface that all fuel providers must implement
 */
export interface FuelProvider {
  /**
   * Test connection to the provider API
   */
  testConnection(): Promise<ConnectionTestResult>;

  /**
   * Refresh OAuth access token
   */
  refreshToken(): Promise<TokenRefreshResult>;

  /**
   * Fetch and map transactions from provider
   * 
   * @param startDate - Start of date range (ISO string)
   * @param endDate - End of date range (ISO string)
   * @param cursor - Pagination cursor
   * @param pageSize - Number of records per page
   */
  syncTransactions(
    startDate?: string,
    endDate?: string,
    cursor?: string,
    pageSize?: number
  ): Promise<SyncResult>;

  /**
   * Map a single provider transaction to internal schema
   */
  mapTransaction(
    transaction: ProviderTransaction,
    orgId: string
  ): Omit<InsertFuelSale, 'id' | 'createdAt' | 'updatedAt'> & { externalId: string };
}

/**
 * Configuration required to initialize a provider
 */
export interface ProviderConfig {
  apiUrl: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  fieldMapping?: FieldMappingConfig;
  orgId: string;
}

/**
 * Registry for fuel providers
 */
export class FuelProviderRegistry {
  private providers = new Map<string, new (config: ProviderConfig) => FuelProvider>();

  register(providerName: string, providerClass: new (config: ProviderConfig) => FuelProvider) {
    this.providers.set(providerName.toLowerCase(), providerClass);
  }

  create(providerName: string, config: ProviderConfig): FuelProvider | null {
    const ProviderClass = this.providers.get(providerName.toLowerCase());
    if (!ProviderClass) {
      return null;
    }
    return new ProviderClass(config);
  }

  getSupportedProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}

// Global registry instance
export const fuelProviderRegistry = new FuelProviderRegistry();
