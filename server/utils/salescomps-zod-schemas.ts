import { z } from 'zod';
import { STORAGE_TYPES } from '@shared/salescomps-constants';

export const salesCompCreateSchema = z.object({
  marina: z.string().min(1, "Marina name is required"),
  salePrice: z.number().positive().optional().transform(val => val?.toString()),
  isPriceDisclosed: z.boolean().default(true),
  capRate: z.number().min(0).max(100).optional().transform(val => val?.toString()),
  isCapRateDisclosed: z.boolean().default(true),
  noi: z.number().positive().optional().transform(val => val?.toString()),
  isNoiDisclosed: z.boolean().default(true),
  saleMonth: z.number().min(1).max(12).optional(),
  saleYear: z.number().min(1900).max(new Date().getFullYear() + 1).optional(),
  city: z.string().optional(),
  market: z.string().optional(), // Legacy - use city
  state: z.string().min(1).max(50).optional(),
  wetSlips: z.number().int().min(0).optional(),
  dryRacks: z.number().int().min(0).optional(),
  ioBoth: z.preprocess(v => v === '' || v === 'none' ? undefined : v, z.enum(STORAGE_TYPES).optional()),
  storageTypes: z.array(z.enum(STORAGE_TYPES)).default([]),
  bodyOfWater: z.string().optional(),
  waterBodyName: z.string().optional(),
  waterfront: z.string().optional(),
  region: z.string().optional(),
  saleCondition: z.string().optional(),
  daysOnMarket: z.number().int().min(0).optional(),
  broker: z.string().optional(),
  address: z.string().optional(),
  zip: z.string().optional(),
  lat: z.string().optional(), // Geocoded latitude (stored as string in DB)
  lng: z.string().optional(), // Geocoded longitude (stored as string in DB)
  seller: z.string().optional(),
  company: z.string().optional(),
  owner: z.string().optional(),
  listPrice: z.number().positive().optional().transform(val => val?.toString()),
  acres: z.number().positive().optional().transform(val => val?.toString()),
  occupancy: z.number().min(0).max(100).optional().transform(val => val?.toString()),
  yearBuilt: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
  articleUrls: z.array(z.string().url()).default([]),
  notes: z.string().optional(),
  waterType: z.enum(['Coastal', 'Lake', 'River']).optional(),
  coastalType: z.enum(['Coastal', 'Lake', 'River']).optional(), // Legacy - use waterType
  
  // Portfolio functionality
  isPortfolio: z.boolean().default(false),
  parentPortfolioId: z.string().uuid().nullable().optional(),
  
  // Profit centers
  profitCenterStorage: z.boolean().default(false),
  profitCenterEvents: z.boolean().default(false),
  profitCenterService: z.boolean().default(false),
  profitCenterThirdPartyLeases: z.boolean().default(false),
  profitCenterBoatRentals: z.boolean().default(false),
  profitCenterBoatBrokerage: z.boolean().default(false),
  profitCenterRvPark: z.boolean().default(false),
  profitCenterFuel: z.boolean().default(false),
  profitCenterShipStore: z.boolean().default(false),
  profitCenterParts: z.boolean().default(false),
  profitCenterBoatClub: z.boolean().default(false),
  profitCenterBoatSales: z.boolean().default(false),
  profitCenterFnb: z.boolean().default(false),
  profitCenterHospitality: z.boolean().default(false),
  
  // Profit center operation types
  profitCenterBoatRentalsType: z.string().nullable().optional(),
  profitCenterBoatBrokerageType: z.string().nullable().optional(),
  profitCenterFuelType: z.string().nullable().optional(),
  profitCenterShipStoreType: z.string().nullable().optional(),
  profitCenterPartsType: z.string().nullable().optional(),
  profitCenterBoatSalesType: z.string().nullable().optional(),
  profitCenterFnbType: z.string().nullable().optional(),
  profitCenterHospitalityType: z.string().nullable().optional(),
  profitCenterBoatClubType: z.string().nullable().optional(),
  profitCenterBoatClubCompany: z.string().nullable().optional(),
  
  custom: z.record(z.unknown()).default({}),
});

export const salesCompUpdateSchema = salesCompCreateSchema.partial();

export const bulkUpdateSchema = z.object({
  ids: z.array(z.string().uuid()),
  updates: salesCompUpdateSchema,
});

export const compColumnCreateSchema = z.object({
  key: z.string().min(1).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid key format"),
  label: z.string().min(1, "Label is required"),
  type: z.enum(['text', 'number', 'currency', 'percent', 'date', 'boolean', 'select']),
  options: z.array(z.string()).optional(),
  required: z.boolean().default(false),
  visible: z.boolean().default(true),
  orderIndex: z.number().int().default(0),
});

export const compColumnUpdateSchema = compColumnCreateSchema.partial().omit({ key: true });

export const compFiltersSchema = z.object({
  q: z.string().optional(),
  state: z.string().optional(),
  region: z.string().optional(),
  saleYearMin: z.coerce.number().int().optional(),
  saleYearMax: z.coerce.number().int().optional(),
  priceMin: z.coerce.number().positive().optional(),
  priceMax: z.coerce.number().positive().optional(),
  capRateMin: z.coerce.number().min(0).max(100).optional(),
  capRateMax: z.coerce.number().min(0).max(100).optional(),
  occupancyMin: z.coerce.number().min(0).max(100).optional(),
  occupancyMax: z.coerce.number().min(0).max(100).optional(),
  wetSlipsMin: z.coerce.number().int().min(0).optional(),
  wetSlipsMax: z.coerce.number().int().min(0).optional(),
  dryRacksMin: z.coerce.number().int().min(0).optional(),
  dryRacksMax: z.coerce.number().int().min(0).optional(),
  ioBoth: z.preprocess(v => v === '' || v === 'none' ? undefined : v, z.enum(STORAGE_TYPES).optional()),
  disclosedOnly: z.coerce.boolean().optional(),
  disclosedCapRateOnly: z.coerce.boolean().optional(),
  portfoliosOnly: z.coerce.boolean().optional(),
  columnFilters: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return {};
        }
      }
      return val || {};
    },
    z.record(z.array(z.string())).default({})
  ),
  includePortfolios: z.coerce.boolean().optional(),
  excludePortfolios: z.coerce.boolean().optional(),
  sortBy: z.string().default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(10000).default(25),
});

export const columnMappingSchema = z.object({
  mapping: z.record(z.string()),
  normalization: z.object({
    currency: z.boolean().default(true),
    months: z.boolean().default(true),
    states: z.boolean().default(true),
    undisclosed: z.boolean().default(true),
  }),
});

// Project schemas
export const projectCreateSchema = z.object({
  name: z.string().min(1, "Project name is required").max(255, "Project name too long"),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format (use hex format like #FF0000)").optional(),
});

export const projectUpdateSchema = projectCreateSchema.partial();

// Project-Comp schemas
export const projectCompCreateSchema = z.object({
  salesCompId: z.string().uuid("Invalid sales comp ID"),
  notes: z.string().optional(),
});

export const projectCompUpdateSchema = z.object({
  notes: z.string().optional(),
});

export const projectCompBulkSchema = z.object({
  salesCompIds: z.array(z.string().uuid()).min(1, "At least one sales comp ID is required"),
});

// Report response schemas
export const analyticsReportDataSchema = z.object({
  totalComps: z.number().int().min(0),
  totalVolume: z.number().min(0),
  averagePrice: z.number().min(0),
  averageCapRate: z.number().min(0),
  timeSeries: z.array(z.object({
    year: z.number().int(),
    count: z.number().int().min(0),
    totalVolume: z.number().min(0),
    avgPrice: z.number().min(0),
  })),
  priceDistribution: z.array(z.object({
    bin: z.string(),
    count: z.number().int().min(0),
  })),
  stateBreakdown: z.array(z.object({
    state: z.string(),
    count: z.number().int().min(0),
    totalVolume: z.number().min(0),
    avgPrice: z.number().min(0),
  })),
  topMarkets: z.array(z.object({
    market: z.string(),
    count: z.number().int().min(0),
    totalVolume: z.number().min(0),
    avgPrice: z.number().min(0),
  })),
});

export const analyticsNarrativeSchema = z.object({
  executiveSummary: z.string(),
  marketTrends: z.string(),
  priceAnalysis: z.string(),
  investmentInsights: z.string(),
  recommendations: z.string(),
});

export const analyticsReportResponseSchema = z.object({
  data: analyticsReportDataSchema,
  narrative: analyticsNarrativeSchema,
  generatedAt: z.string().datetime(),
});

export const projectReportDataSchema = z.object({
  project: z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    color: z.string().nullable(),
    compsCount: z.number().int().min(0),
    totalVolume: z.number().min(0),
    averagePrice: z.number().min(0),
    averageCapRate: z.number().min(0),
  }),
  comps: z.array(z.object({
    id: z.string().uuid(),
    marina: z.string(),
    state: z.string().nullable(),
    market: z.string().nullable(),
    salePrice: z.number().nullable(),
    capRate: z.number().nullable(),
    saleYear: z.number().int().nullable(),
    saleMonth: z.string().nullable(),
  })),
  insights: z.object({
    marketTrends: z.array(z.object({
      year: z.number().int(),
      avgPrice: z.number().min(0),
      count: z.number().int().min(0),
    })),
    priceRanges: z.array(z.object({
      range: z.string(),
      count: z.number().int().min(0),
      percentage: z.number().min(0).max(100),
    })),
    geographicDistribution: z.array(z.object({
      state: z.string(),
      count: z.number().int().min(0),
      avgPrice: z.number().min(0),
    })),
  }),
});

export const projectNarrativeSchema = z.object({
  projectOverview: z.string(),
  portfolioAnalysis: z.string(),
  marketPosition: z.string(),
  riskAssessment: z.string(),
  strategicRecommendations: z.string(),
});

export const projectReportResponseSchema = z.object({
  data: projectReportDataSchema,
  narrative: projectNarrativeSchema,
  generatedAt: z.string().datetime(),
});

// Market & Metrics API validation schemas

// Metric Series schemas
export const metricSeriesCreateSchema = z.object({
  key: z.string().min(1).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid key format"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: z.enum(['internal', 'macro', 'rates', 'fuel']),
  metricType: z.enum(['gauge', 'counter', 'histogram', 'summary']),
  unit: z.enum(['percent', 'currency', 'count', 'days', 'ratio']).optional(),
  dataSource: z.enum(['manual', 'calculated', 'imported', 'api']).optional(),
  calculationFormula: z.string().optional(),
  displayFormat: z.string().optional(),
  aggregationMethod: z.enum(['sum', 'avg', 'min', 'max', 'last', 'count']).default('avg'),
  tags: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  defaultThresholds: z.object({
    warning: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
    }).optional(),
    critical: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
    }).optional(),
  }).optional(),
});

export const metricSeriesUpdateSchema = metricSeriesCreateSchema.partial().omit({ key: true });

export const metricSeriesFiltersSchema = z.object({
  category: z.enum(['internal', 'macro', 'rates', 'fuel']).optional(),
  metricType: z.enum(['gauge', 'counter', 'histogram', 'summary']).optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

// Metric Points schemas
export const metricPointCreateSchema = z.object({
  timestamp: z.string().datetime().transform((val) => new Date(val)),
  value: z.number().transform(val => val.toString()),
  dimensions: z.record(z.string()).default({}),
  metadata: z.record(z.unknown()).default({}),
  confidence: z.number().min(0).max(1).optional().transform(val => val?.toString()),
  source: z.string().optional(),
  aggregationPeriod: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']).optional(),
  samplesCount: z.number().int().min(1).optional(),
});

export const metricPointsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  aggregationPeriod: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']).optional(),
  dimensions: z.record(z.string()).optional(),
  limit: z.coerce.number().int().min(1).max(10000).default(1000),
  offset: z.coerce.number().int().min(0).default(0),
});

// Metric Alerts schemas
export const metricAlertCreateSchema = z.object({
  metricSeriesId: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  alertType: z.enum(['threshold', 'anomaly', 'change', 'missing_data']),
  severity: z.enum(['info', 'warning', 'critical']),
  thresholdMin: z.number().optional().transform(val => val?.toString()),
  thresholdMax: z.number().optional().transform(val => val?.toString()),
  changePercent: z.number().optional().transform(val => val?.toString()),
  changePeriod: z.enum(['1d', '1w', '1m']).optional(),
  missingDataThreshold: z.number().int().min(1).optional(),
  evaluationWindow: z.string().default('5m'),
  suppressionWindow: z.string().default('1h'),
  notificationChannels: z.array(z.enum(['email', 'slack', 'webhook'])).default([]),
  recipients: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

export const metricAlertUpdateSchema = metricAlertCreateSchema.partial().omit({ metricSeriesId: true });

export const metricAlertFiltersSchema = z.object({
  metricSeriesId: z.string().uuid().optional(),
  alertType: z.enum(['threshold', 'anomaly', 'change', 'missing_data']).optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  isActive: z.coerce.boolean().optional(),
  currentState: z.enum(['ok', 'warning', 'critical', 'unknown']).optional(),
  search: z.string().optional(),
});

// Metrics search schema
export const metricsSearchSchema = z.object({
  q: z.string().min(1, "Search query is required"),
  category: z.enum(['internal', 'macro', 'rates', 'fuel']).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  includeInactive: z.boolean().default(false),
});

// Derived metrics query schemas
export const derivedMetricsQuerySchema = z.object({
  states: z.array(z.string().min(1).max(50)).optional(),
  regions: z.array(z.string()).optional(),
  coastalType: z.enum(['coastal', 'lake']).optional(),
  saleYearMin: z.coerce.number().int().optional(),
  saleYearMax: z.coerce.number().int().optional(),
  minWetSlips: z.coerce.number().int().min(0).optional(),
  maxWetSlips: z.coerce.number().int().min(0).optional(),
  minDryRacks: z.coerce.number().int().min(0).optional(),
  maxDryRacks: z.coerce.number().int().min(0).optional(),
  profitCenters: z.array(z.string()).optional(),
  disclosedOnly: z.boolean().default(true),
  groupBy: z.enum(['state', 'region', 'year', 'coastalType']).optional(),
});

// Metrics snapshot schema
export const metricsSnapshotQuerySchema = z.object({
  categories: z.array(z.enum(['internal', 'macro', 'rates', 'fuel'])).optional(),
  metricKeys: z.array(z.string()).optional(),
  includeDerived: z.boolean().default(true),
});

// Portfolio schemas
export const portfolioCreateSchema = z.object({
  name: z.string().min(1, "Portfolio name is required").max(255, "Portfolio name too long"),
  description: z.string().optional(),
  notes: z.string().optional(),
});

export const bulkPortfolioCreateSchema = z.object({
  portfolio: portfolioCreateSchema,
  comps: z.array(salesCompCreateSchema).min(1, "At least one comp is required").max(150, "Maximum 150 comps per portfolio"),
});
