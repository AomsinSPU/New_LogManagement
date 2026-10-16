BEGIN;

CREATE INDEX logs_tenant_time_idx ON public.logs(tenant_id, event_timestamp DESC, id DESC);
CREATE INDEX logs_tenant_source_time_idx ON public.logs(tenant_id, source, event_timestamp DESC);
CREATE INDEX logs_failed_auth_idx ON public.logs(tenant_id, src_ip, ingested_at)
    WHERE event_type = 'authentication' AND outcome = 'failure' AND src_ip IS NOT NULL;
CREATE INDEX logs_retention_idx ON public.logs(tenant_id, ingested_at);
CREATE INDEX logs_batch_idx ON public.logs(tenant_id, batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX logs_ingest_key_idx ON public.logs(tenant_id, ingest_key_id) WHERE ingest_key_id IS NOT NULL;
CREATE INDEX logs_message_search_idx ON public.logs USING GIN(search_vector);
CREATE INDEX alerts_tenant_time_idx ON public.alerts(tenant_id, created_at DESC);
CREATE INDEX alerts_rule_window_idx ON public.alerts(tenant_id, rule_id, src_ip, window_end DESC);
CREATE INDEX alert_rules_enabled_idx ON public.alert_rules(tenant_id, is_enabled);

INSERT INTO public.schema_migrations (version) VALUES ('009_add_search_indexes.sql');
COMMIT;