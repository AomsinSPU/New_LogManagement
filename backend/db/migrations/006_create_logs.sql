BEGIN;

CREATE TABLE public.logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    ingest_key_id UUID,
    batch_id UUID,
    event_timestamp TIMESTAMPTZ NOT NULL,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source TEXT NOT NULL CHECK (source IN ('firewall','network','api','crowdstrike','aws','m365','ad')),
    vendor TEXT,
    product TEXT,
    source_event_id TEXT,
    event_type TEXT NOT NULL CHECK (btrim(event_type) <> ''),
    event_subtype TEXT,
    severity SMALLINT CHECK (severity BETWEEN 0 AND 10),
    action TEXT,
    outcome TEXT NOT NULL DEFAULT 'unknown' CHECK (outcome IN ('success','failure','unknown')),
    message TEXT,
    src_ip INET,
    dst_ip INET,
    src_port INTEGER CHECK (src_port BETWEEN 0 AND 65535),
    dst_port INTEGER CHECK (dst_port BETWEEN 0 AND 65535),
    protocol TEXT,
    actor_user TEXT,
    host TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(metadata) = 'object'),
    raw TEXT NOT NULL CHECK (btrim(raw) <> ''),
    tags TEXT[] NOT NULL DEFAULT '{}'::TEXT[] CHECK (array_position(tags, NULL) IS NULL),
    normalizer_version INTEGER NOT NULL DEFAULT 1 CHECK (normalizer_version > 0),
    search_vector TSVECTOR GENERATED ALWAYS AS
        (to_tsvector('simple'::regconfig, coalesce(message, ''))) STORED,
    FOREIGN KEY (tenant_id, ingest_key_id) REFERENCES public.ingest_keys(tenant_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (tenant_id, batch_id) REFERENCES public.ingestion_batches(tenant_id, id) ON DELETE RESTRICT,
    CHECK (src_ip IS NULL OR masklen(src_ip) = CASE family(src_ip) WHEN 4 THEN 32 ELSE 128 END),
    CHECK (dst_ip IS NULL OR masklen(dst_ip) = CASE family(dst_ip) WHEN 4 THEN 32 ELSE 128 END)
);

INSERT INTO public.schema_migrations (version) VALUES ('006_create_logs.sql');
COMMIT;