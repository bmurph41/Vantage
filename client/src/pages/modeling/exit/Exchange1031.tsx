import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, RefreshCcw, ChevronRight, Download, Calendar, AlertCircle, CheckCircle } from "lucide-react";
import type { ModelingProject } from "@shared/schema";

interface Exchange1031Props {
  projectId: string;
}

export default function Exit1031Exchange({ projectId }: Exchange1031Props) {
  const [, setLocation] = useLocation();
  
  const { data: project } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
  });

  const basePath = `/modeling/projects/${projectId}/exit`;

  const [inputs, setInputs] = useState({
    relinquishedValue: project?.purchasePrice ? Number(project.purchasePrice) * 1.3 : 10000000,
    relinquishedBasis: project?.purchasePrice ? Number(project.purchasePrice) : 8000000,
    accumulatedDepreciation: 500000,
    existingDebt: 5000000,
    replacementValue: 12000000,
    replacementDebt: 7000000,
    closingCosts: 300000,
    daysIdentified: 35,
    daysClosed: 120
  });

  const adjustedBasis = inputs.relinquishedBasis - inputs.accumulatedDepreciation;
  const relinquishedEquity = inputs.relinquishedValue - inputs.existingDebt;
  const replacementEquity = inputs.replacementValue - inputs.replacementDebt;
  
  const bootCash = Math.max(0, relinquishedEquity - replacementEquity);
  const bootDebt = Math.max(0, inputs.existingDebt - inputs.replacementDebt);
  const totalBoot = bootCash + bootDebt;
  
  const deferredGain = inputs.relinquishedValue - adjustedBasis - totalBoot;
  const taxableGain = totalBoot;
  
  const newBasis = adjustedBasis + (replacementEquity - relinquishedEquity);
  
  const id45Progress = Math.min(100, (inputs.daysIdentified / 45) * 100);
  const id180Progress = Math.min(100, (inputs.daysClosed / 180) * 100);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <button onClick={() => setLocation(basePath)} className="hover:text-primary transition-colors">
              Exit Strategy
            </button>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">1031 Exchange</span>
          </div>
          <h1 className="text-3xl font-bold" data-testid="exchange-title">1031 Exchange Planner</h1>
          <p className="text-muted-foreground mt-1">
            Like-kind exchange analysis and timeline tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setLocation(basePath)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button variant="outline" data-testid="btn-export-exchange">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm text-muted-foreground">45-Day Identification</p>
                  <p className="text-2xl font-bold">{inputs.daysIdentified} / 45 days</p>
                </div>
              </div>
              {inputs.daysIdentified <= 45 ? (
                <CheckCircle className="h-6 w-6 text-green-500" />
              ) : (
                <AlertCircle className="h-6 w-6 text-red-500" />
              )}
            </div>
            <Progress value={id45Progress} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">180-Day Closing</p>
                  <p className="text-2xl font-bold">{inputs.daysClosed} / 180 days</p>
                </div>
              </div>
              {inputs.daysClosed <= 180 ? (
                <CheckCircle className="h-6 w-6 text-green-500" />
              ) : (
                <AlertCircle className="h-6 w-6 text-red-500" />
              )}
            </div>
            <Progress value={id180Progress} className="mt-3" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCcw className="h-5 w-5" />
              Exchange Inputs
            </CardTitle>
            <CardDescription>Enter property values and debt information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <h4 className="font-medium text-sm">Relinquished Property (Sold)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="relinquishedValue">Sale Price ($)</Label>
                <Input
                  id="relinquishedValue"
                  type="number"
                  value={inputs.relinquishedValue}
                  onChange={(e) => setInputs({ ...inputs, relinquishedValue: Number(e.target.value) })}
                  data-testid="input-relinquished-value"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="existingDebt">Existing Debt ($)</Label>
                <Input
                  id="existingDebt"
                  type="number"
                  value={inputs.existingDebt}
                  onChange={(e) => setInputs({ ...inputs, existingDebt: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="relinquishedBasis">Original Basis ($)</Label>
                <Input
                  id="relinquishedBasis"
                  type="number"
                  value={inputs.relinquishedBasis}
                  onChange={(e) => setInputs({ ...inputs, relinquishedBasis: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accumulatedDepreciation">Accumulated Depreciation ($)</Label>
                <Input
                  id="accumulatedDepreciation"
                  type="number"
                  value={inputs.accumulatedDepreciation}
                  onChange={(e) => setInputs({ ...inputs, accumulatedDepreciation: Number(e.target.value) })}
                />
              </div>
            </div>
            
            <Separator />
            <h4 className="font-medium text-sm">Replacement Property (Purchased)</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="replacementValue">Purchase Price ($)</Label>
                <Input
                  id="replacementValue"
                  type="number"
                  value={inputs.replacementValue}
                  onChange={(e) => setInputs({ ...inputs, replacementValue: Number(e.target.value) })}
                  data-testid="input-replacement-value"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="replacementDebt">New Debt ($)</Label>
                <Input
                  id="replacementDebt"
                  type="number"
                  value={inputs.replacementDebt}
                  onChange={(e) => setInputs({ ...inputs, replacementDebt: Number(e.target.value) })}
                />
              </div>
            </div>

            <Separator />
            <h4 className="font-medium text-sm">Timeline</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="daysIdentified">Days to Identification</Label>
                <Input
                  id="daysIdentified"
                  type="number"
                  value={inputs.daysIdentified}
                  onChange={(e) => setInputs({ ...inputs, daysIdentified: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="daysClosed">Days to Closing</Label>
                <Input
                  id="daysClosed"
                  type="number"
                  value={inputs.daysClosed}
                  onChange={(e) => setInputs({ ...inputs, daysClosed: Number(e.target.value) })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Exchange Analysis</CardTitle>
            <CardDescription>Boot calculation and tax deferral analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Equity Comparison</h4>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Relinquished Equity</span>
                <span className="font-medium">${relinquishedEquity.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Replacement Equity</span>
                <span className="font-medium">${replacementEquity.toLocaleString()}</span>
              </div>
              <Separator />
              
              <h4 className="font-medium text-sm">Boot Analysis</h4>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cash Boot</span>
                <span className={`font-medium ${bootCash > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  ${bootCash.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mortgage Boot</span>
                <span className={`font-medium ${bootDebt > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  ${bootDebt.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Total Boot (Taxable)</span>
                <span className={`font-bold ${totalBoot > 0 ? 'text-red-500' : 'text-green-500'}`} data-testid="text-total-boot">
                  ${totalBoot.toLocaleString()}
                </span>
              </div>
              <Separator />
              
              <h4 className="font-medium text-sm">Gain Analysis</h4>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Realized Gain</span>
                <span className="font-medium">${(inputs.relinquishedValue - adjustedBasis).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deferred Gain</span>
                <span className="font-medium text-green-600">${deferredGain.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recognized Gain (Taxable)</span>
                <span className="font-medium text-red-500">${taxableGain.toLocaleString()}</span>
              </div>
              <Separator />
              
              <div className="flex justify-between">
                <span className="font-semibold">New Basis in Replacement</span>
                <span className="font-bold" data-testid="text-new-basis">
                  ${newBasis.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Exchange Status</h4>
              <div className="flex flex-wrap gap-2">
                {totalBoot === 0 ? (
                  <Badge variant="default" className="bg-green-500">Full Tax Deferral</Badge>
                ) : (
                  <Badge variant="destructive">Partial Tax Deferral</Badge>
                )}
                {inputs.daysIdentified <= 45 && inputs.daysClosed <= 180 ? (
                  <Badge variant="default" className="bg-green-500">Timeline Compliant</Badge>
                ) : (
                  <Badge variant="destructive">Timeline Issues</Badge>
                )}
                {inputs.replacementValue >= inputs.relinquishedValue ? (
                  <Badge variant="outline">Trading Up</Badge>
                ) : (
                  <Badge variant="outline">Trading Down</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
