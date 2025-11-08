import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Inventory() {
  return (
    <>
      <Header 
        title="Fuel Inventory Management"
        subtitle="Monitor fuel tank levels and manage inventory"
      />
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Inventory management will be implemented here.</p>
            <p className="text-sm text-muted-foreground mt-2">This page will track tank levels, reorder points, and delivery management.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
