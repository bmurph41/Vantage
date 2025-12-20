import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Edit, 
  MapPin, 
  Building2, 
  DollarSign, 
  Anchor, 
  Zap, 
  Waves, 
  Calendar,
  Ship,
  TrendingUp,
  Ruler,
  ChevronRight,
  Info,
  Check,
  X,
  Plus,
  Loader2
} from "lucide-react";
import type { RateComp, RateTier } from "@shared/schema";
import { formatCurrency } from "@/lib/ratecomps/format";
import { queryKeys } from "@/lib/ratecomps/queryKeys";
import { STORAGE_TYPE_LABELS, RATE_PERIOD_LABELS, RATE_UNIT_LABELS, PROTECTION_LEVEL_LABELS } from "@shared/ratecomps-utils";

interface ViewCompModalProps {
  open: boolean;
  onClose: () => void;
  comp: (RateComp & { tiers?: RateTier[]; tierCount?: number }) | null;
  onEdit?: (comp: RateComp) => void;
  onRateAdded?: () => void;
}

interface AddRateFormData {
  storageType: string;
  loaMin: string;
  loaMax: string;
  rateUnit: string;
  ratePeriod: string;
  amountDollars: string;
  seasonality: string;
  electricIncluded: boolean;
  waterIncluded: boolean;
  rateYear: string;
}

const INITIAL_RATE_FORM: AddRateFormData = {
  storageType: 'wet_slip',
  loaMin: '',
  loaMax: '',
  rateUnit: 'per_foot',
  ratePeriod: 'monthly',
  amountDollars: '',
  seasonality: 'annual',
  electricIncluded: false,
  waterIncluded: true,
  rateYear: new Date().getFullYear().toString(),
};

export default function ViewCompModal({ open, onClose, comp, onEdit, onRateAdded }: ViewCompModalProps) {
  const { toast } = useToast();
  const [showAddRateDialog, setShowAddRateDialog] = useState(false);
  const [rateForm, setRateForm] = useState<AddRateFormData>(INITIAL_RATE_FORM);

  if (!comp) return null;

  const tiers = (comp as any).tiers || [];
  const tierCount = tiers.length;

  const formatValue = (value: any) => {
    if (value === null || value === undefined || value === '') return '—';
    return value;
  };

  const formatRateAmount = (amountCents: number | null | undefined) => {
    if (!amountCents) return '—';
    return formatCurrency(amountCents / 100);
  };

  const formatSizeRange = (min: number | null | undefined, max: number | null | undefined) => {
    if (!min && !max) return 'All sizes';
    if (min && max) return `${min}' - ${max}'`;
    if (min) return `${min}'+`;
    if (max) return `Up to ${max}'`;
    return '—';
  };

  const calculatePricePerFoot = (tier: any) => {
    if (!tier.amountCents) return null;
    if (tier.rateUnit === 'per_foot' && tier.ratePeriod === 'monthly') {
      return tier.amountCents / 100;
    }
    if (tier.rateUnit === 'flat' && tier.loaMin && tier.loaMax) {
      const avgLength = (tier.loaMin + tier.loaMax) / 2;
      return (tier.amountCents / 100) / avgLength;
    }
    return null;
  };

  const getRateSummary = () => {
    if (tierCount > 0) {
      const amounts = tiers.map((t: any) => t.amountCents).filter(Boolean);
      if (amounts.length === 0) return null;
      
      const minAmount = Math.min(...amounts);
      const maxAmount = Math.max(...amounts);
      
      const storageTypes = [...new Set(tiers.map((t: any) => t.storageType))];
      
      return {
        minRate: formatCurrency(minAmount / 100),
        maxRate: formatCurrency(maxAmount / 100),
        rateRange: minAmount === maxAmount ? formatCurrency(minAmount / 100) : `${formatCurrency(minAmount / 100)} - ${formatCurrency(maxAmount / 100)}`,
        storageTypes,
        tierCount
      };
    }
    
    if (comp.rateAmount) {
      return {
        minRate: formatCurrency(comp.rateAmount / 100),
        maxRate: formatCurrency(comp.rateAmount / 100),
        rateRange: formatCurrency(comp.rateAmount / 100),
        storageTypes: comp.storageType ? [comp.storageType] : [],
        tierCount: 1
      };
    }
    
    return null;
  };

  const rateSummary = getRateSummary();

  const renderIncludedBadge = (included: boolean | null | undefined, label: string) => (
    <div className="flex items-center gap-2">
      {included ? (
        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={included ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );

  const renderTierCard = (tier: any, index: number) => {
    const pricePerFoot = calculatePricePerFoot(tier);
    const storageLabel = STORAGE_TYPE_LABELS[tier.storageType as keyof typeof STORAGE_TYPE_LABELS] || tier.storageType;
    const periodLabel = RATE_PERIOD_LABELS[tier.ratePeriod as keyof typeof RATE_PERIOD_LABELS] || tier.ratePeriod;
    const unitLabel = RATE_UNIT_LABELS[tier.rateUnit as keyof typeof RATE_UNIT_LABELS] || tier.rateUnit;

    const includedAmenities = [
      tier.electricIncluded && 'Electric',
      tier.waterIncluded && 'Water',
      tier.wifiIncluded && 'WiFi',
      tier.pumpOutIncluded && 'Pump-out',
    ].filter(Boolean);

    return (
      <div key={tier.id || index} className="border rounded-lg p-4 bg-card hover:bg-muted/30 transition-colors">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Ship className="h-4 w-4 text-primary" />
            <span className="font-medium">{tier.tierLabel || storageLabel}</span>
          </div>
          <Badge variant="outline" className="text-xs font-mono">
            {formatSizeRange(tier.loaMin, tier.loaMax)}
          </Badge>
        </div>
        
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-xl font-bold text-primary">
            {formatRateAmount(tier.amountCents)}
          </span>
          <span className="text-xs text-muted-foreground">
            {unitLabel} / {periodLabel}
          </span>
          {pricePerFoot && (
            <span className="text-xs text-muted-foreground ml-auto">
              ~${pricePerFoot.toFixed(2)}/ft/mo
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="capitalize">{tier.seasonality || 'Annual'}</span>
          {includedAmenities.length > 0 && (
            <>
              <span className="text-border">•</span>
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3 text-green-600" />
                {includedAmenities.join(', ')}
              </span>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-0 gap-0 overflow-hidden">
        <div className="px-6 py-4 border-b bg-muted/30">
          <DialogHeader className="space-y-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-xl font-semibold truncate">{comp.marina}</DialogTitle>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                  {[comp.city, comp.state].filter(Boolean).join(', ') || 'Location not specified'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setRateForm(INITIAL_RATE_FORM);
                    setShowAddRateDialog(true);
                  }} 
                  data-testid="button-add-rate"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Rate
                </Button>
                <Button size="sm" onClick={() => onEdit?.(comp)} data-testid="button-edit-comp">
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </div>
            </div>
            {rateSummary && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Badge variant="default" className="text-xs">
                  {rateSummary.rateRange}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {tierCount} rate{tierCount !== 1 ? 's' : ''}
                </Badge>
                {rateSummary.storageTypes.map((type: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {STORAGE_TYPE_LABELS[type as keyof typeof STORAGE_TYPE_LABELS] || type}
                  </Badge>
                ))}
              </div>
            )}
          </DialogHeader>
        </div>

        <Tabs defaultValue="rates" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-2 border-b bg-background">
            <TabsList className="h-9">
              <TabsTrigger value="rates" className="text-xs px-3" data-testid="tab-rates">
                <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                Rates
              </TabsTrigger>
              <TabsTrigger value="amenities" className="text-xs px-3" data-testid="tab-amenities">
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                Amenities
              </TabsTrigger>
              <TabsTrigger value="details" className="text-xs px-3" data-testid="tab-details">
                <Building2 className="h-3.5 w-3.5 mr-1.5" />
                Details
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            <TabsContent value="rates" className="p-4 space-y-4 mt-0">
              {tierCount > 0 ? (
                <>
                  {(() => {
                    const tiersByStorageType = tiers.reduce((acc: Record<string, any[]>, tier: any) => {
                      const key = tier.storageType || 'other';
                      if (!acc[key]) acc[key] = [];
                      acc[key].push(tier);
                      return acc;
                    }, {});
                    
                    const storageTypes = Object.keys(tiersByStorageType);
                    
                    return (
                      <div className="space-y-6">
                        {storageTypes.map((storageType) => {
                          const storageTiers = tiersByStorageType[storageType];
                          const storageLabel = STORAGE_TYPE_LABELS[storageType as keyof typeof STORAGE_TYPE_LABELS] || storageType;
                          
                          const tiersByYear = storageTiers.reduce((acc: Record<string, any[]>, tier: any) => {
                            const year = tier.rateYear ? tier.rateYear.toString() : 'undated';
                            if (!acc[year]) acc[year] = [];
                            acc[year].push(tier);
                            return acc;
                          }, {} as Record<string, any[]>);
                          const yearKeys = Object.keys(tiersByYear).filter(y => y !== 'undated');
                          const years = yearKeys.map(Number).sort((a, b) => b - a);
                          const hasUndated = !!tiersByYear['undated'];
                          const hasMultipleYears = years.length > 1 || (years.length === 1 && hasUndated);
                          
                          return (
                            <div key={storageType} className="border rounded-lg overflow-hidden">
                              <div className="bg-muted/50 px-4 py-2.5 border-b flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Anchor className="h-4 w-4 text-primary" />
                                  <span className="font-medium text-sm">{storageLabel}</span>
                                  <Badge variant="secondary" className="text-xs">
                                    {storageTiers.length} rate{storageTiers.length !== 1 ? 's' : ''}
                                  </Badge>
                                </div>
                                {hasMultipleYears && (
                                  <Badge variant="outline" className="text-xs">
                                    {years.length} years tracked
                                  </Badge>
                                )}
                              </div>
                              <div className="p-3">
                                {hasMultipleYears ? (
                                  <div className="space-y-4">
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="border-b bg-muted/50">
                                            <th className="text-left py-2 px-3 font-medium">Year</th>
                                            <th className="text-left py-2 px-3 font-medium">Size Range</th>
                                            <th className="text-right py-2 px-3 font-medium">Rate</th>
                                            <th className="text-right py-2 px-3 font-medium">$/ft/mo</th>
                                            <th className="text-right py-2 px-3 font-medium">YoY Change</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {years.map((year, yearIndex) => {
                                            const yearTiers = tiersByYear[year.toString()] || [];
                                            const prevYear = years[yearIndex + 1];
                                            const prevYearTiers = prevYear ? tiersByYear[prevYear.toString()] : null;
                                            
                                            return yearTiers.map((tier: any, tierIndex: number) => {
                                              const pricePerFoot = calculatePricePerFoot(tier);
                                              const matchingPrevTier = prevYearTiers?.find((pt: any) => 
                                                pt.loaMin === tier.loaMin && pt.loaMax === tier.loaMax
                                              );
                                              const prevPricePerFoot = matchingPrevTier ? calculatePricePerFoot(matchingPrevTier) : null;
                                              const yoyChange = pricePerFoot && prevPricePerFoot 
                                                ? ((pricePerFoot - prevPricePerFoot) / prevPricePerFoot) * 100 
                                                : null;
                                              
                                              return (
                                                <tr key={tier.id || `${year}-${tierIndex}`} className="border-b last:border-0 hover:bg-muted/30">
                                                  <td className="py-2 px-3 font-medium">{tier.rateYear || year}</td>
                                                  <td className="py-2 px-3">{formatSizeRange(tier.loaMin, tier.loaMax)}</td>
                                                  <td className="py-2 px-3 text-right font-medium">{formatRateAmount(tier.amountCents)}</td>
                                                  <td className="py-2 px-3 text-right">{pricePerFoot ? `$${pricePerFoot.toFixed(2)}` : '—'}</td>
                                                  <td className="py-2 px-3 text-right">
                                                    {yoyChange !== null ? (
                                                      <span className={yoyChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                        {yoyChange >= 0 ? '+' : ''}{yoyChange.toFixed(1)}%
                                                      </span>
                                                    ) : '—'}
                                                  </td>
                                                </tr>
                                              );
                                            });
                                          })}
                                          {hasUndated && tiersByYear['undated']?.map((tier: any, tierIndex: number) => {
                                            const pricePerFoot = calculatePricePerFoot(tier);
                                            return (
                                              <tr key={tier.id || `undated-${tierIndex}`} className="border-b last:border-0 hover:bg-muted/30 bg-muted/20">
                                                <td className="py-2 px-3 font-medium text-muted-foreground italic">Undated</td>
                                                <td className="py-2 px-3">{formatSizeRange(tier.loaMin, tier.loaMax)}</td>
                                                <td className="py-2 px-3 text-right font-medium">{formatRateAmount(tier.amountCents)}</td>
                                                <td className="py-2 px-3 text-right">{pricePerFoot ? `$${pricePerFoot.toFixed(2)}` : '—'}</td>
                                                <td className="py-2 px-3 text-right text-muted-foreground">—</td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="grid gap-2">
                                    {storageTiers.map((tier: any, index: number) => renderTierCard(tier, index))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {tierCount > 1 && (
                    <Card className="bg-muted/30">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          All Rates Comparison
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2 pr-4 font-medium">Year</th>
                                <th className="text-left py-2 pr-4 font-medium">Type</th>
                                <th className="text-left py-2 pr-4 font-medium">Size Range</th>
                                <th className="text-right py-2 pr-4 font-medium">Rate</th>
                                <th className="text-right py-2 font-medium">$/ft/mo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[...tiers].sort((a: any, b: any) => (b.rateYear || 0) - (a.rateYear || 0)).map((tier: any, index: number) => {
                                const pricePerFoot = calculatePricePerFoot(tier);
                                return (
                                  <tr key={tier.id || index} className="border-b last:border-0">
                                    <td className="py-2 pr-4 font-medium">{tier.rateYear || '—'}</td>
                                    <td className="py-2 pr-4">
                                      {STORAGE_TYPE_LABELS[tier.storageType as keyof typeof STORAGE_TYPE_LABELS] || tier.storageType}
                                    </td>
                                    <td className="py-2 pr-4">{formatSizeRange(tier.loaMin, tier.loaMax)}</td>
                                    <td className="py-2 pr-4 text-right font-medium">
                                      {formatRateAmount(tier.amountCents)}
                                    </td>
                                    <td className="py-2 text-right text-muted-foreground">
                                      {pricePerFoot ? `$${pricePerFoot.toFixed(2)}` : '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : comp.rateAmount ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-primary" />
                      Rate Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-primary">
                        {formatRateAmount(comp.rateAmount)}
                      </span>
                      {(comp.rateType || comp.ratePeriod) && (
                        <span className="text-sm text-muted-foreground">
                          {[
                            comp.rateType ? (RATE_UNIT_LABELS[comp.rateType as keyof typeof RATE_UNIT_LABELS] || comp.rateType) : null,
                            comp.ratePeriod ? (RATE_PERIOD_LABELS[comp.ratePeriod as keyof typeof RATE_PERIOD_LABELS] || comp.ratePeriod) : null
                          ].filter(Boolean).join(' / ')}
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                      {comp.storageType && (
                        <div>
                          <p className="text-sm text-muted-foreground">Storage Type</p>
                          <p className="font-medium">
                            {STORAGE_TYPE_LABELS[comp.storageType as keyof typeof STORAGE_TYPE_LABELS] || comp.storageType}
                          </p>
                        </div>
                      )}
                      {(comp.boatLengthMin || comp.boatLengthMax) && (
                        <div>
                          <p className="text-sm text-muted-foreground">Boat Size</p>
                          <p className="font-medium">{formatSizeRange(comp.boatLengthMin, comp.boatLengthMax)}</p>
                        </div>
                      )}
                      {comp.seasonality && (
                        <div>
                          <p className="text-sm text-muted-foreground">Seasonality</p>
                          <p className="font-medium capitalize">{comp.seasonality}</p>
                        </div>
                      )}
                      {comp.protectionLevel && (
                        <div>
                          <p className="text-sm text-muted-foreground">Protection</p>
                          <p className="font-medium">
                            {PROTECTION_LEVEL_LABELS[comp.protectionLevel as keyof typeof PROTECTION_LEVEL_LABELS] || comp.protectionLevel}
                          </p>
                        </div>
                      )}
                      {comp.effectiveDate && (
                        <div>
                          <p className="text-sm text-muted-foreground">Effective Date</p>
                          <p className="font-medium">{comp.effectiveDate}</p>
                        </div>
                      )}
                      {comp.source && (
                        <div>
                          <p className="text-sm text-muted-foreground">Source</p>
                          <p className="font-medium">{comp.source}</p>
                        </div>
                      )}
                    </div>

                    <div className="bg-muted/50 rounded-lg px-4 py-3 text-sm text-muted-foreground flex items-start gap-2 mt-4">
                      <Info className="h-4 w-4 mt-0.5 shrink-0" />
                      <p>This rate uses legacy format. Add rate tiers for more detailed pricing breakdown by boat size.</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No rate information available</p>
                  <p className="text-sm mt-1">Add rate tiers to see detailed pricing information</p>
                  <Button variant="outline" className="mt-4" onClick={() => onEdit?.(comp)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Add Rates
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="amenities" className="p-6 mt-0">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      Utilities
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b">
                      <span>Electric</span>
                      <Badge variant={comp.electricIncluded ? "default" : "secondary"}>
                        {comp.electricIncluded ? 'Included' : 'Additional'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span>Water</span>
                      <Badge variant={comp.waterIncluded ? "default" : "secondary"}>
                        {comp.waterIncluded ? 'Included' : 'Additional'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span>WiFi</span>
                      <Badge variant={comp.wifiIncluded ? "default" : "secondary"}>
                        {comp.wifiIncluded ? 'Included' : 'Additional'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span>Cable TV</span>
                      <Badge variant={comp.cableIncluded ? "default" : "secondary"}>
                        {comp.cableIncluded ? 'Included' : 'Additional'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Anchor className="h-4 w-4 text-primary" />
                      Facility Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Wet Slips</p>
                        <p className="text-lg font-semibold">{formatValue(comp.wetSlips)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Dry Racks</p>
                        <p className="text-lg font-semibold">{formatValue(comp.dryRacks)}</p>
                      </div>
                    </div>
                    {comp.protectionLevel && (
                      <div>
                        <p className="text-sm text-muted-foreground">Protection Level</p>
                        <p className="font-medium">
                          {PROTECTION_LEVEL_LABELS[comp.protectionLevel as keyof typeof PROTECTION_LEVEL_LABELS] || comp.protectionLevel}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="details" className="p-6 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    Marina Location & Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Full Address</p>
                        <p className="font-medium" data-testid="text-full-address">
                          {[comp.address, comp.city, comp.state, comp.zip]
                            .filter(Boolean)
                            .join(', ') || '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Region</p>
                        <p className="font-medium" data-testid="text-region">
                          {formatValue(comp.region)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Water Body</p>
                        <p className="font-medium" data-testid="text-water-body">
                          {formatValue(comp.waterBody)}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Data Source</p>
                        <p className="font-medium" data-testid="text-source">
                          {formatValue(comp.source)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Last Updated</p>
                        <p className="font-medium flex items-center gap-2" data-testid="text-updated">
                          <Calendar className="h-4 w-4" />
                          {comp.updatedAt ? new Date(comp.updatedAt).toLocaleDateString() : '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {comp.notes && (
                    <>
                      <Separator className="my-6" />
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Notes</p>
                        <p className="text-sm bg-muted/50 rounded-lg p-4 whitespace-pre-wrap" data-testid="text-notes">
                          {comp.notes}
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>

      <AddRateDialog
        open={showAddRateDialog}
        onClose={() => setShowAddRateDialog(false)}
        rateCompId={comp.id}
        marinaName={comp.marina || 'Marina'}
        formData={rateForm}
        setFormData={setRateForm}
        onSuccess={() => {
          setShowAddRateDialog(false);
          setRateForm(INITIAL_RATE_FORM);
          onRateAdded?.();
          queryClient.invalidateQueries({ queryKey: queryKeys.comps.all });
          queryClient.invalidateQueries({ queryKey: ['/api/rate-comps'] });
          queryClient.invalidateQueries({ queryKey: queryKeys.comps.tiers(comp.id) });
          queryClient.invalidateQueries({ queryKey: ['/api/rate-comps', comp.id, 'tiers'] });
        }}
      />
    </Dialog>
  );
}

interface AddRateDialogProps {
  open: boolean;
  onClose: () => void;
  rateCompId: string;
  marinaName: string;
  formData: AddRateFormData;
  setFormData: (data: AddRateFormData) => void;
  onSuccess: () => void;
}

function AddRateDialog({ open, onClose, rateCompId, marinaName, formData, setFormData, onSuccess }: AddRateDialogProps) {
  const { toast } = useToast();

  const createTierMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', `/api/rate-comps/${rateCompId}/tiers`, data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Rate tier added successfully" });
      onSuccess();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to add rate tier",
        variant: "destructive" 
      });
    },
  });

  const handleSubmit = () => {
    const errors: string[] = [];
    
    if (!formData.storageType) {
      errors.push("Storage type is required");
    }
    if (!formData.rateUnit) {
      errors.push("Rate unit is required");
    }
    if (!formData.ratePeriod) {
      errors.push("Rate period is required");
    }
    if (!formData.amountDollars || parseFloat(formData.amountDollars) <= 0) {
      errors.push("Please enter a valid rate amount greater than 0");
    }
    
    if (errors.length > 0) {
      toast({ 
        title: "Validation Error", 
        description: errors.join(". "),
        variant: "destructive" 
      });
      return;
    }

    const rateYear = formData.rateYear ? parseInt(formData.rateYear) : new Date().getFullYear();
    const tierData = {
      storageType: formData.storageType || 'wet_slip',
      loaMin: formData.loaMin ? parseInt(formData.loaMin) : null,
      loaMax: formData.loaMax ? parseInt(formData.loaMax) : null,
      rateUnit: formData.rateUnit || 'per_foot',
      ratePeriod: formData.ratePeriod || 'monthly',
      amountCents: Math.round(parseFloat(formData.amountDollars) * 100),
      seasonality: formData.seasonality || 'annual',
      electricIncluded: formData.electricIncluded ?? false,
      waterIncluded: formData.waterIncluded ?? true,
      isCurrentRate: rateYear === new Date().getFullYear(),
      rateYear,
    };

    createTierMutation.mutate(tierData);
  };

  const updateField = (field: keyof AddRateFormData, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Rate Tier</DialogTitle>
          <DialogDescription>
            Add a new rate tier for {marinaName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="storageType">Storage Type</Label>
              <Select value={formData.storageType} onValueChange={(v) => updateField('storageType', v)}>
                <SelectTrigger id="storageType" data-testid="select-storage-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STORAGE_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="seasonality">Seasonality</Label>
              <Select value={formData.seasonality} onValueChange={(v) => updateField('seasonality', v)}>
                <SelectTrigger id="seasonality" data-testid="select-seasonality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="seasonal">Seasonal</SelectItem>
                  <SelectItem value="winter">Winter</SelectItem>
                  <SelectItem value="summer">Summer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rateYear">Rate Year</Label>
              <Select value={formData.rateYear} onValueChange={(v) => updateField('rateYear', v)}>
                <SelectTrigger id="rateYear" data-testid="select-rate-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="loaMin">Min LOA (ft)</Label>
              <Input
                id="loaMin"
                type="number"
                placeholder="e.g., 20"
                value={formData.loaMin}
                onChange={(e) => updateField('loaMin', e.target.value)}
                data-testid="input-loa-min"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loaMax">Max LOA (ft)</Label>
              <Input
                id="loaMax"
                type="number"
                placeholder="e.g., 40"
                value={formData.loaMax}
                onChange={(e) => updateField('loaMax', e.target.value)}
                data-testid="input-loa-max"
              />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amountDollars">Rate Amount ($)</Label>
              <Input
                id="amountDollars"
                type="number"
                step="0.01"
                placeholder="e.g., 25.00"
                value={formData.amountDollars}
                onChange={(e) => updateField('amountDollars', e.target.value)}
                data-testid="input-rate-amount"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rateUnit">Rate Unit</Label>
              <Select value={formData.rateUnit} onValueChange={(v) => updateField('rateUnit', v)}>
                <SelectTrigger id="rateUnit" data-testid="select-rate-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RATE_UNIT_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ratePeriod">Rate Period</Label>
              <Select value={formData.ratePeriod} onValueChange={(v) => updateField('ratePeriod', v)}>
                <SelectTrigger id="ratePeriod" data-testid="select-rate-period">
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

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="electricIncluded">Electric Included</Label>
              <Switch
                id="electricIncluded"
                checked={formData.electricIncluded}
                onCheckedChange={(v) => updateField('electricIncluded', v)}
                data-testid="switch-electric"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="waterIncluded">Water Included</Label>
              <Switch
                id="waterIncluded"
                checked={formData.waterIncluded}
                onCheckedChange={(v) => updateField('waterIncluded', v)}
                data-testid="switch-water"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-add-rate">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={createTierMutation.isPending}
            data-testid="button-save-rate"
          >
            {createTierMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add Rate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
