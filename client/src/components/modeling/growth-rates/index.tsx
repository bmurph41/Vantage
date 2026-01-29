import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Anchor, Warehouse, Fuel, Waves, ShoppingCart, Wrench, Package, Ship,
  DollarSign, Calculator, Handshake, Users, FileSignature, UtensilsCrossed,
  Caravan, Hotel, MoreHorizontal, Briefcase, Scale, Zap, Shield, Building,
  CreditCard, Key, Megaphone, RotateCcw, ChevronDown, ChevronUp, TrendingUp, 
  Receipt, PieChart, Globe, Layers, Sparkles, LucideIcon, Container, MapPin
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
  min = 0,
  max = 10,
  step = 0.5,
  size = 'default'
}: RateInputProps) {
  const isModified = Math.abs(value - defaultValue) > 0.001;
  const percentage = ((value - min) / (max - min)) * 100;
  
  return (
    <div className={cn(
      "flex items-center gap-3 py-2.5 px-3 rounded-lg transition-all duration-200 group",
      isModified ? "bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-200 dark:ring-amber-800" : "hover:bg-white dark:hover:bg-slate-800"
    )}>
      <Icon className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
      <span className={cn(
        "text-sm font-medium text-slate-700 dark:text-slate-300 truncate",
        size === 'large' ? "w-48" : "w-44"
      )} title={label}>
        {label}
      </span>
      
      <div className="flex-1 relative h-6 flex items-center">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percentage}%, #e2e8f0 ${percentage}%, #e2e8f0 100%)`
          }}
        />
      </div>
      
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Math.min(max, Math.max(min, parseFloat(e.target.value) || 0)))}
          step={step}
          min={min}
          max={max}
          className={cn(
            "w-20 text-right text-sm font-mono rounded-lg px-2 py-1.5 pr-6 outline-none transition-all",
            "border bg-white dark:bg-slate-800",
            isModified 
              ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 focus:ring-2 focus:ring-amber-400" 
              : "border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          )}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm pointer-events-none">
          %
        </span>
      </div>
      
      {isModified ? (
        <button
          onClick={() => onChange(defaultValue)}
          className="p-1.5 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-md transition-colors"
          title="Reset to default"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      ) : (
        <div className="w-7" />
      )}
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

const accentStyles: Record<AccentColor, { border: string; iconBg: string }> = {
  blue: { border: 'border-l-blue-500', iconBg: 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400' },
  emerald: { border: 'border-l-emerald-500', iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' },
  slate: { border: 'border-l-slate-400', iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
  purple: { border: 'border-l-purple-500', iconBg: 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400' },
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
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg", style.iconBg)}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {headerAction}
          {collapsible && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
      
      {isExpanded && <div className="p-5">{children}</div>}
    </div>
  );
}

interface CategoryGroupProps {
  title: string;
  children: React.ReactNode;
}

export function CategoryGroup({ title, children }: CategoryGroupProps) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-1">
        {title}
      </div>
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-1.5 space-y-0.5">
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
      className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer focus:ring-2 focus:ring-blue-500 outline-none"
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
    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
      <button
        onClick={() => onChange('universal')}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
          value === 'universal' 
            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm" 
            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        )}
      >
        <Globe className="w-4 h-4" />
        Universal Rate
      </button>
      <button
        onClick={() => onChange('perProfitCenter')}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
          value === 'perProfitCenter' 
            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm" 
            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        )}
      >
        <Layers className="w-4 h-4" />
        Per Profit Center
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
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 px-5 py-3 flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Sparkles className="w-5 h-5 text-blue-500" />
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Quick Presets:</span>
        <div className="flex gap-2">
          {[
            { label: 'Conservative', value: 1.5 },
            { label: 'Moderate', value: 2.5 },
            { label: 'Aggressive', value: 3.5 },
          ].map(({ label, value }) => (
            <button
              key={value}
              onClick={() => onPreset(value)}
              className="px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-500 transition-colors text-slate-700 dark:text-slate-300"
            >
              {label} ({value}%)
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        {modifiedCount > 0 && (
          <span className="text-sm bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-3 py-1.5 rounded-full font-medium">
            {modifiedCount} of {totalCount} modified
          </span>
        )}
        <button
          onClick={onReset}
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
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
    { id: 'g_and_a', key: 'generalAdmin', label: 'General & Administrative', icon: Briefcase, coaCode: COA_CODES.operatingExpenses.generalAdmin },
    { id: 'professional_fees', key: 'professionalServices', label: 'Professional Services', icon: Scale, coaCode: COA_CODES.operatingExpenses.professionalServices },
  ],
  marketing: [
    { id: 'marketing', key: 'advertising', label: 'Advertising & Marketing', icon: Megaphone, coaCode: COA_CODES.operatingExpenses.advertising },
  ],
  operations: [
    { id: 'repairs_maintenance', key: 'repairsMaintenance', label: 'Repairs & Maintenance', icon: Wrench, coaCode: COA_CODES.operatingExpenses.repairsMaintenance },
    { id: 'utilities', key: 'utilities', label: 'Utilities', icon: Zap, coaCode: COA_CODES.operatingExpenses.utilities },
    { id: 'licenses_permits', key: 'licensesPermits', label: 'Licenses & Permits', icon: Key, coaCode: COA_CODES.operatingExpenses.licensesPermits },
    { id: 'contract_services', key: 'securityContractServices', label: 'Security & Contract Services', icon: Shield, coaCode: COA_CODES.operatingExpenses.securityContractServices },
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
