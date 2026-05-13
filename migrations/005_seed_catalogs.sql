-- Migration: 005_seed_catalogs
-- Seed catalog data from Phase 2 static catalogs

-- Stop reasons (19 reasons from PARO_REASONS)
INSERT INTO public.stop_reasons (code, label, category, macro, stops_line, sort_order) VALUES
('FMP',  'Falta materia prima',           'produccion',    'PROD',  true,  1),
('AT',   'Arranque de turno',             'produccion',    'PROD',  false, 2),
('FME',  'Falta material empaque',        'produccion',    'PROD',  true,  3),
('AO',   'Ajuste de operación',           'produccion',    'PROD',  false, 4),
('CP',   'Cambio de presentación',        'produccion',    'PROD',  true,  5),
('CN',   'Cambio de nomenclatura',        'produccion',    'PROD',  true,  6),
('EQ',   'Espera de químico',             'produccion',    'PROD',  false, 7),
('FC',   'Falla de Cavemil',              'mantenimiento', 'MTTO',  true,  8),
('FS',   'Falla de Servicios',            'mantenimiento', 'MTTO',  true,  9),
('FM',   'Falla de molino',               'mantenimiento', 'MTTO',  true,  10),
('FT',   'Falla de tostador',             'mantenimiento', 'MTTO',  true,  11),
('MC',   'Mantenimiento correctivo',      'mantenimiento', 'MTTO',  true,  12),
('MP',   'Mantenimiento preventivo',      'mantenimiento', 'MTTO',  true,  13),
('RCC',  'Retrabajo por calidad',         'calidad',       'OTROS', true,  14),
('AC',   'Ajuste de calidad',             'calidad',       'OTROS', false, 15),
('EMC',  'Evaluación material cliente',   'calidad',       'OTROS', true,  16),
('IS',   'Incidente de seguridad',        'seguridad',     'OTROS', true,  17),
('EP',   'Ejercicio de protección civil', 'seguridad',     'OTROS', true,  18),
('FPRH', 'Falta personal (RH)',           'otros',         'OTROS', true,  19),
('DALM', 'Demora almacén',                'otros',         'OTROS', true,  20),
('CAP',  'Capacitación',                  'otros',         'OTROS', true,  21),
('LIM',  'Limpieza general',              'otros',         'OTROS', false, 22),
('REU',  'Reunión / Junta',               'otros',         'OTROS', true,  23)
ON CONFLICT (code) DO NOTHING;

-- Products
INSERT INTO public.products (id, code, name, theoretical_ppm) VALUES
('1', 'CHOC-500', 'Chocolate 500g', 2.5),
('2', 'CHOC-250', 'Chocolate 250g', 3.0)
ON CONFLICT (code) DO NOTHING;

-- Shifts
INSERT INTO public.shifts (id, label, start_hour, end_hour) VALUES
('1', 'Turno 1 (06-14)', 6,  14),
('2', 'Turno 2 (14-22)', 14, 22),
('3', 'Turno 3 (22-06)', 22, 6)
ON CONFLICT (id) DO NOTHING;
