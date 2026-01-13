import { pgTable, varchar, text, timestamp, numeric, boolean, jsonb, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql, relations } from "drizzle-orm";

export const yieldCurveSourceEnum = ['fred', 'manual', 'calculated'] as const;
export type YieldCurveSource = typeof yieldCurveSourceEnum[number];

export const rateTypeEnum = ['sofr', 'treasury', 'libor', 'prime', 'fed_funds'] as const;
export type RateType = typeof rateTypeEnum[number];

export const tenorEnum = ['overnight', '1m', '3m', '6m', '1y', '2y', '3y', '5y', '7y', '10y', '20y', '30y'] as const;
export type Tenor = typeof tenorEnum[number];

export const capitalMarketsRates = pgTable('capital_markets_rates', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  rateType: text('rate_type').notNull(),
  tenor: text('tenor').notNull(),
  observationDate: timestamp('observation_date', { withTimezone: true }).notNull(),
  rate: numeric('rate', { precision: 10, scale: 6 }).notNull(),
  source: text('source').notNull().default('fred'),
  seriesId: text('series_id'),
  isInterpolated: boolean('is_interpolated').notNull().default(false),
  meta: jsonb('meta').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  rateTypeTenorDateUnique: unique('capital_markets_rates_type_tenor_date').on(
    table.rateType,
    table.tenor,
    table.observationDate
  ),
  observationDateIdx: index('capital_markets_rates_date_idx').on(table.observationDate),
  rateTypeIdx: index('capital_markets_rates_type_idx').on(table.rateType),
}));

export const capitalMarketsForwardCurves = pgTable('capital_markets_forward_curves', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  curveDate: timestamp('curve_date', { withTimezone: true }).notNull(),
  rateType: text('rate_type').notNull(),
  forwardMonths: numeric('forward_months').notNull(),
  forwardRate: numeric('forward_rate', { precision: 10, scale: 6 }).notNull(),
  spotRate: numeric('spot_rate', { precision: 10, scale: 6 }),
  calculationMethod: text('calculation_method').notNull().default('linear'),
  confidence: numeric('confidence', { precision: 5, scale: 4 }),
  meta: jsonb('meta').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  curveDateTypeMonthUnique: unique('capital_markets_forward_curves_date_type_month').on(
    table.curveDate,
    table.rateType,
    table.forwardMonths
  ),
  curveDateIdx: index('capital_markets_forward_curves_date_idx').on(table.curveDate),
  rateTypeIdx: index('capital_markets_forward_curves_type_idx').on(table.rateType),
}));

export const capitalMarketsFredSeriesConfig = pgTable('capital_markets_fred_series', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  seriesId: text('series_id').notNull(),
  rateType: text('rate_type').notNull(),
  tenor: text('tenor').notNull(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  frequency: text('frequency').notNull().default('daily'),
  isActive: boolean('is_active').notNull().default(true),
  lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }),
  lastObservationDate: timestamp('last_observation_date', { withTimezone: true }),
  meta: jsonb('meta').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  seriesIdUnique: unique('capital_markets_fred_series_id_unique').on(table.seriesId),
  rateTypeTenorIdx: index('capital_markets_fred_series_type_tenor_idx').on(table.rateType, table.tenor),
}));

export const capitalMarketsRatesRelations = relations(capitalMarketsRates, ({ one }) => ({
  fredSeries: one(capitalMarketsFredSeriesConfig, {
    fields: [capitalMarketsRates.seriesId],
    references: [capitalMarketsFredSeriesConfig.seriesId],
  }),
}));

export const capitalMarketsFredSeriesRelations = relations(capitalMarketsFredSeriesConfig, ({ many }) => ({
  rates: many(capitalMarketsRates),
}));

export const insertCapitalMarketsRateSchema = createInsertSchema(capitalMarketsRates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CapitalMarketsRate = typeof capitalMarketsRates.$inferSelect;
export type InsertCapitalMarketsRate = z.infer<typeof insertCapitalMarketsRateSchema>;

export const insertCapitalMarketsForwardCurveSchema = createInsertSchema(capitalMarketsForwardCurves).omit({
  id: true,
  createdAt: true,
});
export type CapitalMarketsForwardCurve = typeof capitalMarketsForwardCurves.$inferSelect;
export type InsertCapitalMarketsForwardCurve = z.infer<typeof insertCapitalMarketsForwardCurveSchema>;

export const insertCapitalMarketsFredSeriesSchema = createInsertSchema(capitalMarketsFredSeriesConfig).omit({
  id: true,
  createdAt: true,
});
export type CapitalMarketsFredSeries = typeof capitalMarketsFredSeriesConfig.$inferSelect;
export type InsertCapitalMarketsFredSeries = z.infer<typeof insertCapitalMarketsFredSeriesSchema>;

export const FRED_SERIES_CONFIG: { seriesId: string; rateType: RateType; tenor: Tenor; displayName: string; description: string }[] = [
  { seriesId: 'SOFR', rateType: 'sofr', tenor: 'overnight', displayName: 'SOFR Overnight', description: 'Secured Overnight Financing Rate' },
  { seriesId: 'SOFR30DAYAVG', rateType: 'sofr', tenor: '1m', displayName: 'SOFR 30-Day Average', description: '30-day average SOFR' },
  { seriesId: 'SOFR90DAYAVG', rateType: 'sofr', tenor: '3m', displayName: 'SOFR 90-Day Average', description: '90-day average SOFR' },
  { seriesId: 'SOFR180DAYAVG', rateType: 'sofr', tenor: '6m', displayName: 'SOFR 180-Day Average', description: '180-day average SOFR' },
  { seriesId: 'DGS1MO', rateType: 'treasury', tenor: '1m', displayName: '1-Month Treasury', description: '1-month Treasury constant maturity' },
  { seriesId: 'DGS3MO', rateType: 'treasury', tenor: '3m', displayName: '3-Month Treasury', description: '3-month Treasury constant maturity' },
  { seriesId: 'DGS6MO', rateType: 'treasury', tenor: '6m', displayName: '6-Month Treasury', description: '6-month Treasury constant maturity' },
  { seriesId: 'DGS1', rateType: 'treasury', tenor: '1y', displayName: '1-Year Treasury', description: '1-year Treasury constant maturity' },
  { seriesId: 'DGS2', rateType: 'treasury', tenor: '2y', displayName: '2-Year Treasury', description: '2-year Treasury constant maturity' },
  { seriesId: 'DGS3', rateType: 'treasury', tenor: '3y', displayName: '3-Year Treasury', description: '3-year Treasury constant maturity' },
  { seriesId: 'DGS5', rateType: 'treasury', tenor: '5y', displayName: '5-Year Treasury', description: '5-year Treasury constant maturity' },
  { seriesId: 'DGS7', rateType: 'treasury', tenor: '7y', displayName: '7-Year Treasury', description: '7-year Treasury constant maturity' },
  { seriesId: 'DGS10', rateType: 'treasury', tenor: '10y', displayName: '10-Year Treasury', description: '10-year Treasury constant maturity' },
  { seriesId: 'DGS20', rateType: 'treasury', tenor: '20y', displayName: '20-Year Treasury', description: '20-year Treasury constant maturity' },
  { seriesId: 'DGS30', rateType: 'treasury', tenor: '30y', displayName: '30-Year Treasury', description: '30-year Treasury constant maturity' },
  { seriesId: 'FEDFUNDS', rateType: 'fed_funds', tenor: 'overnight', displayName: 'Fed Funds Rate', description: 'Federal Funds Effective Rate' },
  { seriesId: 'DPRIME', rateType: 'prime', tenor: 'overnight', displayName: 'Prime Rate', description: 'Bank Prime Loan Rate' },
];

export interface YieldCurvePoint {
  tenor: Tenor;
  tenorMonths: number;
  rate: number;
  isInterpolated: boolean;
}

export interface ForwardCurvePoint {
  forwardMonths: number;
  forwardRate: number;
  spotRate?: number;
}

export function tenorToMonths(tenor: Tenor): number {
  const map: Record<Tenor, number> = {
    'overnight': 0,
    '1m': 1,
    '3m': 3,
    '6m': 6,
    '1y': 12,
    '2y': 24,
    '3y': 36,
    '5y': 60,
    '7y': 84,
    '10y': 120,
    '20y': 240,
    '30y': 360,
  };
  return map[tenor];
}
