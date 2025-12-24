import type { ListingPayloadV2, ValidationResult } from '../schema';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'PR', 'VI', 'GU', 'AS', 'MP',
];

const MIN_PRICE = 10_000;
const MAX_PRICE = 5_000_000_000;

export function validateListingPayload(payload: ListingPayloadV2): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!payload.source?.domain) {
    errors.push('Missing source.domain');
  }
  if (!payload.source?.url) {
    errors.push('Missing source.url');
  }
  
  if (!payload.identity?.canonicalListingId) {
    errors.push('Missing identity.canonicalListingId');
  }
  if (typeof payload.identity?.confidence !== 'number') {
    errors.push('Missing identity.confidence');
  }
  
  const hasTitle = payload.core?.title && payload.core.title.trim().length > 0;
  const hasDescription = payload.details?.description && payload.details.description.trim().length > 0;
  
  if (!hasTitle && !hasDescription) {
    errors.push('Listing must have either a title or description');
  }
  
  if (payload.pricing?.price?.amount !== undefined) {
    const amount = payload.pricing.price.amount;
    if (amount < MIN_PRICE) {
      warnings.push(`Price ${amount} is below minimum threshold (${MIN_PRICE})`);
    }
    if (amount > MAX_PRICE) {
      warnings.push(`Price ${amount} exceeds maximum threshold (${MAX_PRICE})`);
    }
    if (amount <= 0) {
      errors.push('Price must be positive');
    }
  }
  
  if (payload.location?.state) {
    const state = payload.location.state.toUpperCase();
    const isUS = !payload.location.country || payload.location.country.toUpperCase() === 'US' || payload.location.country.toUpperCase() === 'USA';
    
    if (isUS && !US_STATES.includes(state)) {
      warnings.push(`Invalid US state code: ${payload.location.state}`);
    }
  }
  
  if (payload.location?.lat !== undefined) {
    if (payload.location.lat < -90 || payload.location.lat > 90) {
      errors.push(`Invalid latitude: ${payload.location.lat}`);
    }
  }
  
  if (payload.location?.lng !== undefined) {
    if (payload.location.lng < -180 || payload.location.lng > 180) {
      errors.push(`Invalid longitude: ${payload.location.lng}`);
    }
  }
  
  if (!payload.media?.images || payload.media.images.length === 0) {
    warnings.push('No images found for listing');
  }
  
  if (payload.details?.acreage !== undefined && payload.details.acreage < 0) {
    errors.push('Acreage cannot be negative');
  }
  
  if (payload.details?.slips !== undefined && (payload.details.slips < 0 || payload.details.slips > 10000)) {
    warnings.push(`Unusual slip count: ${payload.details.slips}`);
  }
  
  if (payload.details?.capRate !== undefined) {
    if (payload.details.capRate < 0 || payload.details.capRate > 100) {
      warnings.push(`Cap rate ${payload.details.capRate}% seems unusual`);
    }
  }
  
  if (payload.details?.occupancy !== undefined) {
    if (payload.details.occupancy < 0 || payload.details.occupancy > 100) {
      warnings.push(`Occupancy ${payload.details.occupancy}% is out of expected range`);
    }
  }
  
  if (payload.details?.yearBuilt !== undefined) {
    const currentYear = new Date().getFullYear();
    if (payload.details.yearBuilt < 1800 || payload.details.yearBuilt > currentYear + 5) {
      warnings.push(`Year built ${payload.details.yearBuilt} seems unusual`);
    }
  }
  
  if (payload.contacts?.brokerEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.contacts.brokerEmail)) {
      warnings.push('Invalid broker email format');
    }
  }
  
  if (payload.contacts?.brokerPhone) {
    const digitsOnly = payload.contacts.brokerPhone.replace(/\D/g, '');
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      warnings.push('Broker phone number length seems unusual');
    }
  }
  
  if (!payload.timestamps?.scrapedAt) {
    errors.push('Missing timestamps.scrapedAt');
  }
  
  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

export function sanitizePayload(payload: ListingPayloadV2): ListingPayloadV2 {
  const sanitized = { ...payload };
  
  if (sanitized.core?.title) {
    sanitized.core.title = sanitized.core.title.trim().slice(0, 500);
  }
  
  if (sanitized.details?.description) {
    sanitized.details.description = sanitized.details.description.trim().slice(0, 50000);
  }
  
  if (sanitized.location?.address1) {
    sanitized.location.address1 = sanitized.location.address1.trim().slice(0, 500);
  }
  
  if (sanitized.location?.state) {
    sanitized.location.state = sanitized.location.state.toUpperCase().trim().slice(0, 2);
  }
  
  if (sanitized.location?.lat !== undefined) {
    sanitized.location.lat = Math.round(sanitized.location.lat * 1000000) / 1000000;
  }
  
  if (sanitized.location?.lng !== undefined) {
    sanitized.location.lng = Math.round(sanitized.location.lng * 1000000) / 1000000;
  }
  
  return sanitized;
}

export function shouldQuarantine(payload: ListingPayloadV2, validation: ValidationResult): { quarantine: boolean; reason: string } {
  if (!validation.ok) {
    return {
      quarantine: true,
      reason: `Validation errors: ${validation.errors.join('; ')}`,
    };
  }
  
  if (payload.identity.confidence < 75) {
    return {
      quarantine: true,
      reason: `Low identity confidence: ${payload.identity.confidence}%`,
    };
  }
  
  return { quarantine: false, reason: '' };
}
