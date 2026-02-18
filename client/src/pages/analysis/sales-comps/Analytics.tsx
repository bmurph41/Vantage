import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { salesCompsApi } from "@/lib/salescomps/api";
import { queryKeys } from "@/lib/salescomps/queryKeys";
import SalesCompsHeader from "@/components/salescomps/sales-comps/SalesCompsHeader";
import AnalyticsWorkbench from "@/components/salescomps/analytics/AnalyticsWorkbench";
import { ExportPdfButton } from "@/components/ui/export-pdf-button";

export default function SalesCompsAnalytics() {
  const reportRef = useRef<HTMLDivElement>(null);
  // Fetch total count
  const { data: compsData } = useQuery({
    queryKey: queryKeys.comps.list({ page: 1, pageSize: 10 }),
    queryFn: () => salesCompsApi.getComps({ page: 1, pageSize: 10 }),
  });

  const total = compsData?.total || 0;

  return (
    <div ref={reportRef} className="flex flex-1 bg-background min-h-screen">
      <div className="flex-1 flex flex-col overflow-hidden">
        <SalesCompsHeader 
          total={total}
          canManageColumns={false}
          canCreate={false}
          hasData={total > 0}
        />
        <div className="flex-1 overflow-auto">
          <div className="flex justify-end px-4 pt-4">
            <ExportPdfButton contentRef={reportRef} filename="sales-comps-analytics" title="Sales Comps Analytics" />
          </div>
          <AnalyticsWorkbench />
        </div>
      </div>
    </div>
  );
}
