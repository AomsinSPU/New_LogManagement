import { buildLogFilter } from '../logs/logs.repository.js';
import { bucketSeconds } from './dashboard.schema.js';

export function createDashboardRepository(pool) {
  return {
    async summary(tenantId, filter) {
      const { where, values } = buildLogFilter(tenantId, filter);
      values.push(filter.top);
      const limit = `$${values.length}`;
      // One statement gives all aggregates a consistent snapshot.
      const top = column => `(SELECT COALESCE(jsonb_agg(t ORDER BY t.count DESC,t.value), '[]'::jsonb)
        FROM (SELECT ${column === 'src_ip' ? 'host(src_ip)' : column + '::text'} AS value,count(*) AS count FROM filtered
          WHERE ${column} IS NOT NULL GROUP BY ${column} ORDER BY count DESC,value LIMIT ${limit}) t)`;
      const { rows: [row] } = await pool.query(`WITH filtered AS MATERIALIZED (
        SELECT src_ip,actor_user,event_type,outcome FROM public.logs WHERE ${where}
      ) SELECT count(*) AS total,
        count(*) FILTER (WHERE outcome='failure') AS failures,
        count(*) FILTER (WHERE outcome='success') AS successes,
        count(*) FILTER (WHERE outcome='unknown' OR outcome IS NULL) AS unknown,
        ${top('src_ip')} AS top_ips, ${top('actor_user')} AS top_users,
        ${top('event_type')} AS top_event_types FROM filtered`, values);
      return { ...row, total: Number(row.total), failures: Number(row.failures),
        successes: Number(row.successes), unknown: Number(row.unknown) };
    },
    async timeline(tenantId, filter) {
      const { where, values } = buildLogFilter(tenantId, filter);
      values.push(`${bucketSeconds[filter.interval]} seconds`, filter.from, filter.to);
      const stride = `$${values.length - 2}::interval`;
      const start = `$${values.length - 1}::timestamptz`;
      const end = `$${values.length}::timestamptz`;
      const { rows } = await pool.query(`WITH counts AS (
        SELECT date_bin(${stride},event_timestamp,${start}) AS bucket_start,count(*) AS count
        FROM public.logs WHERE ${where} GROUP BY 1
      ) SELECT b AS bucket_start, LEAST(b + ${stride},${end}) AS bucket_end,
          COALESCE(c.count,0) AS count
        FROM generate_series(${start},${end},${stride}) b
        LEFT JOIN counts c ON c.bucket_start=b WHERE b < ${end} ORDER BY b`, values);
      return rows.map(row => ({ ...row, count: Number(row.count) }));
    },
  };
}