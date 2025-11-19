import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, X } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

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
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());

  // Fetch all pending items
  const { data: pendingProperties = [] } = useQuery<PendingItem[]>({
    queryKey: ['/api/crm/pending-properties'],
    refetchInterval: 30000, // Refresh every 30 seconds for real-time updates
  });

  const { data: pendingContacts = [] } = useQuery<PendingItem[]>({
    queryKey: ['/api/crm/pending-contacts'],
    refetchInterval: 30000,
  });

  const { data: pendingCompanies = [] } = useQuery<PendingItem[]>({
    queryKey: ['/api/crm/pending-companies'],
    refetchInterval: 30000,
  });

  const { data: pendingProfiles = [] } = useQuery<PendingPropertyProfile[]>({
    queryKey: ['/api/sales-comps/pending-property-profiles'],
    refetchInterval: 30000,
  });

  // Calculate counts
  const pendingPropertiesCount = pendingProperties.filter(p => p.status === 'pending').length;
  const pendingContactsCount = pendingContacts.filter(p => p.status === 'pending').length;
  const pendingCompaniesCount = pendingCompanies.filter(p => p.status === 'pending').length;
  const pendingProfilesCount = pendingProfiles.filter((p: PendingPropertyProfile) => p.status === 'pending').length;

  // Notification configurations
  const notifications = [
    {
      id: 'profiles',
      count: pendingProfilesCount,
      message: (count: number) => `${count} sales comp${count !== 1 ? 's' : ''} need property profile${count !== 1 ? 's' : ''}`,
      linkText: 'Create profiles',
      href: '/crm/properties',
    },
    {
      id: 'properties',
      count: pendingPropertiesCount,
      message: (count: number) => `${count} propert${count !== 1 ? 'ies' : 'y'} pending review`,
      linkText: 'Review properties',
      href: '/crm/pending-properties',
    },
    {
      id: 'contacts',
      count: pendingContactsCount,
      message: (count: number) => `${count} contact${count !== 1 ? 's' : ''} pending review`,
      linkText: 'Review contacts',
      href: '/crm/pending-contacts',
    },
    {
      id: 'companies',
      count: pendingCompaniesCount,
      message: (count: number) => `${count} compan${count !== 1 ? 'ies' : 'y'} pending review`,
      linkText: 'Review companies',
      href: '/crm/pending-companies',
    },
  ];

  // Filter to only show notifications with items that haven't been dismissed
  const activeNotifications = notifications.filter(
    n => n.count > 0 && !dismissedNotifications.has(n.id)
  );

  const handleDismiss = (notificationId: string) => {
    setDismissedNotifications(prev => new Set([...prev, notificationId]));
  };

  if (activeNotifications.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-gray-200">
      {activeNotifications.map((notification) => (
        <Alert 
          key={notification.id}
          className="rounded-none border-x-0 border-t-0 bg-blue-50 border-blue-200" 
          data-testid={`pending-banner-${notification.id}`}
        >
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="flex items-center justify-between">
            <div className="flex items-center gap-3">
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
              className="h-6 w-6 p-0 text-blue-600 hover:text-blue-900 hover:bg-blue-100"
              onClick={() => handleDismiss(notification.id)}
              data-testid={`button-dismiss-${notification.id}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
