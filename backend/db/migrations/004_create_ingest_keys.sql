BEGIN;

CREATE TABLE public.ingest_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    name TEXT NOT NULL CHECK (btrim(name) <> ''),
    key_prefix TEXT NOT NULL CHECK (btrim(key_prefix) <> ''),
    key_hash TEXT NOT NULL UNIQUE CHECK (btrim(key_hash) <> ''),
    allowed_sources TEXT[] NOT NULL CHECK (
        cardinality(allowed_sources) > 0
        AND array_position(allowed_sources, NULL) IS NULL
        AND allowed_sources <@ ARRAY['firewall','network','api','crowdstrike','aws','m365','ad']::TEXT[]
    ),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, created_by) REFERENCES public.users(tenant_id, id) ON DELETE RESTRICT,
    CHECK (expires_at IS NULL OR expires_at > created_at),
    CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

INSERT INTO public.schema_migrations (version) VALUES ('004_create_ingest_keys.sql');
COMMIT;