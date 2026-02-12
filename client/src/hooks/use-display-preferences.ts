import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { setGlobalRoundingDigits } from '@/lib/utils';

interface DisplayPreferences {
  priceRoundingDigits: number;
}

export function useDisplayPreferences() {
  const { data: prefs } = useQuery<DisplayPreferences>({
    queryKey: ['/api/modeling/display-preferences'],
  });

  const roundingDigits = prefs?.priceRoundingDigits ?? 0;

  useEffect(() => {
    setGlobalRoundingDigits(roundingDigits);
  }, [roundingDigits]);

  return { roundingDigits };
}
