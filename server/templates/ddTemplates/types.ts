/**
 * DD Checklist Template Types
 */

export type RequestType = 'document' | 'data' | 'answer' | 'site_access' | 'verification' | 'other';
export type MilestoneAnchor = 'dd_start' | 'dd_expiration' | 'closing' | 'custom_milestone';
export type WorkspaceRole = 'owner_admin' | 'internal_member' | 'buyer' | 'seller' | 'broker' | 'lender' | 'attorney' | 'accountant' | 'consultant' | 'viewer';

export interface ChecklistTemplateItem {
  key: string;
  title: string;
  requestText: string;
  priority: 1 | 2 | 3;
  requestType: RequestType;
  defaultStatus?: 'open';
  milestoneAnchor?: MilestoneAnchor;
  dueOffsetDays?: number;
  defaultOwnerRole?: WorkspaceRole;
  tags?: string[];
  subCategory?: string;
}

export interface ChecklistTemplateSection {
  key: string;
  title: string;
  description?: string;
  defaultCollapsed?: boolean;
  items: ChecklistTemplateItem[];
}

export interface ChecklistTemplate {
  name: string;
  version: string;
  assetClass: string;
  sections: ChecklistTemplateSection[];
}

/** VDR folder mapping: section key prefix → VDR folder template key */
export const SECTION_TO_VDR_FOLDER: Record<string, string> = {
  executive: '01_exec',
  legal: '02_legal',
  financial: '03_financial',
  physical: '04_physical',
  environmental: '05_environmental',
  insurance: '06_insurance',
  lender: '07_lender',
  operations: '08_operations',
  closing: '09_closing',
  rent_roll: '03_financial',
  tax: '03_financial',
  utilities: '08_operations',
  compliance: '02_legal',
  it_systems: '08_operations',
  hr_payroll: '08_operations',
};
