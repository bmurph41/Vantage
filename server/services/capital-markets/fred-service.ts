import { db } from '../../db';
import {
  capitalMarketsRates,
  capitalMarketsFredSeriesConfig,
  capitalMarketsForwardCurves,
  FRED_SERIES_CONFIG,
  tenorToMonths,
  type CapitalMarketsRate,
  type YieldCurvePoint,
  type ForwardCurvePoint,
  type Tenor,
  type RateType,
} from '@shared/schema';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';

const FRED_API_KEY = process.env.FRED_API_KEY;
const FRED_BASE_URL = 'https://api.stlouisfed.org/fred';

interface FredObservation {
  date: string;
  value: string;
}

interface FredSeriesResponse {
  observations: FredObservation[];
}

export async function seedFredSeriesConfig(): Promise<number> {
  let seeded = 0;
  
  for (const config of FRED_SERIES_CONFIG) {
    const existing = await db.query.capitalMarketsFredSeriesConfig.findFirst({
      where: eq(capitalMarketsFredSeriesConfig.seriesId, config.seriesId),
    });
    
    if (!existing) {
      await db.insert(capitalMarketsFredSeriesConfig).values({
        seriesId: config.seriesId,
        rateType: config.rateType,
        tenor: config.tenor,
        displayName: config.displayName,
        description: config.description,
        frequency: 'daily',
        isActive: true,
      });
      seeded++;
    }
  }
  
  console.log(`[Capital Markets] Seeded ${seeded} FRED series configurations`);
  return seeded;
}

export async function fetchFredSeries(
  seriesId: string,
  startDate?: Date,
  endDate?: Date
): Promise<FredObservation[]> {
  if (!FRED_API_KEY) {
    throw new Error('FRED_API_KEY environment variable is not set');
  }
  
  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: FRED_API_KEY,
    file_type: 'json',
  });
  
  if (startDate) {
    params.append('observation_start', startDate.toISOString().split('T')[0]);
  }
  if (endDate) {
    params.append('observation_end', endDate.toISOString().split('T')[0]);
  }
  
  const url = `${FRED_BASE_URL}/series/observations?${params.toString()}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FRED API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json() as FredSeriesResponse;
  return data.observations.filter(obs => obs.value !== '.');
}

export async function fetchAndStoreAllSeries(
  lookbackDays: number = 365
): Promise<{ fetched: number; stored: number; errors: string[] }> {
  const results = { fetched: 0, stored: 0, errors: [] as string[] };
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - lookbackDays);
  
  const series = await db.query.capitalMarketsFredSeriesConfig.findMany({
    where: eq(capitalMarketsFredSeriesConfig.isActive, true),
  });
  
  if (series.length === 0) {
    await seedFredSeriesConfig();
    return fetchAndStoreAllSeries(lookbackDays);
  }
  
  for (const config of series) {
    try {
      const observations = await fetchFredSeries(config.seriesId, startDate);
      results.fetched += observations.length;
      
      let latestDate: Date | null = null;
      
      for (const obs of observations) {
        const rate = parseFloat(obs.value);
        if (isNaN(rate)) continue;
        
        const obsDate = new Date(obs.date);
        if (!latestDate || obsDate > latestDate) {
          latestDate = obsDate;
        }
        
        try {
          await db.insert(capitalMarketsRates)
            .values({
              rateType: config.rateType,
              tenor: config.tenor,
              observationDate: obsDate,
              rate: rate.toFixed(6),
              source: 'fred',
              seriesId: config.seriesId,
              isInterpolated: false,
            })
            .onConflictDoUpdate({
              target: [capitalMarketsRates.rateType, capitalMarketsRates.tenor, capitalMarketsRates.observationDate],
              set: {
                rate: rate.toFixed(6),
                updatedAt: new Date(),
              },
            });
          results.stored++;
        } catch (err: any) {
          if (!err.message?.includes('duplicate key')) {
            results.errors.push(`${config.seriesId}: ${err.message}`);
          }
        }
      }
      
      if (latestDate) {
        await db.update(capitalMarketsFredSeriesConfig)
          .set({
            lastFetchedAt: new Date(),
            lastObservationDate: latestDate,
          })
          .where(eq(capitalMarketsFredSeriesConfig.id, config.id));
      }
      
      console.log(`[Capital Markets] Fetched ${observations.length} observations for ${config.displayName}`);
    } catch (error: any) {
      results.errors.push(`${config.seriesId}: ${error.message}`);
      console.error(`[Capital Markets] Error fetching ${config.seriesId}:`, error.message);
    }
  }
  
  return results;
}

export async function getLatestYieldCurve(
  rateType: RateType,
  asOfDate?: Date
): Promise<{ curveDate: Date; points: YieldCurvePoint[] }> {
  const targetDate = asOfDate ?? new Date();
  
  const rates = await db.select()
    .from(capitalMarketsRates)
    .where(and(
      eq(capitalMarketsRates.rateType, rateType),
      lte(capitalMarketsRates.observationDate, targetDate)
    ))
    .orderBy(desc(capitalMarketsRates.observationDate))
    .limit(20);
  
  if (rates.length === 0) {
    return { curveDate: targetDate, points: [] };
  }
  
  const latestDate = rates[0].observationDate;
  const curveRates = rates.filter(r => 
    r.observationDate.toDateString() === latestDate.toDateString()
  );
  
  const points: YieldCurvePoint[] = curveRates.map(r => ({
    tenor: r.tenor as Tenor,
    tenorMonths: tenorToMonths(r.tenor as Tenor),
    rate: parseFloat(r.rate),
    isInterpolated: r.isInterpolated,
  })).sort((a, b) => a.tenorMonths - b.tenorMonths);
  
  return { curveDate: latestDate, points };
}

export async function getYieldCurveHistory(
  rateType: RateType,
  tenor: Tenor,
  startDate: Date,
  endDate: Date
): Promise<{ date: Date; rate: number }[]> {
  const rates = await db.select()
    .from(capitalMarketsRates)
    .where(and(
      eq(capitalMarketsRates.rateType, rateType),
      eq(capitalMarketsRates.tenor, tenor),
      gte(capitalMarketsRates.observationDate, startDate),
      lte(capitalMarketsRates.observationDate, endDate)
    ))
    .orderBy(capitalMarketsRates.observationDate);
  
  return rates.map(r => ({
    date: r.observationDate,
    rate: parseFloat(r.rate),
  }));
}

export function interpolateRate(
  points: YieldCurvePoint[],
  targetMonths: number
): number | null {
  if (points.length === 0) return null;
  
  points.sort((a, b) => a.tenorMonths - b.tenorMonths);
  
  const exactMatch = points.find(p => p.tenorMonths === targetMonths);
  if (exactMatch) return exactMatch.rate;
  
  if (targetMonths < points[0].tenorMonths) {
    return points[0].rate;
  }
  if (targetMonths > points[points.length - 1].tenorMonths) {
    return points[points.length - 1].rate;
  }
  
  let lowerPoint = points[0];
  let upperPoint = points[points.length - 1];
  
  for (let i = 0; i < points.length - 1; i++) {
    if (points[i].tenorMonths <= targetMonths && points[i + 1].tenorMonths >= targetMonths) {
      lowerPoint = points[i];
      upperPoint = points[i + 1];
      break;
    }
  }
  
  const ratio = (targetMonths - lowerPoint.tenorMonths) / (upperPoint.tenorMonths - lowerPoint.tenorMonths);
  return lowerPoint.rate + ratio * (upperPoint.rate - lowerPoint.rate);
}

export async function calculateForwardCurve(
  rateType: RateType,
  maxMonths: number = 60,
  asOfDate?: Date
): Promise<ForwardCurvePoint[]> {
  const { curveDate, points } = await getLatestYieldCurve(rateType, asOfDate);
  
  if (points.length < 2) {
    return [];
  }
  
  const forwardPoints: ForwardCurvePoint[] = [];
  const spotRate = points[0]?.rate ?? 0;
  
  for (let months = 1; months <= maxMonths; months++) {
    const interpolatedRate = interpolateRate(points, months);
    
    if (interpolatedRate !== null) {
      forwardPoints.push({
        forwardMonths: months,
        forwardRate: interpolatedRate,
        spotRate,
      });
    }
  }
  
  return forwardPoints;
}

export async function storeForwardCurve(
  rateType: RateType,
  curveDate: Date,
  points: ForwardCurvePoint[]
): Promise<number> {
  let stored = 0;
  
  for (const point of points) {
    try {
      await db.insert(capitalMarketsForwardCurves)
        .values({
          curveDate,
          rateType,
          forwardMonths: point.forwardMonths.toString(),
          forwardRate: point.forwardRate.toFixed(6),
          spotRate: point.spotRate?.toFixed(6) ?? null,
          calculationMethod: 'linear',
        })
        .onConflictDoUpdate({
          target: [capitalMarketsForwardCurves.curveDate, capitalMarketsForwardCurves.rateType, capitalMarketsForwardCurves.forwardMonths],
          set: {
            forwardRate: point.forwardRate.toFixed(6),
            spotRate: point.spotRate?.toFixed(6) ?? null,
          },
        });
      stored++;
    } catch (err: any) {
      console.error(`[Capital Markets] Error storing forward curve point:`, err.message);
    }
  }
  
  return stored;
}

export async function getStoredForwardCurve(
  rateType: RateType,
  curveDate?: Date
): Promise<ForwardCurvePoint[]> {
  const targetDate = curveDate ?? new Date();
  
  const curves = await db.select()
    .from(capitalMarketsForwardCurves)
    .where(and(
      eq(capitalMarketsForwardCurves.rateType, rateType),
      lte(capitalMarketsForwardCurves.curveDate, targetDate)
    ))
    .orderBy(desc(capitalMarketsForwardCurves.curveDate), capitalMarketsForwardCurves.forwardMonths)
    .limit(120);
  
  if (curves.length === 0) {
    return [];
  }
  
  const latestDate = curves[0].curveDate;
  const latestCurve = curves.filter(c => 
    c.curveDate.toDateString() === latestDate.toDateString()
  );
  
  return latestCurve.map(c => ({
    forwardMonths: parseFloat(c.forwardMonths),
    forwardRate: parseFloat(c.forwardRate),
    spotRate: c.spotRate ? parseFloat(c.spotRate) : undefined,
  })).sort((a, b) => a.forwardMonths - b.forwardMonths);
}
