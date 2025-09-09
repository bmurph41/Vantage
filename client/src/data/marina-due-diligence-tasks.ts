export interface TaskTemplate {
  id?: string;
  name: string;
  description: string;
  startOffsetDays: number;
  durationDays: number;
  anchor: "psa" | "custom";
  defaultAssignee?: string;
  label: string;
  priority: "low" | "med" | "high";
  category: string;
  estimatedCost?: string;
  typicalCompanies?: string[];
}

export const marinaDueDiligenceTaskTemplates: TaskTemplate[] = [
  // Environmental Due Diligence
  {
    name: "Phase I Environmental Site Assessment",
    description: "Comprehensive environmental assessment to identify potential contamination sources and environmental liabilities",
    startOffsetDays: 0,
    durationDays: 21,
    anchor: "psa",
    label: "Environmental",
    priority: "high",
    category: "Environmental Due Diligence",
    estimatedCost: "$3,000 - $8,000",
    typicalCompanies: ["Environmental consulting firms", "Terracon", "Golder", "AECOM"]
  },
  {
    name: "Phase II Environmental Site Assessment",
    description: "Soil and groundwater sampling if Phase I reveals potential contamination issues",
    startOffsetDays: 21,
    durationDays: 14,
    anchor: "psa",
    label: "Environmental",
    priority: "high",
    category: "Environmental Due Diligence",
    estimatedCost: "$15,000 - $50,000",
    typicalCompanies: ["Environmental consulting firms", "Terracon", "Golder"]
  },
  {
    name: "Wetlands Delineation Study",
    description: "Map and assess wetland boundaries and regulatory constraints around marina property",
    startOffsetDays: 7,
    durationDays: 14,
    anchor: "psa",
    label: "Environmental",
    priority: "high",
    category: "Environmental Due Diligence",
    estimatedCost: "$5,000 - $15,000",
    typicalCompanies: ["Environmental consulting firms", "Wetland specialists"]
  },

  // Marine & Water Quality Inspections
  {
    name: "Marine Structure Inspection",
    description: "Underwater inspection of docks, pilings, seawalls, and marine infrastructure",
    startOffsetDays: 14,
    durationDays: 7,
    anchor: "psa",
    label: "Marine Infrastructure",
    priority: "high",
    category: "Marine & Water Quality",
    estimatedCost: "$8,000 - $25,000",
    typicalCompanies: ["Marine engineering firms", "Diving contractors", "Pile Buck Inc", "Marine Construction"]
  },
  {
    name: "Water Quality Testing",
    description: "Test water quality parameters including dissolved oxygen, pH, pollutants, and contamination levels",
    startOffsetDays: 7,
    durationDays: 10,
    anchor: "psa",
    label: "Water Quality",
    priority: "med",
    category: "Marine & Water Quality",
    estimatedCost: "$2,000 - $8,000",
    typicalCompanies: ["Environmental labs", "Water testing companies", "ALS Environmental"]
  },
  {
    name: "Bathymetric Survey",
    description: "Survey water depths and underwater topography around marina facilities",
    startOffsetDays: 14,
    durationDays: 5,
    anchor: "psa",
    label: "Survey",
    priority: "med",
    category: "Marine & Water Quality",
    estimatedCost: "$5,000 - $15,000",
    typicalCompanies: ["Marine surveyors", "Hydrographic survey companies"]
  },

  // Structural & Property Inspections
  {
    name: "Property Condition Assessment (PCA)",
    description: "Comprehensive assessment of all buildings, structures, and improvements on the property",
    startOffsetDays: 7,
    durationDays: 14,
    anchor: "psa",
    label: "Structural",
    priority: "high",
    category: "Structural & Property Inspections",
    estimatedCost: "$10,000 - $35,000",
    typicalCompanies: ["Engineering firms", "Property assessment specialists", "CBRE Valuation", "Colliers Engineering & Design"]
  },
  {
    name: "ALTA/NSPS Land Title Survey",
    description: "Detailed boundary and improvement survey meeting ALTA/NSPS standards",
    startOffsetDays: 0,
    durationDays: 21,
    anchor: "psa",
    label: "Survey",
    priority: "high",
    category: "Structural & Property Inspections",
    estimatedCost: "$8,000 - $25,000",
    typicalCompanies: ["Licensed surveyors", "Civil engineering firms", "Local surveying companies"]
  },
  {
    name: "Geotechnical Investigation",
    description: "Soil borings and analysis to assess foundation conditions and development constraints",
    startOffsetDays: 14,
    durationDays: 14,
    anchor: "psa",
    label: "Geotechnical",
    priority: "med",
    category: "Structural & Property Inspections",
    estimatedCost: "$15,000 - $40,000",
    typicalCompanies: ["Geotechnical engineers", "Terracon", "Golder", "CMT Engineering"]
  },

  // Financial Due Diligence
  {
    name: "Financial Audit & Review",
    description: "Review audited financial statements, tax returns, and accounting records for past 3 years",
    startOffsetDays: 0,
    durationDays: 21,
    anchor: "psa",
    label: "Financial",
    priority: "high",
    category: "Financial Due Diligence",
    estimatedCost: "$15,000 - $50,000",
    typicalCompanies: ["CPA firms", "Financial advisory services", "Big 4 accounting firms"]
  },
  {
    name: "Rent Roll & Lease Analysis",
    description: "Analyze all boat slip leases, rental agreements, and revenue sources",
    startOffsetDays: 0,
    durationDays: 14,
    anchor: "psa",
    label: "Financial",
    priority: "high",
    category: "Financial Due Diligence",
    estimatedCost: "$5,000 - $15,000",
    typicalCompanies: ["Real estate attorneys", "Asset management firms", "Property management consultants"]
  },
  {
    name: "Operating Expense Review",
    description: "Detailed analysis of utilities, maintenance, insurance, and operating costs",
    startOffsetDays: 7,
    durationDays: 14,
    anchor: "psa",
    label: "Financial",
    priority: "med",
    category: "Financial Due Diligence",
    estimatedCost: "$3,000 - $10,000",
    typicalCompanies: ["Property management firms", "Financial analysts", "CPA firms"]
  },
  {
    name: "Payroll & Staff Review",
    description: "Review employee records, compensation, benefits, and labor compliance",
    startOffsetDays: 14,
    durationDays: 10,
    anchor: "psa",
    label: "HR/Payroll",
    priority: "med",
    category: "Financial Due Diligence",
    estimatedCost: "$2,000 - $8,000",
    typicalCompanies: ["HR consulting firms", "Employment attorneys", "Payroll service providers"]
  },

  // Regulatory & Legal Due Diligence
  {
    name: "Permit & Compliance Review",
    description: "Review all marina permits, licenses, and regulatory compliance status",
    startOffsetDays: 0,
    durationDays: 21,
    anchor: "psa",
    label: "Legal/Regulatory",
    priority: "high",
    category: "Regulatory & Legal",
    estimatedCost: "$10,000 - $25,000",
    typicalCompanies: ["Maritime attorneys", "Environmental lawyers", "Regulatory consultants"]
  },
  {
    name: "Zoning & Land Use Analysis",
    description: "Verify current zoning compliance and analyze future development rights",
    startOffsetDays: 7,
    durationDays: 14,
    anchor: "psa",
    label: "Zoning",
    priority: "high",
    category: "Regulatory & Legal",
    estimatedCost: "$5,000 - $15,000",
    typicalCompanies: ["Land use attorneys", "Planning consultants", "Zoning experts"]
  },
  {
    name: "Title & Encumbrance Review",
    description: "Review title commitment, easements, restrictions, and encumbrances",
    startOffsetDays: 0,
    durationDays: 14,
    anchor: "psa",
    label: "Title",
    priority: "high",
    category: "Regulatory & Legal",
    estimatedCost: "$3,000 - $8,000",
    typicalCompanies: ["Title companies", "Real estate attorneys", "First American Title", "Fidelity National"]
  },

  // Insurance & Risk Assessment
  {
    name: "Insurance Review & Analysis",
    description: "Review existing insurance policies and assess coverage adequacy and costs",
    startOffsetDays: 14,
    durationDays: 10,
    anchor: "psa",
    label: "Insurance",
    priority: "med",
    category: "Insurance & Risk",
    estimatedCost: "$2,000 - $8,000",
    typicalCompanies: ["Insurance brokers", "Risk management consultants", "Marsh", "Aon", "Willis Towers Watson"]
  },
  {
    name: "Flood Zone & FEMA Analysis",
    description: "Analyze flood zone designations, base flood elevations, and flood insurance requirements",
    startOffsetDays: 7,
    durationDays: 7,
    anchor: "psa",
    label: "Flood Risk",
    priority: "high",
    category: "Insurance & Risk",
    estimatedCost: "$1,500 - $5,000",
    typicalCompanies: ["Flood plain specialists", "Engineering firms", "Insurance consultants"]
  },

  // Operational Due Diligence
  {
    name: "Management & Operations Review",
    description: "Assess current management practices, staffing, and operational procedures",
    startOffsetDays: 7,
    durationDays: 14,
    anchor: "psa",
    label: "Operations",
    priority: "med",
    category: "Operational",
    estimatedCost: "$5,000 - $20,000",
    typicalCompanies: ["Marina management consultants", "Operations specialists", "Hospitality consultants"]
  },
  {
    name: "Market Analysis & Feasibility Study",
    description: "Analyze local marina market conditions, competition, and revenue potential",
    startOffsetDays: 0,
    durationDays: 21,
    anchor: "psa",
    label: "Market Analysis",
    priority: "med",
    category: "Operational",
    estimatedCost: "$10,000 - $30,000",
    typicalCompanies: ["Real estate appraisers", "Market research firms", "Marina industry consultants"]
  },
  {
    name: "Equipment & Asset Inventory",
    description: "Inventory and assess condition of all marina equipment, vehicles, and movable assets",
    startOffsetDays: 14,
    durationDays: 7,
    anchor: "psa",
    label: "Asset Inventory",
    priority: "med",
    category: "Operational",
    estimatedCost: "$3,000 - $12,000",
    typicalCompanies: ["Asset management firms", "Equipment appraisers", "Marina specialists"]
  },

  // Technology & Systems
  {
    name: "IT Systems & Technology Review",
    description: "Assess marina management software, POS systems, security systems, and IT infrastructure",
    startOffsetDays: 21,
    durationDays: 7,
    anchor: "psa",
    label: "Technology",
    priority: "low",
    category: "Technology",
    estimatedCost: "$2,000 - $8,000",
    typicalCompanies: ["IT consultants", "Marina software specialists", "Security system companies"]
  }
];

export const taskCategories = [
  "Environmental Due Diligence",
  "Marine & Water Quality", 
  "Structural & Property Inspections",
  "Financial Due Diligence",
  "Regulatory & Legal",
  "Insurance & Risk",
  "Operational",
  "Technology"
];

export function getTasksByCategory(category: string): TaskTemplate[] {
  return marinaDueDiligenceTaskTemplates.filter(task => task.category === category);
}

export function searchTasks(searchTerm: string): TaskTemplate[] {
  if (!searchTerm) return marinaDueDiligenceTaskTemplates;
  
  const lowerSearch = searchTerm.toLowerCase();
  return marinaDueDiligenceTaskTemplates.filter(task => 
    task.name.toLowerCase().includes(lowerSearch) ||
    task.description.toLowerCase().includes(lowerSearch) ||
    task.category.toLowerCase().includes(lowerSearch) ||
    task.label.toLowerCase().includes(lowerSearch) ||
    (task.typicalCompanies && task.typicalCompanies.some(company => 
      company.toLowerCase().includes(lowerSearch)
    ))
  );
}