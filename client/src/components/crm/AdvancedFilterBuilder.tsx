import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Plus,
  X,
  Search,
  Save,
  Filter,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ── Types ──────────────────────────────────────────────────────────────

export interface FilterRule {
  field: string;
  operator: string;
  value: string;
  conjunction: "AND" | "OR";
}

export interface AdvancedFilterBuilderProps {
  onApply: (filters: FilterRule[]) => void;
  onSave?: (name: string, filters: FilterRule[]) => void;
  initialFilters?: FilterRule[];
  entityType?: "contact" | "company" | "property";
}

// ── Field Definitions ──────────────────────────────────────────────────

interface FieldDef {
  value: string;
  label: string;
  type: "text" | "number" | "date" | "select";
  options?: { value: string; label: string }[];
}

const CONTACT_FIELDS: FieldDef[] = [
  { value: "firstName", label: "First Name", type: "text" },
  { value: "lastName", label: "Last Name", type: "text" },
  { value: "email", label: "Email", type: "text" },
  { value: "company", label: "Company", type: "text" },
  { value: "city", label: "City", type: "text" },
  { value: "state", label: "State", type: "text" },
  { value: "contactTag", label: "Tag", type: "select", options: [
    { value: "lead", label: "Lead" },
    { value: "seller", label: "Seller" },
    { value: "competitor", label: "Competitor" },
    { value: "broker", label: "Broker" },
    { value: "vendor", label: "Vendor" },
    { value: "insurance", label: "Insurance" },
    { value: "lender", label: "Lender" },
    { value: "attorney", label: "Attorney" },
    { value: "other", label: "Other" },
  ]},
  { value: "leadScore", label: "Lead Score", type: "select", options: [
    { value: "hot", label: "Hot" },
    { value: "warm", label: "Warm" },
    { value: "cold", label: "Cold" },
    { value: "new", label: "New" },
  ]},
  { value: "createdAt", label: "Created Date", type: "date" },
  { value: "position", label: "Position", type: "text" },
  { value: "phone", label: "Phone", type: "text" },
];

const COMPANY_FIELDS: FieldDef[] = [
  { value: "name", label: "Company Name", type: "text" },
  { value: "industry", label: "Industry", type: "text" },
  { value: "city", label: "City", type: "text" },
  { value: "state", label: "State", type: "text" },
  { value: "size", label: "Size", type: "text" },
  { value: "annualRevenue", label: "Annual Revenue", type: "number" },
  { value: "acquisitionInterest", label: "Acquisition Interest", type: "select", options: [
    { value: "hot", label: "Hot" },
    { value: "warm", label: "Warm" },
    { value: "cold", label: "Cold" },
    { value: "none", label: "None" },
    { value: "unknown", label: "Unknown" },
  ]},
  { value: "isPortfolioCompany", label: "Portfolio Company", type: "select", options: [
    { value: "true", label: "Yes" },
    { value: "false", label: "No" },
  ]},
  { value: "createdAt", label: "Created Date", type: "date" },
  { value: "domain", label: "Domain", type: "text" },
];

const PROPERTY_FIELDS: FieldDef[] = [
  { value: "title", label: "Property Name", type: "text" },
  { value: "type", label: "Type", type: "select", options: [
    { value: "marina", label: "Marina" },
    { value: "boat", label: "Boat" },
    { value: "slip", label: "Slip" },
    { value: "dry_storage", label: "Dry Storage" },
  ]},
  { value: "status", label: "Status", type: "select", options: [
    { value: "available", label: "Available" },
    { value: "under_contract", label: "Under Contract" },
    { value: "sold", label: "Sold" },
    { value: "off_market", label: "Off Market" },
  ]},
  { value: "city", label: "City", type: "text" },
  { value: "state", label: "State", type: "text" },
  { value: "listingPrice", label: "Listing Price", type: "number" },
  { value: "annualRevenue", label: "Annual Revenue", type: "number" },
  { value: "wetSlips", label: "Wet Slips", type: "number" },
  { value: "occupancyRate", label: "Occupancy Rate", type: "number" },
  { value: "createdAt", label: "Created Date", type: "date" },
];

const FIELD_MAP: Record<string, FieldDef[]> = {
  contact: CONTACT_FIELDS,
  company: COMPANY_FIELDS,
  property: PROPERTY_FIELDS,
};

// ── Operator Definitions ───────────────────────────────────────────────

interface OperatorDef {
  value: string;
  label: string;
  needsValue: boolean;
}

const TEXT_OPERATORS: OperatorDef[] = [
  { value: "equals", label: "Equals", needsValue: true },
  { value: "not_equals", label: "Not Equals", needsValue: true },
  { value: "contains", label: "Contains", needsValue: true },
  { value: "starts_with", label: "Starts With", needsValue: true },
  { value: "is_empty", label: "Is Empty", needsValue: false },
  { value: "is_not_empty", label: "Is Not Empty", needsValue: false },
];

const NUMBER_OPERATORS: OperatorDef[] = [
  { value: "equals", label: "Equals", needsValue: true },
  { value: "not_equals", label: "Not Equals", needsValue: true },
  { value: "greater_than", label: "Greater Than", needsValue: true },
  { value: "less_than", label: "Less Than", needsValue: true },
  { value: "is_empty", label: "Is Empty", needsValue: false },
  { value: "is_not_empty", label: "Is Not Empty", needsValue: false },
];

const DATE_OPERATORS: OperatorDef[] = [
  { value: "equals", label: "On Date", needsValue: true },
  { value: "greater_than", label: "After", needsValue: true },
  { value: "less_than", label: "Before", needsValue: true },
  { value: "is_empty", label: "Is Empty", needsValue: false },
  { value: "is_not_empty", label: "Is Not Empty", needsValue: false },
];

const SELECT_OPERATORS: OperatorDef[] = [
  { value: "equals", label: "Is", needsValue: true },
  { value: "not_equals", label: "Is Not", needsValue: true },
  { value: "is_empty", label: "Is Empty", needsValue: false },
  { value: "is_not_empty", label: "Is Not Empty", needsValue: false },
];

function getOperators(fieldType: string): OperatorDef[] {
  switch (fieldType) {
    case "number": return NUMBER_OPERATORS;
    case "date": return DATE_OPERATORS;
    case "select": return SELECT_OPERATORS;
    default: return TEXT_OPERATORS;
  }
}

// ── Component ──────────────────────────────────────────────────────────

const DEFAULT_RULE: FilterRule = {
  field: "",
  operator: "contains",
  value: "",
  conjunction: "AND",
};

export function AdvancedFilterBuilder({
  onApply,
  onSave,
  initialFilters,
  entityType = "contact",
}: AdvancedFilterBuilderProps) {
  const [filters, setFilters] = useState<FilterRule[]>(
    initialFilters?.length ? initialFilters : [{ ...DEFAULT_RULE }]
  );
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [viewName, setViewName] = useState("");

  const fields = FIELD_MAP[entityType] || CONTACT_FIELDS;

  const getFieldDef = useCallback(
    (fieldValue: string) => fields.find((f) => f.value === fieldValue),
    [fields]
  );

  const updateFilter = (index: number, updates: Partial<FilterRule>) => {
    setFilters((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      // Reset operator and value when field changes
      if (updates.field && updates.field !== prev[index].field) {
        const fieldDef = getFieldDef(updates.field);
        const ops = getOperators(fieldDef?.type || "text");
        next[index].operator = ops[0].value;
        next[index].value = "";
      }
      return next;
    });
  };

  const addFilter = () => {
    setFilters((prev) => [...prev, { ...DEFAULT_RULE }]);
  };

  const removeFilter = (index: number) => {
    setFilters((prev) => {
      if (prev.length <= 1) return [{ ...DEFAULT_RULE }];
      return prev.filter((_, i) => i !== index);
    });
  };

  const resetFilters = () => {
    setFilters([{ ...DEFAULT_RULE }]);
  };

  const handleApply = () => {
    const validFilters = filters.filter((f) => {
      if (!f.field) return false;
      const fieldDef = getFieldDef(f.field);
      const ops = getOperators(fieldDef?.type || "text");
      const op = ops.find((o) => o.value === f.operator);
      if (op && !op.needsValue) return true;
      return f.value.trim() !== "";
    });
    onApply(validFilters);
  };

  const handleSave = () => {
    if (!viewName.trim() || !onSave) return;
    const validFilters = filters.filter((f) => f.field);
    onSave(viewName.trim(), validFilters);
    setShowSaveDialog(false);
    setViewName("");
  };

  const activeFilterCount = filters.filter((f) => f.field).length;

  return (
    <>
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Filter className="w-4 h-4 text-blue-600" />
              Advanced Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {activeFilterCount} active
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 text-xs gap-1">
                <RotateCcw className="w-3 h-3" /> Reset
              </Button>
              {onSave && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSaveDialog(true)}
                  disabled={activeFilterCount === 0}
                  className="h-7 text-xs gap-1"
                >
                  <Save className="w-3 h-3" /> Save View
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {filters.map((filter, index) => {
            const fieldDef = getFieldDef(filter.field);
            const operators = getOperators(fieldDef?.type || "text");
            const currentOp = operators.find((o) => o.value === filter.operator);
            const needsValue = currentOp?.needsValue !== false;

            return (
              <div key={index} className="flex items-center gap-2 flex-wrap">
                {/* Conjunction toggle (for rows after the first) */}
                {index > 0 && (
                  <Select
                    value={filter.conjunction}
                    onValueChange={(v) => updateFilter(index, { conjunction: v as "AND" | "OR" })}
                  >
                    <SelectTrigger className="w-[72px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND">AND</SelectItem>
                      <SelectItem value="OR">OR</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {index === 0 && <div className="w-[72px] flex-shrink-0 text-xs text-gray-500 font-medium pl-2">Where</div>}

                {/* Field selector */}
                <Select value={filter.field} onValueChange={(v) => updateFilter(index, { field: v })}>
                  <SelectTrigger className="w-[150px] h-8 text-xs">
                    <SelectValue placeholder="Select field..." />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Operator selector */}
                <Select
                  value={filter.operator}
                  onValueChange={(v) => updateFilter(index, { operator: v })}
                  disabled={!filter.field}
                >
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue placeholder="Operator..." />
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Value input */}
                {needsValue && filter.field && (
                  <>
                    {fieldDef?.type === "select" && fieldDef.options ? (
                      <Select value={filter.value} onValueChange={(v) => updateFilter(index, { value: v })}>
                        <SelectTrigger className="w-[150px] h-8 text-xs">
                          <SelectValue placeholder="Select value..." />
                        </SelectTrigger>
                        <SelectContent>
                          {fieldDef.options.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : fieldDef?.type === "date" ? (
                      <Input
                        type="date"
                        value={filter.value}
                        onChange={(e) => updateFilter(index, { value: e.target.value })}
                        className="w-[150px] h-8 text-xs"
                      />
                    ) : (
                      <Input
                        type={fieldDef?.type === "number" ? "number" : "text"}
                        placeholder="Value..."
                        value={filter.value}
                        onChange={(e) => updateFilter(index, { value: e.target.value })}
                        className="w-[150px] h-8 text-xs"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleApply();
                        }}
                      />
                    )}
                  </>
                )}

                {/* Remove button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-400 hover:text-red-500"
                  onClick={() => removeFilter(index)}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            );
          })}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2 border-t mt-3">
            <Button variant="outline" size="sm" onClick={addFilter} className="h-8 text-xs gap-1">
              <Plus className="w-3.5 h-3.5" /> Add Filter
            </Button>
            <div className="flex-1" />
            <Button size="sm" onClick={handleApply} className="h-8 text-xs gap-1">
              <Search className="w-3.5 h-3.5" /> Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save as View Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save as View</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="viewName">View Name</Label>
              <Input
                id="viewName"
                placeholder="e.g. Hot Leads in Florida"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
              />
            </div>
            <div className="text-xs text-gray-500">
              {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} will be saved with this view.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!viewName.trim()}>
              Save View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
