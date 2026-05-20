import { ChecklistTemplate } from './types';

/**
 * Multifamily DD Request List Add-On
 * Covers: rent roll vs. lease reconciliation, T-12 OpEx variance, loss-to-lease,
 * lease audit and rollover, RUBS recovery, submarket supply pipeline,
 * rent-control status, Phase I ESA, and comparable sales.
 */
export const MULTIFAMILY_ADDON_TEMPLATE: ChecklistTemplate = {
  name: 'Multifamily DD Add-On',
  version: '1.0.0',
  assetClass: 'multifamily',
  sections: [
    // ═══ MF FINANCIAL / REVENUE ═════════════════════════════════════════════
    {
      key: 'mf_financial',
      title: 'MF Financial & Revenue Audit',
      description: 'Rent roll reconciliation, T-12 variance, loss-to-lease, concessions, and other income',
      items: [
        { key: 'mf_fin_01', title: 'Rent Roll vs. Lease File Reconciliation', requestText: 'Provide a current certified rent roll and reconcile it line-by-line against the executed lease files: in-place rent, lease start/end dates, deposits, concessions, and unit status. Identify and explain all discrepancies.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 5, defaultOwnerRole: 'seller', tags: ['multifamily', 'financial'] },
        { key: 'mf_fin_02', title: 'T-12 Operating Statement Variance Analysis', requestText: 'Provide trailing-12-month operating statements with monthly detail and a variance analysis against the prior year and the seller pro forma; explain any month-over-month anomalies.', priority: 1, requestType: 'document', defaultOwnerRole: 'accountant' },
        { key: 'mf_fin_03', title: 'Loss-to-Lease Analysis', requestText: 'Provide a loss-to-lease analysis comparing in-place rents to current market/asking rents by unit type, with the aggregate gain-to-lease / loss-to-lease dollar figure.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'mf_fin_04', title: 'Concession & Free-Rent Audit', requestText: 'Provide a schedule of all concessions, free-rent periods, and move-in incentives granted over the trailing 12 months, with net effective rent by unit.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'mf_fin_05', title: 'Bad Debt & Delinquency History', requestText: 'Provide a 3-year history of bad debt write-offs, the current aged-delinquency report, and a list of tenants on payment plans or in collections.', priority: 1, requestType: 'document', defaultOwnerRole: 'accountant' },
        { key: 'mf_fin_06', title: 'Other Income Verification', requestText: 'Itemize all other income (parking, laundry, pet rent, storage, application/admin fees, late fees, vending) for the trailing 3 years and document the basis and contractual support for each stream.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'mf_fin_07', title: 'RUBS / Utility Reimbursement Income', requestText: 'Document the utility reimbursement methodology (RUBS, submetered, flat fee), the recovery ratio versus actual utility expense, and any local restrictions on billing-back.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'mf_fin_08', title: 'Security Deposit Liability Reconciliation', requestText: 'Reconcile the security deposit ledger to the rent roll and to the deposit trust/bank account; confirm the deposit liability to be credited to the buyer at closing.', priority: 1, requestType: 'document', milestoneAnchor: 'closing', dueOffsetDays: -10, defaultOwnerRole: 'seller', tags: ['financial'] },
        { key: 'mf_fin_09', title: 'Trailing & Forward Rent Trends', requestText: 'Provide a 24-month trended rent roll (lease trade-out report) showing new-lease and renewal rent changes by unit type.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'mf_fin_10', title: 'Prepaid Rent & Tenant Receivables', requestText: 'Provide a schedule of prepaid rent, tenant receivables, and any tenant credits as of the most recent month-end.', priority: 2, requestType: 'data', defaultOwnerRole: 'accountant' },
      ],
    },

    // ═══ LEASE & TENANCY ════════════════════════════════════════════════════
    {
      key: 'mf_lease',
      title: 'Lease & Tenancy Review',
      description: 'Lease audit, expiration/rollover schedule, renewals, estoppels, and voucher concentration',
      items: [
        { key: 'mf_lease_01', title: 'Executed Lease Audit', requestText: 'Provide executed leases for a representative sample (or all) units and audit them against the rent roll for rent, term, deposits, signatures, and addenda.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 7, defaultOwnerRole: 'seller', tags: ['multifamily', 'lease'] },
        { key: 'mf_lease_02', title: 'Lease Expiration Schedule & Rollover Risk', requestText: 'Provide a lease expiration schedule showing the count and percentage of units expiring by month for the next 12-18 months; flag months with rollover concentration.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'mf_lease_03', title: 'Renewal & Retention Rate History', requestText: 'Provide a 3-year history of lease renewal rate, resident retention rate, and average length of stay by unit type.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'mf_lease_04', title: 'Tenant Estoppel Certificates', requestText: 'Obtain signed tenant estoppel certificates confirming rent, deposit, lease term, and the absence of landlord defaults or side agreements.', priority: 1, requestType: 'verification', milestoneAnchor: 'closing', dueOffsetDays: -7, defaultOwnerRole: 'attorney', tags: ['lease'] },
        { key: 'mf_lease_05', title: 'Section 8 / Housing Voucher Concentration', requestText: 'Identify all units occupied under Section 8 / Housing Choice Vouchers or other subsidy programs, the HAP contract terms, and the concentration as a percentage of total units.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'mf_lease_06', title: 'Eviction & Lease-Violation History', requestText: 'Provide a 3-year history of evictions filed and completed, lease-violation notices, and any units with pending unlawful-detainer actions.', priority: 2, requestType: 'document', defaultOwnerRole: 'attorney' },
        { key: 'mf_lease_07', title: 'Standard Lease Form & Addenda', requestText: 'Provide the standard lease form and all addenda (pet, parking, amenity, crime-free, mold) currently in use, and any prior forms still in effect on in-place leases.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'mf_lease_08', title: 'Corporate / Short-Term / Non-Standard Tenancies', requestText: 'Identify any corporate leases, short-term/furnished tenancies, employee/model units, or month-to-month tenancies and their rent and term basis.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'mf_lease_09', title: 'Tenant Screening & Credit Criteria', requestText: 'Provide the current resident screening criteria (income, credit, criminal, rental history) and confirm consistent application across the in-place tenancy.', priority: 3, requestType: 'document', defaultOwnerRole: 'seller' },
      ],
    },

    // ═══ OPERATING EXPENSES ═════════════════════════════════════════════════
    {
      key: 'mf_opex',
      title: 'Operating Expense Review',
      description: 'Property tax, insurance, utilities/RUBS recovery, payroll, management, and vendor contracts',
      items: [
        { key: 'mf_opex_01', title: 'Property Tax Assessment & Appeal Status', requestText: 'Provide current and 3-year historical property tax bills, the assessed value, the status of any pending appeals, and an estimate of post-sale reassessment exposure.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 7, defaultOwnerRole: 'accountant', tags: ['multifamily', 'operations'] },
        { key: 'mf_opex_02', title: 'Insurance Coverage Review', requestText: 'Provide all property, liability, and umbrella insurance policies with declarations pages, the 5-year loss run, and confirmation of replacement-cost and flood/wind coverage.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller', tags: ['insurance'] },
        { key: 'mf_opex_03', title: 'Utility Expense & RUBS Recovery Ratio', requestText: 'Provide 3-year utility expense detail by type (water/sewer, electric, gas, trash) and reconcile against utility reimbursement income to confirm the net recovery ratio.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'mf_opex_04', title: 'Repairs & Maintenance History', requestText: 'Provide a 3-year repairs-and-maintenance expense history with detail on recurring versus one-time items and the make-ready/turn cost component.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'mf_opex_05', title: 'Unit Turnover Cost Analysis', requestText: 'Provide the average per-unit turnover cost, turn time (days vacant), and the count of units turned over the trailing 12 months.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'mf_opex_06', title: 'Payroll & On-Site Staffing Review', requestText: 'Provide the on-site staffing roster, payroll detail, benefits, bonus/commission structure, and identify any employees expected to transfer at closing.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'mf_opex_07', title: 'Property Management Agreement', requestText: 'Provide the current property management agreement, the management fee, termination terms, and confirm whether management is third-party or owner-affiliated.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller', tags: ['operations'] },
        { key: 'mf_opex_08', title: 'Service & Vendor Contract Audit', requestText: 'Provide all service contracts (landscaping, pest control, trash, pool, elevator, snow removal, security) with terms, pricing, assignability, and termination provisions.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'mf_opex_09', title: 'Operating & Capital Budget / Replacement Reserve', requestText: 'Provide the current-year operating and capital budget, the replacement reserve funding level, and the basis for per-unit reserve assumptions.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'mf_opex_10', title: 'Utility Account Transfer & Deposits', requestText: 'Identify all utility accounts requiring transfer at closing, outstanding utility deposits, and any municipal utility lien exposure.', priority: 3, requestType: 'data', defaultOwnerRole: 'seller' },
      ],
    },

    // ═══ PHYSICAL CONDITION & CAPITAL NEEDS ═════════════════════════════════
    {
      key: 'mf_physical',
      title: 'Physical Condition & Capital Needs',
      description: 'Unit condition, deferred maintenance, capex history, building systems, PCA, and Phase I ESA',
      items: [
        { key: 'mf_phys_01', title: 'Unit-by-Unit Interior Condition Assessment', requestText: 'Schedule and conduct an interior inspection of all (or a representative sample of) units, documenting finish level, appliance age, flooring, and renovation status (classic vs. upgraded).', priority: 1, requestType: 'site_access', milestoneAnchor: 'dd_start', dueOffsetDays: 14, defaultOwnerRole: 'consultant', tags: ['multifamily', 'physical'] },
        { key: 'mf_phys_02', title: 'Deferred Maintenance Backlog', requestText: 'Disclose all known deferred maintenance items with estimated cost to cure, including items affecting habitability or code compliance.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'mf_phys_03', title: 'Capital Expenditure History (5 years)', requestText: 'Provide a 5-year capital expenditure history identifying roof, HVAC, parking lot, building envelope, and unit-renovation spend, with items capitalized versus expensed.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'mf_phys_04', title: 'Roof / HVAC / Plumbing Age & Condition', requestText: 'Provide the age, type, and condition of roofs, HVAC systems, water heaters, and plumbing supply lines (note polybutylene/galvanized exposure) for each building.', priority: 1, requestType: 'data', defaultOwnerRole: 'consultant' },
        { key: 'mf_phys_05', title: 'Property Condition Assessment (PCA)', requestText: 'Commission a third-party Property Condition Assessment with an immediate-needs schedule and a 12-year capital reserve table.', priority: 1, requestType: 'document', defaultOwnerRole: 'consultant' },
        { key: 'mf_phys_06', title: 'Phase I Environmental Site Assessment', requestText: 'Commission a Phase I ESA; address any recognized environmental conditions and the need for asbestos, lead-based paint, mold, or radon screening given the building vintage.', priority: 1, requestType: 'document', defaultOwnerRole: 'consultant', tags: ['environmental'] },
        { key: 'mf_phys_07', title: 'ADA & Fair Housing Accessibility Compliance', requestText: 'Assess compliance with Fair Housing Act design/construction requirements and ADA for the leasing office and common areas; identify any accessibility remediation exposure.', priority: 2, requestType: 'verification', defaultOwnerRole: 'attorney' },
        { key: 'mf_phys_08', title: 'Submetering & Utility Infrastructure', requestText: 'Document the water/electric/gas metering configuration (master-metered vs. submetered), submeter ownership and age, and any submetering retrofit opportunity.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'mf_phys_09', title: 'Amenity & Common-Area Inventory', requestText: 'Provide an inventory and condition assessment of community amenities (pool, fitness center, clubhouse, laundry, dog park) and identify any amenities out of service.', priority: 3, requestType: 'data', defaultOwnerRole: 'seller' },
      ],
    },

    // ═══ SUBMARKET & COMPARABLES ════════════════════════════════════════════
    {
      key: 'mf_market',
      title: 'Submarket & Comparables',
      description: 'Vacancy and new-supply pipeline, rent and sale comps, demographics, and demand drivers',
      items: [
        { key: 'mf_mkt_01', title: 'Submarket Vacancy & Absorption Trends', requestText: 'Provide submarket vacancy, absorption, and rent-growth trends for the trailing 3-5 years (CoStar, Yardi Matrix, or equivalent).', priority: 1, requestType: 'data', milestoneAnchor: 'dd_start', dueOffsetDays: 10, defaultOwnerRole: 'broker', tags: ['multifamily', 'market'] },
        { key: 'mf_mkt_02', title: 'New-Supply Pipeline Analysis', requestText: 'Provide a survey of multifamily projects under construction, permitted, or planned within the competitive submarket and the projected delivery timeline.', priority: 1, requestType: 'data', defaultOwnerRole: 'broker' },
        { key: 'mf_mkt_03', title: 'Rent Comparables Survey', requestText: 'Provide a rent comparables survey of 5-10 competing properties with rents by unit type, concessions, amenities, and effective rent per square foot.', priority: 1, requestType: 'document', defaultOwnerRole: 'broker' },
        { key: 'mf_mkt_04', title: 'Demographic & Employment Trends', requestText: 'Provide demographic and employment data for the submarket: population and household growth, median income, major employers, and job-growth forecasts.', priority: 2, requestType: 'data', defaultOwnerRole: 'broker' },
        { key: 'mf_mkt_05', title: 'Comparable Sales Analysis', requestText: 'Provide 5-10 comparable multifamily sales with price per unit, price per square foot, cap rate, and the date and condition basis of each.', priority: 2, requestType: 'data', defaultOwnerRole: 'broker' },
        { key: 'mf_mkt_06', title: 'Submarket Demand Drivers & Concentration', requestText: 'Document submarket demand drivers (employment base, university, transit) and any single-employer or single-industry concentration risk.', priority: 2, requestType: 'data', defaultOwnerRole: 'broker' },
        { key: 'mf_mkt_07', title: 'Affordability & Rent-to-Income Analysis', requestText: 'Provide a rent-to-income analysis for the in-place tenancy and the submarket to assess headroom for rent growth and exposure to affordability pressure.', priority: 3, requestType: 'data', defaultOwnerRole: 'broker' },
      ],
    },

    // ═══ LEGAL, REGULATORY & TITLE ══════════════════════════════════════════
    {
      key: 'mf_legal',
      title: 'Legal, Regulatory & Title',
      description: 'Title and survey, zoning, rent-control status, fair housing, litigation, and regulatory agreements',
      items: [
        { key: 'mf_legal_01', title: 'Title Commitment & Survey Review', requestText: 'Provide a current title commitment and ALTA survey; review all exceptions, easements, and encroachments affecting the property.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 10, defaultOwnerRole: 'attorney', tags: ['multifamily', 'legal'] },
        { key: 'mf_legal_02', title: 'Zoning Compliance & Certificate of Occupancy', requestText: 'Confirm the property is a conforming use under current zoning, provide certificates of occupancy for all buildings, and identify any legal-nonconforming or rebuild-restriction exposure.', priority: 1, requestType: 'verification', defaultOwnerRole: 'attorney' },
        { key: 'mf_legal_03', title: 'Rent Control / Rent Stabilization Status', requestText: 'Confirm whether the property is subject to rent control, rent stabilization, or any local rent cap; document allowable annual increases and registration requirements.', priority: 1, requestType: 'verification', defaultOwnerRole: 'attorney' },
        { key: 'mf_legal_04', title: 'Fair Housing Compliance Review', requestText: 'Review marketing, screening, and leasing practices for Fair Housing Act and source-of-income compliance; disclose any fair-housing complaints or HUD/state actions.', priority: 2, requestType: 'verification', defaultOwnerRole: 'attorney' },
        { key: 'mf_legal_05', title: 'Pending Litigation & Claims', requestText: 'Disclose all pending or threatened litigation, tenant claims, habitability/mold claims, and insurance claims involving the property or the ownership entity.', priority: 1, requestType: 'document', defaultOwnerRole: 'attorney' },
        { key: 'mf_legal_06', title: 'HOA / Condominium Documents', requestText: 'If the property is a condominium or subject to an association, provide the declaration, bylaws, budget, reserve study, and any special assessments.', priority: 2, requestType: 'document', defaultOwnerRole: 'attorney' },
        { key: 'mf_legal_07', title: 'Affordable Housing / LIHTC Regulatory Agreements', requestText: 'Disclose any LIHTC, Section 8 HAP, bond, or land-use restriction agreements; provide the regulatory agreement, the compliance period end date, and the current compliance status.', priority: 1, requestType: 'document', defaultOwnerRole: 'attorney' },
        { key: 'mf_legal_08', title: 'Code Violations & Municipal Liens', requestText: 'Provide a search of open building/fire/health code violations, municipal liens, and any outstanding compliance orders.', priority: 2, requestType: 'document', defaultOwnerRole: 'attorney' },
        { key: 'mf_legal_09', title: 'Permits & Licenses', requestText: 'Provide all operating permits and licenses (rental registration, business license, pool, boiler, fire) and confirm transferability or renewal requirements.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
      ],
    },
  ],
};
