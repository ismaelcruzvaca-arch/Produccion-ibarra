-- Migration: 011_signatures
-- Creates the signatures table for digital signature capture
-- Mapping: matches ISignature fields with snake_case convention
-- and updated_at/is_deleted for replication support

CREATE TABLE IF NOT EXISTS public.signatures (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type text NOT NULL,
    document_id   text NOT NULL,
    signer_id     text,
    signer_name   text,
    signer_role   text,
    signed_at     bigint NOT NULL DEFAULT 0,
    sequence      integer NOT NULL DEFAULT 0,
    is_deleted    boolean NOT NULL DEFAULT false,
    created_at    bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
    updated_at    bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

-- Indexes for replication checkpoint and document lookups
CREATE INDEX IF NOT EXISTS idx_signatures_doc ON public.signatures(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_signatures_updated ON public.signatures(updated_at);

-- Row-Level Security
ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;

-- RLS: allow all authenticated users for now; can be tightened later
CREATE POLICY signatures_self ON public.signatures
    FOR ALL
    USING (true)
    WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.signatures TO authenticated;

COMMENT ON TABLE public.signatures IS 'Digital signatures for production documents (tap-to-confirm)';
COMMENT ON COLUMN public.signatures.document_type IS 'Discriminator: oee_report, toaster_log, mixing_batch, extractor_check, vitamin_kit, quality_inspection';
COMMENT ON COLUMN public.signatures.document_id IS 'UUID of the signed document';
COMMENT ON COLUMN public.signatures.signer_id IS 'operator_profiles.id of the signer';
COMMENT ON COLUMN public.signatures.signer_name IS 'Denormalized display name (offline availability)';
COMMENT ON COLUMN public.signatures.signer_role IS 'operator | supervisor | admin';
COMMENT ON COLUMN public.signatures.signed_at IS 'Epoch ms when signature was captured';
COMMENT ON COLUMN public.signatures.sequence IS 'Ordinal in multi-signer chain (1st, 2nd, 3rd, 4th)';
