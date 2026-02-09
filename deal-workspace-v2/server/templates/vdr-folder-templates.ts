/**
 * Default VDR Folder Tree Template
 * Used during workspace DD project provisioning to create the data room structure.
 */

export interface VdrFolderNode {
  key: string;
  name: string;
  children?: VdrFolderNode[];
  securityLevel?: "public" | "confidential" | "restricted";
}

export interface VdrFolderTemplate {
  name: string;
  version: string;
  folders: VdrFolderNode[];
}

export const VDR_FOLDER_TEMPLATE_DEFAULT: VdrFolderTemplate = {
  name: "Standard Deal Data Room",
  version: "1.0.0",
  folders: [
    { key: "01_exec", name: "01 Executive Summary", securityLevel: "confidential", children: [
      { key: "01_exec_overview", name: "Deal Overview", securityLevel: "confidential" },
      { key: "01_exec_key_dates", name: "Key Dates & Milestones", securityLevel: "confidential" },
      { key: "01_exec_contacts", name: "Contacts", securityLevel: "confidential" },
    ]},
    { key: "02_legal", name: "02 Legal", securityLevel: "restricted", children: [
      { key: "02_legal_psa", name: "PSA / Amendments", securityLevel: "restricted" },
      { key: "02_legal_title", name: "Title / Commitment / Policy", securityLevel: "restricted" },
      { key: "02_legal_survey", name: "Survey", securityLevel: "restricted" },
      { key: "02_legal_easements", name: "Easements / Recorded Docs", securityLevel: "restricted" },
      { key: "02_legal_leases", name: "Leases / Contracts", securityLevel: "restricted" },
      { key: "02_legal_entity", name: "Entity / Closing Documents", securityLevel: "restricted" },
    ]},
    { key: "03_financial", name: "03 Financial", securityLevel: "confidential", children: [
      { key: "03_fin_hist", name: "Historical Financials", securityLevel: "confidential" },
      { key: "03_fin_t12", name: "T12 / YTD", securityLevel: "confidential" },
      { key: "03_fin_gl", name: "General Ledger", securityLevel: "confidential" },
      { key: "03_fin_roll", name: "Rent Roll / Slip Roll", securityLevel: "confidential" },
      { key: "03_fin_capex", name: "CapEx History", securityLevel: "confidential" },
      { key: "03_fin_tax", name: "Tax Bills / Assessments", securityLevel: "confidential" },
    ]},
    { key: "04_physical", name: "04 Physical / Site", securityLevel: "confidential", children: [
      { key: "04_phys_pca", name: "Condition Reports / PCA", securityLevel: "confidential" },
      { key: "04_phys_repairs", name: "Repairs / Vendor Quotes", securityLevel: "confidential" },
      { key: "04_phys_photos", name: "Photos / Plans", securityLevel: "confidential" },
    ]},
    { key: "05_environmental", name: "05 Environmental", securityLevel: "restricted", children: [
      { key: "05_env_phase1", name: "Phase I", securityLevel: "restricted" },
      { key: "05_env_phase2", name: "Phase II / Remediation", securityLevel: "restricted" },
      { key: "05_env_flood", name: "Flood / Storm / Resiliency", securityLevel: "restricted" },
    ]},
    { key: "06_insurance", name: "06 Insurance", securityLevel: "confidential", children: [
      { key: "06_ins_quotes", name: "Quotes", securityLevel: "confidential" },
      { key: "06_ins_policies", name: "Policies / Certificates", securityLevel: "confidential" },
    ]},
    { key: "07_lender", name: "07 Lender / Financing", securityLevel: "confidential", children: [
      { key: "07_lend_terms", name: "Term Sheets / Commitment", securityLevel: "confidential" },
      { key: "07_lend_appraisal", name: "Appraisal", securityLevel: "confidential" },
      { key: "07_lend_conditions", name: "Conditions / Deliverables", securityLevel: "confidential" },
    ]},
    { key: "08_operations", name: "08 Operations", securityLevel: "confidential", children: [
      { key: "08_ops_staff", name: "Staff / Payroll", securityLevel: "confidential" },
      { key: "08_ops_rates", name: "Rates / Policies", securityLevel: "confidential" },
      { key: "08_ops_vendors", name: "Vendors / Service Contracts", securityLevel: "confidential" },
    ]},
    { key: "09_closing", name: "09 Closing", securityLevel: "restricted", children: [
      { key: "09_close_settlement", name: "Settlement Statement / Prorations", securityLevel: "restricted" },
      { key: "09_close_recorded", name: "Recorded Documents", securityLevel: "restricted" },
      { key: "09_close_final", name: "Final Closing Package", securityLevel: "restricted" },
    ]},
  ],
};
