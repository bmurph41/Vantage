/**
 * SETUP WIZARD - Enterprise-Grade Persistence
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Building2,
  MapPin,
  DollarSign,
  Anchor,
  Ship,
  Fuel,
  ShoppingCart,
  Wrench,
  Calendar,
  TrendingUp,
  AlertCircle,
  RotateCcw,
  Cloud,
  CloudOff,
  Car,
  Upload,
  FileSpreadsheet,
  X,
  Trash2,
  FileText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useWizardDraft, onWizardSubmitSuccess } from "@/components/wizard/use-wizard-draft";
import { ResumeDraftModal } from "@/components/wizard/resume-draft-modal";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

// ============================================
// CONSTANTS
// ============================================

const ASSET_TYPES = [
  { value: "MARINA", label: "Marina", icon: Anchor },
  { value: "RV_PARK", label: "RV Park", icon: Ship },
  { value: "MULTIFAMILY", label: "Multifamily", icon: Building2 },
  { value: "RETAIL", label: "Retail", icon: ShoppingCart },
  { value: "INDUSTRIAL", label: "Industrial", icon: Building2 },
  { value: "MIXED_USE", label: "Mixed Use", icon: Building2 },
  { value: "OTHER", label: "Other", icon: Building2 },
];

const STORAGE_TYPES = [
  { value: "WET_SLIPS", label: "Wet Slips", description: "In-water boat storage" },
  { value: "DRY_STACK", label: "Dry Stack Racks", description: "Indoor rack storage" },
  { value: "MOORINGS", label: "Moorings", description: "Mooring balls & anchors" },
  { value: "TRAILER_STORAGE", label: "Trailer Storage", description: "Outdoor trailer parking" },
  { value: "RV_STORAGE", label: "RV Storage", description: "RV & camper storage" },
  { value: "SERVICE_BAYS", label: "Service Bays", description: "Repair & maintenance" },
];

const SEASONALITY_PROFILES = [
  { value: "YEAR_ROUND", label: "Year-Round", description: "Consistent occupancy" },
  { value: "SEASONAL_PEAK_SUMMER", label: "Summer Peak", description: "Peak April-October" },
  { value: "SEASONAL_PEAK_WINTER", label: "Winter Peak", description: "Peak November-March" },
  { value: "CUSTOM", label: "Custom", description: "Define your own" },
];

const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const CURRENT_YEAR = new Date().getFullYear();
const HISTORICAL_YEARS = [
  CURRENT_YEAR - 1,
  CURRENT_YEAR - 2,
  CURRENT_YEAR - 3,
  CURRENT_YEAR - 4,
  CURRENT_YEAR - 5,
];

// ============================================
// WIZARD STEPS
// ============================================

const WIZARD_STEPS = [
  { id: "welcome", title: "Welcome", description: "Get started" },
  { id: "deal-details", title: "Deal Details", description: "Project & acquisition" },
  { id: "storage-mix", title: "Storage Mix", description: "Operations" },
  { id: "profit-centers", title: "Profit Centers", description: "Revenue streams" },
  { id: "financial-scope", title: "Financials", description: "Historical data" },
  { id: "underwriting", title: "Underwriting", description: "Assumptions" },
  { id: "documents", title: "Documents", description: "Upload files" },
  { id: "review", title: "Review", description: "Create project" },
] as const;

type StepId = typeof WIZARD_STEPS[number]["id"];

const STEP_LABELS: Record<string, string> = {
  "welcome": "Welcome",
  "deal-details": "Deal Details",
  "storage-mix": "Storage Mix",
  "profit-centers": "Profit Centers",
  "financial-scope": "Financial Scope",
  "underwriting": "Underwriting",
  "documents": "Documents",
  "review": "Review",
};

function getStepIndex(stepId: string): number {
  const index = WIZARD_STEPS.findIndex((s) => s.id === stepId);
  return index >= 0 ? index : 0;
}

function getStepId(index: number): StepId {
  return WIZARD_STEPS[index]?.id || "welcome";
}
// ============================================
// FORM DATA TYPES
// ============================================

interface StorageMixItem {
  storageType: string;
  count: number;
  avgRate: string;
  currentOccupancy: string;
  occupiedCount: string;
  occupancyInputMode: 'percentage' | 'count';
}

interface WizardFormData {
  name: string;
  assetType: string;
  propertyName: string;
  dealSource: string;
  ebitda: string;
  location: {
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  acquisition: {
    targetClosingDate: string;
    purchasePrice: string;
    closingCostsDollar: string;
    closingCostsPercent: string;
    equityInvested: string;
    debtAmount: string;
    ltv: string;
  };
  loanTerms: {
    interestRate: string;
    amortizationYears: string;
    termYears: string;
    ioMonths: string;
  };
  storageMix: {
    items: StorageMixItem[];
    hasFuelDock: boolean;
  };
  seasonality: {
    profile: string;
    seasonStartMonth: string;
    seasonEndMonth: string;
  };
  profitCenters: {
    commercialTenants: { enabled: boolean; numberOfSuites: string; totalSqFt: string };
    fuelSales: { enabled: boolean; pumpsCount: string };
    shipStore: { enabled: boolean; expectedRevenueBaseline: string };
    serviceDepartment: { enabled: boolean; numberOfBays: string };
    boatRentals: { enabled: boolean; fleetSize: string };
    boatClub: { enabled: boolean; memberCapacity: string; monthlyDues: string };
    boatSales: { enabled: boolean; expectedAnnualRevenue: string };
    parkingLot: { enabled: boolean; totalSpaces: string; avgDailyRate: string };
  };
  financialScope: {
    historicalYears: number[];
    includeT12: boolean;
    fiscalYearEndMonth: string;
    accountingBasis: string;
  };
  underwriting: {
    revenueGrowthPercent: string;
    expenseGrowthPercent: string;
    occupancyGrowthPercent: string;
    targetOccupancy: string;
    capRateExit: string;
    exitYear: string;
    discountRate: string;
    holdPeriodYears: string;
  };
}

const DEAL_SOURCES = [
  { value: "broker", label: "Broker" },
  { value: "direct", label: "Direct / Off-Market" },
  { value: "listing", label: "Online Listing" },
  { value: "auction", label: "Auction" },
  { value: "referral", label: "Referral" },
  { value: "marinamatch", label: "MarinaMatch" },
  { value: "other", label: "Other" },
];

const DEFAULT_FORM_DATA: WizardFormData = {
  name: "",
  assetType: "MARINA",
  propertyName: "",
  dealSource: "",
  ebitda: "",
  location: {
    streetAddress: "",
    city: "",
    state: "",
    zipCode: "",
    country: "USA",
  },
  acquisition: {
    targetClosingDate: "",
    purchasePrice: "",
    closingCostsDollar: "",
    closingCostsPercent: "2",
    equityInvested: "",
    debtAmount: "",
    ltv: "65",
  },
  loanTerms: {
    interestRate: "7",
    amortizationYears: "25",
    termYears: "10",
    ioMonths: "0",
  },
  storageMix: {
    items: [],
    hasFuelDock: false,
  },
  seasonality: {
    profile: "YEAR_ROUND",
    seasonStartMonth: "4",
    seasonEndMonth: "10",
  },
  profitCenters: {
    commercialTenants: { enabled: false, numberOfSuites: "", totalSqFt: "" },
    fuelSales: { enabled: false, pumpsCount: "" },
    shipStore: { enabled: false, expectedRevenueBaseline: "" },
    serviceDepartment: { enabled: false, numberOfBays: "" },
    boatRentals: { enabled: false, fleetSize: "" },
    boatClub: { enabled: false, memberCapacity: "", monthlyDues: "" },
    boatSales: { enabled: false, expectedAnnualRevenue: "" },
    parkingLot: { enabled: false, totalSpaces: "", avgDailyRate: "" },
  },
  financialScope: {
    historicalYears: [],
    includeT12: true,
    fiscalYearEndMonth: "12",
    accountingBasis: "ACCRUAL",
  },
  underwriting: {
    revenueGrowthPercent: "3",
    expenseGrowthPercent: "2.5",
    occupancyGrowthPercent: "0",
    targetOccupancy: "95",
    capRateExit: "",
    exitYear: "5",
    discountRate: "",
    holdPeriodYears: "5",
  },
};

// ============================================
// SLIDE PROPS
// ============================================

interface SlideProps {
  payload: WizardFormData;
  updatePayload: <K extends keyof WizardFormData>(key: K, value: WizardFormData[K]) => void;
  updateNestedPayload: (path: string, value: any) => void;
}
// ============================================
// WELCOME SLIDE
// ============================================

function WelcomeSlide() {
  return (
    <div className="text-center py-8">
      <div className="w-20 h-20 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center">
        <Anchor className="h-10 w-10 text-primary" />
      </div>
      <h2 className="text-3xl font-bold mb-4">Welcome to MarinaMatch</h2>
      <p className="text-lg text-muted-foreground max-w-md mx-auto mb-8">
        Let's set up your modeling project. We'll walk you through the key
        inputs to get your valuation started.
      </p>
      <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto text-sm">
        <div className="p-3 bg-muted rounded-lg">
          <Building2 className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <span className="text-muted-foreground">Property Details</span>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <DollarSign className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <span className="text-muted-foreground">Financial Inputs</span>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <TrendingUp className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <span className="text-muted-foreground">Underwriting</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// DEAL DETAILS SLIDE
// ============================================

function DealDetailsSlide({ payload, updatePayload, updateNestedPayload }: SlideProps) {
  const computedDebt = payload.acquisition.purchasePrice && payload.acquisition.ltv
    ? (parseFloat(payload.acquisition.purchasePrice) * parseFloat(payload.acquisition.ltv) / 100).toFixed(0)
    : '';
  const computedEquity = payload.acquisition.purchasePrice && computedDebt
    ? (parseFloat(payload.acquisition.purchasePrice) - parseFloat(computedDebt)).toFixed(0)
    : '';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-2">Deal Details</h3>
        <p className="text-muted-foreground">
          Enter project information, acquisition parameters, and deal structure.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Project Basics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 md:col-span-1">
              <Label htmlFor="name">
                Project Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., Sunrise Marina Acquisition"
                value={payload.name}
                onChange={(e) => updatePayload("name", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div className="col-span-2 md:col-span-1">
              <Label htmlFor="assetType">
                Asset Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={payload.assetType}
                onValueChange={(v) => updatePayload("assetType", v)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="propertyName">Property / Marina Name</Label>
              <Input
                id="propertyName"
                placeholder="e.g., Sunrise Marina"
                value={payload.propertyName}
                onChange={(e) => updatePayload("propertyName", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="dealSource">Deal Source</Label>
              <Select
                value={payload.dealSource || "none"}
                onValueChange={(v) => updatePayload("dealSource", v === "none" ? "" : v)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="How did this deal originate?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select source...</SelectItem>
                  {DEAL_SOURCES.map((src) => (
                    <SelectItem key={src.value} value={src.value}>
                      {src.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Location
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="streetAddress">Street Address</Label>
            <Input
              id="streetAddress"
              placeholder="123 Marina Way"
              value={payload.location.streetAddress}
              onChange={(e) => updateNestedPayload("location.streetAddress", e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="Miami"
                value={payload.location.city}
                onChange={(e) => updateNestedPayload("location.city", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                placeholder="FL"
                value={payload.location.state}
                onChange={(e) => updateNestedPayload("location.state", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="zipCode">ZIP Code</Label>
              <Input
                id="zipCode"
                placeholder="33101"
                value={payload.location.zipCode}
                onChange={(e) => updateNestedPayload("location.zipCode", e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Acquisition & Capital Structure
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="targetClosingDate">Target Closing Date</Label>
              <Input
                id="targetClosingDate"
                type="date"
                value={payload.acquisition.targetClosingDate}
                onChange={(e) => updateNestedPayload("acquisition.targetClosingDate", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="purchasePrice">Purchase Price ($)</Label>
              <Input
                id="purchasePrice"
                type="number"
                placeholder="5,000,000"
                value={payload.acquisition.purchasePrice}
                onChange={(e) => updateNestedPayload("acquisition.purchasePrice", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="ebitda">Current EBITDA ($)</Label>
              <Input
                id="ebitda"
                type="number"
                placeholder="500,000"
                value={payload.ebitda}
                onChange={(e) => updatePayload("ebitda", e.target.value)}
                className="mt-1.5"
              />
              {payload.acquisition.purchasePrice && payload.ebitda && parseFloat(payload.ebitda) > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Implied Cap Rate: {((parseFloat(payload.ebitda) / parseFloat(payload.acquisition.purchasePrice)) * 100).toFixed(2)}%
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="closingCostsPercent">Closing Costs (%)</Label>
              <Input
                id="closingCostsPercent"
                type="number"
                step="0.1"
                placeholder="2"
                value={payload.acquisition.closingCostsPercent}
                onChange={(e) => updateNestedPayload("acquisition.closingCostsPercent", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="ltv">LTV (%)</Label>
              <Input
                id="ltv"
                type="number"
                placeholder="65"
                value={payload.acquisition.ltv}
                onChange={(e) => updateNestedPayload("acquisition.ltv", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="closingCostsDollar">Closing Costs ($)</Label>
              <Input
                id="closingCostsDollar"
                type="number"
                placeholder="Auto-calculated or enter manually"
                value={payload.acquisition.closingCostsDollar || (
                  payload.acquisition.purchasePrice && payload.acquisition.closingCostsPercent
                    ? (parseFloat(payload.acquisition.purchasePrice) * parseFloat(payload.acquisition.closingCostsPercent) / 100).toFixed(0)
                    : ''
                )}
                onChange={(e) => updateNestedPayload("acquisition.closingCostsDollar", e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          {payload.acquisition.purchasePrice && payload.acquisition.ltv && (
            <div className="mt-3 p-3 bg-muted/50 rounded-lg">
              <div className="text-sm font-medium mb-2">Capital Structure Summary</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Debt Amount:</span>
                  <span className="font-medium">${parseInt(computedDebt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Equity Required:</span>
                  <span className="font-medium">${parseInt(computedEquity).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Loan Terms
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="interestRate">Interest Rate (%)</Label>
              <Input
                id="interestRate"
                type="number"
                step="0.125"
                placeholder="7"
                value={payload.loanTerms.interestRate}
                onChange={(e) => updateNestedPayload("loanTerms.interestRate", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="amortizationYears">Amortization (yrs)</Label>
              <Input
                id="amortizationYears"
                type="number"
                placeholder="25"
                value={payload.loanTerms.amortizationYears}
                onChange={(e) => updateNestedPayload("loanTerms.amortizationYears", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="termYears">Loan Term (yrs)</Label>
              <Input
                id="termYears"
                type="number"
                placeholder="10"
                value={payload.loanTerms.termYears}
                onChange={(e) => updateNestedPayload("loanTerms.termYears", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="ioMonths">IO Period (months)</Label>
              <Input
                id="ioMonths"
                type="number"
                placeholder="0"
                value={payload.loanTerms.ioMonths}
                onChange={(e) => updateNestedPayload("loanTerms.ioMonths", e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
// ============================================
// STORAGE MIX SLIDE
// ============================================

function StorageMixSlide({ payload, updatePayload, updateNestedPayload }: SlideProps) {
  const toggleStorageType = (type: string) => {
    const items = payload.storageMix.items;
    const existingIndex = items.findIndex((i) => i.storageType === type);

    if (existingIndex >= 0) {
      updatePayload("storageMix", {
        ...payload.storageMix,
        items: items.filter((_, i) => i !== existingIndex),
      });
    } else {
      updatePayload("storageMix", {
        ...payload.storageMix,
        items: [...items, { storageType: type, count: 0, avgRate: "", currentOccupancy: "", occupiedCount: "", occupancyInputMode: 'percentage' as const }],
      });
    }
  };

  const updateStorageItem = (storageType: string, field: string, value: any) => {
    const items = payload.storageMix.items.map((item) =>
      item.storageType === storageType ? { ...item, [field]: value } : item
    );
    updatePayload("storageMix", { ...payload.storageMix, items });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-2">Operations & Storage Mix</h3>
        <p className="text-muted-foreground">
          Configure the storage types and capacity at your marina.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Anchor className="h-4 w-4" />
            Storage Types
          </CardTitle>
          <CardDescription>Select all storage types available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {STORAGE_TYPES.map((type) => {
              const isSelected = payload.storageMix.items.some((i) => i.storageType === type.value);
              return (
                <div
                  key={type.value}
                  onClick={() => toggleStorageType(type.value)}
                  className={cn(
                    "p-3 rounded-lg border-2 cursor-pointer transition-all",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/50"
                  )}
                >
                  <div className="font-medium text-sm">{type.label}</div>
                  <div className="text-xs text-muted-foreground">{type.description}</div>
                </div>
              );
            })}
          </div>

          {payload.storageMix.items.length > 0 && (
            <div className="mt-6 space-y-4">
              <Separator />
              <h4 className="font-medium">Storage Details</h4>
              {payload.storageMix.items.map((item) => {
                const mode = item.occupancyInputMode || 'percentage';
                return (
                <div key={item.storageType} className="grid grid-cols-4 gap-3 items-end">
                  <div className="font-medium text-sm">
                    {STORAGE_TYPES.find((t) => t.value === item.storageType)?.label}
                  </div>
                  <div>
                    <Label className="text-xs">Capacity</Label>
                    <Input
                      type="number"
                      value={item.count}
                      onChange={(e) => {
                        const capacity = parseInt(e.target.value) || 0;
                        const updates: Partial<StorageMixItem> = { count: capacity };
                        if (capacity > 0) {
                          if (mode === 'count' && item.occupiedCount) {
                            const occ = parseInt(item.occupiedCount) || 0;
                            updates.currentOccupancy = Math.round((occ / capacity) * 100).toString();
                          } else if (mode === 'percentage' && item.currentOccupancy) {
                            updates.occupiedCount = Math.round((parseFloat(item.currentOccupancy) / 100) * capacity).toString();
                          }
                        }
                        const items = payload.storageMix.items.map((i) =>
                          i.storageType === item.storageType ? { ...i, ...updates } : i
                        );
                        updatePayload("storageMix", { ...payload.storageMix, items });
                      }}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Avg Rate ($/mo)</Label>
                    <Input
                      type="number"
                      value={item.avgRate}
                      onChange={(e) => updateStorageItem(item.storageType, "avgRate", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs">Occupied</Label>
                      <div className="flex rounded-md border border-border overflow-hidden">
                        <button
                          type="button"
                          className={cn(
                            "px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                            mode === 'count'
                              ? "bg-primary text-primary-foreground"
                              : "bg-background text-muted-foreground hover:bg-muted"
                          )}
                          onClick={() => {
                            const updates: Partial<StorageMixItem> = { occupancyInputMode: 'count' as const };
                            if (item.currentOccupancy && item.count > 0) {
                              updates.occupiedCount = Math.round((parseFloat(item.currentOccupancy) / 100) * item.count).toString();
                            }
                            const items = payload.storageMix.items.map((i) =>
                              i.storageType === item.storageType ? { ...i, ...updates } : i
                            );
                            updatePayload("storageMix", { ...payload.storageMix, items });
                          }}
                        >
                          #
                        </button>
                        <button
                          type="button"
                          className={cn(
                            "px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                            mode === 'percentage'
                              ? "bg-primary text-primary-foreground"
                              : "bg-background text-muted-foreground hover:bg-muted"
                          )}
                          onClick={() => {
                            const updates: Partial<StorageMixItem> = { occupancyInputMode: 'percentage' as const };
                            if (item.occupiedCount && item.count > 0) {
                              updates.currentOccupancy = Math.round((parseInt(item.occupiedCount) / item.count) * 100).toString();
                            }
                            const items = payload.storageMix.items.map((i) =>
                              i.storageType === item.storageType ? { ...i, ...updates } : i
                            );
                            updatePayload("storageMix", { ...payload.storageMix, items });
                          }}
                        >
                          %
                        </button>
                      </div>
                    </div>
                    {mode === 'percentage' ? (
                      <Input
                        type="number"
                        value={item.currentOccupancy}
                        placeholder="e.g. 85"
                        onChange={(e) => {
                          const pct = e.target.value;
                          const updates: Partial<StorageMixItem> = { currentOccupancy: pct };
                          if (pct && item.count > 0) {
                            updates.occupiedCount = Math.round((parseFloat(pct) / 100) * item.count).toString();
                          }
                          const items = payload.storageMix.items.map((i) =>
                            i.storageType === item.storageType ? { ...i, ...updates } : i
                          );
                          updatePayload("storageMix", { ...payload.storageMix, items });
                        }}
                      />
                    ) : (
                      <Input
                        type="number"
                        value={item.occupiedCount}
                        placeholder="e.g. 42"
                        onChange={(e) => {
                          const occupied = e.target.value;
                          const updates: Partial<StorageMixItem> = { occupiedCount: occupied };
                          if (occupied && item.count > 0) {
                            updates.currentOccupancy = Math.round((parseInt(occupied) / item.count) * 100).toString();
                          }
                          const items = payload.storageMix.items.map((i) =>
                            i.storageType === item.storageType ? { ...i, ...updates } : i
                          );
                          updatePayload("storageMix", { ...payload.storageMix, items });
                        }}
                      />
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium flex items-center gap-2">
                <Fuel className="h-4 w-4" />
                Fuel Dock
              </div>
              <div className="text-sm text-muted-foreground">
                Does this property have a fuel dock?
              </div>
            </div>
            <Switch
              checked={payload.storageMix.hasFuelDock}
              onCheckedChange={(checked) => updatePayload("storageMix", { ...payload.storageMix, hasFuelDock: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Seasonality
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Seasonality Profile</Label>
            <Select
              value={payload.seasonality.profile}
              onValueChange={(v) => updateNestedPayload("seasonality.profile", v)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEASONALITY_PROFILES.map((profile) => (
                  <SelectItem key={profile.value} value={profile.value}>
                    {profile.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {payload.seasonality.profile !== "YEAR_ROUND" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Season Start</Label>
                <Select
                  value={payload.seasonality.seasonStartMonth}
                  onValueChange={(v) => updateNestedPayload("seasonality.seasonStartMonth", v)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Season End</Label>
                <Select
                  value={payload.seasonality.seasonEndMonth}
                  onValueChange={(v) => updateNestedPayload("seasonality.seasonEndMonth", v)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// PROFIT CENTERS SLIDE
// ============================================

function ProfitCentersSlide({ payload, updateNestedPayload }: SlideProps) {
  const profitCenters = [
    {
      key: "commercialTenants",
      label: "Commercial Leases",
      icon: Building2,
      description: "Leasable commercial space",
      fields: [
        { key: "numberOfSuites", label: "Number of Commercial Leases", type: "number" },
        { key: "totalSqFt", label: "Total Sq Ft", type: "number" },
      ],
    },
    {
      key: "fuelSales",
      label: "Fuel Sales",
      icon: Fuel,
      description: "Fuel dock operations",
      fields: [{ key: "pumpsCount", label: "Number of Pumps", type: "number" }],
    },
    {
      key: "shipStore",
      label: "Ship Store",
      icon: ShoppingCart,
      description: "Retail merchandise",
      fields: [{ key: "expectedRevenueBaseline", label: "Expected Annual Revenue ($)", type: "number" }],
    },
    {
      key: "serviceDepartment",
      label: "Service Department",
      icon: Wrench,
      description: "Boat repairs & maintenance",
      fields: [{ key: "numberOfBays", label: "Number of Bays", type: "number" }],
    },
    {
      key: "boatRentals",
      label: "Boat Rentals",
      icon: Ship,
      description: "Charter & rental operations",
      fields: [{ key: "fleetSize", label: "Fleet Size", type: "number" }],
    },
    {
      key: "boatClub",
      label: "Boat Club",
      icon: Anchor,
      description: "Membership-based boat access",
      fields: [
        { key: "memberCapacity", label: "Member Capacity", type: "number" },
        { key: "monthlyDues", label: "Monthly Dues ($)", type: "number" },
      ],
    },
    {
      key: "boatSales",
      label: "Boat Sales",
      icon: DollarSign,
      description: "New & used boat sales",
      fields: [{ key: "expectedAnnualRevenue", label: "Expected Annual Revenue ($)", type: "number" }],
    },
    {
      key: "parkingLot",
      label: "Parking Lot",
      icon: Car,
      description: "Parking lot & surface lot revenue",
      fields: [
        { key: "totalSpaces", label: "Total Parking Spaces", type: "number" },
        { key: "avgDailyRate", label: "Average Daily Rate ($)", type: "number" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-2">Profit Centers</h3>
        <p className="text-muted-foreground">
          Configure ancillary revenue streams for this property.
        </p>
      </div>

      <div className="space-y-4">
        {profitCenters.map((pc) => {
          const config = payload.profitCenters[pc.key as keyof typeof payload.profitCenters];
          const Icon = pc.icon;

          return (
            <Card key={pc.key}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="font-medium">{pc.label}</div>
                      <div className="text-sm text-muted-foreground">{pc.description}</div>
                    </div>
                  </div>
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={(checked) =>
                      updateNestedPayload(`profitCenters.${pc.key}.enabled`, checked)
                    }
                  />
                </div>

                {config.enabled && (
                  <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4">
                    {pc.fields.map((field) => (
                      <div key={field.key}>
                        <Label className="text-sm">{field.label}</Label>
                        <Input
                          type={field.type}
                          value={(config as any)[field.key] || ""}
                          onChange={(e) =>
                            updateNestedPayload(`profitCenters.${pc.key}.${field.key}`, e.target.value)
                          }
                          className="mt-1"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
// ============================================
// FINANCIAL SCOPE SLIDE
// ============================================

function FinancialScopeSlide({ payload, updateNestedPayload }: SlideProps) {
  const toggleYear = (year: number) => {
    const years = payload.financialScope.historicalYears;
    if (years.includes(year)) {
      updateNestedPayload("financialScope.historicalYears", years.filter((y) => y !== year));
    } else {
      updateNestedPayload("financialScope.historicalYears", [...years, year].sort((a, b) => b - a));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-2">Financial Data Scope</h3>
        <p className="text-muted-foreground">
          Define the historical financial data you'll be working with.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Historical P&L Years</CardTitle>
          <CardDescription>Select years of historical data available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {HISTORICAL_YEARS.map((year) => {
              const isSelected = payload.financialScope.historicalYears.includes(year);
              return (
                <Badge
                  key={year}
                  variant={isSelected ? "default" : "outline"}
                  className="cursor-pointer px-4 py-2 transition-colors"
                  onClick={() => toggleYear(year)}
                >
                  {year}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Include T12 (Trailing 12 Months)</div>
              <div className="text-sm text-muted-foreground">
                Use most recent 12-month period
              </div>
            </div>
            <Switch
              checked={payload.financialScope.includeT12}
              onCheckedChange={(checked) => updateNestedPayload("financialScope.includeT12", checked)}
            />
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Fiscal Year End Month</Label>
              <Select
                value={payload.financialScope.fiscalYearEndMonth}
                onValueChange={(v) => updateNestedPayload("financialScope.fiscalYearEndMonth", v)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Accounting Basis</Label>
              <Select
                value={payload.financialScope.accountingBasis}
                onValueChange={(v) => updateNestedPayload("financialScope.accountingBasis", v)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash Basis</SelectItem>
                  <SelectItem value="ACCRUAL">Accrual Basis</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// UNDERWRITING SLIDE
// ============================================

function UnderwritingSlide({ payload, updateNestedPayload }: SlideProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-2">Underwriting Defaults</h3>
        <p className="text-muted-foreground">
          Set your baseline assumptions for the valuation model.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Growth Assumptions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>Revenue Growth (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={payload.underwriting.revenueGrowthPercent}
                onChange={(e) => updateNestedPayload("underwriting.revenueGrowthPercent", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Expense Growth (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={payload.underwriting.expenseGrowthPercent}
                onChange={(e) => updateNestedPayload("underwriting.expenseGrowthPercent", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Occupancy Growth (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={payload.underwriting.occupancyGrowthPercent}
                onChange={(e) => updateNestedPayload("underwriting.occupancyGrowthPercent", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Target Occupancy (%)</Label>
              <Input
                type="number"
                value={payload.underwriting.targetOccupancy}
                onChange={(e) => updateNestedPayload("underwriting.targetOccupancy", e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Exit Assumptions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>Exit Cap Rate (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={payload.underwriting.capRateExit}
                onChange={(e) => updateNestedPayload("underwriting.capRateExit", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Exit Year</Label>
              <Input
                type="number"
                value={payload.underwriting.exitYear}
                onChange={(e) => updateNestedPayload("underwriting.exitYear", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Discount Rate (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={payload.underwriting.discountRate}
                onChange={(e) => updateNestedPayload("underwriting.discountRate", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Hold Period (yrs)</Label>
              <Input
                type="number"
                value={payload.underwriting.holdPeriodYears}
                onChange={(e) => updateNestedPayload("underwriting.holdPeriodYears", e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// DOCUMENTS SLIDE
// ============================================

interface WizardStagedFile {
  id: string;
  file: File;
  label: string;
  rentRollSubType: string;
}

const WIZARD_STORAGE_TYPE_LABELS: Record<string, string> = {
  WET_SLIPS: "Wet Slips",
  DRY_STACK: "Dry Stack Racks",
  MOORINGS: "Moorings",
  TRAILER_STORAGE: "Trailer Storage",
  RV_STORAGE: "RV Storage",
  SERVICE_BAYS: "Service Bays",
};

function DocumentsSlide({
  payload,
  stagedFiles,
  onAddFiles,
  onRemoveFile,
  onUpdateSubType,
}: {
  payload: WizardFormData;
  stagedFiles: WizardStagedFile[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (id: string) => void;
  onUpdateSubType: (id: string, subType: string) => void;
}) {
  const storageTypes = payload.storageMix.items
    .filter((item) => item.count > 0)
    .map((item) => ({
      value: item.storageType,
      label: WIZARD_STORAGE_TYPE_LABELS[item.storageType] || item.storageType.replace(/_/g, ' '),
    }));

  const allStorageTypes = storageTypes.length > 0
    ? storageTypes
    : Object.entries(WIZARD_STORAGE_TYPE_LABELS).map(([value, label]) => ({ value, label }));

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    onAddFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onAddFiles(Array.from(e.target.files));
    }
    e.target.value = '';
  };

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Upload Documents</h2>
        <p className="text-muted-foreground mt-1">
          Upload rent roll documents for your storage units. These will be sent to AI processing when the project is created.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Storage Rent Rolls
          </CardTitle>
          <CardDescription>
            Drag and drop rent roll files here, or click to browse. Supported formats: Excel, CSV, PDF.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors border-muted-foreground/25 hover:border-primary/50"
            onClick={() => document.getElementById('wizard-file-input')?.click()}
          >
            <input
              id="wizard-file-input"
              type="file"
              multiple
              accept=".xlsx,.xls,.csv,.pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">Drag & drop rent roll files here</p>
            <p className="text-sm text-muted-foreground mt-1">or click to browse your files</p>
            <p className="text-xs text-muted-foreground mt-3">
              Supported formats: Excel (.xlsx, .xls), CSV, PDF
            </p>
          </div>

          {stagedFiles.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Staged Files ({stagedFiles.length})</h4>
              {stagedFiles.map((sf) => (
                <div key={sf.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="flex-shrink-0">
                    {sf.file.name.endsWith('.pdf') ? (
                      <FileText className="h-5 w-5 text-red-500" />
                    ) : (
                      <FileSpreadsheet className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{sf.file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(sf.file.size)}</p>
                  </div>
                  <Select
                    value={sf.rentRollSubType}
                    onValueChange={(v) => onUpdateSubType(sf.id, v)}
                  >
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                      <SelectValue placeholder="Storage type" />
                    </SelectTrigger>
                    <SelectContent>
                      {allStorageTypes.map((st) => (
                        <SelectItem key={st.value} value={st.value}>
                          {st.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => onRemoveFile(sf.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {stagedFiles.length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This step is optional. You can also upload documents later from the Storage Leases section in the workspace.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// REVIEW SLIDE
// ============================================

function ReviewSlide({
  payload,
  isCreating,
  error,
  stagedDocumentCount,
}: {
  payload: WizardFormData;
  isCreating: boolean;
  error: string | null;
  stagedDocumentCount?: number;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-2">Review & Create</h3>
        <p className="text-muted-foreground">
          Review your project configuration before creating.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Project</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{payload.name || "Unnamed Project"}</p>
            <p className="text-sm text-muted-foreground">
              {ASSET_TYPES.find((t) => t.value === payload.assetType)?.label}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Location</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {payload.location.city && payload.location.state
                ? `${payload.location.city}, ${payload.location.state}`
                : "No location set"}
            </p>
            {payload.location.streetAddress && (
              <p className="text-sm text-muted-foreground">{payload.location.streetAddress}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Storage Types</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {payload.storageMix.items.length} types configured
            </p>
            <div className="flex flex-wrap gap-1 mt-1">
              {payload.storageMix.items.slice(0, 3).map((item) => (
                <Badge key={item.storageType} variant="secondary" className="text-xs">
                  {STORAGE_TYPES.find((t) => t.value === item.storageType)?.label}
                </Badge>
              ))}
              {payload.storageMix.items.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{payload.storageMix.items.length - 3} more
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Acquisition</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {payload.acquisition.purchasePrice
                ? `$${parseInt(payload.acquisition.purchasePrice).toLocaleString()}`
                : "Not set"}
            </p>
            {payload.ebitda && (
              <p className="text-sm text-muted-foreground">EBITDA: ${parseInt(payload.ebitda).toLocaleString()}</p>
            )}
            {payload.acquisition.ltv && (
              <p className="text-sm text-muted-foreground">LTV: {payload.acquisition.ltv}%</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit Centers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {Object.values(payload.profitCenters).filter((p) => p.enabled).length} enabled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Financial Scope</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {payload.financialScope.historicalYears.length} year{payload.financialScope.historicalYears.length !== 1 ? 's' : ''} of P&L
            </p>
            {payload.financialScope.includeT12 && (
              <Badge variant="secondary" className="text-xs mt-1">+ T12 Statement</Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Underwriting</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-0.5">
              <p>Revenue Growth: {payload.underwriting.revenueGrowthPercent || 3}%</p>
              <p>Hold Period: {payload.underwriting.holdPeriodYears || 5} years</p>
              {payload.underwriting.capRateExit && (
                <p>Exit Cap: {payload.underwriting.capRateExit}%</p>
              )}
            </div>
          </CardContent>
        </Card>
        {(stagedDocumentCount ?? 0) > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">
                {stagedDocumentCount} rent roll{stagedDocumentCount !== 1 ? 's' : ''} staged
              </p>
              <p className="text-sm text-muted-foreground">Will be uploaded for AI processing</p>
            </CardContent>
          </Card>
        )}
      </div>

      {isCreating && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Creating project...</span>
        </div>
      )}
    </div>
  );
}

// ============================================
// SYNC STATUS INDICATOR
// ============================================

function SyncStatusIndicator({ isSyncing, isOffline }: { isSyncing: boolean; isOffline: boolean }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5">
            {isSyncing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Saving...</span>
              </>
            ) : isOffline ? (
              <>
                <CloudOff className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs text-amber-500">Offline</span>
              </>
            ) : (
              <>
                <Cloud className="h-3.5 w-3.5 text-green-500" />
                <span className="text-xs text-green-500">Saved</span>
              </>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {isSyncing ? "Saving your progress..." : isOffline ? "Working offline - saved locally" : "All changes saved"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
// ============================================
// MAIN WIZARD COMPONENT
// ============================================

export default function SetupWizard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  // State for project creation
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [wizardStagedFiles, setWizardStagedFiles] = useState<WizardStagedFile[]>([]);

  const handleAddWizardFiles = useCallback((files: File[]) => {
    const defaultSubType = 'WET_SLIPS';
    const newFiles: WizardStagedFile[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      label: file.name,
      rentRollSubType: defaultSubType,
    }));
    setWizardStagedFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleRemoveWizardFile = useCallback((id: string) => {
    setWizardStagedFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleUpdateWizardSubType = useCallback((id: string, subType: string) => {
    setWizardStagedFiles((prev) => prev.map((f) => f.id === id ? { ...f, rentRollSubType: subType } : f));
  }, []);

  // Initialize the draft persistence hook
  const {
    draft,
    isLoading: isDraftLoading,
    isInitialized,
    isSyncing,
    isOffline,
    needsVersionMigration,
    payload,
    currentStepId,
    completedStepIds,
    initializeDraft,
    updatePayload,
    updateNestedPayload,
    setCurrentStep,
    markStepComplete,
    clearDraft,
    showResumeModal,
    pendingDraft,
    resumeDraft,
    startOver,
    dismissResumeModal,
  } = useWizardDraft<WizardFormData>("newProject", {
    defaultPayload: DEFAULT_FORM_DATA,
    defaultStepId: "welcome",
    onRestored: () => {
      toast({
        title: "Welcome back!",
        description: "Your progress has been restored.",
      });
    },
  });

  // Get current step index from step ID
  const currentStepIndex = useMemo(() => getStepIndex(currentStepId), [currentStepId]);

  // Initialize draft when component mounts (if no existing draft)
  useEffect(() => {
    if (isInitialized && !draft && !showResumeModal) {
      initializeDraft();
    }
  }, [isInitialized, draft, showResumeModal, initializeDraft]);

  // Navigation handlers
  const goToStep = useCallback((stepId: StepId) => {
    const newIndex = getStepIndex(stepId);
    if (newIndex > currentStepIndex && currentStepId !== "review") {
      markStepComplete(currentStepId);
    }
    setCurrentStep(stepId);
  }, [currentStepIndex, currentStepId, markStepComplete, setCurrentStep]);

  const nextStep = useCallback(() => {
    if (currentStepIndex < WIZARD_STEPS.length - 1) {
      markStepComplete(currentStepId);
      goToStep(getStepId(currentStepIndex + 1));
    }
  }, [currentStepIndex, currentStepId, markStepComplete, goToStep]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      goToStep(getStepId(currentStepIndex - 1));
    }
  }, [currentStepIndex, goToStep]);

  // Validation for current step
  const canProceed = useCallback(() => {
    switch (currentStepId) {
      case "welcome":
        return true;
      case "deal-details":
        return !!payload.name && !!payload.assetType;
      case "storage-mix":
      case "profit-centers":
      case "financial-scope":
      case "underwriting":
      case "documents":
        return true;
      case "review":
        return !!payload.name && !!payload.assetType && !isCreating;
      default:
        return false;
    }
  }, [currentStepId, payload.name, payload.assetType, isCreating]);

  // Handle project creation
  const createProject = useCallback(async () => {
    setIsCreating(true);
    setErrorMessage(null);

    try {
      const parseNumber = (s: string) => {
        const n = parseFloat(s);
        return isNaN(n) ? undefined : n;
      };

      const totalUnits = payload.storageMix.items.reduce((sum, item) => sum + (item.count || 0), 0);

      const input: Record<string, any> = {
        marinaName: payload.name,
        address: payload.location.streetAddress || undefined,
        city: payload.location.city || undefined,
        state: payload.location.state || undefined,
        zipCode: payload.location.zipCode || undefined,
        purchasePrice: payload.acquisition.purchasePrice || undefined,
        ebitda: payload.ebitda || undefined,
        dealSource: ["direct_to_seller", "broker", "owned_marina"].includes(payload.dealSource)
          ? payload.dealSource
          : payload.dealSource === "direct" ? "direct_to_seller" : undefined,
        totalStorageUnits: totalUnits || undefined,
        customMetrics: {
          wizardVersion: 2,
          assetType: payload.assetType,
          propertyName: payload.propertyName || undefined,
          dealSourceDetail: payload.dealSource || undefined,
          country: payload.location.country || undefined,
          storageMix: {
            items: payload.storageMix.items.map((item) => ({
              storageType: item.storageType,
              count: item.count,
              avgRate: parseNumber(item.avgRate),
              currentOccupancy: parseNumber(item.currentOccupancy),
              occupiedCount: parseNumber(item.occupiedCount),
              occupancyInputMode: item.occupancyInputMode || 'percentage',
            })),
            hasFuelDock: payload.storageMix.hasFuelDock,
          },
          profitCenters: {
            commercialTenants: {
              enabled: payload.profitCenters.commercialTenants.enabled,
              numberOfSuites: parseNumber(payload.profitCenters.commercialTenants.numberOfSuites),
              totalSqFt: parseNumber(payload.profitCenters.commercialTenants.totalSqFt),
            },
            fuelSales: {
              enabled: payload.profitCenters.fuelSales.enabled,
              pumpsCount: parseNumber(payload.profitCenters.fuelSales.pumpsCount),
            },
            shipStore: {
              enabled: payload.profitCenters.shipStore.enabled,
              expectedRevenueBaseline: parseNumber(payload.profitCenters.shipStore.expectedRevenueBaseline),
            },
            serviceDepartment: {
              enabled: payload.profitCenters.serviceDepartment.enabled,
              numberOfBays: parseNumber(payload.profitCenters.serviceDepartment.numberOfBays),
            },
            boatRentals: {
              enabled: payload.profitCenters.boatRentals.enabled,
              fleetSize: parseNumber(payload.profitCenters.boatRentals.fleetSize),
            },
            boatClub: {
              enabled: payload.profitCenters.boatClub.enabled,
              memberCapacity: parseNumber(payload.profitCenters.boatClub.memberCapacity),
              monthlyDues: parseNumber(payload.profitCenters.boatClub.monthlyDues),
            },
            boatSales: {
              enabled: payload.profitCenters.boatSales.enabled,
              expectedAnnualRevenue: parseNumber(payload.profitCenters.boatSales.expectedAnnualRevenue),
            },
            parkingLot: {
              enabled: payload.profitCenters.parkingLot.enabled,
              totalSpaces: parseNumber(payload.profitCenters.parkingLot.totalSpaces),
              avgDailyRate: parseNumber(payload.profitCenters.parkingLot.avgDailyRate),
            },
          },
          seasonality: {
            profile: payload.seasonality.profile,
            seasonStartMonth: parseNumber(payload.seasonality.seasonStartMonth),
            seasonEndMonth: parseNumber(payload.seasonality.seasonEndMonth),
          },
          financialScope: {
            historicalYears: payload.financialScope.historicalYears,
            includeT12: payload.financialScope.includeT12,
            fiscalYearEndMonth: parseInt(payload.financialScope.fiscalYearEndMonth) || 12,
            accountingBasis: payload.financialScope.accountingBasis,
          },
          underwriting: {
            revenueGrowthPercent: parseNumber(payload.underwriting.revenueGrowthPercent) || 3,
            expenseGrowthPercent: parseNumber(payload.underwriting.expenseGrowthPercent) || 2.5,
            occupancyGrowthPercent: parseNumber(payload.underwriting.occupancyGrowthPercent) || 0,
            targetOccupancy: parseNumber(payload.underwriting.targetOccupancy) || 95,
            capRateExit: parseNumber(payload.underwriting.capRateExit),
            exitYear: parseInt(payload.underwriting.exitYear) || 5,
            discountRate: parseNumber(payload.underwriting.discountRate),
            holdPeriodYears: parseInt(payload.underwriting.holdPeriodYears) || 5,
          },
          acquisition: {
            targetClosingDate: payload.acquisition.targetClosingDate || undefined,
            closingCostsDollar: parseNumber(payload.acquisition.closingCostsDollar),
            closingCostsPercent: parseNumber(payload.acquisition.closingCostsPercent),
            equityInvested: parseNumber(payload.acquisition.equityInvested),
            debtAmount: parseNumber(payload.acquisition.debtAmount),
            ltv: parseNumber(payload.acquisition.ltv),
          },
          loanTerms: {
            interestRate: parseNumber(payload.loanTerms.interestRate),
            amortizationYears: parseInt(payload.loanTerms.amortizationYears) || undefined,
            termYears: parseInt(payload.loanTerms.termYears) || undefined,
            ioMonths: parseInt(payload.loanTerms.ioMonths) || undefined,
          },
        },
      };

      const csrfMatch = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
      const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;

      const response = await fetch("/api/modeling/projects", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(input),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.details?.[0]?.message || "Failed to create project");
      }

      if (result.id && wizardStagedFiles.length > 0) {
        let uploadCount = 0;
        for (const sf of wizardStagedFiles) {
          try {
            const formData = new FormData();
            formData.append("file", sf.file);
            formData.append("docType", "rent_roll");
            formData.append("year", new Date().getFullYear().toString());
            formData.append("dataGranularity", "monthly");
            formData.append("rentRollSubType", sf.rentRollSubType);

            const uploadHeaders: Record<string, string> = {};
            if (csrfToken) uploadHeaders["X-CSRF-Token"] = csrfToken;

            await fetch(`/api/modeling/projects/${result.id}/documents`, {
              method: "POST",
              body: formData,
              headers: uploadHeaders,
              credentials: "include",
            });
            uploadCount++;
          } catch (err) {
            console.error("[SETUP_WIZARD] Failed to upload file:", sf.file.name, err);
          }
        }
        if (uploadCount > 0) {
          toast({
            title: "Documents uploaded",
            description: `${uploadCount} rent roll${uploadCount > 1 ? 's' : ''} queued for AI processing.`,
          });
        }
      }

      await onWizardSubmitSuccess("newProject", user?.id || null);
      await clearDraft();

      toast({
        title: "Project created!",
        description: `${payload.name} has been created successfully.`,
      });

      if (result.id) {
        const redirectTab = wizardStagedFiles.length > 0 ? '?tab=storage-leases' : '';
        setLocation(`/modeling/projects/${result.id}${redirectTab}`);
      } else {
        setLocation("/modeling/projects");
      }
    } catch (error: any) {
      console.error("[SETUP_WIZARD] Creation error:", error);
      setErrorMessage(error.message || "Failed to create project");
      toast({
        title: "Error",
        description: error.message || "Failed to create project",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  }, [payload, user?.id, clearDraft, toast, setLocation, wizardStagedFiles]);

  // Handle next/submit
  const handleNext = useCallback(async () => {
    if (currentStepId === "review") {
      await createProject();
    } else {
      nextStep();
    }
  }, [currentStepId, createProject, nextStep]);

  // Progress percentage
  const progress = ((currentStepIndex + 1) / WIZARD_STEPS.length) * 100;

  // Loading state
  if (isDraftLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading wizard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Resume Modal */}
      <ResumeDraftModal
        open={showResumeModal}
        draft={pendingDraft}
        needsVersionMigration={needsVersionMigration}
        stepLabels={STEP_LABELS}
        onResume={resumeDraft}
        onStartOver={startOver}
        onDismiss={() => {
          dismissResumeModal();
          if (!draft) initializeDraft();
        }}
      />

      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold">Setup Wizard</h1>
              <SyncStatusIndicator isSyncing={isSyncing} isOffline={isOffline} />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Step {currentStepIndex + 1} of {WIZARD_STEPS.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={startOver}
                disabled={isCreating}
                className="text-muted-foreground"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Start Over
              </Button>
            </div>
          </div>
          <Progress value={progress} className="h-2" />

          {/* Step indicators */}
          <div className="hidden md:flex justify-between mt-4">
            {WIZARD_STEPS.map((step, i) => {
              const isCompleted = completedStepIds.includes(step.id);
              const isCurrent = i === currentStepIndex;
              const isClickable = i < currentStepIndex;

              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-2 text-xs transition-colors",
                    isClickable && "cursor-pointer hover:text-primary",
                    i <= currentStepIndex ? "text-primary" : "text-muted-foreground"
                  )}
                  onClick={() => isClickable && goToStep(step.id)}
                >
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
                      isCompleted
                        ? "bg-primary text-primary-foreground"
                        : isCurrent
                        ? "bg-primary/20 text-primary border border-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {isCompleted ? <Check className="h-3 w-3" /> : i + 1}
                  </div>
                  <span className="hidden lg:inline">{step.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-8 pb-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStepId}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {currentStepId === "welcome" && <WelcomeSlide />}
            {currentStepId === "deal-details" && (
              <DealDetailsSlide
                payload={payload}
                updatePayload={updatePayload}
                updateNestedPayload={updateNestedPayload}
              />
            )}
            {currentStepId === "storage-mix" && (
              <StorageMixSlide
                payload={payload}
                updatePayload={updatePayload}
                updateNestedPayload={updateNestedPayload}
              />
            )}
            {currentStepId === "profit-centers" && (
              <ProfitCentersSlide
                payload={payload}
                updatePayload={updatePayload}
                updateNestedPayload={updateNestedPayload}
              />
            )}
            {currentStepId === "financial-scope" && (
              <FinancialScopeSlide
                payload={payload}
                updatePayload={updatePayload}
                updateNestedPayload={updateNestedPayload}
              />
            )}
            {currentStepId === "underwriting" && (
              <UnderwritingSlide
                payload={payload}
                updatePayload={updatePayload}
                updateNestedPayload={updateNestedPayload}
              />
            )}
            {currentStepId === "documents" && (
              <DocumentsSlide
                payload={payload}
                stagedFiles={wizardStagedFiles}
                onAddFiles={handleAddWizardFiles}
                onRemoveFile={handleRemoveWizardFile}
                onUpdateSubType={handleUpdateWizardSubType}
              />
            )}
            {currentStepId === "review" && (
              <ReviewSlide
                payload={payload}
                isCreating={isCreating}
                error={errorMessage}
                stagedDocumentCount={wizardStagedFiles.length}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between">
          <Button
            variant="ghost"
            onClick={prevStep}
            disabled={currentStepIndex === 0 || isCreating}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : currentStepId === "review" ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Create Project
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}