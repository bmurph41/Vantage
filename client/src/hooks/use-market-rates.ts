import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export type RateType = "sofr" | "treasury" | "prime" | "fed_funds";
export type Tenor = "overnight" | "1m" | "3m" | "6m" | "1y" | "2y" | "3y" | "5y" | "7y" | "10y" | "20y" | "30y";

export interface YieldCurvePoint {
  tenor: Tenor;
  tenorMonths: number;
  rate: number;
  isInterpolated: boolean;
}

export interface YieldCurveResponse {
  rateType: RateType;
  curveDate: string;
  points: YieldCurvePoint[];
}

export interface ForwardCurvePoint {
  forwardMonths: number;
  forwardRate: number;
  spotRate?: number;
}

export interface ForwardCurveResponse {
  rateType: RateType;
  curveDate: string;
  points: ForwardCurvePoint[];
}

export interface MarketRatesStats {
  seriesCount: number;
  totalRates: number;
  latestObservation: string | null;
  seriesByType: Record<string, number>;
}

export const RATE_TYPE_LABELS: Record<RateType, string> = {
  sofr: "SOFR",
  treasury: "Treasury",
  prime: "Prime",
  fed_funds: "Fed Funds",
};

export const TENOR_LABELS: Record<Tenor, string> = {
  overnight: "O/N",
  "1m": "1M",
  "3m": "3M",
  "6m": "6M",
  "1y": "1Y",
  "2y": "2Y",
  "3y": "3Y",
  "5y": "5Y",
  "7y": "7Y",
  "10y": "10Y",
  "20y": "20Y",
  "30y": "30Y",
};

export const COMMON_FINANCING_RATES = [
  { id: "SOFR", rateType: "sofr" as RateType, tenor: "overnight" as Tenor, label: "SOFR Overnight" },
  { id: "SOFR_30D", rateType: "sofr" as RateType, tenor: "1m" as Tenor, label: "30-Day SOFR" },
  { id: "SOFR_90D", rateType: "sofr" as RateType, tenor: "3m" as Tenor, label: "90-Day SOFR" },
  { id: "PRIME", rateType: "prime" as RateType, tenor: "overnight" as Tenor, label: "Prime Rate" },
  { id: "FED_FUNDS", rateType: "fed_funds" as RateType, tenor: "overnight" as Tenor, label: "Fed Funds Rate" },
  { id: "UST_2Y", rateType: "treasury" as RateType, tenor: "2y" as Tenor, label: "2-Year Treasury" },
  { id: "UST_5Y", rateType: "treasury" as RateType, tenor: "5y" as Tenor, label: "5-Year Treasury" },
  { id: "UST_10Y", rateType: "treasury" as RateType, tenor: "10y" as Tenor, label: "10-Year Treasury" },
  { id: "UST_30Y", rateType: "treasury" as RateType, tenor: "30y" as Tenor, label: "30-Year Treasury" },
];

export function useMarketRates(rateType: RateType = "treasury") {
  const { data: yieldCurve, isLoading: curveLoading, error: curveError } = useQuery<YieldCurveResponse>({
    queryKey: ["/api/capital-markets/rates/latest", rateType],
    queryFn: () => apiRequest(`/api/capital-markets/rates/latest?rateType=${rateType}`),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<MarketRatesStats>({
    queryKey: ["/api/capital-markets/stats"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const getRateByTenor = (tenor: Tenor): number | null => {
    if (!yieldCurve?.points) return null;
    const point = yieldCurve.points.find(p => p.tenor === tenor);
    return point?.rate ?? null;
  };

  const curveDate = yieldCurve?.curveDate ? new Date(yieldCurve.curveDate) : null;
  const latestDataDate = stats?.latestObservation ? new Date(stats.latestObservation) : null;

  return {
    yieldCurve,
    curveDate,
    latestDataDate,
    isLoading: curveLoading || statsLoading,
    error: curveError,
    getRateByTenor,
    points: yieldCurve?.points ?? [],
  };
}

export function useAllMarketRates() {
  const treasury = useMarketRates("treasury");
  const sofr = useMarketRates("sofr");
  const prime = useMarketRates("prime");
  const fedFunds = useMarketRates("fed_funds");

  const { data: stats, isLoading: statsLoading } = useQuery<MarketRatesStats>({
    queryKey: ["/api/capital-markets/stats"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const getRate = (rateType: RateType, tenor: Tenor): number | null => {
    switch (rateType) {
      case "treasury":
        return treasury.getRateByTenor(tenor);
      case "sofr":
        return sofr.getRateByTenor(tenor);
      case "prime":
        return prime.getRateByTenor(tenor);
      case "fed_funds":
        return fedFunds.getRateByTenor(tenor);
      default:
        return null;
    }
  };

  const getCommonRate = (rateId: string): number | null => {
    const config = COMMON_FINANCING_RATES.find(r => r.id === rateId);
    if (!config) return null;
    return getRate(config.rateType, config.tenor);
  };

  const getSofrOvernight = (): number | null => sofr.getRateByTenor("overnight");
  const getPrimeRate = (): number | null => prime.getRateByTenor("overnight");
  const getFedFundsRate = (): number | null => fedFunds.getRateByTenor("overnight");
  const getTreasury = (tenor: Tenor): number | null => treasury.getRateByTenor(tenor);

  const isLoading = treasury.isLoading || sofr.isLoading || prime.isLoading || fedFunds.isLoading || statsLoading;
  const latestDataDate = stats?.latestObservation ? new Date(stats.latestObservation) : null;

  return {
    treasury,
    sofr,
    prime,
    fedFunds,
    stats,
    isLoading,
    latestDataDate,
    getRate,
    getCommonRate,
    getSofrOvernight,
    getPrimeRate,
    getFedFundsRate,
    getTreasury,
  };
}

export function useForwardCurve(rateType: RateType = "sofr", maxMonths: number = 60) {
  const { data: forwardCurve, isLoading, error } = useQuery<ForwardCurveResponse>({
    queryKey: ["/api/capital-markets/forward-curve", rateType, maxMonths],
    queryFn: () => apiRequest(`/api/capital-markets/forward-curve?rateType=${rateType}&maxMonths=${maxMonths}`),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const getForwardRate = (months: number): number | null => {
    if (!forwardCurve?.points) return null;
    const point = forwardCurve.points.find(p => p.forwardMonths === months);
    return point?.forwardRate ?? null;
  };

  return {
    forwardCurve,
    points: forwardCurve?.points ?? [],
    curveDate: forwardCurve?.curveDate ? new Date(forwardCurve.curveDate) : null,
    isLoading,
    error,
    getForwardRate,
  };
}
