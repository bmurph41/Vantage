import type { RentRoll, RentRollEntry } from '@shared/schema';

export type { RentRoll, RentRollEntry };

export interface RentRollSummary {
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  occupancyRate: number;
  totalMonthlyRevenue: number;
  averageRatePerUnit: number;
  revenueByType: {
    slip: number;
    rack: number;
    commercial: number;
    seasonal: number;
  };
}

export const RENT_ROLL_QUERY_KEYS = {
  all: () => ['/api/operations/rent-rolls'] as const,
  byId: (id: string) => ['/api/operations/rent-rolls', id] as const,
  entries: (rentRollId: string) => ['/api/operations/rent-rolls', rentRollId, 'entries'] as const,
  summary: (rentRollId: string) => ['/api/operations/rent-rolls', rentRollId, 'summary'] as const,
};
