import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Transactions() {
  return (
    <>
      <Header 
        title="Fuel Sales Transactions"
        subtitle="Track and manage all fuel sales transactions"
      />
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Transaction management will be implemented here.</p>
            <p className="text-sm text-muted-foreground mt-2">This page will include full transaction list, filtering, and detailed transaction views.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
