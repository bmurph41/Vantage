import { db } from "../db";
import { ddChecklistTemplates } from "@shared/schema";
import { eq } from "drizzle-orm";

interface TaskBlueprint {
  title: string;
  description?: string;
  ddCategory?: string;
  priority?: "low" | "med" | "high";
  deadlineDays?: number;
  isMilestone?: boolean;
  isGating?: boolean;
  requiresOnSiteInspection?: boolean;
}

interface DDTemplate {
  name: string;
  description: string;
  templateType: "environmental" | "infrastructure" | "permits" | "financial" | "operations" | "custom";
  category?: string;
  tasks: TaskBlueprint[];
  sortOrder: number;
}

const marinaTemplates: DDTemplate[] = [
  {
    name: "Marina Environmental Assessment",
    description: "Comprehensive 30-item environmental due diligence checklist for marina acquisitions including fuel storage, spill containment, water quality, permits, and EPA compliance verification.",
    templateType: "environmental",
    category: "ESA",
    sortOrder: 1,
    tasks: [
      { title: "Phase I Environmental Site Assessment", description: "Order and review Phase I ESA from qualified environmental consultant", ddCategory: "ESA", priority: "high", deadlineDays: 30, isGating: true },
      { title: "Phase II Environmental Testing", description: "Conduct Phase II soil and groundwater testing based on Phase I findings", ddCategory: "ESA", priority: "high", deadlineDays: 45 },
      { title: "Underground Storage Tank (UST) Inventory", description: "Complete inventory of all underground storage tanks with installation dates and capacities", ddCategory: "ESA", priority: "high", deadlineDays: 21, requiresOnSiteInspection: true },
      { title: "Above-ground Storage Tank (AST) Inspection", description: "Inspect all above-ground fuel storage tanks for integrity, containment, and compliance", ddCategory: "ESA", priority: "high", deadlineDays: 21, requiresOnSiteInspection: true },
      { title: "Fuel Dispensing System Assessment", description: "Evaluate fuel dispensing equipment, piping, and safety systems", ddCategory: "ESA", priority: "high", deadlineDays: 21, requiresOnSiteInspection: true },
      { title: "Secondary Containment Verification", description: "Verify secondary containment systems meet EPA and state requirements", ddCategory: "ESA", priority: "high", deadlineDays: 21, requiresOnSiteInspection: true },
      { title: "Spill Prevention Control Countermeasure (SPCC) Plan Review", description: "Review SPCC plan for adequacy and compliance with 40 CFR Part 112", ddCategory: "ESA", priority: "high", deadlineDays: 14 },
      { title: "Oil/Water Separator Inspection", description: "Inspect oil/water separators and verify maintenance records", ddCategory: "ESA", priority: "med", deadlineDays: 21, requiresOnSiteInspection: true },
      { title: "Marina Basin Water Quality Testing", description: "Test marina water for pollutants, dissolved oxygen, and contaminants", ddCategory: "ESA", priority: "high", deadlineDays: 30, requiresOnSiteInspection: true },
      { title: "Sediment Analysis", description: "Analyze marina sediment for heavy metals and hydrocarbon contamination", ddCategory: "ESA", priority: "high", deadlineDays: 30, requiresOnSiteInspection: true },
      { title: "Stormwater Management System Review", description: "Assess stormwater collection, treatment, and discharge systems", ddCategory: "ESA", priority: "med", deadlineDays: 21 },
      { title: "NPDES Permit Compliance", description: "Review National Pollutant Discharge Elimination System permit status", ddCategory: "ESA", priority: "high", deadlineDays: 21 },
      { title: "EPA Compliance History Review", description: "Research EPA compliance history and any violations or consent orders", ddCategory: "ESA", priority: "high", deadlineDays: 21 },
      { title: "State Environmental Agency Records Search", description: "Search state environmental agency databases for violations or enforcement actions", ddCategory: "ESA", priority: "high", deadlineDays: 21 },
      { title: "Hazardous Materials Inventory", description: "Complete inventory of all hazardous materials stored on-site", ddCategory: "ESA", priority: "med", deadlineDays: 14, requiresOnSiteInspection: true },
      { title: "Hazardous Waste Disposal Records", description: "Review hazardous waste manifests and disposal contractor compliance", ddCategory: "ESA", priority: "med", deadlineDays: 14 },
      { title: "Petroleum Product Storage Records", description: "Review fuel delivery records, inventory reconciliation, and leak detection data", ddCategory: "ESA", priority: "high", deadlineDays: 14 },
      { title: "Leak Detection System Testing", description: "Verify leak detection systems are operational and properly maintained", ddCategory: "ESA", priority: "high", deadlineDays: 21, requiresOnSiteInspection: true },
      { title: "Cathodic Protection System Assessment", description: "Evaluate cathodic protection systems for underground tanks and piping", ddCategory: "ESA", priority: "med", deadlineDays: 21, requiresOnSiteInspection: true },
      { title: "Clean Marina Program Certification", description: "Review clean marina certification status and requirements", ddCategory: "ESA", priority: "low", deadlineDays: 14 },
      { title: "Boat Maintenance Area Assessment", description: "Evaluate environmental controls in boat maintenance and repair areas", ddCategory: "ESA", priority: "med", deadlineDays: 21, requiresOnSiteInspection: true },
      { title: "Paint and Coatings Storage Review", description: "Review storage and handling of paints, solvents, and coatings", ddCategory: "ESA", priority: "low", deadlineDays: 14, requiresOnSiteInspection: true },
      { title: "Bilge Water Disposal Procedures", description: "Evaluate bilge water collection and disposal procedures", ddCategory: "ESA", priority: "med", deadlineDays: 14, requiresOnSiteInspection: true },
      { title: "Sewage Pump-out Station Compliance", description: "Verify sewage pump-out facilities meet Clean Vessel Act requirements", ddCategory: "ESA", priority: "med", deadlineDays: 14, requiresOnSiteInspection: true },
      { title: "Fish Cleaning Station Discharge", description: "Review fish cleaning station waste handling and discharge", ddCategory: "ESA", priority: "low", deadlineDays: 14, requiresOnSiteInspection: true },
      { title: "Coastal Zone Management Act Compliance", description: "Verify compliance with state coastal zone management requirements", ddCategory: "ESA", priority: "med", deadlineDays: 21 },
      { title: "Wetlands Delineation Review", description: "Review any wetlands on or adjacent to the property", ddCategory: "ESA", priority: "med", deadlineDays: 21 },
      { title: "Endangered Species Assessment", description: "Check for protected species or critical habitat designations", ddCategory: "ESA", priority: "med", deadlineDays: 21 },
      { title: "Environmental Insurance Requirements", description: "Identify environmental insurance needs and pollution liability coverage", ddCategory: "ESA", priority: "med", deadlineDays: 14 },
      { title: "Environmental Milestone Complete", description: "All environmental assessments completed and reviewed - ready for closing", isMilestone: true, priority: "high", deadlineDays: 45 }
    ]
  },
  {
    name: "Marina Structural Inspection",
    description: "25-item infrastructure assessment covering docks, pilings, electrical systems, plumbing, seawalls, and all marina structures.",
    templateType: "infrastructure",
    category: "inspection",
    sortOrder: 2,
    tasks: [
      { title: "Floating Dock Systems Inspection", description: "Comprehensive inspection of all floating dock structures, connections, and flotation", ddCategory: "inspection", priority: "high", deadlineDays: 21, requiresOnSiteInspection: true },
      { title: "Fixed Pier Condition Assessment", description: "Evaluate all fixed piers for structural integrity, decking condition, and safety", ddCategory: "inspection", priority: "high", deadlineDays: 21, requiresOnSiteInspection: true },
      { title: "Gangway and Access Ramp Inspection", description: "Inspect all gangways and access ramps for ADA compliance and safety", ddCategory: "inspection", priority: "med", deadlineDays: 21, requiresOnSiteInspection: true },
      { title: "Wood Piling Assessment", description: "Underwater and above-water inspection of wood pilings for rot and marine borer damage", ddCategory: "inspection", priority: "high", deadlineDays: 21, requiresOnSiteInspection: true },
      { title: "Steel Piling Inspection", description: "Assess steel pilings for corrosion, coating condition, and structural integrity", ddCategory: "inspection", priority: "high", deadlineDays: 21, requiresOnSiteInspection: true },
      { title: "Concrete Piling Evaluation", description: "Inspect concrete pilings for spalling, cracking, and rebar exposure", ddCategory: "inspection", priority: "high", deadlineDays: 21, requiresOnSiteInspection: true },
      { title: "Seawall Structural Assessment", description: "Comprehensive seawall inspection including underwater survey and soil conditions", ddCategory: "inspection", priority: "high", deadlineDays: 21, requiresOnSiteInspection: true, isGating: true },
      { title: "Bulkhead Condition Report", description: "Evaluate bulkhead condition, tie-backs, and drainage systems", ddCategory: "inspection", priority: "high", deadlineDays: 21, requiresOnSiteInspection: true },
      { title: "Electrical Shore Power Infrastructure", description: "Inspect main electrical distribution, transformers, and shore power pedestals", ddCategory: "inspection", priority: "high", deadlineDays: 21, requiresOnSiteInspection: true },
      { title: "Electrical Code Compliance Review", description: "Verify NEC Article 555 compliance for marina electrical systems", ddCategory: "inspection", priority: "high", deadlineDays: 21 },
      { title: "Ground Fault Protection Systems", description: "Test GFCI and ELCI protection on all dock circuits", ddCategory: "inspection", priority: "high", deadlineDays: 21, requiresOnSiteInspection: true },
      { title: "Potable Water Distribution System", description: "Assess water supply lines, backflow preventers, and water quality", ddCategory: "inspection", priority: "med", deadlineDays: 21, requiresOnSiteInspection: true },
      { title: "Sewage Pump-out System Inspection", description: "Evaluate pump-out stations, holding tanks, and discharge systems", ddCategory: "inspection", priority: "med", deadlineDays: 21, requiresOnSiteInspection: true },
      { title: "Fuel Dock Structure Assessment", description: "Inspect fuel dock structural elements, containment, and safety systems", ddCategory: "inspection", priority: "high", deadlineDays: 21, requiresOnSiteInspection: true },
      { title: "Travel Lift and Hoist Equipment", description: "Inspect travel lift structure, rails, and mechanical systems", ddCategory: "inspection", priority: "high", deadlineDays: 21, requiresOnSiteInspection: true },
      { title: "Dry Storage Rack Systems", description: "Assess dry stack rack structural integrity, capacity, and condition", ddCategory: "inspection", priority: "med", deadlineDays: 21, requiresOnSiteInspection: true },
      { title: "Forklift and Equipment Assessment", description: "Evaluate forklifts and boat handling equipment condition", ddCategory: "inspection", priority: "med", deadlineDays: 21, requiresOnSiteInspection: true },
      { title: "Marina Building Inspection", description: "Inspect ship store, office, and service buildings for structural issues", ddCategory: "inspection", priority: "med", deadlineDays: 21, requiresOnSiteInspection: true },
      { title: "Restroom and Shower Facilities", description: "Assess restroom facilities for code compliance and condition", ddCategory: "inspection", priority: "low", deadlineDays: 21, requiresOnSiteInspection: true },
      { title: "Fire Suppression Systems", description: "Verify fire suppression systems meet code and are properly maintained", ddCategory: "inspection", priority: "high", deadlineDays: 14, requiresOnSiteInspection: true },
      { title: "Lighting and Security Systems", description: "Assess dock lighting, parking lot lighting, and security cameras", ddCategory: "inspection", priority: "low", deadlineDays: 14, requiresOnSiteInspection: true },
      { title: "Parking Lot and Pavement Condition", description: "Evaluate parking areas, driveways, and boat ramp conditions", ddCategory: "inspection", priority: "low", deadlineDays: 14, requiresOnSiteInspection: true },
      { title: "Dredging Requirements Assessment", description: "Review bathymetric surveys and identify dredging needs", ddCategory: "inspection", priority: "med", deadlineDays: 21 },
      { title: "Capital Expenditure 5-Year Plan", description: "Compile infrastructure findings into prioritized CapEx plan", ddCategory: "inspection", priority: "high", deadlineDays: 30 },
      { title: "Infrastructure Milestone Complete", description: "All infrastructure inspections completed and documented", isMilestone: true, priority: "high", deadlineDays: 30 }
    ]
  },
  {
    name: "Marina Legal/Title Review",
    description: "20-item legal due diligence covering riparian rights, submerged land leases, easements, zoning, and title matters specific to marina properties.",
    templateType: "permits",
    category: "title",
    sortOrder: 3,
    tasks: [
      { title: "Title Commitment Review", description: "Order and review title commitment for all marina parcels", ddCategory: "title", priority: "high", deadlineDays: 14, isGating: true },
      { title: "Riparian Rights Analysis", description: "Confirm riparian rights transfer with the property and document scope", ddCategory: "title", priority: "high", deadlineDays: 21, isGating: true },
      { title: "Submerged Land Lease Review", description: "Review state submerged land lease terms, expiration, rent, and renewal options", ddCategory: "title", priority: "high", deadlineDays: 21, isGating: true },
      { title: "Littoral Rights Verification", description: "Verify littoral rights and any restrictions on water access", ddCategory: "title", priority: "high", deadlineDays: 21 },
      { title: "Mean High Water Line Survey", description: "Obtain survey showing mean high water line and property boundaries", ddCategory: "survey", priority: "high", deadlineDays: 21 },
      { title: "Easement Review and Analysis", description: "Review all recorded easements affecting the property", ddCategory: "title", priority: "high", deadlineDays: 14 },
      { title: "Access Easement Verification", description: "Confirm legal access to the property and any shared access agreements", ddCategory: "title", priority: "high", deadlineDays: 14 },
      { title: "Utility Easements Review", description: "Review utility easements and any restrictions on development", ddCategory: "title", priority: "med", deadlineDays: 14 },
      { title: "Zoning Classification Verification", description: "Confirm current zoning permits marina use and review any variances", ddCategory: "zoning", priority: "high", deadlineDays: 21, isGating: true },
      { title: "Zoning Nonconformity Analysis", description: "Identify any legal nonconforming uses and their implications", ddCategory: "zoning", priority: "high", deadlineDays: 21 },
      { title: "Development Rights Assessment", description: "Evaluate expansion potential and development rights", ddCategory: "zoning", priority: "med", deadlineDays: 21 },
      { title: "Deed Restriction Review", description: "Review any deed restrictions or covenants affecting use", ddCategory: "title", priority: "med", deadlineDays: 14 },
      { title: "HOA/POA Assessment", description: "Review any homeowner or property owner association requirements", ddCategory: "legal", priority: "low", deadlineDays: 14 },
      { title: "ALTA Survey Review", description: "Obtain and review ALTA/NSPS land title survey", ddCategory: "survey", priority: "high", deadlineDays: 21 },
      { title: "Encroachment Analysis", description: "Identify any encroachments onto or from the property", ddCategory: "survey", priority: "med", deadlineDays: 21 },
      { title: "Pending Litigation Search", description: "Search for any pending or threatened litigation involving the property", ddCategory: "legal", priority: "high", deadlineDays: 14 },
      { title: "Liens and Judgments Review", description: "Review all liens, judgments, and UCC filings against the property", ddCategory: "title", priority: "high", deadlineDays: 14 },
      { title: "Property Tax Assessment Review", description: "Review property tax assessments, exemptions, and payment history", ddCategory: "financial", priority: "med", deadlineDays: 14 },
      { title: "Title Insurance Commitment", description: "Obtain owner's title insurance commitment and review exceptions", ddCategory: "title", priority: "high", deadlineDays: 21 },
      { title: "Legal/Title Milestone Complete", description: "All legal and title matters reviewed and cleared for closing", isMilestone: true, priority: "high", deadlineDays: 30 }
    ]
  },
  {
    name: "Marina Operations Audit",
    description: "25-item operational due diligence covering staffing, procedures, maintenance schedules, vendor contracts, safety protocols, and operational systems.",
    templateType: "operations",
    category: "other",
    sortOrder: 4,
    tasks: [
      { title: "Organization Chart Review", description: "Review organizational structure and reporting relationships", ddCategory: "other", priority: "high", deadlineDays: 14 },
      { title: "Key Personnel Interviews", description: "Interview key management and operational staff", ddCategory: "other", priority: "high", deadlineDays: 21, requiresOnSiteInspection: true },
      { title: "Employment Agreement Review", description: "Review employment contracts, non-competes, and severance obligations", ddCategory: "legal", priority: "high", deadlineDays: 21 },
      { title: "Staffing Level Analysis", description: "Analyze staffing levels versus industry benchmarks and seasonal needs", ddCategory: "other", priority: "med", deadlineDays: 14 },
      { title: "Payroll and Benefits Audit", description: "Review payroll costs, benefits programs, and accrued liabilities", ddCategory: "financial", priority: "med", deadlineDays: 14 },
      { title: "Workers Compensation Experience Review", description: "Review workers comp claims history and experience modification rate", ddCategory: "insurance", priority: "med", deadlineDays: 14 },
      { title: "Standard Operating Procedures Review", description: "Evaluate documented SOPs for all major marina functions", ddCategory: "other", priority: "med", deadlineDays: 14 },
      { title: "Emergency Response Plan Assessment", description: "Review hurricane, fire, spill, and emergency response procedures", ddCategory: "other", priority: "high", deadlineDays: 14 },
      { title: "Safety Training Program Review", description: "Evaluate safety training programs and compliance documentation", ddCategory: "other", priority: "high", deadlineDays: 14 },
      { title: "OSHA Compliance History", description: "Review OSHA inspection history and any outstanding violations", ddCategory: "other", priority: "high", deadlineDays: 14 },
      { title: "Equipment Maintenance Schedules", description: "Review preventive maintenance schedules for all major equipment", ddCategory: "other", priority: "med", deadlineDays: 14 },
      { title: "Dock Maintenance History", description: "Review dock maintenance records and repair history", ddCategory: "other", priority: "med", deadlineDays: 14 },
      { title: "Vendor Contract Review", description: "Review all material vendor contracts and service agreements", ddCategory: "legal", priority: "high", deadlineDays: 21 },
      { title: "Fuel Supplier Agreement", description: "Review fuel supply contract terms, pricing, and obligations", ddCategory: "legal", priority: "high", deadlineDays: 14 },
      { title: "Waste Disposal Contracts", description: "Review contracts for waste removal, recycling, and hazmat disposal", ddCategory: "legal", priority: "med", deadlineDays: 14 },
      { title: "Insurance Policy Review", description: "Review all insurance policies including property, liability, and marina coverage", ddCategory: "insurance", priority: "high", deadlineDays: 21, isGating: true },
      { title: "Claims History Analysis", description: "Review insurance claims history for past 5 years", ddCategory: "insurance", priority: "med", deadlineDays: 14 },
      { title: "IT Systems Assessment", description: "Evaluate marina management software, POS, and IT infrastructure", ddCategory: "other", priority: "low", deadlineDays: 14 },
      { title: "Customer Service Metrics", description: "Review customer satisfaction scores, reviews, and complaint handling", ddCategory: "other", priority: "low", deadlineDays: 14 },
      { title: "Boat Club Program Assessment", description: "If applicable, evaluate boat club membership structure and agreements", ddCategory: "other", priority: "low", deadlineDays: 14 },
      { title: "Charter/Rental Operations", description: "If applicable, review charter or rental boat operation compliance", ddCategory: "other", priority: "low", deadlineDays: 14 },
      { title: "Service Department Review", description: "Evaluate service department operations, certifications, and capacity", ddCategory: "other", priority: "med", deadlineDays: 14, requiresOnSiteInspection: true },
      { title: "Ship Store Inventory", description: "Review ship store inventory, suppliers, and profit margins", ddCategory: "other", priority: "low", deadlineDays: 14 },
      { title: "Security Procedures Review", description: "Assess security protocols, access control, and surveillance systems", ddCategory: "other", priority: "med", deadlineDays: 14 },
      { title: "Operations Milestone Complete", description: "All operational assessments completed and transition plan ready", isMilestone: true, priority: "high", deadlineDays: 30 }
    ]
  },
  {
    name: "Marina Financial Due Diligence",
    description: "20-item financial review covering rent roll verification, revenue audit, expense analysis, cap rate validation, and pro forma development.",
    templateType: "financial",
    category: "financial",
    sortOrder: 5,
    tasks: [
      { title: "Historical P&L Review (3 Years)", description: "Analyze 3 years of profit and loss statements with trend analysis", ddCategory: "financial", priority: "high", deadlineDays: 21, isGating: true },
      { title: "Current Year Financial Performance", description: "Review YTD financials versus budget and prior year", ddCategory: "financial", priority: "high", deadlineDays: 14 },
      { title: "Rent Roll Verification", description: "Audit rent roll against lease files and bank deposits", ddCategory: "financial", priority: "high", deadlineDays: 21, isGating: true },
      { title: "Slip Rate Market Analysis", description: "Compare slip rates to market comps by size and location", ddCategory: "financial", priority: "med", deadlineDays: 14 },
      { title: "Occupancy Rate Analysis", description: "Analyze historical and current occupancy trends", ddCategory: "financial", priority: "high", deadlineDays: 14 },
      { title: "Customer Tenure Analysis", description: "Review customer tenure and turnover rates", ddCategory: "financial", priority: "med", deadlineDays: 14 },
      { title: "Accounts Receivable Aging", description: "Review AR aging and assess collectability of outstanding balances", ddCategory: "financial", priority: "high", deadlineDays: 14 },
      { title: "Revenue by Profit Center", description: "Break down revenue by: dockage, fuel, service, storage, retail", ddCategory: "financial", priority: "high", deadlineDays: 14 },
      { title: "Fuel Sales Analysis", description: "Analyze fuel volumes, margins, and pricing strategy", ddCategory: "financial", priority: "med", deadlineDays: 14 },
      { title: "Operating Expense Verification", description: "Verify operating expenses with invoices and contracts", ddCategory: "financial", priority: "high", deadlineDays: 21 },
      { title: "Payroll Expense Audit", description: "Audit payroll against time records and verify accruals", ddCategory: "financial", priority: "med", deadlineDays: 14 },
      { title: "Utility Cost Analysis", description: "Review utility expenses and identify pass-through opportunities", ddCategory: "financial", priority: "low", deadlineDays: 14 },
      { title: "Tax Return Reconciliation", description: "Reconcile financial statements to filed tax returns", ddCategory: "financial", priority: "high", deadlineDays: 21 },
      { title: "Working Capital Calculation", description: "Calculate net working capital for closing adjustment", ddCategory: "financial", priority: "high", deadlineDays: 21 },
      { title: "Deferred Revenue Analysis", description: "Verify treatment of prepaid slip fees and season deposits", ddCategory: "financial", priority: "high", deadlineDays: 14 },
      { title: "Customer Concentration Risk", description: "Identify any customer concentration in revenue", ddCategory: "financial", priority: "med", deadlineDays: 14 },
      { title: "Cap Rate Validation", description: "Validate cap rate assumptions against market transactions", ddCategory: "financial", priority: "high", deadlineDays: 14 },
      { title: "Valuation Sensitivity Analysis", description: "Perform sensitivity analysis on key value drivers", ddCategory: "financial", priority: "med", deadlineDays: 14 },
      { title: "Acquisition Pro Forma", description: "Develop detailed acquisition pro forma with identified upside", ddCategory: "financial", priority: "high", deadlineDays: 30 },
      { title: "Financial Milestone Complete", description: "All financial due diligence verified and pro forma approved", isMilestone: true, priority: "high", deadlineDays: 35 }
    ]
  },
  {
    name: "Marina Regulatory Compliance",
    description: "25-item regulatory compliance checklist covering USCG requirements, zoning enforcement, wetlands permits, insurance requirements, and all federal/state/local regulatory obligations for marina operations.",
    templateType: "permits",
    category: "permits",
    sortOrder: 6,
    tasks: [
      { title: "USCG Facility Inspection History", description: "Obtain and review Coast Guard facility inspection records for past 3 years", ddCategory: "permits", priority: "high", deadlineDays: 14 },
      { title: "USCG Captain of the Port Requirements", description: "Verify compliance with local Captain of the Port requirements and security zones", ddCategory: "permits", priority: "high", deadlineDays: 14 },
      { title: "USCG Facility Security Assessment", description: "Review Maritime Security (MARSEC) level compliance and security plans", ddCategory: "permits", priority: "high", deadlineDays: 21 },
      { title: "USCG Aids to Navigation Permits", description: "Verify private aids to navigation permits are current and compliant", ddCategory: "permits", priority: "med", deadlineDays: 14 },
      { title: "USCG Fuel Transfer Procedures", description: "Review fuel transfer procedures and spill response compliance", ddCategory: "permits", priority: "high", deadlineDays: 14 },
      { title: "Municipal Zoning Compliance Letter", description: "Obtain zoning compliance letter from local planning department", ddCategory: "zoning", priority: "high", deadlineDays: 21, isGating: true },
      { title: "Special Use Permits Review", description: "Review all special use permits, conditional use permits, and variances", ddCategory: "zoning", priority: "high", deadlineDays: 21 },
      { title: "Zoning Violation History", description: "Search for any zoning violations or code enforcement actions", ddCategory: "zoning", priority: "high", deadlineDays: 14 },
      { title: "Expansion/Development Restrictions", description: "Identify any zoning restrictions on marina expansion or development", ddCategory: "zoning", priority: "med", deadlineDays: 21 },
      { title: "Army Corps of Engineers Permits", description: "Review USACE Section 10/404 permits for docks, dredging, and structures", ddCategory: "permits", priority: "high", deadlineDays: 21, isGating: true },
      { title: "Wetlands Permit Compliance", description: "Verify compliance with federal and state wetlands protection requirements", ddCategory: "permits", priority: "high", deadlineDays: 21, isGating: true },
      { title: "Coastal Development Permits", description: "Review state coastal development permits and any conditions", ddCategory: "permits", priority: "high", deadlineDays: 21 },
      { title: "State DEP/DEQ Permits", description: "Compile all state environmental permits (water, air, waste)", ddCategory: "permits", priority: "high", deadlineDays: 21 },
      { title: "NPDES Stormwater Permit", description: "Verify NPDES stormwater discharge permit compliance", ddCategory: "permits", priority: "high", deadlineDays: 14 },
      { title: "Underground Storage Tank Registration", description: "Verify UST registration with state environmental agency", ddCategory: "permits", priority: "high", deadlineDays: 14 },
      { title: "Fuel Sales Licenses", description: "Verify all fuel sales licenses and tax registrations", ddCategory: "permits", priority: "med", deadlineDays: 14 },
      { title: "Property & Casualty Insurance Review", description: "Review P&C insurance including property, liability, and umbrella coverage", ddCategory: "insurance", priority: "high", deadlineDays: 21, isGating: true },
      { title: "Marina Operators Legal Liability (MOLL)", description: "Verify marina operators legal liability coverage adequacy", ddCategory: "insurance", priority: "high", deadlineDays: 21 },
      { title: "Protection & Indemnity (P&I) Coverage", description: "Review P&I coverage for marina-owned vessels and operations", ddCategory: "insurance", priority: "med", deadlineDays: 14 },
      { title: "Environmental Liability Insurance", description: "Verify pollution liability and environmental coverage", ddCategory: "insurance", priority: "high", deadlineDays: 21 },
      { title: "Builders Risk / Marine Operators Coverage", description: "Review coverage for service department and boat handling operations", ddCategory: "insurance", priority: "med", deadlineDays: 14 },
      { title: "Business Interruption Coverage", description: "Verify business interruption and contingent business coverage", ddCategory: "insurance", priority: "med", deadlineDays: 14 },
      { title: "Named Storm/Hurricane Coverage", description: "Review hurricane and named storm coverage and deductibles", ddCategory: "insurance", priority: "high", deadlineDays: 14 },
      { title: "Certificate of Insurance Requirements", description: "Review tenant/customer certificate of insurance requirements and compliance", ddCategory: "insurance", priority: "low", deadlineDays: 14 },
      { title: "Regulatory Compliance Milestone Complete", description: "All regulatory, permit, and insurance items verified and cleared", isMilestone: true, priority: "high", deadlineDays: 30 }
    ]
  }
];

export async function seedDDTemplates() {
  console.log("Seeding Marina-Specific DD Checklist Templates...");
  
  for (const template of marinaTemplates) {
    try {
      const existing = await db.query.ddChecklistTemplates.findFirst({
        where: (t, { eq, and }) => and(
          eq(t.name, template.name),
          eq(t.isSystem, true)
        )
      });
      
      if (existing) {
        console.log(`Updating template "${template.name}" (${template.tasks.length} tasks)...`);
        await db.update(ddChecklistTemplates)
          .set({
            description: template.description,
            templateType: template.templateType,
            category: template.category,
            tasks: template.tasks,
            sortOrder: template.sortOrder,
            updatedAt: new Date(),
          })
          .where(eq(ddChecklistTemplates.id, existing.id));
        continue;
      }
      
      await db.insert(ddChecklistTemplates).values({
        name: template.name,
        description: template.description,
        templateType: template.templateType,
        category: template.category,
        tasks: template.tasks,
        isSystem: true,
        isActive: true,
        sortOrder: template.sortOrder,
      });
      
      console.log(`Created template: ${template.name} (${template.tasks.length} tasks)`);
    } catch (error) {
      console.error(`Error creating template ${template.name}:`, error);
    }
  }
  
  console.log("DD Templates seeding complete!");
}

// Run the seed function
seedDDTemplates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  });
