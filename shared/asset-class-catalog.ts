/**
 * Asset-Class-Aware Profit Center & Amenity Catalogs
 *
 * Source of truth for ops-level metadata on every asset class and business type
 * defined in shared/marketplace/asset-class-taxonomy.ts. Each entry defines what
 * the class is (category + group), its profit-center shape, amenities (for CRE),
 * and storage/unit naming used by the wizard and ops landing pages.
 *
 * Keys here must match taxonomy IDs (preferred) or legacy simplified keys
 * (marina, multifamily, hotel, retail, office, industrial, self_storage, str,
 * medical_office, mixed_use, laundromat, sfr, business, duplex, triplex, quad).
 * Both coexist — `crmProperties.type` may hold either.
 */

import type { CatalogProfitCenter, CatalogAmenity } from './marina-catalog';
import { PROFIT_CENTER_CATALOG as MARINA_PROFIT_CENTERS, AMENITY_CATALOG as MARINA_AMENITIES } from './marina-catalog';
import type { ListingCategory, AssetClassGroup } from './marketplace/asset-class-taxonomy';

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

// ─── Student / Senior / Manufactured Housing ─────────────────────────
const STUDENT_HOUSING_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'bed_rent', name: 'By-the-Bed Rent', description: 'Per-bed rental income', icon: 'home', category: 'core' },
  { id: 'parking', name: 'Parking', description: 'Student parking revenue', icon: 'car', category: 'ancillary' },
  { id: 'amenity_fees', name: 'Amenity Fees', description: 'Gym/lounge/tech fees', icon: 'users', category: 'ancillary' },
  { id: 'application_fees', name: 'Application & Admin Fees', description: 'Admin and application income', icon: 'building', category: 'ancillary' },
];

const SENIOR_HOUSING_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'monthly_rent', name: 'Monthly Rent', description: 'Resident monthly rent', icon: 'home', category: 'core' },
  { id: 'care_services', name: 'Care Services', description: 'Assisted living / memory care fees', icon: 'users', category: 'core' },
  { id: 'meal_plans', name: 'Meal Plans', description: 'Dining service revenue', icon: 'utensils', category: 'ancillary' },
  { id: 'ancillary_services', name: 'Ancillary Services', description: 'Transportation, activities, salon', icon: 'wrench', category: 'ancillary' },
];

const MHP_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'pad_rent', name: 'Pad Rent', description: 'Monthly lot / pad rent', icon: 'home', category: 'core' },
  { id: 'home_rent', name: 'Home Rent', description: 'Park-owned home rental income', icon: 'home', category: 'ancillary' },
  { id: 'utility_reimbursement', name: 'Utility Reimbursement', description: 'Water, sewer, trash pass-throughs', icon: 'fuel', category: 'ancillary' },
  { id: 'late_fees', name: 'Late Fees', description: 'Late payment fees', icon: 'building', category: 'ancillary' },
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

const COWORKING_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'memberships', name: 'Memberships', description: 'Hot desk, dedicated desk, private office', icon: 'users', category: 'core' },
  { id: 'day_passes', name: 'Day Passes', description: 'Drop-in day passes', icon: 'users', category: 'core' },
  { id: 'meeting_rooms', name: 'Meeting Rooms', description: 'Hourly meeting room rentals', icon: 'building', category: 'ancillary' },
  { id: 'event_space', name: 'Event Space', description: 'After-hours event rentals', icon: 'building', category: 'ancillary' },
  { id: 'fb_catering', name: 'F&B / Vending', description: 'Coffee, snacks, vending income', icon: 'utensils', category: 'ancillary' },
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

const COLD_STORAGE_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'frozen_rent', name: 'Frozen Storage Rent', description: 'Frozen room leased capacity', icon: 'warehouse', category: 'core' },
  { id: 'refrigerated_rent', name: 'Refrigerated Rent', description: 'Refrigerated room leased capacity', icon: 'warehouse', category: 'core' },
  { id: 'blast_freeze', name: 'Blast Freeze Services', description: 'Blast freeze tunnels and fees', icon: 'wrench', category: 'ancillary' },
  { id: 'handling_fees', name: 'Handling & Pick-Pack', description: 'Value-added handling services', icon: 'container', category: 'ancillary' },
];

const DATA_CENTER_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'colocation', name: 'Colocation Rent', description: 'Rack / cage / cabinet space', icon: 'warehouse', category: 'core' },
  { id: 'power_kw', name: 'Power (kW)', description: 'Metered / committed kW revenue', icon: 'fuel', category: 'core' },
  { id: 'cross_connects', name: 'Cross-Connects', description: 'Interconnection fees', icon: 'building', category: 'ancillary' },
  { id: 'remote_hands', name: 'Remote Hands', description: 'Managed services / smart hands', icon: 'wrench', category: 'ancillary' },
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

const EXTENDED_STAY_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'rooms', name: 'Rooms Revenue', description: 'Weekly / monthly extended stay rate', icon: 'home', category: 'core' },
  { id: 'laundry', name: 'Laundry', description: 'On-site laundry service', icon: 'home', category: 'ancillary' },
  { id: 'parking', name: 'Parking', description: 'Guest parking', icon: 'car', category: 'ancillary' },
  { id: 'pet_fees', name: 'Pet Fees', description: 'Extended-stay pet fees', icon: 'home', category: 'ancillary' },
];

// ─── RV Park / Campground ──────────────────────────────────────
const RV_PARK_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'site_rent', name: 'Site Rent', description: 'Nightly / weekly / seasonal site rent', icon: 'home', category: 'core' },
  { id: 'cabin_rentals', name: 'Cabin Rentals', description: 'On-site cabins and park-model rentals', icon: 'home', category: 'core' },
  { id: 'store', name: 'Store / Merchandise', description: 'Camp store retail sales', icon: 'shoppingcart', category: 'ancillary' },
  { id: 'activities', name: 'Activities & Rentals', description: 'Rentals, tours, programming', icon: 'users', category: 'ancillary' },
  { id: 'laundry', name: 'Laundry & Showers', description: 'Pay laundry and shower income', icon: 'home', category: 'ancillary' },
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
const SFR_PROFIT_CENTERS: CatalogProfitCenter[] = [];
const SFR_AMENITIES: CatalogAmenity[] = [
  { id: 'garage', name: 'Garage', description: 'Attached or detached garage', icon: 'car', category: 'facility' },
  { id: 'yard', name: 'Fenced Yard', description: 'Fenced backyard', icon: 'home', category: 'recreation' },
  { id: 'in_unit_wd', name: 'In-Unit W/D', description: 'Washer and dryer included', icon: 'home', category: 'convenience' },
  { id: 'smart_home', name: 'Smart Home Features', description: 'Smart thermostat, locks, etc.', icon: 'building', category: 'convenience' },
];

// ─── Land ──────────────────────────────────────────────────────
const LAND_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'ground_lease', name: 'Ground Lease', description: 'Long-term ground lease income', icon: 'building', category: 'core' },
  { id: 'farm_income', name: 'Farm / Crop Income', description: 'Agricultural lease or operation income', icon: 'home', category: 'ancillary' },
  { id: 'timber_mineral', name: 'Timber / Mineral Rights', description: 'Extractive / timber royalty income', icon: 'wrench', category: 'ancillary' },
  { id: 'hunting_lease', name: 'Hunting / Rec Lease', description: 'Recreation / hunting lease income', icon: 'users', category: 'ancillary' },
];

// ─── Parking Facility ──────────────────────────────────────────
const PARKING_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'monthly_contracts', name: 'Monthly Contracts', description: 'Reserved monthly parking', icon: 'car', category: 'core' },
  { id: 'transient', name: 'Transient / Hourly', description: 'Daily and hourly parking', icon: 'car', category: 'core' },
  { id: 'event_parking', name: 'Event Parking', description: 'Special event parking', icon: 'users', category: 'ancillary' },
  { id: 'valet', name: 'Valet', description: 'Valet services income', icon: 'car', category: 'ancillary' },
];

// ─── Car Wash Property / Operating ─────────────────────────────
const CAR_WASH_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'wash_sales', name: 'Wash Sales', description: 'Individual wash revenue', icon: 'car', category: 'core' },
  { id: 'membership', name: 'Unlimited Membership', description: 'Subscription wash plans', icon: 'users', category: 'core' },
  { id: 'detailing', name: 'Detailing', description: 'Hand detailing / add-on services', icon: 'wrench', category: 'ancillary' },
  { id: 'vacuums_vending', name: 'Vacuums & Vending', description: 'Self-serve vacuums and vending', icon: 'shoppingcart', category: 'ancillary' },
];

// ─── Religious Facility ────────────────────────────────────────
const RELIGIOUS_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'facility_rental', name: 'Facility Rental', description: 'Hall, sanctuary, or event rental income', icon: 'building', category: 'core' },
  { id: 'tenant_rent', name: 'Tenant Rent', description: 'Sub-leased classroom or office space', icon: 'building', category: 'ancillary' },
];

// ─── Restaurant / Bar / F&B ─────────────────────────────────────
const FOOD_BEVERAGE_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'food_sales', name: 'Food Sales', description: 'Dine-in, takeout, and delivery food revenue', icon: 'utensils', category: 'core' },
  { id: 'beverage_sales', name: 'Beverage Sales', description: 'Alcohol, soft drinks, coffee', icon: 'utensils', category: 'core' },
  { id: 'catering', name: 'Catering / Events', description: 'Off-premise catering and private events', icon: 'users', category: 'ancillary' },
  { id: 'merchandise', name: 'Merchandise', description: 'Branded merch and retail', icon: 'shoppingcart', category: 'ancillary' },
  { id: 'delivery', name: 'Third-Party Delivery', description: 'Grubhub / DoorDash / Uber Eats', icon: 'car', category: 'ancillary' },
];

const BREWERY_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'taproom', name: 'Taproom / On-Premise', description: 'Taproom pours and pint sales', icon: 'utensils', category: 'core' },
  { id: 'packaged_sales', name: 'Packaged / Distribution', description: 'Cans, bottles, kegs sold through distribution', icon: 'container', category: 'core' },
  { id: 'private_events', name: 'Private Events', description: 'Event space and brewery tours', icon: 'users', category: 'ancillary' },
  { id: 'merchandise', name: 'Merchandise', description: 'Branded glassware, apparel', icon: 'shoppingcart', category: 'ancillary' },
];

// ─── Retail Business (C-store, liquor, apparel, etc) ─────────────
const RETAIL_BIZ_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'merchandise', name: 'Merchandise Sales', description: 'Primary retail product sales', icon: 'shoppingcart', category: 'core' },
  { id: 'lottery_tobacco', name: 'Lottery / Tobacco', description: 'Lottery and tobacco product revenue', icon: 'store', category: 'ancillary' },
  { id: 'prepared_food', name: 'Prepared Food', description: 'Prepared food and beverage program', icon: 'utensils', category: 'ancillary' },
  { id: 'services', name: 'In-Store Services', description: 'Money orders, check cashing, bill pay', icon: 'wrench', category: 'ancillary' },
];

const GAS_STATION_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'fuel_sales', name: 'Fuel Sales', description: 'Gasoline and diesel margin', icon: 'fuel', category: 'core' },
  { id: 'cstore', name: 'C-Store Sales', description: 'In-store merchandise', icon: 'shoppingcart', category: 'core' },
  { id: 'prepared_food', name: 'Prepared Food / QSR', description: 'Branded food counter revenue', icon: 'utensils', category: 'ancillary' },
  { id: 'car_wash', name: 'Car Wash', description: 'On-site wash revenue', icon: 'car', category: 'ancillary' },
];

// ─── Services (Landscaping, Cleaning, etc) ───────────────────────
const SERVICE_BIZ_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'recurring_service', name: 'Recurring Service', description: 'Contracted recurring service revenue', icon: 'wrench', category: 'core' },
  { id: 'one_time_jobs', name: 'One-Time Jobs', description: 'One-off projects and service calls', icon: 'wrench', category: 'core' },
  { id: 'product_sales', name: 'Product Sales', description: 'Parts, chemicals, materials markup', icon: 'shoppingcart', category: 'ancillary' },
  { id: 'emergency_fees', name: 'Emergency / After-Hours', description: 'Premium emergency service fees', icon: 'wrench', category: 'ancillary' },
];

// ─── Tech / SaaS / Ecommerce ────────────────────────────────────
const SAAS_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'subscription_mrr', name: 'Subscription MRR', description: 'Recurring subscription revenue', icon: 'building', category: 'core' },
  { id: 'usage_based', name: 'Usage / API Revenue', description: 'Consumption-based revenue', icon: 'building', category: 'core' },
  { id: 'professional_services', name: 'Professional Services', description: 'Onboarding, implementation, training', icon: 'wrench', category: 'ancillary' },
  { id: 'expansion_revenue', name: 'Expansion / Upsell', description: 'Seat / tier upgrades from existing customers', icon: 'users', category: 'ancillary' },
];

const CONTENT_SITE_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'display_ads', name: 'Display Ads', description: 'Programmatic and direct ad revenue', icon: 'building', category: 'core' },
  { id: 'affiliate', name: 'Affiliate', description: 'Affiliate commissions', icon: 'building', category: 'core' },
  { id: 'sponsored', name: 'Sponsored Content', description: 'Sponsored posts and placements', icon: 'building', category: 'ancillary' },
  { id: 'memberships', name: 'Memberships / Premium', description: 'Gated / subscription content', icon: 'users', category: 'ancillary' },
];

const ECOMMERCE_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'product_sales', name: 'Product Sales', description: 'Direct-to-consumer product revenue', icon: 'shoppingcart', category: 'core' },
  { id: 'subscriptions', name: 'Subscriptions', description: 'Subscribe-and-save / subscription box', icon: 'shoppingcart', category: 'core' },
  { id: 'wholesale', name: 'Wholesale / B2B', description: 'Wholesale channel revenue', icon: 'container', category: 'ancillary' },
  { id: 'shipping_handling', name: 'Shipping & Handling', description: 'S&H collected from customers', icon: 'car', category: 'ancillary' },
];

// ─── Manufacturing / Distribution ───────────────────────────────
const MANUFACTURING_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'product_sales', name: 'Product Sales', description: 'Manufactured goods sold', icon: 'warehouse', category: 'core' },
  { id: 'contract_manufacturing', name: 'Contract Manufacturing', description: 'White-label / contract production', icon: 'wrench', category: 'core' },
  { id: 'tooling', name: 'Tooling / Setup', description: 'Tooling and NRE fees', icon: 'wrench', category: 'ancillary' },
  { id: 'scrap', name: 'Scrap / Recycling', description: 'Scrap metal / byproduct revenue', icon: 'container', category: 'ancillary' },
];

const DISTRIBUTION_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'product_margin', name: 'Product Margin', description: 'Wholesale product margin', icon: 'container', category: 'core' },
  { id: 'logistics_fees', name: 'Logistics / Freight', description: 'Freight and delivery fees', icon: 'car', category: 'core' },
  { id: 'warehousing', name: 'Warehousing', description: '3PL / warehousing service revenue', icon: 'warehouse', category: 'ancillary' },
];

const TRUCKING_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'line_haul', name: 'Line Haul', description: 'Per-mile revenue', icon: 'car', category: 'core' },
  { id: 'fuel_surcharge', name: 'Fuel Surcharge', description: 'Fuel surcharge recovery', icon: 'fuel', category: 'core' },
  { id: 'accessorials', name: 'Accessorials', description: 'Detention, lumper, layover', icon: 'wrench', category: 'ancillary' },
];

// ─── Healthcare ──────────────────────────────────────────────────
const HEALTHCARE_BIZ_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'patient_fees', name: 'Patient Fees', description: 'Self-pay patient revenue', icon: 'users', category: 'core' },
  { id: 'insurance', name: 'Insurance Reimbursements', description: 'Private insurance collections', icon: 'building', category: 'core' },
  { id: 'medicare_medicaid', name: 'Medicare / Medicaid', description: 'Government payer collections', icon: 'building', category: 'core' },
  { id: 'procedures', name: 'Procedures / Ancillary', description: 'Procedures, imaging, lab, retail', icon: 'wrench', category: 'ancillary' },
];

const VETERINARY_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'exam_fees', name: 'Exam Fees', description: 'Office visits and exams', icon: 'users', category: 'core' },
  { id: 'surgery', name: 'Surgery', description: 'Surgical procedures', icon: 'wrench', category: 'core' },
  { id: 'pharmacy_retail', name: 'Pharmacy & Retail', description: 'In-clinic pharmacy and retail', icon: 'shoppingcart', category: 'ancillary' },
  { id: 'boarding_grooming', name: 'Boarding & Grooming', description: 'Boarding, grooming, daycare', icon: 'home', category: 'ancillary' },
];

// ─── Automotive ──────────────────────────────────────────────────
const AUTO_REPAIR_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'labor', name: 'Labor', description: 'Billable labor hours', icon: 'wrench', category: 'core' },
  { id: 'parts', name: 'Parts', description: 'Parts markup revenue', icon: 'wrench', category: 'core' },
  { id: 'tires', name: 'Tires', description: 'Tire sales and installation', icon: 'car', category: 'ancillary' },
  { id: 'diagnostics', name: 'Diagnostics', description: 'Diagnostic and inspection fees', icon: 'wrench', category: 'ancillary' },
];

const AUTO_DEALER_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'new_sales', name: 'New Vehicle Sales', description: 'New vehicle gross', icon: 'car', category: 'core' },
  { id: 'used_sales', name: 'Used Vehicle Sales', description: 'Pre-owned vehicle gross', icon: 'car', category: 'core' },
  { id: 'fi', name: 'F&I', description: 'Finance and insurance gross', icon: 'building', category: 'core' },
  { id: 'service', name: 'Service / Parts', description: 'Fixed ops gross', icon: 'wrench', category: 'core' },
];

// ─── Education ───────────────────────────────────────────────────
const EDUCATION_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'tuition', name: 'Tuition / Program Fees', description: 'Student tuition and program revenue', icon: 'users', category: 'core' },
  { id: 'after_care', name: 'After-Care / Extended Day', description: 'Before/after-school programs', icon: 'users', category: 'ancillary' },
  { id: 'enrollment_fees', name: 'Enrollment / Registration', description: 'Annual registration fees', icon: 'building', category: 'ancillary' },
  { id: 'materials_supplies', name: 'Materials / Supplies', description: 'Books, uniforms, supplies', icon: 'shoppingcart', category: 'ancillary' },
];

// ─── Entertainment / Fitness ─────────────────────────────────────
const FITNESS_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'membership_dues', name: 'Membership Dues', description: 'Recurring membership revenue', icon: 'users', category: 'core' },
  { id: 'personal_training', name: 'Personal Training', description: 'PT and small-group training', icon: 'users', category: 'core' },
  { id: 'classes', name: 'Classes / Programs', description: 'Drop-in and program fees', icon: 'users', category: 'ancillary' },
  { id: 'retail', name: 'Retail / Pro Shop', description: 'Apparel, supplements, accessories', icon: 'shoppingcart', category: 'ancillary' },
  { id: 'childcare', name: 'Childcare / Kids Club', description: 'On-site childcare revenue', icon: 'home', category: 'ancillary' },
];

const BOWLING_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'lineage', name: 'Lineage / Game Revenue', description: 'Per-game bowling revenue', icon: 'users', category: 'core' },
  { id: 'food_beverage', name: 'Food & Beverage', description: 'Bar and grill revenue', icon: 'utensils', category: 'core' },
  { id: 'leagues', name: 'Leagues', description: 'League play revenue', icon: 'users', category: 'ancillary' },
  { id: 'events', name: 'Parties / Events', description: 'Birthday and private events', icon: 'users', category: 'ancillary' },
  { id: 'arcade', name: 'Arcade / Amusement', description: 'Arcade and amusement revenue', icon: 'building', category: 'ancillary' },
];

const GOLF_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'greens_fees', name: 'Greens Fees', description: 'Daily-fee and guest rounds', icon: 'users', category: 'core' },
  { id: 'memberships', name: 'Memberships / Dues', description: 'Annual / monthly membership dues', icon: 'users', category: 'core' },
  { id: 'cart_fees', name: 'Cart Fees', description: 'Cart rental revenue', icon: 'car', category: 'ancillary' },
  { id: 'pro_shop', name: 'Pro Shop', description: 'Retail pro shop revenue', icon: 'shoppingcart', category: 'ancillary' },
  { id: 'food_beverage', name: 'F&B / Banquet', description: 'Restaurant, bar, banquet revenue', icon: 'utensils', category: 'ancillary' },
  { id: 'range', name: 'Driving Range', description: 'Range ball revenue', icon: 'users', category: 'ancillary' },
];

// ─── Construction / Trades ──────────────────────────────────────
const TRADES_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'service_calls', name: 'Service Calls', description: 'Service call revenue (trip + diagnostic)', icon: 'wrench', category: 'core' },
  { id: 'installations', name: 'Installations', description: 'New equipment installation revenue', icon: 'wrench', category: 'core' },
  { id: 'maintenance_contracts', name: 'Maintenance Contracts', description: 'Recurring maintenance agreements', icon: 'wrench', category: 'core' },
  { id: 'emergency_service', name: 'Emergency Service', description: 'After-hours and emergency premiums', icon: 'wrench', category: 'ancillary' },
];

const GC_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'project_revenue', name: 'Project Revenue', description: 'Contract revenue from projects', icon: 'building', category: 'core' },
  { id: 'change_orders', name: 'Change Orders', description: 'Change order revenue', icon: 'wrench', category: 'ancillary' },
  { id: 'self_perform', name: 'Self-Perform Work', description: 'In-house labor revenue', icon: 'wrench', category: 'ancillary' },
];

// ─── Professional Services ──────────────────────────────────────
const PROFESSIONAL_SERVICES_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'billable_hours', name: 'Billable Hours', description: 'Hourly billable work', icon: 'users', category: 'core' },
  { id: 'retainers', name: 'Retainers / Recurring', description: 'Recurring retainer revenue', icon: 'building', category: 'core' },
  { id: 'project_fees', name: 'Project Fees', description: 'Fixed-fee and deliverable-based work', icon: 'building', category: 'core' },
  { id: 'referral_revenue', name: 'Referral / Commissions', description: 'Referral fees and commissions', icon: 'building', category: 'ancillary' },
];

const INSURANCE_AGENCY_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'new_business', name: 'New Business Commission', description: 'New policy commissions', icon: 'building', category: 'core' },
  { id: 'renewals', name: 'Renewal Commissions', description: 'Renewal / trailing commissions', icon: 'building', category: 'core' },
  { id: 'contingent', name: 'Contingent / Profit Share', description: 'Carrier profit-share bonuses', icon: 'building', category: 'ancillary' },
];

// ─── Personal Care ──────────────────────────────────────────────
const PERSONAL_CARE_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'service_revenue', name: 'Service Revenue', description: 'Core service revenue (cuts, treatments)', icon: 'users', category: 'core' },
  { id: 'product_sales', name: 'Product Sales', description: 'Retail product sales', icon: 'shoppingcart', category: 'core' },
  { id: 'memberships', name: 'Memberships / Packages', description: 'Pre-paid service packages', icon: 'users', category: 'ancillary' },
  { id: 'tips_gratuities', name: 'Tips & Gratuities', description: 'Gratuity revenue (if captured)', icon: 'building', category: 'ancillary' },
];

// ─── Franchise ──────────────────────────────────────────────────
const FRANCHISE_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'unit_revenue', name: 'Unit Revenue', description: 'Franchisee unit-level revenue', icon: 'store', category: 'core' },
  { id: 'royalty_payments', name: 'Royalty Fees (Paid)', description: 'Royalties paid to franchisor', icon: 'building', category: 'ancillary' },
  { id: 'advertising_fund', name: 'Advertising Fund', description: 'Brand ad fund contributions', icon: 'building', category: 'ancillary' },
];

// ─── Notes ──────────────────────────────────────────────────────
const NOTE_PROFIT_CENTERS: CatalogProfitCenter[] = [
  { id: 'interest_income', name: 'Interest Income', description: 'Scheduled interest payments', icon: 'building', category: 'core' },
  { id: 'principal_payments', name: 'Principal Payments', description: 'Scheduled principal pay-downs', icon: 'building', category: 'core' },
  { id: 'late_fees', name: 'Late Fees', description: 'Late payment and default fees', icon: 'building', category: 'ancillary' },
  { id: 'resolution', name: 'Resolution Proceeds', description: 'Workout / modification / foreclosure recovery', icon: 'building', category: 'ancillary' },
];

// ─── Generic fallback business ──────────────────────────────────
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
  storageLabel: string;
  showStorageStep: boolean;
  /** Marketplace category — cre_property, operating_business, franchise, note_sale, mixed_use_with_business */
  category?: ListingCategory;
  /** Marketplace group for sidebar grouping */
  group?: AssetClassGroup;
  /** Human-readable label; defaults to id-derived if omitted */
  label?: string;
}

const cre = (
  profitCenters: CatalogProfitCenter[],
  amenities: CatalogAmenity[],
  storageLabel: string,
  showStorageStep: boolean,
  group: AssetClassGroup,
  label: string,
): AssetClassCatalogEntry => ({
  profitCenters,
  amenities,
  hasProfitCenters: profitCenters.length > 0,
  hasAmenities: amenities.length > 0,
  storageLabel,
  showStorageStep,
  category: 'cre_property',
  group,
  label,
});

const biz = (
  profitCenters: CatalogProfitCenter[],
  group: AssetClassGroup,
  label: string,
  storageLabel = 'Revenue Streams',
): AssetClassCatalogEntry => ({
  profitCenters,
  amenities: BUSINESS_AMENITIES,
  hasProfitCenters: profitCenters.length > 0,
  hasAmenities: false,
  storageLabel,
  showStorageStep: false,
  category: 'operating_business',
  group,
  label,
});

const franchise = (
  profitCenters: CatalogProfitCenter[],
  label: string,
): AssetClassCatalogEntry => ({
  profitCenters,
  amenities: BUSINESS_AMENITIES,
  hasProfitCenters: profitCenters.length > 0,
  hasAmenities: false,
  storageLabel: 'Unit Locations',
  showStorageStep: false,
  category: 'franchise',
  group: 'franchise',
  label,
});

const note = (label: string): AssetClassCatalogEntry => ({
  profitCenters: NOTE_PROFIT_CENTERS,
  amenities: [],
  hasProfitCenters: true,
  hasAmenities: false,
  storageLabel: 'Note Terms',
  showStorageStep: false,
  category: 'note_sale',
  group: 'note_sale',
  label,
});

const ASSET_CLASS_CATALOGS: Record<string, AssetClassCatalogEntry> = {
  // ─── Legacy simplified keys (kept for back-compat with crmProperties.type) ─
  marina: cre(MARINA_PROFIT_CENTERS, MARINA_AMENITIES, 'Storage Types', true, 'marina_waterfront', 'Marina'),
  multifamily: cre(MULTIFAMILY_PROFIT_CENTERS, MULTIFAMILY_AMENITIES, 'Unit Mix', true, 'multifamily', 'Multifamily'),
  retail: cre(RETAIL_PROFIT_CENTERS, RETAIL_AMENITIES, 'Tenant Spaces', false, 'retail', 'Retail'),
  office: cre(OFFICE_PROFIT_CENTERS, OFFICE_AMENITIES, 'Tenant Spaces', false, 'office', 'Office'),
  industrial: cre(INDUSTRIAL_PROFIT_CENTERS, INDUSTRIAL_AMENITIES, 'Bay Configuration', false, 'industrial', 'Industrial'),
  self_storage: cre(SELF_STORAGE_PROFIT_CENTERS, SELF_STORAGE_AMENITIES, 'Unit Sizes', true, 'self_storage', 'Self-Storage'),
  hotel: cre(HOTEL_PROFIT_CENTERS, HOTEL_AMENITIES, 'Room Types', true, 'hospitality', 'Hotel'),
  str: cre(STR_PROFIT_CENTERS, STR_AMENITIES, 'Listing Setup', false, 'hospitality', 'Short-Term Rental'),
  medical_office: cre(MEDICAL_OFFICE_PROFIT_CENTERS, MEDICAL_OFFICE_AMENITIES, 'Tenant Suites', false, 'office', 'Medical Office'),
  mixed_use: { ...cre(MIXED_USE_PROFIT_CENTERS, MIXED_USE_AMENITIES, 'Unit Mix', true, 'specialty_cre', 'Mixed-Use'), category: 'mixed_use_with_business' },
  laundromat: { ...biz(LAUNDROMAT_PROFIT_CENTERS, 'services', 'Laundromat', 'Equipment'), amenities: LAUNDROMAT_AMENITIES, hasAmenities: true },
  sfr: cre(SFR_PROFIT_CENTERS, SFR_AMENITIES, 'Property Details', false, 'multifamily', 'Single-Family Rental'),
  business: biz(BUSINESS_PROFIT_CENTERS, 'services', 'Business'),
  duplex: cre(MULTIFAMILY_PROFIT_CENTERS, SFR_AMENITIES, 'Unit Details', true, 'multifamily', 'Duplex'),
  triplex: cre(MULTIFAMILY_PROFIT_CENTERS, SFR_AMENITIES, 'Unit Details', true, 'multifamily', 'Triplex'),
  quad: cre(MULTIFAMILY_PROFIT_CENTERS, SFR_AMENITIES, 'Unit Details', true, 'multifamily', 'Quadplex'),

  // ─── Taxonomy IDs — CRE: Marina / Waterfront ─────────────────────
  yacht_club: cre(MARINA_PROFIT_CENTERS, MARINA_AMENITIES, 'Club Facilities', false, 'marina_waterfront', 'Yacht Club'),
  boatyard: cre(MARINA_PROFIT_CENTERS, MARINA_AMENITIES, 'Yard Services', false, 'marina_waterfront', 'Boatyard'),
  dry_storage_facility: cre(MARINA_PROFIT_CENTERS, MARINA_AMENITIES, 'Rack Configuration', true, 'marina_waterfront', 'Dry Boat Storage'),
  waterfront_resort: cre(HOTEL_PROFIT_CENTERS, HOTEL_AMENITIES, 'Room Types', true, 'marina_waterfront', 'Waterfront Resort'),

  // ─── Hospitality ────────────────────────────────────────────────
  hotel_full_service: cre(HOTEL_PROFIT_CENTERS, HOTEL_AMENITIES, 'Room Types', true, 'hospitality', 'Full-Service Hotel'),
  hotel_limited_service: cre(HOTEL_PROFIT_CENTERS, HOTEL_AMENITIES, 'Room Types', true, 'hospitality', 'Limited-Service Hotel'),
  hotel_boutique: cre(HOTEL_PROFIT_CENTERS, HOTEL_AMENITIES, 'Room Types', true, 'hospitality', 'Boutique Hotel'),
  extended_stay: cre(EXTENDED_STAY_PROFIT_CENTERS, HOTEL_AMENITIES, 'Suite Types', true, 'hospitality', 'Extended Stay'),
  resort: cre(HOTEL_PROFIT_CENTERS, HOTEL_AMENITIES, 'Room Types', true, 'hospitality', 'Resort'),
  str_portfolio: cre(STR_PROFIT_CENTERS, STR_AMENITIES, 'Listing Setup', false, 'hospitality', 'STR Portfolio'),
  rv_park: cre(RV_PARK_PROFIT_CENTERS, MARINA_AMENITIES, 'Site Types', true, 'hospitality', 'RV Park / Campground'),

  // ─── Multifamily ────────────────────────────────────────────────
  apartment_garden: cre(MULTIFAMILY_PROFIT_CENTERS, MULTIFAMILY_AMENITIES, 'Unit Mix', true, 'multifamily', 'Garden Apartments'),
  apartment_midrise: cre(MULTIFAMILY_PROFIT_CENTERS, MULTIFAMILY_AMENITIES, 'Unit Mix', true, 'multifamily', 'Mid-Rise Apartments'),
  apartment_highrise: cre(MULTIFAMILY_PROFIT_CENTERS, MULTIFAMILY_AMENITIES, 'Unit Mix', true, 'multifamily', 'High-Rise Apartments'),
  student_housing: cre(STUDENT_HOUSING_PROFIT_CENTERS, MULTIFAMILY_AMENITIES, 'Bed Types', true, 'multifamily', 'Student Housing'),
  senior_housing: cre(SENIOR_HOUSING_PROFIT_CENTERS, MULTIFAMILY_AMENITIES, 'Unit / Care Types', true, 'multifamily', 'Senior Housing'),
  assisted_living: cre(SENIOR_HOUSING_PROFIT_CENTERS, MULTIFAMILY_AMENITIES, 'Unit / Care Types', true, 'multifamily', 'Assisted Living'),
  manufactured_home_park: cre(MHP_PROFIT_CENTERS, [], 'Pad Inventory', true, 'multifamily', 'Manufactured Home Park'),
  mobile_home: cre(MHP_PROFIT_CENTERS, [], 'Pad Inventory', true, 'multifamily', 'Mobile Home Park'),

  // ─── Office ────────────────────────────────────────────────────
  office_class_a: cre(OFFICE_PROFIT_CENTERS, OFFICE_AMENITIES, 'Tenant Spaces', false, 'office', 'Class A Office'),
  office_class_b: cre(OFFICE_PROFIT_CENTERS, OFFICE_AMENITIES, 'Tenant Spaces', false, 'office', 'Class B Office'),
  office_class_c: cre(OFFICE_PROFIT_CENTERS, OFFICE_AMENITIES, 'Tenant Spaces', false, 'office', 'Class C Office'),
  office_flex: cre(OFFICE_PROFIT_CENTERS, OFFICE_AMENITIES, 'Tenant Spaces', false, 'office', 'Flex Office'),
  coworking: cre(COWORKING_PROFIT_CENTERS, OFFICE_AMENITIES, 'Desk / Office Inventory', true, 'office', 'Coworking'),

  // ─── Retail CRE ────────────────────────────────────────────────
  shopping_center_strip: cre(RETAIL_PROFIT_CENTERS, RETAIL_AMENITIES, 'Tenant Spaces', false, 'retail', 'Strip Center'),
  shopping_center_neighborhood: cre(RETAIL_PROFIT_CENTERS, RETAIL_AMENITIES, 'Tenant Spaces', false, 'retail', 'Neighborhood Center'),
  shopping_center_power: cre(RETAIL_PROFIT_CENTERS, RETAIL_AMENITIES, 'Tenant Spaces', false, 'retail', 'Power Center'),
  shopping_mall: cre(RETAIL_PROFIT_CENTERS, RETAIL_AMENITIES, 'Tenant Spaces', false, 'retail', 'Regional Mall'),
  single_tenant_nnn: cre(RETAIL_PROFIT_CENTERS, RETAIL_AMENITIES, 'Lease Terms', false, 'retail', 'Single-Tenant NNN'),
  restaurant_property: cre(RETAIL_PROFIT_CENTERS, RETAIL_AMENITIES, 'Tenant Info', false, 'retail', 'Restaurant Property'),
  convenience_store_property: cre(RETAIL_PROFIT_CENTERS, RETAIL_AMENITIES, 'Tenant Info', false, 'retail', 'C-Store / Gas Property'),

  // ─── Industrial ────────────────────────────────────────────────
  warehouse: cre(INDUSTRIAL_PROFIT_CENTERS, INDUSTRIAL_AMENITIES, 'Bay Configuration', false, 'industrial', 'Warehouse'),
  distribution_center: cre(INDUSTRIAL_PROFIT_CENTERS, INDUSTRIAL_AMENITIES, 'Bay Configuration', false, 'industrial', 'Distribution Center'),
  manufacturing_facility: cre(INDUSTRIAL_PROFIT_CENTERS, INDUSTRIAL_AMENITIES, 'Bay Configuration', false, 'industrial', 'Manufacturing Facility'),
  cold_storage: cre(COLD_STORAGE_PROFIT_CENTERS, INDUSTRIAL_AMENITIES, 'Room / Chamber Config', false, 'industrial', 'Cold Storage'),
  data_center: cre(DATA_CENTER_PROFIT_CENTERS, INDUSTRIAL_AMENITIES, 'Cage / Cabinet Config', false, 'industrial', 'Data Center'),
  industrial_outdoor_storage: cre(INDUSTRIAL_PROFIT_CENTERS, INDUSTRIAL_AMENITIES, 'Yard Layout', false, 'industrial', 'Industrial Outdoor Storage'),

  // ─── Self-Storage / Land / Specialty ───────────────────────────
  self_storage_facility: cre(SELF_STORAGE_PROFIT_CENTERS, SELF_STORAGE_AMENITIES, 'Unit Sizes', true, 'self_storage', 'Self-Storage Facility'),
  land_development: cre(LAND_PROFIT_CENTERS, [], 'Parcel Info', false, 'land', 'Development Land'),
  land_agricultural: cre(LAND_PROFIT_CENTERS, [], 'Parcel Info', false, 'land', 'Agricultural Land'),
  parking_facility: cre(PARKING_PROFIT_CENTERS, [], 'Level / Section Info', false, 'specialty_cre', 'Parking Facility'),
  car_wash_property: cre(CAR_WASH_PROFIT_CENTERS, [], 'Bay Types', false, 'specialty_cre', 'Car Wash Property'),
  religious_facility: cre(RELIGIOUS_PROFIT_CENTERS, [], 'Facility Spaces', false, 'specialty_cre', 'Religious Facility'),

  // ─── Operating Businesses — Food & Beverage ─────────────────────
  biz_restaurant: biz(FOOD_BEVERAGE_PROFIT_CENTERS, 'food_beverage', 'Restaurant'),
  biz_bar: biz(FOOD_BEVERAGE_PROFIT_CENTERS, 'food_beverage', 'Bar / Tavern'),
  biz_coffee_shop: biz(FOOD_BEVERAGE_PROFIT_CENTERS, 'food_beverage', 'Coffee Shop'),
  biz_brewery: biz(BREWERY_PROFIT_CENTERS, 'food_beverage', 'Brewery'),
  biz_winery: biz(BREWERY_PROFIT_CENTERS, 'food_beverage', 'Winery'),
  biz_food_truck: biz(FOOD_BEVERAGE_PROFIT_CENTERS, 'food_beverage', 'Food Truck'),
  biz_catering: biz(FOOD_BEVERAGE_PROFIT_CENTERS, 'food_beverage', 'Catering'),

  // ─── Operating Businesses — Retail ──────────────────────────────
  biz_convenience_store: biz(RETAIL_BIZ_PROFIT_CENTERS, 'retail_business', 'Convenience Store'),
  biz_liquor_store: biz(RETAIL_BIZ_PROFIT_CENTERS, 'retail_business', 'Liquor Store'),
  biz_gas_station: biz(GAS_STATION_PROFIT_CENTERS, 'retail_business', 'Gas Station'),
  biz_smoke_shop: biz(RETAIL_BIZ_PROFIT_CENTERS, 'retail_business', 'Smoke / Vape Shop'),
  biz_apparel: biz(RETAIL_BIZ_PROFIT_CENTERS, 'retail_business', 'Apparel / Clothing'),
  biz_grocery: biz(RETAIL_BIZ_PROFIT_CENTERS, 'retail_business', 'Grocery / Specialty Food'),

  // ─── Services ───────────────────────────────────────────────────
  biz_landscaping: biz(SERVICE_BIZ_PROFIT_CENTERS, 'services', 'Landscaping'),
  biz_cleaning: biz(SERVICE_BIZ_PROFIT_CENTERS, 'services', 'Cleaning Service'),
  biz_pest_control: biz(SERVICE_BIZ_PROFIT_CENTERS, 'services', 'Pest Control'),
  biz_security: biz(SERVICE_BIZ_PROFIT_CENTERS, 'services', 'Security Services'),
  biz_pool_service: biz(SERVICE_BIZ_PROFIT_CENTERS, 'services', 'Pool Service'),
  biz_event_rental: biz(SERVICE_BIZ_PROFIT_CENTERS, 'services', 'Event Rental'),

  // ─── Tech / SaaS / Ecommerce ───────────────────────────────────
  biz_saas: biz(SAAS_PROFIT_CENTERS, 'tech_saas', 'SaaS Business'),
  biz_mobile_app: biz(SAAS_PROFIT_CENTERS, 'tech_saas', 'Mobile App'),
  biz_content_site: biz(CONTENT_SITE_PROFIT_CENTERS, 'tech_saas', 'Content Site / Blog'),
  biz_ecommerce_dtc: biz(ECOMMERCE_PROFIT_CENTERS, 'ecommerce', 'DTC E-commerce'),
  biz_amazon_fba: biz(ECOMMERCE_PROFIT_CENTERS, 'ecommerce', 'Amazon FBA'),
  biz_marketplace: biz(ECOMMERCE_PROFIT_CENTERS, 'ecommerce', 'Online Marketplace'),

  // ─── Manufacturing / Distribution ───────────────────────────────
  biz_manufacturing: biz(MANUFACTURING_PROFIT_CENTERS, 'manufacturing', 'Manufacturing'),
  biz_food_manufacturing: biz(MANUFACTURING_PROFIT_CENTERS, 'manufacturing', 'Food Manufacturing'),
  biz_distribution: biz(DISTRIBUTION_PROFIT_CENTERS, 'distribution_logistics', 'Wholesale Distribution'),
  biz_trucking: biz(TRUCKING_PROFIT_CENTERS, 'distribution_logistics', 'Trucking / Logistics'),

  // ─── Healthcare ──────────────────────────────────────────────────
  biz_dental_practice: biz(HEALTHCARE_BIZ_PROFIT_CENTERS, 'healthcare_business', 'Dental Practice'),
  biz_medical_practice: biz(HEALTHCARE_BIZ_PROFIT_CENTERS, 'healthcare_business', 'Medical Practice'),
  biz_veterinary: biz(VETERINARY_PROFIT_CENTERS, 'healthcare_business', 'Veterinary Clinic'),
  biz_home_health: biz(HEALTHCARE_BIZ_PROFIT_CENTERS, 'healthcare_business', 'Home Health / Care'),

  // ─── Automotive ──────────────────────────────────────────────────
  biz_auto_repair: biz(AUTO_REPAIR_PROFIT_CENTERS, 'automotive_business', 'Auto Repair'),
  biz_auto_dealer: biz(AUTO_DEALER_PROFIT_CENTERS, 'automotive_business', 'Auto Dealer'),
  biz_car_wash: biz(CAR_WASH_PROFIT_CENTERS, 'automotive_business', 'Car Wash'),

  // ─── Education ───────────────────────────────────────────────────
  biz_daycare: biz(EDUCATION_PROFIT_CENTERS, 'education', 'Daycare / Child Care'),
  biz_tutoring: biz(EDUCATION_PROFIT_CENTERS, 'education', 'Tutoring / Education'),

  // ─── Entertainment / Recreation ─────────────────────────────────
  biz_gym: biz(FITNESS_PROFIT_CENTERS, 'entertainment_recreation', 'Gym / Fitness'),
  biz_yoga_studio: biz(FITNESS_PROFIT_CENTERS, 'entertainment_recreation', 'Yoga / Pilates Studio'),
  biz_bowling_alley: biz(BOWLING_PROFIT_CENTERS, 'entertainment_recreation', 'Bowling Alley'),
  biz_golf_course: biz(GOLF_PROFIT_CENTERS, 'entertainment_recreation', 'Golf Course'),

  // ─── Construction / Trades ──────────────────────────────────────
  biz_general_contractor: biz(GC_PROFIT_CENTERS, 'construction_trades', 'General Contractor'),
  biz_hvac: biz(TRADES_PROFIT_CENTERS, 'construction_trades', 'HVAC'),
  biz_plumbing: biz(TRADES_PROFIT_CENTERS, 'construction_trades', 'Plumbing'),
  biz_electrical: biz(TRADES_PROFIT_CENTERS, 'construction_trades', 'Electrical Contractor'),
  biz_roofing: biz(TRADES_PROFIT_CENTERS, 'construction_trades', 'Roofing'),

  // ─── Professional Services ──────────────────────────────────────
  biz_law_firm: biz(PROFESSIONAL_SERVICES_PROFIT_CENTERS, 'professional_services', 'Law Firm'),
  biz_accounting_firm: biz(PROFESSIONAL_SERVICES_PROFIT_CENTERS, 'professional_services', 'Accounting / CPA Firm'),
  biz_insurance_agency: biz(INSURANCE_AGENCY_PROFIT_CENTERS, 'professional_services', 'Insurance Agency'),
  biz_marketing_agency: biz(PROFESSIONAL_SERVICES_PROFIT_CENTERS, 'professional_services', 'Marketing / Ad Agency'),

  // ─── Personal Care ──────────────────────────────────────────────
  biz_salon: biz(PERSONAL_CARE_PROFIT_CENTERS, 'personal_care', 'Hair Salon / Barbershop'),
  biz_spa: biz(PERSONAL_CARE_PROFIT_CENTERS, 'personal_care', 'Spa / Med Spa'),
  biz_nail_salon: biz(PERSONAL_CARE_PROFIT_CENTERS, 'personal_care', 'Nail Salon'),
  biz_tanning: biz(PERSONAL_CARE_PROFIT_CENTERS, 'personal_care', 'Tanning Salon'),

  // ─── Franchise ──────────────────────────────────────────────────
  franchise_qsr: franchise(FRANCHISE_PROFIT_CENTERS, 'QSR Franchise'),
  franchise_fitness: franchise(FRANCHISE_PROFIT_CENTERS, 'Fitness Franchise'),
  franchise_services: franchise(FRANCHISE_PROFIT_CENTERS, 'Service Franchise'),
  franchise_retail: franchise(FRANCHISE_PROFIT_CENTERS, 'Retail Franchise'),

  // ─── Notes ──────────────────────────────────────────────────────
  note_performing: note('Performing Note'),
  note_non_performing: note('Non-Performing Note'),
};

export function getAssetClassCatalog(assetClass: string | null): AssetClassCatalogEntry {
  return ASSET_CLASS_CATALOGS[assetClass || 'marina'] || ASSET_CLASS_CATALOGS.marina;
}

/** Returns every registered asset class key. */
export function getAllAssetClassCatalogKeys(): string[] {
  return Object.keys(ASSET_CLASS_CATALOGS);
}

/** Returns whether the catalog recognises a given key. */
export function hasAssetClassCatalog(assetClass: string): boolean {
  return assetClass in ASSET_CLASS_CATALOGS;
}

export { ASSET_CLASS_CATALOGS };
export type { AssetClassCatalogEntry };
