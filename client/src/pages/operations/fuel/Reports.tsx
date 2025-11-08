import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Reports() {
  return (
    <>
      <Header 
        title="Fuel Sales Reports"
        subtitle="Generate and export sales reports"
      />
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Reporting features will be implemented here.</p>
            <p className="text-sm text-muted-foreground mt-2">This page will allow generating custom reports and exporting data.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
