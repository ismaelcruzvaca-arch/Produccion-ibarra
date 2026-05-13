-- Migration: 006_seed_lines_machines
-- Seed initial production lines and machines

-- Production lines
INSERT INTO public.lines (id, name, description, is_active) VALUES
('LINEA-1', 'Línea de Producción 1', 'Línea principal de chocolate', true),
('LINEA-2', 'Línea de Producción 2', 'Línea secundaria', true)
ON CONFLICT (id) DO NOTHING;

-- Machines (Cavemil = Molino industrial)
INSERT INTO public.machines (id, line_id, name, description, is_active) VALUES
('CAVEMIL-01', 'LINEA-1', 'Cavemil 01', 'Molino principal L1', true),
('CAVEMIL-02', 'LINEA-1', 'Cavemil 02', 'Molino secundario L1', true),
('CAVEMIL-03', 'LINEA-1', 'Cavemil 03', 'Molino terciario L1', true),
('CAVEMIL-04', 'LINEA-2', 'Cavemil 04', 'Molino principal L2', true),
('TOSTADOR-01', 'LINEA-1', 'Tostador 01', 'Tostador de cacao L1', true),
('TOSTADOR-02', 'LINEA-2', 'Tostador 02', 'Tostador de cacao L2', true)
ON CONFLICT (id) DO NOTHING;
