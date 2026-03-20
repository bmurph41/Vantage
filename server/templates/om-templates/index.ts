export interface OMSection {
  id: string;
  title: string;
  type: 'executive_summary' | 'property_overview' | 'financial_analysis' | 'market_overview' | 'rent_roll' | 'operations' | 'comps' | 'photos' | 'appendix';
  required: boolean;
  defaultContent?: string;
}

export interface OMTemplate {
  id: string;
  name: string;
  assetClass: string;
  description: string;
  sections: OMSection[];
  thumbnail?: string;
}

import { marinaOMTemplate } from './marina-om';
import { multifamilyOMTemplate } from './multifamily-om';
import { hotelOMTemplate } from './hotel-om';
import { retailOMTemplate } from './retail-om';
import { industrialOMTemplate } from './industrial-om';

export const omTemplateRegistry: OMTemplate[] = [
  marinaOMTemplate,
  multifamilyOMTemplate,
  hotelOMTemplate,
  retailOMTemplate,
  industrialOMTemplate,
];

export function getOMTemplateById(id: string): OMTemplate | undefined {
  return omTemplateRegistry.find(t => t.id === id);
}

export function getOMTemplatesByAssetClass(assetClass: string): OMTemplate[] {
  return omTemplateRegistry.filter(t => t.assetClass === assetClass);
}
