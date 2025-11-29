import { useEffect, useRef } from 'react';
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
  const lastTrackedRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const trackMutation = useMutation({
    mutationFn: async () => {
      abortControllerRef.current = new AbortController();
      return apiRequest('POST', '/api/quick-access/recent', {
        itemType,
        itemId,
        title,
        link,
        icon,
      });
    },
    onError: (error: any) => {
      if (error?.name !== 'AbortError') {
        console.warn('Failed to track recent item:', error);
      }
    },
  });

  useEffect(() => {
    if (!enabled || !title || !link || !itemType) {
      return;
    }

    const trackKey = `${itemType}:${itemId || 'page'}:${link}`;
    if (lastTrackedRef.current === trackKey) {
      return;
    }

    const timeoutId = setTimeout(() => {
      lastTrackedRef.current = trackKey;
      trackMutation.mutate();
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [itemType, itemId, title, link, enabled]);

  return {
    track: () => trackMutation.mutate(),
    isPending: trackMutation.isPending,
  };
}
