export type AssetClass = 'marina' | 'hotel' | 'rv_park' | 'storage_unit' | 'industrial' | 'parking';

export type DenomType = 'count' | 'lf' | 'sqft' | 'room_nights' | 'site_nights' | 'bays';

export type CapacityWeightField = 'length_ft' | 'sqft' | 'count' | 'none';

export interface UnitTypeConfig {
  label: string;
  denomType: DenomType;
  capacityWeightField: CapacityWeightField;
  supportsTransient: boolean;
  defaultBands?: Array<{ key: string; label: string; minFt?: number; maxFt?: number }>;
}

export interface AssetClassConfig {
  label: string;
  unitTypes: Record<string, UnitTypeConfig>;
  defaultUtilizationMode: 'contracted' | 'physical';
}

export const ASSET_CLASS_CONFIG: Record<AssetClass, AssetClassConfig> = {
  marina: {
    label: 'Marina',
    defaultUtilizationMode: 'contracted',
    unitTypes: {
      wet_slip: {
        label: 'Wet Slip',
        denomType: 'lf',
        capacityWeightField: 'length_ft',
        supportsTransient: true,
        defaultBands: [
          { key: '0_25', label: "Up to 25'", minFt: 0, maxFt: 25 },
          { key: '26_35', label: "26'–35'", minFt: 26, maxFt: 35 },
          { key: '36_45', label: "36'–45'", minFt: 36, maxFt: 45 },
          { key: '46_60', label: "46'–60'", minFt: 46, maxFt: 60 },
          { key: '61_plus', label: "61'+", minFt: 61 },
        ],
      },
      lift_slip: {
        label: 'Lift Slip',
        denomType: 'lf',
        capacityWeightField: 'length_ft',
        supportsTransient: false,
        defaultBands: [
          { key: '0_25', label: "Up to 25'", minFt: 0, maxFt: 25 },
          { key: '26_35', label: "26'–35'", minFt: 26, maxFt: 35 },
          { key: '36_45', label: "36'–45'", minFt: 36, maxFt: 45 },
          { key: '46_60', label: "46'–60'", minFt: 46, maxFt: 60 },
          { key: '61_plus', label: "61'+", minFt: 61 },
        ],
      },
      dry_rack: {
        label: 'Dry Rack',
        denomType: 'count',
        capacityWeightField: 'length_ft',
        supportsTransient: false,
        defaultBands: [
          { key: '0_25', label: "Up to 25'", minFt: 0, maxFt: 25 },
          { key: '26_35', label: "26'–35'", minFt: 26, maxFt: 35 },
          { key: '36_plus', label: "36'+", minFt: 36 },
        ],
      },
      dry_slip: {
        label: 'Dry Slip',
        denomType: 'count',
        capacityWeightField: 'length_ft',
        supportsTransient: false,
      },
      mooring: {
        label: 'Mooring',
        denomType: 'count',
        capacityWeightField: 'none',
        supportsTransient: true,
      },
      anchorage: {
        label: 'Anchorage',
        denomType: 'count',
        capacityWeightField: 'none',
        supportsTransient: true,
      },
      indoor_rack: {
        label: 'Indoor Rack',
        denomType: 'count',
        capacityWeightField: 'length_ft',
        supportsTransient: false,
      },
      outdoor_rack: {
        label: 'Outdoor Rack',
        denomType: 'count',
        capacityWeightField: 'length_ft',
        supportsTransient: false,
      },
    },
  },

  hotel: {
    label: 'Hotel',
    defaultUtilizationMode: 'physical',
    unitTypes: {
      standard_room: {
        label: 'Standard Room',
        denomType: 'room_nights',
        capacityWeightField: 'count',
        supportsTransient: true,
      },
      suite: {
        label: 'Suite',
        denomType: 'room_nights',
        capacityWeightField: 'count',
        supportsTransient: true,
      },
      cabana: {
        label: 'Cabana',
        denomType: 'room_nights',
        capacityWeightField: 'count',
        supportsTransient: true,
      },
    },
  },

  rv_park: {
    label: 'RV Park',
    defaultUtilizationMode: 'physical',
    unitTypes: {
      full_hookup: {
        label: 'Full Hookup',
        denomType: 'site_nights',
        capacityWeightField: 'count',
        supportsTransient: true,
      },
      partial_hookup: {
        label: 'Partial Hookup',
        denomType: 'site_nights',
        capacityWeightField: 'count',
        supportsTransient: true,
      },
      dry_camping: {
        label: 'Dry Camping',
        denomType: 'site_nights',
        capacityWeightField: 'count',
        supportsTransient: true,
      },
    },
  },

  storage_unit: {
    label: 'Storage Unit',
    defaultUtilizationMode: 'contracted',
    unitTypes: {
      indoor: {
        label: 'Indoor',
        denomType: 'sqft',
        capacityWeightField: 'sqft',
        supportsTransient: false,
      },
      outdoor: {
        label: 'Outdoor',
        denomType: 'sqft',
        capacityWeightField: 'sqft',
        supportsTransient: false,
      },
      climate_controlled: {
        label: 'Climate Controlled',
        denomType: 'sqft',
        capacityWeightField: 'sqft',
        supportsTransient: false,
      },
    },
  },

  industrial: {
    label: 'Industrial',
    defaultUtilizationMode: 'contracted',
    unitTypes: {
      bay: {
        label: 'Bay',
        denomType: 'bays',
        capacityWeightField: 'sqft',
        supportsTransient: false,
      },
      warehouse: {
        label: 'Warehouse',
        denomType: 'sqft',
        capacityWeightField: 'sqft',
        supportsTransient: false,
      },
    },
  },

  parking: {
    label: 'Parking',
    defaultUtilizationMode: 'physical',
    unitTypes: {
      covered: {
        label: 'Covered',
        denomType: 'count',
        capacityWeightField: 'count',
        supportsTransient: true,
      },
      uncovered: {
        label: 'Uncovered',
        denomType: 'count',
        capacityWeightField: 'count',
        supportsTransient: true,
      },
    },
  },
};

export function getAssetClassConfig(assetClass: AssetClass): AssetClassConfig | undefined {
  return ASSET_CLASS_CONFIG[assetClass];
}

export function getUnitTypeConfig(assetClass: AssetClass, unitType: string): UnitTypeConfig | undefined {
  return ASSET_CLASS_CONFIG[assetClass]?.unitTypes[unitType];
}

export function getBandForLength(assetClass: AssetClass, unitType: string, lengthFt: number): string | null {
  const config = getUnitTypeConfig(assetClass, unitType);
  if (!config?.defaultBands) return null;
  for (const band of config.defaultBands) {
    const min = band.minFt ?? 0;
    const max = band.maxFt ?? Infinity;
    if (lengthFt >= min && lengthFt <= max) return band.key;
  }
  return null;
}
