import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AssetClassEntry {
  key: string;
  label: string;
  icon: string;
  color: string;
  group: string;
}

export const ASSET_CLASS_LIST: AssetClassEntry[] = [
  // Waterfront
  { key: "marina",            label: "Marina",                  icon: "⚓", color: "#00d4ff", group: "Waterfront" },
  { key: "dry_stack",         label: "Dry Stack / Boatyard",    icon: "🚢", color: "#06b6d4", group: "Waterfront" },
  { key: "yacht_club",        label: "Yacht Club",              icon: "⛵", color: "#38bdf8", group: "Waterfront" },
  { key: "waterfront_resort", label: "Waterfront Resort",       icon: "🌊", color: "#0ea5e9", group: "Waterfront" },
  { key: "boat_rental",       label: "Boat Rental / Charter",   icon: "🛥️", color: "#22d3ee", group: "Waterfront" },
  // Hospitality
  { key: "hotel",             label: "Hotel",                   icon: "🏨", color: "#a78bfa", group: "Hospitality" },
  { key: "boutique_hotel",    label: "Boutique Hotel",          icon: "🛎️", color: "#8b5cf6", group: "Hospitality" },
  { key: "motel",             label: "Motel / Motor Inn",       icon: "🏩", color: "#c084fc", group: "Hospitality" },
  { key: "extended_stay",     label: "Extended Stay",           icon: "🏠", color: "#e879f9", group: "Hospitality" },
  { key: "rv_park",           label: "RV Park / Campground",    icon: "🚐", color: "#f59e0b", group: "Hospitality" },
  { key: "glamping",          label: "Glamping / Eco-Resort",   icon: "⛺", color: "#fbbf24", group: "Hospitality" },
  // Residential
  { key: "multifamily",       label: "Multifamily",             icon: "🏢", color: "#4ade80", group: "Residential" },
  { key: "garden_apt",        label: "Garden Apartments",       icon: "🌿", color: "#22c55e", group: "Residential" },
  { key: "senior_housing",    label: "Senior Housing",          icon: "👴", color: "#86efac", group: "Residential" },
  { key: "student_housing",   label: "Student Housing",         icon: "🎓", color: "#bbf7d0", group: "Residential" },
  { key: "mobile_home",       label: "Mobile Home Park",        icon: "🏘️", color: "#34d399", group: "Residential" },
  { key: "condo",             label: "Condo / Townhome",        icon: "🏡", color: "#6ee7b7", group: "Residential" },
  { key: "single_family_sfr", label: "SFR Portfolio",           icon: "🏠", color: "#a7f3d0", group: "Residential" },
  // Industrial
  { key: "industrial",        label: "Industrial / Flex",       icon: "🏭", color: "#fb923c", group: "Industrial" },
  { key: "warehouse",         label: "Warehouse / Distribution",icon: "📦", color: "#f97316", group: "Industrial" },
  { key: "cold_storage",      label: "Cold Storage",            icon: "🧊", color: "#fed7aa", group: "Industrial" },
  { key: "self_storage",      label: "Self Storage",            icon: "🗃️", color: "#facc15", group: "Industrial" },
  { key: "data_center",       label: "Data Center",             icon: "🖥️", color: "#fde68a", group: "Industrial" },
  { key: "truck_terminal",    label: "Truck Terminal / Logistics",icon:"🚛", color: "#fbbf24", group: "Industrial" },
  // Office
  { key: "office",            label: "Office",                  icon: "🏬", color: "#60a5fa", group: "Office" },
  { key: "medical_office",    label: "Medical Office",          icon: "🏥", color: "#93c5fd", group: "Office" },
  { key: "coworking",         label: "Co-working / Flex",       icon: "💼", color: "#bfdbfe", group: "Office" },
  { key: "creative_office",   label: "Creative / Loft Office",  icon: "🎨", color: "#dbeafe", group: "Office" },
  // Retail
  { key: "retail",            label: "Retail Strip",            icon: "🛍️", color: "#f472b6", group: "Retail" },
  { key: "anchored_retail",   label: "Anchored Shopping Ctr",   icon: "🏪", color: "#f9a8d4", group: "Retail" },
  { key: "nnn_single_tenant", label: "NNN Single Tenant",       icon: "🏦", color: "#fbcfe8", group: "Retail" },
  // Operating Businesses
  { key: "car_wash",          label: "Car Wash",                icon: "🚗", color: "#22d3ee", group: "Operating Biz" },
  { key: "gas_station",       label: "Gas Station / C-Store",   icon: "⛽", color: "#67e8f9", group: "Operating Biz" },
  { key: "restaurant",        label: "Restaurant / QSR",        icon: "🍽️", color: "#fdba74", group: "Operating Biz" },
  // Land
  { key: "ranchland",         label: "Ranchland / Farm",        icon: "🌾", color: "#a3e635", group: "Land" },
  { key: "dev_land",          label: "Development Site",        icon: "🏗️", color: "#d9f99d", group: "Land" },
  { key: "solar_land",        label: "Solar / Energy Land",     icon: "☀️", color: "#fef08a", group: "Land" },
  // Special Purpose
  { key: "parking",           label: "Parking Garage / Lot",    icon: "🅿️", color: "#94a3b8", group: "Special Purpose" },
];

const GROUPS = Array.from(new Set(ASSET_CLASS_LIST.map((a) => a.group)));

interface AssetClassPickerProps {
  selected: string[];
  onChange: (keys: string[]) => void;
  maxSelections?: number;
  /** When provided, classes not in this list are rendered locked. */
  entitledKeys?: string[];
  /** Called when user clicks a locked (non-entitled) class. */
  onUpgradeRequest?: (key: string) => void;
  /** Classes that are permanently disabled (e.g. already selected at org level). */
  disabledKeys?: string[];
}

export function AssetClassPicker({
  selected,
  onChange,
  maxSelections,
  entitledKeys,
  onUpgradeRequest,
  disabledKeys = [],
}: AssetClassPickerProps) {
  const toggle = (key: string) => {
    if (disabledKeys.includes(key)) return;
    if (entitledKeys && !entitledKeys.includes(key)) {
      onUpgradeRequest?.(key);
      return;
    }
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key));
    } else {
      if (maxSelections && selected.length >= maxSelections) return;
      onChange([...selected, key]);
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-5">
        {GROUPS.map((group) => {
          const items = ASSET_CLASS_LIST.filter((a) => a.group === group);
          return (
            <div key={group}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {group}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {items.map((asset) => {
                  const isSelected = selected.includes(asset.key);
                  const isDisabled = disabledKeys.includes(asset.key);
                  const isLocked =
                    !isDisabled &&
                    entitledKeys !== undefined &&
                    !entitledKeys.includes(asset.key);

                  const btn = (
                    <button
                      key={asset.key}
                      type="button"
                      onClick={() => toggle(asset.key)}
                      disabled={isDisabled}
                      className={cn(
                        "relative flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all text-left w-full",
                        isDisabled
                          ? "border-border bg-muted/30 text-muted-foreground opacity-50 cursor-not-allowed"
                          : isLocked
                          ? "border-border bg-muted/30 text-muted-foreground opacity-60 cursor-pointer hover:opacity-80"
                          : isSelected
                          ? "border-transparent text-white shadow-md"
                          : "border-border bg-background hover:bg-muted text-foreground"
                      )}
                      style={
                        isSelected && !isLocked && !isDisabled
                          ? { backgroundColor: asset.color, borderColor: asset.color }
                          : {}
                      }
                    >
                      <span className="text-base leading-none flex-shrink-0">{asset.icon}</span>
                      <span className="truncate leading-tight">{asset.label}</span>
                      {isLocked && (
                        <Lock className="h-3 w-3 ml-auto flex-shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  );

                  if (isLocked) {
                    return (
                      <Tooltip key={asset.key}>
                        <TooltipTrigger asChild>{btn}</TooltipTrigger>
                        <TooltipContent side="top">
                          Upgrade to unlock {asset.label}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return btn;
                })}
              </div>
            </div>
          );
        })}

        {selected.length > 0 && (
          <div className="pt-2 border-t flex flex-wrap gap-1.5">
            <span className="text-xs text-muted-foreground self-center mr-1">Selected:</span>
            {selected.map((key) => {
              const entry = ASSET_CLASS_LIST.find((a) => a.key === key);
              if (!entry) return null;
              const isDisabled = disabledKeys.includes(key);
              return (
                <Badge
                  key={key}
                  variant="secondary"
                  className={cn(
                    "transition-colors",
                    isDisabled
                      ? "opacity-60 cursor-default"
                      : "cursor-pointer hover:bg-destructive/20"
                  )}
                  onClick={() => !isDisabled && toggle(key)}
                  style={{ borderLeft: `3px solid ${entry.color}` }}
                >
                  {entry.icon} {entry.label} {!isDisabled && "×"}
                </Badge>
              );
            })}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
