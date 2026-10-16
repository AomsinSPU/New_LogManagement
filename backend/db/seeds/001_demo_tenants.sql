-- Development/demo fixtures only. No usable passwords, API secrets or sessions.
-- Stable UUIDs make re-runs insert-only: existing rows are never reset.
BEGIN;

DO $$
DECLARE
    label TEXT;
    source_name TEXT;
    tenant_uuid UUID;
    admin_uuid UUID;
    key_uuid UUID;
    batch_uuid UUID;
    rule_uuid UUID;
    anchor TIMESTAMPTZ;
    record_count INTEGER;
    n INTEGER;
    event_name TEXT;
    event_action TEXT;
    event_outcome TEXT;
    source_ip INET;
    original JSONB;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.schema_migrations WHERE version = '009_add_search_indexes.sql') THEN
        RAISE EXCEPTION 'Apply all migrations before demo seeds';
    END IF;

    FOREACH label IN ARRAY ARRAY['a', 'b'] LOOP
        tenant_uuid := md5('logmanagement-demo:tenant:' || label)::UUID;
        admin_uuid := md5('logmanagement-demo:admin:' || label)::UUID;
        key_uuid := md5('logmanagement-demo:key:' || label)::UUID;
        rule_uuid := md5('logmanagement-demo:rule:' || label)::UUID;
        source_ip := CASE label WHEN 'a' THEN '203.0.113.10'::INET ELSE '198.51.100.20'::INET END;

        INSERT INTO public.tenants(id, slug, name)
        VALUES (tenant_uuid, 'demo-' || label, 'Demo Company ' || upper(label))
        ON CONFLICT (id) DO NOTHING;

        -- Reserved fixture IDs must not silently attach data to unrelated existing rows.
        IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = tenant_uuid AND slug = 'demo-' || label) THEN
            RAISE EXCEPTION 'Reserved demo tenant ID collision';
        END IF;

        INSERT INTO public.users(id, tenant_id, email, password_hash, display_name, role, is_active)
        VALUES
            (admin_uuid, tenant_uuid, 'admin-' || label || '@demo.invalid',
             '!disabled-demo-account', 'Demo Admin ' || upper(label), 'admin', FALSE),
            (md5('logmanagement-demo:viewer:' || label)::UUID, tenant_uuid,
             'viewer-' || label || '@demo.invalid', '!disabled-demo-account',
             'Demo Viewer ' || upper(label), 'viewer', FALSE)
        ON CONFLICT (id) DO NOTHING;

        -- A disabled sentinel is deliberately NOT a password hash supported by an auth library.
        -- Future auth provisioning must set a real hash and explicitly activate the account.
        INSERT INTO public.ingest_keys(id, tenant_id, name, key_prefix, key_hash,
            allowed_sources, created_by, revoked_at)
        VALUES (key_uuid, tenant_uuid, 'Revoked demo collector', 'demo-' || label,
            '!disabled-demo-key-' || label,
            ARRAY['firewall','network','api','crowdstrike','aws','m365','ad'], admin_uuid, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.user_sessions(id, user_id, token_hash, created_at, last_seen_at,
            expires_at, revoked_at, user_agent)
        VALUES (md5('logmanagement-demo:session:' || label)::UUID, admin_uuid,
            '!disabled-demo-session-' || label, CURRENT_TIMESTAMP - INTERVAL '2 days',
            CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '1 day',
            CURRENT_TIMESTAMP - INTERVAL '1 day', 'Demo fixture: expired and revoked')
        ON CONFLICT (id) DO NOTHING;

        FOREACH source_name IN ARRAY ARRAY['firewall','network','api','crowdstrike','aws','m365','ad'] LOOP
            batch_uuid := md5('logmanagement-demo:batch:' || label || ':' || source_name)::UUID;
            record_count := CASE source_name WHEN 'ad' THEN 5 ELSE 1 END;
            INSERT INTO public.ingestion_batches(id, tenant_id, submitted_by, source, filename,
                status, total_count, accepted_count, created_at, completed_at)
            VALUES (batch_uuid, tenant_uuid, admin_uuid, source_name, 'demo-' || source_name || '.json',
                'completed', record_count, record_count, CURRENT_TIMESTAMP - INTERVAL '10 minutes',
                CURRENT_TIMESTAMP - INTERVAL '5 minutes')
            ON CONFLICT (id) DO NOTHING;

            -- Keep the original fixture clock when seeds are run again.
            SELECT completed_at INTO anchor FROM public.ingestion_batches WHERE id = batch_uuid;
            event_name := CASE source_name
                WHEN 'ad' THEN 'authentication' WHEN 'api' THEN 'authentication'
                WHEN 'm365' THEN 'authentication' WHEN 'aws' THEN 'user_management'
                WHEN 'crowdstrike' THEN 'threat_detection' ELSE 'network_connection' END;
            event_action := CASE source_name
                WHEN 'ad' THEN 'login' WHEN 'api' THEN 'login' WHEN 'm365' THEN 'login'
                WHEN 'aws' THEN 'create' WHEN 'crowdstrike' THEN 'alert'
                WHEN 'firewall' THEN 'deny' ELSE 'allow' END;
            event_outcome := CASE source_name WHEN 'ad' THEN 'failure'
                WHEN 'firewall' THEN 'failure' WHEN 'crowdstrike' THEN 'unknown' ELSE 'success' END;

            FOR n IN 1..record_count LOOP
                original := jsonb_build_object('synthetic', TRUE, 'source', source_name,
                    'sequence', n, 'user', 'demo-user-' || label, 'ip', host(source_ip),
                    'event', event_name, 'outcome', event_outcome,
                    'timestamp', anchor - n * INTERVAL '30 seconds');
                INSERT INTO public.logs(id, tenant_id, batch_id, event_timestamp, ingested_at,
                    source, vendor, product, source_event_id, event_type, event_subtype,
                    severity, action, outcome, message, src_ip, dst_ip, src_port, dst_port,
                    protocol, actor_user, host, metadata, raw, tags)
                VALUES (
                    md5('logmanagement-demo:log:' || label || ':' || source_name || ':' || n)::UUID,
                    tenant_uuid, batch_uuid, anchor - n * INTERVAL '30 seconds',
                    anchor - n * INTERVAL '30 seconds', source_name, 'demo', 'synthetic-fixtures',
                    'demo-' || label || '-' || source_name || '-' || n, event_name,
                    CASE WHEN source_name = 'ad' THEN 'login_failed'
                         WHEN source_name IN ('api','m365') THEN 'login_success' ELSE NULL END,
                    CASE WHEN source_name IN ('ad','crowdstrike') THEN 7 ELSE 3 END,
                    event_action, event_outcome,
                    CASE WHEN source_name = 'ad' THEN 'Failed login for demo-user-' || label
                         ELSE 'Demo ' || source_name || ' event for tenant ' || label END,
                    source_ip,
                    CASE WHEN source_name IN ('firewall','network') THEN '192.0.2.10'::INET ELSE NULL END,
                    CASE WHEN source_name IN ('firewall','network') THEN 51000 ELSE NULL END,
                    CASE WHEN source_name IN ('firewall','network') THEN 443 ELSE NULL END,
                    CASE WHEN source_name IN ('firewall','network') THEN 'tcp' ELSE NULL END,
                    CASE WHEN source_name IN ('firewall','network') THEN NULL ELSE 'demo-user-' || label END,
                    'demo-host-' || label,
                    jsonb_build_object('synthetic', TRUE) || CASE source_name
                        WHEN 'ad' THEN '{"event_id":4625,"original_event_type":"LogonFailed"}'::JSONB
                        WHEN 'aws' THEN '{"cloud":{"account_id":"000000000000","region":"ap-southeast-1","service":"iam"},"original_event_type":"CreateUser"}'::JSONB
                        WHEN 'm365' THEN '{"workload":"Exchange","original_event_type":"UserLoggedIn"}'::JSONB
                        ELSE '{}'::JSONB END,
                    original::TEXT, ARRAY['demo','synthetic'])
                ON CONFLICT (id) DO NOTHING;
            END LOOP;
        END LOOP;

        INSERT INTO public.alert_rules(id, tenant_id, name, description, created_by)
        VALUES (rule_uuid, tenant_uuid, 'Repeated failed logins',
            'At least 5 failed authentications from one IP in 300 seconds.', admin_uuid)
        ON CONFLICT (id) DO NOTHING;

        SELECT completed_at INTO anchor FROM public.ingestion_batches
        WHERE id = md5('logmanagement-demo:batch:' || label || ':ad')::UUID;

        INSERT INTO public.alerts(id, tenant_id, rule_id, title, severity, src_ip, event_count,
            window_start, window_end, evidence, dedup_key, created_at, updated_at)
        VALUES (md5('logmanagement-demo:alert:' || label)::UUID, tenant_uuid, rule_uuid,
            'Demo: five failed logins from ' || host(source_ip), 5, source_ip, 5,
            anchor - INTERVAL '5 minutes', anchor,
            jsonb_build_object('synthetic', TRUE, 'precomputed_fixture', TRUE,
                'rule_snapshot', jsonb_build_object('rule_type','failed_login_threshold',
                    'threshold',5,'window_seconds',300,'cooldown_seconds',300),
                'log_ids', (SELECT jsonb_agg(id ORDER BY ingested_at) FROM public.logs
                    WHERE batch_id = md5('logmanagement-demo:batch:' || label || ':ad')::UUID)),
            'demo-failed-login-' || label, anchor, anchor)
        ON CONFLICT (id) DO NOTHING;
    END LOOP;
END;
$$;

COMMIT;
