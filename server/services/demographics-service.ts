import { db } from "../db";
import { demographicsCache, regionalMarketStats, salesComps } from "@shared/schema";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import { US_STATES } from "@shared/salescomps-constants";

interface FredObservation {
  date: string;
  value: string;
}

interface FredSeriesResponse {
  observations?: FredObservation[];
  seriess?: Array<{
    id: string;
    title: string;
  }>;
}

interface EconomicIndicator {
  seriesId: string;
  name: string;
  category: 'population' | 'income' | 'employment' | 'housing';
  value: number | null;
  date: string | null;
  yoyChange: number | null;
  fiveYearCagr: number | null;
  dataPoints: Array<{ date: string; value: number }>;
}

interface RegionalMarketData {
  stateCode: string;
  stateName: string;
  region: string | null;
  totalMarinas: number;
  totalWetSlips: number;
  totalDryRacks: number;
  transactionCount: number;
  avgSalePrice: number | null;
  medianSalePrice: number | null;
  avgPricePerSlip: number | null;
  medianPricePerSlip: number | null;
  avgCapRate: number | null;
  medianCapRate: number | null;
  priceGrowth1Yr: number | null;
  priceGrowth3Yr: number | null;
  priceGrowth5Yr: number | null;
  yearlyStats: Array<{
    year: number;
    txCount: number;
    avgPrice: number | null;
    avgPricePerSlip: number | null;
  }>;
}

interface DemographicsOverview {
  economicIndicators: EconomicIndicator[];
  marketStats: RegionalMarketData;
  lastUpdated: string;
}

const FRED_SERIES_BY_STATE: Record<string, { population: string; income: string; employment: string }> = {
  'AL': { population: 'ALPOP', income: 'MEHOINUSALA', employment: 'ALUR' },
  'AK': { population: 'AKPOP', income: 'MEHOINUSAKA', employment: 'AKUR' },
  'AZ': { population: 'AZPOP', income: 'MEHOINUSAZA', employment: 'AZUR' },
  'AR': { population: 'ARPOP', income: 'MEHOINUSARA', employment: 'ARUR' },
  'CA': { population: 'CAPOP', income: 'MEHOINUSCAA', employment: 'CAUR' },
  'CO': { population: 'COPOP', income: 'MEHOINUSCOA', employment: 'COUR' },
  'CT': { population: 'CTPOP', income: 'MEHOINUSCTA', employment: 'CTUR' },
  'DE': { population: 'DEPOP', income: 'MEHOINUSDEA', employment: 'DEUR' },
  'FL': { population: 'FLPOP', income: 'MEHOINUSFLA', employment: 'FLUR' },
  'GA': { population: 'GAPOP', income: 'MEHOINUSGAA', employment: 'GAUR' },
  'HI': { population: 'HIPOP', income: 'MEHOINUSHIA', employment: 'HIUR' },
  'ID': { population: 'IDPOP', income: 'MEHOINUSIDA', employment: 'IDUR' },
  'IL': { population: 'ILPOP', income: 'MEHOINUSILA', employment: 'ILUR' },
  'IN': { population: 'INPOP', income: 'MEHOINUSINA', employment: 'INUR' },
  'IA': { population: 'IAPOP', income: 'MEHOINUSIAA', employment: 'IAUR' },
  'KS': { population: 'KSPOP', income: 'MEHOINUSKSA', employment: 'KSUR' },
  'KY': { population: 'KYPOP', income: 'MEHOINUSKYA', employment: 'KYUR' },
  'LA': { population: 'LAPOP', income: 'MEHOINUSLAA', employment: 'LAUR' },
  'ME': { population: 'MEPOP', income: 'MEHOINUSMEA', employment: 'MEUR' },
  'MD': { population: 'MDPOP', income: 'MEHOINUSMDA', employment: 'MDUR' },
  'MA': { population: 'MAPOP', income: 'MEHOINUSMAA', employment: 'MAUR' },
  'MI': { population: 'MIPOP', income: 'MEHOINUSMIA', employment: 'MIUR' },
  'MN': { population: 'MNPOP', income: 'MEHOINUSMNA', employment: 'MNUR' },
  'MS': { population: 'MSPOP', income: 'MEHOINUSMSA', employment: 'MSUR' },
  'MO': { population: 'MOPOP', income: 'MEHOINUSMOA', employment: 'MOUR' },
  'MT': { population: 'MTPOP', income: 'MEHOINUSMTA', employment: 'MTUR' },
  'NE': { population: 'NEPOP', income: 'MEHOINUSNEA', employment: 'NEUR' },
  'NV': { population: 'NVPOP', income: 'MEHOINUSNVA', employment: 'NVUR' },
  'NH': { population: 'NHPOP', income: 'MEHOINUSNHA', employment: 'NHUR' },
  'NJ': { population: 'NJPOP', income: 'MEHOINUSNJA', employment: 'NJUR' },
  'NM': { population: 'NMPOP', income: 'MEHOINUSNMA', employment: 'NMUR' },
  'NY': { population: 'NYPOP', income: 'MEHOINUSNYA', employment: 'NYUR' },
  'NC': { population: 'NCPOP', income: 'MEHOINUSNCA', employment: 'NCUR' },
  'ND': { population: 'NDPOP', income: 'MEHOINUSNDA', employment: 'NDUR' },
  'OH': { population: 'OHPOP', income: 'MEHOINUSOHА', employment: 'OHUR' },
  'OK': { population: 'OKPOP', income: 'MEHOINUSOKA', employment: 'OKUR' },
  'OR': { population: 'ORPOP', income: 'MEHOINUSORA', employment: 'ORUR' },
  'PA': { population: 'PAPOP', income: 'MEHOINUSPAA', employment: 'PAUR' },
  'RI': { population: 'RIPOP', income: 'MEHOINUSRIA', employment: 'RIUR' },
  'SC': { population: 'SCPOP', income: 'MEHOINUSSCA', employment: 'SCUR' },
  'SD': { population: 'SDPOP', income: 'MEHOINUSSDA', employment: 'SDUR' },
  'TN': { population: 'TNPOP', income: 'MEHOINUSTNA', employment: 'TNUR' },
  'TX': { population: 'TXPOP', income: 'MEHOINUSTXA', employment: 'TXUR' },
  'UT': { population: 'UTPOP', income: 'MEHOINUSUTA', employment: 'UTUR' },
  'VT': { population: 'VTPOP', income: 'MEHOINUSVTA', employment: 'VTUR' },
  'VA': { population: 'VAPOP', income: 'MEHOINUSVAA', employment: 'VAUR' },
  'WA': { population: 'WAPOP', income: 'MEHOINUSWAA', employment: 'WAUR' },
  'WV': { population: 'WVPOP', income: 'MEHOINUSWVA', employment: 'WVUR' },
  'WI': { population: 'WIPOP', income: 'MEHOINUSWIA', employment: 'WIUR' },
  'WY': { population: 'WYPOP', income: 'MEHOINUSWYA', employment: 'WYUR' },
  'DC': { population: 'DCPOP', income: 'MEHOINUSDCA', employment: 'DCUR' },
};

const STATE_TO_REGION: Record<string, string> = {
  'FL': 'Southeast', 'GA': 'Southeast', 'SC': 'Southeast', 'NC': 'Southeast', 'AL': 'Southeast', 'MS': 'Southeast', 'LA': 'Southeast', 'TN': 'Southeast', 'AR': 'Southeast', 'KY': 'Southeast',
  'TX': 'Southwest', 'AZ': 'Southwest', 'NM': 'Southwest', 'OK': 'Southwest',
  'CA': 'West', 'WA': 'West', 'OR': 'West', 'NV': 'West', 'HI': 'West', 'AK': 'West', 'UT': 'West', 'CO': 'West', 'ID': 'West', 'MT': 'West', 'WY': 'West',
  'NY': 'Northeast', 'NJ': 'Northeast', 'CT': 'Northeast', 'MA': 'Northeast', 'RI': 'Northeast', 'NH': 'Northeast', 'VT': 'Northeast', 'ME': 'Northeast', 'PA': 'Northeast',
  'MD': 'Mid-Atlantic', 'VA': 'Mid-Atlantic', 'DE': 'Mid-Atlantic', 'DC': 'Mid-Atlantic', 'WV': 'Mid-Atlantic',
  'MI': 'Great Lakes', 'OH': 'Great Lakes', 'IL': 'Great Lakes', 'WI': 'Great Lakes', 'MN': 'Great Lakes', 'IN': 'Great Lakes', 'IA': 'Great Lakes',
  'NE': 'Plains', 'KS': 'Plains', 'ND': 'Plains', 'SD': 'Plains', 'MO': 'Plains',
};

export class DemographicsService {
  private fredApiKey: string;

  constructor() {
    this.fredApiKey = process.env.FRED_API_KEY || '';
  }

  private async fetchFredSeries(seriesId: string): Promise<FredSeriesResponse | null> {
    if (!this.fredApiKey) {
      console.warn('FRED API key not configured');
      return null;
    }

    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${this.fredApiKey}&file_type=json&sort_order=desc&limit=20`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`FRED API error for ${seriesId}: ${response.status}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch FRED series ${seriesId}:`, error);
      return null;
    }
  }

  private calculateYoYChange(dataPoints: Array<{ date: string; value: number }>): number | null {
    if (dataPoints.length < 2) return null;
    
    const currentYear = new Date().getFullYear();
    const current = dataPoints.find(d => new Date(d.date).getFullYear() === currentYear || new Date(d.date).getFullYear() === currentYear - 1);
    const previous = dataPoints.find(d => new Date(d.date).getFullYear() === (current ? new Date(current.date).getFullYear() - 1 : currentYear - 2));
    
    if (!current || !previous || previous.value === 0) return null;
    return ((current.value - previous.value) / previous.value) * 100;
  }

  private calculateCagr(dataPoints: Array<{ date: string; value: number }>, years: number): number | null {
    if (dataPoints.length < 2) return null;
    
    const sorted = [...dataPoints].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const endValue = sorted[0]?.value;
    const startIndex = sorted.findIndex(d => {
      const yearDiff = new Date(sorted[0].date).getFullYear() - new Date(d.date).getFullYear();
      return yearDiff >= years;
    });
    
    if (startIndex === -1 || !endValue) return null;
    const startValue = sorted[startIndex].value;
    
    if (startValue <= 0 || endValue <= 0) return null;
    return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
  }

  async getEconomicIndicators(orgId: string, stateCode: string): Promise<EconomicIndicator[]> {
    const seriesConfig = FRED_SERIES_BY_STATE[stateCode];
    if (!seriesConfig) {
      return this.getFallbackIndicators(stateCode);
    }

    const indicators: EconomicIndicator[] = [];

    const cacheExpiry = new Date();
    cacheExpiry.setDate(cacheExpiry.getDate() - 7);

    for (const [category, seriesId] of Object.entries(seriesConfig)) {
      const cached = await db
        .select()
        .from(demographicsCache)
        .where(
          and(
            eq(demographicsCache.orgId, orgId),
            eq(demographicsCache.stateCode, stateCode),
            eq(demographicsCache.seriesId, seriesId),
            gte(demographicsCache.fetchedAt, cacheExpiry)
          )
        )
        .limit(1);

      if (cached.length > 0) {
        const entry = cached[0];
        indicators.push({
          seriesId,
          name: entry.seriesName,
          category: entry.category as 'population' | 'income' | 'employment' | 'housing',
          value: entry.latestValue ? parseFloat(entry.latestValue) : null,
          date: entry.latestDate?.toString() || null,
          yoyChange: entry.yoyChange ? parseFloat(entry.yoyChange) : null,
          fiveYearCagr: entry.fiveYearCagr ? parseFloat(entry.fiveYearCagr) : null,
          dataPoints: entry.dataPoints as Array<{ date: string; value: number }>,
        });
        continue;
      }

      const fredData = await this.fetchFredSeries(seriesId);
      if (fredData?.observations) {
        const dataPoints = fredData.observations
          .filter(obs => obs.value !== '.')
          .map(obs => ({
            date: obs.date,
            value: parseFloat(obs.value),
          }))
          .slice(0, 10);

        const latestValue = dataPoints[0]?.value || null;
        const latestDate = dataPoints[0]?.date || null;
        const yoyChange = this.calculateYoYChange(dataPoints);
        const fiveYearCagr = this.calculateCagr(dataPoints, 5);

        const seriesName = this.getSeriesName(category, stateCode);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        try {
          await db.insert(demographicsCache).values({
            orgId,
            stateCode,
            seriesId,
            seriesName,
            category: category as 'population' | 'income' | 'employment' | 'housing',
            dataPoints,
            latestValue: latestValue?.toString() || null,
            latestDate,
            yoyChange: yoyChange?.toString() || null,
            fiveYearCagr: fiveYearCagr?.toString() || null,
            fetchedAt: new Date(),
            expiresAt,
          }).onConflictDoUpdate({
            target: [demographicsCache.orgId, demographicsCache.stateCode, demographicsCache.seriesId],
            set: {
              dataPoints,
              latestValue: latestValue?.toString() || null,
              latestDate,
              yoyChange: yoyChange?.toString() || null,
              fiveYearCagr: fiveYearCagr?.toString() || null,
              fetchedAt: new Date(),
              expiresAt,
              updatedAt: new Date(),
            },
          });
        } catch (error) {
          console.error('Failed to cache demographics data:', error);
        }

        indicators.push({
          seriesId,
          name: seriesName,
          category: category as 'population' | 'income' | 'employment' | 'housing',
          value: latestValue,
          date: latestDate,
          yoyChange,
          fiveYearCagr,
          dataPoints,
        });
      }
    }

    return indicators.length > 0 ? indicators : this.getFallbackIndicators(stateCode);
  }

  private getSeriesName(category: string, stateCode: string): string {
    const stateName = US_STATES.find(s => s.code === stateCode)?.name || stateCode;
    switch (category) {
      case 'population':
        return `${stateName} Population`;
      case 'income':
        return `${stateName} Median Household Income`;
      case 'employment':
        return `${stateName} Unemployment Rate`;
      case 'housing':
        return `${stateName} Housing Market Index`;
      default:
        return `${stateName} ${category}`;
    }
  }

  private getFallbackIndicators(stateCode: string): EconomicIndicator[] {
    const stateName = US_STATES.find(s => s.code === stateCode)?.name || stateCode;
    return [
      {
        seriesId: `${stateCode}POP`,
        name: `${stateName} Population`,
        category: 'population',
        value: null,
        date: null,
        yoyChange: null,
        fiveYearCagr: null,
        dataPoints: [],
      },
      {
        seriesId: `MEHOINUS${stateCode}A`,
        name: `${stateName} Median Household Income`,
        category: 'income',
        value: null,
        date: null,
        yoyChange: null,
        fiveYearCagr: null,
        dataPoints: [],
      },
      {
        seriesId: `${stateCode}UR`,
        name: `${stateName} Unemployment Rate`,
        category: 'employment',
        value: null,
        date: null,
        yoyChange: null,
        fiveYearCagr: null,
        dataPoints: [],
      },
    ];
  }

  async getRegionalMarketStats(orgId: string, stateCode: string): Promise<RegionalMarketData> {
    const stateName = US_STATES.find(s => s.code === stateCode)?.name || stateCode;
    const region = STATE_TO_REGION[stateCode] || null;

    const cachedStats = await db
      .select()
      .from(regionalMarketStats)
      .where(
        and(
          eq(regionalMarketStats.orgId, orgId),
          eq(regionalMarketStats.stateCode, stateCode)
        )
      )
      .limit(1);

    if (cachedStats.length > 0) {
      const cached = cachedStats[0];
      const cacheAge = Date.now() - new Date(cached.computedAt).getTime();
      const oneHour = 60 * 60 * 1000;

      if (cacheAge < oneHour) {
        return {
          stateCode,
          stateName,
          region: cached.region,
          totalMarinas: cached.totalMarinas,
          totalWetSlips: cached.totalWetSlips,
          totalDryRacks: cached.totalDryRacks,
          transactionCount: cached.transactionCount,
          avgSalePrice: cached.avgSalePrice ? parseFloat(cached.avgSalePrice) : null,
          medianSalePrice: cached.medianSalePrice ? parseFloat(cached.medianSalePrice) : null,
          avgPricePerSlip: cached.avgPricePerSlip ? parseFloat(cached.avgPricePerSlip) : null,
          medianPricePerSlip: cached.medianPricePerSlip ? parseFloat(cached.medianPricePerSlip) : null,
          avgCapRate: cached.avgCapRate ? parseFloat(cached.avgCapRate) : null,
          medianCapRate: cached.medianCapRate ? parseFloat(cached.medianCapRate) : null,
          priceGrowth1Yr: cached.priceGrowth1Yr ? parseFloat(cached.priceGrowth1Yr) : null,
          priceGrowth3Yr: cached.priceGrowth3Yr ? parseFloat(cached.priceGrowth3Yr) : null,
          priceGrowth5Yr: cached.priceGrowth5Yr ? parseFloat(cached.priceGrowth5Yr) : null,
          yearlyStats: cached.yearlyStats as Array<{ year: number; txCount: number; avgPrice: number | null; avgPricePerSlip: number | null }>,
        };
      }
    }

    const stats = await this.computeMarketStats(orgId, stateCode);

    try {
      await db.insert(regionalMarketStats).values({
        orgId,
        stateCode,
        region,
        totalMarinas: stats.totalMarinas,
        totalWetSlips: stats.totalWetSlips,
        totalDryRacks: stats.totalDryRacks,
        transactionCount: stats.transactionCount,
        avgSalePrice: stats.avgSalePrice?.toString() || null,
        medianSalePrice: stats.medianSalePrice?.toString() || null,
        avgPricePerSlip: stats.avgPricePerSlip?.toString() || null,
        medianPricePerSlip: stats.medianPricePerSlip?.toString() || null,
        avgCapRate: stats.avgCapRate?.toString() || null,
        medianCapRate: stats.medianCapRate?.toString() || null,
        priceGrowth1Yr: stats.priceGrowth1Yr?.toString() || null,
        priceGrowth3Yr: stats.priceGrowth3Yr?.toString() || null,
        priceGrowth5Yr: stats.priceGrowth5Yr?.toString() || null,
        yearlyStats: stats.yearlyStats,
        computedAt: new Date(),
      }).onConflictDoUpdate({
        target: [regionalMarketStats.orgId, regionalMarketStats.stateCode, regionalMarketStats.region],
        set: {
          totalMarinas: stats.totalMarinas,
          totalWetSlips: stats.totalWetSlips,
          totalDryRacks: stats.totalDryRacks,
          transactionCount: stats.transactionCount,
          avgSalePrice: stats.avgSalePrice?.toString() || null,
          medianSalePrice: stats.medianSalePrice?.toString() || null,
          avgPricePerSlip: stats.avgPricePerSlip?.toString() || null,
          medianPricePerSlip: stats.medianPricePerSlip?.toString() || null,
          avgCapRate: stats.avgCapRate?.toString() || null,
          medianCapRate: stats.medianCapRate?.toString() || null,
          priceGrowth1Yr: stats.priceGrowth1Yr?.toString() || null,
          priceGrowth3Yr: stats.priceGrowth3Yr?.toString() || null,
          priceGrowth5Yr: stats.priceGrowth5Yr?.toString() || null,
          yearlyStats: stats.yearlyStats,
          computedAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to cache regional market stats:', error);
    }

    return {
      stateCode,
      stateName,
      region,
      ...stats,
    };
  }

  private async computeMarketStats(orgId: string, stateCode: string): Promise<Omit<RegionalMarketData, 'stateCode' | 'stateName' | 'region'>> {
    const stateComps = await db
      .select({
        id: salesComps.id,
        salePrice: salesComps.salePrice,
        wetSlips: salesComps.wetSlips,
        dryRacks: salesComps.dryRacks,
        pricePerSlip: salesComps.pricePerSlip,
        capRate: salesComps.capRate,
        saleYear: salesComps.saleYear,
        saleMonth: salesComps.saleMonth,
      })
      .from(salesComps)
      .where(
        and(
          eq(salesComps.orgId, orgId),
          eq(salesComps.state, stateCode)
        )
      );

    if (stateComps.length === 0) {
      return {
        totalMarinas: 0,
        totalWetSlips: 0,
        totalDryRacks: 0,
        transactionCount: 0,
        avgSalePrice: null,
        medianSalePrice: null,
        avgPricePerSlip: null,
        medianPricePerSlip: null,
        avgCapRate: null,
        medianCapRate: null,
        priceGrowth1Yr: null,
        priceGrowth3Yr: null,
        priceGrowth5Yr: null,
        yearlyStats: [],
      };
    }

    const prices = stateComps.map(c => c.salePrice ? parseFloat(c.salePrice) : null).filter((p): p is number => p !== null && p > 0);
    const pricesPerSlip = stateComps.map(c => c.pricePerSlip ? parseFloat(c.pricePerSlip) : null).filter((p): p is number => p !== null && p > 0);
    const capRates = stateComps.map(c => c.capRate ? parseFloat(c.capRate) : null).filter((r): r is number => r !== null && r > 0);

    const median = (arr: number[]): number | null => {
      if (arr.length === 0) return null;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    const avg = (arr: number[]): number | null => {
      if (arr.length === 0) return null;
      return arr.reduce((sum, v) => sum + v, 0) / arr.length;
    };

    const yearlyData = new Map<number, { count: number; prices: number[]; pricesPerSlip: number[] }>();
    stateComps.forEach(comp => {
      const year = comp.saleYear;
      if (!year) return;
      
      if (!yearlyData.has(year)) {
        yearlyData.set(year, { count: 0, prices: [], pricesPerSlip: [] });
      }
      
      const entry = yearlyData.get(year)!;
      entry.count++;
      
      if (comp.salePrice) {
        const price = parseFloat(comp.salePrice);
        if (price > 0) entry.prices.push(price);
      }
      
      if (comp.pricePerSlip) {
        const pps = parseFloat(comp.pricePerSlip);
        if (pps > 0) entry.pricesPerSlip.push(pps);
      }
    });

    const yearlyStats = Array.from(yearlyData.entries())
      .map(([year, data]) => ({
        year,
        txCount: data.count,
        avgPrice: avg(data.prices),
        avgPricePerSlip: avg(data.pricesPerSlip),
      }))
      .sort((a, b) => b.year - a.year);

    const currentYear = new Date().getFullYear();
    const priceGrowth1Yr = this.computePriceGrowth(yearlyStats, 1, currentYear);
    const priceGrowth3Yr = this.computePriceGrowth(yearlyStats, 3, currentYear);
    const priceGrowth5Yr = this.computePriceGrowth(yearlyStats, 5, currentYear);

    return {
      totalMarinas: stateComps.length,
      totalWetSlips: stateComps.reduce((sum, c) => sum + (c.wetSlips || 0), 0),
      totalDryRacks: stateComps.reduce((sum, c) => sum + (c.dryRacks || 0), 0),
      transactionCount: stateComps.length,
      avgSalePrice: avg(prices),
      medianSalePrice: median(prices),
      avgPricePerSlip: avg(pricesPerSlip),
      medianPricePerSlip: median(pricesPerSlip),
      avgCapRate: avg(capRates),
      medianCapRate: median(capRates),
      priceGrowth1Yr,
      priceGrowth3Yr,
      priceGrowth5Yr,
      yearlyStats,
    };
  }

  private computePriceGrowth(yearlyStats: Array<{ year: number; avgPricePerSlip: number | null }>, years: number, currentYear: number): number | null {
    const recentYear = yearlyStats.find(s => s.year >= currentYear - 1 && s.avgPricePerSlip !== null);
    const pastYear = yearlyStats.find(s => s.year <= currentYear - years && s.avgPricePerSlip !== null);

    if (!recentYear?.avgPricePerSlip || !pastYear?.avgPricePerSlip || pastYear.avgPricePerSlip === 0) {
      return null;
    }

    return ((recentYear.avgPricePerSlip - pastYear.avgPricePerSlip) / pastYear.avgPricePerSlip) * 100;
  }

  async getDemographicsOverview(orgId: string, stateCode: string): Promise<DemographicsOverview> {
    const [economicIndicators, marketStats] = await Promise.all([
      this.getEconomicIndicators(orgId, stateCode),
      this.getRegionalMarketStats(orgId, stateCode),
    ]);

    return {
      economicIndicators,
      marketStats,
      lastUpdated: new Date().toISOString(),
    };
  }

  async getAvailableStates(orgId: string): Promise<Array<{ code: string; name: string; hasData: boolean; transactionCount: number }>> {
    const stateData = await db
      .select({
        state: salesComps.state,
        count: sql<number>`count(*)::int`,
      })
      .from(salesComps)
      .where(eq(salesComps.orgId, orgId))
      .groupBy(salesComps.state);

    const stateMap = new Map(stateData.map(s => [s.state, s.count]));

    return US_STATES.map(state => ({
      code: state.code,
      name: state.name,
      hasData: stateMap.has(state.code),
      transactionCount: stateMap.get(state.code) || 0,
    })).sort((a, b) => b.transactionCount - a.transactionCount);
  }

  async getNationalOverview(orgId: string): Promise<{
    totalTransactions: number;
    totalMarinas: number;
    avgPricePerSlip: number | null;
    topStates: Array<{ stateCode: string; stateName: string; transactionCount: number }>;
  }> {
    const allComps = await db
      .select({
        id: salesComps.id,
        state: salesComps.state,
        salePrice: salesComps.salePrice,
        wetSlips: salesComps.wetSlips,
        dryRacks: salesComps.dryRacks,
      })
      .from(salesComps)
      .where(eq(salesComps.orgId, orgId));

    const stateCount = new Map<string, number>();
    const pricesPerSlip: number[] = [];

    allComps.forEach(comp => {
      if (comp.state) {
        stateCount.set(comp.state, (stateCount.get(comp.state) || 0) + 1);
      }
      // Calculate price per slip from sale price and total slips
      const totalSlips = (comp.wetSlips || 0) + (comp.dryRacks || 0);
      if (comp.salePrice && totalSlips > 0) {
        const pps = comp.salePrice / totalSlips;
        if (pps > 0) pricesPerSlip.push(pps);
      }
    });

    const topStates = Array.from(stateCount.entries())
      .map(([code, count]) => ({
        stateCode: code,
        stateName: US_STATES.find(s => s.code === code)?.name || code,
        transactionCount: count,
      }))
      .sort((a, b) => b.transactionCount - a.transactionCount)
      .slice(0, 10);

    return {
      totalTransactions: allComps.length,
      totalMarinas: allComps.length,
      avgPricePerSlip: pricesPerSlip.length > 0 ? pricesPerSlip.reduce((a, b) => a + b, 0) / pricesPerSlip.length : null,
      topStates,
    };
  }
}

export const demographicsService = new DemographicsService();
