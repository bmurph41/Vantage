import type { OfferingMemorandum } from "@shared/reportSchema";

// Comprehensive demo data for Offering Memorandum stress testing
export const demoOfferingMemorandum: OfferingMemorandum = {
  // Metadata
  id: "om-001-marina-heights",
  title: "Marina Heights Apartments",
  subtitle: "Premier Waterfront Multifamily Investment Opportunity",
  dateCreated: "2024-09-15T10:00:00Z",
  lastUpdated: "2024-09-17T14:30:00Z",
  brokerCompany: "MarinaMatch Commercial Real Estate",
  brokerLicense: "CA BRE #01234567",
  
  // Property Information
  property: {
    name: "Marina Heights Apartments",
    address: {
      street: "1425 Marina Boulevard",
      city: "San Francisco",
      state: "CA",
      zipCode: "94123",
      county: "San Francisco",
      country: "United States",
    },
    propertyType: "multifamily",
    yearBuilt: 2018,
    totalUnits: 84,
    totalSqFt: 127500,
    lotSize: 1.2, // acres
    stories: 6,
    parkingSpaces: 96,
    elevators: 2,
  },
  
  // Financial Information
  financial: {
    askingPrice: 89500000,
    pricePerSqFt: 702,
    pricePerUnit: 1065476,
    currentNOI: 4245000,
    proFormaNOI: 4850000,
    capRate: 4.75,
    grossYield: 5.42,
    occupancy: 94.2,
    averageRent: 4825,
    rentPSF: 3.18,
  },
  
  // Unit Mix
  unitMix: [
    {
      unitType: "studio",
      count: 12,
      avgSqFt: 625,
      avgRent: 3200,
      occupancy: 100,
    },
    {
      unitType: "1br",
      count: 36,
      avgSqFt: 850,
      avgRent: 4200,
      occupancy: 97.2,
    },
    {
      unitType: "2br",
      count: 28,
      avgSqFt: 1250,
      avgRent: 6400,
      occupancy: 92.9,
    },
    {
      unitType: "3br",
      count: 8,
      avgSqFt: 1650,
      avgRent: 8500,
      occupancy: 87.5,
    },
  ],
  
  // Sample Rent Roll (subset of units)
  rentRoll: [
    {
      unit: "101",
      unitType: "studio",
      sqFt: 615,
      tenant: "Sarah Chen",
      leaseStart: "2024-01-15T00:00:00Z",
      leaseEnd: "2024-12-31T00:00:00Z",
      currentRent: 3150,
      marketRent: 3200,
      securityDeposit: 3150,
      occupied: true,
    },
    {
      unit: "102",
      unitType: "1br",
      sqFt: 825,
      tenant: "Michael Rodriguez",
      leaseStart: "2024-03-01T00:00:00Z",
      leaseEnd: "2025-02-28T00:00:00Z",
      currentRent: 4100,
      marketRent: 4200,
      securityDeposit: 4100,
      occupied: true,
    },
    {
      unit: "103",
      unitType: "1br",
      sqFt: 875,
      tenant: "VACANT",
      leaseStart: "2024-01-01T00:00:00Z",
      leaseEnd: "2024-01-01T00:00:00Z",
      currentRent: 0,
      marketRent: 4350,
      securityDeposit: 0,
      occupied: false,
    },
    {
      unit: "201",
      unitType: "2br",
      sqFt: 1185,
      tenant: "Jennifer Kim & David Park",
      leaseStart: "2023-09-01T00:00:00Z",
      leaseEnd: "2024-08-31T00:00:00Z",
      currentRent: 6200,
      marketRent: 6500,
      securityDeposit: 6200,
      occupied: true,
    },
    {
      unit: "202",
      unitType: "2br",
      sqFt: 1290,
      tenant: "Thomas Anderson",
      leaseStart: "2024-04-01T00:00:00Z",
      leaseEnd: "2025-03-31T00:00:00Z",
      currentRent: 6600,
      marketRent: 6600,
      securityDeposit: 6600,
      occupied: true,
    },
    {
      unit: "301",
      unitType: "3br",
      sqFt: 1625,
      tenant: "The Johnson Family",
      leaseStart: "2023-11-01T00:00:00Z",
      leaseEnd: "2024-10-31T00:00:00Z",
      currentRent: 8300,
      marketRent: 8700,
      securityDeposit: 8300,
      occupied: true,
    },
    {
      unit: "601",
      unitType: "3br",
      sqFt: 1850,
      tenant: "VACANT",
      leaseStart: "2024-01-01T00:00:00Z",
      leaseEnd: "2024-01-01T00:00:00Z",
      currentRent: 0,
      marketRent: 9200,
      securityDeposit: 0,
      occupied: false,
    },
  ],
  
  // Investment Highlights
  investmentHighlights: [
    {
      title: "Prime Marina District Location",
      description: "Situated in San Francisco's prestigious Marina District with unobstructed bay views and walking distance to Crissy Field, Marina Green, and the Golden Gate Bridge.",
      icon: "map-pin",
      priority: 1,
    },
    {
      title: "Recently Constructed Class A Asset",
      description: "Built in 2018 with modern amenities, energy-efficient systems, and contemporary finishes throughout. Minimal capital expenditure requirements.",
      icon: "building",
      priority: 2,
    },
    {
      title: "Strong Rental Growth Potential",
      description: "Current rents are 8-12% below market with proven demand for premium waterfront living. Significant upside in pro forma projections.",
      icon: "trending-up",
      priority: 3,
    },
    {
      title: "Institutional Quality Tenant Base",
      description: "High-income professionals averaging $185K+ household income with strong lease terms and credit profiles. Low turnover history.",
      icon: "users",
      priority: 4,
    },
    {
      title: "Comprehensive Amenity Package",
      description: "Rooftop terrace with bay views, fitness center, concierge services, EV charging stations, and secure parking. Competitive market positioning.",
      icon: "star",
      priority: 5,
    },
    {
      title: "Transportation Connectivity",
      description: "Walking distance to multiple Muni lines, express bus routes to Financial District, and major arterials for easy access throughout the Bay Area.",
      icon: "bus",
      priority: 6,
    },
  ],
  
  // Executive Summary
  executiveSummary: `Marina Heights Apartments represents a rare opportunity to acquire a premier Class A multifamily asset in one of San Francisco's most desirable neighborhoods. This 84-unit waterfront property, completed in 2018, offers investors a stabilized cash-flowing asset with significant upside potential through strategic rent optimization and value-add initiatives.

The property benefits from an irreplaceable Marina District location with stunning bay views, walking access to recreational amenities, and proximity to major employment centers. The asset features contemporary design, high-end finishes, and a comprehensive amenity package that positions it as a premier rental destination for high-income professionals.

Current in-place rents average 8-12% below market, presenting immediate upside potential. The sponsor projects a stabilized 4.85% cap rate based on conservative market rent assumptions and minimal capital investment requirements. The property's strong fundamentals, combined with San Francisco's supply-constrained market dynamics, support long-term value appreciation and income growth.`,
  
  // Location & Market
  locationMarket: {
    neighborhood: "Marina District",
    walkScore: 89,
    transitScore: 72,
    schoolRating: 8,
    medianHouseholdIncome: 142500,
    populationGrowth: 2.3,
    unemploymentRate: 2.8,
    majorEmployers: [
      "Salesforce",
      "Google",
      "Meta",
      "Apple",
      "Wells Fargo",
      "Kaiser Permanente",
      "UCSF Medical Center",
      "Gap Inc.",
    ],
    nearbyAmenities: [
      "Marina Green (0.2 miles)",
      "Crissy Field (0.4 miles)",
      "Golden Gate Bridge (1.2 miles)",
      "Palace of Fine Arts (0.6 miles)",
      "Union Street Shopping (0.3 miles)",
      "Safeway (0.2 miles)",
      "Sports Basement (0.4 miles)",
      "Marina Middle School (0.5 miles)",
    ],
    publicTransportation: [
      "Muni Bus Lines 28, 30, 43",
      "Golden Gate Transit Routes",
      "Ferry Service to Marin County",
      "Caltrain Connection via Downtown",
    ],
  },
  
  // Sales Comparables
  salesComparables: [
    {
      address: "3150 Pierce Street",
      distance: 0.8,
      saleDate: "June 2024",
      salePrice: 67500000,
      sqFt: 98500,
      pricePerSqFt: 685,
      units: 72,
      pricePerUnit: 937500,
      yearBuilt: 2019,
      capRate: 4.2,
      compType: "direct",
      notes: "Similar vintage and unit mix, slightly inferior location",
    },
    {
      address: "2425 Van Ness Avenue",
      distance: 1.2,
      saleDate: "March 2024",
      salePrice: 145000000,
      sqFt: 185500,
      pricePerSqFt: 782,
      units: 156,
      pricePerUnit: 929487,
      yearBuilt: 2020,
      capRate: 4.1,
      compType: "superior",
      notes: "Larger scale, premium Pacific Heights location",
    },
    {
      address: "1960 Jefferson Street",
      distance: 0.4,
      saleDate: "January 2024",
      salePrice: 52000000,
      sqFt: 89200,
      pricePerSqFt: 583,
      units: 68,
      pricePerUnit: 764706,
      yearBuilt: 2005,
      capRate: 5.1,
      compType: "inferior",
      notes: "Older vintage with upcoming capital requirements",
    },
    {
      address: "3525 Divisadero Street",
      distance: 2.1,
      saleDate: "August 2023",
      salePrice: 78500000,
      sqFt: 112000,
      pricePerSqFt: 701,
      units: 89,
      pricePerUnit: 882022,
      yearBuilt: 2017,
      capRate: 4.6,
      compType: "comparable",
      notes: "Similar vintage and size, Pacific Heights adjacent",
    },
  ],
  
  // Images (placeholder URLs)
  images: [
    {
      url: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&h=800",
      caption: "Marina Heights Apartments - Street View",
      category: "exterior",
      order: 1,
    },
    {
      url: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&h=800",
      caption: "Luxury Unit Interior - Living Room",
      category: "interior",
      order: 2,
    },
    {
      url: "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=1200&h=800",
      caption: "Modern Kitchen with Premium Finishes",
      category: "interior",
      order: 3,
    },
    {
      url: "https://images.unsplash.com/photo-1571055107559-3e67626fa8be?w=1200&h=800",
      caption: "Rooftop Terrace with Bay Views",
      category: "amenity",
      order: 4,
    },
    {
      url: "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=1200&h=800",
      caption: "Fitness Center",
      category: "amenity",
      order: 5,
    },
    {
      url: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1200&h=800",
      caption: "Marina District Neighborhood",
      category: "neighborhood",
      order: 6,
    },
  ],
  
  // Offering Terms
  offeringTerms: {
    offeringType: "sale",
    listingPrice: 89500000,
    brokerCommission: 2.0,
    earnestMoney: 1000000,
    dueDiligencePeriod: 45,
    closingPeriod: 30,
    possessionDate: "At Close of Escrow",
    financing: "All cash or institutional financing acceptable",
    specialTerms: [
      "Seller to provide 12 months of operating statements",
      "Property sold in as-is condition",
      "Existing leases assigned at closing",
      "Security deposits transferred to buyer",
    ],
  },
  
  // Contact Information
  listingAgents: [
    {
      name: "Jonathan Davis",
      title: "Managing Director",
      company: "MarinaMatch Commercial Real Estate",
      phone: "(415) 555-0123",
      email: "j.davis@marinamatch.com",
      license: "CA BRE #01234567",
      photo: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300",
    },
    {
      name: "Sarah Mitchell",
      title: "Senior Associate",
      company: "MarinaMatch Commercial Real Estate", 
      phone: "(415) 555-0124",
      email: "s.mitchell@marinamatch.com",
      license: "CA BRE #01234568",
      photo: "https://images.unsplash.com/photo-1494790108755-2616b332c5f2?w=300&h=300",
    },
  ],
  
  // Additional Sections
  propertyDescription: `Marina Heights Apartments is a 6-story, 84-unit Class A multifamily property located at 1425 Marina Boulevard in San Francisco's prestigious Marina District. Completed in 2018, the property represents contemporary luxury living with unobstructed views of San Francisco Bay and the Golden Gate Bridge.

The building features a sophisticated architectural design with a limestone and glass facade, floor-to-ceiling windows, and private balconies in select units. The unit mix consists of thoughtfully designed studios, one-, two-, and three-bedroom apartments with high-end finishes including quartz countertops, stainless steel appliances, engineered hardwood flooring, and in-unit washers and dryers.

Residents enjoy access to a comprehensive amenity package including a rooftop terrace with outdoor kitchen and fire pits, state-of-the-art fitness center, 24-hour concierge services, secure underground parking with EV charging stations, and a pet-friendly policy with on-site dog run.`,
  
  marketOverview: `The San Francisco multifamily market continues to demonstrate resilience and long-term growth potential despite recent economic headwinds. The Marina District, in particular, benefits from its premium location, recreational amenities, and proximity to major employment centers.

Key market fundamentals include supply constraints due to limited developable land and complex entitlement processes, strong employment growth in technology and professional services sectors, and continued population growth among high-income demographics. Average asking rents have increased 4.2% year-over-year, with Class A properties commanding premium pricing.

The subject property's marina-adjacent location provides a competitive advantage in attracting and retaining quality tenants willing to pay premium rents for waterfront living and recreational access.`,
  
  financialAnalysis: `The current owner has operated the property conservatively, resulting in below-market rents that present immediate upside potential. Based on recent comparable transactions and current market rent surveys, the property's rents are positioned 8-12% below market.

A value-add strategy focused on lease rollover optimization and selective unit improvements could drive NOI growth of 12-15% over the next 24 months. The property's strong location fundamentals and quality construction minimize ongoing capital expenditure requirements.

Pro forma projections assume moderate rent growth of 3-5% annually, stabilized occupancy of 95%, and operating expense growth in line with inflation. These conservative assumptions support the projected stabilized cap rate of 4.85%.`,
  
  riskFactors: [
    "San Francisco rent control and tenant protection ordinances may limit rental growth potential",
    "Interest rate fluctuations could impact financing costs and investor demand",
    "Economic recession could negatively affect tenant employment and rental demand",
    "Seismic activity risk inherent to San Francisco Bay Area location",
    "Potential for increased property taxes following ownership transfer",
    "Competition from new luxury developments in adjacent neighborhoods",
  ],
  
  disclaimers: `This Offering Memorandum contains summary information about Marina Heights Apartments and is intended for review by prospective purchasers. The information contained herein has been obtained from the owner of the property and other sources deemed reliable; however, neither the owner nor MarinaMatch Commercial Real Estate makes any representation or warranty, express or implied, as to the accuracy or completeness of this information.

Prospective purchasers should conduct their own investigation and analysis of the property and verify all information contained herein. This Offering Memorandum does not constitute an offer to sell or solicitation of an offer to buy the described property. The property is offered subject to prior sale, withdrawal from the market, or changes in price or terms.

All financial projections and analyses are estimates only and should not be relied upon as representations of future performance. Actual results may vary significantly from projections. This offering is made subject to errors, omissions, changes in price, terms, or withdrawal without notice.`,
  
  // Report Configuration
  accentColor: "emerald",
  pageSize: "letter",
  includeSensitiveData: true,
};

// Export additional demo data for component testing
export const demoPrintOptions = {
  pageSize: "letter" as const,
  accentColor: "emerald" as const,
  includeCoverPage: true,
  includeFinancials: true,
  includeComparables: true,
  includePhotos: true,
  showSensitiveData: true,
};

export const demoStyleOptions = {
  fontScale: 1.0,
  spacingScale: 1.0, 
  colorDensity: "standard" as const,
  tableStyle: "zebra" as const,
};

export default demoOfferingMemorandum;