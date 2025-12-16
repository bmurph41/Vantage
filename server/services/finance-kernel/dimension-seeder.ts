import { db } from '../../db';
import { fkDimensions, fkDimensionValues } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export interface SystemDimension {
  key: string;
  label: string;
  values: Array<{ valueKey: string; valueLabel: string }>;
}

export const MARINA_SYSTEM_DIMENSIONS: SystemDimension[] = [
  {
    key: 'department',
    label: 'Department',
    values: [
      { valueKey: 'wet_slips', valueLabel: 'Wet Slips' },
      { valueKey: 'dry_storage', valueLabel: 'Dry Storage' },
      { valueKey: 'lifts', valueLabel: 'Lifts' },
      { valueKey: 'fuel', valueLabel: 'Fuel' },
      { valueKey: 'service', valueLabel: 'Service' },
      { valueKey: 'ship_store', valueLabel: 'Ship Store' },
      { valueKey: 'restaurant_bar', valueLabel: 'Restaurant/Bar' },
      { valueKey: 'storage', valueLabel: 'Storage' },
      { valueKey: 'boat_rentals', valueLabel: 'Boat Rentals' },
      { valueKey: 'boat_club', valueLabel: 'Boat Club' },
      { valueKey: 'boat_sales', valueLabel: 'Boat Sales' },
      { valueKey: 'other', valueLabel: 'Other' },
    ],
  },
  {
    key: 'slip_type',
    label: 'Slip Type',
    values: [
      { valueKey: 'wet', valueLabel: 'Wet Slip' },
      { valueKey: 'lift', valueLabel: 'Boat Lift' },
      { valueKey: 'rack', valueLabel: 'Dry Rack' },
      { valueKey: 'mooring', valueLabel: 'Mooring' },
      { valueKey: 'transient', valueLabel: 'Transient' },
    ],
  },
  {
    key: 'season',
    label: 'Season',
    values: [
      { valueKey: 'in_season', valueLabel: 'In-Season' },
      { valueKey: 'off_season', valueLabel: 'Off-Season' },
      { valueKey: 'shoulder', valueLabel: 'Shoulder Season' },
    ],
  },
  {
    key: 'channel',
    label: 'Channel',
    values: [
      { valueKey: 'tenant', valueLabel: 'Tenant' },
      { valueKey: 'transient', valueLabel: 'Transient' },
      { valueKey: 'broker', valueLabel: 'Broker' },
      { valueKey: 'membership', valueLabel: 'Membership' },
      { valueKey: 'walk_in', valueLabel: 'Walk-In' },
      { valueKey: 'online', valueLabel: 'Online' },
      { valueKey: 'other', valueLabel: 'Other' },
    ],
  },
  {
    key: 'marina',
    label: 'Marina',
    values: [],
  },
  {
    key: 'capex_project',
    label: 'CapEx Project',
    values: [],
  },
  {
    key: 'storm_event',
    label: 'Storm Event',
    values: [],
  },
];

export async function seedSystemDimensions(orgId: string): Promise<void> {
  for (const dimension of MARINA_SYSTEM_DIMENSIONS) {
    const existingDimension = await db
      .select()
      .from(fkDimensions)
      .where(and(eq(fkDimensions.orgId, orgId), eq(fkDimensions.key, dimension.key)))
      .limit(1);

    let dimensionId: string;

    if (existingDimension.length === 0) {
      const [inserted] = await db
        .insert(fkDimensions)
        .values({
          orgId,
          key: dimension.key,
          label: dimension.label,
          isSystem: true,
        })
        .returning();
      dimensionId = inserted.id;
    } else {
      dimensionId = existingDimension[0].id;
    }

    for (const value of dimension.values) {
      const existingValue = await db
        .select()
        .from(fkDimensionValues)
        .where(
          and(
            eq(fkDimensionValues.dimensionId, dimensionId),
            eq(fkDimensionValues.valueKey, value.valueKey)
          )
        )
        .limit(1);

      if (existingValue.length === 0) {
        await db.insert(fkDimensionValues).values({
          orgId,
          dimensionId,
          valueKey: value.valueKey,
          valueLabel: value.valueLabel,
        });
      }
    }
  }
}

export async function getDimensionsWithValues(orgId: string) {
  const dimensions = await db
    .select()
    .from(fkDimensions)
    .where(eq(fkDimensions.orgId, orgId));

  const result = [];

  for (const dimension of dimensions) {
    const values = await db
      .select()
      .from(fkDimensionValues)
      .where(eq(fkDimensionValues.dimensionId, dimension.id));

    result.push({
      ...dimension,
      values,
    });
  }

  return result;
}
