import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export default function RentRollPortfolio() {
  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-rent-roll-portfolio">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="heading-rent-roll-portfolio">
          Rent Roll Portfolio
        </h1>
        <p className="text-muted-foreground" data-testid="description-rent-roll-portfolio">
          Manage and analyze your portfolio of rent rolls across multiple properties and scenarios.
        </p>
      </div>

      <Card>
        <CardContent className="py-12 text-center">
          <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Portfolio Management</h3>
          <p className="text-muted-foreground">
            Portfolio view coming soon. This will allow you to manage multiple rent rolls across your marina properties.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
