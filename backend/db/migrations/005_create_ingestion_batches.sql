BEGIN;

CREATE TABLE public.ingestion_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    ingest_key_id UUID,
    submitted_by UUID,
    source TEXT NOT NULL CHECK (source IN ('firewall','network','api','crowdstrike','aws','m365','ad')),
    filename TEXT,
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','completed','partial','failed')),
    total_count INTEGER NOT NULL DEFAULT 0 CHECK (total_count >= 0),
    accepted_count INTEGER NOT NULL DEFAULT 0 CHECK (accepted_count >= 0),
    rejected_count INTEGER NOT NULL DEFAULT 0 CHECK (rejected_count >= 0),
    error_summary JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(error_summary) = 'array'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, ingest_key_id) REFERENCES public.ingest_keys(tenant_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (tenant_id, submitted_by) REFERENCES public.users(tenant_id, id) ON DELETE RESTRICT,
    CHECK (num_nonnulls(ingest_key_id, submitted_by) = 1),
    CHECK (accepted_count::BIGINT + rejected_count <= total_count),
    CHECK ((status = 'processing' AND completed_at IS NULL) OR
           (status <> 'processing' AND completed_at IS NOT NULL)),
    CHECK (completed_at IS NULL OR completed_at >= created_at),
    CHECK (status <> 'completed' OR (accepted_count = total_count AND rejected_count = 0)),
    CHECK (status <> 'partial' OR (accepted_count > 0 AND rejected_count > 0
           AND accepted_count::BIGINT + rejected_count = total_count))
);

CREATE INDEX ingestion_batches_tenant_time_idx ON public.ingestion_batches(tenant_id, created_at DESC);

INSERT INTO public.schema_migrations (version) VALUES ('005_create_ingestion_batches.sql');
COMMIT;