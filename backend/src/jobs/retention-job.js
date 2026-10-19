export async function runRetentionJob(pool,{dryRun=true,batchSize=1000,maxBatches=100}={}) {
  if (!Number.isInteger(batchSize)||batchSize<1||batchSize>10000||!Number.isInteger(maxBatches)||maxBatches<1||maxBatches>10000) throw new Error('Invalid retention limits');
  const client=await pool.connect();
  let locked=false;
  try {
    locked=(await client.query('SELECT pg_try_advisory_lock(173601,2) AS locked')).rows[0].locked;
    if (!locked) return {skipped:true};
    // Evaluate one cutoff per run. Minimum 7 days even if legacy configuration is invalid.
    const {rows:[time]}=await client.query('SELECT clock_timestamp() AS cutoff');
    const cutoff=time.cutoff;
    const logWhere=`l.tenant_id=t.id AND l.ingested_at < $1::timestamptz - (GREATEST(t.retention_days,7)*interval '1 day')`;
    // Preserve session history for 7 days after expiration/revocation; leave idle sessions until absolute expiry.
    const sessionWhere=`expires_at < $1::timestamptz - interval '7 days' OR revoked_at < $1::timestamptz - interval '7 days'`;
    if (dryRun) {
      const logs=(await client.query(`SELECT count(*) AS n FROM logs l,tenants t WHERE ${logWhere}`,[cutoff])).rows[0].n;
      const sessions=(await client.query(`SELECT count(*) AS n FROM user_sessions WHERE ${sessionWhere}`,[cutoff])).rows[0].n;
      return {dry_run:true,eligible_logs:Number(logs),eligible_sessions:Number(sessions)};
    }
    let logs=0,sessions=0;
    for(let i=0;i<maxBatches;i++) {
      const result=await client.query(`WITH doomed AS (SELECT l.id FROM logs l,tenants t WHERE ${logWhere}
        ORDER BY l.ingested_at,l.id LIMIT $2 FOR UPDATE OF l SKIP LOCKED)
        DELETE FROM logs WHERE id IN (SELECT id FROM doomed)`,[cutoff,batchSize]);
      logs+=result.rowCount;if(result.rowCount<batchSize)break;
    }
    for(let i=0;i<maxBatches;i++) {
      const result=await client.query(`WITH doomed AS (SELECT id FROM user_sessions WHERE ${sessionWhere}
        ORDER BY expires_at,id LIMIT $2 FOR UPDATE SKIP LOCKED)
        DELETE FROM user_sessions WHERE id IN (SELECT id FROM doomed)`,[cutoff,batchSize]);
      sessions+=result.rowCount;if(result.rowCount<batchSize)break;
    }
    return {dry_run:false,deleted_logs:logs,deleted_sessions:sessions,max_batches:maxBatches};
  } finally {
    try {if(locked)await client.query('SELECT pg_advisory_unlock(173601,2)');}
    finally {client.release(true);}
  }
}