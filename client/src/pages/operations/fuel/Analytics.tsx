import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Analytics() {
  return (
    <>
      <Header 
        title="Fuel Sales Analytics"
        subtitle="Analyze sales trends and performance"
      />
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Analytics Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Advanced analytics features will be implemented here.</p>
            <p className="text-sm text-muted-foreground mt-2">This page will include sales charts, fuel type analysis, performance metrics, and trend analysis.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
