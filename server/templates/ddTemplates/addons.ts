import { ChecklistTemplate } from './types';

export const OFFICE_ADDON_TEMPLATE: ChecklistTemplate = {
  name: 'Office Add-On', version: '1.0.0', assetClass: 'office',
  sections: [
    { key: 'office_ops', title: 'Office Operations', items: [
      { key: 'off_01', title: 'Tenant Improvement Allowances', requestText: 'Provide TI allowance schedule by tenant and remaining obligations.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
      { key: 'off_02', title: 'Parking Agreements', requestText: 'Provide parking agreements, ratios, reserved spaces, and revenue.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
      { key: 'off_03', title: 'Common Area Factor / Load Factor', requestText: 'Provide rentable vs. usable SF calculations and common area factors.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
      { key: 'off_04', title: 'Base Year / Expense Stop Analysis', requestText: 'Analyze base year expense stops and operating expense escalations by tenant.', priority: 1, requestType: 'data', defaultOwnerRole: 'accountant' },
      { key: 'off_05', title: 'BOMA Measurement Certification', requestText: 'Provide BOMA measurement certification or floor plans with SF calculations.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
      { key: 'off_06', title: 'Tenant Relocation Risk', requestText: 'Assess lease expiration risk and tenant relocation probability for major tenants.', priority: 1, requestType: 'data', defaultOwnerRole: 'owner_admin' },
      { key: 'off_07', title: 'Signage Rights & Agreements', requestText: 'Provide building signage agreements and tenant signage specifications.', priority: 3, requestType: 'document', defaultOwnerRole: 'seller' },
      { key: 'off_08', title: 'Conference / Amenity Space', requestText: 'Document shared amenity spaces: conference rooms, gym, rooftop, and usage policies.', priority: 3, requestType: 'data', defaultOwnerRole: 'seller' },
      { key: 'off_09', title: 'Building Automation System', requestText: 'Document BAS/BMS systems for HVAC, lighting, and energy management.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
      { key: 'off_10', title: 'Energy Star / LEED Certification', requestText: 'Provide Energy Star score and any green building certifications.', priority: 3, requestType: 'document', defaultOwnerRole: 'seller' },
      { key: 'off_11', title: 'Janitorial Scope & Costs', requestText: 'Provide janitorial service agreement, cleaning specifications, and costs.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
      { key: 'off_12', title: 'Lobby / Common Area Renovation History', requestText: 'Provide history of lobby and common area renovations with costs and dates.', priority: 3, requestType: 'data', defaultOwnerRole: 'seller' },
      { key: 'off_13', title: 'Coworking / Flex Space Agreements', requestText: 'Provide any coworking, flex space, or license agreements if applicable.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
      { key: 'off_14', title: 'Sublease Inventory', requestText: 'Identify any subleases and provide sublease agreements and consent documentation.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
      { key: 'off_15', title: 'Fiber / Telecom Risers', requestText: 'Document telecom riser access, fiber providers, and roof rights agreements.', priority: 3, requestType: 'data', defaultOwnerRole: 'seller' },
    ]},
    { key: 'office_market', title: 'Office Market Analysis', items: [
      { key: 'off_mkt_01', title: 'Submarket Vacancy & Rent Trends', requestText: 'Obtain office submarket report: vacancy rates, asking rents, absorption trends.', priority: 2, requestType: 'data', defaultOwnerRole: 'broker' },
      { key: 'off_mkt_02', title: 'Competitive Property Survey', requestText: 'Identify and survey 5-10 competitive office properties: rents, occupancy, amenities.', priority: 2, requestType: 'data', defaultOwnerRole: 'broker' },
      { key: 'off_mkt_03', title: 'New Supply Pipeline', requestText: 'Identify planned/under construction competitive office supply in the submarket.', priority: 3, requestType: 'data', defaultOwnerRole: 'broker' },
      { key: 'off_mkt_04', title: 'Major Employer Analysis', requestText: 'Research major employers in the area and economic drivers supporting office demand.', priority: 3, requestType: 'data', defaultOwnerRole: 'owner_admin' },
      { key: 'off_mkt_05', title: 'Remote Work Impact Assessment', requestText: 'Assess impact of remote/hybrid work trends on tenant demand in this submarket.', priority: 2, requestType: 'data', defaultOwnerRole: 'owner_admin' },
    ]},
  ],
};

export const RETAIL_ADDON_TEMPLATE: ChecklistTemplate = {
  name: 'Retail Add-On', version: '1.0.0', assetClass: 'retail',
  sections: [
    { key: 'retail_ops', title: 'Retail Operations', items: [
      { key: 'ret_01', title: 'Tenant Sales Reports', requestText: 'Provide tenant sales reports (if percentage rent clauses exist) for last 3 years.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
      { key: 'ret_02', title: 'Percentage Rent Analysis', requestText: 'Analyze percentage rent thresholds and historical performance vs. breakpoints.', priority: 1, requestType: 'data', defaultOwnerRole: 'accountant' },
      { key: 'ret_03', title: 'Anchor Tenant Analysis', requestText: 'Assess anchor tenant financial health, co-tenancy clauses, and kick-out rights.', priority: 1, requestType: 'data', defaultOwnerRole: 'owner_admin' },
      { key: 'ret_04', title: 'Exclusive Use Provisions', requestText: 'Map all exclusive use provisions and identify potential conflicts.', priority: 1, requestType: 'data', defaultOwnerRole: 'attorney' },
      { key: 'ret_05', title: 'Co-Tenancy Provisions', requestText: 'Identify and analyze all co-tenancy clauses and remedies.', priority: 1, requestType: 'data', defaultOwnerRole: 'attorney' },
      { key: 'ret_06', title: 'Outparcel / Pad Site Details', requestText: 'Provide details on outparcels: ownership, ground leases, development potential.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
      { key: 'ret_07', title: 'Signage / Pylon Rights', requestText: 'Provide pylon/monument sign agreements and available signage rights.', priority: 3, requestType: 'document', defaultOwnerRole: 'seller' },
      { key: 'ret_08', title: 'REA / OEA Agreements', requestText: 'Provide Reciprocal Easement Agreements and Operating Agreements between parcels.', priority: 1, requestType: 'document', defaultOwnerRole: 'attorney' },
      { key: 'ret_09', title: 'Traffic Counts', requestText: 'Provide traffic count data for adjacent roadways and site ingress/egress.', priority: 2, requestType: 'data', defaultOwnerRole: 'broker' },
      { key: 'ret_10', title: 'Merchant Association / BID', requestText: 'Provide merchant association bylaws and any BID assessment obligations.', priority: 3, requestType: 'document', defaultOwnerRole: 'seller' },
      { key: 'ret_11', title: 'Pad Site Ground Leases', requestText: 'Provide all ground lease agreements for pad sites or outparcels.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
      { key: 'ret_12', title: 'NNN Reconciliation History', requestText: 'Provide 3-year NNN reconciliation history and methodology documentation.', priority: 1, requestType: 'document', defaultOwnerRole: 'accountant' },
      { key: 'ret_13', title: 'Customer Demographics Study', requestText: 'Provide trade area demographics: population, income, spending patterns.', priority: 2, requestType: 'data', defaultOwnerRole: 'broker' },
      { key: 'ret_14', title: 'E-Commerce Impact Assessment', requestText: 'Assess tenant vulnerability to e-commerce disruption and omnichannel strategies.', priority: 2, requestType: 'data', defaultOwnerRole: 'owner_admin' },
      { key: 'ret_15', title: 'Inline Tenant Mix Strategy', requestText: 'Evaluate current tenant mix against optimal retail merchandising strategy.', priority: 2, requestType: 'data', defaultOwnerRole: 'owner_admin' },
    ]},
  ],
};

export const INDUSTRIAL_ADDON_TEMPLATE: ChecklistTemplate = {
  name: 'Industrial Add-On', version: '1.0.0', assetClass: 'industrial',
  sections: [
    { key: 'industrial_ops', title: 'Industrial Operations', items: [
      { key: 'ind_01', title: 'Clear Height Verification', requestText: 'Verify clear heights throughout warehouse space and compare to market standards.', priority: 1, requestType: 'verification', defaultOwnerRole: 'consultant' },
      { key: 'ind_02', title: 'Loading Dock Inventory', requestText: 'Document loading docks: count, type (dock-high, grade-level, drive-in), levelers, capacity.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller' },
      { key: 'ind_03', title: 'Truck Court / Trailer Parking', requestText: 'Document truck court dimensions, trailer parking capacity, and turning radius adequacy.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller' },
      { key: 'ind_04', title: 'Power Capacity (Amps/Phase)', requestText: 'Document electrical service: amps, voltage, phase, distribution, and available capacity.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller' },
      { key: 'ind_05', title: 'Floor Load Capacity', requestText: 'Provide floor slab specifications: thickness, load capacity (PSF), and condition.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller' },
      { key: 'ind_06', title: 'Sprinkler System (ESFR)', requestText: 'Document fire sprinkler system: type (ESFR, in-rack), GPM, compliance with tenant needs.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
      { key: 'ind_07', title: 'Rail Access / Siding', requestText: 'Document rail access: siding availability, rail operator, switching agreements.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
      { key: 'ind_08', title: 'Crane Systems', requestText: 'Document overhead crane systems: capacity, runway length, condition, inspection records.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
      { key: 'ind_09', title: 'Climate Control / Cold Storage', requestText: 'Document any climate-controlled or cold storage areas: temps, systems, capacity.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
      { key: 'ind_10', title: 'Yard / Outside Storage Permits', requestText: 'Verify zoning approval and permits for outside storage, if applicable.', priority: 2, requestType: 'verification', defaultOwnerRole: 'attorney' },
      { key: 'ind_11', title: 'Hazardous Use Permits', requestText: 'Provide any hazardous use permits and HAZMAT storage compliance documentation.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
      { key: 'ind_12', title: 'Proximity to Infrastructure', requestText: 'Assess proximity to highways, ports, airports, intermodal facilities, and labor pools.', priority: 2, requestType: 'data', defaultOwnerRole: 'owner_admin' },
      { key: 'ind_13', title: 'Last-Mile / E-Commerce Suitability', requestText: 'Evaluate property suitability for last-mile delivery operations.', priority: 3, requestType: 'data', defaultOwnerRole: 'owner_admin' },
      { key: 'ind_14', title: 'Expansion Potential', requestText: 'Assess land availability and zoning for future building expansion.', priority: 2, requestType: 'data', defaultOwnerRole: 'owner_admin' },
      { key: 'ind_15', title: 'Air Rights / Vertical Clearance', requestText: 'Verify no air rights restrictions or FAA height limitations affecting operations.', priority: 3, requestType: 'verification', defaultOwnerRole: 'attorney' },
    ]},
  ],
};

export const OPERATING_BIZ_ADDON_TEMPLATE: ChecklistTemplate = {
  name: 'Operating Business Acquisition Add-On', version: '1.0.0', assetClass: 'business_acquisition',
  sections: [
    { key: 'biz_financial', title: 'Business Financial Deep Dive', items: [
      { key: 'biz_fin_01', title: 'Quality of Earnings (QoE) Report', requestText: 'Engage accounting firm to prepare Quality of Earnings analysis on trailing financials.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 14, defaultOwnerRole: 'accountant' },
      { key: 'biz_fin_02', title: 'Revenue Concentration Analysis', requestText: 'Analyze customer/revenue concentration: % from top 5/10/20 customers.', priority: 1, requestType: 'data', defaultOwnerRole: 'accountant' },
      { key: 'biz_fin_03', title: 'Adjusted EBITDA Bridge', requestText: 'Prepare adjusted EBITDA bridge identifying all add-backs, one-time items, and pro forma adjustments.', priority: 1, requestType: 'data', defaultOwnerRole: 'accountant' },
      { key: 'biz_fin_04', title: 'Working Capital Analysis', requestText: 'Analyze working capital: define components, calculate target, identify seasonal patterns.', priority: 1, requestType: 'data', defaultOwnerRole: 'accountant' },
      { key: 'biz_fin_05', title: 'Monthly Financial Trends (36 months)', requestText: 'Provide 36-month monthly financial summary showing revenue, COGS, OpEx, and EBITDA trends.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
      { key: 'biz_fin_06', title: 'Product/Service Revenue Mix', requestText: 'Break down revenue by product line, service category, or business segment.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller' },
      { key: 'biz_fin_07', title: 'Pricing Analysis', requestText: 'Provide pricing history, rate increases, and competitive pricing benchmark analysis.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
      { key: 'biz_fin_08', title: 'Backlog / Pipeline Report', requestText: 'Provide current sales backlog, pipeline, and contracted future revenue.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
      { key: 'biz_fin_09', title: 'Seasonality Analysis', requestText: 'Document revenue and expense seasonality patterns and working capital implications.', priority: 2, requestType: 'data', defaultOwnerRole: 'accountant' },
      { key: 'biz_fin_10', title: 'Tax Structuring Analysis', requestText: 'Analyze optimal deal structure (asset vs. stock sale) and Section 338(h)(10) election.', priority: 1, requestType: 'data', defaultOwnerRole: 'accountant' },
    ]},
    { key: 'biz_customers', title: 'Customer & Revenue Analysis', items: [
      { key: 'biz_cust_01', title: 'Top Customer Contracts', requestText: 'Provide contracts for top 20 customers by revenue (or all if fewer than 20).', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
      { key: 'biz_cust_02', title: 'Customer Churn Analysis', requestText: 'Provide customer retention/churn rates for the last 3 years.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller' },
      { key: 'biz_cust_03', title: 'Customer Contract Assignability', requestText: 'Analyze change-of-control provisions in key customer contracts.', priority: 1, requestType: 'verification', defaultOwnerRole: 'attorney' },
      { key: 'biz_cust_04', title: 'Customer Satisfaction / NPS', requestText: 'Provide customer satisfaction scores, NPS data, or survey results.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
      { key: 'biz_cust_05', title: 'Customer Acquisition Cost', requestText: 'Provide CAC metrics by channel and customer lifetime value analysis.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
    ]},
    { key: 'biz_operations', title: 'Operations & Supply Chain', items: [
      { key: 'biz_ops_01', title: 'Key Supplier Contracts', requestText: 'Provide contracts for top 10 suppliers/vendors including pricing terms and exclusivity.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
      { key: 'biz_ops_02', title: 'Supply Chain Risk Assessment', requestText: 'Identify single-source dependencies and supply chain vulnerabilities.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller' },
      { key: 'biz_ops_03', title: 'Inventory Valuation & Aging', requestText: 'Provide physical inventory count, valuation methodology, and aging analysis.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
      { key: 'biz_ops_04', title: 'Standard Operating Procedures', requestText: 'Provide documented SOPs for key business processes and operations.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
      { key: 'biz_ops_05', title: 'Quality Control / Warranty Data', requestText: 'Provide quality metrics, warranty claims history, and product liability issues.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
      { key: 'biz_ops_06', title: 'Fleet / Vehicle Information', requestText: 'Provide fleet inventory: make, model, year, mileage, ownership/lease, condition.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
      { key: 'biz_ops_07', title: 'Subcontractor Agreements', requestText: 'Provide all subcontractor agreements and independent contractor classifications.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
    ]},
    { key: 'biz_ip', title: 'Intellectual Property & Brand', items: [
      { key: 'biz_ip_01', title: 'Trademark / Patent / IP Schedule', requestText: 'Provide schedule of all trademarks, patents, copyrights, and trade secrets.', priority: 1, requestType: 'document', defaultOwnerRole: 'attorney' },
      { key: 'biz_ip_02', title: 'Brand / Marketing Materials', requestText: 'Provide brand guidelines, marketing materials, and advertising spend history.', priority: 3, requestType: 'document', defaultOwnerRole: 'seller' },
      { key: 'biz_ip_03', title: 'Social Media / Online Reputation', requestText: 'Provide social media account access/ownership and online review/rating analysis.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
      { key: 'biz_ip_04', title: 'Non-Compete / Non-Solicit Agreements', requestText: 'Provide all non-compete and non-solicitation agreements with employees and principals.', priority: 1, requestType: 'document', defaultOwnerRole: 'attorney' },
    ]},
    { key: 'biz_regulatory', title: 'Regulatory & Compliance', items: [
      { key: 'biz_reg_01', title: 'Industry-Specific Licenses', requestText: 'Provide all industry-specific licenses, certifications, and accreditations.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
      { key: 'biz_reg_02', title: 'Regulatory Compliance History', requestText: 'Provide history of regulatory inspections, audits, findings, and corrective actions.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
      { key: 'biz_reg_03', title: 'Pending Regulatory Changes', requestText: 'Identify any pending regulatory or legislative changes that could impact the business.', priority: 2, requestType: 'data', defaultOwnerRole: 'attorney' },
      { key: 'biz_reg_04', title: 'Data Privacy / GDPR Compliance', requestText: 'Assess data privacy practices, CCPA/GDPR compliance, and data processing agreements.', priority: 2, requestType: 'verification', defaultOwnerRole: 'attorney' },
    ]},
    { key: 'biz_transition', title: 'Transition Planning', items: [
      { key: 'biz_trans_01', title: 'Seller Transition Services Agreement', requestText: 'Negotiate TSA for seller to provide transition support post-closing.', priority: 1, requestType: 'document', milestoneAnchor: 'closing', dueOffsetDays: -14, defaultOwnerRole: 'attorney' },
      { key: 'biz_trans_02', title: 'Key Person Dependencies', requestText: 'Identify key person risk: which individuals are critical to operations and customer relationships.', priority: 1, requestType: 'data', defaultOwnerRole: 'owner_admin' },
      { key: 'biz_trans_03', title: '100-Day Integration Plan', requestText: 'Develop post-closing integration plan covering operations, finance, HR, IT, and customers.', priority: 1, requestType: 'data', milestoneAnchor: 'closing', dueOffsetDays: -7, defaultOwnerRole: 'owner_admin' },
      { key: 'biz_trans_04', title: 'Customer Communication Plan', requestText: 'Prepare customer notification strategy and communication for ownership change.', priority: 1, requestType: 'data', milestoneAnchor: 'closing', dueOffsetDays: -7, defaultOwnerRole: 'owner_admin' },
      { key: 'biz_trans_05', title: 'Vendor Notification Plan', requestText: 'Prepare vendor notification and contract transition plan.', priority: 2, requestType: 'data', milestoneAnchor: 'closing', dueOffsetDays: -7, defaultOwnerRole: 'owner_admin' },
    ]},
  ],
};
