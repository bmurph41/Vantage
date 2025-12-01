import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import type { Launch, Payment, Customer, Boat } from "@shared/schema";
import { Clock } from "lucide-react";

interface ActivityItem {
  id: string;
  customerId: string;
  customerName: string;
  customerInitials: string;
  action: string;
  timestamp: string;
  type: 'launch' | 'payment' | 'reservation';
}

export default function CustomerActivity() {
  const { data: launches = [] } = useQuery<Launch[]>({
    queryKey: ['/api/launches'],
  });
  
  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ['/api/payments'],
  });
  
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });
  
  const { data: boats = [] } = useQuery<Boat[]>({
    queryKey: ['/api/boats'],
  });

  // Generate activity feed from launches and payments
  const activities: ActivityItem[] = [
    ...launches
      .filter(launch => launch.actualLaunchTime || launch.status === 'launched')
      .map(launch => {
        const customer = customers.find(c => c.id === launch.customerId);
        const boat = boats.find(b => b.id === launch.boatId);
        return {
          id: launch.id,
          customerId: launch.customerId,
          customerName: customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown Customer',
          customerInitials: customer ? `${customer.firstName[0]}${customer.lastName[0]}` : 'UK',
          action: `Boat launched - ${boat ? `${boat.name || `${boat.make} ${boat.model}`}` : 'Unknown Boat'}`,
          timestamp: (launch.actualLaunchTime || launch.scheduledTime).toString(),
          type: 'launch' as const,
        };
      }),
    ...payments
      .filter(payment => payment.status === 'paid' && payment.paidDate)
      .map(payment => {
        const customer = customers.find(c => c.id === payment.customerId);
        return {
          id: payment.id,
          customerId: payment.customerId,
          customerName: customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown Customer',
          customerInitials: customer ? `${customer.firstName[0]}${customer.lastName[0]}` : 'UK',
          action: `Payment received - $${payment.amount}`,
          timestamp: payment.paidDate!.toString(),
          type: 'payment' as const,
        };
      }),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 6);

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'launch':
        return 'bg-accent';
      case 'payment':
        return 'bg-chart-3';
      case 'reservation':
        return 'bg-chart-2';
      default:
        return 'bg-muted';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card data-testid="customer-activity">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Recent Customer Activity</h3>
          <Button variant="ghost" size="sm" data-testid="button-view-all-activity">
            View All
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock size={48} className="mx-auto mb-4 opacity-50" />
            <p>No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between"
                data-testid={`activity-item-${activity.id}`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium">{activity.customerInitials}</span>
                  </div>
                  <div>
                    <p className="font-medium">{activity.customerName}</p>
                    <p className="text-sm text-muted-foreground">{activity.action}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{formatTime(activity.timestamp)}</p>
                  <div className={`w-2 h-2 ${getActivityColor(activity.type)} rounded-full mt-1 ml-auto`} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
