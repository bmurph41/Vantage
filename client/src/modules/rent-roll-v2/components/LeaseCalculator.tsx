import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator } from "lucide-react";

export default function LeaseCalculator() {
  const [leaseAmount, setLeaseAmount] = useState<number>(0);
  const [additionalCharge1, setAdditionalCharge1] = useState<number>(0);
  const [additionalCharge2, setAdditionalCharge2] = useState<number>(0);
  const [additionalCharge3, setAdditionalCharge3] = useState<number>(0);

  const [results, setResults] = useState({
    monthlyTotal: 0,
    annualTotal: 0,
    baseMonthly: 0,
    additionalMonthly: 0,
  });

  useEffect(() => {
    const baseMonthly = leaseAmount || 0;
    const additionalMonthly = (additionalCharge1 || 0) + (additionalCharge2 || 0) + (additionalCharge3 || 0);
    const monthlyTotal = baseMonthly + additionalMonthly;
    const annualTotal = monthlyTotal * 12;

    setResults({
      monthlyTotal,
      annualTotal,
      baseMonthly,
      additionalMonthly,
    });
  }, [leaseAmount, additionalCharge1, additionalCharge2, additionalCharge3]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card data-testid="lease-calculator">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Lease Calculator</CardTitle>
        </div>
        <CardDescription>
          Calculate total monthly and annual rent including additional charges
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="base-rent">Base Monthly Rent</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="base-rent"
                type="number"
                step="0.01"
                placeholder="0.00"
                className="pl-7"
                value={leaseAmount || ""}
                onChange={(e) => setLeaseAmount(parseFloat(e.target.value) || 0)}
                data-testid="input-calculator-base-rent"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="charge-1" className="text-xs">Add'l Charge 1</Label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <Input
                  id="charge-1"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-5 text-sm"
                  value={additionalCharge1 || ""}
                  onChange={(e) => setAdditionalCharge1(parseFloat(e.target.value) || 0)}
                  data-testid="input-calculator-charge-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="charge-2" className="text-xs">Add'l Charge 2</Label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <Input
                  id="charge-2"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-5 text-sm"
                  value={additionalCharge2 || ""}
                  onChange={(e) => setAdditionalCharge2(parseFloat(e.target.value) || 0)}
                  data-testid="input-calculator-charge-2"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="charge-3" className="text-xs">Add'l Charge 3</Label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <Input
                  id="charge-3"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-5 text-sm"
                  value={additionalCharge3 || ""}
                  onChange={(e) => setAdditionalCharge3(parseFloat(e.target.value) || 0)}
                  data-testid="input-calculator-charge-3"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground">Calculated Totals</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Monthly Total</p>
              <p className="text-2xl font-bold tabular-nums" data-testid="text-calculator-monthly">
                {formatCurrency(results.monthlyTotal)}
              </p>
              {results.additionalMonthly > 0 && (
                <p className="text-xs text-muted-foreground">
                  Base: {formatCurrency(results.baseMonthly)} + Add'l: {formatCurrency(results.additionalMonthly)}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Annual Total</p>
              <p className="text-2xl font-bold tabular-nums" data-testid="text-calculator-annual">
                {formatCurrency(results.annualTotal)}
              </p>
              <p className="text-xs text-muted-foreground">
                12 months
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
