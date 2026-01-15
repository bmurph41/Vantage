import { db } from '../server/db';
import { 
  marinaSubjects, 
  compSets,
} from '../shared/schema';
import { v4 as uuid } from 'uuid';

const ORG_ID = 'cd3719c3-ef82-4ccc-acb9-261c80fb64b4';
const USER_ID = 'user-1';

async function seedMarinaComps() {
  console.log('Seeding Marina Comps data...');

  const subjectMarina = {
    id: uuid(),
    orgId: ORG_ID,
    name: 'Sunrise Harbor Marina',
    address: '100 Harbor Way',
    city: 'Fort Lauderdale',
    state: 'FL',
    zip: '33308',
    lat: '26.1224',
    lng: '-80.1373',
    slipsTotal: 150,
    racksTotal: 200,
    landStorageSqft: 15000,
    capacityIndex: '300.00',
    slipMix: { '20ft': 30, '30ft': 50, '40ft': 40, '50ft': 30 },
    capabilities: { fuel: true, pumpout: true, repair: true, store: true, restaurant: true },
    notes: 'Target acquisition marina for Q4 2025 analysis',
    createdBy: USER_ID,
  };

  const [subject] = await db.insert(marinaSubjects).values(subjectMarina).returning();
  console.log('Created subject marina:', subject.name);

  const rateCompSet = {
    id: uuid(),
    orgId: ORG_ID,
    name: 'Q4 2025 Rate Analysis - SE Florida',
    compType: 'RATE' as const,
    subjectId: subject.id,
    scoringConfig: {
      weights: { geo: 0.4, capacity: 0.3, slipMix: 0.2, capabilities: 0.1 },
      geoMaxMiles: 100,
    },
    status: 'draft',
    createdBy: USER_ID,
  };

  const [rateSet] = await db.insert(compSets).values(rateCompSet).returning();
  console.log('Created rate comp set:', rateSet.name);

  const salesCompSet = {
    id: uuid(),
    orgId: ORG_ID,
    name: 'Q4 2025 Sales Analysis - Florida',
    compType: 'SALES' as const,
    subjectId: subject.id,
    scoringConfig: {
      weights: { geo: 0.35, capacity: 0.35, slipMix: 0.2, capabilities: 0.1 },
      geoMaxMiles: 150,
    },
    status: 'draft',
    createdBy: USER_ID,
  };

  const [salesSet] = await db.insert(compSets).values(salesCompSet).returning();
  console.log('Created sales comp set:', salesSet.name);

  console.log('\nMarina Comps seed complete!');
  console.log(`Subject: ${subject.name} (${subject.id})`);
  console.log(`Rate Comp Set: ${rateSet.name} (${rateSet.id})`);
  console.log(`Sales Comp Set: ${salesSet.name} (${salesSet.id})`);
  console.log('\nNavigate to /analysis/marina-comps to view the data.');
  console.log('\nNote: Rate and Sales Comps already exist in the database.');
  console.log('Add them to the comp sets via the UI or API.');
  
  process.exit(0);
}

seedMarinaComps().catch((err) => {
  console.error('Error seeding marina comps:', err);
  process.exit(1);
});
