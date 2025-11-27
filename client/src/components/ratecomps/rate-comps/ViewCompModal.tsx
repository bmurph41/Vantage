import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Edit, MapPin, Building2, DollarSign, Anchor, Zap, Waves, Calendar } from "lucide-react";
import type { RateComp } from "@shared/schema";
import { formatCurrency } from "@/lib/ratecomps/format";
import { STORAGE_TYPE_LABELS, RATE_PERIOD_LABELS, RATE_UNIT_LABELS, PROTECTION_LEVEL_LABELS } from "@shared/ratecomps-utils";

interface ViewCompModalProps {
  open: boolean;
  onClose: () => void;
  comp: RateComp | null;
  onEdit?: (comp: RateComp) => void;
}

export default function ViewCompModal({ open, onClose, comp, onEdit }: ViewCompModalProps) {
  if (!comp) return null;

  const formatValue = (value: any) => {
    if (value === null || value === undefined || value === '') return '—';
    return value;
  };

  const formatRateAmount = (amount: number | null) => {
    if (!amount) return '—';
    return formatCurrency(amount / 100);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl mb-2">{comp.marina}</DialogTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>
                  {[comp.city, comp.state].filter(Boolean).join(', ') || '—'}
                </span>
              </div>
            </div>
            <Button onClick={() => onEdit?.(comp)} data-testid="button-edit-comp">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Anchor className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Storage Information</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Storage Type</p>
                <p className="font-medium" data-testid="text-storage-type">
                  {comp.storageType ? (STORAGE_TYPE_LABELS[comp.storageType as keyof typeof STORAGE_TYPE_LABELS] || comp.storageType) : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Boat Size Range</p>
                <p className="font-medium" data-testid="text-boat-size">
                  {comp.boatLengthMin || comp.boatLengthMax 
                    ? `${comp.boatLengthMin || '?'} - ${comp.boatLengthMax || '?'} ft`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Protection Level</p>
                <p className="font-medium" data-testid="text-protection">
                  {comp.protectionLevel ? (PROTECTION_LEVEL_LABELS[comp.protectionLevel as keyof typeof PROTECTION_LEVEL_LABELS] || comp.protectionLevel) : '—'}
                </p>
              </div>
            </div>
          </section>

          <Separator />

          <section>
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Rate Information</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Rate Amount</p>
                <p className="font-medium text-lg" data-testid="text-rate-amount">
                  {formatRateAmount(comp.rateAmount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Rate Type</p>
                <p className="font-medium" data-testid="text-rate-type">
                  {comp.rateType ? (RATE_UNIT_LABELS[comp.rateType as keyof typeof RATE_UNIT_LABELS] || comp.rateType) : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Rate Period</p>
                <p className="font-medium" data-testid="text-rate-period">
                  {comp.ratePeriod ? (RATE_PERIOD_LABELS[comp.ratePeriod as keyof typeof RATE_PERIOD_LABELS] || comp.ratePeriod) : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Seasonality</p>
                <p className="font-medium" data-testid="text-seasonality">
                  {formatValue(comp.seasonality)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Effective Date</p>
                <p className="font-medium flex items-center gap-2" data-testid="text-effective-date">
                  <Calendar className="h-4 w-4" />
                  {comp.effectiveDate || '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Source</p>
                <p className="font-medium" data-testid="text-source">
                  {formatValue(comp.source)}
                </p>
              </div>
            </div>
          </section>

          <Separator />

          <section>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Amenities & Utilities</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Electric Included</p>
                <Badge variant={comp.electricIncluded ? "default" : "secondary"}>
                  {comp.electricIncluded ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Water Included</p>
                <Badge variant={comp.waterIncluded ? "default" : "secondary"}>
                  {comp.waterIncluded ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">WiFi Included</p>
                <Badge variant={comp.wifiIncluded ? "default" : "secondary"}>
                  {comp.wifiIncluded ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Cable Included</p>
                <Badge variant={comp.cableIncluded ? "default" : "secondary"}>
                  {comp.cableIncluded ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
          </section>

          <Separator />

          <section>
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Marina Details</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Address</p>
                <p className="font-medium" data-testid="text-address">
                  {formatValue(comp.address)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Zip Code</p>
                <p className="font-medium" data-testid="text-zip">
                  {formatValue(comp.zip)}
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
              <div>
                <p className="text-sm text-muted-foreground mb-1">Wet Slips</p>
                <p className="font-medium" data-testid="text-wet-slips">
                  {formatValue(comp.wetSlips)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Dry Racks</p>
                <p className="font-medium" data-testid="text-dry-racks">
                  {formatValue(comp.dryRacks)}
                </p>
              </div>
            </div>
          </section>

          {comp.notes && (
            <>
              <Separator />
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Waves className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Notes</h3>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-notes">
                  {comp.notes}
                </p>
              </section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
