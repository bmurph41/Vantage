import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Edit, ExternalLink, MapPin, Building2, DollarSign, Calendar, Users, FileText, Waves } from "lucide-react";
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
          {/* Financial Information */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Financial Information</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Sale Price</p>
                <p className="font-medium" data-testid="text-sale-price">
                  {comp.isPriceDisclosed && comp.salePrice 
                    ? formatCurrency(comp.salePrice)
                    : comp.salePrice ? `${formatCurrency(comp.salePrice)} (Undisclosed)` : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">List Price</p>
                <p className="font-medium" data-testid="text-list-price">
                  {comp.listPrice ? formatCurrency(comp.listPrice) : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Cap Rate</p>
                <p className="font-medium" data-testid="text-cap-rate">
                  {comp.isCapRateDisclosed && comp.capRate 
                    ? `${(comp.capRate / 100).toFixed(2)}%`
                    : comp.capRate ? `${(comp.capRate / 100).toFixed(2)}% (Undisclosed)` : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">NOI</p>
                <p className="font-medium" data-testid="text-noi">
                  {comp.isNoiDisclosed && comp.noi 
                    ? formatCurrency(comp.noi)
                    : comp.noi ? `${formatCurrency(comp.noi)} (Undisclosed)` : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Days on Market</p>
                <p className="font-medium" data-testid="text-dom">
                  {formatValue(comp.daysOnMarket)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Sale Condition</p>
                <p className="font-medium" data-testid="text-sale-condition">
                  {formatValue(comp.saleCondition)}
                </p>
              </div>
            </div>
          </section>

          <Separator />

          {/* Property Details */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Property Details</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Sale Date</p>
                <p className="font-medium flex items-center gap-2" data-testid="text-sale-date">
                  <Calendar className="h-4 w-4" />
                  {formatDate(comp.saleMonth, comp.saleYear)}
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
              <div>
                <p className="text-sm text-muted-foreground mb-1">Occupancy</p>
                <p className="font-medium" data-testid="text-occupancy">
                  {comp.occupancy ? `${comp.occupancy}%` : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Acres</p>
                <p className="font-medium" data-testid="text-acres">
                  {formatValue(comp.acres)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Year Built</p>
                <p className="font-medium" data-testid="text-year-built">
                  {formatValue(comp.yearBuilt)}
                </p>
              </div>
              {comp.storageTypes && comp.storageTypes.length > 0 && (
                <div className="col-span-2 md:col-span-3">
                  <p className="text-sm text-muted-foreground mb-1">Storage Types</p>
                  <div className="flex flex-wrap gap-2">
                    {comp.storageTypes.map((type, idx) => (
                      <Badge key={idx} variant="secondary">{type}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          <Separator />

          {/* Location */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Waves className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Location & Water</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Address</p>
                <p className="font-medium" data-testid="text-address">
                  {formatValue(comp.address)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">ZIP Code</p>
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
                <p className="text-sm text-muted-foreground mb-1">Body of Water</p>
                <p className="font-medium" data-testid="text-body-of-water">
                  {formatValue(comp.bodyOfWater)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Water Body Name</p>
                <p className="font-medium" data-testid="text-water-body-name">
                  {formatValue(comp.waterBodyName)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Waterfront</p>
                <p className="font-medium" data-testid="text-waterfront">
                  {formatValue(comp.waterfront)}
                </p>
              </div>
            </div>
          </section>

          <Separator />

          {/* Transaction Parties */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Transaction Parties</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-medium mb-3">Seller</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Company</p>
                    <p className="text-sm" data-testid="text-seller-company">
                      {formatValue(comp.sellerCompany)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Principal</p>
                    <p className="text-sm" data-testid="text-seller-principal">
                      {formatValue(comp.sellerPrincipal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Legacy Seller Field</p>
                    <p className="text-sm" data-testid="text-seller">
                      {formatValue(comp.seller)}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-3">Buyer</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Company</p>
                    <p className="text-sm" data-testid="text-buyer-company">
                      {formatValue(comp.buyerCompany)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Principal</p>
                    <p className="text-sm" data-testid="text-buyer-principal">
                      {formatValue(comp.buyerPrincipal)}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-3">Brokerage</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Brokerage Name</p>
                    <p className="text-sm" data-testid="text-brokerage">
                      {formatValue(comp.brokerage)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Agent</p>
                    <p className="text-sm" data-testid="text-agent">
                      {[comp.agentFirstName, comp.agentLastName].filter(Boolean).join(' ') || '—'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Article URLs */}
          {comp.articleUrls && comp.articleUrls.length > 0 && comp.articleUrls[0] !== '' && (
            <>
              <Separator />
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <ExternalLink className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Article Links</h3>
                </div>
                <div className="space-y-2">
                  {comp.articleUrls.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-2"
                      data-testid={`link-article-${idx}`}
                    >
                      <ExternalLink className="h-3 w-3" />
                      {url}
                    </a>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* Notes */}
          {comp.notes && (
            <>
              <Separator />
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Notes</h3>
                </div>
                <p className="text-sm whitespace-pre-wrap" data-testid="text-notes">
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
