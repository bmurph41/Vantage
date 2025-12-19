import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  X
} from "lucide-react";
import type { RateComp, RateTier } from "@shared/schema";
import { formatCurrency } from "@/lib/ratecomps/format";
import { STORAGE_TYPE_LABELS, RATE_PERIOD_LABELS, RATE_UNIT_LABELS, PROTECTION_LEVEL_LABELS } from "@shared/ratecomps-utils";

interface ViewCompModalProps {
  open: boolean;
  onClose: () => void;
  comp: (RateComp & { tiers?: RateTier[]; tierCount?: number }) | null;
  onEdit?: (comp: RateComp) => void;
}

export default function ViewCompModal({ open, onClose, comp, onEdit }: ViewCompModalProps) {
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
    const protectionLabel = tier.protectionLevel ? (PROTECTION_LEVEL_LABELS[tier.protectionLevel as keyof typeof PROTECTION_LEVEL_LABELS] || tier.protectionLevel) : null;

    return (
      <Card key={tier.id || index} className="relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Ship className="h-4 w-4 text-primary" />
                {tier.tierLabel || storageLabel}
              </CardTitle>
              {tier.tierLabel && storageLabel && tier.tierLabel !== storageLabel && (
                <p className="text-sm text-muted-foreground mt-1">{storageLabel}</p>
              )}
            </div>
            <Badge variant="outline" className="font-mono">
              {formatSizeRange(tier.loaMin, tier.loaMax)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-primary">
              {formatRateAmount(tier.amountCents)}
            </span>
            <span className="text-sm text-muted-foreground">
              {unitLabel} / {periodLabel}
            </span>
          </div>

          {pricePerFoot && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
              <TrendingUp className="h-4 w-4" />
              <span>~${pricePerFoot.toFixed(2)}/ft/month</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Seasonality</p>
              <p className="font-medium capitalize">{tier.seasonality || 'Annual'}</p>
            </div>
            {protectionLabel && (
              <div>
                <p className="text-muted-foreground">Protection</p>
                <p className="font-medium">{protectionLabel}</p>
              </div>
            )}
            {tier.effectiveDate && (
              <div>
                <p className="text-muted-foreground">Effective</p>
                <p className="font-medium">{tier.effectiveDate}</p>
              </div>
            )}
            {tier.minTermMonths && (
              <div>
                <p className="text-muted-foreground">Min Term</p>
                <p className="font-medium">{tier.minTermMonths} months</p>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-medium">Included:</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {renderIncludedBadge(tier.electricIncluded, 'Electric')}
              {renderIncludedBadge(tier.waterIncluded, 'Water')}
              {renderIncludedBadge(tier.wifiIncluded, 'WiFi')}
              {renderIncludedBadge(tier.pumpOutIncluded, 'Pump-out')}
            </div>
          </div>

          {tier.depositRequired && (
            <div className="bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 rounded-md px-3 py-2 text-sm">
              <span className="font-medium">Deposit Required</span>
              {tier.depositAmountCents && (
                <span className="ml-1">- {formatCurrency(tier.depositAmountCents / 100)}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border-b">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <DialogTitle className="text-2xl font-bold">{comp.marina}</DialogTitle>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    <span>{[comp.city, comp.state].filter(Boolean).join(', ') || '—'}</span>
                  </div>
                  {comp.waterBody && (
                    <div className="flex items-center gap-1.5">
                      <Waves className="h-4 w-4" />
                      <span>{comp.waterBody}</span>
                    </div>
                  )}
                </div>
                {rateSummary && (
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <Badge variant="default" className="text-sm px-3 py-1">
                      <DollarSign className="h-3.5 w-3.5 mr-1" />
                      {rateSummary.rateRange}
                    </Badge>
                    {tierCount > 0 ? (
                      <Badge variant="secondary" className="text-sm px-3 py-1">
                        {tierCount} rate tier{tierCount !== 1 ? 's' : ''}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-sm px-3 py-1">
                        Legacy rate
                      </Badge>
                    )}
                    {rateSummary.storageTypes.map((type: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-sm">
                        {STORAGE_TYPE_LABELS[type as keyof typeof STORAGE_TYPE_LABELS] || type}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={() => onEdit?.(comp)} data-testid="button-edit-comp">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          </DialogHeader>
        </div>

        <ScrollArea className="flex-1 max-h-[calc(90vh-180px)]">
          <Tabs defaultValue="rates" className="w-full">
            <div className="sticky top-0 z-10 bg-background border-b px-6 py-2">
              <TabsList className="grid w-full max-w-md grid-cols-3">
                <TabsTrigger value="rates" className="flex items-center gap-2" data-testid="tab-rates">
                  <DollarSign className="h-4 w-4" />
                  Rates
                </TabsTrigger>
                <TabsTrigger value="amenities" className="flex items-center gap-2" data-testid="tab-amenities">
                  <Zap className="h-4 w-4" />
                  Amenities
                </TabsTrigger>
                <TabsTrigger value="details" className="flex items-center gap-2" data-testid="tab-details">
                  <Building2 className="h-4 w-4" />
                  Details
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="rates" className="p-6 space-y-6 mt-0">
              {tierCount > 0 ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    {tiers.map((tier: any, index: number) => renderTierCard(tier, index))}
                  </div>

                  {tierCount > 1 && (
                    <Card className="bg-muted/30">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          Rate Comparison
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2 pr-4 font-medium">Size Range</th>
                                <th className="text-left py-2 pr-4 font-medium">Type</th>
                                <th className="text-right py-2 pr-4 font-medium">Rate</th>
                                <th className="text-right py-2 font-medium">$/ft/mo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tiers.map((tier: any, index: number) => {
                                const pricePerFoot = calculatePricePerFoot(tier);
                                return (
                                  <tr key={tier.id || index} className="border-b last:border-0">
                                    <td className="py-2 pr-4">{formatSizeRange(tier.loaMin, tier.loaMax)}</td>
                                    <td className="py-2 pr-4">
                                      {STORAGE_TYPE_LABELS[tier.storageType as keyof typeof STORAGE_TYPE_LABELS] || tier.storageType}
                                    </td>
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
          </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
