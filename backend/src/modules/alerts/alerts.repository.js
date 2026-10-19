import { httpError } from '../../middleware/http-error.js';
export function createAlertsRepository(pool) {
  return {
    async list(tenant, filter, rules = false) {
      const values = [tenant];
      let where = 'tenant_id=$1';
      if (!rules && filter.status) { values.push(filter.status); where += ' AND status=$2'; }
      values.push(filter.limit + 1, filter.offset);
      const { rows } = await pool.query(`SELECT * FROM public.${rules ? 'alert_rules' : 'alerts'} WHERE ${where}
        ORDER BY created_at DESC,id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
      return { data: rows.slice(0, filter.limit), pagination: { ...filter, has_more: rows.length > filter.limit } };
    },
    async detail(tenant, id) {
      const { rows: [row] } = await pool.query('SELECT * FROM public.alerts WHERE tenant_id=$1 AND id=$2', [tenant, id]);
      if (!row) throw httpError(404);
      return row;
    },
    async create(auth, input) {
      const { rows: [row] } = await pool.query(`INSERT INTO public.alert_rules
        (tenant_id,created_by,name,description,rule_type,threshold,window_seconds,cooldown_seconds,severity,is_enabled)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [auth.tenant_id,auth.user_id,input.name,
        input.description ?? null,input.rule_type,input.threshold,input.window_seconds,input.cooldown_seconds,input.severity,input.is_enabled]);
      return row;
    },
    async patchRule(tenant, id, input) {
      const columns = ['name','description','rule_type','threshold','window_seconds','cooldown_seconds','severity','is_enabled'];
      const keys = columns.filter(key => input[key] !== undefined);
      const { rows: [row] } = await pool.query(`UPDATE public.alert_rules SET ${keys.map((key,i) => `${key}=$${i+3}`).join(',')}
        WHERE tenant_id=$1 AND id=$2 RETURNING *`, [tenant,id,...keys.map(key => input[key])]);
      if (!row) throw httpError(404);
      return row;
    },
    async status(auth, id, status) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows: [row] } = await client.query('SELECT * FROM public.alerts WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [auth.tenant_id,id]);
        if (!row) throw httpError(404);
        if (row.status === status) { await client.query('COMMIT'); return row; }
        if (row.status === 'resolved') throw httpError(409);
        const { rows: [updated] } = await client.query(`UPDATE public.alerts SET status=$3,
          acknowledged_by=CASE WHEN $3='acknowledged' THEN $4 ELSE acknowledged_by END,
          acknowledged_at=CASE WHEN $3='acknowledged' THEN clock_timestamp() ELSE acknowledged_at END,
          resolved_at=CASE WHEN $3='resolved' THEN clock_timestamp() ELSE NULL END
          WHERE tenant_id=$1 AND id=$2 RETURNING *`, [auth.tenant_id,id,status,auth.user_id]);
        await client.query('COMMIT'); return updated;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
  };
}