/**
 * M&A Tracking Service for DockTalk
 * 
 * Specialized module for detecting and categorizing merger & acquisition
 * activity in the marina industry based on article content analysis.
 */

export interface MATrackingResult {
  isMAArticle: boolean;
  maType: 'acquisition' | 'merger' | 'sale' | 'purchase' | 'divestiture' | 'investment' | 'partnership' | null;
  confidence: number; // 0-100
  matchedKeywords: string[];
  parties: {
    buyer?: string;
    seller?: string;
    target?: string;
  };
  dealIndicators: {
    hasFinancialTerms: boolean;
    hasTransactionVerb: boolean;
    hasMarinaContext: boolean;
    hasCompanyNames: boolean;
  };
}

// M&A transaction keywords organized by category
const MA_KEYWORDS = {
  acquisition: [
    'acquisition', 'acquires', 'acquired', 'acquiring',
    'takeover', 'take over', 'takes over', 'taken over',
    'buyout', 'buy out', 'buys out', 'bought out',
    'purchase', 'purchases', 'purchased', 'purchasing',
    'bought', 'buying', 'to buy',
  ],
  merger: [
    'merger', 'merges', 'merged', 'merging',
    'merge with', 'merged with', 'merging with',
    'combination', 'combines with', 'combined with',
    'consolidation', 'consolidates', 'consolidated',
  ],
  sale: [
    'sale of', 'sells', 'sold', 'selling',
    'divests', 'divested', 'divestiture', 'divesting',
    'disposed', 'disposal', 'disposing',
    'offloads', 'offloaded', 'offloading',
    'exits', 'exited', 'exiting',
  ],
  investment: [
    'investment in', 'invests in', 'invested in', 'investing in',
    'stake in', 'stakes in', 'equity stake',
    'capital injection', 'recapitalization', 'recapitalized',
    'funding round', 'raises capital', 'raised capital',
    'private equity', 'pe firm', 'pe investment',
    'strategic investment', 'majority stake', 'minority stake',
  ],
  partnership: [
    'joint venture', 'jv', 'partnership', 'partners with',
    'strategic partnership', 'strategic alliance',
    'collaboration', 'collaborates with',
  ],
};

// Marina industry context keywords
const MARINA_CONTEXT_KEYWORDS = [
  'marina', 'marinas', 'harbor', 'harbour', 'port',
  'dock', 'docks', 'dockage', 'slip', 'slips',
  'boat', 'boats', 'boating', 'yacht', 'yachts',
  'waterfront', 'moorage', 'mooring', 'berth', 'berths',
  'dry stack', 'dry storage', 'boat storage',
  'marine', 'maritime', 'nautical',
  'boatyard', 'shipyard', 'boat sales',
];

// Known marina operators and PE firms for entity detection
const KNOWN_ENTITIES = [
  // Major Marina Operators
  'safe harbor', 'safe harbor marinas',
  'suntex', 'suntex marinas',
  'igy', 'igy marinas',
  'marinemax', 'marine max',
  'onewater', 'one water marine',
  'freedom boat club',
  'sun communities',
  'grove point', 'grove point marinas',
  'southern marinas',
  'vip marinas',
  'port 32', 'port 32 marinas',
  'acme marinas',
  'integra marinas',
  'windward marina group',
  'bowline marinas',
  'topside marinas',
  'oasis marinas',
  'ocean havens',
  'nautical boat club',
  'westrec', 'westrec marinas',
  // PE Firms & Investment Groups
  'allied strategic capital',
  'blackstone',
  'kkr',
  'brookfield',
  'apollo', 'apollo global',
  'carlyle', 'carlyle group',
  'tpg',
  'warburg pincus',
  'bain capital',
  'advent international',
  'centerbridge',
  'cerberus',
];

// Financial terms that indicate deal activity
const FINANCIAL_TERMS = [
  '$', 'million', 'billion', 'valuation', 'transaction value',
  'deal value', 'purchase price', 'enterprise value',
  'terms of the deal', 'undisclosed amount', 'reported',
  'cap rate', 'multiple', 'ebitda', 'noi',
];

/**
 * Analyze article content for M&A activity
 */
export function analyzeMAContent(title: string, content: string, summary?: string): MATrackingResult {
  const fullText = `${title} ${summary || ''} ${content || ''}`.toLowerCase();
  
  const result: MATrackingResult = {
    isMAArticle: false,
    maType: null,
    confidence: 0,
    matchedKeywords: [],
    parties: {},
    dealIndicators: {
      hasFinancialTerms: false,
      hasTransactionVerb: false,
      hasMarinaContext: false,
      hasCompanyNames: false,
    },
  };
  
  // Check for marina industry context
  const marinaMatches = MARINA_CONTEXT_KEYWORDS.filter(kw => fullText.includes(kw));
  result.dealIndicators.hasMarinaContext = marinaMatches.length > 0;
  
  // Check for known entities
  const entityMatches = KNOWN_ENTITIES.filter(entity => fullText.includes(entity));
  result.dealIndicators.hasCompanyNames = entityMatches.length > 0;
  
  // Check for financial terms
  const financialMatches = FINANCIAL_TERMS.filter(term => fullText.includes(term));
  result.dealIndicators.hasFinancialTerms = financialMatches.length > 0;
  
  // Check for M&A keywords by category
  let maTypeScores: Record<string, number> = {
    acquisition: 0,
    merger: 0,
    sale: 0,
    investment: 0,
    partnership: 0,
  };
  
  for (const [category, keywords] of Object.entries(MA_KEYWORDS)) {
    const matches = keywords.filter(kw => fullText.includes(kw));
    maTypeScores[category] = matches.length;
    result.matchedKeywords.push(...matches);
  }
  
  result.dealIndicators.hasTransactionVerb = result.matchedKeywords.length > 0;
  
  // Determine the primary M&A type
  const maxScore = Math.max(...Object.values(maTypeScores));
  if (maxScore > 0) {
    const topType = Object.entries(maTypeScores)
      .filter(([_, score]) => score === maxScore)
      .map(([type]) => type)[0];
    
    switch (topType) {
      case 'acquisition':
        result.maType = 'acquisition';
        break;
      case 'merger':
        result.maType = 'merger';
        break;
      case 'sale':
        result.maType = maTypeScores.sale > maTypeScores.acquisition ? 'sale' : 'divestiture';
        break;
      case 'investment':
        result.maType = 'investment';
        break;
      case 'partnership':
        result.maType = 'partnership';
        break;
    }
  }
  
  // Calculate confidence score
  let confidence = 0;
  
  // Base score from keyword matches
  confidence += Math.min(result.matchedKeywords.length * 15, 40);
  
  // Marina context bonus
  if (result.dealIndicators.hasMarinaContext) {
    confidence += 20;
  }
  
  // Known entity bonus
  if (result.dealIndicators.hasCompanyNames) {
    confidence += 15;
  }
  
  // Financial terms bonus
  if (result.dealIndicators.hasFinancialTerms) {
    confidence += 15;
  }
  
  // Title match bonus (more reliable than body text)
  const titleLower = title.toLowerCase();
  const titleHasMAKeyword = Object.values(MA_KEYWORDS)
    .flat()
    .some(kw => titleLower.includes(kw));
  if (titleHasMAKeyword) {
    confidence += 10;
  }
  
  result.confidence = Math.min(confidence, 100);
  
  // Determine if this is an M&A article (threshold: 40%)
  result.isMAArticle = result.confidence >= 40 && 
    result.dealIndicators.hasTransactionVerb &&
    (result.dealIndicators.hasMarinaContext || result.dealIndicators.hasCompanyNames);
  
  // Extract parties if possible
  if (result.isMAArticle) {
    result.parties = extractParties(fullText, entityMatches);
  }
  
  return result;
}

/**
 * Extract buyer/seller parties from text
 */
function extractParties(text: string, knownEntities: string[]): MATrackingResult['parties'] {
  const parties: MATrackingResult['parties'] = {};
  
  // Try to identify buyer/seller based on patterns
  const acquiresPattern = /(\w+(?:\s+\w+)*)\s+(?:acquires|purchases|buys|bought)\s+(\w+(?:\s+\w+)*)/i;
  const soldToPattern = /(\w+(?:\s+\w+)*)\s+(?:sold|sells)\s+(?:to)\s+(\w+(?:\s+\w+)*)/i;
  const acquiredByPattern = /(\w+(?:\s+\w+)*)\s+(?:acquired|purchased|bought)\s+by\s+(\w+(?:\s+\w+)*)/i;
  
  let match = text.match(acquiresPattern);
  if (match) {
    parties.buyer = match[1].trim();
    parties.target = match[2].trim();
  }
  
  match = text.match(soldToPattern);
  if (match) {
    parties.seller = match[1].trim();
    parties.buyer = match[2].trim();
  }
  
  match = text.match(acquiredByPattern);
  if (match) {
    parties.target = match[1].trim();
    parties.buyer = match[2].trim();
  }
  
  // If we have known entities but couldn't parse pattern, use first two as buyer/seller
  if (!parties.buyer && !parties.seller && knownEntities.length >= 1) {
    parties.buyer = knownEntities[0];
    if (knownEntities.length >= 2) {
      parties.target = knownEntities[1];
    }
  }
  
  return parties;
}

/**
 * Quick check if an article might be M&A related (fast pre-filter)
 */
export function quickMACheck(title: string): boolean {
  const titleLower = title.toLowerCase();
  
  // Quick keywords for title scanning
  const quickKeywords = [
    'acquisition', 'acquires', 'acquired', 'acquiring',
    'merger', 'merges', 'merged',
    'purchase', 'purchases', 'purchased',
    'sale', 'sells', 'sold',
    'bought', 'buys', 'buying',
    'investment', 'invests',
    'takeover', 'buyout',
    'divests', 'divestiture',
    'joint venture', 'partnership',
  ];
  
  return quickKeywords.some(kw => titleLower.includes(kw));
}

/**
 * Categorize M&A activity type for reporting
 */
export function getMACategoryLabel(maType: MATrackingResult['maType']): string {
  switch (maType) {
    case 'acquisition':
      return 'Acquisition';
    case 'merger':
      return 'Merger';
    case 'sale':
      return 'Asset Sale';
    case 'purchase':
      return 'Purchase';
    case 'divestiture':
      return 'Divestiture';
    case 'investment':
      return 'Investment/Financing';
    case 'partnership':
      return 'Strategic Partnership';
    default:
      return 'Unknown';
  }
}

export { MA_KEYWORDS, MARINA_CONTEXT_KEYWORDS, KNOWN_ENTITIES };
