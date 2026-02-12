import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { formatCurrency as baseFormatCurrency } from '@/lib/utils';

interface DisplayPreferences {
  priceRoundingDigits: number;
}

export function useDisplayPreferences() {
  const { data: prefs } = useQuery<DisplayPreferences>({
    queryKey: ['/api/modeling/display-preferences'],
  });

  const roundingDigits = prefs?.priceRoundingDigits ?? 0;

  const fc = useCallback(
    (value: number | string | null | undefined, opts?: { dash?: boolean }) =>
      baseFormatCurrency(value, { roundingDigits, dash: opts?.dash }),
    [roundingDigits]
  );

  return { roundingDigits, formatCurrency: fc };
}
