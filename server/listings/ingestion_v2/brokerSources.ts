import { Liv2SourceRules } from './schema';

export type BrokerSourceType = 'broker' | 'listing_site' | 'mls';
export type ScrapingFrequency = 'daily' | 'weekly' | 'bi-weekly' | 'monthly';

export interface BrokerSourceConfig {
  name: string;
  domain: string;
  type: 'html' | 'api';
  sourceType: BrokerSourceType;
  frequency: ScrapingFrequency;
  rules: Liv2SourceRules;
  isActive: boolean;
  description?: string;
}

export const BROKER_SOURCES: BrokerSourceConfig[] = [
  {
    name: 'YachtWorld Commercial',
    domain: 'yachtworld.com',
    type: 'html',
    sourceType: 'listing_site',
    frequency: 'weekly',
    isActive: true,
    description: 'Commercial marina and boatyard listings from YachtWorld',
    rules: {
      urlPatterns: {
        listing: '/boats-for-sale/type/marina|/commercial/',
        index: '/boats-for-sale/',
      },
      contentSelectors: {
        title: 'h1.listing-title',
        price: '.listing-price',
        description: '.listing-description',
        gallery: '.listing-gallery img',
        broker: '.broker-info',
      },
      imageAllowPatterns: ['*.jpg', '*.jpeg', '*.png', '*.webp'],
      rateLimit: {
        requestsPerMinute: 10,
        delayMs: 6000,
      },
    },
  },
  {
    name: 'Boats.com Marinas',
    domain: 'boats.com',
    type: 'html',
    sourceType: 'listing_site',
    frequency: 'weekly',
    isActive: true,
    description: 'Marina and boatyard property listings from Boats.com',
    rules: {
      urlPatterns: {
        listing: '/listing/marina|/listing/boatyard',
        index: '/search/',
      },
      contentSelectors: {
        title: '.boat-title',
        price: '.price-value',
        description: '.description-text',
        gallery: '.photo-gallery img',
        broker: '.dealer-info',
      },
      imageAllowPatterns: ['*.jpg', '*.jpeg', '*.png'],
      rateLimit: {
        requestsPerMinute: 15,
        delayMs: 4000,
      },
    },
  },
  {
    name: 'MarinaBrokers.com',
    domain: 'marinabrokers.com',
    type: 'html',
    sourceType: 'broker',
    frequency: 'weekly',
    isActive: true,
    description: 'Dedicated marina brokerage platform',
    rules: {
      urlPatterns: {
        listing: '/listings/',
        index: '/marinas-for-sale/',
      },
      contentSelectors: {
        title: 'h1.property-title',
        price: '.asking-price',
        address: '.property-location',
        description: '.property-description',
        gallery: '.property-photos img',
        broker: '.agent-info',
      },
      imageAllowPatterns: ['*.jpg', '*.jpeg', '*.png', '*.webp'],
      rateLimit: {
        requestsPerMinute: 20,
        delayMs: 3000,
      },
    },
  },
  {
    name: 'Merritt Smith Marinas',
    domain: 'merrittsmith.com',
    type: 'html',
    sourceType: 'broker',
    frequency: 'bi-weekly',
    isActive: true,
    description: 'Merritt Smith marina and waterfront property brokerage',
    rules: {
      urlPatterns: {
        listing: '/property/',
        index: '/listings/',
      },
      contentSelectors: {
        title: '.property-name',
        price: '.property-price',
        address: '.property-address',
        description: '.property-details',
        gallery: '.gallery-images img',
        broker: '.broker-contact',
      },
      imageAllowPatterns: ['*.jpg', '*.jpeg', '*.png'],
      rateLimit: {
        requestsPerMinute: 15,
        delayMs: 4000,
      },
    },
  },
  {
    name: 'Waterfront Ventures',
    domain: 'waterfrontventures.com',
    type: 'html',
    sourceType: 'broker',
    frequency: 'bi-weekly',
    isActive: true,
    description: 'Waterfront and marina investment properties',
    rules: {
      urlPatterns: {
        listing: '/properties/',
        index: '/available-properties/',
      },
      contentSelectors: {
        title: 'h1.listing-title',
        price: '.price-display',
        address: '.location-info',
        description: '.listing-details',
        gallery: '.property-gallery img',
        broker: '.contact-info',
      },
      imageAllowPatterns: ['*.jpg', '*.jpeg', '*.png', '*.webp'],
      rateLimit: {
        requestsPerMinute: 12,
        delayMs: 5000,
      },
    },
  },
  {
    name: 'Marine Asset Partners',
    domain: 'marineassetpartners.com',
    type: 'html',
    sourceType: 'broker',
    frequency: 'weekly',
    isActive: true,
    description: 'Marina and marine asset investment broker',
    rules: {
      urlPatterns: {
        listing: '/marina/',
        index: '/portfolio/',
      },
      contentSelectors: {
        title: '.asset-title',
        price: '.asset-price',
        address: '.asset-location',
        description: '.asset-description',
        gallery: '.asset-gallery img',
        broker: '.broker-info',
      },
      imageAllowPatterns: ['*.jpg', '*.jpeg', '*.png'],
      rateLimit: {
        requestsPerMinute: 20,
        delayMs: 3000,
      },
    },
  },
  {
    name: 'Marina Properties International',
    domain: 'marinaproperties.com',
    type: 'html',
    sourceType: 'broker',
    frequency: 'weekly',
    isActive: true,
    description: 'International marina properties and investments',
    rules: {
      urlPatterns: {
        listing: '/listing/',
        index: '/search/',
      },
      contentSelectors: {
        title: 'h1.property-title',
        price: '.listing-price',
        address: '.property-address',
        description: '.property-content',
        gallery: '.property-images img',
        broker: '.agent-details',
      },
      imageAllowPatterns: ['*.jpg', '*.jpeg', '*.png', '*.webp'],
      rateLimit: {
        requestsPerMinute: 15,
        delayMs: 4000,
      },
    },
  },
  {
    name: 'Coastal Marina Investments',
    domain: 'coastalmarinainvestments.com',
    type: 'html',
    sourceType: 'broker',
    frequency: 'bi-weekly',
    isActive: true,
    description: 'Coastal marina investment properties',
    rules: {
      urlPatterns: {
        listing: '/investment/',
        index: '/opportunities/',
      },
      contentSelectors: {
        title: '.investment-title',
        price: '.investment-price',
        address: '.investment-location',
        description: '.investment-details',
        gallery: '.investment-gallery img',
        broker: '.contact-section',
      },
      imageAllowPatterns: ['*.jpg', '*.jpeg', '*.png'],
      rateLimit: {
        requestsPerMinute: 10,
        delayMs: 6000,
      },
    },
  },
  {
    name: 'FirstBoat Marinas',
    domain: 'firstboatmarinas.com',
    type: 'html',
    sourceType: 'broker',
    frequency: 'weekly',
    isActive: true,
    description: 'FirstBoat marina acquisition and sales',
    rules: {
      urlPatterns: {
        listing: '/marinas/',
        index: '/available/',
      },
      contentSelectors: {
        title: '.marina-title',
        price: '.marina-price',
        address: '.marina-location',
        description: '.marina-description',
        gallery: '.marina-photos img',
        broker: '.broker-details',
      },
      imageAllowPatterns: ['*.jpg', '*.jpeg', '*.png', '*.webp'],
      rateLimit: {
        requestsPerMinute: 15,
        delayMs: 4000,
      },
    },
  },
  {
    name: 'Marina Max Partners',
    domain: 'marinamaxpartners.com',
    type: 'html',
    sourceType: 'broker',
    frequency: 'weekly',
    isActive: true,
    description: 'Marina Max investment and partnership opportunities',
    rules: {
      urlPatterns: {
        listing: '/property/',
        index: '/listings/',
      },
      contentSelectors: {
        title: 'h1.property-name',
        price: '.property-asking-price',
        address: '.property-location',
        description: '.property-overview',
        gallery: '.property-gallery img',
        broker: '.agent-info',
      },
      imageAllowPatterns: ['*.jpg', '*.jpeg', '*.png'],
      rateLimit: {
        requestsPerMinute: 20,
        delayMs: 3000,
      },
    },
  },
  {
    name: 'Sunbelt Business Brokers (Marinas)',
    domain: 'sunbeltnetwork.com',
    type: 'html',
    sourceType: 'broker',
    frequency: 'weekly',
    isActive: true,
    description: 'Sunbelt Business Brokers marina category listings',
    rules: {
      urlPatterns: {
        listing: '/business-for-sale/*/marina',
        index: '/search/marina',
      },
      contentSelectors: {
        title: '.business-title',
        price: '.asking-price',
        address: '.business-location',
        description: '.business-description',
        gallery: '.business-photos img',
        broker: '.broker-contact',
      },
      imageAllowPatterns: ['*.jpg', '*.jpeg', '*.png', '*.webp'],
      jsonLdType: 'Product',
      rateLimit: {
        requestsPerMinute: 10,
        delayMs: 6000,
      },
    },
  },
  {
    name: 'LoopNet Marinas',
    domain: 'loopnet.com',
    type: 'html',
    sourceType: 'listing_site',
    frequency: 'weekly',
    isActive: true,
    description: 'Commercial real estate platform with marina listings',
    rules: {
      urlPatterns: {
        listing: '/Listing/',
        index: '/search/marina',
      },
      contentSelectors: {
        title: 'h1.placard-heading',
        price: '.pricing-info',
        address: '.property-address',
        description: '.description-section',
        gallery: '.gallery-photos img',
        broker: '.contact-card',
      },
      imageAllowPatterns: ['*.jpg', '*.jpeg', '*.png'],
      rateLimit: {
        requestsPerMinute: 8,
        delayMs: 7500,
      },
    },
  },
  {
    name: 'Crexi Marinas',
    domain: 'crexi.com',
    type: 'html',
    sourceType: 'mls',
    frequency: 'weekly',
    isActive: true,
    description: 'Commercial real estate marketplace with marina properties',
    rules: {
      urlPatterns: {
        listing: '/properties/',
        index: '/search/',
      },
      contentSelectors: {
        title: '.property-title',
        price: '.price-amount',
        address: '.address-line',
        description: '.property-overview',
        gallery: '.gallery-container img',
        broker: '.listing-agent',
      },
      imageAllowPatterns: ['*.jpg', '*.jpeg', '*.png', '*.webp'],
      rateLimit: {
        requestsPerMinute: 12,
        delayMs: 5000,
      },
    },
  },
];

export function getBrokerSourceByDomain(domain: string): BrokerSourceConfig | undefined {
  return BROKER_SOURCES.find(s => s.domain === domain);
}

export function getActiveBrokerSources(): BrokerSourceConfig[] {
  return BROKER_SOURCES.filter(s => s.isActive);
}

export function getBrokerSourcesByType(type: BrokerSourceType): BrokerSourceConfig[] {
  return BROKER_SOURCES.filter(s => s.sourceType === type);
}

export function getBrokerSourcesByFrequency(frequency: ScrapingFrequency): BrokerSourceConfig[] {
  return BROKER_SOURCES.filter(s => s.frequency === frequency);
}
