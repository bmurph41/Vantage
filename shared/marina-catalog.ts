export interface CatalogProfitCenter {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'core' | 'ancillary' | 'specialty';
  scLegacyField?: string;
  scLegacyTypeField?: string;
}

export interface CatalogAmenity {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'facility' | 'utility' | 'recreation' | 'convenience';
}

export const PROFIT_CENTER_CATALOG: CatalogProfitCenter[] = [
  { id: 'storage', name: 'Storage', description: 'Wet slips, dry storage, moorings, and other boat storage revenue', icon: 'warehouse', category: 'core', scLegacyField: 'profitCenterStorage' },
  { id: 'fuel', name: 'Fuel Sales', description: 'Gasoline, diesel, and other fuel sales at the fuel dock', icon: 'fuel', category: 'core', scLegacyField: 'profitCenterFuel', scLegacyTypeField: 'profitCenterFuelType' },
  { id: 'ship_store', name: "Ship's Store", description: 'Retail merchandise, boating supplies, snacks, and convenience items', icon: 'shoppingcart', category: 'core', scLegacyField: 'profitCenterShipStore', scLegacyTypeField: 'profitCenterShipStoreType' },
  { id: 'service', name: 'Service & Repairs', description: 'Boat maintenance, engine repair, detailing, and winterization', icon: 'wrench', category: 'core', scLegacyField: 'profitCenterService' },
  { id: 'parts', name: 'Parts', description: 'Marine parts and accessories sales', icon: 'wrench', category: 'core', scLegacyField: 'profitCenterParts', scLegacyTypeField: 'profitCenterPartsType' },
  { id: 'boat_sales', name: 'Boat Sales', description: 'New or used boat sales revenue', icon: 'store', category: 'specialty', scLegacyField: 'profitCenterBoatSales', scLegacyTypeField: 'profitCenterBoatSalesType' },
  { id: 'boat_brokerage', name: 'Boat Brokerage', description: 'Brokerage commissions on boat transactions', icon: 'store', category: 'specialty', scLegacyField: 'profitCenterBoatBrokerage', scLegacyTypeField: 'profitCenterBoatBrokerageType' },
  { id: 'boat_rentals', name: 'Boat Rentals', description: 'Rental fleet income from kayaks, pontoons, jet skis, etc.', icon: 'sailboat', category: 'ancillary', scLegacyField: 'profitCenterBoatRentals', scLegacyTypeField: 'profitCenterBoatRentalsType' },
  { id: 'boat_club', name: 'Boat Club', description: 'Membership-based boat club with recurring fees', icon: 'users', category: 'specialty', scLegacyField: 'profitCenterBoatClub', scLegacyTypeField: 'profitCenterBoatClubType' },
  { id: 'commercial_tenants', name: 'Third-Party Leases', description: 'Leased spaces to restaurants, shops, or other businesses', icon: 'building', category: 'ancillary', scLegacyField: 'profitCenterThirdPartyLeases' },
  { id: 'restaurant', name: 'F&B / Restaurant', description: 'On-site food & beverage operations or concessions', icon: 'utensils', category: 'ancillary', scLegacyField: 'profitCenterFnb', scLegacyTypeField: 'profitCenterFnbType' },
  { id: 'transient', name: 'Transient Dockage', description: 'Short-term or overnight slip rentals for visiting boaters', icon: 'anchor', category: 'core' },
  { id: 'events', name: 'Events', description: 'Event venue rental for weddings, corporate events, and gatherings', icon: 'building', category: 'ancillary', scLegacyField: 'profitCenterEvents' },
  { id: 'rv_park', name: 'RV Park', description: 'RV parking and camping site rentals', icon: 'car', category: 'specialty', scLegacyField: 'profitCenterRvPark' },
  { id: 'hospitality', name: 'Hospitality / Accommodations', description: 'Lodging, hotel rooms, cabins, or vacation rental units', icon: 'home', category: 'specialty', scLegacyField: 'profitCenterHospitality', scLegacyTypeField: 'profitCenterHospitalityType' },
  { id: 'haul_out', name: 'Haul-Out / Travel Lift', description: 'Boat haul-out, launch, and travel lift services', icon: 'container', category: 'core' },
  { id: 'winter_storage', name: 'Winterization / Shrink Wrap', description: 'Seasonal winterization, shrink wrapping, and decommissioning', icon: 'warehouse', category: 'ancillary' },
  { id: 'charter_tours', name: 'Charters / Tours', description: 'Fishing charters, sunset cruises, and sightseeing tours', icon: 'sailboat', category: 'specialty' },
  { id: 'sailing_school', name: 'Sailing / Boating School', description: 'Boating education, sailing lessons, and certification courses', icon: 'sailboat', category: 'specialty' },
  { id: 'bait_tackle', name: 'Bait & Tackle', description: 'Live bait, tackle, and fishing supply sales', icon: 'anchor', category: 'ancillary' },
  { id: 'towing_salvage', name: 'Towing / Salvage', description: 'On-water towing assistance and salvage operations', icon: 'ship', category: 'specialty' },
  { id: 'insurance_commissions', name: 'Insurance Commissions', description: 'Commissions from marine insurance referrals or in-house policies', icon: 'store', category: 'specialty' },
  { id: 'membership_fees', name: 'Membership / Association Fees', description: 'Annual or monthly membership dues, yacht club fees', icon: 'users', category: 'ancillary' },
];

export const AMENITY_CATALOG: CatalogAmenity[] = [
  { id: 'launch_ramp', name: 'Launch Ramp', description: 'Public or private boat ramp for launching vessels', icon: 'waves', category: 'facility' },
  { id: 'pump_out', name: 'Pump-Out Station', description: 'Waste pump-out services for docked vessels', icon: 'anchor', category: 'facility' },
  { id: 'electric_shore_power', name: 'Electric / Shore Power', description: 'Electrical hookups for docked vessels', icon: 'fuel', category: 'utility' },
  { id: 'water_hookup', name: 'Water Hookup', description: 'Water supply connections for docked vessels', icon: 'waves', category: 'utility' },
  { id: 'wifi_cable', name: 'Wi-Fi / Cable', description: 'Internet and cable TV service for slip holders', icon: 'building', category: 'utility' },
  { id: 'parking', name: 'Parking', description: 'Vehicle parking for slip holders and visitors', icon: 'car', category: 'convenience' },
  { id: 'laundry', name: 'Laundry', description: 'Coin-operated laundry facilities', icon: 'home', category: 'convenience' },
  { id: 'showers', name: 'Showers / Restrooms', description: 'Shower and restroom facilities for boaters', icon: 'home', category: 'convenience' },
  { id: 'lockers', name: 'Lockers', description: 'Storage lockers for personal belongings', icon: 'container', category: 'convenience' },
  { id: 'pool', name: 'Pool', description: 'Swimming pool for marina members and guests', icon: 'waves', category: 'recreation' },
  { id: 'fitness_center', name: 'Fitness Center', description: 'Gym or fitness facilities on-site', icon: 'users', category: 'recreation' },
  { id: 'clubhouse', name: 'Clubhouse / Lounge', description: 'Social gathering space for marina community', icon: 'building', category: 'recreation' },
  { id: 'playground', name: 'Playground / Kids Area', description: 'Children play area for families', icon: 'home', category: 'recreation' },
  { id: 'dog_park', name: 'Dog Park / Pet Area', description: 'Designated area for pets', icon: 'home', category: 'recreation' },
  { id: 'ice', name: 'Ice Machine', description: 'Ice vending for boaters', icon: 'container', category: 'convenience' },
  { id: 'security', name: 'Security / Gated Access', description: 'Gated entry, security cameras, or guard service', icon: 'building', category: 'facility' },
  { id: 'boat_detailing', name: 'Boat Detailing Area', description: 'Designated area for hull cleaning, waxing, and cosmetic work', icon: 'wrench', category: 'facility' },
  { id: 'picnic_area', name: 'Picnic / BBQ Area', description: 'Outdoor picnic tables and BBQ grills', icon: 'utensils', category: 'recreation' },
  { id: 'ship_chandlery', name: 'Ship Chandlery', description: 'Marine hardware and supplies outlet', icon: 'shoppingcart', category: 'convenience' },
  { id: 'dinghy_dock', name: 'Dinghy Dock', description: 'Designated dock space for dinghies and tenders', icon: 'anchor', category: 'facility' },
];

export const PROFIT_CENTER_CATEGORIES: Record<string, string> = {
  core: 'Core Revenue',
  ancillary: 'Ancillary Revenue',
  specialty: 'Specialty / Add-On',
};

export const AMENITY_CATEGORIES: Record<string, string> = {
  facility: 'Facilities',
  utility: 'Utilities',
  recreation: 'Recreation',
  convenience: 'Convenience',
};

export function getProfitCenterById(id: string): CatalogProfitCenter | undefined {
  return PROFIT_CENTER_CATALOG.find(pc => pc.id === id);
}

export function getAmenityById(id: string): CatalogAmenity | undefined {
  return AMENITY_CATALOG.find(a => a.id === id);
}

export function profitCenterToScLegacy(enabledIds: string[]): Record<string, boolean | string> {
  const result: Record<string, boolean | string> = {};
  for (const pc of PROFIT_CENTER_CATALOG) {
    if (pc.scLegacyField) {
      result[pc.scLegacyField] = enabledIds.includes(pc.id);
    }
  }
  return result;
}

export function scLegacyToProfitCenterIds(comp: Record<string, any>): string[] {
  const ids: string[] = [];
  for (const pc of PROFIT_CENTER_CATALOG) {
    if (pc.scLegacyField && comp[pc.scLegacyField]) {
      ids.push(pc.id);
    }
  }
  return ids;
}
