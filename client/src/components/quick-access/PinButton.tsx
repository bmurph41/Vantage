import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Pin, PinOff, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { UserPinnedItem } from '@shared/schema';

interface PinButtonProps {
  itemType: string;
  itemId?: string;
  title: string;
  description?: string;
  link: string;
  icon?: string;
  color?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'ghost' | 'outline' | 'default';
  className?: string;
  showLabel?: boolean;
}

export function PinButton({
  itemType,
  itemId,
  title,
  description,
  link,
  icon,
  color,
  size = 'sm',
  variant = 'ghost',
  className,
  showLabel = false,
}: PinButtonProps) {
  const { toast } = useToast();
  const [isPinned, setIsPinned] = useState(false);

  const { data: _pinnedItems } = useQuery<UserPinnedItem[]>({
    queryKey: ['/api/quick-access/pinned'],
  });
  const pinnedItems: UserPinnedItem[] = _pinnedItems ?? [];

  const existingPin = pinnedItems.find(
    p => p.itemType === itemType && p.itemId === itemId && p.link === link
  );

  const addMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/quick-access/pinned', {
      itemType,
      itemId,
      title,
      description,
      link,
      icon,
      color,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quick-access/pinned'] });
      toast({ title: 'Pinned to dashboard', description: `${title} has been added to your quick access.` });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to pin item.', variant: 'destructive' });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (pinId: string) => apiRequest('DELETE', `/api/quick-access/pinned/${pinId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quick-access/pinned'] });
      toast({ title: 'Unpinned', description: `${title} has been removed from quick access.` });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to unpin item.', variant: 'destructive' });
    },
  });

  const handleToggle = () => {
    if (existingPin) {
      removeMutation.mutate(existingPin.id);
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
      disabled={isPending}
      className={cn(
        'transition-colors',
        existingPin && 'text-blue-500 hover:text-blue-600',
        className
      )}
      data-testid={`button-pin-${itemType}-${itemId || 'page'}`}
    >
      {existingPin ? (
        <PinOff className={cn('h-4 w-4', showLabel && 'mr-2')} />
      ) : (
        <Pin className={cn('h-4 w-4', showLabel && 'mr-2')} />
      )}
      {showLabel && (existingPin ? 'Unpin' : 'Pin to Dashboard')}
    </Button>
  );
}

interface QuickPinMenuProps {
  children: React.ReactNode;
  itemType: string;
  itemId?: string;
  title: string;
  description?: string;
  link: string;
  icon?: string;
}

export function QuickPinMenu({
  children,
  itemType,
  itemId,
  title,
  description,
  link,
  icon,
}: QuickPinMenuProps) {
  const { toast } = useToast();

  const { data: _pinnedItems } = useQuery<UserPinnedItem[]>({
    queryKey: ['/api/quick-access/pinned'],
  });
  const pinnedItems: UserPinnedItem[] = _pinnedItems ?? [];

  const existingPin = pinnedItems.find(
    p => p.itemType === itemType && p.itemId === itemId && p.link === link
  );

  const addMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/quick-access/pinned', {
      itemType,
      itemId,
      title,
      description,
      link,
      icon,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quick-access/pinned'] });
      toast({ title: 'Pinned to dashboard', description: `${title} added to quick access.` });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (pinId: string) => apiRequest('DELETE', `/api/quick-access/pinned/${pinId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quick-access/pinned'] });
      toast({ title: 'Unpinned', description: `${title} removed from quick access.` });
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {existingPin ? (
          <DropdownMenuItem 
            onClick={() => removeMutation.mutate(existingPin.id)}
            disabled={removeMutation.isPending}
          >
            <PinOff className="h-4 w-4 mr-2" />
            Remove from Dashboard
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem 
            onClick={() => addMutation.mutate()}
            disabled={addMutation.isPending}
          >
            <Pin className="h-4 w-4 mr-2" />
            Pin to Dashboard
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
