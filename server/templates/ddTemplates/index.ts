export { GENERAL_CRE_TEMPLATE } from './generalCre';
export { MARINA_ADDON_TEMPLATE } from './marina';
export { OFFICE_ADDON_TEMPLATE, RETAIL_ADDON_TEMPLATE, INDUSTRIAL_ADDON_TEMPLATE, OPERATING_BIZ_ADDON_TEMPLATE } from './addons';
export { QUICK_START_TEMPLATES, FINANCIAL_QUICK_TEMPLATE, LEGAL_QUICK_TEMPLATE, OPERATIONS_QUICK_TEMPLATE, ENVIRONMENTAL_QUICK_TEMPLATE, INSURANCE_COMPLIANCE_QUICK_TEMPLATE, TECHNOLOGY_QUICK_TEMPLATE } from './quickStart';
export { SECTION_TO_VDR_FOLDER } from './types';
export type { ChecklistTemplate, ChecklistTemplateSection, ChecklistTemplateItem } from './types';

import { GENERAL_CRE_TEMPLATE } from './generalCre';
import { MARINA_ADDON_TEMPLATE } from './marina';
import { OFFICE_ADDON_TEMPLATE, RETAIL_ADDON_TEMPLATE, INDUSTRIAL_ADDON_TEMPLATE, OPERATING_BIZ_ADDON_TEMPLATE } from './addons';
import { QUICK_START_TEMPLATES } from './quickStart';
import { ChecklistTemplate } from './types';

/** All built-in templates (comprehensive + add-ons) */
export const DD_CHECKLIST_TEMPLATES: ChecklistTemplate[] = [
  GENERAL_CRE_TEMPLATE,
  MARINA_ADDON_TEMPLATE,
  OFFICE_ADDON_TEMPLATE,
  RETAIL_ADDON_TEMPLATE,
  INDUSTRIAL_ADDON_TEMPLATE,
  OPERATING_BIZ_ADDON_TEMPLATE,
];

/** All templates including quick-start */
export const ALL_TEMPLATES: ChecklistTemplate[] = [
  ...DD_CHECKLIST_TEMPLATES,
  ...QUICK_START_TEMPLATES,
];

/** Count items across all templates for verification */
export function countTemplateItems(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of DD_CHECKLIST_TEMPLATES) {
    counts[t.name] = t.sections.reduce((sum, s) => sum + s.items.length, 0);
  }
  return counts;
}
// Expected counts:
// General CRE: 145 items
// Marina Add-On: 65 items
// Office Add-On: 20 items
// Retail Add-On: 15 items
// Industrial Add-On: 15 items
// Operating Business: 36 items (~80 with General CRE merge)
