import { z } from "zod";

// Enum types for the OM report
export const propertyTypeEnum = z.enum([
  "multifamily",
  "office", 
  "retail",
  "industrial",
  "mixed_use",
  "hotel",
  "land",
  "other"
]);

export const unitTypeEnum = z.enum([
  "studio",
  "1br",
  "2br", 
  "3br",
  "4br",
  "commercial",
  "parking",
  "storage"
]);

export const salesCompTypeEnum = z.enum([
  "direct",
  "comparable",
  "superior",
  "inferior"
]);

// Address Schema
export const addressSchema = z.object({
  street: z.string(),
  city: z.string(), 
  state: z.string(),
  zipCode: z.string(),
  county: z.string().optional(),
  country: z.string().default("United States"),
});

// Property Details Schema  
export const propertySchema = z.object({
  name: z.string(),
  address: addressSchema,
  propertyType: propertyTypeEnum,
  yearBuilt: z.number().int().min(1800).max(2030),
  totalUnits: z.number().int().min(0),
  totalSqFt: z.number().min(0),
  lotSize: z.number().min(0), // in acres
  stories: z.number().int().min(1).max(100),
  parkingSpaces: z.number().int().min(0).optional(),
  elevators: z.number().int().min(0).optional(),
});

// Financial Information Schema
export const financialSchema = z.object({
  askingPrice: z.number().min(0),
  pricePerSqFt: z.number().min(0),
  pricePerUnit: z.number().min(0).optional(),
  currentNOI: z.number(),
  proFormaNOI: z.number().optional(),
  capRate: z.number().min(0).max(100), // percentage
  grossYield: z.number().min(0).max(100).optional(),
  occupancy: z.number().min(0).max(100), // percentage
  averageRent: z.number().min(0).optional(),
  rentPSF: z.number().min(0).optional(),
});

// Unit Mix Schema
export const unitMixSchema = z.object({
  unitType: unitTypeEnum,
  count: z.number().int().min(0),
  avgSqFt: z.number().min(0),
  avgRent: z.number().min(0),
  occupancy: z.number().min(0).max(100), // percentage
});

// Rent Roll Entry Schema
export const rentRollEntrySchema = z.object({
  unit: z.string(),
  unitType: unitTypeEnum,
  sqFt: z.number().min(0),
  tenant: z.string(),
  leaseStart: z.string().datetime(),
  leaseEnd: z.string().datetime(),
  currentRent: z.number().min(0),
  marketRent: z.number().min(0),
  securityDeposit: z.number().min(0).optional(),
  occupied: z.boolean(),
});

// Sales Comparable Schema
export const salesComparableSchema = z.object({
  address: z.string(),
  distance: z.number().min(0), // miles from subject
  saleDate: z.string(),
  salePrice: z.number().min(0),
  sqFt: z.number().min(0),
  pricePerSqFt: z.number().min(0),
  units: z.number().int().min(0).optional(),
  pricePerUnit: z.number().min(0).optional(),
  yearBuilt: z.number().int().min(1800).max(2030),
  capRate: z.number().min(0).max(100).optional(),
  compType: salesCompTypeEnum,
  notes: z.string().optional(),
});

// Investment Highlights Schema
export const investmentHighlightSchema = z.object({
  title: z.string(),
  description: z.string(),
  icon: z.string().optional(),
  priority: z.number().int().min(1).max(10).default(5),
});

// Location & Market Schema
export const locationMarketSchema = z.object({
  neighborhood: z.string(),
  walkScore: z.number().int().min(0).max(100).optional(),
  transitScore: z.number().int().min(0).max(100).optional(),
  schoolRating: z.number().int().min(1).max(10).optional(),
  medianHouseholdIncome: z.number().min(0).optional(),
  populationGrowth: z.number().optional(), // percentage
  unemploymentRate: z.number().min(0).max(100).optional(),
  majorEmployers: z.array(z.string()).optional(),
  nearbyAmenities: z.array(z.string()).optional(),
  publicTransportation: z.array(z.string()).optional(),
});

// Photo/Image Schema
export const imageSchema = z.object({
  url: z.string().url(),
  caption: z.string(),
  category: z.enum(["exterior", "interior", "amenity", "neighborhood", "aerial", "floorplan"]),
  order: z.number().int().min(0).default(0),
});

// Contact Information Schema
export const contactSchema = z.object({
  name: z.string(),
  title: z.string(),
  company: z.string(),
  phone: z.string(),
  email: z.string().email(),
  license: z.string().optional(),
  photo: z.string().url().optional(),
});

// Offering Terms Schema
export const offeringTermsSchema = z.object({
  offeringType: z.enum(["sale", "lease", "joint_venture", "ground_lease"]),
  listingPrice: z.number().min(0),
  brokerCommission: z.number().min(0).max(100).optional(), // percentage
  earnestMoney: z.number().min(0).optional(),
  dueDiligencePeriod: z.number().int().min(0).optional(), // days
  closingPeriod: z.number().int().min(0).optional(), // days
  possessionDate: z.string().optional(),
  financing: z.string().optional(),
  specialTerms: z.array(z.string()).optional(),
});

// Main Offering Memorandum Schema
export const offeringMemorandumSchema = z.object({
  // Metadata
  id: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  dateCreated: z.string().datetime(),
  lastUpdated: z.string().datetime(),
  brokerCompany: z.string(),
  brokerLicense: z.string().optional(),
  
  // Property Information
  property: propertySchema,
  financial: financialSchema,
  unitMix: z.array(unitMixSchema),
  rentRoll: z.array(rentRollEntrySchema),
  
  // Investment Details
  investmentHighlights: z.array(investmentHighlightSchema),
  executiveSummary: z.string(),
  locationMarket: locationMarketSchema,
  
  // Comparables & Analysis
  salesComparables: z.array(salesComparableSchema),
  
  // Media
  images: z.array(imageSchema),
  
  // Offering Details
  offeringTerms: offeringTermsSchema,
  
  // Contact Information
  listingAgents: z.array(contactSchema),
  
  // Additional Sections
  propertyDescription: z.string(),
  marketOverview: z.string().optional(),
  financialAnalysis: z.string().optional(),
  riskFactors: z.array(z.string()).optional(),
  disclaimers: z.string().optional(),
  
  // Report Configuration
  accentColor: z.enum(["emerald", "blue"]).default("emerald"),
  pageSize: z.enum(["letter", "a4"]).default("letter"),
  includeSensitiveData: z.boolean().default(true),
});

// Type exports
export type PropertyType = z.infer<typeof propertyTypeEnum>;
export type UnitType = z.infer<typeof unitTypeEnum>;
export type SalesCompType = z.infer<typeof salesCompTypeEnum>;
export type Address = z.infer<typeof addressSchema>;
export type Property = z.infer<typeof propertySchema>;
export type Financial = z.infer<typeof financialSchema>;
export type UnitMix = z.infer<typeof unitMixSchema>;
export type RentRollEntry = z.infer<typeof rentRollEntrySchema>;
export type SalesComparable = z.infer<typeof salesComparableSchema>;
export type InvestmentHighlight = z.infer<typeof investmentHighlightSchema>;
export type LocationMarket = z.infer<typeof locationMarketSchema>;
export type Image = z.infer<typeof imageSchema>;
export type Contact = z.infer<typeof contactSchema>;
export type OfferingTerms = z.infer<typeof offeringTermsSchema>;
export type OfferingMemorandum = z.infer<typeof offeringMemorandumSchema>;

// Helper schemas for forms
export const createOfferingMemorandumSchema = offeringMemorandumSchema.omit({
  id: true,
  dateCreated: true,
  lastUpdated: true,
});

export type CreateOfferingMemorandum = z.infer<typeof createOfferingMemorandumSchema>;

// Validation helpers
export const validateOM = (data: unknown): OfferingMemorandum => {
  return offeringMemorandumSchema.parse(data);
};

export const validateCreateOM = (data: unknown): CreateOfferingMemorandum => {
  return createOfferingMemorandumSchema.parse(data);
};

export default offeringMemorandumSchema;