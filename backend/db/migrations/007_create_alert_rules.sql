BEGIN;

CREATE TABLE public.alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    name TEXT NOT NULL CHECK (btrim(name) <> ''),
    description TEXT,
    rule_type TEXT NOT NULL DEFAULT 'failed_login_threshold' CHECK (rule_type = 'failed_login_threshold'),
    threshold INTEGER NOT NULL DEFAULT 5 CHECK (threshold > 0),
    window_seconds INTEGER NOT NULL DEFAULT 300 CHECK (window_seconds > 0),
    cooldown_seconds INTEGER NOT NULL DEFAULT 300 CHECK (cooldown_seconds >= 0),
    severity SMALLINT NOT NULL DEFAULT 5 CHECK (severity BETWEEN 0 AND 10),
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, created_by) REFERENCES public.users(tenant_id, id) ON DELETE RESTRICT
);

CREATE TRIGGER alert_rules_updated_at BEFORE UPDATE ON public.alert_rules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.schema_migrations (version) VALUES ('007_create_alert_rules.sql');
COMMIT;