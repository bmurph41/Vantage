import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Globe, DollarSign, ArrowRightLeft, PieChart } from "lucide-react";

export default function CurrencySettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [convertForm, setConvertForm] = useState({ amount: "1000000", from: "USD", to: "EUR" });
  const [conversionResult, setConversionResult] = useState<any>(null);

  const { data: ratesData, isLoading } = useQuery<any>({
    queryKey: ["/api/currency/rates"],
  });

  const { data: exposure } = useQuery<any>({
    queryKey: ["/api/currency/fx-exposure"],
  });

  const refreshRates = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/currency/rates/refresh");
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/currency"] });
      toast({ title: "Rates updated", description: `${data.currenciesUpdated} currencies refreshed` });
    },
    onError: () => toast({ title: "API key required", description: "Set OPEN_EXCHANGE_RATES_APP_ID env var", variant: "destructive" }),
  });

  const convert = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/currency/convert", data);
      return res.json();
    },
    onSuccess: (data) => setConversionResult(data),
  });

  const rates = ratesData?.rates || {};
  const currencies = Object.entries(rates).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Multi-Currency Settings</h1>
          <p className="text-muted-foreground">Exchange rates, currency conversion, and portfolio FX exposure</p>
        </div>
        <Button onClick={() => refreshRates.mutate()} disabled={refreshRates.isPending}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshRates.isPending ? "animate-spin" : ""}`} />
          Refresh Rates
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Currency Converter */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5" />Currency Converter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Amount</Label>
                <Input type="number" value={convertForm.amount} onChange={(e) => setConvertForm({ ...convertForm, amount: e.target.value })} />
              </div>
              <div>
                <Label>From</Label>
                <Input value={convertForm.from} onChange={(e) => setConvertForm({ ...convertForm, from: e.target.value.toUpperCase() })} maxLength={3} />
              </div>
              <div>
                <Label>To</Label>
                <Input value={convertForm.to} onChange={(e) => setConvertForm({ ...convertForm, to: e.target.value.toUpperCase() })} maxLength={3} />
              </div>
            </div>
            <Button className="w-full" onClick={() => convert.mutate(convertForm)} disabled={convert.isPending}>
              Convert
            </Button>
            {conversionResult && (
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground">{conversionResult.from} {Number(conversionResult.amount).toLocaleString()}</p>
                <p className="text-2xl font-bold">{conversionResult.to} {Number(conversionResult.convertedAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-muted-foreground mt-1">Rate: {conversionResult.rate}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* FX Exposure */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PieChart className="h-5 w-5" />Portfolio FX Exposure</CardTitle>
            <CardDescription>{exposure?.fxRiskNote}</CardDescription>
          </CardHeader>
          <CardContent>
            {!exposure ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Portfolio (USD)</span>
                  <span className="font-bold">${(exposure.totalPortfolioUsd || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Non-USD Exposure</span>
                  <span className="font-bold">{exposure.nonUsdExposurePct || 0}%</span>
                </div>
                <div className="border-t pt-3 space-y-2">
                  {(exposure.currencies || []).map((c: any) => (
                    <div key={c.currency} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{c.currency}</Badge>
                        <span className="text-sm">{c.dealCount} deals</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">${c.usdEquivalent.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{c.portfolioPct}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Exchange Rates Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Exchange Rates (Base: {ratesData?.base || "USD"})
          </CardTitle>
          <CardDescription>As of {ratesData?.asOf || "—"}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {currencies.map(([currency, rate]) => (
                <div key={currency} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <span className="font-medium">{currency}</span>
                  <span className="text-sm text-muted-foreground">{Number(rate).toFixed(4)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
