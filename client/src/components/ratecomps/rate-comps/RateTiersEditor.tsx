import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Plus, Pencil, Trash2, DollarSign, Anchor, Ruler, Zap, Droplet, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatRateDisplay, formatNormalizedRate, formatSizeRange, STORAGE_TYPE_LABELS, RATE_PERIOD_LABELS, RATE_UNIT_LABELS, PROTECTION_LEVEL_LABELS } from "@shared/ratecomps-utils";
import type { RateTier } from "@shared/schema";

interface RateTiersEditorProps {
  rateCompId: string;
  marinaName: string;
  onTiersUpdated?: () => void;
}

interface TierFormData {
  tierLabel: string;
  storageType: string;
  sizeBasis: string;
  loaMin: string;
  loaMax: string;
  beamMin: string;
  beamMax: string;
  categoryLabel: string;
  rateUnit: string;
  ratePeriod: string;
  amountCents: string;
  seasonality: string;
  seasonStartMonth: string;
  seasonEndMonth: string;
  effectiveDate: string;
  expirationDate: string;
  isCurrentRate: boolean;
  minTermMonths: string;
  depositRequired: boolean;
  depositAmountCents: string;
  electricIncluded: boolean;
  electricAmps: string;
  electricAdditionalCents: string;
  waterIncluded: boolean;
  wifiIncluded: boolean;
  pumpOutIncluded: boolean;
  protectionLevel: string;
  isCovered: boolean;
  liveaboardAllowed: boolean;
  liveaboardAdditionalCents: string;
  taxesIncluded: boolean;
  taxRate: string;
  waitlistOnly: boolean;
  availabilityNotes: string;
  notes: string;
}

const EMPTY_TIER_FORM: TierFormData = {
  tierLabel: '',
  storageType: 'wet_slip',
  sizeBasis: 'loa_range',
  loaMin: '',
  loaMax: '',
  beamMin: '',
  beamMax: '',
  categoryLabel: '',
  rateUnit: 'per_foot',
  ratePeriod: 'monthly',
  amountCents: '',
  seasonality: 'annual',
  seasonStartMonth: '',
  seasonEndMonth: '',
  effectiveDate: '',
  expirationDate: '',
  isCurrentRate: true,
  minTermMonths: '',
  depositRequired: false,
  depositAmountCents: '',
  electricIncluded: false,
  electricAmps: '',
  electricAdditionalCents: '',
  waterIncluded: true,
  wifiIncluded: false,
  pumpOutIncluded: false,
  protectionLevel: 'open',
  isCovered: false,
  liveaboardAllowed: false,
  liveaboardAdditionalCents: '',
  taxesIncluded: false,
  taxRate: '',
  waitlistOnly: false,
  availabilityNotes: '',
  notes: '',
};

function tierToFormData(tier: RateTier): TierFormData {
  return {
    tierLabel: tier.tierLabel || '',
    storageType: tier.storageType || 'wet_slip',
    sizeBasis: tier.sizeBasis || 'loa_range',
    loaMin: tier.loaMin?.toString() || '',
    loaMax: tier.loaMax?.toString() || '',
    beamMin: tier.beamMin?.toString() || '',
    beamMax: tier.beamMax?.toString() || '',
    categoryLabel: tier.categoryLabel || '',
    rateUnit: tier.rateUnit || 'per_foot',
    ratePeriod: tier.ratePeriod || 'monthly',
    amountCents: tier.amountCents ? (tier.amountCents / 100).toString() : '',
    seasonality: tier.seasonality || 'annual',
    seasonStartMonth: tier.seasonStartMonth?.toString() || '',
    seasonEndMonth: tier.seasonEndMonth?.toString() || '',
    effectiveDate: tier.effectiveDate || '',
    expirationDate: tier.expirationDate || '',
    isCurrentRate: tier.isCurrentRate ?? true,
    minTermMonths: tier.minTermMonths?.toString() || '',
    depositRequired: tier.depositRequired ?? false,
    depositAmountCents: tier.depositAmountCents ? (tier.depositAmountCents / 100).toString() : '',
    electricIncluded: tier.electricIncluded ?? false,
    electricAmps: tier.electricAmps?.join(', ') || '',
    electricAdditionalCents: tier.electricAdditionalCents ? (tier.electricAdditionalCents / 100).toString() : '',
    waterIncluded: tier.waterIncluded ?? true,
    wifiIncluded: tier.wifiIncluded ?? false,
    pumpOutIncluded: tier.pumpOutIncluded ?? false,
    protectionLevel: tier.protectionLevel || 'open',
    isCovered: tier.isCovered ?? false,
    liveaboardAllowed: tier.liveaboardAllowed ?? false,
    liveaboardAdditionalCents: tier.liveaboardAdditionalCents ? (tier.liveaboardAdditionalCents / 100).toString() : '',
    taxesIncluded: tier.taxesIncluded ?? false,
    taxRate: tier.taxRate || '',
    waitlistOnly: tier.waitlistOnly ?? false,
    availabilityNotes: tier.availabilityNotes || '',
    notes: tier.notes || '',
  };
}

function formDataToTier(data: TierFormData): any {
  return {
    tierLabel: data.tierLabel || null,
    storageType: data.storageType,
    sizeBasis: data.sizeBasis,
    loaMin: data.loaMin ? parseInt(data.loaMin) : null,
    loaMax: data.loaMax ? parseInt(data.loaMax) : null,
    beamMin: data.beamMin ? parseInt(data.beamMin) : null,
    beamMax: data.beamMax ? parseInt(data.beamMax) : null,
    categoryLabel: data.categoryLabel || null,
    rateUnit: data.rateUnit,
    ratePeriod: data.ratePeriod,
    amountCents: data.amountCents ? Math.round(parseFloat(data.amountCents) * 100) : 0,
    seasonality: data.seasonality,
    seasonStartMonth: data.seasonStartMonth ? parseInt(data.seasonStartMonth) : null,
    seasonEndMonth: data.seasonEndMonth ? parseInt(data.seasonEndMonth) : null,
    effectiveDate: data.effectiveDate || null,
    expirationDate: data.expirationDate || null,
    isCurrentRate: data.isCurrentRate,
    minTermMonths: data.minTermMonths ? parseInt(data.minTermMonths) : null,
    depositRequired: data.depositRequired,
    depositAmountCents: data.depositAmountCents ? Math.round(parseFloat(data.depositAmountCents) * 100) : null,
    electricIncluded: data.electricIncluded,
    electricAmps: data.electricAmps ? data.electricAmps.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)) : [],
    electricAdditionalCents: data.electricAdditionalCents ? Math.round(parseFloat(data.electricAdditionalCents) * 100) : null,
    waterIncluded: data.waterIncluded,
    wifiIncluded: data.wifiIncluded,
    pumpOutIncluded: data.pumpOutIncluded,
    protectionLevel: data.protectionLevel || null,
    isCovered: data.isCovered,
    liveaboardAllowed: data.liveaboardAllowed,
    liveaboardAdditionalCents: data.liveaboardAdditionalCents ? Math.round(parseFloat(data.liveaboardAdditionalCents) * 100) : null,
    taxesIncluded: data.taxesIncluded,
    taxRate: data.taxRate || null,
    waitlistOnly: data.waitlistOnly,
    availabilityNotes: data.availabilityNotes || null,
    notes: data.notes || null,
  };
}

function TierCard({ tier, onEdit, onDelete, onDuplicate }: { 
  tier: RateTier; 
  onEdit: () => void; 
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={`transition-all ${!tier.isCurrentRate ? 'opacity-60' : ''}`} data-testid={`tier-card-${tier.id}`}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant={tier.isCurrentRate ? "default" : "secondary"}>
              {STORAGE_TYPE_LABELS[tier.storageType] || tier.storageType}
            </Badge>
            <span className="font-semibold text-base">
              {formatRateDisplay(tier.amountCents, tier.rateUnit, tier.ratePeriod)}
            </span>
            {tier.normalizedValue && (
              <span className="text-xs text-muted-foreground">
                ({formatNormalizedRate(tier.normalizedValue)})
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onDuplicate} data-testid={`button-duplicate-tier-${tier.id}`}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onEdit} data-testid={`button-edit-tier-${tier.id}`}>
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" data-testid={`button-delete-tier-${tier.id}`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Rate Tier</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this rate tier? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
          <Ruler className="h-3 w-3" />
          <span>{formatSizeRange(tier.loaMin, tier.loaMax, tier.categoryLabel)}</span>
          {tier.tierLabel && (
            <>
              <span>•</span>
              <span>{tier.tierLabel}</span>
            </>
          )}
          {!tier.isCurrentRate && (
            <>
              <span>•</span>
              <Badge variant="outline" className="text-xs">Historical</Badge>
            </>
          )}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 pb-3 px-4">
          <Separator className="mb-3" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <Label className="text-xs text-muted-foreground">Period</Label>
              <p>{RATE_PERIOD_LABELS[tier.ratePeriod] || tier.ratePeriod}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Rate Type</Label>
              <p>{RATE_UNIT_LABELS[tier.rateUnit] || tier.rateUnit}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Protection</Label>
              <p>{PROTECTION_LEVEL_LABELS[tier.protectionLevel || 'open']}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Seasonality</Label>
              <p className="capitalize">{tier.seasonality || 'Annual'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {tier.electricIncluded && (
              <Badge variant="outline" className="gap-1">
                <Zap className="h-3 w-3" /> Electric
                {tier.electricAmps && tier.electricAmps.length > 0 && ` (${tier.electricAmps.join('/')}A)`}
              </Badge>
            )}
            {tier.waterIncluded && (
              <Badge variant="outline" className="gap-1">
                <Droplet className="h-3 w-3" /> Water
              </Badge>
            )}
            {tier.wifiIncluded && <Badge variant="outline">WiFi</Badge>}
            {tier.pumpOutIncluded && <Badge variant="outline">Pump Out</Badge>}
            {tier.isCovered && <Badge variant="outline">Covered</Badge>}
            {tier.liveaboardAllowed && <Badge variant="outline">Liveaboard OK</Badge>}
            {tier.waitlistOnly && <Badge variant="destructive">Waitlist Only</Badge>}
          </div>
          {tier.notes && (
            <p className="text-xs text-muted-foreground mt-2">{tier.notes}</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function TierFormDialog({ 
  open, 
  onOpenChange, 
  initialData, 
  onSubmit, 
  isSubmitting,
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: TierFormData;
  onSubmit: (data: TierFormData) => void;
  isSubmitting: boolean;
  title: string;
  description: string;
}) {
  const [formData, setFormData] = useState<TierFormData>(initialData);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleChange = (field: keyof TierFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tierLabel">Tier Label</Label>
                  <Input
                    id="tierLabel"
                    value={formData.tierLabel}
                    onChange={e => handleChange('tierLabel', e.target.value)}
                    placeholder="e.g., Premium Slip, Economy Tier"
                    data-testid="input-tier-label"
                  />
                </div>
                <div>
                  <Label htmlFor="storageType">Storage Type</Label>
                  <Select value={formData.storageType} onValueChange={v => handleChange('storageType', v)}>
                    <SelectTrigger data-testid="select-storage-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STORAGE_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />
              <p className="text-sm font-medium">Size Range</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sizeBasis">Size Basis</Label>
                  <Select value={formData.sizeBasis} onValueChange={v => handleChange('sizeBasis', v)}>
                    <SelectTrigger data-testid="select-size-basis">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="loa_range">LOA Range</SelectItem>
                      <SelectItem value="exact_loa">Exact LOA</SelectItem>
                      <SelectItem value="beam">By Beam</SelectItem>
                      <SelectItem value="category">By Category</SelectItem>
                      <SelectItem value="any">Any Size</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.sizeBasis === 'category' ? (
                  <div>
                    <Label htmlFor="categoryLabel">Category Name</Label>
                    <Input
                      id="categoryLabel"
                      value={formData.categoryLabel}
                      onChange={e => handleChange('categoryLabel', e.target.value)}
                      placeholder="e.g., Small Boat, Day Sailor"
                      data-testid="input-category-label"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="loaMin">LOA Min (ft)</Label>
                      <Input
                        id="loaMin"
                        type="number"
                        value={formData.loaMin}
                        onChange={e => handleChange('loaMin', e.target.value)}
                        placeholder="e.g., 20"
                        data-testid="input-loa-min"
                      />
                    </div>
                    <div>
                      <Label htmlFor="loaMax">LOA Max (ft)</Label>
                      <Input
                        id="loaMax"
                        type="number"
                        value={formData.loaMax}
                        onChange={e => handleChange('loaMax', e.target.value)}
                        placeholder="e.g., 30"
                        data-testid="input-loa-max"
                      />
                    </div>
                  </div>
                )}
              </div>

              <Separator />
              <p className="text-sm font-medium">Pricing</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="amountCents">Rate Amount ($)</Label>
                  <Input
                    id="amountCents"
                    type="number"
                    step="0.01"
                    value={formData.amountCents}
                    onChange={e => handleChange('amountCents', e.target.value)}
                    placeholder="e.g., 25.00"
                    data-testid="input-amount"
                  />
                </div>
                <div>
                  <Label htmlFor="rateUnit">Rate Unit</Label>
                  <Select value={formData.rateUnit} onValueChange={v => handleChange('rateUnit', v)}>
                    <SelectTrigger data-testid="select-rate-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(RATE_UNIT_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ratePeriod">Period</Label>
                  <Select value={formData.ratePeriod} onValueChange={v => handleChange('ratePeriod', v)}>
                    <SelectTrigger data-testid="select-rate-period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(RATE_PERIOD_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="seasonality">Seasonality</Label>
                  <Select value={formData.seasonality} onValueChange={v => handleChange('seasonality', v)}>
                    <SelectTrigger data-testid="select-seasonality">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="annual">Annual (Year-Round)</SelectItem>
                      <SelectItem value="seasonal">Seasonal</SelectItem>
                      <SelectItem value="summer">Summer Only</SelectItem>
                      <SelectItem value="winter">Winter Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between pt-6">
                  <Label htmlFor="isCurrentRate">Current Rate</Label>
                  <Switch
                    id="isCurrentRate"
                    checked={formData.isCurrentRate}
                    onCheckedChange={v => handleChange('isCurrentRate', v)}
                    data-testid="switch-is-current"
                  />
                </div>
              </div>

              <Separator />
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Amenities & Options</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="electricIncluded" className="text-sm">Electric</Label>
                  <Switch
                    id="electricIncluded"
                    checked={formData.electricIncluded}
                    onCheckedChange={v => handleChange('electricIncluded', v)}
                    data-testid="switch-electric"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="waterIncluded" className="text-sm">Water</Label>
                  <Switch
                    id="waterIncluded"
                    checked={formData.waterIncluded}
                    onCheckedChange={v => handleChange('waterIncluded', v)}
                    data-testid="switch-water"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="wifiIncluded" className="text-sm">WiFi</Label>
                  <Switch
                    id="wifiIncluded"
                    checked={formData.wifiIncluded}
                    onCheckedChange={v => handleChange('wifiIncluded', v)}
                    data-testid="switch-wifi"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="pumpOutIncluded" className="text-sm">Pump Out</Label>
                  <Switch
                    id="pumpOutIncluded"
                    checked={formData.pumpOutIncluded}
                    onCheckedChange={v => handleChange('pumpOutIncluded', v)}
                    data-testid="switch-pumpout"
                  />
                </div>
              </div>

              {formData.electricIncluded && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="electricAmps">Electric Amps (comma-separated)</Label>
                    <Input
                      id="electricAmps"
                      value={formData.electricAmps}
                      onChange={e => handleChange('electricAmps', e.target.value)}
                      placeholder="e.g., 30, 50"
                      data-testid="input-electric-amps"
                    />
                  </div>
                  <div>
                    <Label htmlFor="electricAdditionalCents">Additional Electric ($)</Label>
                    <Input
                      id="electricAdditionalCents"
                      type="number"
                      step="0.01"
                      value={formData.electricAdditionalCents}
                      onChange={e => handleChange('electricAdditionalCents', e.target.value)}
                      placeholder="0.00"
                      data-testid="input-electric-additional"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="protectionLevel">Protection Level</Label>
                  <Select value={formData.protectionLevel} onValueChange={v => handleChange('protectionLevel', v)}>
                    <SelectTrigger data-testid="select-protection">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PROTECTION_LEVEL_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between pt-6">
                  <Label htmlFor="isCovered">Covered Slip</Label>
                  <Switch
                    id="isCovered"
                    checked={formData.isCovered}
                    onCheckedChange={v => handleChange('isCovered', v)}
                    data-testid="switch-covered"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="liveaboardAllowed">Liveaboard Allowed</Label>
                  <Switch
                    id="liveaboardAllowed"
                    checked={formData.liveaboardAllowed}
                    onCheckedChange={v => handleChange('liveaboardAllowed', v)}
                    data-testid="switch-liveaboard"
                  />
                </div>
                {formData.liveaboardAllowed && (
                  <div>
                    <Label htmlFor="liveaboardAdditionalCents">Liveaboard Additional ($)</Label>
                    <Input
                      id="liveaboardAdditionalCents"
                      type="number"
                      step="0.01"
                      value={formData.liveaboardAdditionalCents}
                      onChange={e => handleChange('liveaboardAdditionalCents', e.target.value)}
                      placeholder="0.00"
                      data-testid="input-liveaboard-additional"
                    />
                  </div>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full"
              >
                {showAdvanced ? 'Hide' : 'Show'} Advanced Options
                {showAdvanced ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
              </Button>

              {showAdvanced && (
                <>
                  <Separator />
                  <p className="text-sm font-medium">Terms & Dates</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="minTermMonths">Minimum Term (months)</Label>
                      <Input
                        id="minTermMonths"
                        type="number"
                        value={formData.minTermMonths}
                        onChange={e => handleChange('minTermMonths', e.target.value)}
                        placeholder="e.g., 12"
                        data-testid="input-min-term"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-6">
                      <Label htmlFor="depositRequired">Deposit Required</Label>
                      <Switch
                        id="depositRequired"
                        checked={formData.depositRequired}
                        onCheckedChange={v => handleChange('depositRequired', v)}
                        data-testid="switch-deposit"
                      />
                    </div>
                  </div>

                  {formData.depositRequired && (
                    <div>
                      <Label htmlFor="depositAmountCents">Deposit Amount ($)</Label>
                      <Input
                        id="depositAmountCents"
                        type="number"
                        step="0.01"
                        value={formData.depositAmountCents}
                        onChange={e => handleChange('depositAmountCents', e.target.value)}
                        placeholder="0.00"
                        data-testid="input-deposit-amount"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="effectiveDate">Effective Date</Label>
                      <Input
                        id="effectiveDate"
                        type="date"
                        value={formData.effectiveDate}
                        onChange={e => handleChange('effectiveDate', e.target.value)}
                        data-testid="input-effective-date"
                      />
                    </div>
                    <div>
                      <Label htmlFor="expirationDate">Expiration Date</Label>
                      <Input
                        id="expirationDate"
                        type="date"
                        value={formData.expirationDate}
                        onChange={e => handleChange('expirationDate', e.target.value)}
                        data-testid="input-expiration-date"
                      />
                    </div>
                  </div>

                  <Separator />
                  <p className="text-sm font-medium">Taxes & Availability</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="taxesIncluded">Taxes Included</Label>
                      <Switch
                        id="taxesIncluded"
                        checked={formData.taxesIncluded}
                        onCheckedChange={v => handleChange('taxesIncluded', v)}
                        data-testid="switch-taxes"
                      />
                    </div>
                    {!formData.taxesIncluded && (
                      <div>
                        <Label htmlFor="taxRate">Tax Rate (%)</Label>
                        <Input
                          id="taxRate"
                          type="number"
                          step="0.01"
                          value={formData.taxRate}
                          onChange={e => handleChange('taxRate', e.target.value)}
                          placeholder="e.g., 7.5"
                          data-testid="input-tax-rate"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="waitlistOnly">Waitlist Only</Label>
                      <Switch
                        id="waitlistOnly"
                        checked={formData.waitlistOnly}
                        onCheckedChange={v => handleChange('waitlistOnly', v)}
                        data-testid="switch-waitlist"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="availabilityNotes">Availability Notes</Label>
                    <Textarea
                      id="availabilityNotes"
                      value={formData.availabilityNotes}
                      onChange={e => handleChange('availabilityNotes', e.target.value)}
                      placeholder="e.g., Limited availability during peak season"
                      rows={2}
                      data-testid="input-availability-notes"
                    />
                  </div>
                </>
              )}

              <Separator />
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={e => handleChange('notes', e.target.value)}
                  placeholder="Additional notes about this rate tier..."
                  rows={2}
                  data-testid="input-notes"
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} data-testid="button-save-tier">
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Tier
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function RateTiersEditor({ rateCompId, marinaName, onTiersUpdated }: RateTiersEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<RateTier | null>(null);
  const [duplicatingTier, setDuplicatingTier] = useState<RateTier | null>(null);

  const { data: tiers = [], isLoading } = useQuery({
    queryKey: ['/api/rate-comps', rateCompId, 'tiers'],
    queryFn: async () => {
      const res = await fetch(`/api/rate-comps/${rateCompId}/tiers`);
      if (!res.ok) throw new Error('Failed to fetch tiers');
      return res.json() as Promise<RateTier[]>;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TierFormData) => {
      return apiRequest(`/api/rate-comps/${rateCompId}/tiers`, {
        method: 'POST',
        body: JSON.stringify(formDataToTier(data)),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rate-comps', rateCompId, 'tiers'] });
      setIsAddDialogOpen(false);
      setDuplicatingTier(null);
      toast({ title: "Rate tier created successfully" });
      onTiersUpdated?.();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create rate tier", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TierFormData }) => {
      return apiRequest(`/api/rate-tiers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(formDataToTier(data)),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rate-comps', rateCompId, 'tiers'] });
      setEditingTier(null);
      toast({ title: "Rate tier updated successfully" });
      onTiersUpdated?.();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update rate tier", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/rate-tiers/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rate-comps', rateCompId, 'tiers'] });
      toast({ title: "Rate tier deleted" });
      onTiersUpdated?.();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete rate tier", description: error.message, variant: "destructive" });
    },
  });

  const groupedTiers = tiers.reduce((acc, tier) => {
    const key = tier.storageType || 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(tier);
    return acc;
  }, {} as Record<string, RateTier[]>);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Rate Tiers
          </h3>
          <p className="text-sm text-muted-foreground">
            Manage detailed pricing tiers for {marinaName}
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-tier">
          <Plus className="h-4 w-4 mr-2" />
          Add Rate Tier
        </Button>
      </div>

      {tiers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Anchor className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No rate tiers defined yet. Add your first rate tier to start tracking rates.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Rate Tier
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedTiers).map(([storageType, tierGroup]) => (
            <div key={storageType} className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                {STORAGE_TYPE_LABELS[storageType] || storageType} ({tierGroup.length})
              </h4>
              <div className="space-y-2">
                {tierGroup.map(tier => (
                  <TierCard
                    key={tier.id}
                    tier={tier}
                    onEdit={() => setEditingTier(tier)}
                    onDelete={() => deleteMutation.mutate(tier.id)}
                    onDuplicate={() => setDuplicatingTier(tier)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <TierFormDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        initialData={EMPTY_TIER_FORM}
        onSubmit={data => createMutation.mutate(data)}
        isSubmitting={createMutation.isPending}
        title="Add Rate Tier"
        description={`Add a new pricing tier for ${marinaName}`}
      />

      {editingTier && (
        <TierFormDialog
          open={!!editingTier}
          onOpenChange={open => !open && setEditingTier(null)}
          initialData={tierToFormData(editingTier)}
          onSubmit={data => updateMutation.mutate({ id: editingTier.id, data })}
          isSubmitting={updateMutation.isPending}
          title="Edit Rate Tier"
          description={`Edit pricing tier for ${marinaName}`}
        />
      )}

      {duplicatingTier && (
        <TierFormDialog
          open={!!duplicatingTier}
          onOpenChange={open => !open && setDuplicatingTier(null)}
          initialData={tierToFormData(duplicatingTier)}
          onSubmit={data => createMutation.mutate(data)}
          isSubmitting={createMutation.isPending}
          title="Duplicate Rate Tier"
          description={`Create a copy of this tier for ${marinaName}`}
        />
      )}
    </div>
  );
}
