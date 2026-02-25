// Fuel Sales API Response Types

export interface FuelType {
  id: string;
  name: string;
  category: string;
  currentPrice: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  fuelTypeId: string;
  gallons: string;
  pricePerGallon: string;
  totalAmount: string;
  paymentMethod: 'cash' | 'check';
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  customerName?: string | null;
  customerEmail?: string | null;
  createdAt: string;
}

export interface Inventory {
  id: string;
  fuelTypeId: string;
  currentLevel: string;
  capacity: string;
  reorderPoint: string;
  reorderQuantity: string;
  lastUpdated: string;
}

export interface Delivery {
  id: string;
  fuelTypeId: string;
  quantity: string;
  cost: string;
  supplier: string;
  deliveryDate: string;
  invoiceNumber?: string | null;
  createdAt: string;
}

export interface FinancialProjection {
  id: string;
  month: number;
  year: number;
  projectedRevenue: string;
  projectedGallons: string;
  projectedCosts: string;
  growthRate: string;
  createdAt: string;
}

// Response types with relations
export interface TransactionWithFuelType extends Omit<Transaction, 'fuelTypeId'> {
  fuelType: FuelType;
}

export interface InventoryWithFuelType extends Omit<Inventory, 'fuelTypeId'> {
  fuelType: FuelType;
}

export interface DeliveryWithFuelType extends Omit<Delivery, 'fuelTypeId'> {
  fuelType: FuelType;
}

// Analytics types
export interface DashboardStats {
  todaysSales: string;
  gallonsSold: string;
  avgPricePerGallon: string;
  lowStockAlerts: InventoryWithFuelType[];
}

export interface SalesAnalytics {
  daily: {
    date: string;
    revenue: string;
    gallons: string;
  }[];
  fuelTypeBreakdown: {
    fuelType: string;
    revenue: string;
    gallons: string;
  }[];
}

// Response collections
export type FuelTypesResponse = FuelType[];
export type TransactionsResponse = TransactionWithFuelType[];
export type InventoryResponse = InventoryWithFuelType[];
export type DeliveriesResponse = DeliveryWithFuelType[];
export type FinancialProjectionsResponse = FinancialProjection[];
