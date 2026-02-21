/**
 * DealDetailPanel
 * 
 * Institutional-grade 3-panel deal detail view designed for PE workflows.
 * Replaces the basic ~35-line deal section in detail-drawer.tsx with a
 * comprehensive layout:
 * 
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  Asset Class Badge  |  Deal Name  |  Stage Tracker          │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │  [ Cap Rate ] [ NOI ] [ Rev/Slip ] [ Occupancy ]  ← KPIs   │
 *   ├─────────────────┬──────────────────┬─────────────────────────┤
 *   │                 │                  │                         │
 *   │  Deal Fields    │  Activity        │  Documents              │
 *   │  (asset-class   │  Timeline +      │  + Relationships        │
 *   │   aware)        │  Composer        │  + Linked Entities      │
 *   │                 │                  │                         │
 *   └─────────────────┴──────────────────┴─────────────────────────┘
 * 
 * On narrower drawers, collapses to tabbed layout.
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  DollarSign, Edit3, Save, X, ExternalLink, Building2, User,
  MoreHorizontal, Copy, Trash2, ArrowUpRight, Link2, ChevronRight,
  Loader2, Settings2, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger
} from "@/components/ui/collapsible";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Deal, Contact, Company } from "@shared/schema";

// Sub-components
import { DealStageTracker } from "./deal-stage-tracker";
import { DealFinancialKPIs } from "./deal-financial-kpis";
import { DealActivityTimeline } from "./deal-activity-timeline";
import { DealDocumentsPanel } from "./deal-documents-panel";
import { 
  getAssetClassConfig, ASSET_CLASS_OPTIONS, 
  type AssetClass, type FieldDefinition, type AssetClassConfig 
} from "./asset-class-fields";

// ─── Types ────────────────────────────────────────────────────────

interface DealDetailPanelProps {
  deal: Deal;
  onClose?: () => void;
  isEditing: boolean;
  onEditToggle: (editing: boolean) => void;
  editData: Record<string, any>;
  setEditData: (data: Record<string, any>) => void;
  onSave: () => void;
  isSaving?: boolean;
  relatedContact?: Contact | null;
  relatedCompany?: Company | null;
  /** Width hint - when narrow, use tabbed layout instead of columns */
  layoutMode?: "wide" | "narrow" | "auto";
}

// ─── Component ────────────────────────────────────────────────────

export function DealDetailPanel({
  deal,
  onClose,
  isEditing,
  onEditToggle,
  editData,
  setEditData,
  onSave,
  isSaving,
  relatedContact,
  relatedCompany,
  layoutMode = "auto",
}: DealDetailPanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("details");
  
  const assetClass = (editData.assetClass || editData.asset_class || (deal as any).assetClass || (deal as any).asset_class || "marina") as string;
  const config = getAssetClassConfig(assetClass);

  // Determine layout based on mode
  const useColumns = layoutMode === "wide" || (layoutMode === "auto" && typeof window !== "undefined" && window.innerWidth > 900);

  // ─── Field Update Helper ────────────────────────────────────────

  const updateField = (key: string, value: any) => {
    setEditData({ ...editData, [key]: value });
  };

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ─── Header: Asset Class + Actions ───────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className={cn("text-[10px] font-semibold gap-1 px-2 py-0.5", config.color, config.textColor)}>
            {(() => { const Icon = config.icon; return <Icon className="h-3 w-3" />; })()}
            {config.label}
          </Badge>
          {isEditing && (
            <Select 
              value={assetClass} 
              onValueChange={(v) => updateField("assetClass", v)}
            >
              <SelectTrigger className="h-6 w-auto text-[10px] border-dashed">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSET_CLASS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {deal.id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                    <a href={`/crm/deals/${deal.id}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open full page</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem className="gap-2 text-xs" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/crm/deals/${deal.id}`)}>
                <Copy className="h-3 w-3" /> Copy Link
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-xs" asChild>
                <a href={`/crm/deals/${deal.id}/om`}>
                  <Sparkles className="h-3 w-3" /> Generate OM
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-xs text-red-600">
                <Trash2 className="h-3 w-3" /> Delete Deal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ─── Stage Tracker ───────────────────────────────────────── */}
      <DealStageTracker deal={deal} readOnly={false} />

      {/* ─── Financial KPIs ──────────────────────────────────────── */}
      <DealFinancialKPIs deal={deal} />

      {/* ─── Separator ───────────────────────────────────────────── */}
      <Separator />

      {/* ─── Main Content: Columns or Tabs ───────────────────────── */}
      {useColumns ? (
        <ColumnsLayout
          deal={deal}
          config={config}
          isEditing={isEditing}
          editData={editData}
          updateField={updateField}
          relatedContact={relatedContact}
          relatedCompany={relatedCompany}
        />
      ) : (
        <TabbedLayout
          deal={deal}
          config={config}
          isEditing={isEditing}
          editData={editData}
          updateField={updateField}
          relatedContact={relatedContact}
          relatedCompany={relatedCompany}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      )}
    </div>
  );
}

// ─── Columns Layout (Wide Drawers) ────────────────────────────────

function ColumnsLayout({
  deal, config, isEditing, editData, updateField, relatedContact, relatedCompany
}: {
  deal: Deal;
  config: AssetClassConfig;
  isEditing: boolean;
  editData: Record<string, any>;
  updateField: (key: string, value: any) => void;
  relatedContact?: Contact | null;
  relatedCompany?: Company | null;
}) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Left: Fields + Relationships */}
      <div className="col-span-1 space-y-3">
        <AssetClassFieldGroups 
          deal={deal}
          config={config}
          isEditing={isEditing}
          editData={editData}
          updateField={updateField}
        />
        <RelationshipsSection 
          deal={deal}
          relatedContact={relatedContact}
          relatedCompany={relatedCompany}
        />
      </div>

      {/* Center: Activity Timeline */}
      <div className="col-span-1">
        <DealActivityTimeline 
          dealId={deal.id}
          maxHeight="500px"
          showComposer={true}
        />
      </div>

      {/* Right: Documents */}
      <div className="col-span-1">
        <DealDocumentsPanel 
          dealId={deal.id}
          maxHeight="500px"
        />
      </div>
    </div>
  );
}

// ─── Tabbed Layout (Narrow Drawers / Default) ─────────────────────

function TabbedLayout({
  deal, config, isEditing, editData, updateField, relatedContact, relatedCompany,
  activeTab, setActiveTab
}: {
  deal: Deal;
  config: AssetClassConfig;
  isEditing: boolean;
  editData: Record<string, any>;
  updateField: (key: string, value: any) => void;
  relatedContact?: Contact | null;
  relatedCompany?: Company | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}) {
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="w-full grid grid-cols-4 h-8">
        <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
        <TabsTrigger value="activity" className="text-xs">Activity</TabsTrigger>
        <TabsTrigger value="documents" className="text-xs">Docs</TabsTrigger>
        <TabsTrigger value="relationships" className="text-xs">Related</TabsTrigger>
      </TabsList>

      <TabsContent value="details" className="mt-3 space-y-3">
        <AssetClassFieldGroups 
          deal={deal}
          config={config}
          isEditing={isEditing}
          editData={editData}
          updateField={updateField}
        />
      </TabsContent>

      <TabsContent value="activity" className="mt-3">
        <DealActivityTimeline 
          dealId={deal.id}
          maxHeight="500px"
          showComposer={true}
        />
      </TabsContent>

      <TabsContent value="documents" className="mt-3">
        <DealDocumentsPanel 
          dealId={deal.id}
          maxHeight="500px"
        />
      </TabsContent>

      <TabsContent value="relationships" className="mt-3">
        <RelationshipsSection 
          deal={deal}
          relatedContact={relatedContact}
          relatedCompany={relatedCompany}
        />
      </TabsContent>
    </Tabs>
  );
}

// ─── Asset-Class-Aware Field Groups ───────────────────────────────

function AssetClassFieldGroups({
  deal, config, isEditing, editData, updateField
}: {
  deal: Deal;
  config: AssetClassConfig;
  isEditing: boolean;
  editData: Record<string, any>;
  updateField: (key: string, value: any) => void;
}) {
  return (
    <div className="space-y-2">
      {config.fieldGroups.map(group => {
        const groupFields = config.fields.filter(f => f.group === group.key);
        if (groupFields.length === 0) return null;

        const Icon = group.icon;

        return (
          <Collapsible key={group.key} defaultOpen={group.defaultOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-1.5 px-0.5 hover:bg-muted/30 rounded transition-colors group">
              <ChevronRight className="h-3 w-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">{group.label}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {groupFields.filter(f => getFieldValue(deal, editData, f.key) != null).length}/{groupFields.length}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-0 pl-5 pt-1">
                {groupFields.map(field => (
                  <FieldRow
                    key={field.key}
                    field={field}
                    deal={deal}
                    isEditing={isEditing}
                    editData={editData}
                    updateField={updateField}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

// ─── Individual Field Row ─────────────────────────────────────────

function FieldRow({
  field, deal, isEditing, editData, updateField
}: {
  field: FieldDefinition;
  deal: Deal;
  isEditing: boolean;
  editData: Record<string, any>;
  updateField: (key: string, value: any) => void;
}) {
  const value = getFieldValue(deal, editData, field.key);
  const displayValue = formatFieldValue(value, field);

  return (
    <div className="flex items-center justify-between py-1 min-h-[28px] group">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{field.label}</span>
        {field.tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-[10px] text-muted-foreground/50 cursor-help">ⓘ</span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[200px]">
                {field.tooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {isEditing ? (
        <div className="max-w-[140px]">
          <FieldInput field={field} value={editData[field.key] ?? value ?? ""} onChange={(v) => updateField(field.key, v)} />
        </div>
      ) : (
        <span className={cn(
          "text-xs font-medium text-right",
          value != null ? "text-foreground" : "text-muted-foreground"
        )}>
          {displayValue}
          {field.suffix && value != null && <span className="text-muted-foreground ml-0.5">{field.suffix}</span>}
        </span>
      )}
    </div>
  );
}

// ─── Field Input (Edit Mode) ──────────────────────────────────────

function FieldInput({ 
  field, value, onChange 
}: { 
  field: FieldDefinition; 
  value: any; 
  onChange: (v: any) => void 
}) {
  switch (field.type) {
    case "currency":
      return (
        <Input
          type="number"
          value={value || ""}
          onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : null)}
          placeholder="$0"
          className="h-7 text-xs text-right"
        />
      );
    case "number":
      return (
        <Input
          type="number"
          value={value || ""}
          onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : null)}
          className="h-7 text-xs text-right"
        />
      );
    case "percent":
      return (
        <Input
          type="number"
          step="0.1"
          value={value || ""}
          onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : null)}
          placeholder="0.0%"
          className="h-7 text-xs text-right"
        />
      );
    case "select":
      return (
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "date":
      return (
        <Input
          type="date"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 text-xs"
        />
      );
    case "textarea":
      return (
        <Textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="text-xs resize-none"
        />
      );
    default:
      return (
        <Input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="h-7 text-xs"
        />
      );
  }
}

// ─── Relationships Section ────────────────────────────────────────

function RelationshipsSection({
  deal, relatedContact, relatedCompany
}: {
  deal: Deal;
  relatedContact?: Contact | null;
  relatedCompany?: Company | null;
}) {
  // Fetch associated entities
  const { data: associations } = useQuery<any[]>({
    queryKey: [`/api/crm/associations?entityType=deal&entityId=${deal.id}`],
    enabled: !!deal.id,
  });

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
        Relationships
      </h4>

      <div className="space-y-1.5">
        {/* Primary Contact */}
        {relatedContact && (
          <RelationshipCard
            type="contact"
            name={`${relatedContact.firstName || ""} ${relatedContact.lastName || ""}`.trim() || relatedContact.name || "Contact"}
            subtitle={relatedContact.email || relatedContact.title || ""}
            role="Primary Contact"
            href={`/crm/contacts/${relatedContact.id}`}
          />
        )}

        {/* Primary Company */}
        {relatedCompany && (
          <RelationshipCard
            type="company"
            name={relatedCompany.name || "Company"}
            subtitle={relatedCompany.industry || ""}
            role="Company"
            href={`/crm/companies/${relatedCompany.id}`}
          />
        )}

        {/* Associated Property */}
        {(deal as any).propertyId && (
          <RelationshipCard
            type="property"
            name={(deal as any).propertyName || "Property"}
            subtitle={(deal as any).propertyAddress || ""}
            role="Subject Property"
            href={`/crm/properties/${(deal as any).propertyId}`}
          />
        )}

        {/* Other Associations */}
        {associations?.map(assoc => (
          <RelationshipCard
            key={assoc.id}
            type={assoc.relatedEntityType}
            name={assoc.relatedEntityName || "Entity"}
            subtitle={assoc.relationship || ""}
            role={assoc.role || assoc.relationship || "Related"}
            href={`/crm/${assoc.relatedEntityType}s/${assoc.relatedEntityId}`}
          />
        ))}

        {/* Empty State */}
        {!relatedContact && !relatedCompany && !(deal as any).propertyId && (!associations || associations.length === 0) && (
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground">No relationships yet</p>
          </div>
        )}
      </div>

      {/* Add Relationship */}
      <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1 border-dashed">
        <Link2 className="h-3 w-3" />
        Link Entity
      </Button>
    </div>
  );
}

// ─── Relationship Card ────────────────────────────────────────────

function RelationshipCard({
  type, name, subtitle, role, href
}: {
  type: string;
  name: string;
  subtitle: string;
  role: string;
  href: string;
}) {
  return (
    <a 
      href={href} 
      className="flex items-center gap-2.5 p-2 rounded-md border hover:bg-muted/50 transition-colors group"
    >
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
        type === "contact" && "bg-blue-100 dark:bg-blue-900/40",
        type === "company" && "bg-purple-100 dark:bg-purple-900/40",
        type === "property" && "bg-green-100 dark:bg-green-900/40",
      )}>
        {type === "contact" && <User className="h-3.5 w-3.5 text-blue-600" />}
        {type === "company" && <Building2 className="h-3.5 w-3.5 text-purple-600" />}
        {type === "property" && <Building2 className="h-3.5 w-3.5 text-green-600" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
          {name}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">{subtitle || role}</p>
      </div>
      <div className="flex items-center gap-1">
        <Badge variant="outline" className="text-[9px] h-4 px-1 capitalize">{role}</Badge>
        <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </a>
  );
}

// ─── Utilities ────────────────────────────────────────────────────

function getFieldValue(deal: Deal, editData: Record<string, any>, key: string): any {
  // Check editData first (for edit mode)
  if (editData[key] !== undefined) return editData[key];
  // Then deal object (both camelCase and snake_case)
  const dealAny = deal as any;
  return dealAny[key] ?? dealAny[camelToSnake(key)] ?? dealAny[snakeToCamel(key)] ?? null;
}

function formatFieldValue(value: any, field: FieldDefinition): string {
  if (value === null || value === undefined || value === "") return "—";
  
  switch (field.type) {
    case "currency":
      const num = typeof value === "string" ? parseFloat(value) : value;
      if (isNaN(num)) return "—";
      if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
      if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
      return `$${num.toLocaleString()}`;
    case "percent":
      return `${parseFloat(value).toFixed(1)}%`;
    case "number":
      return Number(value).toLocaleString();
    case "select":
      const opt = field.options?.find(o => o.value === value);
      return opt?.label || String(value);
    case "date":
      try { return new Date(value).toLocaleDateString(); } catch { return String(value); }
    default:
      return String(value);
  }
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export default DealDetailPanel;
