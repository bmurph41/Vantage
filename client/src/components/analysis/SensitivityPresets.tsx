import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingDown, TrendingUp, Percent, Building2, Zap, ShieldAlert,
  ChevronRight
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface SensitivityVariable {
  name: string;
  delta: number[];
}

interface Preset {
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  variables: SensitivityVariable[];
}

const PRESETS: Preset[] = [
  {
    name: "Cap Rate Stress",
    description: "Test valuation sensitivity to exit cap rate changes across a +/-1% range",
    icon: TrendingDown,
    color: "text-red-600",
    bgColor: "bg-red-50",
    variables: [
      { name: "Exit Cap Rate", delta: [-1, -0.5, 0, 0.5, 1] },
    ],
  },
  {
    name: "Revenue Volatility",
    description: "Model revenue growth swings from -5% to +5% against the base case",
    icon: TrendingUp,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    variables: [
      { name: "Revenue Growth", delta: [-5, -2.5, 0, 2.5, 5] },
    ],
  },
  {
    name: "Interest Rate Shock",
    description: "Assess debt service impact from a +/-1% rate movement",
    icon: Percent,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    variables: [
      { name: "Interest Rate", delta: [-1, -0.5, 0, 0.5, 1] },
    ],
  },
  {
    name: "Occupancy Scenarios",
    description: "Evaluate NOI under occupancy variations of +/-10 percentage points",
    icon: Building2,
    color: "text-teal-600",
    bgColor: "bg-teal-50",
    variables: [
      { name: "Occupancy Rate", delta: [-10, -5, 0, 5, 10] },
    ],
  },
  {
    name: "Full Downside",
    description: "Worst-case composite: cap rate expansion, revenue decline, and occupancy drop simultaneously",
    icon: ShieldAlert,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    variables: [
      { name: "Exit Cap Rate", delta: [0, 0.5, 1] },
      { name: "Revenue Growth", delta: [0, -2.5, -5] },
      { name: "Occupancy Rate", delta: [0, -5, -10] },
    ],
  },
];

interface SensitivityPresetsProps {
  onApply: (variables: SensitivityVariable[]) => void;
}

export default function SensitivityPresets({ onApply }: SensitivityPresetsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-500" />
          Quick Presets
        </CardTitle>
        <CardDescription>
          One-click scenario presets to populate the sensitivity analysis with common stress tests
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRESETS.map((preset) => {
            const Icon = preset.icon;
            const totalVariables = preset.variables.length;
            const totalScenarios = preset.variables.reduce(
              (sum, v) => sum + v.delta.length,
              0
            );

            return (
              <div
                key={preset.name}
                className={`group relative rounded-xl border p-4 transition-all hover:shadow-md hover:border-primary/30 cursor-pointer ${preset.bgColor}`}
                onClick={() => onApply(preset.variables)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-lg bg-white/80 shadow-sm ${preset.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                      {totalVariables} var{totalVariables !== 1 ? "s" : ""}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 h-5">
                      {totalScenarios} pts
                    </Badge>
                  </div>
                </div>

                <h4 className="font-semibold text-sm mb-1">{preset.name}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  {preset.description}
                </p>

                {/* Variable list */}
                <div className="space-y-1 mb-3">
                  {preset.variables.map((v) => (
                    <div
                      key={v.name}
                      className="flex items-center justify-between text-[11px] px-2 py-1 rounded bg-white/60"
                    >
                      <span className="font-medium text-gray-700">{v.name}</span>
                      <span className="text-gray-500">
                        {v.delta[0] > 0 ? "+" : ""}
                        {v.delta[0]} to {v.delta[v.delta.length - 1] > 0 ? "+" : ""}
                        {v.delta[v.delta.length - 1]}
                      </span>
                    </div>
                  ))}
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full h-8 text-xs group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onApply(preset.variables);
                  }}
                >
                  Apply Preset
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
