// State name to abbreviation mapping
const stateMap: Record<string, string> = {
  // Full state names to abbreviations
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
  // Common variations
  'wash': 'WA',
  'washington state': 'WA',
  'dc': 'DC',
  'washington dc': 'DC',
  'washington d.c.': 'DC'
};

/**
 * Converts a state name to its two-letter abbreviation
 * If the input is already a valid abbreviation, returns it as-is
 * If no match is found, returns the original input
 */
export function toStateAbbr(input: string): string {
  if (!input || typeof input !== 'string') {
    return input;
  }

  const trimmed = input.trim();
  
  // If it's already a 2-letter code, return it uppercase
  if (trimmed.length === 2 && /^[A-Za-z]{2}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  // Check if it's a full state name
  const normalized = trimmed.toLowerCase();
  const abbreviation = stateMap[normalized];
  
  if (abbreviation) {
    return abbreviation;
  }

  // Return original input if no match found
  return trimmed;
}