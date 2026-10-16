\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
    tenant_a UUID;
    tenant_b UUID;
    admin_a UUID;
    key_a UUID;
    rule_a UUID;
    batch_a UUID;
BEGIN
    IF (SELECT count(*) FROM public.schema_migrations) <> 10 THEN
        RAISE EXCEPTION 'Expected ten applied migrations';
    END IF;
    INSERT INTO public.tenants(slug, name) VALUES ('schema-test-a', 'Test A') RETURNING id INTO tenant_a;
    INSERT INTO public.tenants(slug, name) VALUES ('schema-test-b', 'Test B') RETURNING id INTO tenant_b;
    INSERT INTO public.users(tenant_id, email, password_hash, display_name, role)
        VALUES (tenant_a, 'schema-test@example.invalid', 'test-only-not-a-real-password-hash', 'Test', 'admin')
        RETURNING id INTO admin_a;

    BEGIN
        INSERT INTO public.tenants(slug, name, retention_days) VALUES ('invalid-retention', 'Invalid', 6);
        RAISE EXCEPTION 'Retention constraint failed';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO public.users(tenant_id, email, password_hash, display_name, role)
            VALUES (tenant_a, 'invalid@example.invalid', 'test', 'Test', 'owner');
        RAISE EXCEPTION 'Role constraint failed';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    INSERT INTO public.user_sessions(user_id, token_hash, expires_at)
        VALUES (admin_a, 'test-session-one', CURRENT_TIMESTAMP + INTERVAL '1 day'),
               (admin_a, 'test-session-two', CURRENT_TIMESTAMP + INTERVAL '1 day');
    BEGIN
        INSERT INTO public.user_sessions(user_id, token_hash, expires_at)
            VALUES (admin_a, 'expired-session', CURRENT_TIMESTAMP - INTERVAL '1 day');
        RAISE EXCEPTION 'Session expiry constraint failed';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    INSERT INTO public.ingest_keys(tenant_id, name, key_prefix, key_hash, allowed_sources, created_by)
        VALUES (tenant_a, 'Test key', 'test', 'test-key-hash', ARRAY['ad'], admin_a) RETURNING id INTO key_a;
    BEGIN
        INSERT INTO public.ingest_keys(tenant_id, name, key_prefix, key_hash, allowed_sources, created_by)
            VALUES (tenant_b, 'Invalid', 'bad', 'invalid-key-hash', ARRAY['ad'], admin_a);
        RAISE EXCEPTION 'Cross-tenant creator accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;

    INSERT INTO public.ingestion_batches(tenant_id, ingest_key_id, source, status, total_count, accepted_count, completed_at)
        VALUES (tenant_a, key_a, 'ad', 'completed', 1, 1, CURRENT_TIMESTAMP) RETURNING id INTO batch_a;
    BEGIN
        INSERT INTO public.ingestion_batches(tenant_id, submitted_by, source, total_count, accepted_count)
            VALUES (tenant_a, admin_a, 'ad', 1, 2);
        RAISE EXCEPTION 'Batch counts constraint failed';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    INSERT INTO public.logs(tenant_id, ingest_key_id, batch_id, event_timestamp, source,
        event_type, outcome, src_ip, actor_user, message, raw)
        VALUES (tenant_a, key_a, batch_a, CURRENT_TIMESTAMP, 'ad', 'authentication',
                'failure', '203.0.113.10', 'alice', 'Windows login failed for alice', '{"event_id":4625}');
    IF NOT EXISTS (SELECT 1 FROM public.logs WHERE tenant_id = tenant_a
                   AND search_vector @@ plainto_tsquery('simple', 'login failed')) THEN
        RAISE EXCEPTION 'Full-text search failed';
    END IF;
    BEGIN
        INSERT INTO public.logs(tenant_id, ingest_key_id, event_timestamp, source, event_type, raw)
            VALUES (tenant_b, key_a, CURRENT_TIMESTAMP, 'ad', 'authentication', 'test');
        RAISE EXCEPTION 'Cross-tenant ingest key accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO public.logs(tenant_id, event_timestamp, source, event_type, raw, severity)
            VALUES (tenant_a, CURRENT_TIMESTAMP, 'ad', 'authentication', 'test', 11);
        RAISE EXCEPTION 'Severity constraint failed';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    INSERT INTO public.alert_rules(tenant_id, name, created_by)
        VALUES (tenant_a, 'Failed login test', admin_a) RETURNING id INTO rule_a;
    INSERT INTO public.alerts(tenant_id, rule_id, title, severity, src_ip, event_count, window_start, window_end, dedup_key)
        VALUES (tenant_a, rule_a, 'Test', 5, '203.0.113.10', 5,
                CURRENT_TIMESTAMP - INTERVAL '5 minutes', CURRENT_TIMESTAMP, 'test-dedup');
    BEGIN
        INSERT INTO public.alerts(tenant_id, rule_id, title, severity, src_ip, event_count, window_start, window_end, dedup_key)
            VALUES (tenant_a, rule_a, 'Duplicate', 5, '203.0.113.10', 5,
                    CURRENT_TIMESTAMP - INTERVAL '5 minutes', CURRENT_TIMESTAMP, 'test-dedup');
        RAISE EXCEPTION 'Duplicate alert accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO public.alerts(tenant_id, rule_id, title, severity, src_ip, event_count, window_start, window_end, dedup_key)
            VALUES (tenant_b, rule_a, 'Invalid tenant', 5, '203.0.113.10', 5,
                    CURRENT_TIMESTAMP - INTERVAL '5 minutes', CURRENT_TIMESTAMP, 'cross-tenant');
        RAISE EXCEPTION 'Cross-tenant rule accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;

    UPDATE public.tenants SET name = 'Updated A' WHERE id = tenant_a;
    IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = tenant_a AND updated_at > created_at) THEN
        RAISE EXCEPTION 'updated_at trigger failed';
    END IF;
    RAISE NOTICE 'All schema assertions passed';
END;
$$;

ROLLBACK;