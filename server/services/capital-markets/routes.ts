import { Router } from 'express';
import { z } from 'zod';
import {
  seedFredSeriesConfig,
  fetchAndStoreAllSeries,
  getLatestYieldCurve,
  getYieldCurveHistory,
  calculateForwardCurve,
  storeForwardCurve,
  getStoredForwardCurve,
} from './fred-service';
import { db } from '../../db';
import { capitalMarketsFredSeriesConfig, capitalMarketsRates } from '@shared/schema';
import { eq, desc, sql } from 'drizzle-orm';

const router = Router();

router.get('/rates/latest', async (req: any, res) => {
  try {
    const schema = z.object({
      rateType: z.enum(['sofr', 'treasury', 'libor', 'prime', 'fed_funds']).default('treasury'),
      asOfDate: z.string().optional(),
    });
    
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    
    const { rateType, asOfDate } = parsed.data;
    const targetDate = asOfDate ? new Date(asOfDate) : undefined;
    
    const result = await getLatestYieldCurve(rateType, targetDate);
    res.json(result);
  } catch (error: any) {
    console.error('Get latest rates error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/rates/history', async (req: any, res) => {
  try {
    const schema = z.object({
      rateType: z.enum(['sofr', 'treasury', 'libor', 'prime', 'fed_funds']),
      tenor: z.enum(['overnight', '1m', '3m', '6m', '1y', '2y', '3y', '5y', '7y', '10y', '20y', '30y']),
      startDate: z.string(),
      endDate: z.string().optional(),
    });
    
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    
    const { rateType, tenor, startDate, endDate } = parsed.data;
    
    const history = await getYieldCurveHistory(
      rateType,
      tenor,
      new Date(startDate),
      endDate ? new Date(endDate) : new Date()
    );
    
    res.json({ rateType, tenor, history });
  } catch (error: any) {
    console.error('Get rate history error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/forward-curve', async (req: any, res) => {
  try {
    const schema = z.object({
      rateType: z.enum(['sofr', 'treasury', 'libor', 'prime', 'fed_funds']).default('sofr'),
      maxMonths: z.coerce.number().int().min(1).max(360).default(60),
      asOfDate: z.string().optional(),
      recalculate: z.enum(['true', 'false']).default('false'),
    });
    
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    
    const { rateType, maxMonths, asOfDate, recalculate } = parsed.data;
    const targetDate = asOfDate ? new Date(asOfDate) : undefined;
    
    let points = await getStoredForwardCurve(rateType, targetDate);
    
    if (points.length === 0 || recalculate === 'true') {
      points = await calculateForwardCurve(rateType, maxMonths, targetDate);
      
      if (points.length > 0) {
        const curveDate = targetDate ?? new Date();
        await storeForwardCurve(rateType, curveDate, points);
      }
    }
    
    res.json({
      rateType,
      curveDate: targetDate ?? new Date(),
      points: points.slice(0, maxMonths),
    });
  } catch (error: any) {
    console.error('Get forward curve error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/rates/refresh', async (req: any, res) => {
  try {
    const schema = z.object({
      lookbackDays: z.coerce.number().int().min(1).max(3650).default(365),
    });
    
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    
    const results = await fetchAndStoreAllSeries(parsed.data.lookbackDays);
    
    res.json({
      success: true,
      message: `Fetched ${results.fetched} observations, stored ${results.stored}`,
      ...results,
    });
  } catch (error: any) {
    console.error('Refresh rates error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/series', async (req: any, res) => {
  try {
    const series = await db.query.capitalMarketsFredSeriesConfig.findMany({
      orderBy: [capitalMarketsFredSeriesConfig.rateType, capitalMarketsFredSeriesConfig.tenor],
    });
    
    res.json({ series });
  } catch (error: any) {
    console.error('Get series error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/series/seed', async (req: any, res) => {
  try {
    const seeded = await seedFredSeriesConfig();
    res.json({ success: true, seeded });
  } catch (error: any) {
    console.error('Seed series error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', async (req: any, res) => {
  try {
    const series = await db.query.capitalMarketsFredSeriesConfig.findMany();
    
    const ratesCount = await db.select({ count: sql<number>`count(*)` })
      .from(capitalMarketsRates);
    
    const latestRate = await db.select()
      .from(capitalMarketsRates)
      .orderBy(desc(capitalMarketsRates.observationDate))
      .limit(1);
    
    res.json({
      seriesCount: series.length,
      totalRates: Number(ratesCount[0]?.count ?? 0),
      latestObservation: latestRate[0]?.observationDate ?? null,
      seriesByType: series.reduce((acc, s) => {
        acc[s.rateType] = (acc[s.rateType] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    });
  } catch (error: any) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/sofr-forward-rates/:holdYears', async (req: any, res) => {
  try {
    const holdYears = parseInt(req.params.holdYears);
    if (isNaN(holdYears) || holdYears < 1 || holdYears > 30) {
      return res.status(400).json({ error: 'holdYears must be between 1 and 30' });
    }

    const schema = z.object({
      spreadBps: z.coerce.number().int().min(0).max(5000).default(0),
      rateCap: z.coerce.number().min(0).max(1).optional(),
      rateFloor: z.coerce.number().min(0).max(1).optional(),
    });

    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { spreadBps, rateCap, rateFloor } = parsed.data;
    const spreadDecimal = spreadBps / 10000;
    const maxMonths = holdYears * 12;

    let points = await getStoredForwardCurve('sofr');
    if (points.length === 0) {
      points = await calculateForwardCurve('sofr', maxMonths);
    }

    const startYear = new Date().getFullYear();
    const yearlyRates: {
      year: number;
      yearIndex: number;
      baseSofrRate: number;
      spreadBps: number;
      allInRate: number;
      allInRateCapped: number;
    }[] = [];

    for (let yr = 0; yr < holdYears; yr++) {
      const midpointMonth = yr * 12 + 6;
      let baseSofrRate = 0;

      if (points.length > 0) {
        const closest = points.reduce((prev, curr) =>
          Math.abs(curr.forwardMonths - midpointMonth) < Math.abs(prev.forwardMonths - midpointMonth) ? curr : prev
        );
        baseSofrRate = closest.forwardRate / 100;
      }

      let allInRate = baseSofrRate + spreadDecimal;
      let allInRateCapped = allInRate;

      if (rateCap !== undefined && rateCap > 0) {
        allInRateCapped = Math.min(allInRateCapped, rateCap);
      }
      if (rateFloor !== undefined && rateFloor > 0) {
        allInRateCapped = Math.max(allInRateCapped, rateFloor);
      }

      yearlyRates.push({
        year: startYear + yr,
        yearIndex: yr + 1,
        baseSofrRate: Math.round(baseSofrRate * 10000) / 10000,
        spreadBps,
        allInRate: Math.round(allInRate * 10000) / 10000,
        allInRateCapped: Math.round(allInRateCapped * 10000) / 10000,
      });
    }

    res.json({
      holdYears,
      startYear,
      spreadBps,
      rateCap: rateCap ?? null,
      rateFloor: rateFloor ?? null,
      forwardCurveAvailable: points.length > 0,
      yearlyRates,
    });
  } catch (error: any) {
    console.error('Get SOFR forward rates error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/yield-spreads', async (req: any, res) => {
  try {
    const schema = z.object({
      baseTenor: z.enum(['3m', '6m', '1y', '2y']).default('2y'),
      targetTenor: z.enum(['5y', '7y', '10y', '30y']).default('10y'),
    });
    
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    
    const { baseTenor, targetTenor } = parsed.data;
    
    const [baseResult, targetResult] = await Promise.all([
      getLatestYieldCurve('treasury'),
      getLatestYieldCurve('treasury'),
    ]);
    
    const basePoint = baseResult.points.find(p => p.tenor === baseTenor);
    const targetPoint = targetResult.points.find(p => p.tenor === targetTenor);
    
    if (!basePoint || !targetPoint) {
      return res.status(404).json({ error: 'Tenor data not found' });
    }
    
    const spread = targetPoint.rate - basePoint.rate;
    const spreadBps = Math.round(spread * 100);
    
    res.json({
      baseTenor,
      targetTenor,
      baseRate: basePoint.rate,
      targetRate: targetPoint.rate,
      spread,
      spreadBps,
      curveDate: baseResult.curveDate,
      isInverted: spread < 0,
    });
  } catch (error: any) {
    console.error('Get yield spreads error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
