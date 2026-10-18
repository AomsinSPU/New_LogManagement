const summaryColumns = `id,event_timestamp,ingested_at,source,event_type,event_subtype,severity,
  action,outcome,message,src_ip,dst_ip,src_port,dst_port,protocol,actor_user,host,tags`;
const detailColumns = `${summaryColumns},tenant_id,ingest_key_id,batch_id,vendor,product,
  source_event_id,metadata,raw,normalizer_version`;

export function buildLogFilter(tenantId, filter) {
  const values = [tenantId];
  const conditions = ['tenant_id=$1'];
  const add = (expression, value) => {
    values.push(value);
    conditions.push(expression.replace('?', '$' + values.length));
  };
  if (filter.from) add('event_timestamp >= ?::timestamptz', filter.from);
  if (filter.to) add('event_timestamp < ?::timestamptz', filter.to);
  const columns = { source: 'source', src_ip: 'src_ip', dst_ip: 'dst_ip', user: 'actor_user',
    event_type: 'event_type', outcome: 'outcome', severity: 'severity' };
  for (const [field, column] of Object.entries(columns)) {
    if (filter[field] !== undefined) add(`${column} = ?`, filter[field]);
  }
  if (filter.q) add("search_vector @@ plainto_tsquery('simple', ?)", filter.q);
  return { where: conditions.join(' AND '), values };
}

export function createLogsRepository(pool) {
  return {
    async list(tenantId, filter) {
      const { where, values } = buildLogFilter(tenantId, filter);
      values.push(filter.limit + 1, filter.offset);
      const { rows } = await pool.query(`SELECT ${summaryColumns} FROM public.logs WHERE ${where}
        ORDER BY event_timestamp DESC,id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
      return rows;
    },
    async detail(tenantId, id) {
      const { rows } = await pool.query(`SELECT ${detailColumns} FROM public.logs
        WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
      return rows[0];
    },
  };
}