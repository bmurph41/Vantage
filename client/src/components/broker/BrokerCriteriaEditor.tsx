/**
 * BrokerCriteriaEditor
 *
 * Form for a broker to define the rule set that powers subscriber feedback.
 * Rendered inside BrokerProfileEditor. Persists via PATCH /api/broker-dashboard/my-profile
 * (the `criteria` field is in EDITABLE_PROFILE_FIELDS).
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BrokerCriteria, RiskTolerance } from "@shared/broker/criteria";

interface Props {
  value: BrokerCriteria | null | undefined;
  onChange: (next: BrokerCriteria) => void;
}

const ASSET_CLASS_OPTIONS = [
  "marina",
  "multifamily",
  "industrial",
  "office",
  "retail",
  "hotel",
  "self_storage",
  "mobile_home_park",
  "data_center",
  "medical_office",
];

export function BrokerCriteriaEditor({ value, onChange }: Props) {
  const [criteria, setCriteria] = useState<BrokerCriteria>(value || {});

  useEffect(() => {
    if (value) setCriteria(value);
  }, [JSON.stringify(value || {})]);

  const update = (patch: Partial<BrokerCriteria>) => {
    const next = { ...criteria, ...patch };
    setCriteria(next);
    onChange(next);
  };

  const toggleAssetClass = (ac: string) => {
    const current = new Set(criteria.assetClasses || []);
    if (current.has(ac)) current.delete(ac);
    else current.add(ac);
    update({ assetClasses: Array.from(current) });
  };

  const num = (v: string): number | undefined => {
    if (v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recommendation Criteria</CardTitle>
        <p className="text-xs text-muted-foreground">
          Define the rules your subscribers will see applied when you evaluate a deal or modeling
          project. Leave a field blank to ignore it.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Label>Asset class focus</Label>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {ASSET_CLASS_OPTIONS.map((ac) => {
              const active = criteria.assetClasses?.includes(ac);
              return (
                <button
                  key={ac}
                  type="button"
                  onClick={() => toggleAssetClass(ac)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    active
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                  }`}
                >
                  {ac.replace(/_/g, " ")}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label>Markets (US state codes, comma-separated)</Label>
          <Input
            placeholder="FL, TX, NC"
            value={(criteria.markets || []).join(", ")}
            onChange={(e) =>
              update({
                markets: e.target.value
                  .split(",")
                  .map((s) => s.trim().toUpperCase())
                  .filter(Boolean),
              })
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Cap rate floor (%)</Label>
            <Input
              type="number"
              step="0.1"
              value={criteria.capRateMin ?? ""}
              onChange={(e) => update({ capRateMin: num(e.target.value) })}
            />
          </div>
          <div>
            <Label>DSCR floor (x)</Label>
            <Input
              type="number"
              step="0.05"
              value={criteria.dscrMin ?? ""}
              onChange={(e) => update({ dscrMin: num(e.target.value) })}
            />
          </div>
          <div>
            <Label>LTV ceiling (%)</Label>
            <Input
              type="number"
              step="1"
              value={criteria.ltvMax ?? ""}
              onChange={(e) => update({ ltvMax: num(e.target.value) })}
            />
          </div>
          <div>
            <Label>IRR target (%)</Label>
            <Input
              type="number"
              step="0.5"
              value={criteria.irrTarget ?? ""}
              onChange={(e) => update({ irrTarget: num(e.target.value) })}
            />
          </div>
          <div>
            <Label>Hold min (yrs)</Label>
            <Input
              type="number"
              step="1"
              value={criteria.holdPeriodMinYears ?? ""}
              onChange={(e) => update({ holdPeriodMinYears: num(e.target.value) })}
            />
          </div>
          <div>
            <Label>Hold max (yrs)</Label>
            <Input
              type="number"
              step="1"
              value={criteria.holdPeriodMaxYears ?? ""}
              onChange={(e) => update({ holdPeriodMaxYears: num(e.target.value) })}
            />
          </div>
          <div>
            <Label>Deal size min ($)</Label>
            <Input
              type="number"
              step="100000"
              value={criteria.dealSizeMin ?? ""}
              onChange={(e) => update({ dealSizeMin: num(e.target.value) })}
            />
          </div>
          <div>
            <Label>Deal size max ($)</Label>
            <Input
              type="number"
              step="100000"
              value={criteria.dealSizeMax ?? ""}
              onChange={(e) => update({ dealSizeMax: num(e.target.value) })}
            />
          </div>
        </div>

        <div>
          <Label>Risk tolerance</Label>
          <Select
            value={criteria.riskTolerance || ""}
            onValueChange={(v) => update({ riskTolerance: (v || undefined) as RiskTolerance })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="core">Core</SelectItem>
              <SelectItem value="core_plus">Core+</SelectItem>
              <SelectItem value="value_add">Value-Add</SelectItem>
              <SelectItem value="opportunistic">Opportunistic</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Market outlook narrative</Label>
          <Textarea
            rows={4}
            placeholder="How you're thinking about the market over the next 12-24 months. This feeds your AI-generated subscriber notes."
            value={criteria.outlookNarrative || ""}
            onChange={(e) => update({ outlookNarrative: e.target.value })}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default BrokerCriteriaEditor;
