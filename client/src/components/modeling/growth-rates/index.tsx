import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Anchor, Warehouse, Fuel, Waves, ShoppingCart, Wrench, Package, Ship,
  DollarSign, Calculator, Handshake, Users, FileSignature, UtensilsCrossed,
  Caravan, Hotel, MoreHorizontal, Briefcase, Scale, Zap, Shield, Building,
  CreditCard, Key, Megaphone, RotateCcw, ChevronDown, ChevronUp, TrendingUp, 
  Receipt, PieChart, Globe, Layers, Sparkles, LucideIcon, Container, MapPin,
  Minus, Plus
} from 'lucide-react';

interface RateInputProps {
  label: string;
  icon: LucideIcon;
  value: number;
  defaultValue: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  size?: 'default' | 'large';
}

export function RateInput({ 
  label, 
  icon: Icon, 
  value, 
  defaultValue, 
  onChange,
  min = -100,
  max = 100,
  step = 0.5,
  size = 'default'
}: RateInputProps) {
  const isModified = Math.abs(value - defaultValue) > 0.001;
  
  const decrement = () => onChange(Math.max(min, +(value - step).toFixed(2)));
  const increment = () => onChange(Math.min(max, +(value + step).toFixed(2)));
  
  return (
    <div className={cn(
      "flex items-center justify-between py-2 px-3 rounded-lg transition-all duration-150 border",
      isModified 
        ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60" 
        : "bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50 hover:border-slate-200 dark:hover:border-slate-600"
    )}>
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className={cn(
          "w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0",
          isModified
            ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
            : "bg-slate-50 dark:bg-slate-700/60 text-slate-400 dark:text-slate-500"
        )}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300 truncate" title={label}>
          {label}
        </span>
      </div>
      
      <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
        <button
          onClick={decrement}
          className="w-6 h-6 rounded flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          tabIndex={-1}
        >
          <Minus className="w-3 h-3" />
        </button>
        
        <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-600 overflow-hidden">
          <input
            type="number"
            value={value}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
            }}
            step={step}
            min={min}
            max={max}
            className={cn(
              "w-14 text-center text-[13px] font-mono py-1 bg-transparent outline-none",
              "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
              isModified 
                ? "text-amber-700 dark:text-amber-300 font-semibold" 
                : "text-slate-700 dark:text-slate-300"
            )}
          />
          <span className="text-[11px] text-slate-400 dark:text-slate-500 pr-2 font-medium select-none">
            %
          </span>
        </div>
        
        <button
          onClick={increment}
          className="w-6 h-6 rounded flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          tabIndex={-1}
        >
          <Plus className="w-3 h-3" />
        </button>
        
        {isModified ? (
          <button
            onClick={() => onChange(defaultValue)}
            className="w-6 h-6 rounded flex items-center justify-center text-amber-500 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
            title={`Reset to ${defaultValue}%`}
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        ) : (
          <div className="w-6" />
        )}
      </div>
    </div>
  );
}

type AccentColor = 'blue' | 'emerald' | 'slate' | 'purple';

interface SectionCardProps {
  title: string;
  description: string;
  accent: AccentColor;
  icon: LucideIcon;
  headerAction?: React.ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

const accentStyles: Record<AccentColor, { border: string; iconBg: string; badge: string }> = {
  blue: { border: 'border-l-blue-500', iconBg: 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400', badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' },
  emerald: { border: 'border-l-emerald-500', iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
  slate: { border: 'border-l-slate-400', iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400', badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  purple: { border: 'border-l-purple-500', iconBg: 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400', badge: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300' },
};

export function SectionCard({ 
  title, 
  description, 
  accent, 
  icon: Icon, 
  headerAction, 
  collapsible = false, 
  defaultExpanded = true, 
  children 
}: SectionCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const style = accentStyles[accent];
  
  return (
    <div className={cn(
      "bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 border-l-4 overflow-hidden",
      style.border
    )}>
      <div 
        className={cn(
          "px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between",
          collapsible && "cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
        )}
        onClick={collapsible ? () => setIsExpanded(!isExpanded) : undefined}
      >
        <div className="flex items-center gap-2.5">
          <div className={cn("p-1.5 rounded-lg", style.iconBg)}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {headerAction}
          {collapsible && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>
      
      {isExpanded && <div className="p-4">{children}</div>}
    </div>
  );
}

interface CategoryGroupProps {
  title: string;
  children: React.ReactNode;
  columns?: 2 | 3;
}

export function CategoryGroup({ title, children, columns = 2 }: CategoryGroupProps) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 px-1 flex items-center gap-2">
        <span>{title}</span>
        <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
      </div>
      <div className={cn(
        "grid gap-1.5",
        columns === 3 ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1 md:grid-cols-2"
      )}>
        {children}
      </div>
    </div>
  );
}

interface SetAllDropdownProps {
  onSetAll: (value: number) => void;
}

export function SetAllDropdown({ onSetAll }: SetAllDropdownProps) {
  return (
    <select
      onChange={(e) => e.target.value && onSetAll(parseFloat(e.target.value))}
      defaultValue=""
      className="text-xs border border-slate-200 dark:border-slate-600 rounded-md px-2.5 py-1.5 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer focus:ring-1 focus:ring-blue-500 outline-none"
    >
      <option value="" disabled>Set all to...</option>
      <option value="1.0">1.0%</option>
      <option value="1.5">1.5%</option>
      <option value="2.0">2.0%</option>
      <option value="2.5">2.5%</option>
      <option value="3.0">3.0%</option>
      <option value="3.5">3.5%</option>
      <option value="4.0">4.0%</option>
      <option value="5.0">5.0%</option>
    </select>
  );
}

interface ModeToggleProps {
  value: 'universal' | 'perProfitCenter';
  onChange: (value: 'universal' | 'perProfitCenter') => void;
}

export function ModeToggle({ value, onChange }: ModeToggleProps) {
  return (
    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
      <button
        onClick={() => onChange('universal')}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
          value === 'universal' 
            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm" 
            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        )}
      >
        <Globe className="w-3.5 h-3.5" />
        Universal
      </button>
      <button
        onClick={() => onChange('perProfitCenter')}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
          value === 'perProfitCenter' 
            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm" 
            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        )}
      >
        <Layers className="w-3.5 h-3.5" />
        Per Type
      </button>
    </div>
  );
}

interface QuickActionsBarProps {
  modifiedCount: number;
  totalCount: number;
  onReset: () => void;
  onPreset: (value: number) => void;
}

export function QuickActionsBar({ modifiedCount, totalCount, onReset, onPreset }: QuickActionsBarProps) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <Sparkles className="w-4 h-4 text-blue-500" />
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Presets</span>
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
        <div className="flex gap-1.5">
          {[
            { label: 'Conservative', value: 1.5 },
            { label: 'Moderate', value: 2.5 },
            { label: 'Aggressive', value: 3.5 },
          ].map(({ label, value }) => (
            <button
              key={value}
              onClick={() => onPreset(value)}
              className="px-3 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-200 dark:hover:border-blue-800 hover:text-blue-700 dark:hover:text-blue-300 transition-all text-slate-600 dark:text-slate-300"
            >
              {label} <span className="text-slate-400 dark:text-slate-500 ml-0.5">{value}%</span>
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {modifiedCount > 0 && (
          <span className="text-[11px] bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 font-semibold px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
            {modifiedCount} customized
          </span>
        )}
        <button
          onClick={onReset}
          className="text-xs text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all font-medium"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset All
        </button>
      </div>
    </div>
  );
}

export const COA_CODES = {
  revenue: {
    fuel: 'REV_FUEL',
    marinaAmenities: 'REV_MARINA_&_AMENITIES',
    shipStoreRetail: 'REV_SHIPS_STORE',
    service: 'REV_SERVICE',
    parts: 'REV_PARTS',
    thirdPartyLeases: 'REV_THIRD_PARTY_LEASES',
    inHouseBoatClub: 'REV_IN_HOUSE_BOAT_CLUB',
    boatRentals: 'REV_BOAT_RENTALS',
    boatSales: 'REV_BOAT_SALES',
    boatFinance: 'REV_BOAT_FINANCE',
    boatBrokerage: 'REV_BOAT_BROKERAGE',
    fAndB: 'REV_F&B',
    rvPark: 'REV_RV_PARK',
    hospitalityLodging: 'REV_HOSPITALITY_LODGING',
    miscellaneous: 'REV_MISCELLANEOUS',
  },
  operatingExpenses: {
    payroll: 'OPEX_PAYROLL',
    generalAdmin: 'OPEX_GENERAL_&_ADMINISTRATIVE',
    advertising: 'OPEX_ADVERTISING',
    repairsMaintenance: 'OPEX_REPAIRS_&_MAINTENANCE',
    utilities: 'OPEX_UTILITIES',
    licensesPermits: 'OPEX_LICENSES_&_PERMITS',
    securityContractServices: 'OPEX_SECURITY_&_CONTRACT_SERVICES',
    bankCreditCardFees: 'OPEX_BANK_&_CREDIT_CARD_FEES',
    professionalServices: 'OPEX_PROFESSIONAL_SERVICES',
    insurance: 'OPEX_INSURANCE',
    propertyTaxes: 'OPEX_PROPERTY_TAXES',
    leases: 'OPEX_LEASES',
  },
  departmentalExpenses: {
    fAndB: 'OPEX_F&B',
    service: 'OPEX_SERVICE',
    parts: 'OPEX_PARTS',
    rvPark: 'OPEX_RV_PARK',
    hospitalityLodging: 'OPEX_HOSPITALITY_LODGING',
    miscellaneous: 'OPEX_MISCELLANEOUS',
  }
};

export const REVENUE_CATEGORIES = {
  coreMarineRevenue: [
    { id: 'fuel_dock', key: 'fuel', label: 'Fuel', icon: Fuel, coaCode: COA_CODES.revenue.fuel },
    { id: 'marina_amenities', key: 'marinaAmenities', label: 'Marina & Amenities', icon: Waves, coaCode: COA_CODES.revenue.marinaAmenities },
  ],
  retailAndService: [
    { id: 'ship_store', key: 'shipStoreRetail', label: 'Ship Store/Retail', icon: ShoppingCart, coaCode: COA_CODES.revenue.shipStoreRetail },
    { id: 'service', key: 'service', label: 'Service', icon: Wrench, coaCode: COA_CODES.revenue.service },
    { id: 'parts', key: 'parts', label: 'Parts', icon: Package, coaCode: COA_CODES.revenue.parts },
  ],
  boats: [
    { id: 'rental_boats', key: 'boatRentals', label: 'Boat Rentals', icon: Ship, coaCode: COA_CODES.revenue.boatRentals },
    { id: 'boat_sales', key: 'boatSales', label: 'Boat Sales', icon: DollarSign, coaCode: COA_CODES.revenue.boatSales },
    { id: 'boat_finance', key: 'boatFinance', label: 'Boat Finance', icon: Calculator, coaCode: COA_CODES.revenue.boatFinance },
    { id: 'boat_brokerage', key: 'boatBrokerage', label: 'Boat Brokerage', icon: Handshake, coaCode: COA_CODES.revenue.boatBrokerage },
    { id: 'boat_club', key: 'inHouseBoatClub', label: 'In-House Boat Club', icon: Users, coaCode: COA_CODES.revenue.inHouseBoatClub },
  ],
  leasesAndHospitality: [
    { id: 'commercial_tenants', key: 'thirdPartyLeases', label: 'Third-Party Leases', icon: FileSignature, coaCode: COA_CODES.revenue.thirdPartyLeases },
    { id: 'restaurant', key: 'fAndB', label: 'F&B', icon: UtensilsCrossed, coaCode: COA_CODES.revenue.fAndB },
    { id: 'rv_sites', key: 'rvPark', label: 'RV Park', icon: Caravan, coaCode: COA_CODES.revenue.rvPark },
    { id: 'hospitality', key: 'hospitalityLodging', label: 'Hospitality/Lodging', icon: Hotel, coaCode: COA_CODES.revenue.hospitalityLodging },
    { id: 'misc_revenue', key: 'miscellaneous', label: 'Miscellaneous', icon: MoreHorizontal, coaCode: COA_CODES.revenue.miscellaneous },
  ],
};

export const OPEX_CATEGORIES = {
  laborAndAdmin: [
    { id: 'payroll', key: 'payroll', label: 'Payroll', icon: Users, coaCode: COA_CODES.operatingExpenses.payroll, defaultValue: 4.0 },
    { id: 'g_and_a', key: 'generalAdmin', label: 'General & Admin', icon: Briefcase, coaCode: COA_CODES.operatingExpenses.generalAdmin },
    { id: 'professional_fees', key: 'professionalServices', label: 'Professional Svcs', icon: Scale, coaCode: COA_CODES.operatingExpenses.professionalServices },
  ],
  marketing: [
    { id: 'marketing', key: 'advertising', label: 'Advertising & Marketing', icon: Megaphone, coaCode: COA_CODES.operatingExpenses.advertising },
  ],
  operations: [
    { id: 'repairs_maintenance', key: 'repairsMaintenance', label: 'Repairs & Maint.', icon: Wrench, coaCode: COA_CODES.operatingExpenses.repairsMaintenance },
    { id: 'utilities', key: 'utilities', label: 'Utilities', icon: Zap, coaCode: COA_CODES.operatingExpenses.utilities },
    { id: 'licenses_permits', key: 'licensesPermits', label: 'Licenses & Permits', icon: Key, coaCode: COA_CODES.operatingExpenses.licensesPermits },
    { id: 'contract_services', key: 'securityContractServices', label: 'Security & Contract', icon: Shield, coaCode: COA_CODES.operatingExpenses.securityContractServices },
  ],
  financial: [
    { id: 'bank_cc_fees', key: 'bankCreditCardFees', label: 'Bank/CC Fees', icon: CreditCard, coaCode: COA_CODES.operatingExpenses.bankCreditCardFees },
    { id: 'insurance', key: 'insurance', label: 'Insurance', icon: Shield, coaCode: COA_CODES.operatingExpenses.insurance },
    { id: 'property_taxes', key: 'propertyTaxes', label: 'Property Taxes', icon: Building, coaCode: COA_CODES.operatingExpenses.propertyTaxes },
    { id: 'leases', key: 'leases', label: 'Leases', icon: FileSignature, coaCode: COA_CODES.operatingExpenses.leases },
  ],
};

export const DEPARTMENTAL_EXPENSE_CATEGORIES = [
  { id: 'f_and_b', key: 'fAndB', label: 'F&B', icon: UtensilsCrossed, coaCode: COA_CODES.departmentalExpenses.fAndB },
  { id: 'service_dept', key: 'service', label: 'Service', icon: Wrench, coaCode: COA_CODES.departmentalExpenses.service },
  { id: 'parts_dept', key: 'parts', label: 'Parts', icon: Package, coaCode: COA_CODES.departmentalExpenses.parts },
  { id: 'rv_park_dept', key: 'rvPark', label: 'RV Park', icon: Caravan, coaCode: COA_CODES.departmentalExpenses.rvPark },
  { id: 'hospitality_dept', key: 'hospitalityLodging', label: 'Hospitality/Lodging', icon: Hotel, coaCode: COA_CODES.departmentalExpenses.hospitalityLodging },
  { id: 'misc_dept', key: 'miscellaneous', label: 'Miscellaneous', icon: MoreHorizontal, coaCode: COA_CODES.departmentalExpenses.miscellaneous },
];

export const STORAGE_CATEGORIES = [
  { id: 'wet_slips', label: 'Wet Slips', icon: Anchor },
  { id: 'dry_racks_indoor', label: 'Dry Racks – Indoor', icon: Warehouse },
  { id: 'dry_racks_outdoor', label: 'Dry Racks – Outdoor', icon: Container },
  { id: 'moorings', label: 'Moorings', icon: Anchor },
  { id: 'lift_slips', label: 'Lift Slips', icon: Waves },
  { id: 'dinghies', label: 'Dinghies', icon: Ship },
  { id: 'jet_skis', label: 'Jet Skis', icon: Waves },
  { id: 'land_storage', label: 'Land Storage', icon: MapPin },
  { id: 'boats_on_trailers', label: 'Boats on Trailers', icon: Ship },
];
