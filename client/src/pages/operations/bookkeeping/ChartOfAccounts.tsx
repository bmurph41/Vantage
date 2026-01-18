import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calculator, RefreshCw, AlertCircle, Settings } from "lucide-react";

export default function BookkeepingChartOfAccounts() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Chart of Accounts</h2>
          <p className="text-sm text-muted-foreground">Manage account mappings between your accounting software and MarinaMatch categories</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Sync Now
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Mapping Settings
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-[#1E4FAB]" />
            Account Mappings
          </CardTitle>
          <CardDescription>
            Map your QuickBooks accounts to MarinaMatch's marina-specific Chart of Accounts for accurate P&L categorization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="font-medium">No accounts synced</p>
            <p className="text-sm mt-1 mb-4">Connect QuickBooks to import and map your Chart of Accounts.</p>
            <div className="text-xs bg-muted p-3 rounded-lg max-w-md mx-auto">
              <p className="font-medium mb-2">After connecting, you'll be able to:</p>
              <ul className="text-left space-y-1">
                <li>• Map QBO accounts to marina-specific categories</li>
                <li>• Auto-classify revenue by slip type, fuel, ship store, etc.</li>
                <li>• Generate standardized P&L reports for valuations</li>
                <li>• Sync live data to your Modeling projects</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Marina-Specific Categories</CardTitle>
          <CardDescription>Standard revenue and expense categories for marina valuation</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Mapped Accounts</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Wet Slip Revenue</TableCell>
                <TableCell>Revenue</TableCell>
                <TableCell className="text-muted-foreground">--</TableCell>
                <TableCell><Badge variant="outline">Unmapped</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Dry Storage Revenue</TableCell>
                <TableCell>Revenue</TableCell>
                <TableCell className="text-muted-foreground">--</TableCell>
                <TableCell><Badge variant="outline">Unmapped</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Fuel Sales</TableCell>
                <TableCell>Revenue</TableCell>
                <TableCell className="text-muted-foreground">--</TableCell>
                <TableCell><Badge variant="outline">Unmapped</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Ship Store Sales</TableCell>
                <TableCell>Revenue</TableCell>
                <TableCell className="text-muted-foreground">--</TableCell>
                <TableCell><Badge variant="outline">Unmapped</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Service Revenue</TableCell>
                <TableCell>Revenue</TableCell>
                <TableCell className="text-muted-foreground">--</TableCell>
                <TableCell><Badge variant="outline">Unmapped</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Boat Rentals</TableCell>
                <TableCell>Revenue</TableCell>
                <TableCell className="text-muted-foreground">--</TableCell>
                <TableCell><Badge variant="outline">Unmapped</Badge></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
