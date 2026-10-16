\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
    label TEXT;
    tenant_uuid UUID;
    batch RECORD;
    alert_row RECORD;
BEGIN
    FOREACH label IN ARRAY ARRAY['a','b'] LOOP
        tenant_uuid := md5('logmanagement-demo:tenant:' || label)::UUID;
        IF (SELECT count(*) FROM public.users WHERE tenant_id = tenant_uuid) <> 2
           OR (SELECT count(*) FROM public.ingest_keys WHERE tenant_id = tenant_uuid) <> 1
           OR (SELECT count(*) FROM public.ingestion_batches WHERE tenant_id = tenant_uuid) <> 7
           OR (SELECT count(*) FROM public.logs WHERE tenant_id = tenant_uuid) <> 11
           OR (SELECT count(DISTINCT source) FROM public.logs WHERE tenant_id = tenant_uuid) <> 7
           OR (SELECT count(*) FROM public.alert_rules WHERE tenant_id = tenant_uuid) <> 1
           OR (SELECT count(*) FROM public.alerts WHERE tenant_id = tenant_uuid) <> 1 THEN
            RAISE EXCEPTION 'Incorrect demo row counts for %', label;
        END IF;
        IF EXISTS (SELECT 1 FROM public.users WHERE tenant_id = tenant_uuid AND is_active)
           OR EXISTS (SELECT 1 FROM public.ingest_keys WHERE tenant_id = tenant_uuid AND revoked_at IS NULL) THEN
            RAISE EXCEPTION 'Demo credentials must not be active';
        END IF;
        IF (SELECT count(*) FROM public.user_sessions s JOIN public.users u ON u.id = s.user_id
            WHERE u.tenant_id = tenant_uuid AND s.revoked_at IS NOT NULL AND s.expires_at < CURRENT_TIMESTAMP) <> 1 THEN
            RAISE EXCEPTION 'Expected one expired revoked session per tenant';
        END IF;
        IF (SELECT count(*) FROM public.logs WHERE tenant_id = tenant_uuid
            AND search_vector @@ plainto_tsquery('simple', 'failed login')) <> 5 THEN
            RAISE EXCEPTION 'Search fixtures do not match expected failed logins';
        END IF;
        FOR batch IN SELECT * FROM public.ingestion_batches WHERE tenant_id = tenant_uuid LOOP
            IF batch.accepted_count <> (SELECT count(*) FROM public.logs WHERE batch_id = batch.id)
               OR EXISTS (SELECT 1 FROM public.logs WHERE batch_id = batch.id
                          AND (source <> batch.source OR tenant_id <> batch.tenant_id)) THEN
                RAISE EXCEPTION 'Batch provenance/count mismatch';
            END IF;
        END LOOP;
        FOR alert_row IN SELECT * FROM public.alerts WHERE tenant_id = tenant_uuid LOOP
            IF alert_row.event_count <> (SELECT count(*) FROM public.logs
                WHERE tenant_id = tenant_uuid AND event_type = 'authentication' AND outcome = 'failure'
                    AND src_ip = alert_row.src_ip AND ingested_at >= alert_row.window_start
                    AND ingested_at < alert_row.window_end)
                OR jsonb_array_length(alert_row.evidence->'log_ids') <> 5 THEN
                RAISE EXCEPTION 'Alert evidence/window does not match logs';
            END IF;
        END LOOP;
    END LOOP;
    RAISE NOTICE 'All demo seed assertions passed';
END;
$$;
ROLLBACK;