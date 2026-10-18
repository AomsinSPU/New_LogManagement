import { z } from 'zod';
import { ingestSchema } from './ingest.schema.js';
import { normalizeCommonJson } from '../../normalizers/common-json.js';
import { createIngestRepository } from './ingest.repository.js';

export const batchSchema = z.object({
  source: z.enum(['api','ad','aws','m365','crowdstrike','firewall','network']),
  filename: z.string().trim().min(1).max(255).refine(value => !/[\u0000-\u001f]/.test(value)).optional(),
  records: z.array(z.unknown()).min(1).max(500),
}).strict();

export function createBatchService(pool) {
  return async (auth, input) => {
    const accepted = [];
    const errors = [];
    let rejected = 0;
    input.records.forEach((record, index) => {
      const parsed = ingestSchema.safeParse(record);
      if (!parsed.success || parsed.data.source !== input.source) {
        rejected++;
        if (errors.length < 50) errors.push({ index, message: parsed.success ? 'Source does not match batch' : 'Invalid common-schema record' });
      } else accepted.push(normalizeCommonJson(parsed.data, JSON.stringify(record)));
    });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: [batch] } = await client.query(`INSERT INTO ingestion_batches
        (tenant_id,ingest_key_id,submitted_by,source,filename,total_count)
        VALUES($1,$2,$3,$4,$5,$6) RETURNING id`, [auth.tenant_id,
        auth.type === 'ingest' ? auth.ingest_key_id : null,
        auth.type === 'session' ? auth.user_id : null,
        input.source, input.filename ?? null, input.records.length]);
      const repository = createIngestRepository(client);
      for (const event of accepted) await repository.insert({ ...auth, batch_id: batch.id }, event);
      const status = rejected === 0 ? 'completed' : accepted.length ? 'partial' : 'failed';
      const { rows: [result] } = await client.query(`UPDATE ingestion_batches
        SET accepted_count=$2,rejected_count=$3,status=$4,error_summary=$5,completed_at=clock_timestamp()
        WHERE id=$1 RETURNING id,source,filename,status,total_count,accepted_count,rejected_count,
        error_summary,created_at,completed_at`, [batch.id, accepted.length, rejected, status, JSON.stringify(errors)]);
      await client.query('COMMIT');
      return { data: result };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  };
}