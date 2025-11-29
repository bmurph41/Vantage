import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface TrackRecentOptions {
  itemType: string;
  itemId?: string;
  title: string;
  link: string;
  icon?: string;
  enabled?: boolean;
}

export function useTrackRecent({
  itemType,
  itemId,
  title,
  link,
  icon,
  enabled = true,
}: TrackRecentOptions) {
  const trackMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/quick-access/recent', {
      itemType,
      itemId,
      title,
      link,
      icon,
    }),
    onError: (error) => {
      console.warn('Failed to track recent item:', error);
    },
  });

  useEffect(() => {
    if (enabled && title && link) {
      const timeoutId = setTimeout(() => {
        trackMutation.mutate();
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [itemType, itemId, title, link, enabled]);

  return {
    track: () => trackMutation.mutate(),
    isPending: trackMutation.isPending,
  };
}
