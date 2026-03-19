/**
 * Section Library
 * Marina-first section definitions for the Document Builder
 * Based on institutional IC Memo exemplar analysis
 */

import type { SectionDefinition, DocumentType } from './types';

// =============================================================================
// Section Library - Complete Marina-First Definitions
// =============================================================================

export const SECTION_LIBRARY: Record<string, SectionDefinition> = {
  
  // ---------------------------------------------------------------------------
  // Cover & Introduction
  // ---------------------------------------------------------------------------
  
  cover_page: {
    sectionKey: 'cover_page',
    name: 'Cover Page',
    description: 'Title page with property name, location, hero image, and branding',
    category: 'cover',
    supportedDocTypes: ['offering_memorandum', 'executive_summary', 'pitch_deck', 'ic_memo', 'teaser', 'lender_package', 'due_diligence_summary', 'custom'],
    requiredDataBindings: [
      { bindingKey: 'propertyName', label: 'Property Name', source: 'property', field: 'name', type: 'string', required: true },
      { bindingKey: 'location', label: 'Location', source: 'property', field: 'cityState', type: 'string', required: true }
    ],
    optionalDataBindings: [
      { bindingKey: 'tagline', label: 'Tagline', source: 'manual', field: 'tagline', type: 'string', required: false }
    ],
    requiredMedia: [
      { mediaKey: 'heroImage', label: 'Hero/Cover Image', type: 'image', required: true, suggestedDimensions: { width: 1920, height: 1080 } }
    ],
    optionalMedia: [
      { mediaKey: 'companyLogo', label: 'Company Logo', type: 'image', required: false }
    ],
    schema: {
      type: 'object',
      properties: {
        propertyName: { type: 'string', description: 'Property name displayed prominently' },
        location: { type: 'string', description: 'City, State format' },
        tagline: { type: 'string', description: 'Optional marketing tagline' },
        preparedBy: { type: 'string', description: 'Company or preparer name' },
        preparedDate: { type: 'string', format: 'date', description: 'Document date' },
        confidentiality: { type: 'string', description: 'Confidentiality notice' }
      },
      required: ['propertyName', 'location']
    },
    defaultLayouts: [
      {
        key: 'hero_overlay',
        name: 'Hero with Overlay',
        pageCount: 1,
        structure: {
          gridColumns: 1,
          gridGap: '0',
          placeholders: [
            { id: 'hero', blockType: 'image', x: 0, y: 0, width: 816, height: 1056, bindingKey: 'heroImage' },
            { id: 'title', blockType: 'text', x: 100, y: 400, width: 616, height: 100, bindingKey: 'propertyName', styleHints: { fontSize: 48, fontWeight: 'bold', color: 'white', textAlign: 'center' } },
            { id: 'location', blockType: 'text', x: 100, y: 520, width: 616, height: 50, bindingKey: 'location', styleHints: { fontSize: 24, color: 'white', textAlign: 'center' } },
            { id: 'logo', blockType: 'image', x: 308, y: 800, width: 200, height: 100, bindingKey: 'companyLogo' }
          ]
        }
      }
    ],
    aiPromptTemplates: [],
    completionRules: [
      { type: 'required_field', field: 'propertyName', errorMessage: 'Property name is required' },
      { type: 'required_media', mediaKey: 'heroImage', errorMessage: 'Cover image is required' }
    ],
    estimatedPages: 1,
    marinaSpecific: false
  },

  photo_gallery: {
    sectionKey: 'photo_gallery',
    name: 'Photo Gallery',
    description: 'Multi-image layout showcasing the property',
    category: 'property',
    supportedDocTypes: ['offering_memorandum', 'pitch_deck', 'ic_memo', 'teaser', 'custom'],
    requiredDataBindings: [],
    optionalDataBindings: [],
    requiredMedia: [
      { mediaKey: 'galleryImages', label: 'Gallery Images', type: 'image', required: true, maxCount: 12 }
    ],
    optionalMedia: [],
    schema: {
      type: 'object',
      properties: {
        images: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              caption: { type: 'string' },
              order: { type: 'number' }
            }
          }
        },
        layout: { type: 'string', description: 'Grid layout style: 1x3, 2x2, 1-large-2-small' }
      }
    },
    defaultLayouts: [
      {
        key: 'one_large_two_small',
        name: '1 Large + 2 Small',
        pageCount: 1,
        structure: {
          gridColumns: 2,
          gridGap: '16px',
          placeholders: [
            { id: 'main', blockType: 'image', x: 72, y: 72, width: 500, height: 600, label: 'Main Image' },
            { id: 'top_right', blockType: 'image', x: 588, y: 72, width: 300, height: 290, label: 'Top Right' },
            { id: 'bottom_right', blockType: 'image', x: 588, y: 378, width: 300, height: 290, label: 'Bottom Right' }
          ]
        }
      }
    ],
    aiPromptTemplates: [],
    completionRules: [
      { type: 'required_media', mediaKey: 'galleryImages', errorMessage: 'At least 3 property photos required' }
    ],
    estimatedPages: 1,
    marinaSpecific: false
  },

  // ---------------------------------------------------------------------------
  // Executive Summary & Highlights
  // ---------------------------------------------------------------------------

  executive_summary: {
    sectionKey: 'executive_summary',
    name: 'Executive Summary',
    description: 'Comprehensive overview with property details, investment thesis, and return metrics',
    category: 'summary',
    supportedDocTypes: ['offering_memorandum', 'executive_summary', 'pitch_deck', 'ic_memo', 'lender_package', 'custom'],
    requiredDataBindings: [
      { bindingKey: 'propertyName', label: 'Property Name', source: 'property', field: 'name', type: 'string', required: true },
      { bindingKey: 'location', label: 'Location', source: 'property', field: 'cityState', type: 'string', required: true },
      { bindingKey: 'totalSlips', label: 'Total Slips', source: 'property', field: 'totalSlips', type: 'number', required: false },
      { bindingKey: 'purchasePrice', label: 'Purchase Price', source: 'deal', field: 'value', type: 'currency', required: false }
    ],
    optionalDataBindings: [
      { bindingKey: 'ebitdam', label: 'EBITDAM', source: 'modeling', field: 'ebitdam', type: 'currency', required: false },
      { bindingKey: 'capRate', label: 'Cap Rate', source: 'modeling', field: 'capRate', type: 'percent', required: false },
      { bindingKey: 'irr', label: 'Projected IRR', source: 'modeling', field: 'irr', type: 'percent', required: false },
      { bindingKey: 'equityMultiple', label: 'Equity Multiple', source: 'modeling', field: 'equityMultiple', type: 'number', required: false },
      { bindingKey: 'groundLeaseTerm', label: 'Ground Lease Term', source: 'property', field: 'groundLeaseTerm', type: 'string', required: false }
    ],
    requiredMedia: [],
    optionalMedia: [],
    schema: {
      type: 'object',
      properties: {
        overviewNarrative: { type: 'string', format: 'richtext', description: 'Main executive summary paragraph' },
        propertyOverviewBullets: {
          type: 'array',
          items: { type: 'string' },
          description: 'Key property features as bullet points'
        },
        upsideOpportunities: {
          type: 'array',
          items: { type: 'string' },
          description: 'Value-add and upside opportunities'
        },
        returnsSummary: {
          type: 'object',
          properties: {
            purchasePrice: { type: 'number', format: 'currency' },
            grossIrr: { type: 'number', format: 'percent' },
            netIrr: { type: 'number', format: 'percent' },
            grossEM: { type: 'number' },
            netEM: { type: 'number' },
            capRate: { type: 'number', format: 'percent' },
            ebitdam: { type: 'number', format: 'currency' }
          }
        },
        keyAssumptions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Key underwriting assumptions'
        }
      },
      required: ['overviewNarrative']
    },
    defaultLayouts: [
      {
        key: 'standard',
        name: 'Standard Executive Summary',
        pageCount: 1,
        structure: {
          gridColumns: 1,
          gridGap: '24px',
          placeholders: [
            { id: 'title', blockType: 'text', x: 72, y: 72, width: 672, height: 40, label: 'Section Title', styleHints: { fontSize: 28, fontWeight: 'bold' } },
            { id: 'overview', blockType: 'text', x: 72, y: 130, width: 672, height: 150, bindingKey: 'overviewNarrative' },
            { id: 'property_overview', blockType: 'text', x: 72, y: 300, width: 672, height: 200, label: 'Property Overview Bullets' },
            { id: 'returns_box', blockType: 'metric_tile', x: 72, y: 520, width: 672, height: 180, label: 'Returns Summary Box', styleHints: { backgroundColor: '#f5f5f5', borderRadius: 8 } }
          ]
        }
      }
    ],
    aiPromptTemplates: [
      {
        key: 'generate_overview',
        name: 'Generate Executive Summary',
        systemPrompt: 'You are an expert commercial real estate analyst specializing in marina investments. Write institutional-quality content for offering memorandums.',
        userPromptTemplate: `Write a compelling executive summary paragraph (150-200 words) for {{propertyName}}, a {{totalSlips}}-slip marina in {{location}}.

Key property details:
- Total Slips: {{totalSlips}}
- Ground Lease Term: {{groundLeaseTerm}}
- Purchase Price: {{purchasePrice}}
- Cap Rate: {{capRate}}

The summary should:
1. Open with the investment opportunity positioning
2. Highlight the property's strategic location and market position
3. Emphasize the storage-dominant operation
4. Note key amenities and revenue streams
5. Close with the investment thesis

Write in third person, professional tone. Do not use bullet points.`,
        requiredContext: ['propertyName', 'location'],
        outputFormat: 'text',
        maxTokens: 500,
        temperature: 0.7
      }
    ],
    completionRules: [
      { type: 'required_field', field: 'overviewNarrative', errorMessage: 'Executive summary narrative is required' },
      { type: 'min_content_length', field: 'overviewNarrative', minLength: 200, errorMessage: 'Executive summary should be at least 200 characters' }
    ],
    estimatedPages: 1,
    marinaSpecific: false
  },

  investment_highlights: {
    sectionKey: 'investment_highlights',
    name: 'Investment Highlights',
    description: 'Key investment thesis points and value drivers',
    category: 'summary',
    supportedDocTypes: ['offering_memorandum', 'executive_summary', 'pitch_deck', 'teaser', 'custom'],
    requiredDataBindings: [],
    optionalDataBindings: [
      { bindingKey: 'capRate', label: 'Cap Rate', source: 'modeling', field: 'capRate', type: 'percent', required: false },
      { bindingKey: 'occupancy', label: 'Occupancy', source: 'rent_roll', field: 'occupancyRate', type: 'percent', required: false }
    ],
    requiredMedia: [],
    optionalMedia: [],
    schema: {
      type: 'object',
      properties: {
        highlights: {
          type: 'array',
          items: { type: 'string' },
          description: '5-8 key investment highlights'
        }
      },
      required: ['highlights']
    },
    defaultLayouts: [
      {
        key: 'bullet_list',
        name: 'Bullet List',
        pageCount: 1,
        structure: {
          gridColumns: 1,
          gridGap: '16px',
          placeholders: [
            { id: 'title', blockType: 'text', x: 72, y: 72, width: 672, height: 40, label: 'Investment Highlights', styleHints: { fontSize: 24, fontWeight: 'bold' } },
            { id: 'bullets', blockType: 'text', x: 72, y: 130, width: 672, height: 400, label: 'Highlight Bullets' }
          ]
        }
      }
    ],
    aiPromptTemplates: [
      {
        key: 'generate_highlights',
        name: 'Generate Investment Highlights',
        systemPrompt: 'You are an expert marina investment analyst. Generate compelling, data-driven investment highlights.',
        userPromptTemplate: `Generate 6-8 compelling investment highlights for {{propertyName}} marina.

Property context:
- Location: {{location}}
- Total Slips: {{totalSlips}}
- Occupancy: {{occupancy}}
- Cap Rate: {{capRate}}

Each bullet should:
- Start with a strong action word or key metric
- Be concise (one line)
- Focus on value, stability, or growth potential

Format as bullet points starting with "• ".`,
        requiredContext: ['propertyName'],
        outputFormat: 'bullets',
        maxTokens: 400,
        temperature: 0.7
      }
    ],
    completionRules: [
      { type: 'required_field', field: 'highlights', errorMessage: 'At least 5 investment highlights required' }
    ],
    estimatedPages: 0.5,
    marinaSpecific: false
  },

  // ---------------------------------------------------------------------------
  // Property Details
  // ---------------------------------------------------------------------------

  property_overview: {
    sectionKey: 'property_overview',
    name: 'Property Overview',
    description: 'Aerial view with labeled features and property details',
    category: 'property',
    supportedDocTypes: ['offering_memorandum', 'pitch_deck', 'ic_memo', 'lender_package', 'custom'],
    requiredDataBindings: [
      { bindingKey: 'propertyName', label: 'Property Name', source: 'property', field: 'name', type: 'string', required: true }
    ],
    optionalDataBindings: [
      { bindingKey: 'totalSlips', label: 'Total Slips', source: 'property', field: 'totalSlips', type: 'number', required: false },
      { bindingKey: 'acreage', label: 'Acreage', source: 'property', field: 'acreage', type: 'number', required: false },
      { bindingKey: 'waterFrontage', label: 'Water Frontage', source: 'property', field: 'waterFrontage', type: 'number', required: false },
      { bindingKey: 'amenities', label: 'Amenities', source: 'property', field: 'amenities', type: 'array', required: false }
    ],
    requiredMedia: [
      { mediaKey: 'aerialPhoto', label: 'Aerial Photo', type: 'image', required: true }
    ],
    optionalMedia: [
      { mediaKey: 'siteMap', label: 'Site Map', type: 'image', required: false }
    ],
    schema: {
      type: 'object',
      properties: {
        dockLabels: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              position: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } } }
            }
          },
          description: 'Labels for docks A, B, C, etc.'
        },
        featureLabels: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              position: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } } }
            }
          },
          description: 'Labels for features like Office, Pool, Parking'
        }
      }
    },
    defaultLayouts: [
      {
        key: 'labeled_aerial',
        name: 'Labeled Aerial View',
        pageCount: 1,
        structure: {
          gridColumns: 1,
          gridGap: '0',
          placeholders: [
            { id: 'title', blockType: 'text', x: 72, y: 72, width: 672, height: 40, label: 'Property Overview', styleHints: { fontSize: 28, fontWeight: 'bold' } },
            { id: 'aerial', blockType: 'image', x: 72, y: 130, width: 672, height: 500, bindingKey: 'aerialPhoto', label: 'Aerial Photo with Labels' }
          ]
        }
      }
    ],
    aiPromptTemplates: [],
    completionRules: [
      { type: 'required_media', mediaKey: 'aerialPhoto', errorMessage: 'Aerial photo is required' }
    ],
    estimatedPages: 1,
    marinaSpecific: true
  },

  ground_leases: {
    sectionKey: 'ground_leases',
    name: 'Ground Leases',
    description: 'Ground lease structure, terms, and expense projections',
    category: 'property',
    supportedDocTypes: ['ic_memo', 'lender_package', 'due_diligence_summary', 'custom'],
    requiredDataBindings: [],
    optionalDataBindings: [
      { bindingKey: 'groundLeaseLessor', label: 'Ground Lease Lessor', source: 'property', field: 'groundLeaseLessor', type: 'string', required: false },
      { bindingKey: 'groundLeaseExpiration', label: 'Lease Expiration', source: 'property', field: 'groundLeaseExpiration', type: 'date', required: false },
      { bindingKey: 'rentStructure', label: 'Rent Structure', source: 'property', field: 'groundLeaseRentStructure', type: 'string', required: false }
    ],
    requiredMedia: [],
    optionalMedia: [],
    schema: {
      type: 'object',
      properties: {
        leases: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Lease name (e.g., Ground Lease, Parking Lease)' },
              lessor: { type: 'string' },
              lessee: { type: 'string' },
              dateOfLease: { type: 'string', format: 'date' },
              term: { type: 'string' },
              rent: { type: 'string', description: 'Rent structure description' },
              notes: { type: 'string' }
            }
          }
        },
        leaseExpenseProjections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              values: { type: 'array', items: { type: 'number' } }
            }
          },
          description: 'Annual lease expense projections by category'
        },
        projectionYears: {
          type: 'array',
          items: { type: 'number' },
          description: 'Years for projection columns'
        }
      }
    },
    defaultLayouts: [
      {
        key: 'lease_tables',
        name: 'Lease Tables Layout',
        pageCount: 1,
        structure: {
          gridColumns: 2,
          gridGap: '24px',
          placeholders: [
            { id: 'title', blockType: 'text', x: 72, y: 72, width: 672, height: 40, label: 'Ground Leases' },
            { id: 'ground_lease_table', blockType: 'table', x: 72, y: 130, width: 320, height: 200, label: 'Ground Lease' },
            { id: 'parking_lease_table', blockType: 'table', x: 408, y: 130, width: 320, height: 200, label: 'Parking Lease' },
            { id: 'expense_projections', blockType: 'table', x: 72, y: 360, width: 672, height: 200, label: 'Lease Expense Projections' }
          ]
        }
      }
    ],
    aiPromptTemplates: [],
    completionRules: [],
    estimatedPages: 1,
    marinaSpecific: true
  },

  // ---------------------------------------------------------------------------
  // Market & Competition
  // ---------------------------------------------------------------------------

  location_access: {
    sectionKey: 'location_access',
    name: 'Location & Access',
    description: 'Location map, waterway access, and market positioning',
    category: 'location',
    supportedDocTypes: ['offering_memorandum', 'pitch_deck', 'ic_memo', 'custom'],
    requiredDataBindings: [
      { bindingKey: 'address', label: 'Address', source: 'property', field: 'address', type: 'string', required: true },
      { bindingKey: 'cityState', label: 'City, State', source: 'property', field: 'cityState', type: 'string', required: true }
    ],
    optionalDataBindings: [
      { bindingKey: 'bodyOfWater', label: 'Body of Water', source: 'property', field: 'bodyOfWater', type: 'string', required: false },
      { bindingKey: 'channelDepth', label: 'Channel Depth', source: 'property', field: 'channelDepth', type: 'number', required: false },
      { bindingKey: 'bridgeClearance', label: 'Bridge Clearance', source: 'property', field: 'bridgeClearance', type: 'number', required: false }
    ],
    requiredMedia: [],
    optionalMedia: [
      { mediaKey: 'locationMap', label: 'Location Map', type: 'map', required: false }
    ],
    schema: {
      type: 'object',
      properties: {
        locationNarrative: { type: 'string', format: 'richtext' },
        waterwayAccess: {
          type: 'object',
          properties: {
            bodyOfWater: { type: 'string' },
            channelDepth: { type: 'number' },
            basinDepth: { type: 'number' },
            tidalRange: { type: 'number' },
            bridgeClearance: { type: 'number' },
            accessToOcean: { type: 'boolean' }
          }
        },
        nearbyAttractions: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    },
    defaultLayouts: [
      {
        key: 'map_with_narrative',
        name: 'Map with Narrative',
        pageCount: 1,
        structure: {
          gridColumns: 2,
          gridGap: '24px',
          placeholders: [
            { id: 'title', blockType: 'text', x: 72, y: 72, width: 672, height: 40, label: 'Location & Access' },
            { id: 'map', blockType: 'map', x: 72, y: 130, width: 400, height: 350, label: 'Location Map' },
            { id: 'narrative', blockType: 'text', x: 488, y: 130, width: 256, height: 350, label: 'Location Details' }
          ]
        }
      }
    ],
    aiPromptTemplates: [
      {
        key: 'generate_location',
        name: 'Generate Location Narrative',
        systemPrompt: 'You are a commercial real estate analyst specializing in marina properties.',
        userPromptTemplate: `Write a location overview (100-150 words) for {{propertyName}} located at {{address}}, {{cityState}}.

Include:
1. Strategic waterfront positioning
2. Access to major waterways ({{bodyOfWater}})
3. Proximity to population centers and attractions
4. Transportation accessibility

Write in flowing paragraphs with professional tone.`,
        requiredContext: ['propertyName', 'address', 'cityState'],
        outputFormat: 'text',
        maxTokens: 300,
        temperature: 0.7
      }
    ],
    completionRules: [],
    estimatedPages: 1,
    marinaSpecific: true
  },

  competitive_set: {
    sectionKey: 'competitive_set',
    name: 'Competitive Set Overview',
    description: 'Map and detailed comparison table of competing marinas',
    category: 'market',
    supportedDocTypes: ['offering_memorandum', 'ic_memo', 'custom'],
    requiredDataBindings: [],
    optionalDataBindings: [],
    requiredMedia: [],
    optionalMedia: [
      { mediaKey: 'competitorMap', label: 'Competitor Map', type: 'map', required: false }
    ],
    schema: {
      type: 'object',
      properties: {
        competitors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              ownership: { type: 'string' },
              overallRating: { type: 'string' },
              distanceToSubject: { type: 'string' },
              slipCount: { type: 'number' },
              estOccupancy: { type: 'string' },
              hasWaitlist: { type: 'boolean' },
              summerRate: { type: 'number' },
              winterRate: { type: 'number' },
              dailyRate: { type: 'number' },
              weeklyRate: { type: 'number' },
              monthlyRate: { type: 'number' },
              liveaboardFee: { type: 'number' },
              notes: { type: 'string' }
            }
          }
        },
        subjectProperty: {
          type: 'object',
          description: 'Same structure as competitors for the subject property'
        },
        averageVariance: {
          type: 'object',
          properties: {
            summerRate: { type: 'string' },
            winterRate: { type: 'string' },
            dailyRate: { type: 'string' }
          }
        }
      }
    },
    defaultLayouts: [
      {
        key: 'map_and_table',
        name: 'Map and Comparison Table',
        pageCount: 2,
        structure: {
          gridColumns: 1,
          gridGap: '24px',
          placeholders: [
            { id: 'title', blockType: 'text', x: 72, y: 72, width: 672, height: 40, label: 'Competitive Set Overview' },
            { id: 'map', blockType: 'map', x: 72, y: 130, width: 672, height: 400, label: 'Competitor Location Map' },
            { id: 'table', blockType: 'table', x: 72, y: 550, width: 672, height: 400, label: 'Rate Comparison Table' }
          ]
        }
      }
    ],
    aiPromptTemplates: [],
    completionRules: [],
    estimatedPages: 2,
    marinaSpecific: true
  },

  market_overview: {
    sectionKey: 'market_overview',
    name: 'Market Overview',
    description: 'Local marina market conditions and boating trends',
    category: 'market',
    supportedDocTypes: ['offering_memorandum', 'pitch_deck', 'lender_package', 'custom'],
    requiredDataBindings: [],
    optionalDataBindings: [
      { bindingKey: 'population', label: 'Population', source: 'demographics', field: 'population', type: 'number', required: false },
      { bindingKey: 'medianIncome', label: 'Median Income', source: 'demographics', field: 'medianHouseholdIncome', type: 'currency', required: false },
      { bindingKey: 'boatRegistrations', label: 'Boat Registrations', source: 'demographics', field: 'boatRegistrations', type: 'number', required: false }
    ],
    requiredMedia: [],
    optionalMedia: [],
    schema: {
      type: 'object',
      properties: {
        marketNarrative: { type: 'string', format: 'richtext' },
        demographics: {
          type: 'object',
          properties: {
            population: { type: 'number' },
            populationGrowth: { type: 'number', format: 'percent' },
            medianIncome: { type: 'number', format: 'currency' },
            boatRegistrations: { type: 'number' },
            boatOwnershipRate: { type: 'number', format: 'percent' }
          }
        },
        marketTrends: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    },
    defaultLayouts: [
      {
        key: 'narrative_with_stats',
        name: 'Narrative with Statistics',
        pageCount: 1,
        structure: {
          gridColumns: 2,
          gridGap: '24px',
          placeholders: [
            { id: 'title', blockType: 'text', x: 72, y: 72, width: 672, height: 40, label: 'Market Overview' },
            { id: 'narrative', blockType: 'text', x: 72, y: 130, width: 400, height: 300, label: 'Market Narrative' },
            { id: 'stats', blockType: 'metric_tile', x: 488, y: 130, width: 256, height: 300, label: 'Key Statistics' }
          ]
        }
      }
    ],
    aiPromptTemplates: [
      {
        key: 'generate_market',
        name: 'Generate Market Overview',
        systemPrompt: 'You are a marina market analyst with expertise in recreational boating trends.',
        userPromptTemplate: `Write a market overview (150-200 words) for the {{location}} marina market.

Market data:
- Population: {{population}}
- Median Household Income: {{medianIncome}}
- Boat Registrations: {{boatRegistrations}}

The overview should:
1. Describe local/regional marina market conditions
2. Highlight boating and watercraft ownership trends
3. Discuss supply/demand dynamics for marina slips
4. Position the property favorably within market context

Write in flowing paragraphs with analytical tone.`,
        requiredContext: ['location'],
        outputFormat: 'text',
        maxTokens: 400,
        temperature: 0.7
      }
    ],
    completionRules: [],
    estimatedPages: 1,
    marinaSpecific: false
  },

  // ---------------------------------------------------------------------------
  // Financial Analysis
  // ---------------------------------------------------------------------------

  rent_roll_analysis: {
    sectionKey: 'rent_roll_analysis',
    name: 'Rent Roll Analysis',
    description: 'Detailed rent roll with historical rates, seasonality, and occupancy breakdown',
    category: 'financial',
    supportedDocTypes: ['offering_memorandum', 'ic_memo', 'lender_package', 'custom'],
    requiredDataBindings: [],
    optionalDataBindings: [
      { bindingKey: 'rentRollData', label: 'Rent Roll Data', source: 'rent_roll', field: 'entries', type: 'array', required: false },
      { bindingKey: 'occupancyRate', label: 'Occupancy Rate', source: 'rent_roll', field: 'occupancyRate', type: 'percent', required: false },
      { bindingKey: 'avgRatePerFoot', label: 'Avg Rate/Foot', source: 'rent_roll', field: 'avgRatePerFoot', type: 'currency', required: false }
    ],
    requiredMedia: [],
    optionalMedia: [],
    schema: {
      type: 'object',
      properties: {
        currentRatesNarrative: { type: 'string', format: 'richtext' },
        competitiveAnalysisNarrative: { type: 'string', format: 'richtext' },
        historicalRateGrowth: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              avgLOA: { type: 'string' },
              yearlyRates: { type: 'array', items: { type: 'number' } },
              avgTotalRate: { type: 'number' }
            }
          }
        },
        summerRentRoll: {
          type: 'object',
          properties: {
            categories: { type: 'array', items: { type: 'object' } },
            contractAllocation: { type: 'object' },
            slipStatusAllocation: { type: 'object' },
            liveaboardCount: { type: 'number' }
          }
        },
        winterRentRoll: {
          type: 'object',
          properties: {
            categories: { type: 'array', items: { type: 'object' } },
            contractAllocation: { type: 'object' },
            slipStatusAllocation: { type: 'object' }
          }
        }
      }
    },
    defaultLayouts: [
      {
        key: 'comprehensive',
        name: 'Comprehensive Rent Roll',
        pageCount: 2,
        structure: {
          gridColumns: 1,
          gridGap: '16px',
          placeholders: [
            { id: 'title', blockType: 'text', x: 72, y: 72, width: 672, height: 40, label: 'Rent Roll Analysis' },
            { id: 'narrative', blockType: 'text', x: 72, y: 130, width: 672, height: 150, label: 'Current Rates & Seasonality' },
            { id: 'historical_table', blockType: 'table', x: 72, y: 300, width: 672, height: 200, label: 'Historical Rate Growth' },
            { id: 'summer_roll', blockType: 'table', x: 72, y: 520, width: 672, height: 250, label: 'Summer Rent Roll' },
            { id: 'winter_roll', blockType: 'table', x: 72, y: 790, width: 672, height: 250, label: 'Winter Rent Roll' }
          ]
        }
      }
    ],
    aiPromptTemplates: [],
    completionRules: [],
    estimatedPages: 2,
    marinaSpecific: true
  },

  storage_revenue: {
    sectionKey: 'storage_revenue',
    name: 'Storage Revenue Analysis',
    description: 'Breakdown of storage revenue by type and season',
    category: 'financial',
    supportedDocTypes: ['ic_memo', 'custom'],
    requiredDataBindings: [],
    optionalDataBindings: [],
    requiredMedia: [],
    optionalMedia: [],
    schema: {
      type: 'object',
      properties: {
        narrative: { type: 'string', format: 'richtext' },
        revenueBreakdown: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              currentYear: { type: 'number', format: 'currency' },
              priorYear: { type: 'number', format: 'currency' }
            }
          }
        },
        seasonalMix: {
          type: 'object',
          properties: {
            summer: { type: 'object', properties: { amount: { type: 'number' }, percent: { type: 'number' } } },
            winter: { type: 'object', properties: { amount: { type: 'number' }, percent: { type: 'number' } } },
            transient: { type: 'object', properties: { amount: { type: 'number' }, percent: { type: 'number' } } },
            liveaboard: { type: 'object', properties: { amount: { type: 'number' }, percent: { type: 'number' } } }
          }
        }
      }
    },
    defaultLayouts: [
      {
        key: 'revenue_tables',
        name: 'Revenue Tables',
        pageCount: 1,
        structure: {
          gridColumns: 2,
          gridGap: '24px',
          placeholders: [
            { id: 'title', blockType: 'text', x: 72, y: 72, width: 672, height: 40, label: 'Storage Revenue Analysis' },
            { id: 'narrative', blockType: 'text', x: 72, y: 130, width: 672, height: 100, label: 'Revenue Narrative' },
            { id: 'breakdown_table', blockType: 'table', x: 72, y: 250, width: 320, height: 300, label: 'Revenue Breakdown' },
            { id: 'seasonal_table', blockType: 'table', x: 408, y: 250, width: 320, height: 300, label: 'Seasonal Mix' }
          ]
        }
      }
    ],
    aiPromptTemplates: [],
    completionRules: [],
    estimatedPages: 1,
    marinaSpecific: true
  },

  ancillary_revenue: {
    sectionKey: 'ancillary_revenue',
    name: 'Ancillary Revenue',
    description: 'Non-storage revenue streams including B&B, fuel, ship store, service',
    category: 'financial',
    supportedDocTypes: ['ic_memo', 'offering_memorandum', 'custom'],
    requiredDataBindings: [],
    optionalDataBindings: [],
    requiredMedia: [],
    optionalMedia: [],
    schema: {
      type: 'object',
      properties: {
        narrative: { type: 'string', format: 'richtext' },
        revenueStreams: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              units: { type: 'array', items: { type: 'object' } },
              totalRevenue: { type: 'number', format: 'currency' }
            }
          }
        }
      }
    },
    defaultLayouts: [
      {
        key: 'stream_breakdown',
        name: 'Revenue Stream Breakdown',
        pageCount: 1,
        structure: {
          gridColumns: 2,
          gridGap: '24px',
          placeholders: [
            { id: 'title', blockType: 'text', x: 72, y: 72, width: 672, height: 40, label: 'Ancillary Revenue' },
            { id: 'narrative', blockType: 'text', x: 72, y: 130, width: 350, height: 400, label: 'Description' },
            { id: 'table', blockType: 'table', x: 438, y: 130, width: 306, height: 400, label: 'Revenue Table' }
          ]
        }
      }
    ],
    aiPromptTemplates: [],
    completionRules: [],
    estimatedPages: 1,
    marinaSpecific: true
  },

  financial_overview: {
    sectionKey: 'financial_overview',
    name: 'Financial Overview',
    description: 'Revenue mix charts, gross profit breakdown, and EBITDAM growth',
    category: 'financial',
    supportedDocTypes: ['ic_memo', 'offering_memorandum', 'pitch_deck', 'custom'],
    requiredDataBindings: [],
    optionalDataBindings: [
      { bindingKey: 'revenue', label: 'Total Revenue', source: 'modeling', field: 'revenue', type: 'currency', required: false },
      { bindingKey: 'ebitdam', label: 'EBITDAM', source: 'modeling', field: 'ebitdam', type: 'currency', required: false }
    ],
    requiredMedia: [],
    optionalMedia: [],
    schema: {
      type: 'object',
      properties: {
        revenueMix: {
          type: 'object',
          properties: {
            storage: { type: 'number', format: 'percent' },
            marinaAmenities: { type: 'number', format: 'percent' },
            service: { type: 'number', format: 'percent' },
            thirdPartyLeases: { type: 'number', format: 'percent' },
            bnbAfloat: { type: 'number', format: 'percent' }
          }
        },
        grossProfitMix: {
          type: 'object',
          properties: {
            storage: { type: 'number', format: 'percent' },
            marinaAmenities: { type: 'number', format: 'percent' },
            thirdPartyLeases: { type: 'number', format: 'percent' },
            bnbAfloat: { type: 'number', format: 'percent' }
          }
        },
        revenueByYear: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              year: { type: 'number' },
              storage: { type: 'number' },
              marinaAmenities: { type: 'number' },
              service: { type: 'number' },
              bnbAfloat: { type: 'number' }
            }
          }
        },
        ebitdamByYear: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              year: { type: 'number' },
              ebitdam: { type: 'number' }
            }
          }
        }
      }
    },
    defaultLayouts: [
      {
        key: 'four_charts',
        name: 'Four Chart Layout',
        pageCount: 1,
        structure: {
          gridColumns: 2,
          gridRows: 2,
          gridGap: '24px',
          placeholders: [
            { id: 'title', blockType: 'text', x: 72, y: 72, width: 672, height: 40, label: 'Financial Overview' },
            { id: 'revenue_pie', blockType: 'chart', x: 72, y: 130, width: 320, height: 200, label: 'Revenue Mix Pie' },
            { id: 'revenue_bar', blockType: 'chart', x: 408, y: 130, width: 336, height: 200, label: 'Revenue by Year' },
            { id: 'profit_pie', blockType: 'chart', x: 72, y: 350, width: 320, height: 200, label: 'Gross Profit Mix' },
            { id: 'ebitdam_bar', blockType: 'chart', x: 408, y: 350, width: 336, height: 200, label: 'EBITDAM Growth' }
          ]
        }
      }
    ],
    aiPromptTemplates: [],
    completionRules: [],
    estimatedPages: 1,
    marinaSpecific: false
  },

  historical_financials: {
    sectionKey: 'historical_financials',
    name: 'Historical Financials',
    description: 'T-12 or multi-year historical operating statements',
    category: 'financial',
    supportedDocTypes: ['offering_memorandum', 'ic_memo', 'lender_package', 'custom'],
    requiredDataBindings: [],
    optionalDataBindings: [],
    requiredMedia: [],
    optionalMedia: [],
    schema: {
      type: 'object',
      properties: {
        operatingStatement: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              lineItem: { type: 'string' },
              category: { type: 'string' },
              yearlyValues: { type: 'array', items: { type: 'number' } }
            }
          }
        },
        years: { type: 'array', items: { type: 'number' } },
        notes: { type: 'array', items: { type: 'string' } }
      }
    },
    defaultLayouts: [
      {
        key: 'statement_table',
        name: 'Operating Statement Table',
        pageCount: 1,
        structure: {
          gridColumns: 1,
          gridGap: '16px',
          placeholders: [
            { id: 'title', blockType: 'text', x: 72, y: 72, width: 672, height: 40, label: 'Historical Financials' },
            { id: 'table', blockType: 'table', x: 72, y: 130, width: 672, height: 500, label: 'Operating Statement' }
          ]
        }
      }
    ],
    aiPromptTemplates: [],
    completionRules: [],
    estimatedPages: 1,
    marinaSpecific: false
  },

  // ---------------------------------------------------------------------------
  // Underwriting & Returns
  // ---------------------------------------------------------------------------

  debt_financing: {
    sectionKey: 'debt_financing',
    name: 'Debt Financing Terms',
    description: 'Sample debt financing term sheet',
    category: 'financial',
    supportedDocTypes: ['ic_memo', 'lender_package', 'custom'],
    requiredDataBindings: [],
    optionalDataBindings: [
      { bindingKey: 'purchasePrice', label: 'Purchase Price', source: 'deal', field: 'value', type: 'currency', required: false },
      { bindingKey: 'ltv', label: 'LTV', source: 'modeling', field: 'ltv', type: 'percent', required: false },
      { bindingKey: 'interestRate', label: 'Interest Rate', source: 'modeling', field: 'interestRate', type: 'percent', required: false }
    ],
    requiredMedia: [],
    optionalMedia: [],
    schema: {
      type: 'object',
      properties: {
        purchasePrice: { type: 'number', format: 'currency' },
        exitYear: { type: 'number' },
        lender: { type: 'string' },
        recourse: { type: 'string' },
        loanAmount: { type: 'number', format: 'currency' },
        loanType: { type: 'string' },
        ltv: { type: 'number', format: 'percent' },
        loanTerm: { type: 'string' },
        amortization: { type: 'string' },
        ioPeriod: { type: 'string' },
        pAndIAds: { type: 'number', format: 'currency' },
        ioAds: { type: 'number', format: 'currency' },
        rateStructure: { type: 'string' },
        interestRate: { type: 'number', format: 'percent' },
        prepaymentPenalty: { type: 'string' },
        financingFees: { type: 'number', format: 'percent' },
        extensionFees: { type: 'number', format: 'percent' },
        exitFees: { type: 'number', format: 'percent' },
        dscrCovenant: { type: 'string' }
      }
    },
    defaultLayouts: [
      {
        key: 'term_sheet_table',
        name: 'Term Sheet Table',
        pageCount: 1,
        structure: {
          gridColumns: 1,
          gridGap: '24px',
          placeholders: [
            { id: 'title', blockType: 'text', x: 72, y: 72, width: 672, height: 40, label: 'Sample Debt Financing Term Sheet' },
            { id: 'table', blockType: 'table', x: 200, y: 130, width: 400, height: 450, label: 'Term Sheet' }
          ]
        }
      }
    ],
    aiPromptTemplates: [],
    completionRules: [],
    estimatedPages: 1,
    marinaSpecific: false
  },

  underwriting_assumptions: {
    sectionKey: 'underwriting_assumptions',
    name: 'Underwriting Assumptions',
    description: 'Sources & uses, key assumptions, and summary projections',
    category: 'financial',
    supportedDocTypes: ['ic_memo', 'offering_memorandum', 'custom'],
    requiredDataBindings: [],
    optionalDataBindings: [],
    requiredMedia: [],
    optionalMedia: [],
    schema: {
      type: 'object',
      properties: {
        sourcesAndUses: {
          type: 'object',
          properties: {
            uses: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  item: { type: 'string' },
                  amount: { type: 'number' },
                  percentOfTotal: { type: 'number' }
                }
              }
            },
            sources: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  item: { type: 'string' },
                  amount: { type: 'number' },
                  percentOfTotal: { type: 'number' }
                }
              }
            }
          }
        },
        revenueAssumptions: {
          type: 'object',
          properties: {
            storageRateCAGR: { type: 'number', format: 'percent' },
            nonStorageCAGR: { type: 'number', format: 'percent' },
            overallRevenueCAGR: { type: 'number', format: 'percent' }
          }
        },
        expenseAssumptions: {
          type: 'object',
          properties: {
            payrollCAGR: { type: 'number', format: 'percent' },
            insuranceCAGR: { type: 'number', format: 'percent' },
            propertyTaxCAGR: { type: 'number', format: 'percent' },
            overallExpenseCAGR: { type: 'number', format: 'percent' }
          }
        },
        financingAssumptions: {
          type: 'object',
          properties: {
            ltv: { type: 'number', format: 'percent' },
            interestRate: { type: 'number', format: 'percent' },
            amortization: { type: 'string' },
            loanTerm: { type: 'string' }
          }
        },
        exitAssumptions: {
          type: 'object',
          properties: {
            exitYear: { type: 'number' },
            exitCapRate: { type: 'number', format: 'percent' },
            exitValue: { type: 'number', format: 'currency' }
          }
        },
        summaryProjections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              metric: { type: 'string' },
              yearlyValues: { type: 'array', items: { type: 'number' } }
            }
          }
        }
      }
    },
    defaultLayouts: [
      {
        key: 'comprehensive',
        name: 'Comprehensive Assumptions',
        pageCount: 1,
        structure: {
          gridColumns: 2,
          gridGap: '16px',
          placeholders: [
            { id: 'title', blockType: 'text', x: 72, y: 72, width: 672, height: 40, label: 'Underwriting Assumptions' },
            { id: 'sources_uses', blockType: 'table', x: 72, y: 130, width: 320, height: 200, label: 'Sources & Uses' },
            { id: 'key_assumptions', blockType: 'table', x: 408, y: 130, width: 336, height: 200, label: 'Key Assumptions' },
            { id: 'summary_projections', blockType: 'table', x: 72, y: 350, width: 672, height: 250, label: 'Summary Projections' }
          ]
        }
      }
    ],
    aiPromptTemplates: [],
    completionRules: [],
    estimatedPages: 1,
    marinaSpecific: false
  },

  pro_forma_summary: {
    sectionKey: 'pro_forma_summary',
    name: 'Pro Forma Summary',
    description: 'High-level pro forma with key metrics and returns',
    category: 'financial',
    supportedDocTypes: ['ic_memo', 'offering_memorandum', 'lender_package', 'custom'],
    requiredDataBindings: [],
    optionalDataBindings: [],
    requiredMedia: [],
    optionalMedia: [],
    schema: {
      type: 'object',
      properties: {
        projections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              year: { type: 'number' },
              isActual: { type: 'boolean' },
              occupancy: { type: 'number', format: 'percent' },
              revenue: { type: 'number', format: 'currency' },
              revenueGrowth: { type: 'number', format: 'percent' },
              cogs: { type: 'number', format: 'currency' },
              opex: { type: 'number', format: 'currency' },
              ebitdam: { type: 'number', format: 'currency' },
              ebitdamGrowth: { type: 'number', format: 'percent' },
              ebitdamMargin: { type: 'number', format: 'percent' },
              mgmtFee: { type: 'number', format: 'currency' },
              ebitda: { type: 'number', format: 'currency' },
              capexReserve: { type: 'number', format: 'currency' },
              noi: { type: 'number', format: 'currency' },
              dscr: { type: 'number' },
              capRate: { type: 'number', format: 'percent' },
              irr: { type: 'number', format: 'percent' },
              equityMultiple: { type: 'number' }
            }
          }
        },
        cagrs: {
          type: 'object',
          properties: {
            revenue: { type: 'number', format: 'percent' },
            cogs: { type: 'number', format: 'percent' },
            opex: { type: 'number', format: 'percent' },
            ebitdam: { type: 'number', format: 'percent' },
            ebitda: { type: 'number', format: 'percent' }
          }
        }
      }
    },
    defaultLayouts: [
      {
        key: 'projection_table',
        name: 'Projection Table',
        pageCount: 1,
        structure: {
          gridColumns: 1,
          gridGap: '16px',
          placeholders: [
            { id: 'title', blockType: 'text', x: 72, y: 72, width: 672, height: 40, label: 'Pro Forma Financials' },
            { id: 'table', blockType: 'table', x: 72, y: 130, width: 672, height: 500, label: 'Summary Operating Projections' }
          ]
        }
      }
    ],
    aiPromptTemplates: [],
    completionRules: [],
    estimatedPages: 1,
    marinaSpecific: false
  },

  pro_forma_detail: {
    sectionKey: 'pro_forma_detail',
    name: 'Pro Forma Detail',
    description: 'Line-item revenue, COGS, gross profit, and operating expenses',
    category: 'financial',
    supportedDocTypes: ['ic_memo', 'custom'],
    requiredDataBindings: [],
    optionalDataBindings: [],
    requiredMedia: [],
    optionalMedia: [],
    schema: {
      type: 'object',
      properties: {
        revenueDetail: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              lineItem: { type: 'string' },
              yearlyValues: { type: 'array', items: { type: 'number' } },
              cagr: { type: 'number', format: 'percent' },
              percentOfRevenue: { type: 'number', format: 'percent' }
            }
          }
        },
        cogsDetail: { type: 'array', items: { type: 'object' } },
        grossProfitDetail: { type: 'array', items: { type: 'object' } },
        opexDetail: { type: 'array', items: { type: 'object' } },
        adjustments: { type: 'array', items: { type: 'string' } }
      }
    },
    defaultLayouts: [
      {
        key: 'detailed_table',
        name: 'Detailed Line Items',
        pageCount: 1,
        structure: {
          gridColumns: 1,
          gridGap: '16px',
          placeholders: [
            { id: 'title', blockType: 'text', x: 72, y: 72, width: 672, height: 40, label: 'Pro Forma Detail' },
            { id: 'table', blockType: 'table', x: 72, y: 130, width: 672, height: 500, label: 'Detailed Pro Forma' },
            { id: 'adjustments', blockType: 'text', x: 72, y: 650, width: 672, height: 100, label: 'Adjustments' }
          ]
        }
      }
    ],
    aiPromptTemplates: [],
    completionRules: [],
    estimatedPages: 1,
    marinaSpecific: false
  },

  sensitivity_analysis: {
    sectionKey: 'sensitivity_analysis',
    name: 'Return Summary & Sensitivity',
    description: 'IRR/EM summary with sensitivity tables for key assumptions',
    category: 'financial',
    supportedDocTypes: ['ic_memo', 'offering_memorandum', 'custom'],
    requiredDataBindings: [],
    optionalDataBindings: [],
    requiredMedia: [],
    optionalMedia: [],
    schema: {
      type: 'object',
      properties: {
        returnSummary: {
          type: 'object',
          properties: {
            grossIrr: { type: 'number', format: 'percent' },
            netIrr: { type: 'number', format: 'percent' },
            grossEM: { type: 'number' },
            netEM: { type: 'number' },
            leveragedGain: { type: 'number', format: 'currency' },
            unleveragedIrr: { type: 'number', format: 'percent' },
            unleveragedEM: { type: 'number' },
            exitCapRate: { type: 'number', format: 'percent' },
            goingInCapRate: { type: 'number', format: 'percent' },
            bpsSpread: { type: 'number' }
          }
        },
        revenueChart: { type: 'object', description: 'Revenue CAGR chart data' },
        ebitdamChart: { type: 'object', description: 'EBITDAM CAGR chart data' },
        sensitivityTables: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              variable: { type: 'string' },
              scenarios: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    cagr: { type: 'number', format: 'percent' },
                    irr: { type: 'number', format: 'percent' }
                  }
                }
              }
            }
          }
        }
      }
    },
    defaultLayouts: [
      {
        key: 'comprehensive',
        name: 'Comprehensive Sensitivity',
        pageCount: 1,
        structure: {
          gridColumns: 2,
          gridGap: '16px',
          placeholders: [
            { id: 'title', blockType: 'text', x: 72, y: 72, width: 672, height: 40, label: 'Return Summary & Sensitivity Analysis' },
            { id: 'return_summary', blockType: 'table', x: 72, y: 130, width: 200, height: 200, label: 'Return Summary' },
            { id: 'revenue_chart', blockType: 'chart', x: 288, y: 130, width: 220, height: 150, label: 'Revenue CAGR' },
            { id: 'ebitdam_chart', blockType: 'chart', x: 524, y: 130, width: 220, height: 150, label: 'EBITDAM CAGR' },
            { id: 'sensitivity_rate', blockType: 'table', x: 72, y: 350, width: 320, height: 180, label: 'Rate Growth Sensitivity' },
            { id: 'sensitivity_insurance', blockType: 'table', x: 408, y: 350, width: 320, height: 180, label: 'Insurance Sensitivity' },
            { id: 'sensitivity_payroll', blockType: 'table', x: 72, y: 550, width: 320, height: 180, label: 'Payroll Sensitivity' },
            { id: 'sensitivity_tax', blockType: 'table', x: 408, y: 550, width: 320, height: 180, label: 'Property Tax Sensitivity' }
          ]
        }
      }
    ],
    aiPromptTemplates: [],
    completionRules: [],
    estimatedPages: 1,
    marinaSpecific: false
  },

  // ---------------------------------------------------------------------------
  // Due Diligence & Legal
  // ---------------------------------------------------------------------------

  risks_mitigants: {
    sectionKey: 'risks_mitigants',
    name: 'Risks & Mitigants',
    description: 'Key risks and mitigation strategies',
    category: 'due_diligence',
    supportedDocTypes: ['ic_memo', 'due_diligence_summary', 'custom'],
    requiredDataBindings: [],
    optionalDataBindings: [],
    requiredMedia: [],
    optionalMedia: [],
    schema: {
      type: 'object',
      properties: {
        risks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              risk: { type: 'string' },
              likelihood: { type: 'string' },
              impact: { type: 'string' },
              mitigant: { type: 'string' }
            }
          }
        }
      }
    },
    defaultLayouts: [
      {
        key: 'risk_table',
        name: 'Risk Table',
        pageCount: 1,
        structure: {
          gridColumns: 1,
          gridGap: '16px',
          placeholders: [
            { id: 'title', blockType: 'text', x: 72, y: 72, width: 672, height: 40, label: 'Risks & Mitigants' },
            { id: 'table', blockType: 'table', x: 72, y: 130, width: 672, height: 500, label: 'Risk Assessment Table' }
          ]
        }
      }
    ],
    aiPromptTemplates: [
      {
        key: 'generate_risks',
        name: 'Generate Risk Assessment',
        systemPrompt: 'You are a due diligence analyst specializing in marina acquisitions.',
        userPromptTemplate: `Generate a risk assessment for {{propertyName}} marina acquisition.

Property context:
- Location: {{location}}
- Ground Lease: {{groundLeaseTerm}}
- Purchase Price: {{purchasePrice}}

Include risks in categories:
1. Market/Demand
2. Operational
3. Environmental/Weather
4. Regulatory/Lease
5. Financial

For each risk, provide likelihood (Low/Medium/High), impact, and specific mitigant.`,
        requiredContext: ['propertyName'],
        outputFormat: 'json',
        maxTokens: 800,
        temperature: 0.7
      }
    ],
    completionRules: [],
    estimatedPages: 1,
    marinaSpecific: true
  },

  due_diligence_checklist: {
    sectionKey: 'due_diligence_checklist',
    name: 'Due Diligence Checklist',
    description: 'Status of due diligence items',
    category: 'due_diligence',
    supportedDocTypes: ['ic_memo', 'due_diligence_summary', 'custom'],
    requiredDataBindings: [],
    optionalDataBindings: [
      { bindingKey: 'ddItems', label: 'DD Items', source: 'due_diligence', field: 'items', type: 'array', required: false }
    ],
    requiredMedia: [],
    optionalMedia: [],
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              item: { type: 'string' },
              status: { type: 'string' },
              assignee: { type: 'string' },
              dueDate: { type: 'string', format: 'date' },
              notes: { type: 'string' }
            }
          }
        }
      }
    },
    defaultLayouts: [
      {
        key: 'checklist_table',
        name: 'Checklist Table',
        pageCount: 1,
        structure: {
          gridColumns: 1,
          gridGap: '16px',
          placeholders: [
            { id: 'title', blockType: 'text', x: 72, y: 72, width: 672, height: 40, label: 'Due Diligence Checklist' },
            { id: 'table', blockType: 'table', x: 72, y: 130, width: 672, height: 500, label: 'Checklist' }
          ]
        }
      }
    ],
    aiPromptTemplates: [],
    completionRules: [],
    estimatedPages: 1,
    marinaSpecific: false
  },


  marina_operations: {
    sectionKey: 'marina_operations',
    name: 'Marina Operations',
    description: 'Detailed overview of marina operations, services, staff, and revenue streams',
    category: 'operations',
    supportedDocTypes: ['offering_memorandum', 'ic_memo', 'lender_package', 'custom'],
    requiredDataBindings: [
      { bindingKey: 'totalSlips', label: 'Total Slips', source: 'property', field: 'totalSlips', type: 'number', required: true },
      { bindingKey: 'wetSlips', label: 'Wet Slips', source: 'property', field: 'wetSlips', type: 'number', required: false },
      { bindingKey: 'drySlips', label: 'Dry Slips', source: 'property', field: 'drySlips', type: 'number', required: false },
    ],
    optionalDataBindings: [
      { bindingKey: 'occupancyRate', label: 'Occupancy Rate', source: 'valuator', field: 'occupancyRate', type: 'percent', required: false },
      { bindingKey: 'avgSlipRate', label: 'Avg Slip Rate', source: 'rate_comps', field: 'avgWetRate', type: 'currency', required: false },
      { bindingKey: 'annualRevenue', label: 'Annual Revenue', source: 'valuator', field: 'totalRevenue', type: 'currency', required: false },
    ],
    requiredMedia: [],
    optionalMedia: [
      { mediaKey: 'aerialPhoto', label: 'Aerial / Dock Photo', type: 'image', required: false }
    ],
    schema: {
      type: 'object',
      properties: {
        operationsOverview: { type: 'string', description: 'Narrative overview of marina operations' },
        services: { type: 'array', items: { type: 'string' }, description: 'List of services offered' },
        staffCount: { type: 'number', description: 'Number of employees' },
        managementType: { type: 'string', description: 'Self-managed or third-party' },
        seasonality: { type: 'string', description: 'Seasonal operating notes' },
        amenities: { type: 'array', items: { type: 'string' }, description: 'Key amenities' },
      }
    },
    defaultLayouts: [
      {
        key: 'two_column',
        name: 'Two Column',
        pageCount: 1,
        structure: {
          gridColumns: 2,
          gridGap: '24px',
          placeholders: [
            { id: 'narrative', blockType: 'text', x: 72, y: 72, width: 330, height: 400, bindingKey: 'operationsOverview' },
            { id: 'metrics', blockType: 'metrics', x: 420, y: 72, width: 324, height: 400, bindingKey: 'totalSlips' }
          ]
        }
      }
    ],
    aiPromptTemplates: [
      {
        key: 'operations_narrative',
        name: 'Operations Narrative',
        promptTemplate: 'Write a professional 3-paragraph operations overview for {{propertyName}}, a marina with {{totalSlips}} total slips ({{wetSlips}} wet, {{drySlips}} dry) located in {{location}}. Describe the operational strengths, revenue streams, and management approach. Annual revenue is approximately {{annualRevenue}}. Occupancy rate is {{occupancyRate}}. Write in institutional investment memo style.',
        outputFormat: 'text',
        requiredContext: ['propertyName', 'totalSlips'],
        optionalContext: ['wetSlips', 'drySlips', 'location', 'annualRevenue', 'occupancyRate'],
      }
    ],
    completionRules: [
      { type: 'required_field', field: 'totalSlips', errorMessage: 'Total slip count is required' }
    ],
    estimatedPages: 1,
    marinaSpecific: true,
  },

  disclaimer: {
    sectionKey: 'disclaimer',
    name: 'Disclaimer',
    description: 'Legal disclaimer and confidentiality notice',
    category: 'legal',
    supportedDocTypes: ['offering_memorandum', 'executive_summary', 'pitch_deck', 'ic_memo', 'teaser', 'lender_package', 'custom'],
    requiredDataBindings: [],
    optionalDataBindings: [],
    requiredMedia: [],
    optionalMedia: [],
    schema: {
      type: 'object',
      properties: {
        disclaimerText: { type: 'string', format: 'richtext' },
        confidentialityNotice: { type: 'string' },
        preparedBy: { type: 'string' },
        contactInfo: { type: 'string' }
      }
    },
    defaultLayouts: [
      {
        key: 'standard',
        name: 'Standard Disclaimer',
        pageCount: 1,
        structure: {
          gridColumns: 1,
          gridGap: '24px',
          placeholders: [
            { id: 'title', blockType: 'text', x: 72, y: 72, width: 672, height: 40, label: 'Disclaimer' },
            { id: 'text', blockType: 'text', x: 72, y: 130, width: 672, height: 400, label: 'Disclaimer Text', styleHints: { fontSize: 10, color: '#666' } }
          ]
        }
      }
    ],
    aiPromptTemplates: [],
    completionRules: [],
    estimatedPages: 1,
    marinaSpecific: false
  }
};

// =============================================================================
// Helper Functions
// =============================================================================

export function getSectionsByDocType(docType: DocumentType): SectionDefinition[] {
  return Object.values(SECTION_LIBRARY).filter(
    section => section.supportedDocTypes.includes(docType)
  );
}

export function getSectionsByCategory(category: string): SectionDefinition[] {
  return Object.values(SECTION_LIBRARY).filter(
    section => section.category === category
  );
}

export function getRequiredSections(docType: DocumentType): SectionDefinition[] {
  const { DOCUMENT_TYPE_CONFIGS } = require('./types');
  const config = DOCUMENT_TYPE_CONFIGS[docType];
  if (!config) return [];
  
  return config.requiredSections
    .map((key: string) => SECTION_LIBRARY[key])
    .filter(Boolean);
}

export function getSectionDefinition(sectionKey: string): SectionDefinition | undefined {
  return SECTION_LIBRARY[sectionKey];
}

export function getAllSectionKeys(): string[] {
  return Object.keys(SECTION_LIBRARY);
}

export function getMarinaSpecificSections(): SectionDefinition[] {
  return Object.values(SECTION_LIBRARY).filter(section => section.marinaSpecific);
}
