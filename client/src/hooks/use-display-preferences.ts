import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { setGlobalRoundingDigits } from '@/lib/utils';

interface DisplayPreferences {
  priceRoundingDigits: number;
  bottomLineMetric: 'noi' | 'ebitda';
}

export function useDisplayPreferences() {
  const { data: prefs } = useQuery<DisplayPreferences>({
    queryKey: ['/api/modeling/display-preferences'],
  });

  const roundingDigits = prefs?.priceRoundingDigits ?? 0;
  const bottomLineMetric = prefs?.bottomLineMetric ?? 'noi';
  const metricLabel = bottomLineMetric === 'ebitda' ? 'EBITDA' : 'NOI';

  useEffect(() => {
    setGlobalRoundingDigits(roundingDigits);
  }, [roundingDigits]);

  return { roundingDigits, bottomLineMetric, metricLabel };
}
