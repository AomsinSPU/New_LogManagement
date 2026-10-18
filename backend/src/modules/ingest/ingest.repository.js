// Column names below are fixed application constants, never request-provided SQL identifiers.
const columns = ['event_timestamp', 'source', 'vendor', 'product', 'source_event_id',
  'event_type', 'event_subtype', 'severity', 'action', 'outcome', 'message', 'src_ip', 'dst_ip',
  'src_port', 'dst_port', 'protocol', 'actor_user', 'host', 'metadata', 'raw', 'tags', 'normalizer_version'];

export function createIngestRepository(pool) {
  return {
    async insert(auth, event) {
      const values = [auth.tenant_id, auth.ingest_key_id ?? null, auth.batch_id ?? null,
        ...columns.map(column => column === 'metadata' ? JSON.stringify(event[column]) : event[column] ?? null)];
      const { rows } = await pool.query(`INSERT INTO public.logs
        (tenant_id,ingest_key_id,batch_id,${columns.join(',')})
        VALUES (${values.map((_, index) => '$' + (index + 1)).join(',')})
        RETURNING id, source, event_timestamp, ingested_at`, values);
      return rows[0];
    },
  };
}