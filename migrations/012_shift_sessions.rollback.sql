-- Rollback: 012_shift_sessions
-- Elimina la tabla shift_sessions y sus índices

DROP INDEX IF EXISTS idx_shift_sessions_started_at;
DROP INDEX IF EXISTS idx_shift_sessions_status;
DROP INDEX IF EXISTS idx_shift_sessions_operator_id;
DROP INDEX IF EXISTS idx_shift_sessions_machine_id;
DROP TABLE IF EXISTS public.shift_sessions;
