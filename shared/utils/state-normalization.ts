const STATE_MAPPING: Record<string, string> = {
  'alabama': 'AL',
  'alaska': 'AK',
  'arizona': 'AZ',
  'arkansas': 'AR',
  'california': 'CA',
  'colorado': 'CO',
  'connecticut': 'CT',
  'delaware': 'DE',
  'florida': 'FL',
  'georgia': 'GA',
  'hawaii': 'HI',
  'idaho': 'ID',
  'illinois': 'IL',
  'indiana': 'IN',
  'iowa': 'IA',
  'kansas': 'KS',
  'kentucky': 'KY',
  'louisiana': 'LA',
  'maine': 'ME',
  'maryland': 'MD',
  'massachusetts': 'MA',
  'michigan': 'MI',
  'minnesota': 'MN',
  'mississippi': 'MS',
  'missouri': 'MO',
  'montana': 'MT',
  'nebraska': 'NE',
  'nevada': 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  'ohio': 'OH',
  'oklahoma': 'OK',
  'oregon': 'OR',
  'pennsylvania': 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  'tennessee': 'TN',
  'texas': 'TX',
  'utah': 'UT',
  'vermont': 'VT',
  'virginia': 'VA',
  'washington': 'WA',
  'west virginia': 'WV',
  'wisconsin': 'WI',
  'wyoming': 'WY',
  'district of columbia': 'DC',
  'puerto rico': 'PR',
  'guam': 'GU',
  'us virgin islands': 'VI',
  'american samoa': 'AS',
  'northern mariana islands': 'MP',
};

const VALID_STATE_CODES = new Set(Object.values(STATE_MAPPING));

export function normalizeState(input: string | undefined | null): string {
  if (!input) return '';
  
  const trimmed = input.trim();
  if (!trimmed) return '';
  
  const upper = trimmed.toUpperCase();
  if (upper.length === 2 && VALID_STATE_CODES.has(upper)) {
    return upper;
  }
  
  const lower = trimmed.toLowerCase();
  const mapped = STATE_MAPPING[lower];
  if (mapped) {
    return mapped;
  }
  
  if (upper.length === 2) {
    return upper;
  }
  
  return trimmed;
}

export function isValidStateCode(code: string): boolean {
  return VALID_STATE_CODES.has(code.toUpperCase());
}

export function getStateName(code: string): string | null {
  const upperCode = code.toUpperCase();
  for (const [name, abbr] of Object.entries(STATE_MAPPING)) {
    if (abbr === upperCode) {
      return name.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    }
  }
  return null;
}
