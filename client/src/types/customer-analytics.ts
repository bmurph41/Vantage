export interface CustomerOverview {
  totalCustomers: number;
  activeCustomers: number;
  prospectCustomers: number;
  churnedCustomers: number;
  avgLifetimeValue: number;
  avgTenure: number;
  retentionRate: number;
  churnRate: number;
}

export interface TopCustomer {
  customerId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  lifetimeValue: number;
  tenureMonths: number;
  lastActivityDate: string | null;
  accountType: string;
  slipCount: number;
}

export interface CustomerSegment {
  segment: string;
  customerCount: number;
  totalRevenue: number;
  avgRevenue: number;
  percentage: number;
}

export interface ChurnRiskCustomer {
  customerId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  daysSinceLastActivity: number;
  lifetimeValue: number;
  riskLevel: 'high' | 'medium' | 'low';
}

export interface LtvDistribution {
  bucket: string;
  customerCount: number;
  minValue: number;
  maxValue: number;
}

export const CUSTOMER_ANALYTICS_QUERY_KEYS = {
  overview: () => ['/api/analytics/customers/overview'] as const,
  topCustomers: (limit: number = 20) => [`/api/analytics/customers/top?limit=${limit}`] as const,
  segments: () => ['/api/analytics/customers/segments'] as const,
  churnRisk: () => ['/api/analytics/customers/churn-risk'] as const,
  ltvDistribution: () => ['/api/analytics/customers/ltv-distribution'] as const,
} as const;
