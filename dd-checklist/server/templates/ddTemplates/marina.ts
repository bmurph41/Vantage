import { ChecklistTemplate } from './types';

/**
 * Marina DD Request List Add-On
 * Based on user's "DD Request List Template.xlsx" structure.
 * Covers: marina operations, docks/slips, fuel, boats, pedestals, permits, environmental, service.
 */
export const MARINA_ADDON_TEMPLATE: ChecklistTemplate = {
  name: 'Marina DD Add-On',
  version: '1.0.0',
  assetClass: 'marina',
  sections: [
    // ═══ MARINA OPERATIONS ══════════════════════════════════════════════════
    {
      key: 'marina_ops',
      title: 'Marina Operations & Management',
      description: 'Day-to-day marina operations, staffing, and management systems',
      items: [
        { key: 'mar_ops_01', title: 'Marina Management Software', requestText: 'Identify marina management system (Dockwa, MarinaOffice, Molo, etc.) and provide login/export capabilities.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller', tags: ['marina', 'operations'] },
        { key: 'mar_ops_02', title: 'Slip/Berth Inventory & Layout', requestText: 'Provide complete slip inventory showing slip#, size (LOA/beam), type (wet/dry), and current occupancy.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 5, defaultOwnerRole: 'seller' },
        { key: 'mar_ops_03', title: 'Slip Rate Schedule', requestText: 'Provide current and historical rate schedule by slip size, season, and storage type.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'mar_ops_04', title: 'Occupancy History (3 years)', requestText: 'Provide monthly occupancy rates by slip type for the last 3 years (wet, dry, mooring).', priority: 1, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'mar_ops_05', title: 'Wait List', requestText: 'Provide current wait list for slips showing boat size, requested dates, and deposit status.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'mar_ops_06', title: 'Seasonal Operations Calendar', requestText: 'Provide seasonal calendar: launch/haul dates, winter storage, shrink-wrap, de-winterization.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'mar_ops_07', title: 'Revenue by Category (3 years)', requestText: 'Break down revenue by: dockage, storage, fuel, service, ship store, boat rentals, charters, food/bev, other.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'mar_ops_08', title: 'Standard Slip License/Rental Agreement', requestText: 'Provide standard slip license agreement or rental contract used with slip holders.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller', tags: ['lease'] },
        { key: 'mar_ops_09', title: 'Long-Term Slip Agreements', requestText: 'Provide all long-term slip agreements, deeded slips, or slip ownership arrangements.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'mar_ops_10', title: 'Transient/Guest Docking Policies', requestText: 'Provide transient docking rates, reservation policies, and revenue history.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
      ],
    },

    // ═══ DOCK SYSTEMS & INFRASTRUCTURE ═══════════════════════════════════════
    {
      key: 'marina_docks',
      title: 'Dock Systems & Infrastructure',
      description: 'Physical dock condition, pilings, utilities, and capital planning',
      items: [
        { key: 'mar_dock_01', title: 'Dock Condition Survey', requestText: 'Provide recent dock/pier condition survey or marine structural engineering assessment.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 14, defaultOwnerRole: 'consultant', tags: ['marina', 'docks'] },
        { key: 'mar_dock_02', title: 'Piling Inspection Report', requestText: 'Provide piling inspection report showing condition, remaining useful life, and replacement needs.', priority: 1, requestType: 'document', defaultOwnerRole: 'consultant' },
        { key: 'mar_dock_03', title: 'Dock Layout / Marina Map', requestText: 'Provide scaled marina layout showing all docks, fairways, channels, depths, and utilities.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'mar_dock_04', title: 'Dredging History & Permits', requestText: 'Provide dredging history, permits, bathymetric surveys, and spoil disposal records.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller', tags: ['dredging'] },
        { key: 'mar_dock_05', title: 'Dock Age & Replacement Schedule', requestText: 'Provide age of each dock system and planned replacement/rehabilitation schedule with cost estimates.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'mar_dock_06', title: 'Seawall / Bulkhead Condition', requestText: 'Provide seawall/bulkhead condition assessment and any repair/replacement history.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'mar_dock_07', title: 'Floating vs. Fixed Dock Inventory', requestText: 'Identify all floating vs. fixed dock systems, manufacturers, and warranty status.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'mar_dock_08', title: 'Boat Lift / Travel Lift Inventory', requestText: 'Provide inventory of boat lifts and travel lifts: manufacturer, capacity, age, maintenance records.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller', tags: ['equipment'] },
      ],
    },

    // ═══ PEDESTAL / ELECTRICAL / UTILITIES ═══════════════════════════════════
    {
      key: 'marina_pedestal',
      title: 'Pedestal / Electrical / Dock Utilities',
      description: 'Electrical pedestals, shore power, water, and dock utility systems',
      items: [
        { key: 'mar_ped_01', title: 'Pedestal Inventory', requestText: 'Provide complete pedestal inventory: location, manufacturer, amp rating (30A/50A/100A), age, condition.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller', tags: ['marina', 'pedestal'] },
        { key: 'mar_ped_02', title: 'Electrical Load Analysis', requestText: 'Provide electrical load analysis showing main service capacity, transformer sizing, and available capacity.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'mar_ped_03', title: 'Electrical Inspection Report', requestText: 'Provide most recent electrical inspection of dock systems and compliance with NFPA 303 / NEC.', priority: 1, requestType: 'document', defaultOwnerRole: 'consultant' },
        { key: 'mar_ped_04', title: 'Sub-Metering / Utility Billing', requestText: 'Document how electric and water are metered and billed to slip holders (sub-metered vs. flat rate).', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'mar_ped_05', title: 'Shore Power Revenue', requestText: 'Provide shore power revenue history and rate schedule (included vs. billed separately).', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'mar_ped_06', title: 'Dock Water System', requestText: 'Document dock water supply system: backflow preventers, hose bibs, winterization procedures.', priority: 3, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'mar_ped_07', title: 'Pump-Out Station & Compliance', requestText: 'Provide pump-out station records, EPA No Discharge Zone compliance, and maintenance logs.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller', tags: ['environmental'] },
      ],
    },

    // ═══ FUEL OPERATIONS ════════════════════════════════════════════════════
    {
      key: 'marina_fuel',
      title: 'Fuel Operations',
      description: 'Fuel storage, dispensing, compliance, and revenue',
      items: [
        { key: 'mar_fuel_01', title: 'Fuel Tank Inventory', requestText: 'Provide fuel tank inventory: location (AST/UST), capacity, fuel type, age, manufacturer.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller', tags: ['marina', 'fuel'] },
        { key: 'mar_fuel_02', title: 'Fuel Dispensing Records (3 years)', requestText: 'Provide 3-year fuel dispensing history by month: gallons sold and revenue by fuel type.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'mar_fuel_03', title: 'SPCC Plan', requestText: 'Provide current Spill Prevention, Control, and Countermeasure (SPCC) plan.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller', tags: ['environmental'] },
        { key: 'mar_fuel_04', title: 'Tank Inspection & Testing', requestText: 'Provide tank tightness testing, corrosion protection records, and inspection reports.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'mar_fuel_05', title: 'Fuel Supplier Contracts', requestText: 'Provide fuel supply agreements, pricing terms, and delivery logistics.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'mar_fuel_06', title: 'State Fuel License', requestText: 'Confirm state fuel retail license status and transferability.', priority: 1, requestType: 'verification', defaultOwnerRole: 'attorney' },
      ],
    },

    // ═══ BOATS & VEHICLES ═══════════════════════════════════════════════════
    {
      key: 'marina_boats',
      title: 'Boats, Vehicles & Personal Property',
      description: 'Vessels, vehicles, and equipment included in the sale',
      items: [
        { key: 'mar_boat_01', title: 'Boat Inventory (Owned)', requestText: 'List all marina-owned boats/vessels: make, model, year, HIN, registration, condition, value.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller', tags: ['marina', 'boats'] },
        { key: 'mar_boat_02', title: 'Rental Fleet Details', requestText: 'Provide rental fleet inventory: vessel details, rental rates, utilization history, maintenance records.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'mar_boat_03', title: 'Vehicle & Equipment Inventory', requestText: 'List all vehicles, golf carts, forklifts, tractors included: VIN, registration, condition, value.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller', tags: ['equipment'] },
        { key: 'mar_boat_04', title: 'Personal Property Schedule', requestText: 'Provide complete schedule of FF&E and personal property included in the sale.', priority: 1, requestType: 'document', milestoneAnchor: 'closing', dueOffsetDays: -14, defaultOwnerRole: 'seller' },
        { key: 'mar_boat_05', title: 'Charter/Tour Operations', requestText: 'Provide charter/tour license details, revenue history, and USCG documentation.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'mar_boat_06', title: 'Abandoned / Derelict Vessel Policy', requestText: 'Disclose any abandoned boats on premises and removal procedures/costs.', priority: 2, requestType: 'answer', defaultOwnerRole: 'seller' },
      ],
    },

    // ═══ MARINA PERMITS & REGULATORY ════════════════════════════════════════
    {
      key: 'marina_permits',
      title: 'Marina Permits & Regulatory',
      description: 'Waterway permits, Army Corps, DEP/DEEP, and regulatory compliance',
      items: [
        { key: 'mar_perm_01', title: 'Army Corps of Engineers Permit', requestText: 'Provide current USACE Section 10 / Section 404 permits for all in-water structures.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller', tags: ['marina', 'permits'] },
        { key: 'mar_perm_02', title: 'State Environmental / DEP Permits', requestText: 'Provide all state environmental agency permits: coastal, tidelands, submerged lands, etc.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'mar_perm_03', title: 'Submerged Land Lease', requestText: 'Provide submerged land lease or riparian rights documentation from the state.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller', tags: ['lease'] },
        { key: 'mar_perm_04', title: 'Marina Operating License', requestText: 'Provide marina operating license from local/state authority; confirm transferability.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'mar_perm_05', title: 'Clean Marina Certification', requestText: 'Provide Clean Marina or Clean Boatyard certification status and documentation.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'mar_perm_06', title: 'USCG Compliance', requestText: 'Provide USCG facility inspection history and any compliance orders.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'mar_perm_07', title: 'Navigational Channel Maintenance', requestText: 'Identify responsibility for navigational channel maintenance and any agreements with municipal/federal agencies.', priority: 2, requestType: 'answer', defaultOwnerRole: 'seller' },
        { key: 'mar_perm_08', title: 'Mooring Permits', requestText: 'Provide mooring field permits, mooring inventory, and revenue schedules.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
      ],
    },

    // ═══ MARINA ENVIRONMENTAL ═══════════════════════════════════════════════
    {
      key: 'marina_env',
      title: 'Marina Environmental',
      description: 'Marina-specific environmental concerns: water quality, sediment, wetlands',
      items: [
        { key: 'mar_env_01', title: 'Water Quality Testing', requestText: 'Provide water quality test results for marina basin and surrounding waterway.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller', tags: ['marina', 'environmental'] },
        { key: 'mar_env_02', title: 'Sediment Testing Results', requestText: 'Provide sediment sampling/testing results relevant to dredging permitting.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'mar_env_03', title: 'Stormwater Pollution Prevention', requestText: 'Provide Stormwater Pollution Prevention Plan (SWPPP) and inspection records.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'mar_env_04', title: 'Hazardous Materials Storage', requestText: 'Inventory all hazardous materials stored on-site: paints, solvents, oils, antifreeze, batteries.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'mar_env_05', title: 'Marina Best Management Practices', requestText: 'Document BMPs for hull maintenance, painting, engine repair, and waste disposal.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
      ],
    },

    // ═══ SERVICE / REPAIR OPERATIONS ════════════════════════════════════════
    {
      key: 'marina_service',
      title: 'Service / Repair / Boat Yard',
      description: 'Boat service, repair operations, parts, and yard management',
      items: [
        { key: 'mar_svc_01', title: 'Service Department Revenue', requestText: 'Provide 3-year service department revenue breakdown: labor, parts, sublet, storage.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller', tags: ['marina', 'service'] },
        { key: 'mar_svc_02', title: 'Labor Rate Schedule', requestText: 'Provide current labor rate schedule by service type and technician certification level.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'mar_svc_03', title: 'Technician Certifications', requestText: 'List technician certifications: ABYC, Mercury, Yamaha, Volvo, etc.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'mar_svc_04', title: 'Parts Inventory Valuation', requestText: 'Provide current parts/inventory valuation and age analysis.', priority: 1, requestType: 'document', milestoneAnchor: 'closing', dueOffsetDays: -14, defaultOwnerRole: 'seller' },
        { key: 'mar_svc_05', title: 'Ship Store Inventory', requestText: 'Provide ship store/retail inventory valuation if included in sale.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'mar_svc_06', title: 'Dealer / Brand Agreements', requestText: 'Provide all boat dealer agreements, brand authorization, and franchise contracts.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'mar_svc_07', title: 'Work Order History', requestText: 'Provide 12-month work order summary showing volume, average ticket, and completion rates.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
      ],
    },

    // ═══ STORM / EMERGENCY PLANNING ═════════════════════════════════════════
    {
      key: 'marina_storm',
      title: 'Storm / Emergency Planning',
      description: 'Hurricane preparedness, emergency response, and insurance',
      items: [
        { key: 'mar_storm_01', title: 'Hurricane/Storm Plan', requestText: 'Provide written hurricane/storm preparation and response plan.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller', tags: ['marina', 'storm'] },
        { key: 'mar_storm_02', title: 'Storm Damage History', requestText: 'Provide 10-year history of storm/hurricane damage, repair costs, and insurance claims.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'mar_storm_03', title: 'Emergency Contact / Communication Plan', requestText: 'Provide emergency contact tree and slip holder communication procedures.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'mar_storm_04', title: 'Flood Zone / Storm Surge Analysis', requestText: 'Provide FEMA flood zone maps and storm surge modeling for the property.', priority: 1, requestType: 'document', defaultOwnerRole: 'consultant' },
      ],
    },
  ],
};
