-- Migration: 012_shift_sessions
-- Tabla transaccional de sesiones de turno
-- Registra qué operador está / estuvo en qué máquina durante qué turno
--
-- Dependencias: public.machines, public.operators
--
-- Nota de diseño:
--   Esta es la tabla más importante para la operación diaria.
--   Todos los eventos de telemetría (Frente C) y calidad (Frente A) se
--   colgarán de la sesión activa para trazar quién produjo qué.
--
--   status = 'active' → sesión en curso (solo una por máquina a la vez)
--   status = 'closed' → sesión finalizada, ended_at se llena automáticamente
--
--   El operador abre la sesión al iniciar turno y la cierra al terminar.

CREATE TABLE IF NOT EXISTS public.shift_sessions (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id      UUID            NOT NULL REFERENCES public.machines(id),
    operator_id     VARCHAR(50)     NOT NULL REFERENCES public.operators(id),
    shift_type      VARCHAR(20)     NOT NULL CHECK (shift_type IN ('matutino', 'vespertino', 'nocturno')),
    status          VARCHAR(20)     NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    started_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    ended_at        TIMESTAMPTZ
);

COMMENT ON TABLE public.shift_sessions IS
    'Sesiones de turno — relaciona operador ↔ máquina ↔ turno';
COMMENT ON COLUMN public.shift_sessions.machine_id IS
    'Máquina asignada durante la sesión';
COMMENT ON COLUMN public.shift_sessions.operator_id IS
    'Operador que trabajó la sesión (código de nómina)';
COMMENT ON COLUMN public.shift_sessions.shift_type IS
    'Tipo de turno: matutino, vespertino, nocturno';
COMMENT ON COLUMN public.shift_sessions.status IS
    'Estado de la sesión: active (en curso) o closed (finalizada)';
COMMENT ON COLUMN public.shift_sessions.started_at IS
    'Momento en que el operador inició la sesión';
COMMENT ON COLUMN public.shift_sessions.ended_at IS
    'Momento en que el operador cerró la sesión (NULL si activa)';

-- Índices críticos para rendimiento analítico
CREATE INDEX IF NOT EXISTS idx_shift_sessions_machine_id
    ON public.shift_sessions(machine_id);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_operator_id
    ON public.shift_sessions(operator_id);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_status
    ON public.shift_sessions(status);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_started_at
    ON public.shift_sessions(started_at DESC);
