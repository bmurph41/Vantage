import { getUncachableStripeClient } from './stripeClient';

interface MarinaProduct {
  name: string;
  description: string;
  metadata: Record<string, string>;
  prices: {
    unitAmount: number;
    currency: string;
    recurring?: { interval: 'month' | 'year' };
    nickname: string;
  }[];
}

const marinaProducts: MarinaProduct[] = [
  {
    name: 'Slip Rental - Small (Up to 25ft)',
    description: 'Monthly slip rental for boats up to 25 feet in length',
    metadata: {
      category: 'slip_rental',
      size: 'small',
      maxLength: '25',
    },
    prices: [
      { unitAmount: 35000, currency: 'usd', recurring: { interval: 'month' }, nickname: 'Monthly' },
      { unitAmount: 378000, currency: 'usd', recurring: { interval: 'year' }, nickname: 'Annual (10% off)' },
    ],
  },
  {
    name: 'Slip Rental - Medium (26-35ft)',
    description: 'Monthly slip rental for boats 26 to 35 feet in length',
    metadata: {
      category: 'slip_rental',
      size: 'medium',
      maxLength: '35',
    },
    prices: [
      { unitAmount: 55000, currency: 'usd', recurring: { interval: 'month' }, nickname: 'Monthly' },
      { unitAmount: 594000, currency: 'usd', recurring: { interval: 'year' }, nickname: 'Annual (10% off)' },
    ],
  },
  {
    name: 'Slip Rental - Large (36-50ft)',
    description: 'Monthly slip rental for boats 36 to 50 feet in length',
    metadata: {
      category: 'slip_rental',
      size: 'large',
      maxLength: '50',
    },
    prices: [
      { unitAmount: 85000, currency: 'usd', recurring: { interval: 'month' }, nickname: 'Monthly' },
      { unitAmount: 918000, currency: 'usd', recurring: { interval: 'year' }, nickname: 'Annual (10% off)' },
    ],
  },
  {
    name: 'Dry Stack Storage',
    description: 'Monthly dry stack storage with launch and retrieval service',
    metadata: {
      category: 'dry_stack',
      includesLaunch: 'true',
    },
    prices: [
      { unitAmount: 45000, currency: 'usd', recurring: { interval: 'month' }, nickname: 'Monthly' },
      { unitAmount: 486000, currency: 'usd', recurring: { interval: 'year' }, nickname: 'Annual (10% off)' },
    ],
  },
  {
    name: 'Launch Service',
    description: 'Single boat launch from dry stack to water',
    metadata: {
      category: 'service',
      type: 'launch',
    },
    prices: [
      { unitAmount: 2500, currency: 'usd', nickname: 'Per Launch' },
    ],
  },
  {
    name: 'Retrieval Service',
    description: 'Single boat retrieval from water to dry stack',
    metadata: {
      category: 'service',
      type: 'retrieval',
    },
    prices: [
      { unitAmount: 2500, currency: 'usd', nickname: 'Per Retrieval' },
    ],
  },
  {
    name: 'Fuel Service',
    description: 'Fuel delivery and fill-up service (price per gallon)',
    metadata: {
      category: 'service',
      type: 'fuel',
    },
    prices: [
      { unitAmount: 450, currency: 'usd', nickname: 'Per Gallon' },
    ],
  },
  {
    name: 'Marina Membership - Basic',
    description: 'Basic marina membership with access to facilities',
    metadata: {
      category: 'membership',
      tier: 'basic',
    },
    prices: [
      { unitAmount: 9900, currency: 'usd', recurring: { interval: 'month' }, nickname: 'Monthly' },
      { unitAmount: 99900, currency: 'usd', recurring: { interval: 'year' }, nickname: 'Annual (Save 15%)' },
    ],
  },
  {
    name: 'Marina Membership - Premium',
    description: 'Premium membership with unlimited launches and priority service',
    metadata: {
      category: 'membership',
      tier: 'premium',
      unlimitedLaunches: 'true',
      priorityService: 'true',
    },
    prices: [
      { unitAmount: 29900, currency: 'usd', recurring: { interval: 'month' }, nickname: 'Monthly' },
      { unitAmount: 299900, currency: 'usd', recurring: { interval: 'year' }, nickname: 'Annual (Save 15%)' },
    ],
  },
  {
    name: 'Transient Dockage',
    description: 'Daily transient slip rental for visiting boats',
    metadata: {
      category: 'transient',
      type: 'dockage',
    },
    prices: [
      { unitAmount: 7500, currency: 'usd', nickname: 'Per Night' },
    ],
  },
];

async function seedProducts() {
  console.log('Starting marina product seeding...');
  const stripe = await getUncachableStripeClient();

  for (const product of marinaProducts) {
    try {
      const existingProducts = await stripe.products.search({
        query: `name:'${product.name}'`,
      });

      if (existingProducts.data.length > 0) {
        console.log(`Product already exists: ${product.name}`);
        continue;
      }

      const stripeProduct = await stripe.products.create({
        name: product.name,
        description: product.description,
        metadata: product.metadata,
      });

      console.log(`Created product: ${product.name} (${stripeProduct.id})`);

      for (const price of product.prices) {
        const priceData: any = {
          product: stripeProduct.id,
          unit_amount: price.unitAmount,
          currency: price.currency,
          nickname: price.nickname,
        };

        if (price.recurring) {
          priceData.recurring = price.recurring;
        }

        const stripePrice = await stripe.prices.create(priceData);
        console.log(`  Created price: ${price.nickname} (${stripePrice.id})`);
      }
    } catch (error) {
      console.error(`Error creating product ${product.name}:`, error);
    }
  }

  console.log('Product seeding complete!');
}

seedProducts().catch(console.error);
