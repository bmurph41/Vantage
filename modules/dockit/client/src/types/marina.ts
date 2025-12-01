export interface DashboardStats {
  todaysLaunches: number;
  availableSlips: number;
  totalSlips: number;
  monthlyRevenue: number;
  occupancyRate: number;
  occupiedSlips: number;
  overduePayments: number;
}

export interface LaunchWithDetails {
  id: string;
  customerId: string;
  boatId: string;
  scheduledTime: string;
  status: string;
  notes?: string;
  customerName?: string;
  boatInfo?: string;
}

export interface IntegrationStatus {
  id: string;
  platform: string;
  isEnabled: boolean;
  syncStatus: string;
  lastSync?: string;
}

export interface ActivityItem {
  id: string;
  customerId: string;
  customerName: string;
  customerInitials: string;
  action: string;
  timestamp: string;
  status: string;
}

export interface InventoryStatus {
  wetSlips: {
    total: number;
    occupied: number;
    available: number;
    occupancyRate: number;
  };
  dryStorage: {
    total: number;
    occupied: number;
    available: number;
    occupancyRate: number;
  };
  trailerStorage: {
    total: number;
    occupied: number;
    available: number;
    occupancyRate: number;
  };
}
