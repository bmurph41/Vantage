import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FinancialModel() {
  return (
    <>
      <Header 
        title="Financial Projections"
        subtitle="Forecast and model fuel sales revenue"
      />
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Financial Model</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Financial modeling tools will be implemented here.</p>
            <p className="text-sm text-muted-foreground mt-2">This page will include revenue projections, growth forecasting, and financial planning.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
