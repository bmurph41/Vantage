import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Upload, Calendar, AlertCircle } from "lucide-react";

export default function BookkeepingStatements() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Financial Statements</h2>
          <p className="text-sm text-muted-foreground">View and manage synced P&L statements and balance sheets</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Upload className="w-4 h-4 mr-2" />
            Import Statement
          </Button>
          <Button size="sm" className="bg-[#1E4FAB] hover:bg-[#1a4294]">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#1E4FAB]" />
            P&L Statements
          </CardTitle>
          <CardDescription>
            Monthly and annual profit & loss statements synced from your accounting software
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="font-medium">No statements available</p>
            <p className="text-sm mt-1 mb-4">Connect QuickBooks to automatically sync your P&L statements.</p>
            <Button variant="outline" size="sm">
              <Calendar className="w-4 h-4 mr-2" />
              Select Date Range
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Balance Sheets</CardTitle>
          <CardDescription>Current and historical balance sheet data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No balance sheet data synced yet.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
