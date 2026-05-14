-- Migration: 006_seed_lines_machines
-- Seed initial production lines and machines with deterministic UUIDs (v5)

-- Production lines
INSERT INTO public.lines (id, name, description, is_active) VALUES
('93054368-92ea-5bb8-acd0-2993da58f7c9', 'Línea de Producción 1', 'Línea principal de chocolate', true),
('29730cb3-ee44-5e63-aa62-cab4e62e399d', 'Línea de Producción 2', 'Línea secundaria', true)
ON CONFLICT (id) DO NOTHING;

-- Machines (Cavemil = Molino industrial)
INSERT INTO public.machines (id, line_id, name, description, is_active) VALUES
('a1ca844e-7690-527c-b10a-5e22610e3ef1', '93054368-92ea-5bb8-acd0-2993da58f7c9', 'Cavemil 01', 'Molino principal L1', true),
('21f5e0c0-ec24-5f85-8f08-3261f9f4538b', '93054368-92ea-5bb8-acd0-2993da58f7c9', 'Cavemil 02', 'Molino secundario L1', true),
('415c3fb5-be74-56b9-852f-9057597634c9', '93054368-92ea-5bb8-acd0-2993da58f7c9', 'Cavemil 03', 'Molino terciario L1', true),
('17ea03ad-32cc-5c8a-96c9-0ee681f4fb54', '29730cb3-ee44-5e63-aa62-cab4e62e399d', 'Cavemil 04', 'Molino principal L2', true),
('d5646228-8cc5-5010-b45c-82e773c5ebf6', '93054368-92ea-5bb8-acd0-2993da58f7c9', 'Tostador 01', 'Tostador de cacao L1', true),
('75a5f0a8-5e87-5f43-9d47-d3e6bbd475ff', '29730cb3-ee44-5e63-aa62-cab4e62e399d', 'Tostador 02', 'Tostador de cacao L2', true)
ON CONFLICT (id) DO NOTHING;
