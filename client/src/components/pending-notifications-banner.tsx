import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, X } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";

const DISMISSED_STORAGE_KEY = 'vantage-dismissed-pending-notifications';

function loadDismissed(): Set<string> {
  try {
    const stored = localStorage.getItem(DISMISSED_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {}
  return new Set();
}

function saveDismissed(dismissed: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify([...dismissed]));
  } catch {}
}

type PendingItem = {
  id: string;
  status: string;
};

type PendingPropertyProfile = {
  id: string;
  compId: string;
  orgId: string;
  status: string;
  createdAt: string;
};

export default function PendingNotificationsBanner() {
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(loadDismissed);

  // Fetch all pending items - use longer stale time to reduce unnecessary refetches
  const { data: pendingPropertiesRaw } = useQuery<PendingItem[]>({
    queryKey: ['/api/crm/pending-properties'],
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes instead of 30 seconds
    refetchOnWindowFocus: false,
  });

  const { data: pendingContactsRaw } = useQuery<PendingItem[]>({
    queryKey: ['/api/crm/pending-contacts'],
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: pendingCompaniesRaw } = useQuery<PendingItem[]>({
    queryKey: ['/api/crm/pending-companies'],
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: pendingProfilesRaw } = useQuery<PendingPropertyProfile[]>({
    queryKey: ['/api/sales-comps/pending-property-profiles'],
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const pendingProperties = pendingPropertiesRaw ?? [];
  const pendingContacts = pendingContactsRaw ?? [];
  const pendingCompanies = pendingCompaniesRaw ?? [];
  const pendingProfiles = pendingProfilesRaw ?? [];

  // Calculate counts
  const pendingPropertiesCount = pendingProperties.filter(p => p.status === 'pending').length;
  const pendingContactsCount = pendingContacts.filter(p => p.status === 'pending').length;
  const pendingCompaniesCount = pendingCompanies.filter(p => p.status === 'pending').length;
  const pendingProfilesCount = pendingProfiles.filter((p: PendingPropertyProfile) => p.status === 'pending').length;

  // Notification configurations - each specifies entity type and links to respective pending page
  const notifications = [
    {
      id: 'profiles',
      count: pendingProfilesCount,
      message: (count: number) => `${count} sales comp${count !== 1 ? 's' : ''} need${count === 1 ? 's' : ''} property profile${count !== 1 ? 's' : ''} created`,
      linkText: 'Create property profiles',
      href: '/analysis/sales-comps/pending-profiles',
    },
    {
      id: 'properties',
      count: pendingPropertiesCount,
      message: (count: number) => `${count} propert${count !== 1 ? 'ies' : 'y'} pending review`,
      linkText: 'Review pending properties',
      href: '/crm/pending-properties',
    },
    {
      id: 'contacts',
      count: pendingContactsCount,
      message: (count: number) => `${count} contact${count !== 1 ? 's' : ''} pending review`,
      linkText: 'Review pending contacts',
      href: '/crm/pending-contacts',
    },
    {
      id: 'companies',
      count: pendingCompaniesCount,
      message: (count: number) => `${count} compan${count !== 1 ? 'ies' : 'y'} pending review`,
      linkText: 'Review pending companies',
      href: '/crm/pending-companies',
    },
  ];

  // Filter to only show notifications with items that haven't been dismissed
  const activeNotifications = notifications.filter(
    n => n.count > 0 && !dismissedNotifications.has(n.id)
  );

  const handleDismiss = useCallback((notificationId: string) => {
    setDismissedNotifications(prev => {
      const next = new Set([...prev, notificationId]);
      saveDismissed(next);
      return next;
    });
  }, []);

  if (activeNotifications.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-gray-200">
      {activeNotifications.map((notification) => (
        <SwipeableBanner key={notification.id} onSwipeDismiss={() => handleDismiss(notification.id)}>
          <Alert 
            className="rounded-none border-x-0 border-t-0 bg-blue-50 border-blue-200" 
            data-testid={`pending-banner-${notification.id}`}
          >
            <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <AlertDescription className="flex items-start sm:items-center justify-between gap-2 w-full">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
                <span className="text-sm text-blue-900">
                  <strong>{notification.count}</strong> {notification.message(notification.count).split(' ').slice(1).join(' ')}
                </span>
                <Link href={notification.href}>
                  <Button 
                    variant="link" 
                    className="h-auto p-0 text-sm text-blue-600 hover:text-blue-800 underline"
                    data-testid={`button-view-pending-${notification.id}`}
                  >
                    {notification.linkText}
                  </Button>
                </Link>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-11 w-11 p-0 flex-shrink-0 text-blue-600 hover:text-blue-900 hover:bg-blue-100"
                onClick={() => handleDismiss(notification.id)}
                data-testid={`button-dismiss-${notification.id}`}
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </Button>
            </AlertDescription>
          </Alert>
        </SwipeableBanner>
      ))}
    </div>
  );
}

function SwipeableBanner({ children, onSwipeDismiss }: { children: ReactNode; onSwipeDismiss: () => void }) {
  const touchStartX = useRef<number | null>(null);
  const [translateX, setTranslateX] = useState(0);
  const SWIPE_THRESHOLD = 80;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.touches[0].clientX - touchStartX.current;
    if (delta < 0) setTranslateX(delta);
  };

  const handleTouchEnd = () => {
    if (translateX < -SWIPE_THRESHOLD) {
      onSwipeDismiss();
    }
    setTranslateX(0);
    touchStartX.current = null;
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ transform: `translateX(${translateX}px)`, transition: translateX === 0 ? 'transform 0.2s ease' : 'none' }}
    >
      {children}
    </div>
  );
}
