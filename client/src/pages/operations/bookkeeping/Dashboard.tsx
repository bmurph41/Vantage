import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ContextIntegrationsPanel } from "@/components/integrations/ContextIntegrationsPanel";
import { Calculator, FileText, TrendingUp, DollarSign, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

export default function BookkeepingDashboard() {
  return (
    <div className="p-6 space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Last Sync</CardTitle>
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">2h ago</div>
                <p className="text-xs text-muted-foreground">QuickBooks Online</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Open Invoices</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">--</div>
                <p className="text-xs text-muted-foreground">Connect QuickBooks</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenue MTD</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">--</div>
                <p className="text-xs text-muted-foreground">Connect to view</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Expenses MTD</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">--</div>
                <p className="text-xs text-muted-foreground">Connect to view</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-[#1E4FAB]" />
                Chart of Accounts Status
              </CardTitle>
              <CardDescription>
                Mapping status between your accounting software and MarinaMatch categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="font-medium">No accounting integration connected</p>
                <p className="text-sm mt-1">Connect QuickBooks to sync your Chart of Accounts and financial data.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Latest synced transactions from your accounting software</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="font-medium">No transactions synced yet</p>
                <p className="text-sm mt-1">Connect your accounting integration to see transaction history.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <ContextIntegrationsPanel
            contextKey="bookkeeping"
            title="Accounting Integrations"
            description="Connect your accounting software for automated data sync to MarinaMatch."
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Data Flow to Financial Model</CardTitle>
              <CardDescription>Live data sync status for owned assets</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>P&L Statements</span>
                <Badge variant="outline" className="text-muted-foreground">Not Connected</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Chart of Accounts</span>
                <Badge variant="outline" className="text-muted-foreground">Not Connected</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>A/R Aging</span>
                <Badge variant="outline" className="text-muted-foreground">Not Connected</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Bank Transactions</span>
                <Badge variant="outline" className="text-muted-foreground">Not Connected</Badge>
              </div>
              <p className="text-xs text-muted-foreground pt-2 border-t">
                Connected data automatically syncs to the Financial Model for owned asset valuation models.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
