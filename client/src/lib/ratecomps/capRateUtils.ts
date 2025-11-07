import type { RateComp } from "@shared/schema";

export function deriveEffectiveCapRate(comp: RateComp): number | null {
  const storedCapRate = typeof comp.capRate === 'string' ? parseFloat(comp.capRate) : comp.capRate;
  if (storedCapRate != null && isFinite(storedCapRate)) {
    return storedCapRate;
  }
  
  const noi = typeof comp.noi === 'string' ? parseFloat(comp.noi) : comp.noi;
  const salePrice = typeof comp.salePrice === 'string' ? parseFloat(comp.salePrice) : comp.salePrice;
  
  if (
    comp.isNoiDisclosed &&
    comp.isPriceDisclosed &&
    noi != null &&
    salePrice != null &&
    isFinite(noi) &&
    isFinite(salePrice) &&
    noi > 0 &&
    salePrice > 0
  ) {
    return (noi / salePrice);
  }
  
  return null;
}

export function hasCapRateData(comp: RateComp): boolean {
  return deriveEffectiveCapRate(comp) !== null;
}

export function getCapRateDisclosureStatus(comp: RateComp): {
  hasCapRate: boolean;
  isCalculated: boolean;
  isStored: boolean;
} {
  const storedCapRate = typeof comp.capRate === 'string' ? parseFloat(comp.capRate) : comp.capRate;
  const hasStored = storedCapRate != null && isFinite(storedCapRate);
  
  const noi = typeof comp.noi === 'string' ? parseFloat(comp.noi) : comp.noi;
  const salePrice = typeof comp.salePrice === 'string' ? parseFloat(comp.salePrice) : comp.salePrice;
  
  const canCalculate = (comp.isNoiDisclosed ?? true) && 
                      (comp.isPriceDisclosed ?? true) && 
                      noi != null && 
                      salePrice != null &&
                      isFinite(noi) &&
                      isFinite(salePrice) &&
                      noi > 0 &&
                      salePrice > 0;
  
  return {
    hasCapRate: hasStored || canCalculate,
    isCalculated: !hasStored && canCalculate,
    isStored: hasStored
  };
}

export function formatCapRate(comp: RateComp): string {
  const capRate = deriveEffectiveCapRate(comp);
  const { isCalculated } = getCapRateDisclosureStatus(comp);
  
  if (capRate == null) {
    return '—';
  }
  
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(capRate);
  
  return isCalculated ? `${formatted}*` : formatted;
}

export function extractCapRates(comps: RateComp[]): number[] {
  return comps
    .map(comp => deriveEffectiveCapRate(comp))
    .filter((capRate): capRate is number => capRate !== null);
}

export function getCapRateDisclosureCounts(comps: RateComp[]): {
  total: number;
  disclosed: number;
  calculated: number;
  unavailable: number;
} {
  let disclosed = 0;
  let calculated = 0;
  let unavailable = 0;
  
  comps.forEach(comp => {
    const status = getCapRateDisclosureStatus(comp);
    if (status.isStored) {
      disclosed++;
    } else if (status.isCalculated) {
      calculated++;
    } else {
      unavailable++;
    }
  });
  
  return {
    total: comps.length,
    disclosed,
    calculated,
    unavailable
  };
}
