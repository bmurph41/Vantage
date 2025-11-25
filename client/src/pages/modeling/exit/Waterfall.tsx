import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, BarChart3, ChevronRight, Download, Plus, Trash2 } from "lucide-react";
import type { ModelingProject } from "@shared/schema";

interface WaterfallProps {
  projectId: string;
}

export default function ExitWaterfall({ projectId }: WaterfallProps) {
  const [, setLocation] = useLocation();
  
  const { data: project } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
  });

  const basePath = `/modeling/projects/${projectId}/exit`;

  const [inputs, setInputs] = useState({
    totalDistribution: 15000000,
    totalContributed: 10000000,
    waterfallType: 'american' as 'american' | 'european',
    preferredReturn: 8,
    catchUp: 100,
    carriedInterest: 20
  });

  const [investors, setInvestors] = useState([
    { id: 1, name: "Limited Partners", contribution: 8000000, isGP: false },
    { id: 2, name: "General Partner", contribution: 2000000, isGP: true },
  ]);

  const addInvestor = () => {
    const newId = Math.max(...investors.map(i => i.id)) + 1;
    setInvestors([...investors, {
      id: newId,
      name: `Investor ${newId}`,
      contribution: 1000000,
      isGP: false
    }]);
  };

  const removeInvestor = (id: number) => {
    setInvestors(investors.filter(i => i.id !== id));
  };

  const totalContributed = investors.reduce((sum, i) => sum + i.contribution, 0);
  const lpContribution = investors.filter(i => !i.isGP).reduce((sum, i) => sum + i.contribution, 0);
  const gpContribution = investors.filter(i => i.isGP).reduce((sum, i) => sum + i.contribution, 0);

  const calculateWaterfall = () => {
    let remaining = inputs.totalDistribution;
    const result = {
      returnOfCapital: 0,
      preferredReturn: 0,
      gpCatchUp: 0,
      lpCarriedInterest: 0,
      gpCarriedInterest: 0,
      lpTotal: 0,
      gpTotal: 0
    };

    result.returnOfCapital = Math.min(remaining, totalContributed);
    remaining -= result.returnOfCapital;

    const prefReturnAmount = totalContributed * (inputs.preferredReturn / 100);
    result.preferredReturn = Math.min(remaining, prefReturnAmount);
    remaining -= result.preferredReturn;

    if (inputs.catchUp > 0 && remaining > 0) {
      const targetCatchUp = (result.preferredReturn * inputs.carriedInterest) / (100 - inputs.carriedInterest);
      result.gpCatchUp = Math.min(remaining, targetCatchUp * (inputs.catchUp / 100));
      remaining -= result.gpCatchUp;
    }

    if (remaining > 0) {
      result.gpCarriedInterest = remaining * (inputs.carriedInterest / 100);
      result.lpCarriedInterest = remaining * (1 - inputs.carriedInterest / 100);
    }

    const lpShare = lpContribution / totalContributed;
    const gpShare = gpContribution / totalContributed;

    result.lpTotal = (result.returnOfCapital * lpShare) + 
                     (result.preferredReturn * lpShare) + 
                     result.lpCarriedInterest;
    result.gpTotal = (result.returnOfCapital * gpShare) + 
                     (result.preferredReturn * gpShare) + 
                     result.gpCatchUp + 
                     result.gpCarriedInterest;

    return result;
  };

  const waterfall = calculateWaterfall();
  const lpMOIC = lpContribution > 0 ? waterfall.lpTotal / lpContribution : 0;
  const gpMOIC = gpContribution > 0 ? waterfall.gpTotal / gpContribution : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <button onClick={() => setLocation(basePath)} className="hover:text-primary transition-colors">
              Exit Strategy
            </button>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">Waterfall Analysis</span>
          </div>
          <h1 className="text-3xl font-bold" data-testid="waterfall-title">Waterfall Analysis</h1>
          <p className="text-muted-foreground mt-1">
            Fund distribution modeling with GP/LP splits
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setLocation(basePath)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button variant="outline" data-testid="btn-export-waterfall">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Waterfall Structure
            </CardTitle>
            <CardDescription>Configure distribution parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="totalDistribution">Total Distribution ($)</Label>
                <Input
                  id="totalDistribution"
                  type="number"
                  value={inputs.totalDistribution}
                  onChange={(e) => setInputs({ ...inputs, totalDistribution: Number(e.target.value) })}
                  data-testid="input-total-distribution"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waterfallType">Waterfall Type</Label>
                <Select 
                  value={inputs.waterfallType}
                  onValueChange={(value: 'american' | 'european') => setInputs({ ...inputs, waterfallType: value })}
                >
                  <SelectTrigger data-testid="select-waterfall-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="american">American (Deal-by-Deal)</SelectItem>
                    <SelectItem value="european">European (Whole Fund)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredReturn">Preferred Return (%)</Label>
                <Input
                  id="preferredReturn"
                  type="number"
                  step="0.1"
                  value={inputs.preferredReturn}
                  onChange={(e) => setInputs({ ...inputs, preferredReturn: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catchUp">GP Catch-up (%)</Label>
                <Input
                  id="catchUp"
                  type="number"
                  value={inputs.catchUp}
                  onChange={(e) => setInputs({ ...inputs, catchUp: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="carriedInterest">Carried Interest (%)</Label>
                <Input
                  id="carriedInterest"
                  type="number"
                  value={inputs.carriedInterest}
                  onChange={(e) => setInputs({ ...inputs, carriedInterest: Number(e.target.value) })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Investors</CardTitle>
              <CardDescription>LP and GP capital contributions</CardDescription>
            </div>
            <Button onClick={addInvestor} size="sm" data-testid="btn-add-investor">
              <Plus className="h-4 w-4 mr-2" />
              Add Investor
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {investors.map((investor) => (
                <div key={investor.id} className="flex items-center gap-3" data-testid={`investor-${investor.id}`}>
                  <Input
                    value={investor.name}
                    onChange={(e) => setInvestors(investors.map(i => 
                      i.id === investor.id ? { ...i, name: e.target.value } : i
                    ))}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={investor.contribution}
                    onChange={(e) => setInvestors(investors.map(i => 
                      i.id === investor.id ? { ...i, contribution: Number(e.target.value) } : i
                    ))}
                    className="w-32"
                  />
                  <Badge variant={investor.isGP ? "default" : "secondary"}>
                    {investor.isGP ? "GP" : "LP"}
                  </Badge>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => removeInvestor(investor.id)}
                    className="text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Contributed</span>
                <span className="font-medium">${totalContributed.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Waterfall Distribution</CardTitle>
          <CardDescription>Step-by-step distribution breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">1. Return of Capital</p>
                <p className="text-xl font-bold">${waterfall.returnOfCapital.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">2. Preferred Return</p>
                <p className="text-xl font-bold">${waterfall.preferredReturn.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">3. GP Catch-up</p>
                <p className="text-xl font-bold text-purple-600">${waterfall.gpCatchUp.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">4. Carried Interest Split</p>
                <p className="text-xl font-bold text-green-600">
                  ${(waterfall.lpCarriedInterest + waterfall.gpCarriedInterest).toLocaleString()}
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-6">
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-3">LP Returns</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Capital Returned</span>
                    <span>${(waterfall.returnOfCapital * (lpContribution / totalContributed)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Preferred Return</span>
                    <span>${(waterfall.preferredReturn * (lpContribution / totalContributed)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Profit Share</span>
                    <span>${waterfall.lpCarriedInterest.toLocaleString()}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Total LP Distribution</span>
                    <span className="text-green-600" data-testid="text-lp-total">${waterfall.lpTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">LP MOIC</span>
                    <span className="font-medium">{lpMOIC.toFixed(2)}x</span>
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-3">GP Returns</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Capital Returned</span>
                    <span>${(waterfall.returnOfCapital * (gpContribution / totalContributed)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Preferred Return</span>
                    <span>${(waterfall.preferredReturn * (gpContribution / totalContributed)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Catch-up</span>
                    <span>${waterfall.gpCatchUp.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Carried Interest</span>
                    <span>${waterfall.gpCarriedInterest.toLocaleString()}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Total GP Distribution</span>
                    <span className="text-purple-600" data-testid="text-gp-total">${waterfall.gpTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GP MOIC</span>
                    <span className="font-medium">{gpMOIC.toFixed(2)}x</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
