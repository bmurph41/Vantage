import { getUncachableStripeClient } from '../server/stripeClient';

const PACK_PRODUCTS = [
  {
    id: 'crm_pipeline',
    name: 'CRM & Pipeline',
    description: 'Deal management, contact tracking, pipeline stages, and activity logging',
    price: 9900,
  },
  {
    id: 'modeling_tools',
    name: 'Modeling Tools',
    description: 'Marina valuation, financial modeling, pro forma projections, and scenario analysis',
    price: 14900,
  },
  {
    id: 'analysis',
    name: 'Analysis',
    description: 'Sales comparables, rate comparisons, market demographics, and KPI analytics',
    price: 7900,
  },
  {
    id: 'operations',
    name: 'Operations',
    description: 'Fuel sales tracking, ship store management, rent roll, and launch scheduling',
    price: 12900,
  },
  {
    id: 'fund_management',
    name: 'Fund Management',
    description: 'PE fund lifecycle management, capital allocation, investor tracking, and fund returns',
    price: 19900,
  },
  {
    id: 'lp_portal',
    name: 'LP Portal',
    description: 'Dedicated investor portal with secure document sharing and performance reporting',
    price: 9900,
  },
  {
    id: 'prospecting',
    name: 'Prospecting',
    description: 'Premium outreach tools, lead scoring, and automated prospecting workflows',
    price: 7900,
  },
  {
    id: 'analytics_pro',
    name: 'Analytics Pro',
    description: 'Advanced analytics, custom dashboards, and detailed performance insights',
    price: 4900,
  },
];

async function seedProducts() {
  console.log('Starting Stripe product seeding...');
  
  const stripe = await getUncachableStripeClient();
  
  for (const pack of PACK_PRODUCTS) {
    const productIdKey = `pack_${pack.id}`;
    
    try {
      const existingProducts = await stripe.products.search({
        query: `metadata['pack_type']:'${pack.id}'`,
      });
      
      if (existingProducts.data.length > 0) {
        console.log(`Product already exists: ${pack.name} (${pack.id})`);
        continue;
      }
      
      console.log(`Creating product: ${pack.name}...`);
      
      const product = await stripe.products.create({
        name: `MarinaMatch - ${pack.name}`,
        description: pack.description,
        metadata: {
          pack_type: pack.id,
          is_marinamatch_pack: 'true',
        },
      });
      
      console.log(`  Created product: ${product.id}`);
      
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: pack.price,
        currency: 'usd',
        recurring: {
          interval: 'month',
        },
        metadata: {
          pack_type: pack.id,
        },
        lookup_key: `price_${pack.id}`,
      });
      
      console.log(`  Created price: ${price.id} ($${pack.price / 100}/month)`);
      
    } catch (error: any) {
      console.error(`Failed to create product ${pack.name}:`, error.message);
    }
  }
  
  console.log('\nProduct seeding complete!');
  console.log('\nYou can now update server/services/stripe-pack-service.ts with the actual price IDs.');
  
  console.log('\n--- Created Price IDs ---');
  const allPrices = await stripe.prices.list({ limit: 100, active: true });
  const packPrices = allPrices.data.filter(p => 
    p.metadata?.pack_type && p.recurring
  );
  
  for (const price of packPrices) {
    console.log(`${price.metadata.pack_type}: '${price.id}'`);
  }
}

seedProducts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
