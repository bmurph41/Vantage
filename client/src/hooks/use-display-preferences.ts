import { useQuery } from '@tanstack/react-query';
import { setGlobalRoundingDigits, setGlobalEbitdaRoundingDigits, setGlobalLineItemRoundingDigits, setGlobalPercentRoundingDecimals, setGlobalDebtServiceRoundingDigits } from '@/lib/utils';

interface DisplayPreferences {
  priceRoundingDigits: number;
  ebitdaRoundingDigits: number;
  lineItemRoundingDigits: number;
  percentRoundingDecimals: number;
  debtServiceRoundingDigits: number;
  bottomLineMetric: 'noi' | 'ebitda';
}

export function useDisplayPreferences() {
  const { data: prefs } = useQuery<DisplayPreferences>({
    queryKey: ['/api/modeling/display-preferences'],
  });

  const roundingDigits = prefs?.priceRoundingDigits ?? 0;
  const ebitdaRoundingDigits = prefs?.ebitdaRoundingDigits ?? 0;
  const lineItemRoundingDigits = prefs?.lineItemRoundingDigits ?? 0;
  const percentRoundingDecimals = prefs?.percentRoundingDecimals ?? 1;
  const bottomLineMetric = prefs?.bottomLineMetric ?? 'noi';
  const metricLabel = bottomLineMetric === 'ebitda' ? 'EBITDA' : 'NOI';

  setGlobalRoundingDigits(roundingDigits);
  setGlobalEbitdaRoundingDigits(ebitdaRoundingDigits);
  setGlobalLineItemRoundingDigits(lineItemRoundingDigits);
  setGlobalPercentRoundingDecimals(percentRoundingDecimals);

  const debtServiceRoundingDigits = prefs?.debtServiceRoundingDigits ?? 0;
  setGlobalDebtServiceRoundingDigits(debtServiceRoundingDigits);

  return { roundingDigits, ebitdaRoundingDigits, lineItemRoundingDigits, percentRoundingDecimals, debtServiceRoundingDigits, bottomLineMetric, metricLabel };
}
