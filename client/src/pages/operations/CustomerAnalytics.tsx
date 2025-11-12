import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { CustomerOverviewCards } from "@/components/analytics/customer/CustomerOverviewCards";
import { TopCustomersTable } from "@/components/analytics/customer/TopCustomersTable";
import { LtvDistributionChart } from "@/components/analytics/customer/LtvDistributionChart";
import { SegmentBreakdown } from "@/components/analytics/customer/SegmentBreakdown";
import { ChurnRiskTable } from "@/components/analytics/customer/ChurnRiskTable";
import { CUSTOMER_ANALYTICS_QUERY_KEYS } from "@/types/customer-analytics";
import type { 
  CustomerOverview, 
  TopCustomer, 
  CustomerSegment, 
  ChurnRiskCustomer, 
  LtvDistribution 
} from "@/types/customer-analytics";

export default function CustomerAnalytics() {
  const overviewQuery = useQuery<CustomerOverview>({
    queryKey: CUSTOMER_ANALYTICS_QUERY_KEYS.overview(),
  });

  const topCustomersQuery = useQuery<TopCustomer[]>({
    queryKey: CUSTOMER_ANALYTICS_QUERY_KEYS.topCustomers(20),
  });

  const segmentsQuery = useQuery<CustomerSegment[]>({
    queryKey: CUSTOMER_ANALYTICS_QUERY_KEYS.segments(),
  });

  const churnRiskQuery = useQuery<ChurnRiskCustomer[]>({
    queryKey: CUSTOMER_ANALYTICS_QUERY_KEYS.churnRisk(),
  });

  const ltvDistributionQuery = useQuery<LtvDistribution[]>({
    queryKey: CUSTOMER_ANALYTICS_QUERY_KEYS.ltvDistribution(),
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ 
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.startsWith('/api/analytics/customers');
      }
    });
  };

  const isAnyLoading = 
    overviewQuery.isLoading || 
    topCustomersQuery.isLoading || 
    segmentsQuery.isLoading || 
    churnRiskQuery.isLoading || 
    ltvDistributionQuery.isLoading;

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-customer-analytics">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="heading-customer-analytics">
            Customer Analytics
          </h1>
          <p className="text-muted-foreground" data-testid="description-customer-analytics">
            Comprehensive analytics and insights about your marina customers, engagement patterns, and revenue metrics.
          </p>
        </div>
        <Button 
          onClick={handleRefresh} 
          disabled={isAnyLoading}
          variant="outline"
          data-testid="button-refresh-analytics"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isAnyLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <CustomerOverviewCards 
        data={overviewQuery.data}
        isLoading={overviewQuery.isLoading}
        error={overviewQuery.error}
      />

      <TopCustomersTable 
        data={topCustomersQuery.data}
        isLoading={topCustomersQuery.isLoading}
        error={topCustomersQuery.error}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <LtvDistributionChart 
          data={ltvDistributionQuery.data}
          isLoading={ltvDistributionQuery.isLoading}
          error={ltvDistributionQuery.error}
        />

        <SegmentBreakdown 
          data={segmentsQuery.data}
          isLoading={segmentsQuery.isLoading}
          error={segmentsQuery.error}
        />
      </div>

      <ChurnRiskTable 
        data={churnRiskQuery.data}
        isLoading={churnRiskQuery.isLoading}
        error={churnRiskQuery.error}
      />
    </div>
  );
}
