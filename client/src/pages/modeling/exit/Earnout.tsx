import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Award, ChevronRight, Download, Plus, Trash2 } from "lucide-react";
import type { ModelingProject } from "@shared/schema";

interface EarnoutProps {
  projectId: string;
}

export default function ExitEarnout({ projectId }: EarnoutProps) {
  const [, setLocation] = useLocation();
  
  const { data: project } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
  });

  const basePath = `/modeling/projects/${projectId}/exit`;

  const [basePrice, setBasePrice] = useState(project?.purchasePrice ? Number(project.purchasePrice) : 8000000);
  const [earnouts, setEarnouts] = useState([
    { id: 1, name: "Year 1 EBITDA Target", targetAmount: 1000000, metric: "EBITDA", threshold: 1500000, probability: 80 },
    { id: 2, name: "Year 2 Revenue Target", targetAmount: 500000, metric: "Revenue", threshold: 5000000, probability: 60 },
    { id: 3, name: "Customer Retention Bonus", targetAmount: 250000, metric: "Retention", threshold: 90, probability: 70 },
  ]);

  const addEarnout = () => {
    const newId = Math.max(...earnouts.map(e => e.id)) + 1;
    setEarnouts([...earnouts, {
      id: newId,
      name: `Earnout ${newId}`,
      targetAmount: 500000,
      metric: "EBITDA",
      threshold: 1000000,
      probability: 50
    }]);
  };

  const removeEarnout = (id: number) => {
    setEarnouts(earnouts.filter(e => e.id !== id));
  };

  const updateEarnout = (id: number, field: string, value: number | string) => {
    setEarnouts(earnouts.map(e => 
      e.id === id ? { ...e, [field]: value } : e
    ));
  };

  const totalMaxEarnout = earnouts.reduce((sum, e) => sum + e.targetAmount, 0);
  const probabilityWeightedEarnout = earnouts.reduce((sum, e) => sum + (e.targetAmount * (e.probability / 100)), 0);
  const totalExpectedValue = basePrice + probabilityWeightedEarnout;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <button onClick={() => setLocation(basePath)} className="hover:text-primary transition-colors">
              Exit Strategy
            </button>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">Earnout Modeling</span>
          </div>
          <h1 className="text-3xl font-bold" data-testid="earnout-title">Earnout Modeling</h1>
          <p className="text-muted-foreground mt-1">
            Contingent payment structures with probability weighting
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setLocation(basePath)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button variant="outline" data-testid="btn-export-earnout">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Base Purchase Price</p>
            <p className="text-2xl font-bold" data-testid="text-base-price">
              ${basePrice.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Max Total Earnout</p>
            <p className="text-2xl font-bold text-blue-600">
              ${totalMaxEarnout.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Probability-Weighted</p>
            <p className="text-2xl font-bold text-purple-600">
              ${probabilityWeightedEarnout.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Expected Total Value</p>
            <p className="text-2xl font-bold text-green-600" data-testid="text-expected-value">
              ${totalExpectedValue.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Base Price
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <Label htmlFor="basePrice">Base Purchase Price ($)</Label>
            <Input
              id="basePrice"
              type="number"
              value={basePrice}
              onChange={(e) => setBasePrice(Number(e.target.value))}
              className="mt-2"
              data-testid="input-base-price"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Earnout Tranches</CardTitle>
            <CardDescription>Define contingent payment structures</CardDescription>
          </div>
          <Button onClick={addEarnout} size="sm" data-testid="btn-add-earnout">
            <Plus className="h-4 w-4 mr-2" />
            Add Earnout
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {earnouts.map((earnout) => (
              <div key={earnout.id} className="border rounded-lg p-4" data-testid={`earnout-${earnout.id}`}>
                <div className="flex items-center justify-between mb-4">
                  <Input
                    value={earnout.name}
                    onChange={(e) => updateEarnout(earnout.id, 'name', e.target.value)}
                    className="max-w-xs font-medium"
                  />
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => removeEarnout(earnout.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Target Amount ($)</Label>
                    <Input
                      type="number"
                      value={earnout.targetAmount}
                      onChange={(e) => updateEarnout(earnout.id, 'targetAmount', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Metric</Label>
                    <Input
                      value={earnout.metric}
                      onChange={(e) => updateEarnout(earnout.id, 'metric', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Threshold</Label>
                    <Input
                      type="number"
                      value={earnout.threshold}
                      onChange={(e) => updateEarnout(earnout.id, 'threshold', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Probability (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={earnout.probability}
                      onChange={(e) => updateEarnout(earnout.id, 'probability', Number(e.target.value))}
                    />
                  </div>
                </div>
                
                <Separator className="my-4" />
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Expected Value</span>
                  <span className="font-medium text-purple-600">
                    ${(earnout.targetAmount * (earnout.probability / 100)).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Earnout Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Earnout</th>
                  <th className="text-right py-2 px-4">Max Amount</th>
                  <th className="text-right py-2 px-4">Probability</th>
                  <th className="text-right py-2 px-4">Expected Value</th>
                </tr>
              </thead>
              <tbody>
                {earnouts.map((earnout) => (
                  <tr key={earnout.id} className="border-b">
                    <td className="py-2 px-4">{earnout.name}</td>
                    <td className="text-right py-2 px-4">${earnout.targetAmount.toLocaleString()}</td>
                    <td className="text-right py-2 px-4">{earnout.probability}%</td>
                    <td className="text-right py-2 px-4 text-purple-600">
                      ${(earnout.targetAmount * (earnout.probability / 100)).toLocaleString()}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold bg-muted">
                  <td className="py-2 px-4">Total</td>
                  <td className="text-right py-2 px-4">${totalMaxEarnout.toLocaleString()}</td>
                  <td className="text-right py-2 px-4">-</td>
                  <td className="text-right py-2 px-4 text-purple-600">
                    ${probabilityWeightedEarnout.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
