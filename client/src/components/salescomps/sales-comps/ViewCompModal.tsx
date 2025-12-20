import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, ExternalLink, MapPin, Calendar, Anchor, Ship, Users, FileText, Droplets, Building } from "lucide-react";
import type { SalesComp } from "@shared/schema";
import { formatCurrency } from "@/lib/salescomps/format";

interface ViewCompModalProps {
  open: boolean;
  onClose: () => void;
  comp: SalesComp | null;
  onEdit?: (comp: SalesComp) => void;
}

export default function ViewCompModal({ open, onClose, comp, onEdit }: ViewCompModalProps) {
  if (!comp) return null;

  const formatValue = (value: any) => {
    if (value === null || value === undefined || value === '') return '—';
    return value;
  };

  const formatDate = (month: number | null, year: number | null) => {
    if (!year) return '—';
    if (!month) return year.toString();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[month - 1]} ${year}`;
  };

  const totalUnits = (comp.wetSlips || 0) + (comp.dryRacks || 0);
  const pricePerUnit = totalUnits > 0 && comp.salePrice ? Math.round(Number(comp.salePrice) / totalUnits) : null;

  const DataRow = ({ label, value, testId }: { label: string; value: React.ReactNode; testId?: string }) => (
    <div className="flex justify-between items-baseline py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right" data-testid={testId}>{value}</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b bg-muted/30">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-semibold truncate">{comp.marina}</DialogTitle>
              <DialogDescription className="flex items-center gap-1.5 text-sm mt-1">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">
                  {[comp.address, comp.city, comp.state].filter(Boolean).join(', ') || 'Location not specified'}
                </span>
              </DialogDescription>
            </div>
            <Button size="sm" onClick={() => onEdit?.(comp)} data-testid="button-edit-comp">
              <Edit className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-0 border-b bg-gradient-to-b from-muted/20 to-transparent">
          <div className="p-3 text-center border-r border-border/50">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Sale Price</p>
            <p className="text-base font-bold text-primary" data-testid="text-sale-price-hero">
              {comp.salePrice ? formatCurrency(comp.salePrice) : '—'}
            </p>
            {!comp.isPriceDisclosed && comp.salePrice && (
              <Badge variant="outline" className="text-[9px] mt-0.5">Undisclosed</Badge>
            )}
          </div>
          <div className="p-3 text-center border-r border-border/50">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Cap Rate</p>
            <p className="text-base font-bold" data-testid="text-cap-rate-hero">
              {comp.capRate ? `${(Number(comp.capRate) / 100).toFixed(2)}%` : '—'}
            </p>
          </div>
          <div className="p-3 text-center border-r border-border/50">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Sale Date</p>
            <p className="text-base font-bold" data-testid="text-sale-date-hero">
              {formatDate(comp.saleMonth, comp.saleYear)}
            </p>
          </div>
          <div className="p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Total Units</p>
            <p className="text-base font-bold" data-testid="text-units-hero">
              {totalUnits > 0 ? totalUnits.toLocaleString() : '—'}
            </p>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b">
                <Building className="h-3.5 w-3.5 text-primary" />
                <h4 className="text-xs font-semibold uppercase tracking-wide">Financials</h4>
              </div>
              <div className="space-y-0">
                <DataRow label="Sale Price" value={comp.salePrice ? formatCurrency(comp.salePrice) : '—'} testId="text-sale-price" />
                <DataRow label="List Price" value={comp.listPrice ? formatCurrency(comp.listPrice) : '—'} testId="text-list-price" />
                <DataRow label="NOI" value={comp.noi ? formatCurrency(comp.noi) : '—'} testId="text-noi" />
                <DataRow label="Cap Rate" value={comp.capRate ? `${(Number(comp.capRate) / 100).toFixed(2)}%` : '—'} testId="text-cap-rate" />
                <DataRow label="$/Unit" value={pricePerUnit ? formatCurrency(pricePerUnit) : '—'} testId="text-price-per-unit" />
                <DataRow label="Days on Market" value={formatValue(comp.daysOnMarket)} testId="text-dom" />
              </div>
            </div>

            <div className="bg-card border rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b">
                <Anchor className="h-3.5 w-3.5 text-primary" />
                <h4 className="text-xs font-semibold uppercase tracking-wide">Property</h4>
              </div>
              <div className="space-y-0">
                <DataRow label="Wet Slips" value={formatValue(comp.wetSlips)} testId="text-wet-slips" />
                <DataRow label="Dry Racks" value={formatValue(comp.dryRacks)} testId="text-dry-racks" />
                <DataRow label="Total Units" value={totalUnits > 0 ? totalUnits : '—'} testId="text-total-units" />
                <DataRow label="Acres" value={formatValue(comp.acres)} testId="text-acres" />
                <DataRow label="Occupancy" value={comp.occupancy ? `${comp.occupancy}%` : '—'} testId="text-occupancy" />
                <DataRow label="Year Built" value={formatValue(comp.yearBuilt)} testId="text-year-built" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b">
                <Droplets className="h-3.5 w-3.5 text-primary" />
                <h4 className="text-xs font-semibold uppercase tracking-wide">Location</h4>
              </div>
              <div className="space-y-0">
                <DataRow label="Address" value={formatValue(comp.address)} testId="text-address" />
                <DataRow label="City" value={formatValue(comp.city)} testId="text-city" />
                <DataRow label="State" value={formatValue(comp.state)} testId="text-state" />
                <DataRow label="ZIP" value={formatValue(comp.zip)} testId="text-zip" />
                <DataRow label="Region" value={formatValue(comp.region)} testId="text-region" />
              </div>
            </div>

            <div className="bg-card border rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b">
                <Ship className="h-3.5 w-3.5 text-primary" />
                <h4 className="text-xs font-semibold uppercase tracking-wide">Water Access</h4>
              </div>
              <div className="space-y-0">
                <DataRow label="Body of Water" value={formatValue(comp.bodyOfWater)} testId="text-body-of-water" />
                <DataRow label="Water Body Name" value={formatValue(comp.waterBodyName)} testId="text-water-body-name" />
                <DataRow label="Waterfront" value={formatValue(comp.waterfront)} testId="text-waterfront" />
              </div>
              {comp.storageTypes && comp.storageTypes.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-1.5">Storage Types</p>
                  <div className="flex flex-wrap gap-1">
                    {comp.storageTypes.map((type, idx) => (
                      <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0">{type}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {(comp.seller || comp.company || comp.brokerage || comp.broker) && (
            <div className="bg-card border rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b">
                <Users className="h-3.5 w-3.5 text-primary" />
                <h4 className="text-xs font-semibold uppercase tracking-wide">Transaction Parties</h4>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Seller</p>
                  <p className="text-sm font-medium" data-testid="text-seller">{formatValue(comp.seller)}</p>
                  {comp.owner && <p className="text-xs text-muted-foreground">{comp.owner}</p>}
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Buyer</p>
                  <p className="text-sm font-medium" data-testid="text-buyer">{formatValue(comp.company)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Broker</p>
                  <p className="text-sm font-medium" data-testid="text-broker">{formatValue(comp.brokerage || comp.broker)}</p>
                  {comp.agentFirstName && (
                    <p className="text-xs text-muted-foreground">
                      {[comp.agentFirstName, comp.agentLastName].filter(Boolean).join(' ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {comp.articleUrls && comp.articleUrls.length > 0 && comp.articleUrls[0] !== '' && (
            <div className="bg-card border rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b">
                <ExternalLink className="h-3.5 w-3.5 text-primary" />
                <h4 className="text-xs font-semibold uppercase tracking-wide">Sources</h4>
              </div>
              <div className="space-y-1">
                {comp.articleUrls.slice(0, 3).map((url, idx) => (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1.5 truncate"
                    data-testid={`link-article-${idx}`}
                  >
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{url}</span>
                  </a>
                ))}
                {comp.articleUrls.length > 3 && (
                  <p className="text-xs text-muted-foreground">+{comp.articleUrls.length - 3} more</p>
                )}
              </div>
            </div>
          )}

          {comp.notes && (
            <div className="bg-card border rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <h4 className="text-xs font-semibold uppercase tracking-wide">Notes</h4>
              </div>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed" data-testid="text-notes">
                {comp.notes}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
