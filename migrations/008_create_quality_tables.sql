-- Migration 008: Create quality tables
-- quality_inspections, defect_logs, weight_logs

CREATE TABLE IF NOT EXISTS public.quality_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id text NOT NULL,
  operator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  inspector_id text,
  shift_id text,
  product_code text,
  batch_id text,
  result text DEFAULT 'pending' CHECK (result IN ('pass', 'fail', 'pending')),
  inspected_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  notes text,
  created_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  is_deleted boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.defect_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid REFERENCES public.quality_inspections(id) ON DELETE CASCADE,
  line_id text NOT NULL,
  operator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  shift_id text,
  defect_type text NOT NULL,
  defect_code text,
  quantity integer NOT NULL DEFAULT 1,
  severity text DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  position text,
  notes text,
  registered_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  is_deleted boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.weight_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid REFERENCES public.quality_inspections(id) ON DELETE CASCADE,
  line_id text NOT NULL,
  operator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  shift_id text,
  product_code text,
  target_weight numeric(10,2) NOT NULL,
  actual_weight numeric(10,2) NOT NULL,
  tolerance numeric(10,2) DEFAULT 0,
  unit text DEFAULT 'g',
  deviation numeric(10,2) GENERATED ALWAYS AS (actual_weight - target_weight) STORED,
  result text DEFAULT 'pass' CHECK (result IN ('pass', 'fail')),
  registered_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  is_deleted boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_quality_inspections_line ON public.quality_inspections(line_id);
CREATE INDEX IF NOT EXISTS idx_quality_inspections_date ON public.quality_inspections(inspected_at DESC);
CREATE INDEX IF NOT EXISTS idx_defect_logs_inspection ON public.defect_logs(inspection_id);
CREATE INDEX IF NOT EXISTS idx_defect_logs_line ON public.defect_logs(line_id);
CREATE INDEX IF NOT EXISTS idx_weight_logs_inspection ON public.weight_logs(inspection_id);
CREATE INDEX IF NOT EXISTS idx_weight_logs_line ON public.weight_logs(line_id);

-- Enable RLS
ALTER TABLE public.quality_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defect_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;
