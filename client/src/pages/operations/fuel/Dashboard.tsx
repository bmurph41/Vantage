import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  DollarSign, 
  Fuel, 
  TrendingUp, 
  Package
} from "lucide-react";

export default function Dashboard() {
  const { data: fuelSales = [] } = useQuery({
    queryKey: ['/api/operations/fuel-sales'],
  });

  const { data: fuelTypes = [] } = useQuery({
    queryKey: ['/api/operations/fuel-types'],
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['/api/operations/fuel-inventory'],
  });

  const totalRevenue = fuelSales.reduce((sum: number, sale: any) => sum + Number(sale.totalAmount || 0), 0);
  const totalGallons = fuelSales.reduce((sum: number, sale: any) => sum + Number(sale.quantityGallons || 0), 0);

  return (
    <>
      <Header 
        title="Fuel Sales Dashboard"
        subtitle="Overview of fuel sales operations"
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                From {fuelSales.length} transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Gallons Sold</CardTitle>
              <Fuel className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalGallons.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                All fuel types
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fuel Types</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fuelTypes.length}</div>
              <p className="text-xs text-muted-foreground">
                Active products
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inventory Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inventory.length}</div>
              <p className="text-xs text-muted-foreground">
                Tracked tanks
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {fuelSales.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No transactions yet</p>
            ) : (
              <div className="space-y-4">
                {fuelSales.slice(0, 5).map((sale: any) => (
                  <div key={sale.id} className="flex items-center justify-between border-b pb-2">
                    <div>
                      <p className="font-medium">{sale.customerName || 'Walk-in Customer'}</p>
                      <p className="text-sm text-muted-foreground">
                        {sale.quantityGallons} gal {sale.fuelType}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${Number(sale.totalAmount).toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(sale.transactionDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
