const publicColumns = `id, name, key_prefix, allowed_sources, expires_at, revoked_at,
  last_used_at, created_by, created_at`;

export function createKeyRepository(pool) {
  return {
    async create({ tenantId, userId, name, hash, prefix, sources, expiresAt }) {
      const { rows } = await pool.query(`INSERT INTO public.ingest_keys
        (tenant_id,created_by,name,key_hash,key_prefix,allowed_sources,expires_at)
        SELECT $1,$2,$3,$4,$5,$6,$7::timestamptz
        WHERE $7::timestamptz IS NULL OR $7::timestamptz > CURRENT_TIMESTAMP
        RETURNING ${publicColumns}`, [tenantId, userId, name, hash, prefix, sources, expiresAt]);
      return rows[0];
    },
    async list(tenantId, limit, offset) {
      const { rows } = await pool.query(`SELECT ${publicColumns} FROM public.ingest_keys
        WHERE tenant_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3`, [tenantId, limit, offset]);
      return rows;
    },
    async revoke(tenantId, id) {
      const { rows } = await pool.query(`UPDATE public.ingest_keys
        SET revoked_at=COALESCE(revoked_at,clock_timestamp())
        WHERE tenant_id=$1 AND id=$2 RETURNING id`, [tenantId, id]);
      return rows[0];
    },
  };
}