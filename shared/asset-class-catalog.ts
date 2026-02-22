/**
 * Asset-Class-Aware Profit Center & Amenity Catalogs
 * 
 * Each asset class defines its own profit centers and amenities.
 * Some asset classes (e.g., SFR, laundromat) have no profit centers.
 * The wizard reads from this config based on the selected asset class.
 */

import type { CatalogProfitCenter, CatalogAmenity } from './marina-catalog';
import { PROFIT_CENTER_CATALOG as MARINA_PROFIT_CENTERS, AMENITY_CATALOG as MARINA_AMENITIES } from './marina-catalog';

// ─── Multifamily ──────────────────────────────────────────────────
const MULTIFAMILY_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'residential_rent', name: 'Residential Rent', description: 'Base rent from apartment units', icon: 'home', category: 'core' },
  { id: 'parking', name: 'Parking', description: 'Covered, uncovered, and garage parking revenue', icon: 'car', category: 'core' },
  { id: 'laundry_vending', name: 'Laundry & Vending', description: 'Coin-op laundry and vending machines', icon: 'home', category: 'ancillary' },
  { id: 'pet_fees', name: 'Pet Fees', description: 'Monthly pet rent and one-time pet deposits', icon: 'home', category: 'ancillary' },
  { id: 'storage_units', name: 'Storage Units', description: 'Tenant storage lockers or units', icon: 'warehouse', category: 'ancillary' },
  { id: 'application_fees', name: 'Application & Admin Fees', description: 'Application, lease-break, and administrative fees', icon: 'building', category: 'ancillary' },
  { id: 'utility_reimbursement', name: 'Utility Reimbursement', description: 'RUBS or sub-metered utility pass-throughs', icon: 'fuel', category: 'ancillary' },
];

const MULTIFAMILY_AMENITIES: CatalogAmenity[] = [
  { id: 'pool', name: 'Pool', description: 'Swimming pool and sundeck', icon: 'waves', category: 'recreation' },
  { id: 'fitness_center', name: 'Fitness Center', description: 'On-site gym facility', icon: 'users', category: 'recreation' },
  { id: 'clubhouse', name: 'Clubhouse / Lounge', description: 'Community room and social space', icon: 'building', category: 'recreation' },
  { id: 'dog_park', name: 'Dog Park', description: 'Fenced pet exercise area', icon: 'home', category: 'recreation' },
  { id: 'playground', name: 'Playground', description: "Children's play area", icon: 'home', category: 'recreation' },
  { id: 'business_center', name: 'Business Center', description: 'Workspace with computers and printers', icon: 'building', category: 'convenience' },
  { id: 'package_lockers', name: 'Package Lockers', description: 'Smart package delivery system', icon: 'container', category: 'convenience' },
  { id: 'ev_charging', name: 'EV Charging', description: 'Electric vehicle charging stations', icon: 'fuel', category: 'facility' },
  { id: 'gated_access', name: 'Gated Access', description: 'Controlled entry with gates/fobs', icon: 'building', category: 'facility' },
  { id: 'covered_parking', name: 'Covered Parking', description: 'Covered or garage parking structures', icon: 'car', category: 'facility' },
  { id: 'on_site_laundry', name: 'On-Site Laundry', description: 'Laundry rooms in each building', icon: 'home', category: 'convenience' },
  { id: 'in_unit_wd', name: 'In-Unit W/D', description: 'Washer/dryer in units', icon: 'home', category: 'convenience' },
];

// ─── Retail / Shopping Center ──────────────────────────────────────
const RETAIL_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'base_rent', name: 'Base Rent', description: 'Tenant base rent (NNN, gross, or modified)', icon: 'building', category: 'core' },
  { id: 'cam_recovery', name: 'CAM Recovery', description: 'Common area maintenance reimbursements', icon: 'wrench', category: 'core' },
  { id: 'tax_insurance_recovery', name: 'Tax & Insurance Recovery', description: 'Property tax and insurance pass-throughs', icon: 'building', category: 'core' },
  { id: 'percentage_rent', name: 'Percentage Rent', description: 'Overage rent based on tenant sales', icon: 'store', category: 'ancillary' },
  { id: 'parking', name: 'Parking', description: 'Parking lot or structure revenue', icon: 'car', category: 'ancillary' },
  { id: 'signage', name: 'Signage & Advertising', description: 'Pylon signs, banner, and advertising revenue', icon: 'building', category: 'ancillary' },
];

const RETAIL_AMENITIES: CatalogAmenity[] = [
  { id: 'parking_lot', name: 'Surface Parking', description: 'Surface-level parking lot', icon: 'car', category: 'facility' },
  { id: 'loading_docks', name: 'Loading Docks', description: 'Delivery loading areas', icon: 'container', category: 'facility' },
  { id: 'signage_pylon', name: 'Pylon Signage', description: 'High-visibility pylon sign on road', icon: 'building', category: 'facility' },
  { id: 'security', name: 'Security / Cameras', description: 'Surveillance and security patrols', icon: 'building', category: 'facility' },
];

// ─── Office / MOB ──────────────────────────────────────────────────
const OFFICE_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'base_rent', name: 'Base Rent', description: 'Office space base rent', icon: 'building', category: 'core' },
  { id: 'expense_recovery', name: 'Expense Recovery', description: 'CAM, tax, and insurance recoveries', icon: 'wrench', category: 'core' },
  { id: 'parking', name: 'Parking', description: 'Structured or surface parking revenue', icon: 'car', category: 'core' },
  { id: 'antenna_rooftop', name: 'Antenna / Rooftop', description: 'Cell tower or antenna lease income', icon: 'building', category: 'ancillary' },
  { id: 'conference_rooms', name: 'Conference Rooms', description: 'Shared conference room rentals', icon: 'users', category: 'ancillary' },
];

const OFFICE_AMENITIES: CatalogAmenity[] = [
  { id: 'lobby', name: 'Staffed Lobby', description: 'Attended lobby with reception', icon: 'building', category: 'facility' },
  { id: 'elevator', name: 'Elevators', description: 'Passenger and freight elevators', icon: 'building', category: 'facility' },
  { id: 'fitness_center', name: 'Fitness Center', description: 'On-site gym for tenants', icon: 'users', category: 'recreation' },
  { id: 'conference_center', name: 'Conference Center', description: 'Shared meeting rooms', icon: 'building', category: 'convenience' },
  { id: 'ev_charging', name: 'EV Charging', description: 'Electric vehicle charging', icon: 'fuel', category: 'facility' },
  { id: 'security', name: 'Security / Key Card', description: 'Building access control', icon: 'building', category: 'facility' },
  { id: 'parking_garage', name: 'Parking Garage', description: 'Structured covered parking', icon: 'car', category: 'facility' },
];

// ─── Industrial ──────────────────────────────────────────────────
const INDUSTRIAL_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'base_rent', name: 'Base Rent', description: 'Warehouse/flex space base rent', icon: 'warehouse', category: 'core' },
  { id: 'cam_recovery', name: 'CAM Recovery', description: 'Common area maintenance pass-throughs', icon: 'wrench', category: 'core' },
  { id: 'yard_storage', name: 'Yard / Outdoor Storage', description: 'Fenced outdoor storage area rent', icon: 'container', category: 'ancillary' },
];

const INDUSTRIAL_AMENITIES: CatalogAmenity[] = [
  { id: 'dock_doors', name: 'Dock-High Doors', description: 'Loading dock doors', icon: 'container', category: 'facility' },
  { id: 'drive_in_doors', name: 'Drive-In Doors', description: 'Grade-level drive-in doors', icon: 'car', category: 'facility' },
  { id: 'crane', name: 'Overhead Crane', description: 'Bridge or jib crane system', icon: 'wrench', category: 'facility' },
  { id: 'fenced_yard', name: 'Fenced Yard', description: 'Secured outdoor storage yard', icon: 'container', category: 'facility' },
  { id: 'clear_height', name: 'Clear Height 24ft+', description: 'High bay clear height', icon: 'warehouse', category: 'facility' },
  { id: 'sprinkler', name: 'Sprinkler System', description: 'Fire suppression sprinkler', icon: 'waves', category: 'facility' },
];

// ─── Self-Storage ──────────────────────────────────────────────────
const SELF_STORAGE_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'unit_rent', name: 'Unit Rent', description: 'Monthly self-storage unit rent', icon: 'warehouse', category: 'core' },
  { id: 'tenant_insurance', name: 'Tenant Insurance', description: 'Protection plan commissions', icon: 'building', category: 'ancillary' },
  { id: 'merchandise', name: 'Merchandise Sales', description: 'Boxes, locks, packing supplies', icon: 'shoppingcart', category: 'ancillary' },
  { id: 'truck_rental', name: 'Truck Rental', description: 'Moving truck rental commissions', icon: 'car', category: 'ancillary' },
  { id: 'late_fees', name: 'Late Fees & Lien Sales', description: 'Late payment fees and auction revenue', icon: 'building', category: 'ancillary' },
];

const SELF_STORAGE_AMENITIES: CatalogAmenity[] = [
  { id: 'climate_control', name: 'Climate-Controlled Units', description: 'Temperature and humidity controlled', icon: 'home', category: 'facility' },
  { id: 'drive_up', name: 'Drive-Up Access', description: 'Ground-level vehicle access to units', icon: 'car', category: 'facility' },
  { id: 'security_gate', name: 'Gated / Keypad Access', description: 'Electronic gate access control', icon: 'building', category: 'facility' },
  { id: 'security_cameras', name: 'Security Cameras', description: '24/7 video surveillance', icon: 'building', category: 'facility' },
  { id: 'resident_manager', name: 'On-Site Manager', description: 'Resident or on-site facility manager', icon: 'users', category: 'convenience' },
  { id: 'elevator', name: 'Elevator Access', description: 'Elevator for multi-story buildings', icon: 'building', category: 'facility' },
];

// ─── Hotel / Hospitality ──────────────────────────────────────────
const HOTEL_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'rooms', name: 'Rooms Revenue', description: 'Transient, group, and contract room revenue', icon: 'home', category: 'core' },
  { id: 'food_beverage', name: 'Food & Beverage', description: 'Restaurant, bar, banquet, room service', icon: 'utensils', category: 'core' },
  { id: 'meeting_space', name: 'Meeting & Events', description: 'Conference rooms, ballrooms, A/V', icon: 'building', category: 'core' },
  { id: 'spa', name: 'Spa / Wellness', description: 'Spa treatments, health club fees', icon: 'users', category: 'ancillary' },
  { id: 'parking', name: 'Parking', description: 'Valet and self-park revenue', icon: 'car', category: 'ancillary' },
  { id: 'golf', name: 'Golf', description: 'Greens fees, cart rental, pro shop', icon: 'building', category: 'specialty' },
  { id: 'retail', name: 'Retail / Gift Shop', description: 'Gift shop and retail outlet', icon: 'shoppingcart', category: 'ancillary' },
  { id: 'other_operated', name: 'Other Operated', description: 'Guest laundry, business center, etc.', icon: 'wrench', category: 'ancillary' },
];

const HOTEL_AMENITIES: CatalogAmenity[] = [
  { id: 'pool', name: 'Pool', description: 'Indoor or outdoor swimming pool', icon: 'waves', category: 'recreation' },
  { id: 'fitness_center', name: 'Fitness Center', description: 'On-site gym', icon: 'users', category: 'recreation' },
  { id: 'business_center', name: 'Business Center', description: 'Guest computer and printing', icon: 'building', category: 'convenience' },
  { id: 'restaurant', name: 'On-Site Restaurant', description: 'Full-service restaurant', icon: 'utensils', category: 'recreation' },
  { id: 'bar_lounge', name: 'Bar / Lounge', description: 'Cocktail bar or lobby lounge', icon: 'utensils', category: 'recreation' },
  { id: 'concierge', name: 'Concierge', description: 'Concierge desk services', icon: 'users', category: 'convenience' },
  { id: 'valet', name: 'Valet Parking', description: 'Valet parking service', icon: 'car', category: 'convenience' },
  { id: 'shuttle', name: 'Airport Shuttle', description: 'Complimentary airport shuttle', icon: 'car', category: 'convenience' },
  { id: 'complimentary_breakfast', name: 'Complimentary Breakfast', description: 'Free breakfast for guests', icon: 'utensils', category: 'convenience' },
];

// ─── STR (Short-Term Rental) ──────────────────────────────────────
const STR_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'nightly_revenue', name: 'Nightly Revenue', description: 'Nightly booking rate revenue', icon: 'home', category: 'core' },
  { id: 'cleaning_fees', name: 'Cleaning Fees', description: 'Per-stay cleaning fee income', icon: 'home', category: 'core' },
  { id: 'extra_guest_fees', name: 'Extra Guest Fees', description: 'Additional guest surcharges', icon: 'users', category: 'ancillary' },
  { id: 'pet_fees', name: 'Pet Fees', description: 'Per-stay pet fee income', icon: 'home', category: 'ancillary' },
  { id: 'early_late_fees', name: 'Early/Late Check Fees', description: 'Early check-in or late checkout fees', icon: 'building', category: 'ancillary' },
];

const STR_AMENITIES: CatalogAmenity[] = [
  { id: 'pool', name: 'Pool / Hot Tub', description: 'Private or shared pool', icon: 'waves', category: 'recreation' },
  { id: 'smart_lock', name: 'Smart Lock', description: 'Keyless entry system', icon: 'building', category: 'facility' },
  { id: 'wifi', name: 'High-Speed Wi-Fi', description: 'Fast internet for guests', icon: 'building', category: 'convenience' },
  { id: 'outdoor_space', name: 'Outdoor Space', description: 'Patio, deck, or yard', icon: 'home', category: 'recreation' },
  { id: 'ev_charging', name: 'EV Charging', description: 'Electric vehicle charger', icon: 'fuel', category: 'facility' },
];

// ─── Medical Office ──────────────────────────────────────────────
const MEDICAL_OFFICE_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'base_rent', name: 'Base Rent', description: 'Medical office space rent', icon: 'building', category: 'core' },
  { id: 'expense_recovery', name: 'Expense Recovery', description: 'NNN / expense pass-throughs', icon: 'wrench', category: 'core' },
  { id: 'parking', name: 'Parking', description: 'Patient and staff parking', icon: 'car', category: 'ancillary' },
];

const MEDICAL_OFFICE_AMENITIES: CatalogAmenity[] = [
  { id: 'pharmacy', name: 'On-Site Pharmacy', description: 'Pharmacy within the building', icon: 'building', category: 'convenience' },
  { id: 'imaging_center', name: 'Imaging Center', description: 'X-ray, MRI, or CT suite', icon: 'building', category: 'facility' },
  { id: 'lab', name: 'Lab Services', description: 'Blood draw and diagnostic lab', icon: 'building', category: 'facility' },
  { id: 'covered_drop_off', name: 'Covered Drop-Off', description: 'Patient drop-off portico', icon: 'car', category: 'facility' },
  { id: 'ada_compliance', name: 'Full ADA Compliance', description: 'Wheelchair ramps, wide halls, accessible restrooms', icon: 'users', category: 'facility' },
];

// ─── Mixed-Use ──────────────────────────────────────────────────
const MIXED_USE_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'residential_rent', name: 'Residential Rent', description: 'Upper-floor residential units', icon: 'home', category: 'core' },
  { id: 'retail_rent', name: 'Retail / Ground Floor', description: 'Ground-floor commercial tenant rent', icon: 'store', category: 'core' },
  { id: 'office_rent', name: 'Office Rent', description: 'Office space rent if applicable', icon: 'building', category: 'core' },
  { id: 'cam_recovery', name: 'CAM Recovery', description: 'Common area maintenance recovery', icon: 'wrench', category: 'ancillary' },
  { id: 'parking', name: 'Parking', description: 'Garage or surface lot parking', icon: 'car', category: 'ancillary' },
];

const MIXED_USE_AMENITIES: CatalogAmenity[] = [
  { id: 'rooftop', name: 'Rooftop Deck', description: 'Shared rooftop amenity space', icon: 'building', category: 'recreation' },
  { id: 'lobby', name: 'Lobby / Concierge', description: 'Attended lobby for residents', icon: 'building', category: 'facility' },
  { id: 'fitness_center', name: 'Fitness Center', description: 'Shared gym facility', icon: 'users', category: 'recreation' },
  { id: 'parking_garage', name: 'Parking Garage', description: 'Structured parking for residents/tenants', icon: 'car', category: 'facility' },
  { id: 'bike_storage', name: 'Bike Storage', description: 'Secure bicycle storage', icon: 'car', category: 'convenience' },
];

// ─── Laundromat ──────────────────────────────────────────────────
// No profit centers — single-purpose business
const LAUNDROMAT_PROFIT_CENTERS: CatalogProfitCenter[] = [];

const LAUNDROMAT_AMENITIES: CatalogAmenity[] = [
  { id: 'wifi', name: 'Free Wi-Fi', description: 'Customer internet access', icon: 'building', category: 'convenience' },
  { id: 'tv', name: 'TV / Entertainment', description: 'Mounted TVs for waiting customers', icon: 'building', category: 'convenience' },
  { id: 'vending', name: 'Vending Machines', description: 'Snack and drink machines', icon: 'shoppingcart', category: 'convenience' },
  { id: 'card_payment', name: 'Card Payment System', description: 'Cashless payment on machines', icon: 'building', category: 'facility' },
  { id: 'folding_tables', name: 'Folding Tables', description: 'Ample folding and sorting space', icon: 'home', category: 'convenience' },
  { id: 'security', name: 'Security Cameras', description: 'Video surveillance system', icon: 'building', category: 'facility' },
];

// ─── SFR ──────────────────────────────────────────────────────
// No profit centers — single stream
const SFR_PROFIT_CENTERS: CatalogProfitCenter[] = [];
const SFR_AMENITIES: CatalogAmenity[] = [
  { id: 'garage', name: 'Garage', description: 'Attached or detached garage', icon: 'car', category: 'facility' },
  { id: 'yard', name: 'Fenced Yard', description: 'Fenced backyard', icon: 'home', category: 'recreation' },
  { id: 'in_unit_wd', name: 'In-Unit W/D', description: 'Washer and dryer included', icon: 'home', category: 'convenience' },
  { id: 'smart_home', name: 'Smart Home Features', description: 'Smart thermostat, locks, etc.', icon: 'building', category: 'convenience' },
];

// ─── Business / Other ──────────────────────────────────────────────
const BUSINESS_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'primary_revenue', name: 'Primary Revenue', description: 'Main business revenue stream', icon: 'store', category: 'core' },
  { id: 'secondary_revenue', name: 'Secondary Revenue', description: 'Ancillary or add-on revenue', icon: 'store', category: 'ancillary' },
  { id: 'service_revenue', name: 'Service Revenue', description: 'Fee-based service income', icon: 'wrench', category: 'ancillary' },
];

const BUSINESS_AMENITIES: CatalogAmenity[] = [];

// ─── Master Registry ──────────────────────────────────────────────
interface AssetClassCatalogEntry {
  profitCenters: CatalogProfitCenter[];
  amenities: CatalogAmenity[];
  hasProfitCenters: boolean;
  hasAmenities: boolean;
  storageLabel: string;       // What the "Storage" step is called
  showStorageStep: boolean;   // Whether to show the storage/unit mix step
}

const ASSET_CLASS_CATALOGS: Record<string, AssetClassCatalogEntry> = {
  marina: {
    profitCenters: MARINA_PROFIT_CENTERS,
    amenities: MARINA_AMENITIES,
    hasProfitCenters: true,
    hasAmenities: true,
    storageLabel: 'Storage Types',
    showStorageStep: true,
  },
  multifamily: {
    profitCenters: MULTIFAMILY_PROFIT_CENTERS,
    amenities: MULTIFAMILY_AMENITIES,
    hasProfitCenters: true,
    hasAmenities: true,
    storageLabel: 'Unit Mix',
    showStorageStep: true,
  },
  retail: {
    profitCenters: RETAIL_PROFIT_CENTERS,
    amenities: RETAIL_AMENITIES,
    hasProfitCenters: true,
    hasAmenities: true,
    storageLabel: 'Tenant Spaces',
    showStorageStep: false,
  },
  office: {
    profitCenters: OFFICE_PROFIT_CENTERS,
    amenities: OFFICE_AMENITIES,
    hasProfitCenters: true,
    hasAmenities: true,
    storageLabel: 'Tenant Spaces',
    showStorageStep: false,
  },
  industrial: {
    profitCenters: INDUSTRIAL_PROFIT_CENTERS,
    amenities: INDUSTRIAL_AMENITIES,
    hasProfitCenters: true,
    hasAmenities: true,
    storageLabel: 'Bay Configuration',
    showStorageStep: false,
  },
  self_storage: {
    profitCenters: SELF_STORAGE_PROFIT_CENTERS,
    amenities: SELF_STORAGE_AMENITIES,
    hasProfitCenters: true,
    hasAmenities: true,
    storageLabel: 'Unit Sizes',
    showStorageStep: true,
  },
  hotel: {
    profitCenters: HOTEL_PROFIT_CENTERS,
    amenities: HOTEL_AMENITIES,
    hasProfitCenters: true,
    hasAmenities: true,
    storageLabel: 'Room Types',
    showStorageStep: true,
  },
  str: {
    profitCenters: STR_PROFIT_CENTERS,
    amenities: STR_AMENITIES,
    hasProfitCenters: true,
    hasAmenities: true,
    storageLabel: 'Listing Setup',
    showStorageStep: false,
  },
  medical_office: {
    profitCenters: MEDICAL_OFFICE_PROFIT_CENTERS,
    amenities: MEDICAL_OFFICE_AMENITIES,
    hasProfitCenters: true,
    hasAmenities: true,
    storageLabel: 'Tenant Suites',
    showStorageStep: false,
  },
  mixed_use: {
    profitCenters: MIXED_USE_PROFIT_CENTERS,
    amenities: MIXED_USE_AMENITIES,
    hasProfitCenters: true,
    hasAmenities: true,
    storageLabel: 'Unit Mix',
    showStorageStep: true,
  },
  laundromat: {
    profitCenters: LAUNDROMAT_PROFIT_CENTERS,
    amenities: LAUNDROMAT_AMENITIES,
    hasProfitCenters: false,
    hasAmenities: true,
    storageLabel: 'Equipment',
    showStorageStep: false,
  },
  sfr: {
    profitCenters: SFR_PROFIT_CENTERS,
    amenities: SFR_AMENITIES,
    hasProfitCenters: false,
    hasAmenities: true,
    storageLabel: 'Property Details',
    showStorageStep: false,
  },
  business: {
    profitCenters: BUSINESS_PROFIT_CENTERS,
    amenities: BUSINESS_AMENITIES,
    hasProfitCenters: true,
    hasAmenities: false,
    storageLabel: 'Revenue Streams',
    showStorageStep: false,
  },
};

export function getAssetClassCatalog(assetClass: string | null): AssetClassCatalogEntry {
  return ASSET_CLASS_CATALOGS[assetClass || 'marina'] || ASSET_CLASS_CATALOGS.marina;
}

export { ASSET_CLASS_CATALOGS };
export type { AssetClassCatalogEntry };
