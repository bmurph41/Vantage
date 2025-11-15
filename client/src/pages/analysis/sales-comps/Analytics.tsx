import { useQuery } from "@tanstack/react-query";
import { salesCompsApi } from "@/lib/salescomps/api";
import { queryKeys } from "@/lib/salescomps/queryKeys";
import SalesCompsHeader from "@/components/salescomps/sales-comps/SalesCompsHeader";
import AnalyticsWorkbench from "@/components/salescomps/analytics/AnalyticsWorkbench";

export default function SalesCompsAnalytics() {
  // Fetch total count
  const { data: compsData } = useQuery({
    queryKey: queryKeys.comps.list({ page: 1, pageSize: 1 }),
    queryFn: () => salesCompsApi.getComps({ page: 1, pageSize: 1 }),
  });

  const total = compsData?.total || 0;

  return (
    <div className="flex flex-1 bg-background min-h-screen">
      <div className="flex-1 flex flex-col overflow-hidden">
        <SalesCompsHeader 
          total={total}
          canManageColumns={false}
          canCreate={false}
          hasData={total > 0}
        />
        <div className="flex-1 overflow-auto">
          <AnalyticsWorkbench />
        </div>
      </div>
    </div>
  );
}
