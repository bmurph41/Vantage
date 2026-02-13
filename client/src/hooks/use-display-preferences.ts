import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { setGlobalRoundingDigits, setGlobalEbitdaRoundingDigits, setGlobalLineItemRoundingDigits, setGlobalPercentRoundingDecimals } from '@/lib/utils';

interface DisplayPreferences {
  priceRoundingDigits: number;
  ebitdaRoundingDigits: number;
  lineItemRoundingDigits: number;
  percentRoundingDecimals: number;
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

  useEffect(() => {
    setGlobalRoundingDigits(roundingDigits);
    setGlobalEbitdaRoundingDigits(ebitdaRoundingDigits);
    setGlobalLineItemRoundingDigits(lineItemRoundingDigits);
    setGlobalPercentRoundingDecimals(percentRoundingDecimals);
  }, [roundingDigits, ebitdaRoundingDigits, lineItemRoundingDigits, percentRoundingDecimals]);

  return { roundingDigits, ebitdaRoundingDigits, lineItemRoundingDigits, percentRoundingDecimals, bottomLineMetric, metricLabel };
}
