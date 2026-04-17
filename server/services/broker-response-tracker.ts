interface QueryPool {
  query<R = any>(text: string, params?: unknown[]): Promise<{ rows: R[]; rowCount?: number | null }>;
}

export type BrokerThreadType = "advisory_message" | "comment_thread";

export interface ResponseSampleInput {
  brokerProfileId: string;
  threadType: BrokerThreadType;
  threadId: string;
  inboundAt: Date;
  brokerReplyAt?: Date | null;
}

const HOUR_SECONDS = 3600;
const THIRTY_DAYS_MS = 30 * 86_400_000;
const UNANSWERED_AFTER_HOURS = 168;

export async function recordInboundMessage(
  pool: QueryPool,
  input: Omit<ResponseSampleInput, "brokerReplyAt">,
): Promise<void> {
  await pool.query(
    `INSERT INTO broker_response_samples (broker_profile_id, thread_type, thread_id, first_inbound_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (thread_type, thread_id) DO NOTHING`,
    [input.brokerProfileId, input.threadType, input.threadId, input.inboundAt],
  );
}

export async function recordBrokerReply(
  pool: QueryPool,
  input: ResponseSampleInput & { brokerReplyAt: Date },
): Promise<void> {
  const { rows } = await pool.query<{
    id: string;
    first_inbound_at: Date;
    first_broker_reply_at: Date | null;
  }>(
    `SELECT id, first_inbound_at, first_broker_reply_at
       FROM broker_response_samples
      WHERE thread_type = $1 AND thread_id = $2`,
    [input.threadType, input.threadId],
  );
  if (rows.length === 0) return;
  const sample = rows[0];
  if (sample.first_broker_reply_at) return;

  const responseSeconds = Math.max(
    0,
    Math.floor((input.brokerReplyAt.getTime() - sample.first_inbound_at.getTime()) / 1000),
  );

  await pool.query(
    `UPDATE broker_response_samples
        SET first_broker_reply_at = $2,
            response_seconds = $3,
            is_unanswered = false
      WHERE id = $1`,
    [sample.id, input.brokerReplyAt, responseSeconds],
  );
}

export interface ResponseStats {
  brokerProfileId: string;
  averageResponseHours: number | null;
  medianResponseHours: number | null;
  responseRate30d: number | null;
  responseSamples30d: number;
}

export async function computeResponseStats(
  pool: QueryPool,
  brokerProfileId: string,
): Promise<ResponseStats> {
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);
  const { rows: answered } = await pool.query<{ response_seconds: number }>(
    `SELECT response_seconds
       FROM broker_response_samples
      WHERE broker_profile_id = $1
        AND first_inbound_at >= $2
        AND first_broker_reply_at IS NOT NULL
        AND response_seconds IS NOT NULL`,
    [brokerProfileId, cutoff],
  );
  const { rows: totalRows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM broker_response_samples
      WHERE broker_profile_id = $1 AND first_inbound_at >= $2`,
    [brokerProfileId, cutoff],
  );

  const total = parseInt(totalRows[0]?.count ?? "0", 10);
  const seconds = answered.map((r) => r.response_seconds).sort((a, b) => a - b);

  const avg =
    seconds.length === 0 ? null : seconds.reduce((s, v) => s + v, 0) / seconds.length;
  const median = seconds.length === 0 ? null : percentile(seconds, 0.5);
  const rate = total === 0 ? null : (seconds.length / total) * 100;

  return {
    brokerProfileId,
    averageResponseHours: avg === null ? null : avg / HOUR_SECONDS,
    medianResponseHours: median === null ? null : median / HOUR_SECONDS,
    responseRate30d: rate === null ? null : Math.round(rate * 100) / 100,
    responseSamples30d: total,
  };
}

export async function persistResponseStats(
  pool: QueryPool,
  stats: ResponseStats,
): Promise<void> {
  await pool.query(
    `UPDATE broker_profiles
        SET average_response_hours = $2,
            median_response_hours = $3,
            response_rate_30d = $4,
            response_samples_30d = $5,
            trust_stats_last_recomputed_at = NOW(),
            updated_at = NOW()
      WHERE id = $1`,
    [
      stats.brokerProfileId,
      roundOrNull(stats.averageResponseHours),
      roundOrNull(stats.medianResponseHours),
      stats.responseRate30d,
      stats.responseSamples30d,
    ],
  );
}

export async function recomputeAndPersistResponseStats(
  pool: QueryPool,
  brokerProfileId: string,
): Promise<ResponseStats> {
  const stats = await computeResponseStats(pool, brokerProfileId);
  await persistResponseStats(pool, stats);
  return stats;
}

export async function markStaleUnanswered(pool: QueryPool): Promise<number> {
  const cutoff = new Date(Date.now() - UNANSWERED_AFTER_HOURS * 3600 * 1000);
  const { rowCount } = await pool.query(
    `UPDATE broker_response_samples
        SET is_unanswered = true
      WHERE first_broker_reply_at IS NULL
        AND is_unanswered = false
        AND first_inbound_at < $1`,
    [cutoff],
  );
  return rowCount ?? 0;
}

export async function recomputeAllBrokerResponseStats(pool: QueryPool): Promise<{
  scanned: number;
  updated: number;
}> {
  await markStaleUnanswered(pool);
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM broker_profiles`,
  );
  for (const row of rows) {
    await recomputeAndPersistResponseStats(pool, row.id);
  }
  return { scanned: rows.length, updated: rows.length };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function roundOrNull(n: number | null): string | null {
  if (n === null) return null;
  return (Math.round(n * 100) / 100).toFixed(2);
}
