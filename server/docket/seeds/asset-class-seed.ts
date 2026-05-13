import { db } from "../db";
import { assetClassConfigs, userAssetSubscriptions, articles, rssSources, aiKeywordWeights, aiSourceAdjustments, aiLearningRules, articleRemovalPatterns, articleFeedback } from "@shared/docket-schema";
import { users } from "@shared/docket-schema";
import { eq, isNull } from "drizzle-orm";

// Generic helper: upsert an asset class config by slug
async function upsertAssetClass(config: typeof assetClassConfigs.$inferInsert): Promise<number> {
  const existing = await db.select({ id: assetClassConfigs.id })
    .from(assetClassConfigs)
    .where(eq(assetClassConfigs.slug, config.slug!))
    .limit(1);
  if (existing.length > 0) {
    console.log(`[Asset Class Seed] ${config.displayName} already exists (id: ${existing[0].id}), skipping.`);
    return existing[0].id;
  }
  const [inserted] = await db.insert(assetClassConfigs).values(config).returning({ id: assetClassConfigs.id });
  console.log(`[Asset Class Seed] Created ${config.displayName} (id: ${inserted.id})`);
  return inserted.id;
}

const COMMON_CATEGORIES = [
  "Macro", "M&A", "Development", "Operations", "Regulatory",
  "Environmental", "Technology", "Insurance", "Legal",
  "People Moves", "Company Earnings", "Awards",
  "Business Planning", "Industry Trends", "General"
];

const COMMON_CATEGORY_DEFINITIONS = {
  "Macro": "Federal Reserve, interest rates, inflation, economic indicators, GDP, SOFR",
  "M&A": "Mergers, acquisitions, buyouts, deals, transactions, portfolio sales",
  "Development": "Construction, renovation, permitting, zoning, ground-up development",
  "Operations": "Day-to-day operations, management, staffing, technology systems",
  "Regulatory": "Government regulations, compliance, zoning laws, permits, legislation",
  "Environmental": "Climate change, sustainability, environmental compliance, resilience",
  "Technology": "PropTech, AI, IoT, digital platforms, smart building tech",
  "Insurance": "Insurance coverage, risk management, liability, claims",
  "Legal": "Legal disputes, lawsuits, litigation, compliance requirements",
  "People Moves": "Executive appointments, hirings, promotions, retirements",
  "Company Earnings": "Quarterly earnings, financial results, revenue reports",
  "Awards": "Industry awards, recognition, honors, achievements",
  "Business Planning": "Strategic planning, expansion plans, growth strategy, fundraising",
  "Industry Trends": "Market analysis, forecasts, research studies, cap rate surveys",
  "General": "Articles that don't clearly fit other categories"
};

export async function seedMarinaAssetClass() {
  console.log("[Asset Class Seed] Starting marina config seed...");

  const existing = await db.select().from(assetClassConfigs).where(eq(assetClassConfigs.slug, "marina")).limit(1);

  let marinaConfigId: number;

  if (existing.length > 0) {
    marinaConfigId = existing[0].id;
    console.log(`[Asset Class Seed] Marina config already exists (id: ${marinaConfigId}), skipping insert.`);
  } else {
    const [inserted] = await db.insert(assetClassConfigs).values({
      slug: "marina",
      displayName: "Marina",
      icon: "anchor",
      color: "#1B3A5C",
      isActive: true,
      requiredKeywords: [
        "marina", "marina for sale", "marina broker", "property investment", "marina operations",
        "marinas for sale", "properties", "boat sales", "private equity in marinas", "boat slip",
        "dry stack", "yacht club", "boatyard", "superyacht marina", "megayacht", "dockage",
        "storage", "marine industry", "marina operator", "marina owner", "marina management"
      ],
      scoringTerms: {
        vertical: {
          marina: 8, boat: 8, boating: 8, slip: 8, "dry stack": 8,
          dock: 8, "fuel dock": 8, harbor: 8, moorage: 8, berth: 8,
          yacht: 8, nautical: 8, outboard: 8, inboard: 8,
          haul: 8, launch: 8, dockmaster: 8, superyacht: 8,
          megayacht: 8, pontoon: 8, jetty: 8, wharf: 8,
          anchorage: 8, boatyard: 8, shipyard: 8, waterfront: 8, sailing: 8
        },
        verticalWeightCap: 40,
        verticalWeightEach: 8
      },
      excludeKeywords: ["cruise ship", "cargo", "container", "oil rig", "commercial vessel"],
      sourceMatchRegex: "marina|boating|dock|yacht|maritime|superyacht",
      aiSystemPrompt: "You are an expert in the marina and marine industry. Analyze this article and assign 1-4 most relevant categories. Focus on recreational boating, marina operations, yacht/boat sales, marine infrastructure, and waterfront investment.",
      categories: [
        "Marina Sale", "Boat Sales", "Boat Show", "Manufacturing", "Education",
        ...COMMON_CATEGORIES
      ],
      categoryDefinitions: {
        "Marina Sale": "Marina sales, acquisitions, buyouts, purchases, valuations, transaction multiples",
        "Boat Sales": "Boat sales data, brokerage, yacht sales, dealer sales, market trends",
        "Boat Show": "Boat shows, marine trade shows, exhibitions, industry events",
        "Manufacturing": "Boat manufacturing, shipbuilding, production, OEM, factory operations",
        "Education": "Training programs, certifications, courses, marine education, safety",
        ...COMMON_CATEGORY_DEFINITIONS
      },
      baseSourceBonus: 20,
      termWeightCap: 40,
      termWeightEach: 8,
      financialBonus: 10,
      locationBonusTerms: [
        "florida", "california", "mediterranean", "caribbean",
        "bahamas", "monaco", "france", "italy", "spain", "greece"
      ],
      locationBonus: 5,
      topicStatement: "Marina investment, operations, and recreational boating industry intelligence",
      defaultKeywordWeights: {
        marina: { weight: 15, category: "marina" },
        boat: { weight: 10, category: "marina" },
        slip: { weight: 12, category: "marina" },
        dock: { weight: 10, category: "marina" },
        yacht: { weight: 12, category: "marina" },
        harbor: { weight: 8, category: "marina" },
        moorage: { weight: 10, category: "marina" },
        berth: { weight: 10, category: "marina" },
        boatyard: { weight: 12, category: "marina" },
        superyacht: { weight: 15, category: "marina" },
        acquisition: { weight: 12, category: "investment" },
        transaction: { weight: 10, category: "investment" },
        valuation: { weight: 8, category: "investment" },
        "private equity": { weight: 10, category: "investment" },
        investment: { weight: 8, category: "investment" },
        merger: { weight: 10, category: "investment" },
        inflation: { weight: 5, category: "macro" },
        "interest rate": { weight: 6, category: "macro" },
        recession: { weight: 5, category: "macro" },
        hurricane: { weight: 6, category: "macro" },
        operations: { weight: 5, category: "operational" },
        management: { weight: 4, category: "operational" },
        renovation: { weight: 6, category: "operational" },
        regulation: { weight: 5, category: "regulatory" },
        compliance: { weight: 5, category: "regulatory" },
        permit: { weight: 4, category: "regulatory" },
        spam: { weight: -20, category: "negative" },
        advertisement: { weight: -15, category: "negative" },
        "cruise ship": { weight: -10, category: "negative" },
        cargo: { weight: -8, category: "negative" }
      }
    }).returning();

    marinaConfigId = inserted.id;
    console.log(`[Asset Class Seed] Created marina config (id: ${marinaConfigId})`);
  }

  // Backfill articles, sources, AI tables
  await db.update(articles).set({ assetClassId: marinaConfigId }).where(isNull(articles.assetClassId));
  await db.update(rssSources).set({ assetClassId: marinaConfigId }).where(isNull(rssSources.assetClassId));
  await db.update(aiKeywordWeights).set({ assetClassId: marinaConfigId }).where(isNull(aiKeywordWeights.assetClassId));
  await db.update(aiSourceAdjustments).set({ assetClassId: marinaConfigId }).where(isNull(aiSourceAdjustments.assetClassId));
  await db.update(aiLearningRules).set({ assetClassId: marinaConfigId }).where(isNull(aiLearningRules.assetClassId));
  await db.update(articleRemovalPatterns).set({ assetClassId: marinaConfigId }).where(isNull(articleRemovalPatterns.assetClassId));
  await db.update(articleFeedback).set({ assetClassId: marinaConfigId }).where(isNull(articleFeedback.assetClassId));
  console.log(`[Asset Class Seed] Backfilled marina config`);

  // Auto-subscribe all existing Docket users to marina (table may not exist in all deployments)
  try {
    const allUsers = await db.select({ id: users.id }).from(users);
    let subsCreated = 0;
    for (const user of allUsers) {
      try {
        await db.insert(userAssetSubscriptions).values({
          userId: user.id,
          assetClassId: marinaConfigId,
          isPrimary: true,
          showShared: true,
          notificationLevel: "all",
        }).onConflictDoNothing();
        subsCreated++;
      } catch (e) {}
    }
    console.log(`[Asset Class Seed] Subscribed ${subsCreated} users to marina`);
  } catch (e: any) {
    if (e?.code === '42P01') {
      console.log(`[Asset Class Seed] docket_users table not present — skipping user subscription step`);
    } else {
      throw e;
    }
  }
  console.log(`[Asset Class Seed] Complete!`);
  return marinaConfigId;
}

export async function seedMultifamilyAssetClass(): Promise<number> {
  return upsertAssetClass({
    slug: "multifamily",
    displayName: "Multifamily",
    icon: "building-2",
    color: "#2563EB",
    isActive: true,
    requiredKeywords: [
      "apartment", "multifamily", "apartment complex", "apartment community",
      "rental housing", "affordable housing", "NMHC", "NAA",
      "residential investment", "multifamily acquisition", "apartment sale",
      "housing development", "rent roll", "lease-up"
    ],
    scoringTerms: {
      vertical: {
        apartment: 8, multifamily: 8, "apartment complex": 8, "rental housing": 8,
        tenant: 6, "lease-up": 8, "occupancy rate": 6, "affordable housing": 8,
        "workforce housing": 8, "student housing": 8, NMHC: 8, NAA: 8
      },
      verticalWeightCap: 40, verticalWeightEach: 8
    },
    excludeKeywords: ["single family", "for sale by owner", "FSBO", "homeowner"],
    sourceMatchRegex: "apartment|multifamily|residential|housing",
    aiSystemPrompt: "You are an expert in multifamily real estate investment. Analyze this article and assign 1-4 most relevant categories. Focus on apartment acquisitions, rent growth, development pipelines, REIT earnings, and housing policy.",
    categories: ["Acquisition", "Development", "Rent & Leasing", "Policy & Regulatory", "REIT Earnings", ...COMMON_CATEGORIES],
    categoryDefinitions: {
      "Acquisition": "Apartment community acquisitions, portfolio sales, joint ventures",
      "Development": "Multifamily construction, ground-up development, pipeline activity",
      "Rent & Leasing": "Rent growth, concessions, lease-up velocity, occupancy trends",
      "Policy & Regulatory": "Rent control, zoning reform, HUD policy, housing bills",
      "REIT Earnings": "AvalonBay, Equity Residential, MAA, UDR, NMI quarterly results",
      ...COMMON_CATEGORY_DEFINITIONS
    },
    baseSourceBonus: 15, termWeightCap: 40, termWeightEach: 8, financialBonus: 10,
    locationBonusTerms: ["sunbelt", "texas", "florida", "arizona", "georgia", "carolinas", "nashville", "denver"],
    locationBonus: 5,
    topicStatement: "Multifamily real estate investment, development, and operations intelligence",
    defaultKeywordWeights: {
      apartment: { weight: 12, category: "multifamily" },
      multifamily: { weight: 12, category: "multifamily" },
      "affordable housing": { weight: 10, category: "multifamily" },
      "lease-up": { weight: 10, category: "multifamily" },
      acquisition: { weight: 12, category: "investment" },
      "cap rate": { weight: 8, category: "investment" },
      NOI: { weight: 8, category: "investment" }
    }
  });
}

export async function seedSelfStorageAssetClass(): Promise<number> {
  return upsertAssetClass({
    slug: "self_storage",
    displayName: "Self-Storage",
    icon: "warehouse",
    color: "#D97706",
    isActive: true,
    requiredKeywords: [
      "self storage", "self-storage", "storage facility", "public storage",
      "extra space storage", "cubesmart", "life storage", "national storage affiliates",
      "mini storage", "storage unit", "climate controlled storage", "storage acquisition"
    ],
    scoringTerms: {
      vertical: {
        "self storage": 8, "self-storage": 8, "storage facility": 8,
        "storage unit": 6, "mini storage": 8, "climate controlled": 6,
        "public storage": 8, "extra space": 8, cubesmart: 8, "life storage": 8,
        "national storage": 8, "storage reit": 8
      },
      verticalWeightCap: 40, verticalWeightEach: 8
    },
    excludeKeywords: ["boat storage", "vehicle storage", "parking"],
    sourceMatchRegex: "storage|self.?storage",
    aiSystemPrompt: "You are an expert in self-storage real estate investment. Analyze this article and assign 1-4 most relevant categories. Focus on facility acquisitions, development, REIT performance, demand drivers, and operational metrics.",
    categories: ["Acquisition", "Development", "REIT Earnings", "Demand & Supply", ...COMMON_CATEGORIES],
    categoryDefinitions: {
      "Acquisition": "Storage facility acquisitions, portfolio deals, joint ventures",
      "Development": "New facility construction, conversions, expansions",
      "REIT Earnings": "Public Storage, Extra Space, CubeSmart, Life Storage, NSA earnings",
      "Demand & Supply": "Occupancy trends, rental rate movement, market saturation",
      ...COMMON_CATEGORY_DEFINITIONS
    },
    baseSourceBonus: 15, termWeightCap: 40, termWeightEach: 8, financialBonus: 10,
    locationBonusTerms: ["sunbelt", "florida", "texas", "arizona", "california", "southeast"],
    locationBonus: 5,
    topicStatement: "Self-storage real estate investment, acquisitions, and operational intelligence",
    defaultKeywordWeights: {
      "self storage": { weight: 12, category: "self_storage" },
      "storage facility": { weight: 12, category: "self_storage" },
      "public storage": { weight: 10, category: "self_storage" },
      acquisition: { weight: 12, category: "investment" }
    }
  });
}

export async function seedIndustrialAssetClass(): Promise<number> {
  return upsertAssetClass({
    slug: "industrial",
    displayName: "Industrial",
    icon: "factory",
    color: "#64748B",
    isActive: true,
    requiredKeywords: [
      "industrial property", "warehouse", "distribution center", "logistics facility",
      "industrial park", "manufacturing facility", "industrial acquisition",
      "industrial real estate", "cold storage", "fulfillment center", "NAIOP",
      "industrial REIT", "flex industrial", "last mile"
    ],
    scoringTerms: {
      vertical: {
        warehouse: 8, "distribution center": 8, "logistics facility": 8,
        "industrial park": 8, "fulfillment center": 8, "cold storage": 8,
        "flex industrial": 8, "last mile": 8, NAIOP: 8, Prologis: 8,
        "industrial reit": 8, "e-commerce": 6
      },
      verticalWeightCap: 40, verticalWeightEach: 8
    },
    excludeKeywords: [],
    sourceMatchRegex: "industrial|warehouse|logistics|distribution",
    aiSystemPrompt: "You are an expert in industrial real estate investment. Analyze this article and assign 1-4 most relevant categories. Focus on warehouse/distribution acquisitions, e-commerce demand, supply chain dynamics, and REIT performance.",
    categories: ["Acquisition", "Development", "Supply Chain", "REIT Earnings", "E-Commerce", ...COMMON_CATEGORIES],
    categoryDefinitions: {
      "Acquisition": "Industrial property acquisitions, portfolio deals, sale-leasebacks",
      "Development": "Speculative development, build-to-suit, cold storage construction",
      "Supply Chain": "Logistics trends, last-mile delivery, nearshoring, reshoring",
      "REIT Earnings": "Prologis, Duke Realty, STAG, EastGroup quarterly results",
      "E-Commerce": "E-commerce demand drivers, Amazon, Walmart, DHL expansions",
      ...COMMON_CATEGORY_DEFINITIONS
    },
    baseSourceBonus: 15, termWeightCap: 40, termWeightEach: 8, financialBonus: 10,
    locationBonusTerms: ["new jersey", "inland empire", "chicago", "dallas", "atlanta", "pennsylvania"],
    locationBonus: 5,
    topicStatement: "Industrial real estate investment, logistics, and supply chain intelligence",
    defaultKeywordWeights: {
      warehouse: { weight: 12, category: "industrial" },
      "distribution center": { weight: 12, category: "industrial" },
      "fulfillment center": { weight: 12, category: "industrial" },
      acquisition: { weight: 12, category: "investment" }
    }
  });
}

export async function seedRetailAssetClass(): Promise<number> {
  return upsertAssetClass({
    slug: "retail",
    displayName: "Retail",
    icon: "shopping-bag",
    color: "#DC2626",
    isActive: true,
    requiredKeywords: [
      "shopping center", "strip mall", "retail center", "retail property", "retail real estate",
      "ICSC", "grocery anchored", "net lease", "NNN lease", "power center",
      "lifestyle center", "retail acquisition", "open-air center", "anchor tenant"
    ],
    scoringTerms: {
      vertical: {
        "shopping center": 8, "strip mall": 8, "retail center": 8, "grocery anchored": 8,
        "net lease": 8, NNN: 8, "power center": 8, "lifestyle center": 8,
        ICSC: 8, "anchor tenant": 6, "open-air": 8, "retail reit": 8
      },
      verticalWeightCap: 40, verticalWeightEach: 8
    },
    excludeKeywords: ["e-commerce only", "online only"],
    sourceMatchRegex: "retail|shopping|icsc",
    aiSystemPrompt: "You are an expert in retail real estate investment. Analyze this article and assign 1-4 most relevant categories. Focus on shopping center acquisitions, anchor tenant activity, net lease deals, consumer spending trends, and REIT performance.",
    categories: ["Acquisition", "Tenant Activity", "Net Lease", "REIT Earnings", "Consumer Trends", ...COMMON_CATEGORIES],
    categoryDefinitions: {
      "Acquisition": "Shopping center, strip mall, and net lease property acquisitions",
      "Tenant Activity": "Anchor tenant deals, store openings, closures, bankruptcies",
      "Net Lease": "NNN, NN, ground lease transactions and cap rate trends",
      "REIT Earnings": "Regency Centers, Kimco, Agree Realty, Realty Income results",
      "Consumer Trends": "Retail sales data, foot traffic, consumer spending patterns",
      ...COMMON_CATEGORY_DEFINITIONS
    },
    baseSourceBonus: 15, termWeightCap: 40, termWeightEach: 8, financialBonus: 10,
    locationBonusTerms: ["sunbelt", "florida", "texas", "california", "southeast", "midwest"],
    locationBonus: 5,
    topicStatement: "Retail real estate investment, shopping center operations, and consumer intelligence",
    defaultKeywordWeights: {
      "shopping center": { weight: 12, category: "retail" },
      "net lease": { weight: 12, category: "retail" },
      NNN: { weight: 10, category: "retail" },
      acquisition: { weight: 12, category: "investment" }
    }
  });
}

export async function seedHospitalityAssetClass(): Promise<number> {
  return upsertAssetClass({
    slug: "hospitality",
    displayName: "Hotel & Hospitality",
    icon: "hotel",
    color: "#9333EA",
    isActive: true,
    requiredKeywords: [
      "hotel", "hospitality property", "resort", "lodging", "hotel acquisition", "hotel sale",
      "RevPAR", "hotel development", "extended stay", "full-service hotel", "select-service",
      "hotel REIT", "hotel flag", "hotel brand", "franchise agreement", "hotel conversion"
    ],
    scoringTerms: {
      vertical: {
        hotel: 8, hospitality: 8, resort: 8, lodging: 8, RevPAR: 8, ADR: 8,
        "extended stay": 8, "full-service": 8, "select-service": 8,
        "hotel flag": 6, "hotel conversion": 8, "hotel reit": 8
      },
      verticalWeightCap: 40, verticalWeightEach: 8
    },
    excludeKeywords: ["cruise", "airline", "theme park"],
    sourceMatchRegex: "hotel|hospitality|lodging|resort",
    aiSystemPrompt: "You are an expert in hotel and hospitality real estate investment. Analyze this article and assign 1-4 most relevant categories. Focus on hotel acquisitions, RevPAR trends, brand activity, STR market dynamics, and REIT performance.",
    categories: ["Acquisition", "Development", "Brand & Franchise", "Performance Metrics", "REIT Earnings", ...COMMON_CATEGORIES],
    categoryDefinitions: {
      "Acquisition": "Hotel acquisitions, portfolio deals, distressed sales",
      "Development": "New hotel construction, conversions, renovations, PIP requirements",
      "Brand & Franchise": "Brand deals, franchise agreements, flag changes, soft brands",
      "Performance Metrics": "RevPAR, ADR, occupancy trends, STR reports",
      "REIT Earnings": "Host Hotels, Park Hotels, Chatham Lodging, Apple Hospitality results",
      ...COMMON_CATEGORY_DEFINITIONS
    },
    baseSourceBonus: 15, termWeightCap: 40, termWeightEach: 8, financialBonus: 10,
    locationBonusTerms: ["las vegas", "orlando", "miami", "hawaii", "new york", "nashville", "austin"],
    locationBonus: 5,
    topicStatement: "Hotel and hospitality real estate investment, brand, and performance intelligence",
    defaultKeywordWeights: {
      hotel: { weight: 12, category: "hospitality" },
      RevPAR: { weight: 12, category: "hospitality" },
      resort: { weight: 10, category: "hospitality" },
      acquisition: { weight: 12, category: "investment" }
    }
  });
}

export async function seedShortTermRentalAssetClass(): Promise<number> {
  return upsertAssetClass({
    slug: "str",
    displayName: "Short-Term Rental",
    icon: "home",
    color: "#F59E0B",
    isActive: true,
    requiredKeywords: [
      "short-term rental", "short term rental", "STR market", "Airbnb regulation",
      "vacation rental", "VRBO", "OTA regulation", "STR ban", "STR ordinance",
      "vacation rental management", "STR investor", "STR portfolio"
    ],
    scoringTerms: {
      vertical: {
        "short-term rental": 8, "short term rental": 8, "vacation rental": 8,
        Airbnb: 8, VRBO: 8, "STR market": 8, "STR regulation": 8,
        "rental arbitrage": 6, "OTA": 6, "property manager": 4
      },
      verticalWeightCap: 40, verticalWeightEach: 8
    },
    excludeKeywords: [],
    sourceMatchRegex: "airbnb|vrbo|short.?term.?rental|vacation.?rental",
    aiSystemPrompt: "You are an expert in short-term rental real estate investment. Analyze this article and assign 1-4 most relevant categories. Focus on STR regulations, market performance, Airbnb/VRBO policy changes, investor activity, and professional management trends.",
    categories: ["Regulation", "Market Performance", "Platform News", "Investment", ...COMMON_CATEGORIES],
    categoryDefinitions: {
      "Regulation": "STR ordinances, bans, licensing requirements, HOA restrictions",
      "Market Performance": "Occupancy, ADR, RevPAR, demand trends, seasonality",
      "Platform News": "Airbnb, VRBO, Booking.com policy changes, fee structures",
      "Investment": "STR portfolio acquisitions, investor strategies, cap rate trends",
      ...COMMON_CATEGORY_DEFINITIONS
    },
    baseSourceBonus: 15, termWeightCap: 40, termWeightEach: 8, financialBonus: 10,
    locationBonusTerms: ["florida", "hawaii", "colorado", "arizona", "tennessee", "california", "texas"],
    locationBonus: 5,
    topicStatement: "Short-term rental investment, regulation, and market performance intelligence",
    defaultKeywordWeights: {
      "short-term rental": { weight: 12, category: "str" },
      Airbnb: { weight: 12, category: "str" },
      VRBO: { weight: 10, category: "str" },
      regulation: { weight: 10, category: "regulatory" }
    }
  });
}

export async function seedSeniorHousingAssetClass(): Promise<number> {
  return upsertAssetClass({
    slug: "senior_housing",
    displayName: "Senior Housing",
    icon: "heart-handshake",
    color: "#16A34A",
    isActive: true,
    requiredKeywords: [
      "senior housing", "assisted living", "skilled nursing facility", "memory care",
      "senior living community", "healthcare real estate", "medical office building",
      "life sciences real estate", "NIC", "CCRC", "continuing care",
      "senior housing acquisition", "SNF", "AL community"
    ],
    scoringTerms: {
      vertical: {
        "senior housing": 8, "assisted living": 8, "skilled nursing": 8, "memory care": 8,
        "senior living": 8, CCRC: 8, NIC: 8, "medical office": 8, "life sciences": 8,
        "healthcare reit": 8, Welltower: 8, Ventas: 8, "care home": 6
      },
      verticalWeightCap: 40, verticalWeightEach: 8
    },
    excludeKeywords: ["pediatric", "children's hospital", "emergency room"],
    sourceMatchRegex: "senior.hous|assisted.living|skilled.nursing|healthcare.real.estate|medical.office",
    aiSystemPrompt: "You are an expert in senior housing and healthcare real estate investment. Analyze this article and assign 1-4 most relevant categories. Focus on senior housing acquisitions, care operator performance, demographic demand, and healthcare REIT activity.",
    categories: ["Acquisition", "Development", "Operator News", "Demographics", "REIT Earnings", ...COMMON_CATEGORIES],
    categoryDefinitions: {
      "Acquisition": "Senior housing and medical office acquisitions, portfolio deals",
      "Development": "New senior housing construction, conversions, repositioning",
      "Operator News": "Senior care operator expansions, bankruptcies, management changes",
      "Demographics": "Aging population trends, demand projections, supply/demand dynamics",
      "REIT Earnings": "Welltower, Ventas, Healthpeak, CareTrust results",
      ...COMMON_CATEGORY_DEFINITIONS
    },
    baseSourceBonus: 15, termWeightCap: 40, termWeightEach: 8, financialBonus: 10,
    locationBonusTerms: ["florida", "arizona", "california", "texas", "sunbelt", "southeast"],
    locationBonus: 5,
    topicStatement: "Senior housing and healthcare real estate investment and operator intelligence",
    defaultKeywordWeights: {
      "senior housing": { weight: 12, category: "senior_housing" },
      "assisted living": { weight: 12, category: "senior_housing" },
      "memory care": { weight: 10, category: "senior_housing" },
      acquisition: { weight: 12, category: "investment" }
    }
  });
}

export async function seedMobileHomeParkAssetClass(): Promise<number> {
  return upsertAssetClass({
    slug: "mobile_home_park",
    displayName: "Mobile Home Parks",
    icon: "home",
    color: "#78716C",
    isActive: true,
    requiredKeywords: [
      "manufactured housing", "mobile home park", "MHP acquisition", "land lease community",
      "Sun Communities", "Equity LifeStyle", "UDC", "manufactured home", "MHC",
      "mobile home community", "manufactured housing community", "pad rent"
    ],
    scoringTerms: {
      vertical: {
        "manufactured housing": 8, "mobile home park": 8, "land lease community": 8,
        MHP: 8, "Sun Communities": 8, "Equity LifeStyle": 8, UDC: 8,
        "pad rent": 8, "lot rent": 8, "manufactured home": 6, MHC: 8
      },
      verticalWeightCap: 40, verticalWeightEach: 8
    },
    excludeKeywords: ["tiny home", "modular home"],
    sourceMatchRegex: "manufactured.hous|mobile.home.park|land.lease",
    aiSystemPrompt: "You are an expert in manufactured housing and mobile home park real estate investment. Analyze this article and assign 1-4 most relevant categories. Focus on MHP acquisitions, lot rent trends, REIT activity, and housing affordability dynamics.",
    categories: ["Acquisition", "Development", "Affordability & Policy", "REIT Earnings", ...COMMON_CATEGORIES],
    categoryDefinitions: {
      "Acquisition": "Mobile home park acquisitions, portfolio deals, lot purchases",
      "Development": "New MHP development, infrastructure upgrades, expansion",
      "Affordability & Policy": "Tenant protections, rent regulations, zoning, HUD financing",
      "REIT Earnings": "Sun Communities, Equity LifeStyle, UDC quarterly results",
      ...COMMON_CATEGORY_DEFINITIONS
    },
    baseSourceBonus: 15, termWeightCap: 40, termWeightEach: 8, financialBonus: 10,
    locationBonusTerms: ["florida", "arizona", "texas", "michigan", "indiana", "midwest", "sunbelt"],
    locationBonus: 5,
    topicStatement: "Mobile home park and manufactured housing investment and operations intelligence",
    defaultKeywordWeights: {
      "manufactured housing": { weight: 12, category: "mobile_home_park" },
      "mobile home park": { weight: 12, category: "mobile_home_park" },
      "land lease community": { weight: 10, category: "mobile_home_park" },
      acquisition: { weight: 12, category: "investment" }
    }
  });
}

export async function seedCarWashAssetClass(): Promise<number> {
  return upsertAssetClass({
    slug: "car_wash",
    displayName: "Car Wash",
    icon: "droplets",
    color: "#0EA5E9",
    isActive: true,
    requiredKeywords: [
      "car wash", "carwash", "express car wash", "tunnel wash", "ICA",
      "car wash acquisition", "car wash portfolio", "car wash chain",
      "car wash REIT", "Mister Car Wash", "Take 5", "Magnolia Car Wash"
    ],
    scoringTerms: {
      vertical: {
        "car wash": 8, carwash: 8, "express car wash": 8, "tunnel wash": 8,
        "car wash chain": 8, "car wash portfolio": 8, "Mister Car Wash": 8,
        "Take 5": 6, ICA: 6, "unlimited membership": 6
      },
      verticalWeightCap: 40, verticalWeightEach: 8
    },
    excludeKeywords: [],
    sourceMatchRegex: "car.wash|carwash",
    aiSystemPrompt: "You are an expert in car wash real estate and business investment. Analyze this article and assign 1-4 most relevant categories. Focus on car wash acquisitions, chain consolidation, membership model trends, and real estate considerations.",
    categories: ["Acquisition", "Development", "Consolidation", "Operations", ...COMMON_CATEGORIES],
    categoryDefinitions: {
      "Acquisition": "Car wash site and chain acquisitions, portfolio deals",
      "Development": "New car wash construction, site selection, equipment",
      "Consolidation": "PE-backed rollup activity, brand mergers, regional chains",
      "Operations": "Membership models, throughput optimization, labor",
      ...COMMON_CATEGORY_DEFINITIONS
    },
    baseSourceBonus: 15, termWeightCap: 40, termWeightEach: 8, financialBonus: 10,
    locationBonusTerms: ["sunbelt", "florida", "texas", "arizona", "southeast"],
    locationBonus: 5,
    topicStatement: "Car wash real estate and business investment, consolidation, and operations intelligence",
    defaultKeywordWeights: {
      "car wash": { weight: 12, category: "car_wash" },
      carwash: { weight: 12, category: "car_wash" },
      acquisition: { weight: 12, category: "investment" }
    }
  });
}

export async function seedRvParkAssetClass(): Promise<number> {
  return upsertAssetClass({
    slug: "rv_park",
    displayName: "RV Parks & Campgrounds",
    icon: "tent",
    color: "#65A30D",
    isActive: true,
    requiredKeywords: [
      "rv park", "rv resort", "campground acquisition", "outdoor hospitality", "glamping",
      "KOA", "Sun RV", "Equity LifeStyle RV", "campsite", "full hookup",
      "outdoor recreation real estate", "campground portfolio", "RV community"
    ],
    scoringTerms: {
      vertical: {
        "rv park": 8, "rv resort": 8, campground: 8, glamping: 8,
        KOA: 8, "outdoor hospitality": 8, "Sun RV": 8, campsite: 6,
        "full hookup": 6, "outdoor recreation": 6
      },
      verticalWeightCap: 40, verticalWeightEach: 8
    },
    excludeKeywords: [],
    sourceMatchRegex: "rv.park|rv.resort|campground|glamping",
    aiSystemPrompt: "You are an expert in RV park and campground real estate investment. Analyze this article and assign 1-4 most relevant categories. Focus on campground acquisitions, outdoor hospitality trends, glamping development, and investor activity.",
    categories: ["Acquisition", "Development", "Glamping & Trends", "Operations", ...COMMON_CATEGORIES],
    categoryDefinitions: {
      "Acquisition": "RV park and campground acquisitions, portfolio deals",
      "Development": "New campground construction, glamping cabins, amenity upgrades",
      "Glamping & Trends": "Glamping growth, outdoor travel trends, demographic shifts",
      "Operations": "Reservation systems, amenities, seasonal management",
      ...COMMON_CATEGORY_DEFINITIONS
    },
    baseSourceBonus: 15, termWeightCap: 40, termWeightEach: 8, financialBonus: 10,
    locationBonusTerms: ["florida", "texas", "arizona", "colorado", "tennessee", "california", "national parks"],
    locationBonus: 5,
    topicStatement: "RV park, campground, and outdoor hospitality investment and operations intelligence",
    defaultKeywordWeights: {
      "rv park": { weight: 12, category: "rv_park" },
      campground: { weight: 12, category: "rv_park" },
      glamping: { weight: 10, category: "rv_park" },
      acquisition: { weight: 12, category: "investment" }
    }
  });
}

export async function seedOfficeAssetClass(): Promise<number> {
  return upsertAssetClass({
    slug: "office",
    displayName: "Office",
    icon: "briefcase",
    color: "#475569",
    isActive: true,
    requiredKeywords: [
      "office building", "office tower", "office park", "office acquisition", "office market",
      "coworking", "sublease space", "office REIT", "office conversion",
      "return to office", "hybrid work", "office vacancy", "office leasing"
    ],
    scoringTerms: {
      vertical: {
        "office building": 8, "office tower": 8, "office park": 8, coworking: 8,
        "sublease space": 8, "office reit": 8, "office conversion": 8,
        "return to office": 8, "hybrid work": 6, "office vacancy": 8, "office leasing": 8
      },
      verticalWeightCap: 40, verticalWeightEach: 8
    },
    excludeKeywords: [],
    sourceMatchRegex: "office.real.estate|office.reit|office.building",
    aiSystemPrompt: "You are an expert in office real estate investment. Analyze this article and assign 1-4 most relevant categories. Focus on office acquisitions, leasing activity, conversion trends, remote work impacts, and REIT performance.",
    categories: ["Acquisition", "Leasing", "Conversion", "Return to Office", "REIT Earnings", ...COMMON_CATEGORIES],
    categoryDefinitions: {
      "Acquisition": "Office building acquisitions, portfolio deals, distressed sales",
      "Leasing": "Major lease deals, renewals, sublease activity, tenant demand",
      "Conversion": "Office-to-residential, office-to-hotel, adaptive reuse projects",
      "Return to Office": "RTO mandates, hybrid work policies, space utilization data",
      "REIT Earnings": "Vornado, SL Green, Highwoods, Cousins quarterly results",
      ...COMMON_CATEGORY_DEFINITIONS
    },
    baseSourceBonus: 15, termWeightCap: 40, termWeightEach: 8, financialBonus: 10,
    locationBonusTerms: ["new york", "san francisco", "chicago", "boston", "washington dc", "austin", "miami"],
    locationBonus: 5,
    topicStatement: "Office real estate investment, leasing, conversion, and market intelligence",
    defaultKeywordWeights: {
      "office building": { weight: 12, category: "office" },
      coworking: { weight: 10, category: "office" },
      "office conversion": { weight: 12, category: "office" },
      acquisition: { weight: 12, category: "investment" }
    }
  });
}

// Seed ALL asset classes — idempotent, safe to call on every startup
export async function seedAllAssetClasses(): Promise<void> {
  console.log("[Asset Class Seed] Seeding all asset class configs...");
  const seedFns: Array<[string, () => Promise<number>]> = [
    ["Marina", seedMarinaAssetClass],
    ["Multifamily", seedMultifamilyAssetClass],
    ["Self-Storage", seedSelfStorageAssetClass],
    ["Industrial", seedIndustrialAssetClass],
    ["Retail", seedRetailAssetClass],
    ["Hospitality", seedHospitalityAssetClass],
    ["Short-Term Rental", seedShortTermRentalAssetClass],
    ["Senior Housing", seedSeniorHousingAssetClass],
    ["Mobile Home Parks", seedMobileHomeParkAssetClass],
    ["Car Wash", seedCarWashAssetClass],
    ["RV Parks", seedRvParkAssetClass],
    ["Office", seedOfficeAssetClass],
  ];
  for (const [name, fn] of seedFns) {
    try {
      await fn();
    } catch (e) {
      console.error(`[Asset Class Seed] Error seeding ${name}:`, e);
    }
  }
  console.log("[Asset Class Seed] All asset class configs seeded.");
}
