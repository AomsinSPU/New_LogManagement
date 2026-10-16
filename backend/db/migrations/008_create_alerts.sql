BEGIN;

CREATE TABLE public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    rule_id UUID NOT NULL,
    title TEXT NOT NULL CHECK (btrim(title) <> ''),
    severity SMALLINT NOT NULL CHECK (severity BETWEEN 0 AND 10),
    src_ip INET NOT NULL,
    event_count INTEGER NOT NULL CHECK (event_count > 0),
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
    evidence JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(evidence) = 'object'),
    dedup_key TEXT NOT NULL CHECK (btrim(dedup_key) <> ''),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    UNIQUE (tenant_id, dedup_key),
    FOREIGN KEY (tenant_id, rule_id) REFERENCES public.alert_rules(tenant_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (tenant_id, acknowledged_by) REFERENCES public.users(tenant_id, id) ON DELETE RESTRICT,
    CHECK (window_end > window_start),
    CHECK (num_nonnulls(acknowledged_by, acknowledged_at) IN (0, 2)),
    CHECK (status <> 'acknowledged' OR acknowledged_at IS NOT NULL),
    CHECK ((status = 'resolved') = (resolved_at IS NOT NULL)),
    CHECK (acknowledged_at IS NULL OR acknowledged_at >= created_at),
    CHECK (resolved_at IS NULL OR resolved_at >= created_at),
    CHECK (masklen(src_ip) = CASE family(src_ip) WHEN 4 THEN 32 ELSE 128 END)
);

CREATE TRIGGER alerts_updated_at BEFORE UPDATE ON public.alerts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.schema_migrations (version) VALUES ('008_create_alerts.sql');
COMMIT;