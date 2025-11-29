import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface FavoriteButtonProps {
  itemType: string;
  itemId: string;
  title: string;
  subtitle?: string;
  link: string;
  icon?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'ghost' | 'outline' | 'default';
  className?: string;
  showLabel?: boolean;
}

export function FavoriteButton({
  itemType,
  itemId,
  title,
  subtitle,
  link,
  icon,
  size = 'sm',
  variant = 'ghost',
  className,
  showLabel = false,
}: FavoriteButtonProps) {
  const { toast } = useToast();
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);

  const { data: checkData, isLoading } = useQuery({
    queryKey: ['/api/quick-access/favorites/check', itemType, itemId],
    queryFn: async () => {
      const response = await fetch(`/api/quick-access/favorites/check?itemType=${itemType}&itemId=${itemId}`, {
        credentials: 'include',
      });
      if (!response.ok) return { isFavorited: false, favorite: null };
      return response.json();
    },
    staleTime: 30000,
  });

  useEffect(() => {
    if (checkData) {
      setIsFavorited(checkData.isFavorited);
      setFavoriteId(checkData.favorite?.id || null);
    }
  }, [checkData]);

  const addMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/quick-access/favorites', {
      itemType,
      itemId,
      title,
      subtitle,
      link,
      icon,
    }),
    onSuccess: (data: any) => {
      setIsFavorited(true);
      setFavoriteId(data.id);
      queryClient.invalidateQueries({ queryKey: ['/api/quick-access/favorites'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quick-access/favorites/check', itemType, itemId] });
      toast({ title: 'Added to favorites', description: `${title} has been starred.` });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add to favorites.', variant: 'destructive' });
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => apiRequest('DELETE', `/api/quick-access/favorites/item/${itemType}/${itemId}`),
    onSuccess: () => {
      setIsFavorited(false);
      setFavoriteId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/quick-access/favorites'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quick-access/favorites/check', itemType, itemId] });
      toast({ title: 'Removed from favorites', description: `${title} has been removed.` });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to remove from favorites.', variant: 'destructive' });
    },
  });

  const handleToggle = () => {
    if (isFavorited) {
      removeMutation.mutate();
    } else {
      addMutation.mutate();
    }
  };

  const isPending = addMutation.isPending || removeMutation.isPending;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggle}
      disabled={isPending || isLoading}
      className={cn(
        'transition-colors',
        isFavorited && 'text-yellow-500 hover:text-yellow-600',
        className
      )}
      data-testid={`button-favorite-${itemType}-${itemId}`}
    >
      <Star 
        className={cn(
          'h-4 w-4',
          isFavorited && 'fill-current',
          showLabel && 'mr-2'
        )} 
      />
      {showLabel && (isFavorited ? 'Starred' : 'Star')}
    </Button>
  );
}
