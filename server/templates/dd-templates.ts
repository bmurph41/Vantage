/**
 * Default Due Diligence Checklist Template
 * Used during workspace DD project provisioning to create tasks.
 */

export type WorkspaceRoleType =
  | "owner_admin" | "internal_member" | "buyer" | "seller" | "broker"
  | "lender" | "attorney" | "accountant" | "consultant" | "viewer";

export type MilestoneAnchor = "dd_start" | "dd_expiration" | "closing";

export interface ChecklistTaskTemplate {
  key: string;
  title: string;
  description?: string;
  defaultDueOffsetDays?: number;
  defaultOwnerRole?: WorkspaceRoleType;
  dependencies?: string[];
  required?: boolean;
  tags?: string[];
  milestoneAnchor?: MilestoneAnchor;
}

export interface ChecklistCategory {
  key: string;
  title: string;
  tasks: ChecklistTaskTemplate[];
}

export interface ChecklistTemplate {
  name: string;
  version: string;
  categories: ChecklistCategory[];
}

export const CHECKLIST_TEMPLATE_DEFAULT: ChecklistTemplate = {
  name: "Standard Due Diligence",
  version: "1.0.0",
  categories: [
    {
      key: "executive", title: "Executive / Deal Setup",
      tasks: [
        { key: "exec_confirm_psa", title: "Confirm PSA execution and key dates", description: "Verify PSA effective date, DD expiration, closing date, extension options, notice requirements.", milestoneAnchor: "dd_start", defaultDueOffsetDays: 0, defaultOwnerRole: "owner_admin", required: true, tags: ["psa","dates"] },
        { key: "exec_build_contact_list", title: "Build deal contact list + roles", description: "Buyer, Seller, Broker, Lender, Attorney, Title, Insurance, Survey, Environmental, Appraisal.", milestoneAnchor: "dd_start", defaultDueOffsetDays: 1, defaultOwnerRole: "broker", required: true, tags: ["contacts"] },
        { key: "exec_create_milestones", title: "Confirm DD milestones and internal deadlines", description: "Set internal due dates 3–5 days ahead of external deadlines.", milestoneAnchor: "dd_start", defaultDueOffsetDays: 1, defaultOwnerRole: "owner_admin", required: true, tags: ["milestones"] },
      ],
    },
    {
      key: "legal", title: "Legal",
      tasks: [
        { key: "legal_order_title", title: "Order title commitment", description: "Order title, copies of easements, restrictions, recorded docs.", milestoneAnchor: "dd_start", defaultDueOffsetDays: 1, defaultOwnerRole: "attorney", required: true, tags: ["title"] },
        { key: "legal_review_title", title: "Review title commitment + exceptions", description: "Identify objection items, curative actions, endorsements needed.", milestoneAnchor: "dd_start", defaultDueOffsetDays: 7, defaultOwnerRole: "attorney", required: true, tags: ["title"], dependencies: ["legal_order_title"] },
        { key: "legal_order_survey", title: "Order ALTA/NSPS survey", description: "Coordinate surveyor, provide title, request Table A items.", milestoneAnchor: "dd_start", defaultDueOffsetDays: 2, defaultOwnerRole: "attorney", required: true, tags: ["survey"] },
        { key: "legal_review_survey", title: "Review survey + match to title", description: "Confirm boundary, encroachments, easements, access, setbacks.", milestoneAnchor: "dd_start", defaultDueOffsetDays: 12, defaultOwnerRole: "attorney", required: true, tags: ["survey"], dependencies: ["legal_order_survey","legal_order_title"] },
        { key: "legal_entity_setup", title: "Confirm buying entity + signing authority", description: "Entity docs, operating agreement, incumbency, resolutions.", milestoneAnchor: "dd_start", defaultDueOffsetDays: 5, defaultOwnerRole: "owner_admin", required: true, tags: ["entity"] },
        { key: "legal_permits_licenses", title: "Collect permits/licenses and verify transferability", description: "Local permits, marina/harbor permits (if applicable), business licenses.", milestoneAnchor: "dd_start", defaultDueOffsetDays: 10, defaultOwnerRole: "attorney", required: false, tags: ["permits"] },
      ],
    },
    {
      key: "financial", title: "Financial",
      tasks: [
        { key: "fin_request_financials", title: "Request historical financials + T12", description: "P&L, balance sheet, general ledger, rent roll/slip roll, capex history.", milestoneAnchor: "dd_start", defaultDueOffsetDays: 0, defaultOwnerRole: "accountant", required: true, tags: ["pnl","t12"] },
        { key: "fin_qbo_sync_or_upload", title: "Ingest financials (upload or QBO sync)", description: "Upload PDFs/Excels or sync QuickBooks to populate Valuator model.", milestoneAnchor: "dd_start", defaultDueOffsetDays: 3, defaultOwnerRole: "accountant", required: true, tags: ["ingestion","modeling"], dependencies: ["fin_request_financials"] },
        { key: "fin_normalize_coa", title: "Normalize chart of accounts + map categories", description: "Map seller categories to standardized categories for trend analysis.", milestoneAnchor: "dd_start", defaultDueOffsetDays: 7, defaultOwnerRole: "accountant", required: true, tags: ["coa","mapping"], dependencies: ["fin_qbo_sync_or_upload"] },
        { key: "fin_validate_revenue_drivers", title: "Validate revenue drivers + occupancy", description: "Slips, storage, fuel, service, retail; occupancy, rates, churn.", milestoneAnchor: "dd_start", defaultDueOffsetDays: 10, defaultOwnerRole: "owner_admin", required: true, tags: ["revenue","occupancy"], dependencies: ["fin_qbo_sync_or_upload"] },
        { key: "fin_capex_review", title: "Review capex history + deferred maintenance", description: "Capex list, aging schedule, major systems, reserve assumptions.", milestoneAnchor: "dd_start", defaultDueOffsetDays: 12, defaultOwnerRole: "consultant", required: false, tags: ["capex"] },
        { key: "fin_update_underwriting", title: "Update underwriting model + scenarios", description: "Update NOI bridge, debt scenarios, exit cap sensitivity, IRR.", milestoneAnchor: "dd_start", defaultDueOffsetDays: 14, defaultOwnerRole: "owner_admin", required: true, tags: ["model","scenarios"], dependencies: ["fin_normalize_coa","fin_validate_revenue_drivers"] },
      ],
    },
    {
      key: "physical", title: "Physical / Site",
      tasks: [
        { key: "phys_schedule_site_visit", title: "Schedule site visit + walkthrough", description: "Coordinate access, keys, marina manager, tenants, vendors.", milestoneAnchor: "dd_start", defaultDueOffsetDays: 3, defaultOwnerRole: "broker", required: true, tags: ["site"] },
        { key: "phys_condition_assessment", title: "Complete property condition assessment", description: "Dock systems, utilities, seawalls, paving, roofs, MEP (as applicable).", milestoneAnchor: "dd_start", defaultDueOffsetDays: 10, defaultOwnerRole: "consultant", required: false, tags: ["pca"], dependencies: ["phys_schedule_site_visit"] },
        { key: "phys_vendor_quotes", title: "Collect vendor bids/quotes for key items", description: "Critical repairs, improvements, expansions; obtain ROM costs.", milestoneAnchor: "dd_start", defaultDueOffsetDays: 12, defaultOwnerRole: "consultant", required: false, tags: ["quotes"], dependencies: ["phys_schedule_site_visit"] },
      ],
    },
    {
      key: "environmental", title: "Environmental",
      tasks: [
        { key: "env_order_phase1", title: "Order Phase I ESA", description: "Engage consultant, provide access, request reliance letter.", milestoneAnchor: "dd_start", defaultDueOffsetDays: 2, defaultOwnerRole: "consultant", required: true, tags: ["esa"] },
        { key: "env_review_phase1", title: "Review Phase I results + RECs", description: "Assess RECs, whether Phase II is needed, mitigation steps.", milestoneAnchor: "dd_start", defaultDueOffsetDays: 14, defaultOwnerRole: "consultant", required: true, tags: ["esa"], dependencies: ["env_order_phase1"] },
        { key: "env_flood_storm", title: "Review flood/storm and resiliency risks", description: "FEMA maps, historical claims, elevation, storm surge, resilience plan.", milestoneAnchor: "dd_start", defaultDueOffsetDays: 10, defaultOwnerRole: "consultant", required: false, tags: ["flood","storm"] },
      ],
    },
    {
      key: "insurance", title: "Insurance",
      tasks: [
        { key: "ins_request_quotes", title: "Request insurance quotes", description: "Property, GL, wind/flood (if applicable), umbrella, marina-specific coverages.", milestoneAnchor: "dd_start", defaultDueOffsetDays: 7, defaultOwnerRole: "consultant", required: true, tags: ["insurance"] },
        { key: "ins_bind", title: "Bind insurance coverage", description: "Confirm coverage bound effective at closing; obtain certificates.", milestoneAnchor: "closing", defaultDueOffsetDays: -3, defaultOwnerRole: "consultant", required: true, tags: ["insurance"], dependencies: ["ins_request_quotes"] },
      ],
    },
    {
      key: "lender", title: "Lender / Financing",
      tasks: [
        { key: "lend_submit_package", title: "Submit lender package", description: "T12, rent/slip roll, underwriting, borrower bio, sources/uses.", milestoneAnchor: "dd_start", defaultDueOffsetDays: 5, defaultOwnerRole: "lender", required: false, tags: ["lender"] },
        { key: "lend_appraisal_order", title: "Order appraisal", description: "Engage appraiser, provide docs, confirm timeline.", milestoneAnchor: "dd_start", defaultDueOffsetDays: 7, defaultOwnerRole: "lender", required: false, tags: ["appraisal"], dependencies: ["lend_submit_package"] },
        { key: "lend_commitment", title: "Receive term sheet/commitment and clear conditions", description: "Track conditions precedent, deliverables, timing.", milestoneAnchor: "dd_start", defaultDueOffsetDays: 18, defaultOwnerRole: "lender", required: false, tags: ["commitment"], dependencies: ["lend_submit_package"] },
      ],
    },
    {
      key: "closing", title: "Closing",
      tasks: [
        { key: "close_final_settlement", title: "Review settlement statement (ALTA) + sources/uses", description: "Validate prorations, credits, fees, escrows, payoff, closing costs.", milestoneAnchor: "closing", defaultDueOffsetDays: -2, defaultOwnerRole: "attorney", required: true, tags: ["closing"] },
        { key: "close_wire_confirmations", title: "Confirm wiring instructions + approvals", description: "Fraud checks, call-back verification, approvals.", milestoneAnchor: "closing", defaultDueOffsetDays: -1, defaultOwnerRole: "owner_admin", required: true, tags: ["closing"] },
        { key: "close_closeout_package", title: "Collect closing package + store in VDR", description: "Recorded docs, final title policy, survey, insurance, lender docs.", milestoneAnchor: "closing", defaultDueOffsetDays: 2, defaultOwnerRole: "attorney", required: true, tags: ["closing","vdr"] },
      ],
    },
  ],
};
