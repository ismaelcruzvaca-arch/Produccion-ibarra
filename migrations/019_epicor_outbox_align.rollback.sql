-- Rollback: 019_epicor_outbox_align
-- Revierte todos los cambios de la migración en orden seguro:
--   1. Triggers (dependen de funciones)
--   2. Funciones
--   3. Índices
--   4. Columnas (ALTER TABLE DROP)
--
-- Orden inverso al de creación para evitar errores de dependencia.

-- ================================================================
-- SECTION 1: Triggers
-- ================================================================
DROP TRIGGER IF EXISTS trg_shift_closed_to_epicor ON public.shift_sessions;
DROP TRIGGER IF EXISTS trg_quality_disposition_to_epicor ON public.quality_inspections;

-- ================================================================
-- SECTION 2: Funciones
-- ================================================================
DROP FUNCTION IF EXISTS public.enqueue_shift_closed();
DROP FUNCTION IF EXISTS public.enqueue_quality_disposition();

-- ================================================================
-- SECTION 3: Índices
-- ================================================================
DROP INDEX IF EXISTS idx_epicor_sync_poll;
DROP INDEX IF EXISTS idx_epicor_sync_source;

-- ================================================================
-- SECTION 4: Columnas
-- ================================================================
ALTER TABLE public.epicor_sync_queue
  DROP COLUMN IF EXISTS next_retry_at,
  DROP COLUMN IF EXISTS event_type;
