/**
 * Quick-Start DD Templates
 *
 * Focused, category-specific templates users can mix and match.
 * Each contains 15-25 high-priority items for that diligence area.
 */

import type { ChecklistTemplate } from './types';

export const FINANCIAL_QUICK_TEMPLATE: ChecklistTemplate = {
  name: 'Financial Due Diligence',
  version: '1.0.0',
  assetClass: 'general_cre',
  sections: [
    {
      key: 'fin_statements',
      title: 'Financial Statements',
      description: 'Historical P&L, balance sheets, and supporting schedules',
      items: [
        { key: 'fin_pl_3yr', title: 'Profit & Loss Statements (3 years)', requestText: 'Provide trailing 3-year P&L with monthly detail.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 7 },
        { key: 'fin_bs_3yr', title: 'Balance Sheets (3 years)', requestText: 'Annual balance sheets for the last 3 fiscal years.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 7 },
        { key: 'fin_ytd_financials', title: 'Year-to-Date Financials', requestText: 'Current YTD P&L and balance sheet as of latest month-end.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 5 },
        { key: 'fin_cash_flow', title: 'Cash Flow Statements', requestText: 'Cash flow statements for the last 3 years.', priority: 2, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 10 },
        { key: 'fin_gl_detail', title: 'General Ledger Detail', requestText: 'GL export for the trailing 12 months with account descriptions.', priority: 2, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 14 },
        { key: 'fin_chart_of_accounts', title: 'Chart of Accounts', requestText: 'Current chart of accounts with descriptions.', priority: 3, requestType: 'document' },
      ],
    },
    {
      key: 'fin_revenue',
      title: 'Revenue & Rent Roll',
      description: 'Revenue breakdown, rent rolls, and occupancy data',
      items: [
        { key: 'fin_rent_roll', title: 'Current Rent Roll', requestText: 'Detailed rent roll showing all tenants/slips, unit types, rates, lease dates, and escalation schedules.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 5 },
        { key: 'fin_revenue_breakdown', title: 'Revenue Breakdown by Category', requestText: 'Revenue by source (slip rentals, dry storage, fuel, ship store, service, etc.) for 3 years.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 7 },
        { key: 'fin_occupancy_history', title: 'Historical Occupancy', requestText: 'Monthly occupancy rates by unit type for the last 3 years.', priority: 1, requestType: 'data', milestoneAnchor: 'dd_start', dueOffsetDays: 10 },
        { key: 'fin_ar_aging', title: 'Accounts Receivable Aging', requestText: 'Current AR aging report showing outstanding balances by tenant.', priority: 2, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 7 },
        { key: 'fin_delinquency', title: 'Delinquency & Bad Debt History', requestText: 'Summary of delinquencies and write-offs for the last 3 years.', priority: 2, requestType: 'data' },
      ],
    },
    {
      key: 'fin_expenses',
      title: 'Operating Expenses',
      description: 'Expense detail, contracts, and vendor information',
      items: [
        { key: 'fin_expense_detail', title: 'Detailed Expense Breakdown', requestText: 'Operating expenses by line item with monthly detail for trailing 12 months.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 7 },
        { key: 'fin_capex_history', title: 'Capital Expenditure History', requestText: 'CapEx spending for the last 5 years with descriptions and amounts.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 14 },
        { key: 'fin_vendor_contracts', title: 'Major Vendor Contracts', requestText: 'Copies of contracts for top 10 vendors/service providers by annual spend.', priority: 2, requestType: 'document', milestoneAnchor: 'dd_expiration', dueOffsetDays: -7 },
        { key: 'fin_utilities', title: 'Utility Expense Detail', requestText: 'Monthly utility bills (electric, water, gas, sewer, trash) for 24 months.', priority: 2, requestType: 'document' },
        { key: 'fin_ap_aging', title: 'Accounts Payable Aging', requestText: 'Current AP aging report.', priority: 3, requestType: 'document' },
      ],
    },
    {
      key: 'fin_tax',
      title: 'Tax & Debt',
      description: 'Tax returns, property taxes, and existing debt',
      items: [
        { key: 'fin_tax_returns', title: 'Tax Returns (3 years)', requestText: 'Federal and state tax returns for the entity for 3 years.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 14 },
        { key: 'fin_property_tax', title: 'Property Tax Bills', requestText: 'Property tax bills and assessment notices for the last 3 years.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 10 },
        { key: 'fin_debt_schedule', title: 'Existing Debt Schedule', requestText: 'All outstanding loans with balances, rates, maturity dates, and prepayment terms.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 7 },
        { key: 'fin_loan_docs', title: 'Loan Documents', requestText: 'Copies of existing loan agreements, promissory notes, and guarantees.', priority: 2, requestType: 'document' },
      ],
    },
  ],
};

export const LEGAL_QUICK_TEMPLATE: ChecklistTemplate = {
  name: 'Legal Due Diligence',
  version: '1.0.0',
  assetClass: 'general_cre',
  sections: [
    {
      key: 'legal_title',
      title: 'Title & Ownership',
      description: 'Title reports, deeds, and ownership documentation',
      items: [
        { key: 'legal_title_report', title: 'Preliminary Title Report', requestText: 'Current preliminary title report or title commitment from a licensed title company.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 5 },
        { key: 'legal_deed', title: 'Current Deed', requestText: 'Copy of the current recorded deed for the property.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 5 },
        { key: 'legal_survey', title: 'ALTA/NSPS Survey', requestText: 'Current ALTA survey or most recent boundary/topographic survey.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 7 },
        { key: 'legal_easements', title: 'Easements & Encumbrances', requestText: 'All recorded easements, encumbrances, and CC&Rs affecting the property.', priority: 1, requestType: 'document' },
        { key: 'legal_entity_docs', title: 'Entity Formation Documents', requestText: 'Operating agreement, articles of organization/incorporation, and good standing certificates.', priority: 2, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 10 },
      ],
    },
    {
      key: 'legal_leases',
      title: 'Leases & Agreements',
      description: 'All lease agreements and material contracts',
      items: [
        { key: 'legal_lease_agreements', title: 'All Lease Agreements', requestText: 'Copies of all current leases, subleases, and license agreements with tenants/slip holders.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 10 },
        { key: 'legal_ground_lease', title: 'Ground Lease (if applicable)', requestText: 'Ground lease agreement and all amendments.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 7 },
        { key: 'legal_service_contracts', title: 'Service Contracts', requestText: 'All service contracts, management agreements, and vendor agreements.', priority: 2, requestType: 'document' },
        { key: 'legal_lease_abstracts', title: 'Lease Abstract Schedule', requestText: 'Summary schedule of all leases showing key terms, dates, rates, options, and escalations.', priority: 2, requestType: 'data' },
      ],
    },
    {
      key: 'legal_compliance',
      title: 'Compliance & Litigation',
      description: 'Permits, zoning, litigation, and regulatory compliance',
      items: [
        { key: 'legal_zoning', title: 'Zoning Confirmation', requestText: 'Zoning letter or certificate confirming current zoning classification and permitted uses.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 14 },
        { key: 'legal_permits', title: 'Permits & Licenses', requestText: 'All current operating permits, business licenses, and regulatory approvals.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 14 },
        { key: 'legal_litigation', title: 'Pending & Threatened Litigation', requestText: 'Summary of all pending, threatened, or settled litigation in the last 5 years.', priority: 1, requestType: 'answer', milestoneAnchor: 'dd_start', dueOffsetDays: 7 },
        { key: 'legal_violations', title: 'Code Violations & Citations', requestText: 'All outstanding code violations, citations, or compliance orders.', priority: 1, requestType: 'document' },
        { key: 'legal_ada', title: 'ADA Compliance', requestText: 'ADA compliance status and any pending required improvements.', priority: 2, requestType: 'answer' },
        { key: 'legal_warranties', title: 'Warranties & Guarantees', requestText: 'All active warranties on building systems, equipment, and improvements.', priority: 3, requestType: 'document' },
      ],
    },
  ],
};

export const OPERATIONS_QUICK_TEMPLATE: ChecklistTemplate = {
  name: 'Operations Due Diligence',
  version: '1.0.0',
  assetClass: 'general_cre',
  sections: [
    {
      key: 'ops_staffing',
      title: 'Staffing & Management',
      description: 'Employee information, org chart, and management structure',
      items: [
        { key: 'ops_org_chart', title: 'Organizational Chart', requestText: 'Current org chart with all positions, names, and reporting structure.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 7 },
        { key: 'ops_employee_roster', title: 'Employee Roster', requestText: 'List of all employees with titles, hire dates, compensation, and FT/PT status.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 7 },
        { key: 'ops_mgmt_agreement', title: 'Management Agreement', requestText: 'Current property/marina management agreement and fee structure.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 10 },
        { key: 'ops_benefits', title: 'Employee Benefits Summary', requestText: 'Summary of all employee benefits (health, dental, 401k, PTO, etc.).', priority: 2, requestType: 'document' },
        { key: 'ops_employment_contracts', title: 'Key Employment Contracts', requestText: 'Employment agreements for all key personnel.', priority: 2, requestType: 'document' },
      ],
    },
    {
      key: 'ops_facilities',
      title: 'Facilities & Equipment',
      description: 'Physical condition, maintenance records, and equipment inventory',
      items: [
        { key: 'ops_condition_report', title: 'Property Condition Report', requestText: 'Most recent property condition assessment or engineering report.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 14 },
        { key: 'ops_equipment_list', title: 'Equipment & Asset Inventory', requestText: 'Complete inventory of all equipment, furniture, fixtures, and vehicles with age and condition.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 10 },
        { key: 'ops_maintenance_log', title: 'Maintenance & Repair Log', requestText: 'Maintenance records and major repair history for the last 3 years.', priority: 2, requestType: 'document' },
        { key: 'ops_deferred_maintenance', title: 'Deferred Maintenance List', requestText: 'Known deferred maintenance items with estimated costs to cure.', priority: 1, requestType: 'data', milestoneAnchor: 'dd_start', dueOffsetDays: 10 },
        { key: 'ops_capex_plan', title: 'Capital Improvement Plan', requestText: 'Planned or budgeted capital projects for the next 3-5 years.', priority: 2, requestType: 'document' },
      ],
    },
    {
      key: 'ops_systems',
      title: 'Systems & Technology',
      description: 'Software, POS, reservation systems, and IT infrastructure',
      items: [
        { key: 'ops_software', title: 'Software & Systems Inventory', requestText: 'List of all software systems (PMS, POS, accounting, CRM) with vendors, costs, and contract terms.', priority: 2, requestType: 'data', milestoneAnchor: 'dd_start', dueOffsetDays: 14 },
        { key: 'ops_it_contracts', title: 'IT Service Contracts', requestText: 'IT support, internet, phone, and security system contracts.', priority: 3, requestType: 'document' },
        { key: 'ops_security', title: 'Security Systems & Protocols', requestText: 'Description of security systems (cameras, access control, fire alarm) and emergency procedures.', priority: 3, requestType: 'answer' },
      ],
    },
    {
      key: 'ops_customers',
      title: 'Customer & Revenue Operations',
      description: 'Customer data, waitlists, marketing, and revenue operations',
      items: [
        { key: 'ops_customer_count', title: 'Customer/Tenant Count by Type', requestText: 'Breakdown of customers/tenants by type (annual, seasonal, transient, etc.) for 3 years.', priority: 1, requestType: 'data', milestoneAnchor: 'dd_start', dueOffsetDays: 7 },
        { key: 'ops_waitlist', title: 'Waitlist Information', requestText: 'Current waitlist by unit type/size with deposit amounts and estimated wait times.', priority: 2, requestType: 'data' },
        { key: 'ops_marketing', title: 'Marketing & Advertising', requestText: 'Current marketing channels, annual spend, and website analytics.', priority: 3, requestType: 'data' },
        { key: 'ops_customer_complaints', title: 'Customer Complaints Log', requestText: 'Summary of customer complaints or disputes in the last 2 years.', priority: 3, requestType: 'data' },
      ],
    },
  ],
};

export const ENVIRONMENTAL_QUICK_TEMPLATE: ChecklistTemplate = {
  name: 'Environmental Due Diligence',
  version: '1.0.0',
  assetClass: 'general_cre',
  sections: [
    {
      key: 'env_assessments',
      title: 'Environmental Assessments',
      description: 'Phase I, Phase II, and environmental site assessments',
      items: [
        { key: 'env_phase1', title: 'Phase I Environmental Site Assessment', requestText: 'Most recent Phase I ESA report per ASTM E1527-21 standards.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 7 },
        { key: 'env_phase2', title: 'Phase II ESA (if applicable)', requestText: 'Phase II ESA report if Phase I identified recognized environmental conditions (RECs).', priority: 1, requestType: 'document' },
        { key: 'env_remediation', title: 'Remediation Reports', requestText: 'Any remediation action plans, monitoring reports, or closure letters.', priority: 1, requestType: 'document' },
        { key: 'env_ust', title: 'Underground Storage Tank Records', requestText: 'UST registration, removal records, and monitoring data (fuel tanks, waste oil, etc.).', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 10 },
      ],
    },
    {
      key: 'env_compliance',
      title: 'Environmental Compliance',
      description: 'Permits, spill plans, and regulatory compliance',
      items: [
        { key: 'env_permits', title: 'Environmental Permits', requestText: 'All environmental permits (NPDES, stormwater, wetlands, air quality, etc.).', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 10 },
        { key: 'env_spill_plan', title: 'Spill Prevention & Response Plan', requestText: 'SPCC plan and/or Facility Response Plan.', priority: 1, requestType: 'document' },
        { key: 'env_hazmat', title: 'Hazardous Materials Inventory', requestText: 'Inventory of hazardous materials stored, used, or generated on-site.', priority: 2, requestType: 'document' },
        { key: 'env_waste_manifest', title: 'Waste Disposal Manifests', requestText: 'Hazardous waste manifests and disposal records for the last 3 years.', priority: 2, requestType: 'document' },
        { key: 'env_violations', title: 'Environmental Violations', requestText: 'History of environmental violations, notices of violation, or enforcement actions.', priority: 1, requestType: 'answer' },
        { key: 'env_asbestos_lead', title: 'Asbestos & Lead Paint Surveys', requestText: 'Asbestos and lead-based paint survey reports for pre-1978 structures.', priority: 2, requestType: 'document' },
      ],
    },
    {
      key: 'env_water',
      title: 'Water & Wetlands',
      description: 'Water quality, flood zones, and wetland delineation',
      items: [
        { key: 'env_flood_zone', title: 'Flood Zone Determination', requestText: 'FEMA flood zone determination and flood insurance policy.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 7 },
        { key: 'env_wetlands', title: 'Wetlands Delineation', requestText: 'Wetlands delineation report and Army Corps jurisdictional determination.', priority: 2, requestType: 'document' },
        { key: 'env_water_quality', title: 'Water Quality Testing', requestText: 'Water quality test results for marina basin, potable water, and wastewater.', priority: 2, requestType: 'document' },
        { key: 'env_stormwater', title: 'Stormwater Management Plan', requestText: 'Stormwater management plan and BMP maintenance records.', priority: 2, requestType: 'document' },
      ],
    },
  ],
};

export const INSURANCE_COMPLIANCE_QUICK_TEMPLATE: ChecklistTemplate = {
  name: 'Insurance & Compliance',
  version: '1.0.0',
  assetClass: 'general_cre',
  sections: [
    {
      key: 'ins_policies',
      title: 'Insurance Policies',
      description: 'All insurance coverage and claims history',
      items: [
        { key: 'ins_property', title: 'Property Insurance Policy', requestText: 'Current property/casualty insurance policy declarations page with coverage limits.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 7 },
        { key: 'ins_liability', title: 'General Liability Insurance', requestText: 'Current general liability insurance policy and declarations.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 7 },
        { key: 'ins_umbrella', title: 'Umbrella/Excess Liability', requestText: 'Umbrella or excess liability insurance policy.', priority: 2, requestType: 'document' },
        { key: 'ins_workers_comp', title: 'Workers Compensation', requestText: 'Workers compensation insurance policy and experience modification rate.', priority: 2, requestType: 'document' },
        { key: 'ins_flood', title: 'Flood Insurance', requestText: 'Flood insurance policy (if in flood zone).', priority: 1, requestType: 'document' },
        { key: 'ins_pollution', title: 'Pollution Liability', requestText: 'Environmental/pollution liability insurance policy.', priority: 2, requestType: 'document' },
        { key: 'ins_claims_history', title: 'Claims History (5 years)', requestText: 'Loss run reports from all carriers for the last 5 years.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 10 },
      ],
    },
    {
      key: 'ins_regulatory',
      title: 'Regulatory Compliance',
      description: 'Regulatory filings, certifications, and compliance status',
      items: [
        { key: 'ins_osha', title: 'OSHA Compliance Records', requestText: 'OSHA inspection reports, citations, and safety training records.', priority: 2, requestType: 'document' },
        { key: 'ins_fire_safety', title: 'Fire Safety Inspection', requestText: 'Most recent fire inspection report and fire suppression system certifications.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 14 },
        { key: 'ins_health_dept', title: 'Health Department Inspections', requestText: 'Health department inspection reports (if food service or pool on-site).', priority: 2, requestType: 'document' },
        { key: 'ins_elevator', title: 'Elevator/Lift Inspections', requestText: 'Elevator, boat lift, and hoist inspection certificates.', priority: 2, requestType: 'document' },
        { key: 'ins_certificates', title: 'Operating Certificates', requestText: 'Certificate of occupancy, business license, and any special operating permits.', priority: 1, requestType: 'document' },
        { key: 'ins_safety_plan', title: 'Safety & Emergency Plans', requestText: 'Safety manual, emergency action plan, and evacuation procedures.', priority: 3, requestType: 'document' },
      ],
    },
  ],
};

export const TECHNOLOGY_QUICK_TEMPLATE: ChecklistTemplate = {
  name: 'Technology & IT Due Diligence',
  version: '1.0.0',
  assetClass: 'general_cre',
  sections: [
    {
      key: 'tech_systems',
      title: 'Core Systems & Software',
      description: 'Property management, accounting, and business systems',
      items: [
        { key: 'tech_pms', title: 'Property/Marina Management System', requestText: 'PMS software details: vendor, version, contract terms, monthly cost, and data export capabilities.', priority: 1, requestType: 'answer', milestoneAnchor: 'dd_start', dueOffsetDays: 10 },
        { key: 'tech_accounting', title: 'Accounting Software', requestText: 'Accounting system details and integration with PMS.', priority: 2, requestType: 'answer' },
        { key: 'tech_pos', title: 'Point of Sale Systems', requestText: 'POS systems for retail, fuel, and food service operations.', priority: 2, requestType: 'answer' },
        { key: 'tech_reservation', title: 'Reservation/Booking System', requestText: 'Online reservation system details and booking channel integrations.', priority: 2, requestType: 'answer' },
        { key: 'tech_website', title: 'Website & Online Presence', requestText: 'Website hosting, domain ownership, and analytics access.', priority: 3, requestType: 'data' },
      ],
    },
    {
      key: 'tech_infrastructure',
      title: 'IT Infrastructure',
      description: 'Network, hardware, and connectivity',
      items: [
        { key: 'tech_network', title: 'Network Infrastructure', requestText: 'Network topology, WiFi coverage, and internet service details.', priority: 2, requestType: 'answer' },
        { key: 'tech_security_cameras', title: 'Security Camera System', requestText: 'Security camera system details: camera count, NVR/DVR, cloud storage, and coverage areas.', priority: 2, requestType: 'data' },
        { key: 'tech_access_control', title: 'Access Control & Gates', requestText: 'Access control system details: gate systems, key fobs, card readers, and lock management.', priority: 2, requestType: 'data' },
        { key: 'tech_data_backup', title: 'Data Backup & Recovery', requestText: 'Data backup procedures, disaster recovery plan, and business continuity procedures.', priority: 3, requestType: 'answer' },
        { key: 'tech_contracts', title: 'IT Vendor Contracts', requestText: 'All IT-related vendor contracts (ISP, phone, security monitoring, software subscriptions).', priority: 3, requestType: 'document' },
      ],
    },
  ],
};

/** All quick-start templates */
export const QUICK_START_TEMPLATES: ChecklistTemplate[] = [
  FINANCIAL_QUICK_TEMPLATE,
  LEGAL_QUICK_TEMPLATE,
  OPERATIONS_QUICK_TEMPLATE,
  ENVIRONMENTAL_QUICK_TEMPLATE,
  INSURANCE_COMPLIANCE_QUICK_TEMPLATE,
  TECHNOLOGY_QUICK_TEMPLATE,
];
