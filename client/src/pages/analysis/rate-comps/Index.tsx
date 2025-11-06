import { DollarSign } from "lucide-react";

export default function RateCompsIndex() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <DollarSign className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold mb-4" data-testid="text-rate-comps-title">
          Rate Comps
        </h1>
        <p className="text-muted-foreground max-w-md mb-8" data-testid="text-rate-comps-description">
          Track and analyze marina rates across different storage types and pricing models.
          This module will integrate with the Sales Comps data to provide comprehensive market insights.
        </p>
        <div className="bg-muted/50 border border-border rounded-lg p-6 max-w-lg">
          <p className="text-sm text-muted-foreground" data-testid="text-integration-ready">
            Ready for integration. The Rate Comps functionality will be integrated here,
            enabling you to connect rate data with sales transactions for deeper analysis.
          </p>
        </div>
      </div>
    </div>
  );
}
