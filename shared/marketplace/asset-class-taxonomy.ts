/**
 * Universal asset class taxonomy for the Deal Marketplace.
 *
 * Covers commercial real estate (CRE), operating businesses, franchises,
 * and note sales. Used by the marketplace UI for filters, by ingestion
 * adapters for normalization, and by the broker subscription system to
 * match brokers to user interests.
 */

export type ListingCategory =
  | "cre_property"
  | "operating_business"
  | "mixed_use_with_business"
  | "franchise"
  | "note_sale";

export type AssetClassGroup =
  // CRE groups
  | "marina_waterfront"
  | "hospitality"
  | "multifamily"
  | "office"
  | "retail"
  | "industrial"
  | "self_storage"
  | "land"
  | "specialty_cre"
  // Business groups
  | "food_beverage"
  | "retail_business"
  | "services"
  | "tech_saas"
  | "ecommerce"
  | "manufacturing"
  | "distribution_logistics"
  | "healthcare_business"
  | "automotive_business"
  | "education"
  | "entertainment_recreation"
  | "construction_trades"
  | "professional_services"
  | "personal_care"
  // Franchise/notes
  | "franchise"
  | "note_sale";

export interface AssetClassEntry {
  id: string;
  label: string;
  category: ListingCategory;
  group: AssetClassGroup;
  synonyms: string[];
  /** Metric keys that are typically meaningful for filters on this asset class. */
  typicalMetrics: string[];
}

const CRE_METRICS_BASE = ["asking_price", "cap_rate", "noi", "occupancy", "sqft", "year_built"];
const BUSINESS_METRICS_BASE = [
  "asking_price",
  "annual_revenue",
  "annual_cashflow_sde",
  "annual_ebitda",
  "year_established",
  "employee_count",
];

export const ASSET_CLASSES: AssetClassEntry[] = [
  // ──────────────────────────────────────────────────────────────────────
  // CRE — Marina / Waterfront
  // ──────────────────────────────────────────────────────────────────────
  { id: "marina", label: "Marina", category: "cre_property", group: "marina_waterfront", synonyms: ["wet slip marina", "boat marina"], typicalMetrics: [...CRE_METRICS_BASE, "total_slips", "wet_slips", "dry_storage_spaces", "water_frontage"] },
  { id: "yacht_club", label: "Yacht Club", category: "cre_property", group: "marina_waterfront", synonyms: ["sailing club"], typicalMetrics: [...CRE_METRICS_BASE, "total_slips", "membership_count"] },
  { id: "boatyard", label: "Boatyard", category: "cre_property", group: "marina_waterfront", synonyms: ["boat repair yard"], typicalMetrics: [...CRE_METRICS_BASE, "lift_capacity_tons"] },
  { id: "dry_storage_facility", label: "Dry Boat Storage", category: "cre_property", group: "marina_waterfront", synonyms: ["rack storage"], typicalMetrics: [...CRE_METRICS_BASE, "dry_storage_spaces"] },
  { id: "waterfront_resort", label: "Waterfront Resort", category: "cre_property", group: "marina_waterfront", synonyms: [], typicalMetrics: [...CRE_METRICS_BASE, "room_count", "adr", "revpar"] },

  // ──────────────────────────────────────────────────────────────────────
  // CRE — Hospitality
  // ──────────────────────────────────────────────────────────────────────
  { id: "hotel_full_service", label: "Full-Service Hotel", category: "cre_property", group: "hospitality", synonyms: ["upscale hotel"], typicalMetrics: [...CRE_METRICS_BASE, "room_count", "adr", "revpar", "flag"] },
  { id: "hotel_limited_service", label: "Limited-Service Hotel", category: "cre_property", group: "hospitality", synonyms: ["select service hotel"], typicalMetrics: [...CRE_METRICS_BASE, "room_count", "adr", "revpar"] },
  { id: "hotel_boutique", label: "Boutique Hotel", category: "cre_property", group: "hospitality", synonyms: [], typicalMetrics: [...CRE_METRICS_BASE, "room_count", "adr"] },
  { id: "extended_stay", label: "Extended Stay", category: "cre_property", group: "hospitality", synonyms: [], typicalMetrics: [...CRE_METRICS_BASE, "room_count"] },
  { id: "resort", label: "Resort", category: "cre_property", group: "hospitality", synonyms: [], typicalMetrics: [...CRE_METRICS_BASE, "room_count", "adr", "amenities"] },
  { id: "str_portfolio", label: "Short-Term Rental Portfolio", category: "cre_property", group: "hospitality", synonyms: ["airbnb portfolio", "vacation rental"], typicalMetrics: [...CRE_METRICS_BASE, "unit_count", "adr", "occupancy"] },
  { id: "rv_park", label: "RV Park / Campground", category: "cre_property", group: "hospitality", synonyms: ["campground"], typicalMetrics: [...CRE_METRICS_BASE, "site_count"] },

  // ──────────────────────────────────────────────────────────────────────
  // CRE — Multifamily
  // ──────────────────────────────────────────────────────────────────────
  { id: "apartment_garden", label: "Garden Apartments", category: "cre_property", group: "multifamily", synonyms: [], typicalMetrics: [...CRE_METRICS_BASE, "unit_count"] },
  { id: "apartment_midrise", label: "Mid-Rise Apartments", category: "cre_property", group: "multifamily", synonyms: [], typicalMetrics: [...CRE_METRICS_BASE, "unit_count"] },
  { id: "apartment_highrise", label: "High-Rise Apartments", category: "cre_property", group: "multifamily", synonyms: [], typicalMetrics: [...CRE_METRICS_BASE, "unit_count"] },
  { id: "student_housing", label: "Student Housing", category: "cre_property", group: "multifamily", synonyms: [], typicalMetrics: [...CRE_METRICS_BASE, "bed_count"] },
  { id: "senior_housing", label: "Senior Housing", category: "cre_property", group: "multifamily", synonyms: ["independent living"], typicalMetrics: [...CRE_METRICS_BASE, "unit_count"] },
  { id: "assisted_living", label: "Assisted Living", category: "cre_property", group: "multifamily", synonyms: [], typicalMetrics: [...CRE_METRICS_BASE, "bed_count"] },
  { id: "manufactured_home_park", label: "Manufactured Home Park", category: "cre_property", group: "multifamily", synonyms: ["mobile home park", "MHP"], typicalMetrics: [...CRE_METRICS_BASE, "pad_count"] },

  // ──────────────────────────────────────────────────────────────────────
  // CRE — Office
  // ──────────────────────────────────────────────────────────────────────
  { id: "office_class_a", label: "Class A Office", category: "cre_property", group: "office", synonyms: [], typicalMetrics: CRE_METRICS_BASE },
  { id: "office_class_b", label: "Class B Office", category: "cre_property", group: "office", synonyms: [], typicalMetrics: CRE_METRICS_BASE },
  { id: "office_class_c", label: "Class C Office", category: "cre_property", group: "office", synonyms: [], typicalMetrics: CRE_METRICS_BASE },
  { id: "medical_office", label: "Medical Office", category: "cre_property", group: "office", synonyms: ["MOB"], typicalMetrics: CRE_METRICS_BASE },
  { id: "office_flex", label: "Flex Office", category: "cre_property", group: "office", synonyms: [], typicalMetrics: CRE_METRICS_BASE },
  { id: "coworking", label: "Coworking", category: "cre_property", group: "office", synonyms: [], typicalMetrics: [...CRE_METRICS_BASE, "desk_count"] },

  // ──────────────────────────────────────────────────────────────────────
  // CRE — Retail
  // ──────────────────────────────────────────────────────────────────────
  { id: "shopping_center_strip", label: "Strip Center", category: "cre_property", group: "retail", synonyms: [], typicalMetrics: CRE_METRICS_BASE },
  { id: "shopping_center_neighborhood", label: "Neighborhood Center", category: "cre_property", group: "retail", synonyms: [], typicalMetrics: CRE_METRICS_BASE },
  { id: "shopping_center_power", label: "Power Center", category: "cre_property", group: "retail", synonyms: [], typicalMetrics: CRE_METRICS_BASE },
  { id: "shopping_mall", label: "Regional Mall", category: "cre_property", group: "retail", synonyms: [], typicalMetrics: CRE_METRICS_BASE },
  { id: "single_tenant_nnn", label: "Single Tenant NNN", category: "cre_property", group: "retail", synonyms: ["triple net", "STNL"], typicalMetrics: [...CRE_METRICS_BASE, "lease_term_remaining"] },
  { id: "restaurant_property", label: "Restaurant Property", category: "cre_property", group: "retail", synonyms: [], typicalMetrics: CRE_METRICS_BASE },
  { id: "convenience_store_property", label: "C-Store / Gas Station Property", category: "cre_property", group: "retail", synonyms: ["gas station"], typicalMetrics: CRE_METRICS_BASE },

  // ──────────────────────────────────────────────────────────────────────
  // CRE — Industrial
  // ──────────────────────────────────────────────────────────────────────
  { id: "warehouse", label: "Warehouse", category: "cre_property", group: "industrial", synonyms: [], typicalMetrics: [...CRE_METRICS_BASE, "clear_height", "dock_doors"] },
  { id: "distribution_center", label: "Distribution Center", category: "cre_property", group: "industrial", synonyms: [], typicalMetrics: [...CRE_METRICS_BASE, "clear_height", "dock_doors"] },
  { id: "manufacturing_facility", label: "Manufacturing Facility", category: "cre_property", group: "industrial", synonyms: [], typicalMetrics: [...CRE_METRICS_BASE, "power_capacity"] },
  { id: "cold_storage", label: "Cold Storage", category: "cre_property", group: "industrial", synonyms: ["refrigerated warehouse"], typicalMetrics: [...CRE_METRICS_BASE, "cubic_feet"] },
  { id: "data_center", label: "Data Center", category: "cre_property", group: "industrial", synonyms: [], typicalMetrics: [...CRE_METRICS_BASE, "power_capacity_mw"] },
  { id: "industrial_outdoor_storage", label: "Industrial Outdoor Storage (IOS)", category: "cre_property", group: "industrial", synonyms: ["IOS"], typicalMetrics: [...CRE_METRICS_BASE, "lot_size_acres"] },

  // ──────────────────────────────────────────────────────────────────────
  // CRE — Self-Storage / Land / Specialty
  // ──────────────────────────────────────────────────────────────────────
  { id: "self_storage_facility", label: "Self-Storage Facility", category: "cre_property", group: "self_storage", synonyms: ["mini storage"], typicalMetrics: [...CRE_METRICS_BASE, "unit_count", "rentable_sqft"] },
  { id: "land_development", label: "Development Land", category: "cre_property", group: "land", synonyms: [], typicalMetrics: ["asking_price", "lot_size_acres", "zoning"] },
  { id: "land_agricultural", label: "Agricultural Land", category: "cre_property", group: "land", synonyms: ["farmland"], typicalMetrics: ["asking_price", "lot_size_acres"] },
  { id: "parking_facility", label: "Parking Facility", category: "cre_property", group: "specialty_cre", synonyms: ["parking garage"], typicalMetrics: [...CRE_METRICS_BASE, "space_count"] },
  { id: "car_wash_property", label: "Car Wash Property", category: "cre_property", group: "specialty_cre", synonyms: [], typicalMetrics: CRE_METRICS_BASE },
  { id: "religious_facility", label: "Religious Facility", category: "cre_property", group: "specialty_cre", synonyms: ["church"], typicalMetrics: CRE_METRICS_BASE },

  // ──────────────────────────────────────────────────────────────────────
  // Operating Businesses — Food & Beverage
  // ──────────────────────────────────────────────────────────────────────
  { id: "biz_restaurant", label: "Restaurant", category: "operating_business", group: "food_beverage", synonyms: [], typicalMetrics: [...BUSINESS_METRICS_BASE, "seating_capacity"] },
  { id: "biz_bar", label: "Bar / Tavern", category: "operating_business", group: "food_beverage", synonyms: ["pub"], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_coffee_shop", label: "Coffee Shop", category: "operating_business", group: "food_beverage", synonyms: ["cafe"], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_brewery", label: "Brewery", category: "operating_business", group: "food_beverage", synonyms: ["microbrewery"], typicalMetrics: [...BUSINESS_METRICS_BASE, "annual_barrel_production"] },
  { id: "biz_winery", label: "Winery", category: "operating_business", group: "food_beverage", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_food_truck", label: "Food Truck", category: "operating_business", group: "food_beverage", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_catering", label: "Catering", category: "operating_business", group: "food_beverage", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },

  // ──────────────────────────────────────────────────────────────────────
  // Operating Businesses — Retail
  // ──────────────────────────────────────────────────────────────────────
  { id: "biz_convenience_store", label: "Convenience Store", category: "operating_business", group: "retail_business", synonyms: ["c-store"], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_liquor_store", label: "Liquor Store", category: "operating_business", group: "retail_business", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_gas_station", label: "Gas Station", category: "operating_business", group: "retail_business", synonyms: [], typicalMetrics: [...BUSINESS_METRICS_BASE, "fuel_volume_gallons"] },
  { id: "biz_smoke_shop", label: "Smoke / Vape Shop", category: "operating_business", group: "retail_business", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_apparel", label: "Apparel / Clothing Store", category: "operating_business", group: "retail_business", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_grocery", label: "Grocery / Specialty Food", category: "operating_business", group: "retail_business", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },

  // ──────────────────────────────────────────────────────────────────────
  // Operating Businesses — Services
  // ──────────────────────────────────────────────────────────────────────
  { id: "biz_landscaping", label: "Landscaping", category: "operating_business", group: "services", synonyms: ["lawn care"], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_cleaning", label: "Cleaning Service", category: "operating_business", group: "services", synonyms: ["janitorial"], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_pest_control", label: "Pest Control", category: "operating_business", group: "services", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_security", label: "Security Services", category: "operating_business", group: "services", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_pool_service", label: "Pool Service", category: "operating_business", group: "services", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_event_rental", label: "Event Rental", category: "operating_business", group: "services", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },

  // ──────────────────────────────────────────────────────────────────────
  // Tech / SaaS / Ecommerce
  // ──────────────────────────────────────────────────────────────────────
  { id: "biz_saas", label: "SaaS Business", category: "operating_business", group: "tech_saas", synonyms: ["software"], typicalMetrics: [...BUSINESS_METRICS_BASE, "mrr", "arr", "churn_rate"] },
  { id: "biz_mobile_app", label: "Mobile App", category: "operating_business", group: "tech_saas", synonyms: [], typicalMetrics: [...BUSINESS_METRICS_BASE, "mau", "dau"] },
  { id: "biz_content_site", label: "Content Site / Blog", category: "operating_business", group: "tech_saas", synonyms: [], typicalMetrics: [...BUSINESS_METRICS_BASE, "monthly_pageviews"] },
  { id: "biz_ecommerce_dtc", label: "DTC E-commerce", category: "operating_business", group: "ecommerce", synonyms: ["shopify store"], typicalMetrics: [...BUSINESS_METRICS_BASE, "monthly_orders", "aov"] },
  { id: "biz_amazon_fba", label: "Amazon FBA", category: "operating_business", group: "ecommerce", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_marketplace", label: "Online Marketplace", category: "operating_business", group: "ecommerce", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },

  // ──────────────────────────────────────────────────────────────────────
  // Manufacturing / Distribution
  // ──────────────────────────────────────────────────────────────────────
  { id: "biz_manufacturing", label: "Manufacturing Business", category: "operating_business", group: "manufacturing", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_food_manufacturing", label: "Food Manufacturing", category: "operating_business", group: "manufacturing", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_distribution", label: "Wholesale Distribution", category: "operating_business", group: "distribution_logistics", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_trucking", label: "Trucking / Logistics", category: "operating_business", group: "distribution_logistics", synonyms: [], typicalMetrics: [...BUSINESS_METRICS_BASE, "fleet_size"] },

  // ──────────────────────────────────────────────────────────────────────
  // Healthcare / Auto / Education / Entertainment
  // ──────────────────────────────────────────────────────────────────────
  { id: "biz_dental_practice", label: "Dental Practice", category: "operating_business", group: "healthcare_business", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_medical_practice", label: "Medical Practice", category: "operating_business", group: "healthcare_business", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_veterinary", label: "Veterinary Clinic", category: "operating_business", group: "healthcare_business", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_home_health", label: "Home Health / Care", category: "operating_business", group: "healthcare_business", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_auto_repair", label: "Auto Repair", category: "operating_business", group: "automotive_business", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_auto_dealer", label: "Auto Dealer", category: "operating_business", group: "automotive_business", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_car_wash", label: "Car Wash", category: "operating_business", group: "automotive_business", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_daycare", label: "Daycare / Child Care", category: "operating_business", group: "education", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_tutoring", label: "Tutoring / Education", category: "operating_business", group: "education", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_gym", label: "Gym / Fitness", category: "operating_business", group: "entertainment_recreation", synonyms: ["fitness studio"], typicalMetrics: [...BUSINESS_METRICS_BASE, "member_count"] },
  { id: "biz_yoga_studio", label: "Yoga / Pilates Studio", category: "operating_business", group: "entertainment_recreation", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_bowling_alley", label: "Bowling Alley", category: "operating_business", group: "entertainment_recreation", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_golf_course", label: "Golf Course", category: "operating_business", group: "entertainment_recreation", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },

  // ──────────────────────────────────────────────────────────────────────
  // Construction / Pro Services / Personal Care
  // ──────────────────────────────────────────────────────────────────────
  { id: "biz_general_contractor", label: "General Contractor", category: "operating_business", group: "construction_trades", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_hvac", label: "HVAC", category: "operating_business", group: "construction_trades", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_plumbing", label: "Plumbing", category: "operating_business", group: "construction_trades", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_electrical", label: "Electrical Contractor", category: "operating_business", group: "construction_trades", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_roofing", label: "Roofing", category: "operating_business", group: "construction_trades", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_law_firm", label: "Law Firm", category: "operating_business", group: "professional_services", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_accounting_firm", label: "Accounting / CPA Firm", category: "operating_business", group: "professional_services", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_insurance_agency", label: "Insurance Agency", category: "operating_business", group: "professional_services", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_marketing_agency", label: "Marketing / Ad Agency", category: "operating_business", group: "professional_services", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_salon", label: "Hair Salon / Barbershop", category: "operating_business", group: "personal_care", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_spa", label: "Spa / Med Spa", category: "operating_business", group: "personal_care", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_nail_salon", label: "Nail Salon", category: "operating_business", group: "personal_care", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "biz_tanning", label: "Tanning Salon", category: "operating_business", group: "personal_care", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },

  // ──────────────────────────────────────────────────────────────────────
  // Franchise & Note Sales
  // ──────────────────────────────────────────────────────────────────────
  { id: "franchise_qsr", label: "QSR Franchise", category: "franchise", group: "franchise", synonyms: ["fast food franchise"], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "franchise_fitness", label: "Fitness Franchise", category: "franchise", group: "franchise", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "franchise_services", label: "Service Franchise", category: "franchise", group: "franchise", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "franchise_retail", label: "Retail Franchise", category: "franchise", group: "franchise", synonyms: [], typicalMetrics: BUSINESS_METRICS_BASE },
  { id: "note_performing", label: "Performing Note", category: "note_sale", group: "note_sale", synonyms: [], typicalMetrics: ["asking_price", "upb", "interest_rate", "ltv"] },
  { id: "note_non_performing", label: "Non-Performing Note", category: "note_sale", group: "note_sale", synonyms: ["NPL"], typicalMetrics: ["asking_price", "upb", "ltv"] },
];

export const ASSET_CLASS_BY_ID: Record<string, AssetClassEntry> = Object.fromEntries(
  ASSET_CLASSES.map((entry) => [entry.id, entry]),
);

export const ASSET_CLASS_GROUPS: Record<AssetClassGroup, string> = {
  marina_waterfront: "Marina & Waterfront",
  hospitality: "Hospitality",
  multifamily: "Multifamily",
  office: "Office",
  retail: "Retail",
  industrial: "Industrial",
  self_storage: "Self-Storage",
  land: "Land",
  specialty_cre: "Specialty CRE",
  food_beverage: "Food & Beverage",
  retail_business: "Retail Businesses",
  services: "Services",
  tech_saas: "Tech / SaaS",
  ecommerce: "E-commerce",
  manufacturing: "Manufacturing",
  distribution_logistics: "Distribution & Logistics",
  healthcare_business: "Healthcare",
  automotive_business: "Automotive",
  education: "Education",
  entertainment_recreation: "Entertainment & Recreation",
  construction_trades: "Construction & Trades",
  professional_services: "Professional Services",
  personal_care: "Personal Care",
  franchise: "Franchise",
  note_sale: "Note Sales",
};

export const LISTING_CATEGORIES: Record<ListingCategory, string> = {
  cre_property: "Commercial Real Estate",
  operating_business: "Operating Business",
  mixed_use_with_business: "Mixed-Use (RE + Business)",
  franchise: "Franchise",
  note_sale: "Note Sale",
};

export function getAssetClassesByCategory(category: ListingCategory): AssetClassEntry[] {
  return ASSET_CLASSES.filter((c) => c.category === category);
}

export function getAssetClassesByGroup(group: AssetClassGroup): AssetClassEntry[] {
  return ASSET_CLASSES.filter((c) => c.group === group);
}

/**
 * Best-effort classification from a free-text label produced by a scraper.
 * Returns the matched asset class id, or null if no confident match.
 */
export function classifyFromText(text: string): string | null {
  if (!text) return null;
  const normalized = text.toLowerCase().trim();
  for (const entry of ASSET_CLASSES) {
    if (normalized === entry.id || normalized === entry.label.toLowerCase()) return entry.id;
    for (const syn of entry.synonyms) {
      if (normalized.includes(syn.toLowerCase())) return entry.id;
    }
  }
  // Loose contains check on label
  for (const entry of ASSET_CLASSES) {
    if (normalized.includes(entry.label.toLowerCase())) return entry.id;
  }
  return null;
}
