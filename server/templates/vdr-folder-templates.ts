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

/** All available VDR folder templates */
export const VDR_FOLDER_TEMPLATES: VdrFolderTemplate[] = [];

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

export const VDR_FOLDER_TEMPLATE_FINANCIAL: VdrFolderTemplate = {
  name: "Financial Focus Data Room",
  version: "1.0.0",
  folders: [
    { key: "fin_statements", name: "01 Financial Statements", securityLevel: "confidential", children: [
      { key: "fin_pl", name: "P&L / Income Statements" },
      { key: "fin_balance", name: "Balance Sheets" },
      { key: "fin_cashflow", name: "Cash Flow Statements" },
      { key: "fin_ytd", name: "YTD / Interim Reports" },
    ]},
    { key: "fin_revenue", name: "02 Revenue", securityLevel: "confidential", children: [
      { key: "fin_rent_roll", name: "Rent Roll / Slip Roll" },
      { key: "fin_ar", name: "AR Aging & Collections" },
      { key: "fin_occupancy", name: "Occupancy History" },
      { key: "fin_rev_breakdown", name: "Revenue by Category" },
    ]},
    { key: "fin_expenses", name: "03 Operating Expenses", securityLevel: "confidential", children: [
      { key: "fin_expense_detail", name: "Expense Detail / GL" },
      { key: "fin_vendor_contracts", name: "Vendor Contracts" },
      { key: "fin_utilities", name: "Utility Bills" },
    ]},
    { key: "fin_tax_debt", name: "04 Tax & Debt", securityLevel: "restricted", children: [
      { key: "fin_tax_returns", name: "Tax Returns" },
      { key: "fin_property_tax", name: "Property Tax Bills" },
      { key: "fin_debt", name: "Loan Documents" },
    ]},
    { key: "fin_capex", name: "05 Capital Expenditures", securityLevel: "confidential", children: [
      { key: "fin_capex_history", name: "Historical CapEx" },
      { key: "fin_capex_plan", name: "Planned Improvements" },
      { key: "fin_capex_bids", name: "Bids & Estimates" },
    ]},
    { key: "fin_modeling", name: "06 Pro Forma & Models", securityLevel: "confidential", children: [
      { key: "fin_proforma", name: "Pro Forma" },
      { key: "fin_underwriting", name: "Underwriting Assumptions" },
      { key: "fin_comps", name: "Comparable Sales / Rates" },
    ]},
  ],
};

export const VDR_FOLDER_TEMPLATE_LEGAL: VdrFolderTemplate = {
  name: "Legal & Title Data Room",
  version: "1.0.0",
  folders: [
    { key: "legal_title", name: "01 Title & Ownership", securityLevel: "restricted", children: [
      { key: "legal_title_report", name: "Title Report / Commitment" },
      { key: "legal_deed", name: "Deeds" },
      { key: "legal_survey", name: "Surveys" },
      { key: "legal_easements", name: "Easements & Encumbrances" },
    ]},
    { key: "legal_entity", name: "02 Entity & Formation", securityLevel: "restricted", children: [
      { key: "legal_formation", name: "Formation Documents" },
      { key: "legal_operating", name: "Operating Agreements" },
      { key: "legal_certificates", name: "Good Standing Certificates" },
    ]},
    { key: "legal_leases", name: "03 Leases & Contracts", securityLevel: "restricted", children: [
      { key: "legal_lease_all", name: "All Leases" },
      { key: "legal_lease_abstracts", name: "Lease Abstracts" },
      { key: "legal_ground_lease", name: "Ground Lease" },
      { key: "legal_service", name: "Service Contracts" },
    ]},
    { key: "legal_compliance", name: "04 Permits & Zoning", securityLevel: "confidential", children: [
      { key: "legal_zoning", name: "Zoning / Land Use" },
      { key: "legal_permits", name: "Permits & Licenses" },
      { key: "legal_ada", name: "ADA Compliance" },
      { key: "legal_violations", name: "Violations & Citations" },
    ]},
    { key: "legal_litigation", name: "05 Litigation", securityLevel: "restricted", children: [
      { key: "legal_pending", name: "Pending Litigation" },
      { key: "legal_settled", name: "Settled / Historical" },
    ]},
    { key: "legal_closing", name: "06 Transaction Documents", securityLevel: "restricted", children: [
      { key: "legal_psa", name: "PSA / Amendments" },
      { key: "legal_loi", name: "LOI / Term Sheets" },
      { key: "legal_closing_docs", name: "Closing Package" },
    ]},
  ],
};

export const VDR_FOLDER_TEMPLATE_OPERATIONS: VdrFolderTemplate = {
  name: "Operations Data Room",
  version: "1.0.0",
  folders: [
    { key: "ops_staff", name: "01 Staff & HR", securityLevel: "confidential", children: [
      { key: "ops_org_chart", name: "Org Chart" },
      { key: "ops_employee_roster", name: "Employee Roster" },
      { key: "ops_benefits", name: "Benefits & Comp" },
      { key: "ops_contracts", name: "Employment Contracts" },
    ]},
    { key: "ops_property", name: "02 Property & Facilities", securityLevel: "confidential", children: [
      { key: "ops_condition", name: "Condition Reports / PCA" },
      { key: "ops_equipment", name: "Equipment Inventory" },
      { key: "ops_maintenance", name: "Maintenance Records" },
      { key: "ops_photos", name: "Photos & Site Plans" },
    ]},
    { key: "ops_vendors", name: "03 Vendors & Services", securityLevel: "confidential", children: [
      { key: "ops_vendor_list", name: "Vendor List" },
      { key: "ops_vendor_contracts", name: "Service Contracts" },
      { key: "ops_insurance", name: "Insurance Policies" },
    ]},
    { key: "ops_technology", name: "04 Technology & Systems", securityLevel: "confidential", children: [
      { key: "ops_software", name: "Software & PMS" },
      { key: "ops_it_infra", name: "IT Infrastructure" },
      { key: "ops_security", name: "Security Systems" },
    ]},
    { key: "ops_customers", name: "05 Customers & Marketing", securityLevel: "confidential", children: [
      { key: "ops_customer_data", name: "Customer Data" },
      { key: "ops_waitlist", name: "Waitlist" },
      { key: "ops_marketing", name: "Marketing & Advertising" },
    ]},
    { key: "ops_env", name: "06 Environmental & Compliance", securityLevel: "restricted", children: [
      { key: "ops_env_reports", name: "Environmental Reports" },
      { key: "ops_permits", name: "Permits & Licenses" },
      { key: "ops_regulatory", name: "Regulatory Compliance" },
    ]},
  ],
};

export const VDR_FOLDER_TEMPLATE_MINIMAL: VdrFolderTemplate = {
  name: "Minimal / Quick Deal",
  version: "1.0.0",
  folders: [
    { key: "min_overview", name: "Deal Overview" },
    { key: "min_financials", name: "Financials" },
    { key: "min_legal", name: "Legal & Title" },
    { key: "min_physical", name: "Physical & Environmental" },
    { key: "min_closing", name: "Closing", securityLevel: "restricted" },
  ],
};

// Register all templates
VDR_FOLDER_TEMPLATES.push(
  VDR_FOLDER_TEMPLATE_DEFAULT,
  VDR_FOLDER_TEMPLATE_FINANCIAL,
  VDR_FOLDER_TEMPLATE_LEGAL,
  VDR_FOLDER_TEMPLATE_OPERATIONS,
  VDR_FOLDER_TEMPLATE_MINIMAL,
);
