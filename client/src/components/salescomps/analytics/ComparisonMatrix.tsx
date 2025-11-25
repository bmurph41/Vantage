import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrency, formatPercentage } from "@/lib/salescomps/format";

interface CompData {
  id: string;
  propertyName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  saleDate: string | null;
  salePrice: number | string | null;
  totalSlips: number | string | null;
  pricePerSlip: number | string | null;
  capRate: number | string | null;
  waterType: string | null;
  coastalType: string | null;
  region: string | null;
  storageTypes: string[] | null;
  profitCenters: string[] | null;
  buyerName: string | null;
  sellerName: string | null;
  brokerName: string | null;
  isPortfolio: boolean | null;
}

interface ComparisonMatrixProps {
  comps: CompData[];
  onRemoveComp: (compId: string) => void;
  onClose?: () => void;
}

export default function ComparisonMatrix({ comps, onRemoveComp, onClose }: ComparisonMatrixProps) {
  if (comps.length === 0) {
    return (
      <Card className="p-8 text-center border-dashed">
        <p className="text-sm text-muted-foreground">
          No properties selected for comparison. Select 2-6 properties to compare side by side.
        </p>
      </Card>
    );
  }

  // Helper to get numeric value
  const getNumber = (value: number | string | null): number | null => {
    if (value === null) return null;
    return typeof value === 'string' ? parseFloat(value) : value;
  };

  // Calculate comparison indicators
  const getPriceIndicator = (price: number | string | null, avgPrice: number) => {
    const numPrice = getNumber(price);
    if (!numPrice) return null;
    
    const diff = ((numPrice - avgPrice) / avgPrice) * 100;
    if (Math.abs(diff) < 5) return { icon: Minus, color: 'text-gray-500', text: 'On par' };
    if (diff > 0) return { icon: TrendingUp, color: 'text-red-500', text: `+${diff.toFixed(2)}%` };
    return { icon: TrendingDown, color: 'text-green-500', text: `${diff.toFixed(2)}%` };
  };

  const getCapacityIndicator = (capacity: number | string | null, avgCapacity: number) => {
    const numCap = getNumber(capacity);
    if (!numCap) return null;
    
    const diff = ((numCap - avgCapacity) / avgCapacity) * 100;
    if (Math.abs(diff) < 10) return { icon: Minus, color: 'text-gray-500', text: 'Average' };
    if (diff > 0) return { icon: TrendingUp, color: 'text-blue-500', text: `+${diff.toFixed(0)}%` };
    return { icon: TrendingDown, color: 'text-blue-500', text: `${diff.toFixed(0)}%` };
  };

  // Calculate averages for comparison
  const prices = comps.map(c => getNumber(c.salePrice)).filter((p): p is number => p !== null);
  const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

  const capacities = comps.map(c => getNumber(c.totalSlips)).filter((c): c is number => c !== null);
  const avgCapacity = capacities.length > 0 ? capacities.reduce((a, b) => a + b, 0) / capacities.length : 0;

  const ppsValues = comps.map(c => getNumber(c.pricePerSlip)).filter((p): p is number => p !== null);
  const avgPPS = ppsValues.length > 0 ? ppsValues.reduce((a, b) => a + b, 0) / ppsValues.length : 0;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Side-by-Side Comparison</h3>
          <p className="text-sm text-muted-foreground">
            Comparing {comps.length} {comps.length === 1 ? 'property' : 'properties'}
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full align-middle">
          <div className="grid gap-4" style={{ gridTemplateColumns: `200px repeat(${comps.length}, minmax(280px, 1fr))` }}>
            
            {/* Header Row - Property Names */}
            <div className="font-semibold text-sm text-muted-foreground bg-muted/30 p-3 rounded-tl-lg sticky left-0">
              Property
            </div>
            {comps.map((comp) => (
              <div key={comp.id} className="bg-muted/30 p-3 rounded-t-lg">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-semibold text-sm truncate">{comp.propertyName || 'Unnamed'}</p>
                    <p className="text-xs text-muted-foreground">
                      {comp.city && comp.state ? `${comp.city}, ${comp.state}` : comp.state || '-'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => onRemoveComp(comp.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                {comp.isPortfolio && (
                  <Badge variant="secondary" className="mt-2 text-xs">
                    Portfolio
                  </Badge>
                )}
              </div>
            ))}

            {/* Sale Price */}
            <div className="font-medium text-sm bg-background border-t p-3 sticky left-0">
              Sale Price
            </div>
            {comps.map((comp) => {
              const indicator = getPriceIndicator(comp.salePrice, avgPrice);
              return (
                <div key={`price-${comp.id}`} className="border-t p-3">
                  <p className="font-semibold text-sm">
                    {comp.salePrice ? `$${getNumber(comp.salePrice)?.toLocaleString()}` : '-'}
                  </p>
                  {indicator && (
                    <div className={`flex items-center gap-1 text-xs mt-1 ${indicator.color}`}>
                      <indicator.icon className="h-3 w-3" />
                      <span>{indicator.text}</span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Sale Date */}
            <div className="font-medium text-sm bg-background border-t p-3 sticky left-0">
              Sale Date
            </div>
            {comps.map((comp) => (
              <div key={`date-${comp.id}`} className="border-t p-3">
                <p className="text-sm">
                  {comp.saleDate ? new Date(comp.saleDate).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  }) : '-'}
                </p>
              </div>
            ))}

            {/* Total Slips */}
            <div className="font-medium text-sm bg-background border-t p-3 sticky left-0">
              Total Slips
            </div>
            {comps.map((comp) => {
              const indicator = getCapacityIndicator(comp.totalSlips, avgCapacity);
              return (
                <div key={`slips-${comp.id}`} className="border-t p-3">
                  <p className="font-semibold text-sm">
                    {comp.totalSlips ? getNumber(comp.totalSlips)?.toLocaleString() : '-'}
                  </p>
                  {indicator && (
                    <div className={`flex items-center gap-1 text-xs mt-1 ${indicator.color}`}>
                      <indicator.icon className="h-3 w-3" />
                      <span>{indicator.text}</span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Price Per Slip */}
            <div className="font-medium text-sm bg-background border-t p-3 sticky left-0">
              Price Per Slip
            </div>
            {comps.map((comp) => {
              const pps = getNumber(comp.pricePerSlip);
              const diff = pps && avgPPS ? ((pps - avgPPS) / avgPPS) * 100 : null;
              return (
                <div key={`pps-${comp.id}`} className="border-t p-3">
                  <p className="font-semibold text-sm">
                    {pps ? `$${pps.toLocaleString()}` : '-'}
                  </p>
                  {diff !== null && Math.abs(diff) >= 5 && (
                    <p className={`text-xs mt-1 ${diff > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {diff > 0 ? '+' : ''}{diff.toFixed(2)}% vs avg
                    </p>
                  )}
                </div>
              );
            })}

            {/* Cap Rate */}
            <div className="font-medium text-sm bg-background border-t p-3 sticky left-0">
              Cap Rate
            </div>
            {comps.map((comp) => {
              const capRate = getNumber(comp.capRate);
              return (
                <div key={`cap-${comp.id}`} className="border-t p-3">
                  <p className="text-sm">
                    {capRate ? `${(capRate * 100).toFixed(2)}%` : '-'}
                  </p>
                </div>
              );
            })}

            {/* Water Type */}
            <div className="font-medium text-sm bg-background border-t p-3 sticky left-0">
              Water Type
            </div>
            {comps.map((comp) => (
              <div key={`water-${comp.id}`} className="border-t p-3">
                <p className="text-sm">{comp.waterType || '-'}</p>
              </div>
            ))}

            {/* Coastal Type */}
            <div className="font-medium text-sm bg-background border-t p-3 sticky left-0">
              Coastal Type
            </div>
            {comps.map((comp) => (
              <div key={`coastal-${comp.id}`} className="border-t p-3">
                <p className="text-sm">{comp.coastalType || '-'}</p>
              </div>
            ))}

            {/* Region */}
            <div className="font-medium text-sm bg-background border-t p-3 sticky left-0">
              Region
            </div>
            {comps.map((comp) => (
              <div key={`region-${comp.id}`} className="border-t p-3">
                <p className="text-sm">{comp.region || '-'}</p>
              </div>
            ))}

            {/* Storage Types */}
            <div className="font-medium text-sm bg-background border-t p-3 sticky left-0">
              Storage Types
            </div>
            {comps.map((comp) => (
              <div key={`storage-${comp.id}`} className="border-t p-3">
                <div className="flex flex-wrap gap-1">
                  {comp.storageTypes && comp.storageTypes.length > 0 ? (
                    comp.storageTypes.map((type, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {type}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </div>
              </div>
            ))}

            {/* Profit Centers */}
            <div className="font-medium text-sm bg-background border-t p-3 sticky left-0">
              Profit Centers
            </div>
            {comps.map((comp) => (
              <div key={`profit-${comp.id}`} className="border-t p-3">
                <div className="flex flex-wrap gap-1">
                  {comp.profitCenters && comp.profitCenters.length > 0 ? (
                    comp.profitCenters.map((pc, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {pc}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </div>
              </div>
            ))}

            {/* Buyer */}
            <div className="font-medium text-sm bg-background border-t p-3 sticky left-0">
              Buyer
            </div>
            {comps.map((comp) => (
              <div key={`buyer-${comp.id}`} className="border-t p-3">
                <p className="text-sm">{comp.buyerName || '-'}</p>
              </div>
            ))}

            {/* Seller */}
            <div className="font-medium text-sm bg-background border-t p-3 sticky left-0">
              Seller
            </div>
            {comps.map((comp) => (
              <div key={`seller-${comp.id}`} className="border-t p-3">
                <p className="text-sm">{comp.sellerName || '-'}</p>
              </div>
            ))}

            {/* Broker */}
            <div className="font-medium text-sm bg-background border-t p-3 sticky left-0 rounded-bl-lg">
              Broker
            </div>
            {comps.map((comp, idx) => (
              <div key={`broker-${comp.id}`} className={`border-t p-3 ${idx === comps.length - 1 ? 'rounded-br-lg' : ''}`}>
                <p className="text-sm">{comp.brokerName || '-'}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="mt-6 pt-6 border-t grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Avg Sale Price</p>
          <p className="text-sm font-semibold">
            {avgPrice > 0 ? `$${avgPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Avg Capacity</p>
          <p className="text-sm font-semibold">
            {avgCapacity > 0 ? `${avgCapacity.toLocaleString(undefined, { maximumFractionDigits: 0 })} slips` : '-'}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Avg Price/Slip</p>
          <p className="text-sm font-semibold">
            {avgPPS > 0 ? `$${avgPPS.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
          </p>
        </div>
      </div>
    </Card>
  );
}
