import { Users } from "lucide-react";

export default function DemographicsIndex() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <Users className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold mb-4" data-testid="text-demographics-title">
          Demographics
        </h1>
        <p className="text-muted-foreground max-w-md mb-8" data-testid="text-demographics-description">
          Analyze demographic data and market characteristics for marina locations.
          This module will provide insights into population trends, income levels, and boating demographics.
        </p>
        <div className="bg-muted/50 border border-border rounded-lg p-6 max-w-lg">
          <p className="text-sm text-muted-foreground" data-testid="text-integration-ready">
            Ready for integration. The Demographics functionality will be integrated here,
            enabling you to analyze market demographics and connect them with sales data for comprehensive market analysis.
          </p>
        </div>
      </div>
    </div>
  );
}
