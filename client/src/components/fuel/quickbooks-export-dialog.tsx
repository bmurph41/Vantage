import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Download, Eye, Settings2, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface QuickBooksExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AccountMappings {
  diesel: string;
  regularGas: string;
  premiumGas: string;
  ethanolFree: string;
  salesTax: string;
  accountsReceivable: string;
}

interface PreviewData {
  date: string;
  account: string;
  debit: string;
  credit: string;
  memo: string;
  name: string;
  class: string;
}

export function QuickBooksExportDialog({ open, onOpenChange }: QuickBooksExportDialogProps) {
  const { toast } = useToast();
  const today = new Date();
  
  const [startDate, setStartDate] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), "yyyy-MM-dd"));
  const [exportFormat, setExportFormat] = useState<"journal_entry" | "sales_receipts">("journal_entry");
  const [saveSettings, setSaveSettings] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData[]>([]);

  const [accountMappings, setAccountMappings] = useState<AccountMappings>({
    diesel: "4010",
    regularGas: "4020",
    premiumGas: "4030",
    ethanolFree: "4040",
    salesTax: "2200",
    accountsReceivable: "1200",
  });

  // Load saved settings
  const { data: savedSettings } = useQuery({
    queryKey: ['/api/operations/fuel-integrations'],
    enabled: open,
  });

  useEffect(() => {
    if (savedSettings && Array.isArray(savedSettings)) {
      const qbIntegration = savedSettings.find((s: any) => s.provider === 'quickbooks');
      if (qbIntegration?.settings?.accountMappings) {
        setAccountMappings(qbIntegration.settings.accountMappings);
      }
    }
  }, [savedSettings]);

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async () => {
      return apiRequest({
        url: '/api/operations/fuel-sales/export-quickbooks/preview',
        method: 'POST',
        body: {
          startDate,
          endDate,
          accountMappings,
          format: exportFormat,
        },
      });
    },
    onSuccess: (data: any) => {
      setPreviewData(data.preview || []);
      setShowPreview(true);
    },
    onError: (error: any) => {
      toast({
        title: "Preview Failed",
        description: error.message || "Failed to generate preview",
        variant: "destructive",
      });
    },
  });

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/operations/fuel-sales/export-quickbooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate,
          endDate,
          accountMappings,
          format: exportFormat,
          saveSettings,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fuel-sales-quickbooks-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      return true;
    },
    onSuccess: () => {
      toast({
        title: "Export Successful",
        description: "QuickBooks CSV file has been downloaded",
      });
      if (saveSettings) {
        queryClient.invalidateQueries({ queryKey: ['/api/operations/fuel-integrations'] });
      }
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export data",
        variant: "destructive",
      });
    },
  });

  const handleAccountChange = (field: keyof AccountMappings, value: string) => {
    setAccountMappings(prev => ({ ...prev, [field]: value }));
  };

  const handleExport = () => {
    if (!startDate || !endDate) {
      toast({
        title: "Validation Error",
        description: "Please select both start and end dates",
        variant: "destructive",
      });
      return;
    }
    exportMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-quickbooks-export">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export to QuickBooks
          </DialogTitle>
          <DialogDescription>
            Configure GL account mappings and export fuel sales data to QuickBooks format
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Date Range */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Date Range</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="input-quickbooks-start-date"
                />
              </div>
              <div>
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="input-quickbooks-end-date"
                />
              </div>
            </CardContent>
          </Card>

          {/* GL Account Mappings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                GL Account Mappings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="diesel-account">Diesel Sales Account</Label>
                  <Input
                    id="diesel-account"
                    placeholder="4010"
                    value={accountMappings.diesel}
                    onChange={(e) => handleAccountChange('diesel', e.target.value)}
                    maxLength={4}
                    data-testid="input-diesel-account"
                  />
                </div>
                <div>
                  <Label htmlFor="regular-account">Regular Gas Sales Account</Label>
                  <Input
                    id="regular-account"
                    placeholder="4020"
                    value={accountMappings.regularGas}
                    onChange={(e) => handleAccountChange('regularGas', e.target.value)}
                    maxLength={4}
                    data-testid="input-regular-account"
                  />
                </div>
                <div>
                  <Label htmlFor="premium-account">Premium Gas Sales Account</Label>
                  <Input
                    id="premium-account"
                    placeholder="4030"
                    value={accountMappings.premiumGas}
                    onChange={(e) => handleAccountChange('premiumGas', e.target.value)}
                    maxLength={4}
                    data-testid="input-premium-account"
                  />
                </div>
                <div>
                  <Label htmlFor="ethanol-account">Ethanol-Free Sales Account</Label>
                  <Input
                    id="ethanol-account"
                    placeholder="4040"
                    value={accountMappings.ethanolFree}
                    onChange={(e) => handleAccountChange('ethanolFree', e.target.value)}
                    maxLength={4}
                    data-testid="input-ethanol-account"
                  />
                </div>
                <div>
                  <Label htmlFor="sales-tax-account">Sales Tax Account</Label>
                  <Input
                    id="sales-tax-account"
                    placeholder="2200"
                    value={accountMappings.salesTax}
                    onChange={(e) => handleAccountChange('salesTax', e.target.value)}
                    maxLength={4}
                    data-testid="input-sales-tax-account"
                  />
                </div>
                <div>
                  <Label htmlFor="ar-account">Accounts Receivable</Label>
                  <Input
                    id="ar-account"
                    placeholder="1200"
                    value={accountMappings.accountsReceivable}
                    onChange={(e) => handleAccountChange('accountsReceivable', e.target.value)}
                    maxLength={4}
                    data-testid="input-ar-account"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Export Format */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Export Format</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={exportFormat} onValueChange={(value: any) => setExportFormat(value)}>
                <SelectTrigger data-testid="select-export-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="journal_entry">Journal Entry</SelectItem>
                  <SelectItem value="sales_receipts">Sales Receipts</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Save Settings */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="save-settings"
              checked={saveSettings}
              onCheckedChange={(checked) => setSaveSettings(checked as boolean)}
              data-testid="checkbox-save-settings"
            />
            <Label htmlFor="save-settings" className="text-sm cursor-pointer">
              Save GL account mappings for future exports
            </Label>
          </div>

          {/* Preview Section */}
          {showPreview && previewData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Preview (First 5 Transactions)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">Account</th>
                        <th className="text-right p-2">Debit</th>
                        <th className="text-right p-2">Credit</th>
                        <th className="text-left p-2">Memo</th>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Class</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="p-2">{row.date}</td>
                          <td className="p-2">{row.account}</td>
                          <td className="p-2 text-right">{row.debit}</td>
                          <td className="p-2 text-right">{row.credit}</td>
                          <td className="p-2">{row.memo}</td>
                          <td className="p-2">{row.name}</td>
                          <td className="p-2">{row.class}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Action Buttons */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => previewMutation.mutate()}
              disabled={previewMutation.isPending || !startDate || !endDate}
              data-testid="button-preview-export"
            >
              {previewMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </>
              )}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-export">
                Cancel
              </Button>
              <Button
                onClick={handleExport}
                disabled={exportMutation.isPending || !startDate || !endDate}
                data-testid="button-export-csv"
              >
                {exportMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Export to CSV
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
