import { ChecklistTemplate } from './types';

export const GENERAL_CRE_TEMPLATE: ChecklistTemplate = {
  name: 'General CRE Acquisition DD',
  version: '1.0.0',
  assetClass: 'general_cre',
  sections: [
    // ═══ 1. EXECUTIVE / DEAL SETUP ═══════════════════════════════════════════
    {
      key: 'executive',
      title: 'Executive / Deal Setup',
      description: 'Foundational deal documents and project setup items',
      items: [
        { key: 'exec_01', title: 'Purchase & Sale Agreement', requestText: 'Provide fully executed PSA including all exhibits, addenda, and amendments.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 0, defaultOwnerRole: 'attorney', tags: ['psa'] },
        { key: 'exec_02', title: 'LOI / Term Sheet', requestText: 'Provide signed Letter of Intent or Term Sheet.', priority: 2, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 0 },
        { key: 'exec_03', title: 'Deal Summary / Investment Memo', requestText: 'Prepare internal deal summary with key metrics, thesis, and risk factors.', priority: 1, requestType: 'data', milestoneAnchor: 'dd_start', dueOffsetDays: 5, defaultOwnerRole: 'owner_admin' },
        { key: 'exec_04', title: 'Key Contacts List', requestText: 'Compile list of all parties involved: seller, brokers, attorneys, lender contacts, title company.', priority: 2, requestType: 'data', milestoneAnchor: 'dd_start', dueOffsetDays: 3 },
        { key: 'exec_05', title: 'Site Photos / Aerials', requestText: 'Provide recent aerial photographs and site photos of the property.', priority: 2, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 5 },
        { key: 'exec_06', title: 'Organizational Chart', requestText: 'Provide org chart of current ownership entity structure.', priority: 3, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'exec_07', title: 'Seller Representations', requestText: 'List of all seller representations and warranties per PSA.', priority: 1, requestType: 'document', defaultOwnerRole: 'attorney', milestoneAnchor: 'dd_start', dueOffsetDays: 5 },
        { key: 'exec_08', title: 'Earnest Money Deposit Confirmation', requestText: 'Provide wire confirmation for EMD deposit to escrow.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 3, defaultOwnerRole: 'owner_admin' },
        { key: 'exec_09', title: 'DD Timeline & Key Dates', requestText: 'Confirm DD expiration date, extension deadlines, closing date, and deposit schedules.', priority: 1, requestType: 'data', milestoneAnchor: 'dd_start', dueOffsetDays: 1 },
        { key: 'exec_10', title: 'Broker Marketing Materials / OM', requestText: 'Provide the Offering Memorandum, broker package, or marketing brochure.', priority: 3, requestType: 'document', defaultOwnerRole: 'broker' },
      ],
    },

    // ═══ 2. LEGAL / PSA / TITLE / SURVEY ═════════════════════════════════════
    {
      key: 'legal',
      title: 'Legal / PSA / Title / Survey',
      description: 'Legal documents, title review, and survey items',
      items: [
        { key: 'legal_01', title: 'Title Commitment / Preliminary Report', requestText: 'Order and provide the title commitment with all Schedule B exceptions.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 7, defaultOwnerRole: 'attorney', tags: ['title'] },
        { key: 'legal_02', title: 'Title Exception Documents', requestText: 'Provide copies of all recorded instruments listed as title exceptions (easements, CC&Rs, liens, etc.).', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 10, defaultOwnerRole: 'attorney' },
        { key: 'legal_03', title: 'ALTA Survey', requestText: 'Order and provide current ALTA/NSPS survey with Table A items per lender and title requirements.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 14, defaultOwnerRole: 'consultant', tags: ['survey'] },
        { key: 'legal_04', title: 'Existing Surveys', requestText: 'Provide any existing surveys, plat maps, or site plans.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'legal_05', title: 'Deed / Vesting Deed', requestText: 'Provide current vesting deed and any prior deeds in the chain of title (last 10 years).', priority: 1, requestType: 'document', defaultOwnerRole: 'attorney' },
        { key: 'legal_06', title: 'Zoning Letter / Confirmation', requestText: 'Obtain zoning confirmation letter from municipality confirming current use compliance.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_expiration', dueOffsetDays: -7, defaultOwnerRole: 'attorney', tags: ['zoning'] },
        { key: 'legal_07', title: 'Litigation / Pending Claims', requestText: 'Disclose any pending, threatened, or past litigation involving the property or seller entity.', priority: 1, requestType: 'answer', defaultOwnerRole: 'seller', tags: ['litigation'] },
        { key: 'legal_08', title: 'Entity Formation Documents', requestText: 'Provide articles of organization, operating agreement, and certificates of good standing for seller entity.', priority: 2, requestType: 'document', defaultOwnerRole: 'attorney' },
        { key: 'legal_09', title: 'Encumbrance / Lien Search', requestText: 'Run UCC, judgment, and tax lien searches against property and seller entity.', priority: 1, requestType: 'document', defaultOwnerRole: 'attorney', milestoneAnchor: 'dd_expiration', dueOffsetDays: -5 },
        { key: 'legal_10', title: 'Estoppel Certificates', requestText: 'Obtain tenant/lease estoppel certificates confirming lease terms, rent, deposits.', priority: 1, requestType: 'document', milestoneAnchor: 'closing', dueOffsetDays: -10, defaultOwnerRole: 'seller', tags: ['estoppel'] },
        { key: 'legal_11', title: 'SNDA Agreements', requestText: 'Prepare Subordination, Non-Disturbance, and Attornment agreements for major tenants.', priority: 2, requestType: 'document', defaultOwnerRole: 'attorney' },
        { key: 'legal_12', title: 'Covenant Compliance', requestText: 'Verify compliance with all CC&Rs, deed restrictions, and HOA requirements.', priority: 2, requestType: 'verification', defaultOwnerRole: 'attorney' },
      ],
    },

    // ═══ 3. FINANCIAL / ACCOUNTING / BANKING ═════════════════════════════════
    {
      key: 'financial',
      title: 'Financial / Accounting / Banking',
      description: 'P&L statements, bank records, and financial analysis',
      items: [
        { key: 'fin_01', title: 'Trailing 3-Year P&L Statements', requestText: 'Provide annual income and expense statements for the last 3 full calendar years.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 5, defaultOwnerRole: 'seller', tags: ['financial'] },
        { key: 'fin_02', title: 'Year-to-Date P&L', requestText: 'Provide current year-to-date income and expense statement through most recent month.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 5, defaultOwnerRole: 'seller' },
        { key: 'fin_03', title: 'Monthly Revenue Detail (12 months)', requestText: 'Provide monthly revenue breakdown by category/source for the trailing 12 months.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'fin_04', title: 'Chart of Accounts', requestText: 'Provide chart of accounts / general ledger code mapping.', priority: 2, requestType: 'document', defaultOwnerRole: 'accountant' },
        { key: 'fin_05', title: 'Bank Statements (12 months)', requestText: 'Provide 12 months of bank statements for all property-related accounts.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 7, defaultOwnerRole: 'seller', tags: ['bank'] },
        { key: 'fin_06', title: 'Accounts Receivable Aging', requestText: 'Provide current AR aging report showing outstanding tenant/customer balances.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'fin_07', title: 'Accounts Payable Summary', requestText: 'Provide current AP aging and list of outstanding vendor obligations.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'fin_08', title: 'Budget / Projections', requestText: 'Provide current year operating budget and any forward projections or business plan.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'fin_09', title: 'Capital Expenditure History', requestText: 'Provide 3-year history of capital improvements with costs, descriptions, and dates.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'fin_10', title: 'Debt / Mortgage Statements', requestText: 'Provide current mortgage statements, loan agreements, and payoff letters for existing debt.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'fin_11', title: 'Security Deposit Ledger', requestText: 'Provide schedule of all security deposits held, by tenant/unit.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'fin_12', title: 'Credit Card Processing Statements', requestText: 'Provide 12 months of merchant/credit card processing statements (if applicable).', priority: 3, requestType: 'document', defaultOwnerRole: 'seller' },
      ],
    },

    // ═══ 4. RENT ROLL / LEASES / TENANT ESTOPPELS ═══════════════════════════
    {
      key: 'rent_roll',
      title: 'Rent Roll / Leases / Tenant Estoppels',
      description: 'Lease agreements, rent schedules, and tenant verification',
      items: [
        { key: 'rr_01', title: 'Current Rent Roll', requestText: 'Provide current rent roll showing all tenants/units, lease dates, rents, deposits, and status.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 3, defaultOwnerRole: 'seller', tags: ['rent_roll'] },
        { key: 'rr_02', title: 'All Lease Agreements', requestText: 'Provide copies of all current lease agreements, amendments, extensions, and side letters.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 7, defaultOwnerRole: 'seller' },
        { key: 'rr_03', title: 'Lease Abstraction Schedule', requestText: 'Provide lease abstract summarizing key terms: base rent, escalations, options, CAM, TI, etc.', priority: 1, requestType: 'data', defaultOwnerRole: 'owner_admin' },
        { key: 'rr_04', title: 'Tenant Estoppel Certificates', requestText: 'Distribute and collect signed estoppel certificates from all tenants.', priority: 1, requestType: 'document', milestoneAnchor: 'closing', dueOffsetDays: -10, defaultOwnerRole: 'seller' },
        { key: 'rr_05', title: 'Delinquency / Collection Report', requestText: 'Provide historical delinquency report and any collections actions taken.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'rr_06', title: 'Lease Expiration Schedule', requestText: 'Provide schedule of upcoming lease expirations over next 3-5 years.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'rr_07', title: 'CAM / Reimbursement Reconciliation', requestText: 'Provide prior year CAM reconciliation statements and methodology.', priority: 2, requestType: 'document', defaultOwnerRole: 'accountant' },
        { key: 'rr_08', title: 'Tenant Correspondence', requestText: 'Provide any material tenant correspondence, complaints, or notices in the last 12 months.', priority: 3, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'rr_09', title: 'Vacancy / Occupancy History', requestText: 'Provide 3-year occupancy history by month (or by season if applicable).', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'rr_10', title: 'Tenant Credit / Background', requestText: 'Provide available tenant credit information, guarantees, or financial statements.', priority: 3, requestType: 'document', defaultOwnerRole: 'seller' },
      ],
    },

    // ═══ 5. TAX / ASSESSMENT ═════════════════════════════════════════════════
    {
      key: 'tax',
      title: 'Tax / Assessment',
      description: 'Property tax bills, assessments, and appeals',
      items: [
        { key: 'tax_01', title: 'Property Tax Bills (3 years)', requestText: 'Provide property tax bills for the last 3 years, including any supplemental assessments.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 7, defaultOwnerRole: 'seller', tags: ['tax'] },
        { key: 'tax_02', title: 'Tax Assessment Notice', requestText: 'Provide current tax assessment notice showing assessed and market value.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'tax_03', title: 'Tax Appeal History', requestText: 'Disclose any pending or recent property tax appeals and outcomes.', priority: 2, requestType: 'answer', defaultOwnerRole: 'seller' },
        { key: 'tax_04', title: 'Special Assessments / Impact Fees', requestText: 'Identify any special assessment districts, improvement bonds, or impact fees.', priority: 2, requestType: 'answer', defaultOwnerRole: 'seller' },
        { key: 'tax_05', title: 'Tax Abatement / Exemptions', requestText: 'Identify any tax abatements, PILOT programs, enterprise zone credits, or exemptions.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'tax_06', title: 'Post-Acquisition Tax Estimate', requestText: 'Estimate post-acquisition property tax based on purchase price reassessment.', priority: 1, requestType: 'data', milestoneAnchor: 'dd_expiration', dueOffsetDays: -5, defaultOwnerRole: 'accountant' },
        { key: 'tax_07', title: 'Sales Tax Returns (if applicable)', requestText: 'Provide 12 months of sales/use tax returns if business generates taxable sales.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'tax_08', title: 'Income Tax Returns (entity)', requestText: 'Provide entity-level tax returns for the property (last 2 years) if available.', priority: 3, requestType: 'document', defaultOwnerRole: 'seller' },
      ],
    },

    // ═══ 6. PHYSICAL / ENGINEERING / PCA ═════════════════════════════════════
    {
      key: 'physical',
      title: 'Physical / Engineering / PCA',
      description: 'Property condition, inspections, and engineering reports',
      items: [
        { key: 'phys_01', title: 'Property Condition Assessment (PCA)', requestText: 'Order and provide PCA / Property Condition Report from qualified engineering firm.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 14, defaultOwnerRole: 'consultant', tags: ['pca'] },
        { key: 'phys_02', title: 'Roof Inspection Report', requestText: 'Provide roof inspection report including age, condition, warranty status, and estimated remaining life.', priority: 1, requestType: 'document', defaultOwnerRole: 'consultant' },
        { key: 'phys_03', title: 'MEP Systems Inventory', requestText: 'Provide inventory of mechanical, electrical, plumbing systems with ages and condition.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'phys_04', title: 'Building Plans / As-Builts', requestText: 'Provide architectural plans, as-built drawings, or construction documents.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'phys_05', title: 'Certificate of Occupancy', requestText: 'Provide Certificate of Occupancy or TCO for all structures.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'phys_06', title: 'ADA Compliance Assessment', requestText: 'Assess ADA compliance status and identify any remediation requirements.', priority: 2, requestType: 'verification', defaultOwnerRole: 'consultant' },
        { key: 'phys_07', title: 'Fire / Life Safety Inspection', requestText: 'Provide most recent fire marshal inspection report and fire suppression system certification.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'phys_08', title: 'Capital Improvement Plan', requestText: 'Prepare CapEx plan estimating required and deferred maintenance costs over 5-10 years.', priority: 1, requestType: 'data', milestoneAnchor: 'dd_expiration', dueOffsetDays: -5, defaultOwnerRole: 'owner_admin' },
        { key: 'phys_09', title: 'Structural Assessment', requestText: 'If PCA identifies structural concerns, order structural engineering assessment.', priority: 1, requestType: 'document', defaultOwnerRole: 'consultant' },
        { key: 'phys_10', title: 'Site Visit / Physical Inspection', requestText: 'Schedule and conduct on-site walk-through with buyer team and inspectors.', priority: 1, requestType: 'site_access', milestoneAnchor: 'dd_start', dueOffsetDays: 7, defaultOwnerRole: 'owner_admin' },
        { key: 'phys_11', title: 'Elevator Inspection', requestText: 'Provide most recent elevator inspection certificate and maintenance records (if applicable).', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
      ],
    },

    // ═══ 7. ENVIRONMENTAL ════════════════════════════════════════════════════
    {
      key: 'environmental',
      title: 'Environmental',
      description: 'Phase I/II, contamination, wetlands, and environmental compliance',
      items: [
        { key: 'env_01', title: 'Phase I Environmental Site Assessment', requestText: 'Order and provide Phase I ESA from qualified environmental firm per ASTM E1527-21.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 14, defaultOwnerRole: 'consultant', tags: ['environmental', 'phase1'] },
        { key: 'env_02', title: 'Phase II ESA (if recommended)', requestText: 'If Phase I recommends further investigation, order Phase II with soil/groundwater sampling.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_expiration', dueOffsetDays: -7, defaultOwnerRole: 'consultant' },
        { key: 'env_03', title: 'Prior Environmental Reports', requestText: 'Provide all prior Phase I, Phase II, remediation, or monitoring reports for the property.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'env_04', title: 'Asbestos / Lead Paint Survey', requestText: 'Provide asbestos and lead-based paint survey reports (required for pre-1978 buildings).', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'env_05', title: 'Underground Storage Tanks (USTs)', requestText: 'Disclose any current or former underground storage tanks, removal records, and closure reports.', priority: 1, requestType: 'answer', defaultOwnerRole: 'seller' },
        { key: 'env_06', title: 'Wetlands / Floodplain Determination', requestText: 'Obtain FEMA flood zone determination and any wetlands delineation reports.', priority: 2, requestType: 'document', defaultOwnerRole: 'consultant' },
        { key: 'env_07', title: 'Stormwater / NPDES Permits', requestText: 'Provide stormwater management plan and any NPDES permit documentation.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'env_08', title: 'Environmental Compliance History', requestText: 'Disclose any environmental violations, consent orders, or regulatory actions.', priority: 2, requestType: 'answer', defaultOwnerRole: 'seller' },
        { key: 'env_09', title: 'Mold / Indoor Air Quality', requestText: 'Provide any mold testing or indoor air quality reports.', priority: 3, requestType: 'document', defaultOwnerRole: 'seller' },
      ],
    },

    // ═══ 8. INSURANCE ════════════════════════════════════════════════════════
    {
      key: 'insurance',
      title: 'Insurance',
      description: 'Coverage verification, loss history, and claims',
      items: [
        { key: 'ins_01', title: 'Current Insurance Policies', requestText: 'Provide copies of all current insurance policies (property, liability, umbrella, flood, etc.).', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 7, defaultOwnerRole: 'seller', tags: ['insurance'] },
        { key: 'ins_02', title: '5-Year Loss Run Report', requestText: 'Provide 5-year loss run / claims history from insurance carrier.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 10, defaultOwnerRole: 'seller' },
        { key: 'ins_03', title: 'Insurance Quotes (Post-Acquisition)', requestText: 'Obtain property insurance quotes for post-acquisition coverage.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_expiration', dueOffsetDays: -7, defaultOwnerRole: 'owner_admin' },
        { key: 'ins_04', title: 'Flood Insurance (if applicable)', requestText: 'Determine flood insurance requirements and obtain quotes if in flood zone.', priority: 1, requestType: 'document', defaultOwnerRole: 'owner_admin' },
        { key: 'ins_05', title: 'Workers Compensation Policy', requestText: 'Provide current workers compensation policy and experience modification rate.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'ins_06', title: 'Environmental / Pollution Liability', requestText: 'Assess need for environmental liability insurance; obtain quotes if warranted.', priority: 2, requestType: 'document', defaultOwnerRole: 'owner_admin' },
        { key: 'ins_07', title: 'Pending Insurance Claims', requestText: 'Disclose any open or pending insurance claims related to the property.', priority: 1, requestType: 'answer', defaultOwnerRole: 'seller' },
      ],
    },

    // ═══ 9. UTILITIES / SERVICES / VENDOR CONTRACTS ═════════════════════════
    {
      key: 'utilities',
      title: 'Utilities / Services / Vendor Contracts',
      description: 'Utility accounts, service agreements, and vendor relationships',
      items: [
        { key: 'util_01', title: 'Utility Account Summary', requestText: 'Provide list of all utility accounts: provider, account number, average monthly cost.', priority: 1, requestType: 'data', milestoneAnchor: 'dd_start', dueOffsetDays: 7, defaultOwnerRole: 'seller', tags: ['utilities'] },
        { key: 'util_02', title: 'Utility Bills (12 months)', requestText: 'Provide 12 months of utility bills: electric, water/sewer, gas, trash, internet, phone.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'util_03', title: 'Service Agreements / Vendor Contracts', requestText: 'Provide all service contracts: landscaping, pest control, security, cleaning, elevator, HVAC, etc.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 10, defaultOwnerRole: 'seller', tags: ['vendor'] },
        { key: 'util_04', title: 'Contract Assignment / Termination Review', requestText: 'Review all contracts for assignability, auto-renewal, and termination notice requirements.', priority: 1, requestType: 'verification', defaultOwnerRole: 'attorney' },
        { key: 'util_05', title: 'Property Management Agreement', requestText: 'Provide current property management agreement; review termination provisions.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'util_06', title: 'Telecommunications / Cable Agreements', requestText: 'Provide any bulk cable, internet, or telecom agreements affecting the property.', priority: 3, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'util_07', title: 'Waste / Recycling Contracts', requestText: 'Provide waste removal and recycling service contracts.', priority: 3, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'util_08', title: 'Solar / Energy Agreements', requestText: 'Provide any solar panel lease, PPA, or energy supply agreements.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
      ],
    },

    // ═══ 10. COMPLIANCE / PERMITS / LICENSES ════════════════════════════════
    {
      key: 'compliance',
      title: 'Compliance / Permits / Licenses',
      description: 'Regulatory compliance, permits, and operational licenses',
      items: [
        { key: 'comp_01', title: 'Business License / Occupational Licenses', requestText: 'Provide all current business licenses, occupational licenses, and operating permits.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 7, defaultOwnerRole: 'seller', tags: ['permits'] },
        { key: 'comp_02', title: 'Building Permits (Recent)', requestText: 'Provide all building permits issued in the last 5 years with final inspections.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'comp_03', title: 'Code Violation History', requestText: 'Disclose any code violations, notices of violation, or enforcement actions.', priority: 1, requestType: 'answer', defaultOwnerRole: 'seller' },
        { key: 'comp_04', title: 'Health Department Inspections', requestText: 'Provide health department inspection reports (if food service or public use).', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'comp_05', title: 'Liquor License (if applicable)', requestText: 'Provide liquor license details, transferability analysis, and any violations.', priority: 1, requestType: 'document', defaultOwnerRole: 'attorney' },
        { key: 'comp_06', title: 'Permit Transferability Analysis', requestText: 'Analyze which permits/licenses transfer automatically vs. require reapplication.', priority: 1, requestType: 'verification', defaultOwnerRole: 'attorney' },
        { key: 'comp_07', title: 'Conditional Use Permits / Variances', requestText: 'Provide any conditional use permits, variances, or special exceptions affecting the property.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'comp_08', title: 'OSHA Compliance Records', requestText: 'Provide OSHA inspection history and any citations (if operating business).', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
      ],
    },

    // ═══ 11. IT / SYSTEMS / ACCESS ══════════════════════════════════════════
    {
      key: 'it_systems',
      title: 'IT / Systems / Access',
      description: 'Technology infrastructure, software, and access credentials',
      items: [
        { key: 'it_01', title: 'Technology Systems Inventory', requestText: 'List all software systems: property management, POS, accounting, reservation, security, HVAC controls.', priority: 1, requestType: 'data', milestoneAnchor: 'dd_start', dueOffsetDays: 10, defaultOwnerRole: 'seller', tags: ['it'] },
        { key: 'it_02', title: 'Software License Agreements', requestText: 'Provide all software license and SaaS subscription agreements with terms and costs.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'it_03', title: 'Internet / Network Infrastructure', requestText: 'Document network topology, ISP contracts, Wi-Fi systems, and capacity.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'it_04', title: 'Security Systems', requestText: 'Document security cameras, access control, alarm systems, and monitoring contracts.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'it_05', title: 'Website / Domain Ownership', requestText: 'Confirm domain registration, hosting, and whether website transfers with sale.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'it_06', title: 'Data Migration Plan', requestText: 'Plan for transferring historical data from seller systems to buyer systems.', priority: 2, requestType: 'data', milestoneAnchor: 'closing', dueOffsetDays: -14, defaultOwnerRole: 'owner_admin' },
      ],
    },

    // ═══ 12. HR / PAYROLL / BENEFITS ════════════════════════════════════════
    {
      key: 'hr_payroll',
      title: 'HR / Payroll / Benefits',
      description: 'Employee information, payroll, and benefits for operating businesses',
      items: [
        { key: 'hr_01', title: 'Employee Roster', requestText: 'Provide list of all employees: name, title, department, hire date, FT/PT, salary/hourly rate.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 7, defaultOwnerRole: 'seller', tags: ['hr', 'payroll'] },
        { key: 'hr_02', title: 'Payroll Records (12 months)', requestText: 'Provide 12 months of payroll reports showing gross wages, taxes, benefits, and net pay.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'hr_03', title: 'Benefits Summary', requestText: 'Provide summary of employee benefits: health insurance, 401k, PTO, bonuses.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'hr_04', title: 'Employment Agreements / Contracts', requestText: 'Provide any employment contracts, non-compete agreements, or key-person agreements.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'hr_05', title: 'Workers Comp Claims History', requestText: 'Provide workers compensation claims history for the last 3 years.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'hr_06', title: 'Employee Handbook / Policies', requestText: 'Provide current employee handbook and HR policies.', priority: 3, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'hr_07', title: 'Transition / Retention Plan', requestText: 'Develop plan for employee transition, retention bonuses, and communication.', priority: 1, requestType: 'data', milestoneAnchor: 'closing', dueOffsetDays: -14, defaultOwnerRole: 'owner_admin' },
        { key: 'hr_08', title: 'Org Chart & Staffing Analysis', requestText: 'Review current staffing levels against market benchmarks and operational needs.', priority: 2, requestType: 'data', defaultOwnerRole: 'owner_admin' },
      ],
    },

    // ═══ 13. LENDER / FINANCING ═════════════════════════════════════════════
    {
      key: 'lender',
      title: 'Lender / Financing',
      description: 'Loan requirements, lender deliverables, and financing coordination',
      items: [
        { key: 'lend_01', title: 'Loan Application / Commitment Letter', requestText: 'Submit loan application and obtain commitment letter from lender.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 14, defaultOwnerRole: 'owner_admin', tags: ['lender'] },
        { key: 'lend_02', title: 'Appraisal', requestText: 'Order lender-required appraisal from approved appraiser.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 21, defaultOwnerRole: 'lender' },
        { key: 'lend_03', title: 'Lender DD Checklist', requestText: 'Obtain and complete lender-specific due diligence requirements.', priority: 1, requestType: 'data', defaultOwnerRole: 'lender' },
        { key: 'lend_04', title: 'Environmental Insurance (lender required)', requestText: 'Obtain environmental insurance if required by lender based on Phase I findings.', priority: 2, requestType: 'document', defaultOwnerRole: 'owner_admin' },
        { key: 'lend_05', title: 'Borrower Entity Formation', requestText: 'Form borrowing entity (SPE/LLC) per lender requirements.', priority: 1, requestType: 'document', milestoneAnchor: 'closing', dueOffsetDays: -21, defaultOwnerRole: 'attorney' },
        { key: 'lend_06', title: 'Personal Guaranty / Financial Statements', requestText: 'Provide guarantor personal financial statements and tax returns.', priority: 1, requestType: 'document', defaultOwnerRole: 'owner_admin' },
        { key: 'lend_07', title: 'Insurance Evidence for Lender', requestText: 'Provide evidence of insurance meeting lender requirements before closing.', priority: 1, requestType: 'document', milestoneAnchor: 'closing', dueOffsetDays: -7, defaultOwnerRole: 'owner_admin' },
        { key: 'lend_08', title: 'Rate Lock Confirmation', requestText: 'Confirm interest rate lock and terms with lender.', priority: 1, requestType: 'data', milestoneAnchor: 'closing', dueOffsetDays: -14, defaultOwnerRole: 'owner_admin' },
      ],
    },

    // ═══ 14. CLOSING DELIVERABLES ═══════════════════════════════════════════
    {
      key: 'closing',
      title: 'Closing Deliverables',
      description: 'Pre-closing and closing day requirements',
      items: [
        { key: 'close_01', title: 'Closing Statement / Settlement Statement', requestText: 'Review and approve closing/settlement statement with all prorations and adjustments.', priority: 1, requestType: 'document', milestoneAnchor: 'closing', dueOffsetDays: -3, defaultOwnerRole: 'attorney', tags: ['closing'] },
        { key: 'close_02', title: 'Deed Preparation', requestText: 'Prepare and review warranty/special warranty deed for recording.', priority: 1, requestType: 'document', milestoneAnchor: 'closing', dueOffsetDays: -5, defaultOwnerRole: 'attorney' },
        { key: 'close_03', title: 'Assignment of Leases', requestText: 'Prepare assignment and assumption of leases document.', priority: 1, requestType: 'document', milestoneAnchor: 'closing', dueOffsetDays: -5, defaultOwnerRole: 'attorney' },
        { key: 'close_04', title: 'Assignment of Contracts', requestText: 'Prepare assignment of service contracts, vendor agreements, and other transferable contracts.', priority: 1, requestType: 'document', milestoneAnchor: 'closing', dueOffsetDays: -5, defaultOwnerRole: 'attorney' },
        { key: 'close_05', title: 'Bill of Sale (Personal Property)', requestText: 'Prepare bill of sale for any personal property included in the transaction.', priority: 1, requestType: 'document', milestoneAnchor: 'closing', dueOffsetDays: -3, defaultOwnerRole: 'attorney' },
        { key: 'close_06', title: 'Tenant Notification Letters', requestText: 'Prepare tenant notification letters advising of ownership change and new payment instructions.', priority: 1, requestType: 'document', milestoneAnchor: 'closing', dueOffsetDays: -3, defaultOwnerRole: 'attorney' },
        { key: 'close_07', title: 'Title Insurance Policy', requestText: 'Confirm title insurance policy issuance at closing.', priority: 1, requestType: 'document', milestoneAnchor: 'closing', dueOffsetDays: 0, defaultOwnerRole: 'attorney' },
        { key: 'close_08', title: 'Keys / Access Credentials Transfer', requestText: 'Arrange transfer of all keys, codes, access cards, and system credentials.', priority: 1, requestType: 'other', milestoneAnchor: 'closing', dueOffsetDays: 0, defaultOwnerRole: 'seller' },
        { key: 'close_09', title: 'Pre-Closing Walk-Through', requestText: 'Conduct final pre-closing property inspection/walk-through.', priority: 1, requestType: 'site_access', milestoneAnchor: 'closing', dueOffsetDays: -1, defaultOwnerRole: 'owner_admin' },
        { key: 'close_10', title: 'Wire Transfer Instructions', requestText: 'Confirm wire transfer instructions for closing funds with escrow/title company.', priority: 1, requestType: 'data', milestoneAnchor: 'closing', dueOffsetDays: -2, defaultOwnerRole: 'owner_admin' },
        { key: 'close_11', title: 'FIRPTA / Withholding Certificate', requestText: 'Obtain seller FIRPTA affidavit or IRS withholding certificate if applicable.', priority: 1, requestType: 'document', milestoneAnchor: 'closing', dueOffsetDays: -3, defaultOwnerRole: 'attorney' },
      ],
    },
  ],
};
