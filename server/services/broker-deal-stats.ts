interface QueryPool {
  query<R = any>(text: string, params?: unknown[]): Promise<{ rows: R[]; rowCount?: number | null }>;
}

export interface BrokerDealStats {
  brokerProfileId: string;
  verifiedClosedDealsCount: number;
  verifiedClosedDealsVolume: number;
  verifiedClosedDealsAssetClasses: string[];
  verifiedClosedDealsLastAt: Date | null;
}

export async function computeBrokerDealStats(
  pool: QueryPool,
  brokerProfileId: string,
): Promise<BrokerDealStats> {
  const { rows } = await pool.query<{
    count: string;
    volume: string | null;
    last_closed: Date | null;
  }>(
    `SELECT
        COUNT(*)::text AS count,
        COALESCE(SUM(COALESCE(value, amount, offer_price, 0)), 0)::text AS volume,
        MAX(closed_at) AS last_closed
       FROM crm_deals
      WHERE broker_profile_id = $1
        AND is_closed = true`,
    [brokerProfileId],
  );

  const { rows: assetRows } = await pool.query<{ asset_class: string | null }>(
    `SELECT DISTINCT asset_class
       FROM crm_deals
      WHERE broker_profile_id = $1
        AND is_closed = true
        AND asset_class IS NOT NULL`,
    [brokerProfileId],
  );

  const row = rows[0];
  return {
    brokerProfileId,
    verifiedClosedDealsCount: row ? parseInt(row.count, 10) : 0,
    verifiedClosedDealsVolume: row?.volume ? parseFloat(row.volume) : 0,
    verifiedClosedDealsAssetClasses: assetRows.map((r) => r.asset_class!).filter(Boolean),
    verifiedClosedDealsLastAt: row?.last_closed ?? null,
  };
}

export async function persistBrokerDealStats(
  pool: QueryPool,
  stats: BrokerDealStats,
): Promise<void> {
  await pool.query(
    `UPDATE broker_profiles
        SET verified_closed_deals_count = $2,
            verified_closed_deals_volume = $3,
            verified_closed_deals_asset_classes = $4::jsonb,
            verified_closed_deals_last_at = $5,
            trust_stats_last_recomputed_at = NOW(),
            updated_at = NOW()
      WHERE id = $1`,
    [
      stats.brokerProfileId,
      stats.verifiedClosedDealsCount,
      stats.verifiedClosedDealsVolume.toFixed(2),
      JSON.stringify(stats.verifiedClosedDealsAssetClasses),
      stats.verifiedClosedDealsLastAt,
    ],
  );
}

export async function recomputeAndPersistBrokerDealStats(
  pool: QueryPool,
  brokerProfileId: string,
): Promise<BrokerDealStats> {
  const stats = await computeBrokerDealStats(pool, brokerProfileId);
  await persistBrokerDealStats(pool, stats);
  return stats;
}

export async function recomputeAllBrokerDealStats(pool: QueryPool): Promise<{
  scanned: number;
  updated: number;
}> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM broker_profiles`,
  );
  let updated = 0;
  for (const row of rows) {
    await recomputeAndPersistBrokerDealStats(pool, row.id);
    updated += 1;
  }
  return { scanned: rows.length, updated };
}

export async function attributeDealToBroker(
  pool: QueryPool,
  dealId: string,
  brokerProfileId: string | null,
): Promise<void> {
  const { rows } = await pool.query<{ broker_profile_id: string | null }>(
    `SELECT broker_profile_id FROM crm_deals WHERE id = $1`,
    [dealId],
  );
  if (rows.length === 0) throw new Error(`Deal ${dealId} not found`);
  const previous = rows[0].broker_profile_id;

  await pool.query(
    `UPDATE crm_deals SET broker_profile_id = $2, updated_at = NOW() WHERE id = $1`,
    [dealId, brokerProfileId],
  );

  const toRecompute = new Set<string>();
  if (previous) toRecompute.add(previous);
  if (brokerProfileId) toRecompute.add(brokerProfileId);
  for (const id of toRecompute) {
    await recomputeAndPersistBrokerDealStats(pool, id);
  }
}

export interface BrokerVerifiedDealRow {
  id: string;
  title: string;
  assetClass: string | null;
  closedAt: Date;
  volume: number | null;
  city: string | null;
  state: string | null;
}

export async function getBrokerVerifiedDeals(
  pool: QueryPool,
  brokerProfileId: string,
  limit = 10,
): Promise<BrokerVerifiedDealRow[]> {
  const { rows } = await pool.query<{
    id: string;
    title: string;
    asset_class: string | null;
    closed_at: Date;
    volume: string | null;
    city: string | null;
    state: string | null;
  }>(
    `SELECT id, title, asset_class, closed_at,
            COALESCE(value, amount, offer_price, 0)::text AS volume,
            city, state
       FROM crm_deals
      WHERE broker_profile_id = $1
        AND is_closed = true
      ORDER BY closed_at DESC
      LIMIT $2`,
    [brokerProfileId, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    assetClass: r.asset_class,
    closedAt: r.closed_at,
    volume: r.volume ? parseFloat(r.volume) : null,
    city: r.city,
    state: r.state,
  }));
}
