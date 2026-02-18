import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import RateCompsHeader from "@/components/ratecomps/rate-comps/RateCompsHeader";
import RcAnalyticsWorkbench from "@/components/ratecomps/analytics/RcAnalyticsWorkbench";
import { ExportPdfButton } from "@/components/ui/export-pdf-button";

export default function RateCompsAnalytics() {
  const reportRef = useRef<HTMLDivElement>(null);
  const { data: compsData } = useQuery({
    queryKey: ['/api/rate-comps', { page: 1, pageSize: 10 }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '10',
      });
      const res = await fetch(`/api/rate-comps?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch rate comps');
      return res.json();
    },
  });

  const total = compsData?.total || 0;

  return (
    <div ref={reportRef} className="flex flex-1 bg-background min-h-screen">
      <div className="flex-1 flex flex-col overflow-hidden">
        <RateCompsHeader 
          total={total}
          canManageColumns={false}
          canCreate={false}
          hasData={total > 0}
        />
        <div className="flex-1 overflow-auto">
          <div className="flex justify-end px-4 pt-4">
            <ExportPdfButton contentRef={reportRef} filename="rate-comps-analytics" title="Rate Comps Analytics" />
          </div>
          <RcAnalyticsWorkbench />
        </div>
      </div>
    </div>
  );
}
