import { createHash } from 'node:crypto';

export async function runAlertJob(pool) {
  const { rows: rules } = await pool.query(`SELECT r.id FROM public.alert_rules r
    JOIN public.tenants t ON t.id=r.tenant_id WHERE r.is_enabled AND t.is_active ORDER BY r.id`);
  let created = 0;
  for (const { id } of rules) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // All worker instances serialize each rule; configuration changes use the same row lock.
      const { rows: [rule] } = await client.query(`SELECT r.* FROM public.alert_rules r
        JOIN public.tenants t ON t.id=r.tenant_id WHERE r.id=$1 AND r.is_enabled AND t.is_active
        FOR UPDATE OF r SKIP LOCKED`, [id]);
      if (!rule) { await client.query('COMMIT'); continue; }
      const { rows: [time] } = await client.query(`SELECT clock_timestamp() AS finish`);
      const end = time.finish;
      const start = new Date(end.getTime() - rule.window_seconds * 1000);
      const { rows: groups } = await client.query(`SELECT host(src_ip) AS ip,count(*)::int AS count
        FROM public.logs WHERE tenant_id=$1 AND event_type='authentication' AND outcome='failure'
        AND src_ip IS NOT NULL AND ingested_at >= $2 AND ingested_at < $3 GROUP BY src_ip HAVING count(*) >= $4`,
        [rule.tenant_id,start,end,rule.threshold]);
      for (const group of groups) {
        const { rows: evidence } = await client.query(`SELECT id,ingested_at FROM public.logs
          WHERE tenant_id=$1 AND src_ip=$2 AND event_type='authentication' AND outcome='failure'
          AND ingested_at >= $3 AND ingested_at < $4 ORDER BY ingested_at DESC,id DESC LIMIT 20`, [rule.tenant_id,group.ip,start,end]);
        if (!evidence.length) continue;
        const { rows: [recent] } = await client.query(`SELECT evidence,created_at FROM public.alerts
          WHERE tenant_id=$1 AND rule_id=$2 AND src_ip=$3 ORDER BY created_at DESC,id DESC LIMIT 1`, [rule.tenant_id,id,group.ip]);
        if (recent && (end - recent.created_at < rule.cooldown_seconds * 1000 || recent.evidence.latest_log_id === evidence[0].id)) continue;
        const dedup = createHash('sha256').update(`${id}:${group.ip}:${evidence[0].id}`).digest('hex');
        const result = await client.query(`INSERT INTO public.alerts
          (tenant_id,rule_id,title,severity,src_ip,event_count,window_start,window_end,evidence,dedup_key)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(tenant_id,dedup_key) DO NOTHING`,
          [rule.tenant_id,id,rule.name,rule.severity,group.ip,group.count,start,end,JSON.stringify({
            latest_log_id: evidence[0].id, log_ids: evidence.map(e => e.id), sampled: group.count > evidence.length,
            rule: { name: rule.name, threshold: rule.threshold, window_seconds: rule.window_seconds, cooldown_seconds: rule.cooldown_seconds },
          }),dedup]);
        created += result.rowCount;
      }
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  return { created };
}